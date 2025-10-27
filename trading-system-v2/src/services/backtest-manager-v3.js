/**
 * 策略参数化回测管理器 V3
 * 严谨的回测系统，直接调用Dashboard正在运行的ICT和V3策略逻辑
 */

const logger = require('../utils/logger');
const BacktestStrategyEngineV3 = require('./backtest-strategy-engine-v3');
const MockBinanceAPI = require('./mock-binance-api');

class BacktestManagerV3 {
  constructor(database) {
    console.log('[回测管理器V3] 构造函数被调用');
    logger.info('[回测管理器V3] 构造函数被调用');
    this.database = database;
    this.cache = new Map(); // 缓存回测结果
    this.runningTasks = new Map(); // 运行中的任务
    console.log('[回测管理器V3] 初始化完成');
    logger.info('[回测管理器V3] 初始化完成');
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
      console.log(`[回测管理器V3] 启动${strategyName}-${mode}回测任务: ${taskId}`);
      logger.info(`[回测管理器V3] 启动${strategyName}-${mode}回测任务: ${taskId}`);

      // 检查是否已有运行中的任务
      if (this.runningTasks.has(taskId)) {
        throw new Error('该策略模式已有运行中的回测任务');
      }

      // 标记任务为运行中
      this.runningTasks.set(taskId, {
        taskId,
        strategyName,
        mode,
        startTime: new Date(),
        status: 'RUNNING'
      });

      // 异步执行回测
      console.log(`[回测管理器V3] 开始异步执行回测任务${taskId}`);
      logger.info(`[回测管理器V3] 开始异步执行回测任务${taskId}`);
      process.stderr.write(`[回测管理器V3] 强制输出: 开始异步执行回测任务${taskId}\n`);

      // 检查executeBacktest方法是否存在
      if (typeof this.executeBacktest !== 'function') {
        console.error(`[回测管理器V3] executeBacktest方法不存在!`);
        logger.error(`[回测管理器V3] executeBacktest方法不存在!`);
        process.stderr.write(`[回测管理器V3] 强制输出: executeBacktest方法不存在!\n`);
        this.runningTasks.delete(taskId);
        return {
          success: false,
          error: 'executeBacktest方法不存在'
        };
      }

      console.log(`[回测管理器V3] executeBacktest方法存在，开始调用`);
      logger.info(`[回测管理器V3] executeBacktest方法存在，开始调用`);
      process.stderr.write(`[回测管理器V3] 强制输出: executeBacktest方法存在，开始调用\n`);

      this.executeBacktest(taskId, strategyName, mode, options)
        .then(() => {
          console.log(`[回测管理器V3] 回测任务${taskId}执行完成`);
          logger.info(`[回测管理器V3] 回测任务${taskId}执行完成`);
          process.stderr.write(`[回测管理器V3] 强制输出: 回测任务${taskId}执行完成\n`);
        })
        .catch(error => {
          console.error(`[回测管理器V3] 回测任务${taskId}执行失败:`, error);
          logger.error(`[回测管理器V3] 回测任务${taskId}执行失败:`, error);
          process.stderr.write(`[回测管理器V3] 强制输出: 回测任务${taskId}执行失败: ${error.message}\n`);
          this.runningTasks.delete(taskId);
        });

      return {
        success: true,
        taskId,
        message: '回测任务已启动'
      };

    } catch (error) {
      console.error(`[回测管理器V3] 启动回测失败:`, error);
      logger.error(`[回测管理器V3] 启动回测失败:`, error);
      this.runningTasks.delete(taskId);
      throw error;
    }
  }

  /**
   * 执行回测逻辑
   * @param {string} taskId - 任务ID
   * @param {string} strategyName - 策略名称
   * @param {string} mode - 策略模式
   * @param {Object} options - 回测选项
   */
  async executeBacktest(taskId, strategyName, mode, options) {
    try {
      console.log(`[回测管理器V3] 开始执行回测任务${taskId}`);
      logger.info(`[回测管理器V3] 开始执行回测任务${taskId}`);

      // 强制输出到stderr测试
      process.stderr.write(`[回测管理器V3] 强制输出测试: 开始执行回测任务${taskId}\n`);

      // 检查任务是否在运行中
      if (!this.runningTasks.has(taskId)) {
        console.error(`[回测管理器V3] 任务${taskId}不在运行中，可能已被删除`);
        logger.error(`[回测管理器V3] 任务${taskId}不在运行中，可能已被删除`);
        process.stderr.write(`[回测管理器V3] 强制输出测试: 任务${taskId}不在运行中\n`);
        return;
      }

      console.log(`[回测管理器V3] 任务${taskId}状态确认，继续执行`);
      logger.info(`[回测管理器V3] 任务${taskId}状态确认，继续执行`);
      process.stderr.write(`[回测管理器V3] 强制输出测试: 任务${taskId}状态确认，继续执行\n`);

      // 1. 获取市场数据
      const timeframe = options.timeframe || '15m';
      console.log(`[回测管理器V3] 开始获取市场数据，时间框架: ${timeframe}`);
      logger.info(`[回测管理器V3] 开始获取市场数据，时间框架: ${timeframe}`);
      process.stderr.write(`[回测管理器V3] 强制输出: 开始获取市场数据，时间框架: ${timeframe}\n`);

      const marketData = await this.fetchMarketData(options.symbols || this.getDefaultSymbols(), timeframe);
      console.log(`[回测管理器V3] 市场数据获取完成，交易对数量: ${Object.keys(marketData).length}`);
      logger.info(`[回测管理器V3] 市场数据获取完成，交易对数量: ${Object.keys(marketData).length}`);
      process.stderr.write(`[回测管理器V3] 强制输出: 市场数据获取完成，交易对数量: ${Object.keys(marketData).length}\n`);

      // 2. 准备Mock Binance API（提供历史数据给策略）
      console.log(`[回测管理器V3] 创建Mock Binance API`);
      logger.info(`[回测管理器V3] 创建Mock Binance API`);
      process.stderr.write(`[回测管理器V3] 强制输出: 创建Mock Binance API\n`);
      const mockBinanceAPI = this.createMockBinanceAPI(marketData, timeframe);
      console.log(`[回测管理器V3] Mock Binance API创建完成`);
      logger.info(`[回测管理器V3] Mock Binance API创建完成`);
      process.stderr.write(`[回测管理器V3] 强制输出: Mock Binance API创建完成\n`);

      // 3. 获取策略参数
      console.log(`[回测管理器V3] 开始获取${strategyName}-${mode}参数`);
      logger.info(`[回测管理器V3] 开始获取${strategyName}-${mode}参数`);
      process.stderr.write(`[回测管理器V3] 强制输出: 开始获取${strategyName}-${mode}参数\n`);
      const strategyParams = await this.getStrategyParameters(strategyName, mode);
      console.log(`[回测管理器V3] 获取${strategyName}-${mode}参数完成:`, Object.keys(strategyParams));
      logger.info(`[回测管理器V3] 获取${strategyName}-${mode}参数完成:`, Object.keys(strategyParams));
      process.stderr.write(`[回测管理器V3] 强制输出: 获取${strategyName}-${mode}参数完成，参数数量: ${Object.keys(strategyParams).length}\n`);

      // 详细输出关键参数值
      const keyParams = ['trend4HStrongThreshold', 'trend4HModerateThreshold', 'trend4HWeakThreshold', 'entry15MStrongThreshold', 'entry15MModerateThreshold', 'entry15MWeakThreshold'];
      keyParams.forEach(param => {
        if (strategyParams[param] !== undefined) {
          console.log(`[回测管理器V3] ${strategyName}-${mode} ${param}: ${strategyParams[param]}`);
          logger.info(`[回测管理器V3] ${strategyName}-${mode} ${param}: ${strategyParams[param]}`);
        }
      });

      // 4. 创建回测引擎（使用Mock Binance API）
      console.log(`[回测管理器V3] 创建回测引擎`);
      logger.info(`[回测管理器V3] 创建回测引擎`);
      process.stderr.write(`[回测管理器V3] 强制输出: 创建回测引擎\n`);
      const strategyEngine = new BacktestStrategyEngineV3();

      // 注入Mock Binance API到回测引擎
      strategyEngine.mockBinanceAPI = mockBinanceAPI;
      strategyEngine.ictStrategy.binanceAPI = mockBinanceAPI;
      strategyEngine.v3Strategy.binanceAPI = mockBinanceAPI;
      console.log(`[回测管理器V3] Mock Binance API注入完成`);
      logger.info(`[回测管理器V3] Mock Binance API注入完成`);
      process.stderr.write(`[回测管理器V3] 强制输出: Mock Binance API注入完成\n`);

      // 5. 执行策略回测
      console.log(`[回测管理器V3] 开始执行策略回测，时间框架: ${timeframe}`);
      logger.info(`[回测管理器V3] 开始执行策略回测，时间框架: ${timeframe}`);
      process.stderr.write(`[回测管理器V3] 强制输出: 开始执行策略回测，时间框架: ${timeframe}\n`);
      const backtestResult = await strategyEngine.runStrategyBacktest(strategyName, mode, strategyParams, marketData, timeframe);
      console.log(`[回测管理器V3] 策略回测执行完成，结果:`, backtestResult ? '有结果' : '无结果');
      logger.info(`[回测管理器V3] 策略回测执行完成，结果:`, backtestResult ? '有结果' : '无结果');
      process.stderr.write(`[回测管理器V3] 强制输出: 策略回测执行完成，结果: ${backtestResult ? '有结果' : '无结果'}\n`);

      // 6. 保存回测结果
      console.log(`[回测管理器V3] 保存回测结果`);
      logger.info(`[回测管理器V3] 保存回测结果`);
      process.stderr.write(`[回测管理器V3] 强制输出: 保存回测结果\n`);
      await this.saveBacktestResult(taskId, strategyName, mode, backtestResult);
      console.log(`[回测管理器V3] 回测结果保存完成`);
      logger.info(`[回测管理器V3] 回测结果保存完成`);
      process.stderr.write(`[回测管理器V3] 强制输出: 回测结果保存完成\n`);

      // 6. 清理缓存
      this.cache.delete(`${strategyName}-${mode}`);

      console.log(`[回测管理器V3] 回测任务${taskId}完成`);
      logger.info(`[回测管理器V3] 回测任务${taskId}完成`);

      // 清理资源，避免内存泄漏
      this.cleanupResources();

    } catch (error) {
      console.error(`[回测管理器V3] 回测任务${taskId}执行失败:`, error);
      logger.error(`[回测管理器V3] 回测任务${taskId}执行失败:`, error);
      // 在catch中删除任务，避免重复删除
      this.runningTasks.delete(taskId);
      throw error;
    }
  }

  /**
   * 创建Mock Binance API
   * @param {Object} marketData - 市场数据 { symbol: { '1h': [klines], '5m': [klines] } }
   * @param {string} timeframe - 时间框架
   * @returns {MockBinanceAPI} Mock Binance API实例
   */
  createMockBinanceAPI(marketData, timeframe) {
    const historicalData = {};

    for (const [symbol, data] of Object.entries(marketData)) {
      // marketData现在包含多个时间框架的数据
      const hourlyData = data['1h'] || [];
      const fifteenMinData = data['15m'] || [];
      const fiveMinData = data['5m'] || [];

      // 为所有时间框架提供数据
      // ICT策略需要1d, 4h, 15m，V3策略需要1h, 15m
      historicalData[symbol] = {
        '1h': hourlyData.length > 0 ? hourlyData : fifteenMinData, // 优先使用1h，fallback到15m
        '15m': fifteenMinData.length > 0 ? fifteenMinData : fiveMinData, // 优先使用15m，fallback到5m
        '5m': fiveMinData.length > 0 ? fiveMinData : fifteenMinData, // 优先使用5m，fallback到15m
        '1d': hourlyData.length > 0 ? hourlyData : fifteenMinData, // 使用1h模拟1d，fallback到15m
        '4h': hourlyData.length > 0 ? hourlyData : fifteenMinData, // 使用1h模拟4h，fallback到15m
      };

      const dataSummary = [
        `1h=${hourlyData.length}`,
        `15m=${fifteenMinData.length}`,
        `5m=${fiveMinData.length}`
      ].join(', ');
      logger.info(`[回测管理器V3] ${symbol}: ${dataSummary}`);
    }

    logger.info(`[回测管理器V3] 创建Mock Binance API，基础时间框架: ${timeframe}, 交易对: ${Object.keys(historicalData).join(', ')}`);
    return new MockBinanceAPI(historicalData);
  }

  /**
   * 获取市场数据
   * @param {Array<string>} symbols - 交易对列表
   * @param {string} timeframe - 时间框架 (1h, 5m)
   * @returns {Promise<Object>} 市场数据 { symbol: { '1h': [klines], '5m': [klines] } }
   */
  async fetchMarketData(symbols, timeframe = '15m') {
    const marketData = {};

    try {
      console.log(`[回测管理器V3] 开始获取回测历史数据，交易对: ${symbols.join(', ')}, 时间框架: ${timeframe}`);
      logger.info(`[回测管理器V3] 开始获取回测历史数据，交易对: ${symbols.join(', ')}, 时间框架: ${timeframe}`);

      // 为ICT策略需要获取多个时间框架的数据
      const timeframesNeeded = ['15m', '1h', '5m']; // 需要这三个时间框架（5m用于模拟15m）

      const dataPromises = symbols.map(async symbol => {
        const symbolData = {};

        for (const tf of timeframesNeeded) {
          console.log(`[回测管理器V3] 开始获取${symbol}的${tf}回测数据`);
          const timedData = await this.fetchBacktestData(symbol, tf);
          console.log(`[回测管理器V3] ${symbol}的${tf}数据获取完成 - 共${timedData?.length || 0}条`);
          if (timedData && timedData.length > 0) {
            symbolData[tf] = timedData;
          }
        }

        return { symbol, symbolData };
      });

      const results = await Promise.all(dataPromises);
      console.log(`[回测管理器V3] 所有交易对数据获取完成，共${results.length}个结果`);

      results.forEach(({ symbol, symbolData }) => {
        if (symbolData && Object.keys(symbolData).length > 0) {
          marketData[symbol] = symbolData;
          const dataSummary = Object.entries(symbolData).map(([tf, data]) => `${tf}=${data.length}`).join(', ');
          console.log(`[回测管理器V3] ${symbol}: ${dataSummary}`);
          logger.info(`[回测管理器V3] ${symbol}: ${dataSummary}`);
        } else {
          console.warn(`[回测管理器V3] ${symbol}: 没有足够的回测数据`);
          logger.warn(`[回测管理器V3] ${symbol}: 没有足够的回测数据`);
        }
      });

      console.log(`[回测管理器V3] 成功获取${Object.keys(marketData).length}个交易对的回测数据`);
      logger.info(`[回测管理器V3] 成功获取${Object.keys(marketData).length}个交易对的回测数据`);
      return marketData;

    } catch (error) {
      logger.error(`[回测管理器V3] 获取回测市场数据失败:`, error);
      throw error;
    }
  }

  /**
   * 获取回测历史数据
   * @param {string} symbol - 交易对
   * @param {string} timeframe - 时间框架 (1h, 5m)
   * @returns {Promise<Array>} K线数据
   */
  async fetchBacktestData(symbol, timeframe = '15m') {
    try {
      logger.info(`[回测管理器V3] 开始获取${symbol}的${timeframe}回测数据`);

      // 检查缓存
      const cacheKey = `backtest-${symbol}-${timeframe}`;
      if (this.cache.has(cacheKey)) {
        const cachedData = this.cache.get(cacheKey);
        logger.info(`[回测管理器V3] ${symbol}使用缓存回测数据: ${cachedData.length}条`);
        return cachedData;
      }

      // 从数据库获取回测历史数据
      logger.info(`[回测管理器V3] ${symbol}缓存未命中，从数据库获取回测数据`);
      const klines = await this.getBacktestMarketData(symbol, timeframe);

      // 如果数据库没有足够数据，记录警告
      if (!klines || klines.length < 100) {
        logger.warn(`[回测管理器V3] ${symbol}回测数据不足(${klines ? klines.length : 0}条)`);
        return [];
      }

      if (klines && klines.length > 0) {
        this.cache.set(cacheKey, klines);
        logger.info(`[回测管理器V3] 从数据库获取${symbol}的${klines.length}条回测数据`);
        return klines;
      }

      return [];

    } catch (error) {
      logger.error(`[回测管理器V3] 获取${symbol}回测数据失败:`, error);
      return [];
    }
  }

  /**
   * 获取单个交易对的数据
   * @param {string} symbol - 交易对
   * @param {string} timeframe - 时间框架 (1h, 5m)
   * @returns {Promise<Array>} K线数据
   */
  async fetchSymbolData(symbol, timeframe = '15m') {
    try {
      logger.info(`[回测管理器V3] 开始获取${symbol}的${timeframe}数据`);

      // 检查缓存
      const cacheKey = `market-${symbol}-${timeframe}`;
      if (this.cache.has(cacheKey)) {
        logger.info(`[回测管理器V3] ${symbol}使用缓存数据`);
        return this.cache.get(cacheKey);
      }

      // 从数据库获取历史数据
      logger.info(`[回测管理器V3] ${symbol}缓存未命中，从数据库获取`);
      let klines = await this.getCachedMarketData(symbol, timeframe);

      // 如果数据库没有足够数据，记录警告
      if (!klines || klines.length < 100) {
        logger.warn(`[回测管理器V3] ${symbol}数据库数据不足(${klines ? klines.length : 0}条)`);
        return null;
      }

      if (klines && klines.length > 0) {
        this.cache.set(cacheKey, klines);
        logger.info(`[回测管理器V3] 从数据库获取${symbol}的${klines.length}条数据`);
        return klines;
      }

      return null;

    } catch (error) {
      logger.error(`[回测管理器V3] 获取${symbol}数据失败:`, error);
      return null;
    }
  }

  /**
   * 从数据库获取回测市场数据
   * @param {string} symbol - 交易对
   * @param {string} timeframe - 时间框架 (1h, 5m)
   * @returns {Promise<Array>} K线数据
   */
  async getBacktestMarketData(symbol, timeframe = '15m') {
    try {
      logger.info(`[回测管理器V3] 从数据库获取${symbol}的${timeframe}回测数据`);

      const query = `
        SELECT open_time, close_time, open_price, high_price, low_price, close_price, volume, quote_volume
        FROM backtest_market_data
        WHERE symbol = ? AND timeframe = ?
        ORDER BY open_time ASC
        LIMIT 10000
      `;

      const rows = await this.database.pool.query(query, [symbol, timeframe]);
      logger.info(`[回测管理器V3] 查询到${rows.length}条${symbol}-${timeframe}回测数据`);

      if (rows.length === 0) {
        logger.warn(`[回测管理器V3] ${symbol}-${timeframe}没有回测数据`);
        return [];
      }

      // 转换数据格式为Binance API格式
      const klines = rows.map(row => {
        // 处理时间戳：如果是Date对象则调用getTime()，如果是字符串则转换为时间戳
        const openTime = row.open_time instanceof Date
          ? row.open_time.getTime()
          : new Date(row.open_time).getTime();
        const closeTime = row.close_time instanceof Date
          ? row.close_time.getTime()
          : new Date(row.close_time).getTime();

        return [
          openTime,                    // 0: 开盘时间
          parseFloat(row.open_price),  // 1: 开盘价
          parseFloat(row.high_price),  // 2: 最高价
          parseFloat(row.low_price),   // 3: 最低价
          parseFloat(row.close_price), // 4: 收盘价
          parseFloat(row.volume),      // 5: 成交量
          closeTime,                   // 6: 收盘时间
          parseFloat(row.quote_volume), // 7: 成交额
          0,                           // 8: 成交笔数
          0,                           // 9: 主动买入成交量
          0                            // 10: 主动买入成交额
        ];
      });

      logger.info(`[回测管理器V3] 成功转换${klines.length}条${symbol}-${timeframe}回测数据`);
      return klines;

    } catch (error) {
      logger.error(`[回测管理器V3] 从数据库获取${symbol}回测数据失败:`, error);
      return [];
    }
  }

  /**
   * 从数据库获取缓存的市场数据
   * @param {string} symbol - 交易对
   * @param {string} timeframe - 时间框架 (1h, 5m)
   * @returns {Promise<Array>} K线数据
   */
  async getCachedMarketData(symbol, timeframe = '15m') {
    try {
      logger.info(`[回测管理器V3] 从数据库获取${symbol}的${timeframe}缓存数据`);

      const query = `
        SELECT open_time, close_time, open_price, high_price, low_price, close_price, volume, quote_volume
        FROM backtest_market_data
        WHERE symbol = ? AND timeframe = ?
        ORDER BY open_time DESC
      `;

      const rows = await this.database.pool.query(query, [symbol, timeframe]);
      logger.info(`[回测管理器V3] 查询到${rows.length}条${symbol}-${timeframe}数据`);

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
      logger.error(`[回测管理器V3] 从数据库获取${symbol}数据失败:`, error);
      return [];
    }
  }

  /**
   * 保存回测结果
   * @param {number} taskId - 任务ID
   * @param {string} strategyName - 策略名称
   * @param {string} mode - 策略模式
   * @param {Object} result - 回测结果
   */
  async saveBacktestResult(taskId, strategyName, mode, result) {
    try {
      const metrics = result.metrics;

      // 清理NaN和Infinity值
      const cleanValue = (value) => {
        if (value === null || value === undefined) return 0;
        if (typeof value === 'number') {
          if (isNaN(value)) return 0;
          if (!isFinite(value)) return 0;
          return value;
        }
        return value;
      };

      const values = [
        strategyName,
        mode,
        '180天',
        cleanValue(metrics.totalTrades),
        cleanValue(metrics.winningTrades),
        cleanValue(metrics.losingTrades),
        cleanValue(metrics.winRate),
        cleanValue(metrics.totalPnl),
        cleanValue(metrics.avgWin),
        cleanValue(metrics.avgLoss),
        cleanValue(metrics.maxDrawdown),
        cleanValue(metrics.sharpeRatio),
        cleanValue(metrics.profitFactor),
        cleanValue(metrics.avgTradeDuration),
        cleanValue(metrics.maxConsecutiveWins),
        cleanValue(metrics.maxConsecutiveLosses),
        cleanValue(metrics.totalFees),
        cleanValue(metrics.netProfit),
        new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
        new Date(),
        180,
        'COMPLETED'
      ];

      const query = `
        INSERT INTO strategy_parameter_backtest_results
        (strategy_name, strategy_mode, backtest_period, total_trades, winning_trades, losing_trades,
         win_rate, total_pnl, avg_win, avg_loss, max_drawdown, sharpe_ratio, profit_factor,
         avg_trade_duration, max_consecutive_wins, max_consecutive_losses, total_fees, net_profit,
         backtest_start_date, backtest_end_date, total_days, backtest_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.database.pool.query(query, values);

      logger.info(`[回测管理器V3] 回测结果已保存: ${strategyName}-${mode}`);
    } catch (error) {
      logger.error(`[回测管理器V3] 保存回测结果失败:`, error);
      throw error;
    }
  }

  /**
   * 获取运行中的任务状态
   * @returns {Object} 运行中的任务信息
   */
  getRunningTasksStatus() {
    const runningTasks = Array.from(this.runningTasks.values());
    console.log(`[回测管理器V3] 当前运行中的任务数量: ${runningTasks.length}`);
    logger.info(`[回测管理器V3] 当前运行中的任务数量: ${runningTasks.length}`);
    return {
      count: runningTasks.length,
      tasks: runningTasks
    };
  }

  /**
   * 清理资源，避免内存泄漏
   */
  cleanupResources() {
    try {
      // 强制垃圾回收
      if (global.gc) {
        global.gc();
        logger.info('[回测管理器V3] 执行垃圾回收');
      }

      // 清理缓存
      this.cache.clear();

      logger.info('[回测管理器V3] 资源清理完成');
    } catch (error) {
      logger.error('[回测管理器V3] 资源清理失败:', error);
    }
  }

  /**
   * 获取所有回测结果
   * @param {string} strategy - 策略名称
   * @returns {Promise<Array>} 回测结果列表
   */
  async getAllBacktestResults(strategy) {
    try {
      const query = `
        SELECT * FROM strategy_parameter_backtest_results
        WHERE strategy_name = ?
        ORDER BY created_at DESC
      `;

      const rows = await this.database.pool.query(query, [strategy]);
      logger.info(`[回测管理器V3] 获取到${rows.length}条${strategy}回测结果`);

      return rows;
    } catch (error) {
      logger.error(`[回测管理器V3] 获取回测结果失败:`, error);
      throw error;
    }
  }

  /**
   * 获取默认交易对列表
   * @returns {Array<string>} 交易对列表
   */
  getDefaultSymbols() {
    return ['BTCUSDT', 'ETHUSDT'];
  }

  /**
   * 获取策略参数
   * @param {string} strategyName - 策略名称
   * @param {string} mode - 策略模式
   * @returns {Promise<Object>} 策略参数
   */
  async getStrategyParameters(strategyName, mode) {
    try {
      console.log(`[回测管理器V3] 开始获取${strategyName}-${mode}参数`);
      logger.info(`[回测管理器V3] 开始获取${strategyName}-${mode}参数`);

      // ✅ 优先使用正在运行的策略参数 (is_active = 1)，查询category字段
      let query = `
        SELECT param_name, param_value, category, param_group, param_type
        FROM strategy_params
        WHERE strategy_name = ? AND strategy_mode = ? AND is_active = 1
      `;
      let rows = await this.database.pool.query(query, [strategyName, mode]);
      console.log(`[回测管理器V3] 查询正在运行的参数: ${strategyName}-${mode}, 结果数量: ${rows.length}`);

      // 如果没有正在运行的参数，则使用回测参数 (is_active = 0)
      if (rows.length === 0) {
        query = `
          SELECT param_name, param_value, category, param_group, param_type
          FROM strategy_params
          WHERE strategy_name = ? AND strategy_mode = ? AND is_active = 0
        `;
        rows = await this.database.pool.query(query, [strategyName, mode]);
        console.log(`[回测管理器V3] 使用回测参数: ${strategyName}-${mode}, 结果数量: ${rows.length}`);
        logger.info(`[回测管理器V3] 使用回测参数: ${strategyName}-${mode}`);
      } else {
        console.log(`[回测管理器V3] 使用正在运行的参数: ${strategyName}-${mode}, 结果数量: ${rows.length}`);
        logger.info(`[回测管理器V3] 使用正在运行的参数: ${strategyName}-${mode}`);
      }

      // ✅ 组织成嵌套结构（与StrategyParameterLoader保持一致）
      const params = {};
      rows.forEach(row => {
        // 优先使用category，fallback到param_group
        const group = row.category || row.param_group || 'general';

        // 转换参数值类型
        let value = row.param_value;
        switch (row.param_type) {
          case 'number':
            value = parseFloat(value);
            break;
          case 'boolean':
            value = value === '1' || value === 'true' || value === true;
            break;
          case 'json':
            try {
              value = JSON.parse(value);
            } catch (e) {
              logger.warn(`[回测管理器V3] 解析JSON失败: ${row.param_name}`, e);
            }
            break;
          default:
            // string类型保持原样，但尝试转换number
            if (value === 'true') value = true;
            else if (value === 'false') value = false;
            else if (!isNaN(value) && value !== '') value = parseFloat(value);
        }

        // 创建嵌套结构
        if (!params[group]) {
          params[group] = {};
        }
        params[group][row.param_name] = value;
      });

      logger.info(`[回测管理器V3] 获取${strategyName}-${mode}参数:`, Object.keys(params));
      return params;
    } catch (error) {
      logger.error(`[回测管理器V3] 获取策略参数失败:`, error);
      return {};
    }
  }
}

module.exports = BacktestManagerV3;

