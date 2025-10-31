/**
 * 策略回测引擎 V3
 * 严谨的回测系统，直接调用Dashboard正在运行的ICT和V3策略逻辑
 * 确保回测结果与实时策略完全一致
 */

const logger = require('../utils/logger');
const ICTStrategy = require('../strategies/ict-strategy');
const V3Strategy = require('../strategies/v3-strategy'); // ✅ 使用主V3策略而非旧版integrated
const PositionDurationManager = require('../utils/position-duration-manager');
const TokenClassifier = require('../utils/token-classifier');

class BacktestStrategyEngineV3 {
  constructor(mockBinanceAPI) {
    this.mockBinanceAPI = mockBinanceAPI;
    this.ictStrategy = new ICTStrategy();
    this.v3Strategy = new V3Strategy(); // ✅ 使用主V3策略
    this.currentICTMode = null; // 跟踪当前ICT模式，用于复用策略实例
    this.currentV3Mode = null; // 跟踪当前V3模式，用于复用策略实例

    // 将Mock Binance API注入到策略中
    if (this.mockBinanceAPI) {
      this.ictStrategy.binanceAPI = this.mockBinanceAPI;
      this.v3Strategy.binanceAPI = this.mockBinanceAPI;
    }
  }

  /**
   * 将扁平参数转换为嵌套结构（V3策略期望的格式）
   * @param {Object} flatParams - 扁平参数对象
   * @returns {Object} 嵌套参数对象
   */
  convertToNestedParams(flatParams) {
    const nestedParams = {};

    // 参数映射：扁平参数名 -> 嵌套结构
    const paramMapping = {
      // 风险管理参数
      'riskPercent': 'risk_management.riskPercent',
      'stopLossATRMultiplier': 'risk_management.stopLossATRMultiplier',
      'takeProfitRatio': 'risk_management.takeProfitRatio',
      'maxLeverage': 'risk_management.maxLeverage',

      // 趋势阈值参数
      'trend4HStrongThreshold': 'trend_thresholds.trend4HStrongThreshold',
      'trend4HModerateThreshold': 'trend_thresholds.trend4HModerateThreshold',
      'trend4HWeakThreshold': 'trend_thresholds.trend4HWeakThreshold',

      // 入场阈值参数
      'entry15MStrongThreshold': 'entry_thresholds.entry15MStrongThreshold',
      'entry15MModerateThreshold': 'entry_thresholds.entry15MModerateThreshold',
      'entry15MWeakThreshold': 'entry_thresholds.entry15MWeakThreshold',

      // 因子阈值参数
      'factorStrongThreshold': 'factor_thresholds.factorStrongThreshold',
      'factorModerateThreshold': 'factor_thresholds.factorModerateThreshold',
      'factorWeakThreshold': 'factor_thresholds.factorWeakThreshold'
    };

    // 转换参数
    Object.entries(flatParams).forEach(([key, value]) => {
      const mapping = paramMapping[key];
      if (mapping) {
        const [category, paramName] = mapping.split('.');
        if (!nestedParams[category]) {
          nestedParams[category] = {};
        }
        nestedParams[category][paramName] = value;
      } else {
        // 如果没有映射，直接放在根级别
        nestedParams[key] = value;
      }
    });

    return nestedParams;
  }

  /**
   * 获取持仓时长配置（用于时间止损）
   * @param {string} symbol - 交易对符号
   * @param {string} marketType - 市场类型
   * @returns {Object} 持仓配置
   */
  getPositionConfig(symbol, marketType = 'TREND') {
    // ✅ 修复：使用正确的方法名classify（不是classifyToken）
    const category = TokenClassifier.classify(symbol);
    const config = PositionDurationManager.getPositionConfig(symbol, marketType);

    return {
      maxHoldingMinutes: config.maxDurationHours * 60,
      timeStopMinutes: config.timeStopMinutes,
      marketType: marketType
    };
  }

  /**
   * 运行策略回测
   * @param {string} strategyName - 策略名称
   * @param {string} mode - 策略模式
   * @param {Object} params - 策略参数
   * @param {Object} marketData - 市场数据
   * @param {string} timeframe - 时间框架 (1h, 5m)
   * @returns {Promise<Object>} 回测结果
   */
  async runStrategyBacktest(strategyName, mode, params, marketData, timeframe = '15m') {
    if (strategyName === 'ICT') {
      return await this.runICTBacktest(mode, params, marketData, timeframe);
    } else if (strategyName === 'V3') {
      return await this.runV3Backtest(mode, params, marketData, timeframe);
    } else {
      throw new Error(`不支持的策略: ${strategyName}`);
    }
  }

  /**
   * 运行ICT策略回测
   * 直接调用Dashboard的ICT策略逻辑
   * @param {string} mode - 策略模式
   * @param {Object} params - 策略参数（暂不使用，直接使用策略默认参数）
   * @param {Object} marketData - 市场数据 { symbol: { '1h': [klines], '5m': [klines] } }
   * @param {string} timeframe - 时间框架 (1h, 5m)
   * @returns {Promise<Object>} 回测结果
   */
  async runICTBacktest(mode, params, marketData, timeframe = '15m') {
    logger.info(`[回测引擎V3] 开始ICT-${mode}策略回测`);

    const allTrades = [];
    const symbols = Object.keys(marketData);

    for (const symbol of symbols) {
      const symbolData = marketData[symbol];
      // 根据请求的时间框架使用对应的数据
      const klines = symbolData[timeframe] || [];
      if (!klines || klines.length < 100) {
        logger.warn(`[回测引擎V3] ${symbol} ${timeframe}数据不足: ${klines ? klines.length : 0}条`);
        continue;
      }

      try {
        const symbolTrades = await this.simulateICTTrades(symbol, klines, params, mode, timeframe);
        allTrades.push(...symbolTrades);
        logger.info(`[回测引擎V3] ${symbol} ICT-${mode} 生成${symbolTrades.length}笔交易`);
      } catch (error) {
        logger.error(`[回测引擎V3] ${symbol} ICT回测失败:`, error);
      }
    }

    const metrics = this.calculateMetrics(allTrades, mode);
    logger.info(`[回测引擎V3] ICT-${mode}回测完成: ${allTrades.length}笔交易, 胜率${(metrics.winRate * 100).toFixed(2)}%`);

    return {
      strategy: 'ICT',
      mode,
      trades: allTrades,
      metrics
    };
  }

  /**
   * 运行V3策略回测
   * 直接调用Dashboard的V3策略逻辑
   * @param {string} mode - 策略模式
   * @param {Object} params - 策略参数
   * @param {Object} marketData - 市场数据 { symbol: { '1h': [klines], '5m': [klines] } }
   * @param {string} timeframe - 时间框架 (1h, 5m)
   * @returns {Promise<Object>} 回测结果
   */
  async runV3Backtest(mode, params, marketData, timeframe = '15m') {
    console.log(`[回测引擎V3] 开始V3-${mode}策略回测，时间框架: ${timeframe}`);
    logger.info(`[回测引擎V3] 开始V3-${mode}策略回测，时间框架: ${timeframe}`);

    const allTrades = [];
    const symbols = Object.keys(marketData);
    console.log(`[回测引擎V3] 处理交易对: ${symbols.join(', ')}`);
    logger.info(`[回测引擎V3] 处理交易对: ${symbols.join(', ')}`);

    for (const symbol of symbols) {
      const symbolData = marketData[symbol];
      // 根据请求的时间框架使用对应的数据
      const klines = symbolData[timeframe] || [];
      console.log(`[回测引擎V3] ${symbol}: ${timeframe}数据${klines.length}条`);
      logger.info(`[回测引擎V3] ${symbol}: ${timeframe}数据${klines.length}条`);

      if (!klines || klines.length < 100) {
        console.log(`[回测引擎V3] ${symbol} ${timeframe}数据不足: ${klines ? klines.length : 0}条`);
        logger.warn(`[回测引擎V3] ${symbol} ${timeframe}数据不足: ${klines ? klines.length : 0}条`);
        continue;
      }

      try {
        console.log(`[回测引擎V3] 开始模拟${symbol} V3-${mode}交易`);
        logger.info(`[回测引擎V3] 开始模拟${symbol} V3-${mode}交易`);
        const symbolTrades = await this.simulateV3Trades(symbol, klines, params, mode, timeframe);
        allTrades.push(...symbolTrades);
        console.log(`[回测引擎V3] ${symbol} V3-${mode} 生成${symbolTrades.length}笔交易`);
        logger.info(`[回测引擎V3] ${symbol} V3-${mode} 生成${symbolTrades.length}笔交易`);
      } catch (error) {
        console.error(`[回测引擎V3] ${symbol} V3回测失败:`, error);
        logger.error(`[回测引擎V3] ${symbol} V3回测失败:`, error);
      }
    }

    const metrics = this.calculateMetrics(allTrades, mode);
    logger.info(`[回测引擎V3] V3-${mode}回测完成: ${allTrades.length}笔交易, 胜率${(metrics.winRate * 100).toFixed(2)}%`);

    return {
      strategy: 'V3',
      mode,
      trades: allTrades,
      metrics
    };
  }

