/**
 * 大额挂单高级查询API路由
 * 提供特殊的大额挂单查询功能
 * 
 * @module api/routes/large-orders-advanced
 */

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');

/**
 * 初始化路由
 */
function initRoutes() {
  /**
   * GET /api/v1/large-orders-advanced/persistent-orders
   * 获取持续超过3天且单笔金额>10M的大额挂单数据
   * 
   * @query {string} symbols - 交易对（逗号分隔，默认BTCUSDT,ETHUSDT）
   * @query {number} minDays - 最小持续天数（默认3）
   * @query {number} minAmount - 最小金额（默认10M USD）
   * @returns {Object} 持续大额挂单数据
   */
  router.get('/persistent-orders', async (req, res) => {
    try {
      const database = req.app.get('database');
      const { symbols, minDays = 3, minAmount = 10000000 } = req.query;

      const symbolList = symbols ?
        symbols.split(',').map(s => s.trim().toUpperCase()) :
        ['BTCUSDT', 'ETHUSDT'];

      const minDaysMs = parseInt(minDays) * 24 * 60 * 60 * 1000;
      const minAmountUsd = parseInt(minAmount);

      // 查询持续超过指定天数的大额挂单
      const sql = `
        SELECT 
          symbol,
          JSON_EXTRACT(detection_data, '$.trackedEntries') as trackedEntries,
          created_at
        FROM large_order_detection_results 
        WHERE symbol IN (${symbolList.map(() => '?').join(',')})
          AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        ORDER BY created_at DESC
      `;

      const rows = await database.query(sql, [...symbolList, minDays + 1]);

      // 处理数据，找出持续超过指定天数的挂单
      const persistentOrders = new Map();
      const now = Date.now();

      for (const row of rows) {
        try {
          const trackedEntries = JSON.parse(row.trackedEntries || '[]');
          const recordTime = new Date(row.created_at).getTime();

          for (const entry of trackedEntries) {
            if (entry.valueUSD >= minAmountUsd) {
              const key = `${entry.side}@${entry.price}`;
              const duration = now - entry.createdAt;

              if (duration >= minDaysMs) {
                if (!persistentOrders.has(key)) {
                  persistentOrders.set(key, {
                    symbol: row.symbol,
                    side: entry.side,
                    price: entry.price,
                    qty: entry.qty,
                    valueUSD: entry.valueUSD,
                    createdAt: entry.createdAt,
                    lastSeenAt: entry.lastSeenAt,
                    duration: duration,
                    durationDays: Math.floor(duration / (24 * 60 * 60 * 1000)),
                    appearances: 1
                  });
                } else {
                  const existing = persistentOrders.get(key);
                  existing.appearances++;
                  existing.lastSeenAt = Math.max(existing.lastSeenAt, entry.lastSeenAt);
                }
              }
            }
          }
        } catch (error) {
          logger.warn('[PersistentOrders] 解析数据失败:', {
            symbol: row.symbol,
            error: error.message
          });
        }
      }

      // 按交易对分组并计算买卖比例
      const result = {};
      for (const symbol of symbolList) {
        const symbolOrders = Array.from(persistentOrders.values())
          .filter(order => order.symbol === symbol);

        const buyOrders = symbolOrders.filter(order => order.side === 'bid');
        const sellOrders = symbolOrders.filter(order => order.side === 'ask');

        const totalValue = symbolOrders.reduce((sum, order) => sum + order.valueUSD, 0);
        const buyValue = buyOrders.reduce((sum, order) => sum + order.valueUSD, 0);
        const sellValue = sellOrders.reduce((sum, order) => sum + order.valueUSD, 0);

        result[symbol] = {
          totalOrders: symbolOrders.length,
          buyOrders: buyOrders.length,
          sellOrders: sellOrders.length,
          buyRatio: symbolOrders.length > 0 ? (buyOrders.length / symbolOrders.length * 100).toFixed(1) : 0,
          sellRatio: symbolOrders.length > 0 ? (sellOrders.length / symbolOrders.length * 100).toFixed(1) : 0,
          totalValue: totalValue,
          buyValue: buyValue,
          sellValue: sellValue,
          buyValueRatio: totalValue > 0 ? (buyValue / totalValue * 100).toFixed(1) : 0,
          sellValueRatio: totalValue > 0 ? (sellValue / totalValue * 100).toFixed(1) : 0,
          orders: symbolOrders.sort((a, b) => b.valueUSD - a.valueUSD)
        };
      }

      res.json({
        success: true,
        data: result,
        criteria: {
          minDays: parseInt(minDays),
          minAmount: minAmountUsd,
          symbols: symbolList
        },
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('[PersistentOrdersAPI] 查询失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/v1/large-orders-advanced/mega-orders
   * 获取实时最新的单笔金额>30M的大额挂单数据
   * 
   * @query {string} symbols - 交易对（逗号分隔，默认BTCUSDT,ETHUSDT）
   * @query {number} minAmount - 最小金额（默认30M USD）
   * @returns {Object} 超大额挂单数据
   */
  router.get('/mega-orders', async (req, res) => {
    try {
      const database = req.app.get('database');
      const { symbols, minAmount = 30000000 } = req.query;

      const symbolList = symbols ?
        symbols.split(',').map(s => s.trim().toUpperCase()) :
        ['BTCUSDT', 'ETHUSDT'];

      const minAmountUsd = parseInt(minAmount);

      // 查询最近24小时的数据
      const sql = `
        SELECT 
          symbol,
          JSON_EXTRACT(detection_data, '$.trackedEntries') as trackedEntries,
          created_at
        FROM large_order_detection_results 
        WHERE symbol IN (${symbolList.map(() => '?').join(',')})
          AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        ORDER BY created_at DESC
        LIMIT 100
      `;

      const rows = await database.query(sql, symbolList);

      // 处理数据，找出超大额挂单
      const megaOrders = new Map();
      const now = Date.now();

      for (const row of rows) {
        try {
          const trackedEntries = JSON.parse(row.trackedEntries || '[]');

          for (const entry of trackedEntries) {
            if (entry.valueUSD >= minAmountUsd) {
              const key = `${entry.side}@${entry.price}`;
              const age = now - entry.createdAt;

              // 只保留最近的数据（1小时内）
              if (age <= 60 * 60 * 1000) {
                if (!megaOrders.has(key) || entry.lastSeenAt > megaOrders.get(key).lastSeenAt) {
                  megaOrders.set(key, {
                    symbol: row.symbol,
                    side: entry.side,
                    price: entry.price,
                    qty: entry.qty,
                    valueUSD: entry.valueUSD,
                    createdAt: entry.createdAt,
                    lastSeenAt: entry.lastSeenAt,
                    age: age,
                    ageMinutes: Math.floor(age / (60 * 1000)),
                    isActive: age <= 5 * 60 * 1000, // 5分钟内为活跃
                    appearances: 1
                  });
                } else {
                  const existing = megaOrders.get(key);
                  existing.appearances++;
                  existing.lastSeenAt = Math.max(existing.lastSeenAt, entry.lastSeenAt);
                }
              }
            }
          }
        } catch (error) {
          logger.warn('[MegaOrders] 解析数据失败:', {
            symbol: row.symbol,
            error: error.message
          });
        }
      }

      // 按交易对分组并计算买卖比例
      const result = {};
      for (const symbol of symbolList) {
        const symbolOrders = Array.from(megaOrders.values())
          .filter(order => order.symbol === symbol);

        const buyOrders = symbolOrders.filter(order => order.side === 'bid');
        const sellOrders = symbolOrders.filter(order => order.side === 'ask');
        const activeOrders = symbolOrders.filter(order => order.isActive);

        const totalValue = symbolOrders.reduce((sum, order) => sum + order.valueUSD, 0);
        const buyValue = buyOrders.reduce((sum, order) => sum + order.valueUSD, 0);
        const sellValue = sellOrders.reduce((sum, order) => sum + order.valueUSD, 0);

        result[symbol] = {
          totalOrders: symbolOrders.length,
          activeOrders: activeOrders.length,
          buyOrders: buyOrders.length,
          sellOrders: sellOrders.length,
          buyRatio: symbolOrders.length > 0 ? (buyOrders.length / symbolOrders.length * 100).toFixed(1) : 0,
          sellRatio: symbolOrders.length > 0 ? (sellOrders.length / symbolOrders.length * 100).toFixed(1) : 0,
          totalValue: totalValue,
          buyValue: buyValue,
          sellValue: sellValue,
          buyValueRatio: totalValue > 0 ? (buyValue / totalValue * 100).toFixed(1) : 0,
          sellValueRatio: totalValue > 0 ? (sellValue / totalValue * 100).toFixed(1) : 0,
          orders: symbolOrders.sort((a, b) => b.valueUSD - a.valueUSD)
        };
      }

      res.json({
        success: true,
        data: result,
        criteria: {
          minAmount: minAmountUsd,
          symbols: symbolList,
          timeWindow: '24小时'
        },
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('[MegaOrdersAPI] 查询失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}

module.exports = initRoutes;
