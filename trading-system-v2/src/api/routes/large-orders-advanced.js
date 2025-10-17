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
      // 查询更长时间范围的数据，以便分析挂单的完整生命周期
      const queryDays = Math.max(minDays * 2, 7); // 查询至少7天或minDays*2的数据
      const sql = `
        SELECT 
          symbol,
          CAST(JSON_EXTRACT(detection_data, '$.trackedEntries') AS CHAR) as trackedEntries,
          created_at
        FROM large_order_detection_results 
        WHERE symbol IN (${symbolList.map(() => '?').join(',')})
          AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
          AND JSON_VALID(JSON_EXTRACT(detection_data, '$.trackedEntries'))
          AND JSON_LENGTH(JSON_EXTRACT(detection_data, '$.trackedEntries')) > 0
        ORDER BY created_at ASC
      `;

      logger.info(`[PersistentOrders] 准备查询，参数: ${JSON.stringify([...symbolList, queryDays])}`);
      const rows = await database.query(sql, [...symbolList, queryDays]);
      logger.info(`[PersistentOrders] 查询到${rows.length}条记录`);
      if (rows.length > 0) {
        logger.info(`[PersistentOrders] 第一条记录示例:`, {
          symbol: rows[0].symbol,
          trackedEntries: typeof rows[0].trackedEntries,
          trackedEntriesValue: rows[0].trackedEntries
        });
      }

      // 处理数据，找出真正持续超过指定天数的挂单
      const orderLifecycle = new Map(); // key -> { firstSeen, lastSeen, maxValue, ... }
      const now = Date.now();

      // 第一遍：收集所有挂单的生命周期信息
      let totalEntries = 0;
      let validEntries = 0;
      for (const row of rows) {
        try {
          const trackedEntries = JSON.parse(row.trackedEntries || '[]');
          const recordTime = new Date(row.created_at).getTime();
          totalEntries += trackedEntries.length;

          for (const entry of trackedEntries) {
            if (entry.valueUSD >= minAmountUsd) {
              validEntries++;
              // 改进的订单识别：使用价格范围（±0.5%）来匹配订单
              const priceTolerance = entry.price * 0.005; // 0.5%的价格容差
              const priceKey = `${row.symbol}@${entry.side}@${Math.round(entry.price / priceTolerance)}`;
              
              // 查找是否存在相似的订单（价格差异在0.5%以内）
              let matchedKey = null;
              for (const [key, order] of orderLifecycle.entries()) {
                if (order.symbol === row.symbol && 
                    order.side === entry.side && 
                    Math.abs(order.price - entry.price) / order.price <= 0.005) {
                  matchedKey = key;
                  break;
                }
              }

              if (!matchedKey) {
                // 首次发现这个挂单
                orderLifecycle.set(priceKey, {
                  symbol: row.symbol,
                  side: entry.side,
                  price: entry.price,
                  firstSeen: recordTime,
                  lastSeen: recordTime,
                  maxValueUSD: entry.valueUSD,
                  currentValueUSD: entry.valueUSD,
                  appearances: 1,
                  records: [{ time: recordTime, value: entry.valueUSD }]
                });
              } else {
                // 更新挂单信息
                const order = orderLifecycle.get(matchedKey);
                order.lastSeen = Math.max(order.lastSeen, recordTime);
                order.maxValueUSD = Math.max(order.maxValueUSD, entry.valueUSD);
                order.currentValueUSD = entry.valueUSD; // 使用最新记录的价值
                order.appearances++;
                order.records.push({ time: recordTime, value: entry.valueUSD });
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

      logger.info(`[PersistentOrders] 总共${totalEntries}个订单，其中${validEntries}个超过${minAmountUsd}USD`);

      // 第二遍：筛选真正持续的挂单
      const persistentOrders = new Map();
      const cutoffTime = now - minDaysMs; // 最小持续时间的截止点

      logger.info(`[PersistentOrders] 分析${orderLifecycle.size}个订单的生命周期`);

      for (const [key, order] of orderLifecycle.entries()) {
        // 检查是否满足持续条件
        const duration = order.lastSeen - order.firstSeen;
        const durationDays = Math.floor(duration / (24 * 60 * 60 * 1000));
        const isStillActive = (now - order.lastSeen) <= (2 * 60 * 60 * 1000); // 2小时内还有记录

        logger.info(`[PersistentOrders] 检查订单: ${order.symbol} ${order.side} ${order.price}, 持续时间: ${durationDays}天, 仍然活跃: ${isStillActive}, 最小天数: ${minDays}`);

        // 条件1：持续时间 >= minDays
        // 条件2：最近2小时内还有记录（说明可能还在活跃）
        // 条件3：或者持续时间 >= minDays * 1.5（即使不再活跃，但确实持续了很久）
        if (duration >= minDaysMs && (isStillActive || duration >= minDaysMs * 1.5)) {
          logger.info(`[PersistentOrders] 找到持续订单: ${order.symbol} ${order.side} ${order.price}, 持续时间: ${durationDays}天`);
          persistentOrders.set(key, {
            symbol: order.symbol,
            side: order.side,
            price: order.price,
            qty: 0, // 数量信息在历史记录中可能不准确
            valueUSD: order.maxValueUSD, // 使用最大价值
            createdAt: order.firstSeen,
            lastSeenAt: order.lastSeen,
            duration: duration,
            durationDays: Math.floor(duration / (24 * 60 * 60 * 1000)),
            appearances: order.appearances,
            isActive: isStillActive,
            recordsCount: order.records.length
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
          CAST(JSON_EXTRACT(detection_data, '$.trackedEntries') AS CHAR) as trackedEntries,
          created_at
        FROM large_order_detection_results 
        WHERE symbol IN (${symbolList.map(() => '?').join(',')})
          AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
          AND JSON_VALID(JSON_EXTRACT(detection_data, '$.trackedEntries'))
          AND JSON_LENGTH(JSON_EXTRACT(detection_data, '$.trackedEntries')) > 0
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
              const recordTime = new Date(row.created_at).getTime();
              const age = now - recordTime;

              // 只保留最近的数据（1小时内）
              if (age <= 60 * 60 * 1000) {
                if (!megaOrders.has(key) || recordTime > megaOrders.get(key).lastSeenAt) {
                  megaOrders.set(key, {
                    symbol: row.symbol,
                    side: entry.side,
                    price: entry.price,
                    qty: entry.qty,
                    valueUSD: entry.valueUSD,
                    createdAt: recordTime,
                    lastSeenAt: recordTime,
                    age: age,
                    ageMinutes: Math.floor(age / (60 * 1000)),
                    isActive: age <= 5 * 60 * 1000, // 5分钟内为活跃
                    appearances: 1
                  });
                } else {
                  const existing = megaOrders.get(key);
                  existing.appearances++;
                  existing.lastSeenAt = Math.max(existing.lastSeenAt, recordTime);
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
