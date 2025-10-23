/**
 * ICT策略重构版本
 * 完全解耦，参数驱动，支持差异化配置
 */

const BaseStrategy = require('../core/base-strategy');
const logger = require('../utils/logger');

class ICTStrategy extends BaseStrategy {
  constructor() {
    super();
    this.name = 'ICT';
    this.timeframes = ['1h', '4h', '15m', '5m'];
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

      // ICT特有参数
      liquiditySweepThreshold: 0.002,
      orderBlockStrength: 0.6,
      fairValueGapThreshold: 0.001,
      marketStructureBreakThreshold: 0.005,

      // 多时间框架参数
      multiTimeframe: {
        weight4H: 0.4,
        weight1H: 0.3,
        weight15M: 0.2,
        weight5M: 0.1
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

    logger.info(`[ICT策略] ${this.mode}模式阈值更新:`, this.thresholds);
  }

  /**
   * 计算指标
   * @param {Object} marketData - 市场数据
   * @returns {Object} 指标数据
   */
  async calculateIndicators(marketData) {
    try {
      // 计算多时间框架指标
      const multiTimeframeIndicators = await this.calculateMultiTimeframeIndicators(marketData);

      // 分析市场结构
      const marketStructure = this.analyzeMarketStructure(multiTimeframeIndicators);

      // 检测ICT信号
      const ictSignals = this.detectICTSignals(multiTimeframeIndicators, marketStructure);

      // 计算综合评分
      const trendScore = this.calculateTrendScore(multiTimeframeIndicators, marketStructure);
      const factorScore = this.calculateFactorScore(ictSignals, marketStructure);
      const entryScore = this.calculateEntryScore(ictSignals, marketStructure);

      logger.info(`[ICT策略] 指标计算完成: 趋势=${trendScore}, 因子=${factorScore}, 入场=${entryScore}, 方向=${marketStructure.trend}`);

      return {
        trendScore,
        factorScore,
        entryScore,
        trendDirection: marketStructure.trend,
        marketStructure,
        ictSignals
      };
    } catch (error) {
      logger.error(`[ICT策略] 指标计算失败`, error);
      return {
        trendScore: 0,
        factorScore: 0,
        entryScore: 0,
        trendDirection: 'NEUTRAL',
        marketStructure: { trend: 'NEUTRAL', strength: 0 },
        ictSignals: {}
      };
    }
  }

  /**
   * 计算多时间框架指标
   * @param {Object} marketData - 市场数据
   * @returns {Object} 多时间框架指标
   */
  async calculateMultiTimeframeIndicators(marketData) {
    const indicators = {};

    for (const timeframe of this.timeframes) {
      const data = marketData[timeframe] || marketData.klines;
      if (data && data.length > 0) {
        indicators[timeframe] = {
          trend: this.calculateTrend(data),
          momentum: this.calculateMomentum(data),
          volatility: this.calculateVolatility(data),
          volume: this.calculateVolume(data),
          keyLevels: this.identifyKeyLevels(data)
        };
      }
    }

    return indicators;
  }

  /**
   * 分析市场结构
   * @param {Object} indicators - 多时间框架指标
   * @returns {Object} 市场结构
   */
  analyzeMarketStructure(indicators) {
    const structure = {
      trend: 'NEUTRAL',
      strength: 0,
      keyLevels: [],
      supportResistance: []
    };

    // 4H趋势分析
    if (indicators['4h']) {
      structure.trend = this.determineTrend(indicators['4h']);
      structure.strength = this.calculateTrendStrength(indicators['4h']);
    }

    // 关键位分析
    structure.keyLevels = this.identifyKeyLevels(indicators);
    structure.supportResistance = this.identifySupportResistance(indicators);

    return structure;
  }

  /**
   * 检测ICT信号
   * @param {Object} indicators - 多时间框架指标
   * @param {Object} marketStructure - 市场结构
   * @returns {Object} ICT信号
   */
  detectICTSignals(indicators, marketStructure) {
    const signals = {
      liquiditySweep: this.detectLiquiditySweep(indicators),
      orderBlock: this.detectOrderBlock(indicators),
      fairValueGap: this.detectFairValueGap(indicators),
      marketStructureBreak: this.detectMarketStructureBreak(indicators, marketStructure)
    };

    return signals;
  }

  /**
   * 计算趋势评分
   * @param {Object} indicators - 多时间框架指标
   * @param {Object} marketStructure - 市场结构
   * @returns {number} 趋势评分
   */
  calculateTrendScore(indicators, marketStructure) {
    let score = 0;
    const weights = this.parameters.multiTimeframe;

    // 4H趋势权重最高
    if (indicators['4h']) {
      score += this.calculateTimeframeTrendScore(indicators['4h']) * weights.weight4H;
    }

    // 1H趋势
    if (indicators['1h']) {
      score += this.calculateTimeframeTrendScore(indicators['1h']) * weights.weight1H;
    }

    // 15M趋势
    if (indicators['15m']) {
      score += this.calculateTimeframeTrendScore(indicators['15m']) * weights.weight15M;
    }

    // 5M趋势
    if (indicators['5m']) {
      score += this.calculateTimeframeTrendScore(indicators['5m']) * weights.weight5M;
    }

    // 市场结构强度
    score += marketStructure.strength * 0.2;

    return Math.min(score, 1.0);
  }

  /**
   * 计算多因子评分
   * @param {Object} ictSignals - ICT信号
   * @param {Object} marketStructure - 市场结构
   * @returns {number} 多因子评分
   */
  calculateFactorScore(ictSignals, marketStructure) {
    let score = 0;

    // 流动性扫荡信号
    if (ictSignals.liquiditySweep && ictSignals.liquiditySweep.length > 0) {
      score += 0.3;
    }

    // 订单块信号
    if (ictSignals.orderBlock && ictSignals.orderBlock.length > 0) {
      score += 0.3;
    }

    // 公允价值缺口信号
    if (ictSignals.fairValueGap && ictSignals.fairValueGap.length > 0) {
      score += 0.2;
    }

    // 市场结构突破信号
    if (ictSignals.marketStructureBreak && ictSignals.marketStructureBreak.length > 0) {
      score += 0.2;
    }

    return Math.min(score, 1.0);
  }

  /**
   * 计算入场评分
   * @param {Object} ictSignals - ICT信号
   * @param {Object} marketStructure - 市场结构
   * @returns {number} 入场评分
   */
  calculateEntryScore(ictSignals, marketStructure) {
    let score = 0;

    // 基于市场结构的入场评分
    if (marketStructure.trend === 'UP' || marketStructure.trend === 'DOWN') {
      score += 0.4;
    }

    // 基于ICT信号的入场评分
    const signalCount = Object.values(ictSignals).reduce((count, signals) => {
      return count + (Array.isArray(signals) ? signals.length : 0);
    }, 0);

    score += Math.min(signalCount * 0.1, 0.6);

    return Math.min(score, 1.0);
  }

  /**
   * 计算单时间框架趋势评分
   * @param {Object} timeframeData - 时间框架数据
   * @returns {number} 趋势评分
   */
  calculateTimeframeTrendScore(timeframeData) {
    let score = 0;

    // 趋势方向评分
    if (timeframeData.trend.direction === 'UP' || timeframeData.trend.direction === 'DOWN') {
      score += 0.5;
    }

    // 趋势强度评分
    score += timeframeData.trend.strength * 0.3;

    // 动量确认评分
    if (timeframeData.momentum.rsi > 30 && timeframeData.momentum.rsi < 70) {
      score += 0.2;
    }

    return Math.min(score, 1.0);
  }

  /**
   * 确定趋势方向
   * @param {Object} timeframeData - 时间框架数据
   * @returns {string} 趋势方向
   */
  determineTrend(timeframeData) {
    return timeframeData.trend.direction;
  }

  /**
   * 计算趋势强度
   * @param {Object} timeframeData - 时间框架数据
   * @returns {number} 趋势强度
   */
  calculateTrendStrength(timeframeData) {
    return timeframeData.trend.strength;
  }

  /**
   * 识别关键位
   * @param {Object} indicators - 多时间框架指标
   * @returns {Array} 关键位
   */
  identifyKeyLevels(indicators) {
    const keyLevels = [];

    for (const [timeframe, data] of Object.entries(indicators)) {
      if (data.keyLevels) {
        keyLevels.push(...data.keyLevels.map(level => ({
          ...level,
          timeframe
        })));
      }
    }

    return keyLevels;
  }

  /**
   * 识别支撑阻力位
   * @param {Object} indicators - 多时间框架指标
   * @returns {Array} 支撑阻力位
   */
  identifySupportResistance(indicators) {
    const levels = [];

    for (const [timeframe, data] of Object.entries(indicators)) {
      if (data.supportResistance) {
        levels.push(...data.supportResistance.map(level => ({
          ...level,
          timeframe
        })));
      }
    }

    return levels;
  }

  /**
   * 检测流动性扫荡
   * @param {Object} indicators - 多时间框架指标
   * @returns {Array} 流动性扫荡信号
   */
  detectLiquiditySweep(indicators) {
    const signals = [];
    const threshold = this.parameters.liquiditySweepThreshold;

    for (const [timeframe, data] of Object.entries(indicators)) {
      if (data.keyLevels) {
        const sweeps = data.keyLevels.filter(level =>
          level.type === 'liquidity' && level.strength > threshold
        );
        signals.push(...sweeps.map(sweep => ({
          ...sweep,
          timeframe
        })));
      }
    }

    return signals;
  }

  /**
   * 检测订单块
   * @param {Object} indicators - 多时间框架指标
   * @returns {Array} 订单块信号
   */
  detectOrderBlock(indicators) {
    const signals = [];
    const strength = this.parameters.orderBlockStrength;

    for (const [timeframe, data] of Object.entries(indicators)) {
      if (data.keyLevels) {
        const blocks = data.keyLevels.filter(level =>
          level.type === 'orderBlock' && level.strength > strength
        );
        signals.push(...blocks.map(block => ({
          ...block,
          timeframe
        })));
      }
    }

    return signals;
  }

  /**
   * 检测公允价值缺口
   * @param {Object} indicators - 多时间框架指标
   * @returns {Array} 公允价值缺口信号
   */
  detectFairValueGap(indicators) {
    const signals = [];
    const threshold = this.parameters.fairValueGapThreshold;

    for (const [timeframe, data] of Object.entries(indicators)) {
      if (data.keyLevels) {
        const gaps = data.keyLevels.filter(level =>
          level.type === 'fairValueGap' && level.strength > threshold
        );
        signals.push(...gaps.map(gap => ({
          ...gap,
          timeframe
        })));
      }
    }

    return signals;
  }

  /**
   * 检测市场结构突破
   * @param {Object} indicators - 多时间框架指标
   * @param {Object} marketStructure - 市场结构
   * @returns {Array} 市场结构突破信号
   */
  detectMarketStructureBreak(indicators, marketStructure) {
    const signals = [];
    const threshold = this.parameters.marketStructureBreakThreshold;

    for (const [timeframe, data] of Object.entries(indicators)) {
      if (data.keyLevels) {
        const breaks = data.keyLevels.filter(level =>
          level.type === 'structureBreak' && level.strength > threshold
        );
        signals.push(...breaks.map(break_ => ({
          ...break_,
          timeframe
        })));
      }
    }

    return signals;
  }

  // 技术指标计算方法
  calculateTrend(data) {
    const ema20 = this.calculateEMA(data, 20);
    const ema50 = this.calculateEMA(data, 50);
    const currentPrice = data[data.length - 1][4];

    const trend = {
      direction: currentPrice > ema20 && ema20 > ema50 ? 'UP' :
        currentPrice < ema20 && ema20 < ema50 ? 'DOWN' : 'NEUTRAL',
      strength: Math.abs(currentPrice - ema20) / ema20,
      ema20,
      ema50
    };

    return trend;
  }

  calculateMomentum(data) {
    const rsi = this.calculateRSI(data, 14);
    const macd = this.calculateMACD(data);

    return {
      rsi,
      macd,
      divergence: this.detectDivergence(data, rsi, macd)
    };
  }

  calculateVolatility(data) {
    const atr = this.calculateATR(data, 14);
    const bollinger = this.calculateBollingerBands(data, 20, 2);

    return {
      atr,
      bollinger,
      volatility: atr / data[data.length - 1][4]
    };
  }

  calculateVolume(data) {
    const volumes = data.map(candle => candle[5]);
    const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
    const currentVolume = data[data.length - 1][5];

    return {
      current: currentVolume,
      average: avgVolume,
      ratio: currentVolume / avgVolume
    };
  }

  identifyKeyLevels(data) {
    // 简化的关键位识别
    const levels = [];
    const high = Math.max(...data.map(c => c[2]));
    const low = Math.min(...data.map(c => c[3]));
    const close = data[data.length - 1][4];

    // 识别支撑阻力位
    levels.push({
      type: 'support',
      level: low,
      strength: 0.8,
      touches: 1
    });

    levels.push({
      type: 'resistance',
      level: high,
      strength: 0.8,
      touches: 1
    });

    // 识别流动性位
    levels.push({
      type: 'liquidity',
      level: high + (high - low) * 0.1,
      strength: 0.6,
      touches: 1
    });

    levels.push({
      type: 'liquidity',
      level: low - (high - low) * 0.1,
      strength: 0.6,
      touches: 1
    });

    return levels;
  }

  detectDivergence(data, rsi, macd) {
    // 简化的背离检测
    return {
      bullish: false,
      bearish: false
    };
  }

  calculateBollingerBands(data, period = 20, stdDev = 2) {
    const prices = data.map(c => c[4]);
    const sma = prices.slice(-period).reduce((sum, p) => sum + p, 0) / period;
    const variance = prices.slice(-period).reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / period;
    const stdDeviation = Math.sqrt(variance);

    return {
      upper: sma + (stdDeviation * stdDev),
      middle: sma,
      lower: sma - (stdDeviation * stdDev)
    };
  }

  // 继承基类的技术指标计算方法
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
}

module.exports = ICTStrategy;
