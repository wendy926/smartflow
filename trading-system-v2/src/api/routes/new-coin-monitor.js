/**
 * 新币监控 API 路由
 * 提供新币监控相关的 REST API 接口
 */

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const Joi = require('joi');

// 验证中间件
const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.details[0].message,
        timestamp: new Date().toISOString()
      });
    }
    next();
  };
};

// 请求验证模式
const addCoinSchema = Joi.object({
  symbol: Joi.string().required().max(20).pattern(/^[A-Z0-9]+USDT$/),
  name: Joi.string().required().max(100),
  github_repo: Joi.string().optional().max(200),
  team_score: Joi.number().min(0).max(10).default(0),
  supply_total: Joi.number().integer().min(0).default(0),
  supply_circulation: Joi.number().integer().min(0).default(0),
  vesting_lock_score: Joi.number().min(0).max(10).default(0),
  twitter_followers: Joi.number().integer().min(0).default(0),
  telegram_members: Joi.number().integer().min(0).default(0),
  status: Joi.string().valid('ACTIVE', 'INACTIVE', 'MONITORING').default('ACTIVE'),
  listing_date: Joi.date().optional()
});

const updateCoinSchema = Joi.object({
  name: Joi.string().optional().max(100),
  github_repo: Joi.string().optional().max(200),
  team_score: Joi.number().min(0).max(10).optional(),
  supply_total: Joi.number().integer().min(0).optional(),
  supply_circulation: Joi.number().integer().min(0).optional(),
  vesting_lock_score: Joi.number().min(0).max(10).optional(),
  twitter_followers: Joi.number().integer().min(0).optional(),
  telegram_members: Joi.number().integer().min(0).optional(),
  status: Joi.string().valid('ACTIVE', 'INACTIVE', 'MONITORING').optional()
});

/**
 * 获取新币监控概览
 * GET /api/v1/new-coin-monitor/overview
 */
router.get('/overview', async (req, res) => {
  try {
    const monitorController = req.app.get('newCoinMonitor');
    
    if (!monitorController) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'New coin monitor service is not available',
        timestamp: new Date().toISOString()
      });
    }
    
    const overview = await monitorController.getMonitorOverview();
    
    res.json({
      success: true,
      data: overview,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get monitor overview:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get monitor overview',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 获取所有监控中的新币
 * GET /api/v1/new-coin-monitor/coins
 */
router.get('/coins', async (req, res) => {
  try {
    const monitorController = req.app.get('newCoinMonitor');
    
    if (!monitorController) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'New coin monitor service is not available',
        timestamp: new Date().toISOString()
      });
    }
    
    const coins = await monitorController.getMonitoredCoins();
    
    res.json({
      success: true,
      data: coins,
      count: coins.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get monitored coins:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get monitored coins',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 添加新币到监控列表
 * POST /api/v1/new-coin-monitor/coins
 */
router.post('/coins', validateRequest(addCoinSchema), async (req, res) => {
  try {
    const monitorController = req.app.get('newCoinMonitor');
    
    if (!monitorController) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'New coin monitor service is not available',
        timestamp: new Date().toISOString()
      });
    }
    
    const coinId = await monitorController.addCoin(req.body);
    
    res.status(201).json({
      success: true,
      data: { id: coinId, ...req.body },
      message: 'Coin added to monitoring successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to add coin:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({
        error: 'Conflict',
        message: 'Coin symbol already exists',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to add coin to monitoring',
        timestamp: new Date().toISOString()
      });
    }
  }
});

/**
 * 更新新币信息
 * PUT /api/v1/new-coin-monitor/coins/:symbol
 */
router.put('/coins/:symbol', validateRequest(updateCoinSchema), async (req, res) => {
  try {
    const { symbol } = req.params;
    const database = req.app.get('database');
    
    const updateFields = [];
    const values = [];
    
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        updateFields.push(`${key} = ?`);
        values.push(req.body[key]);
      }
    });
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No fields to update',
        timestamp: new Date().toISOString()
      });
    }
    
    values.push(symbol);
    
    const query = `
      UPDATE new_coins 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE symbol = ?
    `;
    
    const result = await database.query(query, values);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Coin not found',
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      message: 'Coin updated successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to update coin:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update coin',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 删除新币监控
 * DELETE /api/v1/new-coin-monitor/coins/:symbol
 */
