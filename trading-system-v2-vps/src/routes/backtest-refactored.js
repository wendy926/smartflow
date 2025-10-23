/**
 * 回测API路由 - 重构版本
 */

const express = require('express');
const router = express.Router();

/**
 * 创建回测路由
 * @param {Object} backtestManager - 回测管理器
 * @param {Object} logger - 日志记录器
 * @returns {Object} Express路由
 */
function createBacktestRoutes(backtestManager, logger) {
  /**
   * @route POST /api/v1/backtest/run
   * @desc 运行回测
   * @access Public
   */
  router.post('/run', async (req, res) => {
    const { strategyName, mode, timeframe, startDate, endDate, symbol } = req.body;
    logger.info(`[回测API] 收到回测请求: ${strategyName}-${mode}-${timeframe} for ${symbol} from ${startDate} to ${endDate}`);

    if (!strategyName || !mode || !timeframe || !startDate || !endDate || !symbol) {
      return res.status(400).json({ success: false, error: '缺少必要的参数' });
    }

    try {
      const result = await backtestManager.startBacktest(strategyName, mode, timeframe, startDate, endDate, symbol);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      logger.error(`[回测API] 运行回测失败: ${strategyName}-${mode}`, error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @route GET /api/v1/backtest/strategies
   * @desc 获取所有可用策略
   * @access Public
   */
  router.get('/strategies', (req, res) => {
    try {
      const strategies = backtestManager.getAvailableStrategies();
      res.status(200).json({ success: true, data: strategies });
    } catch (error) {
      logger.error('[回测API] 获取策略列表失败', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}

module.exports = createBacktestRoutes;
