/**
 * 适配器工厂类
 * 负责创建不同市场的适配器实例
 */

const logger = require('../utils/logger');
const BinanceAdapter = require('./BinanceAdapter');
const ChinaStockAdapter = require('./ChinaStockAdapter');
const USStockAdapter = require('./USStockAdapter');

// 市场类型枚举
const MarketType = {
  CRYPTO: 'crypto',
  CN_STOCK: 'cn_stock',
  US_STOCK: 'us_stock'
};

class AdapterFactory {
  /**
   * 创建市场适配器
   * @param {string} marketType - 市场类型
   * @param {Object} config - 配置对象
   * @returns {IExchangeAdapter} 适配器实例
   */
  static create(marketType, config) {
    logger.info(`[AdapterFactory] 创建 ${marketType} 适配器`);

    switch (marketType) {
      case MarketType.CRYPTO:
        return new BinanceAdapter(config);
      case MarketType.CN_STOCK:
        return new ChinaStockAdapter(config);
      case MarketType.US_STOCK:
        return new USStockAdapter(config);
      default:
        throw new Error(`Unsupported market type: ${marketType}`);
    }
  }

  /**
   * 获取支持的市场类型
   * @returns {Array} 支持的市场类型列表
   */
  static getSupportedMarkets() {
    return Object.values(MarketType);
  }
}

module.exports = {
  AdapterFactory,
  MarketType
};
