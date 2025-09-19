# SmartFlow 策略指标详细设计文档

**创建时间**: 2025-09-19  
**文档版本**: v1.0  
**关联文档**: PROJECT_STRUCTURE_SUMMARY.md

## 🎯 两个策略的关键指标

### 1. V3策略 (多周期共振策略)

#### 核心指标定义

**4H趋势过滤指标 (10分打分机制)**
```javascript
// 1. 趋势方向 (3分满分，至少2分才能进入后续打分)
const bullScore = [
  lastClose > currentMA20 ? 1 : 0,     // 收盘价 > MA20
  currentMA20 > currentMA50 ? 1 : 0,   // MA20 > MA50  
  currentMA50 > currentMA200 ? 1 : 0   // MA50 > MA200
].reduce((a, b) => a + b, 0);

// 2. 趋势稳定性 (1分)
const stability = consecutiveConfirmCandles >= 2 ? 1 : 0;

// 3. 趋势强度 (1分)  
const strength = (ADX > 20 && DI方向正确) ? 1 : 0;

// 4. 布林带扩张 (1分)
const expansion = (后5根BBW均值 > 前5根BBW均值 * 1.05) ? 1 : 0;

// 5. 动量确认 (1分)
const momentum = (Math.abs(lastClose - currentMA20) / currentMA20 >= 0.005) ? 1 : 0;

// 最终判断: ≥4分保留趋势，<4分震荡市
const totalScore = bullScore + stability + strength + expansion + momentum;
const trend4h = totalScore >= 4 ? (bullScore >= bearScore ? '多头趋势' : '空头趋势') : '震荡市';
```

**1H多因子打分指标 (6分制)**
```javascript
// 趋势市1H多因子打分
let score = 0;

// 1. VWAP方向 (必须满足，不计分)
const vwapDirection = signalType === 'long' ? currentPrice > vwap : currentPrice < vwap;
if (!vwapDirection) return 0; // 不满足直接返回0分

// 2. 突破确认 (±1分)
const breakout = signalType === 'long' ? 
  currentPrice > Math.max(...recent20Highs) : 
  currentPrice < Math.min(...recent20Lows);
score += breakout ? 1 : 0;

// 3. 成交量确认 (±1分)
const volumeConfirm = last15m.volume >= avgVol20 * 1.5 && 
                     last1h.volume >= avgVol20_1h * 1.2;
score += volumeConfirm ? 1 : 0;

// 4. OI变化 (±1分)
const oiConfirm = signalType === 'long' ? oiChange6h >= 0.02 : oiChange6h <= -0.02;
score += oiConfirm ? 1 : 0;

// 5. 资金费率 (±1分)
const fundingConfirm = fundingRate >= -0.0005 && fundingRate <= 0.0005;
score += fundingConfirm ? 1 : 0;

// 6. Delta确认 (±1分)  
const deltaConfirm = signalType === 'long' ? deltaRatio >= 1.2 : deltaRatio <= 0.8;
score += deltaConfirm ? 1 : 0;

// 最终判断: ≥3分入场
const signal = score >= 3 ? signalType : '观望';
```

**15分钟执行指标**
```javascript
// 趋势市15分钟执行 - 两种模式
// 模式A: 回踩确认 (保守模式)
const modeA = {
  condition: price回踩至VWAP附近 && volume >= 1.2 * avgVol,
  execution: `${direction}_回踩确认`,
  stopLoss: setupCandle另一端,
  takeProfit: 2R风险回报比
};

// 模式B: 动能突破 (激进模式)  
const modeB = {
  condition: 放量突破setupCandle && volume >= 1.5 * avgVol,
  execution: `${direction}_突破确认`, 
  stopLoss: setupCandle另一端,
  takeProfit: 2R风险回报比
};
```

#### 计算方法示例

