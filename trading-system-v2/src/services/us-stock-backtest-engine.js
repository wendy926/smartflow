/**
 * 美股回测引擎
 * 独立于加密货币回测引擎，专用于美股模拟交易回测
 */

const USStockSimulationTrades = require('./us-stock-simulation-trades');
const logger = require('../utils/logger');

class USStockBacktestEngine {
  constructor(database) {
    this.database = database;
    this.simulationTrades = new USStockSimulationTrades();
    
    // 内存监控
    this.maxMemoryUsage = 512 * 1024 * 1024; // 512MB限制
    this.memoryCheckInterval = null;
  }

  /**
   * 监控内存使用
   */
  startMemoryMonitoring() {
    this.memoryCheckInterval = setInterval(() => {
      const memUsage = process.memoryUsage();
      const heapUsed = memUsage.heapUsed;
      
      if (heapUsed > this.maxMemoryUsage) {
        logger.warn(`[USStockBacktestEngine] 内存使用过高: ${(heapUsed / 1024 / 1024).toFixed(2)}MB`);
        if (global.gc) {
          global.gc(); // 手动触发垃圾回收
          logger.info('[USStockBacktestEngine] 已触发手动垃圾回收');
        }
      }
    }, 30000); // 每30秒检查一次
  }

  /**
   * 停止内存监控
   */
  stopMemoryMonitoring() {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
  }

  /**
   * 执行回测
   * @param {Object} options - 回测选项
   * @returns {Object} 回测结果
   */
  async runBacktest(options) {
    const {
      strategyName,    // V3_US 或 ICT_US
      strategyMode,    // AGGRESSIVE, BALANCED, CONSERVATIVE
      symbol,          // AAPL, MSFT等
      timeframe,       // 15m, 1h, 4h
      startDate,       // 2024-01-01
      endDate          // 2025-10-26
    } = options;

    try {
      logger.info(`[USStockBacktestEngine] 开始美股回测: ${strategyName}-${strategyMode}, ${symbol}, ${timeframe}, ${startDate} - ${endDate}`);

      // 1. 获取市场数据
      const marketData = await this.getMarketData(symbol, timeframe, startDate, endDate);
      if (!marketData || marketData.length === 0) {
        throw new Error(`无法获取市场数据: ${symbol}`);
      }

      // 2. 获取策略参数
      const strategyParams = await this.getStrategyParams(strategyName, strategyMode);

      // 3. 执行回测
      const trades = [];
      const positions = new Map(); // 持仓跟踪

      for (let i = 0; i < marketData.length; i++) {
        const currentData = marketData[i];
        const currentPrice = currentData.close;

        // 运行策略分析（这里需要调用具体的策略）
        const signals = await this.runStrategy(strategyName, marketData, i, strategyParams);

        // 处理信号并创建模拟订单
        for (const signal of signals) {
          if (signal.action === 'BUY' && !positions.has(symbol)) {
            // 开仓
            const order = await this.createSimulatedTrade({
              symbol,
              side: 'BUY',
              type: 'MARKET',
              quantity: this.calculatePositionSize(currentPrice, strategyParams),
              price: currentPrice,
              strategyName: `${strategyName}_${strategyMode}`,
              strategyMode,
              stopLoss: signal.stopLoss,
              takeProfit: signal.takeProfit
            });

            trades.push(order);
            positions.set(symbol, order);
          } else if (signal.action === 'SELL' && positions.has(symbol)) {
            // 平仓
            const position = positions.get(symbol);
            const exitPrice = currentPrice;
            const pnl = this.calculateTradePnL(position, exitPrice);

            await this.simulationTrades.closeTrade(position.orderId, exitPrice);
            await this.simulationTrades.updatePnL(position.orderId, pnl, 0);

            trades.push({
              ...position,
              exitPrice,
              pnl,
              closed_at: new Date()
            });

            positions.delete(symbol);
          }
        }

        // 更新未平仓订单的浮动盈亏（避免每次循环都计算所有持仓）
        if (i % 10 === 0) {  // 每10根K线更新一次
          for (const [posSymbol, position] of positions.entries()) {
            const unrealizedPnl = this.calculateTradePnL(position, currentPrice);
            await this.simulationTrades.updatePnL(position.orderId, 0, unrealizedPnl);
          }
        }

        // 定期清理trades数组，避免内存堆积（保留最近100条）
        if (trades.length > 100 && i % 50 === 0) {
          trades.splice(0, trades.length - 100);
        }
      }

      // 最终更新所有未平仓订单
      const currentPrice = marketData[marketData.length - 1].close;
      for (const [posSymbol, position] of positions.entries()) {
        const unrealizedPnl = this.calculateTradePnL(position, currentPrice);
        await this.simulationTrades.updatePnL(position.orderId, 0, unrealizedPnl);
      }

      // 4. 计算回测指标
      const closedTrades = trades.filter(t => t.closed_at);
      const metrics = this.calculateMetrics(closedTrades);

      // 5. 保存回测结果
      const backtestResult = {
        strategy_name: strategyName,
        strategy_mode: strategyMode,
        symbol,
        start_date: startDate,
        end_date: endDate,
        ...metrics
      };

      await this.simulationTrades.saveBacktestResult(backtestResult);

      logger.info(`[USStockBacktestEngine] 回测完成: ${symbol}, 总交易: ${closedTrades.length}, 胜率: ${metrics.win_rate}%, 净盈亏: $${metrics.net_pnl}`);

      return backtestResult;

    } catch (error) {
      logger.error('[USStockBacktestEngine] 回测失败:', error);
      throw error;
    }
  }

