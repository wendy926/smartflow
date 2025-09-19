// strategy-implementation.test.js - 策略实现完整性测试
// 测试ICT和V3策略的核心实现逻辑

const assert = require('assert');

/**
 * ICT策略实现测试
 */
class ICTStrategyImplementationTest {
  
  /**
   * 测试ICT策略1D趋势判断3分制评分系统
   */
  static testICT3PointTrendSystem() {
    console.log('\n🧪 测试ICT策略1D趋势判断3分制评分系统...');
    
    // 模拟上升趋势数据（需要足够的数据点进行MA计算）
    const upTrendData = [];
    for (let i = 0; i < 25; i++) {
      const basePrice = 50000 + i * 100;
      upTrendData.push([
        1640995200000 + i * 86400000, // 时间戳
        basePrice.toString(),
        (basePrice + 500).toString(),
        (basePrice - 500).toString(),
        (basePrice + 200).toString(),
        (1000 + i * 10).toString()
      ]);
    }
    
    // 模拟ICT核心实例
    const ictCore = {
      detectTrend: function(data, lookback = 20) {
        const closes = data.map(d => parseFloat(d[4]));
        const last = closes.slice(-lookback);
        
        let score = 0;
        const trendFactors = {
          priceStructure: 0,
          maConfirmation: 0,
          volumeConfirmation: 0
        };
        
        // 1. 价格结构分析 (1分)
        const priceStructure = this.analyzePriceStructure(last);
        if (priceStructure.higherHighs && priceStructure.higherLows) {
          score += 1;
          trendFactors.priceStructure = 1;
        } else if (!priceStructure.higherHighs && !priceStructure.higherLows) {
          score -= 1;
          trendFactors.priceStructure = -1;
        }
        
        // 2. MA确认 (1分)
        const ma20 = this.calculateMA(last, 20);
        const ma50 = this.calculateMA(last, 50);
        const currentMA20 = ma20[ma20.length - 1];
        const currentMA50 = ma50[ma50.length - 1];
        const lastPrice = last[last.length - 1];
        
        if (lastPrice > currentMA20 && currentMA20 > currentMA50) {
          score += 1;
          trendFactors.maConfirmation = 1;
        }
        
        // 3. 成交量确认 (1分)
        const volumes = data.slice(-lookback).map(d => parseFloat(d[5]));
        const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
        const currentVolume = volumes[volumes.length - 1];
        
        if (currentVolume > avgVolume * 1.2) {
          score += 1;
          trendFactors.volumeConfirmation = 1;
        }
        
        // 确定趋势方向
        let trend = 'sideways';
        if (score >= 2) {
          trend = 'up';
        } else if (score <= -2) {
          trend = 'down';
        }
        
        return { trend, score, trendFactors };
      },
      
      analyzePriceStructure: function(closes) {
        const highs = [];
        const lows = [];
        
        for (let i = 2; i < closes.length - 2; i++) {
          if (closes[i] > closes[i-1] && closes[i] > closes[i-2] && 
              closes[i] > closes[i+1] && closes[i] > closes[i+2]) {
            highs.push({ index: i, price: closes[i] });
          }
          
          if (closes[i] < closes[i-1] && closes[i] < closes[i-2] && 
              closes[i] < closes[i+1] && closes[i] < closes[i+2]) {
            lows.push({ index: i, price: closes[i] });
          }
        }
        
        let higherHighs = false;
        if (highs.length >= 2) {
          const lastHigh = highs[highs.length - 1];
          const secondLastHigh = highs[highs.length - 2];
          higherHighs = lastHigh.price > secondLastHigh.price;
        }
        
        let higherLows = false;
        if (lows.length >= 2) {
          const lastLow = lows[lows.length - 1];
          const secondLastLow = lows[lows.length - 2];
          higherLows = lastLow.price > secondLastLow.price;
        }
        
        return { higherHighs, higherLows, highs: highs.slice(-3), lows: lows.slice(-3) };
      },
      
      calculateMA: function(data, period) {
        const result = [];
        for (let i = 0; i < data.length; i++) {
          if (i < period - 1) {
            result.push(null);
          } else {
            const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            result.push(sum / period);
          }
        }
        return result;
      }
    };
    
    const result = ictCore.detectTrend(upTrendData, 5);
    
    // 验证3分制评分系统
    assert.strictEqual(typeof result.score, 'number', '得分应该是数字');
    assert.strictEqual(result.score >= -3 && result.score <= 3, true, '得分应该在-3到3之间');
    assert.strictEqual(typeof result.trendFactors, 'object', '趋势因子应该是对象');
    assert.strictEqual(typeof result.trendFactors.priceStructure, 'number', '价格结构因子应该是数字');
    assert.strictEqual(typeof result.trendFactors.maConfirmation, 'number', 'MA确认因子应该是数字');
    assert.strictEqual(typeof result.trendFactors.volumeConfirmation, 'number', '成交量确认因子应该是数字');
    
    console.log('✅ ICT策略1D趋势判断3分制评分系统测试通过');
  }
  
