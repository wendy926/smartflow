/**
 * V3策略增强版 - 解决信号死区问题
 * 实现补偿机制和动态权重调整
 */

const V3Strategy = require('./v3-strategy');
const logger = require('../utils/logger');

class V3StrategyEnhanced extends V3Strategy {
  constructor() {
    super();
    this.name = 'V3-Enhanced';
  }

  /**
   * 增强版信号融合 - 解决信号死区问题
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
    const factorScore = factors1H.totalScore || factors1H.score || 0;
    const entryScore = execution15M.score || 0;
    const structureScore = execution15M.structureScore || 0;

    // 方案3：动态权重调整
    const dynamicWeights = this.calculateDynamicWeights(trendScore, factorScore, entryScore);

    // 使用动态权重计算总分
    const totalScore = (
      (trendScore / 10) * dynamicWeights.trend +
      (factorScore / 6) * dynamicWeights.factor +
      (entryScore / 5) * dynamicWeights.entry
    );

    const normalizedScore = Math.round(totalScore * 100);

    logger.info(`V3增强信号融合: 4H=${trendScore}/10, 1H=${factorScore}/6, 15M=${entryScore}/5, 结构=${structureScore}/2`);
    logger.info(`动态权重: 趋势=${(dynamicWeights.trend * 100).toFixed(1)}%, 因子=${(dynamicWeights.factor * 100).toFixed(1)}%, 入场=${(dynamicWeights.entry * 100).toFixed(1)}%`);
    logger.info(`总分=${normalizedScore}%`);

    // 震荡市特殊处理：检查是否有假突破信号
    if (trendDirection === 'RANGE') {
      // 如果15M执行信号是BUY或SELL，且来自震荡市假突破，则允许交易
      if (execution15M?.signal === 'BUY' || execution15M?.signal === 'SELL') {
        if (execution15M?.reason?.includes('Range fake breakout')) {
          logger.info(`震荡市假突破信号: ${execution15M.signal}, 原因: ${execution15M.reason}`);
          return execution15M.signal;
        }
      }
      logger.info(`震荡市无有效假突破信号，HOLD`);
      return 'HOLD';
    }

    // 方案2：补偿机制 - 动态调整因子门槛
    const compensation = this.calculateCompensation(normalizedScore, trendScore, factorScore, entryScore, structureScore);
    const adjustedFactorThreshold = this.getAdjustedFactorThreshold(normalizedScore, trendScore, compensation);

    logger.info(`补偿机制: 总分=${normalizedScore}%, 趋势=${trendScore}, 补偿=${compensation}, 调整后因子门槛=${adjustedFactorThreshold}`);

    // 强信号：总分>=70 且 趋势强 且 因子满足调整后门槛 且 15M有效
    if (normalizedScore >= 70 &&
      trendScore >= 6 &&
      factorScore >= adjustedFactorThreshold.strong &&
      entryScore >= 1) {
      logger.info(`✅ 强信号触发: 总分=${normalizedScore}%, 趋势=${trendScore}, 因子=${factorScore}>=${adjustedFactorThreshold.strong}, 15M=${entryScore}, 结构=${structureScore}`);
      return trendDirection === 'UP' ? 'BUY' : 'SELL';
    }

    // 中等信号：总分50-69 且 趋势>=5 且 因子满足调整后门槛 且 15M有效
    if (normalizedScore >= 50 &&
      normalizedScore < 70 &&
      trendScore >= 5 &&
      factorScore >= adjustedFactorThreshold.moderate &&
      entryScore >= 1) {
      logger.info(`⚠️ 中等信号触发: 总分=${normalizedScore}%, 趋势=${trendScore}, 因子=${factorScore}>=${adjustedFactorThreshold.moderate}, 15M=${entryScore}, 结构=${structureScore}`);
      return trendDirection === 'UP' ? 'BUY' : 'SELL';
    }

    // 弱信号：总分35-49 且 趋势>=4 且 因子满足调整后门槛 且 15M有效
    if (normalizedScore >= 35 &&
      normalizedScore < 50 &&
      trendScore >= 4 &&
      factorScore >= adjustedFactorThreshold.weak &&
      entryScore >= 1) {
      logger.info(`⚠️ 弱信号触发: 总分=${normalizedScore}%, 趋势=${trendScore}, 因子=${factorScore}>=${adjustedFactorThreshold.weak}, 15M=${entryScore}, 结构=${structureScore}`);
      return trendDirection === 'UP' ? 'BUY' : 'SELL';
    }

    // 其他情况HOLD
    logger.info(`信号不足: 总分=${normalizedScore}%, HOLD`);
    return 'HOLD';
  }

  /**
   * 方案3：计算动态权重
   * @param {number} trendScore - 趋势得分
   * @param {number} factorScore - 因子得分
   * @param {number} entryScore - 入场得分
   * @returns {Object} 动态权重
   */
  calculateDynamicWeights(trendScore, factorScore, entryScore) {
    const baseWeights = { trend: 0.5, factor: 0.35, entry: 0.15 };

    // 趋势很强时增加趋势权重
    if (trendScore >= 8) {
      baseWeights.trend = 0.6;
      baseWeights.factor = 0.3;
      baseWeights.entry = 0.1;
    }
    // 因子很强时增加因子权重
    else if (factorScore >= 5) {
      baseWeights.trend = 0.45;
      baseWeights.factor = 0.4;
      baseWeights.entry = 0.15;
    }
    // 入场很强时增加入场权重
    else if (entryScore >= 4) {
      baseWeights.trend = 0.5;
      baseWeights.factor = 0.3;
      baseWeights.entry = 0.2;
    }
    // 所有指标都很强时平衡权重
    else if (trendScore >= 7 && factorScore >= 4 && entryScore >= 3) {
      baseWeights.trend = 0.45;
      baseWeights.factor = 0.35;
      baseWeights.entry = 0.2;
    }

    return baseWeights;
  }

