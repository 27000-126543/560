const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { successResponse, errorResponse, validateWorkHours, addActivity, addNotification } = require('../utils/helpers');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const { workLogValidation, rejectValidation } = require('../middleware/validation');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      page_size = 10,
      user_id = '',
      task_id = '',
      project_id = '',
      date_from = '',
      date_to = '',
      status = ''
    } = req.query;
    const offset = (page - 1) * page_size;
    const userId = req.user.id;
    const userRole = req.user.role;

    let sql = `SELECT wl.*, t.name as task_name, p.name as project_name, u.real_name as user_name 
               FROM work_logs wl 
               LEFT JOIN tasks t ON wl.task_id = t.id 
               LEFT JOIN projects p ON t.project_id = p.id 
               LEFT JOIN users u ON wl.user_id = u.id 
               WHERE 1=1`;
    const params = [];

    if (userRole === 'member') {
      sql += ' AND wl.user_id = ?';
      params.push(userId);
    } else if (userRole === 'manager') {
      sql += ' AND p.manager_id = ?';
      params.push(userId);
    }

    if (user_id) {
      sql += ' AND wl.user_id = ?';
      params.push(user_id);
    }
    if (task_id) {
      sql += ' AND wl.task_id = ?';
      params.push(task_id);
    }
    if (project_id) {
      sql += ' AND t.project_id = ?';
      params.push(project_id);
    }
    if (date_from) {
      sql += ' AND wl.work_date >= ?';
      params.push(date_from);
    }
    if (date_to) {
      sql += ' AND wl.work_date <= ?';
      params.push(date_to);
    }
    if (status) {
      sql += ' AND wl.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY wl.work_date DESC, wl.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(page_size), parseInt(offset));

    const [workLogs] = await pool.execute(sql, params);

    let countSql = `SELECT COUNT(*) as total 
                    FROM work_logs wl 
                    LEFT JOIN tasks t ON wl.task_id = t.id 
                    LEFT JOIN projects p ON t.project_id = p.id 
                    WHERE 1=1`;
    const countParams = [];

    if (userRole === 'member') {
      countSql += ' AND wl.user_id = ?';
      countParams.push(userId);
    } else if (userRole === 'manager') {
      countSql += ' AND p.manager_id = ?';
      countParams.push(userId);
    }

    if (user_id) {
      countSql += ' AND wl.user_id = ?';
      countParams.push(user_id);
    }
    if (task_id) {
      countSql += ' AND wl.task_id = ?';
      countParams.push(task_id);
    }
    if (project_id) {
      countSql += ' AND t.project_id = ?';
      countParams.push(project_id);
    }
    if (date_from) {
      countSql += ' AND wl.work_date >= ?';
      countParams.push(date_from);
    }
    if (date_to) {
      countSql += ' AND wl.work_date <= ?';
      countParams.push(date_to);
    }
    if (status) {
      countSql += ' AND wl.status = ?';
      countParams.push(status);
    }

    const [countResult] = await pool.execute(countSql, countParams);

    successResponse(res, {
      list: workLogs,
      total: countResult[0].total,
      page: parseInt(page),
      page_size: parseInt(page_size)
    });
  } catch (err) {
    console.error('获取工时记录错误:', err);
    errorResponse(res, '获取工时记录失败', 500);
  }
});

