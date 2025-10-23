#!/bin/bash
echo '=== 🔄 恢复新系统到ADX优化完成状态 ==='

cd /home/admin/trading-system-v2/trading-system-v2

# 1. 恢复策略文件（从本地拉取最新版本）
echo '📥 Step 1: 拉取最新代码'
git pull origin main 2>/dev/null || echo '跳过git pull'

# 2. 重新创建strategy-engine.js（带策略注册）
echo '📝 Step 2: 创建strategy-engine.js'
cat > src/core/strategy-engine.js << 'EOFENGINE'
/**
 * 策略引擎核心模块
 * 负责策略注册、参数管理和策略执行
 */

const logger = require('../utils/logger');

class StrategyEngine {
  constructor(databaseAdapter, parameterManager, signalProcessor, loggerInstance) {
    this.strategies = new Map();
    this.parameterManager = parameterManager;
    this.signalProcessor = signalProcessor;
    this.logger = loggerInstance || logger;
    this.databaseAdapter = databaseAdapter;
    
    // 延迟策略注册，避免循环依赖
  }

  /**
   * 注册策略
   */
  registerStrategy(name, strategyClass) {
    this.strategies.set(name, strategyClass);
    this.logger.info(`[策略引擎] 注册策略: ${name}`);
  }

  /**
   * 手动初始化策略注册
   */
  initializeStrategies() {
    try {
      const ICTStrategyRefactored = require('../strategies/ict-strategy-refactored');
      const V3StrategyV3_1Integrated = require('../strategies/v3-strategy-v3-1-integrated');
      
      this.registerStrategy('ICT', ICTStrategyRefactored);
      this.registerStrategy('V3', V3StrategyV3_1Integrated);
      
      this.logger.info('[策略引擎] 策略初始化完成');
    } catch (error) {
      this.logger.error('[策略引擎] 策略初始化失败:', error);
    }
  }

  /**
   * 执行策略（参数驱动）
   */
  async executeStrategy(strategyName, mode, marketData, parameters = {}) {
    try {
      const StrategyClass = this.strategies.get(strategyName);
      if (!StrategyClass) {
        throw new Error(`策略未注册: ${strategyName}`);
      }

      // 创建策略实例
      const strategy = new StrategyClass(this.logger);

      // 应用参数（如果策略支持）
      if (strategy.applyParameters && typeof strategy.applyParameters === 'function') {
        strategy.applyParameters(parameters);
      }
      
      // 设置模式（如果策略支持）
      if (strategy.setMode && typeof strategy.setMode === 'function') {
        strategy.setMode(mode);
      }

      // 执行策略
      const result = await strategy.execute(marketData);

      this.logger.info(`[策略引擎] ${strategyName}-${mode}: 执行完成, 信号=${result.signal}, 置信度=${result.confidence}`);

      return result;
    } catch (error) {
      this.logger.error(`[策略引擎] ${strategyName}-${mode}: 执行失败`, error);
      return {
        signal: 'HOLD',
        confidence: 0,
        metadata: { error: error.message }
      };
    }
  }

  /**
   * 获取策略参数（带模式配置）
   */
  getStrategyParameters(strategyName, mode) {
    // 基础参数（所有模式共享）
    const baseParams = {
      stopLossATRMultiplier: 0.6,  // 优化后参数
      takeProfitRatio: 2.5          // 优化后参数
    };

    // 模式特定参数
    const modeParams = {
      AGGRESSIVE: {
        signalThresholds: { strong: 0.5, moderate: 0.3, weak: 0.2 }
      },
      BALANCED: {
        signalThresholds: { strong: 0.6, moderate: 0.4, weak: 0.3 }
      },
      CONSERVATIVE: {
        signalThresholds: { strong: 0.7, moderate: 0.5, weak: 0.4 }
      }
    };

    return {
      ...baseParams,
      ...(modeParams[mode] || modeParams.BALANCED)
    };
  }
}

// 参数管理器（简化版）
class ParameterManager {
  constructor() {
    this.parameters = new Map();
  }

  getParameters(strategyName, mode) {
    const key = `${strategyName}-${mode}`;
    return this.parameters.get(key) || {};
  }

  setParameters(strategyName, mode, params) {
    const key = `${strategyName}-${mode}`;
    this.parameters.set(key, params);
  }
}

