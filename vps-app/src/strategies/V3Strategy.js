/**
 * V3趋势交易策略实现
 * 严格按照strategy-v3.md文档要求实现
 */

const TechnicalIndicators = require('./TechnicalIndicators');

class V3Strategy {
  constructor(config = {}) {
    this.config = {
      // 4H趋势判断配置
      trend4h: {
        scoreThreshold: 4,              // ≥4分保留趋势
        minDirectionScore: 2,           // 每个方向至少2分
        adxThreshold: 20,               // ADX > 20
        momentumThreshold: 0.005,       // 0.5%动量阈值
        bbExpansionRatio: 1.05          // 布林带扩张比例
      },
      // 1H多因子打分配置
      hourly: {
        scoreThreshold: 3,              // ≥3分入场
        vwapRequired: true,             // VWAP必须一致
        volumeRatio15m: 1.5,            // 15m成交量≥1.5×均量
        volumeRatio1h: 1.2,             // 1h成交量≥1.2×均量
        oiChangeThresholdLong: 0.02,    // 多头OI≥+2%
        oiChangeThresholdShort: -0.03,  // 空头OI≤-3%
        fundingRateMax: 0.0005,         // 资金费率阈值±0.05%
        deltaThreshold: 1.2             // Delta不平衡阈值
      },
      // 15m入场执行配置
      execution: {
        atrMultiplier: 1.2,             // ATR止损倍数
        riskRewardRatio: 2,             // 风险回报比
        maxTimeInPosition: 48           // 最大持仓时间(15m K线数)
      },
      ...config
    };
  }

  /**
   * 分析V3策略
   * @param {string} symbol - 交易对符号
   * @param {Object} klineData - K线数据 {1d: [], 4h: [], 1h: [], 15m: []}
   * @param {Object} indicators - 技术指标数据
   * @returns {Object} V3分析结果
   */
  analyze(symbol, klineData, indicators) {
    try {
      console.log(`🔄 开始V3策略分析: ${symbol}`);

      const analysisTime = Math.floor(Date.now() / 1000);
      const result = {
        symbol,
        analysisTime,
        trend4h: null,
        trend4hScore: 0,
        trendStrength: '弱',
        score1h: 0,
        finalSignal: '观望',
        signalStrength: '弱',
        executionMode: 'NONE',
        entryPrice: null,
        stopLoss: null,
        takeProfit: null,
        atrValue: 0,
        setupCandleHigh: null,
        setupCandleLow: null
      };

      // 1. 4H趋势判断
      const trend4hResult = this.analyze4HTrend(klineData['4h'], indicators['4h']);
      result.trend4h = trend4hResult.trend;
      result.trend4hScore = trend4hResult.score;
      result.trendStrength = trend4hResult.strength;

      // 如果4H趋势不明确，直接返回
      if (result.trend4h === '震荡市') {
        console.log(`📊 ${symbol} V3策略: 4H趋势不明确，跳过分析`);
        return result;
      }

      // 2. 1H多因子打分
      const hourlyScore = this.analyze1HFactors(klineData['1h'], indicators['1h'], result.trend4h);
      result.score1h = hourlyScore.score;

      // 如果1H打分不足，直接返回
      if (result.score1h < this.config.hourly.scoreThreshold) {
        console.log(`📊 ${symbol} V3策略: 1H打分不足(${result.score1h}/${this.config.hourly.scoreThreshold})，跳过分析`);
        return result;
      }

      // 3. 15m入场执行分析
      const executionResult = this.analyze15mExecution(klineData['15m'], indicators['15m'], result.trend4h);
      result.executionMode = executionResult.mode;
      result.entryPrice = executionResult.entryPrice;
      result.stopLoss = executionResult.stopLoss;
      result.takeProfit = executionResult.takeProfit;
      result.atrValue = executionResult.atrValue;
      result.setupCandleHigh = executionResult.setupCandleHigh;
      result.setupCandleLow = executionResult.setupCandleLow;

      // 4. 最终信号判断
      if (result.executionMode !== 'NONE' && result.entryPrice && result.stopLoss && result.takeProfit) {
        result.finalSignal = result.trend4h === '多头趋势' ? '做多' : '做空';
        result.signalStrength = this.calculateSignalStrength(result.trend4hScore, result.score1h, result.executionMode);
      }

      console.log(`✅ ${symbol} V3策略分析完成: ${result.finalSignal} (${result.signalStrength})`);
      return result;

    } catch (error) {
      console.error(`❌ V3策略分析失败 ${symbol}:`, error.message);
      return {
        symbol,
        analysisTime: Math.floor(Date.now() / 1000),
        error: error.message,
        finalSignal: '观望'
      };
    }
  }