  /**
   * 获取市场数据
   */
  async getMarketData(symbol, timeframe, startDate, endDate) {
    try {
      const sql = `
        SELECT symbol, timeframe, timestamp, open, high, low, close, volume
        FROM us_stock_market_data
        WHERE symbol = ? 
          AND timeframe = ?
          AND timestamp >= ?
          AND timestamp <= ?
        ORDER BY timestamp ASC
      `;

      const klines = await this.database.query(sql, [symbol, timeframe, startDate, endDate]);

      return klines.map(k => ({
        timestamp: k.timestamp,
        open: parseFloat(k.open),
        high: parseFloat(k.high),
        low: parseFloat(k.low),
        close: parseFloat(k.close),
        volume: parseFloat(k.volume),
        symbol: k.symbol,
        timeframe: k.timeframe
      }));

    } catch (error) {
      logger.error(`[USStockBacktestEngine] 获取市场数据失败:`, error);
      throw error;
    }
  }

  /**
   * 获取策略参数
   */
  async getStrategyParams(strategyName, strategyMode) {
    try {
      const sql = `
        SELECT param_name, param_value, param_type
        FROM us_stock_strategy_params
        WHERE strategy_name = ? AND strategy_mode = ?
      `;

      const params = await this.database.query(sql, [strategyName, strategyMode]);

      const result = {};
      for (const param of params) {
        const value = this.convertParamValue(param.param_value, param.param_type);
        result[param.param_name] = value;
      }

      return result;

    } catch (error) {
      logger.error(`[USStockBacktestEngine] 获取策略参数失败:`, error);
      return {};
    }
  }

  /**
   * 转换参数值
   */
  convertParamValue(value, type) {
    switch (type) {
      case 'number':
        return parseFloat(value);
      case 'boolean':
        return value === 'true' || value === '1';
      case 'string':
      default:
        return value;
    }
  }

  /**
   * 运行策略
   */
  async runStrategy(strategyName, marketData, currentIndex, strategyParams) {
    try {
      const currentData = marketData[currentIndex];
      const klines15m = marketData; // 简化版，使用当前数据

      // 获取多时间框架数据
      const { klines4H, klines1H } = await this.getMultiTimeframeData(
        currentData.symbol,
        currentData.timestamp
      );

      if (strategyName === 'V3_US') {
        return await this.runV3Strategy(klines4H, klines1H, klines15m);
      } else if (strategyName === 'ICT_US') {
        return await this.runICTStrategy(klines15m);
      }

      return [];

    } catch (error) {
      logger.error(`[USStockBacktestEngine] 策略执行失败:`, error);
      return [];
    }
  }

  /**
   * 运行V3策略
   */
  async runV3Strategy(klines4H, klines1H, klines15m) {
    try {
      const USV3Strategy = require('../strategies/us-v3-strategy');
      const strategy = new USV3Strategy();
      
      const result = await strategy.execute(klines4H, klines1H, klines15m);
      
      if (result && result.action === 'BUY') {
        return [{
          action: 'BUY',
          symbol: klines15m[0]?.symbol || 'UNKNOWN',
          stopLoss: result.stopLoss,
          takeProfit: result.takeProfit
        }];
      }

      return [];

    } catch (error) {
      logger.error('[USStockBacktestEngine] V3策略执行失败:', error);
      return [];
    }
  }

  /**
   * 运行ICT策略
   */
  async runICTStrategy(klines15m) {
    try {
      const USICTStrategy = require('../strategies/us-ict-strategy');
      const strategy = new USICTStrategy();
      
      const result = await strategy.execute(klines15m);
      
      if (result && result.action === 'BUY') {
        return [{
          action: 'BUY',
          symbol: klines15m[0]?.symbol || 'UNKNOWN',
          stopLoss: result.stopLoss,
          takeProfit: result.takeProfit
        }];
      }

      return [];

    } catch (error) {
      logger.error('[USStockBacktestEngine] ICT策略执行失败:', error);
      return [];
    }
  }