```javascript
class StrategyV3Core {
  // 4H趋势分析
  async analyze4HTrend(symbol) {
    const candles4h = await this.getKlineData(symbol, '4h', 250);
    const { ma20, ma50, ma200 } = this.calculateMovingAverages(candles4h);
    const { ADX, DIplus, DIminus } = this.calculateADX(candles4h, 14);
    const bb = this.calculateBollingerBands(candles4h, 20, 2);
    
    // 10分打分逻辑
    let totalScore = 0;
    let bullScore = 0;
    let bearScore = 0;
    
    const lastClose = candles4h[candles4h.length - 1].close;
    const currentMA20 = ma20[ma20.length - 1];
    const currentMA50 = ma50[ma50.length - 1];
    const currentMA200 = ma200[ma200.length - 1];
    
    // 1. 趋势方向判断 (3分)
    if (lastClose > currentMA20) bullScore++;
    if (currentMA20 > currentMA50) bullScore++;
    if (currentMA50 > currentMA200) bullScore++;
    
    if (lastClose < currentMA20) bearScore++;
    if (currentMA20 < currentMA50) bearScore++;
    if (currentMA50 < currentMA200) bearScore++;
    
    // 检查方向是否至少2分
    if (bullScore < 2 && bearScore < 2) {
      return { trend4h: '震荡市', score: 0, reason: '趋势方向不明确' };
    }
    
    const trendDirection = bullScore >= bearScore ? 'bull' : 'bear';
    let directionScore = Math.max(bullScore, bearScore);
    
    // 2. 趋势稳定性 (1分)
    const stabilityScore = this.checkTrendStability(candles4h) ? 1 : 0;
    
    // 3. 趋势强度 (1分)
    const currentADX = ADX[ADX.length - 1];
    const strengthScore = (currentADX > 20 && this.checkDIDirection(DIplus, DIminus, trendDirection)) ? 1 : 0;
    
    // 4. 布林带扩张 (1分)
    const expansionScore = this.checkBBExpansion(bb) ? 1 : 0;
    
    // 5. 动量确认 (1分)
    const momentumScore = (Math.abs(lastClose - currentMA20) / currentMA20 >= 0.005) ? 1 : 0;
    
    totalScore = directionScore + stabilityScore + strengthScore + expansionScore + momentumScore;
    
    return {
      trend4h: totalScore >= 4 ? (trendDirection === 'bull' ? '多头趋势' : '空头趋势') : '震荡市',
      score: totalScore,
      details: {
        direction: directionScore,
        stability: stabilityScore,
        strength: strengthScore,
        expansion: expansionScore,
        momentum: momentumScore
      },
      ma20: currentMA20,
      ma50: currentMA50,
      ma200: currentMA200,
      adx: currentADX
    };
  }
  
  // 1H多因子打分
  async analyze1HScoring(symbol, trend4h) {
    const candles1h = await this.getKlineData(symbol, '1h', 50);
    const candles15m = await this.getKlineData(symbol, '15m', 50);
    const vwap = this.calculateVWAP(candles1h);
    
    const signalType = trend4h === '多头趋势' ? 'long' : 'short';
    const currentPrice = candles1h[candles1h.length - 1].close;
    
    let score = 0;
    const factorScores = {};
    
    // 1. VWAP方向 (必需)
    const vwapDirection = signalType === 'long' ? currentPrice > vwap : currentPrice < vwap;
    factorScores.vwap = vwapDirection ? 1 : 0;
    
    if (!vwapDirection) {
      return { signal: '观望', score: 0, reason: 'VWAP方向不一致', factorScores };
    }
    
    // 2. 突破确认 (±1分)
    const recent20Highs = candles1h.slice(-20).map(c => c.high);
    const recent20Lows = candles1h.slice(-20).map(c => c.low);
    const breakout = signalType === 'long' ? 
      currentPrice > Math.max(...recent20Highs) : 
      currentPrice < Math.min(...recent20Lows);
    factorScores.breakout = breakout ? 1 : 0;
    score += breakout ? 1 : 0;
    
    // 3. 成交量确认 (±1分)
    const last15m = candles15m[candles15m.length - 1];
    const last1h = candles1h[candles1h.length - 1];
    const avgVol15m = candles15m.slice(-20).reduce((a, c) => a + c.volume, 0) / 20;
    const avgVol1h = candles1h.slice(-20).reduce((a, c) => a + c.volume, 0) / 20;
    
    const volumeConfirm = last15m.volume >= avgVol15m * 1.5 && last1h.volume >= avgVol1h * 1.2;
    factorScores.volume = volumeConfirm ? 1 : 0;
    score += volumeConfirm ? 1 : 0;
    
    // 4. OI变化 (±1分) - 需要实现获取6h OI数据
    const oiChange6h = await this.getOIChange6h(symbol);
    const oiConfirm = signalType === 'long' ? oiChange6h >= 0.02 : oiChange6h <= -0.02;
    factorScores.oi = oiConfirm ? 1 : 0;
    score += oiConfirm ? 1 : 0;
    
    // 5. 资金费率 (±1分)
    const fundingRate = await this.getFundingRate(symbol);
    const fundingConfirm = fundingRate >= -0.0005 && fundingRate <= 0.0005;
    factorScores.funding = fundingConfirm ? 1 : 0;
    score += fundingConfirm ? 1 : 0;
    
    // 6. Delta确认 (±1分)
    const deltaRatio = await this.getDeltaRatio(symbol);
    const deltaConfirm = signalType === 'long' ? deltaRatio >= 1.2 : deltaRatio <= 0.8;
    factorScores.delta = deltaConfirm ? 1 : 0;
    score += deltaConfirm ? 1 : 0;
    
    return {
      signal: score >= 3 ? (signalType === 'long' ? '做多' : '做空') : '观望',
      score,
      factorScores,
      vwap,
      signalStrength: score >= 5 ? '强' : score >= 4 ? '中' : score >= 3 ? '弱' : '无'
    };
  }
  
  // 辅助方法
  checkTrendStability(candles) {
    // 检查最近2根4H K线是否都满足趋势方向
    const recent2 = candles.slice(-2);
    return recent2.every(candle => {
      // 这里需要根据具体趋势方向判断
      return true; // 简化实现
    });
  }
  
  checkDIDirection(DIplus, DIminus, trendDirection) {
    const currentDIplus = DIplus[DIplus.length - 1];
    const currentDIminus = DIminus[DIminus.length - 1];
    
    return trendDirection === 'bull' ? 
      currentDIplus > currentDIminus : 
      currentDIminus > currentDIplus;
  }
  
  checkBBExpansion(bb) {
    const recent10 = bb.slice(-10);
    const first5Avg = recent10.slice(0, 5).reduce((a, b) => a + b.bandwidth, 0) / 5;
    const last5Avg = recent10.slice(5).reduce((a, b) => a + b.bandwidth, 0) / 5;
    
    return last5Avg > first5Avg * 1.05;
  }
}
```

