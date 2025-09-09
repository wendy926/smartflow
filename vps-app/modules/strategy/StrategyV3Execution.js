// StrategyV3Execution.js - 策略V3执行逻辑模块

class StrategyV3Execution {
  constructor() {
    this.maxTimeInPosition = 48; // 12小时 = 48个15分钟
  }

  /**
   * 趋势市15分钟入场执行
   */
  analyzeTrendExecution(symbol, trend4h, score1h, vwapDirectionConsistent, candles15m, candles1h) {
    try {
      if (!candles15m || candles15m.length < 20) {
        return { signal: 'NONE', mode: 'NONE', reason: '15m数据不足' };
      }

      const last15m = candles15m[candles15m.length - 1];
      const prev15m = candles15m[candles15m.length - 2];

      // 计算EMA20/50
      const ema20 = this.calculateEMA(candles15m, 20);
      const ema50 = this.calculateEMA(candles15m, 50);
      const lastEMA20 = ema20[ema20.length - 1];
      const lastEMA50 = ema50[ema50.length - 1];

      // 计算ATR14
      const atr14 = this.calculateATR(candles15m, 14);
      const lastATR = atr14[atr14.length - 1];

      // 检查VWAP方向一致性（必须满足）
      if (!vwapDirectionConsistent) {
        return { signal: 'NONE', mode: 'NONE', reason: 'VWAP方向不一致' };
      }

      // 多头模式：多头回踩突破
      if (trend4h === '多头趋势' && score1h >= 3) {
        // 检查价格回踩EMA支撑
        const priceAtSupport = last15m.close >= lastEMA20 && last15m.close >= lastEMA50;

        // 检查突破setup candle高点
        const setupBreakout = last15m.high > prev15m.high && last15m.close > prev15m.high;

        // 检查成交量确认
        const avgVol = candles15m.slice(-20).reduce((a, c) => a + c.volume, 0) / 20;
        const volConfirm = last15m.volume >= avgVol * 1.2;

        if (priceAtSupport && setupBreakout && volConfirm) {
          const entry = Math.max(last15m.close, prev15m.high);
          const stopLoss = Math.min(prev15m.low, entry - 1.2 * lastATR);
          const takeProfit = entry + 2 * (entry - stopLoss);

          return {
            signal: 'BUY',
            mode: '多头回踩突破',
            entry,
            stopLoss,
            takeProfit,
            setupCandleHigh: prev15m.high,
            setupCandleLow: prev15m.low,
            atr14: lastATR,
            reason: '趋势市多头回踩突破触发'
          };
        }
      }

      // 空头模式：空头反抽破位
      if (trend4h === '空头趋势' && score1h >= 3) {
        // 检查价格反抽EMA阻力
        const priceAtResistance = last15m.close <= lastEMA20 && last15m.close <= lastEMA50;

        // 检查跌破setup candle低点
        const setupBreakdown = last15m.low < prev15m.low && last15m.close < prev15m.low;

        // 检查成交量确认
        const avgVol = candles15m.slice(-20).reduce((a, c) => a + c.volume, 0) / 20;
        const volConfirm = last15m.volume >= avgVol * 1.2;

        if (priceAtResistance && setupBreakdown && volConfirm) {
          const entry = Math.min(last15m.close, prev15m.low);
          const stopLoss = Math.max(prev15m.high, entry + 1.2 * lastATR);
          const takeProfit = entry - 2 * (stopLoss - entry);

          return {
            signal: 'SELL',
            mode: '空头反抽破位',
            entry,
            stopLoss,
            takeProfit,
            setupCandleHigh: prev15m.high,
            setupCandleLow: prev15m.low,
            atr14: lastATR,
            reason: '趋势市空头反抽破位触发'
          };
        }
      }

      return { signal: 'NONE', mode: 'NONE', reason: '未满足趋势市入场条件' };

    } catch (error) {
      console.error(`趋势市15m执行分析失败 [${symbol}]:`, error);
      return { signal: 'NONE', mode: 'NONE', reason: '分析错误: ' + error.message };
    }
  }

