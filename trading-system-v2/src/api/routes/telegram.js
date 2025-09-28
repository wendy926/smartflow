/**
 * Telegram监控API路由
 */

const express = require('express');
const router = express.Router();
const TelegramMonitoringService = require('../../services/telegram-monitoring');
const logger = require('../../utils/logger');

const telegramService = new TelegramMonitoringService();

/**
 * 获取Telegram配置状态
 * GET /api/v1/telegram/status
 */
router.get('/status', (req, res) => {
  try {
    const status = telegramService.getStatus();
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('获取Telegram状态失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 配置交易触发Telegram机器人
 * POST /api/v1/telegram/trading-config
 */
router.post('/trading-config', (req, res) => {
  try {
    const { botToken, chatId } = req.body;

    if (!botToken || !chatId) {
      return res.status(400).json({
        success: false,
        error: 'botToken和chatId不能为空'
      });
    }

    telegramService.updateConfig({
      trading: { botToken, chatId }
    });

    res.json({
      success: true,
      message: '交易触发Telegram配置已保存',
      data: telegramService.getStatus()
    });
  } catch (error) {
    logger.error('设置交易触发Telegram配置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 配置系统监控Telegram机器人
 * POST /api/v1/telegram/monitoring-config
 */
router.post('/monitoring-config', (req, res) => {
  try {
    const { botToken, chatId } = req.body;

    if (!botToken || !chatId) {
      return res.status(400).json({
        success: false,
        error: 'botToken和chatId不能为空'
      });
    }

    telegramService.updateConfig({
      monitoring: { botToken, chatId }
    });

    res.json({
      success: true,
      message: '系统监控Telegram配置已保存',
      data: telegramService.getStatus()
    });
  } catch (error) {
    logger.error('设置系统监控Telegram配置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 测试交易触发Telegram连接
 * POST /api/v1/telegram/test-trading
 */
router.post('/test-trading', async (req, res) => {
  try {
    const result = await telegramService.testConnection('trading');

    if (result.success) {
      // 发送测试消息
      const testMessage = `🧪 <b>交易触发测试消息</b>\n\n这是一条测试消息，用于验证交易触发Telegram机器人配置是否正确。\n\n🕐 <b>时间:</b> ${new Date().toLocaleString('zh-CN')}\n🔗 <b>系统:</b> SmartFlow 交易系统 V2.0`;

      const sendResult = await telegramService.sendMessage(testMessage, 'trading');

      res.json({
        success: true,
        message: '交易触发Telegram测试成功',
        data: {
          connection: result,
          messageSent: sendResult
        }
      });
    } else {
      res.json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    logger.error('测试交易触发Telegram失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 测试系统监控Telegram连接
 * POST /api/v1/telegram/test-monitoring
 */
router.post('/test-monitoring', async (req, res) => {
  try {
    const result = await telegramService.testConnection('monitoring');

    if (result.success) {
      // 发送测试消息
      const testMessage = `🧪 <b>系统监控测试消息</b>\n\n这是一条测试消息，用于验证系统监控Telegram机器人配置是否正确。\n\n🕐 <b>时间:</b> ${new Date().toLocaleString('zh-CN')}\n🔗 <b>系统:</b> SmartFlow 交易系统 V2.0`;

      const sendResult = await telegramService.sendMessage(testMessage, 'monitoring');

      res.json({
        success: true,
        message: '系统监控Telegram测试成功',
        data: {
          connection: result,
          messageSent: sendResult
        }
      });
    } else {
      res.json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    logger.error('测试系统监控Telegram失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 发送交易触发通知
 * POST /api/v1/telegram/send-trading-alert
 */
router.post('/send-trading-alert', async (req, res) => {
  try {
    const tradeData = req.body;

    if (!tradeData.symbol || !tradeData.strategy_type) {
      return res.status(400).json({
        success: false,
        error: '交易数据不完整'
      });
    }

    const result = await telegramService.sendTradingAlert(tradeData);

    res.json({
      success: result,
      message: result ? '交易触发通知发送成功' : '交易触发通知发送失败',
      data: { sent: result }
    });
  } catch (error) {
    logger.error('发送交易触发通知失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 配置宏观监控Telegram机器人
 * POST /api/v1/telegram/macro-config
 */
router.post('/macro-config', (req, res) => {
  try {
    const { botToken, chatId, btcThreshold, ethThreshold, fearGreedLow, fearGreedHigh } = req.body;

    if (!botToken || !chatId) {
      return res.status(400).json({
        success: false,
        error: 'botToken和chatId不能为空'
      });
    }

    telegramService.updateConfig({
      macro: { 
        botToken, 
        chatId,
        thresholds: {
          btcThreshold: parseFloat(btcThreshold) || 10000000,
          ethThreshold: parseFloat(ethThreshold) || 1000,
          fearGreedLow: parseFloat(fearGreedLow) || 20,
          fearGreedHigh: parseFloat(fearGreedHigh) || 80
        }
      }
    });

    res.json({
      success: true,
      message: '宏观监控Telegram配置已保存',
      data: telegramService.getStatus()
    });
  } catch (error) {
    logger.error('设置宏观监控Telegram配置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 测试宏观监控Telegram连接
 * POST /api/v1/telegram/test-macro
 */
router.post('/test-macro', async (req, res) => {
  try {
    const result = await telegramService.testConnection('macro');

    if (result.success) {
      // 发送测试消息
      const testMessage = `🧪 <b>宏观监控测试消息</b>\n\n这是一条测试消息，用于验证宏观监控Telegram机器人配置是否正确。\n\n🕐 <b>时间:</b> ${new Date().toLocaleString('zh-CN')}\n🔗 <b>系统:</b> SmartFlow 宏观监控系统\n\n📊 <b>当前监控配置:</b>\n• BTC大额转账阈值: $10,000,000\n• ETH大额转账阈值: 1,000 ETH\n• 恐惧贪婪指数阈值: 20-80`;

      const sendResult = await telegramService.sendMessage(testMessage, 'macro');

      res.json({
        success: true,
        message: '宏观监控Telegram测试成功',
        data: {
          connection: result,
          messageSent: sendResult
        }
      });
    } else {
      res.json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    logger.error('测试宏观监控Telegram失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 发送系统监控告警
 * POST /api/v1/telegram/send-monitoring-alert
 */
router.post('/send-monitoring-alert', async (req, res) => {
  try {
    const { type, message, data } = req.body;

    if (!type || !message) {
      return res.status(400).json({
        success: false,
        error: '告警类型和消息不能为空'
      });
    }

    const result = await telegramService.sendMonitoringAlert(type, message, data);

    res.json({
      success: result,
      message: result ? '系统监控告警发送成功' : '系统监控告警发送失败',
      data: { sent: result }
    });
  } catch (error) {
    logger.error('发送系统监控告警失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
