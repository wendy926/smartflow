// StrategyV3Core.js - 策略V3核心实现模块

const BinanceAPI = require('../api/BinanceAPI');

class StrategyV3Core {
  constructor() {
    this.deltaData = new Map(); // 存储Delta数据
  }

  /**
   * 计算移动平均线
   */
  calculateMA(candles, period = 20) {
    return candles.map((c, i) => {
      if (i < period - 1) return null;
      const sum = candles.slice(i - period + 1, i + 1).reduce((acc, x) => acc + x.close, 0);
      return sum / period;
    });
  }

  /**
   * 计算指数移动平均线
   */
  calculateEMA(candles, period = 20) {
    const multiplier = 2 / (period + 1);
    const ema = [];

    for (let i = 0; i < candles.length; i++) {
      if (i === 0) {
        ema[i] = candles[i].close;
      } else {
        ema[i] = (candles[i].close * multiplier) + (ema[i - 1] * (1 - multiplier));
      }
    }

    return ema;
  }

  /**
   * 计算ADX指标
   */
  calculateADX(candles, period = 14) {
    if (!candles || candles.length < period + 1) return null;

    const TR = [], DMplus = [], DMminus = [];
    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high, low = candles[i].low, closePrev = candles[i - 1].close;
      const highPrev = candles[i - 1].high, lowPrev = candles[i - 1].low;

      const tr = Math.max(high - low, Math.abs(high - closePrev), Math.abs(low - closePrev));
      TR.push(tr);

      const upMove = high - highPrev;
      const downMove = lowPrev - low;

      DMplus.push(upMove > downMove && upMove > 0 ? upMove : 0);
      DMminus.push(downMove > upMove && downMove > 0 ? downMove : 0);
    }

    function smooth(arr) {
      const smoothed = [];
      let sum = arr.slice(0, period).reduce((a, b) => a + b, 0);
      smoothed[period - 1] = sum;
      for (let i = period; i < arr.length; i++) {
        sum = smoothed[i - 1] - smoothed[i - 1] / period + arr[i];
        smoothed[i] = sum;
      }
      return smoothed;
    }

