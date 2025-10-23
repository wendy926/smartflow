const BaseStrategy = require('../core/base-strategy');
const logger = require('../utils/logger');

class V3StrategyRefactored extends BaseStrategy {
  constructor(logger) {
    super(logger);
    this.name = 'V3';
    this.initializeDefaultParameters();
    this.mode = 'BALANCED';
    this.updateThresholds();
  }

  initializeDefaultParameters() {
    this.parameters = {
      signalThresholds: { strong: 0.05, moderate: 0.4, weak: 0.2 },
      stopLossATRMultiplier: 0.4,
      takeProfitRatio: 3.5,
      entry15MStrongThreshold: 0.7,
      entry15MModerateThreshold: 0.5,
      entry15MWeakThreshold: 0.3,
      factorTrendWeight: 40,
      factorMomentumWeight: 20,
      factorVolumeWeight: 10,
      factorVolatilityWeight: 15,
      factorFundingWeight: 10,
      factorOIWeight: 5,
      leverageBuffer: 0.005,
      maxLeverage: 24,
      // V3.1优化参数
      trend4HStrongThreshold: 0.1,
      trend4HModerateThreshold: 0.05,
      trend4HWeakThreshold: 0.02,
      earlyTrendEnabled: true,
      fakeBreakoutFilterEnabled: true,
      dynamicStopLossEnabled: true,
      // 早期趋势探测参数
      earlyTrendMACDThreshold: 0.5,
      earlyTrendDeltaThreshold: 0.05,
      earlyTrendADXThreshold: 20,
      earlyTrendVWAPThreshold: 0.01,
      // 假突破过滤参数
      fakeBreakoutVolumeMultiplier: 1.1,
      fakeBreakoutPullbackThreshold: 0.006,
      // 动态止损参数
      dynamicStopLossHighMultiplier: 1.8,
      dynamicStopLossModerateMultiplier: 1.5,
      dynamicStopLossLowMultiplier: 1.2,
      // 盈亏比优化参数
      targetProfitLossRatio: 3.0,
      minProfitLossRatio: 2.0,
      maxProfitLossRatio: 5.0
    };
  }

  setParameters(parameters) {
    this.logger.info('[V3策略] 设置参数:', Object.keys(parameters).length, '个参数');
    this.parameters = { ...this.parameters, ...parameters };
    this.updateThresholds();
  }

  setMode(mode) {
    this.logger.info('[V3策略] 设置模式:', mode);
    this.mode = mode;
    this.updateThresholds();
  }

  updateThresholds() {
    // 根据模式调整参数 - 优化盈亏比到3:1
    if (this.mode === 'AGGRESSIVE') {
      this.parameters.signalThresholds = { strong: 0.05, moderate: 0.2, weak: 0.1 };
      this.parameters.trend4HStrongThreshold = 0.1;
      this.parameters.earlyTrendMACDThreshold = 0.3;
      this.parameters.earlyTrendDeltaThreshold = 0.03;
      this.parameters.fakeBreakoutVolumeMultiplier = 1.05;
      this.parameters.fakeBreakoutPullbackThreshold = 0.008;
      this.parameters.targetProfitLossRatio = 4.0; // 从3.0提升到4.0
      this.parameters.dynamicStopLossHighMultiplier = 1.2; // 从1.5收紧到1.2
      this.parameters.dynamicStopLossModerateMultiplier = 1.0; // 从1.2收紧到1.0
      this.parameters.dynamicStopLossLowMultiplier = 0.8; // 从1.0收紧到0.8
    } else if (this.mode === 'CONSERVATIVE') {
      this.parameters.signalThresholds = { strong: 0.08, moderate: 0.4, weak: 0.25 };
      this.parameters.trend4HStrongThreshold = 0.15;
      this.parameters.earlyTrendMACDThreshold = 0.6;
      this.parameters.earlyTrendDeltaThreshold = 0.06;
      this.parameters.fakeBreakoutVolumeMultiplier = 1.15;
      this.parameters.fakeBreakoutPullbackThreshold = 0.005;
      this.parameters.targetProfitLossRatio = 4.5; // 从4.0提升到4.5
      this.parameters.dynamicStopLossHighMultiplier = 1.5; // 从2.0收紧到1.5
      this.parameters.dynamicStopLossModerateMultiplier = 1.2; // 从1.6收紧到1.2
      this.parameters.dynamicStopLossLowMultiplier = 1.0; // 从1.3收紧到1.0
    } else {
      this.parameters.signalThresholds = { strong: 0.05, moderate: 0.4, weak: 0.2 };
      this.parameters.trend4HStrongThreshold = 0.2;
      this.parameters.earlyTrendMACDThreshold = 0.5;
      this.parameters.earlyTrendDeltaThreshold = 0.05;
      this.parameters.fakeBreakoutVolumeMultiplier = 1.1;
      this.parameters.fakeBreakoutPullbackThreshold = 0.006;
      this.parameters.targetProfitLossRatio = 4.0; // 从3.0提升到4.0
      this.parameters.dynamicStopLossHighMultiplier = 1.3; // 从1.8收紧到1.3
      this.parameters.dynamicStopLossModerateMultiplier = 1.1; // 从1.5收紧到1.1
      this.parameters.dynamicStopLossLowMultiplier = 0.9; // 从1.2收紧到0.9
    }

    // 确保关键参数有默认值
    this.parameters.stopLossATRMultiplier = this.parameters.stopLossATRMultiplier || 0.4;
    this.parameters.takeProfitRatio = this.parameters.takeProfitRatio || 3.5;
  }

