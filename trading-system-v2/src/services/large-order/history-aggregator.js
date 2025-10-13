/**
 * HistoryAggregator - 历史大额挂单聚合器
 * 
 * 功能：
 * - 聚合7天历史大额挂单数据
 * - 识别新增挂单（<1小时）
 * - 识别活跃挂单（当前存在）
 * - 统计出现频率和持续时间
 * 
 * @module large-order/history-aggregator
 */

const logger = require('../../utils/logger');

class HistoryAggregator {
  /**
   * 聚合历史挂单数据
   * @param {Array} detectionRecords - 数据库检测记录
   * @param {string} symbol - 交易对
   * @returns {Object} 聚合结果
   */
  aggregateOrders(detectionRecords, symbol) {
    const orderMap = new Map();  // key(side@price) -> aggregated data
    const now = Date.now();

    for (const record of detectionRecords) {
      let entries = [];
      
      try {
        const detectionData = JSON.parse(record.detection_data || '{}');
        entries = detectionData.trackedEntries || [];
      } catch (error) {
        logger.warn(`[HistoryAggregator] 解析detection_data失败:`, error.message);
        continue;
      }

      for (const entry of entries) {
        const key = `${entry.side}@${entry.price}`;
        const recordTime = new Date(record.created_at).getTime();

        if (!orderMap.has(key)) {
          // 新挂单
          orderMap.set(key, {
            price: entry.price,
            side: entry.side,
            maxValueUSD: entry.valueUSD || 0,
            firstSeen: recordTime,
            lastSeen: recordTime,
            appearances: 1,
            firstSeenFormatted: record.created_at,
            lastSeenFormatted: record.created_at
          });
        } else {
          // 已存在，更新
          const agg = orderMap.get(key);
          agg.maxValueUSD = Math.max(agg.maxValueUSD, entry.valueUSD || 0);
          agg.lastSeen = Math.max(agg.lastSeen, recordTime);
          agg.lastSeenFormatted = record.created_at;
          agg.appearances++;
        }
      }
    }

    // 转换为数组并添加状态标记
    const result = Array.from(orderMap.values()).map(order => {
      const timeSinceFirst = now - order.firstSeen;
      const timeSinceLast = now - order.lastSeen;

      return {
        ...order,
        isNew: timeSinceFirst < 3600000,        // <1小时为新增
        isActive: timeSinceLast < 900000,       // <15分钟为活跃
        timeSinceFirstHours: (timeSinceFirst / 3600000).toFixed(1),
        timeSinceLastMinutes: (timeSinceLast / 60000).toFixed(0)
      };
    });

    // 按价值排序
    result.sort((a, b) => b.maxValueUSD - a.maxValueUSD);

    // 统计
    const stats = {
      totalOrders: result.length,
      newOrders: result.filter(o => o.isNew).length,
      activeOrders: result.filter(o => o.isActive).length,
      inactiveOrders: result.filter(o => !o.isActive).length
    };

    return {
      symbol,
      stats,
      orders: result
    };
  }

  /**
   * 批量聚合多个交易对
   * @param {Object} database - 数据库实例
   * @param {Array} symbols - 交易对列表
   * @param {number} days - 天数
   * @returns {Object} 聚合结果
   */
  async aggregateMultipleSymbols(database, symbols, days = 7) {
    const result = {};

    for (const symbol of symbols) {
      try {
        const sql = `
          SELECT 
            symbol,
            detection_data,
            created_at,
            tracked_entries_count
          FROM large_order_detection_results
          WHERE symbol = ?
            AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            AND tracked_entries_count > 0
          ORDER BY created_at DESC
        `;

        const rows = await database.query(sql, [symbol, days]);
        result[symbol] = this.aggregateOrders(rows, symbol);

        logger.info(`[HistoryAggregator] ${symbol} 聚合完成`, {
          total: result[symbol].stats.totalOrders,
          new: result[symbol].stats.newOrders,
          active: result[symbol].stats.activeOrders
        });
      } catch (error) {
        logger.error(`[HistoryAggregator] ${symbol} 聚合失败:`, error);
        result[symbol] = { symbol, stats: {}, orders: [] };
      }
    }

    return result;
  }
}

module.exports = HistoryAggregator;

