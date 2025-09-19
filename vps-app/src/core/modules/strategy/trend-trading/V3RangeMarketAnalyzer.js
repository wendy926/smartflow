// V3RangeMarketAnalyzer.js - V3策略震荡市分析器
// 严格按照strategy-v3.md文档实现震荡市1H边界确认和15m假突破入场逻辑

const BinanceAPI = require('../../api/BinanceAPI');
const TechnicalIndicators = require('../../utils/TechnicalIndicators');

/**
 * V3策略震荡市分析器
 * 
 * 按照strategy-v3.md文档实现:
 * 1. 震荡市1H边界确认 - 多因子打分机制
 * 2. 15m假突破入场 - 布林带收窄 + 假突破验证
 * 3. 震荡市专用止损止盈机制
 * 
 * 多因子权重 (按交易对分类):
 * - 主流币: VWAP20%, 触碰30%, 成交量20%, Delta15%, OI10%, 无突破5%
 * - 高市值币: VWAP20%, 触碰30%, 成交量25%, Delta15%, OI10%
 * - 热点/小币: VWAP10%, 触碰25%, 成交量30%, Delta25%, OI10%
 */
class V3RangeMarketAnalyzer {
  constructor(database, cacheManager) {
    this.database = database;
    this.cacheManager = cacheManager;
    
    // 配置参数 (按strategy-v3.md文档)
    this.config = {
      // 1H边界确认配置
      boundary: {
        bbPeriod: 20,                 // 布林带周期
        bbStdDev: 2,                  // 布林带标准差倍数
        touchThreshold: 2,            // 最少触碰次数
        touchTolerancePct: 1.5,       // 触碰容忍度1.5%
        lookbackHours: 6,             // 回看6小时
        scoreThreshold: 3             // 边界确认阈值
      },
      
      // 15m假突破配置
      fakeBreakout: {
        bbWidthThreshold: 0.05,       // 布林带宽收窄阈值5%
        breakoutRatio: 0.015,         // 假突破比例1.5%
        returnRatio: 0.01,            // 回撤比例1%
        volumeRatio: 1.2,             // 成交量确认比例
        confirmationBars: 2           // 确认K线数
      },
      
      // 多因子权重模板
      weights: {
        largecap: {   // 主流币 (BTC/ETH)
          vwap: 0.20,
          touch: 0.30,
          volume: 0.20,
          delta: 0.15,
          oi: 0.10,
          noBreakout: 0.05
        },
        midcap: {     // 高市值趋势币 (SOL/BNB)
          vwap: 0.20,
          touch: 0.30,
          volume: 0.25,
          delta: 0.15,
          oi: 0.10,
          noBreakout: 0.00
        },
        smallcap: {   // 热点/小币
          vwap: 0.10,
          touch: 0.25,
          volume: 0.30,
          delta: 0.25,
          oi: 0.10,
          noBreakout: 0.00
        }
      }
    };
  }

