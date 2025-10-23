/**
 * 策略参数化回测管理器
 * 支持ICT和V3策略的180天历史数据回测
 * 遵循23个设计原则，实现高性能回测功能
 */

const logger = require('../utils/logger');
const BinanceAPI = require('../api/binance-api');
const BacktestStrategyEngine = require('./backtest-strategy-engine');

class BacktestManager {
  constructor(database, binanceAPI) {
    this.database = database;
    this.binanceAPI = binanceAPI || new BinanceAPI();
    this.strategyEngine = new BacktestStrategyEngine();
    this.cache = new Map(); // 缓存回测结果
    this.runningTasks = new Map(); // 运行中的任务
  }

  /**
   * 启动策略回测
   * @param {string} strategyName - 策略名称 (ICT/V3)
   * @param {string} mode - 策略模式 (AGGRESSIVE/BALANCED/CONSERVATIVE)
   * @param {Object} options - 回测选项
   * @returns {Promise<Object>} 回测结果
   */
  async startBacktest(strategyName, mode, options = {}) {
    const taskId = `${strategyName}-${mode}-${Date.now()}`;

    try {
      logger.info(`[回测管理器] 启动${strategyName}-${mode}回测任务: ${taskId}`);

      // 检查是否已有运行中的任务
      if (this.runningTasks.has(taskId)) {
        throw new Error('该策略模式已有运行中的回测任务');
      }

      // 创建回测任务记录
      const taskRecord = await this.createBacktestTask(strategyName, mode, options);

      // 标记任务为运行中
      this.runningTasks.set(taskId, {
        taskId,
        strategyName,
        mode,
        startTime: new Date(),
        status: 'RUNNING'
      });

      // 异步执行回测
      this.executeBacktest(taskId, taskRecord.id, strategyName, mode, options)
        .catch(error => {
          logger.error(`[回测管理器] 回测任务${taskId}执行失败:`, error);
          this.runningTasks.delete(taskId);
        });

      return {
        success: true,
        taskId,
        message: '回测任务已启动'
      };

    } catch (error) {
      logger.error(`[回测管理器] 启动回测失败:`, error);
      this.runningTasks.delete(taskId);
      throw error;
    }
  }

  /**
   * 执行回测逻辑
   * @param {string} taskId - 任务ID
   * @param {number} taskRecordId - 任务记录ID
   * @param {string} strategyName - 策略名称
   * @param {string} mode - 策略模式
   * @param {Object} options - 回测选项
   */
  async executeBacktest(taskId, taskRecordId, strategyName, mode, options) {
    try {
      // 1. 获取策略参数
      const strategyParams = await this.getStrategyParameters(strategyName, mode);

      // 2. 获取市场数据
      const marketData = await this.fetchMarketData(options.symbols || this.getDefaultSymbols());

      // 3. 执行策略回测
      const backtestResult = await this.runStrategyBacktest(strategyName, mode, strategyParams, marketData);

      // 4. 保存回测结果
      await this.saveBacktestResult(taskRecordId, strategyName, mode, backtestResult);

      // 5. 更新任务状态
      await this.updateTaskStatus(taskRecordId, 'COMPLETED', 100);

      // 6. 清理缓存
      this.cache.delete(`${strategyName}-${mode}`);

      logger.info(`[回测管理器] 回测任务${taskId}完成`);

    } catch (error) {
      logger.error(`[回测管理器] 回测任务${taskId}执行失败:`, error);
      await this.updateTaskStatus(taskRecordId, 'FAILED', 0, error.message);
      throw error;
    } finally {
      this.runningTasks.delete(taskId);
    }
  }

