/**
 * 策略V3 - 多因子趋势跟踪策略
 * 基于strategy-comparison.md中的策略逻辑
 */

const TechnicalIndicators = require('../utils/technical-indicators');
const BinanceAPI = require('../api/binance-api');
const logger = require('../utils/logger');
const config = require('../config');

class V3Strategy {
  constructor() {
    this.name = 'V3';
    this.binanceAPI = new BinanceAPI();
    this.timeframes = ['4H', '1H', '15M'];
  }

  /**
   * 分析4H趋势
   * @param {string} symbol - 交易对
   * @param {Array} klines - 4H K线数据
   * @returns {Object} 4H趋势分析结果
   */
  analyze4HTrend(klines, data = {}) {
    try {
      if (!klines || klines.length < 200) {
        return { trend: 'RANGE', score: 0, confidence: 0, error: 'Insufficient data' };
      }

      const prices = klines.map(k => parseFloat(k[4])); // 收盘价
      const volumes = klines.map(k => parseFloat(k[5])); // 成交量

      // 计算技术指标
      const ma20 = TechnicalIndicators.calculateMA(prices, 20);
      const ma50 = TechnicalIndicators.calculateMA(prices, 50);
      const ma200 = TechnicalIndicators.calculateMA(prices, 200);
      const adx = TechnicalIndicators.calculateADX(
        klines.map(k => parseFloat(k[2])), // 最高价
        klines.map(k => parseFloat(k[3])), // 最低价
        prices
      );
      const bbw = TechnicalIndicators.calculateBBW(prices);
      const vwap = TechnicalIndicators.calculateVWAP(klines);

      // 判断趋势方向
      const currentPrice = prices[prices.length - 1];
      const trendDirection = this.determineTrendDirection(
        currentPrice, ma20[ma20.length - 1], ma50[ma50.length - 1],
        ma200[ma200.length - 1], adx.adx
      );

      // 计算10点评分系统
      const score = this.calculate4HScore(
        currentPrice, ma20, ma50, ma200, adx, bbw, vwap,
        0, 0, 0 // 这些参数将在1H分析中获取
      );

      return {
        timeframe: '4H',
        trend: trendDirection,
        trendDirection,
        confidence: this.calculateTrendConfidence(adx.adx, bbw.bbw),
        score: score.total,
        // 将指标数据直接放在顶层，与API期望格式匹配
        ma20: ma20[ma20.length - 1] || 0,
        ma50: ma50[ma50.length - 1] || 0,
        ma200: ma200[ma200.length - 1] || 0,
        adx: adx.adx || 0,
        bbw: bbw.bbw || 0,
        vwap: vwap || 0,
        currentPrice: currentPrice || 0,
        indicators: {
          ma20: ma20[ma20.length - 1],
          ma50: ma50[ma50.length - 1],
          ma200: ma200[ma200.length - 1],
          adx: adx.adx,
          bbw: bbw.bbw,
          vwap: vwap,
          currentPrice: currentPrice
        },
        timestamp: new Date()
      };
    } catch (error) {
      logger.error(`分析4H趋势失败: ${error.message}`);
      return { trend: 'ERROR', score: 0, confidence: 0, error: error.message };
    }
  }