// 信号处理器（简化版）
class SignalProcessor {
  processSignal(signal, marketData) {
    return signal;
  }
}

module.exports = { StrategyEngine, ParameterManager, SignalProcessor };
EOFENGINE

echo '✅ strategy-engine.js 创建完成'

# 3. 创建backtest-engine.js（优化版）
echo '📝 Step 3: 创建backtest-engine.js'
cat > src/core/backtest-engine.js << 'EOFBACKTEST'
/**
 * 回测引擎（优化版）
 */

const { StrategyEngine, ParameterManager, SignalProcessor } = require('./strategy-engine');
const logger = require('../utils/logger');

class BacktestEngine {
  constructor(databaseAdapter) {
    this.databaseAdapter = databaseAdapter;
    this.parameterManager = new ParameterManager();
    this.signalProcessor = new SignalProcessor();
    
    this.strategyEngine = new StrategyEngine(
      databaseAdapter,
      this.parameterManager,
      this.signalProcessor,
      logger
    );
    
    // 初始化策略
    this.strategyEngine.initializeStrategies();
    
    this.dataManager = new DataManager(databaseAdapter);
    this.resultProcessor = new ResultProcessor();
    this.tradeManager = new TradeManager();
  }

  buildKlinesWindow(marketData, currentIndex) {
    const windowSize = 100;
    const startIndex = Math.max(0, currentIndex - windowSize + 1);

    return marketData.slice(startIndex, currentIndex + 1).map(d => [
      d.timestamp.getTime(),
      parseFloat(d.open),
      parseFloat(d.high),
      parseFloat(d.low),
      parseFloat(d.close),
      parseFloat(d.volume),
      d.timestamp.getTime(),
      parseFloat(d.volume * d.close),
      0,
      parseFloat(d.volume * 0.5),
      parseFloat(d.volume * d.close * 0.5)
    ]);
  }

  async runBacktest(strategyName, mode, timeframe, startDate, endDate, symbol = 'BTCUSDT') {
    try {
      logger.info(`[回测引擎] 开始回测: ${strategyName}-${mode}, ${symbol}, 时间框架: ${timeframe}, 时间范围: ${startDate} - ${endDate}`);

      const marketData = await this.dataManager.getMarketData(timeframe, startDate, endDate, symbol);
      if (!marketData || marketData.length === 0) {
        throw new Error('无法获取市场数据');
      }

      const parameters = this.strategyEngine.getStrategyParameters(strategyName, mode);
      const trades = [];
      const positions = new Map();

      for (let i = 50; i < marketData.length; i++) {
        const currentData = marketData[i];
        const klines = this.buildKlinesWindow(marketData, i);

        const adaptedData = {
          timestamp: currentData.timestamp,
          symbol: symbol,
          open: parseFloat(currentData.open),
          high: parseFloat(currentData.high),
          low: parseFloat(currentData.low),
          close: parseFloat(currentData.close),
          volume: parseFloat(currentData.volume),
          klines: klines,
          metadata: {
            klines: klines,
            dailyTrend: 'NEUTRAL',
            orderBlocks: []
          }
        };

        const result = await this.strategyEngine.executeStrategy(
          strategyName,
          mode,
          adaptedData,
          parameters
        );

        if (result.signal !== 'HOLD') {
          this.tradeManager.processTrade(result, adaptedData, positions, trades);
        }

        this.tradeManager.checkExitConditions(positions, adaptedData, trades);
      }

      // 关闭所有剩余持仓
      for (const [symbol, position] of positions.entries()) {
        const closedTrade = this.tradeManager.closePosition(
          position,
          marketData[marketData.length - 1],
          '回测结束'
        );
        trades.push(closedTrade);
      }

      const results = this.resultProcessor.calculateResults(trades);
      logger.info(`[回测引擎] 回测完成: ${strategyName}-${mode}, 交易数: ${results.totalTrades}, 胜率: ${results.winRate.toFixed(4)}%`);

      return results;
    } catch (error) {
      logger.error(`[回测引擎] 回测失败: ${strategyName}-${mode}`, error);
      throw error;
    }
  }
}

// DataManager, TradeManager, ResultProcessor类定义...
class DataManager {
  constructor(databaseAdapter) {
    this.databaseAdapter = databaseAdapter;
  }

