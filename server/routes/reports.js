const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const pool = require('../config/database');
const { successResponse, errorResponse, getWeekRange, getLastWeekRange } = require('../utils/helpers');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    const stats = {};

    if (userRole === 'admin') {
      const [userStats] = await pool.execute(
        `SELECT 
          COUNT(*) as total_users,
          SUM(CASE WHEN role_id = 2 THEN 1 ELSE 0 END) as manager_count,
          SUM(CASE WHEN role_id = 3 THEN 1 ELSE 0 END) as member_count,
          SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as active_users
         FROM users`
      );
      stats.users = userStats[0];

      const [projectStats] = await pool.execute(
        `SELECT 
          COUNT(*) as total_projects,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_projects,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_projects
         FROM projects`
      );
      stats.projects = projectStats[0];

      const [taskStats] = await pool.execute(
        `SELECT 
          COUNT(*) as total_tasks,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_tasks,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_tasks
         FROM tasks`
      );
      stats.tasks = taskStats[0];

      const [overdueTasks] = await pool.execute(
        `SELECT COUNT(*) as count FROM tasks 
         WHERE status != 'completed' AND deadline < CURDATE()`
      );
      stats.overdue_tasks = overdueTasks[0].count;

    } else if (userRole === 'manager') {
      const [projectStats] = await pool.execute(
        `SELECT 
          COUNT(*) as total_projects,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_projects,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_projects
         FROM projects WHERE manager_id = ?`,
        [userId]
      );
      stats.projects = projectStats[0];

      const [taskStats] = await pool.execute(
        `SELECT 
          COUNT(*) as total_tasks,
          SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) as pending_tasks,
          SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
          SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
          SUM(CASE WHEN t.status = 'rejected' THEN 1 ELSE 0 END) as rejected_tasks
         FROM tasks t 
         LEFT JOIN projects p ON t.project_id = p.id 
         WHERE p.manager_id = ? OR t.creator_id = ?`,
        [userId, userId]
      );
      stats.tasks = taskStats[0];

      const [pendingLogs] = await pool.execute(
        `SELECT COUNT(*) as count 
         FROM work_logs wl 
         LEFT JOIN tasks t ON wl.task_id = t.id 
         LEFT JOIN projects p ON t.project_id = p.id 
         WHERE wl.status = 'submitted' AND (p.manager_id = ? OR t.creator_id = ?)`,
        [userId, userId]
      );
      stats.pending_logs = pendingLogs[0].count;

      const [overdueTasks] = await pool.execute(
        `SELECT COUNT(*) as count 
         FROM tasks t 
         LEFT JOIN projects p ON t.project_id = p.id 
         WHERE t.status != 'completed' AND t.deadline < CURDATE() 
           AND (p.manager_id = ? OR t.creator_id = ?)`,
        [userId, userId]
      );
      stats.overdue_tasks = overdueTasks[0].count;

    } else {
      const [taskStats] = await pool.execute(
        `SELECT 
          COUNT(*) as total_tasks,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_tasks,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_tasks
         FROM tasks WHERE assignee_id = ?`,
        [userId]
      );
      stats.tasks = taskStats[0];

      const [workStats] = await pool.execute(
        `SELECT 
          COUNT(*) as total_logs,
          COALESCE(SUM(hours), 0) as total_hours,
          SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_logs,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_logs
         FROM work_logs WHERE user_id = ?`,
        [userId]
      );
      stats.work_logs = workStats[0];

      const [weekHours] = await pool.execute(
        `SELECT COALESCE(SUM(hours), 0) as total 
         FROM work_logs 
         WHERE user_id = ? AND work_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`,
        [userId]
      );
      stats.week_hours = weekHours[0].total;
    }

    successResponse(res, stats);
  } catch (err) {
    console.error('获取看板数据错误:', err);
    errorResponse(res, '获取看板数据失败', 500);
  }
});

