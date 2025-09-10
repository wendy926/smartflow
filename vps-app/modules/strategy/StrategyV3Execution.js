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
          // 严格按照strategy-v3.md: 止损 = min(setup candle 低点, 收盘价 - 1.2 × ATR(14))
          const stopLoss = Math.min(prev15m.low, last15m.close - 1.2 * lastATR);
          const takeProfit = entry + 2 * (entry - stopLoss);

          console.log(`多头回踩突破: entry=${entry}, stopLoss=${stopLoss}, takeProfit=${takeProfit}, atr14=${lastATR}`);

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
          // 严格按照strategy-v3.md: 止损 = max(setup candle 高点, 收盘价 + 1.2 × ATR(14))
          const stopLoss = Math.max(prev15m.high, last15m.close + 1.2 * lastATR);
          const takeProfit = entry - 2 * (stopLoss - entry);

          console.log(`空头反抽破位: entry=${entry}, stopLoss=${stopLoss}, takeProfit=${takeProfit}, atr14=${lastATR}`);

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

      return { signal: 'NONE', mode: 'NONE', reason: '未满足趋势市入场条件', atr14: lastATR };

    } catch (error) {
      console.error(`趋势市15m执行分析失败 [${symbol}]:`, error);
      return { signal: 'NONE', mode: 'NONE', reason: '分析错误: ' + error.message, atr14: null };
    }
  }

  /**
   * 震荡市15分钟入场执行 - 严格按照strategy-v3.md实现
   */
  analyzeRangeExecution(symbol, rangeResult, candles15m, candles1h) {
    try {
      if (!candles15m || candles15m.length < 20) {
        return { signal: 'NONE', mode: 'NONE', reason: '15m数据不足', atr14: null };
      }

      const { lowerBoundaryValid, upperBoundaryValid, bb1h } = rangeResult;
      if (!bb1h) {
        return { signal: 'NONE', mode: 'NONE', reason: '1H边界数据无效', atr14: null };
      }

      const last15m = candles15m[candles15m.length - 1];
      const prev15m = candles15m[candles15m.length - 2];

      // 计算ATR14 - 震荡市也需要ATR用于止损计算
      let atr14 = this.calculateATR(candles15m, 14);
      let lastATR = atr14[atr14.length - 1];
      
      // ATR计算失败时重试一次
      if (!atr14 || atr14.length === 0 || !lastATR || lastATR <= 0) {
        console.warn(`ATR计算失败，尝试重试 [${symbol}]`);
        atr14 = this.calculateATR(candles15m, 14);
        lastATR = atr14[atr14.length - 1];
        
        if (!atr14 || atr14.length === 0 || !lastATR || lastATR <= 0) {
          console.error(`ATR计算重试失败 [${symbol}]`);
          return { signal: 'NONE', mode: 'NONE', reason: 'ATR计算失败', atr14: null };
        }
      }

      // 配置参数 - 严格按照文档
      const opts = {
        lowerTouchPct: 0.015,
        upperTouchPct: 0.015,
        vol15mMultiplier: 1.7,
        falseBreakVolThreshold: 1.2,
        takeProfitMode: "mid_or_opposite"
      };

      // 计算平均成交量
      const avgVol15m = candles15m.slice(-20).reduce((a, c) => a + c.volume, 0) / Math.min(20, candles15m.length);
      const avgVol1h = candles1h ? candles1h.slice(-20).reduce((a, c) => a + c.volume, 0) / Math.min(20, candles1h.length) : avgVol15m;

      // 检查是否接近边界 - 严格按照文档
      const nearLower = last15m.close <= bb1h.lower * (1 + opts.lowerTouchPct);
      const nearUpper = last15m.close >= bb1h.upper * (1 - opts.upperTouchPct);

      // === 区间交易 - 下轨做多 ===
      if (lowerBoundaryValid && nearLower) {
        const smallVolNotBreak = last15m.volume < avgVol15m * 0.8 && last15m.low >= bb1h.lower * 0.995;
        const setupBreak = last15m.high > prev15m.high && last15m.close > prev15m.high && last15m.volume >= avgVol15m * 0.8;
        
        if (smallVolNotBreak || setupBreak) {
          const entry = Math.max(last15m.close, prev15m.high);
          // 严格按照文档：Math.min(bb1h.lower * 0.995, last15.low - last15.low * 0.005)
          const stopLoss = Math.min(bb1h.lower * 0.995, last15m.low - last15m.low * 0.005);
          // 严格按照文档：p.takeProfitMode === "mid_or_opposite" ? bb1h.middle : bb1h.upper
          const takeProfit = opts.takeProfitMode === "mid_or_opposite" ? bb1h.middle : bb1h.upper;

          console.log(`震荡市下轨多头: entry=${entry}, stopLoss=${stopLoss}, takeProfit=${takeProfit}, mode=${opts.takeProfitMode}`);

          return {
            signal: 'BUY',
            mode: 'RANGE_LONG',
            entry,
            stopLoss,
            takeProfit,
            setupCandleHigh: prev15m.high,
            setupCandleLow: prev15m.low,
            atr14: lastATR,
            reason: '下轨区间交易触发'
          };
        }
      }

      // === 区间交易 - 上轨做空 ===
      if (upperBoundaryValid && nearUpper) {
        const smallVolNotBreak = last15m.volume < avgVol15m * 0.8 && last15m.high <= bb1h.upper * 1.005;
        const setupBreak = last15m.low < prev15m.low && last15m.close < prev15m.low && last15m.volume >= avgVol15m * 0.8;
        
        if (smallVolNotBreak || setupBreak) {
          const entry = Math.min(last15m.close, prev15m.low);
          // 严格按照文档：Math.max(bb1h.upper * 1.005, last15.high + last15.high * 0.005)
          const stopLoss = Math.max(bb1h.upper * 1.005, last15m.high + last15m.high * 0.005);
          // 严格按照文档：p.takeProfitMode === "mid_or_opposite" ? bb1h.middle : bb1h.lower
          const takeProfit = opts.takeProfitMode === "mid_or_opposite" ? bb1h.middle : bb1h.lower;

          console.log(`震荡市上轨空头: entry=${entry}, stopLoss=${stopLoss}, takeProfit=${takeProfit}, mode=${opts.takeProfitMode}`);

          return {
            signal: 'SELL',
            mode: 'RANGE_SHORT',
            entry,
            stopLoss,
            takeProfit,
            setupCandleHigh: prev15m.high,
            setupCandleLow: prev15m.low,
            atr14: lastATR,
            reason: '上轨区间交易触发'
          };
        }
      }

      // === 假突破反手 - 向上假突破失败 ===
      const prevAboveUpper = prev15m.close > bb1h.upper;
      const lastBackInside = last15m.close <= bb1h.upper && last15m.close >= bb1h.lower;
      const prevVolRelative = prev15m.volume / avgVol15m;

      if (prevAboveUpper && lastBackInside && prevVolRelative < opts.falseBreakVolThreshold) {
        const entry = last15m.close;
        // 严格按照文档：Math.max(prev15.high * 1.01, bb1h.upper * 1.02)
        const stopLoss = Math.max(prev15m.high * 1.01, bb1h.upper * 1.02);
        const takeProfit = bb1h.lower;

        console.log(`向上假突破反手: entry=${entry}, stopLoss=${stopLoss}, takeProfit=${takeProfit}`);

        return {
          signal: 'SELL',
          mode: 'FALSE_BREAK_SHORT',
          entry,
          stopLoss,
          takeProfit,
          setupCandleHigh: prev15m.high,
          setupCandleLow: prev15m.low,
          atr14: lastATR,
          reason: '向上假突破失败反手'
        };
      }

      // === 假突破反手 - 向下假突破失败 ===
      const prevBelowLower = prev15m.close < bb1h.lower;
      const lastBackInside2 = last15m.close <= bb1h.upper && last15m.close >= bb1h.lower;

      if (prevBelowLower && lastBackInside2 && prevVolRelative < opts.falseBreakVolThreshold) {
        const entry = last15m.close;
        // 严格按照文档：Math.min(prev15.low * 0.99, bb1h.lower * 0.98)
        const stopLoss = Math.min(prev15m.low * 0.99, bb1h.lower * 0.98);
        const takeProfit = bb1h.upper;

        console.log(`向下假突破反手: entry=${entry}, stopLoss=${stopLoss}, takeProfit=${takeProfit}`);

        return {
          signal: 'BUY',
          mode: 'FALSE_BREAK_LONG',
          entry,
          stopLoss,
          takeProfit,
          setupCandleHigh: prev15m.high,
          setupCandleLow: prev15m.low,
          atr14: lastATR,
          reason: '向下假突破失败反手'
        };
      }

      // 记录震荡市15分钟执行指标到监控系统
      if (this.dataMonitor) {
        this.dataMonitor.recordIndicator(symbol, '震荡市15分钟执行', {
          nearLower,
          nearUpper,
          lowerBoundaryValid,
          upperBoundaryValid,
          avgVol15m,
          avgVol1h,
          lastATR,
          bb1h: rangeResult.bb1h
        });
      }

      return { signal: 'NONE', mode: 'NONE', reason: '未满足震荡市入场条件', atr14: lastATR };

    } catch (error) {
      console.error(`震荡市15m执行分析失败 [${symbol}]:`, error);
      
      // 记录错误到监控系统
      if (this.dataMonitor) {
        this.dataMonitor.recordDataValidationError(
          'RANGE_15M_EXECUTION_FAILED',
          `震荡市15分钟执行失败: ${error.message}`,
          { symbol, error: error.message }
        );
      }
      
      return { signal: 'NONE', mode: 'NONE', reason: '分析错误: ' + error.message, atr14: null };
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

    // 计算止损和止盈 - 严格按照strategy-v3.md规范
    let stopLoss, takeProfit;
    
    // 确保ATR值有效，如果为空则使用默认值
    const effectiveATR = atr14 && atr14 > 0 ? atr14 : entryPrice * 0.01; // 默认1%的ATR
    
    if (position === 'LONG') {
      // 多头：止损 = min(setup candle 低点, 入场价 - 1.2 × ATR(14))
      const stopLossByATR = entryPrice - 1.2 * effectiveATR;
      stopLoss = setupCandleLow ? Math.min(setupCandleLow, stopLossByATR) : stopLossByATR;
      takeProfit = entryPrice + 2 * (entryPrice - stopLoss);
    } else {
      // 空头：止损 = max(setup candle 高点, 入场价 + 1.2 × ATR(14))
      const stopLossByATR = entryPrice + 1.2 * effectiveATR;
      stopLoss = setupCandleHigh ? Math.max(setupCandleHigh, stopLossByATR) : stopLossByATR;
      takeProfit = entryPrice - 2 * (stopLoss - entryPrice);
    }

    console.log(`出场条件检查: position=${position}, entryPrice=${entryPrice}, stopLoss=${stopLoss}, takeProfit=${takeProfit}, atr14=${atr14}, effectiveATR=${effectiveATR}`);

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

    // 3️⃣ 震荡市区间边界失效止损
    if (marketType === '震荡市') {
      // 需要传入区间边界参数，这里先用EMA作为近似
      const rangeHigh = ema20 + effectiveATR * 2; // 近似区间高点
      const rangeLow = ema20 - effectiveATR * 2;  // 近似区间低点
      
      if (position === 'LONG' && currentPrice < (rangeLow - effectiveATR)) {
        return { exit: true, reason: 'RANGE_BOUNDARY_BREAK', exitPrice: currentPrice };
      }
      if (position === 'SHORT' && currentPrice > (rangeHigh + effectiveATR)) {
        return { exit: true, reason: 'RANGE_BOUNDARY_BREAK', exitPrice: currentPrice };
      }
    }

    // 4️⃣ 趋势或多因子反转
    if (marketType === '趋势市') {
      if ((position === 'LONG' && (trend4h !== '多头趋势' || score1h < 3)) ||
        (position === 'SHORT' && (trend4h !== '空头趋势' || score1h < 3))) {
        return { exit: true, reason: 'TREND_REVERSAL', exitPrice: currentPrice };
      }
    }

    // 5️⃣ Delta/主动买卖盘减弱
    const deltaImbalance = deltaSell > 0 ? deltaBuy / deltaSell : 0;
    if ((position === 'LONG' && deltaImbalance < 1.1) ||
      (position === 'SHORT' && deltaImbalance > 0.91)) { // 1/1.1
      return { exit: true, reason: 'DELTA_WEAKENING', exitPrice: currentPrice };
    }

    // 6️⃣ 跌破支撑或突破阻力
    if ((position === 'LONG' && (currentPrice < ema20 || currentPrice < ema50 || currentPrice < prevLow)) ||
      (position === 'SHORT' && (currentPrice > ema20 || currentPrice > ema50 || currentPrice > prevHigh))) {
      return { exit: true, reason: 'SUPPORT_RESISTANCE_BREAK', exitPrice: currentPrice };
    }

    // 7️⃣ 时间止损
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
   * 计算ATR - 严格按照strategy-v3.md规范
   * TR = max(High-Low, |High-Close_prev|, |Low-Close_prev|)
   * ATR = EMA_14(TR)
   */
  calculateATR(candles, period = 14) {
    if (!candles || candles.length < period + 1) {
      console.warn(`ATR计算失败: K线数据不足，需要至少${period + 1}根K线，实际${candles?.length || 0}根`);
      return [];
    }

    const tr = [];
    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const closePrev = candles[i - 1].close;

      const trueRange = Math.max(
        high - low,
        Math.abs(high - closePrev),
        Math.abs(low - closePrev)
      );
      tr.push(trueRange);
    }

    // 使用EMA计算ATR
    const atr = this.calculateEMA(tr.map(t => ({ close: t })), period);
    
    console.log(`ATR计算完成: TR数组长度=${tr.length}, ATR数组长度=${atr.length}, 最新ATR=${atr[atr.length - 1]}`);
    return atr;
  }
}

module.exports = StrategyV3Execution;
