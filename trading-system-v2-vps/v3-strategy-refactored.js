/**
 * V3策略重构版本
 * 完全解耦，参数驱动，支持差异化配置
 */

const BaseStrategy = require('../core/base-strategy');
const logger = require('../utils/logger');

class V3Strategy extends BaseStrategy {
  constructor() {
    super();
    this.name = 'V3';
    this.initializeDefaultParameters();
  }

  /**
   * 初始化默认参数
   */
  initializeDefaultParameters() {
    this.parameters = {
      // 趋势判断参数
      trend4HStrongThreshold: 0.8,
      trend4HModerateThreshold: 0.6,
      trend4HWeakThreshold: 0.4,

      // 入场信号参数
      entry15MStrongThreshold: 0.7,
      entry15MModerateThreshold: 0.5,
      entry15MWeakThreshold: 0.3,

      // 止损止盈参数
      stopLossATRMultiplier: 0.5,
      takeProfitRatio: 3.0,

      // 假突破过滤参数
      fakeBreakoutFilter: {
        volFactor: 0.2,
        deltaThreshold: 0.0005,
        reclaimPct: 0.001
      },

      // 早期趋势检测参数
      earlyTrendDetector: {
        macdHistThreshold: 0.5,
        macdConsecutiveBars: 2,
        deltaThreshold: 0.05,
        adxMin: 20,
        adx4HMax: 40,
        weightBonus: 0.2
      }
    };
  }

  /**
   * 更新阈值
   */
  updateThresholds() {
    const modeParams = this.getModeParameters();
    this.thresholds = {
      strong: modeParams.strong,
      moderate: modeParams.moderate,
      weak: modeParams.weak
    };

    logger.info(`[V3策略] ${this.mode}模式阈值更新:`, this.thresholds);
  }

  /**
   * 计算指标
   * @param {Object} marketData - 市场数据
   * @returns {Object} 指标数据
   */
  async calculateIndicators(marketData) {
    try {
      const klines = marketData.klines || [];
      if (klines.length < 50) {
        return {
          trendScore: 0,
          factorScore: 0,
          entryScore: 0,
          trendDirection: 'NEUTRAL'
        };
      }

      // 计算趋势评分
      const trendScore = this.calculateTrendScore(klines);

      // 计算多因子评分
      const factorScore = this.calculateFactorScore(klines);

      // 计算入场评分
      const entryScore = this.calculateEntryScore(klines);

      // 确定趋势方向
      const trendDirection = this.determineTrendDirection(klines);

      logger.info(`[V3策略] 指标计算完成: 趋势=${trendScore}, 因子=${factorScore}, 入场=${entryScore}, 方向=${trendDirection}`);

      return {
        trendScore,
        factorScore,
        entryScore,
        trendDirection
      };
    } catch (error) {
      logger.error(`[V3策略] 指标计算失败`, error);
      return {
        trendScore: 0,
        factorScore: 0,
        entryScore: 0,
        trendDirection: 'NEUTRAL'
      };
    }
  }

  /**
   * 计算趋势评分
   * @param {Array} klines - K线数据
   * @returns {number} 趋势评分
   */
  calculateTrendScore(klines) {
    try {
      // 计算4H趋势
      const ema20 = this.calculateEMA(klines, 20);
      const ema50 = this.calculateEMA(klines, 50);
      const currentPrice = klines[klines.length - 1][4];

      let trendScore = 0;

      // 趋势方向评分
      if (currentPrice > ema20 && ema20 > ema50) {
        trendScore += 0.4; // 上升趋势
      } else if (currentPrice < ema20 && ema20 < ema50) {
        trendScore += 0.4; // 下降趋势
      }

      // 趋势强度评分
      const trendStrength = Math.abs(currentPrice - ema20) / ema20;
      trendScore += Math.min(trendStrength * 2, 0.4);

      // ADX评分
      const adx = this.calculateADX(klines, 14);
      if (adx > 25) {
        trendScore += 0.2;
      }

      return Math.min(trendScore, 1.0);
    } catch (error) {
      logger.error(`[V3策略] 趋势评分计算失败`, error);
      return 0;
    }
  }

  /**
   * 计算多因子评分
   * @param {Array} klines - K线数据
   * @returns {number} 多因子评分
   */
  calculateFactorScore(klines) {
    try {
      let factorScore = 0;

      // RSI评分
      const rsi = this.calculateRSI(klines, 14);
      if (rsi > 30 && rsi < 70) {
        factorScore += 0.2;
      }

      // MACD评分
      const macd = this.calculateMACD(klines);
      if (macd.histogram > 0) {
        factorScore += 0.2;
      }

      // 成交量评分
      const volumeScore = this.calculateVolumeScore(klines);
      factorScore += volumeScore * 0.3;

      // 波动率评分
      const volatilityScore = this.calculateVolatilityScore(klines);
      factorScore += volatilityScore * 0.3;

      return Math.min(factorScore, 1.0);
    } catch (error) {
      logger.error(`[V3策略] 多因子评分计算失败`, error);
      return 0;
    }
  }

