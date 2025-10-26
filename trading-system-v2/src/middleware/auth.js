const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * JWT认证中间件
 */
const authMiddleware = (req, res, next) => {
  try {
    // 从请求头获取token
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: '未提供认证令牌'
      });
    }

    // 验证token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    // 将用户信息附加到请求对象
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    return res.status(401).json({
      error: 'Unauthorized',
      message: '无效的认证令牌'
    });
  }
};

/**
 * 可选认证中间件（token存在则验证）
 */
const optionalAuthMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      req.user = decoded;
    }

    next();
  } catch (error) {
    // 可选认证失败也不阻止请求
    next();
  }
};

module.exports = {
  authMiddleware,
  optionalAuthMiddleware
};

