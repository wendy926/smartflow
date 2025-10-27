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
    const userCountRows = await database.query(
      'SELECT COUNT(*) as total_users FROM users'
    );
    logger.info('总用户数查询结果:', JSON.stringify(userCountRows));
    
    let totalUsers = 0;
    if (userCountRows && Array.isArray(userCountRows) && userCountRows.length > 0) {
      totalUsers = Number(userCountRows[0].total_users || 0);
    }

    // 获取今日新增用户数
    const todayNewUsersRows = await database.query(
      `SELECT COUNT(*) as today_new_users 
       FROM users 
       WHERE DATE(created_at) = CURDATE()`
    );
    logger.info('今日新增用户查询结果:', JSON.stringify(todayNewUsersRows));
    
    let todayNewUsers = 0;
    if (todayNewUsersRows && Array.isArray(todayNewUsersRows) && todayNewUsersRows.length > 0) {
      todayNewUsers = Number(todayNewUsersRows[0].today_new_users || 0);
    }

    // 获取活跃用户数（最近7天登录过）
    const activeUsersRows = await database.query(
      `SELECT COUNT(DISTINCT user_id) as active_users
       FROM user_sessions 
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
    );
    logger.info('活跃用户查询结果:', JSON.stringify(activeUsersRows));
    
    let activeUsers = 0;
    if (activeUsersRows && Array.isArray(activeUsersRows) && activeUsersRows.length > 0) {
      activeUsers = Number(activeUsersRows[0].active_users || 0);
    }

    const result = {
      totalUsers,
      todayNewUsers,
      activeUsers,
      timestamp: toBeijingISO()
    };

    logger.info('最终用户统计数据:', result);

    res.json({
      success: true,
      data: result
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