  /**
   * 计算趋势置信度
   * @param {number} adx - ADX值
   * @param {number} bbw - 布林带宽度
   * @returns {number} 置信度
   */
  calculateTrendConfidence(adx, bbw) {
    let confidence = 0.5; // 基础置信度

    // ADX影响
    if (adx > 25) confidence += 0.3;
    else if (adx > 20) confidence += 0.2;
    else if (adx < 15) confidence -= 0.2;

    // 布林带宽度影响
    if (bbw < 0.05) confidence += 0.2; // 收窄表示趋势可能开始
    else if (bbw > 0.15) confidence -= 0.1; // 过宽表示震荡

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * 分析1H因子（6个因子详细评分）
   * @param {string} symbol - 交易对
   * @param {Array} klines - 1H K线数据
   * @param {Object} ticker24hr - 24小时价格统计
   * @param {Object} fundingRate - 资金费率
   * @param {Array} oiHistory - 持仓量历史
   * @returns {Object} 1H因子分析结果
   */
  analyze1HFactors(klines, data = {}) {
    try {
      if (!klines || klines.length < 50) {
        logger.warn(`1H数据不足: ${klines?.length || 0}条`);
        return { factors: {}, score: 0, confidence: 0, error: 'Insufficient data' };
      }

      // 调试信息
      logger.info(`1H分析开始 - K线数量: ${klines.length}, 数据: ${JSON.stringify(Object.keys(data))}`);

      const prices = klines.map(k => parseFloat(k[4]));
      const volumes = klines.map(k => parseFloat(k[5]));

      // 计算技术指标
      const ema20 = TechnicalIndicators.calculateEMA(prices, 20);
      const ema50 = TechnicalIndicators.calculateEMA(prices, 50);
      const adx = TechnicalIndicators.calculateADX(
        klines.map(k => parseFloat(k[2])),
        klines.map(k => parseFloat(k[3])),
        prices
      );
      const bbw = TechnicalIndicators.calculateBBW(prices);
      const vwap = TechnicalIndicators.calculateVWAP(klines);

      // 调试信息
      logger.info(`V3 1H技术指标 - VWAP: ${vwap}, ADX: ${adx?.adx}, BBW: ${bbw?.bbw}`);

      // 计算持仓量变化（6小时OI变化）
      const oiChange = data.oiHistory && data.oiHistory.length > 0 ?
        TechnicalIndicators.calculateOIChange(data.oiHistory.map(oi => parseFloat(oi.sumOpenInterest)), 6) : 0;

      // 调试信息
      logger.info(`V3 OI调试 - 原始数据: ${JSON.stringify(data.oiHistory?.slice(0, 2))}, 计算结果: ${oiChange}`);

      // 计算Delta（简化版本）
      const delta = this.calculateSimpleDelta(prices, volumes);

      // 计算6个因子的详细评分
      const factors = this.calculate1HFactors(
        prices[prices.length - 1], ema20[ema20.length - 1], ema50[ema50.length - 1],
        adx.adx, bbw.bbw, vwap, parseFloat(data.fundingRate?.lastFundingRate || 0),
        oiChange, delta, 'UP'
      );

      return {
        timeframe: '1H',
        factors,
        score: factors.totalScore || 0,
        // 将指标数据直接放在顶层，与API期望格式匹配
        vwap: vwap || 0,
        oiChange: oiChange || 0,
        funding: parseFloat(data.fundingRate?.lastFundingRate || 0),
        delta: delta || 0,
        indicators: {
          ema20: ema20[ema20.length - 1],
          ema50: ema50[ema50.length - 1],
          adx: adx.adx,
          bbw: bbw.bbw,
          vwap: vwap,
          fundingRate: parseFloat(data.fundingRate?.lastFundingRate || 0),
          oiChange: oiChange,
          delta: delta
        },
        timestamp: new Date()
      };
    } catch (error) {
      logger.error(`分析1H因子失败: ${error.message}`);
      return { factors: {}, score: 0, confidence: 0, error: error.message };
    }
  }

  /**
   * 分析15M执行信号
   * @param {string} symbol - 交易对
   * @returns {Promise<Object>} 15M执行信号分析结果
   */
  analyze15mExecution(klines, data = {}) {
    try {
      if (!klines || klines.length < 15) {
        logger.warn(`15M K线数据不足: 实际长度 ${klines ? klines.length : 0}`);
        return { signal: 'ERROR', score: 0, confidence: 0, error: 'Insufficient 15M data' };
      }

      const prices = klines.map(k => parseFloat(k[4]));
      const volumes = klines.map(k => parseFloat(k[5]));

      // 计算技术指标
      const ema20 = TechnicalIndicators.calculateEMA(prices, 20);
      const ema50 = TechnicalIndicators.calculateEMA(prices, 50);
      const adx = TechnicalIndicators.calculateADX(
        klines.map(k => parseFloat(k[2])),
        klines.map(k => parseFloat(k[3])),
        prices
      );
      const bbw = TechnicalIndicators.calculateBBW(prices);
      const vwap = TechnicalIndicators.calculateVWAP(klines);

      // 计算Delta（简化版本）
      const delta = this.calculateSimpleDelta(prices, volumes);

      // 检查VWAP有效性
      if (vwap === null || vwap === undefined) {
        logger.warn(`15M VWAP计算失败，使用价格均值`);
        vwap = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      }

      // 调试信息
      logger.info(`15M指标计算 - 数据长度: ${klines.length}, 价格长度: ${prices.length}, EMA20: ${ema20[ema20.length - 1]}, EMA50: ${ema50[ema50.length - 1]}, ADX: ${adx.adx}, BBW: ${bbw.bbw}, VWAP: ${vwap}, Delta: ${delta}`);

      // 检查指标有效性，如果计算失败则使用默认值
      if (!ema20 || ema20.length === 0) {
        logger.warn(`15M EMA20计算失败，使用默认值`);
        ema20 = [prices[prices.length - 1]];
      }

      if (!ema50 || ema50.length === 0) {
        logger.warn(`15M EMA50计算失败，使用默认值`);
        ema50 = [prices[prices.length - 1]];
      }

      if (!adx || adx.adx === null || adx.adx === undefined) {
        logger.warn(`15M ADX计算失败，使用默认值`);
        adx = { adx: 0, di_plus: 0, di_minus: 0 };
      }

      if (!bbw || bbw.bbw === null || bbw.bbw === undefined) {
        logger.warn(`15M BBW计算失败，使用默认值`);
        bbw = { bbw: 0, upper: 0, middle: 0, lower: 0 };
      }

      // 判断执行信号
      const entrySignal = this.determineEntrySignal(
        prices[prices.length - 1], ema20[ema20.length - 1],
        adx.adx, bbw.bbw, vwap, 0, 0, delta
      );

      return {
        timeframe: '15M',
        signal: entrySignal,
        confidence: this.calculateTrendConfidence(adx.adx, bbw.bbw),
        score: this.calculate15MScore(ema20[ema20.length - 1], adx.adx, bbw.bbw, vwap, delta),
        // 将指标数据直接放在顶层，与API期望格式匹配
        ema20: ema20[ema20.length - 1] || 0,
        ema50: ema50[ema50.length - 1] || 0,
        atr: (() => {
          try {
            const atrArray = this.calculateATR(klines.map(k => parseFloat(k[2])), klines.map(k => parseFloat(k[3])), prices);
            const lastATR = atrArray && atrArray.length > 0 ? atrArray[atrArray.length - 1] : null;
            // 如果ATR为null或0，使用价格的一定百分比作为默认值
            return lastATR && lastATR > 0 ? lastATR : (prices[prices.length - 1] * 0.01);
          } catch (error) {
            logger.warn(`15M ATR计算失败: ${error.message}`);
            return prices[prices.length - 1] * 0.01; // 使用当前价格的1%作为默认ATR
          }
        })(),
        bbw: bbw.bbw || 0,
        indicators: {
          ema20: ema20[ema20.length - 1],
          adx: adx.adx,
          bbw: bbw.bbw,
          vwap: vwap,
          delta: delta,
          currentPrice: prices[prices.length - 1]
        },
        timestamp: new Date()
      };
    } catch (error) {
      logger.error(`分析15M执行信号失败: ${error.message}`);
      return { signal: 'ERROR', score: 0, confidence: 0, error: error.message };
    }
  }

  /**
   * 计算15M评分
   * @param {number} ema20 - EMA20值
   * @param {number} adx - ADX值
   * @param {number} bbw - 布林带宽度
   * @param {number} vwap - VWAP值
   * @param {number} delta - Delta值
   * @returns {number} 15M评分
   */
  calculate15MScore(ema20, adx, bbw, vwap, delta) {
    let score = 0;

    // EMA20有效性 (1分) - 允许0值
    if (ema20 !== null && ema20 !== undefined && ema20 >= 0) score += 1;

    // ADX强度 (1分)
    if (adx && adx > 20) score += 1;

    // 布林带收窄 (1分)
    if (bbw && bbw < 0.1) score += 1;

    // VWAP有效性 (1分) - 允许0值
    if (vwap !== null && vwap !== undefined && vwap >= 0) score += 1;

    // Delta确认 (1分)
    if (delta && Math.abs(delta) > 0.1) score += 1;

    return score;
  }

  /**
   * 计算交易参数
   * @param {string} symbol - 交易对
   * @param {string} signal - 交易信号
   * @param {number} currentPrice - 当前价格
   * @param {number} atr - ATR值
   * @returns {Object} 交易参数
   */
  async calculateTradeParameters(symbol, signal, currentPrice, atr) {
    try {
      if (!currentPrice) {
        return { entryPrice: 0, stopLoss: 0, takeProfit: 0, leverage: 0, margin: 0 };
      }

      // 如果ATR为0或无效，使用价格的1%作为默认ATR
      if (!atr || atr === 0) {
        atr = currentPrice * 0.01;
        logger.warn(`ATR无效，使用默认值: ${atr}`);
      }

      const entryPrice = currentPrice;
      let stopLoss = 0;
      let takeProfit = 0;
      let leverage = 1;

      // 根据信号方向计算止损和止盈
      if (signal === 'BUY') {
        stopLoss = entryPrice - (atr * 2);
        takeProfit = entryPrice + (atr * 4);
      } else if (signal === 'SELL') {
        stopLoss = entryPrice + (atr * 2);
        takeProfit = entryPrice - (atr * 4);
      }

      // 按照文档计算杠杆和保证金
      // 止损距离X%：多头：(entrySignal - stopLoss) / entrySignal，空头：(stopLoss - entrySignal) / entrySignal
      const isLong = signal === 'BUY';
      const stopLossDistance = isLong
        ? (entryPrice - stopLoss) / entryPrice  // 多头
        : (stopLoss - entryPrice) / entryPrice; // 空头
      const stopLossDistanceAbs = Math.abs(stopLossDistance);

      const maxLossAmount = 100; // 默认最大损失金额

      // 最大杠杆数Y：1/(X%+0.5%) 数值向下取整
      const maxLeverage = Math.floor(1 / (stopLossDistanceAbs + 0.005));

      // 使用计算出的最大杠杆数
      leverage = maxLeverage;

      // 保证金Z：M/(Y*X%) 数值向上取整
      const margin = stopLossDistanceAbs > 0 ? Math.ceil(maxLossAmount / (leverage * stopLossDistanceAbs)) : 0;

      return {
        entryPrice: parseFloat(entryPrice.toFixed(4)),
        stopLoss: parseFloat(stopLoss.toFixed(4)),
        takeProfit: parseFloat(takeProfit.toFixed(4)),
        leverage: leverage,
        margin: margin
      };
    } catch (error) {
      logger.error(`V3交易参数计算失败: ${error.message}`);
      return { entryPrice: 0, stopLoss: 0, takeProfit: 0, leverage: 0, margin: 0 };
    }
  }

  /**
   * 判断趋势方向
   * @param {number} currentPrice - 当前价格
   * @param {number} ma20 - 20周期移动平均
   * @param {number} ma50 - 50周期移动平均
   * @param {number} ma200 - 200周期移动平均
   * @param {number} adx - ADX值
   * @returns {string} 趋势方向
   */
  determineTrendDirection(currentPrice, ma20, ma50, ma200, adx) {
    if (!ma20 || !ma50 || !ma200 || !adx) return 'RANGE';

    // 强趋势判断
    if (adx > 25) {
      if (currentPrice > ma20 && ma20 > ma50 && ma50 > ma200) {
        return 'UP';
      } else if (currentPrice < ma20 && ma20 < ma50 && ma50 < ma200) {
        return 'DOWN';
      }
    }

    // 弱趋势判断
    if (currentPrice > ma20 && ma20 > ma50) {
      return 'UP';
    } else if (currentPrice < ma20 && ma20 < ma50) {
      return 'DOWN';
    }

    return 'RANGE';
  }

  /**
   * 计算因子得分
   * @param {number} currentPrice - 当前价格
   * @param {number} ema20 - 20周期EMA
   * @param {number} ema50 - 50周期EMA
   * @param {number} adx - ADX值
   * @param {number} bbw - 布林带宽度
   * @param {number} vwap - VWAP
   * @param {number} fundingRate - 资金费率
   * @param {number} oiChange - 持仓量变化
   * @param {number} delta - Delta值
   * @returns {Object} 因子得分
   */
  calculateFactors(currentPrice, ema20, ema50, adx, bbw, vwap, fundingRate, oiChange, delta) {
    let score = 0;
    const factors = {};

    // 趋势因子 (40分)
    if (currentPrice > ema20 && ema20 > ema50) {
      score += 40;
      factors.trend = 'BULLISH';
    } else if (currentPrice < ema20 && ema20 < ema50) {
      score += 40;
      factors.trend = 'BEARISH';
    } else {
      factors.trend = 'NEUTRAL';
    }

    // 动量因子 (20分)
    if (adx > 25) {
      score += 20;
      factors.momentum = 'STRONG';
    } else if (adx > 15) {
      score += 10;
      factors.momentum = 'MODERATE';
    } else {
      factors.momentum = 'WEAK';
    }

    // 波动率因子 (15分)
    if (bbw > 0.05) {
      score += 15;
      factors.volatility = 'HIGH';
    } else if (bbw > 0.02) {
      score += 10;
      factors.volatility = 'MODERATE';
    } else {
      factors.volatility = 'LOW';
    }

    // 成交量因子 (10分)
    if (currentPrice > vwap) {
      score += 10;
      factors.volume = 'BULLISH';
    } else {
      factors.volume = 'BEARISH';
    }

    // 资金费率因子 (10分)
    if (Math.abs(fundingRate) < 0.0001) {
      score += 10;
      factors.funding = 'NEUTRAL';
    } else if (fundingRate > 0) {
      score += 5;
      factors.funding = 'BULLISH';
    } else {
      score += 5;
      factors.funding = 'BEARISH';
    }

    // 持仓量因子 (5分)
    if (oiChange > 0.02) {
      score += 5;
      factors.openInterest = 'INCREASING';
    } else if (oiChange < -0.02) {
      score += 5;
      factors.openInterest = 'DECREASING';
    } else {
      factors.openInterest = 'STABLE';
    }

    return {
      totalScore: score,
      factors
    };
  }

  /**
   * 判断入场信号
   * @param {number} currentPrice - 当前价格
   * @param {number} ema20 - 20周期EMA
   * @param {number} adx - ADX值
   * @param {number} bbw - 布林带宽度
   * @param {number} vwap - VWAP
   * @param {number} fundingRate - 资金费率
   * @param {number} oiChange - 持仓量变化
   * @param {number} delta - Delta值
   * @returns {string} 入场信号
   */
  determineEntrySignal(currentPrice, ema20, adx, bbw, vwap, fundingRate, oiChange, delta) {
    if (ema20 === null || ema20 === undefined || adx === null || adx === undefined ||
      bbw === null || bbw === undefined || vwap === null || vwap === undefined) {
      return 'HOLD';
    }

    // 基础条件检查
    const isTrending = adx > 15;
    const isVolatile = bbw > 0.02;
    const isAboveVWAP = currentPrice > vwap;
    const isBelowVWAP = currentPrice < vwap;

    // 买入信号
    if (isTrending && isVolatile && isAboveVWAP && delta > 0.1) {
      return 'BUY';
    }

    // 卖出信号
    if (isTrending && isVolatile && isBelowVWAP && delta < -0.1) {
      return 'SELL';
    }

    return 'HOLD';
  }

  /**
   * 执行完整的策略分析
   * @param {string} symbol - 交易对
   * @returns {Promise<Object>} 完整分析结果
   */
  async execute(symbol) {
    try {
      logger.info(`开始执行V3策略分析: ${symbol}`);

      // 获取基础数据
      const [klines4H, klines1H, klines15M, ticker24hr, fundingRate, oiHistory] = await Promise.all([
        this.binanceAPI.getKlines(symbol, '4h', 250),
        this.binanceAPI.getKlines(symbol, '1h', 50),
        this.binanceAPI.getKlines(symbol, '15m', 50),
        this.binanceAPI.getTicker24hr(symbol),
        this.binanceAPI.getFundingRate(symbol),
        this.binanceAPI.getOpenInterestHist(symbol, '1h', 7)
      ]);

      // 检查数据有效性
      if (!klines4H || !klines1H || !klines15M || !ticker24hr) {
        throw new Error(`无法获取 ${symbol} 的完整数据`);
      }

      // 并行执行多时间级别分析
      const [trend4H, factors1H, execution15M] = await Promise.all([
        this.analyze4HTrend(klines4H, {}),
        this.analyze1HFactors(klines1H, { ticker24hr, fundingRate, oiHistory }),
        this.analyze15mExecution(klines15M, {})
      ]);

      // 综合判断
      const finalSignal = this.combineSignals(trend4H, factors1H, execution15M);

      // 计算交易参数（如果有交易信号且没有现有交易）
      let tradeParams = { entryPrice: 0, stopLoss: 0, takeProfit: 0, leverage: 0, margin: 0 };
      if (finalSignal !== 'HOLD' && finalSignal !== 'ERROR') {
        try {
          // 检查是否已有交易（简单的内存缓存检查）
          const cacheKey = `v3_trade_${symbol}`;
          const existingTrade = this.cache ? await this.cache.get(cacheKey) : null;

          if (!existingTrade) {
            // 没有现有交易，计算新的交易参数
            const currentPrice = parseFloat(klines15M[klines15M.length - 1][4]);
            const atr = this.calculateATR(klines15M.map(k => parseFloat(k[2])), klines15M.map(k => parseFloat(k[3])), klines15M.map(k => parseFloat(k[4])));
            const currentATR = atr[atr.length - 1];
            tradeParams = await this.calculateTradeParameters(symbol, finalSignal, currentPrice, currentATR);

            // 缓存交易参数（5分钟过期）
            if (this.cache && tradeParams.entryPrice > 0) {
              await this.cache.set(cacheKey, JSON.stringify(tradeParams), 300);
            }
          } else {
            // 使用现有交易参数
            tradeParams = JSON.parse(existingTrade);
          }
        } catch (error) {
          logger.error(`V3交易参数计算失败: ${error.message}`);
        }
      }

      const result = {
        success: true,
        symbol,
        strategy: 'V3',
        signal: finalSignal,
        timeframes: {
          '4H': trend4H,
          '1H': factors1H,
          '15M': execution15M
        },
        // 添加交易参数
        entryPrice: tradeParams.entryPrice || 0,
        stopLoss: tradeParams.stopLoss || 0,
        takeProfit: tradeParams.takeProfit || 0,
        leverage: tradeParams.leverage || 0,
        margin: tradeParams.margin || 0,
        timestamp: new Date()
      };

      logger.info(`V3策略分析完成: ${symbol} - ${finalSignal}`);
      return result;
    } catch (error) {
      logger.error(`V3策略执行失败: ${error.message}`);
      // 返回错误状态而不是抛出异常
      return {
        success: false,
        symbol,
        strategy: 'V3',
        signal: 'ERROR',
        timeframes: {
          '4H': { trend: 'ERROR', score: 0, confidence: 0, error: error.message },
          '1H': { factors: {}, score: 0, confidence: 0, error: error.message },
          '15M': { signal: 'ERROR', score: 0, confidence: 0, error: error.message }
        },
        timestamp: new Date(),
        error: error.message
      };
    }
  }

  /**
   * 综合多时间级别信号
   * @param {Object} trend4H - 4H趋势分析
   * @param {Object} factors1H - 1H因子分析
   * @param {Object} execution15M - 15M执行信号
   * @returns {string} 综合信号
   */
  combineSignals(trend4H, factors1H, execution15M) {
    const trendDirection = trend4H.trendDirection;
    const factorsScore = factors1H.factors?.totalScore || 0;
    const executionSignal = execution15M.signal;

    // 强趋势 + 高因子得分 + 明确执行信号
    if (trendDirection !== 'RANGE' && factorsScore > 70 && executionSignal !== 'HOLD') {
      return executionSignal;
    }

    // 中等条件
    if (trendDirection !== 'RANGE' && factorsScore > 50 && executionSignal !== 'HOLD') {
      return executionSignal;
    }

    // 根据文档要求：1H多因子确认（score≥3才有效）
    if (trendDirection !== 'RANGE' && factorsScore >= 3) {
      // 如果15M信号是HOLD，但有趋势，则根据趋势方向生成信号
      if (executionSignal === 'HOLD') {
        return trendDirection === 'UP' ? 'BUY' : 'SELL';
      }
      return executionSignal;
    }

    return 'HOLD';
  }

  // 以下方法是为了兼容测试文件而添加的包装器方法

  /**
   * 计算移动平均线 (包装器)
   * @param {Array} klines - K线数据
   * @param {number} period - 周期
   * @returns {Array} MA值数组
   */
  async calculateMA(klines, period) {
    const prices = klines.map(k => parseFloat(k[4]));
    return TechnicalIndicators.calculateMA(prices, period);
  }

  /**
   * 计算ADX指标 (包装器)
   * @param {Array} klines - K线数据
   * @param {number} period - 周期
   * @returns {Object} ADX结果
   */
  async calculateADX(klines, period = 14) {
    const high = klines.map(k => parseFloat(k[2]));
    const low = klines.map(k => parseFloat(k[3]));
    const close = klines.map(k => parseFloat(k[4]));

    const result = TechnicalIndicators.calculateADX(high, low, close, period);

    // 按照测试期望返回格式
    return {
      adx: result.adx,
      diPlus: result.di_plus,
      diMinus: result.di_minus
    };
  }

  /**
   * 计算布林带宽度 (包装器)
   * @param {Array} klines - K线数据
   * @param {number} period - 周期
   * @param {number} stdDev - 标准差倍数
   * @returns {Object} BBW结果
   */
  async calculateBBW(klines, period = 20, stdDev = 2) {
    const prices = klines.map(k => parseFloat(k[4]));
    const result = TechnicalIndicators.calculateBBW(prices, period, stdDev);

    // 按照测试期望返回数字而不是对象
    return result.bbw;
  }

  /**
   * 判断4H趋势 (包装器)
   * @param {string} symbol - 交易对
   * @returns {Promise<Object>} 趋势判断结果
   */
  async judge4HTrend(symbol) {
    return await this.analyze4HTrend(symbol);
  }

  /**
   * 计算VWAP (包装器)
   * @param {Array} klines - K线数据
   * @returns {number} VWAP值
   */
  async calculateVWAP(klines) {
    const prices = klines.map(k => parseFloat(k[4]));
    const volumes = klines.map(k => parseFloat(k[5]));
    return TechnicalIndicators.calculateVWAP(prices, volumes);
  }

  /**
   * 计算OI变化率 (包装器)
   * @param {Array} oiHistory - 持仓量历史
   * @param {number} period - 周期
   * @returns {number} OI变化率
   */
  async calculateOIChange(oiHistory, period = 24) {
    const values = oiHistory.map(oi => parseFloat(oi.sumOpenInterest || oi));
    return TechnicalIndicators.calculateOIChange(values, period);
  }

  /**
   * 计算Delta (包装器)
   * @param {Array} aggTradeData - 聚合交易数据
   * @returns {number} Delta值
   */
  async calculateDelta(aggTradeData) {
    const buyVolumes = aggTradeData.map(trade => parseFloat(trade.buyVolume || 0));
    const sellVolumes = aggTradeData.map(trade => parseFloat(trade.sellVolume || 0));
    return TechnicalIndicators.calculateDelta(buyVolumes, sellVolumes);
  }

  /**
   * 计算Delta不平衡 (包装器)
   * @param {Array} aggTradeData - 聚合交易数据
   * @returns {number} Delta不平衡值
   */
  async calculateDeltaImbalance(aggTradeData) {
    const buyVolumes = aggTradeData.map(trade => parseFloat(trade.buyVolume || 0));
    const sellVolumes = aggTradeData.map(trade => parseFloat(trade.sellVolume || 0));
    return TechnicalIndicators.calculateDeltaImbalance(buyVolumes, sellVolumes);
  }

  /**
   * 判断1H因子 (包装器)
   * @param {string} symbol - 交易对
   * @param {string} trendDirection - 趋势方向
   * @returns {Promise<Object>} 因子判断结果
   */
  async judge1HFactors(symbol, trendDirection) {
    const result = await this.analyze1HFactors(symbol);
    return {
      score: result.factors.totalScore,
      factors: result.factors.factors,
      trendDirection
    };
  }

  /**
   * 计算EMA (包装器)
   * @param {Array} klines - K线数据
   * @param {number} period - 周期
   * @returns {Array} EMA值数组
   */
  async calculateEMA(klines, period) {
    const prices = klines.map(k => parseFloat(k[4]));
    return TechnicalIndicators.calculateEMA(prices, period);
  }

  /**
   * 计算ATR (包装器)
   * @param {Array} klines - K线数据
   * @param {number} period - 周期
   * @returns {Array} ATR值数组
   */
  async calculateATR(klines, period = 14) {
    const high = klines.map(k => parseFloat(k[2]));
    const low = klines.map(k => parseFloat(k[3]));
    const close = klines.map(k => parseFloat(k[4]));
    return TechnicalIndicators.calculateATR(high, low, close, period);
  }

  /**
   * 判断15M入场 (包装器)
   * @param {string} symbol - 交易对
   * @param {string} trendDirection - 趋势方向
   * @param {Object} mockData - 模拟数据
   * @returns {Promise<Object>} 入场判断结果
   */
  async judge15mEntry(symbol, trendDirection, mockData) {
    const result = await this.analyze15mExecution(symbol);
    return {
      entry_signal: result.entrySignal,
      trendDirection,
      indicators: result.indicators
    };
  }

  /**
   * 判断15M震荡突破 (包装器)
   * @param {string} symbol - 交易对
   * @param {Object} mockData - 模拟数据
   * @returns {Promise<Object>} 突破判断结果
   */
  async judge15mRangeBreakout(symbol, mockData) {
    const result = await this.analyze15mExecution(symbol);
    return {
      entry_signal: result.entrySignal,
      indicators: result.indicators
    };
  }

  /**
   * 分析15m入场信号
   * @param {string} symbol - 交易对
   * @param {string} trendDirection - 趋势方向
   * @param {Object} data - 数据
   * @returns {Object} 入场分析结果
   */
  async analyze15mEntry(symbol, trendDirection) {
    try {
      // 获取15m数据
      const klines15m = await this.binanceAPI.getKlines(symbol, '15m', 100);
      const prices = klines15m.map(k => parseFloat(k[4]));
      const volumes = klines15m.map(k => parseFloat(k[5]));

      // 计算技术指标
      const ema20 = TechnicalIndicators.calculateEMA(prices, 20);
      const ema50 = TechnicalIndicators.calculateEMA(prices, 50);
      const atr = TechnicalIndicators.calculateATR(
        klines15m.map(k => parseFloat(k[2])), // 最高价
        klines15m.map(k => parseFloat(k[3])), // 最低价
        prices, 14
      );
      const bbw = TechnicalIndicators.calculateBBW(prices);
      const vwap = TechnicalIndicators.calculateVWAP(klines);

      // 入场信号判断
      let entry_signal = 'HOLD';
      let confidence_score = 0;
      let is_fake_breakout = false;

      const currentPrice = prices[prices.length - 1];
      const currentEMA20 = ema20[ema20.length - 1];
      const currentEMA50 = ema50[ema50.length - 1];
      const currentATR = atr[atr.length - 1];

      if (trendDirection === 'UP') {
        // 趋势市场：EMA20 > EMA50，价格突破EMA20
        if (currentEMA20 > currentEMA50 && currentPrice > currentEMA20) {
          entry_signal = 'BUY';
          confidence_score = 85;
        }
      } else if (trendDirection === 'DOWN') {
        // 趋势市场：EMA20 < EMA50，价格跌破EMA20
        if (currentEMA20 < currentEMA50 && currentPrice < currentEMA20) {
          entry_signal = 'SELL';
          confidence_score = 85;
        }
      } else if (trendDirection === 'RANGE') {
        // 震荡市场：布林带收窄 + 假突破策略
        console.log('RANGE模式 - bbw:', bbw.bbw, 'currentPrice:', currentPrice);
        if (bbw.bbw && bbw.bbw < 0.1) { // 布林带收窄（放宽条件）
          // 计算震荡区间（不包含当前价格）
          const recentHigh = Math.max(...prices.slice(-20, -1));
          const recentLow = Math.min(...prices.slice(-20, -1));
          console.log('布林带收窄 - recentHigh:', recentHigh, 'recentLow:', recentLow, 'ATR:', currentATR);

          if (currentPrice > recentHigh + (currentATR * 0.5)) {
            entry_signal = 'SELL'; // 假突破做空
            confidence_score = 70;
            is_fake_breakout = true;
            console.log('假突破做空触发');
          } else if (currentPrice < recentLow - (currentATR * 0.5)) {
            entry_signal = 'BUY'; // 假突破做多
            confidence_score = 70;
            is_fake_breakout = true;
            console.log('假突破做多触发');
          }
        } else {
          console.log('布林带未收窄，bbw:', bbw.bbw);
        }
      }

      return {
        entry_signal,
        confidence: confidence_score,
        is_fake_breakout,
        ema20: currentEMA20,
        ema50: currentEMA50,
        atr: currentATR,
        current_price: currentPrice
      };
    } catch (error) {
      logger.error(`15m入场分析失败: ${error.message}`);
      return {
        entry_signal: 'HOLD',
        confidence: 0,
        error: error.message
      };
    }
  }

  /**
   * 计算止损 (包装器)
   * @param {number} entryPrice - 入场价格
   * @param {number} atr - ATR值
   * @param {Object} setupCandle - 设置蜡烛
   * @param {string} type - 类型
   * @param {number} rangeHigh - 震荡高点
   * @param {number} rangeLow - 震荡低点
   * @returns {number} 止损价格
   */
  async calculateStopLoss(entryPrice, atr, setupCandle, type, rangeHigh = null, rangeLow = null) {
    if (type === 'trend') {
      return entryPrice - (atr * 2);
    } else if (type === 'range') {
      return rangeLow ? rangeLow - (atr * 0.5) : entryPrice - (atr * 1.5);
    }
    return entryPrice - (atr * 1.5);
  }

  /**
   * 计算1H多因子评分（6个因子）
   * @param {number} currentPrice - 当前价格
   * @param {number} ema20 - 20周期EMA
   * @param {number} ema50 - 50周期EMA
   * @param {number} adx - ADX值
   * @param {number} bbw - 布林带宽度
   * @param {number} vwap - VWAP
   * @param {number} fundingRate - 资金费率
   * @param {number} oiChange - 持仓量变化
   * @param {number} delta - Delta值
   * @param {string} trendDirection - 趋势方向
   * @returns {Object} 因子评分结果
   */
  calculate1HFactors(currentPrice, ema20, ema50, adx, bbw, vwap, fundingRate, oiChange, delta, trendDirection) {
    const factors = {
      vwapDirection: 0,        // VWAP方向 (1分，权重20%)
      breakoutConfirmation: 0, // 突破确认 (1分，权重20%)
      volumeConfirmation: 0,   // 成交量双确认 (1分，权重20%)
      oiChange: 0,             // OI变化 (1分，权重15%)
      fundingRate: 0,          // 资金费率 (1分，权重15%)
      deltaImbalance: 0        // Delta失衡 (1分，权重10%)
    };

    // 1. VWAP方向 (1分，权重20%，必须满足)
    if (trendDirection === 'UP' && currentPrice > vwap) {
      factors.vwapDirection = 1;
    } else if (trendDirection === 'DOWN' && currentPrice < vwap) {
      factors.vwapDirection = 1;
    } else if (trendDirection === 'RANGE') {
      factors.vwapDirection = 0; // 震荡市场不满足VWAP方向要求
    }

    // 2. 突破确认 (1分，权重20%)
    if (trendDirection === 'UP' && currentPrice > ema20 && ema20 > ema50) {
      factors.breakoutConfirmation = 1;
    } else if (trendDirection === 'DOWN' && currentPrice < ema20 && ema20 < ema50) {
      factors.breakoutConfirmation = 1;
    } else if ((trendDirection === 'UP' && currentPrice > ema20) ||
      (trendDirection === 'DOWN' && currentPrice < ema20)) {
      factors.breakoutConfirmation = 0; // 部分确认不满足要求
    }

    // 3. 成交量双确认 (1分，权重20%)
    if (Math.abs(delta) > 0.1) {
      factors.volumeConfirmation = 1; // 成交量确认
    }

    // 4. OI变化 (1分，权重15%)
    if (trendDirection === 'UP' && oiChange > 0.02) {
      factors.oiChange = 1; // 多头6h OI≥+2%
    } else if (trendDirection === 'DOWN' && oiChange < -0.03) {
      factors.oiChange = 1; // 空头6h OI≤-3%
    }

    // 5. 资金费率 (1分，权重15%)
    if (Math.abs(fundingRate) <= 0.0005) { // -0.05%≤Funding Rate≤+0.05%
      factors.fundingRate = 1;
    }

    // 6. Delta失衡 (1分，权重10%)
    if (trendDirection === 'UP' && delta > 0.1) {
      factors.deltaImbalance = 1; // 主动买盘≥卖盘×1.2（多头）
    } else if (trendDirection === 'DOWN' && delta < -0.1) {
      factors.deltaImbalance = 1; // 主动卖盘≥买盘×1.2（空头）
    }

    const totalScore = Object.values(factors).reduce((sum, score) => sum + score, 0);

    return {
      totalScore,
      factors
    };
  }

  /**
   * 计算4H趋势评分（10点评分系统）
   * @param {number} currentPrice - 当前价格
   * @param {Array} ma20 - 20日均线
   * @param {Array} ma50 - 50日均线
   * @param {Array} ma200 - 200日均线
   * @param {Object} adx - ADX指标
   * @param {Object} bbw - 布林带宽度
   * @param {number} vwap - VWAP
   * @param {number} fundingRate - 资金费率
   * @param {number} oiChange - 持仓量变化
   * @param {number} delta - Delta值
   * @returns {Object} 评分结果
   */
  calculate4HScore(currentPrice, ma20, ma50, ma200, adx, bbw, vwap, fundingRate, oiChange, delta) {
    const scores = {
      trendStability: 0,    // 趋势稳定性 (2分)
      trendStrength: 0,     // 趋势强度 (2分)
      bbExpansion: 0,       // 布林带扩张 (2分)
      momentumConfirmation: 0, // 动量确认 (2分)
      volumeConfirmation: 0,   // 成交量确认 (1分)
      fundingConfirmation: 0   // 资金费率确认 (1分)
    };

    // 1. 趋势稳定性 (2分)
    if (ma20[ma20.length - 1] && ma50[ma50.length - 1] && ma200[ma200.length - 1]) {
      if (currentPrice > ma20[ma20.length - 1] && ma20[ma20.length - 1] > ma50[ma50.length - 1] && ma50[ma50.length - 1] > ma200[ma200.length - 1]) {
        scores.trendStability = 2; // 完美上升趋势
      } else if (currentPrice < ma20[ma20.length - 1] && ma20[ma20.length - 1] < ma50[ma50.length - 1] && ma50[ma50.length - 1] < ma200[ma200.length - 1]) {
        scores.trendStability = 2; // 完美下降趋势
      } else if ((currentPrice > ma20[ma20.length - 1] && ma20[ma20.length - 1] > ma50[ma50.length - 1]) ||
        (currentPrice < ma20[ma20.length - 1] && ma20[ma20.length - 1] < ma50[ma50.length - 1])) {
        scores.trendStability = 1; // 部分趋势
      }
    }

    // 2. 趋势强度 (2分)
    if (adx.adx > 30) {
      scores.trendStrength = 2;
    } else if (adx.adx > 20) {
      scores.trendStrength = 1;
    }

    // 3. 布林带扩张 (2分)
    if (bbw.bbw > 0.02) {
      scores.bbExpansion = 2; // 高波动
    } else if (bbw.bbw > 0.01) {
      scores.bbExpansion = 1; // 中等波动
    }

    // 4. 动量确认 (2分)
    if (currentPrice > vwap && oiChange > 0.02) {
      scores.momentumConfirmation = 2; // 价格高于VWAP且持仓量增加
    } else if (currentPrice > vwap || oiChange > 0.01) {
      scores.momentumConfirmation = 1; // 部分确认
    }

    // 5. 成交量确认 (1分)
    if (delta > 0.1) {
      scores.volumeConfirmation = 1; // 买盘强势
    } else if (delta < -0.1) {
      scores.volumeConfirmation = 1; // 卖盘强势
    }

    // 6. 资金费率确认 (1分)
    if (Math.abs(fundingRate) > 0.0005) {
      scores.fundingConfirmation = 1; // 资金费率异常
    }

    const total = Object.values(scores).reduce((sum, score) => sum + score, 0);

    return {
      total,
      breakdown: scores
    };
  }

  /**
   * 计算止盈 (包装器)
   * @param {number} entryPrice - 入场价格
   * @param {number} stopLoss - 止损价格
   * @param {number} riskRewardRatio - 风险回报比
   * @returns {number} 止盈价格
   */
  async calculateTakeProfit(entryPrice, stopLoss, riskRewardRatio = 2) {
    const risk = entryPrice - stopLoss;
    return entryPrice + (risk * riskRewardRatio);
  }

  /**
   * 计算简单Delta
   * @param {Array} prices - 价格数组
   * @param {Array} volumes - 成交量数组
   * @returns {number} Delta值
   */
  calculateSimpleDelta(prices, volumes) {
    if (prices.length < 2) return 0;

    let buyVolume = 0;
    let sellVolume = 0;

    for (let i = 1; i < prices.length; i++) {
      const priceChange = prices[i] - prices[i - 1];
      const volume = volumes[i];

      if (priceChange > 0) {
        buyVolume += volume;
      } else if (priceChange < 0) {
        sellVolume += volume;
      }
    }

    const totalVolume = buyVolume + sellVolume;
    return totalVolume > 0 ? (buyVolume - sellVolume) / totalVolume : 0;
  }

  /**
   * 计算成交量确认
   * @param {Array} volumes - 成交量数组
   * @returns {number} 成交量确认分数
   */
  calculateVolumeConfirmation(volumes) {
    if (volumes.length < 20) return 0;

    const recentVolume = volumes[volumes.length - 1];
    const avgVolume = volumes.slice(-20).reduce((sum, vol) => sum + vol, 0) / 20;

    return recentVolume > avgVolume * 1.5 ? 1 : 0;
  }
}

module.exports = V3Strategy;
