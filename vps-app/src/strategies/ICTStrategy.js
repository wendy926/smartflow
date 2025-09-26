/**
 * ICT策略实现
 * 严格按照ict.md文档要求实现
 */

const TechnicalIndicators = require('./TechnicalIndicators');

class ICTStrategy {
  constructor(config = {}) {
    this.config = {
      // 1D趋势判断配置 - 放宽条件
      dailyTrend: {
        lookbackPeriod: 15,             // 比较最近15根日线（从20减少）
        trendThreshold: 1               // 3分制中≥1分确认趋势（从2分降低）
      },
      // 4H OB/FVG检测配置 - 放宽条件
      obDetection: {
        minHeightATRRatio: 0.15,        // OB最小高度 = 0.15×ATR（从0.25降低）
        maxAgeDays: 60,                 // OB最大年龄60天（从30天增加）
        sweepHTFThresholdATRRatio: 0.25, // 4H Sweep阈值 = 0.25×ATR（从0.4降低）
        sweepHTFMaxBars: 3              // 4H Sweep最大收回bar数（从2增加）
      },
      // 15m入场确认配置 - 放宽条件
      ltfConfirmation: {
        maxAgeDays: 7,                  // OB/FVG最大年龄7天（从2天增加）
        sweepLTFThresholdATRRatio: 0.1, // 15m Sweep阈值 = 0.1×ATR（从0.2降低）
        sweepLTFMaxBars: 5,             // 15m Sweep最大收回bar数（从3增加）
        engulfingBodyRatio: 1.2         // 吞没形态实体比例（从1.5降低）
      },
      // 风险管理配置
      riskManagement: {
        atrMultiplier: 1.5,             // ATR止损倍数
        riskRewardRatio: 3,             // 风险回报比3:1
        maxTimeInPosition: 48           // 最大持仓时间(15m K线数)
      },
      ...config
    };
  }

  /**
   * 分析ICT策略
   * @param {string} symbol - 交易对符号
   * @param {Object} klineData - K线数据 {1d: [], 4h: [], 1h: [], 15m: []}
   * @param {Object} indicators - 技术指标数据
   * @returns {Object} ICT分析结果
   */
  analyze(symbol, klineData, indicators) {
    try {
      console.log(`🔄 开始ICT策略分析: ${symbol}`);

      const analysisTime = Math.floor(Date.now() / 1000);
      const result = {
        symbol,
        analysisTime,
        dailyTrend: null,
        dailyTrendScore: 0,
        obDetected: false,
        obLow: null,
        obHigh: null,
        obAgeDays: null,
        fvgDetected: false,
        sweepHTF: false,
        sweepLTF: false,
        engulfingDetected: false,
        volumeConfirm: false,
        signalType: 'WAIT',
        signalStrength: '弱',
        entryPrice: null,
        stopLoss: null,
        takeProfit: null,
        atr4h: 0,
        atr15m: 0
      };

      // 1. 1D趋势判断
      const dailyTrendResult = this.analyzeDailyTrend(klineData['1d']);
      result.dailyTrend = dailyTrendResult.trend;
      result.dailyTrendScore = dailyTrendResult.score;

      // 如果1D趋势不明确，直接返回
      if (result.dailyTrend === 'sideways') {
        console.log(`📊 ${symbol} ICT策略: 1D趋势不明确，跳过分析`);
        return result;
      }

      // 2. 4H OB/FVG检测
      const obResult = this.detectOrderBlocks(klineData['4h'], indicators['4h']);
      result.obDetected = obResult.detected;
      result.obLow = obResult.low;
      result.obHigh = obResult.high;
      result.obAgeDays = obResult.ageDays;

      if (!result.obDetected) {
        console.log(`📊 ${symbol} ICT策略: 未检测到有效OB，跳过分析`);
        return result;
      }

      // 3. 4H Sweep宏观速率确认
      const sweepHTFResult = this.detectSweepHTF(klineData['4h'], indicators['4h'], result.dailyTrend);
      result.sweepHTF = sweepHTFResult.detected;

      if (!result.sweepHTF) {
        console.log(`📊 ${symbol} ICT策略: 4H Sweep无效，跳过分析`);
        return result;
      }

      // 4. 15m入场确认（OB/FVG年龄≤2天）
      if (result.obAgeDays > this.config.ltfConfirmation.maxAgeDays) {
        console.log(`📊 ${symbol} ICT策略: OB年龄过大(${result.obAgeDays}天)，跳过分析`);
        return result;
      }

      // 5. 吞没形态确认
      const engulfingResult = this.detectEngulfingPattern(klineData['15m'], indicators['15m'], result.dailyTrend);
      result.engulfingDetected = engulfingResult.detected;

      if (!result.engulfingDetected) {
        console.log(`📊 ${symbol} ICT策略: 未检测到吞没形态，跳过分析`);
        return result;
      }

      // 6. 15m Sweep微观速率确认
      const sweepLTFResult = this.detectSweepLTF(klineData['15m'], indicators['15m']);
      result.sweepLTF = sweepLTFResult.detected;

      if (!result.sweepLTF) {
        console.log(`📊 ${symbol} ICT策略: 15m Sweep无效，跳过分析`);
        return result;
      }

      // 7. 计算交易参数
      const tradeParams = this.calculateTradeParameters(
        klineData['15m'],
        indicators['4h'],
        indicators['15m'],
        result.dailyTrend,
        result.obLow,
        result.obHigh
      );

      result.entryPrice = tradeParams.entryPrice;
      result.stopLoss = tradeParams.stopLoss;
      result.takeProfit = tradeParams.takeProfit;
      result.atr4h = tradeParams.atr4h;
      result.atr15m = tradeParams.atr15m;

      // 8. 确定最终信号类型
      result.signalType = this.determineSignalType(result.dailyTrend, result.obDetected, result.engulfingDetected);
      result.signalStrength = this.calculateSignalStrength(result);

      console.log(`✅ ${symbol} ICT策略分析完成: ${result.signalType} (${result.signalStrength})`);
      return result;

    } catch (error) {
      console.error(`❌ ICT策略分析失败 ${symbol}:`, error.message);
      return {
        symbol,
        analysisTime: Math.floor(Date.now() / 1000),
        error: error.message,
        signalType: 'WAIT'
      };
    }
  }

