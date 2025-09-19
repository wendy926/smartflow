// ICTStructureAnalyzer.js - ICT策略结构分析器
// 严格按照ict.md文档实现Order Block和Fair Value Gap检测

/**
 * ICT结构分析器
 * 
 * 按照ict.md文档实现:
 * 1. Order Block检测:
 *    - 强劲价格移动 + 低成交量暂停 + 价格拒绝
 *    - 过滤条件: 高度≥0.25×ATR(4H), 年龄≤30天
 * 
 * 2. Fair Value Gap检测:
 *    - 三根K线形成价格缺口
 *    - 过滤条件: 缺口大小>0.5×ATR(4H), 中间K线放量
 */
class ICTStructureAnalyzer {
  constructor() {
    this.config = {
      // Order Block检测配置
      ob: {
        minMoveATRRatio: 2.0,         // 最小移动 = 2×ATR (强劲移动)
        maxVolumeRatio: 0.8,          // 最大成交量比例 (低成交量暂停)
        maxBodyRatio: 0.3,            // 最大实体比例 (价格拒绝)
        minHeightATRRatio: 0.25,      // 最小高度 = 0.25×ATR
        maxAgeDays: 30                // 最大年龄30天
      },
      
      // Fair Value Gap检测配置
      fvg: {
        minSizeATRRatio: 0.5,         // 最小大小 = 0.5×ATR
        minVolumeRatio: 1.5,          // 中间K线最小成交量比例
        maxAgeHours: 168              // 最大年龄7天(168小时)
      }
    };
  }

  /**
   * Order Block检测 - 严格按照ict.md文档实现
   * @param {Array} candles4h - 4H K线数据
   * @param {number} atr4h - 4H ATR值
   * @returns {Array} Order Block数组
   */
  async detectOrderBlocks(candles4h, atr4h) {
    try {
      const orderBlocks = [];
      
      // 需要至少20根K线进行分析
      if (candles4h.length < 20) {
        throw new Error('4H K线数据不足，需要至少20根');
      }

      // 计算平均成交量
      const volumes = candles4h.map(c => c.volume);
      const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;

      // 从第10根开始，到倒数第5根结束 (保留边界)
      for (let i = 10; i < candles4h.length - 5; i++) {
        const currentCandle = candles4h[i];
        const prevCandle = candles4h[i - 1];
        const nextCandle = candles4h[i + 1];

        // 1. 检查强劲价格移动 - 按ict.md文档要求
        const priceMove = Math.abs(nextCandle.close - currentCandle.close);
        const moveRatio = priceMove / currentCandle.close;
        const minMoveSize = this.config.ob.minMoveATRRatio * atr4h;
        
        if (priceMove < minMoveSize) continue;

        // 2. 检查低成交量暂停 - 按ict.md文档要求
        if (currentCandle.volume >= avgVolume * this.config.ob.maxVolumeRatio) continue;

        // 3. 检查价格拒绝 - 按ict.md文档要求
        const bodySize = Math.abs(currentCandle.close - currentCandle.open);
        const totalSize = currentCandle.high - currentCandle.low;
        const bodyRatio = totalSize > 0 ? bodySize / totalSize : 0;
        
        if (bodyRatio >= this.config.ob.maxBodyRatio) continue;

        // 确定OB类型
        const obType = nextCandle.close > currentCandle.close ? 'bullish' : 'bearish';
        
        // 创建Order Block
        const orderBlock = {
          timestamp: currentCandle.timestamp,
          high: Math.max(prevCandle.high, currentCandle.high),
          low: Math.min(prevCandle.low, currentCandle.low),
          type: obType,
          
          // 质量指标
          height: Math.max(prevCandle.high, currentCandle.high) - Math.min(prevCandle.low, currentCandle.low),
          volume: currentCandle.volume,
          averageVolume: avgVolume,
          volumeRatio: currentCandle.volume / avgVolume,
          
          // 移动数据
          priceMove,
          moveRatio,
          moveDirection: nextCandle.close > currentCandle.close ? 'up' : 'down',
          
          // 拒绝数据
          bodySize,
          totalSize,
          bodyRatio,
          wickSize: totalSize - bodySize,
          
          // 索引信息
          candleIndex: i,
          formationCandles: [prevCandle, currentCandle, nextCandle]
        };

        orderBlocks.push(orderBlock);
      }

      console.log(`📦 检测到 ${orderBlocks.length} 个Order Block候选 [4H]`);
      return orderBlocks;

    } catch (error) {
      console.error('Order Block检测失败:', error);
      return [];
    }
  }

