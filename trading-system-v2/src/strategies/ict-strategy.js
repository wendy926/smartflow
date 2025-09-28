const TechnicalIndicators = require('../utils/technical-indicators');
const BinanceAPI = require('../api/binance-api');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * ICT策略实现
 * 基于订单块、流动性、吞没形态等ICT概念
 */
class ICTStrategy {
  constructor() {
    this.name = 'ICT';
    this.timeframes = ['1D', '4H', '15m'];
    this.binanceAPI = new BinanceAPI();
  }

  /**
   * 分析日线趋势
   * @param {string} symbol - 交易对
   * @returns {Object} 趋势分析结果
   */
  analyzeDailyTrend(klines) {
    try {
      if (!klines || klines.length < 25) {
        return { trend: 'RANGE', confidence: 0, reason: 'Insufficient data' };
      }

      // 计算ATR
      const atr = this.calculateATR(klines, 14);
      const currentATR = atr[atr.length - 1];

      // 基于20日收盘价比较的趋势判断
      const prices = klines.map(k => parseFloat(k[4])); // 收盘价
      const recent20Prices = prices.slice(-20); // 最近20日收盘价

      if (recent20Prices.length < 20) {
        return { trend: 'RANGE', confidence: 0, reason: 'Insufficient 20-day data' };
      }

      const firstPrice = recent20Prices[0];
      const lastPrice = recent20Prices[recent20Prices.length - 1];
      const priceChange = ((lastPrice - firstPrice) / firstPrice) * 100;

      // 趋势判断逻辑：基于20日收盘价比较
      let trend = 'RANGE';
      let confidence = 0;

      if (priceChange > 3) { // 20日涨幅超过3%
        trend = 'UP';
        confidence = Math.min(Math.abs(priceChange) / 10, 1);
      } else if (priceChange < -3) { // 20日跌幅超过3%
        trend = 'DOWN';
        confidence = Math.min(Math.abs(priceChange) / 10, 1);
      } else {
        // 震荡趋势
        trend = 'RANGE';
        confidence = 0.3; // 震荡市场基础置信度
      }

      return {
        trend,
        confidence,
        atr: currentATR,
        priceChange,
        closeChange: priceChange / 100, // 转换为小数形式
        lookback: 20, // 20日回看期
        reason: `20-day price change: ${priceChange.toFixed(2)}%, ATR: ${currentATR.toFixed(4)}`
      };
    } catch (error) {
      logger.error(`ICT Daily trend analysis error for ${symbol}:`, error);
      return { trend: 'RANGE', confidence: 0, reason: 'Analysis error' };
    }
  }

  /**
   * 检测订单块（基于高度过滤、年龄过滤和宏观Sweep确认）
   * @param {Array} klines - K线数据
   * @param {number} atr4H - 4H ATR值
   * @param {number} maxAgeDays - 最大年龄（天）
   * @returns {Array} 订单块列表
   */
  detectOrderBlocks(klines, atr4H, maxAgeDays = 30) {
    const orderBlocks = [];

    if (klines.length < 20) return orderBlocks;

    const currentTime = Date.now();
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

    // 寻找吞没形态作为订单块
    for (let i = 1; i < klines.length - 1; i++) {
      const current = klines[i];
      const previous = klines[i - 1];

      const currentOpen = parseFloat(current[1]);
      const currentClose = parseFloat(current[4]);
      const previousOpen = parseFloat(previous[1]);
      const previousClose = parseFloat(previous[4]);
      const currentTime = parseFloat(current[0]);

      // 检查年龄过滤
      if (currentTime < Date.now() - maxAgeMs) continue;

      // 看涨订单块：前一根为阴线，当前为阳线且完全吞没
      if (previousClose < previousOpen && currentClose > currentOpen &&
        currentOpen < previousClose && currentClose > previousOpen) {

        const obHeight = Math.max(currentOpen, currentClose) - Math.min(currentOpen, currentClose);

        // 高度过滤：OB高度 >= 0.25 × ATR(4H)
        if (obHeight >= 0.25 * atr4H) {
          orderBlocks.push({
            type: 'BULLISH',
            high: Math.max(currentOpen, currentClose),
            low: Math.min(currentOpen, currentClose),
            timestamp: currentTime,
            height: obHeight,
            strength: obHeight / atr4H, // 相对于ATR的强度
            age: (Date.now() - currentTime) / (24 * 60 * 60 * 1000) // 年龄（天）
          });
        }
      }

      // 看跌订单块：前一根为阳线，当前为阴线且完全吞没
      if (previousClose > previousOpen && currentClose < currentOpen &&
        currentOpen > previousClose && currentClose < previousOpen) {

        const obHeight = Math.max(currentOpen, currentClose) - Math.min(currentOpen, currentClose);

        // 高度过滤：OB高度 >= 0.25 × ATR(4H)
        if (obHeight >= 0.25 * atr4H) {
          orderBlocks.push({
            type: 'BEARISH',
            high: Math.max(currentOpen, currentClose),
            low: Math.min(currentOpen, currentClose),
            timestamp: currentTime,
            height: obHeight,
            strength: obHeight / atr4H, // 相对于ATR的强度
            age: (Date.now() - currentTime) / (24 * 60 * 60 * 1000) // 年龄（天）
          });
        }
      }
    }

    return orderBlocks;
  }

