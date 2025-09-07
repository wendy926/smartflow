// modules/utils/TechnicalIndicators.js
// 技术指标计算模块

class TechnicalIndicators {
  static calculateSMA(data, period) {
    if (data.length < period) return [];

    const result = [];
    for (let i = period - 1; i < data.length; i++) {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
    return result;
  }

  static calculateVWAP(klines) {
    let cumulativePV = 0;
    let cumulativeVol = 0;

    return klines.map(k => {
      const typical = (parseFloat(k.high) + parseFloat(k.low) + parseFloat(k.close)) / 3;
      const volume = parseFloat(k.volume);

      cumulativePV += typical * volume;
      cumulativeVol += volume;

      return cumulativePV / cumulativeVol;
    });
  }

  static calculateATR(klines, period = 14) {
    if (klines.length < period + 1) return [];

    const trueRanges = [];
    for (let i = 1; i < klines.length; i++) {
      const high = parseFloat(klines[i].high);
      const low = parseFloat(klines[i].low);
      const prevClose = parseFloat(klines[i - 1].close);

      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);
    }

    const atr = [];
    for (let i = period - 1; i < trueRanges.length; i++) {
      const sum = trueRanges.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      atr.push(sum / period);
    }

    return atr;
  }

  static calculateEMA(data, period) {
    if (data.length === 0) return [];

    const multiplier = 2 / (period + 1);
    const ema = [data[0]];

    for (let i = 1; i < data.length; i++) {
      ema.push((data[i] * multiplier) + (ema[i - 1] * (1 - multiplier)));
    }

    return ema;
  }

  static calculateRSI(data, period = 14) {
    if (data.length < period + 1) return [];

    const gains = [];
    const losses = [];

    for (let i = 1; i < data.length; i++) {
      const change = data[i] - data[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    const avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

    const rsi = [];
    let currentAvgGain = avgGain;
    let currentAvgLoss = avgLoss;

    for (let i = period; i < gains.length; i++) {
      currentAvgGain = ((currentAvgGain * (period - 1)) + gains[i]) / period;
      currentAvgLoss = ((currentAvgLoss * (period - 1)) + losses[i]) / period;

      const rs = currentAvgGain / currentAvgLoss;
      const rsiValue = 100 - (100 / (1 + rs));
      rsi.push(rsiValue);
    }

    return rsi;
  }

  static calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const fastEMA = this.calculateEMA(data, fastPeriod);
    const slowEMA = this.calculateEMA(data, slowPeriod);

    const macdLine = [];
    for (let i = 0; i < Math.min(fastEMA.length, slowEMA.length); i++) {
      macdLine.push(fastEMA[i] - slowEMA[i]);
    }

    const signalLine = this.calculateEMA(macdLine, signalPeriod);
    const histogram = [];

    for (let i = 0; i < Math.min(macdLine.length, signalLine.length); i++) {
      histogram.push(macdLine[i] - signalLine[i]);
    }

    return {
      macd: macdLine,
      signal: signalLine,
      histogram: histogram
    };
  }

  static calculateBollingerBands(data, period = 20, stdDev = 2) {
    const sma = this.calculateSMA(data, period);
    const bands = [];

    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      const mean = sma[i - period + 1];

      const variance = slice.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / period;
      const standardDeviation = Math.sqrt(variance);

      bands.push({
        upper: mean + (stdDev * standardDeviation),
        middle: mean,
        lower: mean - (stdDev * standardDeviation)
      });
    }

    return bands;
  }

  /**
   * 计算布林带开口扩张
   * 检查最近20根K线布林带上下轨间距是否逐渐扩大
   * @param {Array} data - 价格数据
   * @param {number} period - 计算周期，默认20
   * @returns {boolean} 是否开口扩张
   */
  static calculateBollingerBandExpansion(data, period = 20) {
    if (data.length < period + 20) return false;

    const bands = this.calculateBollingerBands(data, period);
    if (bands.length < 20) return false;

    // 获取最近20根K线的布林带宽度
    const recentBands = bands.slice(-20);
    const widths = recentBands.map(band => band.upper - band.lower);

    // 检查宽度是否呈上升趋势（至少前10根比后10根窄）
    const firstHalf = widths.slice(0, 10);
    const secondHalf = widths.slice(10, 20);

    const avgFirstHalf = firstHalf.reduce((sum, w) => sum + w, 0) / firstHalf.length;
    const avgSecondHalf = secondHalf.reduce((sum, w) => sum + w, 0) / secondHalf.length;

    // 如果后半段平均宽度比前半段大15%以上，认为开口扩张
    return avgSecondHalf > avgFirstHalf * 1.15;
  }

