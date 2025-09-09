// modules/api/BinanceContractChecker.js
// Binance合约可用性检查模块

const BinanceAPI = require('./BinanceAPI');

class BinanceContractChecker {
  constructor() {
    this.contractCache = new Map();
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24小时缓存
    this.lastUpdate = 0;
  }

  /**
   * 获取所有可用的Binance期货合约
   */
  async getAllAvailableContracts() {
    try {
      // 检查缓存是否有效
      const now = Date.now();
      if (this.contractCache.size > 0 && (now - this.lastUpdate) < this.cacheExpiry) {
        console.log('📋 使用缓存的Binance合约列表');
        return Array.from(this.contractCache.keys());
      }

      console.log('🔄 从Binance API获取最新合约列表...');
      
      // 调用Binance exchangeInfo API
      const { default: fetch } = await import('node-fetch');
      const response = await fetch('https://fapi.binance.com/fapi/v1/exchangeInfo');
      
      if (!response.ok) {
        throw new Error(`Binance exchangeInfo API错误: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // 过滤出可用的USDT合约
      const availableContracts = data.symbols
        .filter(symbol => 
          symbol.status === 'TRADING' && 
          symbol.symbol.endsWith('USDT') &&
          symbol.permissions.includes('SPOT') === false // 排除现货合约
        )
        .map(symbol => symbol.symbol);

      // 更新缓存
      this.contractCache.clear();
      availableContracts.forEach(contract => {
        this.contractCache.set(contract, true);
      });
      this.lastUpdate = now;

      console.log(`✅ 获取到 ${availableContracts.length} 个可用的Binance期货合约`);
      return availableContracts;

    } catch (error) {
      console.error('❌ 获取Binance合约列表失败:', error);
      
      // 如果API调用失败，返回空数组
      return [];
    }
  }

  /**
   * 检查单个交易对是否在Binance期货中可用
   */
  async isContractAvailable(symbol) {
    try {
      const availableContracts = await this.getAllAvailableContracts();
      return availableContracts.includes(symbol.toUpperCase());
    } catch (error) {
      console.error(`检查合约 ${symbol} 可用性失败:`, error);
      return false;
    }
  }

  /**
   * 批量检查多个交易对的可用性
   */
  async checkMultipleContracts(symbols) {
    const results = {};
    const availableContracts = await this.getAllAvailableContracts();
    
    for (const symbol of symbols) {
      results[symbol] = availableContracts.includes(symbol.toUpperCase());
    }
    
    return results;
  }

  /**
   * 过滤出可用的交易对
   */
  async filterAvailableContracts(symbols) {
    const availableContracts = await this.getAllAvailableContracts();
    return symbols.filter(symbol => availableContracts.includes(symbol.toUpperCase()));
  }

  /**
   * 获取合约详细信息
   */
  async getContractInfo(symbol) {
    try {
      const { default: fetch } = await import('node-fetch');
      const response = await fetch('https://fapi.binance.com/fapi/v1/exchangeInfo');
      
      if (!response.ok) {
        throw new Error(`Binance exchangeInfo API错误: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const contract = data.symbols.find(s => s.symbol === symbol.toUpperCase());
      
      if (!contract) {
        return null;
      }

      return {
        symbol: contract.symbol,
        status: contract.status,
        baseAsset: contract.baseAsset,
        quoteAsset: contract.quoteAsset,
        permissions: contract.permissions,
        isSpotTradingAllowed: contract.permissions.includes('SPOT'),
        isMarginTradingAllowed: contract.permissions.includes('MARGIN'),
        filters: contract.filters
      };
    } catch (error) {
      console.error(`获取合约 ${symbol} 信息失败:`, error);
      return null;
    }
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.contractCache.clear();
    this.lastUpdate = 0;
    console.log('🗑️ Binance合约缓存已清除');
  }
}

module.exports = BinanceContractChecker;