  /**
   * 计算入场评分
   * @param {Array} klines - K线数据
   * @returns {number} 入场评分
   */
  calculateEntryScore(klines) {
    try {
      let entryScore = 0;

      // 15分钟级别入场信号
      const entry15M = this.calculate15MEntryScore(klines);
      entryScore += entry15M * 0.4;

      // 假突破过滤
      const fakeBreakoutFilter = this.applyFakeBreakoutFilter(klines);
      entryScore += fakeBreakoutFilter * 0.3;

      // 早期趋势检测
      const earlyTrend = this.detectEarlyTrend(klines);
      entryScore += earlyTrend * 0.3;

      return Math.min(entryScore, 1.0);
    } catch (error) {
      logger.error(`[V3策略] 入场评分计算失败`, error);
      return 0;
    }
  }

  /**
   * 确定趋势方向
   * @param {Array} klines - K线数据
   * @returns {string} 趋势方向
   */
  determineTrendDirection(klines) {
    try {
      const ema20 = this.calculateEMA(klines, 20);
      const ema50 = this.calculateEMA(klines, 50);
      const currentPrice = klines[klines.length - 1][4];

      if (currentPrice > ema20 && ema20 > ema50) {
        return 'UP';
      } else if (currentPrice < ema20 && ema20 < ema50) {
        return 'DOWN';
      } else {
        return 'NEUTRAL';
      }
    } catch (error) {
      logger.error(`[V3策略] 趋势方向确定失败`, error);
      return 'NEUTRAL';
    }
  }

  /**
   * 计算15分钟入场评分
   * @param {Array} klines - K线数据
   * @returns {number} 入场评分
   */
  calculate15MEntryScore(klines) {
    try {
      if (klines.length < 20) return 0;

      let score = 0;

      // 最近几根K线的价格行为
      const recentKlines = klines.slice(-5);
      const priceAction = this.analyzePriceAction(recentKlines);
      score += priceAction * 0.5;

      // 成交量确认
      const volumeConfirmation = this.analyzeVolumeConfirmation(recentKlines);
      score += volumeConfirmation * 0.5;

      return Math.min(score, 1.0);
    } catch (error) {
      logger.error(`[V3策略] 15分钟入场评分计算失败`, error);
      return 0;
    }
  }

  /**
   * 应用假突破过滤
   * @param {Array} klines - K线数据
   * @returns {number} 过滤评分
   */
  applyFakeBreakoutFilter(klines) {
    try {
      const params = this.parameters.fakeBreakoutFilter;
      let score = 1.0;

      // 成交量过滤
      const volumeScore = this.analyzeVolumeFilter(klines, params.volFactor);
      score *= volumeScore;

      // Delta过滤
      const deltaScore = this.analyzeDeltaFilter(klines, params.deltaThreshold);
      score *= deltaScore;

      // 回撤过滤
      const reclaimScore = this.analyzeReclaimFilter(klines, params.reclaimPct);
      score *= reclaimScore;

      return score;
    } catch (error) {
      logger.error(`[V3策略] 假突破过滤失败`, error);
      return 0.5;
    }
  }

  /**
   * 检测早期趋势
   * @param {Array} klines - K线数据
   * @returns {number} 早期趋势评分
   */
  detectEarlyTrend(klines) {
    try {
      const params = this.parameters.earlyTrendDetector;
      let score = 0;

      // MACD直方图分析
      const macd = this.calculateMACD(klines);
      if (macd.histogram > params.macdHistThreshold) {
        score += 0.3;
      }

      // ADX分析
      const adx = this.calculateADX(klines, 14);
      if (adx > params.adxMin) {
        score += 0.3;
      }

      // Delta分析
      const delta = this.calculateDelta(klines);
      if (delta > params.deltaThreshold) {
        score += 0.4;
      }

      return Math.min(score, 1.0);
    } catch (error) {
      logger.error(`[V3策略] 早期趋势检测失败`, error);
      return 0;
    }
  }

  // 技术指标计算方法
  calculateEMA(klines, period) {
    if (klines.length < period) return 0;

    const prices = klines.map(k => k[4]);
    const multiplier = 2 / (period + 1);
    let ema = prices[0];

    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }

