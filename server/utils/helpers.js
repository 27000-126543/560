const dayjs = require('dayjs');

const successResponse = (res, data = null, message = '操作成功') => {
  res.json({
    code: 200,
    message,
    data
  });
};

const errorResponse = (res, message = '操作失败', code = 400) => {
  res.status(code).json({
    code,
    message,
    data: null
  });
};

const validateWorkHours = (hours) => {
  if (hours <= 0 || hours > 24) {
    return { valid: false, message: '工时必须在0-24小时之间' };
  }
  if (hours % 0.5 !== 0) {
    return { valid: false, message: '工时必须精确到半小时' };
  }
  return { valid: true };
};

const getWeekRange = (date = new Date()) => {
  const d = dayjs(date);
  const startOfWeek = d.startOf('week').add(1, 'day');
  const endOfWeek = d.endOf('week').add(1, 'day');
  return {
    start: startOfWeek.format('YYYY-MM-DD'),
    end: endOfWeek.format('YYYY-MM-DD')
  };
};

const getLastWeekRange = () => {
  const lastWeek = dayjs().subtract(1, 'week');
  return getWeekRange(lastWeek.toDate());
};

const addActivity = async (taskId, userId, type, content = '', extraData = null) => {
  try {
    const pool = require('../config/database');
    const extra = extraData ? JSON.stringify(extraData) : null;
    await pool.execute(
      'INSERT INTO task_activities (task_id, user_id, type, content, extra_data) VALUES (?, ?, ?, ?, ?)',
      [taskId, userId, type, content, extra]
    );
    return true;
  } catch (err) {
    console.error('插入活动记录失败:', err);
    return false;
  }
};

const addNotification = async (userId, type, title, content = '', relatedId = null, relatedType = '') => {
  try {
    const pool = require('../config/database');
    await pool.execute(
      'INSERT INTO notifications (user_id, type, title, content, related_id, related_type) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, type, title, content, relatedId, relatedType]
    );
    return true;
  } catch (err) {
    console.error('插入通知失败:', err);
    return false;
  }
};

module.exports = {
  successResponse,
  errorResponse,
  validateWorkHours,
  getWeekRange,
  getLastWeekRange,
  addActivity,
  addNotification
};
