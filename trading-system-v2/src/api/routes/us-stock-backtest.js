/**
 * 美股回测API路由
 * 独立于加密货币回测
 */

const express = require('express');
const router = express.Router();
const USStockBacktestEngine = require('../../services/us-stock-backtest-engine');
const USStockSimulationTrades = require('../../services/us-stock-simulation-trades');
const DatabaseConnection = require('../../database/database-connection');
const logger = require('../../utils/logger');

// 依赖注入
let backtestEngine = null;
let simulationTrades = null;

/**
 * 设置服务
 */
function setServices(database) {
  backtestEngine = new USStockBacktestEngine(database);
  simulationTrades = new USStockSimulationTrades();
}

/**
 * POST /api/us-stock/backtest
 * 触发美股回测
 */
router.post('/backtest', async (req, res) => {
  try {
    const {
      strategyName,    // V3_US 或 ICT_US
      strategyMode,    // AGGRESSIVE, BALANCED, CONSERVATIVE
      symbol,          // AAPL, MSFT等
      timeframe,       // 15m, 1h
      startDate,       // 2024-01-01
      endDate          // 2025-10-26
    } = req.body;

    logger.info(`[USStockBacktestAPI] 回测请求:`, req.body);

    // 验证参数
    if (!strategyName || !symbol || !timeframe || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: strategyName, symbol, timeframe, startDate, endDate'
      });
    }

    // 执行回测
    const result = await backtestEngine.runBacktest({
      strategyName,
      strategyMode: strategyMode || 'BALANCED',
      symbol,
      timeframe,
      startDate,
      endDate
    });

    res.json({
      success: true,
      result
    });

  } catch (error) {
    logger.error('[USStockBacktestAPI] 回测失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/us-stock/backtest/results
 * 获取回测结果
 */
router.get('/backtest/results', async (req, res) => {
  try {
    const { strategyName, symbol } = req.query;

    if (!strategyName) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: strategyName'
      });
    }

    const results = await simulationTrades.getBacktestResults(strategyName, symbol);

    res.json({
      success: true,
      results
    });

  } catch (error) {
    logger.error('[USStockBacktestAPI] 获取回测结果失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/us-stock/trades
 * 获取交易历史
 */
router.get('/trades', async (req, res) => {
  try {
    const { symbol, limit } = req.query;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: symbol'
      });
    }

    const trades = await simulationTrades.getTradeHistory(symbol, parseInt(limit) || 100);

    res.json({
      success: true,
      trades
    });

  } catch (error) {
    logger.error('[USStockBacktestAPI] 获取交易历史失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/us-stock/trades/open
 * 获取未平仓订单
 */
router.get('/trades/open', async (req, res) => {
  try {
    const { symbol } = req.query;

    const openTrades = await simulationTrades.getOpenTrades(symbol);

    res.json({
      success: true,
      openTrades
    });

  } catch (error) {
    logger.error('[USStockBacktestAPI] 获取未平仓订单失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 导出设置服务函数
 */
module.exports = { router, setServices };