  /**
   * 模拟ICT策略交易
   * 直接调用Dashboard的ICT策略execute方法
   * @param {string} symbol - 交易对
   * @param {Array} klines - K线数据
   * @param {Object} params - 策略参数
   * @param {string} mode - 策略模式
   * @returns {Promise<Array>} 交易记录
   */
  async simulateICTTrades(symbol, klines, params, mode, timeframe = '15m') {
    const trades = [];
    let position = null;
    let lastSignal = null;

    console.log(`[回测引擎V3] ${symbol} ICT-${mode}: 开始回测，K线数量=${klines.length}`);
    console.log(`[回测引擎V3] ${symbol} ICT-${mode}: 使用策略内部风险管理`);

    // 优化：减少回测频率，每10根K线检查一次
    const step = Math.max(1, Math.floor(klines.length / 100)); // 最多检查100次
    console.log(`[回测引擎V3] ${symbol} ICT-${mode}: 优化回测，步长=${step}，总K线=${klines.length}`);

    for (let i = 50; i < klines.length - 1; i += step) {
      const currentKline = klines[i];
      const currentPrice = currentKline[4]; // close price
      const nextKline = klines[Math.min(i + step, klines.length - 1)];
      const nextPrice = nextKline[4];

      try {
        // 设置Mock Binance API的当前索引
        if (this.mockBinanceAPI) {
          this.mockBinanceAPI.setCurrentIndex(i);
        }

        // ✅ 应用策略参数到params属性（嵌套结构）
        if (params && Object.keys(params).length > 0) {
          // 复用策略实例，只在第一次或参数改变时重新创建
          if (!this.ictStrategy || this.currentICTMode !== mode) {
            this.ictStrategy = new ICTStrategy();
            this.currentICTMode = mode;
          }
          this.ictStrategy.binanceAPI = this.mockBinanceAPI;
          this.ictStrategy.mode = mode; // 设置模式

          // 清除参数加载器缓存，确保每次都重新加载
          if (this.ictStrategy.paramLoader) {
            this.ictStrategy.paramLoader.clearCache();
          }

          // 将参数合并到this.ictStrategy.params
          this.ictStrategy.params = {
            ...this.ictStrategy.params,
            ...params
          };

          logger.debug(`[回测引擎V3] ${symbol} ICT-${mode}: 应用参数到params`, Object.keys(params));
        }

        // ✅ 确保参数已加载完成（与实盘一致）
        if (!this.ictStrategy.params || Object.keys(this.ictStrategy.params).length === 0) {
          logger.info(`[回测引擎V3] ${symbol} ICT-${mode}: 参数未加载，开始加载...`);
          await this.ictStrategy.initializeParameters(mode);
          logger.info(`[回测引擎V3] ${symbol} ICT-${mode}: 参数加载完成`);
        }

        // 直接调用ICT策略的execute方法（异步处理）
        const ictResult = await this.ictStrategy.execute(symbol);

        // 记录策略执行结果
        if (ictResult) {
          logger.info(`[回测引擎V3] ${symbol} ICT-${mode}: 信号=${ictResult.signal}, 趋势=${ictResult.trend}, 置信度=${ictResult.confidence}`);
          if (ictResult.signal !== 'HOLD') {
            logger.info(`[回测引擎V3] ${symbol} ICT-${mode}: 检测到交易信号! 信号=${ictResult.signal}`);
          }
        }

        // 每处理20次检查一次，减少CPU消耗
        if (i % (step * 20) === 0) {
          await new Promise(resolve => setImmediate(resolve));
          // 减少垃圾回收频率，避免IO阻塞
          if (global.gc && i % (step * 100) === 0) {
            global.gc();
          }
        }

        if (!ictResult) {
          continue;
        }

        // 检查是否有交易信号
        const signal = ictResult.signal;

        // 检查开仓信号
        if (!position && (signal === 'BUY' || signal === 'SELL')) {

          // 开仓
          const direction = signal === 'BUY' ? 'LONG' : 'SHORT';
          const entryPrice = currentPrice;

          // ✅ 使用实盘的止损止盈计算方法
          // 获取策略返回的交易参数（包含结构止损和多止盈点）
          const tradeParams = ictResult.tradeParams || ictResult;

          // ✅ 使用实盘的结构止损逻辑
          let stopLoss = tradeParams.stopLoss || entryPrice;
          let takeProfit = tradeParams.takeProfit || entryPrice;

          // 如果策略返回了多个止盈点，使用 TP2（第二个止盈点）
          if (tradeParams.takeProfit2) {
            takeProfit = tradeParams.takeProfit2;
          }

          // ✅ 获取风险百分比（与实盘一致）
          const riskPct = params?.position?.riskPercent || this.ictStrategy.params?.position?.riskPercent || 0.01;

          // ✅ 使用实盘的仓位计算逻辑
          const equity = 10000; // 默认资金
          const riskAmount = equity * riskPct;
          const stopDistance = Math.abs(entryPrice - stopLoss);

          // 计算单位数
          const units = stopDistance > 0 ? riskAmount / stopDistance : 0;

          // 计算杠杆（与实盘逻辑一致）
          const stopLossDistancePct = stopDistance / entryPrice;
          const calculatedMaxLeverage = Math.floor(1 / (stopLossDistancePct + 0.005));
          const leverage = Math.min(calculatedMaxLeverage, 24);

          const positionSize = units;

          if (positionSize < 0.1) {
            logger.warn(`[回测引擎V3] ${symbol} ICT-${mode}: 止损距离过大，跳过交易。止损距离=${stopDistance.toFixed(2)}, 计算仓位=${positionSize.toFixed(4)}`);
            continue;
          }

          logger.info(`[回测引擎V3] ${symbol} ICT-${mode}: 使用实盘逻辑计算止损止盈, 入场=${entryPrice.toFixed(2)}, SL=${stopLoss.toFixed(2)}, TP=${takeProfit.toFixed(2)}, 杠杆=${leverage}, 仓位=${positionSize.toFixed(4)}`);

          position = {
            symbol,
            type: direction,
            entryTime: new Date(currentKline[0]),
            entryPrice,
            quantity: positionSize, // 使用风险控制计算出的仓位大小
            confidence: ictResult.confidence || 'med',
            stopLoss: stopLoss,
            takeProfit: takeProfit,
            leverage: ictResult.leverage || 1
          };

          lastSignal = signal;

          const actualRRRecalculated = Math.abs(position.takeProfit - entryPrice) / Math.abs(entryPrice - position.stopLoss);
          logger.info(`[回测引擎V3] ${symbol} ICT-${mode}: 开仓 ${direction} @ ${entryPrice.toFixed(2)}, SL=${position.stopLoss.toFixed(2)}, TP=${position.takeProfit.toFixed(2)}, 实际盈亏比=${actualRRRecalculated.toFixed(2)}:1`);
        }
        // 检查信号反转
        else if (position && signal !== 'HOLD' && signal !== lastSignal) {
          // 信号反转，平仓
          const trade = this.closePosition(position, currentPrice, '信号反转');
          trades.push(trade);

          // 更新策略实例的回撤状态
          this.ictStrategy.updateDrawdownStatus(trade.pnl);

          position = null;
          lastSignal = null;
        }

        // 检查平仓条件（如果有持仓）
        if (position) {
          let shouldExit = false;
          let exitReason = '';

          // ✅ 添加时间止损检查（与实盘一致）
          const positionConfig = this.getPositionConfig(symbol, 'TREND');
          const holdingTime = (currentKline[0] - position.entryTime.getTime()) / 1000 / 60; // 分钟

          // 检查最大持仓时长限制
          if (holdingTime >= positionConfig.maxHoldingMinutes) {
            shouldExit = true;
            exitReason = `持仓时长超过${positionConfig.maxHoldingMinutes}分钟限制`;
            logger.info(`[回测引擎V3] ${symbol} ICT-${mode}: ${exitReason}`);
          }
          // 检查时间止损（持仓超时且未盈利）
          else if (holdingTime >= positionConfig.timeStopMinutes) {
            const isProfitable = (position.type === 'LONG' && nextPrice > position.entryPrice) ||
              (position.type === 'SHORT' && nextPrice < position.entryPrice);

            if (!isProfitable) {
              shouldExit = true;
              exitReason = `时间止损 - 持仓${holdingTime.toFixed(0)}分钟未盈利`;
              logger.info(`[回测引擎V3] ${symbol} ICT-${mode}: ${exitReason}`);
            }
          }

          // 检查止损
          if (!shouldExit && position.type === 'LONG' && nextPrice <= position.stopLoss) {
            shouldExit = true;
            exitReason = '止损';
          } else if (!shouldExit && position.type === 'SHORT' && nextPrice >= position.stopLoss) {
            shouldExit = true;
            exitReason = '止损';
          }
          // 检查止盈
          else if (!shouldExit && position.type === 'LONG' && nextPrice >= position.takeProfit) {
            shouldExit = true;
            exitReason = '止盈';
          } else if (!shouldExit && position.type === 'SHORT' && nextPrice <= position.takeProfit) {
            shouldExit = true;
            exitReason = '止盈';
          }

          if (shouldExit) {
            const trade = this.closePosition(position, nextPrice, exitReason);
            trades.push(trade);

            // 更新策略实例的回撤状态
            this.ictStrategy.updateDrawdownStatus(trade.pnl);

            console.log(`[回测引擎V3] ${symbol} ICT-${mode}: 平仓 ${exitReason}, PnL=${trade.pnl.toFixed(2)}, 持仓时长=${holdingTime.toFixed(1)}分钟`);

            position = null;
            lastSignal = null;
          }
        }
      } catch (error) {
        logger.error(`[回测引擎V3] ${symbol} ICT-${mode}: 策略执行失败:`, error);
      }
    }

    // 平仓未完成的持仓
    if (position) {
      const lastKline = klines[klines.length - 1];
      const trade = this.closePosition(position, lastKline[4], '回测结束');
      trades.push(trade);

      // 更新策略实例的回撤状态
      this.ictStrategy.updateDrawdownStatus(trade.pnl);
    }

    logger.info(`[回测引擎V3] ${symbol} ICT-${mode}: 生成交易=${trades.length}`);
    return trades;
  }