router.get('/user-work-hours', roleMiddleware('admin', 'manager'), async (req, res) => {
  try {
    const { start_date, end_date, department = '' } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    let sql = `SELECT 
                 u.id,
                 u.username,
                 u.real_name,
                 u.department,
                 r.name as role_name,
                 COALESCE(SUM(wl.hours), 0) as total_hours,
                 COUNT(DISTINCT wl.task_id) as task_count,
                 COUNT(wl.id) as log_count
               FROM users u
               LEFT JOIN work_logs wl ON u.id = wl.user_id
               LEFT JOIN roles r ON u.role_id = r.id
               LEFT JOIN tasks t ON wl.task_id = t.id
               LEFT JOIN projects p ON t.project_id = p.id
               WHERE r.name = 'member'`;
    const params = [];

    if (userRole === 'manager') {
      sql += ' AND p.manager_id = ?';
      params.push(userId);
    }

    if (start_date) {
      sql += ' AND wl.work_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND wl.work_date <= ?';
      params.push(end_date);
    }
    if (department) {
      sql += ' AND u.department = ?';
      params.push(department);
    }

    sql += ' GROUP BY u.id, u.username, u.real_name, u.department, r.name ORDER BY total_hours DESC';

    const [rows] = await pool.execute(sql, params);
    successResponse(res, rows);
  } catch (err) {
    console.error('获取成员工时统计错误:', err);
    errorResponse(res, '获取工时统计失败', 500);
  }
});

router.get('/project-progress', roleMiddleware('admin', 'manager'), async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let sql = `SELECT 
                 p.id,
                 p.name,
                 p.status,
                 p.manager_id,
                 u.real_name as manager_name,
                 COUNT(t.id) as total_tasks,
                 SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
                 COALESCE(SUM(t.estimated_hours), 0) as estimated_hours,
                 COALESCE(SUM(t.actual_hours), 0) as actual_hours
               FROM projects p
               LEFT JOIN tasks t ON p.id = t.project_id
               LEFT JOIN users u ON p.manager_id = u.id
               WHERE 1=1`;
    const params = [];

    if (userRole === 'manager') {
      sql += ' AND p.manager_id = ?';
      params.push(userId);
    }

    sql += ' GROUP BY p.id, p.name, p.status, p.manager_id, u.real_name ORDER BY p.id DESC';

    const [projects] = await pool.execute(sql, params);

    const result = projects.map(p => ({
      ...p,
      progress: p.total_tasks > 0 ? Math.round((p.completed_tasks / p.total_tasks) * 100) : 0
    }));

    successResponse(res, result);
  } catch (err) {
    console.error('获取项目进度错误:', err);
    errorResponse(res, '获取项目进度失败', 500);
  }
});

router.get('/task-trend', async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const days = parseInt(req.query.days || 7);

    const dateList = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dateList.push(date.toISOString().split('T')[0]);
    }

    const result = [];
    for (const date of dateList) {
      let sql = `SELECT COUNT(*) as count FROM tasks WHERE DATE(created_at) = ?`;
      let params = [date];

      if (userRole === 'manager') {
        sql += ' AND creator_id = ?';
        params.push(userId);
      } else if (userRole === 'member') {
        sql += ' AND assignee_id = ?';
        params.push(userId);
      }

      const [rows] = await pool.execute(sql, params);

      let completedSql = `SELECT COUNT(*) as count FROM tasks WHERE DATE(completed_at) = ?`;
      let completedParams = [date];

      if (userRole === 'manager') {
        completedSql += ' AND creator_id = ?';
        completedParams.push(userId);
      } else if (userRole === 'member') {
        completedSql += ' AND assignee_id = ?';
        completedParams.push(userId);
      }

      const [completedRows] = await pool.execute(completedSql, completedParams);

      result.push({
        date,
        created: rows[0].count,
        completed: completedRows[0].count
      });
    }

    successResponse(res, result);
  } catch (err) {
    console.error('获取任务趋势错误:', err);
    errorResponse(res, '获取任务趋势失败', 500);
  }
});