  /**
   * 4H趋势分析
   * @param {Array} klines4h - 4H K线数据
   * @param {Array} indicators4h - 4H技术指标
   * @returns {Object} 趋势分析结果
   */
  analyze4HTrend(klines4h, indicators4h) {
    if (!klines4h || klines4h.length < 200) {
      return { trend: '震荡市', score: 0, strength: '弱' };
    }

    const latest = klines4h[klines4h.length - 1];
    const latestIndicator = indicators4h[indicators4h.length - 1];

    // 计算MA
    const closes = klines4h.map(k => k.close_price);
    const ma20 = latestIndicator?.ma20 || TechnicalIndicators.calculateSMA(closes, 20).slice(-1)[0];
    const ma50 = latestIndicator?.ma50 || TechnicalIndicators.calculateSMA(closes, 50).slice(-1)[0];
    const ma200 = latestIndicator?.ma200 || TechnicalIndicators.calculateSMA(closes, 200).slice(-1)[0];

    // 1. 趋势方向判断（必选，每个方向至少2分）
    const trendScore = TechnicalIndicators.calculateTrendScore(latest.close_price, ma20, ma50, ma200);

    if (trendScore.direction === 'RANGE') {
      return { trend: '震荡市', score: 0, strength: '弱' };
    }

    let score = 0;
    const direction = trendScore.direction === 'BULL' ? '多头趋势' : '空头趋势';

    // 2. 连续确认（连续≥2根4H K线满足趋势方向）
    const last2Closes = closes.slice(-2);
    if (direction === '多头趋势' && last2Closes.every(c => c > ma20)) {
      score++;
    } else if (direction === '空头趋势' && last2Closes.every(c => c < ma20)) {
      score++;
    }

    // 3. 趋势强度（ADX > 20 且 DI方向正确）
    const adx = latestIndicator?.adx14;
    const diPlus = latestIndicator?.di_plus;
    const diMinus = latestIndicator?.di_minus;

    if (adx && adx > this.config.trend4h.adxThreshold) {
      if ((direction === '多头趋势' && diPlus > diMinus) ||
        (direction === '空头趋势' && diMinus > diPlus)) {
        score++;
      }
    }

    // 4. 布林带扩张
    const bbWidth = latestIndicator?.bb_width;
    if (bbWidth) {
      const bbWidths = indicators4h.slice(-10).map(i => i.bb_width).filter(w => w);
      if (bbWidths.length >= 10) {
        const firstHalf = bbWidths.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
        const secondHalf = bbWidths.slice(5).reduce((a, b) => a + b, 0) / 5;
        if (secondHalf > firstHalf * this.config.trend4h.bbExpansionRatio) {
          score++;
        }
      }
    }

    // 5. 动量确认（当前K线收盘价离MA20距离≥0.5%）
    const momentum = Math.abs((latest.close_price - ma20) / ma20);
    if (momentum >= this.config.trend4h.momentumThreshold) {
      score++;
    }

    // 判断最终趋势
    let finalTrend = '震荡市';
    let strength = '弱';

    if (score >= this.config.trend4h.scoreThreshold) {
      finalTrend = direction;
      if (score >= 5) strength = '强';
      else if (score >= 4) strength = '中';
    }

    return { trend: finalTrend, score, strength };
  }

  /**
   * 1H多因子打分分析
   * @param {Array} klines1h - 1H K线数据
   * @param {Array} indicators1h - 1H技术指标
   * @param {string} trend4h - 4H趋势方向
   * @returns {Object} 打分结果
   */
  analyze1HFactors(klines1h, indicators1h, trend4h) {
    if (!klines1h || klines1h.length < 20) {
      return { score: 0, details: {} };
    }

    const latest = klines1h[klines1h.length - 1];
    const latestIndicator = indicators1h[indicators1h.length - 1];

    let score = 0;
    const details = {};

    // 1. VWAP方向一致（必须满足）
    const vwap = latestIndicator?.vwap;
    if (vwap) {
      if (trend4h === '多头趋势' && latest.close_price > vwap) {
        details.vwapDirection = '多头';
      } else if (trend4h === '空头趋势' && latest.close_price < vwap) {
        details.vwapDirection = '空头';
      } else {
        details.vwapDirection = '不一致';
        return { score: 0, details }; // VWAP不一致直接返回0分
      }
    } else {
      details.vwapDirection = '无数据';
      return { score: 0, details }; // 无VWAP数据直接返回0分
    }

    // 2. 突破确认（收盘价突破最近20根4H K线高点/低点）
    // 这里简化处理，使用1H数据
    const highs = klines1h.slice(-20).map(k => k.high_price);
    const lows = klines1h.slice(-20).map(k => k.low_price);

    if (trend4h === '多头趋势' && latest.close_price > Math.max(...highs)) {
      score++;
      details.breakoutConfirmed = true;
    } else if (trend4h === '空头趋势' && latest.close_price < Math.min(...lows)) {
      score++;
      details.breakoutConfirmed = true;
    } else {
      details.breakoutConfirmed = false;
    }

    // 3. 成交量确认（15m成交量≥1.5×20期均量，1h成交量≥1.2×20期均量）
    const volumeRatio = latestIndicator?.volume_ratio;
    if (volumeRatio && volumeRatio >= this.config.hourly.volumeRatio1h) {
      score++;
      details.volumeConfirmed = true;
    } else {
      details.volumeConfirmed = false;
    }

    // 4. OI变化
    const oiChange = latestIndicator?.oi_change_6h;
    if (oiChange !== null && oiChange !== undefined) {
      if (trend4h === '多头趋势' && oiChange >= this.config.hourly.oiChangeThresholdLong) {
        score++;
        details.oiChangeConfirmed = true;
      } else if (trend4h === '空头趋势' && oiChange <= this.config.hourly.oiChangeThresholdShort) {
        score++;
        details.oiChangeConfirmed = true;
      } else {
        details.oiChangeConfirmed = false;
      }
    } else {
      details.oiChangeConfirmed = false;
    }

    // 5. 资金费率合理
    const fundingRate = latestIndicator?.funding_rate;
    if (fundingRate !== null && fundingRate !== undefined) {
      if (Math.abs(fundingRate) <= this.config.hourly.fundingRateMax) {
        score++;
        details.fundingRateOk = true;
      } else {
        details.fundingRateOk = false;
      }
    } else {
      details.fundingRateOk = false;
    }

    // 6. Delta/买卖盘不平衡
    const deltaRatio = latestIndicator?.delta_ratio;
    if (deltaRatio !== null && deltaRatio !== undefined) {
      if (trend4h === '多头趋势' && deltaRatio >= this.config.hourly.deltaThreshold) {
        score++;
        details.deltaConfirmed = true;
      } else if (trend4h === '空头趋势' && deltaRatio <= -this.config.hourly.deltaThreshold) {
        score++;
        details.deltaConfirmed = true;
      } else {
        details.deltaConfirmed = false;
      }
    } else {
      details.deltaConfirmed = false;
    }

    return { score, details };
  }

