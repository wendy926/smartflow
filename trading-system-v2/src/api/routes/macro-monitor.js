/**
 * 宏观监控API路由
 * 提供宏观监控数据的API接口
 */

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');

// 中间件：获取宏观监控控制器
const getMacroMonitorController = (req, res, next) => {
  req.macroMonitor = req.app.get('macroMonitor');
  if (!req.macroMonitor) {
    return res.status(500).json({
      success: false,
      error: '宏观监控服务未初始化'
    });
  }
  next();
};

// 应用中间件
router.use(getMacroMonitorController);

/**
 * 获取宏观监控状态
 * GET /api/v1/macro-monitor/status
 */
router.get('/status', async (req, res) => {
  try {
    const status = await req.macroMonitor.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('获取宏观监控状态失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 手动触发监控
 * POST /api/v1/macro-monitor/trigger
 */
router.post('/trigger', async (req, res) => {
  try {
    const result = await req.macroMonitor.triggerMonitoring();
    res.json(result);
  } catch (error) {
    logger.error('手动触发监控失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取资金流数据
 * GET /api/v1/macro-monitor/fund-flow
 */
router.get('/fund-flow', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const data = await req.macroMonitor.fundFlowMonitor.getFundFlowData(limit);

    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    logger.error('获取资金流数据失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取市场情绪数据
 * GET /api/v1/macro-monitor/sentiment
 */
router.get('/sentiment', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const data = await req.macroMonitor.sentimentMonitor.getSentimentData(limit);

    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    logger.error('获取市场情绪数据失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取当前恐惧贪婪指数
 * GET /api/v1/macro-monitor/sentiment/current
 */
router.get('/sentiment/current', async (req, res) => {
  try {
    const data = await req.macroMonitor.sentimentMonitor.getCurrentFearGreedIndex();

    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    logger.error('获取当前恐惧贪婪指数失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取合约市场数据
 * GET /api/v1/macro-monitor/futures
 */
router.get('/futures', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const data = await req.macroMonitor.futuresMonitor.getFuturesData(limit);

    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    logger.error('获取合约市场数据失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取宏观指标数据
 * GET /api/v1/macro-monitor/macro
 */
router.get('/macro', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const data = await req.macroMonitor.macroMonitor.getMacroData(limit);

    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    logger.error('获取宏观指标数据失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取当前美联储利率
 * GET /api/v1/macro-monitor/macro/fed-funds
 */
router.get('/macro/fed-funds', async (req, res) => {
  try {
    const data = await req.macroMonitor.macroMonitor.getCurrentFedFundsRate();

    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    logger.error('获取当前美联储利率失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取当前CPI通胀率
 * GET /api/v1/macro-monitor/macro/cpi
 */
router.get('/macro/cpi', async (req, res) => {
  try {
    const data = await req.macroMonitor.macroMonitor.getCurrentCPIRate();

    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    logger.error('获取当前CPI通胀率失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取告警记录
 * GET /api/v1/macro-monitor/alerts
 */
router.get('/alerts', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const alertType = req.query.type;
    const alertLevel = req.query.level;

    let query = 'SELECT * FROM macro_monitoring_alerts WHERE 1=1';
    const params = [];

    if (alertType) {
      query += ' AND alert_type = ?';
      params.push(alertType);
    }

    if (alertLevel) {
      query += ' AND alert_level = ?';
      params.push(alertLevel);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const [rows] = await req.macroMonitor.database.execute(query, params);

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    logger.error('获取告警记录失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取监控数据概览
 * GET /api/v1/macro-monitor/overview
 */
router.get('/overview', async (req, res) => {
  try {
    const status = await req.macroMonitor.getStatus();

    // 获取各模块最新数据
    const [fundFlowData, sentimentData, futuresData, macroData] = await Promise.all([
      req.macroMonitor.fundFlowMonitor.getFundFlowData(5),
      req.macroMonitor.sentimentMonitor.getSentimentData(5),
      req.macroMonitor.futuresMonitor.getFuturesData(5),
      req.macroMonitor.macroMonitor.getMacroData(5)
    ]);

    // 获取当前关键指标
    const [currentFearGreed, currentFedFunds, currentCPI] = await Promise.all([
      req.macroMonitor.sentimentMonitor.getCurrentFearGreedIndex(),
      req.macroMonitor.macroMonitor.getCurrentFedFundsRate(),
      req.macroMonitor.macroMonitor.getCurrentCPIRate()
    ]);

    const overview = {
      status: status.isRunning,
      lastUpdate: new Date().toISOString(),
      fundFlow: {
        latest: fundFlowData.slice(0, 3),
        count: fundFlowData.length
      },
      sentiment: {
        latest: sentimentData.slice(0, 3),
        current: currentFearGreed,
        count: sentimentData.length
      },
      futures: {
        latest: futuresData.slice(0, 3),
        count: futuresData.length
      },
      macro: {
        latest: macroData.slice(0, 3),
        current: {
          fedFunds: currentFedFunds,
          cpi: currentCPI
        },
        count: macroData.length
      }
    };

    res.json({
      success: true,
      data: overview
    });
  } catch (error) {
    logger.error('获取监控数据概览失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
