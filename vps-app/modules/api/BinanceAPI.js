// modules/api/BinanceAPI.js
// Binance API 接口模块

const { SmartAPIRateLimiter } = require('./RateLimiter');

class BinanceAPI {
  static BASE_URL = 'https://fapi.binance.com';
  static rateLimiter = new SmartAPIRateLimiter();
  
  // 启动RateLimiter的清理机制
  static {
    this.rateLimiter.startCleanup();
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
        
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      // 如果是网络错误或其他异常
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(`网络连接失败，无法访问Binance API (${symbol})`);
      }
      throw error;
    }
  }
}

module.exports = BinanceAPI;
