// ICTSweepDetector.js - ICT策略Sweep检测器
// 严格按照ict.md文档实现Sweep宏观和微观速率检测

/**
 * ICT Sweep检测器
 * 
 * 按照ict.md文档实现:
 * 1. Sweep宏观速率确认 (4H级别):
 *    - 检测关键swing高/低是否在≤2根4H内被刺破并收回
 *    - 刺破幅度÷bar数 ≥ 0.4×ATR(4H) → 有效sweep
 * 
 * 2. Sweep微观速率 (15m级别):
 *    - sweep发生在≤3根15m内收回
 *    - sweep幅度÷bar数 ≥ 0.2×ATR(15m)
 */
class ICTSweepDetector {
  constructor() {
    this.config = {
      // 4H宏观Sweep配置
      htf: {
        maxBarsToReturn: 2,           // 最大2根4H K线收回
        minSpeedATRRatio: 0.4,        // 最小速率 = 0.4×ATR(4H)
        swingLookback: 20,            // 寻找swing高低点的回看期
        minSwingSize: 0.01            // 最小swing大小 (1%)
      },
      
      // 15m微观Sweep配置
      ltf: {
        maxBarsToReturn: 3,           // 最大3根15m K线收回
        minSpeedATRRatio: 0.2,        // 最小速率 = 0.2×ATR(15m)
        swingLookback: 20,            // 寻找swing高低点的回看期
        minSwingSize: 0.005           // 最小swing大小 (0.5%)
      }
    };
  }

