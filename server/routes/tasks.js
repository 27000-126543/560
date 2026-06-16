const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { successResponse, errorResponse, validateWorkHours } = require('../utils/helpers');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const { taskValidation } = require('../middleware/validation');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      page_size = 10, 
      keyword = '', 
      status = '', 
      priority = '', 
      project_id = '',
      assignee_id = '',
      deadline_from = '',
      deadline_to = ''
    } = req.query;
    const offset = (page - 1) * page_size;
    const userId = req.user.id;
    const userRole = req.user.role;

    let sql = `SELECT t.*, p.name as project_name, u.real_name as assignee_name, c.real_name as creator_name 
               FROM tasks t 
               LEFT JOIN projects p ON t.project_id = p.id 
               LEFT JOIN users u ON t.assignee_id = u.id 
               LEFT JOIN users c ON t.creator_id = c.id 
               WHERE 1=1`;
    const params = [];

    if (userRole === 'manager') {
      sql += ' AND (t.creator_id = ? OR p.manager_id = ?)';
      params.push(userId, userId);
    } else if (userRole === 'member') {
      sql += ' AND t.assignee_id = ?';
      params.push(userId);
    }

    if (keyword) {
      sql += ' AND (t.name LIKE ? OR t.description LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (status) {
      sql += ' AND t.status = ?';
      params.push(status);
    }
    if (priority) {
      sql += ' AND t.priority = ?';
      params.push(priority);
    }
    if (project_id) {
      sql += ' AND t.project_id = ?';
      params.push(project_id);
    }
    if (assignee_id) {
      sql += ' AND t.assignee_id = ?';
      params.push(assignee_id);
    }
    if (deadline_from) {
      sql += ' AND t.deadline >= ?';
      params.push(deadline_from);
    }
    if (deadline_to) {
      sql += ' AND t.deadline <= ?';
      params.push(deadline_to);
    }

    sql += ' ORDER BY FIELD(t.status, "in_progress", "pending", "rejected", "completed"), FIELD(t.priority, "urgent", "high", "medium", "low"), t.deadline ASC LIMIT ? OFFSET ?';
    params.push(parseInt(page_size), parseInt(offset));

    const [tasks] = await pool.execute(sql, params);

    let countSql = `SELECT COUNT(*) as total 
                    FROM tasks t 
                    LEFT JOIN projects p ON t.project_id = p.id 
                    WHERE 1=1`;
    const countParams = [];

    if (userRole === 'manager') {
      countSql += ' AND (t.creator_id = ? OR p.manager_id = ?)';
      countParams.push(userId, userId);
    } else if (userRole === 'member') {
      countSql += ' AND t.assignee_id = ?';
      countParams.push(userId);
    }

    if (keyword) {
      countSql += ' AND (t.name LIKE ? OR t.description LIKE ?)';
      countParams.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (status) {
      countSql += ' AND t.status = ?';
      countParams.push(status);
    }
    if (priority) {
      countSql += ' AND t.priority = ?';
      countParams.push(priority);
    }
    if (project_id) {
      countSql += ' AND t.project_id = ?';
      countParams.push(project_id);
    }
    if (assignee_id) {
      countSql += ' AND t.assignee_id = ?';
      countParams.push(assignee_id);
    }

    const [countResult] = await pool.execute(countSql, countParams);

    successResponse(res, {
      list: tasks,
      total: countResult[0].total,
      page: parseInt(page),
      page_size: parseInt(page_size)
    });
  } catch (err) {
    console.error('获取任务列表错误:', err);
    errorResponse(res, '获取任务列表失败', 500);
  }
});

router.get('/my-tasks', async (req, res) => {
  try {
    const { status = '', priority = '' } = req.query;
    const userId = req.user.id;

    let sql = `SELECT t.*, p.name as project_name 
               FROM tasks t 
               LEFT JOIN projects p ON t.project_id = p.id 
               WHERE t.assignee_id = ?`;
    const params = [userId];

    if (status) {
      sql += ' AND t.status = ?';
      params.push(status);
    }
    if (priority) {
      sql += ' AND t.priority = ?';
      params.push(priority);
    }

    sql += ' ORDER BY FIELD(t.priority, "urgent", "high", "medium", "low"), t.deadline ASC';

    const [tasks] = await pool.execute(sql, params);
    successResponse(res, tasks);
  } catch (err) {
    console.error('获取我的任务错误:', err);
    errorResponse(res, '获取任务列表失败', 500);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const taskId = req.params.id;

    let sql = `SELECT t.*, p.name as project_name, u.real_name as assignee_name, u.email as assignee_email, 
                      c.real_name as creator_name 
               FROM tasks t 
               LEFT JOIN projects p ON t.project_id = p.id 
               LEFT JOIN users u ON t.assignee_id = u.id 
               LEFT JOIN users c ON t.creator_id = c.id 
               WHERE t.id = ?`;
    const params = [taskId];

    if (userRole === 'manager') {
      sql += ' AND (t.creator_id = ? OR p.manager_id = ?)';
      params.push(userId, userId);
    } else if (userRole === 'member') {
      sql += ' AND t.assignee_id = ?';
      params.push(userId);
    }

    const [tasks] = await pool.execute(sql, params);

    if (tasks.length === 0) {
      return errorResponse(res, '任务不存在或无权访问', 404);
    }

    const task = tasks[0];

    let logSql = `SELECT wl.*, u.real_name as user_name 
                  FROM work_logs wl 
                  LEFT JOIN users u ON wl.user_id = u.id 
                  WHERE wl.task_id = ? 
                  ORDER BY wl.work_date DESC, wl.created_at DESC`;
    const logParams = [taskId];

    if (userRole === 'member') {
      logSql += ' AND wl.user_id = ?';
      logParams.push(userId);
    }

    const [workLogs] = await pool.execute(logSql, logParams);

    task.work_logs = workLogs;

    successResponse(res, task);
  } catch (err) {
    console.error('获取任务详情错误:', err);
    errorResponse(res, '获取任务详情失败', 500);
  }
});

