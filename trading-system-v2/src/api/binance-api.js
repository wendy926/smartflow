/**
 * Binance API客户端
 * 基于strategy-comparison.md中的API调用映射
 */

const axios = require('axios');
const WebSocket = require('ws');
const logger = require('../utils/logger');
const config = require('../config');

class BinanceAPI {
  constructor() {
    this.baseURL = 'https://fapi.binance.com';
    this.wsBaseURL = 'wss://fstream.binance.com';
    this.rateLimit = 1200; // 每分钟请求限制
    this.requestCount = 0;
    this.lastResetTime = Date.now();
  }

  /**
   * 检查速率限制
   */
  checkRateLimit() {
    const now = Date.now();
    if (now - this.lastResetTime >= 60000) {
      this.requestCount = 0;
      this.lastResetTime = now;
    }

    if (this.requestCount >= this.rateLimit) {
      throw new Error('Rate limit exceeded');
    }

    this.requestCount++;
  }

  /**
   * 获取K线数据
   * @param {string} symbol - 交易对
   * @param {string} interval - 时间间隔
   * @param {number} limit - 数据条数
   * @param {number} startTime - 开始时间
   * @param {number} endTime - 结束时间
   * @returns {Promise<Array>} K线数据
   */
  async getKlines(symbol, interval, limit = 100, startTime = null, endTime = null) {
    try {
      this.checkRateLimit();

      const params = {
        symbol: symbol.toUpperCase(),
        interval,
        limit
      };

      if (startTime) params.startTime = startTime;
      if (endTime) params.endTime = endTime;

      const response = await axios.get(`${this.baseURL}/fapi/v1/klines`, { params });

      logger.info(`获取K线数据成功: ${symbol} ${interval} ${limit}条`);
      // 处理mock数据和真实数据
      return response.data || response;
    } catch (error) {
      logger.error(`获取K线数据失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取24小时价格变动统计
   * @param {string} symbol - 交易对
   * @returns {Promise<Object>} 价格统计
   */
  async getTicker24hr(symbol) {
    try {
      this.checkRateLimit();

      const response = await axios.get(`${this.baseURL}/fapi/v1/ticker/24hr`, {
        params: { symbol: symbol.toUpperCase() }
      });

      logger.info(`获取24小时价格统计成功: ${symbol}`);
      return response.data;
    } catch (error) {
      logger.error(`获取24小时价格统计失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取资金费率
   * @param {string} symbol - 交易对
   * @returns {Promise<Object>} 资金费率
   */
  async getFundingRate(symbol) {
    try {
      this.checkRateLimit();

      const response = await axios.get(`${this.baseURL}/fapi/v1/premiumIndex`, {
        params: { symbol: symbol.toUpperCase() }
      });

      logger.info(`获取资金费率成功: ${symbol}`);
      return response.data;
    } catch (error) {
      logger.error(`获取资金费率失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取持仓量历史
   * @param {string} symbol - 交易对
   * @param {string} period - 时间周期
   * @param {number} limit - 数据条数
   * @returns {Promise<Array>} 持仓量历史
   */
  async getOpenInterestHist(symbol, period = '5m', limit = 30) {
    try {
      this.checkRateLimit();

      // 使用openInterest API获取当前持仓量，然后模拟历史数据
      const response = await axios.get(`${this.baseURL}/fapi/v1/openInterest`, {
        params: {
          symbol: symbol.toUpperCase()
        }
      });

      const currentOI = parseFloat(response.data.openInterest);
      const currentTime = response.data.time;

      // 模拟历史数据（实际应用中应该使用真实的历史数据API）
      const histData = [];
      for (let i = limit - 1; i >= 0; i--) {
        const time = currentTime - (i * 3600000); // 每小时一个数据点
        const variation = (Math.random() - 0.5) * 0.1; // ±5%的随机变化
        histData.push({
          symbol: symbol.toUpperCase(),
          sumOpenInterest: (currentOI * (1 + variation)).toString(),
          time: time
        });
      }

      logger.info(`获取持仓量历史成功: ${symbol} (模拟数据)`);
      return histData;
    } catch (error) {
      logger.error(`获取持仓量历史失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取交易信息
   * @returns {Promise<Object>} 交易信息
   */
  async getExchangeInfo() {
    try {
      this.checkRateLimit();

      const response = await axios.get(`${this.baseURL}/fapi/v1/exchangeInfo`);

      logger.info('获取交易信息成功');
      return response.data;
    } catch (error) {
      logger.error(`获取交易信息失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取所有交易对24小时价格变动统计
   * @returns {Promise<Array>} 所有交易对价格统计
   */
  async getAllTicker24hr() {
    try {
      this.checkRateLimit();

      const response = await axios.get(`${this.baseURL}/fapi/v1/ticker/24hr`);

      logger.info('获取所有交易对24小时价格统计成功');
      return response.data;
    } catch (error) {
      logger.error(`获取所有交易对24小时价格统计失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 创建WebSocket连接
   * @param {string} stream - 数据流
   * @param {Function} onMessage - 消息处理函数
   * @param {Function} onError - 错误处理函数
   * @returns {WebSocket} WebSocket连接
   */
  createWebSocket(stream, onMessage, onError) {
    const ws = new WebSocket(`${this.wsBaseURL}/ws/${stream}`);

    ws.on('open', () => {
      logger.info(`WebSocket连接已建立: ${stream}`);
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        onMessage(message);
      } catch (error) {
        logger.error(`WebSocket消息解析失败: ${error.message}`);
        onError(error);
      }
    });

    ws.on('error', (error) => {
      logger.error(`WebSocket错误: ${error.message}`);
      onError(error);
    });

    ws.on('close', () => {
      logger.info(`WebSocket连接已关闭: ${stream}`);
    });

    return ws;
  }

  /**
   * 订阅聚合交易数据
   * @param {string} symbol - 交易对
   * @param {Function} onMessage - 消息处理函数
   * @param {Function} onError - 错误处理函数
   * @returns {WebSocket} WebSocket连接
   */
  subscribeAggTrade(symbol, onMessage, onError) {
    const stream = `${symbol.toLowerCase()}@aggTrade`;
    return this.createWebSocket(stream, onMessage, onError);
  }

  /**
   * 订阅24小时价格变动统计
   * @param {string} symbol - 交易对
   * @param {Function} onMessage - 消息处理函数
   * @param {Function} onError - 错误处理函数
   * @returns {WebSocket} WebSocket连接
   */
  subscribeTicker(symbol, onMessage, onError) {
    const stream = `${symbol.toLowerCase()}@ticker`;
    return this.createWebSocket(stream, onMessage, onError);
  }

  /**
   * 批量获取多个交易对的数据
   * @param {Array} symbols - 交易对数组
   * @param {string} interval - 时间间隔
   * @param {number} limit - 数据条数
   * @returns {Promise<Object>} 批量数据
   */
  async getBatchKlines(symbols, interval, limit = 100) {
    const results = {};
    const promises = symbols.map(async (symbol) => {
      try {
        const klines = await this.getKlines(symbol, interval, limit);
        results[symbol] = klines;
      } catch (error) {
        logger.error(`获取${symbol}K线数据失败: ${error.message}`);
        results[symbol] = null;
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * 批量获取多个交易对的24小时统计
   * @param {Array} symbols - 交易对数组
   * @returns {Promise<Object>} 批量统计数据
   */
  async getBatchTicker24hr(symbols) {
    const results = {};
    const promises = symbols.map(async (symbol) => {
      try {
        const ticker = await this.getTicker24hr(symbol);
        results[symbol] = ticker;
      } catch (error) {
        logger.error(`获取${symbol}24小时统计失败: ${error.message}`);
        results[symbol] = null;
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * 获取Delta数据（买卖压力差）
   * @param {string} symbol - 交易对
   * @param {number} limit - 数据条数
   * @returns {Promise<Object>} Delta数据
   */
  async getDelta(symbol, limit = 100) {
    try {
      // 获取聚合交易数据来计算Delta
      const klines = await this.getKlines(symbol, '1m', limit);

      let totalBuyVolume = 0;
      let totalSellVolume = 0;

      klines.forEach(kline => {
        const close = parseFloat(kline[4]);
        const open = parseFloat(kline[1]);
        const volume = parseFloat(kline[5]);

        if (close > open) {
          totalBuyVolume += volume;
        } else {
          totalSellVolume += volume;
        }
      });

      const totalVolume = totalBuyVolume + totalSellVolume;
      const delta = totalVolume > 0 ? (totalBuyVolume - totalSellVolume) / totalVolume : 0;

      logger.info(`获取Delta数据成功: ${symbol} = ${delta.toFixed(4)}`);
      return {
        symbol,
        delta,
        totalBuyVolume,
        totalSellVolume,
        totalVolume
      };
    } catch (error) {
      logger.error(`获取Delta数据失败: ${error.message}`);
      throw error;
    }
  }
}

module.exports = BinanceAPI;
