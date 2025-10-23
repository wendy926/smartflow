/**
 * V3.1策略参数配置管理器
 * 根据不同市场环境动态调整参数
 */

class V31ParameterConfigs {
  constructor() {
    // 市场环境检测参数
    this.marketConditions = {
      TRENDING: 'trending',      // 趋势市场
      RANGING: 'ranging',       // 震荡市场
      VOLATILE: 'volatile',     // 高波动市场
      CALM: 'calm'             // 低波动市场
    };

    // 基础参数配置
    this.baseConfigs = {
      // 趋势市场配置 - 适合单边行情
      [this.marketConditions.TRENDING]: {
        signalThresholds: {
          strong: 20,      // 强信号阈值
          moderate: 15,    // 中等信号阈值
          weak: 10,        // 弱信号阈值
          veryWeak: 6,     // 极弱信号阈值
          ultraWeak: 3     // 超弱信号阈值
        },
        stopLoss: {
          kEntryHigh: 1.2,
          kEntryMed: 1.5,
          kEntryLow: 2.0,
          kHold: 2.5
        },
        takeProfit: {
          tpFactor: 4.0,   // 4:1盈亏比
          profitTrigger: 1.2,
          trailStep: 0.6
        },
        fakeBreakout: {
          volFactor: 1.0,
          deltaThreshold: 0.004,
          reclaimPct: 0.008
        }
      },

      // 震荡市场配置 - 适合区间交易
      [this.marketConditions.RANGING]: {
        signalThresholds: {
          strong: 25,
          moderate: 18,
          weak: 12,
          veryWeak: 8,
          ultraWeak: 4
        },
        stopLoss: {
          kEntryHigh: 0.8,
          kEntryMed: 1.0,
          kEntryLow: 1.2,
          kHold: 1.8
        },
        takeProfit: {
          tpFactor: 3.0,   // 3:1盈亏比
          profitTrigger: 0.8,
          trailStep: 0.4
        },
        fakeBreakout: {
          volFactor: 1.3,
          deltaThreshold: 0.006,
          reclaimPct: 0.004
        }
      },

      // 高波动市场配置 - 适合快速行情
      [this.marketConditions.VOLATILE]: {
        signalThresholds: {
          strong: 30,
          moderate: 22,
          weak: 15,
          veryWeak: 10,
          ultraWeak: 6
        },
        stopLoss: {
          kEntryHigh: 1.5,
          kEntryMed: 2.0,
          kEntryLow: 2.5,
          kHold: 3.0
        },
        takeProfit: {
          tpFactor: 5.0,   // 5:1盈亏比
          profitTrigger: 1.5,
          trailStep: 0.8
        },
        fakeBreakout: {
          volFactor: 0.8,
          deltaThreshold: 0.003,
          reclaimPct: 0.010
        }
      },

      // 低波动市场配置 - 适合稳定行情
      [this.marketConditions.CALM]: {
        signalThresholds: {
          strong: 15,
          moderate: 10,
          weak: 6,
          veryWeak: 4,
          ultraWeak: 2
        },
        stopLoss: {
          kEntryHigh: 0.6,
          kEntryMed: 0.8,
          kEntryLow: 1.0,
          kHold: 1.5
        },
        takeProfit: {
          tpFactor: 2.5,   // 2.5:1盈亏比
          profitTrigger: 0.6,
          trailStep: 0.3
        },
        fakeBreakout: {
          volFactor: 1.5,
          deltaThreshold: 0.008,
          reclaimPct: 0.003
        }
      }
    };
  }