  /**
   * 震荡市15分钟入场执行
   */
  analyzeRangeExecution(symbol, rangeResult, candles15m, candles1h) {
    try {
      if (!candles15m || candles15m.length < 2) {
        return { signal: 'NONE', mode: 'NONE', reason: '15m数据不足' };
      }

      const { lowerBoundaryValid, upperBoundaryValid, bbUpper, bbMiddle, bbLower } = rangeResult;
      const last15m = candles15m[candles15m.length - 1];
      const prev15m = candles15m[candles15m.length - 2];

      // 计算平均成交量
      const avgVol15m = candles15m.slice(-20).reduce((a, c) => a + c.volume, 0) / Math.min(20, candles15m.length);
      const avgVol1h = candles1h ? candles1h.slice(-20).reduce((a, c) => a + c.volume, 0) / Math.min(20, candles1h.length) : avgVol15m;

      // 区间交易 - 下轨做多
      if (lowerBoundaryValid) {
        const nearLower = last15m.close <= bbLower * 1.01;
        const smallVolNotBreak = last15m.volume < avgVol15m * 0.8 && last15m.low >= bbLower * 0.995;
        const setupBreak = last15m.high > prev15m.high && last15m.close > prev15m.high && last15m.volume >= avgVol15m * 0.8;

        if (nearLower && (smallVolNotBreak || setupBreak)) {
          const entry = Math.max(last15m.close, prev15m.high);
          const stopLoss = Math.min(bbLower * 0.995, last15m.low - last15m.low * 0.005);
          const takeProfit = bbMiddle; // 中轨止盈

          return {
            signal: 'BUY',
            mode: '区间多头',
            entry,
            stopLoss,
            takeProfit,
            setupCandleHigh: prev15m.high,
            setupCandleLow: prev15m.low,
            reason: '震荡市下轨区间交易触发'
          };
        }
      }

      // 区间交易 - 上轨做空
      if (upperBoundaryValid) {
        const nearUpper = last15m.close >= bbUpper * 0.99;
        const smallVolNotBreak = last15m.volume < avgVol15m * 0.8 && last15m.high <= bbUpper * 1.005;
        const setupBreak = last15m.low < prev15m.low && last15m.close < prev15m.low && last15m.volume >= avgVol15m * 0.8;

        if (nearUpper && (smallVolNotBreak || setupBreak)) {
          const entry = Math.min(last15m.close, prev15m.low);
          const stopLoss = Math.max(bbUpper * 1.005, last15m.high + last15m.high * 0.005);
          const takeProfit = bbMiddle; // 中轨止盈

          return {
            signal: 'SELL',
            mode: '区间空头',
            entry,
            stopLoss,
            takeProfit,
            setupCandleHigh: prev15m.high,
            setupCandleLow: prev15m.low,
            reason: '震荡市上轨区间交易触发'
          };
        }
      }

      // 假突破反手 - 向上假突破失败
      const prevAboveUpper = prev15m.close > bbUpper;
      const lastBackInside = last15m.close <= bbUpper && last15m.close >= bbLower;
      const prevVolRelative = prev15m.volume / avgVol15m;

      if (prevAboveUpper && lastBackInside && prevVolRelative < 1.2) {
        return {
          signal: 'SELL',
          mode: '假突破空头',
          entry: last15m.close,
          stopLoss: Math.max(prev15m.high * 1.01, bbUpper * 1.02),
          takeProfit: bbLower,
          setupCandleHigh: prev15m.high,
          setupCandleLow: prev15m.low,
          reason: '震荡市向上假突破失败反手'
        };
      }

      // 假突破反手 - 向下假突破失败
      const prevBelowLower = prev15m.close < bbLower;
      const lastBackInside2 = last15m.close <= bbUpper && last15m.close >= bbLower;

      if (prevBelowLower && lastBackInside2 && prevVolRelative < 1.2) {
        return {
          signal: 'BUY',
          mode: '假突破多头',
          entry: last15m.close,
          stopLoss: Math.min(prev15m.low * 0.99, bbLower * 0.98),
          takeProfit: bbUpper,
          setupCandleHigh: prev15m.high,
          setupCandleLow: prev15m.low,
          reason: '震荡市向下假突破失败反手'
        };
      }

      return { signal: 'NONE', mode: 'NONE', reason: '未满足震荡市入场条件' };

    } catch (error) {
      console.error(`震荡市15m执行分析失败 [${symbol}]:`, error);
      return { signal: 'NONE', mode: 'NONE', reason: '分析错误: ' + error.message };
    }
  }