  async calculateIndicators(marketData) {
    try {
      const klines = marketData.klines || [];
      if (klines.length < 50) {
        return { trendScore: 0, factorScore: 0, entryScore: 0, trendDirection: 'NEUTRAL' };
      }

      // 使用完整参数集进行指标计算
      const trendWeight = this.parameters.factorTrendWeight || 40;
      const momentumWeight = this.parameters.factorMomentumWeight || 20;
      const volumeWeight = this.parameters.factorVolumeWeight || 10;
      const volatilityWeight = this.parameters.factorVolatilityWeight || 15;
      const fundingWeight = this.parameters.factorFundingWeight || 10;
      const oiWeight = this.parameters.factorOIWeight || 5;

      // 趋势评分
      const trendScore = this.calculateTrendScore(klines);

      // 因子评分
      const factorScore = this.calculateFactorScore(klines);

      // 入场评分
      const entryScore = this.calculateEntryScore(klines);

      // 趋势方向 - 修复判断逻辑
      const trendDirection = this.determineTrendDirection(klines);

      this.logger.info('[V3策略] 指标计算完成:', {
        trend: trendScore,
        factor: factorScore,
        entry: entryScore,
        direction: trendDirection
      });

      return {
        trendScore,
        factorScore,
        entryScore,
        trendDirection
      };
    } catch (error) {
      this.logger.error('[V3策略] 指标计算失败', error);
      return { trendScore: 0, factorScore: 0, entryScore: 0, trendDirection: 'NEUTRAL' };
    }
  }

