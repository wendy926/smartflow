const logger = require('../utils/logger');

class ResultProcessor {
  constructor(logger) {
    this.logger = logger;
  }

  processResults(trades, marketData) {
    try {
      this.logger.info('[结果处理器] 处理回测结果', { tradesCount: trades.length });
      return trades;
    } catch (error) {
      this.logger.error('[结果处理器] 处理结果失败', error);
      throw error;
    }
  }
}

module.exports = ResultProcessor;