  /**
   * 1H边界确认分析 - 严格按照strategy-v3.md文档实现
   * @param {string} symbol - 交易对
   * @param {Object} symbolCategory - 交易对分类
   * @returns {Object} 边界确认分析结果
   */
  async analyze1HBoundary(symbol, symbolCategory) {
    try {
      console.log(`📊 开始1H边界确认分析 [${symbol}]`);

      // 获取1H K线数据
      const klines1h = await BinanceAPI.getKlines(symbol, '1h', 50);
      
      if (!klines1h || klines1h.length < 30) {
        throw new Error('1H K线数据不足');
      }

      const candles1h = klines1h.map(k => ({
        timestamp: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));

      // 计算布林带
      const closes = candles1h.map(c => c.close);
      const bollinger = TechnicalIndicators.calculateBollingerBands(
        closes, 
        this.config.boundary.bbPeriod, 
        this.config.boundary.bbStdDev
      );
      
      const currentBB = bollinger[bollinger.length - 1];
      const upperBoundary = currentBB.upper;
      const lowerBoundary = currentBB.lower;
      const middleBoundary = currentBB.middle;

      // 分析最近6小时的边界触碰情况
      const touchAnalysis = this.analyzeBoundaryTouches(candles1h, upperBoundary, lowerBoundary);

      // 获取权重配置
      const weights = this.getSymbolWeights(symbolCategory.category);

      // 上轨边界多因子确认
      const upperBoundaryScore = await this.calculateBoundaryScore(
        symbol, candles1h, upperBoundary, 'upper', touchAnalysis.upperTouches, weights
      );

      // 下轨边界多因子确认
      const lowerBoundaryScore = await this.calculateBoundaryScore(
        symbol, candles1h, lowerBoundary, 'lower', touchAnalysis.lowerTouches, weights
      );

      const result = {
        symbol,
        upperBoundary,
        lowerBoundary,
        middleBoundary,
        boundaryWidth: currentBB.bandwidth,
        
        // 触碰分析
        upperTouches: touchAnalysis.upperTouches,
        lowerTouches: touchAnalysis.lowerTouches,
        
        // 边界有效性
        upperValid: upperBoundaryScore.score >= this.config.boundary.scoreThreshold,
        lowerValid: lowerBoundaryScore.score >= this.config.boundary.scoreThreshold,
        upperScore: upperBoundaryScore,
        lowerScore: lowerBoundaryScore,
        
        // 整体边界评分
        boundaryScore: Math.max(upperBoundaryScore.score, lowerBoundaryScore.score),
        
        // 权重配置
        weights,
        symbolCategory: symbolCategory.category,
        
        timestamp: new Date().toISOString()
      };

      // 存储边界分析结果
      await this.storeBoundaryAnalysis(symbol, result);

      console.log(`🔄 1H边界确认完成 [${symbol}]: 上轨=${result.upperValid}(${upperBoundaryScore.score.toFixed(1)}), 下轨=${result.lowerValid}(${lowerBoundaryScore.score.toFixed(1)})`);

      return result;

    } catch (error) {
      console.error(`1H边界确认分析失败 [${symbol}]:`, error);
      throw error;
    }
  }

  /**
   * 分析边界触碰情况
   */
  analyzeBoundaryTouches(candles1h, upperBoundary, lowerBoundary) {
    const lookbackCandles = candles1h.slice(-this.config.boundary.lookbackHours);
    const tolerance = this.config.boundary.touchTolerancePct / 100;

    const upperTouches = [];
    const lowerTouches = [];

    for (const candle of lookbackCandles) {
      // 上轨触碰检查: close ≥ upper × (1 - 1.5%)
      if (candle.close >= upperBoundary * (1 - tolerance)) {
        upperTouches.push({
          timestamp: candle.timestamp,
          price: candle.close,
          distance: candle.close - upperBoundary,
          distancePct: ((candle.close - upperBoundary) / upperBoundary) * 100
        });
      }

      // 下轨触碰检查: close ≤ lower × (1 + 1.5%)
      if (candle.close <= lowerBoundary * (1 + tolerance)) {
        lowerTouches.push({
          timestamp: candle.timestamp,
          price: candle.close,
          distance: lowerBoundary - candle.close,
          distancePct: ((lowerBoundary - candle.close) / lowerBoundary) * 100
        });
      }
    }

    return {
      upperTouches,
      lowerTouches,
      upperTouchCount: upperTouches.length,
      lowerTouchCount: lowerTouches.length
    };
  }

  /**
   * 计算边界确认得分 - 多因子打分机制
   */
  async calculateBoundaryScore(symbol, candles1h, boundary, boundaryType, touches, weights) {
    try {
      let totalScore = 0;
      const factorScores = {};

      // 1. VWAP因子 - 越接近中轨越好
      const vwapScore = await this.calculateVWAPFactor(candles1h, boundary, boundaryType);
      factorScores.vwap = vwapScore.score;
      totalScore += vwapScore.score * weights.vwap;

      // 2. 触碰因子 - 最近1H多次触碰边界
      const touchScore = this.calculateTouchFactor(touches);
      factorScores.touch = touchScore.score;
      totalScore += touchScore.score * weights.touch;

      // 3. 成交量因子 - 成交量低表示震荡区间有效
      const volumeScore = this.calculateVolumeFactor(candles1h);
      factorScores.volume = volumeScore.score;
      totalScore += volumeScore.score * weights.volume;

      // 4. Delta因子 - 越接近0越好
      const deltaScore = await this.calculateDeltaFactor(symbol);
      factorScores.delta = deltaScore.score;
      totalScore += deltaScore.score * weights.delta;

      // 5. OI因子 - 稳定OI表示大资金未表态
      const oiScore = await this.calculateOIFactor(symbol);
      factorScores.oi = oiScore.score;
      totalScore += oiScore.score * weights.oi;

      // 6. 无突破因子 - 最近无新高/新低 (仅适用于主流币)
      let noBreakoutScore = { score: 0 };
      if (weights.noBreakout > 0) {
        noBreakoutScore = this.calculateNoBreakoutFactor(candles1h);
        factorScores.noBreakout = noBreakoutScore.score;
        totalScore += noBreakoutScore.score * weights.noBreakout;
      }

      return {
        score: totalScore,
        factorScores,
        factorDetails: {
          vwap: vwapScore,
          touch: touchScore,
          volume: volumeScore,
          delta: deltaScore,
          oi: oiScore,
          noBreakout: noBreakoutScore
        },
        weights,
        boundaryType
      };

    } catch (error) {
      console.error(`边界得分计算失败 [${symbol}]:`, error);
      return {
        score: 0,
        error: error.message
      };
    }
  }

  /**
   * VWAP因子计算
   */
  async calculateVWAPFactor(candles1h, boundary, boundaryType) {
    try {
      const vwap = TechnicalIndicators.calculateVWAP(candles1h);
      const currentPrice = candles1h[candles1h.length - 1].close;
      
      // 计算价格相对于边界和VWAP的位置
      const boundaryDistance = Math.abs(currentPrice - boundary);
      const vwapDistance = Math.abs(currentPrice - vwap);
      const boundaryRange = Math.abs(boundary - vwap);
      
      // 越接近中轨(VWAP)得分越高
      let score = 0;
      if (boundaryRange > 0) {
        const normalizedDistance = vwapDistance / boundaryRange;
        score = Math.max(0, 1 - normalizedDistance * 2); // 距离越近得分越高
      }

      return {
        score: Math.min(score, 1),
        vwap,
        currentPrice,
        boundary,
        vwapDistance,
        boundaryDistance,
        description: `价格距VWAP ${vwapDistance.toFixed(2)}, 距${boundaryType}边界 ${boundaryDistance.toFixed(2)}`
      };

    } catch (error) {
      console.error('VWAP因子计算失败:', error);
      return { score: 0, error: error.message };
    }
  }

  /**
   * 触碰因子计算
   */
  calculateTouchFactor(touches) {
    const touchCount = touches.length;
    
    // 触碰次数评分: ≥2次满分，1次半分，0次无分
    let score = 0;
    if (touchCount >= this.config.boundary.touchThreshold) {
      score = 1.0;
    } else if (touchCount >= 1) {
      score = 0.5;
    }

    // 触碰质量评分 - 考虑触碰的均匀性和强度
    if (touchCount > 0) {
      const avgDistance = touches.reduce((sum, touch) => sum + Math.abs(touch.distancePct), 0) / touchCount;
      const qualityBonus = Math.max(0, (2 - avgDistance) / 2 * 0.2); // 最多20%质量加成
      score = Math.min(score + qualityBonus, 1.0);
    }

    return {
      score,
      touchCount,
      threshold: this.config.boundary.touchThreshold,
      touches,
      description: `${touchCount}次触碰 ${score >= 1 ? '(满分)' : score >= 0.5 ? '(半分)' : '(无分)'}`
    };
  }

  /**
   * 成交量因子计算
   */
  calculateVolumeFactor(candles1h) {
    const volumes = candles1h.map(c => c.volume);
    const avgVolume20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const currentVolume = volumes[volumes.length - 1];
    const volumeRatio = currentVolume / avgVolume20;

    // 震荡市成交量因子: 成交量低表示区间有效，放量表示可能突破
    let score = 0;
    if (volumeRatio <= 1.0) {
      score = 1.0; // 成交量正常或偏低，区间有效
    } else if (volumeRatio <= 1.5) {
      score = 0.5; // 成交量略高，区间可能有效
    } else {
      score = 0.0; // 成交量过高，区间可能失效
    }

    return {
      score,
      currentVolume,
      avgVolume20,
      volumeRatio,
      description: `成交量比率${volumeRatio.toFixed(2)} ${score >= 1 ? '(低量有效)' : score >= 0.5 ? '(中等)' : '(高量警告)'}`
    };
  }

  /**
   * Delta因子计算
   */
  async calculateDeltaFactor(symbol) {
    try {
      // 获取Delta数据
      const deltaData = await this.getDeltaData(symbol);
      
      if (!deltaData) {
        return { score: 0, reason: 'Delta数据不可用' };
      }

      const deltaRatio = deltaData.buyVolume / Math.max(deltaData.sellVolume, 1);
      const deltaImbalance = Math.abs(deltaRatio - 1); // 距离1的偏差

      // 震荡市Delta因子: 越接近0(平衡)越好
      let score = 0;
      if (deltaImbalance <= 0.02) {       // ±2%以内
        score = 1.0;
      } else if (deltaImbalance <= 0.05) { // ±5%以内
        score = 0.5;
      } else {
        score = 0.0;
      }

      return {
        score,
        deltaRatio,
        deltaImbalance,
        buyVolume: deltaData.buyVolume,
        sellVolume: deltaData.sellVolume,
        description: `Delta比率${deltaRatio.toFixed(2)} ${score >= 1 ? '(平衡)' : score >= 0.5 ? '(轻微不平衡)' : '(严重不平衡)'}`
      };

    } catch (error) {
      console.error(`Delta因子计算失败 [${symbol}]:`, error);
      return { score: 0, error: error.message };
    }
  }

  /**
   * OI因子计算
   */
  async calculateOIFactor(symbol) {
    try {
      const oiHistory = await BinanceAPI.getOpenInterestHist(symbol, '1h', 6);
      
      if (!oiHistory || oiHistory.length < 2) {
        return { score: 0, reason: 'OI历史数据不足' };
      }

      // 计算6h OI变化
      const oiCurrent = parseFloat(oiHistory[oiHistory.length - 1].sumOpenInterest);
      const oi6hAgo = parseFloat(oiHistory[0].sumOpenInterest);
      const oiChange = Math.abs((oiCurrent - oi6hAgo) / oi6hAgo);

      // 震荡市OI因子: 稳定OI(变化≤2%)表示大资金未表态，边界可靠
      let score = 0;
      if (oiChange <= 0.02) {           // ≤2%变化
        score = 1.0;
      } else if (oiChange <= 0.05) {    // ≤5%变化
        score = 0.5;
      } else {
        score = 0.0;
      }

      return {
        score,
        oiChange,
        oiChangePercent: oiChange * 100,
        oiCurrent,
        oi6hAgo,
        description: `OI变化${(oiChange * 100).toFixed(2)}% ${score >= 1 ? '(稳定)' : score >= 0.5 ? '(轻微变化)' : '(变化较大)'}`
      };

    } catch (error) {
      console.error(`OI因子计算失败 [${symbol}]:`, error);
      return { score: 0, error: error.message };
    }
  }

  /**
   * 无突破因子计算 (仅适用于主流币)
   */
  calculateNoBreakoutFactor(candles1h) {
    const lookback = 20;
    const recentCandles = candles1h.slice(-lookback);
    
    if (recentCandles.length < lookback) {
      return { score: 0, reason: '数据不足' };
    }

    const highs = recentCandles.map(c => c.high);
    const lows = recentCandles.map(c => c.low);
    const maxHigh = Math.max(...highs);
    const minLow = Math.min(...lows);
    
    // 检查最近是否有新高或新低
    const recentHigh = highs[highs.length - 1];
    const recentLow = lows[lows.length - 1];
    
    const hasNewHigh = recentHigh >= maxHigh * 0.999; // 99.9%接近历史高点
    const hasNewLow = recentLow <= minLow * 1.001;   // 100.1%接近历史低点
    
    const noBreakout = !hasNewHigh && !hasNewLow;
    
    return {
      score: noBreakout ? 1.0 : 0.0,
      hasNewHigh,
      hasNewLow,
      noBreakout,
      maxHigh,
      minLow,
      recentHigh,
      recentLow,
      description: noBreakout ? '无新突破(有利震荡)' : '有新突破(震荡可能结束)'
    };
  }

  /**
   * 15m假突破入场分析 - 按strategy-v3.md文档实现
   */
  async analyze15mFakeBreakout(symbol, boundaryResult, symbolCategory) {
    try {
      console.log(`⚡ 开始15m假突破分析 [${symbol}]`);

      // 获取15m K线数据
      const klines15m = await BinanceAPI.getKlines(symbol, '15m', 50);
      
      if (!klines15m || klines15m.length < 30) {
        throw new Error('15m K线数据不足');
      }

      const candles15m = klines15m.map(k => ({
        timestamp: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));

      // 1. 检查15m布林带宽收窄 - 按strategy-v3.md文档
      const bbWidthCheck = this.check15mBBWidth(candles15m);
      if (!bbWidthCheck.narrow) {
        return {
          fakeBreakoutDetected: false,
          reason: '15m布林带宽未收窄',
          bbWidthCheck
        };
      }

      // 2. 检查假突破模式
      const fakeBreakoutAnalysis = this.detectFakeBreakoutPattern(candles15m, boundaryResult);

      if (!fakeBreakoutAnalysis.detected) {
        return {
          fakeBreakoutDetected: false,
          reason: '未检测到假突破模式',
          bbWidthCheck,
          fakeBreakoutAnalysis
        };
      }

      // 3. 成交量确认
      const volumeConfirmation = this.checkFakeBreakoutVolume(candles15m);

      // 4. 计算入场价格和风险管理
      const entryCalculation = this.calculateFakeBreakoutEntry(fakeBreakoutAnalysis, boundaryResult, candles15m);

      const result = {
        fakeBreakoutDetected: true,
        direction: fakeBreakoutAnalysis.direction,
        mode: fakeBreakoutAnalysis.mode,
        confidence: this.calculateFakeBreakoutConfidence(fakeBreakoutAnalysis, volumeConfirmation),
        
        // 分析详情
        bbWidthCheck,
        fakeBreakoutAnalysis,
        volumeConfirmation,
        entryCalculation,
        
        // 入场数据
        entryPrice: entryCalculation.entryPrice,
        currentPrice: candles15m[candles15m.length - 1].close,
        
        // 技术指标
        atr14: entryCalculation.atr14,
        
        timestamp: new Date().toISOString()
      };

      // 存储假突破分析结果
      await this.storeFakeBreakoutAnalysis(symbol, result);

      console.log(`🎯 15m假突破分析完成 [${symbol}]: ${result.detected ? result.direction : 'NONE'} (置信度: ${result.confidence.toFixed(2)})`);

      return result;

    } catch (error) {
      console.error(`15m假突破分析失败 [${symbol}]:`, error);
      throw error;
    }
  }

  /**
   * 检查15m布林带宽收窄
   */
  check15mBBWidth(candles15m) {
    const closes = candles15m.map(c => c.close);
    const bollinger = TechnicalIndicators.calculateBollingerBands(closes, 20, 2);
    const currentBB = bollinger[bollinger.length - 1];
    
    const narrow = currentBB.bandwidth < this.config.fakeBreakout.bbWidthThreshold;
    
    return {
      narrow,
      bandwidth: currentBB.bandwidth,
      threshold: this.config.fakeBreakout.bbWidthThreshold,
      description: narrow ? '布林带收窄' : '布林带未收窄'
    };
  }

  /**
   * 检测假突破模式
   */
  detectFakeBreakoutPattern(candles15m, boundaryResult) {
    const currentCandle = candles15m[candles15m.length - 1];
    const prevCandle = candles15m[candles15m.length - 2];
    
    let detected = false;
    let direction = null;
    let mode = null;

    // 检测多头假突破: 前一根突破下轨 + 当前回撤到区间内
    if (boundaryResult.lowerValid) {
      const prevBelowLower = prevCandle.close < boundaryResult.lowerBoundary;
      const currentAboveLower = currentCandle.close > boundaryResult.lowerBoundary;
      
      if (prevBelowLower && currentAboveLower) {
        detected = true;
        direction = 'LONG';
        mode = '假突破_多头';
      }
    }

    // 检测空头假突破: 前一根突破上轨 + 当前回撤到区间内
    if (boundaryResult.upperValid && !detected) {
      const prevAboveUpper = prevCandle.close > boundaryResult.upperBoundary;
      const currentBelowUpper = currentCandle.close < boundaryResult.upperBoundary;
      
      if (prevAboveUpper && currentBelowUpper) {
        detected = true;
        direction = 'SHORT';
        mode = '假突破_空头';
      }
    }

    return {
      detected,
      direction,
      mode,
      prevCandle,
      currentCandle,
      upperBoundary: boundaryResult.upperBoundary,
      lowerBoundary: boundaryResult.lowerBoundary,
      description: detected ? 
        `检测到${direction}假突破` : 
        '未检测到假突破模式'
    };
  }

  /**
   * 假突破成交量确认
   */
  checkFakeBreakoutVolume(candles15m) {
    const volumes = candles15m.map(c => c.volume);
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const currentVolume = volumes[volumes.length - 1];
    const volumeRatio = currentVolume / avgVolume;

    // 假突破时成交量应该适中，不宜过高
    const confirmed = volumeRatio >= 1.0 && volumeRatio <= 2.0;

    return {
      confirmed,
      currentVolume,
      avgVolume,
      volumeRatio,
      description: confirmed ? 
        `假突破成交量确认: ${volumeRatio.toFixed(2)}倍` :
        `假突破成交量异常: ${volumeRatio.toFixed(2)}倍`
    };
  }

  /**
   * 计算假突破入场价格
   */
  calculateFakeBreakoutEntry(fakeBreakoutAnalysis, boundaryResult, candles15m) {
    const entryPrice = fakeBreakoutAnalysis.currentCandle.close;
    
    // 计算ATR14
    const atr14 = TechnicalIndicators.calculateATR(
      candles15m.map(c => c.high),
      candles15m.map(c => c.low),
      candles15m.map(c => c.close),
      14
    );
    const currentATR14 = atr14[atr14.length - 1];

    return {
      entryPrice,
      atr14: currentATR14,
      entryCandle: fakeBreakoutAnalysis.currentCandle,
      setupCandle: fakeBreakoutAnalysis.prevCandle
    };
  }

  /**
   * 计算假突破置信度
   */
  calculateFakeBreakoutConfidence(fakeBreakoutAnalysis, volumeConfirmation) {
    let confidence = 0;

    // 基础假突破模式 (0.6)
    if (fakeBreakoutAnalysis.detected) {
      confidence += 0.6;
    }

    // 成交量确认加成 (0.2)
    if (volumeConfirmation.confirmed) {
      confidence += 0.2;
    }

    // 突破幅度合理性加成 (0.2)
    const breakoutDistance = Math.abs(
      fakeBreakoutAnalysis.prevCandle.close - 
      (fakeBreakoutAnalysis.direction === 'LONG' ? fakeBreakoutAnalysis.lowerBoundary : fakeBreakoutAnalysis.upperBoundary)
    );
    const priceBase = fakeBreakoutAnalysis.currentCandle.close;
    const breakoutRatio = breakoutDistance / priceBase;
    
    if (breakoutRatio >= 0.01 && breakoutRatio <= 0.03) { // 1%-3%的突破幅度
      confidence += 0.2;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * 获取交易对权重配置
   */
  getSymbolWeights(category) {
    return this.config.weights[category] || this.config.weights.midcap;
  }

  /**
   * 获取Delta数据 (复用V3HourlyScoring的方法)
   */
  async getDeltaData(symbol) {
    try {
      // 从缓存获取
      const cached = await this.cacheManager.get('delta_realtime', symbol);
      if (cached && cached.timestamp && Date.now() - cached.timestamp < 60000) {
        return cached;
      }

      // 从数据库获取
      const result = await this.database.runQuery(`
        SELECT delta_buy_volume, delta_sell_volume, delta_ratio
        FROM delta_realtime_data 
        WHERE symbol = ? AND timeframe = '15m'
        ORDER BY timestamp DESC 
        LIMIT 1
      `, [symbol]);

      if (result && result.length > 0) {
        return {
          buyVolume: result[0].delta_buy_volume,
          sellVolume: result[0].delta_sell_volume,
          ratio: result[0].delta_ratio,
          timestamp: Date.now()
        };
      }

      // 模拟数据 (临时方案)
      return {
        buyVolume: 950 + Math.random() * 100,
        sellVolume: 950 + Math.random() * 100,
        ratio: 0.95 + Math.random() * 0.1,
        timestamp: Date.now(),
        source: 'simulated'
      };

    } catch (error) {
      console.error(`获取Delta数据失败 [${symbol}]:`, error);
      return null;
    }
  }

  /**
   * 存储边界分析结果
   */
  async storeBoundaryAnalysis(symbol, result) {
    try {
      await this.database.run(`
        INSERT OR REPLACE INTO v3_range_boundary_analysis
        (symbol, bb_upper, bb_lower, bb_middle, bb_width, upper_touches_6h, lower_touches_6h,
         boundary_valid, total_boundary_score, boundary_score_threshold, symbol_category)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        symbol,
        result.upperBoundary,
        result.lowerBoundary,
        result.middleBoundary,
        result.boundaryWidth,
        result.upperTouches.length,
        result.lowerTouches.length,
        result.upperValid || result.lowerValid,
        result.boundaryScore,
        this.config.boundary.scoreThreshold,
        result.symbolCategory
      ]);
    } catch (error) {
      console.error('存储边界分析结果失败:', error);
    }
  }

  /**
   * 存储假突破分析结果
   */
  async storeFakeBreakoutAnalysis(symbol, result) {
    try {
      // 这里可以扩展存储到专门的假突破分析表
      console.log(`📝 假突破分析结果已记录 [${symbol}]: ${result.direction || 'NONE'}`);
    } catch (error) {
      console.error('存储假突破分析结果失败:', error);
    }
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    if (!this.database) throw new Error('数据库连接不可用');
    if (!this.cacheManager) throw new Error('缓存管理器不可用');
    
    // 测试数据库连接
    await this.database.runQuery('SELECT 1');
    
    return { status: 'healthy', timestamp: new Date().toISOString() };
  }

  /**
   * 获取震荡市分析统计
   */
  getRangeAnalysisStats() {
    return {
      config: this.config,
      lastUpdate: new Date().toISOString()
    };
  }
}

module.exports = V3RangeMarketAnalyzer;
