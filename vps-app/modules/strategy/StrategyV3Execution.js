// StrategyV3Execution.js - 策略V3执行逻辑模块

const BinanceAPI = require('../api/BinanceAPI');

class StrategyV3Execution {
  constructor() {
    this.maxTimeInPosition = 24; // 6小时 = 24个15分钟（严格按照strategy-v3.md文档）
    this.dataMonitor = null; // 将在外部设置
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
   * 震荡市15分钟假突破入场执行 - 严格按照strategy-v3.md重新实现
   */
  async analyzeRangeExecution(symbol, rangeResult, candles15m, candles1h, deltaManager = null) {
    try {
      if (!candles15m || candles15m.length < 20) {
        // 记录15分钟执行指标失败
        if (this.dataMonitor) {
          this.dataMonitor.recordIndicator(symbol, '15分钟执行', {
            error: '15m数据不足',
            signal: 'NONE',
            mode: 'NONE',
            atr14: null
          }, Date.now());
        }
        return { signal: 'NONE', mode: 'NONE', reason: '15m数据不足', atr14: null };
      }

      const { lowerBoundaryValid, upperBoundaryValid, bb1h } = rangeResult;
      if (!bb1h) {
        // 记录15分钟执行指标失败
        if (this.dataMonitor) {
          this.dataMonitor.recordIndicator(symbol, '15分钟执行', {
            error: '1H边界数据无效',
            signal: 'NONE',
            mode: 'NONE',
            atr14: null
          }, Date.now());
        }
        return { signal: 'NONE', mode: 'NONE', reason: '1H边界数据无效', atr14: null };
      }

      const last15m = candles15m[candles15m.length - 1];
      const prev15m = candles15m[candles15m.length - 2];

      // 1. 计算15m布林带宽收窄 - 严格按照文档
      const closes15m = candles15m.slice(-20).map(c => c.close);
      const bbWidth = this.calculateBBWidth(closes15m, 20, 2);
      const narrowBB = bbWidth < 0.05; // 布林带宽收窄阈值

      if (!narrowBB) {
        // 记录15分钟执行指标失败
        if (this.dataMonitor) {
          this.dataMonitor.recordIndicator(symbol, '15分钟执行', {
            error: '15m布林带未收窄',
            signal: 'NONE',
            mode: 'NONE',
            atr14: null
          }, Date.now());
        }
        return { signal: 'NONE', mode: 'NONE', reason: '15m布林带未收窄', atr14: null };
      }

      // 2. 计算ATR14 - 震荡市也需要ATR用于止损计算
      let atr14 = this.calculateATR(candles15m, 14);
      let lastATR = atr14[atr14.length - 1];

      // ATR计算失败时重试一次
      if (!atr14 || atr14.length === 0 || !lastATR || lastATR <= 0) {
        console.warn(`ATR计算失败，尝试重试 [${symbol}]`);
        atr14 = this.calculateATR(candles15m, 14);
        lastATR = atr14[atr14.length - 1];

        if (!atr14 || atr14.length === 0 || !lastATR || lastATR <= 0) {
          console.error(`ATR计算重试失败 [${symbol}]`);
          // 记录15分钟执行指标失败
          if (this.dataMonitor) {
            this.dataMonitor.recordIndicator(symbol, '15分钟执行', {
              error: 'ATR计算失败',
              signal: 'NONE',
              mode: 'NONE',
              atr14: null
            }, Date.now());
          }
          return { signal: 'NONE', mode: 'NONE', reason: 'ATR计算失败', atr14: null };
        }
      }

      // 3. 配置参数 - 严格按照文档
      const opts = {
        lowerTouchPct: 0.015,
        upperTouchPct: 0.015,
        vol15mMultiplier: 1.7,
        falseBreakVolThreshold: 1.2,
        takeProfitMode: "mid_or_opposite"
      };

      // 4. 计算平均成交量
      const avgVol15m = candles15m.slice(-20).reduce((a, c) => a + c.volume, 0) / Math.min(20, candles15m.length);
      const avgVol1h = candles1h ? candles1h.slice(-20).reduce((a, c) => a + c.volume, 0) / Math.min(20, candles1h.length) : avgVol15m;

      // 5. 检查是否在1H区间内 - 严格按照文档
      const rangeHigh = bb1h.upper;
      const rangeLow = bb1h.lower;
      const inRange = last15m.close < rangeHigh && last15m.close > rangeLow;

      if (!inRange) {
        return { signal: 'NONE', mode: 'NONE', reason: '不在1H区间内', atr14: lastATR };
      }

      // 6. 假突破入场条件判断 - 按照strategy-v3.md优化实现
      const prevClose = prev15m.close;
      const lastClose = last15m.close;
      let signal = 'NONE', mode = 'NONE', entry = null, stopLoss = null, takeProfit = null, reason = '';

      // 6a. 获取15分钟多因子数据
      const multiFactorData = await this.getMultiFactorData(symbol, last15m.close, deltaManager);
      const factorScore15m = this.calculateFactorScore({
        currentPrice: multiFactorData.currentPrice,
        vwap: multiFactorData.vwap,
        delta: multiFactorData.delta,
        oi: multiFactorData.oi,
        volume: multiFactorData.volume,
        signalType: 'long' // 先假设多头，后续根据实际信号调整
      });

      // 6b. 空头假突破：突破上沿后快速回撤 + 多因子确认
      if (prevClose > rangeHigh && lastClose < rangeHigh && upperBoundaryValid) {
        const shortFactorScore = this.calculateFactorScore({
          currentPrice: multiFactorData.currentPrice,
          vwap: multiFactorData.vwap,
          delta: multiFactorData.delta,
          oi: multiFactorData.oi,
          volume: multiFactorData.volume,
          signalType: 'short'
        });

        if (shortFactorScore >= 2) { // 多因子得分≥2才入场
          signal = 'SHORT';
          mode = '假突破反手';
          entry = lastClose;
          stopLoss = rangeHigh;
          takeProfit = entry - 2 * (stopLoss - entry); // 1:2 RR
          reason = `假突破上沿→空头入场 (多因子得分:${shortFactorScore})`;
        }
      }

      // 6c. 多头假突破：突破下沿后快速回撤 + 多因子确认
      if (prevClose < rangeLow && lastClose > rangeLow && lowerBoundaryValid) {
        if (factorScore15m >= 2) { // 多因子得分≥2才入场
          signal = 'BUY';
          mode = '假突破反手';
          entry = lastClose;
          stopLoss = rangeLow;
          takeProfit = entry + 2 * (entry - stopLoss); // 1:2 RR
          reason = `假突破下沿→多头入场 (多因子得分:${factorScore15m})`;
        }
      }

      // 7. 如果没有假突破信号，返回无信号
      if (signal === 'NONE') {
        return {
          signal: 'NONE',
          mode: 'NONE',
          reason: '未满足假突破条件',
          atr14: lastATR,
          bbWidth: bbWidth
        };
      }

      // 8. 计算杠杆和保证金数据
      const direction = signal === 'BUY' ? 'LONG' : 'SHORT';
      const leverageData = this.calculateLeverageData(entry, stopLoss, takeProfit, direction);

      // 记录15分钟执行指标到监控系统
      if (this.dataMonitor) {
        this.dataMonitor.recordIndicator(symbol, '15分钟执行', {
          signal,
          mode,
          reason,
          entry,
          stopLoss,
          takeProfit,
          atr14: lastATR,
          bbWidth: bbWidth,
          factorScore15m,
          vwap15m: multiFactorData.vwap,
          delta: multiFactorData.delta,
          oi: multiFactorData.oi,
          volume: multiFactorData.volume
        }, Date.now());
      }

      return {
        signal,
        mode,
        reason,
        entry,
        stopLoss,
        takeProfit,
        atr14: lastATR,
        bbWidth: bbWidth,
        leverage: leverageData.leverage,
        margin: leverageData.margin,
        riskAmount: leverageData.riskAmount,
        rewardAmount: leverageData.rewardAmount,
        riskRewardRatio: leverageData.riskRewardRatio
      };
    } catch (error) {
      console.error(`震荡市15m执行分析失败 [${symbol}]:`, error);
      // 记录15分钟执行指标失败
      if (this.dataMonitor) {
        this.dataMonitor.recordIndicator(symbol, '15分钟执行', {
          error: error.message,
          signal: 'NONE',
          mode: 'NONE',
          atr14: null
        }, Date.now());
      }
      return { signal: 'NONE', mode: 'NONE', reason: '分析错误: ' + error.message, atr14: null };
    }
  }

  /**
   * 计算布林带宽 - 按照strategy-v3.md实现
   */
  calculateBBWidth(closes, period = 20, k = 2) {
    if (closes.length < period) return 1; // 数据不足时返回默认值

    const slice = closes.slice(-period);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / period;
    const deviation = Math.sqrt(variance);

    const upper = mean + k * deviation;
    const lower = mean - k * deviation;

    return (upper - lower) / mean;
  }

  /**
   * 多因子打分系统 - 按照strategy-v3.md优化实现
   */
  calculateFactorScore({ currentPrice, vwap, delta, oi, volume, signalType }) {
    let score = 0;

    // 1. VWAP因子：当前价 > VWAP → +1，否则 -1
    const vwapFactor = currentPrice > vwap ? +1 : -1;
    score += vwapFactor;

    // 2. Delta因子：Delta正值 → +1，负值 → -1
    const deltaFactor = delta > 0 ? +1 : -1;
    score += deltaFactor;

    // 3. OI因子：OI上涨 → +1，下降 → -1
    const oiFactor = oi > 0 ? +1 : -1;
    score += oiFactor;

    // 4. Volume因子：成交量增量 → +1，减量 → -1
    const volumeFactor = volume > 0 ? +1 : -1;
    score += volumeFactor;

    // 根据信号类型调整得分
    if (signalType === "long") {
      // 多头信号：所有因子都应该是正值
      return score;
    } else if (signalType === "short") {
      // 空头信号：所有因子都应该是负值，所以得分取反
      return -score;
    }

    return score;
  }

  /**
   * 获取多因子数据 - 按照strategy-v3.md实现
   */
  async getMultiFactorData(symbol, currentPrice = null, deltaManager = null) {
    try {
      const [vwapPrice, delta, oi, volDelta, price] = await Promise.all([
        this.getVWAP(symbol, "15m"),
        this.getDelta(symbol, "15m", deltaManager),
        this.getOI(symbol),
        this.getVolume(symbol, "15m"),
        currentPrice || this.getCurrentPrice(symbol)
      ]);

      return {
        currentPrice: price,
        vwap: vwapPrice,
        delta: delta,
        oi: oi,
        volume: volDelta
      };
    } catch (error) {
      console.error(`获取多因子数据失败 [${symbol}]:`, error);
      return {
        currentPrice: currentPrice || 0,
        vwap: 0,
        delta: 0,
        oi: 0,
        volume: 0
      };
    }
  }

  /**
   * 获取当前价格
   */
  async getCurrentPrice(symbol) {
    try {
      const ticker = await BinanceAPI.get24hrTicker(symbol);
      return parseFloat(ticker.lastPrice);
    } catch (error) {
      console.error(`获取当前价格失败 [${symbol}]:`, error);
      return 0;
    }
  }

  /**
   * 获取VWAP - 按照strategy-v3.md实现
   */
  async getVWAP(symbol, interval) {
    try {
      const klines = await BinanceAPI.getKlines(symbol, interval, 20);
      if (!klines || klines.length < 20) return 0;

      let sumPV = 0;
      let sumVolume = 0;

      for (const k of klines) {
        const typicalPrice = (parseFloat(k[2]) + parseFloat(k[3]) + parseFloat(k[4])) / 3;
        const volume = parseFloat(k[5]);
        sumPV += typicalPrice * volume;
        sumVolume += volume;
      }

      return sumVolume > 0 ? sumPV / sumVolume : 0;
    } catch (error) {
      console.error(`获取VWAP失败 [${symbol}]:`, error);
      return 0;
    }
  }

  /**
   * 获取Delta - 按照strategy-v3.md实现
   * @param {string} symbol - 交易对
   * @param {string} interval - 时间级别 ('15m' 或 '1h')
   * @param {Object} deltaManager - Delta实时管理器
   * @returns {number} Delta值
   */
  async getDelta(symbol, interval, deltaManager = null) {
    try {
      // 优先使用实时Delta数据
      if (deltaManager) {
        const deltaData = deltaManager.getDeltaData(symbol, interval === '15m' ? '15m' : '1h');
        if (deltaData && deltaData.delta !== null) {
          return deltaData.delta;
        }
      }

      // 降级到K线数据计算
      const klines = await BinanceAPI.getKlines(symbol, interval, 2);
      if (!klines || klines.length < 2) return 0;

      const last = parseFloat(klines[klines.length - 1][4]);
      const prev = parseFloat(klines[klines.length - 2][4]);

      return last - prev; // 正值多头，负值空头
    } catch (error) {
      console.error(`获取Delta失败 [${symbol}]:`, error);
      return 0;
    }
  }

  /**
   * 获取OI - 按照strategy-v3.md实现
   */
  async getOI(symbol) {
    try {
      const oiData = await BinanceAPI.getOpenInterest(symbol);
      return oiData ? parseFloat(oiData.openInterest) : 0;
    } catch (error) {
      console.error(`获取OI失败 [${symbol}]:`, error);
      return 0;
    }
  }

  /**
   * 获取Volume - 按照strategy-v3.md实现
   */
  async getVolume(symbol, interval) {
    try {
      const klines = await BinanceAPI.getKlines(symbol, interval, 2);
      if (!klines || klines.length < 2) return 0;

      const last = parseFloat(klines[klines.length - 1][5]);
      const prev = parseFloat(klines[klines.length - 2][5]);

      return last - prev; // 增量
    } catch (error) {
      console.error(`获取Volume失败 [${symbol}]:`, error);
      return 0;
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
      // 空头止盈：入场价 - 2 × (止损 - 入场价)，确保止盈 < 入场价 < 止损
      takeProfit = entryPrice - 2 * (stopLoss - entryPrice);
    }

    // 验证止损止盈价格合理性
    if (position === 'LONG') {
      // 多头：入场价 > 止损价，入场价 < 止盈价
      if (entryPrice <= stopLoss || entryPrice >= takeProfit) {
        console.warn(`多头止损止盈价格异常: entry=${entryPrice}, stop=${stopLoss}, profit=${takeProfit}`);
        // 重新计算确保合理性
        stopLoss = Math.min(entryPrice * 0.98, stopLoss); // 止损不超过入场价的98%
        takeProfit = entryPrice + 2 * (entryPrice - stopLoss);
      }
    } else {
      // 空头：入场价 < 止损价，入场价 > 止盈价
      if (entryPrice >= stopLoss || entryPrice <= takeProfit) {
        console.warn(`空头止损止盈价格异常: entry=${entryPrice}, stop=${stopLoss}, profit=${takeProfit}`);
        // 重新计算确保合理性
        stopLoss = Math.max(entryPrice * 1.02, stopLoss); // 止损不低于入场价的102%
        takeProfit = entryPrice - 2 * (stopLoss - entryPrice);
      }
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

    // 3️⃣ 震荡市止损逻辑 - 严格按照strategy-v3.md文档
    if (marketType === '震荡市') {
      // 获取震荡市边界数据
      const rangeResult = analysisData?.rangeResult;
      if (rangeResult && rangeResult.bb1h) {
        const { upper: rangeHigh, lower: rangeLow } = rangeResult.bb1h;

        // 区间边界失效止损
        if (position === 'LONG' && currentPrice < (rangeLow - effectiveATR)) {
          return { exit: true, reason: 'RANGE_BOUNDARY_BREAK', exitPrice: currentPrice };
        }
        if (position === 'SHORT' && currentPrice > (rangeHigh + effectiveATR)) {
          return { exit: true, reason: 'RANGE_BOUNDARY_BREAK', exitPrice: currentPrice };
        }
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

    // 7️⃣ 震荡市多因子止损 - 严格按照strategy-v3.md文档
    if (marketType === '震荡市') {
      const rangeResult = analysisData?.rangeResult;
      if (rangeResult) {
        // 检查多因子状态
        const factors = {
          vwap: rangeResult.vwapDirectionConsistent || false,
          delta: Math.abs(rangeResult.delta || 0) <= 0.02,
          oi: Math.abs(rangeResult.oiChange || 0) <= 0.02,
          volume: (rangeResult.volFactor || 0) <= 1.7
        };

        // 统计方向错误的因子
        const badFactors = Object.entries(factors)
          .filter(([key, val]) => val === false)
          .map(([key]) => key);

        // 如果≥2个因子方向错误，触发止损
        if (badFactors.length >= 2) {
          return { exit: true, reason: 'FACTOR_STOP', exitPrice: currentPrice };
        }
      }
    }

    // 8️⃣ 时间止损
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
