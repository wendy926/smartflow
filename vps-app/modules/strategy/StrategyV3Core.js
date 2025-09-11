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
   * 检查布林带带宽是否扩张 - 严格按照strategy-v3.md文档
   */
  isBBWExpanding(candles, period = 20, k = 2) {
    if (candles.length < period + 10) return false;

    const bb = this.calculateBollingerBands(candles, period, k);
    
    // 检查最近10根K线的带宽变化趋势
    const recentBB = bb.slice(-10);
    if (recentBB.length < 10) return false;

    // 计算带宽变化率
    const bandwidths = recentBB.map(b => b.bandwidth);
    const firstHalf = bandwidths.slice(0, 5);
    const secondHalf = bandwidths.slice(5);
    
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    // 如果后半段平均带宽比前半段大5%以上，认为带宽扩张
    return avgSecond > avgFirst * 1.05;
  }

  /**
   * 4H趋势过滤 - 核心判断逻辑
   */
  async analyze4HTrend(symbol) {
    try {
      const klines4h = await BinanceAPI.getKlines(symbol, '4h', 250);
      if (!klines4h || klines4h.length < 200) {
        return { trend4h: '震荡市', marketType: '震荡市', error: '数据不足' };
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

      // 判断趋势强度 - 严格按照文档：ADX(14) > 20 且布林带带宽扩张
      const adxLong = ADX > 20 && DIplus > DIminus;
      const adxShort = ADX > 20 && DIminus > DIplus;
      
      // 布林带带宽扩张检查 - 严格按照文档要求
      const bbwExpanding = this.isBBWExpanding(candles, 20, 2);
      
      // 趋势强度确认：ADX条件 AND 布林带带宽扩张
      const strengthLong = adxLong && bbwExpanding;
      const strengthShort = adxShort && bbwExpanding;

      // 确保总是返回有效的趋势类型，不返回空值
      let trend4h = '震荡市';
      let marketType = '震荡市';

      if (isLongMA && strengthLong && trendConfirmed) {
        trend4h = '多头趋势';
        marketType = '趋势市';
      } else if (isShortMA && strengthShort && trendConfirmed) {
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
      
      // 根据错误类型提供更详细的错误信息
      let errorMessage = error.message;
      if (error.message.includes('地理位置限制')) {
        errorMessage = `交易对 ${symbol} 在VPS位置无法访问，建议移除该交易对`;
      } else if (error.message.includes('不存在或已下架')) {
        errorMessage = `交易对 ${symbol} 不存在或已下架，建议移除该交易对`;
      } else if (error.message.includes('网络连接失败')) {
        errorMessage = `网络连接失败，无法获取 ${symbol} 数据`;
      }
      
      return { trend4h: '震荡市', marketType: '震荡市', error: errorMessage };
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
        console.log(`❌ VWAP方向不一致 [${symbol}]: 跳过后续因子计算`);
        return { score: 0, allowEntry: false, vwapDirectionConsistent: false };
      }

      console.log(`✅ VWAP方向一致 [${symbol}]: 开始计算其他因子`);

      let score = 0;
      const factors = {};

      // 2. 突破确认（4H关键位突破）
      const klines4h = await BinanceAPI.getKlines(symbol, '4h', 20);
      if (klines4h && klines4h.length >= 20) {
        const highs4h = klines4h.map(k => parseFloat(k[2]));
        const lows4h = klines4h.map(k => parseFloat(k[3]));
        const maxHigh = Math.max(...highs4h);
        const minLow = Math.min(...lows4h);

        console.log(`🔍 突破确认检查 [${symbol}]:`, {
          trend4h,
          lastClose: last1h.close,
          maxHigh,
          minLow,
          breakout: trend4h === '多头趋势' ? last1h.close > maxHigh : last1h.close < minLow
        });

        if (trend4h === '多头趋势' && last1h.close > maxHigh) {
          score++;
          factors.breakout = true;
          console.log(`✅ 多头突破确认 [${symbol}]: +1分`);
        } else if (trend4h === '空头趋势' && last1h.close < minLow) {
          score++;
          factors.breakout = true;
          console.log(`✅ 空头突破确认 [${symbol}]: +1分`);
        }
      }

      // 3. 成交量双确认
      const avgVol15m = candles15m.slice(-20).reduce((a, c) => a + c.volume, 0) / 20;
      const avgVol1h = candles1h.slice(-20).reduce((a, c) => a + c.volume, 0) / 20;

      const vol15mRatio = last15m.volume / avgVol15m;
      const vol1hRatio = last1h.volume / avgVol1h;

      console.log(`🔍 成交量确认检查 [${symbol}]:`, {
        vol15mRatio,
        vol1hRatio,
        vol15mThreshold: vol15mRatio >= 1.5,
        vol1hThreshold: vol1hRatio >= 1.2,
        volumeConfirm: vol15mRatio >= 1.5 && vol1hRatio >= 1.2
      });

      if (vol15mRatio >= 1.5 && vol1hRatio >= 1.2) {
        score++;
        factors.volume = true;
        console.log(`✅ 成交量确认 [${symbol}]: +1分`);
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

      console.log(`📊 多因子得分汇总 [${symbol}]:`, {
        score,
        allowEntry,
        factors,
        vwapDirectionConsistent
      });

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
   * 震荡市1H区间边界有效性检查 - 按照strategy-v3.md重新实现
   */
  async analyzeRangeBoundary(symbol) {
    try {
      const klines1h = await BinanceAPI.getKlines(symbol, '1h', 50);
      
      if (!klines1h || klines1h.length < 25) {
        return { 
          lowerBoundaryValid: false, 
          upperBoundaryValid: false, 
          error: '1H数据不足',
          bb1h: null
        };
      }

      const candles1h = klines1h.map(k => ({
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));

      // 计算1H布林带
      const bb = this.calculateBollingerBands(candles1h, 20, 2);
      const lastBB = bb[bb.length - 1];

      // 计算VWAP
      const vwap = this.calculateVWAP(candles1h.slice(-20));

      // 配置参数 - 严格按照strategy-v3.md
      const opts = {
        bbPeriod: 20,
        bbK: 2,
        lowerTouchPct: 0.015,  // 1.5%容差
        upperTouchPct: 0.015,  // 1.5%容差
        volMultiplier: 1.7,    // 成交量倍数阈值
        oiThreshold: 0.02,     // OI变化阈值
        deltaThreshold: 0.02,  // Delta阈值
        breakoutPeriod: 20     // 突破检测周期
      };

      // 1. 检查边界连续触碰 - 严格按照文档
      const last6Candles = candles1h.slice(-6);
      let lowerTouches = 0, upperTouches = 0;

      for (const c of last6Candles) {
        if (c.close <= lastBB.lower * (1 + opts.lowerTouchPct)) lowerTouches++;
        if (c.close >= lastBB.upper * (1 - opts.upperTouchPct)) upperTouches++;
      }

      // 2. 成交量因子验证 - 严格按照文档
      const avgVol = candles1h.slice(-opts.bbPeriod).reduce((a, c) => a + c.volume, 0) / opts.bbPeriod;
      const volFactor = last6Candles[last6Candles.length - 1].volume / avgVol;

      // 3. Delta因子计算
      const deltaBuy = this.deltaData.get(`${symbol}_buy`) || 0;
      const deltaSell = this.deltaData.get(`${symbol}_sell`) || 0;
      const delta = Math.abs(deltaBuy - deltaSell) / Math.max(deltaBuy + deltaSell, 1);

      // 4. OI变化因子 - 严格按照文档
      let oiChange = 0;
      try {
        const openInterestHist = await BinanceAPI.getOpenInterestHist(symbol, '1h', 6);
        if (openInterestHist && openInterestHist.length >= 2) {
          const oiStart = openInterestHist[0].sumOpenInterest;
          const oiEnd = openInterestHist[openInterestHist.length - 1].sumOpenInterest;
          oiChange = (oiEnd - oiStart) / oiStart;
        }
      } catch (error) {
        console.warn(`获取OI数据失败 [${symbol}]:`, error.message);
      }

      // 5. 检查最近突破 - 严格按照文档
      const recentHigh = Math.max(...candles1h.slice(-opts.breakoutPeriod).map(c => c.high));
      const recentLow = Math.min(...candles1h.slice(-opts.breakoutPeriod).map(c => c.low));
      const lastClose = candles1h[candles1h.length - 1].close;
      const lastBreakout = lastClose > recentHigh || lastClose < recentLow;

      // 6. 多因子打分系统 - 按照strategy-v3.md优化实现
      const factorScore = this.calculateBoundaryFactorScore({
        touchesLower: lowerTouches,
        touchesUpper: upperTouches,
        volFactor,
        delta,
        oiChange,
        lastBreakout,
        vwap: lastBB.middle, // 使用布林带中轨作为VWAP参考
        currentPrice: lastClose
      });

      const boundaryThreshold = 3.0; // 边界判断阈值
      const lowerBoundaryValid = factorScore >= boundaryThreshold;
      const upperBoundaryValid = factorScore >= boundaryThreshold;

      // 记录震荡市边界判断指标到监控系统
      if (this.dataMonitor) {
        this.dataMonitor.recordIndicator(symbol, '震荡市1H边界判断', {
          lowerBoundaryValid,
          upperBoundaryValid,
          touchesLower: lowerTouches,
          touchesUpper: upperTouches,
          volFactor,
          delta,
          oiChange,
          lastBreakout,
          bbBandwidth: lastBB.bandwidth
        });
      }

      return {
        lowerBoundaryValid,
        upperBoundaryValid,
        bb1h: {
          upper: lastBB.upper,
          middle: lastBB.middle,
          lower: lastBB.lower,
          bandwidth: lastBB.bandwidth
        },
        vwap,
        volFactor,
        delta,
        oiChange,
        lastBreakout,
        touchesLower: lowerTouches,
        touchesUpper: upperTouches,
        factorScore,
        boundaryThreshold
      };
    } catch (error) {
      console.error(`1H边界判断失败 [${symbol}]:`, error);
      return { 
        lowerBoundaryValid: false, 
        upperBoundaryValid: false, 
        error: error.message,
        bb1h: null
      };
    }
  }

  /**
   * 计算1H边界多因子得分 - 按照strategy-v3.md优化实现
   */
  calculateBoundaryFactorScore({ touchesLower, touchesUpper, volFactor, delta, oiChange, lastBreakout, vwap, currentPrice }) {
    let score = 0;
    
    // 1. 连续触碰因子 (0-2分)
    const touchScore = Math.min(touchesLower + touchesUpper, 2);
    score += touchScore;
    
    // 2. 成交量因子 (0-1分)
    if (volFactor <= 1.7) {
      score += 1;
    }
    
    // 3. Delta因子 (0-1分)
    if (Math.abs(delta) <= 0.02) {
      score += 1;
    }
    
    // 4. OI因子 (0-1分)
    if (Math.abs(oiChange) <= 0.02) {
      score += 1;
    }
    
    // 5. 无突破因子 (0-1分)
    if (!lastBreakout) {
      score += 1;
    }
    
    // 6. VWAP因子 (0-1分) - 价格接近布林带中轨
    const vwapDistance = Math.abs(currentPrice - vwap) / vwap;
    if (vwapDistance <= 0.01) { // 1%以内
      score += 1;
    }
    
    return score;
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
