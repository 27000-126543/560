const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { successResponse, errorResponse } = require('../utils/helpers');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const { userValidation } = require('../middleware/validation');

router.use(authMiddleware);

router.get('/', roleMiddleware('admin'), async (req, res) => {
  try {
    const { page = 1, page_size = 10, keyword = '', role_id = '', status = '' } = req.query;
    const offset = (page - 1) * page_size;

    let sql = `SELECT u.*, r.name as role_name, r.description as role_desc 
               FROM users u 
               LEFT JOIN roles r ON u.role_id = r.id 
               WHERE 1=1`;
    const params = [];

    if (keyword) {
      sql += ' AND (u.username LIKE ? OR u.real_name LIKE ? OR u.email LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    if (role_id) {
      sql += ' AND u.role_id = ?';
      params.push(role_id);
    }
    if (status !== '') {
      sql += ' AND u.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY u.id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(page_size), parseInt(offset));

    const [users] = await pool.execute(sql, params);
    users.forEach(u => delete u.password);

    let countSql = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
    const countParams = [];
    if (keyword) {
      countSql += ' AND (username LIKE ? OR real_name LIKE ? OR email LIKE ?)';
      countParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    if (role_id) {
      countSql += ' AND role_id = ?';
      countParams.push(role_id);
    }
    if (status !== '') {
      countSql += ' AND status = ?';
      countParams.push(status);
    }

    const [countResult] = await pool.execute(countSql, countParams);

    successResponse(res, {
      list: users,
      total: countResult[0].total,
      page: parseInt(page),
      page_size: parseInt(page_size)
    });
  } catch (err) {
    console.error('获取用户列表错误:', err);
    errorResponse(res, '获取用户列表失败', 500);
  }
});

router.get('/roles', async (req, res) => {
  try {
    const [roles] = await pool.execute('SELECT * FROM roles ORDER BY id ASC');
    successResponse(res, roles);
  } catch (err) {
    console.error('获取角色列表错误:', err);
    errorResponse(res, '获取角色列表失败', 500);
  }
});

router.get('/managers', roleMiddleware('admin', 'manager'), async (req, res) => {
  try {
    const [users] = await pool.execute(
      `SELECT u.id, u.username, u.real_name, u.email, u.department 
       FROM users u 
       INNER JOIN roles r ON u.role_id = r.id 
       WHERE r.name = 'manager' AND u.status = 1 
       ORDER BY u.id ASC`
    );
    successResponse(res, users);
  } catch (err) {
    console.error('获取主管列表错误:', err);
    errorResponse(res, '获取主管列表失败', 500);
  }
});

router.get('/members', roleMiddleware('admin', 'manager'), async (req, res) => {
  try {
    const [users] = await pool.execute(
      `SELECT u.id, u.username, u.real_name, u.email, u.department 
       FROM users u 
       INNER JOIN roles r ON u.role_id = r.id 
       WHERE r.name = 'member' AND u.status = 1 
       ORDER BY u.id ASC`
    );
    successResponse(res, users);
  } catch (err) {
    console.error('获取成员列表错误:', err);
    errorResponse(res, '获取成员列表失败', 500);
  }
});

router.get('/:id', roleMiddleware('admin'), async (req, res) => {
  try {
    const [users] = await pool.execute(
      `SELECT u.*, r.name as role_name, r.description as role_desc 
       FROM users u 
       LEFT JOIN roles r ON u.role_id = r.id 
       WHERE u.id = ?`,
      [req.params.id]
    );

    if (users.length === 0) {
      return errorResponse(res, '用户不存在', 404);
    }

    const user = users[0];
    delete user.password;

    successResponse(res, user);
  } catch (err) {
    console.error('获取用户详情错误:', err);
    errorResponse(res, '获取用户详情失败', 500);
  }
});

router.post('/', roleMiddleware('admin'), userValidation, async (req, res) => {
  try {
    const { username, real_name, email, phone, department, role_id, password = '123456' } = req.body;

    const [existingUsers] = await pool.execute('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existingUsers.length > 0) {
      return errorResponse(res, '用户名或邮箱已存在');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.execute(
      'INSERT INTO users (username, password, real_name, email, phone, department, role_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, hashedPassword, real_name, email, phone, department, role_id]
    );

    successResponse(res, { id: result.insertId }, '用户创建成功');
  } catch (err) {
    console.error('创建用户错误:', err);
    errorResponse(res, '创建用户失败', 500);
  }
});

router.put('/:id', roleMiddleware('admin'), userValidation, async (req, res) => {
  try {
    const { real_name, email, phone, department, role_id, status } = req.body;
    const userId = req.params.id;

    const [users] = await pool.execute('SELECT id FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return errorResponse(res, '用户不存在', 404);
    }

    const [existingUsers] = await pool.execute('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
    if (existingUsers.length > 0) {
      return errorResponse(res, '邮箱已被使用');
    }

    await pool.execute(
      'UPDATE users SET real_name = ?, email = ?, phone = ?, department = ?, role_id = ?, status = ? WHERE id = ?',
      [real_name, email, phone, department, role_id, status, userId]
    );

    successResponse(res, null, '用户更新成功');
  } catch (err) {
    console.error('更新用户错误:', err);
    errorResponse(res, '更新用户失败', 500);
  }
});

router.delete('/:id', roleMiddleware('admin'), async (req, res) => {
  try {
    const userId = req.params.id;

    if (userId == req.user.id) {
      return errorResponse(res, '不能删除自己的账号');
    }

    const [users] = await pool.execute('SELECT id FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return errorResponse(res, '用户不存在', 404);
    }

    await pool.execute('DELETE FROM users WHERE id = ?', [userId]);

    successResponse(res, null, '用户删除成功');
  } catch (err) {
    console.error('删除用户错误:', err);
    errorResponse(res, '删除用户失败', 500);
  }
});

router.put('/:id/status', roleMiddleware('admin'), async (req, res) => {
  try {
    const { status } = req.body;
    const userId = req.params.id;

    if (status !== 0 && status !== 1) {
      return errorResponse(res, '状态值无效');
    }

    const [users] = await pool.execute('SELECT id FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return errorResponse(res, '用户不存在', 404);
    }

    await pool.execute('UPDATE users SET status = ? WHERE id = ?', [status, userId]);

    successResponse(res, null, status === 1 ? '用户已启用' : '用户已禁用');
  } catch (err) {
    console.error('更新用户状态错误:', err);
    errorResponse(res, '更新用户状态失败', 500);
  }
});

module.exports = router;
