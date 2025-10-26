/**
 * 市场费率管理器
 * 负责从交易所API获取实时费率数据
 */

const logger = require('./logger');

class MarketRateManager {
  constructor(binanceAPI) {
    this.binanceAPI = binanceAPI;
    this.rateCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5分钟缓存过期
  }

  /**
   * 获取资金费率
   * @param {string} symbol - 交易对
   * @returns {Promise<number>} 资金费率
   */
  async getFundingRate(symbol) {
    try {
      const cacheKey = `funding_${symbol}`;
      const cached = this.rateCache.get(cacheKey);

      // 检查缓存是否有效
      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        logger.debug(`[费率管理器] 使用缓存资金费率: ${symbol} = ${cached.rate}`);
        return cached.rate;
      }

      // 从API获取最新费率
      const fundingData = await this.binanceAPI.getFundingRate(symbol);
      const rate = parseFloat(fundingData.lastFundingRate || 0);

      // 更新缓存
      this.rateCache.set(cacheKey, {
        rate: rate,
        timestamp: Date.now()
      });

      logger.info(`[费率管理器] 获取资金费率: ${symbol} = ${(rate * 100).toFixed(4)}%`);
      return rate;

    } catch (error) {
      logger.error(`[费率管理器] 获取资金费率失败: ${symbol}`, error);
      // 返回默认值
      return 0.0001; // 0.01%
    }
  }

  /**
   * 获取手续费率
   * @param {string} symbol - 交易对
   * @returns {Promise<number>} 手续费率
   */
  async getFeeRate(symbol) {
    try {
      const cacheKey = `fee_${symbol}`;
      const cached = this.rateCache.get(cacheKey);

      // 检查缓存是否有效
      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        logger.debug(`[费率管理器] 使用缓存手续费率: ${symbol} = ${cached.rate}`);
        return cached.rate;
      }

      // 从API获取交易规则
      const exchangeInfo = await this.binanceAPI.getExchangeInfo();
      const symbolInfo = exchangeInfo.symbols.find(s => s.symbol === symbol);

      if (symbolInfo && symbolInfo.filters) {
        // 查找手续费过滤器
        const feeFilter = symbolInfo.filters.find(f => f.filterType === 'PERCENT_PRICE');
        if (feeFilter) {
          const rate = parseFloat(feeFilter.multiplierUp || 0.0004); // 默认0.04%

          // 更新缓存
          this.rateCache.set(cacheKey, {
            rate: rate,
            timestamp: Date.now()
          });

          logger.info(`[费率管理器] 获取手续费率: ${symbol} = ${(rate * 100).toFixed(4)}%`);
          return rate;
        }
      }

      // 返回默认手续费率
      const defaultRate = 0.0004; // 0.04%
      this.rateCache.set(cacheKey, {
        rate: defaultRate,
        timestamp: Date.now()
      });

      return defaultRate;

    } catch (error) {
      logger.error(`[费率管理器] 获取手续费率失败: ${symbol}`, error);
      return 0.0004; // 默认0.04%
    }
  }

  /**
   * 获取利率（年化）
   * @param {string} symbol - 交易对
   * @returns {Promise<number>} 利率
   */
  async getInterestRate(symbol) {
    try {
      const cacheKey = `interest_${symbol}`;
      const cached = this.rateCache.get(cacheKey);

      // 检查缓存是否有效
      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        logger.debug(`[费率管理器] 使用缓存利率: ${symbol} = ${cached.rate}`);
        return cached.rate;
      }

      // 从API获取借贷利率
      const borrowRates = await this.binanceAPI.getBorrowRates();
      const asset = symbol.replace('USDT', ''); // 提取基础资产
      const rateInfo = borrowRates.find(r => r.asset === asset);

      if (rateInfo) {
        const rate = parseFloat(rateInfo.borrowRate || 0.01); // 默认1%

        // 更新缓存
        this.rateCache.set(cacheKey, {
          rate: rate,
          timestamp: Date.now()
        });

        logger.info(`[费率管理器] 获取利率: ${symbol} = ${(rate * 100).toFixed(2)}%`);
        return rate;
      }

      // 返回默认利率
      const defaultRate = 0.01; // 1%
      this.rateCache.set(cacheKey, {
        rate: defaultRate,
        timestamp: Date.now()
      });

      return defaultRate;

    } catch (error) {
      logger.error(`[费率管理器] 获取利率失败: ${symbol}`, error);
      return 0.01; // 默认1%
    }
  }

  /**
   * 批量获取所有费率
   * @param {string} symbol - 交易对
   * @returns {Promise<Object>} 费率对象
   */
  async getAllRates(symbol) {
    try {
      const [fundingRate, feeRate, interestRate] = await Promise.all([
        this.getFundingRate(symbol),
        this.getFeeRate(symbol),
        this.getInterestRate(symbol)
      ]);

      return {
        fundingRate,
        feeRate,
        interestRate,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`[费率管理器] 批量获取费率失败: ${symbol}`, error);
      return {
        fundingRate: 0.0001,
        feeRate: 0.0004,
        interestRate: 0.01,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 清空缓存
   */
  clearCache() {
    this.rateCache.clear();
    logger.info('[费率管理器] 缓存已清空');
  }

  /**
   * 获取缓存统计
   * @returns {Object} 缓存统计
   */
  getCacheStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const [key, value] of this.rateCache) {
      if (now - value.timestamp < this.cacheExpiry) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }

    return {
      totalEntries: this.rateCache.size,
      validEntries,
      expiredEntries,
      cacheExpiryMinutes: this.cacheExpiry / (1000 * 60)
    };
  }
}

module.exports = MarketRateManager;
