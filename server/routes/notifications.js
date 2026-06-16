const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { successResponse, errorResponse } = require('../utils/helpers');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, page_size = 20, is_read = '' } = req.query;
    const offset = (page - 1) * page_size;

    let countSql = 'SELECT COUNT(*) as total FROM notifications WHERE user_id = ?';
    let listSql = 'SELECT * FROM notifications WHERE user_id = ?';
    const params = [userId];
    const countParams = [userId];

    if (is_read !== '' && is_read !== undefined) {
      const readVal = is_read === '1' || is_read === 'true' ? 1 : 0;
      listSql += ' AND is_read = ?';
      countSql += ' AND is_read = ?';
      params.push(readVal);
      countParams.push(readVal);
    }

    listSql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(page_size), parseInt(offset));

    const [countResult] = await pool.execute(countSql, countParams);
    const [list] = await pool.execute(listSql, params);

    successResponse(res, {
      list,
      total: countResult[0].total,
      page: parseInt(page),
      page_size: parseInt(page_size)
    });
  } catch (err) {
    console.error('获取通知列表错误:', err);
    errorResponse(res, '获取通知列表失败', 500);
  }
});

router.get('/unread-count', async (req, res) => {
  try {
    const userId = req.user.id;

    const [result] = await pool.execute(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    );

    successResponse(res, { unread_count: result[0].count });
  } catch (err) {
    console.error('获取未读通知数错误:', err);
    errorResponse(res, '获取未读通知数失败', 500);
  }
});

router.put('/:id/read', async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;

    const [notifications] = await pool.execute(
      'SELECT * FROM notifications WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );

    if (notifications.length === 0) {
      return errorResponse(res, '通知不存在', 404);
    }

    await pool.execute(
      'UPDATE notifications SET is_read = 1 WHERE id = ?',
      [notificationId]
    );

    successResponse(res, null, '已标记为已读');
  } catch (err) {
    console.error('标记通知已读错误:', err);
    errorResponse(res, '标记已读失败', 500);
  }
});

router.put('/read-all', async (req, res) => {
  try {
    const userId = req.user.id;

    await pool.execute(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
      [userId]
    );

    successResponse(res, null, '全部标记为已读');
  } catch (err) {
    console.error('全部标记已读错误:', err);
    errorResponse(res, '操作失败', 500);
  }
});

module.exports = router;
