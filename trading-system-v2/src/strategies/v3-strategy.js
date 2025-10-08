/**
 * 策略V3 - 多因子趋势跟踪策略
 * 基于strategy-comparison.md中的策略逻辑
 */

const TechnicalIndicators = require('../utils/technical-indicators');
const BinanceAPI = require('../api/binance-api');
const TokenClassifier = require('../utils/token-classifier');
const { globalAdjuster } = require('./v3-dynamic-weights');
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

      // 优化：添加MACD Histogram用于动能确认
      const macd = TechnicalIndicators.calculateMACDHistogram(prices, 12, 26, 9);
      logger.info(`4H MACD: histogram=${macd.histogram.toFixed(4)}, trending=${macd.trending}`);

      // 判断趋势方向
      const currentPrice = prices[prices.length - 1];
      const trendDirection = this.determineTrendDirection(
        currentPrice, ma20[ma20.length - 1], ma50[ma50.length - 1],
        ma200[ma200.length - 1], adx.adx
      );

      // 计算10点评分系统（优化：传入MACD）
      const score = this.calculate4HScore(
        currentPrice, ma20, ma50, ma200, adx, bbw, vwap,
        0, 0, 0, // 这些参数将在1H分析中获取
        macd // 新增MACD参数
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
        macdHistogram: macd.histogram || 0, // 新增
        macdTrending: macd.trending || false, // 新增
        indicators: {
          ma20: ma20[ma20.length - 1],
          ma50: ma50[ma50.length - 1],
          ma200: ma200[ma200.length - 1],
          adx: adx.adx,
          bbw: bbw.bbw,
          vwap: vwap,
          currentPrice: currentPrice,
          macd: macd // 新增
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
  analyze1HFactors(symbol, klines, data = {}) {
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

      // 获取4H趋势方向，如果没有则根据当前价格和EMA判断
      let trendDirection = data.trend4H || 'RANGE';
      if (!data.trend4H) {
        const currentPrice = prices[prices.length - 1];
        const currentEma20 = ema20[ema20.length - 1];
        const currentEma50 = ema50[ema50.length - 1];

        if (currentPrice > currentEma20 && currentEma20 > currentEma50) {
          trendDirection = 'UP';
        } else if (currentPrice < currentEma20 && currentEma20 < currentEma50) {
          trendDirection = 'DOWN';
        } else {
          trendDirection = 'RANGE';
        }
      }

      // 调试信息
      logger.info(`V3 1H趋势方向判断: ${trendDirection} (来自4H: ${data.trend4H || '无'})`);

      // 计算6个因子的详细评分（传入symbol用于加权）
      const factors = this.calculate1HFactors(
        symbol,
        prices[prices.length - 1], ema20[ema20.length - 1], ema50[ema50.length - 1],
        adx.adx, bbw.bbw, vwap, parseFloat(data.fundingRate?.lastFundingRate || 0),
        oiChange, delta, trendDirection
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
  analyze15mExecution(symbol, klines, data = {}) {
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

      // 判断市场类型（从data中获取或默认为TREND）
      const marketType = data.marketType || 'TREND';
      const trend = data.trend || 'RANGE';

      // 计算平均成交量
      const avgVolume = volumes.length >= 20 ?
        volumes.slice(-20).reduce((a, b) => a + b, 0) / 20 : 0;
      const currentVolume = volumes[volumes.length - 1];
      const oiChange = data.oiChange || 0;

      // 优化：分析价格结构（HH/HL或LL/LH）
      const structureScore = this.analyzeStructure(klines, trend);

      // 判断执行信号（支持震荡市）
      const entrySignalResult = this.determineEntrySignal(
        prices[prices.length - 1], ema20[ema20.length - 1],
        adx.adx, bbw.bbw, vwap, 0, 0, delta, marketType,
        data.rangeBoundary, klines
      );

      const entrySignal = entrySignalResult.signal || entrySignalResult;

      return {
        timeframe: '15M',
        signal: entrySignal,
        confidence: this.calculateTrendConfidence(adx.adx, bbw.bbw),
        score: this.calculate15MScore(symbol, marketType, ema20[ema20.length - 1], adx.adx, bbw.bbw, vwap, delta, currentVolume, avgVolume, oiChange, structureScore),
        structureScore, // 新增
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
   * 分析1H震荡市边界有效性（新增）
   * 根据strategy-v3.md文档实现震荡市边界判断
   * @param {Array} klines1H - 1H K线数据
   * @param {number} delta - Delta值
   * @param {Array} oiHistory - 持仓量历史
   * @param {Object} thresholds - 阈值配置
   * @returns {Object} 边界有效性判断结果
   */
  analyze1HRangeBoundary(klines1H, delta, oiHistory, thresholds = {}) {
    try {
      if (!klines1H || klines1H.length < 50) {
        return { lowerValid: false, upperValid: false, error: 'Insufficient data' };
      }

      const closes = klines1H.map(k => parseFloat(k[4]));
      const highs = klines1H.map(k => parseFloat(k[2]));
      const lows = klines1H.map(k => parseFloat(k[3]));
      const volumes = klines1H.map(k => parseFloat(k[5]));

      // 1. 计算布林带
      const bb = TechnicalIndicators.calculateBollingerBands(closes, 20, 2);
      const latestBB = bb[bb.length - 1];
      const upper = latestBB.upper;
      const lower = latestBB.lower;
      const middle = latestBB.middle;

      // 2. 计算连续触碰边界
      const last6Closes = closes.slice(-6);
      const lowerTouches = last6Closes.filter(c => c <= lower * (1 + 0.015)).length;
      const upperTouches = last6Closes.filter(c => c >= upper * (1 - 0.015)).length;

      // 3. 计算多因子得分
      let factorScore = 0;

      // 3.1 成交量因子：最新1H成交量 ≤ 1.7 × 20期均量
      const avgVolume = volumes.slice(-20).reduce((sum, v) => sum + v, 0) / 20;
      const currentVolume = volumes[volumes.length - 1];
      if (currentVolume <= avgVolume * (thresholds.volumeThreshold || 1.7)) {
        factorScore += 1;
      }

      // 3.2 Delta因子：|Delta| ≤ 0.02
      if (Math.abs(delta || 0) <= (thresholds.deltaThreshold || 0.02)) {
        factorScore += 1;
      }

      // 3.3 OI因子：|6h OI变化| ≤ 2%
      const oiChange = oiHistory && oiHistory.length >= 6 ?
        (oiHistory[oiHistory.length - 1] - oiHistory[0]) / oiHistory[0] : 0;
      if (Math.abs(oiChange) <= (thresholds.oiThreshold || 0.02)) {
        factorScore += 1;
      }

      // 3.4 无突破因子：最近20根K线无新高/新低
      const recent20Highs = highs.slice(-20);
      const recent20Lows = lows.slice(-20);
      const recentHigh = Math.max(...recent20Highs);
      const recentLow = Math.min(...recent20Lows);
      const lastHigh = highs[highs.length - 1];
      const lastLow = lows[lows.length - 1];

      const noNewHigh = lastHigh < recentHigh;
      const noNewLow = lastLow > recentLow;
      if (noNewHigh && noNewLow) {
        factorScore += 1;
      }

      // 3.5 VWAP因子（简化处理）
      const vwap = TechnicalIndicators.calculateVWAP(klines1H);
      const currentPrice = closes[closes.length - 1];
      const vwapDeviation = Math.abs(currentPrice - vwap) / vwap;
      if (vwapDeviation < 0.02) { // 价格在VWAP 2%范围内
        factorScore += 1;
      }

      // 4. 边界有效性判断
      const scoreThreshold = thresholds.scoreThreshold || 3;
      const lowerValid = lowerTouches >= 2 && factorScore >= scoreThreshold;
      const upperValid = upperTouches >= 2 && factorScore >= scoreThreshold;

      logger.info(`1H震荡市边界分析: 下轨触碰${lowerTouches}次, 上轨触碰${upperTouches}次, 因子得分${factorScore}/5, 下轨有效=${lowerValid}, 上轨有效=${upperValid}`);
      logger.info(`1H边界值: 下轨=${lower.toFixed(2)}, 中轨=${middle.toFixed(2)}, 上轨=${upper.toFixed(2)}`);

      return {
        lowerValid,
        upperValid,
        upper,
        lower,
        middle,
        factorScore,
        lowerTouches,
        upperTouches,
        thresholds: {
          volumeThreshold: thresholds.volumeThreshold || 1.7,
          deltaThreshold: thresholds.deltaThreshold || 0.02,
          oiThreshold: thresholds.oiThreshold || 0.02,
          scoreThreshold: thresholds.scoreThreshold || 3
        }
      };
    } catch (error) {
      logger.error(`1H震荡市边界分析失败: ${error.message}`);
      return { lowerValid: false, upperValid: false, error: error.message };
    }
  }

  /**
   * 分析价格结构（优化：新增）
   * 根据strategy-v3-plus.md：检测HH/HL（上升）或LL/LH（下降）
   * @param {Array} klines - K线数据
   * @param {string} trend - 趋势方向
   * @returns {number} 结构得分 0-2
   */
  analyzeStructure(klines, trend) {
    if (!klines || klines.length < 24) return 0;

    try {
      let score = 0;

      // 获取最近12根和之前12根的高低点
      const recent12 = klines.slice(-12);
      const prev12 = klines.slice(-24, -12);

      const recentHigh = Math.max(...recent12.map(k => parseFloat(k[2])));
      const recentLow = Math.min(...recent12.map(k => parseFloat(k[3])));
      const prevHigh = Math.max(...prev12.map(k => parseFloat(k[2])));
      const prevLow = Math.min(...prev12.map(k => parseFloat(k[3])));

      // 计算变化幅度，降低检测阈值
      const highChange = Math.abs(recentHigh - prevHigh) / prevHigh;
      const lowChange = Math.abs(recentLow - prevLow) / prevLow;
      const minChange = 0.001; // 0.1%的最小变化阈值

      if (trend === 'UP') {
        // 上升趋势：寻找Higher High (HH) - 降低阈值
        if (recentHigh > prevHigh && highChange >= minChange) {
          score += 1;
          logger.debug(`检测到HH: recent=${recentHigh.toFixed(4)} > prev=${prevHigh.toFixed(4)} (${(highChange * 100).toFixed(2)}%)`);
        }
        // 上升趋势：寻找Higher Low (HL) - 降低阈值
        if (recentLow > prevLow && lowChange >= minChange) {
          score += 1;
          logger.debug(`检测到HL: recent=${recentLow.toFixed(4)} > prev=${prevLow.toFixed(4)} (${(lowChange * 100).toFixed(2)}%)`);
        }
      } else if (trend === 'DOWN') {
        // 下降趋势：寻找Lower Low (LL) - 降低阈值
        if (recentLow < prevLow && lowChange >= minChange) {
          score += 1;
          logger.debug(`检测到LL: recent=${recentLow.toFixed(4)} < prev=${prevLow.toFixed(4)} (${(lowChange * 100).toFixed(2)}%)`);
        }
        // 下降趋势：寻找Lower High (LH) - 降低阈值
        if (recentHigh < prevHigh && highChange >= minChange) {
          score += 1;
          logger.debug(`检测到LH: recent=${recentHigh.toFixed(4)} < prev=${prevHigh.toFixed(4)} (${(highChange * 100).toFixed(2)}%)`);
        }
      }

      // 如果没有检测到明确的结构，但趋势明确，给予基础分
      if (score === 0 && trend !== 'RANGE') {
        score = 0.5; // 给予基础结构分
        logger.debug(`趋势明确但结构不明显，给予基础分: ${score}`);
      }

      logger.info(`15M结构分析: ${trend}趋势，得分${score}/2, highChange=${(highChange * 100).toFixed(2)}%, lowChange=${(lowChange * 100).toFixed(2)}%`);
      return score; // 0, 0.5, 1, 或 2
    } catch (error) {
      logger.error(`结构分析失败: ${error.message}`);
      return 0;
    }
  }

  /**
   * 计算15M评分
   * @param {string} symbol - 交易对
   * @param {string} marketType - 市场类型 'TREND' 或 'RANGE'
   * @param {number} ema20 - EMA20值
   * @param {number} adx - ADX值
   * @param {number} bbw - 布林带宽度
   * @param {number} vwap - VWAP值
   * @param {number} delta - Delta值
   * @param {number} volume - 成交量
   * @param {number} avgVolume - 平均成交量
   * @param {number} oiChange - OI变化
   * @param {number} structureScore - 结构得分（优化：新增）
   * @returns {number} 15M评分
   */
  calculate15MScore(symbol, marketType, ema20, adx, bbw, vwap, delta, volume, avgVolume, oiChange, structureScore = 0) {
    const { calculate15MWeightedScore } = require('./v3-strategy-weighted');
    const categoryInfo = TokenClassifier.getCategoryInfo(symbol);

    // 评估各因子得分（0或1）
    const factorScores = {
      vwap: vwap !== null && vwap >= 0 ? 1 : 0,
      delta: delta && Math.abs(delta) > 0.1 ? 1 : 0,
      oi: oiChange && Math.abs(oiChange) > 0.02 ? 1 : 0,
      volume: volume && avgVolume && volume >= avgVolume * 1.5 ? 1 : 0
    };

    // 计算加权得分
    const weightedScore = calculate15MWeightedScore(symbol, marketType, factorScores);

    // 传统评分（兼容旧逻辑）
    let score = 0;
    if (ema20 !== null && ema20 !== undefined && ema20 >= 0) score += 1;
    if (adx && adx > 20) score += 1;
    if (bbw && bbw < 0.1) score += 1;
    if (factorScores.vwap) score += 1;
    if (factorScores.delta) score += 1;

    logger.info(`${symbol} (${categoryInfo.name}) 15M ${marketType}市 - 传统得分:${score}/5, 加权得分:${(weightedScore * 100).toFixed(1)}%`);

    // 修复：使用>= (大于等于)，60%应该返回传统得分
    // 优化：直接返回传统得分，让信号融合层判断阈值
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
      const calculatedMaxLeverage = Math.floor(1 / (stopLossDistanceAbs + 0.005));

      // 使用计算出的最大杠杆数，但不超过24倍
      leverage = Math.min(calculatedMaxLeverage, 24);

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

    // 强趋势判断（提高ADX阈值到30，更保守）
    if (adx > 30) {
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
  /**
   * 判断15M入场信号（优化：支持震荡市假突破）
   * @param {number} currentPrice - 当前价格
   * @param {number} ema20 - EMA20
   * @param {number} adx - ADX
   * @param {number} bbw - 布林带宽度
   * @param {number} vwap - VWAP
   * @param {number} fundingRate - 资金费率
   * @param {number} oiChange - OI变化
   * @param {number} delta - Delta
   * @param {string} marketType - 市场类型 'TREND' 或 'RANGE'
   * @param {Object} rangeBoundary - 震荡市边界信息
   * @param {Array} klines15m - 15M K线数据
   * @returns {Object} 入场信号和参数
   */
  determineEntrySignal(currentPrice, ema20, adx, bbw, vwap, fundingRate, oiChange, delta, marketType = 'TREND', rangeBoundary = null, klines15m = null) {
    if (ema20 === null || ema20 === undefined || adx === null || adx === undefined ||
      bbw === null || bbw === undefined || vwap === null || vwap === undefined) {
      return { signal: 'HOLD', stopLoss: 0, takeProfit: 0, reason: 'Invalid indicators' };
    }

    // 震荡市假突破逻辑
    if (marketType === 'RANGE' && rangeBoundary && klines15m) {
      return this.determineRangeEntrySignal(currentPrice, rangeBoundary, klines15m, bbw);
    }

    // 趋势市逻辑（原有逻辑）
    const isTrending = adx > 15;
    const isVolatile = bbw > 0.02;
    const isAboveVWAP = currentPrice > vwap;
    const isBelowVWAP = currentPrice < vwap;

    // 买入信号
    if (isTrending && isVolatile && isAboveVWAP && delta > 0.1) {
      return { signal: 'BUY', stopLoss: 0, takeProfit: 0, reason: 'Trend long' };
    }

    // 卖出信号
    if (isTrending && isVolatile && isBelowVWAP && delta < -0.1) {
      return { signal: 'SELL', stopLoss: 0, takeProfit: 0, reason: 'Trend short' };
    }

    return { signal: 'HOLD', stopLoss: 0, takeProfit: 0, reason: 'No trend signal' };
  }

  /**
   * 震荡市假突破入场信号判断
   * @param {number} currentPrice - 当前价格
   * @param {Object} rangeBoundary - 边界信息
   * @param {Array} klines15m - 15M K线数据
   * @param {number} bbw - 布林带宽度
   * @returns {Object} 入场信号和参数
   */
  determineRangeEntrySignal(currentPrice, rangeBoundary, klines15m, bbw) {
    try {
      // 1. 检查布林带宽收窄（15分钟布林带宽 < 5%）
      if (bbw >= 0.05) {
        return { signal: 'HOLD', stopLoss: 0, takeProfit: 0, reason: 'BBW not narrow enough' };
      }

      // 2. 检查边界有效性
      if (!rangeBoundary.lowerValid && !rangeBoundary.upperValid) {
        return { signal: 'HOLD', stopLoss: 0, takeProfit: 0, reason: 'No valid boundaries' };
      }

      // 3. 获取前一根和当前K线收盘价
      if (klines15m.length < 2) {
        return { signal: 'HOLD', stopLoss: 0, takeProfit: 0, reason: 'Insufficient 15M data' };
      }

      const prevClose = parseFloat(klines15m[klines15m.length - 2][4]);
      const lastClose = parseFloat(klines15m[klines15m.length - 1][4]);

      // 4. 计算ATR用于止损
      const highs = klines15m.map(k => parseFloat(k[2]));
      const lows = klines15m.map(k => parseFloat(k[3]));
      const closes = klines15m.map(k => parseFloat(k[4]));
      const atr = TechnicalIndicators.calculateATR(highs, lows, closes, 14);
      const currentATR = atr[atr.length - 1] || (currentPrice * 0.01);

      // 5. 假突破判断
      // 多头假突破：prevClose < rangeLow 且 lastClose > rangeLow 且下轨有效
      if (prevClose < rangeBoundary.lower && lastClose > rangeBoundary.lower && rangeBoundary.lowerValid) {
        const stopLoss = rangeBoundary.lower - currentATR;
        const takeProfit = lastClose + 2 * (lastClose - stopLoss);

        logger.info(`震荡市多头假突破: 价格${lastClose}突破下轨${rangeBoundary.lower}, 止损${stopLoss}, 止盈${takeProfit}`);
        return {
          signal: 'BUY',
          stopLoss,
          takeProfit,
          reason: 'Range fake breakout long',
          entryPrice: lastClose
        };
      }

      // 空头假突破：prevClose > rangeHigh 且 lastClose < rangeHigh 且上轨有效
      if (prevClose > rangeBoundary.upper && lastClose < rangeBoundary.upper && rangeBoundary.upperValid) {
        const stopLoss = rangeBoundary.upper + currentATR;
        const takeProfit = lastClose - 2 * (stopLoss - lastClose);

        logger.info(`震荡市空头假突破: 价格${lastClose}跌破上轨${rangeBoundary.upper}, 止损${stopLoss}, 止盈${takeProfit}`);
        return {
          signal: 'SELL',
          stopLoss,
          takeProfit,
          reason: 'Range fake breakout short',
          entryPrice: lastClose
        };
      }

      return { signal: 'HOLD', stopLoss: 0, takeProfit: 0, reason: 'No range breakout detected' };
    } catch (error) {
      logger.error(`震荡市入场信号判断失败: ${error.message}`);
      return { signal: 'HOLD', stopLoss: 0, takeProfit: 0, reason: 'Error in range analysis' };
    }
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

      // 优化：先执行4H分析，然后并行执行1H和15M分析
      // 步骤1：执行4H分析
      const trend4H = await this.analyze4HTrend(klines4H, {});

      // 步骤2：根据4H趋势决定分析方式
      let factors1H, execution15M, rangeBoundary = null;

      if (trend4H?.trend === 'RANGE') {
        // 震荡市：先分析1H边界，再分析15M假突破
        logger.info(`[${symbol}] 震荡市模式：执行1H边界分析`);

        // 计算Delta（简化版本）
        const prices1H = klines1H.map(k => parseFloat(k[4]));
        const volumes1H = klines1H.map(k => parseFloat(k[5]));
        const delta = this.calculateSimpleDelta(prices1H, volumes1H);

        // 分析1H震荡市边界
        rangeBoundary = this.analyze1HRangeBoundary(klines1H, delta, oiHistory);

        // 1H因子分析（震荡市）
        factors1H = this.analyze1HFactors(symbol, klines1H, {
          ticker24hr, fundingRate, oiHistory, trend4H: trend4H?.trend
        });

        // 15M执行分析（震荡市假突破）
        execution15M = await this.analyze15mExecution(symbol, klines15M, {
          trend: trend4H?.trend || 'RANGE',
          marketType: 'RANGE',
          rangeBoundary: rangeBoundary
        });
      } else {
        // 趋势市：并行执行1H和15M分析
        const [factors1HResult, execution15MResult] = await Promise.all([
          this.analyze1HFactors(symbol, klines1H, { ticker24hr, fundingRate, oiHistory, trend4H: trend4H?.trend }),
          this.analyze15mExecution(symbol, klines15M, {
            trend: trend4H?.trend || 'RANGE',
            marketType: 'TREND'
          })
        ]);

        factors1H = factors1HResult;
        execution15M = execution15MResult;
      }

      // 综合判断
      logger.info(`[${symbol}] 开始信号融合: 4H=${trend4H?.score}, 1H=${factors1H?.score}, 15M=${execution15M?.score}`);
      const finalSignal = this.combineSignals(trend4H, factors1H, execution15M);
      logger.info(`[${symbol}] 信号融合结果: ${finalSignal}`);

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
  /**
   * 计算动态权重
   * @param {number} trendScore - 趋势得分
   * @param {number} factorScore - 因子得分
   * @param {number} entryScore - 入场得分
   * @returns {Object} 动态权重
   */
  calculateDynamicWeights(trendScore, factorScore, entryScore) {
    const baseWeights = { trend: 0.5, factor: 0.35, entry: 0.15 };

    // 趋势很强时增加趋势权重
    if (trendScore >= 8) {
      baseWeights.trend = 0.6;
      baseWeights.factor = 0.3;
      baseWeights.entry = 0.1;
    }
    // 因子很强时增加因子权重
    else if (factorScore >= 5) {
      baseWeights.trend = 0.45;
      baseWeights.factor = 0.4;
      baseWeights.entry = 0.15;
    }
    // 入场很强时增加入场权重
    else if (entryScore >= 4) {
      baseWeights.trend = 0.5;
      baseWeights.factor = 0.3;
      baseWeights.entry = 0.2;
    }
    // 所有指标都很强时平衡权重
    else if (trendScore >= 7 && factorScore >= 4 && entryScore >= 3) {
      baseWeights.trend = 0.45;
      baseWeights.factor = 0.35;
      baseWeights.entry = 0.2;
    }

    return baseWeights;
  }

  /**
   * 计算补偿机制
   * @param {number} normalizedScore - 归一化总分
   * @param {number} trendScore - 趋势得分
   * @param {number} factorScore - 因子得分
   * @param {number} entryScore - 入场得分
   * @param {number} structureScore - 结构得分
   * @returns {number} 补偿值
   */
  calculateCompensation(normalizedScore, trendScore, factorScore, entryScore, structureScore = 0) {
    let compensation = 0;

    // 总分很高时给予补偿
    if (normalizedScore >= 80) {
      compensation += 1;
    } else if (normalizedScore >= 75) {
      compensation += 0.5;
    }

    // 趋势很强时给予补偿
    if (trendScore >= 8) {
      compensation += 1;
    } else if (trendScore >= 7) {
      compensation += 0.5;
    }

    // 入场很强时给予补偿
    if (entryScore >= 4) {
      compensation += 0.5;
    }

    // 结构确认时给予补偿
    if (structureScore >= 2) {
      compensation += 0.5;
    }

    return Math.min(compensation, 2); // 最大补偿2分
  }

  /**
   * 获取调整后的因子门槛
   * @param {number} normalizedScore - 归一化总分
   * @param {number} trendScore - 趋势得分
   * @param {number} compensation - 补偿值
   * @returns {Object} 调整后的门槛
   */
  getAdjustedFactorThreshold(normalizedScore, trendScore, compensation) {
    // 基础门槛
    let strongThreshold = 5;
    let moderateThreshold = 4;
    let weakThreshold = 3;

    // 总分很高时降低门槛
    if (normalizedScore >= 80) {
      strongThreshold = Math.max(3, strongThreshold - 2);
      moderateThreshold = Math.max(2, moderateThreshold - 2);
      weakThreshold = Math.max(1, weakThreshold - 1);
    } else if (normalizedScore >= 75) {
      strongThreshold = Math.max(3, strongThreshold - 1);
      moderateThreshold = Math.max(2, moderateThreshold - 1);
    }

    // 趋势很强时降低门槛
    if (trendScore >= 8) {
      strongThreshold = Math.max(3, strongThreshold - 1);
      moderateThreshold = Math.max(2, moderateThreshold - 1);
    }

    // 应用补偿
    strongThreshold = Math.max(1, strongThreshold - compensation);
    moderateThreshold = Math.max(1, moderateThreshold - compensation);
    weakThreshold = Math.max(1, weakThreshold - compensation);

    return {
      strong: Math.round(strongThreshold),
      moderate: Math.round(moderateThreshold),
      weak: Math.round(weakThreshold)
    };
  }

  /**
   * 综合判断信号（优化版：容忍度逻辑 + 补偿机制）
   * 根据strategy-v3-plus.md：允许"强中短一致 + 弱偏差"容忍度
   * 增加补偿机制和动态权重调整解决信号死区问题
   * 
   * @param {Object} trend4H - 4H趋势分析结果
   * @param {Object} factors1H - 1H因子分析结果
   * @param {Object} execution15M - 15M执行信号结果
   * @returns {string} 最终交易信号
   */
  combineSignals(trend4H, factors1H, execution15M) {
    const trendDirection = trend4H.trendDirection || trend4H.trend;
    const trendScore = trend4H.score || 0;
    const factorScore = factors1H.totalScore || factors1H.score || 0;
    const entryScore = execution15M.score || 0;
    const structureScore = execution15M.structureScore || 0;

    logger.info(`combineSignals调试: factors1H.totalScore=${factors1H.totalScore}, factors1H.score=${factors1H.score}, factorScore=${factorScore}`);

    // 计算动态权重
    const weights = this.calculateDynamicWeights(trendScore, factorScore, entryScore);
    logger.info(`动态权重: 趋势=${weights.trend}, 因子=${weights.factor}, 入场=${weights.entry}`);

    // 计算总分（使用动态权重）
    const totalScore = (
      (trendScore / 10) * weights.trend +      // 4H: 0-10分 → 0-0.6
      (factorScore / 6) * weights.factor +     // 1H: 0-6分 → 0-0.4
      (entryScore / 5) * weights.entry         // 15M: 0-5分 → 0-0.2
    );

    // 归一化到0-100
    const normalizedScore = Math.round(totalScore * 100);

    // 计算补偿值
    const compensation = this.calculateCompensation(normalizedScore, trendScore, factorScore, entryScore, structureScore);
    logger.info(`补偿值: ${compensation}`);

    // 获取调整后的因子门槛
    const adjustedThreshold = this.getAdjustedFactorThreshold(normalizedScore, trendScore, compensation);
    logger.info(`调整后门槛: 强=${adjustedThreshold.strong}, 中=${adjustedThreshold.moderate}, 弱=${adjustedThreshold.weak}`);

    logger.info(`V3信号融合: 4H=${trendScore}/10, 1H=${factorScore}/6, 15M=${entryScore}/5, 结构=${structureScore}/2, 总分=${normalizedScore}%, 补偿=${compensation}`);

    // 如果趋势不明确，检查是否有震荡市假突破信号
    if (trendDirection === 'RANGE') {
      logger.info(`震荡市模式: 检查15M假突破信号`);
      // 如果15M检测到假突破信号，返回对应的交易信号
      if (execution15M.signal && (execution15M.signal === 'BUY' || execution15M.signal === 'SELL')) {
        const reason = execution15M.reason || '';
        if (reason.includes('Range fake breakout') || reason.includes('震荡市')) {
          logger.info(`✅ 震荡市假突破信号: ${execution15M.signal}, 理由: ${reason}`);
          return execution15M.signal;
        }
      }
      logger.info(`震荡市无有效假突破信号，HOLD`);
      return 'HOLD';
    }

    // 强信号：总分>=70 且 4H趋势强 且 1H因子强 且 15M有效（使用调整后门槛）
    if (normalizedScore >= 70 &&
      trendScore >= 6 &&
      factorScore >= adjustedThreshold.strong &&
      entryScore >= 1) {  // 15M必须有效，结构确认作为加分项
      logger.info(`✅ 强信号触发: 总分=${normalizedScore}%, 趋势=${trendScore}, 因子=${factorScore}>=${adjustedThreshold.strong}, 15M=${entryScore}, 结构=${structureScore}, 补偿=${compensation}`);
      return trendDirection === 'UP' ? 'BUY' : 'SELL';
    }

    // 中等信号：总分45-69 且 趋势>=5 且 1H因子强 且 15M有效（使用调整后门槛）
    if (normalizedScore >= 45 &&
      normalizedScore < 70 &&
      trendScore >= 5 &&
      factorScore >= adjustedThreshold.moderate &&  // 使用调整后门槛
      entryScore >= 1) {   // 15M必须有效
      logger.info(`⚠️ 中等信号触发: 总分=${normalizedScore}%, 趋势=${trendScore}, 因子=${factorScore}>=${adjustedThreshold.moderate}, 15M=${entryScore}, 结构=${structureScore}, 补偿=${compensation}`);
      return trendDirection === 'UP' ? 'BUY' : 'SELL';
    }

    // 弱信号：总分35-44 且 趋势>=4 且 1H因子有效 且 15M有效（使用调整后门槛）
    if (normalizedScore >= 35 &&
      normalizedScore < 45 &&
      trendScore >= 4 &&
      factorScore >= adjustedThreshold.weak &&  // 使用调整后门槛
      entryScore >= 1) {   // 15M必须有效
      logger.info(`⚠️ 弱信号触发: 总分=${normalizedScore}%, 趋势=${trendScore}, 因子=${factorScore}>=${adjustedThreshold.weak}, 15M=${entryScore}, 结构=${structureScore}, 补偿=${compensation}`);
      return trendDirection === 'UP' ? 'BUY' : 'SELL';
    }

    // 其他情况HOLD
    logger.info(`信号不足: 总分=${normalizedScore}%, 趋势=${trendScore}, 因子=${factorScore}, 15M=${entryScore}, 补偿=${compensation}, HOLD`);
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
        logger.debug('RANGE模式 - bbw:', bbw.bbw, 'currentPrice:', currentPrice);
        if (bbw.bbw && bbw.bbw < 0.1) { // 布林带收窄（放宽条件）
          // 计算震荡区间（不包含当前价格）
          const recentHigh = Math.max(...prices.slice(-20, -1));
          const recentLow = Math.min(...prices.slice(-20, -1));
          logger.debug('布林带收窄 - recentHigh:', recentHigh, 'recentLow:', recentLow, 'ATR:', currentATR);

          if (currentPrice > recentHigh + (currentATR * 0.5)) {
            entry_signal = 'SELL'; // 假突破做空
            confidence_score = 70;
            is_fake_breakout = true;
            logger.debug('假突破做空触发');
          } else if (currentPrice < recentLow - (currentATR * 0.5)) {
            entry_signal = 'BUY'; // 假突破做多
            confidence_score = 70;
            is_fake_breakout = true;
            logger.debug('假突破做多触发');
          }
        } else {
          logger.debug('布林带未收窄，bbw:', bbw.bbw);
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
  calculate1HFactors(symbol, currentPrice, ema20, ema50, adx, bbw, vwap, fundingRate, oiChange, delta, trendDirection) {
    // 获取代币分类信息
    const categoryInfo = TokenClassifier.getCategoryInfo(symbol);
    logger.info(`${symbol} 代币分类: ${categoryInfo.name}`);

    const factors = {
      vwapDirection: 0,        // VWAP方向（必须满足，不计分）
      breakoutConfirmation: 0, // 突破确认
      volumeConfirmation: 0,   // 成交量双确认
      oiChange: 0,             // OI变化
      fundingRate: 0,          // 资金费率
      deltaImbalance: 0        // Delta失衡
    };

    // 1. VWAP方向 (1分，权重20%，必须满足)
    if (trendDirection === 'UP' && currentPrice > vwap) {
      factors.vwapDirection = 1;
    } else if (trendDirection === 'DOWN' && currentPrice < vwap) {
      factors.vwapDirection = 1;
    } else if (trendDirection === 'RANGE') {
      // 震荡市场：价格在VWAP附近波动也给予部分分数
      const vwapDeviation = Math.abs(currentPrice - vwap) / vwap;
      if (vwapDeviation < 0.01) { // 在VWAP 1%范围内
        factors.vwapDirection = 1; // 震荡市场中价格贴近VWAP也算有效
      } else {
        factors.vwapDirection = 0;
      }
    }

    // 2. 突破确认 (1分，权重20%)
    if (trendDirection === 'UP' && currentPrice > ema20 && ema20 > ema50) {
      factors.breakoutConfirmation = 1;
    } else if (trendDirection === 'DOWN' && currentPrice < ema20 && ema20 < ema50) {
      factors.breakoutConfirmation = 1;
    } else if (trendDirection === 'RANGE') {
      // 震荡市场：价格在EMA20附近波动也算有效
      const emaDeviation = Math.abs(currentPrice - ema20) / ema20;
      if (emaDeviation < 0.02) { // 在EMA20 2%范围内
        factors.breakoutConfirmation = 1;
      } else {
        factors.breakoutConfirmation = 0;
      }
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
    } else if (trendDirection === 'RANGE') {
      // 震荡市场：小幅OI变化也算有效
      if (Math.abs(oiChange) > 0.01) { // 震荡市场OI变化≥±1%
        factors.oiChange = 1;
      } else {
        factors.oiChange = 0;
      }
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
    } else if (trendDirection === 'RANGE') {
      // 震荡市场：小幅Delta变化也算有效
      if (Math.abs(delta) > 0.05) { // 震荡市场Delta变化≥±5%
        factors.deltaImbalance = 1;
      } else {
        factors.deltaImbalance = 0;
      }
    }

    // 使用加权计算总分（根据代币类别）
    const { calculate1HTrendWeightedScore } = require('./v3-strategy-weighted');

    // VWAP方向是必须条件，不参与加权计算
    if (!factors.vwapDirection) {
      return {
        totalScore: 0,
        weightedScore: 0,
        factors,
        category: categoryInfo.name
      };
    }

    // 计算加权得分
    const factorScores = {
      vwapDirection: factors.vwapDirection,
      breakout: factors.breakoutConfirmation,
      volume: factors.volumeConfirmation,
      oiChange: factors.oiChange,
      delta: factors.deltaImbalance,
      fundingRate: factors.fundingRate
    };

    const weightedScore = calculate1HTrendWeightedScore(symbol, trendDirection, factorScores);
    const totalScore = Object.values(factors).reduce((sum, score) => sum + score, 0);

    logger.info(`${symbol} 1H因子 - 原始得分:${totalScore}/6, 加权得分:${(weightedScore * 100).toFixed(1)}%`);

    return {
      totalScore,
      weightedScore,  // 新增：加权得分（0-1之间）
      factors,
      category: categoryInfo.name
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
   * @param {Object} macd - MACD Histogram（优化：新增）
   * @returns {Object} 评分结果
   */
  calculate4HScore(currentPrice, ma20, ma50, ma200, adx, bbw, vwap, fundingRate, oiChange, delta, macd = null) {
    const scores = {
      trendStability: 0,    // 趋势稳定性 (2分)
      trendStrength: 0,     // 趋势强度 (2分)
      macdMomentum: 0,      // MACD动能确认 (3分) - 优化：新增，权重增加
      bbExpansion: 0,       // 布林带扩张 (1分) - 优化：权重降低
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

    // 3. MACD动能确认 (3分) - 优化：新增，用于减少假突破
    if (macd && macd.histogram !== undefined) {
      if (macd.trending && Math.abs(macd.histogram) > 0) {
        scores.macdMomentum = 3; // MACD柱状图为正且持续上升
        logger.info(`MACD动能强：histogram=${macd.histogram.toFixed(4)}`);
      } else if (Math.abs(macd.histogram) > 0) {
        scores.macdMomentum = 1; // 有动能但不强
      }
    }

    // 4. 布林带扩张 (1分) - 优化：权重降低，让位给MACD
    if (bbw.bbw > 0.02) {
      scores.bbExpansion = 1; // 高波动
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