  /**
   * 获取多时间框架数据
   */
  async getMultiTimeframeData(symbol, timestamp) {
    try {
      // 获取4H数据
      const klines4H = await this.getMarketData(symbol, '4h', null, null);
      // 获取1H数据
      const klines1H = await this.getMarketData(symbol, '1h', null, null);

      return { klines4H, klines1H };

    } catch (error) {
      logger.error(`[USStockBacktestEngine] 获取多时间框架数据失败:`, error);
      return { klines4H: [], klines1H: [] };
    }
  }

  /**
   * 计算仓位大小
   */
  calculatePositionSize(currentPrice, strategyParams) {
    // 简化版：固定仓位
    const baseSize = 10; // 10股
    return baseSize;
  }

  /**
   * 创建模拟交易
   */
  async createSimulatedTrade(orderData) {
    return await this.simulationTrades.createTrade(orderData);
  }

  /**
   * 计算交易PnL
   */
  calculateTradePnL(trade, exitPrice) {
    const entryPrice = parseFloat(trade.avg_fill_price || trade.price);
    const quantity = parseFloat(trade.filled_quantity || trade.quantity);

    if (trade.side === 'BUY') {
      return (exitPrice - entryPrice) * quantity;
    } else {
      return (entryPrice - exitPrice) * quantity;
    }
  }

  /**
   * 计算回测指标
   */
  calculateMetrics(trades) {
    if (!trades || trades.length === 0) {
      return {
        total_trades: 0,
        winning_trades: 0,
        losing_trades: 0,
        win_rate: 0,
        total_profit: 0,
        total_loss: 0,
        net_pnl: 0,
        max_drawdown: 0,
        sharpe_ratio: 0,
        profit_factor: 0,
        avg_win: 0,
        avg_loss: 0,
        avg_holding_period: 0
      };
    }

    const pnlArray = trades.map(t => t.pnl || 0);
    const winningTrades = pnlArray.filter(pnl => pnl > 0);
    const losingTrades = pnlArray.filter(pnl => pnl < 0);

    const totalTrades = trades.length;
    const winCount = winningTrades.length;
    const loseCount = losingTrades.length;
    const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;

    const totalProfit = winningTrades.reduce((sum, pnl) => sum + pnl, 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, pnl) => sum + pnl, 0));
    const netPnl = pnlArray.reduce((sum, pnl) => sum + pnl, 0);

    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : 0;

    const avgWin = winCount > 0 ? totalProfit / winCount : 0;
    const avgLoss = loseCount > 0 ? totalLoss / loseCount : 0;

    // 计算持仓时间（天）
    const holdingPeriods = trades.filter(t => t.closed_at).map(t => {
      const holdingMs = new Date(t.closed_at) - new Date(t.created_at);
      return holdingMs / (1000 * 60 * 60 * 24);
    });
    const avgHoldingPeriod = holdingPeriods.length > 0
      ? holdingPeriods.reduce((sum, days) => sum + days, 0) / holdingPeriods.length
      : 0;

    // 计算夏普比率（简化版）
    const meanReturn = netPnl / totalTrades;
    const variance = pnlArray.reduce((sum, pnl) => sum + Math.pow(pnl - meanReturn, 2), 0) / totalTrades;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(252) : 0;

    // 计算最大回撤
    let peak = 0;
    let maxDrawdown = 0;
    let runningPnl = 0;

    for (const pnl of pnlArray) {
      runningPnl += pnl;
      if (runningPnl > peak) {
        peak = runningPnl;
      }
      const drawdown = (peak - runningPnl) / (peak > 0 ? peak : 1) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return {
      total_trades: totalTrades,
      winning_trades: winCount,
      losing_trades: loseCount,
      win_rate: parseFloat(winRate.toFixed(2)),
      total_profit: parseFloat(totalProfit.toFixed(2)),
      total_loss: parseFloat(totalLoss.toFixed(2)),
      net_pnl: parseFloat(netPnl.toFixed(2)),
      max_drawdown: parseFloat(maxDrawdown.toFixed(2)),
      sharpe_ratio: parseFloat(sharpeRatio.toFixed(4)),
      profit_factor: parseFloat(profitFactor.toFixed(4)),
      avg_win: parseFloat(avgWin.toFixed(2)),
      avg_loss: parseFloat(avgLoss.toFixed(2)),
      avg_holding_period: parseFloat(avgHoldingPeriod.toFixed(2))
    };
  }
}

module.exports = USStockBacktestEngine;