  /**
   * 1D趋势分析
   * @param {Array} klines1d - 1D K线数据
   * @returns {Object} 趋势分析结果
   */
  analyzeDailyTrend(klines1d) {
    if (!klines1d || klines1d.length < this.config.dailyTrend.lookbackPeriod) {
      return { trend: 'sideways', score: 0 };
    }

    const closes = klines1d.map(k => k.close_price);
    const lookbackPeriod = this.config.dailyTrend.lookbackPeriod;

    // 比较最近20根日线收盘价
    const last20 = closes.slice(-lookbackPeriod);
    const firstClose = last20[0];
    const lastClose = last20[last20.length - 1];

    const changePercent = (lastClose - firstClose) / firstClose;

    if (changePercent > 0.02) { // 上涨超过2%
      return { trend: 'up', score: 3 };
    } else if (changePercent < -0.02) { // 下跌超过2%
      return { trend: 'down', score: 3 };
    } else {
      return { trend: 'sideways', score: 0 };
    }
  }

  /**
   * 检测订单块(OB)
   * @param {Array} klines4h - 4H K线数据
   * @param {Array} indicators4h - 4H技术指标
   * @returns {Object} OB检测结果
   */
  detectOrderBlocks(klines4h, indicators4h) {
    if (!klines4h || klines4h.length < 10) {
      return { detected: false, low: null, high: null, ageDays: null };
    }

    const atr14 = indicators4h[indicators4h.length - 1]?.atr14;
    if (!atr14) {
      return { detected: false, low: null, high: null, ageDays: null };
    }

    // 简化OB检测：寻找前一根大阳/大阴K线的区间
    let bestOB = null;
    let maxOBHeight = 0;

    for (let i = klines4h.length - 10; i < klines4h.length - 1; i++) {
      const kline = klines4h[i];
      const obHeight = kline.high_price - kline.low_price;
      const heightATRRatio = obHeight / atr14;

      // 过滤条件：OB高度≥0.25×ATR
      if (heightATRRatio >= this.config.obDetection.minHeightATRRatio) {
        if (obHeight > maxOBHeight) {
          maxOBHeight = obHeight;
          bestOB = {
            low: kline.low_price,
            high: kline.high_price,
            openTime: kline.open_time,
            heightATRRatio
          };
        }
      }
    }

    if (!bestOB) {
      return { detected: false, low: null, high: null, ageDays: null };
    }

    // 检查OB年龄
    const currentTime = klines4h[klines4h.length - 1].open_time;
    const ageMs = currentTime - bestOB.openTime;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    if (ageDays > this.config.obDetection.maxAgeDays) {
      return { detected: false, low: null, high: null, ageDays: null };
    }

    return {
      detected: true,
      low: bestOB.low,
      high: bestOB.high,
      ageDays: ageDays,
      heightATRRatio: bestOB.heightATRRatio
    };
  }