  async getMarketData(timeframe, startDate, endDate, symbol) {
    const sql = `
      SELECT 
        UNIX_TIMESTAMP(open_time) * 1000 as timestamp,
        open_price as open, high_price as high, low_price as low, close_price as close,
        volume
      FROM backtest_market_data
      WHERE symbol = ? AND timeframe = ?
        AND open_time >= ? AND open_time <= ?
      ORDER BY open_time ASC
    `;

    try {
      const results = await this.databaseAdapter.query(sql, [symbol, timeframe, startDate, endDate]);
      
      const formatted = results.map(row => ({
        timestamp: new Date(Number(row.timestamp)),
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
        volume: Number(row.volume)
      }));

      logger.info(`[数据管理器] 成功获取 ${formatted.length} 条数据`);
      return formatted;
    } catch (error) {
      logger.error('[数据管理器] 获取数据失败:', error);
      throw error;
    }
  }
}

class TradeManager {
  constructor() {
    this.trades = [];
  }

  processTrade(result, marketData, positions, trades) {
    const symbol = marketData.symbol || 'BTCUSDT';
    const existingPosition = positions.get(symbol);

    if (existingPosition && result.signal !== existingPosition.direction) {
      const closedTrade = this.closePosition(existingPosition, marketData, '反向信号');
      positions.delete(symbol);
      trades.push(closedTrade);
    }

    if (result.signal !== 'HOLD' && !positions.has(symbol)) {
      const position = this.openPosition(result, marketData);
      positions.set(symbol, position);
    }
  }

  openPosition(result, marketData) {
    return {
      symbol: marketData.symbol || 'BTCUSDT',
      direction: result.signal,
      entryPrice: marketData.close,
      entryTime: marketData.timestamp,
      stopLoss: result.stopLoss || marketData.close * (result.signal === 'BUY' ? 0.98 : 1.02),
      takeProfit: result.takeProfit || marketData.close * (result.signal === 'BUY' ? 1.05 : 0.95)
    };
  }

  closePosition(position, marketData, reason) {
    const exitPrice = marketData.close;
    const pnl = position.direction === 'BUY' 
      ? (exitPrice - position.entryPrice) 
      : (position.entryPrice - exitPrice);

    return {
      ...position,
      exitPrice,
      exitTime: marketData.timestamp,
      pnl,
      closeReason: reason
    };
  }

  checkExitConditions(positions, marketData, trades) {
    for (const [symbol, position] of positions.entries()) {
      let shouldClose = false;
      let reason = '';

      if (position.direction === 'BUY') {
        if (marketData.close <= position.stopLoss) {
          shouldClose = true;
          reason = '止损';
        } else if (marketData.close >= position.takeProfit) {
          shouldClose = true;
          reason = '止盈';
        }
      } else {
        if (marketData.close >= position.stopLoss) {
          shouldClose = true;
          reason = '止损';
        } else if (marketData.close <= position.takeProfit) {
          shouldClose = true;
          reason = '止盈';
        }
      }

      if (shouldClose) {
        const closedTrade = this.closePosition(position, marketData, reason);
        positions.delete(symbol);
        trades.push(closedTrade);
      }
    }
  }
}

class ResultProcessor {
  calculateResults(trades) {
    const totalTrades = trades.length;
    const winningTrades = trades.filter(t => t.pnl > 0).length;
    const losingTrades = trades.filter(t => t.pnl < 0).length;
    const netProfit = trades.reduce((sum, t) => sum + t.pnl, 0);
    
    const avgWin = winningTrades > 0 
      ? trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0) / winningTrades 
      : 0;
    const avgLoss = losingTrades > 0 
      ? Math.abs(trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0) / losingTrades) 
      : 0;

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate: totalTrades > 0 ? (winningTrades / totalTrades * 100) : 0,
      netProfit,
      profitFactor: avgLoss > 0 ? avgWin / avgLoss : 0,
      avgWin,
      avgLoss
    };
  }
}

module.exports = { BacktestEngine, DataManager, TradeManager, ResultProcessor };
EOFBACKTEST

echo '✅ backtest-engine.js 创建完成'

echo '
=== ✅ 新系统恢复完成 ===
已创建核心文件:
  - src/core/strategy-engine.js
  - src/core/backtest-engine.js

下一步:
1. 测试系统是否正常运行
2. 如需要，继续添加ADX优化
'