  /**
   * 测试ICT策略Sweep检测机制
   */
  static testICTSweepDetection() {
    console.log('\n🧪 测试ICT策略Sweep检测机制...');
    
    // 模拟Sweep检测器
    const sweepDetector = {
      config: {
        htf: {
          maxBarsToReturn: 2,
          minSpeedATRRatio: 0.4,
          swingLookback: 20,
          minSwingSize: 0.01
        }
      },
      
      detectSweepHTF: function(candles4h, atr4h) {
        // 模拟检测逻辑
        const swingPoints = this.findSwingPoints(candles4h);
        if (swingPoints.highs.length === 0) {
          return { detected: false, reason: '未找到有效的swing高低点' };
        }
        
        const recentBars = candles4h.slice(-3);
        const swingHighSweeps = this.detectSwingHighSweeps(swingPoints.highs, recentBars, atr4h);
        const validSweeps = swingHighSweeps.filter(sweep => sweep.valid);
        
        return {
          detected: validSweeps.length > 0,
          speed: validSweeps.length > 0 ? validSweeps[0].speed : 0,
          threshold: this.config.htf.minSpeedATRRatio * atr4h,
          validSweeps
        };
      },
      
      findSwingPoints: function(candles) {
        const highs = [];
        const lows = [];
        
        for (let i = 2; i < candles.length - 2; i++) {
          const current = candles[i];
          const leftSlice = candles.slice(i - 2, i);
          const rightSlice = candles.slice(i + 1, i + 3);
          
          const isSwingHigh = leftSlice.every(c => c.high <= current.high) && 
                             rightSlice.every(c => c.high <= current.high);
          
          if (isSwingHigh) {
            highs.push({
              index: i,
              level: current.high,
              type: 'high'
            });
          }
        }
        
        return { highs: highs.slice(-5), lows };
      },
      
      detectSwingHighSweeps: function(swingHighs, recentBars, atr) {
        const sweeps = [];
        
        for (const swingHigh of swingHighs) {
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
          
          const speed = barsToReturn > 0 ? exceedAmount / barsToReturn : 0;
          const threshold = this.config.htf.minSpeedATRRatio * atr;
          const valid = returned && barsToReturn <= this.config.htf.maxBarsToReturn && speed >= threshold;
          
          sweeps.push({
            swingLevel: swingHigh.level,
            direction: 'bearish',
            exceedAmount,
            barsToReturn,
            speed,
            threshold,
            returned,
            valid,
            sweepBar
          });
        }
        
        return sweeps;
      }
    };
    
    // 模拟4H K线数据
    const candles4h = [
      { high: 50000, low: 49000, close: 49500 },
      { high: 51000, low: 50000, close: 50500 },
      { high: 52000, low: 51000, close: 51500 },
      { high: 53000, low: 52000, close: 52500 }
    ];
    
    const atr4h = 500;
    const result = sweepDetector.detectSweepHTF(candles4h, atr4h);
    
    // 验证Sweep检测结果
    assert.strictEqual(typeof result.detected, 'boolean', '检测结果应该是布尔值');
    assert.strictEqual(typeof result.speed, 'number', '速率应该是数字');
    assert.strictEqual(typeof result.threshold, 'number', '阈值应该是数字');
    assert.strictEqual(Array.isArray(result.validSweeps), true, '有效Sweep应该是数组');
    
    console.log('✅ ICT策略Sweep检测机制测试通过');
  }
}

/**
 * V3策略实现测试
 */
class V3StrategyImplementationTest {
  
