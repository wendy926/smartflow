/**
 * 策略相关API路由
 */

const express = require('express');
const router = express.Router();
const V3Strategy = require('../../strategies/v3-strategy');
const ICTStrategy = require('../../strategies/ict-strategy');
const RollingStrategy = require('../../strategies/rolling-strategy');
const logger = require('../../utils/logger');

// 延迟初始化数据库操作
let dbOps = null;
const getDbOps = () => {
  if (!dbOps) {
    dbOps = require('../../database/operations');
  }
  return dbOps;
};

// 初始化策略实例
const v3Strategy = new V3Strategy();
const ictStrategy = new ICTStrategy();
const rollingStrategy = new RollingStrategy();

/**
 * 获取所有策略状态
 * GET /api/v1/strategies/status
 */
router.get('/status', async (req, res) => {
  try {
    const status = {
      v3: { name: 'V3趋势交易策略', status: 'active' },
      ict: { name: 'ICT订单块策略', status: 'active' },
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('获取策略状态失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 执行V3策略分析
 * POST /api/v1/strategies/v3/analyze
 */
router.post('/v3/analyze', async (req, res) => {
  try {
    const { symbol = 'BTCUSDT' } = req.body;

    const result = await v3Strategy.execute(symbol);

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('V3策略分析失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 执行ICT策略分析
 * POST /api/v1/strategies/ict/analyze
 */
router.post('/ict/analyze', async (req, res) => {
  try {
    const { symbol = 'BTCUSDT' } = req.body;

    const result = await ictStrategy.execute(symbol);

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('ICT策略分析失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 执行滚仓计算
 * POST /api/v1/strategies/rolling/calculate
 */
router.post('/rolling/calculate', async (req, res) => {
  try {
    const params = req.body;

    const result = await rollingStrategy.execute(params);

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('滚仓计算失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 批量执行策略分析
 * POST /api/v1/strategies/batch-analyze
 */
router.post('/batch-analyze', async (req, res) => {
  try {
    const { symbols = ['BTCUSDT', 'ETHUSDT'] } = req.body;
    const results = [];

    for (const symbol of symbols) {
      try {
        const [v3Result, ictResult] = await Promise.all([
          v3Strategy.execute(symbol),
          ictStrategy.execute(symbol)
        ]);

        results.push({
          symbol,
          v3: v3Result,
          ict: ictResult
        });
      } catch (error) {
        logger.error(`批量分析失败 ${symbol}:`, error);
        results.push({
          symbol,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('批量策略分析失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取V3策略判断记录
 * GET /api/v1/strategies/v3/judgments
 */
router.get('/v3/judgments', async (req, res) => {
  try {
    const { limit = 10, symbol } = req.query;

    // 获取所有活跃的交易对
    const symbols = await getDbOps().getAllSymbols();
    const activeSymbols = symbols.filter(s => s.status === 'ACTIVE');
    
    const results = [];
    
    // 为每个交易对执行V3策略
    for (const sym of activeSymbols.slice(0, parseInt(limit))) {
      try {
        const result = await v3Strategy.execute(sym.symbol);
        results.push({
          id: sym.id,
          symbol: sym.symbol,
          timeframe: '4H',
          trend: result.timeframes?.trend4H || 'RANGE',
          signal: result.signal || 'HOLD',
          confidence: result.confidence || 0,
          score: result.score || 0,
          factors: result.timeframes?.factors1H || {},
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error(`V3 strategy error for ${sym.symbol}:`, error);
        // 添加错误记录
        results.push({
          id: sym.id,
          symbol: sym.symbol,
          timeframe: '4H',
          trend: 'ERROR',
          signal: 'ERROR',
          confidence: 0,
          score: 0,
          factors: {},
          timestamp: new Date().toISOString(),
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      data: results,
      count: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('V3 judgments error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取ICT策略判断记录
 * GET /api/v1/strategies/ict/judgments
 */
router.get('/ict/judgments', async (req, res) => {
  try {
    const { limit = 10, symbol } = req.query;

    // 获取所有活跃的交易对
    const symbols = await getDbOps().getAllSymbols();
    const activeSymbols = symbols.filter(s => s.status === 'ACTIVE');
    
    const results = [];
    
    // 为每个交易对执行ICT策略
    for (const sym of activeSymbols.slice(0, parseInt(limit))) {
      try {
        const result = await ictStrategy.execute(sym.symbol);
        results.push({
          id: sym.id,
          symbol: sym.symbol,
          timeframe: '1D',
          trend: result.timeframes?.trend1D || 'RANGE',
          signal: result.signal || 'HOLD',
          confidence: result.confidence || 0,
          score: result.score || 0,
          reasons: result.reasons || [],
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error(`ICT strategy error for ${sym.symbol}:`, error);
        // 添加错误记录
        results.push({
          id: sym.id,
          symbol: sym.symbol,
          timeframe: '1D',
          trend: 'ERROR',
          signal: 'ERROR',
          confidence: 0,
          score: 0,
          reasons: [],
          timestamp: new Date().toISOString(),
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      data: results,
      count: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('ICT judgments error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


module.exports = router;