  /**
   * 方案2：计算补偿机制
   * @param {number} normalizedScore - 归一化总分
   * @param {number} trendScore - 趋势得分
   * @param {number} factorScore - 因子得分
   * @param {number} entryScore - 入场得分
   * @param {number} structureScore - 结构得分
   * @returns {number} 补偿值
   */
  calculateCompensation(normalizedScore, trendScore, factorScore, entryScore, structureScore = 0) {
    let compensation = 0;

    // 总分很高时给予补偿
    if (normalizedScore >= 80) {
      compensation += 1;
    } else if (normalizedScore >= 75) {
      compensation += 0.5;
    }

    // 趋势很强时给予补偿
    if (trendScore >= 8) {
      compensation += 1;
    } else if (trendScore >= 7) {
      compensation += 0.5;
    }

    // 入场很强时给予补偿
    if (entryScore >= 4) {
      compensation += 0.5;
    }

    // 结构确认时给予补偿
    if (structureScore >= 2) {
      compensation += 0.5;
    }

    return Math.min(compensation, 2); // 最大补偿2分
  }

  /**
   * 获取调整后的因子门槛
   * @param {number} normalizedScore - 归一化总分
   * @param {number} trendScore - 趋势得分
   * @param {number} compensation - 补偿值
   * @returns {Object} 调整后的门槛
   */
  getAdjustedFactorThreshold(normalizedScore, trendScore, compensation) {
    // 基础门槛
    let strongThreshold = 5;
    let moderateThreshold = 4;
    let weakThreshold = 3;

    // 总分很高时降低门槛
    if (normalizedScore >= 80) {
      strongThreshold = Math.max(3, strongThreshold - 2);
      moderateThreshold = Math.max(2, moderateThreshold - 2);
      weakThreshold = Math.max(1, weakThreshold - 1);
    } else if (normalizedScore >= 75) {
      strongThreshold = Math.max(3, strongThreshold - 1);
      moderateThreshold = Math.max(2, moderateThreshold - 1);
    }

    // 趋势很强时降低门槛
    if (trendScore >= 8) {
      strongThreshold = Math.max(3, strongThreshold - 1);
      moderateThreshold = Math.max(2, moderateThreshold - 1);
    }

    // 应用补偿
    strongThreshold = Math.max(1, strongThreshold - compensation);
    moderateThreshold = Math.max(1, moderateThreshold - compensation);
    weakThreshold = Math.max(1, weakThreshold - compensation);

    return {
      strong: Math.round(strongThreshold),
      moderate: Math.round(moderateThreshold),
      weak: Math.round(weakThreshold)
    };
  }

  /**
   * 执行增强版V3策略分析
   * @param {string} symbol - 交易对
   * @returns {Promise<Object>} 完整分析结果
   */
  async execute(symbol) {
    try {
      logger.info(`开始执行V3增强策略分析: ${symbol}`);

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

      // 使用增强版信号融合
      logger.info(`[${symbol}] 开始增强信号融合: 4H=${trend4H?.score}, 1H=${factors1H?.score}, 15M=${execution15M?.score}`);
      const finalSignal = this.combineSignals(trend4H, factors1H, execution15M);
      logger.info(`[${symbol}] 增强信号融合结果: ${finalSignal}`);

      // 计算交易参数
      let tradeParams = { entryPrice: 0, stopLoss: 0, takeProfit: 0, leverage: 0, margin: 0 };
      if (finalSignal !== 'HOLD') {
        const currentPrice = parseFloat(ticker24hr.lastPrice);
        const atr = TechnicalIndicators.calculateATR(klines15M, 14);
        const atrVal = atr[atr.length - 1];

        // 计算动态杠杆和仓位
        const totalScore = ((trend4H?.score || 0) + (factors1H?.score || 0) + (execution15M?.score || 0)) / 3;
        const confidence = totalScore / 10;
        const stopDistance = atrVal * 2 * (1 - confidence * 0.3); // 动态止损
        const leverage = Math.min(20, Math.max(1, Math.round(confidence * 20)));
        const margin = 100 * confidence; // 动态仓位

        tradeParams = {
          entryPrice: currentPrice,
          stopLoss: finalSignal === 'BUY' ? currentPrice - stopDistance : currentPrice + stopDistance,
          takeProfit: finalSignal === 'BUY' ? currentPrice + stopDistance * 2 : currentPrice - stopDistance * 2,
          leverage: leverage,
          margin: margin
        };
      }

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
        enhanced: true // 标记为增强版
      };

    } catch (error) {
      logger.error(`V3增强策略分析错误 ${symbol}:`, error);
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
        error: error.message,
        enhanced: true
      };
    }
  }
}

module.exports = V3StrategyEnhanced;