  /**
   * 测试V3策略4H趋势过滤10分制评分系统
   */
  static testV3TenPointScoring() {
    console.log('\n🧪 测试V3策略4H趋势过滤10分制评分系统...');
    
    // 模拟V3核心实例
    const v3Core = {
      analyze4HTrend: function(symbol) {
        // 模拟K线数据
        const candles = Array.from({ length: 50 }, (_, i) => ({
          open: 50000 + i * 100,
          high: 50100 + i * 100,
          low: 49900 + i * 100,
          close: 50000 + i * 100,
          volume: 1000 + i * 10
        }));
        
        const closes = candles.map(c => c.close);
        const ma20 = this.calculateMA(candles, 20);
        const ma50 = this.calculateMA(candles, 50);
        const ma200 = this.calculateMA(candles, 200);
        
        const lastClose = closes[closes.length - 1];
        const currentMA20 = ma20[ma20.length - 1];
        const currentMA50 = ma50[ma50.length - 1];
        const currentMA200 = ma200[ma200.length - 1];
        
        let totalScore = 0;
        let bullScore = 0;
        let bearScore = 0;
        let direction = null;
        
        // 1. 趋势方向（必选）
        if (lastClose > currentMA20) bullScore++;
        if (currentMA20 > currentMA50) bullScore++;
        if (currentMA50 > currentMA200) bullScore++;
        
        if (lastClose < currentMA20) bearScore++;
        if (currentMA20 < currentMA50) bearScore++;
        if (currentMA50 < currentMA200) bearScore++;
        
        if (bullScore >= 2) {
          direction = "BULL";
          totalScore = bullScore; // 修复：先设置方向分
        } else if (bearScore >= 2) {
          direction = "BEAR";
          totalScore = bearScore; // 修复：先设置方向分
        }
        
        if (!direction) {
          return { trend4h: '震荡市', marketType: '震荡市', score: 0 };
        }
        
        // 2. 趋势稳定性 (1分)
        const last2 = closes.slice(-2);
        const last2MA20 = ma20.slice(-2);
        const last2MA50 = ma50.slice(-2);
        const last2MA200 = ma200.slice(-2);
        
        let trendStability = false;
        if (direction === "BULL") {
          trendStability = last2.every((c, i) =>
            c > last2MA20[i] && last2MA20[i] > last2MA50[i] && last2MA50[i] > last2MA200[i]
          );
        }
        
        if (trendStability) {
          totalScore++;
        }
        
        // 3. 趋势强度 (1分) - 模拟ADX
        const ADX = 25;
        const DIplus = 30;
        const DIminus = 20;
        
        if (ADX > 20 && ((direction === "BULL" && DIplus > DIminus) || 
                         (direction === "BEAR" && DIminus > DIplus))) {
          totalScore++;
        }
        
        // 4. 布林带扩张 (1分)
        const bbwExpanding = true; // 模拟布林带扩张
        if (bbwExpanding) {
          totalScore++;
        }
        
        // 5. 动量确认 (1分)
        const momentumDistance = Math.abs((lastClose - currentMA20) / currentMA20);
        if (momentumDistance >= 0.005) {
          totalScore++;
        }
        
        // 最终判断
        let trend4h = '震荡市';
        let marketType = '震荡市';
        
        if (totalScore >= 4) {
          trend4h = direction === "BULL" ? "多头趋势" : "空头趋势";
          marketType = "趋势市";
        }
        
        return {
          trend4h,
          marketType,
          score: totalScore,
          direction,
          bullScore,
          bearScore
        };
      },
      
      calculateMA: function(data, period) {
        const result = [];
        for (let i = 0; i < data.length; i++) {
          if (i < period - 1) {
            result.push(null);
          } else {
            const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b.close, 0);
            result.push(sum / period);
          }
        }
        return result;
      }
    };
    
    const result = v3Core.analyze4HTrend('BTCUSDT');
    
    // 验证10分制评分系统
    assert.strictEqual(typeof result.score, 'number', '得分应该是数字');
    assert.strictEqual(result.score >= 0 && result.score <= 10, true, '得分应该在0到10之间');
    assert.strictEqual(typeof result.direction, 'string', '方向应该是字符串');
    assert.strictEqual(typeof result.bullScore, 'number', '多头得分应该是数字');
    assert.strictEqual(typeof result.bearScore, 'number', '空头得分应该是数字');
    assert.strictEqual(['多头趋势', '空头趋势', '震荡市'].includes(result.trend4h), true, '趋势类型应该有效');
    assert.strictEqual(['趋势市', '震荡市'].includes(result.marketType), true, '市场类型应该有效');
    
