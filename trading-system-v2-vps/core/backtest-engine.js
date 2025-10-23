/**
 * 回测引擎重构版本
 * 完全解耦，参数驱动，支持差异化配置
 */

const { StrategyEngine } = require('./strategy-engine');
const logger = require('../utils/logger');

class BacktestEngine {
  constructor() {
    this.strategyEngine = new StrategyEngine();
    this.dataManager = new DataManager();
    this.resultProcessor = new ResultProcessor();
    this.tradeManager = new TradeManager();
  }

  /**
   * 执行回测
   * @param {string} strategyName - 策略名称
   * @param {string} mode - 模式
   * @param {string} timeframe - 时间框架
   * @param {string} startDate - 开始日期
   * @param {string} endDate - 结束日期
   * @returns {Object} 回测结果
   */
  async runBacktest(strategyName, mode, timeframe, startDate, endDate) {
    try {
      logger.info(`[回测引擎] 开始回测: ${strategyName}-${mode}, 时间框架: ${timeframe}, 时间范围: ${startDate} - ${endDate}`);

      // 1. 获取市场数据
      const marketData = await this.dataManager.getMarketData(timeframe, startDate, endDate);
      if (!marketData || marketData.length === 0) {
        throw new Error('无法获取市场数据');
      }

      // 2. 获取策略参数
      const parameters = this.strategyEngine.getStrategyParameters(strategyName, mode);

      // 3. 执行回测
      const trades = [];
      const positions = new Map();

      for (let i = 0; i < marketData.length; i++) {
        const currentData = marketData[i];

        // 执行策略
        const result = await this.strategyEngine.executeStrategy(
          strategyName,
          mode,
          currentData,
          parameters
        );

        // 处理交易
        if (result.signal !== 'HOLD') {
          const trade = this.tradeManager.processTrade(result, currentData, positions);
          if (trade) trades.push(trade);
        }

        // 检查平仓条件
        this.tradeManager.checkExitConditions(positions, currentData, trades);

        // 定期清理内存
        if (i % 1000 === 0) {
          await new Promise(resolve => setImmediate(resolve));
          if (global.gc) global.gc();
        }
      }

      // 4. 处理结果
      const backtestResult = this.resultProcessor.process(trades, mode, {
        strategyName,
        timeframe,
        startDate,
        endDate,
        totalCandles: marketData.length
      });

      logger.info(`[回测引擎] 回测完成: ${strategyName}-${mode}, 交易数: ${trades.length}, 胜率: ${backtestResult.winRate}%`);

      return backtestResult;
    } catch (error) {
      logger.error(`[回测引擎] 回测失败: ${strategyName}-${mode}`, error);
      throw error;
    }
  }

  /**
   * 注册策略
   * @param {string} name - 策略名称
   * @param {Class} strategyClass - 策略类
   */
  registerStrategy(name, strategyClass) {
    this.strategyEngine.registerStrategy(name, strategyClass);
  }

  /**
   * 设置策略参数
   * @param {string} strategyName - 策略名称
   * @param {string} mode - 模式
   * @param {Object} parameters - 参数
   */
  setStrategyParameters(strategyName, mode, parameters) {
    this.strategyEngine.setStrategyParameters(strategyName, mode, parameters);
  }
}

/**
 * 数据管理器
 */
class DataManager {
  constructor() {
    this.cache = new Map();
  }