  /**
   * 检测HTF Sweep（高时间框架流动性扫荡）
   * 按照ICT文档：检测关键swing高/低是否在≤2根4H内被刺破并收回，刺破幅度÷bar数≥0.4×ATR(4H)
   * @param {number} extreme - 极值点
   * @param {Array} klines - K线数据
   * @param {number} atrValue - ATR值
   * @returns {Object} Sweep检测结果
   */
  detectSweepHTF(extreme, klines, atrValue) {
    if (!klines || klines.length < 3) {
      return { detected: false, type: null, level: 0, confidence: 0, speed: 0 };
    }

    const currentATR = atrValue || 0;
    const recentBars = klines.slice(-3); // 最近3根K线，最多检查2根

    let detected = false;
    let type = null;
    let level = 0;
    let confidence = 0;
    let speed = 0;

    // 检查最近2根K线是否有突破极值点的情况
    for (let i = 0; i < Math.min(2, recentBars.length); i++) {
      const bar = recentBars[i];
      const high = parseFloat(bar[2]);
      const low = parseFloat(bar[3]);
      const close = parseFloat(bar[4]);

      // 检测上方流动性扫荡：最高价突破极值点
      if (high > extreme) {
        // 检查是否在后续K线中收回（包括同一根K线）
        let barsToReturn = 0;
        for (let j = i; j < recentBars.length; j++) {
          if (j > i) barsToReturn++; // 只有在后续K线中才计数
          if (parseFloat(recentBars[j][4]) < extreme) {
            // 计算扫荡速率：刺破幅度 ÷ bar数
            const exceed = high - extreme;
            const sweepSpeed = barsToReturn > 0 ? exceed / barsToReturn : exceed; // 如果是同一根K线，直接使用exceed

            // 调试信息
            logger.info(`ICT HTF Sweep调试 - 突破幅度: ${exceed}, barsToReturn: ${barsToReturn}, sweepSpeed: ${sweepSpeed}, 阈值: ${0.4 * currentATR}`);

            // 检查是否满足条件：sweep速率 ≥ 0.4 × ATR 且 bars数 ≤ 2
            if (sweepSpeed >= 0.4 * currentATR && barsToReturn <= 2) {
              detected = true;
              type = 'LIQUIDITY_SWEEP_UP';
              level = extreme;
              confidence = Math.min(sweepSpeed / (0.4 * currentATR), 1);
              speed = sweepSpeed;
              break;
            }
          }
        }
        if (detected) break;
      }

      // 检测下方流动性扫荡：最低价跌破极值点
      if (low < extreme) {
        // 检查是否在后续K线中收回（包括同一根K线）
        let barsToReturn = 0;
        for (let j = i; j < recentBars.length; j++) {
          if (j > i) barsToReturn++; // 只有在后续K线中才计数
          if (parseFloat(recentBars[j][4]) > extreme) {
            // 计算扫荡速率：刺破幅度 ÷ bar数
            const exceed = extreme - low;
            const sweepSpeed = barsToReturn > 0 ? exceed / barsToReturn : exceed; // 如果是同一根K线，直接使用exceed

            // 检查是否满足条件：sweep速率 ≥ 0.4 × ATR 且 bars数 ≤ 2
            if (sweepSpeed >= 0.4 * currentATR && barsToReturn <= 2) {
              detected = true;
              type = 'LIQUIDITY_SWEEP_DOWN';
              level = extreme;
              confidence = Math.min(sweepSpeed / (0.4 * currentATR), 1);
              speed = sweepSpeed;
              break;
            }
          }
        }
        if (detected) break;
      }
    }

    return { detected, type, level, confidence, speed };
  }

