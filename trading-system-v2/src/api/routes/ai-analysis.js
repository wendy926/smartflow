/**
 * AI分析API路由
 * 提供AI市场分析相关的REST API接口
 */

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const { toBeijingISO } = require('../../utils/time-helper');

// 延迟初始化
let aiOps = null;
let scheduler = null;

const getAIOps = () => {
  if (!aiOps) {
    aiOps = require('../../database/ai-operations')();
  }
  return aiOps;
};

const getScheduler = () => {
  if (!scheduler) {
    // 从全局获取scheduler实例
    scheduler = global.aiScheduler;
  }
  return scheduler;
};

/**
 * 获取宏观风险分析（使用AI Agent分析）
 * GET /api/v1/ai/macro-risk?symbols=BTCUSDT,ETHUSDT
 */
router.get('/macro-risk', async (req, res) => {
  try {
    const { symbols, forceRefresh } = req.query;
    const symbolList = symbols ? symbols.split(',') : ['BTCUSDT', 'ETHUSDT'];

    const operations = getAIOps();
    const results = {};

    // 获取实时价格（与AI分析数据并行，使用单例）
    const { getBinanceAPI } = require('../../api/binance-api-singleton');
    const binanceAPI = getBinanceAPI();

    for (const symbol of symbolList) {
      let analysis = await operations.getLatestAnalysis(symbol, 'MACRO_RISK');

      // 🆕 检查数据是否过期（超过2小时）或强制刷新
      const shouldRefresh = forceRefresh === 'true' ||
        !analysis ||
        (analysis && (Date.now() - new Date(analysis.createdAt).getTime()) > 2 * 60 * 60 * 1000);

      // 🆕 如果需要刷新且AI调度器可用，触发新的分析
      if (shouldRefresh) {
        const scheduler = getScheduler();
        if (scheduler) {
          try {
            logger.info(`[AI手动触发] 触发${symbol}宏观分析（数据过期或手动刷新）`);
            // 🔧 异步触发分析，不等待完成（避免API超时）
            scheduler.triggerMacroAnalysis(symbol).catch(error => {
              logger.warn(`[AI手动触发] 触发${symbol}分析失败:`, error.message);
            });
            logger.info(`[AI手动触发] ${symbol}分析已触发，使用现有数据`);
          } catch (triggerError) {
            logger.warn(`[AI手动触发] 触发${symbol}分析失败:`, triggerError.message);
            // 继续使用旧数据
          }
        } else {
          logger.warn('[AI手动触发] AI调度器未初始化，使用缓存数据');
        }
      }

      // 获取实时价格
      let realtimePrice = null;
      let realtimeTimestamp = null;
      try {
        const ticker = await binanceAPI.getTicker24hr(symbol);
        realtimePrice = parseFloat(ticker.lastPrice);
        realtimeTimestamp = new Date().toISOString();
      } catch (priceError) {
        logger.warn(`获取${symbol}实时价格失败:`, priceError.message);
      }

      if (analysis) {
        results[symbol] = {
          symbol: analysis.symbol,
          riskLevel: analysis.riskLevel,
          analysisData: analysis.analysisData,
          confidence: analysis.confidenceScore,
          updatedAt: analysis.updatedAt,
          createdAt: analysis.createdAt,
          // 添加实时价格信息
          realtimePrice: realtimePrice,
          realtimeTimestamp: realtimeTimestamp,
          analysisPrice: analysis.analysisData?.currentPrice || null
        };
      } else {
        results[symbol] = {
          symbol,
          riskLevel: null,
          analysisData: null,
          realtimePrice: realtimePrice,
          realtimeTimestamp: realtimeTimestamp,
          message: '暂无分析数据'
        };
      }
    }

    res.json({
      success: true,
      data: results,
      lastUpdate: new Date().toISOString()
    });

  } catch (error) {
    logger.error('获取宏观风险分析失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取交易对AI分析
 * GET /api/v1/ai/symbol-analysis?symbol=BTCUSDT&forceRefresh=true
 */
router.get('/symbol-analysis', async (req, res) => {
  try {
    const { symbol, forceRefresh } = req.query;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: '缺少symbol参数'
      });
    }

    const operations = getAIOps();
    let analysis = await operations.getLatestAnalysis(symbol, 'SYMBOL_TREND');
    
    // 检查是否需要强制刷新
    const shouldRefresh = forceRefresh === 'true' || 
                         !analysis || 
                         (analysis && (Date.now() - new Date(analysis.createdAt).getTime()) > 2 * 60 * 60 * 1000);

    if (shouldRefresh) {
      const scheduler = getScheduler();
      if (scheduler) {
        try {
          logger.info(`[AI手动触发] 触发${symbol}符号趋势分析（数据过期或手动刷新）`);
          // 异步触发分析，不等待完成（避免API超时）
          scheduler.triggerSymbolAnalysis(symbol).catch(error => {
            logger.warn(`[AI手动触发] 触发${symbol}符号分析失败:`, error.message);
          });
          logger.info(`[AI手动触发] ${symbol}符号分析已触发，使用现有数据`);
        } catch (triggerError) {
          logger.warn(`[AI手动触发] 触发${symbol}符号分析失败:`, triggerError.message);
          // 继续使用旧数据
        }
      } else {
        logger.warn('[AI手动触发] AI调度器未初始化，使用缓存数据');
      }
    }

    if (!analysis) {
      return res.json({
        success: true,
        data: null,
        message: '暂无分析数据'
      });
    }

    res.json({
      success: true,
      data: {
        symbol: analysis.symbol,
        analysisData: analysis.analysisData,
        confidence: analysis.confidenceScore,
        updatedAt: analysis.updatedAt,
        createdAt: analysis.createdAt
      }
    });

  } catch (error) {
    logger.error('获取交易对AI分析失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取所有最新AI分析
 * GET /api/v1/ai/latest?type=MACRO_RISK|SYMBOL_TREND
 */
router.get('/latest', async (req, res) => {
  try {
    const { type } = req.query;

    const operations = getAIOps();
    const analyses = await operations.getAllLatestAnalysis(type || null);

    res.json({
      success: true,
      data: analyses,
      count: analyses.length
    });

  } catch (error) {
    logger.error('获取所有最新AI分析失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 手动触发AI分析
 * POST /api/v1/ai/analyze
 * Body: { type: 'macro_risk' | 'symbol_trend', symbols: ['BTCUSDT'] }
 */
router.post('/analyze', async (req, res) => {
  try {
    const { type, symbols } = req.body;

    if (!type) {
      return res.status(400).json({
        success: false,
        error: '缺少type参数'
      });
    }

    const aiScheduler = getScheduler();

    if (!aiScheduler) {
      return res.status(503).json({
        success: false,
        error: 'AI调度器未启动'
      });
    }

    let result;

    if (type === 'macro_risk') {
      // 宏观风险分析
      const symbol = symbols && symbols.length > 0 ? symbols[0] : null;
      result = await aiScheduler.triggerMacroAnalysis(symbol);
    } else if (type === 'symbol_trend') {
      // 交易对趋势分析
      if (!symbols || symbols.length === 0) {
        return res.status(400).json({
          success: false,
          error: '交易对趋势分析需要提供symbols参数'
        });
      }
      result = await aiScheduler.triggerSymbolAnalysis(symbols[0]);
    } else {
      return res.status(400).json({
        success: false,
        error: '无效的分析类型'
      });
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('手动触发AI分析失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取AI配置状态
 * GET /api/v1/ai/config/status
 */
router.get('/config/status', async (req, res) => {
  try {
    const operations = getAIOps();
    const config = await operations.getConfig();

    const aiScheduler = getScheduler();
    const schedulerStatus = aiScheduler ? aiScheduler.getStatus() : null;

    res.json({
      success: true,
      data: {
        enabled: config.ai_analysis_enabled === 'true',
        macroUpdateInterval: parseInt(config.macro_update_interval),
        symbolUpdateInterval: parseInt(config.symbol_update_interval),
        alertDangerEnabled: config.alert_danger_enabled === 'true',
        alertExtremeEnabled: config.alert_extreme_enabled === 'true',
        scheduler: schedulerStatus
      }
    });

  } catch (error) {
    logger.error('获取AI配置状态失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取API统计
 * GET /api/v1/ai/stats?days=7
 */
router.get('/stats', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;

    const operations = getAIOps();
    const stats = await operations.getAPIStats(days);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('获取API统计失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取告警统计
 * GET /api/v1/ai/alerts/stats?days=7
 */
router.get('/alerts/stats', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;

    const operations = getAIOps();
    const aiScheduler = getScheduler();

    if (!aiScheduler || !aiScheduler.alertService) {
      return res.status(503).json({
        success: false,
        error: 'AI告警服务未启动'
      });
    }

    const stats = await aiScheduler.alertService.getAlertStats(days);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('获取告警统计失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 健康检查
 * GET /api/v1/ai/health
 */
router.get('/health', async (req, res) => {
  try {
    const aiScheduler = getScheduler();

    const health = {
      ai_enabled: false,
      scheduler_running: false,
      claude_available: false
    };

    if (aiScheduler) {
      const status = aiScheduler.getStatus();
      health.ai_enabled = status.initialized;
      health.scheduler_running = status.running;

      if (aiScheduler.claudeClient) {
        health.claude_available = await aiScheduler.claudeClient.healthCheck();
      }
    }

    res.json({
      success: true,
      data: health
    });

  } catch (error) {
    logger.error('AI健康检查失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 手动触发AI符号分析
 * POST /api/v1/ai/trigger-symbol-analysis
 */
router.post('/trigger-symbol-analysis', async (req, res) => {
  try {
    const { symbol } = req.body;  // 可选：指定单个交易对

    // 获取scheduler实例（需要从main.js传入）
    const scheduler = req.app.get('aiScheduler');

    if (!scheduler) {
      return res.status(503).json({
        success: false,
        error: 'AI分析调度器未初始化'
      });
    }

    if (symbol) {
      // 分析单个交易对
      logger.info(`手动触发 ${symbol} AI分析`);
      const result = await scheduler.triggerSymbolAnalysis(symbol);

      res.json({
        success: true,
        message: `${symbol} AI分析已完成`,
        data: result,
        timestamp: toBeijingISO()
      });
    } else {
      // 触发所有交易对分析
      logger.info('手动触发所有交易对AI分析');

      // 异步执行，不阻塞响应
      scheduler.runSymbolAnalysis().catch(err => {
        logger.error('手动触发AI分析失败:', err);
      });

      res.json({
        success: true,
        message: 'AI分析任务已触发，预计3-5分钟完成',
        timestamp: toBeijingISO()
      });
    }
  } catch (error) {
    logger.error('手动触发AI分析失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取AI分析监控状态（用于系统监控页面）
 * GET /api/v1/ai/monitoring/status
 */
router.get('/monitoring/status', async (req, res) => {
  try {
    const operations = getAIOps();

    // 获取宏观风险分析状态
    const [macroAnalysis] = await operations.pool.query(`
      SELECT 
        symbol,
        risk_level,
        created_at,
        TIMESTAMPDIFF(MINUTE, created_at, NOW()) as age_minutes
      FROM ai_market_analysis
      WHERE analysis_type = 'MACRO_RISK'
      ORDER BY created_at DESC
      LIMIT 10
    `);

    // 获取交易对趋势分析状态
    const [symbolAnalysis] = await operations.pool.query(`
      SELECT 
        symbol,
        created_at,
        TIMESTAMPDIFF(MINUTE, created_at, NOW()) as age_minutes
      FROM ai_market_analysis
      WHERE analysis_type = 'SYMBOL_TREND'
      ORDER BY created_at DESC
      LIMIT 20
    `);

    // 获取最近24小时的成功率统计
    const [stats] = await operations.pool.query(`
      SELECT 
        analysis_type,
        COUNT(*) as total,
        SUM(CASE WHEN risk_level IS NOT NULL OR analysis_data IS NOT NULL THEN 1 ELSE 0 END) as success
      FROM ai_market_analysis
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY analysis_type
    `);

    // 处理宏观分析状态
    const macroSymbols = [...new Set(macroAnalysis.map(a => a.symbol))];
    const macroLatest = macroAnalysis.length > 0 ? macroAnalysis[0] : null;
    const macroStats = stats.find(s => s.analysis_type === 'MACRO_RISK');
    const macroSuccessRate = macroStats ? ((macroStats.success / macroStats.total) * 100).toFixed(1) : '100.0';

    // 处理交易对分析状态
    const symbolCount = [...new Set(symbolAnalysis.map(a => a.symbol))].length;
    const symbolLatest = symbolAnalysis.length > 0 ? symbolAnalysis[0] : null;
    const symbolStats = stats.find(s => s.analysis_type === 'SYMBOL_TREND');
    const symbolSuccessRate = symbolStats ? ((symbolStats.success / symbolStats.total) * 100).toFixed(1) : '100.0';

    // 获取配置
    const config = await operations.getConfig();
    const macroInterval = parseInt(config.macro_update_interval || 3600);
    const symbolInterval = parseInt(config.symbol_update_interval || 900);

    res.json({
      success: true,
      data: {
        macro: {
          symbols: macroSymbols,
          lastUpdate: macroLatest ? macroLatest.created_at : null,
          ageMinutes: macroLatest ? macroLatest.age_minutes : null,
          successRate: parseFloat(macroSuccessRate),
          nextUpdateMinutes: macroLatest ? Math.max(0, Math.floor(macroInterval / 60) - macroLatest.age_minutes) : 0,
          intervalMinutes: Math.floor(macroInterval / 60),
          total24h: macroStats ? macroStats.total : 0
        },
        symbol: {
          count: symbolCount,
          lastUpdate: symbolLatest ? symbolLatest.created_at : null,
          ageMinutes: symbolLatest ? symbolLatest.age_minutes : null,
          successRate: parseFloat(symbolSuccessRate),
          nextUpdateMinutes: symbolLatest ? Math.max(0, Math.floor(symbolInterval / 60) - symbolLatest.age_minutes) : 0,
          intervalMinutes: Math.floor(symbolInterval / 60),
          total24h: symbolStats ? symbolStats.total : 0
        }
      },
      timestamp: toBeijingISO()
    });

  } catch (error) {
    logger.error('获取AI监控状态失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

