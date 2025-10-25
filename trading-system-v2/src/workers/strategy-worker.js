/**
 * 策略执行工作进程
 * 负责执行交易策略分析
 */

const V3Strategy = require('../strategies/v3-strategy');
const ICTStrategy = require('../strategies/ict-strategy');
const TradeManager = require('../core/trade-manager');
const { getBinanceAPI } = require('../api/binance-api-singleton');
const logger = require('../utils/logger');
const config = require('../config');
const { getMaxLossAmount } = require('../api/routes/settings');

class StrategyWorker {
  constructor() {
    this.v3Strategy = new V3Strategy();
    this.ictStrategy = new ICTStrategy();
    this.tradeManager = TradeManager;
    this.binanceAPI = getBinanceAPI();  // 使用单例
    this.isRunning = false;
    this.symbols = config.defaultSymbols || ['BTCUSDT', 'ETHUSDT', 'ONDOUSDT', 'MKRUSDT', 'PENDLEUSDT', 'LINKUSDT', 'LDOUSDT'];
    this.intervalId = null; // 保存interval引用以便清理
  }

  async start() {
    if (this.isRunning) {
      logger.warn('策略工作进程已在运行');
      return;
    }

    this.isRunning = true;
    this.isExecuting = false; // 添加执行标志，防止并发执行
    logger.info('策略工作进程启动');

    // 每10分钟执行一次策略分析 - 降低2C2G VPS负载 - 保存interval引用以便清理
    this.intervalId = setInterval(async () => {
      if (this.isExecuting) {
        logger.warn('上一次策略执行尚未完成，跳过本次执行');
        return;
      }
      
      try {
        this.isExecuting = true;
        await this.executeStrategies();
      } catch (error) {
        logger.error(`策略执行失败: ${error.message}`, error);
        // 即使失败也继续运行，不抛出异常
      } finally {
        this.isExecuting = false;
      }
    }, 10 * 60 * 1000); // 从5分钟改为10分钟，降低VPS负载

    // 立即执行一次
    try {
      this.isExecuting = true;
      await this.executeStrategies();
    } catch (error) {
      logger.error(`初始策略执行失败: ${error.message}`, error);
      // 即使失败也继续运行
    } finally {
      this.isExecuting = false;
    }
  }

  async executeStrategies() {
    const startTime = Date.now();
    logger.info('开始执行策略分析和交易检查');

    for (const symbol of this.symbols) {
      let v3Result = null;
      let ictResult = null;
      
      try {
        // 检查执行时间，超过4分钟则中断（留1分钟缓冲）
        const elapsed = Date.now() - startTime;
        if (elapsed > 4 * 60 * 1000) {
          logger.warn(`策略执行超时(${elapsed}ms)，中断剩余交易对分析`);
          break;
        }

        // 1. 检查现有交易的止盈止损条件
        await this.checkExistingTrades(symbol);

        // 2. 执行V3策略分析 - 添加超时控制（30秒）
        try {
          const v3Promise = this.v3Strategy.execute(symbol);
          const v3Timeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('V3策略执行超时')), 30000)
          );
          v3Result = await Promise.race([v3Promise, v3Timeout]);
          if (v3Result && v3Result.signal !== 'WATCH') {
            logger.info(`V3策略信号: ${symbol} - ${v3Result.signal}`);
          }
        } catch (error) {
          logger.error(`V3策略执行失败 ${symbol}: ${error.message}`);
        }

