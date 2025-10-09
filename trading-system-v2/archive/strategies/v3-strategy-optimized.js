/**
 * V3策略第二次优化版本
 * 实现4处核心优化：
 * 1. 趋势置信度分层机制
 * 2. 多因子去相关评分修正
 * 3. 趋势连续性约束
 * 4. 确认收盘延迟机制
 */

const V3Strategy = require('./v3-strategy');
const TechnicalIndicators = require('../utils/technical-indicators');
const TokenClassifier = require('../utils/token-classifier');
const logger = require('../utils/logger');

class V3StrategyOptimized extends V3Strategy {
  constructor() {
    super();
    this.name = 'V3-Optimized';
    this.config = {
      adxThreshold: 30.0,
      atrMultiplierBase: 2.0,
      confirmationBars: 2,
      maxLeverage: 24,
      minLeverage: 1,
      riskPerTrade: 100.0,
      correlationMatrix: [[1, 0.7, 0.6], [0.7, 1, 0.65], [0.6, 0.65, 1]]
    };
  }

  /**
   * 1. 趋势置信度分层机制
   * @param {number} adxVal - ADX值
   * @param {boolean} macdAligned - MACD是否与趋势同向
   * @returns {number} 置信度(0-1)
   */
  computeTrendConfidence(adxVal, macdAligned) {
    if (adxVal < 20) return 0.2;
    if (adxVal < 30) return macdAligned ? 0.5 : 0.4;
    if (adxVal < 40) return macdAligned ? 0.7 : 0.5;
    return macdAligned ? 0.9 : 0.6;
  }

  /**
   * 2. 多因子去相关评分修正
   * @param {Object} factors - 因子得分对象
   * @param {Array} corrMatrix - 相关性矩阵
   * @returns {number} 去相关得分(0-1)
   */
  decorrelatedScore(factors, corrMatrix) {
    const vals = Object.values(factors);
    if (vals.length === 0) return 0;

    let sum = 0;
    for (let i = 0; i < vals.length; i++) {
      const maxCorr = Math.max(...corrMatrix[i].filter((x, j) => j !== i));
      sum += vals[i] * (1 - maxCorr);
    }
    return sum / vals.length;
  }

  /**
   * 3. 趋势连续性验证
   * @param {Array} emaTrendSeries - EMA趋势序列
   * @returns {boolean} 是否连续
   */
  validateTrendPersistence(emaTrendSeries) {
    const lastThree = emaTrendSeries.slice(-3);
    return new Set(lastThree).size === 1; // 全部相同才确认
  }

  /**
   * 4. 确认收盘延迟机制
   * @param {string} signal - 信号类型
   * @param {Array} closes - 收盘价数组
   * @param {number} bars - 确认K线数
   * @returns {boolean} 是否确认
   */
  confirmEntry(signal, closes, bars = this.config.confirmationBars) {
    const last = closes.slice(-bars);
    if (signal === 'BUY') return last.every((c, i, arr) => c >= arr[0]);
    if (signal === 'SELL') return last.every((c, i, arr) => c <= arr[0]);
    return false;
  }

  /**
   * 自适应止损计算
   * @param {number} entry - 入场价格
   * @param {number} atrVal - ATR值
   * @param {number} confidence - 置信度
   * @returns {number} 止损距离
   */
  calcAdaptiveStop(entry, atrVal, confidence) {
    const multiplier = this.config.atrMultiplierBase * (1 - 0.5 * confidence);
    return atrVal * multiplier;
  }

  /**
   * 分层仓位管理
   * @param {number} baseRisk - 基础风险
   * @param {number} totalScore - 总得分
   * @param {number} winRate - 胜率
   * @returns {number} 仓位大小
   */
  positionSizing(baseRisk, totalScore, winRate = 0.55) {
    const confidence = totalScore / 100;
    const adj = 0.5 + 0.5 * winRate;
    return baseRisk * confidence * adj;
  }

  /**
   * 成本感知过滤
   * @param {number} expectedRR - 预期风险回报比
   * @param {number} atr - ATR值
   * @param {number} tickSize - 最小价格变动
   * @returns {boolean} 是否通过过滤
   */
  costAwareFilter(expectedRR, atr, tickSize) {
    return expectedRR >= 1.5 && atr >= 0.3 * tickSize;
  }