  /**
   * 获取市场数据
   * @param {string} timeframe - 时间框架
   * @param {string} startDate - 开始日期
   * @param {string} endDate - 结束日期
   * @returns {Array} 市场数据
   */
  async getMarketData(timeframe, startDate, endDate) {
    const cacheKey = `${timeframe}-${startDate}-${endDate}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // 从数据库获取数据
      const data = await this.fetchDataFromDatabase(timeframe, startDate, endDate);
      this.cache.set(cacheKey, data);
      return data;
    } catch (error) {
      logger.error(`[数据管理器] 获取数据失败: ${timeframe}`, error);
      return [];
    }
  }

  /**
   * 从数据库获取数据
   * @param {string} timeframe - 时间框架
   * @param {string} startDate - 开始日期
   * @param {string} endDate - 结束日期
   * @returns {Array} 数据
   */
  async fetchDataFromDatabase(timeframe, startDate, endDate) {
    // 这里应该从数据库获取数据
    // 暂时返回空数组，实际实现需要连接数据库
    return [];
  }
}

/**
 * 交易管理器
 */
class TradeManager {
  constructor() {
    this.trades = [];
  }

  /**
   * 处理交易
   * @param {Object} result - 策略结果
   * @param {Object} marketData - 市场数据
   * @param {Map} positions - 持仓
   * @returns {Object|null} 交易记录
   */
  processTrade(result, marketData, positions) {
    const symbol = marketData.symbol || 'BTCUSDT';
    const existingPosition = positions.get(symbol);

    if (existingPosition) {
      // 平仓现有仓位
      const closedTrade = this.closePosition(existingPosition, marketData);
      positions.delete(symbol);
      this.trades.push(closedTrade);
    }

    if (result.signal !== 'HOLD') {
      // 开新仓
      const position = this.openPosition(result, marketData);
      positions.set(symbol, position);
      return position;
    }

    return null;
  }

  /**
   * 开仓
   * @param {Object} result - 策略结果
   * @param {Object} marketData - 市场数据
   * @returns {Object} 持仓记录
   */
  openPosition(result, marketData) {
    return {
      symbol: marketData.symbol || 'BTCUSDT',
      direction: result.signal,
      entryPrice: marketData.currentPrice || marketData.close,
      entryTime: marketData.timestamp || new Date(),
      stopLoss: result.stopLoss,
      takeProfit: result.takeProfit,
      confidence: result.confidence,
      metadata: result.metadata,
      status: 'OPEN'
    };
  }

  /**
   * 平仓
   * @param {Object} position - 持仓记录
   * @param {Object} marketData - 市场数据
   * @returns {Object} 交易记录
   */
  closePosition(position, marketData) {
    const exitPrice = marketData.currentPrice || marketData.close;
    const pnl = this.calculatePnL(position, exitPrice);
    const duration = (marketData.timestamp || new Date()) - position.entryTime;

    return {
      ...position,
      exitPrice,
      exitTime: marketData.timestamp || new Date(),
      pnl,
      duration,
      status: 'CLOSED'
    };
  }

  /**
   * 计算盈亏
   * @param {Object} position - 持仓记录
   * @param {number} exitPrice - 退出价格
   * @returns {number} 盈亏
   */
  calculatePnL(position, exitPrice) {
    const priceDiff = exitPrice - position.entryPrice;
    return position.direction === 'BUY' ? priceDiff : -priceDiff;
  }

  /**
   * 检查平仓条件
   * @param {Map} positions - 持仓
   * @param {Object} marketData - 市场数据
   * @param {Array} trades - 交易记录
   */
  checkExitConditions(positions, marketData, trades) {
    const currentPrice = marketData.currentPrice || marketData.close;

    for (const [symbol, position] of positions) {
      let shouldClose = false;
      let closeReason = '';

      // 检查止损
      if (position.direction === 'BUY' && currentPrice <= position.stopLoss) {
        shouldClose = true;
        closeReason = '止损';
      } else if (position.direction === 'SELL' && currentPrice >= position.stopLoss) {
        shouldClose = true;
        closeReason = '止损';
      }

      // 检查止盈
      if (position.direction === 'BUY' && currentPrice >= position.takeProfit) {
        shouldClose = true;
        closeReason = '止盈';
      } else if (position.direction === 'SELL' && currentPrice <= position.takeProfit) {
        shouldClose = true;
        closeReason = '止盈';
      }

      // 检查时间止损（24小时）
      const maxHoldTime = 24 * 60 * 60 * 1000; // 24小时
      if (Date.now() - position.entryTime.getTime() > maxHoldTime) {
        shouldClose = true;
        closeReason = '时间止损';
      }

      if (shouldClose) {
        const closedTrade = this.closePosition(position, marketData);
        closedTrade.closeReason = closeReason;
        trades.push(closedTrade);
        positions.delete(symbol);
      }
    }
  }
}

/**
 * 结果处理器
 */
class ResultProcessor {
  /**
   * 处理回测结果
   * @param {Array} trades - 交易记录
   * @param {string} mode - 模式
   * @param {Object} metadata - 元数据
   * @returns {Object} 回测结果
   */
  process(trades, mode, metadata = {}) {
    const closedTrades = trades.filter(trade => trade.status === 'CLOSED');

    if (closedTrades.length === 0) {
      return {
        strategy: metadata.strategyName || 'Unknown',
        mode,
        timeframe: metadata.timeframe || '1h',
        status: 'COMPLETED',
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        netProfit: 0,
        profitFactor: 0,
        avgWin: 0,
        avgLoss: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        totalFees: 0,
        backtestStartDate: metadata.startDate,
        backtestEndDate: metadata.endDate,
        totalDays: 0,
        createdAt: new Date().toISOString()
      };
    }

    // 计算基本统计
    const winningTrades = closedTrades.filter(trade => trade.pnl > 0);
    const losingTrades = closedTrades.filter(trade => trade.pnl < 0);
    const winRate = (winningTrades.length / closedTrades.length) * 100;

    // 计算盈亏
    const totalProfit = winningTrades.reduce((sum, trade) => sum + trade.pnl, 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, trade) => sum + trade.pnl, 0));
    const netProfit = totalProfit - totalLoss;
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : 0;

    // 计算平均盈亏
    const avgWin = winningTrades.length > 0 ? totalProfit / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? totalLoss / losingTrades.length : 0;

    // 计算最大回撤
    const maxDrawdown = this.calculateMaxDrawdown(closedTrades);

    // 计算夏普比率
    const sharpeRatio = this.calculateSharpeRatio(closedTrades);

    // 计算手续费
    const totalFees = closedTrades.length * 0.001; // 假设每笔交易0.1%手续费

    // 计算回测天数
    const startDate = new Date(metadata.startDate || closedTrades[0].entryTime);
    const endDate = new Date(metadata.endDate || closedTrades[closedTrades.length - 1].exitTime);
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

    return {
      strategy: metadata.strategyName || 'Unknown',
      mode,
      timeframe: metadata.timeframe || '1h',
      status: 'COMPLETED',
      totalTrades: closedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: parseFloat(winRate.toFixed(4)),
      netProfit: parseFloat(netProfit.toFixed(8)),
      profitFactor: parseFloat(profitFactor.toFixed(4)),
      avgWin: parseFloat(avgWin.toFixed(8)),
      avgLoss: parseFloat(avgLoss.toFixed(8)),
      maxDrawdown: parseFloat(maxDrawdown.toFixed(8)),
      sharpeRatio: parseFloat(sharpeRatio.toFixed(4)),
      totalFees: parseFloat(totalFees.toFixed(8)),
      backtestStartDate: metadata.startDate,
      backtestEndDate: metadata.endDate,
      totalDays,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * 计算最大回撤
   * @param {Array} trades - 交易记录
   * @returns {number} 最大回撤
   */
  calculateMaxDrawdown(trades) {
    let maxDrawdown = 0;
    let peak = 0;
    let runningPnL = 0;

    for (const trade of trades) {
      runningPnL += trade.pnl;

      if (runningPnL > peak) {
        peak = runningPnL;
      }

      const drawdown = peak - runningPnL;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }

  /**
   * 计算夏普比率
   * @param {Array} trades - 交易记录
   * @returns {number} 夏普比率
   */
  calculateSharpeRatio(trades) {
    if (trades.length < 2) return 0;

    const returns = trades.map(trade => trade.pnl);
    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;

    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    return avgReturn / stdDev;
  }
}

module.exports = { BacktestEngine, DataManager, TradeManager, ResultProcessor };
