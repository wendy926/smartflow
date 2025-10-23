/**
 * 回测数据服务
 * 负责从Binance API获取180天历史数据并缓存到数据库
 * 遵循高性能设计原则，支持批量数据获取和缓存管理
 */

const logger = require('../utils/logger');
const BinanceAPI = require('../api/binance-api');

class BacktestDataService {
  constructor(database, binanceAPI) {
    this.database = database;
    this.binanceAPI = binanceAPI || new BinanceAPI();
    this.cache = new Map(); // 内存缓存
    this.cacheExpiry = 30 * 60 * 1000; // 30分钟缓存过期
  }

  /**
   * 获取交易对的180天历史数据
   * @param {string} symbol - 交易对
   * @param {string} timeframe - 时间周期 (1h, 4h, 1d)
   * @param {boolean} forceRefresh - 是否强制刷新
   * @returns {Promise<Array>} K线数据
   */
  async getHistoricalData(symbol, timeframe = '1h', forceRefresh = false) {
    const cacheKey = `${symbol}-${timeframe}`;
    
    try {
      // 检查内存缓存
      if (!forceRefresh && this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheExpiry) {
          logger.debug(`[回测数据服务] 从内存缓存获取${symbol}-${timeframe}数据`);
          return cached.data;
        }
      }

      // 检查数据库缓存
      const dbData = await this.getCachedData(symbol, timeframe);
      if (dbData && dbData.length > 0 && !forceRefresh) {
        logger.info(`[回测数据服务] 从数据库缓存获取${symbol}-${timeframe}数据: ${dbData.length}条`);
        this.cache.set(cacheKey, {
          data: dbData,
          timestamp: Date.now()
        });
        return dbData;
      }

      // 从Binance API获取数据
      logger.info(`[回测数据服务] 从Binance API获取${symbol}-${timeframe}的180天数据`);
      const apiData = await this.fetchFromBinanceAPI(symbol, timeframe);
      
      if (apiData && apiData.length > 0) {
        // 保存到数据库
        await this.saveToDatabase(symbol, timeframe, apiData);
        
        // 更新内存缓存
        this.cache.set(cacheKey, {
          data: apiData,
          timestamp: Date.now()
        });
        
        logger.info(`[回测数据服务] 成功获取并缓存${symbol}-${timeframe}数据: ${apiData.length}条`);
        return apiData;
      }

      return [];

    } catch (error) {
      logger.error(`[回测数据服务] 获取${symbol}-${timeframe}数据失败:`, error);
      throw error;
    }
  }

  /**
   * 批量获取多个交易对的历史数据
   * @param {Array<string>} symbols - 交易对列表
   * @param {string} timeframe - 时间周期
   * @param {boolean} forceRefresh - 是否强制刷新
   * @returns {Promise<Object>} 数据映射
   */
  async getBatchHistoricalData(symbols, timeframe = '1h', forceRefresh = false) {
    const results = {};
    
    try {
      logger.info(`[回测数据服务] 开始批量获取${symbols.length}个交易对的${timeframe}数据`);
      
      // 并行获取所有交易对的数据（限制并发数避免API限制）
      const batchSize = 3; // 每批3个交易对
      const batches = [];
      
      for (let i = 0; i < symbols.length; i += batchSize) {
        const batch = symbols.slice(i, i + batchSize);
        batches.push(batch);
      }
      
      for (const batch of batches) {
        const batchPromises = batch.map(symbol => 
          this.getHistoricalData(symbol, timeframe, forceRefresh)
            .then(data => ({ symbol, data }))
            .catch(error => {
              logger.error(`[回测数据服务] 获取${symbol}数据失败:`, error);
              return { symbol, data: [] };
            })
        );
        
        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(({ symbol, data }) => {
          results[symbol] = data;
        });
        
        // 批次间延迟，避免API限制
        if (batches.indexOf(batch) < batches.length - 1) {
          await this.delay(1000);
        }
      }
      
      const successCount = Object.values(results).filter(data => data.length > 0).length;
      logger.info(`[回测数据服务] 批量获取完成: ${successCount}/${symbols.length}个交易对成功`);
      
      return results;

    } catch (error) {
      logger.error(`[回测数据服务] 批量获取数据失败:`, error);
      throw error;
    }
  }

  /**
   * 从Binance API获取数据
   * @param {string} symbol - 交易对
   * @param {string} timeframe - 时间周期
   * @returns {Promise<Array>} K线数据
   */
  async fetchFromBinanceAPI(symbol, timeframe) {
    try {
      // 计算180天前的时间戳
      const endTime = Date.now();
      const startTime = endTime - (180 * 24 * 60 * 60 * 1000);
      
      // 根据时间周期计算需要的K线数量
      let limit = 1000; // 默认限制
      if (timeframe === '1h') {
        limit = 180 * 24; // 180天 * 24小时
      } else if (timeframe === '4h') {
        limit = 180 * 6; // 180天 * 6个4小时
      } else if (timeframe === '1d') {
        limit = 180; // 180天
      }
      
      // 分批获取数据（Binance API限制每次最多1000条）
      const allKlines = [];
      let currentStartTime = startTime;
      
      while (currentStartTime < endTime) {
        const batchLimit = Math.min(1000, limit - allKlines.length);
        if (batchLimit <= 0) break;
        
        const klines = await this.binanceAPI.getKlines(symbol, timeframe, batchLimit, currentStartTime);
        
        if (!klines || klines.length === 0) break;
        
        allKlines.push(...klines);
        
        // 更新下次请求的起始时间
        const lastKlineTime = klines[klines.length - 1][0];
        currentStartTime = lastKlineTime + 1;
        
        // 避免API限制
        await this.delay(100);
      }
      
      // 去重并排序
      const uniqueKlines = this.deduplicateKlines(allKlines);
      return uniqueKlines.sort((a, b) => a[0] - b[0]);

    } catch (error) {
      logger.error(`[回测数据服务] 从Binance API获取${symbol}-${timeframe}数据失败:`, error);
      throw error;
    }
  }

  /**
   * 从数据库获取缓存数据
   * @param {string} symbol - 交易对
   * @param {string} timeframe - 时间周期
   * @returns {Promise<Array>} K线数据
   */
  async getCachedData(symbol, timeframe) {
    try {
      const query = `
        SELECT open_time, close_time, open_price, high_price, low_price, close_price, 
               volume, quote_volume, trades_count, taker_buy_volume, taker_buy_quote_volume
        FROM backtest_market_data 
        WHERE symbol = ? AND timeframe = ?
        ORDER BY open_time ASC
      `;
      
      const rows = await this.database.query(query, [symbol, timeframe]);
      
      return rows.map(row => [
        row.open_time.getTime(), // 0: 开盘时间
        row.open_price,          // 1: 开盘价
        row.high_price,          // 2: 最高价
        row.low_price,           // 3: 最低价
        row.close_price,         // 4: 收盘价
        row.volume,              // 5: 成交量
        row.close_time.getTime(), // 6: 收盘时间
        row.quote_volume,        // 7: 成交额
        row.trades_count,        // 8: 成交笔数
        row.taker_buy_volume,    // 9: 主动买入成交量
        row.taker_buy_quote_volume // 10: 主动买入成交额
      ]);

    } catch (error) {
      logger.error(`[回测数据服务] 获取缓存数据失败:`, error);
      return [];
    }
  }

  /**
   * 保存数据到数据库
   * @param {string} symbol - 交易对
   * @param {string} timeframe - 时间周期
   * @param {Array} klines - K线数据
   */
  async saveToDatabase(symbol, timeframe, klines) {
    if (!klines || klines.length === 0) return;

    try {
      const values = klines.map(kline => [
        symbol,
        timeframe,
        new Date(kline[0]), // open_time
        new Date(kline[6]), // close_time
        kline[1], // open_price
        kline[2], // high_price
        kline[3], // low_price
        kline[4], // close_price
        kline[5], // volume
        kline[7], // quote_volume
        kline[8] || 0, // trades_count
        kline[9] || 0, // taker_buy_volume
        kline[10] || 0 // taker_buy_quote_volume
      ]);

      const query = `
        INSERT INTO backtest_market_data 
        (symbol, timeframe, open_time, close_time, open_price, high_price, low_price, close_price, 
         volume, quote_volume, trades_count, taker_buy_volume, taker_buy_quote_volume)
        VALUES ?
        ON DUPLICATE KEY UPDATE
        open_price = VALUES(open_price),
        high_price = VALUES(high_price),
        low_price = VALUES(low_price),
        close_price = VALUES(close_price),
        volume = VALUES(volume),
        quote_volume = VALUES(quote_volume),
        trades_count = VALUES(trades_count),
        taker_buy_volume = VALUES(taker_buy_volume),
        taker_buy_quote_volume = VALUES(taker_buy_quote_volume)
      `;

      await this.database.query(query, [values]);
      logger.info(`[回测数据服务] 保存${symbol}-${timeframe}数据到数据库: ${klines.length}条`);

    } catch (error) {
      logger.error(`[回测数据服务] 保存数据到数据库失败:`, error);
      throw error;
    }
  }

  /**
   * 去重K线数据
   * @param {Array} klines - K线数据
   * @returns {Array} 去重后的K线数据
   */
  deduplicateKlines(klines) {
    const seen = new Set();
    return klines.filter(kline => {
      const key = `${kline[0]}-${kline[6]}`; // 开盘时间-收盘时间
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * 清理过期缓存
   * @param {number} maxAge - 最大缓存时间（毫秒）
   */
  cleanExpiredCache(maxAge = this.cacheExpiry) {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > maxAge) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 缓存统计
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      memoryUsage: process.memoryUsage().heapUsed
    };
  }

  /**
   * 清空所有缓存
   */
  clearCache() {
    this.cache.clear();
    logger.info('[回测数据服务] 已清空所有缓存');
  }

  /**
   * 延迟函数
   * @param {number} ms - 延迟毫秒数
   * @returns {Promise} Promise对象
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 检查数据完整性
   * @param {string} symbol - 交易对
   * @param {string} timeframe - 时间周期
   * @returns {Promise<Object>} 数据完整性报告
   */
  async checkDataIntegrity(symbol, timeframe) {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_count,
          MIN(open_time) as earliest_time,
          MAX(open_time) as latest_time,
          COUNT(DISTINCT DATE(open_time)) as unique_days
        FROM backtest_market_data 
        WHERE symbol = ? AND timeframe = ?
      `;
      
      const result = await this.database.query(query, [symbol, timeframe]);
      const stats = result[0];
      
      const expectedDays = 180;
      const actualDays = stats.unique_days;
      const completeness = actualDays / expectedDays;
      
      return {
        symbol,
        timeframe,
        totalRecords: stats.total_count,
        earliestTime: stats.earliest_time,
        latestTime: stats.latest_time,
        uniqueDays: actualDays,
        expectedDays,
        completeness: Math.round(completeness * 100) / 100,
        isComplete: completeness >= 0.95 // 95%以上认为完整
      };

    } catch (error) {
      logger.error(`[回测数据服务] 检查数据完整性失败:`, error);
      throw error;
    }
  }

  /**
   * 批量检查数据完整性
   * @param {Array<string>} symbols - 交易对列表
   * @param {string} timeframe - 时间周期
   * @returns {Promise<Array>} 完整性报告列表
   */
  async batchCheckDataIntegrity(symbols, timeframe = '1h') {
    const reports = [];
    
    for (const symbol of symbols) {
      try {
        const report = await this.checkDataIntegrity(symbol, timeframe);
        reports.push(report);
      } catch (error) {
        logger.error(`[回测数据服务] 检查${symbol}数据完整性失败:`, error);
        reports.push({
          symbol,
          timeframe,
          error: error.message,
          isComplete: false
        });
      }
    }
    
    return reports;
  }
}

module.exports = BacktestDataService;
