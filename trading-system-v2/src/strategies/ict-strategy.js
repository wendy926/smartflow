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
   * @param {number} extreme - 极值点（高点或低点）
   * @returns {Object} LTF Sweep检测结果
   */
  detectSweepLTF(klines, atr15, extreme) {
    if (!klines || klines.length < 5) {
      return { detected: false, type: null, level: 0, confidence: 0, speed: 0 };
    }

    const currentATR = atr15 || 0;
    const recentBars = klines.slice(-5); // 最近5根K线，最多检查3根

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
      if (high > extreme) {
        // 检查是否在后续K线中收回
        let barsToReturn = 0;
        for (let j = i + 1; j < recentBars.length; j++) {
          barsToReturn++;
          if (parseFloat(recentBars[j][4]) < extreme) {
            // 计算扫荡速率：刺破幅度 ÷ bar数
            const exceed = high - extreme;
            const sweepSpeed = exceed / barsToReturn;

            // 检查是否满足条件：sweep速率 ≥ 0.2 × ATR 且 bars数 ≤ 3
            if (sweepSpeed >= 0.2 * currentATR && barsToReturn <= 3) {
              detected = true;
              type = 'LTF_SWEEP_UP';
              level = extreme;
              confidence = Math.min(sweepSpeed / (0.2 * currentATR), 1);
              speed = sweepSpeed;
              break;
            }
          }
        }
        if (detected) break;
      }

      // 检测下方流动性扫荡：最低价跌破极值点
      if (low < extreme) {
        // 检查是否在后续K线中收回
        let barsToReturn = 0;
        for (let j = i + 1; j < recentBars.length; j++) {
          barsToReturn++;
          if (parseFloat(recentBars[j][4]) > extreme) {
            // 计算扫荡速率：刺破幅度 ÷ bar数
            const exceed = extreme - low;
            const sweepSpeed = exceed / barsToReturn;

            // 检查是否满足条件：sweep速率 ≥ 0.2 × ATR 且 bars数 ≤ 3
            if (sweepSpeed >= 0.2 * currentATR && barsToReturn <= 3) {
              detected = true;
              type = 'LTF_SWEEP_DOWN';
              level = extreme;
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
   * 检测成交量放大
   * 按照ICT文档：成交量放大作为可选加强过滤
   * @param {Array} klines - K线数据
   * @param {number} period - 计算平均成交量的周期
   * @returns {Object} 成交量放大检测结果
   */
  detectVolumeExpansion(klines, period = 20) {
    if (!klines || klines.length < period + 1) {
      return { detected: false, ratio: 0, currentVolume: 0, averageVolume: 0 };
    }

    const currentVolume = parseFloat(klines[klines.length - 1][5]); // 当前成交量
    const recentVolumes = klines.slice(-period - 1, -1).map(k => parseFloat(k[5])); // 排除当前K线的历史成交量
    const averageVolume = recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length;
    
    const volumeRatio = averageVolume > 0 ? currentVolume / averageVolume : 0;
    
    // 成交量放大条件：当前成交量 ≥ 1.5倍平均成交量
    const detected = volumeRatio >= 1.5;

    return {
      detected,
      ratio: volumeRatio,
      currentVolume,
      averageVolume
    };
  }

  /**
   * 检查OB/FVG年龄过滤
   * 按照ICT文档：OB/FVG年龄 ≤ 2天
   * @param {Object} orderBlock - 订单块对象
   * @returns {boolean} 是否满足年龄条件
   */
  checkOrderBlockAge(orderBlock) {
    if (!orderBlock || !orderBlock.timestamp) return false;
    
    const currentTime = Date.now();
    const obTime = orderBlock.timestamp;
    const ageDays = (currentTime - obTime) / (1000 * 60 * 60 * 24); // 转换为天
    
    return ageDays <= 2; // 年龄 ≤ 2天
  }

  /**
   * 计算止损价格
   * 按照ICT文档：上升趋势：OB下沿-1.5×ATR(4H)或最近3根4H最低点
   * 下降趋势：OB上沿+1.5×ATR(4H)或最近3根4H最高点
   * @param {string} trend - 趋势方向
   * @param {Object} orderBlock - 订单块
   * @param {Array} klines4H - 4H K线数据
   * @param {number} atr4H - 4H ATR值
   * @returns {number} 止损价格
   */
  calculateStopLoss(trend, orderBlock, klines4H, atr4H) {
    if (!orderBlock || !klines4H || klines4H.length < 3) return 0;

    const currentPrice = parseFloat(klines4H[klines4H.length - 1][4]);
    
    if (trend === 'UP') {
      // 上升趋势：OB下沿 - 1.5×ATR(4H) 或 最近3根4H的最低点
      const obStopLoss = orderBlock.low - (1.5 * atr4H);
      const recent3Lows = klines4H.slice(-3).map(k => parseFloat(k[3])); // 最低价
      const minRecentLow = Math.min(...recent3Lows);
      
      return Math.max(obStopLoss, minRecentLow);
    } else if (trend === 'DOWN') {
      // 下降趋势：OB上沿 + 1.5×ATR(4H) 或 最近3根4H的最高点
      const obStopLoss = orderBlock.high + (1.5 * atr4H);
      const recent3Highs = klines4H.slice(-3).map(k => parseFloat(k[2])); // 最高价
      const maxRecentHigh = Math.max(...recent3Highs);
      
      return Math.min(obStopLoss, maxRecentHigh);
    }
    
    return currentPrice;
  }

  /**
   * 计算止盈价格
   * 按照ICT文档：RR = 3:1
   * @param {number} entryPrice - 入场价格
   * @param {number} stopLoss - 止损价格
   * @param {string} trend - 趋势方向
   * @returns {number} 止盈价格
   */
  calculateTakeProfit(entryPrice, stopLoss, trend) {
    if (!entryPrice || !stopLoss) return 0;

    const stopDistance = Math.abs(entryPrice - stopLoss);
    
    if (trend === 'UP') {
      // 上升趋势：入场价 + 3倍止损距离
      return entryPrice + (3 * stopDistance);
    } else if (trend === 'DOWN') {
      // 下降趋势：入场价 - 3倍止损距离
      return entryPrice - (3 * stopDistance);
    }
    
    return entryPrice;
  }

  /**
   * 计算仓位大小
   * 按照ICT文档：单位数 = 风险资金 ÷ 止损距离
   * @param {number} equity - 资金总额
   * @param {number} riskPct - 风险比例（如1%）
   * @param {number} entryPrice - 入场价格
   * @param {number} stopLoss - 止损价格
   * @returns {Object} 仓位计算结果
   */
  calculatePositionSize(equity, riskPct, entryPrice, stopLoss) {
    if (!equity || !riskPct || !entryPrice || !stopLoss) {
      return { units: 0, notional: 0, margin: 0 };
    }

    // 风险资金 = Equity × 风险比例
    const riskAmount = equity * riskPct;
    
    // 止损距离
    const stopDistance = Math.abs(entryPrice - stopLoss);
    
    // 单位数 = 风险资金 ÷ 止损距离
    const units = stopDistance > 0 ? riskAmount / stopDistance : 0;
    
    // 名义价值 = 单位数 × 入场价
    const notional = units * entryPrice;
    
    // 计算杠杆：基于风险比例和止损距离
    const stopLossDistancePct = stopDistance / entryPrice;
    const maxLeverage = Math.floor(1 / (stopLossDistancePct + 0.005)); // 加0.5%缓冲
    const leverage = Math.min(maxLeverage, 20); // 最大杠杆限制为20
    
    // 保证金 = 名义价值 ÷ 杠杆
    const margin = notional / leverage;

    return {
      units,
      notional,
      leverage,
      margin,
      riskAmount,
      stopDistance
    };
  }

  /**
   * 计算交易参数
   * 按照ICT文档要求计算止损、止盈和仓位
   * @param {string} symbol - 交易对
   * @param {string} trend - 趋势方向
   * @param {Object} signals - 信号对象
   * @param {Object} orderBlock - 订单块
   * @param {Array} klines4H - 4H K线数据
   * @param {number} atr4H - 4H ATR值
   * @returns {Object} 交易参数
   */
  async calculateTradeParameters(symbol, trend, signals, orderBlock, klines4H, atr4H) {
    try {
      // 获取当前价格
      const klines15m = await this.binanceAPI.getKlines(symbol, '15m', 50);
      if (!klines15m || klines15m.length < 20) {
        return { entry: 0, stopLoss: 0, takeProfit: 0, leverage: 1, risk: 0 };
      }

      const currentPrice = parseFloat(klines15m[klines15m.length - 1][4]); // 收盘价
      const equity = 10000; // 默认资金总额
      const riskPct = 0.01; // 1%风险

      // 计算入场价格（当前价格）
      const entry = currentPrice;

      // 计算止损价格（按照文档要求）
      const stopLoss = this.calculateStopLoss(trend, orderBlock, klines4H, atr4H);

      // 计算止盈价格（RR = 3:1）
      const takeProfit = this.calculateTakeProfit(entry, stopLoss, trend);

      // 计算仓位大小
      const positionSize = this.calculatePositionSize(equity, riskPct, entry, stopLoss);

      return {
        entry: parseFloat(entry.toFixed(4)),
        stopLoss: parseFloat(stopLoss.toFixed(4)),
        takeProfit: parseFloat(takeProfit.toFixed(4)),
        leverage: positionSize.leverage,
        margin: parseFloat(positionSize.margin.toFixed(2)),
        risk: riskPct,
        units: parseFloat(positionSize.units.toFixed(4)),
        notional: parseFloat(positionSize.notional.toFixed(2)),
        riskAmount: parseFloat(positionSize.riskAmount.toFixed(2))
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

      // 5. 检测成交量放大（可选加强过滤）
      const volumeExpansion = this.detectVolumeExpansion(klines15m);

      // 6. 检查订单块年龄过滤（≤2天）
      const validOrderBlocks = orderBlocks.filter(ob => this.checkOrderBlockAge(ob));
      const hasValidOrderBlock = validOrderBlocks.length > 0;

      // 7. 综合评分（按照ICT文档要求）
      let score = 0;
      let reasons = [];

      // 趋势评分（必须）
      if (dailyTrend.trend !== 'RANGE') {
        score += dailyTrend.confidence * 30;
        reasons.push(`Daily trend: ${dailyTrend.trend} (${(dailyTrend.confidence * 100).toFixed(1)}%)`);
      }

      // 订单块评分（必须满足年龄过滤≤2天）
      if (hasValidOrderBlock) {
        score += 20;
        reasons.push(`Valid order blocks (≤2 days): ${validOrderBlocks.length}`);
      }

      // 吞没形态评分（必须）
      if (engulfing.detected) {
        score += engulfing.strength * 25;
        reasons.push(`Engulfing pattern: ${engulfing.type} (${(engulfing.strength * 100).toFixed(1)}%)`);
      }

      // HTF Sweep评分（必须）
      if (sweepHTF.detected) {
        score += sweepHTF.confidence * 15;
        reasons.push(`HTF Sweep: ${sweepHTF.type} (${(sweepHTF.confidence * 100).toFixed(1)}%)`);
      }

      // LTF Sweep评分（必须）
      if (sweepLTF.detected) {
        score += sweepLTF.confidence * 10;
        reasons.push(`LTF Sweep: ${sweepLTF.type} (${(sweepLTF.confidence * 100).toFixed(1)}%)`);
      }

      // 成交量放大评分（可选加强过滤）
      if (volumeExpansion.detected) {
        score += 5;
        reasons.push(`Volume expansion: ${volumeExpansion.ratio.toFixed(2)}x`);
      }

      // 判断信号强度
      let signal = 'HOLD';
      if (score >= 45) {
        signal = dailyTrend.trend === 'UP' ? 'BUY' : 'SELL';
        logger.info(`ICT策略 ${symbol} 触发交易信号: ${signal}, 分数: ${score}, 趋势: ${dailyTrend.trend}`);
      } else if (score >= 25) {
        signal = 'WATCH';
      }

      // 8. 计算交易参数（只在信号为BUY或SELL时计算）
      let tradeParams = { entry: 0, stopLoss: 0, takeProfit: 0, leverage: 1, risk: 0 };
      if (signal === 'BUY' || signal === 'SELL') {
        try {
          // 检查是否已有交易
          const cacheKey = `ict_trade_${symbol}`;
          const existingTrade = this.cache ? await this.cache.get(cacheKey) : null;

          if (!existingTrade && hasValidOrderBlock) {
            // 使用最新的有效订单块
            const latestOrderBlock = validOrderBlocks[validOrderBlocks.length - 1];
            
            // 计算新的交易参数（使用文档要求的方法）
            tradeParams = await this.calculateTradeParameters(
              symbol, 
              dailyTrend.trend, 
              {
                engulfing,
                sweepHTF,
                sweepLTF,
                volumeExpansion
              },
              latestOrderBlock,
              klines4H,
              atr4H[atr4H.length - 1]
            );

            // 缓存交易参数（5分钟过期）
            if (this.cache && tradeParams.entry > 0) {
              await this.cache.set(cacheKey, JSON.stringify(tradeParams), 300);
            }
          } else if (existingTrade) {
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
        orderBlocks: validOrderBlocks.slice(-3), // 最近3个有效订单块
        signals: {
          engulfing,
          sweepHTF,
          sweepLTF,
          volumeExpansion
        },
        // 添加timeframes结构以匹配API期望格式
        timeframes: {
          '1D': {
            trend: dailyTrend.trend,
            closeChange: dailyTrend.closeChange || 0,
            lookback: dailyTrend.lookback || 20
          },
          '4H': {
            orderBlocks: validOrderBlocks.slice(-3),
            atr: atr4H[atr4H.length - 1] || 0,
            sweepDetected: sweepHTF.detected || false,
            sweepRate: sweepHTF.speed || 0
          },
          '15M': {
            signal: signal,
            engulfing: engulfing.detected || false,
            atr: atr15m[atr15m.length - 1] || 0,
            sweepRate: sweepLTF.speed || 0,
            volume: klines15m[klines15m.length - 1] ? parseFloat(klines15m[klines15m.length - 1][5]) : 0,
            volumeExpansion: volumeExpansion.detected || false,
            volumeRatio: volumeExpansion.ratio || 0
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
