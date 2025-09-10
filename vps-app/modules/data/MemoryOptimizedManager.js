// modules/data/MemoryOptimizedManager.js
// 内存优化数据管理器 - 只保留15分钟内的聚合数据在内存中

const { DataCache } = require('../utils/DataCache');

class MemoryOptimizedManager {
  constructor(database) {
    this.db = database;
    
    // 内存中只保留15分钟内的聚合数据
    this.memoryRetentionMs = 15 * 60 * 1000; // 15分钟
    
    // 内存缓存 - 只存储聚合后的指标
    this.aggregatedMetrics = new Map(); // 聚合指标缓存
    this.globalStats = new Map(); // 全局统计
    this.activeSimulations = new Map(); // 活跃模拟交易（只保留必要字段）
    
    // 缓存配置
    this.cache = new DataCache();
    this.cacheConfig = {
      aggregatedMetrics: 5 * 60 * 1000,    // 5分钟
      globalStats: 2 * 60 * 1000,          // 2分钟
      activeSimulations: 1 * 60 * 1000,    // 1分钟
    };

    // 启动定期清理
    this.startMemoryCleanup();
  }

  /**
   * 存储原始K线数据到数据库
   */
  async storeKlineData(symbol, interval, klineData) {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO kline_data 
        (symbol, interval, open_time, close_time, open_price, high_price, low_price, close_price, 
         volume, quote_volume, trades_count, taker_buy_volume, taker_buy_quote_volume)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const kline of klineData) {
        await new Promise((resolve, reject) => {
          stmt.run([
            symbol, interval, kline.openTime, kline.closeTime,
            kline.open, kline.high, kline.low, kline.close,
            kline.volume, kline.quoteVolume, kline.tradesCount,
            kline.takerBuyVolume, kline.takerBuyQuoteVolume
          ], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      stmt.finalize();
    } catch (error) {
      console.error(`存储K线数据失败 [${symbol}]:`, error);
    }
  }

  /**
   * 存储技术指标到数据库
   */
  async storeTechnicalIndicators(symbol, interval, indicators) {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO technical_indicators 
        (symbol, interval, timestamp, atr, atr14, vwap, vwap_direction, delta, delta_direction, 
         oi, oi_direction, volume_direction, trend_4h, trend_1h, score_1h, market_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      await new Promise((resolve, reject) => {
        stmt.run([
          symbol, interval, indicators.timestamp,
          indicators.atr, indicators.atr14, indicators.vwap, indicators.vwapDirection,
          indicators.delta, indicators.deltaDirection, indicators.oi, indicators.oiDirection,
          indicators.volumeDirection, indicators.trend4h, indicators.trend1h,
          indicators.score1h, indicators.marketType
        ], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      stmt.finalize();
    } catch (error) {
      console.error(`存储技术指标失败 [${symbol}]:`, error);
    }
  }

  /**
   * 更新聚合指标到内存（15分钟数据）
   */
  updateAggregatedMetrics(symbol, metrics) {
    const now = Date.now();
    const key = `${symbol}_${metrics.timeWindow}`;
    
    // 只保留15分钟内的数据
    this.aggregatedMetrics.set(key, {
      ...metrics,
      timestamp: now,
      symbol,
      timeWindow: metrics.timeWindow
    });

    // 清理过期数据
    this.cleanExpiredData();
  }

  /**
   * 获取聚合指标（优先从内存，否则从数据库）
   */
  async getAggregatedMetrics(symbol, timeWindow = '15m') {
    const key = `${symbol}_${timeWindow}`;
    const cached = this.aggregatedMetrics.get(key);
    
    if (cached && (Date.now() - cached.timestamp) < this.memoryRetentionMs) {
      return cached;
    }

    // 从数据库获取
    try {
      const result = await new Promise((resolve, reject) => {
        this.db.get(`
          SELECT * FROM aggregated_metrics 
          WHERE symbol = ? AND time_window = ? 
          ORDER BY timestamp DESC LIMIT 1
        `, [symbol, timeWindow], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (result) {
        // 更新内存缓存
        this.aggregatedMetrics.set(key, {
          ...result,
          timestamp: new Date(result.timestamp).getTime()
        });
      }

      return result;
    } catch (error) {
      console.error(`获取聚合指标失败 [${symbol}]:`, error);
      return null;
    }
  }

  /**
   * 更新全局统计
   */
  updateGlobalStats(stats) {
    this.globalStats.set('current', {
      ...stats,
      timestamp: Date.now()
    });
  }

  /**
   * 获取全局统计
   */
  getGlobalStats() {
    const stats = this.globalStats.get('current');
    if (stats && (Date.now() - stats.timestamp) < this.cacheConfig.globalStats) {
      return stats;
    }
    return null;
  }

  /**
   * 更新活跃模拟交易（只保留必要字段）
   */
  updateActiveSimulations(simulations) {
    const now = Date.now();
    const activeSims = new Map();
    
    for (const sim of simulations) {
      if (sim.status === 'ACTIVE') {
        // 只保留必要字段，减少内存占用
        activeSims.set(sim.id, {
          id: sim.id,
          symbol: sim.symbol,
          direction: sim.direction,
          entry_price: sim.entry_price,
          stop_loss_price: sim.stop_loss_price,
          take_profit_price: sim.take_profit_price,
          trigger_reason: sim.trigger_reason,
          created_at: sim.created_at,
          timestamp: now
        });
      }
    }
    
    this.activeSimulations = activeSims;
  }

  /**
   * 获取活跃模拟交易
   */
  getActiveSimulations() {
    return Array.from(this.activeSimulations.values());
  }

  /**
   * 清理过期数据
   */
  cleanExpiredData() {
    const now = Date.now();
    
    // 清理聚合指标
    for (const [key, data] of this.aggregatedMetrics.entries()) {
      if (now - data.timestamp > this.memoryRetentionMs) {
        this.aggregatedMetrics.delete(key);
      }
    }
    
    // 清理全局统计
    for (const [key, data] of this.globalStats.entries()) {
      if (now - data.timestamp > this.cacheConfig.globalStats) {
        this.globalStats.delete(key);
      }
    }
    
    // 清理活跃模拟交易
    for (const [key, data] of this.activeSimulations.entries()) {
      if (now - data.timestamp > this.cacheConfig.activeSimulations) {
        this.activeSimulations.delete(key);
      }
    }
  }

  /**
   * 启动定期内存清理
   */
  startMemoryCleanup() {
    // 每5分钟清理一次过期数据
    setInterval(() => {
      this.cleanExpiredData();
      console.log(`🧹 内存清理完成 - 聚合指标: ${this.aggregatedMetrics.size}, 全局统计: ${this.globalStats.size}, 活跃交易: ${this.activeSimulations.size}`);
    }, 5 * 60 * 1000);
  }

  /**
   * 获取内存使用统计
   */
  getMemoryStats() {
    return {
      aggregatedMetrics: this.aggregatedMetrics.size,
      globalStats: this.globalStats.size,
      activeSimulations: this.activeSimulations.size,
      cacheSize: this.cache.size(),
      memoryRetentionMs: this.memoryRetentionMs
    };
  }

  /**
   * 强制清理所有内存数据
   */
  clearAllMemory() {
    this.aggregatedMetrics.clear();
    this.globalStats.clear();
    this.activeSimulations.clear();
    this.cache.clear();
    console.log('🧹 强制清理所有内存数据完成');
  }
}

module.exports = { MemoryOptimizedManager };