router.get('/my-logs', async (req, res) => {
  try {
    const { date_from = '', date_to = '', status = '' } = req.query;
    const userId = req.user.id;

    let sql = `SELECT wl.*, t.name as task_name, p.name as project_name 
               FROM work_logs wl 
               LEFT JOIN tasks t ON wl.task_id = t.id 
               LEFT JOIN projects p ON t.project_id = p.id 
               WHERE wl.user_id = ?`;
    const params = [userId];

    if (date_from) {
      sql += ' AND wl.work_date >= ?';
      params.push(date_from);
    }
    if (date_to) {
      sql += ' AND wl.work_date <= ?';
      params.push(date_to);
    }
    if (status) {
      sql += ' AND wl.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY wl.work_date DESC, wl.created_at DESC';

    const [workLogs] = await pool.execute(sql, params);
    successResponse(res, workLogs);
  } catch (err) {
    console.error('获取我的工时记录错误:', err);
    errorResponse(res, '获取工时记录失败', 500);
  }
});

router.get('/calendar', async (req, res) => {
  try {
    const { month, user_id = '' } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!month) {
      return errorResponse(res, '请提供月份参数，格式：YYYY-MM');
    }

    const yearMonth = month.split('-');
    if (yearMonth.length !== 2) {
      return errorResponse(res, '月份格式错误，请使用 YYYY-MM 格式');
    }

    const startDate = `${month}-01`;
    const endDate = new Date(yearMonth[0], yearMonth[1], 0).toISOString().split('T')[0];

    let sql = `SELECT 
                 wl.work_date,
                 COALESCE(SUM(wl.hours), 0) as total_hours,
                 COALESCE(SUM(CASE WHEN wl.status = 'approved' THEN wl.hours ELSE 0 END), 0) as approved_hours,
                 COALESCE(SUM(CASE WHEN wl.status = 'submitted' THEN wl.hours ELSE 0 END), 0) as submitted_hours,
                 COALESCE(SUM(CASE WHEN wl.status = 'rejected' THEN 1 ELSE 0 END), 0) as rejected_count,
                 COUNT(wl.id) as log_count
               FROM work_logs wl
               LEFT JOIN tasks t ON wl.task_id = t.id
               LEFT JOIN projects p ON t.project_id = p.id
               WHERE wl.work_date >= ? AND wl.work_date <= ?`;
    const params = [startDate, endDate];

    if (user_id && (userRole === 'admin' || userRole === 'manager')) {
      sql += ' AND wl.user_id = ?';
      params.push(user_id);
    } else if (userRole === 'member') {
      sql += ' AND wl.user_id = ?';
      params.push(userId);
    } else if (userRole === 'manager') {
      sql += ' AND p.manager_id = ?';
      params.push(userId);
    }

    sql += ' GROUP BY wl.work_date ORDER BY wl.work_date ASC';

    const [rows] = await pool.execute(sql, params);

    const result = {};
    rows.forEach(row => {
      result[row.work_date] = {
        total_hours: parseFloat(row.total_hours),
        approved_hours: parseFloat(row.approved_hours),
        submitted_hours: parseFloat(row.submitted_hours),
        rejected_count: parseInt(row.rejected_count),
        log_count: parseInt(row.log_count)
      };
    });

    successResponse(res, result);
  } catch (err) {
    console.error('获取日历工时统计错误:', err);
    errorResponse(res, '获取日历数据失败', 500);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const logId = req.params.id;

    let sql = `SELECT wl.*, t.name as task_name, p.name as project_name, u.real_name as user_name 
               FROM work_logs wl 
               LEFT JOIN tasks t ON wl.task_id = t.id 
               LEFT JOIN projects p ON t.project_id = p.id 
               LEFT JOIN users u ON wl.user_id = u.id 
               WHERE wl.id = ?`;
    const params = [logId];

    if (userRole === 'member') {
      sql += ' AND wl.user_id = ?';
      params.push(userId);
    } else if (userRole === 'manager') {
      sql += ' AND p.manager_id = ?';
      params.push(userId);
    }

    const [workLogs] = await pool.execute(sql, params);

    if (workLogs.length === 0) {
      return errorResponse(res, '工时记录不存在或无权访问', 404);
    }

    successResponse(res, workLogs[0]);
  } catch (err) {
    console.error('获取工时记录详情错误:', err);
    errorResponse(res, '获取工时记录失败', 500);
  }
});

