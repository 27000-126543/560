const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { successResponse, errorResponse } = require('../utils/helpers');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const { projectValidation } = require('../middleware/validation');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const { page = 1, page_size = 10, keyword = '', status = '', manager_id = '' } = req.query;
    const offset = (page - 1) * page_size;
    const userId = req.user.id;
    const userRole = req.user.role;

    let sql = `SELECT p.*, u.real_name as manager_name, u.department 
               FROM projects p 
               LEFT JOIN users u ON p.manager_id = u.id 
               WHERE 1=1`;
    const params = [];

    if (userRole === 'manager') {
      sql += ' AND p.manager_id = ?';
      params.push(userId);
    } else if (userRole === 'member') {
      sql += ` AND (p.manager_id = ? OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ?))`;
      params.push(userId, userId);
    }

    if (keyword) {
      sql += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (status) {
      sql += ' AND p.status = ?';
      params.push(status);
    }
    if (manager_id) {
      sql += ' AND p.manager_id = ?';
      params.push(manager_id);
    }

    sql += ' ORDER BY p.id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(page_size), parseInt(offset));

    const [projects] = await pool.execute(sql, params);

    let countSql = 'SELECT COUNT(*) as total FROM projects p WHERE 1=1';
    const countParams = [];

    if (userRole === 'manager') {
      countSql += ' AND p.manager_id = ?';
      countParams.push(userId);
    } else if (userRole === 'member') {
      countSql += ` AND (p.manager_id = ? OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ?))`;
      countParams.push(userId, userId);
    }

    if (keyword) {
      countSql += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      countParams.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (status) {
      countSql += ' AND p.status = ?';
      countParams.push(status);
    }

    const [countResult] = await pool.execute(countSql, countParams);

    for (const project of projects) {
      const [taskStats] = await pool.execute(
        `SELECT 
          COUNT(*) as total_tasks,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
          SUM(actual_hours) as actual_hours
         FROM tasks 
         WHERE project_id = ?`,
        [project.id]
      );
      project.task_stats = taskStats[0];
    }

    successResponse(res, {
      list: projects,
      total: countResult[0].total,
      page: parseInt(page),
      page_size: parseInt(page_size)
    });
  } catch (err) {
    console.error('获取项目列表错误:', err);
    errorResponse(res, '获取项目列表失败', 500);
  }
});

router.get('/all', async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let sql = 'SELECT id, name, status FROM projects WHERE 1=1';
    const params = [];

    if (userRole === 'manager') {
      sql += ' AND manager_id = ?';
      params.push(userId);
    } else if (userRole === 'member') {
      sql += ` AND (manager_id = ? OR id IN (SELECT project_id FROM project_members WHERE user_id = ?))`;
      params.push(userId, userId);
    }

    sql += ' ORDER BY id DESC';

    const [projects] = await pool.execute(sql, params);
    successResponse(res, projects);
  } catch (err) {
    console.error('获取所有项目错误:', err);
    errorResponse(res, '获取项目列表失败', 500);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [projects] = await pool.execute(
      `SELECT p.*, u.real_name as manager_name, u.email as manager_email, u.department 
       FROM projects p 
       LEFT JOIN users u ON p.manager_id = u.id 
       WHERE p.id = ?`,
      [req.params.id]
    );

    if (projects.length === 0) {
      return errorResponse(res, '项目不存在', 404);
    }

    const project = projects[0];

    const [members] = await pool.execute(
      `SELECT u.id, u.username, u.real_name, u.email, u.department 
       FROM project_members pm 
       LEFT JOIN users u ON pm.user_id = u.id 
       WHERE pm.project_id = ? 
       ORDER BY u.id ASC`,
      [project.id]
    );

    project.members = members;

    const [taskStats] = await pool.execute(
      `SELECT 
        COUNT(*) as total_tasks,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_tasks,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_tasks,
        SUM(estimated_hours) as estimated_hours,
        SUM(actual_hours) as actual_hours
       FROM tasks 
       WHERE project_id = ?`,
      [project.id]
    );

    project.task_stats = taskStats[0];

    successResponse(res, project);
  } catch (err) {
    console.error('获取项目详情错误:', err);
    errorResponse(res, '获取项目详情失败', 500);
  }
});

