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
    this.binanceAPI = BinanceAPI;
  }

  /**
   * 分析日线趋势
   * @param {string} symbol - 交易对
   * @returns {Object} 趋势分析结果
   */
  async analyzeDailyTrend(symbol) {
    try {
      // 获取日线数据
      const dailyKlines = await this.binanceAPI.getKlines(symbol, '1d', 100);
      if (!dailyKlines || dailyKlines.length < 50) {
        return { trend: 'RANGE', confidence: 0, reason: 'Insufficient data' };
      }

      // 计算ATR
      const atr = this.calculateATR(dailyKlines, 14);
      const currentATR = atr[atr.length - 1];

      // 计算价格变化
      const currentPrice = parseFloat(dailyKlines[dailyKlines.length - 1].close);
      const price20DaysAgo = parseFloat(dailyKlines[dailyKlines.length - 21].close);
      const priceChange = ((currentPrice - price20DaysAgo) / price20DaysAgo) * 100;

      // 趋势判断逻辑
      let trend = 'RANGE';
      let confidence = 0;

      if (priceChange > 5 && currentATR > 0) {
        trend = 'UP';
        confidence = Math.min(Math.abs(priceChange) / 10, 1);
      } else if (priceChange < -5 && currentATR > 0) {
        trend = 'DOWN';
        confidence = Math.min(Math.abs(priceChange) / 10, 1);
      }

      return {
        trend,
        confidence,
        atr: currentATR,
        priceChange,
        reason: `Price change: ${priceChange.toFixed(2)}%, ATR: ${currentATR.toFixed(4)}`
      };
    } catch (error) {
      logger.error(`ICT Daily trend analysis error for ${symbol}:`, error);
      return { trend: 'RANGE', confidence: 0, reason: 'Analysis error' };
    }
  }

  /**
   * 检测订单块
   * @param {Array} klines - K线数据
   * @param {string} timeframe - 时间周期
   * @returns {Array} 订单块列表
   */
  detectOrderBlocks(klines, timeframe = '4H') {
    const orderBlocks = [];

    if (klines.length < 20) return orderBlocks;

    // 寻找吞没形态作为订单块
    for (let i = 1; i < klines.length - 1; i++) {
      const current = klines[i];
      const previous = klines[i - 1];

      const currentOpen = parseFloat(current.open);
      const currentClose = parseFloat(current.close);
      const previousOpen = parseFloat(previous.open);
      const previousClose = parseFloat(previous.close);

      // 看涨订单块：前一根为阴线，当前为阳线且完全吞没
      if (previousClose < previousOpen && currentClose > currentOpen &&
        currentOpen < previousClose && currentClose > previousOpen) {
        orderBlocks.push({
          type: 'BULLISH',
          high: Math.max(currentOpen, currentClose),
          low: Math.min(currentOpen, currentClose),
          timestamp: current.openTime,
          timeframe,
          strength: Math.abs(currentClose - currentOpen) / previousClose
        });
      }

      // 看跌订单块：前一根为阳线，当前为阴线且完全吞没
      if (previousClose > previousOpen && currentClose < currentOpen &&
        currentOpen > previousClose && currentClose < previousOpen) {
        orderBlocks.push({
          type: 'BEARISH',
          high: Math.max(currentOpen, currentClose),
          low: Math.min(currentOpen, currentClose),
          timestamp: current.openTime,
          timeframe,
          strength: Math.abs(currentClose - currentOpen) / previousClose
        });
      }
    }

    return orderBlocks;
  }

  /**
   * 检测HTF Sweep（高时间框架流动性扫荡）
   * @param {Array} klines - K线数据
   * @param {string} timeframe - 时间周期
   * @returns {Object} Sweep检测结果
   */
  detectSweepHTF(klines, timeframe = '4H') {
    if (klines.length < 10) {
      return { detected: false, type: null, level: 0, confidence: 0 };
    }

    // 寻找最近的高点和低点
    const recentKlines = klines.slice(-10);
    let highestHigh = 0;
    let lowestLow = Infinity;
    let highestIndex = -1;
    let lowestIndex = -1;

    recentKlines.forEach((kline, index) => {
      const high = parseFloat(kline.high);
      const low = parseFloat(kline.low);

      if (high > highestHigh) {
        highestHigh = high;
        highestIndex = index;
      }
      if (low < lowestLow) {
        lowestLow = low;
        lowestIndex = index;
      }
    });

    const currentPrice = parseFloat(klines[klines.length - 1].close);
    const atr = this.calculateATR(klines, 14);
    const currentATR = atr[atr.length - 1];

    // 检测流动性扫荡
    let detected = false;
    let type = null;
    let level = 0;
    let confidence = 0;

    // 检测上方流动性扫荡
    if (currentPrice > highestHigh * 0.999 && highestIndex < recentKlines.length - 2) {
      detected = true;
      type = 'LIQUIDITY_SWEEP_UP';
      level = highestHigh;
      confidence = Math.min((currentPrice - highestHigh) / currentATR, 1);
    }

    // 检测下方流动性扫荡
    if (currentPrice < lowestLow * 1.001 && lowestIndex < recentKlines.length - 2) {
      detected = true;
      type = 'LIQUIDITY_SWEEP_DOWN';
      level = lowestLow;
      confidence = Math.min((lowestLow - currentPrice) / currentATR, 1);
    }

    return { detected, type, level, confidence };
  }

  /**
   * 检测吞没形态
   * @param {Array} klines - K线数据
   * @returns {Object} 吞没形态检测结果
   */
  detectEngulfingPattern(klines) {
    if (klines.length < 2) {
      return { detected: false, type: null, strength: 0 };
    }

    const current = klines[klines.length - 1];
    const previous = klines[klines.length - 2];

    const currentOpen = parseFloat(current.open);
    const currentClose = parseFloat(current.close);
    const previousOpen = parseFloat(previous.open);
    const previousClose = parseFloat(previous.close);

    // 看涨吞没
    if (previousClose < previousOpen && currentClose > currentOpen &&
      currentOpen < previousClose && currentClose > previousOpen) {
      const strength = Math.abs(currentClose - currentOpen) / previousClose;
      return { detected: true, type: 'BULLISH_ENGULFING', strength };
    }

    // 看跌吞没
    if (previousClose > previousOpen && currentClose < currentOpen &&
      currentOpen > previousClose && currentClose < previousOpen) {
      const strength = Math.abs(currentClose - currentOpen) / previousClose;
      return { detected: true, type: 'BEARISH_ENGULFING', strength };
    }

    return { detected: false, type: null, strength: 0 };
  }

  /**
   * 检测LTF Sweep（低时间框架流动性扫荡）
   * @param {Array} klines - K线数据
   * @returns {Object} LTF Sweep检测结果
   */
  detectSweepLTF(klines) {
    if (klines.length < 5) {
      return { detected: false, type: null, level: 0, confidence: 0 };
    }

    const recentKlines = klines.slice(-5);
    const currentPrice = parseFloat(klines[klines.length - 1].close);

    // 寻找最近的高点和低点
    let highestHigh = 0;
    let lowestLow = Infinity;

    recentKlines.forEach(kline => {
      const high = parseFloat(kline.high);
      const low = parseFloat(kline.low);
      highestHigh = Math.max(highestHigh, high);
      lowestLow = Math.min(lowestLow, low);
    });

    const atr = this.calculateATR(klines, 14);
    const currentATR = atr[atr.length - 1];

    let detected = false;
    let type = null;
    let level = 0;
    let confidence = 0;

    // 检测上方流动性扫荡
    if (currentPrice > highestHigh * 0.999) {
      detected = true;
      type = 'LTF_SWEEP_UP';
      level = highestHigh;
      confidence = Math.min((currentPrice - highestHigh) / currentATR, 1);
    }

    // 检测下方流动性扫荡
    if (currentPrice < lowestLow * 1.001) {
      detected = true;
      type = 'LTF_SWEEP_DOWN';
      level = lowestLow;
      confidence = Math.min((lowestLow - currentPrice) / currentATR, 1);
    }

    return { detected, type, level, confidence };
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

      const currentPrice = parseFloat(klines[klines.length - 1].close);
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
        leverage = Math.min(5, Math.max(1, Math.floor(100 / currentATR)));
      } else if (trend === 'DOWN') {
        stopLoss = currentPrice + (currentATR * 2);
        takeProfit = currentPrice - (currentATR * 4);
        leverage = Math.min(5, Math.max(1, Math.floor(100 / currentATR)));
      }

      // 根据信号强度调整杠杆
      if (signals.engulfing && signals.engulfing.strength > 0.5) {
        leverage = Math.min(leverage * 1.5, 10);
      }

      if (signals.sweepHTF && signals.sweepHTF.confidence > 0.7) {
        leverage = Math.min(leverage * 1.2, 10);
      }

      return {
        entry,
        stopLoss: parseFloat(stopLoss.toFixed(4)),
        takeProfit: parseFloat(takeProfit.toFixed(4)),
        leverage: Math.min(leverage, 10),
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

      // 1. 分析日线趋势
      const dailyTrend = await this.analyzeDailyTrend(symbol);

      // 2. 获取4H数据检测订单块
      const klines4H = await this.binanceAPI.getKlines(symbol, '4h', 50);
      const orderBlocks = klines4H ? this.detectOrderBlocks(klines4H, '4H') : [];

      // 3. 检测HTF Sweep
      const sweepHTF = klines4H ? this.detectSweepHTF(klines4H, '4H') : { detected: false };

      // 4. 获取15m数据检测吞没形态和LTF Sweep
      const klines15m = await this.binanceAPI.getKlines(symbol, '15m', 50);
      const engulfing = klines15m ? this.detectEngulfingPattern(klines15m) : { detected: false };
      const sweepLTF = klines15m ? this.detectSweepLTF(klines15m) : { detected: false };

      // 5. 计算交易参数
      const tradeParams = await this.calculateTradeParameters(symbol, dailyTrend.trend, {
        engulfing,
        sweepHTF,
        sweepLTF
      });

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
      if (score >= 70) {
        signal = dailyTrend.trend === 'UP' ? 'BUY' : 'SELL';
      } else if (score >= 40) {
        signal = 'WATCH';
      }

      return {
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
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`ICT strategy execution error for ${symbol}:`, error);
      return {
        symbol,
        strategy: 'ICT',
        signal: 'HOLD',
        score: 0,
        trend: 'RANGE',
        confidence: 0,
        reasons: 'Analysis error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // 包装方法，委托给TechnicalIndicators
  calculateATR(klines, period) {
    const high = klines.map(k => parseFloat(k.high));
    const low = klines.map(k => parseFloat(k.low));
    const close = klines.map(k => parseFloat(k.close));
    return TechnicalIndicators.calculateATR(high, low, close, period);
  }
}

module.exports = ICTStrategy;