router.post('/', workLogValidation, async (req, res) => {
  try {
    const { task_id, work_date, hours, log_content } = req.body;
    const userId = req.user.id;

    const validation = validateWorkHours(parseFloat(hours));
    if (!validation.valid) {
      return errorResponse(res, validation.message);
    }

    const [tasks] = await pool.execute(`
      SELECT t.*, p.manager_id 
      FROM tasks t 
      LEFT JOIN projects p ON t.project_id = p.id 
      WHERE t.id = ?
    `, [task_id]);
    if (tasks.length === 0) {
      return errorResponse(res, '任务不存在');
    }

    if (tasks[0].assignee_id !== userId && req.user.role === 'member') {
      return errorResponse(res, '只能为分配给自己的任务填报工时', 403);
    }

    const [dayLogs] = await pool.execute(
      'SELECT COALESCE(SUM(hours), 0) as total_hours FROM work_logs WHERE user_id = ? AND work_date = ?',
      [userId, work_date]
    );

    const totalHoursForDay = parseFloat(dayLogs[0].total_hours) + parseFloat(hours);
    if (totalHoursForDay > 24) {
      return errorResponse(res, '当日总工时不能超过24小时');
    }

    const [result] = await pool.execute(
      'INSERT INTO work_logs (task_id, user_id, work_date, hours, log_content) VALUES (?, ?, ?, ?, ?)',
      [task_id, userId, work_date, hours, log_content]
    );

    await pool.execute(
      'UPDATE tasks SET actual_hours = COALESCE(actual_hours, 0) + ? WHERE id = ?',
      [hours, task_id]
    );

    const workLogId = result.insertId;
    
    addActivity(task_id, userId, 'worklog_submit', `提交了工时记录：${hours}小时，${log_content || '无描述'}`, {
      work_log_id: workLogId,
      hours: hours,
      work_date: work_date
    });
    
    const task = tasks[0];
    if (task.manager_id && task.manager_id !== userId) {
      addNotification(task.manager_id, 'worklog_submit', '工时提交待审核', `成员提交了工时：${hours}小时，任务「${task.name}」`, workLogId, 'worklog');
    }

    successResponse(res, { id: workLogId }, '工时记录提交成功');
  } catch (err) {
    console.error('提交工时记录错误:', err);
    errorResponse(res, '提交工时记录失败', 500);
  }
});

