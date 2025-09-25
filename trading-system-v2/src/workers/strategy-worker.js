/**
 * 策略执行工作进程
 * 负责执行交易策略分析
 */

const V3Strategy = require('../strategies/v3-strategy');
const ICTStrategy = require('../strategies/ict-strategy');
const TradeManager = require('../core/trade-manager');
const BinanceAPI = require('../api/binance-api');
const logger = require('../utils/logger');
const config = require('../config');

class StrategyWorker {
  constructor() {
    this.v3Strategy = new V3Strategy();
    this.ictStrategy = new ICTStrategy();
    this.tradeManager = TradeManager;
    this.binanceAPI = new BinanceAPI();
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
    logger.info('开始执行策略分析和交易检查');
    
    for (const symbol of this.symbols) {
      try {
        // 1. 检查现有交易的止盈止损条件
        await this.checkExistingTrades(symbol);
        
        // 2. 执行V3策略分析
        const v3Result = await this.v3Strategy.execute(symbol);
        logger.info(`V3策略分析完成: ${symbol} - ${v3Result.signal}`);
        
        // 3. 执行ICT策略分析
        const ictResult = await this.ictStrategy.execute(symbol);
        logger.info(`ICT策略分析完成: ${symbol} - ${ictResult.signal}`);
        
      } catch (error) {
        logger.error(`策略分析失败 ${symbol}: ${error.message}`);
      }
    }
  }

  /**
   * 检查现有交易的止盈止损条件
   * @param {string} symbol - 交易对
   */
  async checkExistingTrades(symbol) {
    try {
      // 获取当前价格
      const ticker = await this.binanceAPI.getTicker24hr(symbol);
      if (!ticker || !ticker.lastPrice) {
        logger.warn(`无法获取 ${symbol} 的当前价格`);
        return;
      }

      const currentPrice = parseFloat(ticker.lastPrice);
      
      // 自动检查并关闭符合条件的交易
      const closedTrades = await this.tradeManager.autoCloseTrades(symbol, currentPrice);
      
      if (closedTrades.length > 0) {
        logger.info(`自动关闭了 ${closedTrades.length} 个交易: ${symbol}`);
        for (const trade of closedTrades) {
          logger.info(`关闭交易: ${trade.symbol} ${trade.strategy_type} ${trade.exit_reason} PnL: ${trade.pnl}`);
        }
      }
    } catch (error) {
      logger.error(`检查现有交易失败 ${symbol}: ${error.message}`);
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