  /**
   * Fair Value Gap检测 - 严格按照ict.md文档实现
   * @param {Array} candles4h - 4H K线数据  
   * @param {number} atr4h - 4H ATR值
   * @returns {Array} Fair Value Gap数组
   */
  async detectFairValueGaps(candles4h, atr4h) {
    try {
      const fairValueGaps = [];
      
      if (candles4h.length < 10) {
        throw new Error('4H K线数据不足，需要至少10根');
      }

      // 计算平均成交量
      const volumes = candles4h.map(c => c.volume);
      const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;

      // 从第5根开始，到倒数第5根结束
      for (let i = 5; i < candles4h.length - 5; i++) {
        const candle1 = candles4h[i - 1]; // 第一根K线
        const candle2 = candles4h[i];     // 中间K线
        const candle3 = candles4h[i + 1]; // 第三根K线

        // 检测看涨FVG: candle1.high < candle3.low
        if (candle1.high < candle3.low) {
          const gap = candle3.low - candle1.high;
          
          // 按ict.md文档要求: 缺口大小 > 0.5×ATR(4H)
          if (gap > this.config.fvg.minSizeATRRatio * atr4h) {
            
            // 检查中间K线成交量 - 按ict.md文档要求: 中间K线放量
            if (candle2.volume > avgVolume * this.config.fvg.minVolumeRatio) {
              
              const fvg = {
                timestamp: candle2.timestamp,
                high: candle3.low,
                low: candle1.high,
                type: 'bullish',
                size: gap,
                
                // 形成数据
                candle1,
                candle2,
                candle3,
                middleVolume: candle2.volume,
                averageVolume: avgVolume,
                volumeRatio: candle2.volume / avgVolume,
                
                // 质量指标
                sizeATRRatio: gap / atr4h,
                gapPercentage: (gap / candle2.close) * 100,
                
                // 填充状态 (初始为0)
                fillPercentage: 0,
                fillLevel: 0,
                
                candleIndex: i
              };
              
              fairValueGaps.push(fvg);
            }
          }
        }

        // 检测看跌FVG: candle1.low > candle3.high
        if (candle1.low > candle3.high) {
          const gap = candle1.low - candle3.high;
          
          if (gap > this.config.fvg.minSizeATRRatio * atr4h) {
            if (candle2.volume > avgVolume * this.config.fvg.minVolumeRatio) {
              
              const fvg = {
                timestamp: candle2.timestamp,
                high: candle1.low,
                low: candle3.high,
                type: 'bearish',
                size: gap,
                
                candle1,
                candle2,
                candle3,
                middleVolume: candle2.volume,
                averageVolume: avgVolume,
                volumeRatio: candle2.volume / avgVolume,
                
                sizeATRRatio: gap / atr4h,
                gapPercentage: (gap / candle2.close) * 100,
                
                fillPercentage: 0,
                fillLevel: 0,
                
                candleIndex: i
              };
              
              fairValueGaps.push(fvg);
            }
          }
        }
      }

      // 计算FVG填充状态
      this.calculateFVGFillStatus(fairValueGaps, candles4h);

      console.log(`🔄 检测到 ${fairValueGaps.length} 个Fair Value Gap候选 [4H]`);
      return fairValueGaps;

    } catch (error) {
      console.error('Fair Value Gap检测失败:', error);
      return [];
    }
  }

  /**
   * 计算FVG填充状态
   */
  calculateFVGFillStatus(fvgs, candles4h) {
    for (const fvg of fvgs) {
      // 找到FVG形成后的所有K线
      const afterFVGCandles = candles4h.slice(fvg.candleIndex + 2);
      
      let maxFillLevel = 0;
      
      for (const candle of afterFVGCandles) {
        if (fvg.type === 'bullish') {
          // 看涨FVG: 检查价格向下填充
          if (candle.low <= fvg.high) {
            const fillLevel = Math.max(0, fvg.high - Math.max(candle.low, fvg.low));
            maxFillLevel = Math.max(maxFillLevel, fillLevel);
          }
        } else {
          // 看跌FVG: 检查价格向上填充
          if (candle.high >= fvg.low) {
            const fillLevel = Math.max(0, Math.min(candle.high, fvg.high) - fvg.low);
            maxFillLevel = Math.max(maxFillLevel, fillLevel);
          }
        }
      }
      
      fvg.fillLevel = maxFillLevel;
      fvg.fillPercentage = (maxFillLevel / fvg.size) * 100;
    }
  }