        // 3. 执行ICT策略分析 - 添加超时控制（30秒）
        try {
          const ictPromise = this.ictStrategy.execute(symbol);
          const ictTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('ICT策略执行超时')), 30000)
          );
          ictResult = await Promise.race([ictPromise, ictTimeout]);
          if (ictResult && ictResult.signal !== 'WATCH') {
            logger.info(`ICT策略信号: ${symbol} - ${ictResult.signal}`);
          }
        } catch (error) {
          logger.error(`ICT策略执行失败 ${symbol}: ${error.message}`);
        }

        // 4. 根据策略信号创建交易
        await this.handleStrategySignals(symbol, v3Result, ictResult);

      } catch (error) {
        logger.error(`策略分析失败 ${symbol}: ${error.message}`, error);
        // 继续处理下一个交易对
      }
    }

    const totalTime = Date.now() - startTime;
    logger.info(`策略执行完成，耗时: ${totalTime}ms`);
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

      // 计算止损止盈 - 优先使用策略计算的参数
      let stopLoss, takeProfit, leverage, margin_used, quantity;
      
      if (result.tradeParams && result.tradeParams.entry > 0) {
        // 使用策略计算的精确参数
        stopLoss = result.tradeParams.stopLoss || 0;
        takeProfit = result.tradeParams.takeProfit || 0;
        leverage = result.tradeParams.leverage || 1;
        margin_used = result.tradeParams.margin || 0;
        quantity = result.tradeParams.units || 0;
        logger.info(`${strategy}策略使用精确参数: 止损=${stopLoss}, 止盈=${takeProfit}, 杠杆=${leverage}, 保证金=${margin_used}, 数量=${quantity}`);
      } else {
        // 使用默认计算方法
        stopLoss = result.stopLoss !== undefined ? result.stopLoss : this.calculateStopLoss(currentPrice, result.signal);
        takeProfit = result.takeProfit !== undefined ? result.takeProfit : this.calculateTakeProfit(currentPrice, result.signal);
        leverage = result.leverage || 1;
        margin_used = result.margin || 0;
        quantity = 0;
        logger.warn(`${strategy}策略使用默认参数: 止损=${stopLoss}, 止盈=${takeProfit}, 杠杆=${leverage}`);
      }

      // 如果策略没有提供精确参数，则使用默认计算
      if (!result.tradeParams || result.tradeParams.entry <= 0) {
        // 获取最大损失金额（从用户设置中获取）
        const maxLossAmount = result.maxLossAmount || getMaxLossAmount();

        // 计算仓位大小（基于止损距离和最大损失金额）
        quantity = this.calculatePositionSize(currentPrice, result.signal, stopLoss, maxLossAmount);

        // 计算杠杆和保证金
        const stopDistance = Math.abs(currentPrice - stopLoss);
        const stopDistancePct = stopDistance / currentPrice;
        const maxLeverage = Math.floor(1 / (stopDistancePct + 0.005)); // 加0.5%缓冲
        leverage = result.leverage || Math.min(maxLeverage, 20); // 最大20倍杠杆
        margin_used = result.margin || (quantity * currentPrice / leverage);
      }

      // 创建交易数据
      const tradeData = {
        symbol,
        strategy_type: strategy,
        trade_type: result.signal, // 使用trade_type字段
        entry_price: currentPrice,
        entry_reason: result.reason || `${strategy}策略信号`,
        quantity: quantity, // 使用quantity字段
        leverage: leverage,
        margin_used: margin_used, // 使用margin_used字段
        stop_loss: stopLoss,
        take_profit: takeProfit,
        market_type: result.marketType || (strategy === 'ICT' ? 'TREND' : 'RANGE'), // ✅ 保存市场类型
        time_stop_minutes: result.timeStopMinutes, // ✅ 保存时间止损
        max_duration_hours: result.maxDurationHours // ✅ 保存最大持仓时长
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
   * @param {number} stopLoss - 止损价格
   * @param {number} maxLossAmount - 最大损失金额（USDT）
   * @returns {number} 仓位大小
   */
  calculatePositionSize(price, direction, stopLoss, maxLossAmount = 50) {
    if (!stopLoss || stopLoss <= 0) {
      logger.warn('止损价格无效，使用默认仓位');
      return 0.1; // 兜底默认值
    }

    // 计算止损距离（绝对值）
    const stopDistance = Math.abs(price - stopLoss);

    if (stopDistance === 0) {
      logger.warn('止损距离为0，使用默认仓位');
      return 0.1;
    }

    // 计算quantity：最大损失金额 / 止损距离
    // 公式：quantity = maxLossAmount / (price × stopDistancePct)
    //      = maxLossAmount / stopDistance
    const quantity = maxLossAmount / stopDistance;

    logger.info(`仓位计算: 价格=${price.toFixed(4)}, 止损=${stopLoss.toFixed(4)}, ` +
      `止损距离=${stopDistance.toFixed(4)}, 最大损失=${maxLossAmount}U, ` +
      `quantity=${quantity.toFixed(6)}`);

    return quantity;
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