  /**
   * 获取策略参数
   * @param {string} strategyName - 策略名称
   * @param {string} mode - 策略模式
   * @returns {Promise<Object>} 策略参数
   */
  async getStrategyParameters(strategyName, mode) {
    const cacheKey = `params-${strategyName}-${mode}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const query = `
        SELECT param_name, param_value, param_type, param_group, unit, min_value, max_value, description
        FROM strategy_params 
        WHERE strategy_name = ? AND strategy_mode = ? AND is_active = 0
        ORDER BY param_group, param_name
      `;

      const params = await this.database.query(query, [strategyName, mode]);

      // 将参数转换为对象格式
      const paramObj = {};
      params.forEach(param => {
        if (!paramObj[param.param_group]) {
          paramObj[param.param_group] = {};
        }

        // 转换参数值类型
        let value = param.param_value;
        if (param.param_type === 'number') {
          value = parseFloat(value);
        } else if (param.param_type === 'boolean') {
          value = value === 'true' || value === '1';
        }

        paramObj[param.param_group][param.param_name] = {
          value,
          type: param.param_type,
          unit: param.unit,
          min: param.min_value ? parseFloat(param.min_value) : null,
          max: param.max_value ? parseFloat(param.max_value) : null,
          description: param.description
        };
      });

      this.cache.set(cacheKey, paramObj);
      return paramObj;

    } catch (error) {
      logger.error(`[回测管理器] 获取策略参数失败:`, error);
      throw error;
    }
  }

  /**
   * 获取市场数据
   * @param {Array<string>} symbols - 交易对列表
   * @returns {Promise<Object>} 市场数据
   */
  async fetchMarketData(symbols) {
    const marketData = {};

    try {
      // 并行获取所有交易对的数据
      const dataPromises = symbols.map(symbol => this.fetchSymbolData(symbol));
      const results = await Promise.all(dataPromises);

      results.forEach((data, index) => {
        if (data) {
          marketData[symbols[index]] = data;
        }
      });

      logger.info(`[回测管理器] 获取到${Object.keys(marketData).length}个交易对的180天数据`);
      return marketData;

    } catch (error) {
      logger.error(`[回测管理器] 获取市场数据失败:`, error);
      throw error;
    }
  }

  /**
   * 获取单个交易对的数据
   * @param {string} symbol - 交易对
   * @returns {Promise<Array>} K线数据
   */
  async fetchSymbolData(symbol) {
    try {
      logger.info(`[回测管理器] 开始获取${symbol}的数据`);

      // 检查缓存
      const cacheKey = `market-${symbol}`;
      if (this.cache.has(cacheKey)) {
        logger.info(`[回测管理器] ${symbol}使用缓存数据`);
        return this.cache.get(cacheKey);
      }

      // 从数据库获取历史数据
      logger.info(`[回测管理器] ${symbol}缓存未命中，从数据库获取`);
      let klines = await this.getCachedMarketData(symbol);

      // 如果数据库没有足够数据，记录警告但不从API获取（应该使用预加载服务）
      if (!klines || klines.length < 100) { // 至少需要100条数据
        logger.warn(`[回测管理器] ${symbol}数据库数据不足(${klines ? klines.length : 0}条)，请先使用预加载服务获取数据`);
        return null;
      }

      if (klines && klines.length > 0) {
        this.cache.set(cacheKey, klines);
        logger.info(`[回测管理器] 从数据库获取${symbol}的${klines.length}条数据`);
        return klines;
      }

      return null;

    } catch (error) {
      logger.error(`[回测管理器] 获取${symbol}数据失败:`, error);
      return null;
    }
  }

  /**
   * 从数据库获取缓存的市场数据
   * @param {string} symbol - 交易对
   * @returns {Promise<Array>} K线数据
   */
  async getCachedMarketData(symbol) {
    try {
      logger.info(`[回测管理器] 从数据库获取${symbol}的缓存数据`);

      const query = `
        SELECT open_time, close_time, open_price, high_price, low_price, close_price, volume, quote_volume
        FROM backtest_market_data 
        WHERE symbol = ? AND timeframe = '1h'
        ORDER BY open_time DESC
      `;

      const rows = await this.database.query(query, [symbol]);
      logger.info(`[回测管理器] 查询到${rows.length}条${symbol}数据`);

      return rows.map(row => {
        // 处理时间戳：如果是Date对象则调用getTime()，如果是字符串则转换为时间戳
        const openTime = row.open_time instanceof Date
          ? row.open_time.getTime()
          : new Date(row.open_time).getTime();
        const closeTime = row.close_time instanceof Date
          ? row.close_time.getTime()
          : new Date(row.close_time).getTime();

        return [
          openTime,
          parseFloat(row.open_price),
          parseFloat(row.high_price),
          parseFloat(row.low_price),
          parseFloat(row.close_price),
          parseFloat(row.volume),
          closeTime,
          parseFloat(row.quote_volume),
          0, // trades_count
          0, // taker_buy_volume
          0  // taker_buy_quote_volume
        ];
      });

    } catch (error) {
      logger.error(`[回测管理器] 获取缓存数据失败:`, error);
      return null;
    }
  }

  /**
   * 保存市场数据到数据库
   * @param {string} symbol - 交易对
   * @param {Array} klines - K线数据
   */
  async saveMarketData(symbol, klines) {
    try {
      const values = klines.map(kline => [
        symbol,
        '1h',
        new Date(kline[0]),
        new Date(kline[6]),
        kline[1],
        kline[2],
        kline[3],
        kline[4],
        kline[5],
        kline[7],
        kline[8] || 0,
        kline[9] || 0,
        kline[10] || 0
      ]);

      const query = `
        INSERT INTO backtest_market_data 
        (symbol, timeframe, open_time, close_time, open_price, high_price, low_price, close_price, volume, quote_volume, trades_count, taker_buy_volume, taker_buy_quote_volume)
        VALUES ?
        ON DUPLICATE KEY UPDATE
        open_price = VALUES(open_price),
        high_price = VALUES(high_price),
        low_price = VALUES(low_price),
        close_price = VALUES(close_price),
        volume = VALUES(volume),
        quote_volume = VALUES(quote_volume)
      `;

      await this.database.query(query, [values]);
      logger.info(`[回测管理器] 保存${symbol}的${klines.length}条K线数据到数据库`);

    } catch (error) {
      logger.error(`[回测管理器] 保存市场数据失败:`, error);
    }
  }

  /**
   * 运行策略回测
   * @param {string} strategyName - 策略名称
   * @param {string} mode - 策略模式
   * @param {Object} params - 策略参数
   * @param {Object} marketData - 市场数据
   * @returns {Promise<Object>} 回测结果
   */
  async runStrategyBacktest(strategyName, mode, params, marketData) {
    try {
      logger.info(`[回测管理器] 开始执行${strategyName}-${mode}策略回测`);

      if (strategyName === 'ICT') {
        return await this.runICTBacktest(mode, params, marketData);
      } else if (strategyName === 'V3') {
        return await this.runV3Backtest(mode, params, marketData);
      } else {
        throw new Error(`不支持的策略: ${strategyName}`);
      }

    } catch (error) {
      logger.error(`[回测管理器] 策略回测失败:`, error);
      throw error;
    }
  }

  /**
   * 运行ICT策略回测
   * @param {string} mode - 策略模式
   * @param {Object} params - 策略参数
   * @param {Object} marketData - 市场数据
   * @returns {Promise<Object>} 回测结果
   */
  async runICTBacktest(mode, params, marketData) {
    const trades = [];
    const symbols = Object.keys(marketData);

    logger.info(`[回测管理器] ICT-${mode}回测: 交易对数量=${symbols.length}, 参数=${JSON.stringify(Object.keys(params))}`);

    for (const symbol of symbols) {
      const klines = marketData[symbol];
      logger.info(`[回测管理器] ${symbol}: K线数量=${klines ? klines.length : 0}`);
      if (!klines || klines.length < 100) {
        logger.warn(`[回测管理器] ${symbol}数据不足，跳过`);
        continue;
      }

      // 模拟ICT策略交易
      logger.info(`[回测管理器] 开始模拟${symbol}的ICT交易`);
      const symbolTrades = await this.simulateICTTrades(symbol, klines, params, mode);
      logger.info(`[回测管理器] ${symbol}生成${symbolTrades.length}笔交易`);
      trades.push(...symbolTrades);
    }

    logger.info(`[回测管理器] ICT-${mode}回测完成: 总交易数=${trades.length}`);
    return this.calculateBacktestMetrics(trades, mode);
  }

  /**
   * 运行V3策略回测
   * @param {string} mode - 策略模式
   * @param {Object} params - 策略参数
   * @param {Object} marketData - 市场数据
   * @returns {Promise<Object>} 回测结果
   */
  async runV3Backtest(mode, params, marketData) {
    const trades = [];
    const symbols = Object.keys(marketData);

    for (const symbol of symbols) {
      const klines = marketData[symbol];
      if (!klines || klines.length < 100) continue;

      // 模拟V3策略交易
      const symbolTrades = await this.simulateV3Trades(symbol, klines, params, mode);
      trades.push(...symbolTrades);
    }

    return this.calculateBacktestMetrics(trades, mode);
  }

  /**
   * 模拟ICT策略交易
   * @param {string} symbol - 交易对
   * @param {Array} klines - K线数据
   * @param {Object} params - 策略参数
   * @param {string} mode - 策略模式
   * @returns {Promise<Array>} 交易记录
   */
  async simulateICTTrades(symbol, klines, params, mode) {
    // 调用BacktestStrategyEngine的simulateICTTrades方法
    return await this.strategyEngine.simulateICTTrades(symbol, klines, params, mode);
  }

  /**
   * 模拟V3策略交易
   * @param {string} symbol - 交易对
   * @param {Array} klines - K线数据
   * @param {Object} params - 策略参数
   * @param {string} mode - 策略模式
   * @returns {Promise<Array>} 交易记录
   */
  async simulateV3Trades(symbol, klines, params, mode) {
    // 调用BacktestStrategyEngine的simulateV3Trades方法
    return await this.strategyEngine.simulateV3Trades(symbol, klines, params, mode);
  }

  /**
   * 检查ICT开仓信号
   * @param {Array} klines - K线数据
   * @param {number} index - 当前K线索引
   * @param {Object} params - 策略参数
   * @param {string} mode - 策略模式
   * @returns {Object|null} 信号对象
   */
  checkICTSignal(klines, index, params, mode) {
    // 简化的ICT信号检测逻辑
    // 实际实现需要根据ICT策略的具体规则

    const currentKline = klines[index];
    const prevKline = klines[index - 1];

    // 检查订单块信号
    const orderBlockSignal = this.checkOrderBlockSignal(klines, index, params.orderblock || {});
    if (orderBlockSignal) return orderBlockSignal;

    // 检查流动性扫荡信号
    const sweepSignal = this.checkSweepSignal(klines, index, params.sweep || {});
    if (sweepSignal) return sweepSignal;

    // 检查吞没形态信号
    const engulfingSignal = this.checkEngulfingSignal(klines, index, params.engulfing || {});
    if (engulfingSignal) return engulfingSignal;

    return null;
  }

  /**
   * 检查V3开仓信号
   * @param {Array} klines - K线数据
   * @param {number} index - 当前K线索引
   * @param {Object} params - 策略参数
   * @param {string} mode - 策略模式
   * @returns {Object|null} 信号对象
   */
  checkV3Signal(klines, index, params, mode) {
    // 简化的V3信号检测逻辑
    // 实际实现需要根据V3策略的具体规则

    const currentKline = klines[index];
    const prevKline = klines[index - 1];

    // 检查趋势信号
    const trendSignal = this.checkTrendSignal(klines, index, params.trend || {});
    if (!trendSignal) return null;

    // 检查因子信号
    const factorSignal = this.checkFactorSignal(klines, index, params.factor || {});
    if (!factorSignal) return null;

    // 检查入场信号
    const entrySignal = this.checkEntrySignal(klines, index, params.entry || {});
    if (!entrySignal) return null;

    return {
      direction: trendSignal.direction,
      confidence: (trendSignal.confidence + factorSignal.confidence + entrySignal.confidence) / 3
    };
  }

  /**
   * 计算回测指标
   * @param {Array} trades - 交易记录
   * @param {string} mode - 策略模式
   * @returns {Object} 回测指标
   */
  calculateBacktestMetrics(trades, mode) {
    if (trades.length === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalPnl: 0,
        avgWin: 0,
        avgLoss: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        profitFactor: 0,
        avgTradeDuration: 0,
        maxConsecutiveWins: 0,
        maxConsecutiveLosses: 0,
        totalFees: 0,
        netProfit: 0
      };
    }

    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl < 0);

    const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
    const totalFees = trades.reduce((sum, t) => sum + (t.fees || 0), 0);

    const winRate = trades.length > 0 ? winningTrades.length / trades.length : 0;
    const avgWin = winningTrades.length > 0 ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length : 0;

    const profitFactor = Math.abs(avgLoss) > 0 ? Math.abs(avgWin) / Math.abs(avgLoss) : 0;

    // 计算最大回撤
    let maxDrawdown = 0;
    let peak = 0;
    let current = 0;

    for (const trade of trades) {
      current += trade.pnl;
      if (current > peak) peak = current;
      const drawdown = peak - current;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    // 计算连续盈亏
    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;
    let currentWins = 0;
    let currentLosses = 0;

    for (const trade of trades) {
      if (trade.pnl > 0) {
        currentWins++;
        currentLosses = 0;
        if (currentWins > maxConsecutiveWins) maxConsecutiveWins = currentWins;
      } else {
        currentLosses++;
        currentWins = 0;
        if (currentLosses > maxConsecutiveLosses) maxConsecutiveLosses = currentLosses;
      }
    }

    // 计算平均持仓时长
    const totalDuration = trades.reduce((sum, t) => sum + (t.durationHours || 0), 0);
    const avgTradeDuration = trades.length > 0 ? totalDuration / trades.length : 0;

    // 计算夏普比率（简化版）
    const returns = trades.map(t => t.pnl);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const sharpeRatio = Math.sqrt(variance) > 0 ? avgReturn / Math.sqrt(variance) : 0;

    return {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate,
      totalPnl,
      avgWin,
      avgLoss,
      maxDrawdown,
      sharpeRatio,
      profitFactor,
      avgTradeDuration,
      maxConsecutiveWins,
      maxConsecutiveLosses,
      totalFees,
      netProfit: totalPnl - totalFees
    };
  }

  /**
   * 获取默认交易对列表
   * @returns {Array<string>} 交易对列表
   */
  getDefaultSymbols() {
    return [
      'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT',
      'SOLUSDT', 'DOTUSDT', 'DOGEUSDT', 'AVAXUSDT', 'SHIBUSDT',
      'MATICUSDT', 'LTCUSDT', 'UNIUSDT'
    ];
  }

  /**
   * 创建回测任务记录
   * @param {string} strategyName - 策略名称
   * @param {string} mode - 策略模式
   * @param {Object} options - 回测选项
   * @returns {Promise<Object>} 任务记录
   */
  async createBacktestTask(strategyName, mode, options) {
    const query = `
      INSERT INTO backtest_tasks 
      (strategy_name, task_type, target_mode, status, total_days, symbols, created_by)
      VALUES (?, 'SINGLE_MODE', ?, 'PENDING', ?, ?, 'system')
    `;

    const symbols = JSON.stringify(options.symbols || this.getDefaultSymbols());
    const result = await this.database.query(query, [strategyName, mode, 180, symbols]);

    return {
      id: result.insertId,
      strategyName,
      mode,
      status: 'PENDING'
    };
  }

  /**
   * 更新任务状态
   * @param {number} taskId - 任务ID
   * @param {string} status - 状态
   * @param {number} progress - 进度
   * @param {string} errorMessage - 错误信息
   */
  async updateTaskStatus(taskId, status, progress = 0, errorMessage = null) {
    const query = `
      UPDATE backtest_tasks 
      SET status = ?, progress_percent = ?, end_time = ?, error_message = ?
      WHERE id = ?
    `;

    await this.database.query(query, [status, progress, new Date(), errorMessage, taskId]);
  }

  /**
   * 保存回测结果
   * @param {number} taskId - 任务ID
   * @param {string} strategyName - 策略名称
   * @param {string} mode - 策略模式
   * @param {Object} result - 回测结果
   */
  async saveBacktestResult(taskId, strategyName, mode, result) {
    const query = `
      INSERT INTO strategy_parameter_backtest_results 
      (strategy_name, strategy_mode, backtest_period, total_trades, winning_trades, losing_trades, 
       win_rate, total_pnl, avg_win, avg_loss, max_drawdown, sharpe_ratio, profit_factor, 
       avg_trade_duration, max_consecutive_wins, max_consecutive_losses, total_fees, net_profit,
       backtest_start_date, backtest_end_date, total_days, backtest_status)
      VALUES (?, ?, '180天', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 180, 'COMPLETED')
    `;

    await this.database.query(query, [
      strategyName, mode, result.totalTrades, result.winningTrades, result.losingTrades,
      result.winRate, result.totalPnl, result.avgWin, result.avgLoss, result.maxDrawdown,
      result.sharpeRatio, result.profitFactor, result.avgTradeDuration, result.maxConsecutiveWins,
      result.maxConsecutiveLosses, result.totalFees, result.netProfit,
      new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), new Date()
    ]);
  }

  /**
   * 获取回测结果
   * @param {string} strategyName - 策略名称
   * @param {string} mode - 策略模式
   * @returns {Promise<Object>} 回测结果
   */
  async getBacktestResult(strategyName, mode) {
    const query = `
      SELECT * FROM strategy_parameter_backtest_results 
      WHERE strategy_name = ? AND strategy_mode = ?
      ORDER BY created_at DESC LIMIT 1
    `;

    const results = await this.database.query(query, [strategyName, mode]);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * 获取所有回测结果
   * @param {string} strategyName - 策略名称
   * @returns {Promise<Array>} 回测结果列表
   */
  async getAllBacktestResults(strategyName) {
    const query = `
      SELECT * FROM strategy_parameter_backtest_results 
      WHERE strategy_name = ?
      ORDER BY strategy_mode, created_at DESC
    `;

    return await this.database.query(query, [strategyName]);
  }

  // 辅助方法（简化实现）
  checkOrderBlockSignal(klines, index, params) { return null; }
  checkSweepSignal(klines, index, params) { return null; }
  checkEngulfingSignal(klines, index, params) { return null; }
  checkTrendSignal(klines, index, params) { return null; }
  checkFactorSignal(klines, index, params) { return null; }
  checkEntrySignal(klines, index, params) { return null; }
  checkICTExitSignal(klines, index, position, params, mode) { return null; }
  checkV3ExitSignal(klines, index, position, params, mode) { return null; }

  calculatePositionSize(confidence, mode) {
    const baseSize = 1000; // 基础仓位
    const multiplier = mode === 'AGGRESSIVE' ? 1.5 : mode === 'CONSERVATIVE' ? 0.5 : 1.0;
    return baseSize * multiplier * confidence;
  }

  closePosition(position, exitPrice, reason) {
    const pnl = position.type === 'LONG'
      ? (exitPrice - position.entryPrice) * position.quantity
      : (position.entryPrice - exitPrice) * position.quantity;

    const durationHours = (new Date() - position.entryTime) / (1000 * 60 * 60);

    return {
      ...position,
      exitTime: new Date(),
      exitPrice,
      pnl,
      durationHours,
      exitReason: reason,
      fees: Math.abs(pnl) * 0.001 // 0.1% 手续费
    };
  }
}

module.exports = BacktestManager;
