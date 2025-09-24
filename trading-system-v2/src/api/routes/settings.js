/**
 * 用户设置API路由
 * 处理用户偏好设置，如最大损失金额等
 */

const express = require('express');
const router = express.Router();
const database = require('../../database/connection');
const logger = require('../../utils/logger');

/**
 * 获取用户设置
 * GET /api/v1/settings/:key
 */
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    
    // 从数据库获取用户设置
    const value = await getUserSetting(key);
    
    res.json({
      key,
      value,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`获取用户设置失败 (${req.params.key}):`, error);
    res.status(500).json({
      error: 'Failed to get user setting',
      message: error.message
    });
  }
});

/**
 * 设置用户设置
 * POST /api/v1/settings/:key
 */
router.post('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({
        error: 'Value is required',
        message: 'Please provide a value in the request body'
      });
    }
    
    // 保存用户设置到数据库
    await setUserSetting(key, value);
    
    res.json({
      key,
      value,
      message: 'Setting saved successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`保存用户设置失败 (${req.params.key}):`, error);
    res.status(500).json({
      error: 'Failed to save user setting',
      message: error.message
    });
  }
});

/**
 * 获取所有用户设置
 * GET /api/v1/settings
 */
router.get('/', async (req, res) => {
  try {
    const settings = await getAllUserSettings();
    
    res.json({
      settings,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('获取所有用户设置失败:', error);
    res.status(500).json({
      error: 'Failed to get user settings',
      message: error.message
    });
  }
});

/**
 * 从数据库获取用户设置
 * @param {string} key - 设置键
 * @param {any} defaultValue - 默认值
 * @returns {any} 设置值
 */
async function getUserSetting(key, defaultValue = null) {
  try {
    const connection = await database.getConnection();
    
    try {
      const [rows] = await connection.execute(
        'SELECT value FROM user_settings WHERE setting_key = ?',
        [key]
      );
      
      if (rows.length > 0) {
        const value = rows[0].value;
        // 尝试解析JSON值
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      
      return defaultValue;
    } finally {
      connection.release();
    }
  } catch (error) {
    logger.error(`获取用户设置失败 (${key}):`, error);
    return defaultValue;
  }
}

/**
 * 设置用户设置到数据库
 * @param {string} key - 设置键
 * @param {any} value - 设置值
 */
async function setUserSetting(key, value) {
  try {
    const connection = await database.getConnection();
    
    try {
      // 将值转换为字符串存储
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      
      // 使用INSERT ... ON DUPLICATE KEY UPDATE
      await connection.execute(
        `INSERT INTO user_settings (setting_key, value, updated_at) 
         VALUES (?, ?, NOW()) 
         ON DUPLICATE KEY UPDATE 
         value = VALUES(value), 
         updated_at = NOW()`,
        [key, stringValue]
      );
      
      logger.info(`用户设置已保存: ${key} = ${stringValue}`);
    } finally {
      connection.release();
    }
  } catch (error) {
    logger.error(`保存用户设置失败 (${key}):`, error);
    throw error;
  }
}

/**
 * 获取所有用户设置
 * @returns {Object} 所有设置
 */
async function getAllUserSettings() {
  try {
    const connection = await database.getConnection();
    
    try {
      const [rows] = await connection.execute(
        'SELECT setting_key, value FROM user_settings ORDER BY setting_key'
      );
      
      const settings = {};
      rows.forEach(row => {
        try {
          settings[row.setting_key] = JSON.parse(row.value);
        } catch {
          settings[row.setting_key] = row.value;
        }
      });
      
      return settings;
    } finally {
      connection.release();
    }
  } catch (error) {
    logger.error('获取所有用户设置失败:', error);
    return {};
  }
}

module.exports = router;
