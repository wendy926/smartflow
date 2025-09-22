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
   * @returns {Promise<Object>} 4H趋势分析结果
   */
  async analyze4HTrend(symbol) {
    try {
      const klines = await this.binanceAPI.getKlines(symbol, '4h', 200);
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
      const vwap = TechnicalIndicators.calculateVWAP(prices, volumes);
      
      // 获取资金费率
      const fundingRate = await this.binanceAPI.getFundingRate(symbol);
      
      // 获取持仓量变化
      const oiHist = await this.binanceAPI.getOpenInterestHist(symbol, '1h', 24);
      const oiChange = TechnicalIndicators.calculateOIChange(
        oiHist.map(oi => parseFloat(oi.sumOpenInterest))
      );
      
      // 获取Delta数据
      const deltaData = await this.binanceAPI.getDelta(symbol, 100);
      
      // 判断趋势方向
      const currentPrice = prices[prices.length - 1];
      const trendDirection = this.determineTrendDirection(
        currentPrice, ma20[ma20.length - 1], ma50[ma50.length - 1], 
        ma200[ma200.length - 1], adx.adx
      );
      
      return {
        symbol,
        timeframe: '4H',
        trendDirection,
        indicators: {
          ma20: ma20[ma20.length - 1],
          ma50: ma50[ma50.length - 1],
          ma200: ma200[ma200.length - 1],
          adx: adx.adx,
          bbw: bbw.bbw,
          vwap: vwap,
          fundingRate: parseFloat(fundingRate.lastFundingRate),
          oiChange: oiChange,
          delta: deltaData.delta
        },
        timestamp: new Date()
      };
    } catch (error) {
      logger.error(`分析4H趋势失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 分析1H因子
   * @param {string} symbol - 交易对
   * @returns {Promise<Object>} 1H因子分析结果
   */
  async analyze1HFactors(symbol) {
    try {
      const klines = await this.binanceAPI.getKlines(symbol, '1h', 100);
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
      const vwap = TechnicalIndicators.calculateVWAP(prices, volumes);
      
      // 获取资金费率和持仓量变化
      const fundingRate = await this.binanceAPI.getFundingRate(symbol);
      const oiHist = await this.binanceAPI.getOpenInterestHist(symbol, '1h', 24);
      const oiChange = TechnicalIndicators.calculateOIChange(
        oiHist.map(oi => parseFloat(oi.sumOpenInterest))
      );
      
      // 获取Delta数据
      const deltaData = await this.binanceAPI.getDelta(symbol, 100);
      
      // 计算因子得分
      const factors = this.calculateFactors(
        prices[prices.length - 1], ema20[ema20.length - 1], ema50[ema50.length - 1],
        adx.adx, bbw.bbw, vwap, parseFloat(fundingRate.lastFundingRate),
        oiChange, deltaData.delta
      );
      
      return {
        symbol,
        timeframe: '1H',
        factors,
        indicators: {
          ema20: ema20[ema20.length - 1],
          ema50: ema50[ema50.length - 1],
          adx: adx.adx,
          bbw: bbw.bbw,
          vwap: vwap,
          fundingRate: parseFloat(fundingRate.lastFundingRate),
          oiChange: oiChange,
          delta: deltaData.delta
        },
        timestamp: new Date()
      };
    } catch (error) {
      logger.error(`分析1H因子失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 分析15M执行信号
   * @param {string} symbol - 交易对
   * @returns {Promise<Object>} 15M执行信号分析结果
   */
  async analyze15mExecution(symbol) {
    try {
      const klines = await this.binanceAPI.getKlines(symbol, '15m', 50);
      const prices = klines.map(k => parseFloat(k[4]));
      const volumes = klines.map(k => parseFloat(k[5]));
      
      // 计算技术指标
      const ema20 = TechnicalIndicators.calculateEMA(prices, 20);
      const adx = TechnicalIndicators.calculateADX(
        klines.map(k => parseFloat(k[2])),
        klines.map(k => parseFloat(k[3])),
        prices
      );
      const bbw = TechnicalIndicators.calculateBBW(prices);
      const vwap = TechnicalIndicators.calculateVWAP(prices, volumes);
      
      // 获取资金费率和持仓量变化
      const fundingRate = await this.binanceAPI.getFundingRate(symbol);
      const oiHist = await this.binanceAPI.getOpenInterestHist(symbol, '15m', 24);
      const oiChange = TechnicalIndicators.calculateOIChange(
        oiHist.map(oi => parseFloat(oi.sumOpenInterest))
      );
      
      // 获取Delta数据
      const deltaData = await this.binanceAPI.getDelta(symbol, 100);
      
      // 判断执行信号
      const entrySignal = this.determineEntrySignal(
        prices[prices.length - 1], ema20[ema20.length - 1],
        adx.adx, bbw.bbw, vwap, parseFloat(fundingRate.lastFundingRate),
        oiChange, deltaData.delta
      );
      
      return {
        symbol,
        timeframe: '15M',
        entrySignal,
        indicators: {
          ema20: ema20[ema20.length - 1],
          adx: adx.adx,
          bbw: bbw.bbw,
          vwap: vwap,
          fundingRate: parseFloat(fundingRate.lastFundingRate),
          oiChange: oiChange,
          delta: deltaData.delta
        },
        timestamp: new Date()
      };
    } catch (error) {
      logger.error(`分析15M执行信号失败: ${error.message}`);
      throw error;
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
    if (!ema20 || !adx || !bbw || !vwap) return 'HOLD';
    
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
      
      // 并行执行多时间级别分析
      const [trend4H, factors1H, execution15M] = await Promise.all([
        this.analyze4HTrend(symbol),
        this.analyze1HFactors(symbol),
        this.analyze15mExecution(symbol)
      ]);
      
      // 综合判断
      const finalSignal = this.combineSignals(trend4H, factors1H, execution15M);
      
      const result = {
        symbol,
        strategy: 'V3',
        signal: finalSignal,
        timeframes: {
          '4H': trend4H,
          '1H': factors1H,
          '15M': execution15M
        },
        timestamp: new Date()
      };
      
      logger.info(`V3策略分析完成: ${symbol} - ${finalSignal}`);
      return result;
    } catch (error) {
      logger.error(`V3策略执行失败: ${error.message}`);
      throw error;
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
    const factorsScore = factors1H.factors.totalScore;
    const executionSignal = execution15M.entrySignal;
    
    // 强趋势 + 高因子得分 + 明确执行信号
    if (trendDirection !== 'RANGE' && factorsScore > 70 && executionSignal !== 'HOLD') {
      return executionSignal;
    }
    
    // 中等条件
    if (trendDirection !== 'RANGE' && factorsScore > 50 && executionSignal !== 'HOLD') {
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
    return TechnicalIndicators.calculateADX(high, low, close, period);
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
    return TechnicalIndicators.calculateBBW(prices, period, stdDev);
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
    const atr = TechnicalIndicators.calculateATR(high, low, close, period);
    return [atr]; // 返回数组以匹配测试期望
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
}

module.exports = V3Strategy;
