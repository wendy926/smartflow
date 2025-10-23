const logger = require('../utils/logger');

class DataManager {
  constructor(databaseAdapter, logger) {
    this.databaseAdapter = databaseAdapter;
    this.logger = logger;
  }

  async getMarketData(timeframe, startDate, endDate) {
    try {
      return await this.databaseAdapter.getMarketData(timeframe, startDate, endDate);
    } catch (error) {
      this.logger.error('[数据管理器] 获取市场数据失败', error);
      throw error;
    }
  }
}

module.exports = DataManager;
