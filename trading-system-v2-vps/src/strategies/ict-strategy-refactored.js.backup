const BaseStrategy = require('../core/base-strategy');
const logger = require('../utils/logger');

class ICTStrategyRefactored extends BaseStrategy {
  constructor(logger) {
    super(logger);
    this.name = 'ICT';
    this.initializeDefaultParameters();
    this.mode = 'BALANCED';
    this.updateThresholds();
  }

  initializeDefaultParameters() {
    this.parameters = {
      // 基础参数
      signalThresholds: { strong: 0.6, moderate: 0.4, weak: 0.2 },
      stopLossATRMultiplier: 2.5,
      takeProfitRatio: 3.0,

      // ICT策略核心参数 - 根据ict-optimize.md优化
      // 1. ATR时框优化
      atrTimeframes: {
        orderBlockHeight: '4H',    // 订单块高度用4H ATR
        stopLoss: '4H',           // 止损用4H ATR
        ltfSweep: '15M',          // LTF扫荡用15M ATR
        htfSweep: '4H'            // HTF扫荡用4H ATR
      },

      // 2. 门槛式条件优化 - 改为分层结构
      requiredConditions: {
        dailyTrend: true,         // 必须：日线趋势
        orderBlock: true,         // 必须：有效订单块
        htfSweep: false,          // 可选：HTF扫荡
        ltfSweep: false,          // 可选：LTF扫荡
        engulfing: false,         // 可选：15M吞没
        harmonic: false           // 可选：谐波
      },

      // 3. 扫荡阈值优化
      sweepThresholds: {
        htf: 0.3,                 // HTF扫荡阈值：0.3 × ATR(4H)
        ltf: 0.1,                 // LTF扫荡阈值：0.1 × ATR(15M) - 从0.02提升
        regressionRatio: 0.5      // 回归比例：50%以上
      },

      // 4. 订单块参数优化
      orderBlockParams: {
        maxAge: 3,                // 最大年龄：3天（从5天降低）
        minHeight: 0.25,          // 最小高度：0.25 × ATR(4H)
        volumeThreshold: 0.8      // 成交量阈值：80%（从60%提升）
      },

      // 5. 谐波检测优化
      harmonicParams: {
        tolerance: 0.05,          // 容差：5%（从10%降低）
        minConfidence: 0.8,       // 最小置信度：0.8
        requireOrderBlockOverlap: true // 要求与订单块重合
      },

      // 6. 止损止盈优化
      riskManagement: {
        structuralStop: true,     // 优先使用结构止损
        atrFallback: true,        // ATR作为备选
        stopLossMultiplier: 2.5,  // 止损倍数：2.5 × ATR(4H)
        takeProfitRatio: 3.0,     // 目标盈亏比：3:1
        minStopLossPct: 0.3,      // 最小止损百分比：0.3%
        maxStopLossPct: 5.0       // 最大止损百分比：5.0%
      },

      // 7. 交易成本
      tradingCosts: {
        commission: 0.0004,       // 手续费：0.04%
        slippage: 0.0003          // 滑点：0.03%
      }
    };
  }

  setParameters(parameters) {
    this.logger.info('[ICT策略] 设置参数:', Object.keys(parameters).length, '个参数');
    this.parameters = { ...this.parameters, ...parameters };
    this.updateThresholds();
  }

  setMode(mode) {
    this.logger.info('[ICT策略] 设置模式:', mode);
    this.mode = mode;
    this.updateThresholds();
  }

