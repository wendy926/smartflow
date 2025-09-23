/**
 * 策略相关API路由
 */

const express = require('express');
const router = express.Router();
const V3Strategy = require('../../strategies/v3-strategy');
const ICTStrategy = require('../../strategies/ict-strategy');
const RollingStrategy = require('../../strategies/rolling-strategy');
const logger = require('../../utils/logger');

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
    
    // 这里应该从数据库获取历史判断记录
    // 暂时返回模拟数据
    const mockJudgments = [
      {
        id: 1,
        symbol: symbol || 'BTCUSDT',
        timeframe: '4H',
        trend: 'UP',
        signal: 'BUY',
        confidence: 0.85,
        score: 8.5,
        factors: {
          ma20: 45230,
          adx: 28.5,
          bbw: 0.12,
          vwap: 45180,
          oiChange: 5.2,
          funding: 0.01
        },
        timestamp: new Date().toISOString()
      }
    ];

    res.json({
      success: true,
      data: mockJudgments.slice(0, parseInt(limit)),
      count: mockJudgments.length,
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
    
    // 这里应该从数据库获取历史判断记录
    // 暂时返回模拟数据
    const mockJudgments = [
      {
        id: 1,
        symbol: symbol || 'BTCUSDT',
        timeframe: '1D',
        trend: 'DOWN',
        signal: 'SELL',
        confidence: 0.72,
        score: 7.2,
        reasons: ['订单块检测', '流动性扫荡', '吞没形态'],
        timestamp: new Date().toISOString()
      }
    ];

    res.json({
      success: true,
      data: mockJudgments.slice(0, parseInt(limit)),
      count: mockJudgments.length,
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