    const smTR = smooth(TR), smDMplus = smooth(DMplus), smDMminus = smooth(DMminus);
    const DIplus = smDMplus.map((v, i) => i >= period - 1 ? 100 * v / smTR[i] : null);
    const DIminus = smDMminus.map((v, i) => i >= period - 1 ? 100 * v / smTR[i] : null);
    const DX = DIplus.map((v, i) => i < period - 1 ? null : 100 * Math.abs(DIplus[i] - DIminus[i]) / (DIplus[i] + DIminus[i]));
    const ADX = [];
    let sumDX = DX.slice(period - 1, period - 1 + period).reduce((a, b) => a + b, 0);
    ADX[period * 2 - 2] = sumDX / period;
    for (let i = period * 2 - 1; i < DX.length; i++) {
      ADX[i] = (ADX[i - 1] * (period - 1) + DX[i]) / period;
    }
    const last = ADX.length - 1;
    return { ADX: ADX[last] || null, DIplus: DIplus[last] || null, DIminus: DIminus[last] || null };
  }

  /**
   * 计算布林带
   */
  calculateBollingerBands(candles, period = 20, k = 2) {
    const closes = candles.map(c => c.close);
    const ma = this.calculateMA(candles, period);
    const stdDev = [];

    for (let i = period - 1; i < candles.length; i++) {
      const slice = closes.slice(i - period + 1, i + 1);
      const mean = ma[i];
      const variance = slice.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / period;
      stdDev[i] = Math.sqrt(variance);
    }

    return ma.map((m, i) => ({
      middle: m,
      upper: m + k * (stdDev[i] || 0),
      lower: m - k * (stdDev[i] || 0),
      bandwidth: stdDev[i] ? (2 * k * stdDev[i]) / m : 0
    }));
  }

  /**
   * 计算VWAP
   */
  calculateVWAP(candles) {
    let pvSum = 0; // Price * Volume 累积
    let vSum = 0;  // Volume 累积

    for (const c of candles) {
      const typicalPrice = (c.high + c.low + c.close) / 3;
      pvSum += typicalPrice * c.volume;
      vSum += c.volume;
    }

    return vSum > 0 ? pvSum / vSum : null;
  }

  /**
   * 计算ATR
   */
  calculateATR(candles, period = 14) {
    const tr = [];
    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const closePrev = candles[i - 1].close;

      tr.push(Math.max(
        high - low,
        Math.abs(high - closePrev),
        Math.abs(low - closePrev)
      ));
    }

    return this.calculateEMA(tr.map(t => ({ close: t })), period);
  }

  /**
   * 4H趋势过滤 - 核心判断逻辑
   */
  async analyze4HTrend(symbol) {
    try {
      const klines4h = await BinanceAPI.getKlines(symbol, '4h', 250);
      if (!klines4h || klines4h.length < 200) {
        return { trend4h: 'NONE', marketType: 'NONE', error: '数据不足' };
      }

      const candles = klines4h.map(k => ({
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));

      const ma20 = this.calculateMA(candles, 20);
      const ma50 = this.calculateMA(candles, 50);
      const ma200 = this.calculateMA(candles, 200);
      const close4h = candles[candles.length - 1].close;

      // 检查MA排列
      const isLongMA = ma20[ma20.length - 1] > ma50[ma50.length - 1] &&
        ma50[ma50.length - 1] > ma200[ma200.length - 1] &&
        close4h > ma20[ma20.length - 1];

      const isShortMA = ma20[ma20.length - 1] < ma50[ma50.length - 1] &&
        ma50[ma50.length - 1] < ma200[ma200.length - 1] &&
        close4h < ma20[ma20.length - 1];

      // 计算ADX和布林带带宽
      const { ADX, DIplus, DIminus } = this.calculateADX(candles, 14);
      const bb = this.calculateBollingerBands(candles, 20, 2);
      const bbw = bb[bb.length - 1]?.bandwidth || 0;

      // 检查连续确认机制（至少2根4H K线满足条件）
      let trendConfirmed = false;
      if (candles.length >= 2) {
        const last2Candles = candles.slice(-2);
        const last2MA20 = ma20.slice(-2);
        const last2MA50 = ma50.slice(-2);
        const last2MA200 = ma200.slice(-2);

        if (isLongMA) {
          trendConfirmed = last2Candles.every((c, i) =>
            c.close > last2MA20[i] &&
            last2MA20[i] > last2MA50[i] &&
            last2MA50[i] > last2MA200[i]
          );
        } else if (isShortMA) {
          trendConfirmed = last2Candles.every((c, i) =>
            c.close < last2MA20[i] &&
            last2MA20[i] < last2MA50[i] &&
            last2MA50[i] < last2MA200[i]
          );
        }
      }

      // 判断趋势强度
      const adxLong = ADX > 20 && DIplus > DIminus;
      const adxShort = ADX > 20 && DIminus > DIplus;

      let trend4h = 'NONE';
      let marketType = 'NONE';

      if (isLongMA && adxLong && trendConfirmed) {
        trend4h = '多头趋势';
        marketType = '趋势市';
      } else if (isShortMA && adxShort && trendConfirmed) {
        trend4h = '空头趋势';
        marketType = '趋势市';
      } else {
        trend4h = '震荡市';
        marketType = '震荡市';
      }

      return {
        trend4h,
        marketType,
        ma20: ma20[ma20.length - 1],
        ma50: ma50[ma50.length - 1],
        ma200: ma200[ma200.length - 1],
        closePrice: close4h,
        adx14: ADX,
        bbw,
        trendConfirmed,
        diplus: DIplus,
        diminus: DIminus
      };

    } catch (error) {
      console.error(`4H趋势分析失败 [${symbol}]:`, error);
      return { trend4h: 'NONE', marketType: 'NONE', error: error.message };
    }
  }

  /**
   * 1H多因子打分系统 - 趋势市
   */
  async analyze1HScoring(symbol, trend4h) {
    try {
      const [klines1h, klines15m, ticker, funding, openInterestHist] = await Promise.all([
        BinanceAPI.getKlines(symbol, '1h', 50),
        BinanceAPI.getKlines(symbol, '15m', 50),
        BinanceAPI.get24hrTicker(symbol),
        BinanceAPI.getFundingRate(symbol),
        BinanceAPI.getOpenInterestHist(symbol, '1h', 6)
      ]);

      if (!klines1h || klines1h.length < 20) {
        return { score: 0, allowEntry: false, error: '1H数据不足' };
      }

      const candles1h = klines1h.map(k => ({
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));

      const candles15m = klines15m.map(k => ({
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));

      const last1h = candles1h[candles1h.length - 1];
      const last15m = candles15m[candles15m.length - 1];

      // 计算VWAP
      const vwap = this.calculateVWAP(candles1h.slice(-20));

      // 1. VWAP方向一致性（必须满足）
      let vwapDirectionConsistent = false;
      if (trend4h === '多头趋势' && last1h.close > vwap) {
        vwapDirectionConsistent = true;
      } else if (trend4h === '空头趋势' && last1h.close < vwap) {
        vwapDirectionConsistent = true;
      }

      // 调试信息
      console.log(`🔍 VWAP方向检查 [${symbol}]:`, {
        trend4h,
        lastClose: last1h.close,
        vwap,
        vwapDirectionConsistent,
        condition: trend4h === '多头趋势' ? `close(${last1h.close}) > vwap(${vwap})` : `close(${last1h.close}) < vwap(${vwap})`
      });

      if (!vwapDirectionConsistent) {
        return { score: 0, allowEntry: false, vwapDirectionConsistent: false };
      }

      let score = 0;
      const factors = {};

      // 2. 突破确认（4H关键位突破）
      const klines4h = await BinanceAPI.getKlines(symbol, '4h', 20);
      if (klines4h && klines4h.length >= 20) {
        const highs4h = klines4h.map(k => parseFloat(k[2]));
        const lows4h = klines4h.map(k => parseFloat(k[3]));
        const maxHigh = Math.max(...highs4h);
        const minLow = Math.min(...lows4h);

        if (trend4h === '多头趋势' && last1h.close > maxHigh) {
          score++;
          factors.breakout = true;
        } else if (trend4h === '空头趋势' && last1h.close < minLow) {
          score++;
          factors.breakout = true;
        }
      }

      // 3. 成交量双确认
      const avgVol15m = candles15m.slice(-20).reduce((a, c) => a + c.volume, 0) / 20;
      const avgVol1h = candles1h.slice(-20).reduce((a, c) => a + c.volume, 0) / 20;

      const vol15mRatio = last15m.volume / avgVol15m;
      const vol1hRatio = last1h.volume / avgVol1h;

      if (vol15mRatio >= 1.5 && vol1hRatio >= 1.2) {
        score++;
        factors.volume = true;
      }

      // 4. OI变化
      let oiChange6h = 0;
      if (openInterestHist && openInterestHist.length >= 2) {
        const oiStart = openInterestHist[0].sumOpenInterest;
        const oiEnd = openInterestHist[openInterestHist.length - 1].sumOpenInterest;
        oiChange6h = (oiEnd - oiStart) / oiStart;
      }

      if (trend4h === '多头趋势' && oiChange6h >= 0.02) {
        score++;
        factors.oi = true;
      } else if (trend4h === '空头趋势' && oiChange6h <= -0.03) {
        score++;
        factors.oi = true;
      }

      // 5. 资金费率
      const fundingRate = funding && funding.length > 0 ? parseFloat(funding[0].fundingRate) : 0;
      if (fundingRate >= -0.0005 && fundingRate <= 0.0005) {
        score++;
        factors.funding = true;
      }

      // 6. Delta/买卖盘不平衡（简化实现）
      const deltaBuy = this.deltaData.get(`${symbol}_buy`) || 0;
      const deltaSell = this.deltaData.get(`${symbol}_sell`) || 0;
      const deltaImbalance = deltaSell > 0 ? deltaBuy / deltaSell : 0;

      if (trend4h === '多头趋势' && deltaImbalance >= 1.2) {
        score++;
        factors.delta = true;
      } else if (trend4h === '空头趋势' && deltaImbalance <= 0.83) { // 1/1.2
        score++;
        factors.delta = true;
      }

      const allowEntry = score >= 3;

      return {
        score,
        allowEntry,
        vwapDirectionConsistent,
        factors,
        vwap,
        vol15mRatio,
        vol1hRatio,
        oiChange6h,
        fundingRate,
        deltaImbalance,
        deltaBuy,
        deltaSell
      };

    } catch (error) {
      console.error(`1H打分分析失败 [${symbol}]:`, error);
      return { score: 0, allowEntry: false, error: error.message };
    }
  }

  /**
   * 震荡市1H边界判断
   */
  async analyzeRangeBoundary(symbol) {
    try {
      const klines1h = await BinanceAPI.getKlines(symbol, '1h', 50);
      if (!klines1h || klines1h.length < 25) {
        return { lowerBoundaryValid: false, upperBoundaryValid: false, error: '1H数据不足' };
      }

      const candles1h = klines1h.map(k => ({
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));

      // 计算布林带
      const bb = this.calculateBollingerBands(candles1h, 20, 2);
      const lastBB = bb[bb.length - 1];

      // 计算VWAP
      const vwap = this.calculateVWAP(candles1h.slice(-20));

      // 检查边界连续触碰
      const last6Candles = candles1h.slice(-6);
      let lowerTouches = 0, upperTouches = 0;

      for (const c of last6Candles) {
        if (c.close <= lastBB.lower * 1.01) lowerTouches++;
        if (c.close >= lastBB.upper * 0.99) upperTouches++;
      }

      // 成交量因子
      const avgVol = candles1h.slice(-20).reduce((a, c) => a + c.volume, 0) / 20;
      const volFactor = last6Candles[last6Candles.length - 1].volume / avgVol;

      // Delta因子（简化）
      const deltaBuy = this.deltaData.get(`${symbol}_buy`) || 0;
      const deltaSell = this.deltaData.get(`${symbol}_sell`) || 0;
      const delta = Math.abs(deltaBuy - deltaSell) / Math.max(deltaBuy + deltaSell, 1);

      // 检查最近突破
      const recentHigh = Math.max(...candles1h.slice(-20).map(c => c.high));
      const recentLow = Math.min(...candles1h.slice(-20).map(c => c.low));
      const lastClose = candles1h[candles1h.length - 1].close;
      const lastBreakout = lastClose > recentHigh || lastClose < recentLow;

      // 综合边界有效性判断
      const lowerBoundaryValid = lowerTouches >= 2 &&
        volFactor <= 1.2 &&
        delta <= 0.02 &&
        !lastBreakout;

      const upperBoundaryValid = upperTouches >= 2 &&
        volFactor <= 1.2 &&
        delta <= 0.02 &&
        !lastBreakout;

      return {
        lowerBoundaryValid,
        upperBoundaryValid,
        bbUpper: lastBB.upper,
        bbMiddle: lastBB.middle,
        bbLower: lastBB.lower,
        bbBandwidth: lastBB.bandwidth,
        vwap,
        delta,
        touchesLower: lowerTouches,
        touchesUpper: upperTouches,
        volFactor,
        lastBreakout
      };

    } catch (error) {
      console.error(`震荡市边界分析失败 [${symbol}]:`, error);
      return { lowerBoundaryValid: false, upperBoundaryValid: false, error: error.message };
    }
  }

  /**
   * 更新Delta数据
   */
  updateDeltaData(symbol, deltaBuy, deltaSell) {
    this.deltaData.set(`${symbol}_buy`, deltaBuy);
    this.deltaData.set(`${symbol}_sell`, deltaSell);
  }

  /**
   * 获取Delta数据
   */
  getDeltaData(symbol) {
    return {
      buy: this.deltaData.get(`${symbol}_buy`) || 0,
      sell: this.deltaData.get(`${symbol}_sell`) || 0
    };
  }
}

module.exports = StrategyV3Core;