  /**
   * 出场判断 - V3版本6种出场条件
   */
  checkExitConditions(params) {
    const {
      position, // 'LONG' | 'SHORT'
      entryPrice,
      currentPrice,
      setupCandleHigh,
      setupCandleLow,
      atr14,
      trend4h,
      score1h,
      deltaBuy,
      deltaSell,
      ema20,
      ema50,
      prevHigh,
      prevLow,
      timeInPosition,
      marketType
    } = params;

    // 计算止损和止盈
    let stopLoss, takeProfit;
    if (position === 'LONG') {
      stopLoss = Math.min(setupCandleLow, entryPrice - 1.2 * atr14);
      takeProfit = entryPrice + 2 * (entryPrice - stopLoss);
    } else {
      stopLoss = Math.max(setupCandleHigh, entryPrice + 1.2 * atr14);
      takeProfit = entryPrice - 2 * (stopLoss - entryPrice);
    }

    // 1️⃣ 止损触发
    if ((position === 'LONG' && currentPrice <= stopLoss) ||
      (position === 'SHORT' && currentPrice >= stopLoss)) {
      return { exit: true, reason: 'STOP_LOSS', exitPrice: stopLoss };
    }

    // 2️⃣ 止盈触发
    if ((position === 'LONG' && currentPrice >= takeProfit) ||
      (position === 'SHORT' && currentPrice <= takeProfit)) {
      return { exit: true, reason: 'TAKE_PROFIT', exitPrice: takeProfit };
    }

    // 3️⃣ 趋势或多因子反转
    if (marketType === '趋势市') {
      if ((position === 'LONG' && (trend4h !== '多头趋势' || score1h < 3)) ||
        (position === 'SHORT' && (trend4h !== '空头趋势' || score1h < 3))) {
        return { exit: true, reason: 'TREND_REVERSAL', exitPrice: currentPrice };
      }
    }

    // 4️⃣ Delta/主动买卖盘减弱
    const deltaImbalance = deltaSell > 0 ? deltaBuy / deltaSell : 0;
    if ((position === 'LONG' && deltaImbalance < 1.1) ||
      (position === 'SHORT' && deltaImbalance > 0.91)) { // 1/1.1
      return { exit: true, reason: 'DELTA_WEAKENING', exitPrice: currentPrice };
    }

    // 5️⃣ 跌破支撑或突破阻力
    if ((position === 'LONG' && (currentPrice < ema20 || currentPrice < ema50 || currentPrice < prevLow)) ||
      (position === 'SHORT' && (currentPrice > ema20 || currentPrice > ema50 || currentPrice > prevHigh))) {
      return { exit: true, reason: 'SUPPORT_RESISTANCE_BREAK', exitPrice: currentPrice };
    }

    // 6️⃣ 时间止损
    if (timeInPosition >= this.maxTimeInPosition) {
      return { exit: true, reason: 'TIME_STOP', exitPrice: currentPrice };
    }

    // 否则继续持仓
    return { exit: false, reason: '', exitPrice: null };
  }

  /**
   * 计算EMA
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
}

module.exports = StrategyV3Execution;
