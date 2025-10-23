/**
 * 回测引擎重构版本 - 修复版
 */

const { StrategyEngine } = require('./strategy-engine');
const logger = require('../utils/logger');

class BacktestEngine {
  constructor(strategyEngine, databaseAdapter, logger) {
    this.strategyEngine = strategyEngine;
    this.databaseAdapter = databaseAdapter;
    this.logger = logger;
  }
  
  async runBacktest(strategyName, mode, timeframe, startDate, endDate) {
    try {
      
      const marketData = await this.getMarketData(timeframe, startDate, endDate);
      if (!marketData || marketData.length === 0) {
        throw new Error('无法获取市场数据');
      }
      
      
      const result = await this.executeBacktest(strategyName, mode, marketData, timeframe);
      
      return result;
    } catch (error) {
      this.logger.error(`[回测引擎] 处理K线数据失败: ${i}`, error);
      throw error;
    }
  }

  async executeBacktest(strategyName, mode, marketData, timeframe) {
    try {
      const trades = [];
      let currentPosition = null;


      for (let i = 50; i < marketData.length; i++) {
        try {
          const historicalData = marketData.slice(0, i + 1);
          const currentKline = marketData[i];
          
          const strategyResult = await this.strategyEngine.executeStrategy(strategyName, mode, {
            klines: historicalData,
            timeframe: timeframe,
            currentIndex: i
          });

          if (strategyResult && strategyResult.signal && strategyResult.signal !== 'HOLD') {
            const trade = this.processSignal(strategyResult, currentKline, i, currentPosition);
            
            if (trade) {
              // if (currentPosition) {
                this.closePosition(currentPosition, trade, trades);
                currentPosition = null; // 清空持仓
                // this.closePosition(currentPosition, trade, trades);
                currentPosition = null; // 清空持仓
                // this.closePosition(currentPosition, trade, trades);
              }
              
              if (trade.action === 'OPEN') {
                currentPosition = trade;
                trades.push(trade);
              }
            }
          }

        } catch (error) {
          this.logger.error(`[回测引擎] 处理信号失败`, error);
          continue;
        }
      }

      // if (currentPosition) {
                this.closePosition(currentPosition, trade, trades);
                currentPosition = null; // 清空持仓
                // this.closePosition(currentPosition, trade, trades);
                currentPosition = null; // 清空持仓
        const lastKline = marketData[marketData.length - 1];
        this.closePosition(currentPosition, {
          exitPrice: parseFloat(lastKline[4]),
          timestamp: lastKline[0],
          reason: 'END_OF_DATA'
        }, trades);
      }

      const result = this.calculateBacktestResults(trades, marketData, strategyName, mode, timeframe);
      
      
      return result;
    } catch (error) {
      this.logger.error(`[回测引擎] 处理信号失败`, error);
      throw error;
    }
  }

  processSignal(strategyResult, currentKline, index, currentPosition) {
    try {
      const signal = strategyResult.signal;
      const confidence = strategyResult.confidence || 0;
      const stopLoss = strategyResult.stopLoss || 0;
      const takeProfit = strategyResult.takeProfit || 0;
      
      if (confidence < 0.05) {
      }

      const currentPrice = parseFloat(currentKline[4]);
      const timestamp = currentKline[0];

      // if (currentPosition) {
                this.closePosition(currentPosition, trade, trades);
                currentPosition = null; // 清空持仓
                // this.closePosition(currentPosition, trade, trades);
                currentPosition = null; // 清空持仓
      }

      return {
        action: 'OPEN',
        side: signal,
        entryPrice: currentPrice,
        stopLoss: stopLoss,
        takeProfit: takeProfit,
        timestamp: timestamp,
        index: index,
        confidence: confidence
      };
    } catch (error) {
      this.logger.error('[回测引擎] 处理信号失败', error);
    }
  }

  closePosition(position, exitTrade, trades) {
    try {
      const exitPrice = exitTrade.exitPrice || parseFloat(exitTrade.entryPrice);
      const exitTimestamp = exitTrade.timestamp;
      
      position.exitPrice = exitPrice;
      position.exitTimestamp = exitTimestamp;
      position.exitReason = exitTrade.reason || 'SIGNAL';
      position.action = 'CLOSE';
      
      const pnl = this.calculatePnL(position);
      position.pnl = pnl;
      
    } catch (error) {
      this.logger.error('[回测引擎] 关闭仓位失败', error);
    }
  }

  calculatePnL(trade) {
    try {
      if (!trade.exitPrice) return 0;
      
      const entryPrice = trade.entryPrice;
      const exitPrice = trade.exitPrice;
      
      if (trade.side === 'BUY') {
        return exitPrice - entryPrice;
      } else if (trade.side === 'SELL') {
        return entryPrice - exitPrice;
      }
      
      return 0;
    } catch (error) {
      this.logger.error('[回测引擎] 计算盈亏失败', error);
      return 0;
    }
  }

  calculateBacktestResults(trades, marketData, strategyName, mode, timeframe) {
    try {
      const closedTrades = trades.filter(trade => trade.action === 'CLOSE');
      const totalTrades = closedTrades.length;
      const winningTrades = closedTrades.filter(trade => (trade.pnl || 0) > 0);
      const losingTrades = closedTrades.filter(trade => (trade.pnl || 0) < 0);
      
      const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;
      const netProfit = closedTrades.reduce((total, trade) => total + (trade.pnl || 0), 0);
      
      const avgWin = winningTrades.length > 0 ? 
        winningTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0) / winningTrades.length : 0;
      const avgLoss = losingTrades.length > 0 ? 
        Math.abs(losingTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0) / losingTrades.length) : 0;
      
      const profitFactor = avgLoss > 0 ? avgWin / avgLoss : 0;
      
      const startDate = marketData[0] ? new Date(marketData[0][0]) : new Date();
      const endDate = marketData[marketData.length - 1] ? new Date(marketData[marketData.length - 1][0]) : new Date();
      const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

      return {
        strategy: strategyName,
        mode: mode,
        timeframe: timeframe,
        totalTrades: totalTrades,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRate: parseFloat(winRate.toFixed(2)),
        netProfit: parseFloat(netProfit.toFixed(2)),
        profitFactor: parseFloat(profitFactor.toFixed(2)),
        avgWin: parseFloat(avgWin.toFixed(2)),
        avgLoss: parseFloat(avgLoss.toFixed(2)),
        maxDrawdown: 0,
        sharpeRatio: 0,
        totalFees: 0,
        backtestStartDate: startDate.toISOString(),
        backtestEndDate: endDate.toISOString(),
        totalDays: totalDays,
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('[回测引擎] 计算回测结果失败', error);
      return {
        strategy: strategyName,
        mode: mode,
        timeframe: timeframe,
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
        backtestStartDate: new Date().toISOString(),
        backtestEndDate: new Date().toISOString(),
        totalDays: 0,
        createdAt: new Date().toISOString()
      };
    }
  }

  async getMarketData(timeframe, startDate, endDate) {
    try {
      const marketData = await this.databaseAdapter.getMarketData(timeframe, startDate, endDate);
      return marketData;
    } catch (error) {
      this.logger.error('[回测引擎] 获取市场数据失败', error);
      throw error;
    }
  }
}

module.exports = BacktestEngine;
