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
      rolling: { name: '动态杠杆滚仓工具', status: 'active' },
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

module.exports = router;