  /**
   * 检测吞没形态
   * @param {Array} klines - K线数据
   * @returns {Object} 吞没形态检测结果
   */
  detectEngulfingPattern(klines) {
    if (!klines || klines.length < 2) {
      return { detected: false, type: null, strength: 0 };
    }

    const current = klines[klines.length - 1];
    const previous = klines[klines.length - 2];

    // 使用数组格式（Binance API返回的格式）
    const currentOpen = parseFloat(current[1]);   // 开盘价
    const currentClose = parseFloat(current[4]);  // 收盘价
    const previousOpen = parseFloat(previous[1]); // 开盘价
    const previousClose = parseFloat(previous[4]); // 收盘价

    // 看涨吞没：前一根为阴线，当前为阳线且完全吞没
    if (previousClose < previousOpen && currentClose > currentOpen &&
      currentOpen < previousClose && currentClose > previousOpen) {
      const strength = Math.abs(currentClose - currentOpen) / previousClose;
      return { detected: true, type: 'BULLISH_ENGULFING', strength };
    }

    // 看跌吞没：前一根为阳线，当前为阴线且完全吞没
    if (previousClose > previousOpen && currentClose < currentOpen &&
      currentOpen > previousClose && currentClose < previousOpen) {
      const strength = Math.abs(currentClose - currentOpen) / previousClose;
      return { detected: true, type: 'BEARISH_ENGULFING', strength };
    }

    return { detected: false, type: null, strength: 0 };
  }

  /**
   * 检测LTF Sweep（低时间框架流动性扫荡）
   * 按照ICT文档：sweep发生在≤3根15m内收回，sweep幅度÷bar数≥0.2×ATR(15m)
   * @param {Array} klines - K线数据
   * @param {number} atr15 - 15分钟ATR值
   * @returns {Object} LTF Sweep检测结果
   */
  detectSweepLTF(klines, atr15) {
    if (!klines || klines.length < 5) {
      return { detected: false, type: null, level: 0, confidence: 0, speed: 0 };
    }

    const currentATR = atr15 || 0;
    const recentBars = klines.slice(-5); // 最近5根K线，最多检查3根

    // 寻找最近的高点和低点
    let highestHigh = 0;
    let lowestLow = Infinity;

    recentBars.forEach(kline => {
      const high = parseFloat(kline[2]); // 最高价
      const low = parseFloat(kline[3]);   // 最低价
      highestHigh = Math.max(highestHigh, high);
      lowestLow = Math.min(lowestLow, low);
    });

    let detected = false;
    let type = null;
    let level = 0;
    let confidence = 0;
    let speed = 0;

    // 检查最近3根K线是否有突破极值点的情况
    for (let i = 0; i < Math.min(3, recentBars.length); i++) {
      const bar = recentBars[i];
      const high = parseFloat(bar[2]);
      const low = parseFloat(bar[3]);

      // 检测上方流动性扫荡：最高价突破极值点
      if (high > highestHigh) {
        // 检查是否在后续K线中收回
        let barsToReturn = 0;
        for (let j = i + 1; j < recentBars.length; j++) {
          barsToReturn++;
          if (parseFloat(recentBars[j][4]) < highestHigh) {
            // 计算扫荡速率：刺破幅度 ÷ bar数
            const exceed = high - highestHigh;
            const sweepSpeed = exceed / barsToReturn;

            // 检查是否满足条件：sweep速率 ≥ 0.2 × ATR 且 bars数 ≤ 3
            if (sweepSpeed >= 0.2 * currentATR && barsToReturn <= 3) {
              detected = true;
              type = 'LTF_SWEEP_UP';
              level = highestHigh;
              confidence = Math.min(sweepSpeed / (0.2 * currentATR), 1);
              speed = sweepSpeed;
              break;
            }
          }
        }
        if (detected) break;
      }

      // 检测下方流动性扫荡：最低价跌破极值点
      if (low < lowestLow) {
        // 检查是否在后续K线中收回
        let barsToReturn = 0;
        for (let j = i + 1; j < recentBars.length; j++) {
          barsToReturn++;
          if (parseFloat(recentBars[j][4]) > lowestLow) {
            // 计算扫荡速率：刺破幅度 ÷ bar数
            const exceed = lowestLow - low;
            const sweepSpeed = exceed / barsToReturn;

            // 检查是否满足条件：sweep速率 ≥ 0.2 × ATR 且 bars数 ≤ 3
            if (sweepSpeed >= 0.2 * currentATR && barsToReturn <= 3) {
              detected = true;
              type = 'LTF_SWEEP_DOWN';
              level = lowestLow;
              confidence = Math.min(sweepSpeed / (0.2 * currentATR), 1);
              speed = sweepSpeed;
              break;
            }
          }
        }
        if (detected) break;
      }
    }

    return { detected, type, level, confidence, speed };
  }

