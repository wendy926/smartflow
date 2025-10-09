/**
 * V3趋势交易策略实现
 * 基于4H→1H→15m多时间框架分析
 */

const TechnicalIndicators = require('../utils/technical-indicators');
const BinanceAPI = require('../api/binance-api');
const logger = require('../utils/logger');
const config = require('../config');

class V3Strategy {
  constructor() {
    this.name = 'V3';
    this.timeframes = ['4H', '1H', '15M'];
    this.batchSize = config.strategies.v3.batchSize;
    this.maxSymbols = config.strategies.v3.maxSymbols;
  }

  /**
   * 分析4H趋势判断
   * @param {Array} klines4h - 4H K线数据
   * @returns {Object} 趋势判断结果
   */
  async analyze4HTrend(klines4h) {
    try {
      if (!klines4h || klines4h.length < 200) {
        throw new Error('4H K线数据不足');
      }

      const closes = klines4h.map(k => k.close);
      const highs = klines4h.map(k => k.high);
      const lows = klines4h.map(k => k.low);

      // 计算移动平均线
      const ma20 = TechnicalIndicators.calculateSMA(closes, 20);
      const ma50 = TechnicalIndicators.calculateSMA(closes, 50);
      const ma200 = TechnicalIndicators.calculateSMA(closes, 200);

      // 计算ADX指标
      const adxResult = TechnicalIndicators.calculateADX(highs, lows, closes, 14);

      // 计算布林带宽度
      const bollinger = TechnicalIndicators.calculateBollingerBands(closes, 20, 2);
      const bbw = bollinger[bollinger.length - 1].width;

      // 计算布林带扩张
      const recentBBW = bollinger.slice(-10);
      const firstHalf = recentBBW.slice(0, 5).reduce((sum, b) => sum + b.width, 0) / 5;
      const secondHalf = recentBBW.slice(5).reduce((sum, b) => sum + b.width, 0) / 5;
      const expanding = secondHalf > firstHalf * 1.05;

      // 计算趋势得分
      const latestClose = closes[closes.length - 1];
      const latestMA20 = ma20[ma20.length - 1];
      const latestMA50 = ma50[ma50.length - 1];
      const latestMA200 = ma200[ma200.length - 1];

      let score = 0;
      let trendDirection = 'RANGE';

      // 趋势方向判断（必选，每个方向至少2分）
      const bullScore = this.calculateBullScore(latestClose, latestMA20, latestMA50, latestMA200);
      const bearScore = this.calculateBearScore(latestClose, latestMA20, latestMA50, latestMA200);

      if (bullScore >= 2) {
        trendDirection = 'UP';
        score = bullScore;
      } else if (bearScore >= 2) {
        trendDirection = 'DOWN';
        score = bearScore;
      } else {
        return {
          trendDirection: 'RANGE',
          score: 0,
          confidenceLevel: 'LOW',
          indicators: {
            ma20: latestMA20,
            ma50: latestMA50,
            ma200: latestMA200,
            adx: adxResult.adx,
            bbw: bbw
          }
        };
      }

      // 其他因子加分
      score += this.calculateAdditionalScore(klines4h, trendDirection, adxResult, expanding);

      // 判断置信度
      const confidenceLevel = this.getConfidenceLevel(score);

      return {
        trendDirection,
        score: Math.min(score, 10), // 最高10分
        confidenceLevel,
        indicators: {
          ma20: latestMA20,
          ma50: latestMA50,
          ma200: latestMA200,
          adx: adxResult.adx,
          diPlus: adxResult.diPlus,
          diMinus: adxResult.diMinus,
          bbw: bbw,
          expanding: expanding
        }
      };

    } catch (error) {
      logger.error('V3 4H趋势分析失败:', error);
      throw error;
    }
  }

  /**
   * 分析1H多因子确认
   * @param {Array} klines1h - 1H K线数据
   * @param {string} trend4h - 4H趋势方向
   * @returns {Object} 1H多因子打分结果
   */
  async analyze1HFactors(klines1h, trend4h) {
    try {
      if (!klines1h || klines1h.length < 20) {
        throw new Error('1H K线数据不足');
      }

      const latest = klines1h[klines1h.length - 1];
      const closes = klines1h.map(k => k.close);
      const volumes = klines1h.map(k => k.volume);

      // 计算VWAP
      const vwap = TechnicalIndicators.calculateVWAP(klines1h);

      // VWAP方向必须一致（必须满足）
      if (trend4h === 'UP' && latest.close <= vwap) {
        return { score: 0, allowLong: false, allowShort: false };
      }
      if (trend4h === 'DOWN' && latest.close >= vwap) {
        return { score: 0, allowLong: false, allowShort: false };
      }

      let score = 0;

      // 突破确认
      const highs = klines1h.slice(-20).map(k => k.high);
      const lows = klines1h.slice(-20).map(k => k.low);
      
      if (trend4h === 'UP' && latest.close > Math.max(...highs)) {
        score += 1;
      }
      if (trend4h === 'DOWN' && latest.close < Math.min(...lows)) {
        score += 1;
      }

      // 成交量确认
      const avgVolume = volumes.slice(-20).reduce((sum, v) => sum + v, 0) / 20;
      if (latest.volume >= avgVolume * 1.2) {
        score += 1;
      }

      // OI变化（模拟数据）
      const oiChange = Math.random() * 0.1 - 0.05; // 模拟-5%到+5%的变化
      if (trend4h === 'UP' && oiChange >= 0.02) {
        score += 1;
      }
      if (trend4h === 'DOWN' && oiChange <= -0.03) {
        score += 1;
      }

      // 资金费率（模拟数据）
      const fundingRate = Math.random() * 0.001 - 0.0005; // 模拟-0.05%到+0.05%
      if (Math.abs(fundingRate) <= 0.0005) {
        score += 1;
      }

      // Delta不平衡（模拟数据）
      const deltaBuy = Math.random() * 1000;
      const deltaSell = Math.random() * 1000;
      if (trend4h === 'UP' && deltaBuy >= deltaSell * 1.2) {
        score += 1;
      }
      if (trend4h === 'DOWN' && deltaSell >= deltaBuy * 1.2) {
        score += 1;
      }

      return {
        score,
        allowLong: trend4h === 'UP' && score >= 3,
        allowShort: trend4h === 'DOWN' && score >= 3,
        factors: {
          vwap: vwap,
          vwapDirection: latest.close > vwap ? 'UP' : 'DOWN',
          breakout: trend4h === 'UP' ? latest.close > Math.max(...highs) : latest.close < Math.min(...lows),
          volumeRatio: latest.volume / avgVolume,
          oiChange: oiChange,
          fundingRate: fundingRate,
          deltaRatio: deltaBuy / (deltaSell || 1)
        }
      };

    } catch (error) {
      logger.error('V3 1H多因子分析失败:', error);
      throw error;
    }
  }