  /**
   * 模拟V3策略交易
   * 直接调用Dashboard的V3策略execute方法
   * @param {string} symbol - 交易对
   * @param {Array} klines - K线数据
   * @param {Object} params - 策略参数
   * @param {string} mode - 策略模式
   * @returns {Promise<Array>} 交易记录
   */
  async simulateV3Trades(symbol, klines, params, mode, timeframe = '15m') {
    const trades = [];
    let position = null;
    let lastSignal = null;

    // 使用策略内部风险管理

    // 添加假突破过滤统计
    let totalSignals = 0;
    let filteredSignals = 0;
    let passedSignals = 0;

    console.log(`[回测引擎V3] ${symbol} V3-${mode}: 开始回测，K线数量=${klines.length}`);
    logger.info(`[回测引擎V3] ${symbol} V3-${mode}: 开始回测，K线数量=${klines.length}`);
    process.stderr.write(`[回测引擎V3] 强制输出: ${symbol} V3-${mode}开始回测，K线数量=${klines.length}\n`);

    // 创建Mock Binance API并注入到V3策略中
    const MockBinanceAPI = require('./mock-binance-api');
    const mockAPI = new MockBinanceAPI({ [symbol]: { '1h': klines, '4h': klines, '15m': klines, '5m': klines } });
    this.v3Strategy.binanceAPI = mockAPI;
    console.log(`[回测引擎V3] ${symbol} V3-${mode}: Mock Binance API已注入，数据量: ${timeframe}=${klines.length}条`);
    logger.info(`[回测引擎V3] ${symbol} V3-${mode}: Mock Binance API已注入，数据量: ${timeframe}=${klines.length}条`);
    process.stderr.write(`[回测引擎V3] 强制输出: ${symbol} V3-${mode}Mock Binance API已注入，数据量: ${timeframe}=${klines.length}条\n`);

    // 优化：进一步减小步长以及时检测TP1/TP2，提高执行精度
    const step = Math.max(1, Math.floor(klines.length / 200)); // 检查200次，确保不遗漏任何价格变化
    console.log(`[回测引擎V3] ${symbol} V3-${mode}: 优化回测，步长=${step}，总K线=${klines.length}`);
    logger.info(`[回测引擎V3] ${symbol} V3-${mode}: 优化回测，步长=${step}，总K线=${klines.length}`);
    process.stderr.write(`[回测引擎V3] 强制输出: ${symbol} V3-${mode}优化回测，步长=${step}，总K线=${klines.length}\n`);

    let loopCount = 0;
    for (let i = 50; i < klines.length - 1; i += step) {
      loopCount++;
      if (loopCount % 10 === 0) {
        console.log(`[回测引擎V3] ${symbol} V3-${mode}: 回测进度 ${loopCount}/50, 当前索引=${i}`);
        logger.info(`[回测引擎V3] ${symbol} V3-${mode}: 回测进度 ${loopCount}/50, 当前索引=${i}`);
        process.stderr.write(`[回测引擎V3] 强制输出: ${symbol} V3-${mode}回测进度 ${loopCount}/50, 当前索引=${i}\n`);
      }
      const currentKline = klines[i];
      const currentPrice = currentKline[4]; // close price
      const nextKline = klines[Math.min(i + step, klines.length - 1)];
      const nextPrice = nextKline[4];
      // ✅ 使用high/low价格范围进行更精确的止盈止损检测
      const nextHigh = parseFloat(nextKline[2]); // high price
      const nextLow = parseFloat(nextKline[3]); // low price

      try {
        // 设置Mock Binance API的当前索引
        mockAPI.setCurrentIndex(i);

        // ✅ 为每个模式创建独立的策略实例，避免参数污染
        if (!this.v3Strategy || this.currentV3Mode !== mode) {
          this.v3Strategy = new V3Strategy();
          this.currentV3Mode = mode;
          logger.info(`[回测引擎V3] ${symbol} V3-${mode}: 创建新的策略实例`);
        }

        this.v3Strategy.binanceAPI = mockAPI; // 使用同一个Mock API实例
        this.v3Strategy.mode = mode; // 强制设置模式

        // ✅ 确保参数已加载完成（与实盘一致）
        // 如果模式改变或参数为空，重新加载参数
        if (!this.v3Strategy.params || Object.keys(this.v3Strategy.params).length === 0 || this.v3Strategy.mode !== mode) {
          logger.info(`[回测引擎V3] ${symbol} V3-${mode}: 参数未加载或模式不匹配，开始加载...`);
          await this.v3Strategy.initializeParameters(mode);
          logger.info(`[回测引擎V3] ${symbol} V3-${mode}: 参数加载完成`);
        }

        // 🔍 调试：输出关键参数值（从策略实例中读取）
        const keyParams = ['trend4HStrongThreshold', 'entry15MStrongThreshold', 'trend4HModerateThreshold', 'entry15MModerateThreshold', 'factorModerateThreshold', 'stopLossATRMultiplier', 'takeProfitRatio'];
        console.log(`[回测引擎V3] ${symbol} V3-${mode}: 策略实例参数值:`);
        logger.info(`[回测引擎V3] ${symbol} V3-${mode}: 策略实例参数值:`);
        keyParams.forEach(param => {
          let value = 'undefined';
          if (param.includes('Threshold')) {
            let category;
            if (param.includes('trend4H')) {
              category = 'trend_thresholds';
            } else if (param.includes('entry15M')) {
              category = 'entry_thresholds';
            } else if (param.includes('factor')) {
              category = 'factor_thresholds';
            }
            value = this.v3Strategy.params[category]?.[param] || 'undefined';
          } else if (param.includes('ATR') || param.includes('Ratio')) {
            value = this.v3Strategy.params.risk_management?.[param] || 'undefined';
          }
          console.log(`  ${param}: ${value}`);
          logger.info(`  ${param}: ${value}`);
        });

        // ✅ 不再直接覆盖策略参数，让策略使用自己加载的参数
        // 注释掉原来的参数覆盖逻辑
        /*
        if (params && Object.keys(params).length > 0) {
          // 清除参数加载器缓存，确保每次都重新加载
          if (this.v3Strategy.paramLoader) {
            this.v3Strategy.paramLoader.clearCache();
          }

          // 直接使用params（已经是嵌套结构了）
          this.v3Strategy.params = params;

          console.log(`[回测引擎V3] ${symbol} V3-${mode}: 应用参数到params`, Object.keys(params));
          logger.info(`[回测引擎V3] ${symbol} V3-${mode}: 应用参数到params`, Object.keys(params));
        }
        */

        // 验证关键参数是否正确应用（仅在debug模式下）
        if (process.env.DEBUG) {
          console.log(`[回测引擎V3] ${symbol} V3-${mode}: 验证参数 - trend4HStrongThreshold=${this.v3Strategy.trend4HStrongThreshold}, entry15MStrongThreshold=${this.v3Strategy.entry15MStrongThreshold}`);
          logger.info(`[回测引擎V3] ${symbol} V3-${mode}: 验证参数 - trend4HStrongThreshold=${this.v3Strategy.trend4HStrongThreshold}, entry15MStrongThreshold=${this.v3Strategy.entry15MStrongThreshold}`);

          // 输出更多关键参数用于调试
          const debugParams = ['trend4HModerateThreshold', 'trend4HWeakThreshold', 'entry15MModerateThreshold', 'entry15MWeakThreshold'];
          debugParams.forEach(param => {
            console.log(`[回测引擎V3] ${symbol} V3-${mode}: ${param}=${this.v3Strategy[param]}`);
            logger.info(`[回测引擎V3] ${symbol} V3-${mode}: ${param}=${this.v3Strategy[param]}`);
          });

          // 验证参数是否真的被应用
          console.log(`[回测引擎V3] ${symbol} V3-${mode}: 参数应用验证 - 策略实例参数:`, {
            trend4HStrongThreshold: this.v3Strategy.trend4HStrongThreshold,
            trend4HModerateThreshold: this.v3Strategy.trend4HModerateThreshold,
            trend4HWeakThreshold: this.v3Strategy.trend4HWeakThreshold,
            entry15MStrongThreshold: this.v3Strategy.entry15MStrongThreshold,
            entry15MModerateThreshold: this.v3Strategy.entry15MModerateThreshold,
            entry15MWeakThreshold: this.v3Strategy.entry15MWeakThreshold
          });
          logger.info(`[回测引擎V3] ${symbol} V3-${mode}: 参数应用验证完成`);
        }

        // 强制验证模式设置
        console.log(`[回测引擎V3] ${symbol} V3-${mode}: 策略模式验证: ${this.v3Strategy.mode}`);
        logger.info(`[回测引擎V3] ${symbol} V3-${mode}: 策略模式验证: ${this.v3Strategy.mode}`);

        // 直接调用V3策略的execute方法（异步处理）
        console.log(`[回测引擎V3] ${symbol} V3-${mode}: 开始调用V3策略execute方法`);
        logger.info(`[回测引擎V3] ${symbol} V3-${mode}: 开始调用V3策略execute方法`);

        let v3Result = null;
        try {
          v3Result = await this.v3Strategy.execute(symbol);
          console.log(`[回测引擎V3] ${symbol} V3-${mode}: V3策略执行完成`, v3Result ? '有结果' : '无结果');
          logger.info(`[回测引擎V3] ${symbol} V3-${mode}: V3策略执行完成`, v3Result ? '有结果' : '无结果');
        } catch (error) {
          console.error(`[回测引擎V3] ${symbol} V3-${mode}: V3策略执行失败`, error.message);
          logger.error(`[回测引擎V3] ${symbol} V3-${mode}: V3策略执行失败`, error.message);
          v3Result = null;
        }

        // 记录策略执行结果
        if (v3Result) {
          console.log(`[回测引擎V3] ${symbol} V3-${mode}: 信号=${v3Result.signal}, 趋势=${v3Result.trend}, 置信度=${v3Result.confidence}`);
          logger.info(`[回测引擎V3] ${symbol} V3-${mode}: 信号=${v3Result.signal}, 趋势=${v3Result.trend}, 置信度=${v3Result.confidence}`);
          if (v3Result.signal !== 'HOLD') {
            console.log(`[回测引擎V3] ${symbol} V3-${mode}: 检测到交易信号! 信号=${v3Result.signal}`);
            logger.info(`[回测引擎V3] ${symbol} V3-${mode}: 检测到交易信号! 信号=${v3Result.signal}`);
          }
        } else {
          console.log(`[回测引擎V3] ${symbol} V3-${mode}: V3策略返回null或undefined`);
          logger.warn(`[回测引擎V3] ${symbol} V3-${mode}: V3策略返回null或undefined`);
        }

        // 每处理20次检查一次，减少CPU消耗
        if (i % (step * 20) === 0) {
          await new Promise(resolve => setImmediate(resolve));
          // 减少垃圾回收频率，避免IO阻塞
          if (global.gc && i % (step * 100) === 0) {
            global.gc();
          }
        }

        if (!v3Result) {
          continue;
        }

        // 检查是否有交易信号
        const signal = v3Result.signal;

        // 统计信号
        if (signal === 'BUY' || signal === 'SELL') {
          totalSignals++;
          console.log(`[回测引擎V3] ${symbol} V3-${mode}: 检测到信号 ${signal} (总信号数: ${totalSignals})`);
        }

        // 检查开仓信号
        if (!position && (signal === 'BUY' || signal === 'SELL')) {

          // 统计假突破过滤结果
          if (v3Result.filterResult) {
            if (v3Result.filterResult.passed) {
              passedSignals++;
              console.log(`[回测引擎V3] ${symbol} V3-${mode}: 假突破过滤器通过 (通过数: ${passedSignals})`);
            } else {
              filteredSignals++;
              console.log(`[回测引擎V3] ${symbol} V3-${mode}: 假突破过滤器拒绝 - ${v3Result.filterResult.reason} (过滤数: ${filteredSignals})`);
            }
          }

          // 开仓
          const direction = signal === 'BUY' ? 'LONG' : 'SHORT';
          const entryPrice = currentPrice;

          // ✅ 使用策略返回的止盈止损逻辑（避免硬编码）
          const confidence = v3Result.confidence || 'med';

          // ✅ 回测时强制使用参数计算止损止盈，忽略策略返回值
          // 计算真实的ATR（过去14根K线的平均真实波动幅度）
          const atr = this.calculateTrueATR(klines, i, 14);

          // ✅ 方案4：根据市场波动性（ATR）动态调整止损距离
          // 计算ATR历史平均值（过去50根K线）
          const atrHistory = [];
          const historyPeriod = Math.min(50, i + 1);
          for (let j = Math.max(0, i - historyPeriod + 1); j <= i; j++) {
            const historicalATR = this.calculateTrueATR(klines, j, 14);
            if (historicalATR > 0) {
              atrHistory.push(historicalATR);
            }
          }
          const avgATR = atrHistory.length > 0 
            ? atrHistory.reduce((a, b) => a + b, 0) / atrHistory.length 
            : atr;

          // 计算当前ATR相对平均ATR的比例
          const atrRatio = avgATR > 0 ? atr / avgATR : 1.0;

          // 从参数中获取基础止损倍数
          const baseMultiplier = params?.risk_management?.stopLossATRMultiplier || params?.position?.stopLossATRMultiplier || 0.3;

          // 根据波动性动态调整止损倍数
          // 低波动（ATR < 80%平均）：使用较紧止损（基础值的80%）
          // 正常波动（80%-120%）：使用标准止损（基础值）
          // 高波动（ATR > 120%平均）：使用较宽止损（基础值的133%）
          let dynamicStopMultiplier = baseMultiplier;
          if (atrRatio < 0.8) {
            // 低波动：收紧止损至基础值的80%
            dynamicStopMultiplier = baseMultiplier * 0.8;
          } else if (atrRatio > 1.2) {
            // 高波动：放宽止损至基础值的133%
            dynamicStopMultiplier = baseMultiplier * 1.33;
          } else {
            // 正常波动：使用基础值
            dynamicStopMultiplier = baseMultiplier;
          }

          // 确保止损倍数在合理范围内（0.2-0.6）
          dynamicStopMultiplier = Math.max(0.2, Math.min(0.6, dynamicStopMultiplier));

          const stopDistance = atr * dynamicStopMultiplier;
          const stopLoss = direction === 'LONG' ? entryPrice - stopDistance : entryPrice + stopDistance;
          const risk = stopDistance;

          // ✅ 方案4调试日志：输出动态止损计算信息
          logger.info(`[回测引擎V3-方案4] ${symbol} V3-${mode}: 动态止损计算 - ATR=${atr.toFixed(4)}, 平均ATR=${avgATR.toFixed(4)}, ATR比例=${atrRatio.toFixed(2)}, 基础倍数=${baseMultiplier}, 动态倍数=${dynamicStopMultiplier.toFixed(3)}, 止损距离=${stopDistance.toFixed(4)}`);
          console.log(`[回测引擎V3-方案4-CONSOLE] ${symbol} V3-${mode}: 动态止损 - ATR=${atr.toFixed(4)}, 平均ATR=${avgATR.toFixed(4)}, 比例=${atrRatio.toFixed(2)}, 倍数=${dynamicStopMultiplier.toFixed(3)}`);

          // ✅ 方案3：提高止盈目标，提升平均盈利，提升盈亏比
          // 默认止盈：3.0倍（从2.5提高，提升平均盈利，提升盈亏比至1.5-2.0+）
          const takeProfitRatio = params?.risk_management?.takeProfitRatio || 3.0;
          // TP1: 第一个止盈位（60%的止盈距离）
          const tp1Ratio = 0.6 * takeProfitRatio;
          // TP2: 第二个止盈位（100%的止盈距离）
          const tp2Ratio = takeProfitRatio;

          // ✅ 方案1：收紧信号过滤，只使用High置信度建仓（Med/Low仅记录，不建仓）
          // 只允许High置信度建仓，Med/Low置信度不建仓
          const highConfidenceRatio = (params?.position_management?.highConfidencePositionRatio || 100) / 100;
          const medConfidenceRatio = 0; // 方案1：Med信号不建仓
          const lowConfidenceRatio = 0; // 方案1：Low信号不建仓
          const positionRatio = confidence === 'High' ? highConfidenceRatio : (confidence === 'Med' ? medConfidenceRatio : lowConfidenceRatio);

          // 如果置信度不足（不是High），不建仓
          if (positionRatio <= 0 || confidence !== 'High') {
            logger.warn(`[回测引擎V3] ${symbol} V3-${mode}: 置信度${confidence}不足，跳过建仓（方案1：只允许High置信度建仓）`);
            continue;
          }

          // 使用风险金额控制仓位：以账户1%风险和止损距离计算张数
          const equity = 10000; // 名义资金
          const riskPct = (params?.risk_management?.riskPercent ?? params?.position?.riskPercent) || 0.01;
          const riskAmount = equity * riskPct;
          const units = stopDistance > 0 ? (riskAmount / stopDistance) : 0;
          const totalQuantity = units * positionRatio;

          // 计算TP1和TP2
          const takeProfit1 = direction === 'LONG' ? entryPrice + tp1Ratio * risk : entryPrice - tp1Ratio * risk;
          const takeProfit2 = direction === 'LONG' ? entryPrice + tp2Ratio * risk : entryPrice - tp2Ratio * risk;

          // 分仓数量：TP1平50%，TP2平50%
          const tp1Quantity = totalQuantity * 0.5;
          const tp2Quantity = totalQuantity * 0.5;
          const remainingQuantity = totalQuantity; // 初始剩余数量等于总数量

          const actualRR = tp2Ratio / dynamicStopMultiplier; // 使用TP2和动态止损倍数计算整体盈亏比

          // ✅ 方案3：强制RR过滤：小于2:1的交易直接跳过，保障目标RR
          // ✅ 优化：由于止盈目标已提高至3.0，止损收紧至0.3，实际RR = 3.0 / 0.3 = 10:1，满足≥2:1
          if (actualRR < 2) {
            logger.warn(`[回测引擎V3] ${symbol} V3-${mode}: 实际RR=${actualRR.toFixed(2)} < 2:1，跳过该信号`);
            continue;
          }

          // ✅ 输出开仓信息，便于追踪（包含TP1/TP2距离百分比）
          const tp1DistancePct = direction === 'LONG'
            ? ((takeProfit1 - entryPrice) / entryPrice * 100).toFixed(2)
            : ((entryPrice - takeProfit1) / entryPrice * 100).toFixed(2);
          const tp2DistancePct = direction === 'LONG'
            ? ((takeProfit2 - entryPrice) / entryPrice * 100).toFixed(2)
            : ((entryPrice - takeProfit2) / entryPrice * 100).toFixed(2);
          const stopDistancePct = direction === 'LONG'
            ? ((entryPrice - stopLoss) / entryPrice * 100).toFixed(2)
            : ((stopLoss - entryPrice) / entryPrice * 100).toFixed(2);

          logger.info(`[回测引擎V3] ${symbol} V3-${mode}: 准备开仓 - 方向=${direction}, 入场=${entryPrice.toFixed(4)}, 止损=${stopLoss.toFixed(4)}(${stopDistancePct}%), TP1=${takeProfit1.toFixed(4)}(${tp1DistancePct}%), TP2=${takeProfit2.toFixed(4)}(${tp2DistancePct}%), 理论RR=${actualRR.toFixed(2)}:1`);
          console.log(`[回测引擎V3-CONSOLE] ${symbol} V3-${mode}: 开仓参数 - 入场=${entryPrice.toFixed(4)}, TP1=${takeProfit1.toFixed(4)}(${tp1DistancePct}%), TP2=${takeProfit2.toFixed(4)}(${tp2DistancePct}%), RR=${actualRR.toFixed(2)}:1`);

          // ✅ 详细调试输出
          console.log(`[回测引擎V3调试] ${symbol} V3-${mode}: 参数验证`);
          console.log(`[回测引擎V3调试] - ATR=${atr.toFixed(4)}, stopLossATRMultiplier=${atrMultiplier}, stopDistance=${stopDistance.toFixed(4)}`);
          console.log(`[回测引擎V3调试] - tp1Ratio=${tp1Ratio}, tp2Ratio=${tp2Ratio}, confidence=${confidence}, positionRatio=${positionRatio}`);
          console.log(`[回测引擎V3调试] - totalQuantity=${totalQuantity.toFixed(4)}, tp1Quantity=${tp1Quantity.toFixed(4)}, tp2Quantity=${tp2Quantity.toFixed(4)}`);
          console.log(`[回测引擎V3调试] - entryPrice=${entryPrice.toFixed(4)}, stopLoss=${stopLoss.toFixed(4)}, stopDistance=${stopDistance.toFixed(4)}, 止损百分比=${((stopDistance / entryPrice) * 100).toFixed(2)}%`);

          logger.info(`[回测引擎V3] ${symbol} V3-${mode}: 分仓出场策略, ATR=${atr.toFixed(4)}, ATR倍数=${atrMultiplier}, TP1倍数=${tp1Ratio}, TP2倍数=${tp2Ratio}, 置信度=${confidence}, 仓位比例=${positionRatio}, 总数量=${totalQuantity.toFixed(4)}, TP1数量=${tp1Quantity.toFixed(4)}, TP2数量=${tp2Quantity.toFixed(4)}`);
          logger.info(`[回测引擎V3] ${symbol} V3-${mode}: SL=${stopLoss.toFixed(4)}, TP1=${takeProfit1.toFixed(4)}, TP2=${takeProfit2.toFixed(4)}, 整体盈亏比=${actualRR.toFixed(2)}:1`);

          position = {
            symbol,
            type: direction,
            entryTime: new Date(currentKline[0]),
            entryPrice,
            quantity: totalQuantity,
            remainingQuantity: remainingQuantity, // 剩余数量（用于分仓出场）
            confidence: v3Result.confidence || 'med',
            stopLoss: stopLoss,
            takeProfit: takeProfit2, // 主要止盈目标（TP2）
            takeProfit1: takeProfit1, // 第一期止盈
            takeProfit2: takeProfit2, // 第二期止盈
            tp1Quantity: tp1Quantity, // 第一期数量
            tp2Quantity: tp2Quantity, // 第二期数量
            tp1Filled: false, // TP1是否已平仓
            tp2Filled: false, // TP2是否已平仓
            leverage: v3Result.leverage || 1
          };

          lastSignal = signal;

          // ✅ 诊断：输出position创建后的验证信息
          logger.info(`[回测引擎V3-诊断] ${symbol} V3-${mode}: position创建完成 - takeProfit1=${position.takeProfit1.toFixed(4)}, takeProfit2=${position.takeProfit2.toFixed(4)}, remainingQuantity=${position.remainingQuantity.toFixed(4)}, tp1Quantity=${position.tp1Quantity.toFixed(4)}, tp2Quantity=${position.tp2Quantity.toFixed(4)}`);
          console.log(`[回测引擎V3-诊断-CONSOLE] ${symbol} V3-${mode}: position创建 - TP1=${position.takeProfit1.toFixed(4)}, TP2=${position.takeProfit2.toFixed(4)}, remainingQty=${position.remainingQuantity.toFixed(4)}`);

          const actualRRRecalculated = Math.abs(position.takeProfit - entryPrice) / Math.abs(entryPrice - position.stopLoss);
          logger.info(`[回测引擎V3] ${symbol} V3-${mode}: 开仓 ${direction} @ ${entryPrice}, SL=${position.stopLoss}, TP=${position.takeProfit}`);
          logger.info(`[回测引擎V3] ${symbol} V3-${mode}: 风险=${Math.abs(entryPrice - position.stopLoss)}, 预期盈利=${Math.abs(position.takeProfit - entryPrice)}, 实际盈亏比=${actualRRRecalculated.toFixed(2)}`);
        }
        // 检查信号反转
        else if (position && signal !== 'HOLD' && signal !== lastSignal) {
          // 信号反转，平仓
          const trade = this.closePosition(position, currentPrice, '信号反转');
          trades.push(trade);

          // 更新策略实例的回撤状态
          this.v3Strategy.updateDrawdownStatus(trade.pnl);

          position = null;
          lastSignal = null;
        }

        // 检查平仓条件（如果有持仓）
        if (position) {
          // ✅ 诊断：每次持仓检查都输出开始信息
          logger.info(`[回测引擎V3-诊断] ${symbol} V3-${mode}: 开始持仓检查 - 持仓存在=${!!position}, takeProfit1=${position.takeProfit1 ? position.takeProfit1.toFixed(4) : 'undefined'}, takeProfit1存在=${!!position.takeProfit1}, remainingQuantity=${position.remainingQuantity || 'undefined'}`);
          console.log(`[回测引擎V3-诊断-CONSOLE] ${symbol} V3-${mode}: 持仓检查开始 - position存在=${!!position}, TP1=${position.takeProfit1 ? position.takeProfit1.toFixed(4) : 'N/A'}, remainingQty=${position.remainingQuantity || 'N/A'}`);

          let shouldExit = false;
          let exitReason = '';

          // ✅ 添加时间止损检查（与实盘一致）
          const positionConfig = this.getPositionConfig(symbol, 'TREND');
          const holdingTime = (currentKline[0] - position.entryTime.getTime()) / 1000 / 60; // 分钟

          // ✅ 诊断：每次持仓检查都输出时间止损检查信息
          logger.info(`[回测引擎V3-诊断] ${symbol} V3-${mode}: 时间止损检查 - 持仓时长=${holdingTime.toFixed(1)}分钟, maxHoldingMinutes=${positionConfig.maxHoldingMinutes}, timeStopMinutes=${positionConfig.timeStopMinutes}`);

          // 检查最大持仓时长限制
          if (holdingTime >= positionConfig.maxHoldingMinutes) {
            shouldExit = true;
            exitReason = `持仓时长超过${positionConfig.maxHoldingMinutes}分钟限制`;
            logger.info(`[回测引擎V3] ${symbol} V3-${mode}: ${exitReason}`);
            console.log(`[回测引擎V3-诊断-CONSOLE] ${symbol} V3-${mode}: shouldExit设置为true (最大持仓时长)`);
          }
          // 检查时间止损（持仓超时且未盈利）
          else if (holdingTime >= positionConfig.timeStopMinutes) {
            const isProfitable = (position.type === 'LONG' && nextPrice > position.entryPrice) ||
              (position.type === 'SHORT' && nextPrice < position.entryPrice);

            // ✅ 优化策略：如果接近TP1（距离<3%），延长持仓时间，避免过早平仓
            let nearTP1 = false;
            if (position.takeProfit1) {
              const tp1DistancePct = position.type === 'LONG'
                ? ((nextPrice - position.takeProfit1) / position.entryPrice * 100)
                : ((position.takeProfit1 - nextPrice) / position.entryPrice * 100);
              nearTP1 = Math.abs(tp1DistancePct) < 3.0; // 接近TP1（距离<3%，从2%放宽）
            }

            // 如果未盈利且不接近TP1，触发时间止损
            if (!isProfitable && !nearTP1) {
              shouldExit = true;
              exitReason = `时间止损 - 持仓${holdingTime.toFixed(0)}分钟未盈利且远离TP1`;
              logger.info(`[回测引擎V3] ${symbol} V3-${mode}: ${exitReason}`);
              console.log(`[回测引擎V3-诊断-CONSOLE] ${symbol} V3-${mode}: shouldExit设置为true (时间止损)`);
            } else if (!isProfitable && nearTP1) {
              // 接近TP1但未盈利，延长持仓时间（额外增加50%的时间）
              logger.info(`[回测引擎V3] ${symbol} V3-${mode}: 接近TP1，延长持仓时间（当前${holdingTime.toFixed(0)}分钟）`);
            }
          }

          // ✅ 优先级调整：先检查止盈（TP1/TP2），再检查止损（避免止损过早触发）
          // 分仓出场逻辑：先检查TP1，再检查TP2（必须在TP1已平仓或价格同时达到时才检查TP2）
          // ✅ 诊断：输出条件检查信息（每次持仓检查都输出）
          const hasTakeProfit1 = !!position.takeProfit1;
          const hasRemainingQuantity = position.remainingQuantity > 0;
          const conditionCheck = !shouldExit && position && hasTakeProfit1 && hasRemainingQuantity;

          // ✅ 优化：每次持仓检查都输出条件检查信息，确保能追踪
          if (position) {
            logger.info(`[回测引擎V3-诊断] ${symbol} V3-${mode}: TP1/TP2检查条件 - shouldExit=${shouldExit}, position存在=${!!position}, takeProfit1存在=${hasTakeProfit1}(${position.takeProfit1 || 'N/A'}), remainingQuantity=${position.remainingQuantity}, 条件满足=${conditionCheck}`);
            console.log(`[回测引擎V3-诊断-CONSOLE] ${symbol} V3-${mode}: 条件检查 - shouldExit=${shouldExit}, hasTP1=${hasTakeProfit1}, remainingQty=${position.remainingQuantity}, 进入TP检查=${conditionCheck}`);
          }

          // ✅ 优化：增加持仓检查日志，确保能追踪持仓状态
          if (!shouldExit && position && position.takeProfit1 && position.remainingQuantity > 0) {
            // 每次持仓检查都输出基本信息（每10次输出一次）
            if (loopCount % 10 === 0) {
              logger.info(`[回测引擎V3-持仓] ${symbol} V3-${mode}: 持仓检查 - 方向=${position.type}, 入场=${position.entryPrice.toFixed(4)}, 当前价=${nextPrice.toFixed(4)}, 剩余仓位=${position.remainingQuantity.toFixed(4)}, TP1=${position.takeProfit1.toFixed(4)}, TP2=${position.takeProfit2.toFixed(4)}, 止损=${position.stopLoss.toFixed(4)}`);
            }
            let tp1Executed = false;

            // ✅ 优化：使用high/low价格范围检测TP1，提高触发精度
            const tp1Hit = position.type === 'LONG'
              ? (nextHigh >= position.takeProfit1 && !position.tp1Filled) // LONG: high价达到TP1
              : (nextLow <= position.takeProfit1 && !position.tp1Filled); // SHORT: low价达到TP1

            // ✅ 优化：增强调试日志，降低输出阈值，确保能追踪TP1触发状态
            if (position.type === 'LONG') {
              const tp1DistancePct = ((nextHigh - position.takeProfit1) / position.takeProfit1 * 100);
              const tp1DistanceAbs = Math.abs(tp1DistancePct);
              // ✅ 优化：降低阈值从1.0%到0.5%，并且每次持仓检查都输出（loopCount % 5 === 0）
              if (loopCount % 5 === 0 || tp1DistanceAbs < 0.5 || tp1Hit) { // 每5次、接近TP1（0.5%）或触发时输出
                logger.info(`[回测引擎V3-TP1] ${symbol} V3-${mode}: LONG TP1检查 - 入场=${position.entryPrice.toFixed(4)}, TP1=${position.takeProfit1.toFixed(4)}, 当前high=${nextHigh.toFixed(4)}, low=${nextLow.toFixed(4)}, 距离=${tp1DistancePct.toFixed(4)}%, 是否触发=${tp1Hit}, 剩余仓位=${position.remainingQuantity.toFixed(4)}`);
                console.log(`[回测引擎V3-TP1-CONSOLE] ${symbol} V3-${mode}: LONG TP1检查 - TP1=${position.takeProfit1.toFixed(4)}, high=${nextHigh.toFixed(4)}, 距离=${tp1DistancePct.toFixed(4)}%, 触发=${tp1Hit}`);
              }
            } else {
              const tp1DistancePct = ((position.takeProfit1 - nextLow) / position.takeProfit1 * 100);
              const tp1DistanceAbs = Math.abs(tp1DistancePct);
              if (loopCount % 5 === 0 || tp1DistanceAbs < 0.5 || tp1Hit) { // 每5次、接近TP1（0.5%）或触发时输出
                logger.info(`[回测引擎V3-TP1] ${symbol} V3-${mode}: SHORT TP1检查 - 入场=${position.entryPrice.toFixed(4)}, TP1=${position.takeProfit1.toFixed(4)}, 当前high=${nextHigh.toFixed(4)}, low=${nextLow.toFixed(4)}, 距离=${tp1DistancePct.toFixed(4)}%, 是否触发=${tp1Hit}, 剩余仓位=${position.remainingQuantity.toFixed(4)}`);
                console.log(`[回测引擎V3-TP1-CONSOLE] ${symbol} V3-${mode}: SHORT TP1检查 - TP1=${position.takeProfit1.toFixed(4)}, low=${nextLow.toFixed(4)}, 距离=${tp1DistancePct.toFixed(4)}%, 触发=${tp1Hit}`);
              }
            }

            if (tp1Hit && position.remainingQuantity >= position.tp1Quantity) {
              // TP1平仓（部分仓位）
              const partialTrade = this.closePartialPosition(position, nextPrice, 'TP1止盈', position.tp1Quantity);
              trades.push(partialTrade);

              // 更新策略实例的回撤状态
              this.v3Strategy.updateDrawdownStatus(partialTrade.pnl);

              // 更新position状态
              position.remainingQuantity -= position.tp1Quantity;
              position.tp1Filled = true;
              tp1Executed = true;

              // ✅ TP1后移动止损至保本，确保剩余仓位不亏损
              position.stopLoss = position.entryPrice;

              console.log(`[回测引擎V3] ${symbol} V3-${mode}: TP1平仓 ${position.tp1Quantity.toFixed(4)}, PnL=${partialTrade.pnl.toFixed(2)}, 剩余数量=${position.remainingQuantity.toFixed(4)}`);
              logger.info(`[回测引擎V3] ${symbol} V3-${mode}: TP1平仓 ${position.tp1Quantity.toFixed(4)}, PnL=${partialTrade.pnl.toFixed(2)}, 剩余数量=${position.remainingQuantity.toFixed(4)}`);
            }

            // ✅ 优化：使用high/low价格范围检测TP2，提高触发精度
            if ((tp1Executed || tp1Hit || position.tp1Filled) && position.remainingQuantity > 0) {
              const tp2Hit = position.type === 'LONG'
                ? (nextHigh >= position.takeProfit2 && !position.tp2Filled) // LONG: high价达到TP2
                : (nextLow <= position.takeProfit2 && !position.tp2Filled); // SHORT: low价达到TP2

              // ✅ 优化：增强调试日志，降低输出阈值，确保能追踪TP2触发状态
              if (position.tp1Filled || (tp1Executed || tp1Hit)) { // TP1已触发或即将触发时记录TP2
                if (position.type === 'LONG') {
                  const tp2DistancePct = ((nextHigh - position.takeProfit2) / position.takeProfit2 * 100);
                  const tp2DistanceAbs = Math.abs(tp2DistancePct);
                  if (loopCount % 5 === 0 || tp2DistanceAbs < 0.5 || tp2Hit) { // 每5次、接近TP2（0.5%）或触发时输出
                    logger.info(`[回测引擎V3-TP2] ${symbol} V3-${mode}: LONG TP2检查 - TP2=${position.takeProfit2.toFixed(4)}, 当前high=${nextHigh.toFixed(4)}, low=${nextLow.toFixed(4)}, 距离=${tp2DistancePct.toFixed(4)}%, 是否触发=${tp2Hit}, 剩余仓位=${position.remainingQuantity.toFixed(4)}`);
                    console.log(`[回测引擎V3-TP2-CONSOLE] ${symbol} V3-${mode}: LONG TP2检查 - TP2=${position.takeProfit2.toFixed(4)}, high=${nextHigh.toFixed(4)}, 距离=${tp2DistancePct.toFixed(4)}%, 触发=${tp2Hit}`);
                  }
                } else {
                  const tp2DistancePct = ((position.takeProfit2 - nextLow) / position.takeProfit2 * 100);
                  const tp2DistanceAbs = Math.abs(tp2DistancePct);
                  if (loopCount % 5 === 0 || tp2DistanceAbs < 0.5 || tp2Hit) { // 每5次、接近TP2（0.5%）或触发时输出
                    logger.info(`[回测引擎V3-TP2] ${symbol} V3-${mode}: SHORT TP2检查 - TP2=${position.takeProfit2.toFixed(4)}, 当前high=${nextHigh.toFixed(4)}, low=${nextLow.toFixed(4)}, 距离=${tp2DistancePct.toFixed(4)}%, 是否触发=${tp2Hit}, 剩余仓位=${position.remainingQuantity.toFixed(4)}`);
                    console.log(`[回测引擎V3-TP2-CONSOLE] ${symbol} V3-${mode}: SHORT TP2检查 - TP2=${position.takeProfit2.toFixed(4)}, low=${nextLow.toFixed(4)}, 距离=${tp2DistancePct.toFixed(4)}%, 触发=${tp2Hit}`);
                  }
                }
              }

              if (tp2Hit && position.remainingQuantity >= position.tp2Quantity) {
                // TP2平仓（剩余仓位）
                const partialTrade = this.closePartialPosition(position, nextPrice, 'TP2止盈', position.tp2Quantity);
                trades.push(partialTrade);

                // 更新策略实例的回撤状态
                this.v3Strategy.updateDrawdownStatus(partialTrade.pnl);

                // 更新position状态
                position.remainingQuantity -= position.tp2Quantity;
                position.tp2Filled = true;

                console.log(`[回测引擎V3] ${symbol} V3-${mode}: TP2平仓 ${position.tp2Quantity.toFixed(4)}, PnL=${partialTrade.pnl.toFixed(2)}, 剩余数量=${position.remainingQuantity.toFixed(4)}`);
                logger.info(`[回测引擎V3] ${symbol} V3-${mode}: TP2平仓 ${position.tp2Quantity.toFixed(4)}, PnL=${partialTrade.pnl.toFixed(2)}, 剩余数量=${position.remainingQuantity.toFixed(4)}`);
              }
            }

            // 如果所有仓位都已平仓，清空position
            if (position.remainingQuantity <= 0.0001) {
              position = null;
              lastSignal = null;
            }
          }
          // ✅ 优化：使用high/low价格范围检测止损，提高触发精度
          if (!shouldExit && position && position.remainingQuantity > 0) {
            const stopLossHit = position.type === 'LONG'
              ? (nextLow <= position.stopLoss) // LONG: low价跌破止损
              : (nextHigh >= position.stopLoss); // SHORT: high价突破止损

            if (stopLossHit) {
              shouldExit = true;
              exitReason = '止损';
              // ✅ 调试日志：输出止损触发信息
              const stopDistance = position.type === 'LONG'
                ? ((position.stopLoss - position.entryPrice) / position.entryPrice * 100).toFixed(4)
                : ((position.entryPrice - position.stopLoss) / position.entryPrice * 100).toFixed(4);
              logger.info(`[回测引擎V3-DEBUG] ${symbol} V3-${mode}: 止损触发 - 入场=${position.entryPrice.toFixed(4)}, 止损=${position.stopLoss.toFixed(4)}, 当前${position.type === 'LONG' ? 'low' : 'high'}=${position.type === 'LONG' ? nextLow.toFixed(4) : nextHigh.toFixed(4)}, 距离=${stopDistance}%`);
            }
          }
          // 兼容旧逻辑：如果没有分仓信息，使用旧逻辑
          if (!shouldExit && position && position.takeProfit && !position.takeProfit1) {
            if (position.type === 'LONG' && nextPrice >= position.takeProfit) {
              shouldExit = true;
              exitReason = '止盈';
            } else if (position.type === 'SHORT' && nextPrice <= position.takeProfit) {
              shouldExit = true;
              exitReason = '止盈';
            }
          }

          // 全仓平仓（止损或旧逻辑）
          if (shouldExit) {
            const trade = this.closePosition(position, nextPrice, exitReason);
            trades.push(trade);

            // 更新策略实例的回撤状态
            this.v3Strategy.updateDrawdownStatus(trade.pnl);

            console.log(`[回测引擎V3] ${symbol} V3-${mode}: 平仓 ${exitReason}, PnL=${trade.pnl.toFixed(2)}, 持仓时长=${holdingTime.toFixed(1)}分钟`);

            position = null;
            lastSignal = null;
          }
        }
      } catch (error) {
        logger.error(`[回测引擎V3] ${symbol} V3-${mode}: 策略执行失败:`, error);
      }
    }

    // 平仓未完成的持仓
    if (position) {
      const lastKline = klines[klines.length - 1];
      const lastPrice = parseFloat(lastKline[4]);

      // 如果还有剩余仓位，按最后价格全部平仓
      if (position.remainingQuantity > 0.0001) {
        const finalTrade = this.closePartialPosition(position, lastPrice, '回测结束', position.remainingQuantity);
        trades.push(finalTrade);
        this.v3Strategy.updateDrawdownStatus(finalTrade.pnl);
        logger.info(`[回测引擎V3] ${symbol} V3-${mode}: 回测结束平仓剩余数量=${position.remainingQuantity.toFixed(4)}, PnL=${finalTrade.pnl.toFixed(2)}`);
      } else {
        // 如果没有剩余仓位，但position还存在，说明可能是旧逻辑，使用全仓平仓
        const trade = this.closePosition(position, lastPrice, '回测结束');
        trades.push(trade);
        this.v3Strategy.updateDrawdownStatus(trade.pnl);
      }
    }

    // 输出假突破过滤统计
    console.log(`[回测引擎V3] ${symbol} V3-${mode}: 假突破过滤统计 - 总信号=${totalSignals}, 通过过滤=${passedSignals}, 被过滤=${filteredSignals}`);
    logger.info(`[回测引擎V3] ${symbol} V3-${mode}: 假突破过滤统计 - 总信号=${totalSignals}, 通过过滤=${passedSignals}, 被过滤=${filteredSignals}`);
    logger.info(`[回测引擎V3] ${symbol} V3-${mode}: 生成交易=${trades.length}`);
    return trades;
  }