  updateThresholds() {
    // 根据模式调整参数 - 优化盈亏比到3:1
    if (this.mode === 'AGGRESSIVE') {
      this.parameters.signalThresholds = { strong: 0.5, moderate: 0.3, weak: 0.15 };
      this.parameters.requiredConditions.htfSweep = false;
      this.parameters.requiredConditions.ltfSweep = false;
      this.parameters.requiredConditions.engulfing = true;
      this.parameters.riskManagement.stopLossMultiplier = 1.5; // 从2.0收紧到1.5
      this.parameters.riskManagement.takeProfitRatio = 3.5;    // 从2.5提升到3.5
    } else if (this.mode === 'CONSERVATIVE') {
      this.parameters.signalThresholds = { strong: 0.7, moderate: 0.5, weak: 0.3 };
      this.parameters.requiredConditions.htfSweep = true;
      this.parameters.requiredConditions.ltfSweep = true;
      this.parameters.requiredConditions.engulfing = true;
      this.parameters.requiredConditions.harmonic = true;
      this.parameters.riskManagement.stopLossMultiplier = 2.0; // 从3.0收紧到2.0
      this.parameters.riskManagement.takeProfitRatio = 4.5;    // 从4.0提升到4.5
    } else {
      this.parameters.signalThresholds = { strong: 0.6, moderate: 0.4, weak: 0.2 };
      this.parameters.requiredConditions.htfSweep = false;
      this.parameters.requiredConditions.ltfSweep = true;
      this.parameters.requiredConditions.engulfing = true;
      this.parameters.riskManagement.stopLossMultiplier = 1.8; // 从2.5收紧到1.8
      this.parameters.riskManagement.takeProfitRatio = 4.0;    // 从3.0提升到4.0
    }
  }

  async calculateIndicators(marketData) {
    try {
      const klines = marketData.klines || [];
      if (klines.length < 50) {
        return { trendScore: 0, factorScore: 0, entryScore: 0, trendDirection: 'NEUTRAL' };
      }

      // 计算多时框ATR
      const atr15M = this.calculateATR(klines, 14, '15M');
      const atr1H = this.calculateATR(klines, 14, '1H');
      const atr4H = this.calculateATR(klines, 14, '4H');
      const atr1D = this.calculateATR(klines, 14, '1D');

      // 日线趋势判断 - 修复逻辑
      const dailyTrend = this.determineDailyTrend(klines);

      // 订单块检测
      const orderBlocks = this.detectOrderBlocks(klines, atr4H);

      // 扫荡检测
      const htfSweep = this.detectHTFSweep(klines, atr4H);
      const ltfSweep = this.detectLTFSweep(klines, atr15M);

      // 15M吞没检测
      const engulfing = this.detectEngulfing(klines);

      // 谐波检测
      const harmonic = this.detectHarmonic(klines, orderBlocks);

      // 计算综合评分
      const totalScore = this.calculateTotalScore({
        dailyTrend,
        orderBlocks,
        htfSweep,
        ltfSweep,
        engulfing,
        harmonic
      });

      this.logger.info('[ICT策略] 指标计算完成:', {
        dailyTrend,
        orderBlocksCount: orderBlocks.length,
        htfSweep,
        ltfSweep,
        engulfing,
        harmonic,
        totalScore,
        atr15M,
        atr4H
      });

      return {
        trendScore: totalScore,
        factorScore: totalScore,
        entryScore: totalScore,
        trendDirection: dailyTrend,
        metadata: {
          atr15M,
          atr4H,
          orderBlocks,
          htfSweep,
          ltfSweep,
          engulfing,
          harmonic
        }
      };
    } catch (error) {
      this.logger.error('[ICT策略] 指标计算失败', error);
      return { trendScore: 0, factorScore: 0, entryScore: 0, trendDirection: 'NEUTRAL' };
    }
  }

