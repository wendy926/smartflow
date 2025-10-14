/**
 * 持仓监控API路由
 * 提供持仓监控服务的状态查询和控制接口
 */

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');

let positionMonitor = null;

// 中间件，确保positionMonitor已初始化
router.use((req, res, next) => {
  if (!positionMonitor) {
    positionMonitor = req.app.get('positionMonitor');
  }
  if (!positionMonitor) {
    logger.error('[持仓监控API] PositionMonitor服务未初始化');
    return res.status(500).json({ success: false, error: 'PositionMonitor服务未初始化' });
  }
  next();
});

/**
 * 获取持仓监控状态
 * GET /api/v1/position-monitor/status
 */
router.get('/status', (req, res) => {
  try {
    const status = positionMonitor.getStatus();
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('获取持仓监控状态失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 手动执行持仓检查
 * POST /api/v1/position-monitor/check
 */
router.post('/check', async (req, res) => {
  try {
    const result = await positionMonitor.manualCheck();
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('手动持仓检查失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 更新检查间隔
 * POST /api/v1/position-monitor/interval
 * body: { intervalMinutes: 5 }
 */
router.post('/interval', (req, res) => {
  try {
    const { intervalMinutes } = req.body;

    if (!intervalMinutes || intervalMinutes < 1 || intervalMinutes > 60) {
      return res.status(400).json({
        success: false,
        error: '检查间隔必须在1-60分钟之间'
      });
    }

    positionMonitor.updateCheckInterval(intervalMinutes);

    res.json({
      success: true,
      message: `检查间隔已更新为 ${intervalMinutes} 分钟`,
      data: positionMonitor.getStatus(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('更新检查间隔失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取所有交易对的持仓时长配置
 * GET /api/v1/position-monitor/config
 */
router.get('/config', (req, res) => {
  try {
    const PositionDurationManager = require('../../utils/position-duration-manager');
    const config = PositionDurationManager.getAllPositionDurations();

    res.json({
      success: true,
      data: config,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('获取持仓时长配置失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取特定交易对的持仓时长配置
 * GET /api/v1/position-monitor/config/:symbol
 */
router.get('/config/:symbol', (req, res) => {
  try {
    const { symbol } = req.params;
    const { marketType = 'RANGE' } = req.query;

    const PositionDurationManager = require('../../utils/position-duration-manager');
    const config = PositionDurationManager.getPositionConfig(symbol, marketType);

    res.json({
      success: true,
      data: {
        symbol,
        marketType,
        config
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`获取 ${req.params.symbol} 持仓配置失败:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