  generateSignal(indicators) {
    try {
      const { trendScore, factorScore, entryScore, trendDirection } = indicators;
      const threshold = this.parameters.signalThresholds || { strong: 0.05, moderate: 0.4, weak: 0.2 };
      const strongThreshold = this.parameters.trend4HStrongThreshold || threshold.strong;

      // 使用完整的参数集进行信号判断
      const entryThreshold = this.parameters.entry15MStrongThreshold || 0.7;
      const factorWeight = this.parameters.factorTrendWeight || 40;
      const momentumWeight = this.parameters.factorMomentumWeight || 20;
      const volumeWeight = this.parameters.factorVolumeWeight || 10;

      // 计算加权总评分
      const totalScore = (trendScore * factorWeight + factorScore * momentumWeight + entryScore * volumeWeight) / (factorWeight + momentumWeight + volumeWeight);

      let signal = 'HOLD';
      let confidence = 0;

      // 修复信号生成逻辑：放宽趋势方向要求
      this.logger.info('[V3策略] 信号判断详情:', {
        总评分: totalScore,
        强阈值: strongThreshold,
        趋势方向: trendDirection,
        评分vs阈值: totalScore >= strongThreshold
      });

      // 使用动态阈值进行信号判断 - 放宽趋势方向要求
      if (totalScore >= strongThreshold) {
        // 如果评分足够高，即使趋势方向为NEUTRAL也生成信号
        if (trendDirection === 'UP') {
          signal = 'BUY';
          confidence = Math.min(totalScore * 0.8, 0.8);
        } else if (trendDirection === 'DOWN') {
          signal = 'SELL';
          confidence = Math.min(totalScore * 0.8, 0.8);
        } else if (trendDirection === 'NEUTRAL' && totalScore >= strongThreshold * 1.5) {
          // 对于NEUTRAL趋势，需要更高的评分才生成信号
          signal = 'BUY'; // 默认BUY，可以根据其他指标调整
          confidence = Math.min(totalScore * 0.6, 0.6);
        }
      } else if (totalScore >= threshold.moderate) {
        if (trendDirection === 'UP') {
          signal = 'BUY';
          confidence = Math.min(totalScore * 0.6, 0.6);
        } else if (trendDirection === 'DOWN') {
          signal = 'SELL';
          confidence = Math.min(totalScore * 0.6, 0.6);
        }
      }

      this.logger.info('[V3策略] 信号生成:', {
        评分: totalScore,
        阈值: strongThreshold,
        信号: signal,
        置信度: confidence
      });

      return {
        direction: signal,
        confidence: confidence,
        metadata: {
          totalScore: totalScore,
          trendScore: trendScore,
          factorScore: factorScore,
          entryScore: entryScore,
          trendDirection: trendDirection,
          mode: this.mode
        }
      };
    } catch (error) {
      this.logger.error('[V3策略] 信号生成失败', error);
      return {
        direction: 'HOLD',
        confidence: 0,
        metadata: { error: error.message }
      };
    }
  }

  calculateStopLoss(marketData, signal) {
    try {
      const klines = marketData.klines || [];
      if (klines.length === 0) return 0;

      const currentPrice = parseFloat(klines[klines.length - 1][4]);
      const atr = this.calculateATR(klines, 14);

      // 使用动态止损
      const dynamicStopLoss = this.calculateDynamicStopLoss(marketData, signal, atr);

      this.logger.info('[V3策略] 止损计算:', {
        当前价格: currentPrice,
        ATR: atr,
        动态止损: dynamicStopLoss
      });

      return dynamicStopLoss;
    } catch (error) {
      this.logger.error('[V3策略] 止损计算失败', error);
      return 0;
    }
  }

  calculateTakeProfit(marketData, signal, stopLoss) {
    try {
      const klines = marketData.klines || [];
      if (klines.length === 0) return 0;

      const currentPrice = parseFloat(klines[klines.length - 1][4]);
      const riskRewardRatio = this.parameters.targetProfitLossRatio || 3.0;

      let takeProfit = 0;
      let risk = 0;
      if (signal.direction === 'BUY') {
        risk = Math.abs(currentPrice - stopLoss); // 修复：使用绝对值
        takeProfit = currentPrice + (risk * riskRewardRatio);
      } else if (signal.direction === 'SELL') {
        risk = Math.abs(stopLoss - currentPrice); // 修复：使用绝对值
        takeProfit = currentPrice - (risk * riskRewardRatio);
      }

      this.logger.info('[V3策略] 止盈计算:', {
        当前价格: currentPrice,
        止损: stopLoss,
        止盈: takeProfit,
        风险: risk,
        风险回报比: riskRewardRatio
      });

      return takeProfit;
    } catch (error) {
      this.logger.error('[V3策略] 止盈计算失败', error);
      return 0;
    }
  }

  // V3.1优化功能：早期趋势探测
  detectEarlyTrend(klines) {
    try {
      if (!this.parameters.earlyTrendEnabled) return { detected: false };

      const recent = klines.slice(-20);
      const prices = recent.map(k => parseFloat(k[4]));
      const volumes = recent.map(k => parseFloat(k[5]));

      // 计算MACD
      const macd = this.calculateMACD(prices);
      const delta = this.calculateDelta(prices);
      const adx = this.calculateADX(klines);
      const vwap = this.calculateVWAP(klines);

      // 早期趋势条件
      const macdCondition = macd > this.parameters.earlyTrendMACDThreshold;
      const deltaCondition = delta > this.parameters.earlyTrendDeltaThreshold;
      const adxCondition = adx > this.parameters.earlyTrendADXThreshold;
      const vwapCondition = this.checkVWAPDirection(prices, vwap);

      const detected = macdCondition && deltaCondition && adxCondition && vwapCondition;

      this.logger.info('[V3策略] 早期趋势探测:', {
        检测到: detected,
        MACD: macd,
        Delta: delta,
        ADX: adx,
        VWAP方向: vwapCondition,
        MACD阈值: this.parameters.earlyTrendMACDThreshold,
        Delta阈值: this.parameters.earlyTrendDeltaThreshold,
        ADX阈值: this.parameters.earlyTrendADXThreshold
      });

      return {
        detected,
        signalType: detected ? (prices[prices.length - 1] > vwap ? 'UP' : 'DOWN') : null,
        macd,
        delta,
        adx,
        vwap
      };
    } catch (error) {
      this.logger.error('[V3策略] 早期趋势探测失败', error);
      return { detected: false };
    }
  }

