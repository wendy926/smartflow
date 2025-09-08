// modules/api/RateLimiter.js
// API 限流管理模块

const { DataCache } = require('../utils/DataCache');

class SmartAPIRateLimiter {
  constructor() {
    this.rateLimits = {
      klines: { weight: 1, limit: 1200, window: 60000 }, // 1分钟1200次
      ticker: { weight: 1, limit: 1200, window: 60000 },
      fundingRate: { weight: 1, limit: 1200, window: 60000 },
      openInterest: { weight: 1, limit: 1200, window: 60000 },
      openInterestHist: { weight: 1, limit: 1200, window: 60000 }
    };

    this.usage = new Map();
    this.symbolPriorities = new Map();
    this.cache = new DataCache();
    this.queue = [];
    this.processing = false;
  }

  setSymbolPriority(symbol, priority = 1) {
    this.symbolPriorities.set(symbol, priority);
  }

  getSymbolPriority(symbol) {
    return this.symbolPriorities.get(symbol) || 1;
  }

  getRequestWeight(endpoint) {
    for (const [key, limit] of Object.entries(this.rateLimits)) {
      if (endpoint.includes(key)) {
        return limit.weight;
      }
    }
    return 1;
  }

  checkRateLimit() {
    const now = Date.now();
    const totalUsage = Array.from(this.usage.values()).reduce((sum, usage) => sum + usage, 0);

    // 检查是否超过总限制
    const totalLimit = Object.values(this.rateLimits).reduce((sum, limit) => sum + limit.limit, 0);
    if (totalUsage >= totalLimit) {
      return false;
    }

    // 检查各端点限制
    for (const [endpoint, usage] of this.usage.entries()) {
      const limit = this.rateLimits[endpoint];
      if (limit && usage >= limit.limit) {
        return false;
      }
    }

    return true;
  }

  async waitForSlot(endpoint, symbol) {
    return new Promise((resolve) => {
      const priority = this.getSymbolPriority(symbol);
      this.queue.push({ endpoint, symbol, priority, resolve });
      this.queue.sort((a, b) => b.priority - a.priority);

      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  async queueSymbolData(symbol, dataTypes) {
    const promises = dataTypes.map(dataType => {
      const endpoint = this.getEndpointForDataType(dataType);
      return this.fetchDataForType(symbol, dataType);
    });

    return Promise.all(promises);
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      if (!this.checkRateLimit()) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      const { endpoint, symbol, resolve } = this.queue.shift();

      try {
        const weight = this.getRequestWeight(endpoint);
        this.recordUsage(endpoint, weight);
        resolve();
      } catch (error) {
        console.error(`处理队列项时出错: ${error.message}`);
        resolve();
      }
    }

    this.processing = false;
  }

  recordUsage(endpoint, weight) {
    const now = Date.now();
    const currentUsage = this.usage.get(endpoint) || 0;
    this.usage.set(endpoint, currentUsage + weight);

    // 清理过期记录
    setTimeout(() => {
      const current = this.usage.get(endpoint) || 0;
      this.usage.set(endpoint, Math.max(0, current - weight));
    }, 60000); // 1分钟后减少使用量
  }

  getEndpointForDataType(dataType) {
    const mapping = {
      'klines': 'klines',
      'ticker': 'ticker',
      'funding': 'fundingRate',
      'openInterest': 'openInterest',
      'openInterestHist': 'openInterestHist'
    };
    return mapping[dataType] || 'klines';
  }

  async fetchDataForType(symbol, dataType) {
    const { BinanceAPI } = require('./BinanceAPI');

    switch (dataType) {
      case 'klines':
        return await BinanceAPI.getKlines(symbol, '1h', 200);
      case 'ticker':
        return await BinanceAPI.get24hrTicker(symbol);
      case 'funding':
        return await BinanceAPI.getFundingRate(symbol);
      case 'openInterest':
        return await BinanceAPI.getOpenInterest(symbol);
      case 'openInterestHist':
        return await BinanceAPI.getOpenInterestHist(symbol, '1h', 6);
      default:
        throw new Error(`未知的数据类型: ${dataType}`);
    }
  }

  async callBinanceAPI(symbol, endpoint) {
    const { default: fetch } = await import('node-fetch');
    const url = `${this.BASE_URL}${endpoint}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Binance API 错误: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async cachedCall(cacheKey, apiCall, endpoint = 'klines', symbol = 'UNKNOWN') {
    // 检查缓存
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // 等待API槽位
    await this.waitForSlot(endpoint, symbol);

    try {
      const result = await apiCall();
      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error(`API调用失败 ${symbol} ${endpoint}:`, error.message);
      throw error;
    }
  }

  cleanExpiredCache() {
    this.cache.clear();
  }

  // 定期清理过期的使用记录
  startCleanup() {
    setInterval(() => {
      this.cleanupExpiredUsage();
    }, 5 * 60 * 1000); // 每5分钟清理一次
  }

  cleanupExpiredUsage() {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1分钟窗口

    for (const [endpoint, usage] of this.usage.entries()) {
      if (now - usage.timestamp > windowMs) {
        this.usage.delete(endpoint);
      }
    }

    // 清理过期的优先级记录
    for (const [symbol, priority] of this.symbolPriorities.entries()) {
      if (now - priority.timestamp > 10 * 60 * 1000) { // 10分钟过期
        this.symbolPriorities.delete(symbol);
      }
    }

    console.log(`🧹 API限流器清理完成 - 使用记录: ${this.usage.size}, 优先级: ${this.symbolPriorities.size}`);
  }
}

module.exports = { SmartAPIRateLimiter };