router.put('/:id', async (req, res) => {
  try {
    const logId = req.params.id;
    const { work_date, hours, log_content } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    const [workLogs] = await pool.execute('SELECT * FROM work_logs WHERE id = ?', [logId]);
    if (workLogs.length === 0) {
      return errorResponse(res, '工时记录不存在', 404);
    }

    const log = workLogs[0];

    if (userRole === 'member' && log.user_id !== userId) {
      return errorResponse(res, '无权修改此工时记录', 403);
    }

    if (userRole === 'member' && log.status === 'submitted') {
      return errorResponse(res, '已提交待审核的工时记录不能修改，请等待审核或被驳回后再修改', 403);
    }

    if (log.status === 'approved') {
      return errorResponse(res, '已审核通过的工时记录不能修改');
    }

    const oldHours = parseFloat(log.hours);
    const wasCounted = log.status === 'submitted' || log.status === 'approved';
    const wasRejected = log.status === 'rejected';

    if (hours !== undefined) {
      const validation = validateWorkHours(parseFloat(hours));
      if (!validation.valid) {
        return errorResponse(res, validation.message);
      }

      const checkDate = work_date || log.work_date;
      const [dayLogs] = await pool.execute(
        'SELECT COALESCE(SUM(hours), 0) as total_hours FROM work_logs WHERE user_id = ? AND work_date = ? AND id != ? AND status != ?',
        [log.user_id, checkDate, logId, 'rejected']
      );

      const totalHoursForDay = parseFloat(dayLogs[0].total_hours) + parseFloat(hours);
      if (totalHoursForDay > 24) {
        return errorResponse(res, '当日总工时不能超过24小时');
      }

      if (wasCounted) {
        const hoursDiff = parseFloat(hours) - oldHours;
        await pool.execute(
          'UPDATE tasks SET actual_hours = GREATEST(0, COALESCE(actual_hours, 0) + ?) WHERE id = ?',
          [hoursDiff, log.task_id]
        );
      } else {
        await pool.execute(
          'UPDATE tasks SET actual_hours = COALESCE(actual_hours, 0) + ? WHERE id = ?',
          [parseFloat(hours), log.task_id]
        );
      }
    } else if (wasRejected) {
      const checkDate = work_date || log.work_date;
      const [dayLogs] = await pool.execute(
        'SELECT COALESCE(SUM(hours), 0) as total_hours FROM work_logs WHERE user_id = ? AND work_date = ? AND id != ? AND status != ?',
        [log.user_id, checkDate, logId, 'rejected']
      );

      const totalHoursForDay = parseFloat(dayLogs[0].total_hours) + oldHours;
      if (totalHoursForDay > 24) {
        return errorResponse(res, '当日总工时不能超过24小时');
      }

      await pool.execute(
        'UPDATE tasks SET actual_hours = COALESCE(actual_hours, 0) + ? WHERE id = ?',
        [oldHours, log.task_id]
      );
    }

    await pool.execute(
      'UPDATE work_logs SET work_date = ?, hours = ?, log_content = ?, status = ?, reject_reason = NULL WHERE id = ?',
      [
        work_date || log.work_date,
        hours !== undefined ? hours : log.hours,
        log_content !== undefined ? log_content : log.log_content,
        'submitted',
        logId
      ]
    );
    
    const finalHours = hours !== undefined ? parseFloat(hours) : oldHours;
    const finalDate = work_date || log.work_date;
    const finalContent = log_content !== undefined ? log_content : log.log_content;
    
    const activityText = wasRejected ? '重新提交了工时记录' : '更新了工时记录';
    addActivity(log.task_id, userId, 'worklog_submit', `${activityText}：${finalHours}小时，${finalContent || '无描述'}`, {
      work_log_id: logId,
      hours: finalHours,
      work_date: finalDate
    });
    
    if (wasRejected) {
      const [taskInfo] = await pool.execute(`
        SELECT t.*, p.manager_id 
        FROM tasks t 
        LEFT JOIN projects p ON t.project_id = p.id 
        WHERE t.id = ?
      `, [log.task_id]);
      
      if (taskInfo.length > 0 && taskInfo[0].manager_id && taskInfo[0].manager_id !== userId) {
        addNotification(taskInfo[0].manager_id, 'worklog_submit', '工时提交待审核', 
          `成员重新提交了工时：${finalHours}小时，任务「${taskInfo[0].name}」`, logId, 'worklog');
      }
    }

    successResponse(res, null, '工时记录更新成功');
  } catch (err) {
    console.error('更新工时记录错误:', err);
    errorResponse(res, '更新工时记录失败', 500);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const logId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    const [workLogs] = await pool.execute('SELECT * FROM work_logs WHERE id = ?', [logId]);
    if (workLogs.length === 0) {
      return errorResponse(res, '工时记录不存在', 404);
    }

    const log = workLogs[0];

    if (userRole === 'member' && log.user_id !== userId) {
      return errorResponse(res, '无权删除此工时记录', 403);
    }

    if (userRole === 'member' && log.status === 'submitted') {
      return errorResponse(res, '已提交待审核的工时记录不能删除，请等待审核或被驳回后再操作', 403);
    }

    if (log.status === 'approved') {
      return errorResponse(res, '已审核通过的工时记录不能删除');
    }

    if (log.status === 'submitted') {
      await pool.execute(
        'UPDATE tasks SET actual_hours = GREATEST(0, COALESCE(actual_hours, 0) - ?) WHERE id = ?',
        [log.hours, log.task_id]
      );
    }

    await pool.execute('DELETE FROM work_logs WHERE id = ?', [logId]);

    successResponse(res, null, '工时记录删除成功');
  } catch (err) {
    console.error('删除工时记录错误:', err);
    errorResponse(res, '删除工时记录失败', 500);
  }
});

