/**
 * Binance API 单例管理器
 * 确保整个应用使用同一个API实例，共享统计数据
 */

const BinanceAPI = require('./binance-api');

let binanceAPIInstance = null;

/**
 * 获取Binance API单例
 * @returns {BinanceAPI} Binance API实例
 */
function getBinanceAPI() {
  if (!binanceAPIInstance) {
    binanceAPIInstance = new BinanceAPI();
  }
  return binanceAPIInstance;
}

/**
 * 重置单例（仅用于测试）
 */
function resetBinanceAPI() {
  binanceAPIInstance = null;
}

module.exports = {
  getBinanceAPI,
  resetBinanceAPI
};