  /**
   * 计算保证金
   * @param {number} entryPrice - 入场价格
   * @param {number} stopLoss - 止损价格
   * @param {number} leverage - 杠杆
   * @returns {number} 保证金
   */
  calculateMargin(entryPrice, stopLoss, leverage) {
    if (!entryPrice || !stopLoss || !leverage) return 0;

    // 计算止损距离百分比
    const stopLossDistance = Math.abs(entryPrice - stopLoss) / entryPrice;

    // 使用100 USDT作为默认最大损失金额
    const maxLossAmount = 100;

    // 计算保证金：M/(Y*X%) 数值向上取整
    const margin = Math.ceil(maxLossAmount / (leverage * stopLossDistance));

    return margin;
  }

  /**
   * 计算交易参数
   * @param {string} symbol - 交易对
   * @param {string} trend - 趋势方向
   * @param {Object} signals - 信号对象
   * @returns {Object} 交易参数
   */
  async calculateTradeParameters(symbol, trend, signals) {
    try {
      // 获取当前价格和ATR
      const klines = await this.binanceAPI.getKlines(symbol, '15m', 50);
      if (!klines || klines.length < 20) {
        return { entry: 0, stopLoss: 0, takeProfit: 0, leverage: 1, risk: 0 };
      }

      const currentPrice = parseFloat(klines[klines.length - 1][4]); // 收盘价
      const atr = this.calculateATR(klines, 14);
      const currentATR = atr[atr.length - 1];

      // 基础参数
      let entry = currentPrice;
      let stopLoss = 0;
      let takeProfit = 0;
      let leverage = 1;
      let risk = 0.02; // 2%风险

      // 根据趋势和信号调整参数
      if (trend === 'UP') {
        stopLoss = currentPrice - (currentATR * 2);
        takeProfit = currentPrice + (currentATR * 4);
      } else if (trend === 'DOWN') {
        stopLoss = currentPrice + (currentATR * 2);
        takeProfit = currentPrice - (currentATR * 4);
      }

      // 按照文档计算杠杆和保证金
      // 止损距离X%：多头：(entrySignal - stopLoss) / entrySignal，空头：(stopLoss - entrySignal) / entrySignal
      const isLong = trend === 'UP';
      const stopLossDistance = isLong
        ? (currentPrice - stopLoss) / currentPrice  // 多头
        : (stopLoss - currentPrice) / currentPrice; // 空头
      const stopLossDistanceAbs = Math.abs(stopLossDistance);

      const maxLossAmount = 100; // 默认最大损失金额

      // 最大杠杆数Y：1/(X%+0.5%) 数值向下取整
      const maxLeverage = Math.floor(1 / (stopLossDistanceAbs + 0.005));

      // 使用计算出的最大杠杆数
      leverage = maxLeverage;

      // 计算保证金Z：M/(Y*X%) 数值向上取整
      const margin = stopLossDistanceAbs > 0 ? Math.ceil(maxLossAmount / (leverage * stopLossDistanceAbs)) : 0;

      return {
        entry,
        stopLoss: parseFloat(stopLoss.toFixed(4)),
        takeProfit: parseFloat(takeProfit.toFixed(4)),
        leverage: leverage,
        margin: margin,
        risk: Math.min(risk, 0.05)
      };
    } catch (error) {
      logger.error(`ICT Trade parameters calculation error for ${symbol}:`, error);
      return { entry: 0, stopLoss: 0, takeProfit: 0, leverage: 1, risk: 0 };
    }
  }

