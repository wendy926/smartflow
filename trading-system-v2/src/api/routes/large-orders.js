/**
 * 大额挂单API路由
 * 提供大额挂单监控的REST API
 * 
 * @module api/routes/large-orders
 */

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');

/**
 * 初始化路由
 * @param {LargeOrderDetector} detector - 大额挂单检测器实例
 * @param {Object} database - 数据库实例
 */
function initRoutes(detector, database) {
  /**
   * GET /api/v1/large-orders/detect
   * 获取指定交易对的大额挂单检测结果
   * 
   * @query {string} symbols - 交易对（逗号分隔，可选）
   * @returns {Object} { success, data: [{symbol, finalAction, buyScore, ...}] }
   */
  router.get('/detect', async (req, res) => {
    try {
      const { symbols } = req.query;
      let targetSymbols = [];
      
      if (symbols) {
        targetSymbols = symbols.split(',').map(s => s.trim().toUpperCase());
      } else {
        // 获取所有活跃的监控交易对
        const sql = 'SELECT symbol FROM smart_money_watch_list WHERE is_active = 1';
        const rows = await database.query(sql);
        targetSymbols = rows.map(row => row.symbol);
      }
      
      const results = [];
      for (const symbol of targetSymbols) {
        try {
          const result = await detector.detect(symbol);
          results.push(result);
        } catch (error) {
          logger.error('[LargeOrdersAPI] 检测失败', { symbol, error: error.message });
          results.push({
            symbol,
            error: error.message,
            timestamp: Date.now()
          });
        }
      }
      
      res.json({
        success: true,
        data: results,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('[LargeOrdersAPI] /detect 失败', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/v1/large-orders/status
   * 获取监控状态
   * 
   * @returns {Object} 监控状态
   */
  router.get('/status', async (req, res) => {
    try {
      const status = detector.getMonitoringStatus();
      res.json({
        success: true,
        data: status,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('[LargeOrdersAPI] /status 失败', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/v1/large-orders/history
   * 获取历史检测结果
   * 
   * @query {string} symbol - 交易对
   * @query {number} limit - 限制数量（默认20）
   * @returns {Object} 历史记录
   */
  router.get('/history', async (req, res) => {
    try {
      const { symbol, limit = 20 } = req.query;
      
      if (!symbol) {
        return res.status(400).json({
          success: false,
          error: 'symbol参数必填'
        });
      }
      
      const sql = `
        SELECT * FROM large_order_detection_results 
        WHERE symbol = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
      `;
      
      const rows = await database.query(sql, [symbol.toUpperCase(), parseInt(limit)]);
      
      res.json({
        success: true,
        data: rows.map(row => ({
          ...row,
          detection_data: row.detection_data ? JSON.parse(row.detection_data) : null
        })),
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('[LargeOrdersAPI] /history 失败', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/v1/large-orders/monitor/start
   * 启动监控
   * 
   * @body {string} symbol - 交易对
   * @returns {Object} 操作结果
   */
  router.post('/monitor/start', async (req, res) => {
    try {
      const { symbol } = req.body;
      
      if (!symbol) {
        return res.status(400).json({
          success: false,
          error: 'symbol参数必填'
        });
      }
      
      detector.startMonitoring(symbol.toUpperCase());
      
      res.json({
        success: true,
        message: `已启动 ${symbol} 的监控`,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('[LargeOrdersAPI] /monitor/start 失败', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/v1/large-orders/monitor/stop
   * 停止监控
   * 
   * @body {string} symbol - 交易对（可选，不传则停止所有）
   * @returns {Object} 操作结果
   */
  router.post('/monitor/stop', async (req, res) => {
    try {
      const { symbol } = req.body;
      
      if (symbol) {
        detector.stopMonitoring(symbol.toUpperCase());
        res.json({
          success: true,
          message: `已停止 ${symbol} 的监控`,
          timestamp: Date.now()
        });
      } else {
        detector.stopMonitoring();
        res.json({
          success: true,
          message: '已停止所有监控',
          timestamp: Date.now()
        });
      }
    } catch (error) {
      logger.error('[LargeOrdersAPI] /monitor/stop 失败', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/v1/large-orders/config
   * 获取配置
   * 
   * @returns {Object} 配置信息
   */
  router.get('/config', async (req, res) => {
    try {
      const sql = 'SELECT * FROM large_order_config';
      const rows = await database.query(sql);
      
      res.json({
        success: true,
        data: rows,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('[LargeOrdersAPI] /config 失败', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}

module.exports = initRoutes;

