/**
 * 回测引擎重构版本
 * 完全解耦，参数驱动，支持差异化配置
 */

const { StrategyEngine, ParameterManager, SignalProcessor } = require('./strategy-engine');
const logger = require('../utils/logger');
const BacktestDataService = require('../services/backtest-data-service');

class BacktestEngine {
  constructor(databaseAdapter) {
    this.databaseAdapter = databaseAdapter;

    // 初始化参数管理器和信号处理器
    this.parameterManager = new ParameterManager();
    this.signalProcessor = new SignalProcessor();

    // 初始化策略引擎
    this.strategyEngine = new StrategyEngine(
      databaseAdapter,
      this.parameterManager,
      this.signalProcessor,
      logger
    );

    this.dataManager = new DataManager(databaseAdapter);
    this.resultProcessor = new ResultProcessor();
    this.tradeManager = new TradeManager();
  }

  /**
   * 构建K线窗口 - 为策略提供历史数据上下文
   * @param {Array} marketData - 完整市场数据
   * @param {number} currentIndex - 当前索引
   * @returns {Array} K线数组
   */
  buildKlinesWindow(marketData, currentIndex) {
    const windowSize = 100; // 提供100根K线的历史
    const startIndex = Math.max(0, currentIndex - windowSize + 1);

    return marketData.slice(startIndex, currentIndex + 1).map(d => [
      d.timestamp.getTime(),           // 0: openTime
      parseFloat(d.open),               // 1: open
      parseFloat(d.high),               // 2: high
      parseFloat(d.low),                // 3: low
      parseFloat(d.close),              // 4: close
      parseFloat(d.volume),             // 5: volume
      d.timestamp.getTime(),            // 6: closeTime
      parseFloat(d.volume * d.close),   // 7: quoteVolume
      0,                                // 8: trades
      parseFloat(d.volume * 0.5),       // 9: takerBuyVolume (估算)
      parseFloat(d.volume * d.close * 0.5) // 10: takerBuyQuoteVolume (估算)
    ]);
  }