  // V3.1优化功能：假突破过滤器
  filterFakeBreakout(klines, signal) {
    try {
      if (!this.parameters.fakeBreakoutFilterEnabled) return { passed: true };

      const recent = klines.slice(-5);
      const volumes = recent.map(k => parseFloat(k[5]));
      const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
      const currentVolume = volumes[volumes.length - 1];

      // 量能确认
      const volumeCondition = currentVolume >= avgVolume * this.parameters.fakeBreakoutVolumeMultiplier;

      // 回撤容忍
      const prices = recent.map(k => parseFloat(k[4]));
      const maxPrice = Math.max(...prices);
      const minPrice = Math.min(...prices);
      const pullback = (maxPrice - minPrice) / minPrice;
      const pullbackCondition = pullback < this.parameters.fakeBreakoutPullbackThreshold;

      const passed = volumeCondition && pullbackCondition;

      this.logger.info('[V3策略] 假突破过滤:', {
        通过: passed,
        量能条件: volumeCondition,
        回撤条件: pullbackCondition,
        当前量能: currentVolume,
        平均量能: avgVolume,
        回撤幅度: pullback,
        量能倍数: this.parameters.fakeBreakoutVolumeMultiplier,
        回撤阈值: this.parameters.fakeBreakoutPullbackThreshold
      });

      return { passed };
    } catch (error) {
      this.logger.error('[V3策略] 假突破过滤失败', error);
      return { passed: true };
    }
  }

  // V3.1优化功能：动态止损
  calculateDynamicStopLoss(marketData, signal, atr) {
    try {
      if (!this.parameters.dynamicStopLossEnabled) {
        const currentPrice = parseFloat(marketData.klines[marketData.klines.length - 1][4]);
        const atrStop = atr * this.parameters.stopLossATRMultiplier;
        return signal.direction === 'BUY' ? currentPrice - atrStop : currentPrice + atrStop;
      }

      const klines = marketData.klines || [];
      const currentPrice = parseFloat(klines[klines.length - 1][4]);

      // 根据趋势强度调整止损
      const trendScore = this.calculateTrendScore(klines);
      const confidence = signal.confidence || 0;

      let multiplier = this.parameters.stopLossATRMultiplier || 0.4;

      // 根据置信度调整止损 - 优化盈亏比
      if (confidence > 0.8) {
        multiplier = this.parameters.dynamicStopLossHighMultiplier || 1.8;
      } else if (confidence > 0.6) {
        multiplier = this.parameters.dynamicStopLossModerateMultiplier || 1.5;
      } else if (confidence > 0.4) {
        multiplier = this.parameters.dynamicStopLossLowMultiplier || 1.2;
      }

      // 强趋势时放宽止损
      if (trendScore > 0.8) {
        multiplier *= 1.1;
      }

      const dynamicStopLoss = currentPrice + (signal.direction === 'BUY' ? -atr * multiplier : atr * multiplier);

      this.logger.info('[V3策略] 动态止损:', {
        基础倍数: this.parameters.stopLossATRMultiplier,
        动态倍数: multiplier,
        趋势评分: trendScore,
        置信度: confidence,
        动态止损: dynamicStopLoss
      });

      return dynamicStopLoss;
    } catch (error) {
      this.logger.error('[V3策略] 动态止损计算失败', error);
      const currentPrice = parseFloat(marketData.klines[marketData.klines.length - 1][4]);
      const atrStop = atr * this.parameters.stopLossATRMultiplier;
      return signal.direction === 'BUY' ? currentPrice - atrStop : currentPrice + atrStop;
    }
  }

