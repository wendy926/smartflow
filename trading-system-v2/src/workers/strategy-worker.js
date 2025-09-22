/**
 * 策略执行工作进程
 * 负责执行交易策略分析
 */

const V3Strategy = require('../strategies/v3-strategy');
const logger = require('../utils/logger');
const config = require('../config');

class StrategyWorker {
  constructor() {
    this.v3Strategy = new V3Strategy();
    this.isRunning = false;
    this.symbols = config.defaultSymbols || ['BTCUSDT', 'ETHUSDT', 'ONDOUSDT', 'MKRUSDT', 'PENDLEUSDT', 'MPLUSDT', 'LINKUSDT', 'LDOUSDT'];
  }

  async start() {
    if (this.isRunning) {
      logger.warn('策略工作进程已在运行');
      return;
    }

    this.isRunning = true;
    logger.info('策略工作进程启动');

    // 每5分钟执行一次策略分析
    setInterval(async () => {
      try {
        await this.executeStrategies();
      } catch (error) {
        logger.error(`策略执行失败: ${error.message}`);
      }
    }, 5 * 60 * 1000);

    // 立即执行一次
    await this.executeStrategies();
  }

  async executeStrategies() {
    logger.info('开始执行策略分析');
    
    for (const symbol of this.symbols) {
      try {
        const result = await this.v3Strategy.execute(symbol);
        logger.info(`策略分析完成: ${symbol} - ${result.signal}`);
      } catch (error) {
        logger.error(`策略分析失败 ${symbol}: ${error.message}`);
      }
    }
  }

  stop() {
    this.isRunning = false;
    logger.info('策略工作进程停止');
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const worker = new StrategyWorker();
  worker.start();

  // 优雅关闭
  process.on('SIGINT', () => {
    logger.info('收到SIGINT信号，正在关闭策略工作进程...');
    worker.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('收到SIGTERM信号，正在关闭策略工作进程...');
    worker.stop();
    process.exit(0);
  });
}

module.exports = StrategyWorker;