  /**
   * 执行回测
   * @param {string} strategyName - 策略名称
   * @param {string} mode - 模式
   * @param {string} timeframe - 时间框架
   * @param {string} startDate - 开始日期
   * @param {string} endDate - 结束日期
   * @param {string} symbol - 交易对
   * @returns {Object} 回测结果
   */
  async runBacktest(strategyName, mode, timeframe, startDate, endDate, symbol = 'BTCUSDT') {
    try {
      logger.info(`[回测引擎] 开始回测: ${strategyName}-${mode}, ${symbol}, 时间框架: ${timeframe}, 时间范围: ${startDate} - ${endDate}`);

      // 1. 获取市场数据
      const marketData = await this.dataManager.getMarketData(timeframe, startDate, endDate, symbol);
      if (!marketData || marketData.length === 0) {
        throw new Error('无法获取市场数据');
      }

      // 2. 获取策略参数
      const parameters = this.strategyEngine.getStrategyParameters(strategyName, mode);

      // 3. 执行回测
      const trades = [];
      const positions = new Map();

      // 信号去重：跟踪最后一个信号，避免频繁换仓
      let lastSignal = { direction: null, timestamp: null, symbol: null };

      for (let i = 0; i < marketData.length; i++) {
        const currentData = marketData[i];

        // 构建策略需要的klines数组（提供历史数据窗口）
        const klinesWindow = this.buildKlinesWindow(marketData, i);
        const adaptedData = {
          ...currentData,
          klines: klinesWindow,
          currentPrice: currentData.close,
          symbol: currentData.symbol
        };

        // 执行策略
        const result = await this.strategyEngine.executeStrategy(
          strategyName,
          mode,
          adaptedData,
          parameters
        );

        // 信号去重：取消时间过滤，改用市场条件过滤（在策略内部）
        // 保留lastSignal用于统计，但不再过滤
        if (result.signal !== 'HOLD') {
          lastSignal = {
            direction: result.signal,
            timestamp: adaptedData.timestamp,
            symbol: adaptedData.symbol || 'BTCUSDT'
          };
        }

        // 处理交易（传递trades数组以记录平仓交易）
        if (result.signal !== 'HOLD') {
          this.tradeManager.processTrade(result, adaptedData, positions, trades);
        }

        // 检查平仓条件
        this.tradeManager.checkExitConditions(positions, adaptedData, trades);

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
 * 数据管理器 - 集成BacktestDataService
 */
class DataManager {
  constructor(databaseAdapter) {
    this.cache = new Map();
    this.databaseAdapter = databaseAdapter;
    this.backtestDataService = new BacktestDataService(databaseAdapter);
  }

  /**
   * 直接从数据库获取回测数据
   * @private
   */
  async fetchDataFromDatabase(symbol, timeframe, startDate, endDate) {
    const sql = `
      SELECT 
        UNIX_TIMESTAMP(open_time) * 1000 as timestamp,
        open_price, high_price, low_price, close_price,
        volume, quote_volume, trades_count,
        taker_buy_volume, taker_buy_quote_volume
      FROM backtest_market_data
      WHERE symbol = ? AND timeframe = ?
        AND open_time >= ? AND open_time <= ?
      ORDER BY open_time ASC
    `;

    try {
      const results = await this.databaseAdapter.db.query(sql, [
        symbol,
        timeframe,
        startDate,
        endDate
      ]);

      return results;
    } catch (error) {
      logger.error(`[数据管理器] 数据库查询失败`, error);
      throw error;
    }
  }

  /**
   * 获取市场数据
   * @param {string} timeframe - 时间框架
   * @param {string} startDate - 开始日期
   * @param {string} endDate - 结束日期
   * @param {string} symbol - 交易对
   * @returns {Array} 市场数据
   */
  async getMarketData(timeframe, startDate, endDate, symbol = 'BTCUSDT') {
    const cacheKey = `${symbol}-${timeframe}-${startDate}-${endDate}`;

    if (this.cache.has(cacheKey)) {
      logger.info(`[数据管理器] 从缓存获取数据: ${cacheKey}`);
      return this.cache.get(cacheKey);
    }

    try {
      logger.info(`[数据管理器] 从数据库获取数据: ${symbol}-${timeframe} (${startDate} ~ ${endDate})`);

      // 直接从数据库获取回测数据
      const dbResults = await this.fetchDataFromDatabase(symbol, timeframe, startDate, endDate);

      if (!dbResults || dbResults.length === 0) {
        logger.warn(`[数据管理器] 数据库中未找到数据: ${symbol}-${timeframe}`);
        return [];
      }

      // 转换为回测引擎需要的格式
      const data = dbResults.map((row, index) => ({
        timestamp: new Date(parseInt(row.timestamp)),
        open: parseFloat(row.open_price),
        high: parseFloat(row.high_price),
        low: parseFloat(row.low_price),
        close: parseFloat(row.close_price),
        volume: parseFloat(row.volume),
        currentPrice: parseFloat(row.close_price),
        symbol: symbol,
        // 添加metadata支持
        metadata: {
          dailyTrend: index > 20 ? (row.close_price > dbResults[index - 20].close_price ? 'BULLISH' : 'BEARISH') : 'NEUTRAL',
          orderBlocks: [],
          timeframe: timeframe
        }
      }));

      this.cache.set(cacheKey, data);
      logger.info(`[数据管理器] 成功获取 ${data.length} 条数据`);

      return data;
    } catch (error) {
      logger.error(`[数据管理器] 获取数据失败: ${symbol}-${timeframe}`, error);
      return [];
    }
  }

  /**
   * 清空缓存
   */
  clearCache() {
    this.cache.clear();
    if (this.backtestDataService) {
      this.backtestDataService.clearCache();
    }
    logger.info('[数据管理器] 已清空所有缓存');
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return {
      dataManagerCache: this.cache.size,
      backtestServiceCache: this.backtestDataService ? this.backtestDataService.getCacheStats() : {}
    };
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
  processTrade(result, marketData, positions, trades = []) {
    const symbol = marketData.symbol || 'BTCUSDT';
    const existingPosition = positions.get(symbol);

    // 优化：只在反向信号时平仓，同向信号保持持仓
    if (existingPosition && result.signal !== 'HOLD' &&
      result.signal !== existingPosition.direction) {
      // 反向信号：平仓现有仓位
      const closedTrade = this.closePosition(existingPosition, marketData, '反向信号');
      positions.delete(symbol);
      trades.push(closedTrade); // 记录到传入的trades数组
    }

    // 只在没有持仓或刚平仓后开新仓
    if (result.signal !== 'HOLD' && !positions.has(symbol)) {
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
   * @param {string} closeReason - 平仓原因
   * @returns {Object} 交易记录
   */
  closePosition(position, marketData, closeReason = '未知') {
    const exitPrice = marketData.currentPrice || marketData.close;
    const pnl = this.calculatePnL(position, exitPrice);
    const duration = (marketData.timestamp || new Date()) - position.entryTime;
    const pnlPercent = (pnl / position.entryPrice) * 100;
    const riskRewardActual = position.direction === 'BUY'
      ? (exitPrice - position.entryPrice) / (position.entryPrice - position.stopLoss)
      : (position.entryPrice - exitPrice) / (position.stopLoss - position.entryPrice);

    const trade = {
      ...position,
      exitPrice,
      exitTime: marketData.timestamp || new Date(),
      pnl,
      pnlPercent,
      duration,
      durationHours: duration / (1000 * 60 * 60),
      closeReason,
      riskRewardActual,
      status: 'CLOSED'
    };

    // 记录详细交易日志
    logger.info('[交易平仓详情]', {
      symbol: trade.symbol,
      direction: trade.direction,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      stopLoss: trade.stopLoss,
      takeProfit: trade.takeProfit,
      closeReason: trade.closeReason,
      pnl: trade.pnl.toFixed(2),
      pnlPercent: trade.pnlPercent.toFixed(2) + '%',
      holdTime: trade.durationHours.toFixed(2) + 'h',
      riskRewardActual: trade.riskRewardActual.toFixed(2) + ':1',
      confidence: trade.confidence
    });

    return trade;
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
    const currentTime = marketData.timestamp || new Date();

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

      // 检查时间止损（24小时）- 使用回测时间而非真实时间
      const maxHoldTime = 24 * 60 * 60 * 1000; // 24小时
      const holdTime = currentTime.getTime() - position.entryTime.getTime();
      if (holdTime > maxHoldTime) {
        shouldClose = true;
        closeReason = '时间止损';
      }

      if (shouldClose) {
        const closedTrade = this.closePosition(position, marketData, closeReason);
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

    // 统计平仓原因
    const closeReasonStats = this.calculateCloseReasonStats(closedTrades);

    // 计算盈亏分布
    const pnlDistribution = this.calculatePnlDistribution(closedTrades);

    // 计算持仓时间统计
    const holdTimeStats = this.calculateHoldTimeStats(closedTrades);

    // 记录详细统计日志
    logger.info('[回测统计详情]', {
      strategy: metadata.strategyName,
      mode: mode,
      总交易数: closedTrades.length,
      盈利交易: winningTrades.length,
      亏损交易: losingTrades.length,
      胜率: winRate.toFixed(2) + '%',
      净盈利: netProfit.toFixed(2),
      盈亏比: profitFactor.toFixed(2) + ':1',
      平均盈利: avgWin.toFixed(2),
      平均亏损: avgLoss.toFixed(2),
      平仓原因: closeReasonStats,
      盈亏分布: pnlDistribution,
      持仓时间: holdTimeStats
    });

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
      closeReasonStats,
      pnlDistribution,
      holdTimeStats,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * 统计平仓原因
   */
  calculateCloseReasonStats(trades) {
    const stats = {
      止损: 0,
      止盈: 0,
      时间止损: 0,
      未知: 0
    };

    trades.forEach(trade => {
      const reason = trade.closeReason || '未知';
      if (stats.hasOwnProperty(reason)) {
        stats[reason]++;
      } else {
        stats['未知']++;
      }
    });

    const total = trades.length;
    return {
      止损: { 数量: stats['止损'], 比例: ((stats['止损'] / total) * 100).toFixed(2) + '%' },
      止盈: { 数量: stats['止盈'], 比例: ((stats['止盈'] / total) * 100).toFixed(2) + '%' },
      时间止损: { 数量: stats['时间止损'], 比例: ((stats['时间止损'] / total) * 100).toFixed(2) + '%' },
      未知: { 数量: stats['未知'], 比例: ((stats['未知'] / total) * 100).toFixed(2) + '%' }
    };
  }

  /**
   * 计算盈亏分布
   */
  calculatePnlDistribution(trades) {
    const sorted = trades.map(t => t.pnl).sort((a, b) => a - b);
    const positive = trades.filter(t => t.pnl > 0);
    const negative = trades.filter(t => t.pnl < 0);

    return {
      最大盈利: sorted[sorted.length - 1]?.toFixed(2) || 0,
      最大亏损: sorted[0]?.toFixed(2) || 0,
      平均盈利: positive.length > 0 ? (positive.reduce((sum, t) => sum + t.pnl, 0) / positive.length).toFixed(2) : 0,
      平均亏损: negative.length > 0 ? (negative.reduce((sum, t) => sum + t.pnl, 0) / negative.length).toFixed(2) : 0,
      中位数: sorted[Math.floor(sorted.length / 2)]?.toFixed(2) || 0
    };
  }

  /**
   * 计算持仓时间统计
   */
  calculateHoldTimeStats(trades) {
    const hours = trades.map(t => t.durationHours || 0).sort((a, b) => a - b);

    return {
      最短持仓: hours[0]?.toFixed(2) + 'h' || '0h',
      最长持仓: hours[hours.length - 1]?.toFixed(2) + 'h' || '0h',
      平均持仓: (hours.reduce((sum, h) => sum + h, 0) / hours.length).toFixed(2) + 'h',
      中位数: hours[Math.floor(hours.length / 2)]?.toFixed(2) + 'h' || '0h'
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