router.post('/:id/approve', roleMiddleware('admin', 'manager'), async (req, res) => {
  try {
    const logId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    let sql = `SELECT wl.*, t.name as task_name 
               FROM work_logs wl 
               LEFT JOIN tasks t ON wl.task_id = t.id 
               LEFT JOIN projects p ON t.project_id = p.id 
               WHERE wl.id = ?`;
    const params = [logId];

    if (userRole === 'manager') {
      sql += ' AND p.manager_id = ?';
      params.push(userId);
    }

    const [workLogs] = await pool.execute(sql, params);
    if (workLogs.length === 0) {
      return errorResponse(res, '工时记录不存在或无权审核', 403);
    }

    if (workLogs[0].status !== 'submitted') {
      return errorResponse(res, '该工时记录状态不是待审核，无法通过');
    }
    const log = workLogs[0];

    await pool.execute(
      "UPDATE work_logs SET status = 'approved' WHERE id = ?",
      [logId]
    );
    
    addActivity(log.task_id, userId, 'worklog_approve', `审核通过了工时记录：${log.hours}小时`, {
      work_log_id: logId,
      hours: log.hours
    });
    
    if (log.user_id !== userId) {
      addNotification(log.user_id, 'worklog_approve', '工时审核通过', `您的工时记录（${log.hours}小时，任务「${log.task_name}」）已审核通过`, logId, 'worklog');
    }

    successResponse(res, null, '工时记录审核通过');
  } catch (err) {
    console.error('审核工时记录错误:', err);
    errorResponse(res, '审核失败', 500);
  }
});

router.post('/:id/reject', roleMiddleware('admin', 'manager'), rejectValidation, async (req, res) => {
  try {
    const logId = req.params.id;
    const { reject_reason } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    let sql = `SELECT wl.*, t.name as task_name 
               FROM work_logs wl 
               LEFT JOIN tasks t ON wl.task_id = t.id 
               LEFT JOIN projects p ON t.project_id = p.id 
               WHERE wl.id = ?`;
    const params = [logId];

    if (userRole === 'manager') {
      sql += ' AND p.manager_id = ?';
      params.push(userId);
    }

    const [workLogs] = await pool.execute(sql, params);
    if (workLogs.length === 0) {
      return errorResponse(res, '工时记录不存在或无权审核', 403);
    }

    if (workLogs[0].status !== 'submitted') {
      return errorResponse(res, '该工时记录状态不是待审核，无法驳回');
    }

    const log = workLogs[0];

    await pool.execute(
      'UPDATE work_logs SET status = ?, reject_reason = ? WHERE id = ?',
      ['rejected', reject_reason, logId]
    );

    if (log.status === 'submitted') {
      await pool.execute(
        'UPDATE tasks SET actual_hours = GREATEST(0, COALESCE(actual_hours, 0) - ?) WHERE id = ?',
        [log.hours, log.task_id]
      );
    }
    
    addActivity(log.task_id, userId, 'worklog_reject', `驳回了工时记录：${log.hours}小时，原因：${reject_reason}`, {
      work_log_id: logId,
      hours: log.hours,
      reject_reason
    });
    
    if (log.user_id !== userId) {
      addNotification(log.user_id, 'worklog_reject', '工时被驳回', `您的工时记录（${log.hours}小时，任务「${log.task_name}」）被驳回，原因：${reject_reason}`, logId, 'worklog');
    }

    successResponse(res, null, '工时记录已驳回');
  } catch (err) {
    console.error('驳回工时记录错误:', err);
    errorResponse(res, '驳回失败', 500);
  }
});

module.exports = router;
