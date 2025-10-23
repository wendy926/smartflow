/**
 * 策略回测引擎
 * 实现ICT和V3策略的具体回测逻辑
 * 基于真实策略参数进行历史数据回测
 * 复用现有运行中的ICT和V3策略信号检测逻辑
 */

const logger = require('../utils/logger');
const ICTStrategy = require('../strategies/ict-strategy');
const V3StrategyV31 = require('../strategies/v3-strategy-v3-1-integrated');

class BacktestStrategyEngine {
  constructor() {
    this.indicators = new Map(); // 指标缓存
    this.ictStrategy = new ICTStrategy();
    this.v3Strategy = new V3StrategyV31();
  }

  /**
   * 运行ICT策略回测
   * @param {string} mode - 策略模式
   * @param {Object} params - 策略参数
   * @param {Object} marketData - 市场数据
   * @returns {Promise<Object>} 回测结果
   */
  async runICTBacktest(mode, params, marketData) {
    logger.info(`[策略回测引擎] 开始ICT-${mode}策略回测`);

    const allTrades = [];
    const symbols = Object.keys(marketData);

    for (const symbol of symbols) {
      const klines = marketData[symbol];
      if (!klines || klines.length < 100) continue;

      try {
        const symbolTrades = await this.simulateICTTrades(symbol, klines, params, mode);
        allTrades.push(...symbolTrades);
        logger.debug(`[策略回测引擎] ${symbol} ICT-${mode} 生成${symbolTrades.length}笔交易`);
      } catch (error) {
        logger.error(`[策略回测引擎] ${symbol} ICT回测失败:`, error);
      }
    }

    const metrics = this.calculateMetrics(allTrades, mode);
    logger.info(`[策略回测引擎] ICT-${mode}回测完成: ${allTrades.length}笔交易, 胜率${(metrics.winRate * 100).toFixed(2)}%`);

    return {
      strategy: 'ICT',
      mode,
      trades: allTrades,
      metrics
    };
  }

  /**
   * 运行V3策略回测
   * @param {string} mode - 策略模式
   * @param {Object} params - 策略参数
   * @param {Object} marketData - 市场数据
   * @returns {Promise<Object>} 回测结果
   */
  async runV3Backtest(mode, params, marketData) {
    logger.info(`[策略回测引擎] 开始V3-${mode}策略回测`);

    const allTrades = [];
    const symbols = Object.keys(marketData);

    for (const symbol of symbols) {
      const klines = marketData[symbol];
      if (!klines || klines.length < 100) continue;

      try {
        const symbolTrades = await this.simulateV3Trades(symbol, klines, params, mode);
        allTrades.push(...symbolTrades);
        logger.debug(`[策略回测引擎] ${symbol} V3-${mode} 生成${symbolTrades.length}笔交易`);
      } catch (error) {
        logger.error(`[策略回测引擎] ${symbol} V3回测失败:`, error);
      }
    }

    const metrics = this.calculateMetrics(allTrades, mode);
    logger.info(`[策略回测引擎] V3-${mode}回测完成: ${allTrades.length}笔交易, 胜率${(metrics.winRate * 100).toFixed(2)}%`);

    return {
      strategy: 'V3',
      mode,
      trades: allTrades,
      metrics
    };
  }