router.post('/', roleMiddleware('admin', 'manager'), taskValidation, async (req, res) => {
  try {
    const { name, description, project_id, assignee_id, priority, deadline, estimated_hours } = req.body;
    const creatorId = req.user.id;

    const [result] = await pool.execute(
      `INSERT INTO tasks (name, description, project_id, creator_id, assignee_id, priority, deadline, estimated_hours) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description, project_id, creatorId, assignee_id, priority, deadline, estimated_hours || null]
    );

    successResponse(res, { id: result.insertId }, '任务创建成功');
  } catch (err) {
    console.error('创建任务错误:', err);
    errorResponse(res, '创建任务失败', 500);
  }
});

router.put('/:id', roleMiddleware('admin', 'manager'), taskValidation, async (req, res) => {
  try {
    const taskId = req.params.id;
    const { name, description, project_id, assignee_id, priority, deadline, estimated_hours, status } = req.body;

    const [tasks] = await pool.execute('SELECT id FROM tasks WHERE id = ?', [taskId]);
    if (tasks.length === 0) {
      return errorResponse(res, '任务不存在', 404);
    }

    await pool.execute(
      `UPDATE tasks SET name = ?, description = ?, project_id = ?, assignee_id = ?, 
                        priority = ?, deadline = ?, estimated_hours = ?, status = ? 
       WHERE id = ?`,
      [name, description, project_id, assignee_id, priority, deadline, estimated_hours || null, status, taskId]
    );

    successResponse(res, null, '任务更新成功');
  } catch (err) {
    console.error('更新任务错误:', err);
    errorResponse(res, '更新任务失败', 500);
  }
});

router.delete('/:id', roleMiddleware('admin', 'manager'), async (req, res) => {
  try {
    const taskId = req.params.id;

    const [tasks] = await pool.execute('SELECT id FROM tasks WHERE id = ?', [taskId]);
    if (tasks.length === 0) {
      return errorResponse(res, '任务不存在', 404);
    }

    await pool.execute('DELETE FROM tasks WHERE id = ?', [taskId]);

    successResponse(res, null, '任务删除成功');
  } catch (err) {
    console.error('删除任务错误:', err);
    errorResponse(res, '删除任务失败', 500);
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const taskId = req.params.id;
    const { status } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    const [tasks] = await pool.execute('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (tasks.length === 0) {
      return errorResponse(res, '任务不存在', 404);
    }

    const task = tasks[0];

    if (userRole === 'member' && task.assignee_id !== userId) {
      return errorResponse(res, '无权修改此任务状态', 403);
    }

    const validStatuses = ['pending', 'in_progress', 'completed', 'rejected'];
    if (!validStatuses.includes(status)) {
      return errorResponse(res, '无效的任务状态');
    }

    const updateData = { status };
    if (status === 'completed') {
      updateData.completed_at = new Date();
    } else {
      updateData.completed_at = null;
    }

    await pool.execute(
      'UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?',
      [status, status === 'completed' ? new Date() : null, taskId]
    );

    successResponse(res, null, '任务状态更新成功');
  } catch (err) {
    console.error('更新任务状态错误:', err);
    errorResponse(res, '更新任务状态失败', 500);
  }
});

router.post('/:id/reject', roleMiddleware('admin', 'manager'), async (req, res) => {
  try {
    const taskId = req.params.id;
    const { reject_reason } = req.body;

    if (!reject_reason || !reject_reason.trim()) {
      return errorResponse(res, '驳回原因不能为空');
    }

    const [tasks] = await pool.execute('SELECT id FROM tasks WHERE id = ?', [taskId]);
    if (tasks.length === 0) {
      return errorResponse(res, '任务不存在', 404);
    }

    await pool.execute(
      'UPDATE tasks SET status = ?, reject_reason = ? WHERE id = ?',
      ['rejected', reject_reason, taskId]
    );

    successResponse(res, null, '任务已驳回');
  } catch (err) {
    console.error('驳回任务错误:', err);
    errorResponse(res, '驳回任务失败', 500);
  }
});

module.exports = router;
