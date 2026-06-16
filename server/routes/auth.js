const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { generateToken } = require('../utils/jwt');
const { successResponse, errorResponse } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');
const { loginValidation } = require('../middleware/validation');

router.post('/login', loginValidation, async (req, res) => {
  try {
    const { username, password } = req.body;

    const [users] = await pool.execute(
      `SELECT u.*, r.name as role_name, r.description as role_desc 
       FROM users u 
       LEFT JOIN roles r ON u.role_id = r.id 
       WHERE u.username = ?`,
      [username]
    );

    if (users.length === 0) {
      return errorResponse(res, '用户名或密码错误');
    }

    const user = users[0];

    if (user.status !== 1) {
      return errorResponse(res, '账号已被禁用，请联系管理员');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return errorResponse(res, '用户名或密码错误');
    }

    const token = generateToken({
      id: user.id,
      username: user.username,
      role: user.role_name,
      role_id: user.role_id
    });

    const userInfo = {
      id: user.id,
      username: user.username,
      real_name: user.real_name,
      email: user.email,
      phone: user.phone,
      department: user.department,
      role_id: user.role_id,
      role: user.role_name,
      role_desc: user.role_desc,
      avatar: user.avatar
    };

    successResponse(res, { token, user: userInfo }, '登录成功');
  } catch (err) {
    console.error('登录错误:', err);
    errorResponse(res, '登录失败，请稍后重试', 500);
  }
});

router.post('/logout', authMiddleware, (req, res) => {
  successResponse(res, null, '退出成功');
});

router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const [users] = await pool.execute(
      `SELECT u.*, r.name as role_name, r.description as role_desc 
       FROM users u 
       LEFT JOIN roles r ON u.role_id = r.id 
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (users.length === 0) {
      return errorResponse(res, '用户不存在', 404);
    }

    const user = users[0];
    delete user.password;

    successResponse(res, user);
  } catch (err) {
    console.error('获取用户信息错误:', err);
    errorResponse(res, '获取用户信息失败', 500);
  }
});

router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { real_name, email, phone, avatar } = req.body;
    const userId = req.user.id;

    await pool.execute(
      'UPDATE users SET real_name = ?, email = ?, phone = ?, avatar = ? WHERE id = ?',
      [real_name, email, phone, avatar, userId]
    );

    const [users] = await pool.execute(
      `SELECT u.*, r.name as role_name 
       FROM users u 
       LEFT JOIN roles r ON u.role_id = r.id 
       WHERE u.id = ?`,
      [userId]
    );

    const user = users[0];
    delete user.password;

    successResponse(res, user, '个人信息更新成功');
  } catch (err) {
    console.error('更新用户信息错误:', err);
    errorResponse(res, '更新个人信息失败', 500);
  }
});

router.put('/password', authMiddleware, async (req, res) => {
  try {
    const { old_password, new_password } = req.body;

    if (!old_password || !new_password) {
      return errorResponse(res, '原密码和新密码都不能为空');
    }

    if (new_password.length < 6) {
      return errorResponse(res, '新密码长度不能少于6位');
    }

    const [users] = await pool.execute('SELECT password FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) {
      return errorResponse(res, '用户不存在', 404);
    }

    const isOldPasswordValid = await bcrypt.compare(old_password, users[0].password);
    if (!isOldPasswordValid) {
      return errorResponse(res, '原密码错误');
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);
    await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);

    successResponse(res, null, '密码修改成功');
  } catch (err) {
    console.error('修改密码错误:', err);
    errorResponse(res, '修改密码失败', 500);
  }
});

module.exports = router;
