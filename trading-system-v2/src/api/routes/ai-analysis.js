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
    const { symbols } = req.query;
    const symbolList = symbols ? symbols.split(',') : ['BTCUSDT', 'ETHUSDT'];

    const operations = getAIOps();
    const results = {};

    // 获取实时价格（与AI分析数据并行，使用单例）
    const { getBinanceAPI } = require('../../api/binance-api-singleton');
    const binanceAPI = getBinanceAPI();

    for (const symbol of symbolList) {
      const analysis = await operations.getLatestAnalysis(symbol, 'MACRO_RISK');

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
 * GET /api/v1/ai/symbol-analysis?symbol=BTCUSDT
 */
router.get('/symbol-analysis', async (req, res) => {
  try {
    const { symbol } = req.query;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: '缺少symbol参数'
      });
    }

    const operations = getAIOps();
    const analysis = await operations.getLatestAnalysis(symbol, 'SYMBOL_TREND');

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

module.exports = router;

