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
const v3StrategyEnhanced = new V3StrategyEnhanced();
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
          v3Strategy.execute(symbol),  // 使用基础v3Strategy
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
        logger.info(`执行V3增强策略分析: ${sym.symbol}`);
        const result = await v3StrategyEnhanced.execute(sym.symbol);
        logger.info(`V3策略分析完成: ${sym.symbol}`, result);

        results.push({
          id: sym.id,
          symbol: sym.symbol,
          timeframe: '4H',
          trend: result.timeframes?.["4H"]?.trend || 'RANGE',
          signal: result.signal || 'HOLD',
          confidence: result.timeframes?.["4H"]?.confidence || 0,
          score: result.timeframes?.["4H"]?.score || 0,
          factors: result.timeframes?.["1H"]?.factors || {},
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
        logger.info(`执行ICT策略分析: ${sym.symbol}`);
        const result = await ictStrategy.execute(sym.symbol);
        logger.info(`ICT策略分析完成: ${sym.symbol}`, result);

        results.push({
          id: sym.id,
          symbol: sym.symbol,
          timeframe: '1D',
          trend: result.trend || 'RANGE',
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

/**
 * 获取策略统计信息
 * GET /api/v1/strategies/statistics
 */
router.get('/statistics', async (req, res) => {
  try {
    const dbOps = getDbOps();

    // 获取V3策略统计
    const v3Stats = await dbOps.getStrategyStatistics('v3');

    // 获取ICT策略统计
    const ictStats = await dbOps.getStrategyStatistics('ict');

    // 获取总体统计
    const totalStats = await dbOps.getTotalStatistics();

    const statistics = {
      v3: {
        totalTrades: v3Stats.totalTrades || 0,
        profitableTrades: v3Stats.profitableTrades || 0,
        losingTrades: v3Stats.losingTrades || 0,
        winRate: v3Stats.winRate || 0,
        totalPnl: v3Stats.totalPnl || 0,
        maxDrawdown: v3Stats.maxDrawdown || 0
      },
      ict: {
        totalTrades: ictStats.totalTrades || 0,
        profitableTrades: ictStats.profitableTrades || 0,
        losingTrades: ictStats.losingTrades || 0,
        winRate: ictStats.winRate || 0,
        totalPnl: ictStats.totalPnl || 0,
        maxDrawdown: ictStats.maxDrawdown || 0
      },
      overall: {
        totalTrades: totalStats.totalTrades || 0,
        profitableTrades: totalStats.profitableTrades || 0,
        losingTrades: totalStats.losingTrades || 0,
        winRate: totalStats.winRate || 0,
        totalPnl: totalStats.totalPnl || 0,
        maxDrawdown: totalStats.maxDrawdown || 0
      }
    };

    res.json({
      success: true,
      data: statistics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('获取策略统计失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取策略当前状态（包含所有交易对的判断信息）
 * GET /api/v1/strategies/current-status
 */
router.get('/current-status', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const dbOps = getDbOps();

    // 获取所有活跃的交易对
    const symbols = await dbOps.getAllSymbols();
    const activeSymbols = symbols.filter(s => s.status === 'ACTIVE').slice(0, parseInt(limit));

    const results = [];

    // 为每个交易对执行两个策略
    for (const sym of activeSymbols) {
      try {
        // 获取实时价格数据
        const BinanceAPI = require('../../api/binance-api');
        const api = new BinanceAPI();
        const tickerData = await api.getTicker24hr(sym.symbol);

        const [v3Result, ictResult] = await Promise.all([
          v3Strategy.execute(sym.symbol),  // 使用基础v3Strategy，与直接API调用一致
          ictStrategy.execute(sym.symbol)
        ]);

        results.push({
          symbol: sym.symbol,
          lastPrice: tickerData.lastPrice || sym.last_price || 0,
          priceChange24h: tickerData.priceChangePercent ? parseFloat(tickerData.priceChangePercent) / 100 : sym.price_change_24h || 0,
          timestamp: new Date().toISOString(),
          v3: {
            signal: v3Result.signal || 'HOLD',
            trend: v3Result.timeframes?.["4H"]?.trend || 'RANGE',
            score: v3Result.timeframes?.["4H"]?.score || 0,
            timeframes: {
              "4H": {
                trend: v3Result.timeframes?.["4H"]?.trend || 'RANGE',
                score: v3Result.timeframes?.["4H"]?.score || 0,
                adx: v3Result.timeframes?.["4H"]?.adx || 0,
                bbw: v3Result.timeframes?.["4H"]?.bbw || 0,
                ma20: v3Result.timeframes?.["4H"]?.ma20 || 0,
                ma50: v3Result.timeframes?.["4H"]?.ma50 || 0,
                ma200: v3Result.timeframes?.["4H"]?.ma200 || 0
              },
              "1H": {
                vwap: v3Result.timeframes?.["1H"]?.vwap || 0,
                oiChange: v3Result.timeframes?.["1H"]?.oiChange || 0,
                funding: v3Result.timeframes?.["1H"]?.funding || 0,
                delta: v3Result.timeframes?.["1H"]?.delta || 0,
                score: v3Result.timeframes?.["1H"]?.score || 0
              },
              "15M": {
                signal: v3Result.timeframes?.["15M"]?.signal || 'HOLD',
                ema20: v3Result.timeframes?.["15M"]?.ema20 || 0,
                ema50: v3Result.timeframes?.["15M"]?.ema50 || 0,
                atr: v3Result.timeframes?.["15M"]?.atr || 0,
                bbw: v3Result.timeframes?.["15M"]?.bbw || 0,
                score: v3Result.timeframes?.["15M"]?.score || 0
              }
            },
            entryPrice: v3Result.entryPrice || 0,
            stopLoss: v3Result.stopLoss || 0,
            takeProfit: v3Result.takeProfit || 0,
            leverage: v3Result.leverage || 0,
            margin: v3Result.margin || 0
          },
          ict: {
            signal: ictResult.signal || 'HOLD',
            trend: ictResult.trend || 'RANGE',
            score: ictResult.score || 0,
            confidence: ictResult.confidence || 'MEDIUM',
            timeframes: {
              "1D": {
                trend: ictResult.timeframes?.["1D"]?.trend || 'SIDEWAYS',
                closeChange: ictResult.timeframes?.["1D"]?.closeChange || 0,
                lookback: ictResult.timeframes?.["1D"]?.lookback || 20
              },
              "4H": {
                orderBlocks: ictResult.timeframes?.["4H"]?.orderBlocks || [],
                atr: ictResult.timeframes?.["4H"]?.atr || 0,
                sweepDetected: ictResult.timeframes?.["4H"]?.sweepDetected || false,
                sweepRate: ictResult.timeframes?.["4H"]?.sweepRate || 0
              },
              "15M": {
                signal: ictResult.timeframes?.["15M"]?.signal || 'HOLD',
                engulfing: ictResult.timeframes?.["15M"]?.engulfing || false,
                engulfingType: ictResult.timeframes?.["15M"]?.engulfingType || 'NONE',
                engulfingStrength: ictResult.timeframes?.["15M"]?.engulfingStrength || 0,
                atr: ictResult.timeframes?.["15M"]?.atr || 0,
                sweepRate: ictResult.timeframes?.["15M"]?.sweepRate || 0,
                volume: ictResult.timeframes?.["15M"]?.volume || 0,
                volumeExpansion: ictResult.timeframes?.["15M"]?.volumeExpansion || false,
                volumeRatio: ictResult.timeframes?.["15M"]?.volumeRatio || 0,
                harmonicPattern: ictResult.timeframes?.["15M"]?.harmonicPattern || {
                  detected: false,
                  type: 'NONE',
                  confidence: 0,
                  score: 0,
                  points: null
                }
              }
            },
            entryPrice: ictResult.entryPrice || 0,
            stopLoss: ictResult.stopLoss || 0,
            takeProfit: ictResult.takeProfit || 0,
            leverage: ictResult.leverage || 0,
            margin: ictResult.margin || 0
          },
          midTimeframePrice: v3Result.timeframes?.["4H"]?.price || ictResult.timeframes?.["4H"]?.price || 0
        });
      } catch (error) {
        logger.error(`获取${sym.symbol}策略状态失败:`, error);
        results.push({
          symbol: sym.symbol,
          error: error.message,
          v3: null,
          ict: null
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
    logger.error('获取策略当前状态失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取V3增强版策略状态
 * GET /api/v1/strategies/v3-enhanced/current-status
 */
router.get('/v3-enhanced/current-status', async (req, res) => {
  try {
    const { limit = 10, symbol } = req.query;

    // 获取交易对列表
    const dbOps = getDbOps();
    const symbols = await dbOps.getAllSymbols();

    // 应用限制和过滤
    let filteredSymbols = symbols;
    if (symbol) {
      filteredSymbols = symbols.filter(s => s.symbol === symbol);
    }
    if (limit) {
      filteredSymbols = filteredSymbols.slice(0, parseInt(limit));
    }

    if (!filteredSymbols || filteredSymbols.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        timestamp: new Date().toISOString()
      });
    }

    const results = [];

    for (const sym of filteredSymbols) {
      try {
        logger.info(`执行V3增强策略分析: ${sym.symbol}`);
        const v3EnhancedResult = await v3StrategyEnhanced.execute(sym.symbol);

        results.push({
          symbol: sym.symbol,
          v3Enhanced: {
            signal: v3EnhancedResult.signal,
            trend: v3EnhancedResult.trend,
            score: v3EnhancedResult.score,
            timeframes: v3EnhancedResult.timeframes,
            entryPrice: v3EnhancedResult.entryPrice || 0,
            stopLoss: v3EnhancedResult.stopLoss || 0,
            takeProfit: v3EnhancedResult.takeProfit || 0,
            leverage: v3EnhancedResult.leverage || 0,
            margin: v3EnhancedResult.margin || 0,
            enhanced: v3EnhancedResult.enhanced || false
          }
        });
      } catch (error) {
        logger.error(`获取${sym.symbol} V3增强策略状态失败:`, error);
        results.push({
          symbol: sym.symbol,
          error: error.message,
          v3Enhanced: null
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
    logger.error('获取V3增强策略当前状态失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取单个交易对的V3增强版策略分析
 * GET /api/v1/strategies/v3-enhanced/:symbol
 */
router.get('/v3-enhanced/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: '交易对参数缺失'
      });
    }

    logger.info(`执行V3增强策略分析: ${symbol}`);
    const result = await v3StrategyEnhanced.execute(symbol);

    res.json({
      success: true,
      data: {
        symbol: symbol,
        v3Enhanced: {
          signal: result.signal,
          trend: result.trend,
          score: result.score,
          timeframes: result.timeframes,
          entryPrice: result.entryPrice || 0,
          stopLoss: result.stopLoss || 0,
          takeProfit: result.takeProfit || 0,
          leverage: result.leverage || 0,
          margin: result.margin || 0,
          enhanced: result.enhanced || false
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`获取${req.params.symbol} V3增强策略分析失败:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