  /**
   * 检测4H Sweep宏观速率
   * @param {Array} klines4h - 4H K线数据
   * @param {Array} indicators4h - 4H技术指标
   * @param {string} trend - 趋势方向
   * @returns {Object} Sweep检测结果
   */
  detectSweepHTF(klines4h, indicators4h, trend) {
    if (!klines4h || klines4h.length < 5) {
      return { detected: false, speed: 0 };
    }

    const atr14 = indicators4h[indicators4h.length - 1]?.atr14;
    if (!atr14) {
      return { detected: false, speed: 0 };
    }

    // 寻找最近的swing高/低点
    const recentKlines = klines4h.slice(-10);
    let extreme = null;

    if (trend === 'up') {
      // 上升趋势中寻找swing低点
      extreme = Math.min(...recentKlines.map(k => k.low_price));
    } else {
      // 下降趋势中寻找swing高点
      extreme = Math.max(...recentKlines.map(k => k.high_price));
    }

    // 检测是否在≤2根4H内被刺破并收回
    const last3Bars = klines4h.slice(-3);
    let sweepDetected = false;
    let sweepSpeed = 0;

    for (let i = 0; i < last3Bars.length - 1; i++) {
      const bar = last3Bars[i];
      let exceed = 0;

      if (trend === 'up') {
        exceed = extreme - bar.low_price; // 向下刺破
      } else {
        exceed = bar.high_price - extreme; // 向上刺破
      }

      if (exceed > 0) {
        const barsToReturn = last3Bars.length - 1 - i;
        if (barsToReturn <= this.config.obDetection.sweepHTFMaxBars) {
          sweepSpeed = exceed / barsToReturn;

          // 检查是否满足速率阈值
          if (sweepSpeed >= this.config.obDetection.sweepHTFThresholdATRRatio * atr14) {
            sweepDetected = true;
            break;
          }
        }
      }
    }

    return { detected: sweepDetected, speed: sweepSpeed };
  }

  /**
   * 检测吞没形态
   * @param {Array} klines15m - 15m K线数据
   * @param {Array} indicators15m - 15m技术指标
   * @param {string} trend - 趋势方向
   * @returns {Object} 吞没形态检测结果
   */
  detectEngulfingPattern(klines15m, indicators15m, trend) {
    if (!klines15m || klines15m.length < 2) {
      return { detected: false };
    }

    const atr15 = indicators15m[indicators15m.length - 1]?.atr14;
    if (!atr15) {
      return { detected: false };
    }

    const prevCandle = klines15m[klines15m.length - 2];
    const currCandle = klines15m[klines15m.length - 1];

    // 使用技术指标模块的吞没检测
    const isEngulfing = TechnicalIndicators.isEngulfingPattern(
      prevCandle,
      currCandle,
      atr15,
      trend
    );

    return { detected: isEngulfing };
  }