  /**
   * 波动率收缩检测
   * @param {Array} bbwSeries - BBW序列
   * @param {Array} atrSeries - ATR序列
   * @returns {boolean} 是否收缩
   */
  detectVolatilityContraction(bbwSeries, atrSeries) {
    if (bbwSeries.length < 6 || atrSeries.length < 6) return false;

    // 使用for循环替代slice和reduce，减少内存分配
    let recentBBWSum = 0, recentATRSum = 0;
    let prevBBWSum = 0, prevATRSum = 0;

    for (let i = bbwSeries.length - 3; i < bbwSeries.length; i++) {
      recentBBWSum += bbwSeries[i];
      recentATRSum += atrSeries[i];
    }

    for (let i = bbwSeries.length - 6; i < bbwSeries.length - 3; i++) {
      prevBBWSum += bbwSeries[i];
      prevATRSum += atrSeries[i];
    }

    const avgBBW = recentBBWSum / 3;
    const avgATR = recentATRSum / 3;
    const prevBBW = prevBBWSum / 3;
    const prevATR = prevATRSum / 3;

    const bbwDrop = prevBBW > 0 ? (prevBBW - avgBBW) / prevBBW : 0;
    const atrDrop = prevATR > 0 ? (prevATR - avgATR) / prevATR : 0;

    return bbwDrop > 0.5 || atrDrop > 0.4;
  }

  /**
   * 优化的4H趋势分析
   * @param {Array} klines4H - 4H K线数据
   * @param {Object} options - 选项
   * @returns {Object} 趋势分析结果
   */
  async analyze4HTrend(klines4H, options = {}) {
    const result = await super.analyze4HTrend(klines4H, options);

    if (!result) return null;

    // 计算MACD对齐度
    const closes = klines4H.map(k => parseFloat(k[4]));
    const macdRes = TechnicalIndicators.calculateMACD(closes);
    const macdAligned = result.trend === 'UP' ?
      macdRes.histogram[macdRes.histogram.length - 1] > 0 :
      macdRes.histogram[macdRes.histogram.length - 1] < 0;

    // 计算趋势置信度
    const trendConfidence = this.computeTrendConfidence(result.adx, macdAligned);

    // 验证趋势连续性
    const ema20 = TechnicalIndicators.calculateEMA(closes, 20);
    const ema50 = TechnicalIndicators.calculateEMA(closes, 50);
    const emaTrendSeries = ema20.slice(-10).map((val, i) => val > ema50[i] ? 'UP' : 'DOWN');
    const trendPersistence = this.validateTrendPersistence(emaTrendSeries);

    return {
      ...result,
      trendConfidence,
      macdAligned,
      trendPersistence,
      score: Math.round(trendConfidence * 10) // 使用置信度重新计算得分
    };
  }

  /**
   * 优化的1H因子分析
   * @param {string} symbol - 交易对
   * @param {Array} klines1H - 1H K线数据
   * @param {Object} options - 选项
   * @returns {Object} 因子分析结果
   */
  async analyze1HFactors(symbol, klines1H, options = {}) {
    const result = await super.analyze1HFactors(symbol, klines1H, options);

    if (!result) return null;

    // 提取因子得分
    const factors = {
      vwap: result.vwapDirection ? 1 : 0,
      oi: result.oiChange ? 1 : 0,
      delta: result.delta ? 1 : 0
    };

    // 计算去相关得分
    const decorrelatedScore = this.decorrelatedScore(factors, this.config.correlationMatrix);

    return {
      ...result,
      decorrelatedScore,
      score: Math.round(decorrelatedScore * 6) // 使用去相关得分重新计算
    };
  }

  /**
   * 优化的15M执行分析
   * @param {string} symbol - 交易对
   * @param {Array} klines15M - 15M K线数据
   * @param {Object} options - 选项
   * @returns {Object} 执行分析结果
   */
  async analyze15mExecution(symbol, klines15M, options = {}) {
    const result = await super.analyze15mExecution(symbol, klines15M, options);

    if (!result) return null;

    // 检测波动率收缩
    const closes = klines15M.map(k => parseFloat(k[4]));
    const highs = klines15M.map(k => parseFloat(k[2]));
    const lows = klines15M.map(k => parseFloat(k[3]));

    const bbwSeries = TechnicalIndicators.calculateBBW(klines15M);
    const atrSeries = TechnicalIndicators.calculateATR(klines15M, 14);

    const volatilityContraction = this.detectVolatilityContraction(bbwSeries, atrSeries);

    return {
      ...result,
      volatilityContraction,
      bbwSeries,
      atrSeries
    };
  }