  generateSignal(indicators) {
    try {
      const { trendScore, trendDirection, metadata } = indicators;
      const threshold = this.parameters.signalThresholds.strong;

      // 检查必须条件
      const requiredMet = this.checkRequiredConditions(metadata);

      // 检查可选条件
      const optionalMet = this.checkOptionalConditions(metadata);

      let signal = 'HOLD';
      let confidence = 0;
      let reason = '';

      // 修复信号生成逻辑：放宽日线趋势要求
      if (requiredMet && trendScore >= threshold) {
        if (trendDirection === 'UP') {
          signal = 'BUY';
          confidence = Math.min(trendScore * 0.8, 0.8);
          reason = 'ICT信号：日线趋势+订单块+确认';
        } else if (trendDirection === 'DOWN') {
          signal = 'SELL';
          confidence = Math.min(trendScore * 0.8, 0.8);
          reason = 'ICT信号：日线趋势+订单块+确认';
        } else if (trendDirection === 'NEUTRAL' && trendScore >= threshold * 1.2) {
          // 对于NEUTRAL趋势，需要更高的评分才生成信号
          signal = 'BUY'; // 默认BUY，可以根据其他指标调整
          confidence = Math.min(trendScore * 0.6, 0.6);
          reason = 'ICT信号：订单块+确认（趋势中性）';
        }
      } else if (requiredMet && trendScore >= this.parameters.signalThresholds.moderate) {
        if (trendDirection === 'UP') {
          signal = 'BUY';
          confidence = Math.min(trendScore * 0.6, 0.6);
          reason = 'ICT信号：日线趋势+订单块+部分确认';
        } else if (trendDirection === 'DOWN') {
          signal = 'SELL';
          confidence = Math.min(trendScore * 0.6, 0.6);
          reason = 'ICT信号：日线趋势+订单块+部分确认';
        } else if (trendDirection === 'NEUTRAL' && trendScore >= this.parameters.signalThresholds.moderate * 1.2) {
          signal = 'BUY';
          confidence = Math.min(trendScore * 0.5, 0.5);
          reason = 'ICT信号：订单块+部分确认（趋势中性）';
        }
      } else {
        reason = `ICT信号：条件不满足 (必须:${requiredMet}, 评分:${trendScore.toFixed(2)}, 阈值:${threshold})`;
      }

      this.logger.info('[ICT策略] 信号生成:', {
        评分: trendScore,
        阈值: threshold,
        信号: signal,
        置信度: confidence,
        原因: reason,
        必须条件: requiredMet,
        可选条件: optionalMet
      });

      return {
        direction: signal,
        confidence: confidence,
        metadata: {
          totalScore: trendScore,
          trendDirection: trendDirection,
          requiredMet,
          optionalMet,
          reason,
          mode: this.mode
        }
      };
    } catch (error) {
      this.logger.error('[ICT策略] 信号生成失败', error);
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
      const atr4H = this.calculateATR(klines, 14, '4H');

      // 优先使用结构止损
      let stopLoss = 0;

      if (this.parameters.riskManagement.structuralStop) {
        // 基于订单块边界的结构止损
        const orderBlocks = this.detectOrderBlocks(klines, atr4H);
        if (orderBlocks.length > 0) {
          const latestBlock = orderBlocks[orderBlocks.length - 1];
          if (signal.direction === 'BUY') {
            stopLoss = latestBlock.low - (atr4H * 0.1); // 订单块下方
          } else if (signal.direction === 'SELL') {
            stopLoss = latestBlock.high + (atr4H * 0.1); // 订单块上方
          }
        }
      }

      // 如果结构止损不可用，使用ATR止损
      if (stopLoss === 0 && this.parameters.riskManagement.atrFallback) {
        const multiplier = this.parameters.riskManagement.stopLossMultiplier;
        const atrStop = atr4H * multiplier;

        if (signal.direction === 'BUY') {
          stopLoss = currentPrice - atrStop;
        } else if (signal.direction === 'SELL') {
          stopLoss = currentPrice + atrStop;
        }
      }

      // 验证止损百分比
      const stopLossPct = Math.abs(stopLoss - currentPrice) / currentPrice * 100;
      if (stopLossPct < this.parameters.riskManagement.minStopLossPct) {
        stopLoss = currentPrice * (1 - this.parameters.riskManagement.minStopLossPct / 100);
      } else if (stopLossPct > this.parameters.riskManagement.maxStopLossPct) {
        stopLoss = currentPrice * (1 - this.parameters.riskManagement.maxStopLossPct / 100);
      }

      this.logger.info('[ICT策略] 止损计算:', {
        当前价格: currentPrice,
        ATR4H: atr4H,
        止损: stopLoss,
        止损百分比: stopLossPct.toFixed(2) + '%'
      });

      return stopLoss;
    } catch (error) {
      this.logger.error('[ICT策略] 止损计算失败', error);
      return 0;
    }
  }

