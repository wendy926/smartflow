/**
 * 聪明钱V2 API路由
 * 基于候选-确认分层策略的聪明钱检测API
 * 
 * 设计原则：
 * 1. 单一职责：专注于API路由
 * 2. 开闭原则：支持功能扩展
 * 3. 依赖倒置：依赖抽象接口
 * 4. 接口隔离：提供简洁的API接口
 * 5. RESTful设计：遵循REST规范
 */

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');

/**
 * 初始化路由
 */
function initRoutes() {
  /**
   * GET /api/v1/smart-money-v2/status
   * 获取所有交易对的聪明钱状态
   * 
   * @returns {Object} 所有交易对的状态
   */
  router.get('/status', async (req, res) => {
    try {
      const monitor = req.app.get('smartMoneyV2Monitor');

      if (!monitor) {
        return res.status(503).json({
          success: false,
          error: '聪明钱V2监控服务未初始化'
        });
      }

      const states = monitor.getAllStates();

      res.json({
        success: true,
        data: states,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('[聪明钱V2 API] 获取状态失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/v1/smart-money-v2/status/:symbol
   * 获取指定交易对的聪明钱状态
   * 
   * @param {string} symbol - 交易对
   * @returns {Object} 交易对状态
   */
  router.get('/status/:symbol', async (req, res) => {
    try {
      const monitor = req.app.get('smartMoneyV2Monitor');
      const symbol = req.params.symbol.toUpperCase();

      if (!monitor) {
        return res.status(503).json({
          success: false,
          error: '聪明钱V2监控服务未初始化'
        });
      }

      const state = monitor.getState(symbol);

      if (!state) {
        return res.status(404).json({
          success: false,
          error: `交易对${symbol}未找到`
        });
      }

      res.json({
        success: true,
        data: state,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('[聪明钱V2 API] 获取状态失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/v1/smart-money-v2/detect/:symbol
   * 手动触发指定交易对的检测
   * 
   * @param {string} symbol - 交易对
   * @returns {Object} 检测结果
   */
  router.post('/detect/:symbol', async (req, res) => {
    try {
      const monitor = req.app.get('smartMoneyV2Monitor');
      const symbol = req.params.symbol.toUpperCase();

      if (!monitor) {
        return res.status(503).json({
          success: false,
          error: '聪明钱V2监控服务未初始化'
        });
      }

      const state = await monitor.triggerDetection(symbol);

      res.json({
        success: true,
        data: state,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('[聪明钱V2 API] 手动检测失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/v1/smart-money-v2/stats
   * 获取监控统计信息
   * 
   * @returns {Object} 统计信息
   */
  router.get('/stats', async (req, res) => {
    try {
      const monitor = req.app.get('smartMoneyV2Monitor');

      if (!monitor) {
        return res.status(503).json({
          success: false,
          error: '聪明钱V2监控服务未初始化'
        });
      }

      const stats = monitor.getStats();

      res.json({
        success: true,
        data: stats,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('[聪明钱V2 API] 获取统计信息失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/v1/smart-money-v2/history/:symbol
   * 获取指定交易对的历史状态变化
   * 
   * @param {string} symbol - 交易对
   * @param {number} limit - 限制数量（默认50）
   * @returns {Object} 历史记录
   */
  router.get('/history/:symbol', async (req, res) => {
    try {
      const database = req.app.get('database');
      const symbol = req.params.symbol.toUpperCase();
      const limit = parseInt(req.query.limit) || 50;

      const sql = `
        SELECT 
          from_stage,
          to_stage,
          transition_time,
          transition_duration_ms,
          transition_confidence,
          transition_reasons,
          price_at_transition,
          volume_at_transition
        FROM four_phase_stage_transitions
        WHERE symbol = ?
        ORDER BY transition_time DESC
        LIMIT ?
      `;

      const rows = await database.query(sql, [symbol, limit]);

      const history = rows.map(row => ({
        from: row.from_stage,
        to: row.to_stage,
        time: row.transition_time,
        duration: row.transition_duration_ms,
        confidence: row.transition_confidence,
        reasons: JSON.parse(row.transition_reasons || '[]'),
        price: row.price_at_transition,
        volume: row.volume_at_transition
      }));

      res.json({
        success: true,
        data: history,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('[聪明钱V2 API] 获取历史记录失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/v1/smart-money-v2/recent/:symbol
   * 获取指定交易对的最近检测结果
   * 
   * @param {string} symbol - 交易对
   * @param {number} limit - 限制数量（默认20）
   * @returns {Object} 最近检测结果
   */
  router.get('/recent/:symbol', async (req, res) => {
    try {
      const database = req.app.get('database');
      const symbol = req.params.symbol.toUpperCase();
      const limit = parseInt(req.query.limit) || 20;

      const sql = `
        SELECT 
          timestamp,
          current_stage,
          stage_confidence,
          stage_duration_ms,
          trigger_reasons,
          raw_indicators
        FROM four_phase_smart_money_results
        WHERE symbol = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `;

      const rows = await database.query(sql, [symbol, limit]);

      const results = rows.map(row => ({
        time: row.timestamp,
        stage: row.current_stage,
        confidence: row.stage_confidence,
        duration: row.stage_duration_ms,
        reasons: JSON.parse(row.trigger_reasons || '[]'),
        indicators: JSON.parse(row.raw_indicators || '{}')
      }));

      res.json({
        success: true,
        data: results,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('[聪明钱V2 API] 获取最近检测结果失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}

module.exports = initRoutes;

