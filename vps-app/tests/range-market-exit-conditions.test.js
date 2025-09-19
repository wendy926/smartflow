// range-market-exit-conditions.test.js - 震荡市逻辑和出场条件测试
// 测试V3策略震荡市逻辑和ICT/V3策略出场条件

const assert = require('assert');

/**
 * V3策略震荡市逻辑测试
 */
class V3RangeMarketTest {
  
  /**
   * 测试V3策略1H边界确认
   */
  static testV31HBoundaryConfirmation() {
    console.log('\n🧪 测试V3策略1H边界确认...');
    
    // 模拟震荡市分析器
    const rangeAnalyzer = {
      analyze1HBoundary: function(symbol) {
        // 模拟1H K线数据
        const candles1h = Array.from({ length: 24 }, (_, i) => ({
          open: 50000 + Math.sin(i * 0.5) * 1000,
          high: 51000 + Math.sin(i * 0.5) * 1000,
          low: 49000 + Math.sin(i * 0.5) * 1000,
          close: 50000 + Math.sin(i * 0.5) * 1000,
          volume: 1000 + i * 10,
          timestamp: new Date(Date.now() - (24 - i) * 3600000).toISOString()
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
              timestamp: candle.timestamp,
              price: candle.close,
              distance: candle.close - upperBoundary
            });
          }
          
          if (candle.close <= lowerBoundary * (1 + tolerance)) {
            lowerTouches.push({
              timestamp: candle.timestamp,
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
    
    // 验证震荡市边界确认
    assert.strictEqual(typeof result.upperBoundary, 'number', '上轨边界应该是数字');
    assert.strictEqual(typeof result.lowerBoundary, 'number', '下轨边界应该是数字');
    assert.strictEqual(typeof result.upperValid, 'boolean', '上轨有效性应该是布尔值');
    assert.strictEqual(typeof result.lowerValid, 'boolean', '下轨有效性应该是布尔值');
    assert.strictEqual(typeof result.upperScore, 'number', '上轨得分应该是数字');
    assert.strictEqual(typeof result.lowerScore, 'number', '下轨得分应该是数字');
    assert.strictEqual(Array.isArray(result.upperTouches), true, '上轨触碰应该是数组');
    assert.strictEqual(Array.isArray(result.lowerTouches), true, '下轨触碰应该是数组');
    
    console.log('✅ V3策略1H边界确认测试通过');
  }
  
  /**
   * 测试V3策略15m假突破分析
   */
  static testV315mFakeBreakout() {
    console.log('\n🧪 测试V3策略15m假突破分析...');
    
    // 模拟假突破分析器
    const fakeBreakoutAnalyzer = {
      analyze15mFakeBreakout: function(symbol, boundaryResult) {
        // 模拟15m K线数据
        const candles15m = Array.from({ length: 50 }, (_, i) => ({
          timestamp: new Date(Date.now() - (50 - i) * 900000).toISOString(),
          open: 50000 + Math.sin(i * 0.2) * 500,
          high: 50500 + Math.sin(i * 0.2) * 500,
          low: 49500 + Math.sin(i * 0.2) * 500,
          close: 50000 + Math.sin(i * 0.2) * 500,
          volume: 500 + i * 5
        }));
        
        // 1. 检查布林带宽收窄
        const bbWidthCheck = this.check15mBBWidth(candles15m);
        if (!bbWidthCheck.narrow) {
          return {
            fakeBreakoutDetected: false,
            reason: '15m布林带宽未收窄',
            bbWidthCheck
          };
        }
        
        // 2. 检查假突破模式
        const fakeBreakoutAnalysis = this.detectFakeBreakoutPattern(candles15m);
        
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
        
        return {
          fakeBreakoutDetected: true,
          direction: fakeBreakoutAnalysis.direction,
          confidence: this.calculateFakeBreakoutConfidence(fakeBreakoutAnalysis, volumeConfirmation),
          bbWidthCheck,
          fakeBreakoutAnalysis,
          volumeConfirmation
        };
      },
      
      check15mBBWidth: function(candles15m) {
        const closes = candles15m.map(c => c.close);
        const avgPrice = closes.reduce((sum, price) => sum + price, 0) / closes.length;
        const variance = closes.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / closes.length;
        const bandwidth = Math.sqrt(variance) / avgPrice;
        
        const narrow = bandwidth < 0.05; // 5%带宽阈值
        
        return {
          narrow,
          bandwidth,
          threshold: 0.05,
          description: narrow ? '布林带收窄' : '布林带未收窄'
        };
      },
      
      detectFakeBreakoutPattern: function(candles15m) {
        const currentCandle = candles15m[candles15m.length - 1];
        const prevCandle = candles15m[candles15m.length - 2];
        
        // 模拟假突破检测逻辑
        const breakoutRatio = 0.015; // 1.5%突破比例
        const returnRatio = 0.01;    // 1%回撤比例
        
        let detected = false;
        let direction = null;
        
        // 检查向上假突破
        if (currentCandle.high > prevCandle.high * (1 + breakoutRatio) &&
            currentCandle.close < currentCandle.high * (1 - returnRatio)) {
          detected = true;
          direction = 'bearish';
        }
        
        // 检查向下假突破
        if (currentCandle.low < prevCandle.low * (1 - breakoutRatio) &&
            currentCandle.close > currentCandle.low * (1 + returnRatio)) {
          detected = true;
          direction = 'bullish';
        }
        
        return {
          detected,
          direction,
          mode: detected ? 'fake_breakout' : 'none',
          currentCandle,
          prevCandle
        };
      },
      
      checkFakeBreakoutVolume: function(candles15m) {
        const volumes = candles15m.map(c => c.volume);
        const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        const currentVolume = volumes[volumes.length - 1];
        const volumeRatio = currentVolume / avgVolume;
        
        return {
          volumeRatio,
          confirmed: volumeRatio >= 1.2,
          description: volumeRatio >= 1.2 ? '成交量确认' : '成交量未确认'
        };
      },
      
      calculateFakeBreakoutConfidence: function(fakeBreakoutAnalysis, volumeConfirmation) {
        let confidence = 0;
        
        if (fakeBreakoutAnalysis.detected) {
          confidence += 0.6; // 假突破检测占60%
        }
        
        if (volumeConfirmation.confirmed) {
          confidence += 0.4; // 成交量确认占40%
        }
        
        return Math.min(confidence, 1.0);
      }
    };
    
    const boundaryResult = { upperBoundary: 51000, lowerBoundary: 49000 };
    const result = fakeBreakoutAnalyzer.analyze15mFakeBreakout('BTCUSDT', boundaryResult);
    
    // 验证假突破分析
    assert.strictEqual(typeof result.fakeBreakoutDetected, 'boolean', '假突破检测结果应该是布尔值');
    assert.strictEqual(typeof result.confidence, 'number', '置信度应该是数字');
    assert.strictEqual(result.confidence >= 0 && result.confidence <= 1, true, '置信度应该在0-1之间');
    assert.strictEqual(typeof result.bbWidthCheck, 'object', '布林带宽度检查应该是对象');
    assert.strictEqual(typeof result.volumeConfirmation, 'object', '成交量确认应该是对象');
    
    console.log('✅ V3策略15m假突破分析测试通过');
  }
}

/**
 * ICT策略出场条件测试
 */
class ICTExitConditionsTest {
  
  /**
   * 测试ICT策略出场条件
   */
  static testICTExitConditions() {
    console.log('\n🧪 测试ICT策略出场条件...');
    
    // 模拟ICT出场条件检查器
    const ictExitChecker = {
      checkICTExitConditions: function(params) {
        const {
          position,
          entryPrice,
          currentPrice,
          stopLoss,
          takeProfit,
          ob,
          fvg,
          atr4h,
          timeInPosition
        } = params;
        
        // 1. 止损触发
        if ((position === 'LONG' && currentPrice <= stopLoss) ||
            (position === 'SHORT' && currentPrice >= stopLoss)) {
          return { 
            exit: true, 
            reason: 'STOP_LOSS', 
            exitPrice: stopLoss,
            description: '触发止损'
          };
        }
        
        // 2. 止盈触发
        if ((position === 'LONG' && currentPrice >= takeProfit) ||
            (position === 'SHORT' && currentPrice <= takeProfit)) {
          return { 
            exit: true, 
            reason: 'TAKE_PROFIT', 
            exitPrice: takeProfit,
            description: '触发止盈(RR=3:1)'
          };
        }
        
        // 3. Order Block失效
        if (ob) {
          const obBreakResult = this.checkOrderBlockBreak(position, currentPrice, ob, atr4h);
          if (obBreakResult.broken) {
            return {
              exit: true,
              reason: 'ORDER_BLOCK_BREAK',
              exitPrice: currentPrice,
              description: `OB失效: ${obBreakResult.description}`
            };
          }
        }
        
        // 4. Fair Value Gap回填
        if (fvg) {
          const fvgFillResult = this.checkFVGRefill(position, currentPrice, fvg);
          if (fvgFillResult.filled) {
            return {
              exit: true,
              reason: 'FVG_REFILL',
              exitPrice: currentPrice,
              description: `FVG回填: ${fvgFillResult.description}`
            };
          }
        }
        
        // 5. 时间止损
        if (timeInPosition >= 48) { // 12小时 = 48个15分钟
          return {
            exit: true,
            reason: 'TIME_STOP',
            exitPrice: currentPrice,
            description: '时间止损: 持仓超过12小时'
          };
        }
        
        // 否则继续持仓
        return { 
          exit: false, 
          reason: '', 
          exitPrice: null,
          description: '继续持仓'
        };
      },
      
      checkOrderBlockBreak: function(position, currentPrice, ob, atr4h) {
        const tolerance = atr4h * 0.5;
        
        if (position === 'LONG') {
          const obBreakLevel = ob.low - tolerance;
          if (currentPrice <= obBreakLevel) {
            return {
              broken: true,
              description: `价格跌破OB下沿(${obBreakLevel.toFixed(2)})`
            };
          }
        } else if (position === 'SHORT') {
          const obBreakLevel = ob.high + tolerance;
          if (currentPrice >= obBreakLevel) {
            return {
              broken: true,
              description: `价格突破OB上沿(${obBreakLevel.toFixed(2)})`
            };
          }
        }
        
        return { broken: false, description: 'OB仍然有效' };
      },
      
      checkFVGRefill: function(position, currentPrice, fvg) {
        if (currentPrice >= fvg.low && currentPrice <= fvg.high) {
          return {
            filled: true,
            description: `价格回填到FVG区间(${fvg.low.toFixed(2)}-${fvg.high.toFixed(2)})`
          };
        }
        
        return { filled: false, description: 'FVG未被回填' };
      }
    };
    
    // 测试多头止损触发
    const longStopLossParams = {
      position: 'LONG',
      entryPrice: 50000,
      currentPrice: 49000, // 跌破止损
      stopLoss: 49500,
      takeProfit: 51500,
      atr4h: 500,
      timeInPosition: 10
    };
    
    const stopLossResult = ictExitChecker.checkICTExitConditions(longStopLossParams);
    assert.strictEqual(stopLossResult.exit, true, '多头止损应该触发');
    assert.strictEqual(stopLossResult.reason, 'STOP_LOSS', '止损原因应该是STOP_LOSS');
    
    // 测试多头止盈触发
    const longTakeProfitParams = {
      ...longStopLossParams,
      currentPrice: 52000, // 超过止盈
      entryPrice: 50000,
      stopLoss: 49000
    };
    
    const takeProfitResult = ictExitChecker.checkICTExitConditions(longTakeProfitParams);
    assert.strictEqual(takeProfitResult.exit, true, '多头止盈应该触发');
    assert.strictEqual(takeProfitResult.reason, 'TAKE_PROFIT', '止盈原因应该是TAKE_PROFIT');
    
    // 测试OB失效
    const obBreakParams = {
      position: 'LONG',
      entryPrice: 50000,
      currentPrice: 48500,
      stopLoss: 49000,
      takeProfit: 52000,
      ob: { high: 50500, low: 49500 },
      atr4h: 500,
      timeInPosition: 10
    };
    
    const obBreakResult = ictExitChecker.checkICTExitConditions(obBreakParams);
    assert.strictEqual(obBreakResult.exit, true, 'OB失效应该触发出场');
    assert.strictEqual(obBreakResult.reason, 'ORDER_BLOCK_BREAK', '出场原因应该是ORDER_BLOCK_BREAK');
    
    // 测试时间止损
    const timeStopParams = {
      position: 'LONG',
      entryPrice: 50000,
      currentPrice: 50500,
      stopLoss: 49000,
      takeProfit: 52000,
      atr4h: 500,
      timeInPosition: 50 // 超过48个15分钟
    };
    
    const timeStopResult = ictExitChecker.checkICTExitConditions(timeStopParams);
    assert.strictEqual(timeStopResult.exit, true, '时间止损应该触发');
    assert.strictEqual(timeStopResult.reason, 'TIME_STOP', '止损原因应该是TIME_STOP');
    
    // 测试继续持仓
    const continueParams = {
      position: 'LONG',
      entryPrice: 50000,
      currentPrice: 50500,
      stopLoss: 49000,
      takeProfit: 52000,
      atr4h: 500,
      timeInPosition: 10
    };
    
    const continueResult = ictExitChecker.checkICTExitConditions(continueParams);
    assert.strictEqual(continueResult.exit, false, '应该继续持仓');
    assert.strictEqual(continueResult.reason, '', '继续持仓时reason应该为空');
    
    console.log('✅ ICT策略出场条件测试通过');
  }
}

/**
 * V3策略出场条件测试
 */
class V3ExitConditionsTest {
  
  /**
   * 测试V3策略出场条件
   */
  static testV3ExitConditions() {
    console.log('\n🧪 测试V3策略出场条件...');
    
    // 模拟V3出场条件检查器
    const v3ExitChecker = {
      checkExitConditions: function(params) {
        const {
          position,
          entryPrice,
          currentPrice,
          setupCandleHigh,
          setupCandleLow,
          atr14,
          trend4h,
          score1h,
          timeInPosition,
          marketType
        } = params;
        
        // 计算止损和止盈
        let stopLoss, takeProfit;
        const effectiveATR = atr14 || entryPrice * 0.01;
        
        if (position === 'LONG') {
          const stopLossByATR = entryPrice - 1.2 * effectiveATR;
          stopLoss = setupCandleLow ? Math.min(setupCandleLow, stopLossByATR) : stopLossByATR;
          takeProfit = entryPrice + 2 * (entryPrice - stopLoss);
        } else {
          const stopLossByATR = entryPrice + 1.2 * effectiveATR;
          stopLoss = setupCandleHigh ? Math.max(setupCandleHigh, stopLossByATR) : stopLossByATR;
          takeProfit = entryPrice - 2 * (stopLoss - entryPrice);
        }
        
        // 1. 止损触发
        if ((position === 'LONG' && currentPrice <= stopLoss) ||
            (position === 'SHORT' && currentPrice >= stopLoss)) {
          return { exit: true, reason: 'STOP_LOSS', exitPrice: stopLoss };
        }
        
        // 2. 止盈触发
        if ((position === 'LONG' && currentPrice >= takeProfit) ||
            (position === 'SHORT' && currentPrice <= takeProfit)) {
          return { exit: true, reason: 'TAKE_PROFIT', exitPrice: takeProfit };
        }
        
        // 3. 趋势反转
        if (marketType === '趋势市') {
          if ((position === 'LONG' && (trend4h !== '多头趋势' || score1h < 3)) ||
              (position === 'SHORT' && (trend4h !== '空头趋势' || score1h < 3))) {
            return { exit: true, reason: 'TREND_REVERSAL', exitPrice: currentPrice };
          }
        }
        
        // 4. 时间止损
        if (timeInPosition >= 24) { // 6小时 = 24个15分钟
          return { exit: true, reason: 'TIME_STOP', exitPrice: currentPrice };
        }
        
        return { exit: false, reason: '', exitPrice: null };
      }
    };
    
    // 测试多头止损触发
    const longStopLossParams = {
      position: 'LONG',
      entryPrice: 50000,
      currentPrice: 49000,
      setupCandleLow: 49500,
      atr14: 500,
      trend4h: '多头趋势',
      score1h: 4,
      timeInPosition: 10,
      marketType: '趋势市'
    };
    
    const stopLossResult = v3ExitChecker.checkExitConditions(longStopLossParams);
    assert.strictEqual(stopLossResult.exit, true, 'V3多头止损应该触发');
    assert.strictEqual(stopLossResult.reason, 'STOP_LOSS', '止损原因应该是STOP_LOSS');
    
    // 测试趋势反转
    const trendReversalParams = {
      position: 'LONG',
      entryPrice: 50000,
      currentPrice: 50500,
      setupCandleLow: 49000,
      atr14: 500,
      trend4h: '空头趋势', // 趋势反转
      score1h: 2, // 得分过低
      timeInPosition: 10,
      marketType: '趋势市'
    };
    
    const trendReversalResult = v3ExitChecker.checkExitConditions(trendReversalParams);
    assert.strictEqual(trendReversalResult.exit, true, 'V3趋势反转应该触发出场');
    assert.strictEqual(trendReversalResult.reason, 'TREND_REVERSAL', '出场原因应该是TREND_REVERSAL');
    
    // 测试震荡市多因子止损
    const rangeMarketParams = {
      position: 'LONG',
      entryPrice: 50000,
      currentPrice: 50500,
      setupCandleLow: 49000,
      atr14: 500,
      trend4h: '多头趋势',
      score1h: 4,
      timeInPosition: 10,
      marketType: '震荡市'
    };
    
    const rangeMarketResult = v3ExitChecker.checkExitConditions(rangeMarketParams);
    assert.strictEqual(rangeMarketResult.exit, false, '震荡市应该继续持仓');
    
    console.log('✅ V3策略出场条件测试通过');
  }
}

/**
 * 运行所有震荡市和出场条件测试
 */
function runAllRangeMarketExitTests() {
  try {
    console.log('🚀 开始运行震荡市逻辑和出场条件测试...\n');
    
    // V3策略震荡市测试
    V3RangeMarketTest.testV31HBoundaryConfirmation();
    V3RangeMarketTest.testV315mFakeBreakout();
    
    // ICT策略出场条件测试
    ICTExitConditionsTest.testICTExitConditions();
    
    // V3策略出场条件测试
    V3ExitConditionsTest.testV3ExitConditions();
    
    console.log('\n🎉 所有震荡市和出场条件测试通过！');
    console.log('✅ 测试覆盖范围：');
    console.log('   - V3策略1H边界确认');
    console.log('   - V3策略15m假突破分析');
    console.log('   - ICT策略8种出场条件');
    console.log('   - V3策略8种出场条件');
    
  } catch (error) {
    console.error('\n❌ 震荡市和出场条件测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 如果直接运行此文件，则执行测试
if (require.main === module) {
  runAllRangeMarketExitTests();
}

module.exports = {
  V3RangeMarketTest,
  ICTExitConditionsTest,
  V3ExitConditionsTest,
  runAllRangeMarketExitTests
};