  /**
   * 验证Order Block质量
   */
  validateOrderBlockQuality(ob, atr4h) {
    const validation = {
      valid: false,
      score: 0,
      reasons: []
    };

    // 1. 高度验证
    if (ob.height >= this.config.ob.minHeightATRRatio * atr4h) {
      validation.score += 0.3;
      validation.reasons.push('高度满足要求');
    } else {
      validation.reasons.push(`高度不足: ${ob.height.toFixed(4)} < ${(this.config.ob.minHeightATRRatio * atr4h).toFixed(4)}`);
    }

    // 2. 年龄验证
    const ageInDays = (Date.now() - ob.timestamp) / (24 * 60 * 60 * 1000);
    if (ageInDays <= this.config.ob.maxAgeDays) {
      validation.score += 0.3;
      validation.reasons.push('年龄符合要求');
    } else {
      validation.reasons.push(`年龄过大: ${ageInDays.toFixed(1)}天 > ${this.config.ob.maxAgeDays}天`);
    }

    // 3. 成交量验证
    if (ob.volumeRatio <= this.config.ob.maxVolumeRatio) {
      validation.score += 0.2;
      validation.reasons.push('成交量暂停确认');
    } else {
      validation.reasons.push(`成交量过高: ${ob.volumeRatio.toFixed(2)} > ${this.config.ob.maxVolumeRatio}`);
    }

    // 4. 价格拒绝验证
    if (ob.bodyRatio <= this.config.ob.maxBodyRatio) {
      validation.score += 0.2;
      validation.reasons.push('价格拒绝确认');
    } else {
      validation.reasons.push(`实体比例过大: ${ob.bodyRatio.toFixed(2)} > ${this.config.ob.maxBodyRatio}`);
    }

    validation.valid = validation.score >= 0.6; // 60%以上认为有效

    return validation;
  }

  /**
   * 验证Fair Value Gap质量
   */
  validateFVGQuality(fvg, atr4h) {
    const validation = {
      valid: false,
      score: 0,
      reasons: []
    };

    // 1. 大小验证
    if (fvg.size > this.config.fvg.minSizeATRRatio * atr4h) {
      validation.score += 0.4;
      validation.reasons.push('缺口大小满足要求');
    } else {
      validation.reasons.push(`缺口过小: ${fvg.size.toFixed(4)} < ${(this.config.fvg.minSizeATRRatio * atr4h).toFixed(4)}`);
    }

    // 2. 年龄验证
    const ageInHours = (Date.now() - fvg.timestamp) / (60 * 60 * 1000);
    if (ageInHours <= this.config.fvg.maxAgeHours) {
      validation.score += 0.2;
      validation.reasons.push('年龄符合要求');
    } else {
      validation.reasons.push(`年龄过大: ${ageInHours.toFixed(1)}小时 > ${this.config.fvg.maxAgeHours}小时`);
    }

    // 3. 中间K线成交量验证
    if (fvg.volumeRatio >= this.config.fvg.minVolumeRatio) {
      validation.score += 0.2;
      validation.reasons.push('中间K线放量确认');
    } else {
      validation.reasons.push(`中间K线成交量不足: ${fvg.volumeRatio.toFixed(2)} < ${this.config.fvg.minVolumeRatio}`);
    }

    // 4. 填充状态验证 (未填充的FVG质量更高)
    if (fvg.fillPercentage < 50) {
      validation.score += 0.2;
      validation.reasons.push('FVG未被大幅填充');
    } else {
      validation.reasons.push(`FVG已被大幅填充: ${fvg.fillPercentage.toFixed(1)}%`);
    }

    validation.valid = validation.score >= 0.6;

    return validation;
  }

  /**
   * 检测OB形成模式
   */
  detectOBFormationPattern(candles, startIndex) {
    // 分析OB形成前后的价格行为
    const beforeCandles = candles.slice(Math.max(0, startIndex - 5), startIndex);
    const formationCandles = candles.slice(startIndex, startIndex + 3);
    const afterCandles = candles.slice(startIndex + 3, Math.min(candles.length, startIndex + 8));

    // 检测形成模式
    const patterns = {
      accumulation: this.detectAccumulationPattern(beforeCandles, formationCandles),
      distribution: this.detectDistributionPattern(beforeCandles, formationCandles),
      reversal: this.detectReversalPattern(beforeCandles, formationCandles, afterCandles)
    };

    return patterns;
  }

  /**
   * 检测吸筹模式
   */
  detectAccumulationPattern(beforeCandles, formationCandles) {
    if (beforeCandles.length < 3 || formationCandles.length < 2) {
      return { detected: false, reason: '数据不足' };
    }

    // 检查是否有价格下跌 + 成交量减少的模式
    const priceDecline = beforeCandles.every((candle, i) => 
      i === 0 || candle.close <= beforeCandles[i - 1].close
    );
    
    const volumeDecrease = beforeCandles.every((candle, i) =>
      i === 0 || candle.volume <= beforeCandles[i - 1].volume * 1.1
    );

    const detected = priceDecline && volumeDecrease;

    return {
      detected,
      priceDecline,
      volumeDecrease,
      confidence: detected ? 0.8 : 0.3
    };
  }

