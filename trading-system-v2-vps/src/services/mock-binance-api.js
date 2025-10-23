/**
 * Mock Binance API
 * 用于回测，提供历史K线数据而不是实时数据
 */

const logger = require('../utils/logger');

class MockBinanceAPI {
  constructor(historicalData) {
    // historicalData: { symbol: { '1d': [klines], '4h': [klines], '15m': [klines], '1h': [klines], '5m': [klines] } }
    this.historicalData = historicalData;
    this.currentIndex = 0; // 当前回测进度索引
  }

  /**
   * 设置当前回测进度
   * @param {number} index - 当前K线索引
   */
  setCurrentIndex(index) {
    this.currentIndex = index;
  }

  /**
   * 获取K线数据
   * @param {string} symbol - 交易对
   * @param {string} interval - 时间间隔
   * @param {number} limit - 数量限制
   * @returns {Promise<Array>} K线数据
   */
  async getKlines(symbol, interval, limit) {
    try {
      console.log(`[Mock Binance API] 请求${symbol} ${interval}数据，限制${limit}条，当前索引${this.currentIndex}`);
      logger.info(`[Mock Binance API] 请求${symbol} ${interval}数据，限制${limit}条，当前索引${this.currentIndex}`);
      
      const symbolData = this.historicalData[symbol];
      if (!symbolData) {
        console.warn(`[Mock Binance API] 没有${symbol}的历史数据，可用symbols: ${Object.keys(this.historicalData).join(', ')}`);
        logger.warn(`[Mock Binance API] 没有${symbol}的历史数据，可用symbols: ${Object.keys(this.historicalData).join(', ')}`);
        return [];
      }

      // 验证数据格式
      const validateKlineData = (data, intervalName) => {
        if (!Array.isArray(data)) {
          logger.error(`[Mock Binance API] ${symbol} ${intervalName}数据不是数组`);
          return false;
        }
        if (data.length === 0) {
          logger.warn(`[Mock Binance API] ${symbol} ${intervalName}数据为空`);
          return false;
        }
        // 检查K线数据格式
        const firstKline = data[0];
        if (!Array.isArray(firstKline) || firstKline.length < 11) {
          logger.error(`[Mock Binance API] ${symbol} ${intervalName}数据格式错误，期望11个字段，实际${firstKline ? firstKline.length : 0}个`);
          return false;
        }
        return true;
      };

      // 根据时间间隔获取数据
      let data = [];
      let baseInterval = null; // 基础时间框架

      if (interval === '1d') {
        // 使用1h数据模拟1d数据（每24根1h数据取1根）
        const hourlyData = symbolData['1h'] || [];
        if (!validateKlineData(hourlyData, '1h')) {
          return [];
        }
        // 根据当前索引计算1d数据的索引
        const dayIndex = Math.floor(this.currentIndex / 24);
        const startDayIndex = Math.max(0, dayIndex - limit + 1);
        const endDayIndex = dayIndex + 1;

        // 从原始1h数据中提取对应的1d数据
        data = [];
        for (let i = startDayIndex; i < endDayIndex; i++) {
          const hourIndex = i * 24;
          if (hourIndex < hourlyData.length) {
            data.push(hourlyData[hourIndex]);
          }
        }
        baseInterval = '1h';
        logger.debug(`[Mock Binance API] ${symbol} ${interval}: 从1h数据提取，1h索引${startDayIndex * 24}-${endDayIndex * 24}，1d数据${data.length}条`);
      } else if (interval === '4h') {
        // 使用1h数据模拟4h数据（每4根1h数据取1根）
        const hourlyData = symbolData['1h'] || [];
        if (!validateKlineData(hourlyData, '1h')) {
          return [];
        }
        // 根据当前索引计算4h数据的索引
        const fourHourIndex = Math.floor(this.currentIndex / 4);
        const startFourHourIndex = Math.max(0, fourHourIndex - limit + 1);
        const endFourHourIndex = fourHourIndex + 1;

        // 从原始1h数据中提取对应的4h数据
        data = [];
        for (let i = startFourHourIndex; i < endFourHourIndex; i++) {
          const hourIndex = i * 4;
          if (hourIndex < hourlyData.length) {
            data.push(hourlyData[hourIndex]);
          }
        }
        baseInterval = '1h';
        logger.debug(`[Mock Binance API] ${symbol} ${interval}: 从1h数据提取，1h索引${startFourHourIndex * 4}-${endFourHourIndex * 4}，4h数据${data.length}条`);
      } else if (interval === '1h') {
        data = symbolData['1h'] || [];
        if (!validateKlineData(data, '1h')) {
          return [];
        }
        // 从当前索引往前取limit条
        const startIndex = Math.max(0, this.currentIndex - limit + 1);
        const endIndex = this.currentIndex + 1;
        data = data.slice(startIndex, endIndex);
        baseInterval = '1h';
        logger.debug(`[Mock Binance API] ${symbol} ${interval}: 原始数据${data.length}条 (索引${startIndex}-${endIndex})`);
      } else if (interval === '15m') {
        // 使用5m数据模拟15m数据（每3根5m数据取1根）
        const fiveMinData = symbolData['5m'] || [];
        if (!validateKlineData(fiveMinData, '5m')) {
          return [];
        }
        // 根据当前索引计算15m数据的索引
        const fifteenMinIndex = Math.floor(this.currentIndex / 3);
        const startFifteenMinIndex = Math.max(0, fifteenMinIndex - limit + 1);
        const endFifteenMinIndex = fifteenMinIndex + 1;

        // 从原始5m数据中提取对应的15m数据
        data = [];
        for (let i = startFifteenMinIndex; i < endFifteenMinIndex; i++) {
          const fiveMinIndex = i * 3;
          if (fiveMinIndex < fiveMinData.length) {
            data.push(fiveMinData[fiveMinIndex]);
          }
        }
        baseInterval = '5m';
        logger.debug(`[Mock Binance API] ${symbol} ${interval}: 从5m数据提取，5m索引${startFifteenMinIndex * 3}-${endFifteenMinIndex * 3}，15m数据${data.length}条`);
      } else if (interval === '5m') {
        data = symbolData['5m'] || [];
        if (!validateKlineData(data, '5m')) {
          return [];
        }
        // 从当前索引往前取limit条
        const startIndex = Math.max(0, this.currentIndex - limit + 1);
        const endIndex = this.currentIndex + 1;
        data = data.slice(startIndex, endIndex);
        baseInterval = '5m';
        logger.debug(`[Mock Binance API] ${symbol} ${interval}: 原始数据${data.length}条 (索引${startIndex}-${endIndex})`);
      }

      // 增加日志输出用于调试
      if (data.length === 0) {
        logger.warn(`[Mock Binance API] ${symbol} ${interval}数据为空 (当前索引=${this.currentIndex})`);
      } else {
        logger.info(`[Mock Binance API] 返回${symbol} ${interval}数据: ${data.length}条 (当前索引=${this.currentIndex})`);
        // 输出第一条数据的详细信息用于调试
        if (data.length > 0) {
          const firstKline = data[0];
          logger.debug(`[Mock Binance API] ${symbol} ${interval}第一条数据: [${firstKline[0]}, ${firstKline[1]}, ${firstKline[2]}, ${firstKline[3]}, ${firstKline[4]}, ${firstKline[5]}]`);
          console.log(`[Mock Binance API] ${symbol} ${interval}第一条数据: [${firstKline[0]}, ${firstKline[1]}, ${firstKline[2]}, ${firstKline[3]}, ${firstKline[4]}, ${firstKline[5]}]`);
        }
      }
      return data;
    } catch (error) {
      logger.error(`[Mock Binance API] 获取K线数据失败:`, error);
      return [];
    }
  }

