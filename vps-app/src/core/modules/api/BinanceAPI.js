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

    const result = await this.rateLimiter.cachedCall(
      `ticker24h_${symbol}`,
      () => this.callBinanceAPI(symbol, `${endpoint}?${params}`),
      'ticker24h',
      symbol
    );
    
    // 统一字段名称，将price字段映射为lastPrice以保持兼容性
    if (result && result.price && !result.lastPrice) {
      result.lastPrice = result.price;
    }
    
    return result;
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
    return await this.callBinanceAPIWithRetry(symbol, endpoint, 2);
  }

  /**
   * 带重试机制的Binance API调用
   * @param {string} symbol - 交易对
   * @param {string} endpoint - API端点
   * @param {number} maxRetries - 最大重试次数
   * @returns {Promise} API响应结果
   */
  static async callBinanceAPIWithRetry(symbol, endpoint, maxRetries = 2) {
    const { default: fetch } = await import('node-fetch');
    const url = `${this.BASE_URL}${endpoint}`;
    const dataType = this.getDataTypeFromEndpoint(endpoint);
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 [${symbol}] API调用尝试 ${attempt}/${maxRetries}: ${dataType}`);
        
        const response = await fetch(url, {
          timeout: 10000, // 10秒超时
          headers: {
            'User-Agent': 'SmartFlow-Trading-System/1.0'
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = `Binance API 错误: ${response.status} ${response.statusText}`;
          
          // 检查是否是地理位置限制错误
          if (response.status === 403 && errorText.includes('restricted location')) {
            errorMessage = `交易对 ${symbol} 在当前位置无法访问 (地理位置限制)`;
          } else if (response.status === 400 && errorText.includes('Invalid symbol')) {
            errorMessage = `交易对 ${symbol} 不存在或已下架`;
          } else if (response.status === 429) {
            errorMessage = `API调用频率过高，需要等待 (${symbol})`;
          }
          
          // 对于某些错误，不进行重试
          if (response.status === 403 || response.status === 400) {
            this.realTimeMonitor.recordAPICall(symbol, dataType, false, errorMessage);
            throw new Error(errorMessage);
          }
          
          // 对于可重试的错误，记录并继续重试
          lastError = new Error(errorMessage);
          this.realTimeMonitor.recordAPICall(symbol, dataType, false, errorMessage);
          
          if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 1000; // 指数退避：2秒、4秒
            console.log(`⏳ [${symbol}] 等待 ${delay}ms 后重试...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          
          throw lastError;
        }

        const result = await response.json();
        // 记录成功的API调用
        this.realTimeMonitor.recordAPICall(symbol, dataType, true);
        console.log(`✅ [${symbol}] API调用成功: ${dataType}`);
        return result;

      } catch (error) {
        lastError = error;
        
        // 如果是网络错误或其他异常
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
          const networkError = `网络连接失败，无法访问Binance API (${symbol})`;
          this.realTimeMonitor.recordAPICall(symbol, dataType, false, networkError);
          lastError = new Error(networkError);
        } else {
          // 记录失败的API调用
          this.realTimeMonitor.recordAPICall(symbol, dataType, false, error.message);
        }

        // 如果是最后一次尝试，直接抛出错误
        if (attempt >= maxRetries) {
          console.error(`❌ [${symbol}] API调用最终失败 (${attempt}/${maxRetries}):`, lastError.message);
          throw lastError;
        }

        // 等待后重试
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`⏳ [${symbol}] 等待 ${delay}ms 后重试... (${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
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

  /**
   * 获取API错误详情，用于前端展示
   * @returns {Object} 错误详情统计
   */
  static getAPIErrorDetails() {
    const stats = this.realTimeMonitor.getGlobalStats();
    const symbolStats = this.realTimeMonitor.getAllSymbolStats();
    const failureAnalysis = this.realTimeMonitor.getFailureAnalysis();

    // 找出有错误的交易对
    const errorSymbols = symbolStats.filter(symbol => symbol.failedCalls > 0);
    
    // 按错误类型分组
    const errorsByType = {};
    errorSymbols.forEach(symbol => {
      symbol.errors.forEach(error => {
        const errorType = this.realTimeMonitor.categorizeError(error.error);
        if (!errorsByType[errorType]) {
          errorsByType[errorType] = [];
        }
        errorsByType[errorType].push({
          symbol: symbol.symbol,
          dataType: error.dataType,
          error: error.error,
          timestamp: error.timestamp
        });
      });
    });

    return {
      globalStats: stats,
      errorSymbols: errorSymbols.map(s => ({
        symbol: s.symbol,
        totalCalls: s.totalCalls,
        failedCalls: s.failedCalls,
        successRate: s.successRate,
        lastError: s.errors[s.errors.length - 1]?.error || null
      })),
      errorsByType,
      failureAnalysis,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = BinanceAPI;