  /**
   * 检测派发模式
   */
  detectDistributionPattern(beforeCandles, formationCandles) {
    if (beforeCandles.length < 3 || formationCandles.length < 2) {
      return { detected: false, reason: '数据不足' };
    }

    // 检查是否有价格上涨 + 成交量减少的模式
    const priceRise = beforeCandles.every((candle, i) => 
      i === 0 || candle.close >= beforeCandles[i - 1].close
    );
    
    const volumeDecrease = beforeCandles.every((candle, i) =>
      i === 0 || candle.volume <= beforeCandles[i - 1].volume * 1.1
    );

    const detected = priceRise && volumeDecrease;

    return {
      detected,
      priceRise,
      volumeDecrease,
      confidence: detected ? 0.8 : 0.3
    };
  }

  /**
   * 检测反转模式
   */
  detectReversalPattern(beforeCandles, formationCandles, afterCandles) {
    if (beforeCandles.length < 2 || formationCandles.length < 2 || afterCandles.length < 2) {
      return { detected: false, reason: '数据不足' };
    }

    // 检查价格方向是否发生反转
    const beforeTrend = this.calculateTrendDirection(beforeCandles);
    const afterTrend = this.calculateTrendDirection(afterCandles);
    
    const detected = beforeTrend !== 'sideways' && afterTrend !== 'sideways' && beforeTrend !== afterTrend;

    return {
      detected,
      beforeTrend,
      afterTrend,
      confidence: detected ? 0.9 : 0.2
    };
  }

  /**
   * 计算趋势方向
   */
  calculateTrendDirection(candles) {
    if (candles.length < 2) return 'sideways';
    
    const first = candles[0].close;
    const last = candles[candles.length - 1].close;
    const change = (last - first) / first;
    
    if (change > 0.01) return 'up';      // 1%以上上涨
    if (change < -0.01) return 'down';   // 1%以上下跌
    return 'sideways';
  }

  /**
   * 计算结构强度评分
   */
  calculateStructureStrength(ob, fvg) {
    let strength = 0;

    // OB强度贡献
    if (ob) {
      // 高度贡献 (0-30分)
      strength += Math.min(ob.height * 1000, 30);
      
      // 年龄贡献 (0-20分) - 越新鲜越强
      const ageInDays = (Date.now() - ob.timestamp) / (24 * 60 * 60 * 1000);
      strength += Math.max(20 - ageInDays, 0);
      
      // 成交量贡献 (0-20分)
      strength += Math.min((1 / ob.volumeRatio) * 10, 20);
    }

    // FVG强度贡献
    if (fvg) {
      // 大小贡献 (0-20分)
      strength += Math.min(fvg.size * 1000, 20);
      
      // 填充状态贡献 (0-10分) - 未填充更强
      strength += Math.max(10 - fvg.fillPercentage / 10, 0);
    }

    return Math.min(strength, 100);
  }

  /**
   * 分析结构重叠 (OB与FVG重叠)
   */
  analyzeStructureOverlap(obs, fvgs) {
    const overlaps = [];

    for (const ob of obs) {
      for (const fvg of fvgs) {
        // 检查价格区间是否重叠
        const overlap = this.calculatePriceRangeOverlap(
          { high: ob.high, low: ob.low },
          { high: fvg.high, low: fvg.low }
        );

        if (overlap.percentage > 0.3) { // 30%以上重叠
          overlaps.push({
            ob,
            fvg,
            overlap,
            combinedStrength: this.calculateStructureStrength(ob, fvg),
            type: 'ob_fvg_overlap'
          });
        }
      }
    }

    return overlaps.sort((a, b) => b.combinedStrength - a.combinedStrength);
  }

  /**
   * 计算价格区间重叠
   */
  calculatePriceRangeOverlap(range1, range2) {
    const overlapHigh = Math.min(range1.high, range2.high);
    const overlapLow = Math.max(range1.low, range2.low);
    
    if (overlapHigh <= overlapLow) {
      return { percentage: 0, size: 0 };
    }

    const overlapSize = overlapHigh - overlapLow;
    const range1Size = range1.high - range1.low;
    const range2Size = range2.high - range2.low;
    const avgRangeSize = (range1Size + range2Size) / 2;
    
    return {
      percentage: (overlapSize / avgRangeSize) * 100,
      size: overlapSize,
      high: overlapHigh,
      low: overlapLow
    };
  }

  /**
   * 获取结构分析统计
   */
  getStructureAnalysisStats() {
    return {
      obConfig: this.config.ob,
      fvgConfig: this.config.fvg,
      lastUpdate: new Date().toISOString()
    };
  }
}

module.exports = ICTStructureAnalyzer;