router.delete('/coins/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const database = req.app.get('database');
    
    const query = 'DELETE FROM new_coins WHERE symbol = ?';
    const result = await database.query(query, [symbol]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Coin not found',
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      message: 'Coin removed from monitoring successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to delete coin:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete coin',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 获取新币评分历史
 * GET /api/v1/new-coin-monitor/coins/:symbol/scores
 */
router.get('/coins/:symbol/scores', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { limit = 100, offset = 0 } = req.query;
    const database = req.app.get('database');
    
    const query = `
      SELECT ncs.*, nc.symbol, nc.name
      FROM new_coin_scores ncs
      JOIN new_coins nc ON ncs.coin_id = nc.id
      WHERE nc.symbol = ?
      ORDER BY ncs.evaluation_time DESC
      LIMIT ? OFFSET ?
    `;
    
    const scores = await database.query(query, [symbol, parseInt(limit), parseInt(offset)]);
    
    res.json({
      success: true,
      data: scores,
      count: scores.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get coin scores:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get coin scores',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 获取新币市场数据历史
 * GET /api/v1/new-coin-monitor/coins/:symbol/market-data
 */
router.get('/coins/:symbol/market-data', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { limit = 100, offset = 0 } = req.query;
    const database = req.app.get('database');
    
    const query = `
      SELECT ncmd.*, nc.symbol, nc.name
      FROM new_coin_market_data ncmd
      JOIN new_coins nc ON ncmd.coin_id = nc.id
      WHERE nc.symbol = ?
      ORDER BY ncmd.data_time DESC
      LIMIT ? OFFSET ?
    `;
    
    const marketData = await database.query(query, [symbol, parseInt(limit), parseInt(offset)]);
    
    res.json({
      success: true,
      data: marketData,
      count: marketData.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get market data:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get market data',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 获取新币告警记录
 * GET /api/v1/new-coin-monitor/alerts
 */
router.get('/alerts', async (req, res) => {
  try {
    const { limit = 100, offset = 0, level, type } = req.query;
    const database = req.app.get('database');
    
    let whereClause = 'WHERE 1=1';
    const values = [];
    
    if (level) {
      whereClause += ' AND alert_level = ?';
      values.push(level);
    }
    
    if (type) {
      whereClause += ' AND alert_type = ?';
      values.push(type);
    }
    
    const query = `
      SELECT nca.*, nc.symbol, nc.name
      FROM new_coin_alerts nca
      JOIN new_coins nc ON nca.coin_id = nc.id
      ${whereClause}
      ORDER BY nca.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    values.push(parseInt(limit), parseInt(offset));
    const alerts = await database.query(query, values);
    
    res.json({
      success: true,
      data: alerts,
      count: alerts.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get alerts:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get alerts',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 获取告警统计
 * GET /api/v1/new-coin-monitor/alert-statistics
 */
router.get('/alert-statistics', async (req, res) => {
  try {
    const monitorController = req.app.get('newCoinMonitor');
    
    if (!monitorController) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'New coin monitor service is not available',
        timestamp: new Date().toISOString()
      });
    }
    
    const statistics = await monitorController.getAlertStatistics();
    
    res.json({
      success: true,
      data: statistics,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get alert statistics:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get alert statistics',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 手动触发新币评估
 * POST /api/v1/new-coin-monitor/evaluate
 */
router.post('/evaluate', async (req, res) => {
  try {
    const monitorController = req.app.get('newCoinMonitor');
    
    if (!monitorController) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'New coin monitor service is not available',
        timestamp: new Date().toISOString()
      });
    }
    
    // 异步执行评估
    monitorController.evaluateAllCoins().catch(error => {
      logger.error('Manual evaluation failed:', error);
    });
    
    res.json({
      success: true,
      message: 'Evaluation started',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to start evaluation:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to start evaluation',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 获取监控配置
 * GET /api/v1/new-coin-monitor/config
 */
router.get('/config', async (req, res) => {
  try {
    const database = req.app.get('database');
    
    const query = `
      SELECT config_key, config_value, config_type, description, is_active
      FROM new_coin_monitor_config
      ORDER BY config_key
    `;
    
    const configs = await database.query(query);
    
    res.json({
      success: true,
      data: configs,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get config:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get config',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 更新监控配置
 * PUT /api/v1/new-coin-monitor/config
 */
router.put('/config', async (req, res) => {
  try {
    const database = req.app.get('database');
    const { configs } = req.body;
    
    if (!Array.isArray(configs)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Configs must be an array',
        timestamp: new Date().toISOString()
      });
    }
    
    const updatePromises = configs.map(config => {
      const query = `
        UPDATE new_coin_monitor_config 
        SET config_value = ?, updated_at = CURRENT_TIMESTAMP
        WHERE config_key = ?
      `;
      return database.query(query, [config.config_value, config.config_key]);
    });
    
    await Promise.all(updatePromises);
    
    res.json({
      success: true,
      message: 'Config updated successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to update config:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update config',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 获取新币监控服务状态
 * GET /api/v1/new-coin-monitor/status
 */
router.get('/status', async (req, res) => {
  try {
    const monitorController = req.app.get('newCoinMonitor');
    
    const status = {
      isRunning: monitorController ? monitorController.isRunning : false,
      config: monitorController ? Object.keys(monitorController.config).length : 0,
      activeIntervals: monitorController ? Object.keys(monitorController.intervals).length : 0,
      requestQueue: monitorController ? monitorController.requestQueue.length : 0,
      activeRequests: monitorController ? monitorController.activeRequests : 0
    };
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get status:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get status',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
