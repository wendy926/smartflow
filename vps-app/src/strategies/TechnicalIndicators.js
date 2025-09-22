/**
 * 技术指标计算模块
 * 严格按照strategy-v3.md和ict.md要求实现
 */

class TechnicalIndicators {
  /**
   * 计算简单移动平均线 (SMA)
   * @param {Array} prices - 价格数组
   * @param {number} period - 周期
   * @returns {Array} SMA数组
   */
  static calculateSMA(prices, period) {
    const sma = [];
    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
    return sma;
  }

  /**
   * 计算指数移动平均线 (EMA)
   * @param {Array} prices - 价格数组
   * @param {number} period - 周期
   * @returns {Array} EMA数组
   */
  static calculateEMA(prices, period) {
    if (prices.length === 0) return [];
    
    const k = 2 / (period + 1);
    const ema = [];
    ema[0] = prices[0]; // 初始值用首个价格
    
    for (let i = 1; i < prices.length; i++) {
      ema[i] = prices[i] * k + ema[i - 1] * (1 - k);
    }
    
    return ema;
  }

  /**
   * 计算真实波动幅度 (TR)
   * @param {Array} highs - 最高价数组
   * @param {Array} lows - 最低价数组
   * @param {Array} closes - 收盘价数组
   * @returns {Array} TR数组
   */
  static calculateTR(highs, lows, closes) {
    const tr = [];
    tr[0] = highs[0] - lows[0]; // 第一根K线的TR
    
    for (let i = 1; i < highs.length; i++) {
      const tr1 = highs[i] - lows[i];
      const tr2 = Math.abs(highs[i] - closes[i - 1]);
      const tr3 = Math.abs(lows[i] - closes[i - 1]);
      tr[i] = Math.max(tr1, tr2, tr3);
    }
    
    return tr;
  }

  /**
   * 计算平均真实波动幅度 (ATR)
   * @param {Array} highs - 最高价数组
   * @param {Array} lows - 最低价数组
   * @param {Array} closes - 收盘价数组
   * @param {number} period - 周期，默认14
   * @returns {Array} ATR数组
   */
  static calculateATR(highs, lows, closes, period = 14) {
    const tr = this.calculateTR(highs, lows, closes);
    const atr = this.calculateEMA(tr, period);
    return atr;
  }

  /**
   * 计算方向移动指标 (DM)
   * @param {Array} highs - 最高价数组
   * @param {Array} lows - 最低价数组
   * @returns {Object} {dmPlus, dmMinus}
   */
  static calculateDM(highs, lows) {
    const dmPlus = [];
    const dmMinus = [];
    
    dmPlus[0] = 0;
    dmMinus[0] = 0;
    
    for (let i = 1; i < highs.length; i++) {
      const highDiff = highs[i] - highs[i - 1];
      const lowDiff = lows[i - 1] - lows[i];
      
      if (highDiff > lowDiff && highDiff > 0) {
        dmPlus[i] = highDiff;
        dmMinus[i] = 0;
      } else if (lowDiff > highDiff && lowDiff > 0) {
        dmPlus[i] = 0;
        dmMinus[i] = lowDiff;
      } else {
        dmPlus[i] = 0;
        dmMinus[i] = 0;
      }
    }
    
    return { dmPlus, dmMinus };
  }

  /**
   * 计算ADX指标
   * @param {Array} highs - 最高价数组
   * @param {Array} lows - 最低价数组
   * @param {Array} closes - 收盘价数组
   * @param {number} period - 周期，默认14
   * @returns {Object} {adx, diPlus, diMinus}
   */
  static calculateADX(highs, lows, closes, period = 14) {
    const tr = this.calculateTR(highs, lows, closes);
    const { dmPlus, dmMinus } = this.calculateDM(highs, lows);
    
    // 平滑TR, DM+, DM-
    const smTR = this.smoothArray(tr, period);
    const smDmPlus = this.smoothArray(dmPlus, period);
    const smDmMinus = this.smoothArray(dmMinus, period);
    
    // 计算DI+, DI-
    const diPlus = [];
    const diMinus = [];
    
    for (let i = 0; i < smTR.length; i++) {
      diPlus[i] = 100 * (smDmPlus[i] / smTR[i]);
      diMinus[i] = 100 * (smDmMinus[i] / smTR[i]);
    }
    
    // 计算DX
    const dx = [];
    for (let i = 0; i < diPlus.length; i++) {
      const sum = diPlus[i] + diMinus[i];
      if (sum > 0) {
        dx[i] = 100 * Math.abs(diPlus[i] - diMinus[i]) / sum;
      } else {
        dx[i] = 0;
      }
    }
    
    // 计算ADX (DX的EMA)
    const adx = this.calculateEMA(dx, period);
    
    return {
      adx: adx[adx.length - 1] || 0,
      diPlus: diPlus[diPlus.length - 1] || 0,
      diMinus: diMinus[diMinus.length - 1] || 0
    };
  }