  /**
   * 4H Sweep宏观速率检测 - 严格按照ict.md文档实现
   * @param {Array} candles4h - 4H K线数据
   * @param {number} atr4h - 4H ATR值
   * @param {Object} options - 检测选项
   * @returns {Object} Sweep检测结果
   */
  async detectSweepHTF(candles4h, atr4h, options = {}) {
    try {
      const config = { ...this.config.htf, ...options };
      
      // 1. 寻找关键swing高低点
      const swingPoints = this.findSwingPoints(candles4h, config.swingLookback, config.minSwingSize);
      
      if (swingPoints.highs.length === 0 && swingPoints.lows.length === 0) {
        return {
          detected: false,
          reason: '未找到有效的swing高低点',
          swingPoints
        };
      }

      // 2. 检测最近的swing点是否被刺破
      const recentBars = candles4h.slice(-config.maxBarsToReturn - 1); // 多取1根用于对比
      
      // 检测swing高点被刺破
      const swingHighSweeps = this.detectSwingHighSweeps(swingPoints.highs, recentBars, atr4h, config);
      
      // 检测swing低点被刺破
      const swingLowSweeps = this.detectSwingLowSweeps(swingPoints.lows, recentBars, atr4h, config);
      
      // 合并所有有效的sweep
      const allSweeps = [...swingHighSweeps, ...swingLowSweeps];
      const validSweeps = allSweeps.filter(sweep => sweep.valid);

      if (validSweeps.length === 0) {
        return {
          detected: false,
          reason: '未检测到有效的4H Sweep',
          swingPoints,
          attemptedSweeps: allSweeps,
          threshold: config.minSpeedATRRatio * atr4h
        };
      }

      // 选择最佳sweep (速率最高的)
      const bestSweep = validSweeps.sort((a, b) => b.speed - a.speed)[0];

      return {
        detected: true,
        speed: bestSweep.speed,
        threshold: config.minSpeedATRRatio * atr4h,
        direction: bestSweep.direction,
        swingLevel: bestSweep.swingLevel,
        exceedAmount: bestSweep.exceedAmount,
        barsToReturn: bestSweep.barsToReturn,
        valid: true,
        
        // 详细数据
        bestSweep,
        allValidSweeps: validSweeps,
        swingPoints,
        
        // 质量评分
        quality: this.calculateSweepQuality(bestSweep, atr4h),
        
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('4H Sweep检测失败:', error);
      return {
        detected: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 15m Sweep微观速率检测 - 严格按照ict.md文档实现
   */
  async detectSweepLTF(candles15m, atr15m, options = {}) {
    try {
      const config = { ...this.config.ltf, ...options };
      
      // 1. 寻找15m级别的swing点
      const swingPoints = this.findSwingPoints(candles15m, config.swingLookback, config.minSwingSize);
      
      if (swingPoints.highs.length === 0 && swingPoints.lows.length === 0) {
        return {
          detected: false,
          reason: '未找到有效的15m swing点',
          swingPoints
        };
      }

      // 2. 检测最近的sweep
      const recentBars = candles15m.slice(-config.maxBarsToReturn - 1);
      
      const swingHighSweeps = this.detectSwingHighSweeps(swingPoints.highs, recentBars, atr15m, config);
      const swingLowSweeps = this.detectSwingLowSweeps(swingPoints.lows, recentBars, atr15m, config);
      
      const allSweeps = [...swingHighSweeps, ...swingLowSweeps];
      const validSweeps = allSweeps.filter(sweep => sweep.valid);

      if (validSweeps.length === 0) {
        return {
          detected: false,
          reason: '未检测到有效的15m Sweep',
          swingPoints,
          attemptedSweeps: allSweeps,
          threshold: config.minSpeedATRRatio * atr15m
        };
      }

      const bestSweep = validSweeps.sort((a, b) => b.speed - a.speed)[0];

      return {
        detected: true,
        speed: bestSweep.speed,
        threshold: config.minSpeedATRRatio * atr15m,
        direction: bestSweep.direction,
        swingLevel: bestSweep.swingLevel,
        exceedAmount: bestSweep.exceedAmount,
        barsToReturn: bestSweep.barsToReturn,
        valid: true,
        
        bestSweep,
        allValidSweeps: validSweeps,
        swingPoints,
        quality: this.calculateSweepQuality(bestSweep, atr15m),
        
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('15m Sweep检测失败:', error);
      return {
        detected: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 寻找Swing高低点
   */
  findSwingPoints(candles, lookback, minSwingSize) {
    const swingHighs = [];
    const swingLows = [];

    for (let i = lookback; i < candles.length - lookback; i++) {
      const current = candles[i];
      const leftSlice = candles.slice(i - lookback, i);
      const rightSlice = candles.slice(i + 1, i + lookback + 1);

      // 检测swing高点
      const isSwingHigh = leftSlice.every(c => c.high <= current.high) && 
                         rightSlice.every(c => c.high <= current.high);
      
      if (isSwingHigh) {
        // 验证swing大小
        const leftMax = Math.max(...leftSlice.map(c => c.high));
        const rightMax = Math.max(...rightSlice.map(c => c.high));
        const swingSize = Math.min(
          (current.high - leftMax) / leftMax,
          (current.high - rightMax) / rightMax
        );
        
        if (swingSize >= minSwingSize) {
          swingHighs.push({
            index: i,
            timestamp: current.timestamp,
            level: current.high,
            type: 'high',
            swingSize
          });
        }
      }

      // 检测swing低点
      const isSwingLow = leftSlice.every(c => c.low >= current.low) && 
                        rightSlice.every(c => c.low >= current.low);
      
      if (isSwingLow) {
        const leftMin = Math.min(...leftSlice.map(c => c.low));
        const rightMin = Math.min(...rightSlice.map(c => c.low));
        const swingSize = Math.min(
          (leftMin - current.low) / leftMin,
          (rightMin - current.low) / rightMin
        );
        
        if (swingSize >= minSwingSize) {
          swingLows.push({
            index: i,
            timestamp: current.timestamp,
            level: current.low,
            type: 'low',
            swingSize
          });
        }
      }
    }

    return {
      highs: swingHighs.slice(-5), // 保留最近5个swing点
      lows: swingLows.slice(-5)
    };
  }

  /**
   * 检测swing高点被刺破 - 按ict.md文档实现
   */
  detectSwingHighSweeps(swingHighs, recentBars, atr, config) {
    const sweeps = [];

    for (const swingHigh of swingHighs) {
      // 检查是否有K线刺破swing高点
      let sweepBar = null;
      let exceedAmount = 0;

      for (const bar of recentBars) {
        if (bar.high > swingHigh.level) {
          const exceed = bar.high - swingHigh.level;
          if (exceed > exceedAmount) {
            sweepBar = bar;
            exceedAmount = exceed;
          }
        }
      }

      if (!sweepBar) continue;

      // 检查是否在规定时间内收回
      const sweepBarIndex = recentBars.indexOf(sweepBar);
      let barsToReturn = 0;
      let returned = false;

      for (let i = sweepBarIndex + 1; i < recentBars.length; i++) {
        barsToReturn++;
        if (recentBars[i].close < swingHigh.level) {
          returned = true;
          break;
        }
      }

      // 计算sweep速率 - 按ict.md文档公式
      const speed = barsToReturn > 0 ? exceedAmount / barsToReturn : 0;
      const threshold = config.minSpeedATRRatio * atr;
      const valid = returned && barsToReturn <= config.maxBarsToReturn && speed >= threshold;

      sweeps.push({
        swingLevel: swingHigh.level,
        direction: 'bearish', // 刺破高点后回落
        exceedAmount,
        barsToReturn,
        speed,
        threshold,
        returned,
        valid,
        sweepBar,
        swingPoint: swingHigh
      });
    }

    return sweeps;
  }

  /**
   * 检测swing低点被刺破 - 按ict.md文档实现
   */
  detectSwingLowSweeps(swingLows, recentBars, atr, config) {
    const sweeps = [];

    for (const swingLow of swingLows) {
      // 检查是否有K线刺破swing低点
      let sweepBar = null;
      let exceedAmount = 0;

      for (const bar of recentBars) {
        if (bar.low < swingLow.level) {
          const exceed = swingLow.level - bar.low;
          if (exceed > exceedAmount) {
            sweepBar = bar;
            exceedAmount = exceed;
          }
        }
      }

      if (!sweepBar) continue;

      // 检查是否在规定时间内收回
      const sweepBarIndex = recentBars.indexOf(sweepBar);
      let barsToReturn = 0;
      let returned = false;

      for (let i = sweepBarIndex + 1; i < recentBars.length; i++) {
        barsToReturn++;
        if (recentBars[i].close > swingLow.level) {
          returned = true;
          break;
        }
      }

      // 计算sweep速率
      const speed = barsToReturn > 0 ? exceedAmount / barsToReturn : 0;
      const threshold = config.minSpeedATRRatio * atr;
      const valid = returned && barsToReturn <= config.maxBarsToReturn && speed >= threshold;

      sweeps.push({
        swingLevel: swingLow.level,
        direction: 'bullish', // 刺破低点后回升
        exceedAmount,
        barsToReturn,
        speed,
        threshold,
        returned,
        valid,
        sweepBar,
        swingPoint: swingLow
      });
    }

    return sweeps;
  }

  /**
   * 计算Sweep质量评分
   */
  calculateSweepQuality(sweep, atr) {
    let quality = 0;

    // 速率评分 (0-40分)
    const speedRatio = sweep.speed / sweep.threshold;
    quality += Math.min(speedRatio * 20, 40);

    // 收回速度评分 (0-30分) - 越快收回质量越高
    const returnSpeedScore = Math.max(30 - sweep.barsToReturn * 10, 0);
    quality += returnSpeedScore;

    // 刺破幅度评分 (0-30分)
    const exceedRatio = sweep.exceedAmount / atr;
    quality += Math.min(exceedRatio * 15, 30);

    return Math.min(quality, 100);
  }

  /**
   * 检测流动性扫荡模式
   */
  detectLiquiditySweepPattern(candles, swingPoint, atr) {
    // 寻找流动性聚集区域
    const liquidityZones = this.identifyLiquidityZones(candles, swingPoint);
    
    // 检查是否有效扫荡了流动性
    const sweepEffectiveness = this.calculateSweepEffectiveness(liquidityZones, swingPoint, atr);
    
    return {
      liquidityZones,
      sweepEffectiveness,
      isEffectiveSweep: sweepEffectiveness.score > 0.7
    };
  }

  /**
   * 识别流动性聚集区域
   */
  identifyLiquidityZones(candles, swingPoint) {
    const zones = [];
    
    // 寻找价格多次测试的区域
    const priceRanges = this.groupPricesByRange(candles, 0.002); // 0.2%价格范围
    
    for (const range of priceRanges) {
      if (range.testCount >= 3) { // 至少3次测试
        zones.push({
          level: range.averagePrice,
          testCount: range.testCount,
          totalVolume: range.totalVolume,
          strength: range.testCount * range.totalVolume
        });
      }
    }
    
    return zones.sort((a, b) => b.strength - a.strength);
  }

  /**
   * 按价格范围分组
   */
  groupPricesByRange(candles, rangePercent) {
    const priceRanges = new Map();
    
    for (const candle of candles) {
      const priceKey = Math.floor(candle.close / (candle.close * rangePercent)) * (candle.close * rangePercent);
      
      if (!priceRanges.has(priceKey)) {
        priceRanges.set(priceKey, {
          averagePrice: priceKey,
          testCount: 0,
          totalVolume: 0,
          prices: []
        });
      }
      
      const range = priceRanges.get(priceKey);
      range.testCount++;
      range.totalVolume += candle.volume;
      range.prices.push(candle.close);
    }
    
    return Array.from(priceRanges.values());
  }

  /**
   * 计算Sweep有效性
   */
  calculateSweepEffectiveness(liquidityZones, swingPoint, atr) {
    let score = 0;
    let sweptLiquidity = 0;
    
    // 检查有多少流动性被扫荡
    for (const zone of liquidityZones) {
      const distanceToSwing = Math.abs(zone.level - swingPoint.level);
      
      if (distanceToSwing < atr * 0.5) { // 在ATR的0.5倍范围内
        sweptLiquidity += zone.strength;
        score += 0.2;
      }
    }
    
    return {
      score: Math.min(score, 1.0),
      sweptLiquidity,
      totalLiquidity: liquidityZones.reduce((sum, zone) => sum + zone.strength, 0),
      effectiveness: sweptLiquidity / Math.max(liquidityZones.reduce((sum, zone) => sum + zone.strength, 0), 1)
    };
  }

  /**
   * 验证Sweep模式 - 综合验证
   */
  validateSweepPattern(sweepHTF, sweepLTF, mtfStructure) {
    const validation = {
      valid: false,
      score: 0,
      reasons: []
    };

    // 1. 检查HTF和LTF Sweep一致性
    if (sweepHTF.detected && sweepLTF.detected) {
      if (sweepHTF.direction === sweepLTF.direction) {
        validation.score += 0.4;
        validation.reasons.push('HTF和LTF Sweep方向一致');
      } else {
        validation.reasons.push('HTF和LTF Sweep方向不一致');
      }
    }

    // 2. 检查Sweep与OB/FVG的配合
    if (mtfStructure.bestOB && sweepHTF.detected) {
      const obSweepAlignment = this.checkOBSweepAlignment(mtfStructure.bestOB, sweepHTF);
      if (obSweepAlignment.aligned) {
        validation.score += 0.3;
        validation.reasons.push('Sweep与OB配合良好');
      }
    }

    // 3. 检查Sweep质量
    if (sweepHTF.quality > 70) {
      validation.score += 0.2;
      validation.reasons.push('HTF Sweep质量高');
    }

    if (sweepLTF.quality > 70) {
      validation.score += 0.1;
      validation.reasons.push('LTF Sweep质量高');
    }

    validation.valid = validation.score >= 0.6; // 60%以上认为有效

    return validation;
  }

  /**
   * 检查OB与Sweep的配合
   */
  checkOBSweepAlignment(ob, sweep) {
    // 检查Sweep是否发生在OB附近
    const distanceToOB = Math.abs(sweep.swingLevel - ((ob.high + ob.low) / 2));
    const obSize = ob.high - ob.low;
    
    // 如果Sweep发生在OB范围的2倍以内，认为配合良好
    const aligned = distanceToOB < obSize * 2;
    
    return {
      aligned,
      distance: distanceToOB,
      obSize,
      alignmentRatio: distanceToOB / obSize
    };
  }

  /**
   * 获取Sweep检测统计信息
   */
  getSweepDetectionStats() {
    return {
      htfConfig: this.config.htf,
      ltfConfig: this.config.ltf,
      lastUpdate: new Date().toISOString()
    };
  }
}

module.exports = ICTSweepDetector;