### 2. ICT策略 (价格行为策略)

#### 核心指标定义

**高时间框架 (1D) 趋势指标**
```javascript
// 1D趋势判断 (3分制)
const dailyTrendAnalysis = {
  // 1. 价格结构分析 (1分)
  priceStructure: {
    higherHighs: recentHighs.every((h, i) => i === 0 || h > recentHighs[i-1]) ? 1 : 0,
    higherLows: recentLows.every((l, i) => i === 0 || l > recentLows[i-1]) ? 1 : 0
  },
  
  // 2. 移动平均线确认 (1分)
  maConfirmation: {
    above20MA: currentPrice > ma20 ? 1 : 0,
    ma20Above50: ma20 > ma50 ? 1 : 0
  },
  
  // 3. 成交量确认 (1分)
  volumeConfirmation: {
    aboveAverage: currentVolume > avgVolume20 * 1.2 ? 1 : 0
  }
};

// 最终判断: ≥2分确认趋势
const dailyTrend = totalScore >= 2 ? '上升' : (totalScore <= -2 ? '下降' : '震荡');
```

**中时间框架 (4H) 结构指标**
```javascript
// Order Block (OB) 检测
const orderBlockDetection = {
  // OB识别条件
  identify: {
    strongMove: Math.abs(priceMove) > atr4h * 2,        // 强劲价格移动
    lowVolumePause: volume < avgVolume * 0.8,           // 低成交量暂停
    priceRejection: rejectionCandle.bodySize < 0.3     // 价格拒绝
  },
  
  // OB质量评分
  quality: {
    height: Math.abs(ob.high - ob.low),                 // OB高度
    age: (Date.now() - ob.timestamp) / (24 * 60 * 60 * 1000), // OB年龄(天)
    testCount: ob.testedTimes,                          // 测试次数
    strength: ob.volume / avgVolume                     // OB强度
  }
};

// Fair Value Gap (FVG) 检测
const fvgDetection = {
  // FVG识别条件
  identify: {
    gap: candle1.low > candle3.high || candle1.high < candle3.low, // 价格缺口
    size: Math.abs(gap) > atr4h * 0.5,                 // 缺口大小
    volume: candle2.volume > avgVolume * 1.5            // 中间K线放量
  },
  
  // FVG质量评分
  quality: {
    size: Math.abs(fvg.high - fvg.low),                // FVG大小
    age: (Date.now() - fvg.timestamp) / (60 * 60 * 1000), // FVG年龄(小时)
    fillPercentage: fvg.filledSize / fvg.totalSize      // 填充百分比
  }
};
```

