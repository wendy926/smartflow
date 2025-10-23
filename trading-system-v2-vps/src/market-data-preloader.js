/**
 * 市场数据预加载服务
 * 负责预存储Binance交易所最近180天的历史数据
 * 遵循高性能设计原则，支持批量数据获取和存储
 */

const logger = require('../utils/logger');
const BinanceAPI = require('../api/binance-api');

class MarketDataPreloader {
  constructor(database, binanceAPI) {
    this.database = database;
    this.binanceAPI = binanceAPI || new BinanceAPI();
    this.isPreloading = false;
    this.preloadProgress = new Map();
  }

  /**
   * 预加载所有交易对的历史数据
   * @param {Array<string>} symbols - 交易对列表
   * @param {Array<string>} timeframes - 时间周期列表
   * @returns {Promise<Object>} 预加载结果
   */
  async preloadAllData(symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT'],
    timeframes = ['1h', '4h', '1d']) {
    if (this.isPreloading) {
      logger.warn('[数据预加载] 预加载任务正在进行中，跳过重复请求');
      return { success: false, message: '预加载任务正在进行中' };
    }

    this.isPreloading = true;
    const startTime = Date.now();
    const results = {
      success: true,
      totalSymbols: symbols.length,
      totalTimeframes: timeframes.length,
      totalTasks: symbols.length * timeframes.length,
      completedTasks: 0,
      failedTasks: 0,
      details: {}
    };

    try {
      logger.info(`[数据预加载] 开始预加载${symbols.length}个交易对的${timeframes.length}个时间周期数据`);

      // 并行预加载所有数据
      const allTasks = [];
      for (const symbol of symbols) {
        for (const timeframe of timeframes) {
          allTasks.push(this.preloadSymbolData(symbol, timeframe));
        }
      }

      // 分批执行避免API限制
      const batchSize = 5;
      for (let i = 0; i < allTasks.length; i += batchSize) {
        const batch = allTasks.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(batch);

        batchResults.forEach((result, index) => {
          const taskIndex = i + index;
          const symbol = symbols[Math.floor(taskIndex / timeframes.length)];
          const timeframe = timeframes[taskIndex % timeframes.length];

          if (result.status === 'fulfilled') {
            results.completedTasks++;
            results.details[`${symbol}-${timeframe}`] = result.value;
          } else {
            results.failedTasks++;
            results.details[`${symbol}-${timeframe}`] = {
              success: false,
              error: result.reason.message
            };
            logger.error(`[数据预加载] ${symbol}-${timeframe} 预加载失败:`, result.reason);
          }
        });

        // 批次间延迟避免API限制
        if (i + batchSize < allTasks.length) {
          await this.delay(1000);
        }
      }

      const duration = Date.now() - startTime;
      logger.info(`[数据预加载] 预加载完成 - 耗时: ${duration}ms, 成功: ${results.completedTasks}, 失败: ${results.failedTasks}`);

      return results;

    } catch (error) {
      logger.error('[数据预加载] 预加载过程发生错误:', error);
      results.success = false;
      results.error = error.message;
      return results;
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * 预加载指定时间范围的数据
   * @param {string} symbol - 交易对
   * @param {string} timeframe - 时间周期
   * @param {number} startTime - 开始时间（毫秒时间戳）
   * @param {number} endTime - 结束时间（毫秒时间戳）
   * @returns {Promise<Object>} 预加载结果
   */
  async preloadDataByRange(symbol, timeframe, startTime, endTime) {
    const startTimeMs = Date.now();

    try {
      logger.info(`[数据预加载] 开始获取${symbol}-${timeframe}的指定时间范围数据`);
      const apiData = await this.fetchDataByRange(symbol, timeframe, startTime, endTime);

      if (!apiData || apiData.length === 0) {
        throw new Error('API返回数据为空');
      }

      // 批量保存到数据库
      const savedCount = await this.batchSaveData(symbol, timeframe, apiData);

      const duration = Date.now() - startTimeMs;
      logger.info(`[数据预加载] ${symbol}-${timeframe} 预加载完成 - 数据量: ${savedCount}, 耗时: ${duration}ms`);

      return {
        success: true,
        dataCount: savedCount,
        duration: duration,
        message: '预加载成功'
      };

    } catch (error) {
      logger.error(`[数据预加载] ${symbol}-${timeframe} 预加载失败:`, error);
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTimeMs
      };
    }
  }

  /**
   * 预加载单个交易对的数据
   * @param {string} symbol - 交易对
   * @param {string} timeframe - 时间周期
   * @returns {Promise<Object>} 预加载结果
   */
  async preloadSymbolData(symbol, timeframe) {
    const startTime = Date.now();
    const cacheKey = `${symbol}-${timeframe}`;

    try {
      // 检查数据是否已存在且完整
      const existingData = await this.checkExistingData(symbol, timeframe);
      if (existingData.isComplete) {
        logger.info(`[数据预加载] ${symbol}-${timeframe} 数据已完整，跳过预加载`);
        return {
          success: true,
          message: '数据已存在且完整',
          dataCount: existingData.count,
          duration: Date.now() - startTime
        };
      }

      // 从Binance API获取180天数据
      logger.info(`[数据预加载] 开始获取${symbol}-${timeframe}的180天数据`);
      const apiData = await this.fetch180DaysData(symbol, timeframe);

      if (!apiData || apiData.length === 0) {
        throw new Error('API返回数据为空');
      }

      // 清理旧数据
      await this.cleanOldData(symbol, timeframe);

      // 批量保存到数据库
      const savedCount = await this.batchSaveData(symbol, timeframe, apiData);

      const duration = Date.now() - startTime;
      logger.info(`[数据预加载] ${symbol}-${timeframe} 预加载完成 - 数据量: ${savedCount}, 耗时: ${duration}ms`);

      return {
        success: true,
        dataCount: savedCount,
        duration: duration,
        message: '预加载成功'
      };

    } catch (error) {
      logger.error(`[数据预加载] ${symbol}-${timeframe} 预加载失败:`, error);
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * 获取指定时间范围的数据
   * @param {string} symbol - 交易对
   * @param {string} timeframe - 时间周期
   * @param {number} startTime - 开始时间（毫秒时间戳）
   * @param {number} endTime - 结束时间（毫秒时间戳）
   * @returns {Promise<Array>} K线数据
   */
  async fetchDataByRange(symbol, timeframe, startTime, endTime) {
    const allKlines = [];
    let currentStartTime = startTime;
    let batchCount = 0;
    const maxBatches = 50; // 最多50批次

    const startDate = new Date(startTime).toISOString().split('T')[0];
    const endDate = new Date(endTime).toISOString().split('T')[0];
    logger.info(`[数据预加载] 开始获取${symbol}-${timeframe}的${startDate}至${endDate}数据`);

    while (currentStartTime < endTime && batchCount < maxBatches) {
      const klines = await this.binanceAPI.getKlines(symbol, timeframe, 1000, currentStartTime, endTime);

      if (!klines || klines.length === 0) {
        logger.warn(`[数据预加载] ${symbol}-${timeframe} 第${batchCount + 1}批次无数据`);
        break;
      }

      allKlines.push(...klines);
      batchCount++;

      logger.info(`[数据预加载] ${symbol}-${timeframe} 第${batchCount}批次: ${klines.length}条, 累计: ${allKlines.length}条`);

      // 更新下次请求的起始时间
      const lastKlineTime = klines[klines.length - 1][0];
      const intervalMs = this.getIntervalMs(timeframe);
      currentStartTime = lastKlineTime + intervalMs;

      // 避免API限制
      await this.delay(100);
    }

    logger.info(`[数据预加载] ${symbol}-${timeframe} 获取完成: 总计${allKlines.length}条, ${batchCount}批次`);
    return allKlines;
  }

  /**
   * 从Binance API获取180天数据
   * @param {string} symbol - 交易对
   * @param {string} timeframe - 时间周期
   * @returns {Promise<Array>} K线数据
   */
  async fetch180DaysData(symbol, timeframe) {
    const endTime = Date.now();
    const startTime = endTime - (180 * 24 * 60 * 60 * 1000);

    // 根据时间周期计算需要的K线数量
    const expectedCount = this.getExpectedCount(timeframe);
    
    const allKlines = [];
    let currentStartTime = startTime;
    let batchCount = 0;
    const maxBatches = 20; // 最多20批次，确保覆盖180天

    logger.info(`[数据预加载] 开始获取${symbol}-${timeframe}的180天数据 (预期${expectedCount}条)`);

    while (currentStartTime < endTime && batchCount < maxBatches) {
      const klines = await this.binanceAPI.getKlines(symbol, timeframe, 1000, currentStartTime);

      if (!klines || klines.length === 0) {
        logger.warn(`[数据预加载] ${symbol}-${timeframe} 第${batchCount + 1}批次无数据`);
        break;
      }

      allKlines.push(...klines);
      batchCount++;

      logger.info(`[数据预加载] ${symbol}-${timeframe} 第${batchCount}批次: ${klines.length}条, 累计: ${allKlines.length}条`);

      // 更新下次请求的起始时间
      const lastKlineTime = klines[klines.length - 1][0];
      const intervalMs = this.getIntervalMs(timeframe);
      currentStartTime = lastKlineTime + intervalMs;

      // 避免API限制
      await this.delay(100);
    }

    logger.info(`[数据预加载] ${symbol}-${timeframe} 获取完成: 总计${allKlines.length}条, ${batchCount}批次, 预期${expectedCount}条`);

    return allKlines;
  }

  /**
   * 获取时间周期对应的毫秒数
   * @param {string} timeframe - 时间周期
   * @returns {number} 毫秒数
   */
  getIntervalMs(timeframe) {
    const intervals = {
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };
    return intervals[timeframe] || 60 * 60 * 1000;
  }

  /**
   * 获取预期数据量
   * @param {string} timeframe - 时间周期
   * @returns {number} 预期数据量
   */
  getExpectedCount(timeframe) {
    const expectedCounts = {
      '1h': 180 * 24, // 180天 * 24小时 = 4320条
      '4h': 180 * 6,  // 180天 * 6个4小时 = 1080条
      '1d': 180       // 180天 = 180条
    };
    return expectedCounts[timeframe] || 4320;
  }

  /**
   * 检查现有数据的完整性
   * @param {string} symbol - 交易对
   * @param {string} timeframe - 时间周期
   * @returns {Promise<Object>} 数据状态
   */
  async checkExistingData(symbol, timeframe) {
    try {
      const query = `
        SELECT 
          COUNT(*) as count,
          MIN(open_time) as earliest_time,
          MAX(open_time) as latest_time,
          COUNT(DISTINCT DATE(open_time)) as unique_days
        FROM backtest_market_data 
        WHERE symbol = ? AND timeframe = ?
      `;

      const [rows] = await this.database.pool.query(query, [symbol, timeframe]);
      const stats = rows[0];

      const expectedDays = 180;
      const actualDays = stats.unique_days || 0;
      const completeness = actualDays / expectedDays;

      return {
        count: stats.count,
        earliestTime: stats.earliest_time,
        latestTime: stats.latest_time,
        uniqueDays: actualDays,
        completeness: Math.round(completeness * 100) / 100,
        isComplete: completeness >= 0.95 // 95%以上认为完整
      };

    } catch (error) {
      logger.error(`[数据预加载] 检查${symbol}-${timeframe}数据失败:`, error);
      return { count: 0, isComplete: false };
    }
  }

  /**
   * 清理旧数据
   * @param {string} symbol - 交易对
   * @param {string} timeframe - 时间周期
   */
  async cleanOldData(symbol, timeframe) {
    try {
      const query = `DELETE FROM backtest_market_data WHERE symbol = ? AND timeframe = ?`;
      await this.database.pool.query(query, [symbol, timeframe]);
      logger.info(`[数据预加载] 已清理${symbol}-${timeframe}的旧数据`);
    } catch (error) {
      logger.error(`[数据预加载] 清理${symbol}-${timeframe}旧数据失败:`, error);
    }
  }

  /**
   * 批量保存数据到数据库
   * @param {string} symbol - 交易对
   * @param {string} timeframe - 时间周期
   * @param {Array} klines - K线数据
   * @returns {Promise<number>} 保存的数据条数
   */
  async batchSaveData(symbol, timeframe, klines) {
    if (!klines || klines.length === 0) return 0;

    try {
      const batchSize = 1000;
      let savedCount = 0;

      for (let i = 0; i < klines.length; i += batchSize) {
        const batch = klines.slice(i, i + batchSize);
        const values = batch.map(kline => [
          symbol,
          timeframe,
          new Date(kline[0]), // open_time
          new Date(kline[6]), // close_time
          parseFloat(kline[1]), // open_price
          parseFloat(kline[2]), // high_price
          parseFloat(kline[3]), // low_price
          parseFloat(kline[4]), // close_price
          parseFloat(kline[5]), // volume
          parseFloat(kline[7]), // quote_volume
          parseInt(kline[8]), // trade_count
          parseFloat(kline[9]), // taker_buy_volume
          parseFloat(kline[10]) // taker_buy_quote_volume
        ]);

        const query = `
          INSERT INTO backtest_market_data (
            symbol, timeframe, open_time, close_time, open_price, high_price, 
            low_price, close_price, volume, quote_volume, trades_count, 
            taker_buy_volume, taker_buy_quote_volume
          ) VALUES ?
        `;

        await this.database.pool.query(query, [values]);
        savedCount += batch.length;
      }

      logger.info(`[数据预加载] ${symbol}-${timeframe} 批量保存完成: ${savedCount}条数据`);
      return savedCount;

    } catch (error) {
      logger.error(`[数据预加载] 批量保存${symbol}-${timeframe}数据失败:`, error);
      throw error;
    }
  }

  /**
   * 获取预加载状态
   * @returns {Object} 预加载状态
   */
  getPreloadStatus() {
    return {
      isPreloading: this.isPreloading,
      progress: Object.fromEntries(this.preloadProgress)
    };
  }

  /**
   * 延迟函数
   * @param {number} ms - 延迟毫秒数
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = MarketDataPreloader;