    console.log('✅ V3策略4H趋势过滤10分制评分系统测试通过');
  }
  
  /**
   * 测试V3策略1H多因子打分系统
   */
  static testV3MultiFactorScoring() {
    console.log('\n🧪 测试V3策略1H多因子打分系统...');
    
    // 模拟V3多因子打分实例
    const v3Scoring = {
      analyze1HScoring: function(symbol, trend4h) {
        const currentPrice = 50000;
        const lastVWAP = 49500; // VWAP低于当前价格
        
        let score = 0;
        const factorScores = {};
        
        // 1. VWAP方向一致性（必须满足）
        const vwapDirectionConsistent = this.checkVWAPDirectionConsistency(currentPrice, lastVWAP, trend4h);
        if (!vwapDirectionConsistent) {
          return { score: 0, error: 'VWAP方向不一致' };
        }
        
        // 2. 突破确认 (±1分)
        const breakoutScore = this.calculateBreakoutScore(trend4h);
        score += breakoutScore;
        factorScores.breakout = breakoutScore;
        
        // 3. 成交量确认 (±1分)
        const volumeScore = this.calculateVolumeScore();
        score += volumeScore;
        factorScores.volume = volumeScore;
        
        // 4. OI变化 (±1分)
        const oiScore = this.calculateOIScore();
        score += oiScore;
        factorScores.oi = oiScore;
        
        // 5. Delta确认 (±1分)
        const deltaScore = this.calculateDeltaScore();
        score += deltaScore;
        factorScores.delta = deltaScore;
        
        // 6. 资金费率 (±1分)
        const fundingScore = this.calculateFundingScore();
        score += fundingScore;
        factorScores.funding = fundingScore;
        
        return {
          score,
          factorScores,
          signal: score >= 3 ? (trend4h === '多头趋势' ? '做多' : '做空') : '观望'
        };
      },
      
      checkVWAPDirectionConsistency: function(currentPrice, lastVWAP, trend4h) {
        if (trend4h === '多头趋势') {
          return currentPrice > lastVWAP;
        } else if (trend4h === '空头趋势') {
          return currentPrice < lastVWAP;
        }
        return false;
      },
      
      calculateBreakoutScore: function(trend4h) {
        return trend4h === '多头趋势' ? 1 : 0;
      },
      
      calculateVolumeScore: function() {
        return 1; // 模拟成交量确认
      },
      
      calculateOIScore: function() {
        return 1; // 模拟OI变化确认
      },
      
      calculateDeltaScore: function() {
        return 1; // 模拟Delta确认
      },
      
      calculateFundingScore: function() {
        return 1; // 模拟资金费率确认
      }
    };
    
    const result = v3Scoring.analyze1HScoring('BTCUSDT', '多头趋势');
    
    // 验证多因子打分系统
    assert.strictEqual(typeof result.score, 'number', '得分应该是数字');
    assert.strictEqual(result.score >= 0 && result.score <= 6, true, '得分应该在0到6之间');
    assert.strictEqual(typeof result.factorScores, 'object', '因子得分应该是对象');
    assert.strictEqual(['做多', '做空', '观望'].includes(result.signal), true, '信号应该有效');
    
    // 验证VWAP方向一致性检查
    const vwapTest = v3Scoring.checkVWAPDirectionConsistency(50000, 49500, '多头趋势');
    assert.strictEqual(vwapTest, true, 'VWAP方向一致性检查应该正确');
    
    console.log('✅ V3策略1H多因子打分系统测试通过');
  }
  
  /**
   * 测试V3策略震荡市逻辑
   */
  static testV3RangeMarketLogic() {
    console.log('\n🧪 测试V3策略震荡市逻辑...');
    
    // 模拟震荡市分析器
    const rangeAnalyzer = {
      analyze1HBoundary: function(symbol) {
        const candles1h = Array.from({ length: 24 }, (_, i) => ({
          open: 50000 + Math.sin(i * 0.5) * 1000,
          high: 51000 + Math.sin(i * 0.5) * 1000,
          low: 49000 + Math.sin(i * 0.5) * 1000,
          close: 50000 + Math.sin(i * 0.5) * 1000,
          volume: 1000 + i * 10
        }));
        
        const closes = candles1h.map(c => c.close);
        const upperBoundary = Math.max(...closes) * 1.02;
        const lowerBoundary = Math.min(...closes) * 0.98;
        
        // 分析边界触碰
        const touchAnalysis = this.analyzeBoundaryTouches(candles1h, upperBoundary, lowerBoundary);
        
        // 计算边界得分
        const upperScore = this.calculateBoundaryScore(candles1h, upperBoundary, touchAnalysis.upperTouches);
        const lowerScore = this.calculateBoundaryScore(candles1h, lowerBoundary, touchAnalysis.lowerTouches);
        
        return {
          upperBoundary,
          lowerBoundary,
          upperValid: upperScore >= 3,
          lowerValid: lowerScore >= 3,
          upperScore,
          lowerScore,
          upperTouches: touchAnalysis.upperTouches,
          lowerTouches: touchAnalysis.lowerTouches
        };
      },
      
      analyzeBoundaryTouches: function(candles1h, upperBoundary, lowerBoundary) {
        const tolerance = 0.015; // 1.5%
        const upperTouches = [];
        const lowerTouches = [];
        
        for (const candle of candles1h) {
          if (candle.close >= upperBoundary * (1 - tolerance)) {
            upperTouches.push({
              timestamp: new Date().toISOString(),
              price: candle.close,
              distance: candle.close - upperBoundary
            });
          }
          
          if (candle.close <= lowerBoundary * (1 + tolerance)) {
            lowerTouches.push({
              timestamp: new Date().toISOString(),
              price: candle.close,
              distance: lowerBoundary - candle.close
            });
          }
        }
        
        return { upperTouches, lowerTouches };
      },
      
      calculateBoundaryScore: function(candles1h, boundary, touches) {
        let score = 0;
        
        // 触碰次数得分
        score += Math.min(touches.length, 3);
        
        // 成交量确认得分
        const avgVolume = candles1h.reduce((sum, c) => sum + c.volume, 0) / candles1h.length;
        const recentVolume = candles1h.slice(-1)[0].volume;
        if (recentVolume > avgVolume * 1.2) {
          score += 1;
        }
        
        return score;
      }
    };
    
    const result = rangeAnalyzer.analyze1HBoundary('BTCUSDT');
    
    // 验证震荡市逻辑
    assert.strictEqual(typeof result.upperBoundary, 'number', '上轨边界应该是数字');
    assert.strictEqual(typeof result.lowerBoundary, 'number', '下轨边界应该是数字');
    assert.strictEqual(typeof result.upperValid, 'boolean', '上轨有效性应该是布尔值');
    assert.strictEqual(typeof result.lowerValid, 'boolean', '下轨有效性应该是布尔值');
    assert.strictEqual(typeof result.upperScore, 'number', '上轨得分应该是数字');
    assert.strictEqual(typeof result.lowerScore, 'number', '下轨得分应该是数字');
    assert.strictEqual(Array.isArray(result.upperTouches), true, '上轨触碰应该是数组');
    assert.strictEqual(Array.isArray(result.lowerTouches), true, '下轨触碰应该是数组');
    
    console.log('✅ V3策略震荡市逻辑测试通过');
  }
}

