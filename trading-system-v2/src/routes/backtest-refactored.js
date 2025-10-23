/**
 * 回测API路由重构版本
 * 完全解耦，参数驱动，支持差异化配置
 */

const express = require('express');
const BacktestManagerRefactored = require('../services/backtest-manager-refactored');
const logger = require('../utils/logger');

const router = express.Router();
const backtestManager = new BacktestManagerRefactored();

/**
 * 启动回测
 * POST /api/v1/backtest/:strategy/:mode
 */
router.post('/:strategy/:mode', async (req, res) => {
  try {
    const { strategy, mode } = req.params;
    const options = req.body || {};

    logger.info(`[回测API] 启动回测: ${strategy}-${mode}`, options);

    const result = await backtestManager.startBacktest(strategy, mode, options);

    if (result.success) {
      res.json({
        success: true,
        data: {
          success: true,
          taskId: `${strategy}-${mode}-${Date.now()}`,
          message: '回测任务已启动'
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    logger.error(`[回测API] 启动回测失败`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取回测结果
 * GET /api/v1/backtest/:strategy
 */
router.get('/:strategy', async (req, res) => {
  try {
    const { strategy } = req.params;
    const { mode, timeframe } = req.query;

    logger.info(`[回测API] 获取回测结果: ${strategy}, 模式: ${mode}, 时间框架: ${timeframe}`);

    const result = await backtestManager.getBacktestResults(strategy, mode, timeframe);

    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error(`[回测API] 获取回测结果失败`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 设置策略参数
 * POST /api/v1/backtest/:strategy/:mode/parameters
 */
router.post('/:strategy/:mode/parameters', async (req, res) => {
  try {
    const { strategy, mode } = req.params;
    const parameters = req.body;

    logger.info(`[回测API] 设置策略参数: ${strategy}-${mode}`, parameters);

    const result = await backtestManager.setStrategyParameters(strategy, mode, parameters);

    res.json(result);
  } catch (error) {
    logger.error(`[回测API] 设置策略参数失败`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取策略参数
 * GET /api/v1/backtest/:strategy/:mode/parameters
 */
router.get('/:strategy/:mode/parameters', async (req, res) => {
  try {
    const { strategy, mode } = req.params;

    logger.info(`[回测API] 获取策略参数: ${strategy}-${mode}`);

    const result = await backtestManager.getStrategyParameters(strategy, mode);

    res.json(result);
  } catch (error) {
    logger.error(`[回测API] 获取策略参数失败`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 批量回测
 * POST /api/v1/backtest/batch
 */
router.post('/batch', async (req, res) => {
  try {
    const { configs } = req.body;

    if (!Array.isArray(configs)) {
      return res.status(400).json({
        success: false,
        error: 'configs must be an array'
      });
    }

    logger.info(`[回测API] 批量回测: ${configs.length}个配置`);

    const results = await backtestManager.batchBacktest(configs);

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    logger.error(`[回测API] 批量回测失败`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取支持的策略列表
 * GET /api/v1/backtest/strategies
 */
router.get('/strategies', (req, res) => {
  try {
    const strategies = backtestManager.getSupportedStrategies();

    res.json({
      success: true,
      data: strategies
    });
  } catch (error) {
    logger.error(`[回测API] 获取策略列表失败`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取支持的时间框架
 * GET /api/v1/backtest/timeframes
 */
router.get('/timeframes', (req, res) => {
  try {
    const timeframes = backtestManager.getSupportedTimeframes();

    res.json({
      success: true,
      data: timeframes
    });
  } catch (error) {
    logger.error(`[回测API] 获取时间框架列表失败`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 清理缓存
 * POST /api/v1/backtest/clear-cache
 */
router.post('/clear-cache', (req, res) => {
  try {
    backtestManager.clearCache();

    res.json({
      success: true,
      message: '缓存清理完成'
    });
  } catch (error) {
    logger.error(`[回测API] 清理缓存失败`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