  /**
   * 15m入场执行分析
   * @param {Array} klines15m - 15m K线数据
   * @param {Array} indicators15m - 15m技术指标
   * @param {string} trend4h - 4H趋势方向
   * @returns {Object} 执行分析结果
   */
  analyze15mExecution(klines15m, indicators15m, trend4h) {
    if (!klines15m || klines15m.length < 50) {
      return { mode: 'NONE', entryPrice: null, stopLoss: null, takeProfit: null, atrValue: 0 };
    }

    const latest = klines15m[klines15m.length - 1];
    const latestIndicator = indicators15m[indicators15m.length - 1];

    // 计算EMA和ATR
    const closes = klines15m.map(k => k.close_price);
    const ema20 = latestIndicator?.ema20 || TechnicalIndicators.calculateEMA(closes, 20).slice(-1)[0];
    const ema50 = latestIndicator?.ema50 || TechnicalIndicators.calculateEMA(closes, 50).slice(-1)[0];
    const atr14 = latestIndicator?.atr14 || TechnicalIndicators.calculateATR(
      klines15m.map(k => k.high_price),
      klines15m.map(k => k.low_price),
      closes,
      14
    ).slice(-1)[0];

    // 获取setup candle（前一根K线）
    const setupCandle = klines15m[klines15m.length - 2];

    let entryPrice = null;
    let stopLoss = null;
    let takeProfit = null;
    let mode = 'NONE';

    if (trend4h === '多头趋势') {
      // 多头：回踩EMA20/50支撑 + 突破setup candle高点
      if (latest.close_price > ema20 && latest.close_price > ema50 && latest.close_price > setupCandle.high_price) {
        mode = '回踩确认';
        entryPrice = latest.close_price;
        stopLoss = Math.min(setupCandle.low_price, entryPrice - this.config.execution.atrMultiplier * atr14);
        takeProfit = entryPrice + this.config.execution.riskRewardRatio * (entryPrice - stopLoss);
      }
    } else if (trend4h === '空头趋势') {
      // 空头：反抽EMA20/50阻力 + 跌破setup candle低点
      if (latest.close_price < ema20 && latest.close_price < ema50 && latest.close_price < setupCandle.low_price) {
        mode = '反抽确认';
        entryPrice = latest.close_price;
        stopLoss = Math.max(setupCandle.high_price, entryPrice + this.config.execution.atrMultiplier * atr14);
        takeProfit = entryPrice - this.config.execution.riskRewardRatio * (stopLoss - entryPrice);
      }
    }

    return {
      mode,
      entryPrice,
      stopLoss,
      takeProfit,
      atrValue: atr14,
      setupCandleHigh: setupCandle.high_price,
      setupCandleLow: setupCandle.low_price
    };
  }

  /**
   * 计算信号强度
   * @param {number} trend4hScore - 4H趋势得分
   * @param {number} score1h - 1H多因子得分
   * @param {string} executionMode - 执行模式
   * @returns {string} 信号强度
   */
  calculateSignalStrength(trend4hScore, score1h, executionMode) {
    if (executionMode === 'NONE') return '弱';

    const totalScore = trend4hScore + score1h;

    if (totalScore >= 8) return '强';
    else if (totalScore >= 6) return '中';
    else return '弱';
  }
}

module.exports = V3Strategy;
