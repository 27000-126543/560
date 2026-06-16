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

module.exports = {
  successResponse,
  errorResponse,
  validateWorkHours,
  getWeekRange,
  getLastWeekRange
};
