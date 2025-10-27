/**
 * 用户相关API路由
 */

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const { toBeijingISO } = require('../../utils/time-helper');

// 延迟初始化数据库操作
let dbOps = null;
const getDbOps = () => {
  if (!dbOps) {
    dbOps = require('../../database/operations');
  }
  return dbOps;
};

/**
 * 获取用户统计数据
 * GET /api/v1/users/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const database = req.app.get('database');
    
    // 获取总用户数
    const [userCountResult] = await database.query(
      'SELECT COUNT(*) as total_users FROM users WHERE deleted_at IS NULL'
    );
    const totalUsers = userCountResult.total_users || 0;

    // 获取今日新增用户数
    const [todayNewUsersResult] = await database.query(
      `SELECT COUNT(*) as today_new_users 
       FROM users 
       WHERE DATE(created_at) = CURDATE() AND deleted_at IS NULL`
    );
    const todayNewUsers = todayNewUsersResult.today_new_users || 0;

    // 获取活跃用户数（最近7天登录过）
    const [activeUsersResult] = await database.query(
      `SELECT COUNT(DISTINCT user_id) as active_users 
       FROM user_sessions 
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
    );
    const activeUsers = activeUsersResult.active_users || 0;

    res.json({
      success: true,
      data: {
        totalUsers,
        todayNewUsers,
        activeUsers,
        timestamp: toBeijingISO()
      }
    });
  } catch (error) {
    logger.error('获取用户统计数据失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