    return ema;
  }

  calculateRSI(klines, period = 14) {
    if (klines.length < period + 1) return 50;

    const prices = klines.map(k => k[4]);
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  calculateMACD(klines) {
    const ema12 = this.calculateEMA(klines, 12);
    const ema26 = this.calculateEMA(klines, 26);
    const macdLine = ema12 - ema26;
    const signalLine = this.calculateEMA(klines.map((k, i) => [0, 0, 0, 0, macdLine]), 9);

    return {
      macd: macdLine,
      signal: signalLine,
      histogram: macdLine - signalLine
    };
  }

  calculateADX(klines, period = 14) {
    if (klines.length < period + 1) return 0;

    const trueRanges = [];
    const plusDMs = [];
    const minusDMs = [];

    for (let i = 1; i < klines.length; i++) {
      const current = klines[i];
      const previous = klines[i - 1];

      const high = current[2];
      const low = current[3];
      const prevHigh = previous[2];
      const prevLow = previous[3];

      const tr = Math.max(high - low, Math.abs(high - previous[4]), Math.abs(low - previous[4]));
      trueRanges.push(tr);

      const plusDM = high - prevHigh > prevLow - low ? Math.max(high - prevHigh, 0) : 0;
      const minusDM = prevLow - low > high - prevHigh ? Math.max(prevLow - low, 0) : 0;

      plusDMs.push(plusDM);
      minusDMs.push(minusDM);
    }

    const atr = trueRanges.slice(-period).reduce((sum, tr) => sum + tr, 0) / period;
    const plusDI = (plusDMs.slice(-period).reduce((sum, dm) => sum + dm, 0) / period) / atr * 100;
    const minusDI = (minusDMs.slice(-period).reduce((sum, dm) => sum + dm, 0) / period) / atr * 100;

    const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;
    return dx;
  }

  calculateDelta(klines) {
    if (klines.length < 2) return 0;

    const current = klines[klines.length - 1];
    const previous = klines[klines.length - 2];

    const currentDelta = (current[2] - current[3]) / current[4];
    const previousDelta = (previous[2] - previous[3]) / previous[4];

    return Math.abs(currentDelta - previousDelta);
  }

  analyzePriceAction(klines) {
    if (klines.length < 2) return 0;

    let score = 0;

    // 分析K线形态
    for (let i = 0; i < klines.length - 1; i++) {
      const current = klines[i];
      const next = klines[i + 1];

      const currentBody = Math.abs(current[4] - current[1]);
      const currentRange = current[2] - current[3];
      const bodyRatio = currentBody / currentRange;

      if (bodyRatio > 0.6) {
        score += 0.2; // 实体较大的K线
      }

      if (current[4] > current[1] && next[4] > next[1]) {
        score += 0.1; // 连续上涨
      } else if (current[4] < current[1] && next[4] < next[1]) {
        score += 0.1; // 连续下跌
      }
    }

    return Math.min(score, 1.0);
  }

  analyzeVolumeConfirmation(klines) {
    if (klines.length < 5) return 0;

    const volumes = klines.map(k => k[5]);
    const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
    const currentVolume = volumes[volumes.length - 1];

    return Math.min(currentVolume / avgVolume, 2.0) / 2.0;
  }

  analyzeVolumeFilter(klines, volFactor) {
    const volumes = klines.map(k => k[5]);
    const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
    const currentVolume = volumes[volumes.length - 1];

    return currentVolume > avgVolume * volFactor ? 1.0 : 0.5;
  }

  analyzeDeltaFilter(klines, deltaThreshold) {
    const delta = this.calculateDelta(klines);
    return delta > deltaThreshold ? 1.0 : 0.5;
  }

  analyzeReclaimFilter(klines, reclaimPct) {
    if (klines.length < 3) return 1.0;

    const current = klines[klines.length - 1];
    const previous = klines[klines.length - 2];

    const reclaim = Math.abs(current[4] - previous[4]) / previous[4];
    return reclaim < reclaimPct ? 1.0 : 0.5;
  }

  calculateVolumeScore(klines) {
    if (klines.length < 10) return 0;

    const volumes = klines.map(k => k[5]);
    const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
    const recentVolume = volumes.slice(-3).reduce((sum, v) => sum + v, 0) / 3;

    return Math.min(recentVolume / avgVolume, 2.0) / 2.0;
  }

  calculateVolatilityScore(klines) {
    if (klines.length < 20) return 0;

    const atr = this.calculateATR(klines, 14);
    const currentPrice = klines[klines.length - 1][4];
    const volatility = atr / currentPrice;

    // 适中的波动率得分更高
    if (volatility > 0.01 && volatility < 0.05) {
      return 1.0;
    } else if (volatility > 0.005 && volatility < 0.1) {
      return 0.7;
    } else {
      return 0.3;
    }
  }
}

module.exports = V3Strategy;
