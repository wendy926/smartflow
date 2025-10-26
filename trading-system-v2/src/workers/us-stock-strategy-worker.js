/**
 * 美股策略执行器 Worker
 * 定时执行美股策略分析，生成模拟订单
 * 独立于加密货币策略执行器
 */

const DatabaseConnection = require('../database/database-connection');
const USStockMarketDataLoader = require('../services/us-stock-market-data-loader');
const USStockBacktestEngine = require('../services/us-stock-backtest-engine');
const USStockSimulationTrades = require('../services/us-stock-simulation-trades');
const USV3Strategy = require('../strategies/us-v3-strategy');
const USICTStrategy = require('../strategies/us-ict-strategy');
const logger = require('../utils/logger');

class USStockStrategyWorker {
  constructor() {
    this.database = DatabaseConnection.getInstance();
    this.marketDataLoader = new USStockMarketDataLoader();
    this.backtestEngine = new USStockBacktestEngine(this.database);
    this.simulationTrades = new USStockSimulationTrades();
    
    this.isRunning = false;
    this.intervalId = null;
    
    this.symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'];
    this.strategies = ['V3_US', 'ICT_US'];
    this.modes = ['AGGRESSIVE', 'BALANCED', 'CONSERVATIVE'];
    
    this.executionInterval = 5 * 60 * 1000; // 5分钟执行一次
  }

  /**
   * 启动Worker
   */
  async start() {
    if (this.isRunning) {
      logger.warn('[USStockStrategyWorker] Worker已在运行中');
      return;
    }

    try {
      await this.initialize();
      
      this.isRunning = true;
      
      // 立即执行一次
      await this.executeStrategies();
      
      // 设置定时执行
      this.intervalId = setInterval(async () => {
        await this.executeStrategies();
      }, this.executionInterval);
      
      logger.info('[USStockStrategyWorker] Worker已启动');

    } catch (error) {
      logger.error('[USStockStrategyWorker] 启动失败:', error);
      throw error;
    }
  }

  /**
   * 停止Worker
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    logger.info('[USStockStrategyWorker] Worker已停止');
  }

  /**
   * 初始化
   */
  async initialize() {
    try {
      await this.marketDataLoader.initialize();
      logger.info('[USStockStrategyWorker] 初始化完成');

    } catch (error) {
      logger.error('[USStockStrategyWorker] 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 执行策略
   */
  async executeStrategies() {
    if (!this.isRunning) {
      return;
    }

    try {
      logger.info(`[USStockStrategyWorker] 开始执行策略分析，交易对: ${this.symbols.join(', ')}`);

      for (const symbol of this.symbols) {
        for (const strategyName of this.strategies) {
          for (const mode of this.modes) {
            try {
              await this.executeSingleStrategy(symbol, strategyName, mode);
              
              // 避免API限流
              await this.sleep(1000);
              
            } catch (error) {
              logger.error(`[USStockStrategyWorker] 策略执行失败: ${strategyName}-${mode} for ${symbol}`, error);
            }
          }
        }
      }

      logger.info('[USStockStrategyWorker] 策略执行完成');

    } catch (error) {
      logger.error('[USStockStrategyWorker] 执行策略失败:', error);
    }
  }

  /**
   * 执行单个策略
   */
  async executeSingleStrategy(symbol, strategyName, mode) {
    try {
      // 1. 获取最新K线数据
      const klines15m = await this.marketDataLoader.getKlinesFromDB(symbol, '15m', 100);
      
      if (!klines15m || klines15m.length === 0) {
        logger.warn(`[USStockStrategyWorker] 无法获取${symbol}的K线数据`);
        return;
      }

      // 2. 运行策略分析
      const signals = await this.analyzeStrategy(strategyName, symbol, klines15m, mode);
      
      if (!signals || signals.length === 0) {
        return;
      }

      // 3. 创建模拟订单
      for (const signal of signals) {
        if (signal.action === 'BUY' || signal.action === 'SELL') {
          await this.simulationTrades.createTrade({
            symbol,
            side: signal.action === 'BUY' ? 'BUY' : 'SELL',
            type: 'MARKET',
            quantity: this.calculatePositionSize(klines15m[klines15m.length - 1].close),
            price: klines15m[klines15m.length - 1].close,
            strategyName: `${strategyName}_${mode}`,
            strategyMode: mode,
            stopLoss: signal.stopLoss,
            takeProfit: signal.takeProfit
          });
        }
      }

      logger.info(`[USStockStrategyWorker] ${strategyName}-${mode} for ${symbol} 执行完成，生成${signals.length}个信号`);

    } catch (error) {
      logger.error(`[USStockStrategyWorker] 执行策略${strategyName}-${mode}失败:`, error);
      throw error;
    }
  }

  /**
   * 分析策略
   */
  async analyzeStrategy(strategyName, symbol, klines, mode) {
    try {
      if (strategyName === 'V3_US') {
        const strategy = new USV3Strategy();
        
        // 获取多时间框架数据（简化版）
        const klines4H = klines; // 简化版，使用相同数据
        const klines1H = klines;
        
        const result = await strategy.execute(klines4H, klines1H, klines);
        
        if (result && result.action === 'BUY') {
          return [result];
        }

      } else if (strategyName === 'ICT_US') {
        const strategy = new USICTStrategy();
        
        const result = await strategy.execute(klines);
        
        if (result && result.action === 'BUY') {
          return [result];
        }
      }

      return [];

    } catch (error) {
      logger.error(`[USStockStrategyWorker] 策略分析失败: ${strategyName}`, error);
      return [];
    }
  }

  /**
   * 计算仓位大小
   */
  calculatePositionSize(currentPrice) {
    // 固定仓位：10股
    const baseSize = 10;
    return baseSize;
  }

  /**
   * 延迟函数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 启动Worker（如果直接运行）
if (require.main === module) {
  const worker = new USStockStrategyWorker();
  
  worker.start().catch(error => {
    logger.error('[USStockStrategyWorker] Worker启动失败:', error);
    process.exit(1);
  });
  
  // 优雅退出
  process.on('SIGINT', () => {
    logger.info('[USStockStrategyWorker] 收到SIGINT信号，正在停止...');
    worker.stop();
    process.exit(0);
  });
}

module.exports = USStockStrategyWorker;