  /**
   * 检测当前市场环境
   * @param {Array} klines - K线数据
   * @param {string} timeframe - 时间框架
   * @returns {string} 市场环境类型
   */
  detectMarketCondition(klines, timeframe = '1h') {
    if (!klines || klines.length < 20) {
      return this.marketConditions.TRENDING; // 默认趋势市场
    }

    try {
      // 计算ATR和价格变化
      const prices = klines.map(k => parseFloat(k[4]));
      const highs = klines.map(k => parseFloat(k[2]));
      const lows = klines.map(k => parseFloat(k[3]));

      // 计算价格变化率
      const priceChange = Math.abs(prices[prices.length - 1] - prices[0]) / prices[0];

      // 计算ATR
      const atr = this.calculateATR(highs, lows, prices);
      const avgATR = atr.slice(-10).reduce((sum, val) => sum + val, 0) / 10;
      const atrRatio = avgATR / prices[prices.length - 1];

      // 计算价格波动性
      const priceVolatility = this.calculateVolatility(prices.slice(-20));

      // 市场环境判断逻辑
      if (atrRatio > 0.02 && priceVolatility > 0.03) {
        return this.marketConditions.VOLATILE; // 高波动
      } else if (atrRatio < 0.005 && priceVolatility < 0.01) {
        return this.marketConditions.CALM; // 低波动
      } else if (priceChange < 0.05 && priceVolatility < 0.02) {
        return this.marketConditions.RANGING; // 震荡
      } else {
        return this.marketConditions.TRENDING; // 趋势
      }
    } catch (error) {
      console.error('市场环境检测失败:', error);
      return this.marketConditions.TRENDING; // 默认趋势市场
    }
  }

  /**
   * 获取指定市场环境的参数配置
   * @param {string} marketCondition - 市场环境
   * @returns {Object} 参数配置
   */
  getConfig(marketCondition) {
    return this.baseConfigs[marketCondition] || this.baseConfigs[this.marketConditions.TRENDING];
  }

  /**
   * 根据市场环境动态调整参数
   * @param {Object} baseParams - 基础参数
   * @param {string} marketCondition - 市场环境
   * @returns {Object} 调整后的参数
   */
  adjustParameters(baseParams, marketCondition) {
    const config = this.getConfig(marketCondition);

    return {
      // 信号阈值调整
      signalThresholds: {
        strong: config.signalThresholds.strong,
        moderate: config.signalThresholds.moderate,
        weak: config.signalThresholds.weak,
        veryWeak: config.signalThresholds.veryWeak,
        ultraWeak: config.signalThresholds.ultraWeak
      },

      // 止损参数调整
      stopLoss: {
        kEntryHigh: config.stopLoss.kEntryHigh,
        kEntryMed: config.stopLoss.kEntryMed,
        kEntryLow: config.stopLoss.kEntryLow,
        kHold: config.stopLoss.kHold
      },

      // 止盈参数调整
      takeProfit: {
        tpFactor: config.takeProfit.tpFactor,
        profitTrigger: config.takeProfit.profitTrigger,
        trailStep: config.takeProfit.trailStep
      },

      // 假突破过滤参数调整
      fakeBreakout: {
        volFactor: config.fakeBreakout.volFactor,
        deltaThreshold: config.fakeBreakout.deltaThreshold,
        reclaimPct: config.fakeBreakout.reclaimPct
      }
    };
  }

  /**
   * 计算ATR
   * @param {Array} highs - 最高价数组
   * @param {Array} lows - 最低价数组
   * @param {Array} closes - 收盘价数组
   * @returns {Array} ATR数组
   */
  calculateATR(highs, lows, closes) {
    const tr = [];
    for (let i = 1; i < highs.length; i++) {
      const high = highs[i];
      const low = lows[i];
      const prevClose = closes[i - 1];

      const tr1 = high - low;
      const tr2 = Math.abs(high - prevClose);
      const tr3 = Math.abs(low - prevClose);

      tr.push(Math.max(tr1, tr2, tr3));
    }

    // 计算14周期ATR
    const atr = [];
    for (let i = 13; i < tr.length; i++) {
      const sum = tr.slice(i - 13, i + 1).reduce((s, v) => s + v, 0);
      atr.push(sum / 14);
    }

    return atr;
  }

  /**
   * 计算价格波动性
   * @param {Array} prices - 价格数组
   * @returns {number} 波动性
   */
  calculateVolatility(prices) {
    if (prices.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;

    return Math.sqrt(variance);
  }
}

module.exports = V31ParameterConfigs;
