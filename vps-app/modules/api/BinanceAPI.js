// modules/api/BinanceAPI.js
// Binance API 接口模块

const { SmartAPIRateLimiter } = require('./RateLimiter');
const RealTimeDataMonitor = require('../monitoring/RealTimeDataMonitor');

class BinanceAPI {
  static BASE_URL = 'https://fapi.binance.com';
  static rateLimiter = new SmartAPIRateLimiter();
  static realTimeMonitor = new RealTimeDataMonitor();
  
  // 启动RateLimiter的清理机制（仅在非测试环境）
  static {
    if (process.env.NODE_ENV !== 'test') {
      this.rateLimiter.startCleanup();
    }
  }

  // 停止RateLimiter的清理机制
  static stopCleanup() {
    this.rateLimiter.stopCleanup();
  }

  static async getKlines(symbol, interval, limit = 500) {
    const endpoint = '/fapi/v1/klines';
    const params = new URLSearchParams({
      symbol: symbol.toUpperCase(),
      interval,
      limit: limit.toString()
    });

    return await this.rateLimiter.cachedCall(
      `klines_${symbol}_${interval}_${limit}`,
      () => this.callBinanceAPI(symbol, `${endpoint}?${params}`),
      'klines',
      symbol
    );
  }

  static async getFundingRate(symbol) {
    const endpoint = '/fapi/v1/fundingRate';
    const params = new URLSearchParams({
      symbol: symbol.toUpperCase(),
      limit: '1'
    });

    return await this.rateLimiter.cachedCall(
      `funding_${symbol}`,
      () => this.callBinanceAPI(symbol, `${endpoint}?${params}`),
      'fundingRate',
      symbol
    );
  }

  static async getOpenInterest(symbol) {
    const endpoint = '/fapi/v1/openInterest';
    const params = new URLSearchParams({
      symbol: symbol.toUpperCase()
    });

    return await this.rateLimiter.cachedCall(
      `openInterest_${symbol}`,
      () => this.callBinanceAPI(symbol, `${endpoint}?${params}`),
      'openInterest',
      symbol
    );
  }

  static async getTicker(symbol) {
    const endpoint = '/fapi/v1/ticker/price';
    const params = new URLSearchParams({
      symbol: symbol.toUpperCase()
    });

    return await this.rateLimiter.cachedCall(
      `ticker_${symbol}`,
      () => this.callBinanceAPI(symbol, `${endpoint}?${params}`),
      'ticker',
      symbol
    );
  }

  static async get24hrTicker(symbol) {
    const endpoint = '/fapi/v1/ticker/24hr';
    const params = new URLSearchParams({
      symbol: symbol.toUpperCase()
    });

    return await this.rateLimiter.cachedCall(
      `ticker_${symbol}`,
      () => this.callBinanceAPI(symbol, `${endpoint}?${params}`),
      'ticker',
      symbol
    );
  }

  static async getOpenInterestHist(symbol, period = '1h', limit = 24) {
    const endpoint = '/futures/data/openInterestHist';
    const params = new URLSearchParams({
      symbol: symbol.toUpperCase(),
      period,
      limit: limit.toString()
    });

    return await this.rateLimiter.cachedCall(
      `openInterestHist_${symbol}_${period}_${limit}`,
      () => this.callBinanceAPI(symbol, `${endpoint}?${params}`),
      'openInterestHist',
      symbol
    );
  }

  static async callBinanceAPI(symbol, endpoint) {
    const { default: fetch } = await import('node-fetch');
    const url = `${this.BASE_URL}${endpoint}`;
    const dataType = this.getDataTypeFromEndpoint(endpoint);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Binance API 错误: ${response.status} ${response.statusText}`;
        
        // 检查是否是地理位置限制错误
        if (response.status === 403 && errorText.includes('restricted location')) {
          errorMessage = `交易对 ${symbol} 在当前位置无法访问 (地理位置限制)`;
        } else if (response.status === 400 && errorText.includes('Invalid symbol')) {
          errorMessage = `交易对 ${symbol} 不存在或已下架`;
        }
        
        // 记录失败的API调用
        this.realTimeMonitor.recordAPICall(symbol, dataType, false, errorMessage);
        throw new Error(errorMessage);
      }

      const result = await response.json();
      // 记录成功的API调用
      this.realTimeMonitor.recordAPICall(symbol, dataType, true);
      return result;
    } catch (error) {
      // 如果是网络错误或其他异常
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        const networkError = `网络连接失败，无法访问Binance API (${symbol})`;
        this.realTimeMonitor.recordAPICall(symbol, dataType, false, networkError);
        throw new Error(networkError);
      }
      // 记录失败的API调用
      this.realTimeMonitor.recordAPICall(symbol, dataType, false, error.message);
      throw error;
    }
  }

  /**
   * 从endpoint获取数据类型
   * @param {string} endpoint - API端点
   * @returns {string} 数据类型
   */
  static getDataTypeFromEndpoint(endpoint) {
    if (endpoint.includes('/klines')) {
      return 'K线数据';
    } else if (endpoint.includes('/ticker')) {
      return '行情数据';
    } else if (endpoint.includes('/fundingRate')) {
      return '资金费率';
    } else if (endpoint.includes('/openInterestHist')) {
      return '持仓量历史';
    } else if (endpoint.includes('/exchangeInfo')) {
      return '交易对信息';
    } else {
      return '其他数据';
    }
  }

  /**
   * 获取实时数据采集率统计
   * @returns {Object} 实时统计信息
   */
  static getRealTimeStats() {
    return {
      global: this.realTimeMonitor.getGlobalStats(),
      symbols: this.realTimeMonitor.getAllSymbolStats(),
      failureAnalysis: this.realTimeMonitor.getFailureAnalysis()
    };
  }

  /**
   * 重置实时监控数据
   */
  static resetRealTimeStats() {
    this.realTimeMonitor.reset();
  }
}

module.exports = BinanceAPI;
