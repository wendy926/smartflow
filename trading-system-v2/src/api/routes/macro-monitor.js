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

    query += ' ORDER BY created_at DESC LIMIT 50';

    const rows = await req.macroMonitor.database.query(query, params);

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
 * 获取未平仓合约涨跌数据
 * GET /api/v1/macro-monitor/open-interest
 */
router.get('/open-interest', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    
    // 获取未平仓合约数据，按交易所分组
    const query = `
      SELECT 
        source,
        metric_value as openInterest,
        JSON_EXTRACT(raw_data, '$.oiChangePercent') as oiChangePercent,
        created_at
      FROM macro_monitoring_data 
      WHERE data_type = 'FUTURES_MARKET' 
      AND metric_name = '未平仓合约'
      AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      ORDER BY created_at DESC
      LIMIT ?
    `;
    
    const rows = await req.macroMonitor.database.query(query, [limit]);
    
    // 按交易所分组并计算统计数据
    const exchangeData = {};
    const summary = {
      totalExchanges: 0,
      averageChange: 0,
      positiveChanges: 0,
      negativeChanges: 0,
      lastUpdate: null
    };
    
    rows.forEach(row => {
      const exchange = row.source;
      const oiChangePercent = parseFloat(row.oiChangePercent) || 0;
      
      if (!exchangeData[exchange]) {
        exchangeData[exchange] = {
          name: exchange,
          data: [],
          latest: null,
          averageChange: 0,
          trend: 'stable'
        };
      }
      
      exchangeData[exchange].data.push({
        openInterest: parseFloat(row.openInterest),
        changePercent: oiChangePercent,
        timestamp: row.created_at
      });
      
      // 更新最新数据
      if (!exchangeData[exchange].latest || row.created_at > exchangeData[exchange].latest.timestamp) {
        exchangeData[exchange].latest = {
          openInterest: parseFloat(row.openInterest),
          changePercent: oiChangePercent,
          timestamp: row.created_at
        };
      }
      
      // 更新汇总统计
      if (!summary.lastUpdate || row.created_at > summary.lastUpdate) {
        summary.lastUpdate = row.created_at;
      }
    });
    
    // 计算各交易所的平均变化和趋势
    Object.keys(exchangeData).forEach(exchange => {
      const data = exchangeData[exchange].data;
      const changes = data.map(d => d.changePercent).filter(c => !isNaN(c));
      
      if (changes.length > 0) {
        exchangeData[exchange].averageChange = changes.reduce((a, b) => a + b, 0) / changes.length;
        exchangeData[exchange].trend = exchangeData[exchange].averageChange > 0.5 ? 'up' : 
                                      exchangeData[exchange].averageChange < -0.5 ? 'down' : 'stable';
      }
    });
    
    // 计算总体统计
    summary.totalExchanges = Object.keys(exchangeData).length;
    const allChanges = Object.values(exchangeData)
      .map(ex => ex.averageChange)
      .filter(c => !isNaN(c));
    
    if (allChanges.length > 0) {
      summary.averageChange = allChanges.reduce((a, b) => a + b, 0) / allChanges.length;
      summary.positiveChanges = allChanges.filter(c => c > 0).length;
      summary.negativeChanges = allChanges.filter(c => c < 0).length;
    }
    
    res.json({
      success: true,
      data: {
        exchanges: exchangeData,
        summary: summary,
        lastUpdate: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('获取未平仓合约涨跌数据失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取7天宏观数据趋势
 * GET /api/v1/macro-monitor/trends
 */
router.get('/trends', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const interval = req.query.interval || '4h'; // 4小时间隔
    
    // 计算时间范围
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (days * 24 * 60 * 60 * 1000));
    
    // 获取市场情绪数据（恐惧贪婪指数）
    const sentimentQuery = `
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') as time_bucket,
        AVG(CAST(metric_value AS DECIMAL(10,4))) as avg_value,
        COUNT(*) as data_points
      FROM macro_monitoring_data 
      WHERE data_type = 'MARKET_SENTIMENT' 
      AND metric_name = '恐惧贪婪指数'
      AND created_at >= ? AND created_at <= ?
      GROUP BY time_bucket
      ORDER BY time_bucket ASC
    `;
    
    // 获取多空比数据
    const longShortQuery = `
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') as time_bucket,
        source,
        AVG(CAST(metric_value AS DECIMAL(10,4))) as avg_value,
        COUNT(*) as data_points
      FROM macro_monitoring_data 
      WHERE data_type = 'FUTURES_MARKET' 
      AND metric_name = '多空比'
      AND created_at >= ? AND created_at <= ?
      GROUP BY time_bucket, source
      ORDER BY time_bucket ASC, source ASC
    `;
    
    // 获取资金费率数据
    const fundingRateQuery = `
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') as time_bucket,
        source,
        AVG(CAST(metric_value AS DECIMAL(10,6))) as avg_value,
        COUNT(*) as data_points
      FROM macro_monitoring_data 
      WHERE data_type = 'FUTURES_MARKET' 
      AND metric_name = '资金费率'
      AND created_at >= ? AND created_at <= ?
      GROUP BY time_bucket, source
      ORDER BY time_bucket ASC, source ASC
    `;
    
    // 获取未平仓合约数据
    const openInterestQuery = `
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') as time_bucket,
        source,
        AVG(CAST(metric_value AS DECIMAL(15,2))) as avg_value,
        COUNT(*) as data_points
      FROM macro_monitoring_data 
      WHERE data_type = 'FUTURES_MARKET' 
      AND metric_name = '未平仓合约'
      AND created_at >= ? AND created_at <= ?
      GROUP BY time_bucket, source
      ORDER BY time_bucket ASC, source ASC
    `;
    
    // 并行执行查询
    const [sentimentData, longShortData, fundingRateData, openInterestData] = await Promise.all([
      req.macroMonitor.database.query(sentimentQuery, [startTime, endTime]),
      req.macroMonitor.database.query(longShortQuery, [startTime, endTime]),
      req.macroMonitor.database.query(fundingRateQuery, [startTime, endTime]),
      req.macroMonitor.database.query(openInterestQuery, [startTime, endTime])
    ]);
    
    // 处理市场情绪数据
    const sentimentTrend = sentimentData.map(row => ({
      time: row.time_bucket,
      value: parseFloat(row.avg_value) || 0,
      dataPoints: row.data_points
    }));
    
    // 处理多空比数据，按交易所分组
    const longShortTrend = {};
    longShortData.forEach(row => {
      const source = row.source;
      if (!longShortTrend[source]) {
        longShortTrend[source] = [];
      }
      longShortTrend[source].push({
        time: row.time_bucket,
        value: parseFloat(row.avg_value) || 0,
        dataPoints: row.data_points
      });
    });
    
    // 处理资金费率数据，按交易所分组
    const fundingRateTrend = {};
    fundingRateData.forEach(row => {
      const source = row.source;
      if (!fundingRateTrend[source]) {
        fundingRateTrend[source] = [];
      }
      fundingRateTrend[source].push({
        time: row.time_bucket,
        value: parseFloat(row.avg_value) || 0,
        dataPoints: row.data_points
      });
    });
    
    // 处理未平仓合约数据，按交易所分组
    const openInterestTrend = {};
    openInterestData.forEach(row => {
      const source = row.source;
      if (!openInterestTrend[source]) {
        openInterestTrend[source] = [];
      }
      openInterestTrend[source].push({
        time: row.time_bucket,
        value: parseFloat(row.avg_value) || 0,
        dataPoints: row.data_points
      });
    });
    
    res.json({
      success: true,
      data: {
        period: `${days}天`,
        interval: interval,
        timeRange: {
          start: startTime.toISOString(),
          end: endTime.toISOString()
        },
        trends: {
          sentiment: sentimentTrend,
          longShortRatio: longShortTrend,
          fundingRate: fundingRateTrend,
          openInterest: openInterestTrend
        },
        lastUpdate: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('获取宏观数据趋势失败:', error);
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
      req.macroMonitor.fundFlowMonitor.getFundFlowData(10),
      req.macroMonitor.sentimentMonitor.getSentimentData(10),
      req.macroMonitor.futuresMonitor.getFuturesData(10),
      req.macroMonitor.macroMonitor.getMacroData(10)
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
        latest: futuresData.slice(0, 10),
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