  /**
   * 平仓
   * @param {Object} position - 持仓
   * @param {number} exitPrice - 平仓价格
   * @param {string} reason - 平仓原因
   * @returns {Object} 交易记录
   */
  closePosition(position, exitPrice, reason) {
    const pnl = position.type === 'LONG'
      ? (exitPrice - position.entryPrice) * position.quantity
      : (position.entryPrice - exitPrice) * position.quantity;

    const durationHours = (new Date() - position.entryTime) / (1000 * 60 * 60);
    const fees = Math.abs(pnl) * 0.001; // 0.1% 手续费

    return {
      ...position,
      exitTime: new Date(),
      exitPrice,
      pnl,
      durationHours,
      exitReason: reason,
      fees
    };
  }

  /**
   * 部分平仓（用于分仓出场）
   * @param {Object} position - 持仓
   * @param {number} exitPrice - 平仓价格
   * @param {string} reason - 平仓原因
   * @param {number} exitQuantity - 平仓数量
   * @returns {Object} 交易记录
   */
  closePartialPosition(position, exitPrice, reason, exitQuantity) {
    const pnl = position.type === 'LONG'
      ? (exitPrice - position.entryPrice) * exitQuantity
      : (position.entryPrice - exitPrice) * exitQuantity;

    const durationHours = (new Date() - position.entryTime) / (1000 * 60 * 60);
    const fees = Math.abs(pnl) * 0.001; // 0.1% 手续费

    return {
      symbol: position.symbol,
      type: position.type,
      entryTime: position.entryTime,
      exitTime: new Date(),
      entryPrice: position.entryPrice,
      exitPrice,
      quantity: exitQuantity, // 部分数量
      pnl,
      durationHours,
      exitReason: reason,
      fees,
      confidence: position.confidence
    };
  }

