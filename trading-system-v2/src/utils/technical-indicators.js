/**
 * 技术指标计算工具
 * 基于strategy-comparison.md中的指标计算逻辑
 */

const logger = require('./logger');

/**
 * 技术指标计算类
 */
class TechnicalIndicators {
  /**
   * 计算移动平均线 (MA)
   * @param {Array} prices - 价格数组
   * @param {number} period - 周期
   * @returns {Array} MA值数组
   */
  static calculateMA(prices, period) {
    if (prices.length < period) {
      return new Array(prices.length).fill(null);
    }

    const ma = [];
    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        ma.push(null);
      } else {
        const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        ma.push(sum / period);
      }
    }
    return ma;
  }

  /**
   * 计算指数移动平均线 (EMA)
   * @param {Array} prices - 价格数组
   * @param {number} period - 周期
   * @returns {Array} EMA值数组
   */
  static calculateEMA(prices, period) {
    if (prices.length === 0) return [];

    const multiplier = 2 / (period + 1);
    const ema = [];

    // 第一个值使用SMA
    if (prices.length >= period) {
      const sma = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
      ema.push(sma);
    } else {
      ema.push(prices[0]);
    }

    // 计算后续EMA值
    for (let i = 1; i < prices.length; i++) {
      const emaValue = (prices[i] * multiplier) + (ema[i - 1] * (1 - multiplier));
      ema.push(emaValue);
    }

    return ema;
  }

  /**
   * 计算MACD Histogram
   * @param {Array} prices - 价格数组
   * @param {number} fast - 快线周期（默认12）
   * @param {number} slow - 慢线周期（默认26）
   * @param {number} signal - 信号线周期（默认9）
   * @returns {Object} {histogram, macd, signal, trending}
   */
  static calculateMACDHistogram(prices, fast = 12, slow = 26, signal = 9) {
    if (!prices || prices.length < slow + signal) {
      logger.warn(`MACD计算数据不足: 需要${slow + signal}, 实际${prices.length}`);
      return { histogram: 0, macd: 0, signal: 0, trending: false };
    }

    try {
      // 计算快线和慢线EMA
      const emaFast = this.calculateEMA(prices, fast);
      const emaSlow = this.calculateEMA(prices, slow);

      if (!emaFast || !emaSlow || emaFast.length === 0 || emaSlow.length === 0) {
        return { histogram: 0, macd: 0, signal: 0, trending: false };
      }

      // 计算MACD线（快线 - 慢线）
      const macdLine = [];
      for (let i = 0; i < prices.length; i++) {
        if (emaFast[i] !== null && emaFast[i] !== undefined &&
          emaSlow[i] !== null && emaSlow[i] !== undefined) {
          macdLine.push(emaFast[i] - emaSlow[i]);
        }
      }

      if (macdLine.length === 0) {
        return { histogram: 0, macd: 0, signal: 0, trending: false };
      }

      // 计算信号线（MACD线的EMA）
      const signalLine = this.calculateEMA(macdLine, signal);

      if (!signalLine || signalLine.length === 0) {
        return { histogram: 0, macd: 0, signal: 0, trending: false };
      }

      // 获取最后一个值
      const lastMacd = macdLine[macdLine.length - 1] || 0;
      const lastSignal = signalLine[signalLine.length - 1] || 0;

      // 计算柱状图（MACD - Signal）
      const histogram = lastMacd - lastSignal;

      // trending: histogram > 0 表示上升动能，< 0 表示下降动能
      const trending = histogram > 0;

      logger.info(`MACD计算成功: histogram=${histogram.toFixed(4)}, macd=${lastMacd.toFixed(4)}, signal=${lastSignal.toFixed(4)}, trending=${trending}`);

      return {
        histogram,
        macd: lastMacd,
        signal: lastSignal,
        trending
      };
    } catch (error) {
      logger.error(`MACD计算失败: ${error.message}`);
      return { histogram: 0, macd: 0, signal: 0, trending: false };
    }
  }

  /**
   * 计算ADX (Average Directional Index)
   * @param {Array} high - 最高价数组
   * @param {Array} low - 最低价数组
   * @param {Array} close - 收盘价数组
   * @param {number} period - 周期，默认14
   * @returns {Object} {adx, di_plus, di_minus}
   */
  static calculateADX(high, low, close, period = 14) {
    if (high.length < period + 1) {
      logger.warn(`ADX计算数据不足: 需要${period + 1}, 实际${high.length}`);
      return { adx: null, di_plus: null, di_minus: null };
    }

    const tr = this.calculateTrueRange(high, low, close);
    const dm_plus = this.calculateDMPlus(high, low);
    const dm_minus = this.calculateDMMinus(high, low);

    // 计算平滑的TR, DM+, DM-
    const atr = this.calculateSmoothed(tr, period);
    const di_plus = this.calculateSmoothed(dm_plus, period).map((val, i) =>
      atr[i] > 0 ? (val / atr[i]) * 100 : 0
    );
    const di_minus = this.calculateSmoothed(dm_minus, period).map((val, i) =>
      atr[i] > 0 ? (val / atr[i]) * 100 : 0
    );

    // 计算DX
    const dx = di_plus.map((plus, i) => {
      const minus = di_minus[i];
      const sum = plus + minus;
      return sum > 0 ? Math.abs(plus - minus) / sum * 100 : 0;
    });

    // 计算ADX
    const adx = this.calculateSmoothed(dx, period);

    return {
      adx: adx[adx.length - 1],
      di_plus: di_plus[di_plus.length - 1],
      di_minus: di_minus[di_minus.length - 1]
    };
  }

  /**
   * 计算布林带宽度 (BBW)
   * @param {Array} prices - 价格数组
   * @param {number} period - 周期，默认20
   * @param {number} stdDev - 标准差倍数，默认2
   * @returns {Object} {bbw, upper, middle, lower}
   */
  static calculateBBW(prices, period = 20, stdDev = 2) {
    if (prices.length < period) {
      return { bbw: null, upper: null, middle: null, lower: null };
    }

    const ma = this.calculateMA(prices, period);
    const bbw = [];
    const upper = [];
    const lower = [];

    for (let i = period - 1; i < prices.length; i++) {
      const slice = prices.slice(i - period + 1, i + 1);
      const mean = ma[i];
      const variance = slice.reduce((acc, price) => acc + Math.pow(price - mean, 2), 0) / period;
      const std = Math.sqrt(variance);

      const upperBand = mean + (std * stdDev);
      const lowerBand = mean - (std * stdDev);
      const width = (upperBand - lowerBand) / mean;

      bbw.push(width);
      upper.push(upperBand);
      lower.push(lowerBand);
    }

    return {
      bbw: bbw[bbw.length - 1],
      upper: upper[upper.length - 1],
      middle: ma[ma.length - 1],
      lower: lower[lower.length - 1]
    };
  }

  /**
   * 计算VWAP (Volume Weighted Average Price)
   * @param {Array} klines - K线数据数组，每个元素为 [openTime, open, high, low, close, volume, ...]
   * @returns {number} VWAP值
   */
  static calculateVWAP(klines) {
    if (!klines || klines.length === 0) {
      return null;
    }

    let totalVolumePrice = 0;
    let totalVolume = 0;

    for (const kline of klines) {
      const high = parseFloat(kline[2]);
      const low = parseFloat(kline[3]);
      const close = parseFloat(kline[4]);
      const volume = parseFloat(kline[5]);

      // 使用典型价格 (high + low + close) / 3
      const typicalPrice = (high + low + close) / 3;

      totalVolumePrice += typicalPrice * volume;
      totalVolume += volume;
    }

    return totalVolume > 0 ? totalVolumePrice / totalVolume : null;
  }

  /**
   * 计算持仓量变化率
   * @param {Array} openInterest - 持仓量数组
   * @param {number} period - 周期，默认6（6小时）
   * @returns {number} 持仓量变化率
   */
  static calculateOIChange(openInterest, period = 6) {
    if (openInterest.length < period + 1) {
      return 0; // 数据不足时返回0而不是null
    }

    const current = openInterest[openInterest.length - 1];
    const previous = openInterest[openInterest.length - 1 - period];

    return previous > 0 ? (current - previous) / previous : 0;
  }

  /**
   * 计算Delta (买卖压力差)
   * @param {Array} buyVolumes - 买入成交量数组
   * @param {Array} sellVolumes - 卖出成交量数组
   * @returns {number} Delta值
   */
  static calculateDelta(buyVolumes, sellVolumes) {
    if (buyVolumes.length !== sellVolumes.length || buyVolumes.length === 0) {
      return null;
    }

    const totalBuy = buyVolumes.reduce((sum, vol) => sum + vol, 0);
    const totalSell = sellVolumes.reduce((sum, vol) => sum + vol, 0);
    const totalVolume = totalBuy + totalSell;

    return totalVolume > 0 ? (totalBuy - totalSell) / totalVolume : null;
  }

  /**
   * 计算Delta不平衡
   * @param {Array} buyVolumes - 买入成交量数组
   * @param {Array} sellVolumes - 卖出成交量数组
   * @returns {number} Delta不平衡值
   */
  static calculateDeltaImbalance(buyVolumes, sellVolumes) {
    if (buyVolumes.length !== sellVolumes.length || buyVolumes.length === 0) {
      return null;
    }

    const totalBuy = buyVolumes.reduce((sum, vol) => sum + vol, 0);
    const totalSell = sellVolumes.reduce((sum, vol) => sum + vol, 0);
    const totalVolume = totalBuy + totalSell;

    return totalVolume > 0 ? (totalBuy - totalSell) / totalVolume : null;
  }

  /**
   * 计算ATR (Average True Range)
   * @param {Array} high - 最高价数组
   * @param {Array} low - 最低价数组
   * @param {Array} close - 收盘价数组
   * @param {number} period - 周期，默认14
   * @returns {number} ATR值
   */
  static calculateATR(high, low, close, period = 14) {
    if (high.length < period + 1) {
      return new Array(high.length).fill(null);
    }

    const tr = this.calculateTrueRange(high, low, close);
    const atr = this.calculateSmoothed(tr, period);

    return atr;
  }

  /**
   * 计算1日趋势方向
   * @param {Array} prices - 价格数组
   * @param {number} maPeriod - MA周期，默认200
   * @returns {string} 'UP', 'DOWN', 'RANGE'
   */
  static calculate1DTrend(prices, maPeriod = 200) {
    if (prices.length < maPeriod) {
      return 'RANGE';
    }

    const ma200 = this.calculateMA(prices, maPeriod);
    const currentPrice = prices[prices.length - 1];
    const currentMA = ma200[ma200.length - 1];

    const priceChange = (currentPrice - currentMA) / currentMA;

    if (priceChange > 0.02) return 'UP';
    if (priceChange < -0.02) return 'DOWN';
    return 'RANGE';
  }

  /**
   * 计算真实波动范围 (True Range)
   * @param {Array} high - 最高价数组
   * @param {Array} low - 最低价数组
   * @param {Array} close - 收盘价数组
   * @returns {Array} TR值数组
   */
  static calculateTrueRange(high, low, close) {
    const tr = [];

    for (let i = 0; i < high.length; i++) {
      if (i === 0) {
        tr.push(high[i] - low[i]);
      } else {
        const hl = high[i] - low[i];
        const hc = Math.abs(high[i] - close[i - 1]);
        const lc = Math.abs(low[i] - close[i - 1]);
        tr.push(Math.max(hl, hc, lc));
      }
    }

    return tr;
  }

  /**
   * 计算DM+ (Directional Movement Plus)
   * @param {Array} high - 最高价数组
   * @param {Array} low - 最低价数组
   * @returns {Array} DM+值数组
   */
  static calculateDMPlus(high, low) {
    const dm_plus = [];

    for (let i = 0; i < high.length; i++) {
      if (i === 0) {
        dm_plus.push(0);
      } else {
        const highDiff = high[i] - high[i - 1];
        const lowDiff = low[i - 1] - low[i];

        if (highDiff > lowDiff && highDiff > 0) {
          dm_plus.push(highDiff);
        } else {
          dm_plus.push(0);
        }
      }
    }

    return dm_plus;
  }

  /**
   * 计算DM- (Directional Movement Minus)
   * @param {Array} high - 最高价数组
   * @param {Array} low - 最低价数组
   * @returns {Array} DM-值数组
   */
  static calculateDMMinus(high, low) {
    const dm_minus = [];

    for (let i = 0; i < high.length; i++) {
      if (i === 0) {
        dm_minus.push(0);
      } else {
        const highDiff = high[i] - high[i - 1];
        const lowDiff = low[i - 1] - low[i];

        if (lowDiff > highDiff && lowDiff > 0) {
          dm_minus.push(lowDiff);
        } else {
          dm_minus.push(0);
        }
      }
    }

    return dm_minus;
  }

  /**
   * 计算平滑移动平均
   * @param {Array} values - 数值数组
   * @param {number} period - 周期
   * @returns {Array} 平滑后的数组
   */
  static calculateSmoothed(values, period) {
    const smoothed = [];

    for (let i = 0; i < values.length; i++) {
      if (i < period - 1) {
        smoothed.push(null);
      } else if (i === period - 1) {
        const sum = values.slice(0, period).reduce((a, b) => a + b, 0);
        smoothed.push(sum / period);
      } else {
        const prevSmoothed = smoothed[i - 1];
        const currentValue = values[i];
        const smoothedValue = prevSmoothed - (prevSmoothed / period) + (currentValue / period);
        smoothed.push(smoothedValue);
      }
    }

    return smoothed;
  }

  /**
   * 检测吞没形态
   * @param {Array} open - 开盘价数组
   * @param {Array} high - 最高价数组
   * @param {Array} low - 最低价数组
   * @param {Array} close - 收盘价数组
   * @returns {Object} {isEngulfing, type, confidence}
   */
  static detectEngulfingPattern(open, high, low, close) {
    if (open.length < 2) {
      return { isEngulfing: false, type: null, confidence: 0 };
    }

    const prevOpen = open[open.length - 2];
    const prevClose = close[open.length - 2];
    const currOpen = open[open.length - 1];
    const currClose = close[open.length - 1];

    // 看涨吞没
    if (prevClose < prevOpen && currClose > currOpen &&
      currOpen < prevClose && currClose > prevOpen) {
      const confidence = Math.min(100, Math.abs(currClose - currOpen) / Math.abs(prevClose - prevOpen) * 50);
      return { isEngulfing: true, type: 'BULLISH', confidence };
    }

    // 看跌吞没
    if (prevClose > prevOpen && currClose < currOpen &&
      currOpen > prevClose && currClose < prevOpen) {
      const confidence = Math.min(100, Math.abs(currClose - currOpen) / Math.abs(prevClose - prevOpen) * 50);
      return { isEngulfing: true, type: 'BEARISH', confidence };
    }

    return { isEngulfing: false, type: null, confidence: 0 };
  }

  /**
   * 检测Sweep (扫单)
   * @param {Array} high - 最高价数组
   * @param {Array} low - 最低价数组
   * @param {Array} close - 收盘价数组
   * @param {string} timeframe - 时间级别
   * @returns {Object} {isSweep, type, level}
   */
  static detectSweep(high, low, close, timeframe = 'HTF') {
    if (high.length < 10) {
      return { isSweep: false, type: null, level: null };
    }

    const recentHighs = high.slice(-10);
    const recentLows = low.slice(-10);
    const recentCloses = close.slice(-10);

    const maxHigh = Math.max(...recentHighs);
    const minLow = Math.min(...recentLows);
    const currentClose = recentCloses[recentCloses.length - 1];

    // 检测向上扫单
    if (currentClose > maxHigh * 0.999) {
      return { isSweep: true, type: 'UP', level: maxHigh };
    }

    // 检测向下扫单
    if (currentClose < minLow * 1.001) {
      return { isSweep: true, type: 'DOWN', level: minLow };
    }

    return { isSweep: false, type: null, level: null };
  }
}

module.exports = TechnicalIndicators;
