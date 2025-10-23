/**
 * 策略基类
 * 提供策略的通用功能和接口
 */

const logger = require('../utils/logger');

class BaseStrategy {
  constructor() {
    this.parameters = {};
    this.mode = 'BALANCED';
    this.thresholds = {};
    this.indicators = null;
    this.name = 'BaseStrategy';
  }

  /**
   * 应用参数
   * @param {Object} parameters - 参数
   */
  applyParameters(parameters) {
    this.parameters = { ...this.parameters, ...parameters };
    this.updateThresholds();
    logger.info(`[${this.name}] 应用参数完成`, Object.keys(parameters));
  }

  /**
   * 设置模式
   * @param {string} mode - 模式
   */
  setMode(mode) {
    this.mode = mode;
    this.updateThresholds();
    logger.info(`[${this.name}] 设置模式: ${mode}`);
  }

  /**
   * 更新阈值
   * 子类需要重写此方法
   */
  updateThresholds() {
    // 默认实现，子类需要重写
    this.thresholds = {
      strong: { score: 0.8, trend: 0.8, factor: 0.8, entry: 0.8 },
      moderate: { score: 0.6, trend: 0.6, factor: 0.6, entry: 0.6 },
      weak: { score: 0.4, trend: 0.4, factor: 0.4, entry: 0.4 }
    };
  }

  /**
   * 执行策略
   * @param {Object} marketData - 市场数据
   * @returns {Object} 策略执行结果
   */
  async execute(marketData) {
    try {
      // 计算指标
      const indicators = await this.calculateIndicators(marketData);

      // 生成信号
      const signal = this.generateSignal(indicators);

      // 计算止损止盈
      const stopLoss = this.calculateStopLoss(marketData, signal);
      const takeProfit = this.calculateTakeProfit(marketData, signal, stopLoss);

      return {
        signal: signal.direction,
        confidence: signal.confidence,
        stopLoss,
        takeProfit,
        metadata: {
          ...signal.metadata,
          mode: this.mode,
          parameters: this.parameters
        }
      };
    } catch (error) {
      logger.error(`[${this.name}] 执行失败`, error);
      return {
        signal: 'HOLD',
        confidence: 'low',
        error: error.message
      };
    }
  }

  /**
   * 计算指标
   * @param {Object} marketData - 市场数据
   * @returns {Object} 指标数据
   */
  async calculateIndicators(marketData) {
    // 默认实现，子类需要重写
    return {
      trendScore: 0,
      factorScore: 0,
      entryScore: 0,
      trendDirection: 'NEUTRAL'
    };
  }

  /**
   * 生成信号
   * @param {Object} indicators - 指标数据
   * @returns {Object} 信号
   */
  generateSignal(indicators) {
    const { trendScore, factorScore, entryScore } = indicators;
    const totalScore = (trendScore + factorScore + entryScore) / 3;

    // 根据阈值判断信号强度
    if (totalScore >= this.thresholds.strong.score) {
      return {
        direction: indicators.trendDirection === 'UP' ? 'BUY' : 'SELL',
        confidence: 'high',
        metadata: { score: totalScore, level: 'strong' }
      };
    } else if (totalScore >= this.thresholds.moderate.score) {
      return {
        direction: indicators.trendDirection === 'UP' ? 'BUY' : 'SELL',
        confidence: 'med',
        metadata: { score: totalScore, level: 'moderate' }
      };
    } else if (totalScore >= this.thresholds.weak.score) {
      return {
        direction: indicators.trendDirection === 'UP' ? 'BUY' : 'SELL',
        confidence: 'low',
        metadata: { score: totalScore, level: 'weak' }
      };
    }

    return {
      direction: 'HOLD',
      confidence: 'low',
      metadata: { score: totalScore }
    };
  }

  /**
   * 计算止损
   * @param {Object} marketData - 市场数据
   * @param {Object} signal - 信号
   * @returns {number} 止损价格
   */
  calculateStopLoss(marketData, signal) {
    if (signal.direction === 'HOLD') return 0;

    const atr = this.calculateATR(marketData.klines, 14);
    const multiplier = this.parameters.stopLossATRMultiplier || 0.5;
    const stopDistance = atr * multiplier;

    return signal.direction === 'BUY'
      ? marketData.currentPrice - stopDistance
      : marketData.currentPrice + stopDistance;
  }

  /**
   * 计算止盈
   * @param {Object} marketData - 市场数据
   * @param {Object} signal - 信号
   * @param {number} stopLoss - 止损价格
   * @returns {number} 止盈价格
   */
  calculateTakeProfit(marketData, signal, stopLoss) {
    if (signal.direction === 'HOLD' || stopLoss === 0) return 0;

    const stopDistance = Math.abs(marketData.currentPrice - stopLoss);
    const takeProfitRatio = this.parameters.takeProfitRatio || 3.0;
    const takeProfitDistance = stopDistance * takeProfitRatio;

    return signal.direction === 'BUY'
      ? marketData.currentPrice + takeProfitDistance
      : marketData.currentPrice - takeProfitDistance;
  }

  /**
   * 计算ATR
   * @param {Array} klines - K线数据
   * @param {number} period - 周期
   * @returns {number} ATR值
   */
  calculateATR(klines, period = 14) {
    if (!klines || klines.length < period + 1) return 0;

    const trueRanges = [];
    for (let i = 1; i < klines.length; i++) {
      const current = klines[i];
      const previous = klines[i - 1];

      const high = current[2];
      const low = current[3];
      const prevClose = previous[4];

      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );

      trueRanges.push(tr);
    }

    // 计算ATR（简单移动平均）
    const atr = trueRanges.slice(-period).reduce((sum, tr) => sum + tr, 0) / period;
    return atr;
  }

  /**
   * 获取模式参数
   * @returns {Object} 模式参数
   */
  getModeParameters() {
    const baseParams = this.parameters;
    const modeMultipliers = {
      AGGRESSIVE: { strong: 0.5, moderate: 0.3, weak: 0.1 },
      BALANCED: { strong: 0.7, moderate: 0.5, weak: 0.3 },
      CONSERVATIVE: { strong: 0.9, moderate: 0.7, weak: 0.5 }
    };

    const multiplier = modeMultipliers[this.mode] || modeMultipliers.BALANCED;

    return {
      strong: {
        score: baseParams.trend4HStrongThreshold * multiplier.strong,
        trend: baseParams.trend4HStrongThreshold * multiplier.strong,
        factor: baseParams.entry15MStrongThreshold * multiplier.strong,
        entry: baseParams.entry15MStrongThreshold * multiplier.strong
      },
      moderate: {
        score: baseParams.trend4HModerateThreshold * multiplier.moderate,
        trend: baseParams.trend4HModerateThreshold * multiplier.moderate,
        factor: baseParams.entry15MModerateThreshold * multiplier.moderate,
        entry: baseParams.entry15MModerateThreshold * multiplier.moderate
      },
      weak: {
        score: baseParams.trend4HWeakThreshold * multiplier.weak,
        trend: baseParams.trend4HWeakThreshold * multiplier.weak,
        factor: baseParams.entry15MWeakThreshold * multiplier.weak,
        entry: baseParams.entry15MWeakThreshold * multiplier.weak
      }
    };
  }
}

module.exports = BaseStrategy;