  /**
   * 优化的信号融合
   * @param {Object} trend4H - 4H趋势结果
   * @param {Object} factors1H - 1H因子结果
   * @param {Object} execution15M - 15M执行结果
   * @returns {string} 最终信号
   */
  combineSignals(trend4H, factors1H, execution15M) {
    if (!trend4H || !factors1H || !execution15M) {
      logger.info('信号融合: 数据不完整，返回HOLD');
      return 'HOLD';
    }

    const trendDirection = trend4H.trendDirection || trend4H.trend;
    const trendScore = trend4H.score || 0;
    const factorScore = factors1H.score || 0;
    const entryScore = execution15M.score || 0;
    const structureScore = execution15M.structureScore || 0;

    // 计算加权总分
    const normalizedScore = (
      (trendScore / 10 * 0.5) +
      (factorScore / 6 * 0.35) +
      (entryScore / 5 * 0.15)
    ) * 100;

    // 检查趋势连续性
    if (!trend4H.trendPersistence) {
      logger.info(`信号融合: 趋势不连续，返回HOLD`);
      return 'HOLD';
    }

    // 强信号：总分>=70 且 趋势强 且 因子强 且 15M有效
    if (normalizedScore >= 70 &&
      trendScore >= 6 &&
      factorScore >= 5 &&
      entryScore >= 1) {
      logger.info(`✅ 强信号触发: 总分=${normalizedScore.toFixed(1)}%, 趋势=${trendScore}, 因子=${factorScore}, 15M=${entryScore}, 结构=${structureScore}`);
      return trendDirection === 'UP' ? 'BUY' : 'SELL';
    }

    // 中等信号：总分45-69 且 趋势>=5 且 因子>=4 且 15M有效
    if (normalizedScore >= 45 &&
      normalizedScore < 70 &&
      trendScore >= 5 &&
      factorScore >= 4 &&
      entryScore >= 1) {
      logger.info(`⚠️ 中等信号触发: 总分=${normalizedScore.toFixed(1)}%, 趋势=${trendScore}, 因子=${factorScore}, 15M=${entryScore}, 结构=${structureScore}`);
      return trendDirection === 'UP' ? 'BUY' : 'SELL';
    }

    // 弱信号：总分35-44 且 趋势>=4 且 因子>=3 且 15M有效
    if (normalizedScore >= 35 &&
      normalizedScore < 45 &&
      trendScore >= 4 &&
      factorScore >= 3 &&
      entryScore >= 1) {
      logger.info(`⚠️ 弱信号触发: 总分=${normalizedScore.toFixed(1)}%, 趋势=${trendScore}, 因子=${factorScore}, 15M=${entryScore}, 结构=${structureScore}`);
      return trendDirection === 'UP' ? 'BUY' : 'SELL';
    }

    // 其他情况HOLD
    logger.info(`信号不足: 总分=${normalizedScore.toFixed(1)}%, HOLD`);
    return 'HOLD';
  }

