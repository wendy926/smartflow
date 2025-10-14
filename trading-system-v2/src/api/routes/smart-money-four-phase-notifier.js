/**
 * 四阶段聪明钱Telegram通知API路由
 * 提供通知配置管理和测试功能
 */

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');

let fourPhaseNotifier = null;

// 中间件：确保通知器已初始化
router.use((req, res, next) => {
  if (!fourPhaseNotifier) {
    fourPhaseNotifier = req.app.get('fourPhaseNotifier');
  }
  if (!fourPhaseNotifier) {
    logger.error('[四阶段聪明钱通知API] 通知器未初始化');
    return res.status(500).json({ 
      success: false, 
      error: '四阶段聪明钱通知器未初始化' 
    });
  }
  next();
});

/**
 * 获取通知配置
 * GET /api/v1/smart-money-four-phase-notifier/config
 */
router.get('/config', (req, res) => {
  try {
    const stats = fourPhaseNotifier.getNotificationStats();
    
    res.json({
      success: true,
      data: {
        config: stats.config,
        stats: {
          totalNotifications: stats.totalNotifications,
          todayNotifications: stats.todayNotifications,
          weekNotifications: stats.weekNotifications
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('获取通知配置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 更新通知配置
 * POST /api/v1/smart-money-four-phase-notifier/config
 * body: { enabled: true, confidenceThreshold: 0.7, ... }
 */
router.post('/config', async (req, res) => {
  try {
    const config = req.body;
    
    // 参数验证
    if (config.enabled !== undefined && typeof config.enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'enabled必须是布尔值'
      });
    }
    
    if (config.confidenceThreshold !== undefined && 
        (typeof config.confidenceThreshold !== 'number' || 
         config.confidenceThreshold < 0 || 
         config.confidenceThreshold > 1)) {
      return res.status(400).json({
        success: false,
        error: 'confidenceThreshold必须是0-1之间的数字'
      });
    }
    
    if (config.cooldownMinutes !== undefined && 
        (typeof config.cooldownMinutes !== 'number' || 
         config.cooldownMinutes < 1)) {
      return res.status(400).json({
        success: false,
        error: 'cooldownMinutes必须是大于0的数字'
      });
    }

    // 更新配置
    await fourPhaseNotifier.updateConfiguration(config);
    
    res.json({
      success: true,
      message: '通知配置更新成功',
      data: fourPhaseNotifier.getNotificationStats(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('更新通知配置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 发送测试通知
 * POST /api/v1/smart-money-four-phase-notifier/test
 * body: { symbol: 'BTCUSDT', stage: 'accumulation' }
 */
router.post('/test', async (req, res) => {
  try {
    const { symbol = 'BTCUSDT', stage = 'accumulation' } = req.body;
    
    // 参数验证
    if (typeof symbol !== 'string' || !symbol.match(/^[A-Z]{3,10}USDT$/)) {
      return res.status(400).json({
        success: false,
        error: '无效的交易对格式'
      });
    }
    
    const validStages = ['accumulation', 'markup', 'distribution', 'markdown'];
    if (!validStages.includes(stage)) {
      return res.status(400).json({
        success: false,
        error: `无效的阶段，必须是: ${validStages.join(', ')}`
      });
    }

    // 发送测试通知
    await fourPhaseNotifier.sendTestNotification(symbol, stage);
    
    res.json({
      success: true,
      message: `测试通知已发送: ${symbol} ${stage}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('发送测试通知失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取通知统计
 * GET /api/v1/smart-money-four-phase-notifier/stats
 */
router.get('/stats', (req, res) => {
  try {
    const stats = fourPhaseNotifier.getNotificationStats();
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('获取通知统计失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 重置通知历史
 * POST /api/v1/smart-money-four-phase-notifier/reset-history
 */
router.post('/reset-history', (req, res) => {
  try {
    fourPhaseNotifier.resetNotificationHistory();
    
    res.json({
      success: true,
      message: '通知历史已重置',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('重置通知历史失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 立即检查信号
 * POST /api/v1/smart-money-four-phase-notifier/check
 */
router.post('/check', async (req, res) => {
  try {
    await fourPhaseNotifier.checkForSignals();
    
    res.json({
      success: true,
      message: '信号检查完成',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('检查信号失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取API文档
 * GET /api/v1/smart-money-four-phase-notifier/docs
 */
router.get('/docs', (req, res) => {
  const docs = {
    title: '四阶段聪明钱Telegram通知API文档',
    version: '1.0.0',
    description: '管理四阶段聪明钱信号的Telegram通知功能',
    endpoints: {
      'GET /config': '获取通知配置和统计信息',
      'POST /config': '更新通知配置',
      'POST /test': '发送测试通知',
      'GET /stats': '获取通知统计信息',
      'POST /reset-history': '重置通知历史',
      'POST /check': '立即检查信号',
      'GET /docs': '获取API文档'
    },
    configuration: {
      enabled: '是否启用通知 (boolean)',
      confidenceThreshold: '置信度阈值 (0-1)',
      cooldownMinutes: '冷却时间（分钟）',
      stages: {
        accumulation: '吸筹阶段通知配置',
        markup: '拉升阶段通知配置',
        distribution: '派发阶段通知配置',
        markdown: '砸盘阶段通知配置'
      }
    },
    example: {
      'POST /config': {
        enabled: true,
        confidenceThreshold: 0.7,
        cooldownMinutes: 60,
        stages: {
          accumulation: { enabled: true, emoji: '📈' },
          markup: { enabled: true, emoji: '🚀' },
          distribution: { enabled: true, emoji: '⚠️' },
          markdown: { enabled: true, emoji: '📉' }
        }
      },
      'POST /test': {
        symbol: 'BTCUSDT',
        stage: 'accumulation'
      }
    }
  };
  
  res.json({
    success: true,
    data: docs,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