  /**
   * 获取24小时价格统计
   * @param {string} symbol - 交易对
   * @returns {Promise<Object>} 价格统计
   */
  async getTicker24hr(symbol) {
    try {
      const symbolData = this.historicalData[symbol];
      if (!symbolData || !symbolData['1h'] || symbolData['1h'].length === 0) {
        return null;
      }

      const klines = symbolData['1h'];
      const currentKline = klines[this.currentIndex];

      if (!currentKline) {
        return null;
      }

      return {
        symbol,
        lastPrice: parseFloat(currentKline[4]), // close price
        priceChange: 0,
        priceChangePercent: 0,
        highPrice: parseFloat(currentKline[2]),
        lowPrice: parseFloat(currentKline[3]),
        volume: parseFloat(currentKline[5])
      };
    } catch (error) {
      logger.error(`[Mock Binance API] 获取24小时价格统计失败:`, error);
      return null;
    }
  }

  /**
   * 获取资金费率
   * @param {string} symbol - 交易对
   * @returns {Promise<number>} 资金费率
   */
  async getFundingRate(symbol) {
    // 返回默认资金费率
    return 0.0001;
  }

  /**
   * 获取持仓量历史
   * @param {string} symbol - 交易对
   * @param {string} period - 周期
   * @param {number} limit - 数量限制
   * @returns {Promise<Array>} 持仓量历史
   */
  async getOpenInterestHist(symbol, period, limit) {
    try {
      // 返回模拟的持仓量历史数据
      const mockData = [];
      const symbolData = this.historicalData[symbol];
      if (!symbolData || !symbolData['1h'] || symbolData['1h'].length === 0) {
        logger.warn(`[Mock Binance API] ${symbol} 没有1h数据用于生成持仓量历史`);
        return [];
      }

      const klines = symbolData['1h'];
      const startIndex = Math.max(0, this.currentIndex - limit + 1);
      const endIndex = this.currentIndex + 1;

      for (let i = startIndex; i < endIndex && i < klines.length; i++) {
        const kline = klines[i];
        mockData.push({
          symbol,
          sumOpenInterest: parseFloat(kline[5]) * 1000, // 基于成交量模拟持仓量
          sumOpenInterestValue: parseFloat(kline[5]) * parseFloat(kline[4]) * 1000,
          timestamp: kline[0]
        });
      }

      logger.info(`[Mock Binance API] 返回${symbol}持仓量历史: ${mockData.length}条`);
      return mockData;
    } catch (error) {
      logger.error(`[Mock Binance API] 获取持仓量历史失败:`, error);
      return [];
    }
  }
}

module.exports = MockBinanceAPI;