  /**
   * 执行优化的V3策略分析
   * @param {string} symbol - 交易对
   * @returns {Promise<Object>} 完整分析结果
   */
  async execute(symbol) {
    try {
      logger.info(`开始执行V3优化策略分析: ${symbol}`);

      // 获取基础数据
      const [klines4H, klines1H, klines15M, ticker24hr, fundingRate, oiHistory] = await Promise.all([
        this.binanceAPI.getKlines(symbol, '4h', 250),
        this.binanceAPI.getKlines(symbol, '1h', 50),
        this.binanceAPI.getKlines(symbol, '15m', 50),
        this.binanceAPI.getTicker24hr(symbol),
        this.binanceAPI.getFundingRate(symbol),
        this.binanceAPI.getOpenInterestHist(symbol, '1h', 7)
      ]);

      // 检查数据有效性
      if (!klines4H || !klines1H || !klines15M || !ticker24hr) {
        throw new Error(`无法获取 ${symbol} 的完整数据`);
      }

      // 分步执行分析
      const [trend4H, factors1H] = await Promise.all([
        this.analyze4HTrend(klines4H, {}),
        this.analyze1HFactors(symbol, klines1H, { ticker24hr, fundingRate, oiHistory })
      ]);

      const execution15M = await this.analyze15mExecution(symbol, klines15M, {
        trend: trend4H?.trend || 'RANGE',
        marketType: 'TREND'
      });

      // 综合判断
      logger.info(`[${symbol}] 开始信号融合: 4H=${trend4H?.score}, 1H=${factors1H?.score}, 15M=${execution15M?.score}`);
      const finalSignal = this.combineSignals(trend4H, factors1H, execution15M);
      logger.info(`[${symbol}] 信号融合结果: ${finalSignal}`);

      // 计算交易参数
      let tradeParams = { entryPrice: 0, stopLoss: 0, takeProfit: 0, leverage: 0, margin: 0 };
      if (finalSignal !== 'HOLD') {
        const currentPrice = parseFloat(ticker24hr.lastPrice);
        const atr = TechnicalIndicators.calculateATR(klines15M, 14);
        const atrVal = atr[atr.length - 1];

        // 应用确认延迟机制 - 优化内存使用
        const closes = new Array(klines15M.length);
        for (let i = 0; i < klines15M.length; i++) {
          closes[i] = parseFloat(klines15M[i][4]);
        }
        const confirmed = this.confirmEntry(finalSignal, closes);

        if (confirmed) {
          const confidence = trend4H.trendConfidence || 0.5;
          const stopDistance = this.calcAdaptiveStop(currentPrice, atrVal, confidence);
          const totalScore = ((trend4H?.score || 0) + (factors1H?.score || 0) + (execution15M?.score || 0)) / 3 * 10;
          const positionSize = this.positionSizing(this.config.riskPerTrade, totalScore);

          tradeParams = {
            entryPrice: currentPrice,
            stopLoss: finalSignal === 'BUY' ? currentPrice - stopDistance : currentPrice + stopDistance,
            takeProfit: finalSignal === 'BUY' ? currentPrice + stopDistance * 2 : currentPrice - stopDistance * 2,
            leverage: Math.min(this.config.maxLeverage, Math.max(this.config.minLeverage, Math.round(confidence * 20))),
            margin: positionSize
          };
        } else {
          logger.info(`[${symbol}] 信号未确认，等待收盘验证`);
          return {
            signal: 'HOLD',
            trend: trend4H?.trend || 'RANGE',
            score: 0,
            timeframes: {
              '4H': { trend: trend4H?.trend || 'RANGE', score: trend4H?.score || 0 },
              '1H': { score: factors1H?.score || 0 },
              '15M': { signal: 'HOLD', score: execution15M?.score || 0 }
            },
            entryPrice: 0,
            stopLoss: 0,
            takeProfit: 0,
            leverage: 0,
            margin: 0
          };
        }
      }

      // 记录遥测数据
      const telemetryData = {
        trendScore: trend4H?.score || 0,
        factorScore: factors1H?.score || 0,
        executionScore: execution15M?.score || 0,
        totalScore: ((trend4H?.score || 0) + (factors1H?.score || 0) + (execution15M?.score || 0)) / 3,
        trendConfidence: trend4H?.trendConfidence || 0,
        decorrelatedScore: factors1H?.decorrelatedScore || 0,
        signalResult: finalSignal,
        positionSize: tradeParams.margin,
        stopLoss: tradeParams.stopLoss,
        takeProfit: tradeParams.takeProfit
      };

      return {
        signal: finalSignal,
        trend: trend4H?.trend || 'RANGE',
        score: Math.round(((trend4H?.score || 0) + (factors1H?.score || 0) + (execution15M?.score || 0)) / 3),
        timeframes: {
          '4H': {
            trend: trend4H?.trend || 'RANGE',
            score: trend4H?.score || 0,
            adx: trend4H?.adx || 0,
            bbw: trend4H?.bbw || 0,
            ma20: trend4H?.ma20 || 0,
            ma50: trend4H?.ma50 || 0,
            ma200: trend4H?.ma200 || 0
          },
          '1H': {
            vwap: factors1H?.vwap || 0,
            oiChange: factors1H?.oiChange || 0,
            funding: factors1H?.fundingRate || 0,
            delta: factors1H?.delta || 0,
            score: factors1H?.score || 0
          },
          '15M': {
            signal: execution15M?.signal || 'HOLD',
            ema20: execution15M?.ema20 || 0,
            ema50: execution15M?.ema50 || 0,
            atr: execution15M?.atr || 0,
            bbw: execution15M?.bbw || 0,
            score: execution15M?.score || 0
          }
        },
        ...tradeParams,
        telemetryData
      };

    } catch (error) {
      logger.error(`V3优化策略分析错误 ${symbol}:`, error);
      return {
        signal: 'HOLD',
        trend: 'RANGE',
        score: 0,
        timeframes: {
          '4H': { trend: 'RANGE', score: 0 },
          '1H': { score: 0 },
          '15M': { signal: 'HOLD', score: 0 }
        },
        entryPrice: 0,
        stopLoss: 0,
        takeProfit: 0,
        leverage: 0,
        margin: 0,
        error: error.message
      };
    }
  }
}

module.exports = V3StrategyOptimized;