  /**
   * 分析15m入场执行
   * @param {Array} klines15m - 15m K线数据
   * @param {string} trend4h - 4H趋势方向
   * @returns {Object} 15m入场执行结果
   */
  async analyze15mExecution(klines15m, trend4h) {
    try {
      if (!klines15m || klines15m.length < 50) {
        throw new Error('15m K线数据不足');
      }

      const latest = klines15m[klines15m.length - 1];
      const closes = klines15m.map(k => k.close);
      const highs = klines15m.map(k => k.high);
      const lows = klines15m.map(k => k.low);

      // 计算EMA
      const ema20 = TechnicalIndicators.calculateEMA(closes, 20);
      const ema50 = TechnicalIndicators.calculateEMA(closes, 50);

      // 计算ATR
      const atr = TechnicalIndicators.calculateATR(highs, lows, closes, 14);

      // 计算布林带
      const bollinger = TechnicalIndicators.calculateBollingerBands(closes, 20, 2);
      const bbWidth = bollinger[bollinger.length - 1].width;

      // 入场条件判断
      const setupCandle = klines15m[klines15m.length - 2];
      const lastCandle = klines15m[klines15m.length - 1];

      let entrySignal = null;
      let stopLoss = null;
      let takeProfit = null;

      if (trend4h === 'UP') {
        // 多头入场条件
        if (lastCandle.close > setupCandle.high && 
            lastCandle.close > ema20[ema20.length - 1] && 
            lastCandle.close > ema50[ema50.length - 1]) {
          entrySignal = 'LONG';
          stopLoss = Math.min(setupCandle.low, lastCandle.close - 1.2 * atr[atr.length - 1]);
          takeProfit = lastCandle.close + 2 * (lastCandle.close - stopLoss);
        }
      } else if (trend4h === 'DOWN') {
        // 空头入场条件
        if (lastCandle.close < setupCandle.low && 
            lastCandle.close < ema20[ema20.length - 1] && 
            lastCandle.close < ema50[ema50.length - 1]) {
          entrySignal = 'SHORT';
          stopLoss = Math.max(setupCandle.high, lastCandle.close + 1.2 * atr[atr.length - 1]);
          takeProfit = lastCandle.close - 2 * (stopLoss - lastCandle.close);
        }
      }

      return {
        entrySignal,
        stopLoss,
        takeProfit,
        indicators: {
          ema20: ema20[ema20.length - 1],
          ema50: ema50[ema50.length - 1],
          atr: atr[atr.length - 1],
          bbWidth: bbWidth
        }
      };

    } catch (error) {
      logger.error('V3 15m入场分析失败:', error);
      throw error;
    }
  }

  // 辅助方法
  calculateBullScore(close, ma20, ma50, ma200) {
    let score = 0;
    if (close > ma20) score++;
    if (ma20 > ma50) score++;
    if (ma50 > ma200) score++;
    return score;
  }

  calculateBearScore(close, ma20, ma50, ma200) {
    let score = 0;
    if (close < ma20) score++;
    if (ma20 < ma50) score++;
    if (ma50 < ma200) score++;
    return score;
  }

  calculateAdditionalScore(klines4h, trendDirection, adxResult, expanding) {
    let score = 0;

    // 趋势稳定性
    const recentCloses = klines4h.slice(-2).map(k => k.close);
    const ma20 = TechnicalIndicators.calculateSMA(klines4h.map(k => k.close), 20);
    const latestMA20 = ma20[ma20.length - 1];

    if (trendDirection === 'UP' && recentCloses.every(c => c > latestMA20)) {
      score += 1;
    }
    if (trendDirection === 'DOWN' && recentCloses.every(c => c < latestMA20)) {
      score += 1;
    }

    // 趋势强度
    if (adxResult.adx > 20) {
      if (trendDirection === 'UP' && adxResult.diPlus > adxResult.diMinus) {
        score += 1;
      }
      if (trendDirection === 'DOWN' && adxResult.diMinus > adxResult.diPlus) {
        score += 1;
      }
    }

    // 布林带扩张
    if (expanding) {
      score += 1;
    }

    // 动量确认
    const latestClose = klines4h[klines4h.length - 1].close;
    if (Math.abs((latestClose - latestMA20) / latestMA20) >= 0.005) {
      score += 1;
    }

    return score;
  }

  getConfidenceLevel(score) {
    if (score >= 7) return 'HIGH';
    if (score >= 4) return 'MEDIUM';
    return 'LOW';
  }
}

module.exports = V3Strategy;
