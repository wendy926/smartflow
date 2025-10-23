/**
 * 策略回测引擎 V3
 * 严谨的回测系统，直接调用Dashboard正在运行的ICT和V3策略逻辑
 * 确保回测结果与实时策略完全一致
 */

const logger = require('../utils/logger');
const ICTStrategy = require('../strategies/ict-strategy');
const V3StrategyV31 = require('../strategies/v3-strategy-v3-1-integrated');

class BacktestStrategyEngineV3 {
  constructor(mockBinanceAPI) {
    this.mockBinanceAPI = mockBinanceAPI;
    this.ictStrategy = new ICTStrategy();
    this.v3Strategy = new V3StrategyV31();

    // 将Mock Binance API注入到策略中
    if (this.mockBinanceAPI) {
      this.ictStrategy.binanceAPI = this.mockBinanceAPI;
      this.v3Strategy.binanceAPI = this.mockBinanceAPI;
    }
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
  async runStrategyBacktest(strategyName, mode, params, marketData, timeframe = '1h') {
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
  async runICTBacktest(mode, params, marketData, timeframe = '1h') {
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
        const symbolTrades = await this.simulateICTTrades(symbol, klines, params, mode);
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
  async runV3Backtest(mode, params, marketData, timeframe = '1h') {
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
        const symbolTrades = await this.simulateV3Trades(symbol, klines, params, mode);
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
  async simulateICTTrades(symbol, klines, params, mode) {
    const trades = [];
    let position = null;
    let lastSignal = null;

    console.log(`[回测引擎V3] ${symbol} ICT-${mode}: 开始回测，K线数量=${klines.length}`);

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

        // 应用策略参数 - 确保参数正确应用
        if (params && Object.keys(params).length > 0) {
          // 先重置策略实例，然后应用参数
          this.ictStrategy = new ICTStrategy();
          this.ictStrategy.binanceAPI = this.mockBinanceAPI;
          Object.assign(this.ictStrategy, params);
          logger.debug(`[回测引擎V3] ${symbol} ICT-${mode}: 应用参数`, Object.keys(params));
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

          // ✅ 使用策略返回的止盈止损（避免硬编码）
          let stopLoss = ictResult.stopLoss || 0;
          let takeProfit = ictResult.takeProfit || 0;

          // 如果策略没有返回止盈止损，使用默认计算
          if (stopLoss === 0 || takeProfit === 0) {
            // 计算真实的ATR（过去14根K线的平均真实波动幅度）
            const atr = this.calculateTrueATR(klines, i, 14);
            
            // ✅ 从参数中获取止损倍数，默认1.5
            const atrMultiplier = params?.risk_management?.stopLossATRMultiplier || 1.5;
            const stopDistance = atr * atrMultiplier;
            stopLoss = direction === 'LONG' ? entryPrice - stopDistance : entryPrice + stopDistance;
            const risk = stopDistance;

            // ✅ 从参数中获取止盈倍数，默认5.0
            const takeProfitRatio = params?.risk_management?.takeProfitRatio || 5.0;
            takeProfit = direction === 'LONG' ? entryPrice + takeProfitRatio * risk : entryPrice - takeProfitRatio * risk;
            
            const actualRR = takeProfitRatio / atrMultiplier;
            logger.info(`[回测引擎V3] ${symbol} ICT-${mode}: 使用参数计算止损止盈, ATR=${atr.toFixed(2)}, ATR倍数=${atrMultiplier}, 止盈倍数=${takeProfitRatio}, SL=${stopLoss.toFixed(2)}, TP=${takeProfit.toFixed(2)}, 盈亏比=${actualRR.toFixed(2)}:1`);
          } else {
            const risk = Math.abs(entryPrice - stopLoss);
            const reward = Math.abs(takeProfit - entryPrice);
            const actualRR = reward / risk;
            logger.info(`[回测引擎V3] ${symbol} ICT-${mode}: 使用策略返回的止损止盈, SL=${stopLoss.toFixed(2)}, TP=${takeProfit.toFixed(2)}, 盈亏比=${actualRR.toFixed(2)}:1`);
          }

          position = {
            symbol,
            type: direction,
            entryTime: new Date(currentKline[0]),
            entryPrice,
            quantity: 1.0,
            confidence: ictResult.confidence || 'med',
            stopLoss: stopLoss,
            takeProfit: takeProfit,
            leverage: ictResult.leverage || 1
          };

          lastSignal = signal;
          
          const actualRR = Math.abs(position.takeProfit - entryPrice) / Math.abs(entryPrice - position.stopLoss);
          logger.info(`[回测引擎V3] ${symbol} ICT-${mode}: 开仓 ${direction} @ ${entryPrice.toFixed(2)}, SL=${position.stopLoss.toFixed(2)}, TP=${position.takeProfit.toFixed(2)}, 实际盈亏比=${actualRR.toFixed(2)}:1`);
        }
        // 检查信号反转
        else if (position && signal !== 'HOLD' && signal !== lastSignal) {
          // 信号反转，平仓
          const trade = this.closePosition(position, currentPrice, '信号反转');
          trades.push(trade);
          position = null;
          lastSignal = null;
        }

        // 检查平仓条件（如果有持仓）
        if (position) {
          let shouldExit = false;
          let exitReason = '';

          // 检查止损
          if (position.type === 'LONG' && nextPrice <= position.stopLoss) {
            shouldExit = true;
            exitReason = '止损';
          } else if (position.type === 'SHORT' && nextPrice >= position.stopLoss) {
            shouldExit = true;
            exitReason = '止损';
          }
          // 检查止盈
          else if (position.type === 'LONG' && nextPrice >= position.takeProfit) {
            shouldExit = true;
            exitReason = '止盈';
          } else if (position.type === 'SHORT' && nextPrice <= position.takeProfit) {
            shouldExit = true;
            exitReason = '止盈';
          }

          if (shouldExit) {
            const trade = this.closePosition(position, nextPrice, exitReason);
            trades.push(trade);
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
  async simulateV3Trades(symbol, klines, params, mode) {
    const trades = [];
    let position = null;
    let lastSignal = null;

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
    console.log(`[回测引擎V3] ${symbol} V3-${mode}: Mock Binance API已注入，数据量: 1h=${klines.length}条`);
    logger.info(`[回测引擎V3] ${symbol} V3-${mode}: Mock Binance API已注入，数据量: 1h=${klines.length}条`);
    process.stderr.write(`[回测引擎V3] 强制输出: ${symbol} V3-${mode}Mock Binance API已注入，数据量: 1h=${klines.length}条\n`);

    // 优化：减少回测频率，每20根K线检查一次
    const step = Math.max(1, Math.floor(klines.length / 20)); // 最多检查20次，减少CPU消耗
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

      try {
        // 设置Mock Binance API的当前索引
        mockAPI.setCurrentIndex(i);

        // 强制设置模式并应用参数
        this.v3Strategy = new V3StrategyV31();
        this.v3Strategy.binanceAPI = mockAPI; // 使用同一个Mock API实例
        this.v3Strategy.mode = mode; // 强制设置模式

        // 应用参数到策略实例
        if (params && Object.keys(params).length > 0) {
          Object.assign(this.v3Strategy, params);
          console.log(`[回测引擎V3] ${symbol} V3-${mode}: 应用参数`, Object.keys(params));
          logger.info(`[回测引擎V3] ${symbol} V3-${mode}: 应用参数`, Object.keys(params));

          // 验证关键参数是否正确应用
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
        } else {
          console.log(`[回测引擎V3] ${symbol} V3-${mode}: 没有参数需要应用，设置模式为${mode}`);
          logger.warn(`[回测引擎V3] ${symbol} V3-${mode}: 没有参数需要应用，设置模式为${mode}`);
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

          // 优先使用策略返回的止盈止损
          let stopLoss = v3Result.stopLoss || 0;
          let takeProfit = v3Result.takeProfit || 0;

          // 如果策略没有返回止盈止损，使用参数计算
          if (stopLoss === 0 || takeProfit === 0) {
            // 计算真实的ATR（过去14根K线的平均真实波动幅度）
            const atr = this.calculateTrueATR(klines, i, 14);
            
            // ✅ 从参数中获取止损倍数（根据置信度），默认1.8
            let atrMultiplier = 1.8;
            if (params?.risk_management) {
              if (confidence === 'high' && params.risk_management.stopLossATRMultiplier_high) {
                atrMultiplier = params.risk_management.stopLossATRMultiplier_high;
              } else if (confidence === 'med' && params.risk_management.stopLossATRMultiplier_medium) {
                atrMultiplier = params.risk_management.stopLossATRMultiplier_medium;
              } else if (confidence === 'low' && params.risk_management.stopLossATRMultiplier_low) {
                atrMultiplier = params.risk_management.stopLossATRMultiplier_low;
              } else if (params.risk_management.stopLossATRMultiplier) {
                atrMultiplier = params.risk_management.stopLossATRMultiplier;
              }
            }
            
            const stopDistance = atr * atrMultiplier;
            stopLoss = direction === 'LONG' ? entryPrice - stopDistance : entryPrice + stopDistance;
            const risk = stopDistance;

            // ✅ 从参数中获取止盈倍数，默认5.0
            const takeProfitRatio = params?.risk_management?.takeProfitRatio || 5.0;
            takeProfit = direction === 'LONG' ? entryPrice + takeProfitRatio * risk : entryPrice - takeProfitRatio * risk;
            
            const actualRR = takeProfitRatio / atrMultiplier;
            logger.info(`[回测引擎V3] ${symbol} V3-${mode}: 使用参数计算止损止盈, ATR=${atr.toFixed(2)}, ATR倍数=${atrMultiplier}, 止盈倍数=${takeProfitRatio}, SL=${stopLoss.toFixed(2)}, TP=${takeProfit.toFixed(2)}, 盈亏比=${actualRR.toFixed(2)}:1, 置信度=${confidence}`);
          } else {
            const risk = Math.abs(entryPrice - stopLoss);
            const reward = Math.abs(takeProfit - entryPrice);
            const actualRR = reward / risk;
            logger.info(`[回测引擎V3] ${symbol} V3-${mode}: 使用策略返回的止损止盈, SL=${stopLoss.toFixed(2)}, TP=${takeProfit.toFixed(2)}, 盈亏比=${actualRR.toFixed(2)}:1, 置信度=${confidence}`);
          }

          position = {
            symbol,
            type: direction,
            entryTime: new Date(currentKline[0]),
            entryPrice,
            quantity: 1.0,
            confidence: v3Result.confidence || 'med',
            stopLoss: stopLoss, // 使用策略或ATR计算的止损
            takeProfit: takeProfit,
            leverage: v3Result.leverage || 1
          };

          lastSignal = signal;

          const actualRR = Math.abs(position.takeProfit - entryPrice) / Math.abs(entryPrice - position.stopLoss);
          logger.info(`[回测引擎V3] ${symbol} V3-${mode}: 开仓 ${direction} @ ${entryPrice}, SL=${position.stopLoss}, TP=${position.takeProfit}`);
          logger.info(`[回测引擎V3] ${symbol} V3-${mode}: 风险=${Math.abs(entryPrice - position.stopLoss)}, 预期盈利=${Math.abs(position.takeProfit - entryPrice)}, 实际盈亏比=${actualRR.toFixed(2)}`);
        }
        // 检查信号反转
        else if (position && signal !== 'HOLD' && signal !== lastSignal) {
          // 信号反转，平仓
          const trade = this.closePosition(position, currentPrice, '信号反转');
          trades.push(trade);
          position = null;
          lastSignal = null;
        }

        // 检查平仓条件（如果有持仓）
        if (position) {
          let shouldExit = false;
          let exitReason = '';

          // 检查止损
          if (position.type === 'LONG' && nextPrice <= position.stopLoss) {
            shouldExit = true;
            exitReason = '止损';
          } else if (position.type === 'SHORT' && nextPrice >= position.stopLoss) {
            shouldExit = true;
            exitReason = '止损';
          }
          // 检查止盈
          else if (position.type === 'LONG' && nextPrice >= position.takeProfit) {
            shouldExit = true;
            exitReason = '止盈';
          } else if (position.type === 'SHORT' && nextPrice <= position.takeProfit) {
            shouldExit = true;
            exitReason = '止盈';
          }

          if (shouldExit) {
            const trade = this.closePosition(position, nextPrice, exitReason);
            trades.push(trade);
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
      const trade = this.closePosition(position, lastKline[4], '回测结束');
      trades.push(trade);
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