  // 辅助方法
  calculateATR(klines, period) {
    try {
      if (klines.length < period + 1) return 0;

      const trueRanges = [];
      for (let i = 1; i < klines.length; i++) {
        const high = parseFloat(klines[i][2]);
        const low = parseFloat(klines[i][3]);
        const prevClose = parseFloat(klines[i - 1][4]);

        const tr = Math.max(
          high - low,
          Math.abs(high - prevClose),
          Math.abs(low - prevClose)
        );
        trueRanges.push(tr);
      }

      const recentTR = trueRanges.slice(-period);
      return recentTR.reduce((sum, tr) => sum + tr, 0) / recentTR.length;
    } catch (error) {
      return 0;
    }
  }

  calculateTrendScore(klines) {
    try {
      const recent = klines.slice(-20);
      const prices = recent.map(k => parseFloat(k[4]));
      const sma = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      const currentPrice = prices[prices.length - 1];
      const trendStrength = Math.abs(currentPrice - sma) / sma;
      return Math.min(trendStrength * 10, 1);
    } catch (error) {
      return 0;
    }
  }

  calculateFactorScore(klines) {
    try {
      const recent = klines.slice(-14);
      const volumes = recent.map(k => parseFloat(k[5]));
      const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
      const currentVolume = volumes[volumes.length - 1];
      const volumeRatio = currentVolume / avgVolume;
      return Math.min(volumeRatio / 2, 1);
    } catch (error) {
      return 0;
    }
  }

  calculateEntryScore(klines) {
    try {
      const recent = klines.slice(-10);
      const prices = recent.map(k => parseFloat(k[4]));
      const highs = recent.map(k => parseFloat(k[2]));
      const lows = recent.map(k => parseFloat(k[3]));
      const volatility = (Math.max(...highs) - Math.min(...lows)) / Math.min(...lows);
      return Math.min(volatility * 5, 1);
    } catch (error) {
      return 0;
    }
  }

  determineTrendDirection(klines) {
    try {
      const recent = klines.slice(-10);
      const prices = recent.map(k => parseFloat(k[4]));
      const firstPrice = prices[0];
      const lastPrice = prices[prices.length - 1];
      const change = (lastPrice - firstPrice) / firstPrice;

      // 放宽趋势判断阈值
      if (change > 0.005) return 'UP';  // 从0.01降低到0.005
      if (change < -0.005) return 'DOWN'; // 从-0.01降低到-0.005
      return 'NEUTRAL';
    } catch (error) {
      return 'NEUTRAL';
    }
  }

  calculateMACD(prices) {
    // 简化的MACD计算
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    return ema12 - ema26;
  }

  calculateDelta(prices) {
    const recent = prices.slice(-5);
    const first = recent[0];
    const last = recent[recent.length - 1];
    return (last - first) / first;
  }

  calculateADX(klines) {
    // 简化的ADX计算
    const recent = klines.slice(-14);
    let sum = 0;
    for (let i = 1; i < recent.length; i++) {
      const high = parseFloat(recent[i][2]);
      const low = parseFloat(recent[i][3]);
      const prevHigh = parseFloat(recent[i - 1][2]);
      const prevLow = parseFloat(recent[i - 1][3]);
      sum += Math.abs(high - low);
    }
    return sum / recent.length;
  }

  calculateVWAP(klines) {
    const recent = klines.slice(-20);
    let totalVolume = 0;
    let totalPriceVolume = 0;

    recent.forEach(k => {
      const price = (parseFloat(k[2]) + parseFloat(k[3]) + parseFloat(k[4])) / 3;
      const volume = parseFloat(k[5]);
      totalPriceVolume += price * volume;
      totalVolume += volume;
    });

    return totalVolume > 0 ? totalPriceVolume / totalVolume : 0;
  }

  checkVWAPDirection(prices, vwap) {
    const currentPrice = prices[prices.length - 1];
    return Math.abs(currentPrice - vwap) / vwap > this.parameters.earlyTrendVWAPThreshold;
  }

  calculateEMA(prices, period) {
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    return ema;
  }
}

module.exports = V3StrategyRefactored;
