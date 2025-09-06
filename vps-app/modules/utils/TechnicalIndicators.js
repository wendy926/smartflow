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