  /**
   * 计算ADX (Average Directional Index)
   * @param {Array} klines - K线数据数组
   * @param {number} period - 计算周期，默认14
   * @returns {Array} ADX数组
   */
  static calculateADX(klines, period = 14) {
    if (klines.length < period + 1) return [];

    const trueRanges = [];
    const plusDMs = [];
    const minusDMs = [];

    // 计算True Range, +DM, -DM
    for (let i = 1; i < klines.length; i++) {
      const high = parseFloat(klines[i].high);
      const low = parseFloat(klines[i].low);
      const prevHigh = parseFloat(klines[i - 1].high);
      const prevLow = parseFloat(klines[i - 1].low);

      const tr = Math.max(
        high - low,
        Math.abs(high - prevHigh),
        Math.abs(low - prevLow)
      );
      trueRanges.push(tr);

      const plusDM = high - prevHigh > prevLow - low && high - prevHigh > 0 ? high - prevHigh : 0;
      const minusDM = prevLow - low > high - prevHigh && prevLow - low > 0 ? prevLow - low : 0;

      plusDMs.push(plusDM);
      minusDMs.push(minusDM);
    }

    // 计算平滑的TR, +DM, -DM
    const smoothTR = this.calculateSmoothedValues(trueRanges, period);
    const smoothPlusDM = this.calculateSmoothedValues(plusDMs, period);
    const smoothMinusDM = this.calculateSmoothedValues(minusDMs, period);

    // 计算+DI和-DI
    const plusDI = [];
    const minusDI = [];

    for (let i = 0; i < smoothTR.length; i++) {
      plusDI.push((smoothPlusDM[i] / smoothTR[i]) * 100);
      minusDI.push((smoothMinusDM[i] / smoothTR[i]) * 100);
    }

    // 计算DX
    const dx = [];
    for (let i = 0; i < plusDI.length; i++) {
      const diSum = plusDI[i] + minusDI[i];
      const diDiff = Math.abs(plusDI[i] - minusDI[i]);
      dx.push(diSum > 0 ? (diDiff / diSum) * 100 : 0);
    }

    // 计算ADX
    const adx = this.calculateSMA(dx, period);

    return adx;
  }

  /**
   * 计算平滑值（Wilder's Smoothing）
   * @param {Array} values - 原始值数组
   * @param {number} period - 平滑周期
   * @returns {Array} 平滑后的值数组
   */
  static calculateSmoothedValues(values, period) {
    if (values.length === 0) return [];

    const smoothed = [];
    let sum = 0;

    // 第一个值
    sum = values.slice(0, period).reduce((a, b) => a + b, 0);
    smoothed.push(sum / period);

    // 后续值使用Wilder's Smoothing
    for (let i = period; i < values.length; i++) {
      sum = (sum * (period - 1) + values[i]) / period;
      smoothed.push(sum);
    }

    return smoothed;
  }

  /**
   * 计算Delta (净主动买卖量)
   * 基于价格位置和成交量的简化Delta计算
   * @param {Array} klines - K线数据数组
   * @returns {Array} Delta数组
   */
  static calculateDelta(klines) {
    const deltas = [];

    for (let i = 0; i < klines.length; i++) {
      const k = klines[i];
      const high = parseFloat(k.high);
      const low = parseFloat(k.low);
      const close = parseFloat(k.close);
      const volume = parseFloat(k.volume);

      // 基于收盘价在K线中的位置判断买卖压力
      const priceRange = high - low;
      const pricePosition = priceRange > 0 ? (close - low) / priceRange : 0.5;

      // 如果收盘价在K线上半部分，认为是买入主导
      // 如果收盘价在下半部分，认为是卖出主导
      const delta = pricePosition > 0.5 ? volume : -volume;
      deltas.push(delta);
    }

    return deltas;
  }

  /**
   * 计算累积Delta (Cumulative Volume Delta)
   * @param {Array} klines - K线数据数组
   * @returns {Array} CVD数组
   */
  static calculateCVD(klines) {
    const deltas = this.calculateDelta(klines);
    const cvd = [];
    let cumulativeDelta = 0;

    for (const delta of deltas) {
      cumulativeDelta += delta;
      cvd.push(cumulativeDelta);
    }

    return cvd;
  }

  static calculateStochastic(klines, kPeriod = 14, dPeriod = 3) {
    if (klines.length < kPeriod) return { k: [], d: [] };

    const kValues = [];

    for (let i = kPeriod - 1; i < klines.length; i++) {
      const slice = klines.slice(i - kPeriod + 1, i + 1);
      const highest = Math.max(...slice.map(k => parseFloat(k.high)));
      const lowest = Math.min(...slice.map(k => parseFloat(k.low)));
      const currentClose = parseFloat(klines[i].close);

      const k = ((currentClose - lowest) / (highest - lowest)) * 100;
      kValues.push(k);
    }

    const dValues = this.calculateSMA(kValues, dPeriod);

    return {
      k: kValues,
      d: dValues
    };
  }
}

module.exports = TechnicalIndicators;
