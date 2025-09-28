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

        // 4. 根据策略信号创建交易
        await this.handleStrategySignals(symbol, v3Result, ictResult);

      } catch (error) {
        logger.error(`策略分析失败 ${symbol}: ${error.message}`);
      }
    }
  }

  /**
   * 处理策略信号并创建交易
   * @param {string} symbol - 交易对
   * @param {Object} v3Result - V3策略结果
   * @param {Object} ictResult - ICT策略结果
   */
  async handleStrategySignals(symbol, v3Result, ictResult) {
    try {
      // 检查V3策略信号 (V3策略返回BUY/SELL)
      if (v3Result.signal === 'BUY' || v3Result.signal === 'SELL') {
        // 转换信号格式
        const convertedResult = {
          ...v3Result,
          signal: v3Result.signal === 'BUY' ? 'LONG' : 'SHORT'
        };
        await this.createTradeFromSignal(symbol, 'V3', convertedResult);
      }

      // 检查ICT策略信号 (ICT策略返回BUY/SELL，需要转换为LONG/SHORT)
      if (ictResult.signal === 'BUY' || ictResult.signal === 'SELL') {
        // 转换信号格式
        const convertedResult = {
          ...ictResult,
          signal: ictResult.signal === 'BUY' ? 'LONG' : 'SHORT'
        };
        await this.createTradeFromSignal(symbol, 'ICT', convertedResult);
      }
    } catch (error) {
      logger.error(`处理策略信号失败 ${symbol}: ${error.message}`);
    }
  }

  /**
   * 根据策略信号创建交易
   * @param {string} symbol - 交易对
   * @param {string} strategy - 策略名称
   * @param {Object} result - 策略结果
   */
  async createTradeFromSignal(symbol, strategy, result) {
    try {
      // 检查是否已有该策略的活跃交易
      const existingTrade = await this.tradeManager.getActiveTrade(symbol, strategy);
      if (existingTrade) {
        logger.info(`${strategy}策略 ${symbol} 已有活跃交易，跳过创建`);
        return;
      }

      // 获取当前价格
      const ticker = await this.binanceAPI.getTicker24hr(symbol);
      if (!ticker || !ticker.lastPrice) {
        logger.warn(`无法获取 ${symbol} 的当前价格，跳过创建交易`);
        return;
      }

      const currentPrice = parseFloat(ticker.lastPrice);

      // 创建交易数据
      const tradeData = {
        symbol,
        strategy_type: strategy,
        trade_type: result.signal, // 使用trade_type字段
        entry_price: currentPrice,
        entry_reason: result.reason || `${strategy}策略信号`,
        quantity: this.calculatePositionSize(currentPrice, result.signal), // 使用quantity字段
        leverage: result.leverage || 1.0,
        margin_used: result.margin || (this.calculatePositionSize(currentPrice, result.signal) * currentPrice), // 使用margin_used字段
        stop_loss: result.stopLoss !== undefined ? result.stopLoss : this.calculateStopLoss(currentPrice, result.signal),
        take_profit: result.takeProfit !== undefined ? result.takeProfit : this.calculateTakeProfit(currentPrice, result.signal)
      };

      // 创建交易
      const createResult = await this.tradeManager.createTrade(tradeData);
      if (createResult.success) {
        logger.info(`成功创建${strategy}策略交易: ${symbol} ${result.signal} 入场价: ${currentPrice}`);
      } else {
        logger.warn(`创建${strategy}策略交易失败: ${symbol} - ${createResult.error}`);
      }
    } catch (error) {
      logger.error(`创建${strategy}策略交易失败 ${symbol}: ${error.message}`);
    }
  }

  /**
   * 计算仓位大小
   * @param {number} price - 当前价格
   * @param {string} direction - 交易方向
   * @returns {number} 仓位大小
   */
  calculatePositionSize(price, direction) {
    // 固定仓位大小，可以根据需要调整
    const baseQuantity = 0.1; // 基础数量
    return baseQuantity;
  }

  /**
   * 计算止损价格
   * @param {number} price - 当前价格
   * @param {string} direction - 交易方向
   * @returns {number} 止损价格
   */
  calculateStopLoss(price, direction) {
    const stopLossPercent = 0.02; // 2%止损
    if (direction === 'LONG') {
      return price * (1 - stopLossPercent);
    } else {
      return price * (1 + stopLossPercent);
    }
  }

  /**
   * 计算止盈价格
   * @param {number} price - 当前价格
   * @param {string} direction - 交易方向
   * @returns {number} 止盈价格
   */
  calculateTakeProfit(price, direction) {
    const takeProfitPercent = 0.04; // 4%止盈
    if (direction === 'LONG') {
      return price * (1 + takeProfitPercent);
    } else {
      return price * (1 - takeProfitPercent);
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
