/**
 * 监控相关API路由
 */

const express = require('express');
const router = express.Router();
const resourceMonitor = require('../../monitoring/resource-monitor');
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
 * 获取系统监控数据
 * GET /api/v1/monitoring/system
 */
router.get('/system', async (req, res) => {
  try {
    const systemInfo = resourceMonitor.getSystemInfo();
    const currentResources = await resourceMonitor.checkResources(); // ✅ 修复：添加 await

    // 获取Binance API统计（使用单例，确保统计数据共享）
    const { getBinanceAPI } = require('../../api/binance-api-singleton');
    const binanceAPI = getBinanceAPI();
    const apiStats = binanceAPI.getStats();

    res.json({
      success: true,
      data: {
        system: systemInfo,
        resources: currentResources,
        apiStats: apiStats,  // 添加API统计数据
        timestamp: toBeijingISO()
      }
    });
  } catch (error) {
    logger.error('获取系统监控数据失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取监控指标
 * GET /api/v1/monitoring/metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const { metric_type, component, limit = 100 } = req.query;

    const metrics = await getDbOps().getMonitoringMetrics(metric_type, component, limit);

    res.json({
      success: true,
      data: metrics,
      count: metrics.length,
      timestamp: toBeijingISO()
    });
  } catch (error) {
    logger.error('获取监控指标失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 记录监控指标
 * POST /api/v1/monitoring/metrics
 */
router.post('/metrics', async (req, res) => {
  try {
    const {
      metric_type,
      component,
      strategy_type = 'ALL',
      timeframe = 'ALL',
      success_count = 0,
      total_count = 1,
      avg_response_time = 0,
      error_message = null
    } = req.body;

    if (!metric_type || !component) {
      return res.status(400).json({
        success: false,
        error: 'metric_type和component不能为空'
      });
    }

    const success_rate = total_count > 0 ? (success_count / total_count) * 100 : 0;

    const metricData = {
      metric_type,
      component,
      strategy_type,
      timeframe,
      success_count,
      total_count,
      success_rate,
      avg_response_time,
      error_message
    };

    const result = await getDbOps().addMonitoringMetric(metricData);

    res.json({
      success: true,
      data: result,
      message: '监控指标记录成功',
      timestamp: toBeijingISO()
    });
  } catch (error) {
    logger.error('记录监控指标失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取交易对统计
 * GET /api/v1/monitoring/symbols
 */
router.get('/symbols', async (req, res) => {
  try {
    const { strategy } = req.query;

    const stats = await getDbOps().getSymbolStatistics(strategy);

    res.json({
      success: true,
      data: stats,
      count: stats.length,
      timestamp: toBeijingISO()
    });
  } catch (error) {
    logger.error('获取交易对统计失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 更新交易对统计
 * POST /api/v1/monitoring/symbols/:symbol/statistics
 */
router.post('/:symbol/statistics', async (req, res) => {
  try {
    const { symbol } = req.params;
    const {
      strategy_type,
      total_trades = 0,
      winning_trades = 0,
      losing_trades = 0,
      total_pnl = 0,
      max_drawdown = 0,
      profit_factor = 0,
      best_trade = 0,
      worst_trade = 0,
      avg_holding_time = 0
    } = req.body;

    if (!strategy_type) {
      return res.status(400).json({
        success: false,
        error: 'strategy_type不能为空'
      });
    }

    const win_rate = total_trades > 0 ? (winning_trades / total_trades) * 100 : 0;
    const avg_pnl_per_trade = total_trades > 0 ? total_pnl / total_trades : 0;

    const statData = {
      symbol,
      strategy_type,
      total_trades,
      winning_trades,
      losing_trades,
      win_rate,
      total_pnl,
      avg_pnl_per_trade,
      max_drawdown,
      profit_factor,
      best_trade,
      worst_trade,
      avg_holding_time
    };

    const result = await getDbOps().updateSymbolStatistics(statData);

    res.json({
      success: true,
      data: result,
      message: '交易对统计更新成功',
      timestamp: toBeijingISO()
    });
  } catch (error) {
    logger.error('更新交易对统计失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取健康检查状态
 * GET /api/v1/monitoring/health
 */
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: toBeijingISO(),
      services: {
        database: 'connected',
        cache: 'connected',
        strategies: 'running'
      },
      resources: await resourceMonitor.checkResources() // ✅ 修复：添加 await
    };

    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    logger.error('健康检查失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      data: {
        status: 'unhealthy',
        timestamp: toBeijingISO()
      }
    });
  }
});

module.exports = router;