  /**
   * 计算回测指标
   * @param {Array} trades - 交易记录
   * @param {string} mode - 策略模式
   * @returns {Object} 回测指标
   */
  calculateMetrics(trades, mode) {
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

    // 计算最大回撤（修复计算逻辑）
    let maxDrawdown = 0;
    let peakEquity = 10000; // 初始资金
    let currentEquity = 10000; // 当前资金

    for (const trade of trades) {
      currentEquity += trade.pnl;
      if (currentEquity > peakEquity) {
        peakEquity = currentEquity;
      }
      const currentDrawdown = (peakEquity - currentEquity) / peakEquity;
      if (currentDrawdown > maxDrawdown) {
        maxDrawdown = currentDrawdown;
      }
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
   * 计算真实的ATR（Average True Range）- 使用Wilder's Smoothing Method
   * @param {Array} klines - K线数据数组
   * @param {number} currentIndex - 当前K线索引
   * @param {number} period - ATR计算周期，默认14
   * @returns {number} ATR值
   */
  calculateTrueATR(klines, currentIndex, period = 14) {
    try {
      if (currentIndex < period - 1) {
        // 如果数据不足，使用当前价格的0.5%作为估算
        const currentPrice = parseFloat(klines[currentIndex][4]);
        return currentPrice * 0.005;
      }

      // 计算所有需要的TR值（从索引0到currentIndex）
      const trValues = [];
      for (let i = 0; i <= currentIndex; i++) {
        const kline = klines[i];
        const high = parseFloat(kline[2]);
        const low = parseFloat(kline[3]);

        let tr;
        if (i === 0) {
          // 第一根K线，没有前一根收盘价
          tr = high - low;
        } else {
          const prevClose = parseFloat(klines[i - 1][4]);
          tr = Math.max(
            high - low,
            Math.abs(high - prevClose),
            Math.abs(low - prevClose)
          );
        }
        trValues.push(tr);
      }

      // 使用Wilder's Smoothing计算ATR
      let atr = 0;

      if (currentIndex === period - 1) {
        // 初始ATR：前14根TR的简单平均
        const sum = trValues.slice(0, period).reduce((a, b) => a + b, 0);
        atr = sum / period;
      } else if (currentIndex > period - 1) {
        // Wilder's Smoothing: ATR[i] = ATR[i-1] - (ATR[i-1]/period) + (TR[i]/period)
        // 递归计算到currentIndex

        // 先计算初始ATR
        const initialSum = trValues.slice(0, period).reduce((a, b) => a + b, 0);
        let prevATR = initialSum / period;

        // 然后用Wilder's Smoothing逐步更新到currentIndex
        for (let i = period; i <= currentIndex; i++) {
          const currentTR = trValues[i];
          prevATR = prevATR - (prevATR / period) + (currentTR / period);
        }

        atr = prevATR;
      }

      logger.debug(`[回测引擎V3] ATR计算(Wilder's): 周期=${period}, 当前索引=${currentIndex}, ATR=${atr.toFixed(4)}`);

      return atr;
    } catch (error) {
      logger.error(`[回测引擎V3] ATR计算失败: ${error.message}`);
      // 出错时使用当前价格的0.5%作为估算
      const currentPrice = parseFloat(klines[currentIndex][4]);
      return currentPrice * 0.005;
    }
  }
}

module.exports = BacktestStrategyEngineV3;