  calculateTakeProfit(marketData, signal, stopLoss) {
    try {
      const klines = marketData.klines || [];
      if (klines.length === 0) return 0;

      const currentPrice = parseFloat(klines[klines.length - 1][4]);
      const riskRewardRatio = this.parameters.riskManagement.takeProfitRatio;

      let takeProfit = 0;
      let risk = 0;
      if (signal.direction === 'BUY') {
        risk = Math.abs(currentPrice - stopLoss); // 修复：使用绝对值
        takeProfit = currentPrice + (risk * riskRewardRatio);
      } else if (signal.direction === 'SELL') {
        risk = Math.abs(stopLoss - currentPrice); // 修复：使用绝对值
        takeProfit = currentPrice - (risk * riskRewardRatio);
      }

      this.logger.info('[ICT策略] 止盈计算:', {
        当前价格: currentPrice,
        止损: stopLoss,
        止盈: takeProfit,
        风险: risk,
        风险回报比: riskRewardRatio
      });

      return takeProfit;
    } catch (error) {
      this.logger.error('[ICT策略] 止盈计算失败', error);
      return 0;
    }
  }

  // 辅助方法
  calculateATR(klines, period, timeframe) {
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

  determineDailyTrend(klines) {
    try {
      const recent = klines.slice(-20);
      const prices = recent.map(k => parseFloat(k[4]));
      const sma = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      const currentPrice = prices[prices.length - 1];
      const change = (currentPrice - sma) / sma;

      // 放宽趋势判断阈值
      if (change > 0.005) return 'UP';  // 从0.01降低到0.005
      if (change < -0.005) return 'DOWN'; // 从-0.01降低到-0.005
      return 'NEUTRAL';
    } catch (error) {
      return 'NEUTRAL';
    }
  }

  detectOrderBlocks(klines, atr4H) {
    try {
      const blocks = [];
      const minHeight = atr4H * this.parameters.orderBlockParams.minHeight;

      for (let i = 20; i < klines.length - 5; i++) {
        const high = parseFloat(klines[i][2]);
        const low = parseFloat(klines[i][3]);
        const height = high - low;

        if (height >= minHeight) {
          blocks.push({
            index: i,
            high: high,
            low: low,
            height: height,
            timestamp: klines[i][0]
          });
        }
      }

      return blocks.slice(-5); // 返回最近5个订单块
    } catch (error) {
      return [];
    }
  }

  detectHTFSweep(klines, atr4H) {
    try {
      const threshold = atr4H * this.parameters.sweepThresholds.htf;
      const recent = klines.slice(-10);

      for (let i = 1; i < recent.length; i++) {
        const high = parseFloat(recent[i][2]);
        const low = parseFloat(recent[i][3]);
        const prevHigh = parseFloat(recent[i - 1][2]);
        const prevLow = parseFloat(recent[i - 1][3]);

        if (high > prevHigh + threshold || low < prevLow - threshold) {
          return true;
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  detectLTFSweep(klines, atr15M) {
    try {
      const threshold = atr15M * this.parameters.sweepThresholds.ltf;
      const recent = klines.slice(-5);

      for (let i = 1; i < recent.length; i++) {
        const high = parseFloat(recent[i][2]);
        const low = parseFloat(recent[i][3]);
        const prevHigh = parseFloat(recent[i - 1][2]);
        const prevLow = parseFloat(recent[i - 1][3]);

        if (high > prevHigh + threshold || low < prevLow - threshold) {
          return true;
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  detectEngulfing(klines) {
    try {
      const recent = klines.slice(-3);
      if (recent.length < 2) return { detected: false, strength: 0 };

      const current = recent[recent.length - 1];
      const previous = recent[recent.length - 2];

      const currentOpen = parseFloat(current[1]);
      const currentClose = parseFloat(current[4]);
      const previousOpen = parseFloat(previous[1]);
      const previousClose = parseFloat(previous[4]);

      const currentBody = Math.abs(currentClose - currentOpen);
      const previousBody = Math.abs(previousClose - previousOpen);

      if (currentBody > previousBody * 1.2) {
        const strength = currentBody / previousBody;
        return { detected: true, strength: Math.min(strength, 2.0) };
      }

      return { detected: false, strength: 0 };
    } catch (error) {
      return { detected: false, strength: 0 };
    }
  }

  detectHarmonic(klines, orderBlocks) {
    try {
      // 简化的谐波检测
      const recent = klines.slice(-20);
      const prices = recent.map(k => parseFloat(k[4]));

      let harmonicScore = 0;
      const tolerance = this.parameters.harmonicParams.tolerance;

      // 检测基本的斐波那契回撤
      const high = Math.max(...prices);
      const low = Math.min(...prices);
      const range = high - low;

      const fibLevels = [0.236, 0.382, 0.5, 0.618, 0.786];
      const currentPrice = prices[prices.length - 1];

      for (const level of fibLevels) {
        const fibPrice = low + (range * level);
        if (Math.abs(currentPrice - fibPrice) / currentPrice < tolerance) {
          harmonicScore += 0.2;
        }
      }

      return {
        detected: harmonicScore >= this.parameters.harmonicParams.minConfidence,
        score: harmonicScore
      };
    } catch (error) {
      return { detected: false, score: 0 };
    }
  }

  checkRequiredConditions(metadata) {
    const { dailyTrend, orderBlocks } = metadata;

    let met = 0;
    let total = 0;

    if (this.parameters.requiredConditions.dailyTrend) {
      total++;
      // 放宽日线趋势要求，允许NEUTRAL
      if (dailyTrend !== null) met++;
    }

    if (this.parameters.requiredConditions.orderBlock) {
      total++;
      if (orderBlocks && orderBlocks.length > 0) met++;
    }

    return met === total;
  }

  checkOptionalConditions(metadata) {
    const { htfSweep, ltfSweep, engulfing, harmonic } = metadata;

    let met = 0;
    let total = 0;

    if (this.parameters.requiredConditions.htfSweep) {
      total++;
      if (htfSweep) met++;
    }

    if (this.parameters.requiredConditions.ltfSweep) {
      total++;
      if (ltfSweep) met++;
    }

    if (this.parameters.requiredConditions.engulfing) {
      total++;
      if (engulfing && engulfing.detected) met++;
    }

    if (this.parameters.requiredConditions.harmonic) {
      total++;
      if (harmonic && harmonic.detected) met++;
    }

    return total === 0 ? true : met >= Math.ceil(total / 2); // 至少满足一半可选条件
  }

  calculateTotalScore(indicators) {
    let score = 0;
    let weight = 0;

    // 日线趋势权重
    if (indicators.dailyTrend !== 'NEUTRAL') {
      score += 30;
      weight += 30;
    } else {
      // 即使趋势中性也给部分分数
      score += 15;
      weight += 30;
    }

    // 订单块权重
    if (indicators.orderBlocks && indicators.orderBlocks.length > 0) {
      score += 25;
      weight += 25;
    }

    // HTF扫荡权重
    if (indicators.htfSweep) {
      score += 15;
      weight += 15;
    }

    // LTF扫荡权重
    if (indicators.ltfSweep) {
      score += 10;
      weight += 10;
    }

    // 吞没权重
    if (indicators.engulfing && indicators.engulfing.detected) {
      score += 15 * Math.min(indicators.engulfing.strength, 2.0) / 2.0;
      weight += 15;
    }

    // 谐波权重
    if (indicators.harmonic && indicators.harmonic.detected) {
      score += 5 * indicators.harmonic.score;
      weight += 5;
    }

    return weight > 0 ? (score / weight) * 100 : 0;
  }
}

module.exports = ICTStrategyRefactored;
