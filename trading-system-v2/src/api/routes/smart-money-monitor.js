/**
 * 聪明钱监控API路由
 * 提供监控状态查询和配置管理
 */

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');

/**
 * 获取聪明钱监控状态
 * GET /api/v1/smart-money-monitor/status
 */
router.get('/status', (req, res) => {
  try {
    const smartMoneyMonitor = req.app.get('smartMoneyMonitor');
    
    if (!smartMoneyMonitor) {
      return res.status(503).json({
        success: false,
        error: '聪明钱监控服务未启动'
      });
    }
    
    const status = smartMoneyMonitor.getStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('获取聪明钱监控状态失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 更新聪明钱监控配置
 * POST /api/v1/smart-money-monitor/config
 */
router.post('/config', (req, res) => {
  try {
    const smartMoneyMonitor = req.app.get('smartMoneyMonitor');
    
    if (!smartMoneyMonitor) {
      return res.status(503).json({
        success: false,
        error: '聪明钱监控服务未启动'
      });
    }
    
    const {
      confidenceThreshold,
      checkInterval,
      cooldownPeriod,
      maxNotificationsPerHour
    } = req.body;
    
    // 验证参数
    const config = {};
    
    if (confidenceThreshold !== undefined) {
      if (typeof confidenceThreshold !== 'number' || confidenceThreshold < 0 || confidenceThreshold > 1) {
        return res.status(400).json({
          success: false,
          error: '置信度阈值必须在0-1之间'
        });
      }
      config.confidenceThreshold = confidenceThreshold;
    }
    
    if (checkInterval !== undefined) {
      if (typeof checkInterval !== 'number' || checkInterval < 10000) {
        return res.status(400).json({
          success: false,
          error: '检查间隔必须大于等于10秒'
        });
      }
      config.checkInterval = checkInterval;
    }
    
    if (cooldownPeriod !== undefined) {
      if (typeof cooldownPeriod !== 'number' || cooldownPeriod < 60000) {
        return res.status(400).json({
          success: false,
          error: '冷却期必须大于等于1分钟'
        });
      }
      config.cooldownPeriod = cooldownPeriod;
    }
    
    if (maxNotificationsPerHour !== undefined) {
      if (typeof maxNotificationsPerHour !== 'number' || maxNotificationsPerHour < 1 || maxNotificationsPerHour > 100) {
        return res.status(400).json({
          success: false,
          error: '每小时最大通知数必须在1-100之间'
        });
      }
      config.maxNotificationsPerHour = maxNotificationsPerHour;
    }
    
    // 更新配置
    smartMoneyMonitor.updateConfig(config);
    
    res.json({
      success: true,
      message: '聪明钱监控配置已更新',
      data: smartMoneyMonitor.getStatus()
    });
    
  } catch (error) {
    logger.error('更新聪明钱监控配置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 手动触发聪明钱检查
 * POST /api/v1/smart-money-monitor/check
 */
router.post('/check', async (req, res) => {
  try {
    const smartMoneyMonitor = req.app.get('smartMoneyMonitor');
    
    if (!smartMoneyMonitor) {
      return res.status(503).json({
        success: false,
        error: '聪明钱监控服务未启动'
      });
    }
    
    // 手动触发检查
    await smartMoneyMonitor.checkSmartMoneySignals();
    
    res.json({
      success: true,
      message: '聪明钱检查已触发'
    });
    
  } catch (error) {
    logger.error('手动触发聪明钱检查失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取聪明钱监控通知历史
 * GET /api/v1/smart-money-monitor/history
 */
router.get('/history', (req, res) => {
  try {
    const smartMoneyMonitor = req.app.get('smartMoneyMonitor');
    
    if (!smartMoneyMonitor) {
      return res.status(503).json({
        success: false,
        error: '聪明钱监控服务未启动'
      });
    }
    
    // 获取通知历史（这里需要扩展SmartMoneyMonitor类来暴露历史数据）
    const history = smartMoneyMonitor.notificationHistory || new Map();
    const historyArray = Array.from(history.entries()).map(([key, value]) => ({
      key,
      ...value,
      timestamp: new Date(value.timestamp).toISOString()
    }));
    
    res.json({
      success: true,
      data: {
        history: historyArray,
        totalCount: historyArray.length
      }
    });
    
  } catch (error) {
    logger.error('获取聪明钱监控历史失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