router.post('/', roleMiddleware('admin', 'manager'), projectValidation, async (req, res) => {
  try {
    const { name, description, manager_id, start_date, end_date, members = [] } = req.body;

    const [result] = await pool.execute(
      'INSERT INTO projects (name, description, manager_id, start_date, end_date) VALUES (?, ?, ?, ?, ?)',
      [name, description, manager_id, start_date, end_date]
    );

    const projectId = result.insertId;

    if (members.length > 0) {
      const memberValues = members.map(m => [projectId, m]);
      await pool.query(
        'INSERT INTO project_members (project_id, user_id) VALUES ?',
        [memberValues]
      );
    }

    const isManagerInMembers = members.some(m => m === manager_id);
    if (!isManagerInMembers) {
      await pool.execute(
        'INSERT IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)',
        [projectId, manager_id]
      );
    }

    successResponse(res, { id: projectId }, '项目创建成功');
  } catch (err) {
    console.error('创建项目错误:', err);
    errorResponse(res, '创建项目失败', 500);
  }
});

router.put('/:id', roleMiddleware('admin', 'manager'), projectValidation, async (req, res) => {
  try {
    const projectId = req.params.id;
    const { name, description, manager_id, status, start_date, end_date } = req.body;
    const members = req.body.members;

    const [projects] = await pool.execute('SELECT id, manager_id FROM projects WHERE id = ?', [projectId]);
    if (projects.length === 0) {
      return errorResponse(res, '项目不存在', 404);
    }

    await pool.execute(
      'UPDATE projects SET name = ?, description = ?, manager_id = ?, status = ?, start_date = ?, end_date = ? WHERE id = ?',
      [name, description, manager_id, status, start_date, end_date, projectId]
    );

    if (members !== undefined) {
      await pool.execute('DELETE FROM project_members WHERE project_id = ?', [projectId]);

      const memberIds = Array.isArray(members) ? members : [];
      if (memberIds.length > 0) {
        const memberValues = memberIds.map(m => [projectId, m]);
        await pool.query(
          'INSERT INTO project_members (project_id, user_id) VALUES ?',
          [memberValues]
        );
      }

      const isManagerInMembers = memberIds.some(m => m == manager_id);
      if (!isManagerInMembers) {
        await pool.execute(
          'INSERT IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)',
          [projectId, manager_id]
        );
      }
    } else {
      const oldManagerId = projects[0].manager_id;
      if (oldManagerId != manager_id) {
        await pool.execute(
          'INSERT IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)',
          [projectId, manager_id]
        );
      }
    }

    successResponse(res, null, '项目更新成功');
  } catch (err) {
    console.error('更新项目错误:', err);
    errorResponse(res, '更新项目失败', 500);
  }
});

router.delete('/:id', roleMiddleware('admin'), async (req, res) => {
  try {
    const projectId = req.params.id;

    const [projects] = await pool.execute('SELECT id FROM projects WHERE id = ?', [projectId]);
    if (projects.length === 0) {
      return errorResponse(res, '项目不存在', 404);
    }

    await pool.execute('DELETE FROM projects WHERE id = ?', [projectId]);

    successResponse(res, null, '项目删除成功');
  } catch (err) {
    console.error('删除项目错误:', err);
    errorResponse(res, '删除项目失败', 500);
  }
});

router.get('/:id/tasks', async (req, res) => {
  try {
    const projectId = req.params.id;
    const { status = '' } = req.query;

    let sql = `SELECT t.*, u.real_name as assignee_name, c.real_name as creator_name 
               FROM tasks t 
               LEFT JOIN users u ON t.assignee_id = u.id 
               LEFT JOIN users c ON t.creator_id = c.id 
               WHERE t.project_id = ?`;
    const params = [projectId];

    if (status) {
      sql += ' AND t.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY t.priority DESC, t.deadline ASC';

    const [tasks] = await pool.execute(sql, params);
    successResponse(res, tasks);
  } catch (err) {
    console.error('获取项目任务错误:', err);
    errorResponse(res, '获取任务列表失败', 500);
  }
});

module.exports = router;