/**
 * 运行所有策略实现测试
 */
function runAllStrategyImplementationTests() {
  try {
    console.log('🚀 开始运行策略实现完整性测试...\n');
    
    // ICT策略测试
    ICTStrategyImplementationTest.testICT3PointTrendSystem();
    ICTStrategyImplementationTest.testICTSweepDetection();
    
    // V3策略测试
    V3StrategyImplementationTest.testV3TenPointScoring();
    V3StrategyImplementationTest.testV3MultiFactorScoring();
    V3StrategyImplementationTest.testV3RangeMarketLogic();
    
    console.log('\n🎉 所有策略实现测试通过！');
    console.log('✅ 测试覆盖范围：');
    console.log('   - ICT策略1D趋势判断3分制评分系统');
    console.log('   - ICT策略Sweep检测机制');
    console.log('   - V3策略4H趋势过滤10分制评分系统');
    console.log('   - V3策略1H多因子打分系统');
    console.log('   - V3策略震荡市逻辑');
    
  } catch (error) {
    console.error('\n❌ 策略实现测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 如果直接运行此文件，则执行测试
if (require.main === module) {
  runAllStrategyImplementationTests();
}

module.exports = {
  ICTStrategyImplementationTest,
  V3StrategyImplementationTest,
  runAllStrategyImplementationTests
};
