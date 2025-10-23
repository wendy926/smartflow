/**
 * ADX (Average Directional Index) 计算器
 * 用于识别趋势强度，过滤震荡市
 */

class ADXCalculator {
  /**
   * 计算ADX指标
   * @param {Array} klines - K线数据 [[timestamp, open, high, low, close, volume, ...], ...]
   * @param {number} period - 计算周期，默认14
   * @returns {number} ADX值 (0-100)
   */
  static calculateADX(klines, period = 14) {
    if (!klines || klines.length < period + 1) {
      return 0;
    }

    const trueRanges = [];
    const plusDMs = [];
    const minusDMs = [];

    // 1. 计算True Range和Directional Movement
    for (let i = 1; i < klines.length; i++) {
      const high = parseFloat(klines[i][2]);
      const low = parseFloat(klines[i][3]);
      const prevHigh = parseFloat(klines[i - 1][2]);
      const prevLow = parseFloat(klines[i - 1][3]);
      const prevClose = parseFloat(klines[i - 1][4]);

      // True Range = max(high-low, abs(high-prevClose), abs(low-prevClose))
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);

      // Directional Movement
      const highDiff = high - prevHigh;
      const lowDiff = prevLow - low;

      const plusDM = (highDiff > lowDiff && highDiff > 0) ? highDiff : 0;
      const minusDM = (lowDiff > highDiff && lowDiff > 0) ? lowDiff : 0;

      plusDMs.push(plusDM);
      minusDMs.push(minusDM);
    }

    if (trueRanges.length < period) {
      return 0;
    }

    // 2. 计算平滑的ATR和DI
    // 使用简单移动平均（可以改为Wilder's smoothing以提高精度）
    const atr = this.smoothedAverage(trueRanges, period);
    const plusDI = (this.smoothedAverage(plusDMs, period) / atr) * 100;
    const minusDI = (this.smoothedAverage(minusDMs, period) / atr) * 100;

    // 3. 计算DX (Directional Index)
    const diSum = plusDI + minusDI;
    if (diSum === 0) {
      return 0;
    }
    const dx = (Math.abs(plusDI - minusDI) / diSum) * 100;

    // 4. ADX是DX的移动平均
    // 这里简化处理，直接返回DX作为ADX的近似值
    // 完整实现需要对DX再做一次平滑
    return isNaN(dx) ? 0 : Math.min(100, dx);
  }

  /**
   * 计算平滑平均值（后N个元素）
   */
  static smoothedAverage(array, period) {
    if (array.length < period) {
      return 0;
    }
    const slice = array.slice(-period);
    const sum = slice.reduce((a, b) => a + b, 0);
    return sum / period;
  }

  /**
   * Wilder's Smoothing Method (更精确的ADX计算)
   * @param {Array} values - 数值数组
   * @param {number} period - 周期
   * @returns {Array} 平滑后的数组
   */
  static wildersSmoothing(values, period) {
    if (values.length < period) {
      return [];
    }

    const smoothed = [];
    
    // 第一个值是简单平均
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += values[i];
    }
    smoothed.push(sum / period);

    // 后续值使用Wilder's公式
    for (let i = period; i < values.length; i++) {
      const prev = smoothed[smoothed.length - 1];
      const current = ((prev * (period - 1)) + values[i]) / period;
      smoothed.push(current);
    }

    return smoothed;
  }

  /**
   * 判断市场状态
   * @param {number} adx - ADX值
   * @returns {string} 市场状态: STRONG_TREND/TRENDING/RANGING/WEAK
   */
  static getMarketState(adx) {
    if (adx >= 35) return 'STRONG_TREND';  // 强趋势
    if (adx >= 25) return 'TRENDING';       // 趋势市
    if (adx >= 20) return 'RANGING';        // 弱趋势/震荡
    return 'WEAK';                           // 极弱/无趋势
  }

  /**
   * 判断是否应该过滤（震荡市）
   * @param {number} adx - ADX值
   * @param {number} threshold - 阈值，默认20
   * @returns {boolean} true表示应该过滤（震荡市）
   */
  static shouldFilter(adx, threshold = 20) {
    return adx < threshold;
  }
}

module.exports = ADXCalculator;
