const { verifyToken } = require('../utils/jwt');
const { errorResponse } = require('../utils/helpers');

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return errorResponse(res, '未提供认证令牌', 401);
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return errorResponse(res, '认证令牌无效或已过期', 401);
  }

  req.user = decoded;
  next();
};

const roleMiddleware = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, '请先登录', 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return errorResponse(res, '权限不足，无法访问该资源', 403);
    }

    next();
  };
};

module.exports = { authMiddleware, roleMiddleware };