  /**
   * 平滑数组（Wilder's smoothing）
   * @param {Array} arr - 输入数组
   * @param {number} period - 周期
   * @returns {Array} 平滑后的数组
   */
  static smoothArray(arr, period) {
    const smoothed = [];
    smoothed[period - 1] = arr.slice(0, period).reduce((a, b) => a + b, 0);
    
    for (let i = period; i < arr.length; i++) {
      smoothed[i] = smoothed[i - 1] - smoothed[i - 1] / period + arr[i];
    }
    
    return smoothed;
  }

  /**
   * 计算布林带
   * @param {Array} prices - 价格数组
   * @param {number} period - 周期，默认20
   * @param {number} multiplier - 标准差倍数，默认2
   * @returns {Object} {upper, middle, lower, width}
   */
  static calculateBollingerBands(prices, period = 20, multiplier = 2) {
    const sma = this.calculateSMA(prices, period);
    const bands = [];
    
    for (let i = period - 1; i < prices.length; i++) {
      const slice = prices.slice(i - period + 1, i + 1);
      const mean = sma[i - period + 1];
      const variance = slice.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / period;
      const stdDev = Math.sqrt(variance);
      
      const upper = mean + multiplier * stdDev;
      const lower = mean - multiplier * stdDev;
      const width = (upper - lower) / mean;
      
      bands.push({
        upper,
        middle: mean,
        lower,
        width
      });
    }
    
    return bands;
  }

  /**
   * 计算VWAP (成交量加权平均价格)
   * @param {Array} klines - K线数据数组 [{high, low, close, volume}]
   * @returns {number} VWAP值
   */
  static calculateVWAP(klines) {
    let pvSum = 0; // Price * Volume 累积
    let vSum = 0;  // Volume 累积
    
    for (const k of klines) {
      // 典型价格
      const typicalPrice = (k.high + k.low + k.close) / 3;
      pvSum += typicalPrice * k.volume;
      vSum += k.volume;
    }
    
    return vSum > 0 ? pvSum / vSum : null;
  }

  /**
   * 计算成交量比率
   * @param {Array} volumes - 成交量数组
   * @param {number} period - 周期，默认20
   * @returns {Array} 成交量比率数组
   */
  static calculateVolumeRatio(volumes, period = 20) {
    const volumeMA = this.calculateSMA(volumes, period);
    const ratios = [];
    
    for (let i = period - 1; i < volumes.length; i++) {
      ratios.push(volumes[i] / volumeMA[i - period + 1]);
    }
    
    return ratios;
  }

  /**
   * 检测吞没形态
   * @param {Object} prevCandle - 前一根K线 {open, high, low, close}
   * @param {Object} currCandle - 当前K线 {open, high, low, close}
   * @param {number} atr - ATR值
   * @param {string} trend - 趋势方向 'up' | 'down'
   * @returns {boolean} 是否为吞没形态
   */
  static isEngulfingPattern(prevCandle, currCandle, atr, trend = 'up') {
    const prevBody = Math.abs(prevCandle.close - prevCandle.open);
    const currBody = Math.abs(currCandle.close - currCandle.open);
    
    // 当前K线实体必须足够大
    if (currBody < 0.6 * atr) return false;
    
    // 当前K线实体必须大于前一根的1.5倍
    if (currBody < 1.5 * prevBody) return false;
    
    if (trend === 'up') {
      // 多头吞没：当前收盘 > 前一根开盘，当前开盘 < 前一根收盘
      return currCandle.close > prevCandle.open && currCandle.open < prevCandle.close;
    } else {
      // 空头吞没：当前收盘 < 前一根开盘，当前开盘 > 前一根收盘
      return currCandle.close < prevCandle.open && currCandle.open > prevCandle.close;
    }
  }

  /**
   * 检测突破
   * @param {number} currentPrice - 当前价格
   * @param {Array} highs - 历史最高价数组
   * @param {Array} lows - 历史最低价数组
   * @param {string} direction - 突破方向 'up' | 'down'
   * @returns {boolean} 是否突破
   */
  static isBreakout(currentPrice, highs, lows, direction = 'up') {
    if (direction === 'up') {
      return currentPrice > Math.max(...highs);
    } else {
      return currentPrice < Math.min(...lows);
    }
  }

  /**
   * 计算趋势方向得分
   * @param {number} close - 收盘价
   * @param {number} ma20 - MA20
   * @param {number} ma50 - MA50
   * @param {number} ma200 - MA200
   * @returns {Object} {bullScore, bearScore, direction}
   */
  static calculateTrendScore(close, ma20, ma50, ma200) {
    let bullScore = 0;
    let bearScore = 0;
    
    // 收盘价与MA20关系
    if (close > ma20) bullScore++;
    else if (close < ma20) bearScore++;
    
    // MA20与MA50关系
    if (ma20 > ma50) bullScore++;
    else if (ma20 < ma50) bearScore++;
    
    // MA50与MA200关系
    if (ma50 > ma200) bullScore++;
    else if (ma50 < ma200) bearScore++;
    
    // 判断趋势方向
    let direction = 'RANGE';
    if (bullScore >= 2) direction = 'BULL';
    else if (bearScore >= 2) direction = 'BEAR';
    
    return {
      bullScore,
      bearScore,
      direction,
      totalScore: bullScore + bearScore
    };
  }
}

module.exports = TechnicalIndicators;