router.get('/export/work-logs', roleMiddleware('admin', 'manager'), async (req, res) => {
  try {
    const { start_date, end_date, user_id, project_id, status } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    let sql = `SELECT 
                 wl.id,
                 wl.work_date,
                 u.real_name as user_name,
                 u.department,
                 p.name as project_name,
                 t.name as task_name,
                 wl.hours,
                 wl.log_content,
                 wl.status,
                 wl.created_at
               FROM work_logs wl
               LEFT JOIN tasks t ON wl.task_id = t.id
               LEFT JOIN projects p ON t.project_id = p.id
               LEFT JOIN users u ON wl.user_id = u.id
               WHERE 1=1`;
    const params = [];

    if (userRole === 'manager') {
      sql += ' AND p.manager_id = ?';
      params.push(userId);
    }

    if (start_date) {
      sql += ' AND wl.work_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND wl.work_date <= ?';
      params.push(end_date);
    }
    if (user_id) {
      sql += ' AND wl.user_id = ?';
      params.push(user_id);
    }
    if (project_id) {
      sql += ' AND t.project_id = ?';
      params.push(project_id);
    }
    if (status) {
      sql += ' AND wl.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY wl.work_date DESC, wl.created_at DESC';

    const [rows] = await pool.execute(sql, params);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('工时记录');

    worksheet.columns = [
      { header: '序号', key: 'no', width: 8 },
      { header: '日期', key: 'work_date', width: 12 },
      { header: '姓名', key: 'user_name', width: 12 },
      { header: '部门', key: 'department', width: 12 },
      { header: '项目', key: 'project_name', width: 20 },
      { header: '任务', key: 'task_name', width: 25 },
      { header: '工时(h)', key: 'hours', width: 10 },
      { header: '工作内容', key: 'log_content', width: 50 },
      { header: '状态', key: 'status', width: 10 }
    ];

    const statusMap = {
      submitted: '已提交',
      approved: '已通过',
      rejected: '已驳回'
    };

    rows.forEach((row, index) => {
      worksheet.addRow({
        no: index + 1,
        work_date: row.work_date,
        user_name: row.user_name,
        department: row.department || '-',
        project_name: row.project_name,
        task_name: row.task_name,
        hours: row.hours,
        log_content: row.log_content,
        status: statusMap[row.status] || row.status
      });
    });

    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    worksheet.eachRow(row => row.alignment = { vertical: 'middle', wrapText: true });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=work_logs.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('导出工时记录错误:', err);
    errorResponse(res, '导出失败', 500);
  }
});

router.get('/export/user-hours', roleMiddleware('admin', 'manager'), async (req, res) => {
  try {
    const { start_date, end_date, department } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    let sql = `SELECT 
                 u.id,
                 u.real_name,
                 u.username,
                 u.department,
                 COALESCE(SUM(wl.hours), 0) as total_hours,
                 COUNT(DISTINCT wl.task_id) as task_count,
                 COUNT(wl.id) as log_count
               FROM users u
               LEFT JOIN work_logs wl ON u.id = wl.user_id
               LEFT JOIN roles r ON u.role_id = r.id
               LEFT JOIN tasks t ON wl.task_id = t.id
               LEFT JOIN projects p ON t.project_id = p.id
               WHERE r.name = 'member'`;
    const params = [];

    if (userRole === 'manager') {
      sql += ' AND p.manager_id = ?';
      params.push(userId);
    }

    if (start_date) {
      sql += ' AND wl.work_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND wl.work_date <= ?';
      params.push(end_date);
    }
    if (department) {
      sql += ' AND u.department = ?';
      params.push(department);
    }

    sql += ' GROUP BY u.id, u.real_name, u.username, u.department ORDER BY total_hours DESC';

    const [rows] = await pool.execute(sql, params);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('成员工时统计');

    worksheet.columns = [
      { header: '序号', key: 'no', width: 8 },
      { header: '姓名', key: 'real_name', width: 12 },
      { header: '用户名', key: 'username', width: 15 },
      { header: '部门', key: 'department', width: 15 },
      { header: '总工时(h)', key: 'total_hours', width: 12 },
      { header: '任务数', key: 'task_count', width: 10 },
      { header: '工时记录数', key: 'log_count', width: 12 }
    ];

    rows.forEach((row, index) => {
      worksheet.addRow({
        no: index + 1,
        real_name: row.real_name,
        username: row.username,
        department: row.department || '-',
        total_hours: row.total_hours,
        task_count: row.task_count,
        log_count: row.log_count
      });
    });

    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    worksheet.eachRow(row => row.alignment = { vertical: 'middle' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=user_hours_report.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('导出成员工时统计错误:', err);
    errorResponse(res, '导出失败', 500);
  }
});

module.exports = router;
