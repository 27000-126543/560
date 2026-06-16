const { body, validationResult } = require('express-validator');
const { errorResponse } = require('../utils/helpers');

const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const firstError = errors.array()[0];
    return errorResponse(res, firstError.msg, 400);
  };
};

const loginValidation = validate([
  body('username').notEmpty().withMessage('用户名不能为空'),
  body('password').notEmpty().withMessage('密码不能为空')
]);

const userValidation = validate([
  body('username').notEmpty().withMessage('用户名不能为空').isLength({ min: 3, max: 50 }).withMessage('用户名长度3-50个字符'),
  body('real_name').notEmpty().withMessage('真实姓名不能为空'),
  body('role_id').isInt().withMessage('角色ID必须为数字'),
  body('email').isEmail().withMessage('邮箱格式不正确'),
  body('department').optional()
]);

const projectValidation = validate([
  body('name').notEmpty().withMessage('项目名称不能为空'),
  body('description').optional(),
  body('manager_id').isInt().withMessage('请选择项目主管')
]);

const taskValidation = validate([
  body('name').notEmpty().withMessage('任务名称不能为空'),
  body('project_id').isInt().withMessage('请选择所属项目'),
  body('assignee_id').isInt().withMessage('请分配任务负责人'),
  body('priority').isIn(['low', 'medium', 'high', 'urgent']).withMessage('优先级不正确'),
  body('deadline').isISO8601().withMessage('截止日期格式不正确'),
  body('description').optional()
]);

const workLogValidation = validate([
  body('task_id').isInt().withMessage('请选择任务'),
  body('work_date').isISO8601().withMessage('日期格式不正确'),
  body('hours').isFloat({ min: 0.5, max: 24 }).withMessage('工时必须在0.5-24小时之间'),
  body('log_content').notEmpty().withMessage('工作日志内容不能为空')
]);

const rejectValidation = validate([
  body('reject_reason').notEmpty().withMessage('驳回原因不能为空')
]);

module.exports = {
  loginValidation,
  userValidation,
  projectValidation,
  taskValidation,
  workLogValidation,
  rejectValidation
};