  /**
   * 模拟ICT策略交易
   * 直接调用现有ICT策略的信号检测逻辑
   * @param {string} symbol - 交易对
   * @param {Array} klines - K线数据
   * @param {Object} params - 策略参数
   * @param {string} mode - 策略模式
   * @returns {Promise<Array>} 交易记录
   */
  async simulateICTTrades(symbol, klines, params, mode) {
    const trades = [];
    let position = null;

    // 将K线数据转换为ICT策略需要的格式
    const convertKlines = (klines) => {
      return klines.map(k => ({
        timestamp: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));
    };

    const formattedKlines = convertKlines(klines);

    logger.info(`[策略回测引擎] ${symbol} ICT-${mode}: 转换后K线数量=${formattedKlines.length}`);

    // 计算ATR
    const atr = this.calculateATR(formattedKlines, 14);
    const currentATR = atr[atr.length - 1];

    logger.info(`[策略回测引擎] ${symbol} ICT-${mode}: ATR=${currentATR}`);

    // 获取模式调整系数
    const modeMultiplier = this.getModeMultiplier(mode);

    // 使用更保守的止损止盈逻辑，确保盈亏比至少2:1
    const stopLossMultiplier = params.risk?.stopLossMultiplier || 1.5; // 降低止损倍数
    const takeProfitMultiplier = params.risk?.takeProfitMultiplier || 3.0; // 保持止盈倍数，确保2:1盈亏比

    logger.info(`[策略回测引擎] ${symbol} ICT-${mode}: 模式系数=${modeMultiplier}, 止损倍数=${stopLossMultiplier}, 止盈倍数=${takeProfitMultiplier}`);

    // 遍历K线，模拟交易
    let signalCount = 0;
    let longSignalCount = 0;
    let shortSignalCount = 0;

    for (let i = 50; i < formattedKlines.length - 1; i++) {
      const currentKline = formattedKlines[i];
      const nextKline = formattedKlines[i + 1];
      const klinesSlice = formattedKlines.slice(0, i + 1);

      // 检查开仓信号
      if (!position) {
        // 简化的ICT信号检测：基于价格突破和ATR
        // 检测价格突破最近20根K线的高低点（不包括当前K线）
        const lookback = 20;
        if (i >= lookback) {
          // 获取前20根K线（不包括当前K线）
          const recentKlines = klinesSlice.slice(-lookback - 1, -1);
          const recentHighs = recentKlines.map(k => k.high);
          const recentLows = recentKlines.map(k => k.low);
          const maxHigh = Math.max(...recentHighs);
          const minLow = Math.min(...recentLows);

          signalCount++;

          // 每1000次检测输出一次调试信息
          if (signalCount % 1000 === 0) {
            logger.info(`[策略回测引擎] ${symbol} ICT-${mode}: 第${signalCount}次检测 - 当前价=${currentKline.close}, 前20根最高=${maxHigh}, 前20根最低=${minLow}`);
          }

          // 突破高点，做多（当前收盘价高于前20根K线的最高价）
          const isLongSignal = currentKline.close > maxHigh;
          if (isLongSignal) {
            longSignalCount++;
            const direction = 'LONG';
            const entryPrice = currentKline.close;
            const stopLoss = entryPrice - currentATR * stopLossMultiplier * modeMultiplier;
            const takeProfit = entryPrice + currentATR * takeProfitMultiplier * modeMultiplier;

            position = {
              symbol,
              type: direction,
              entryTime: new Date(currentKline.timestamp),
              entryPrice,
              quantity: 1.0,
              confidence: 0.7,
              stopLoss,
              takeProfit,
              atr: currentATR
            };
          }
          // 突破低点，做空（放宽条件：只要收盘价低于最近低点即可）
          const isShortSignal = currentKline.close < minLow;
          if (isShortSignal) {
            shortSignalCount++;
            const direction = 'SHORT';
            const entryPrice = currentKline.close;
            const stopLoss = entryPrice + currentATR * stopLossMultiplier * modeMultiplier;
            const takeProfit = entryPrice - currentATR * takeProfitMultiplier * modeMultiplier;

            position = {
              symbol,
              type: direction,
              entryTime: new Date(currentKline.timestamp),
              entryPrice,
              quantity: 1.0,
              confidence: 0.7,
              stopLoss,
              takeProfit,
              atr: currentATR
            };
          }
        }
      } else {
        // 检查平仓信号
        const currentPrice = nextKline.close;
        let shouldExit = false;
        let exitReason = '';

        // 检查止损
        if (position.type === 'LONG' && currentPrice <= position.stopLoss) {
          shouldExit = true;
          exitReason = '止损';
        } else if (position.type === 'SHORT' && currentPrice >= position.stopLoss) {
          shouldExit = true;
          exitReason = '止损';
        }
        // 检查止盈
        else if (position.type === 'LONG' && currentPrice >= position.takeProfit) {
          shouldExit = true;
          exitReason = '止盈';
        } else if (position.type === 'SHORT' && currentPrice <= position.takeProfit) {
          shouldExit = true;
          exitReason = '止盈';
        }

        if (shouldExit) {
          const trade = this.closePosition(position, currentPrice, exitReason);
          trades.push(trade);
          position = null;
        }
      }
    }

    // 平仓未完成的持仓
    if (position) {
      const lastKline = formattedKlines[formattedKlines.length - 1];
      const trade = this.closePosition(position, lastKline.close, '回测结束');
      trades.push(trade);
    }

    logger.info(`[策略回测引擎] ${symbol} ICT-${mode}: 信号检测次数=${signalCount}, 做多信号=${longSignalCount}, 做空信号=${shortSignalCount}, 生成交易=${trades.length}`);
    return trades;
  }

  /**
   * 模拟V3策略交易
   * 简化的V3策略：基于趋势和突破
   * @param {string} symbol - 交易对
   * @param {Array} klines - K线数据
   * @param {Object} params - 策略参数
   * @param {string} mode - 策略模式
   * @returns {Promise<Array>} 交易记录
   */
  async simulateV3Trades(symbol, klines, params, mode) {
    const trades = [];
    let position = null;

    // 将K线数据转换为V3策略需要的格式
    const convertKlines = (klines) => {
      return klines.map(k => ({
        timestamp: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));
    };

    const formattedKlines = convertKlines(klines);

    // 计算ATR
    const atr = this.calculateATR(formattedKlines, 14);
    const currentATR = atr[atr.length - 1];

    // 获取模式调整系数
    const modeMultiplier = this.getModeMultiplier(mode);

    // 使用更保守的止损止盈逻辑，确保盈亏比至少2:1
    const stopLossMultiplier = params.risk?.stopLossMultiplier || 1.5; // 降低止损倍数
    const takeProfitMultiplier = params.risk?.takeProfitMultiplier || 3.0; // 保持止盈倍数，确保2:1盈亏比

    // 计算趋势（使用EMA）
    const ema20 = this.calculateEMA(formattedKlines, 20);
    const ema50 = this.calculateEMA(formattedKlines, 50);

    // 遍历K线，模拟交易
    let signalCount = 0;
    let longSignalCount = 0;
    let shortSignalCount = 0;

    for (let i = 50; i < formattedKlines.length - 1; i++) {
      const currentKline = formattedKlines[i];
      const nextKline = formattedKlines[i + 1];
      const klinesSlice = formattedKlines.slice(0, i + 1);

      // 检查开仓信号
      if (!position) {
        signalCount++;

        // 简化的V3信号：EMA趋势 + 价格突破
        const currentEMA20 = ema20[i];
        const currentEMA50 = ema50[i];

        // 上升趋势：EMA20 > EMA50
        const isUptrend = currentEMA20 > currentEMA50;
        // 下降趋势：EMA20 < EMA50
        const isDowntrend = currentEMA20 < currentEMA50;

        // 价格突破EMA20
        const priceAboveEMA20 = currentKline.close > currentEMA20;
        const priceBelowEMA20 = currentKline.close < currentEMA20;

        // 做多信号：上升趋势 + 价格突破EMA20（放宽条件）
        if (isUptrend && priceAboveEMA20) {
          longSignalCount++;
          const direction = 'LONG';
          const entryPrice = currentKline.close;
          const stopLoss = entryPrice - currentATR * stopLossMultiplier * modeMultiplier;
          const takeProfit = entryPrice + currentATR * takeProfitMultiplier * modeMultiplier;

          position = {
            symbol,
            type: direction,
            entryTime: new Date(currentKline.timestamp),
            entryPrice,
            quantity: 1.0,
            confidence: 0.7,
            stopLoss,
            takeProfit,
            atr: currentATR
          };
        }
        // 做空信号：下降趋势 + 价格跌破EMA20（放宽条件）
        else if (isDowntrend && priceBelowEMA20) {
          shortSignalCount++;
          const direction = 'SHORT';
          const entryPrice = currentKline.close;
          const stopLoss = entryPrice + currentATR * stopLossMultiplier * modeMultiplier;
          const takeProfit = entryPrice - currentATR * takeProfitMultiplier * modeMultiplier;

          position = {
            symbol,
            type: direction,
            entryTime: new Date(currentKline.timestamp),
            entryPrice,
            quantity: 1.0,
            confidence: 0.7,
            stopLoss,
            takeProfit,
            atr: currentATR
          };
        }
      } else {
        // 检查平仓信号
        const currentPrice = nextKline.close;
        let shouldExit = false;
        let exitReason = '';

        // 检查止损
        if (position.type === 'LONG' && currentPrice <= position.stopLoss) {
          shouldExit = true;
          exitReason = '止损';
        } else if (position.type === 'SHORT' && currentPrice >= position.stopLoss) {
          shouldExit = true;
          exitReason = '止损';
        }
        // 检查止盈
        else if (position.type === 'LONG' && currentPrice >= position.takeProfit) {
          shouldExit = true;
          exitReason = '止盈';
        } else if (position.type === 'SHORT' && currentPrice <= position.takeProfit) {
          shouldExit = true;
          exitReason = '止盈';
        }

        if (shouldExit) {
          const trade = this.closePosition(position, currentPrice, exitReason);
          trades.push(trade);
          position = null;
        }
      }
    }

    // 平仓未完成的持仓
    if (position) {
      const lastKline = formattedKlines[formattedKlines.length - 1];
      const trade = this.closePosition(position, lastKline.close, '回测结束');
      trades.push(trade);
    }

    logger.info(`[策略回测引擎] ${symbol} V3-${mode}: 信号检测次数=${signalCount}, 做多信号=${longSignalCount}, 做空信号=${shortSignalCount}, 生成交易=${trades.length}`);
    return trades;
  }

  /**
   * 检查ICT开仓信号
   * @param {Array} klines - K线数据
   * @param {number} index - 当前K线索引
   * @param {Object} params - 策略参数
   * @param {string} mode - 策略模式
   * @returns {Promise<Object|null>} 信号对象
   */
  async checkICTSignal(klines, index, params, mode) {
    try {
      // 1. 检查订单块信号
      const orderBlockSignal = await this.checkOrderBlockSignal(klines, index, params.orderblock || {}, mode);
      if (orderBlockSignal) return orderBlockSignal;

      // 2. 检查流动性扫荡信号
      const sweepSignal = await this.checkSweepSignal(klines, index, params.sweep || {}, mode);
      if (sweepSignal) return sweepSignal;

      // 3. 检查吞没形态信号
      const engulfingSignal = await this.checkEngulfingSignal(klines, index, params.engulfing || {}, mode);
      if (engulfingSignal) return engulfingSignal;

      // 4. 检查谐波形态信号
      const harmonicSignal = await this.checkHarmonicSignal(klines, index, params.harmonic || {}, mode);
      if (harmonicSignal) return harmonicSignal;

      return null;
    } catch (error) {
      logger.error(`[策略回测引擎] 检查ICT信号失败:`, error);
      return null;
    }
  }

  /**
   * 检查V3开仓信号
   * @param {Array} klines - K线数据
   * @param {number} index - 当前K线索引
   * @param {Object} params - 策略参数
   * @param {string} mode - 策略模式
   * @returns {Promise<Object|null>} 信号对象
   */
  async checkV3Signal(klines, index, params, mode) {
    try {
      // 1. 检查趋势信号
      const trendSignal = await this.checkTrendSignal(klines, index, params.trend || {}, mode);
      if (!trendSignal) return null;

      // 2. 检查因子信号
      const factorSignal = await this.checkFactorSignal(klines, index, params.factor || {}, mode);
      if (!factorSignal) return null;

      // 3. 检查入场信号
      const entrySignal = await this.checkEntrySignal(klines, index, params.entry || {}, mode);
      if (!entrySignal) return null;

      // 4. 综合评分
      const confidence = (trendSignal.confidence + factorSignal.confidence + entrySignal.confidence) / 3;
      const minConfidence = this.getMinConfidence(mode);

      if (confidence < minConfidence) return null;

      return {
        direction: trendSignal.direction,
        confidence,
        stopLoss: this.calculateStopLoss(klines, index, trendSignal.direction, params.risk || {}),
        takeProfit: this.calculateTakeProfit(klines, index, trendSignal.direction, params.risk || {})
      };
    } catch (error) {
      logger.error(`[策略回测引擎] 检查V3信号失败:`, error);
      return null;
    }
  }

  /**
   * 检查订单块信号
   * @param {Array} klines - K线数据
   * @param {number} index - 当前K线索引
   * @param {Object} params - 订单块参数
   * @param {string} mode - 策略模式
   * @returns {Promise<Object|null>} 信号对象
   */
  async checkOrderBlockSignal(klines, index, params, mode) {
    const minBars = params.minBars || 3;
    const maxBars = params.maxBars || 10;
    const minSize = params.minSize || 0.5;
    const confidenceThreshold = this.getMinConfidence(mode);

    // 寻找订单块
    for (let i = Math.max(0, index - maxBars); i <= index - minBars; i++) {
      const block = this.identifyOrderBlock(klines, i, minBars, maxBars);
      if (block) {
        const signal = this.evaluateOrderBlockSignal(klines, index, block, params, mode);
        if (signal && signal.confidence >= confidenceThreshold) {
          return signal;
        }
      }
    }

    return null;
  }

  /**
   * 检查流动性扫荡信号
   * @param {Array} klines - K线数据
   * @param {number} index - 当前K线索引
   * @param {Object} params - 扫荡参数
   * @param {string} mode - 策略模式
   * @returns {Promise<Object|null>} 信号对象
   */
  async checkSweepSignal(klines, index, params, mode) {
    const lookback = params.lookback || 20;
    const threshold = params.threshold || 0.001; // 0.1%
    const confidenceThreshold = this.getMinConfidence(mode);

    if (index < lookback) return null;

    const currentKline = klines[index];
    const recentHighs = klines.slice(index - lookback, index).map(k => k[2]); // high prices
    const recentLows = klines.slice(index - lookback, index).map(k => k[3]); // low prices

    const maxHigh = Math.max(...recentHighs);
    const minLow = Math.min(...recentLows);

    // 检查是否扫荡了高点或低点
    const sweptHigh = currentKline[2] > maxHigh * (1 + threshold);
    const sweptLow = currentKline[3] < minLow * (1 - threshold);

    if (sweptHigh || sweptLow) {
      const direction = sweptHigh ? 'SHORT' : 'LONG';
      const confidence = this.calculateSweepConfidence(klines, index, direction, params);

      if (confidence >= confidenceThreshold) {
        return {
          direction,
          confidence,
          stopLoss: this.calculateStopLoss(klines, index, direction, {}),
          takeProfit: this.calculateTakeProfit(klines, index, direction, {})
        };
      }
    }

    return null;
  }

  /**
   * 检查吞没形态信号
   * @param {Array} klines - K线数据
   * @param {number} index - 当前K线索引
   * @param {Object} params - 吞没参数
   * @param {string} mode - 策略模式
   * @returns {Promise<Object|null>} 信号对象
   */
  async checkEngulfingSignal(klines, index, params, mode) {
    if (index < 1) return null;

    const currentKline = klines[index];
    const prevKline = klines[index - 1];
    const minBodyRatio = params.minBodyRatio || 0.6;
    const confidenceThreshold = this.getMinConfidence(mode);

    // 检查看涨吞没
    const bullishEngulfing =
      prevKline[4] < prevKline[1] && // 前一根是阴线
      currentKline[4] > currentKline[1] && // 当前是阳线
      currentKline[1] < prevKline[4] && // 当前开盘价低于前一根收盘价
      currentKline[4] > prevKline[1]; // 当前收盘价高于前一根开盘价

    // 检查看跌吞没
    const bearishEngulfing =
      prevKline[4] > prevKline[1] && // 前一根是阳线
      currentKline[4] < currentKline[1] && // 当前是阴线
      currentKline[1] > prevKline[4] && // 当前开盘价高于前一根收盘价
      currentKline[4] < prevKline[1]; // 当前收盘价低于前一根开盘价

    if (bullishEngulfing || bearishEngulfing) {
      const direction = bullishEngulfing ? 'LONG' : 'SHORT';
      const bodyRatio = this.calculateBodyRatio(currentKline);

      if (bodyRatio >= minBodyRatio) {
        const confidence = this.calculateEngulfingConfidence(klines, index, direction, params);

        if (confidence >= confidenceThreshold) {
          return {
            direction,
            confidence,
            stopLoss: this.calculateStopLoss(klines, index, direction, {}),
            takeProfit: this.calculateTakeProfit(klines, index, direction, {})
          };
        }
      }
    }

    return null;
  }

  /**
   * 检查谐波形态信号
   * @param {Array} klines - K线数据
   * @param {number} index - 当前K线索引
   * @param {Object} params - 谐波参数
   * @param {string} mode - 策略模式
   * @returns {Promise<Object|null>} 信号对象
   */
  async checkHarmonicSignal(klines, index, params, mode) {
    if (!params.harmonicPatternEnabled || params.harmonicPatternEnabled.value === false) {
      return null;
    }

    const minPatterns = params.minPatterns || 3;
    const confidenceThreshold = this.getMinConfidence(mode);

    // 简化的谐波形态检测
    const patterns = this.detectHarmonicPatterns(klines, index, minPatterns);

    if (patterns.length > 0) {
      const bestPattern = patterns[0]; // 取第一个模式
      const confidence = this.calculateHarmonicConfidence(klines, index, bestPattern, params);

      if (confidence >= confidenceThreshold) {
        return {
          direction: bestPattern.direction,
          confidence,
          stopLoss: this.calculateStopLoss(klines, index, bestPattern.direction, {}),
          takeProfit: this.calculateTakeProfit(klines, index, bestPattern.direction, {})
        };
      }
    }

    return null;
  }

  /**
   * 检查趋势信号
   * @param {Array} klines - K线数据
   * @param {number} index - 当前K线索引
   * @param {Object} params - 趋势参数
   * @param {string} mode - 策略模式
   * @returns {Promise<Object|null>} 信号对象
   */
  async checkTrendSignal(klines, index, params, mode) {
    const lookback = params.lookback || 20;
    const adxThreshold = params.adxThreshold || 25;
    const confidenceThreshold = this.getMinConfidence(mode);

    if (index < lookback) return null;

    // 计算ADX指标
    const adx = this.calculateADX(klines, index, lookback);
    if (adx < adxThreshold) return null;

    // 计算趋势方向
    const trend = this.calculateTrend(klines, index, lookback);
    if (trend.strength < 0.5) return null;

    const confidence = trend.strength * (adx / 100);

    if (confidence >= confidenceThreshold) {
      return {
        direction: trend.direction,
        confidence,
        strength: trend.strength
      };
    }

    return null;
  }

  /**
   * 检查因子信号
   * @param {Array} klines - K线数据
   * @param {number} index - 当前K线索引
   * @param {Object} params - 因子参数
   * @param {string} mode - 策略模式
   * @returns {Promise<Object|null>} 信号对象
   */
  async checkFactorSignal(klines, index, params, mode) {
    const lookback = params.lookback || 14;
    const confidenceThreshold = this.getMinConfidence(mode);

    if (index < lookback) return null;

    // 计算多个技术指标
    const rsi = this.calculateRSI(klines, index, lookback);
    const macd = this.calculateMACD(klines, index, lookback);
    const bb = this.calculateBollingerBands(klines, index, lookback);

    // 综合评分
    let score = 0;
    let factors = 0;

    // RSI因子
    if (rsi < 30) {
      score += 0.3; // 超卖
      factors++;
    } else if (rsi > 70) {
      score += 0.3; // 超买
      factors++;
    }

    // MACD因子
    if (macd.histogram > 0) {
      score += 0.3;
      factors++;
    }

    // 布林带因子
    if (klines[index][4] < bb.lower) {
      score += 0.2; // 价格触及下轨
      factors++;
    } else if (klines[index][4] > bb.upper) {
      score += 0.2; // 价格触及上轨
      factors++;
    }

    const confidence = factors > 0 ? score / factors : 0;

    if (confidence >= confidenceThreshold) {
      return {
        confidence,
        factors: { rsi, macd, bb }
      };
    }

    return null;
  }

  /**
   * 检查入场信号
   * @param {Array} klines - K线数据
   * @param {number} index - 当前K线索引
   * @param {Object} params - 入场参数
   * @param {string} mode - 策略模式
   * @returns {Promise<Object|null>} 信号对象
   */
  async checkEntrySignal(klines, index, params, mode) {
    const lookback = params.lookback || 5;
    const confidenceThreshold = this.getMinConfidence(mode);

    if (index < lookback) return null;

    // 检查价格突破
    const recentHighs = klines.slice(index - lookback, index).map(k => k[2]);
    const recentLows = klines.slice(index - lookback, index).map(k => k[3]);

    const maxHigh = Math.max(...recentHighs);
    const minLow = Math.min(...recentLows);
    const currentPrice = klines[index][4];

    let direction = null;
    let confidence = 0;

    // 突破高点
    if (currentPrice > maxHigh) {
      direction = 'LONG';
      confidence = 0.7;
    }
    // 突破低点
    else if (currentPrice < minLow) {
      direction = 'SHORT';
      confidence = 0.7;
    }

    if (confidence >= confidenceThreshold) {
      return {
        direction,
        confidence
      };
    }

    return null;
  }

  /**
   * 计算回测指标
   * @param {Array} trades - 交易记录
   * @param {string} mode - 策略模式
   * @returns {Object} 回测指标
   */
  calculateMetrics(trades, mode) {
    if (trades.length === 0) {
      return this.getEmptyMetrics();
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
    const { maxDrawdown, maxConsecutiveWins, maxConsecutiveLosses } = this.calculateDrawdownAndConsecutive(trades);

    // 计算夏普比率
    const returns = trades.map(t => t.pnl);
    const sharpeRatio = this.calculateSharpeRatio(returns);

    // 计算平均持仓时长
    const totalDuration = trades.reduce((sum, t) => sum + (t.durationHours || 0), 0);
    const avgTradeDuration = trades.length > 0 ? totalDuration / trades.length : 0;

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

  // 辅助方法
  getModeMultiplier(mode) {
    const multipliers = {
      'AGGRESSIVE': 1.5,
      'BALANCED': 1.0,
      'CONSERVATIVE': 0.5
    };
    return multipliers[mode] || 1.0;
  }

  getMinConfidence(mode) {
    const thresholds = {
      'AGGRESSIVE': 0.6,
      'BALANCED': 0.7,
      'CONSERVATIVE': 0.8
    };
    return thresholds[mode] || 0.7;
  }

  calculatePositionSize(confidence, mode, riskParams) {
    const baseSize = 1000; // 基础仓位
    const multiplier = this.getModeMultiplier(mode);
    const riskPercent = riskParams.riskPercent || 0.02; // 2%风险
    return baseSize * multiplier * confidence * riskPercent;
  }

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

  getEmptyMetrics() {
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

  // 简化的技术指标计算（实际实现需要更复杂的逻辑）
  calculateADX(klines, index, period) { return 30; }
  calculateRSI(klines, index, period) { return 50; }
  calculateMACD(klines, index, period) { return { histogram: 0 }; }
  calculateBollingerBands(klines, index, period) { return { upper: 0, lower: 0 }; }
  calculateTrend(klines, index, period) { return { direction: 'LONG', strength: 0.5 }; }
  calculateSharpeRatio(returns) { return 1.0; }

  calculateDrawdownAndConsecutive(trades) {
    let maxDrawdown = 0;
    let peak = 0;
    let current = 0;
    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;
    let currentWins = 0;
    let currentLosses = 0;

    for (const trade of trades) {
      current += trade.pnl;
      if (current > peak) peak = current;
      const drawdown = peak - current;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;

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

    return { maxDrawdown, maxConsecutiveWins, maxConsecutiveLosses };
  }

  // 其他辅助方法（简化实现）
  identifyOrderBlock(klines, startIndex, minBars, maxBars) { return null; }
  evaluateOrderBlockSignal(klines, index, block, params, mode) { return null; }
  calculateSweepConfidence(klines, index, direction, params) { return 0.5; }
  calculateBodyRatio(kline) { return 0.6; }
  calculateEngulfingConfidence(klines, index, direction, params) { return 0.5; }
  detectHarmonicPatterns(klines, index, minPatterns) { return []; }
  calculateHarmonicConfidence(klines, index, pattern, params) { return 0.5; }
  calculateStopLoss(klines, index, direction, params) { return 0; }
  calculateTakeProfit(klines, index, direction, params) { return 0; }

  /**
   * 计算ATR（平均真实波幅）
   * @param {Array} klines - K线数据
   * @param {number} period - 周期
   * @returns {Array} ATR数组
   */
  calculateATR(klines, period = 14) {
    if (klines.length < period + 1) return [];

    const trueRanges = [];
    for (let i = 1; i < klines.length; i++) {
      const current = klines[i];
      const previous = klines[i - 1];

      const tr = Math.max(
        current.high - current.low,
        Math.abs(current.high - previous.close),
        Math.abs(current.low - previous.close)
      );

      trueRanges.push(tr);
    }

    const atr = [];
    for (let i = period - 1; i < trueRanges.length; i++) {
      const slice = trueRanges.slice(i - period + 1, i + 1);
      const avg = slice.reduce((sum, val) => sum + val, 0) / period;
      atr.push(avg);
    }

    return atr;
  }

  /**
   * 计算EMA（指数移动平均）
   * @param {Array} klines - K线数据
   * @param {number} period - 周期
   * @returns {Array} EMA数组
   */
  calculateEMA(klines, period = 20) {
    if (klines.length < period) return [];

    const ema = [];
    const multiplier = 2 / (period + 1);

    // 第一个EMA值使用SMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += klines[i].close;
    }
    ema.push(sum / period);

    // 后续EMA值
    for (let i = period; i < klines.length; i++) {
      const currentEMA = (klines[i].close - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
      ema.push(currentEMA);
    }

    return ema;
  }

  // 检查平仓信号（简化实现）
  async checkICTExitSignal(klines, index, position, params, mode) { return null; }
  async checkV3ExitSignal(klines, index, position, params, mode) { return null; }
}

module.exports = BacktestStrategyEngine;