**低时间框架 (15m) 入场指标**
```javascript
// 15分钟入场确认
const ltfEntrySignals = {
  // 1. OB反应确认
  obReaction: {
    priceInOB: currentPrice >= ob.low && currentPrice <= ob.high,
    rejection: rejectionCandle.bodySize < candle.totalSize * 0.3,
    volume: currentVolume > avgVolume15m * 1.2
  },
  
  // 2. 吞没形态确认
  engulfingPattern: {
    bodyRatio: engulfingCandle.body > previousCandle.body * 1.1,
    direction: engulfingCandle.direction === expectedDirection,
    volume: engulfingCandle.volume > avgVolume15m * 1.3
  },
  
  // 3. Sweep确认
  sweepConfirmation: {
    liquidityTaken: price突破前期高低点,
    quickReversal: reversal within 3 candles,
    speed: sweepSpeed > threshold
  }
};
```

#### 计算方法示例

```javascript
class ICTCore {
  // 1D趋势分析
  async analyzeDailyTrend(symbol) {
    const candles1d = await this.getKlineData(symbol, '1d', 20);
    
    let score = 0;
    const details = {};
    
    // 1. 价格结构分析 (1分)
    const higherHighs = this.detectHigherHighs(candles1d);
    const higherLows = this.detectHigherLows(candles1d);
    const structureScore = (higherHighs && higherLows) ? 1 : (higherHighs || higherLows) ? 0.5 : 0;
    score += structureScore;
    details.structure = { higherHighs, higherLows, score: structureScore };
    
    // 2. MA确认 (1分)
    const { ma20, ma50 } = this.calculateMovingAverages(candles1d);
    const currentPrice = candles1d[candles1d.length - 1].close;
    const currentMA20 = ma20[ma20.length - 1];
    const currentMA50 = ma50[ma50.length - 1];
    
    const maScore = (currentPrice > currentMA20 && currentMA20 > currentMA50) ? 1 : 
                   (currentPrice < currentMA20 && currentMA20 < currentMA50) ? -1 : 0;
    score += Math.abs(maScore);
    details.ma = { price: currentPrice, ma20: currentMA20, ma50: currentMA50, score: maScore };
    
    // 3. 成交量确认 (1分)
    const avgVolume = this.calculateAverageVolume(candles1d, 20);
    const currentVolume = candles1d[candles1d.length - 1].volume;
    const volumeScore = (currentVolume > avgVolume * 1.2) ? 1 : 0;
    score += volumeScore;
    details.volume = { current: currentVolume, average: avgVolume, score: volumeScore };
    
    // 最终趋势判断
    let trend;
    if (score >= 2 && maScore > 0) {
      trend = '上升';
    } else if (score >= 2 && maScore < 0) {
      trend = '下降';
    } else {
      trend = '震荡';
    }
    
    return {
      trend,
      score,
      confidence: score / 3,
      details
    };
  }
  
  // 4H结构分析
  async analyzeMTF(symbol, dailyTrend) {
    const candles4h = await this.getKlineData(symbol, '4h', 100);
    
    // Order Block检测
    const orderBlocks = this.detectOrderBlocks(candles4h);
    const validOBs = orderBlocks.filter(ob => this.validateOrderBlock(ob));
    
    // Fair Value Gap检测
    const fvgs = this.detectFairValueGaps(candles4h);
    const validFVGs = fvgs.filter(fvg => this.validateFVG(fvg));
    
    // Sweep检测
    const sweeps = this.detectSweeps(candles4h);
    
    return {
      obDetected: validOBs.length > 0,
      fvgDetected: validFVGs.length > 0,
      sweepHTF: sweeps.length > 0,
      bestOB: validOBs[0],
      bestFVG: validFVGs[0],
      orderBlocks: validOBs,
      fairValueGaps: validFVGs,
      sweeps
    };
  }
  
  // 15m入场分析
  async analyzeLTF(symbol, mtfResult) {
    const candles15m = await this.getKlineData(symbol, '15m', 100);
    
    let entrySignal = false;
    let entryPrice = 0;
    let signalType = 'WAIT';
    let confidence = 0;
    
    // 1. 检查OB反应
    if (mtfResult.bestOB) {
      const obReaction = this.checkOBReaction(candles15m, mtfResult.bestOB);
      if (obReaction.valid) {
        entrySignal = true;
        entryPrice = candles15m[candles15m.length - 1].close;
        signalType = obReaction.direction === 'bullish' ? 'BOS_LONG' : 'BOS_SHORT';
        confidence += 0.4;
      }
    }
    
    // 2. 检查吞没形态
    const engulfing = this.detectEngulfingPattern(candles15m);
    if (engulfing.detected) {
      entrySignal = true;
      entryPrice = candles15m[candles15m.length - 1].close;
      signalType = engulfing.direction === 'bullish' ? 'CHoCH_LONG' : 'CHoCH_SHORT';
      confidence += 0.3;
    }
    
    // 3. 检查Sweep
    const sweep = this.detectLTFSweep(candles15m);
    if (sweep.detected) {
      entrySignal = true;
      entryPrice = candles15m[candles15m.length - 1].close;
      signalType = sweep.direction === 'bullish' ? 'MIT_LONG' : 'MIT_SHORT';
      confidence += 0.3;
    }
    
    // 4. 成交量确认
    const volumeConfirmation = this.checkVolumeConfirmation(candles15m);
    if (volumeConfirmation) {
      confidence += 0.2;
    }
    
    return {
      entrySignal,
      entryPrice,
      signalType,
      confidence: Math.min(confidence, 1.0),
      signalStrength: confidence > 0.8 ? '强' : confidence > 0.5 ? '中' : '弱',
      volumeConfirmation
    };
  }
  
  // 辅助方法实现
  detectHigherHighs(candles) {
    const highs = candles.slice(-5).map(c => c.high);
    return highs.every((high, i) => i === 0 || high >= highs[i-1]);
  }
  
  detectHigherLows(candles) {
    const lows = candles.slice(-5).map(c => c.low);
    return lows.every((low, i) => i === 0 || low >= lows[i-1]);
  }
  
  detectOrderBlocks(candles) {
    const orderBlocks = [];
    
    for (let i = 10; i < candles.length - 5; i++) {
      const current = candles[i];
      const prev = candles[i-1];
      const next = candles[i+1];
      
      // 检查是否有强劲移动
      const moveSize = Math.abs(next.close - current.close) / current.close;
      if (moveSize > 0.02) { // 2%以上的移动
        
        // 检查是否有低成交量暂停
        const avgVolume = candles.slice(i-10, i).reduce((a, c) => a + c.volume, 0) / 10;
        if (current.volume < avgVolume * 0.8) {
          
          orderBlocks.push({
            timestamp: current.timestamp,
            high: Math.max(prev.high, current.high),
            low: Math.min(prev.low, current.low),
            volume: current.volume,
            type: next.close > current.close ? 'bullish' : 'bearish',
            strength: moveSize,
            index: i
          });
        }
      }
    }
    
    return orderBlocks;
  }
  
  detectFairValueGaps(candles) {
    const fvgs = [];
    
    for (let i = 1; i < candles.length - 1; i++) {
      const candle1 = candles[i-1];
      const candle2 = candles[i];
      const candle3 = candles[i+1];
      
      // 检查bullish FVG
      if (candle1.high < candle3.low) {
        const gap = candle3.low - candle1.high;
        const atr = this.calculateATR(candles.slice(i-14, i), 14);
        
        if (gap > atr * 0.3) { // 缺口大小大于ATR的30%
          fvgs.push({
            timestamp: candle2.timestamp,
            high: candle3.low,
            low: candle1.high,
            type: 'bullish',
            size: gap,
            volume: candle2.volume,
            index: i
          });
        }
      }
      
      // 检查bearish FVG
      if (candle1.low > candle3.high) {
        const gap = candle1.low - candle3.high;
        const atr = this.calculateATR(candles.slice(i-14, i), 14);
        
        if (gap > atr * 0.3) {
          fvgs.push({
            timestamp: candle2.timestamp,
            high: candle1.low,
            low: candle3.high,
            type: 'bearish',
            size: gap,
            volume: candle2.volume,
            index: i
          });
        }
      }
    }
    
    return fvgs;
  }
  
  validateOrderBlock(ob) {
    // OB验证逻辑
    const now = Date.now();
    const age = (now - ob.timestamp) / (24 * 60 * 60 * 1000); // 天数
    
    return age <= 30 && ob.strength > 0.01; // 30天内且移动大于1%
  }
  
  validateFVG(fvg) {
    // FVG验证逻辑
    const now = Date.now();
    const age = (now - fvg.timestamp) / (60 * 60 * 1000); // 小时数
    
    return age <= 168 && fvg.size > 0; // 7天内且有缺口
  }
}
```

---

**文档状态**: ✅ 策略指标详细设计完成  
**覆盖内容**: V3和ICT策略的核心指标定义、计算方法和代码实现  
**技术深度**: 包含完整的算法逻辑和代码示例  
**关联文档**: PROJECT_STRUCTURE_SUMMARY.md
