const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { successResponse, errorResponse, validateWorkHours } = require('../utils/helpers');
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
      sql += ` AND (wl.user_id = ? OR p.manager_id = ? OR t.creator_id = ?)`;
      params.push(userId, userId, userId);
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
      countSql += ` AND (wl.user_id = ? OR p.manager_id = ? OR t.creator_id = ?)`;
      countParams.push(userId, userId, userId);
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

router.get('/:id', async (req, res) => {
  try {
    const [workLogs] = await pool.execute(
      `SELECT wl.*, t.name as task_name, p.name as project_name, u.real_name as user_name 
       FROM work_logs wl 
       LEFT JOIN tasks t ON wl.task_id = t.id 
       LEFT JOIN projects p ON t.project_id = p.id 
       LEFT JOIN users u ON wl.user_id = u.id 
       WHERE wl.id = ?`,
      [req.params.id]
    );

    if (workLogs.length === 0) {
      return errorResponse(res, '工时记录不存在', 404);
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

    const [tasks] = await pool.execute('SELECT * FROM tasks WHERE id = ?', [task_id]);
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

    successResponse(res, { id: result.insertId }, '工时记录提交成功');
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

    if (log.status === 'approved') {
      return errorResponse(res, '已审核通过的工时记录不能修改');
    }

    if (hours !== undefined) {
      const validation = validateWorkHours(parseFloat(hours));
      if (!validation.valid) {
        return errorResponse(res, validation.message);
      }

      const checkDate = work_date || log.work_date;
      const [dayLogs] = await pool.execute(
        'SELECT COALESCE(SUM(hours), 0) as total_hours FROM work_logs WHERE user_id = ? AND work_date = ? AND id != ?',
        [log.user_id, checkDate, logId]
      );

      const totalHoursForDay = parseFloat(dayLogs[0].total_hours) + parseFloat(hours);
      if (totalHoursForDay > 24) {
        return errorResponse(res, '当日总工时不能超过24小时');
      }

      const hoursDiff = parseFloat(hours) - parseFloat(log.hours);
      await pool.execute(
        'UPDATE tasks SET actual_hours = COALESCE(actual_hours, 0) + ? WHERE id = ?',
        [hoursDiff, log.task_id]
      );
    }

    await pool.execute(
      'UPDATE work_logs SET work_date = ?, hours = ?, log_content = ?, status = ? WHERE id = ?',
      [
        work_date || log.work_date,
        hours || log.hours,
        log_content || log.log_content,
        'submitted',
        logId
      ]
    );

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

    if (log.status === 'approved') {
      return errorResponse(res, '已审核通过的工时记录不能删除');
    }

    await pool.execute(
      'UPDATE tasks SET actual_hours = GREATEST(0, COALESCE(actual_hours, 0) - ?) WHERE id = ?',
      [log.hours, log.task_id]
    );

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

    const [workLogs] = await pool.execute('SELECT id FROM work_logs WHERE id = ?', [logId]);
    if (workLogs.length === 0) {
      return errorResponse(res, '工时记录不存在', 404);
    }

    await pool.execute(
      "UPDATE work_logs SET status = 'approved' WHERE id = ?",
      [logId]
    );

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

    const [workLogs] = await pool.execute('SELECT * FROM work_logs WHERE id = ?', [logId]);
    if (workLogs.length === 0) {
      return errorResponse(res, '工时记录不存在', 404);
    }

    const log = workLogs[0];

    await pool.execute(
      'UPDATE work_logs SET status = ?, reject_reason = ? WHERE id = ?',
      ['rejected', reject_reason, logId]
    );

    await pool.execute(
      'UPDATE tasks SET actual_hours = GREATEST(0, COALESCE(actual_hours, 0) - ?) WHERE id = ?',
      [log.hours, log.task_id]
    );

    successResponse(res, null, '工时记录已驳回');
  } catch (err) {
    console.error('驳回工时记录错误:', err);
    errorResponse(res, '驳回失败', 500);
  }
});

module.exports = router;