  /**
   * 执行ICT策略分析
   * @param {string} symbol - 交易对
   * @returns {Object} 策略分析结果
   */
  async execute(symbol) {
    try {
      logger.info(`Executing ICT strategy for ${symbol}`);

      // 检查缓存
      if (this.cache) {
        const cacheKey = `ict:${symbol}`;
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          logger.info(`Using cached ICT strategy result for ${symbol}`);
          return JSON.parse(cached);
        }
      }

      // 获取基础数据
      const [klines1D, klines4H, klines15m] = await Promise.all([
        this.binanceAPI.getKlines(symbol, '1d', 25),
        this.binanceAPI.getKlines(symbol, '4h', 50),
        this.binanceAPI.getKlines(symbol, '15m', 50)
      ]);

      // 检查数据有效性
      if (!klines1D || !klines4H || !klines15m) {
        throw new Error(`无法获取 ${symbol} 的完整数据`);
      }

      // 1. 分析日线趋势
      const dailyTrend = this.analyzeDailyTrend(klines1D);

      // 2. 检测订单块
      const atr4H = this.calculateATR(klines4H, 14);
      const orderBlocks = this.detectOrderBlocks(klines4H, atr4H[atr4H.length - 1], 30);

      // 3. 检测HTF Sweep - 检测最近的关键swing点
      const recentKlines = klines4H.slice(-10);
      let recentHigh = 0;
      let recentLow = Infinity;
      recentKlines.forEach(kline => {
        const high = parseFloat(kline[2]);
        const low = parseFloat(kline[3]);
        if (high > recentHigh) recentHigh = high;
        if (low < recentLow) recentLow = low;
      });

      // 检测上方扫荡（突破最近高点）
      const sweepHTFUp = this.detectSweepHTF(recentHigh, klines4H, atr4H[atr4H.length - 1]);
      // 检测下方扫荡（跌破最近低点）
      const sweepHTFDown = this.detectSweepHTF(recentLow, klines4H, atr4H[atr4H.length - 1]);

      // 选择有效的扫荡
      const sweepHTF = sweepHTFUp.detected ? sweepHTFUp : sweepHTFDown;

      // 调试信息
      logger.info(`ICT HTF Sweep调试 - 最近高点: ${recentHigh}, 最近低点: ${recentLow}, 当前价: ${parseFloat(klines4H[klines4H.length - 1][4])}, 检测结果: ${JSON.stringify(sweepHTF)}`);

      // 4. 检测吞没形态和LTF Sweep
      const engulfing = this.detectEngulfingPattern(klines15m);
      const atr15m = this.calculateATR(klines15m, 14);

      // 检测LTF扫荡 - 检测最近的关键swing点
      const recent15mKlines = klines15m.slice(-10);
      let recent15mHigh = 0;
      let recent15mLow = Infinity;
      recent15mKlines.forEach(kline => {
        const high = parseFloat(kline[2]);
        const low = parseFloat(kline[3]);
        if (high > recent15mHigh) recent15mHigh = high;
        if (low < recent15mLow) recent15mLow = low;
      });

      // 检测上方扫荡（突破最近高点）
      const sweepLTFUp = this.detectSweepLTF(klines15m, atr15m[atr15m.length - 1], recent15mHigh);
      // 检测下方扫荡（跌破最近低点）
      const sweepLTFDown = this.detectSweepLTF(klines15m, atr15m[atr15m.length - 1], recent15mLow);

      // 选择有效的扫荡
      const sweepLTF = sweepLTFUp.detected ? sweepLTFUp : sweepLTFDown;

      // 6. 综合评分
      let score = 0;
      let reasons = [];

      // 趋势评分
      if (dailyTrend.trend !== 'RANGE') {
        score += dailyTrend.confidence * 30;
        reasons.push(`Daily trend: ${dailyTrend.trend} (${(dailyTrend.confidence * 100).toFixed(1)}%)`);
      }

      // 订单块评分
      if (orderBlocks.length > 0) {
        const recentOrderBlocks = orderBlocks.filter(ob =>
          Date.now() - ob.timestamp < 7 * 24 * 60 * 60 * 1000 // 7天内
        );
        if (recentOrderBlocks.length > 0) {
          score += 20;
          reasons.push(`Recent order blocks: ${recentOrderBlocks.length}`);
        }
      }

      // 吞没形态评分
      if (engulfing.detected) {
        score += engulfing.strength * 25;
        reasons.push(`Engulfing pattern: ${engulfing.type} (${(engulfing.strength * 100).toFixed(1)}%)`);
      }

      // Sweep评分
      if (sweepHTF.detected) {
        score += sweepHTF.confidence * 15;
        reasons.push(`HTF Sweep: ${sweepHTF.type} (${(sweepHTF.confidence * 100).toFixed(1)}%)`);
      }

      if (sweepLTF.detected) {
        score += sweepLTF.confidence * 10;
        reasons.push(`LTF Sweep: ${sweepLTF.type} (${(sweepLTF.confidence * 100).toFixed(1)}%)`);
      }

      // 判断信号强度
      let signal = 'HOLD';
      if (score >= 45) {
        signal = dailyTrend.trend === 'UP' ? 'BUY' : 'SELL';
        logger.info(`ICT策略 ${symbol} 触发交易信号: ${signal}, 分数: ${score}, 趋势: ${dailyTrend.trend}`);
      } else if (score >= 25) {
        signal = 'WATCH';
      }

      // 5. 计算交易参数（只在信号为BUY或SELL时计算）
      let tradeParams = { entry: 0, stopLoss: 0, takeProfit: 0, leverage: 1, risk: 0 };
      if (signal === 'BUY' || signal === 'SELL') {
        try {
          // 检查是否已有交易
          const cacheKey = `ict_trade_${symbol}`;
          const existingTrade = this.cache ? await this.cache.get(cacheKey) : null;

          if (!existingTrade) {
            // 没有现有交易，计算新的交易参数
            tradeParams = await this.calculateTradeParameters(symbol, dailyTrend.trend, {
              engulfing,
              sweepHTF,
              sweepLTF
            });

            // 缓存交易参数（5分钟过期）
            if (this.cache && tradeParams.entry > 0) {
              await this.cache.set(cacheKey, JSON.stringify(tradeParams), 300);
            }
          } else {
            // 使用现有交易参数
            tradeParams = JSON.parse(existingTrade);
          }
        } catch (error) {
          logger.error(`ICT交易参数计算失败: ${error.message}`);
        }
      }

      const result = {
        symbol,
        strategy: 'ICT',
        timeframe: '15m',
        signal,
        score: Math.min(score, 100),
        trend: dailyTrend.trend,
        confidence: dailyTrend.confidence,
        reasons: reasons.join('; '),
        tradeParams,
        orderBlocks: orderBlocks.slice(-3), // 最近3个订单块
        signals: {
          engulfing,
          sweepHTF,
          sweepLTF
        },
        // 添加timeframes结构以匹配API期望格式
        timeframes: {
          '1D': {
            trend: dailyTrend.trend,
            closeChange: dailyTrend.closeChange || 0,
            lookback: dailyTrend.lookback || 20
          },
          '4H': {
            orderBlocks: orderBlocks.slice(-3),
            atr: atr4H[atr4H.length - 1] || 0,
            sweepDetected: sweepHTF.detected || false,
            sweepRate: sweepHTF.speed || 0
          },
          '15M': {
            signal: signal,
            engulfing: engulfing.detected || false,
            atr: atr15m[atr15m.length - 1] || 0,
            sweepRate: sweepLTF.speed || 0,
            volume: klines15m[klines15m.length - 1] ? parseFloat(klines15m[klines15m.length - 1][5]) : 0
          }
        },
        // 添加交易参数
        entryPrice: tradeParams.entry || 0,
        stopLoss: tradeParams.stopLoss || 0,
        takeProfit: tradeParams.takeProfit || 0,
        leverage: tradeParams.leverage || 0,
        margin: this.calculateMargin(tradeParams.entry || 0, tradeParams.stopLoss || 0, tradeParams.leverage || 1),
        timestamp: new Date().toISOString()
      };

      // 保存到缓存
      if (this.cache) {
        const cacheKey = `ict:${symbol}`;
        await this.cache.set(cacheKey, JSON.stringify(result)); // 5分钟缓存
      }

      return result;
    } catch (error) {
      logger.error(`ICT strategy execution error for ${symbol}:`, error);
      throw error;
    }
  }

  // 包装方法，委托给TechnicalIndicators
  calculateATR(klines, period) {
    const high = klines.map(k => parseFloat(k[2])); // 最高价
    const low = klines.map(k => parseFloat(k[3]));  // 最低价
    const close = klines.map(k => parseFloat(k[4])); // 收盘价
    return TechnicalIndicators.calculateATR(high, low, close, period);
  }
}

module.exports = ICTStrategy;