  /**
   * 检测15m Sweep微观速率
   * @param {Array} klines15m - 15m K线数据
   * @param {Array} indicators15m - 15m技术指标
   * @returns {Object} Sweep检测结果
   */
  detectSweepLTF(klines15m, indicators15m) {
    if (!klines15m || klines15m.length < 5) {
      return { detected: false, speed: 0 };
    }

    const atr15 = indicators15m[indicators15m.length - 1]?.atr14;
    if (!atr15) {
      return { detected: false, speed: 0 };
    }

    // 寻找最近的swing高/低点
    const recentKlines = klines15m.slice(-20);
    const extreme = Math.max(...recentKlines.map(k => k.high_price));

    // 检测是否在≤3根15m内被刺破并收回
    const last4Bars = klines15m.slice(-4);
    let sweepDetected = false;
    let sweepSpeed = 0;

    for (let i = 0; i < last4Bars.length - 1; i++) {
      const bar = last4Bars[i];
      const exceed = bar.high_price - extreme;

      if (exceed > 0) {
        const barsToReturn = last4Bars.length - 1 - i;
        if (barsToReturn <= this.config.ltfConfirmation.sweepLTFMaxBars) {
          sweepSpeed = exceed / barsToReturn;

          // 检查是否满足速率阈值
          if (sweepSpeed >= this.config.ltfConfirmation.sweepLTFThresholdATRRatio * atr15) {
            sweepDetected = true;
            break;
          }
        }
      }
    }

    return { detected: sweepDetected, speed: sweepSpeed };
  }

  /**
   * 计算交易参数
   * @param {Array} klines15m - 15m K线数据
   * @param {Array} indicators4h - 4H技术指标
   * @param {Array} indicators15m - 15m技术指标
   * @param {string} trend - 趋势方向
   * @param {number} obLow - OB下沿
   * @param {number} obHigh - OB上沿
   * @returns {Object} 交易参数
   */
  calculateTradeParameters(klines15m, indicators4h, indicators15m, trend, obLow, obHigh) {
    const latest = klines15m[klines15m.length - 1];
    const atr4h = indicators4h[indicators4h.length - 1]?.atr14 || 0;
    const atr15m = indicators15m[indicators15m.length - 1]?.atr14 || 0;

    const entryPrice = latest.close_price;
    let stopLoss = null;
    let takeProfit = null;

    if (trend === 'up') {
      // 上升趋势：止损 = OB下沿 - 1.5×ATR(4H)
      stopLoss = Math.min(obLow, entryPrice - this.config.riskManagement.atrMultiplier * atr4h);
      takeProfit = entryPrice + this.config.riskManagement.riskRewardRatio * (entryPrice - stopLoss);
    } else {
      // 下降趋势：止损 = OB上沿 + 1.5×ATR(4H)
      stopLoss = Math.max(obHigh, entryPrice + this.config.riskManagement.atrMultiplier * atr4h);
      takeProfit = entryPrice - this.config.riskManagement.riskRewardRatio * (stopLoss - entryPrice);
    }

    return {
      entryPrice,
      stopLoss,
      takeProfit,
      atr4h,
      atr15m
    };
  }

  /**
   * 确定信号类型
   * @param {string} trend - 趋势方向
   * @param {boolean} obDetected - 是否检测到OB
   * @param {boolean} engulfingDetected - 是否检测到吞没
   * @returns {string} 信号类型
   */
  determineSignalType(trend, obDetected, engulfingDetected) {
    if (!obDetected || !engulfingDetected) {
      return 'WAIT';
    }

    if (trend === 'up') {
      return 'BOS_LONG';
    } else if (trend === 'down') {
      return 'BOS_SHORT';
    } else {
      return 'WAIT';
    }
  }

  /**
   * 计算信号强度
   * @param {Object} analysis - 分析结果
   * @returns {string} 信号强度
   */
  calculateSignalStrength(analysis) {
    let score = 0;

    // 1D趋势明确
    if (analysis.dailyTrend !== 'sideways') score++;

    // OB检测有效
    if (analysis.obDetected) score++;

    // 4H Sweep有效
    if (analysis.sweepHTF) score++;

    // 15m Sweep有效
    if (analysis.sweepLTF) score++;

    // 吞没形态确认
    if (analysis.engulfingDetected) score++;

    if (score >= 5) return '强';
    else if (score >= 3) return '中';
    else return '弱';
  }
}

module.exports = ICTStrategy;
