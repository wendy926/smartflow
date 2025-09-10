#!/usr/bin/env node

// 测试出场条件判断逻辑

const path = require('path');

// 模拟SimulationManager的checkExitConditions方法
function testCheckExitConditions() {
  console.log('🧪 测试出场条件判断逻辑...\n');

  // 测试用例1：震荡市区间空头交易
  console.log('📋 测试用例1：震荡市区间空头交易');
  const sim1 = {
    symbol: 'XLMUSDT',
    direction: 'SHORT',
    trigger_reason: 'SIGNAL_区间空头',
    market_type: '震荡市',
    execution_mode_v3: '区间空头'
  };
  
  const analysisData1 = {
    marketType: '震荡市',
    rangeResult: {
      bb1h: {
        upper: 100,
        lower: 95
      }
    }
  };

  const result1 = checkExitConditions(sim1, 98, analysisData1);
  console.log('  结果:', result1);
  console.log('  预期: 使用震荡市出场条件，不应该触发TREND_REVERSAL\n');

  // 测试用例2：趋势市多头回踩突破交易
  console.log('📋 测试用例2：趋势市多头回踩突破交易');
  const sim2 = {
    symbol: 'BTCUSDT',
    direction: 'LONG',
    trigger_reason: 'SIGNAL_多头回踩突破',
    market_type: '趋势市',
    execution_mode_v3: '多头回踩突破'
  };
  
  const analysisData2 = {
    marketType: '趋势市',
    trend4h: { trend: 'UPTREND' },
    hourlyConfirmation: { score: 2 }
  };

  const result2 = checkExitConditions(sim2, 50000, analysisData2);
  console.log('  结果:', result2);
  console.log('  预期: 使用趋势市出场条件，可能触发TREND_REVERSAL\n');

  // 测试用例3：区间信号但market_type为null
  console.log('📋 测试用例3：区间信号但market_type为null');
  const sim3 = {
    symbol: 'XLMUSDT',
    direction: 'SHORT',
    trigger_reason: 'SIGNAL_区间空头',
    market_type: null,
    execution_mode_v3: '区间空头'
  };
  
  const analysisData3 = {
    marketType: null,
    rangeResult: {
      bb1h: {
        upper: 100,
        lower: 95
      }
    }
  };

  const result3 = checkExitConditions(sim3, 98, analysisData3);
  console.log('  结果:', result3);
  console.log('  预期: 应该使用震荡市出场条件（因为isRangeSignal=true）\n');
}

// 模拟checkExitConditions方法
function checkExitConditions(sim, currentPrice, analysisData = null) {
  const position = sim.direction === 'LONG' ? 'long' : 'short';
  
  // 模拟基本参数
  const entryPrice = 100;
  const stopLoss = 95;
  const takeProfit = 105;
  const atr14 = 2;
  const timeInPosition = 5;
  const maxTimeInPosition = 48;

  // 获取市场类型
  let marketType = sim.market_type || analysisData?.marketType || '震荡市';
  
  // 特殊处理：如果触发原因是区间交易，强制使用震荡市出场条件
  const isRangeSignal = sim.trigger_reason?.includes('区间');
  
  console.log(`  🎯 市场类型判断 [${sim.symbol}]:`, {
    marketType,
    isRangeSignal,
    triggerReason: sim.trigger_reason,
    willUseRangeExit: marketType === '震荡市' || isRangeSignal
  });
  
  // 根据市场类型使用不同的出场条件
  if (marketType === '震荡市' || isRangeSignal) {
    console.log('  ✅ 使用震荡市出场条件');
    
    // 震荡市出场条件
    if (analysisData?.rangeResult?.bb1h) {
      const { upper: rangeHigh, lower: rangeLow } = analysisData.rangeResult.bb1h;
      const effectiveATR = atr14 && atr14 > 0 ? atr14 : entryPrice * 0.01;

      // 区间边界失效止损
      if (position === 'long' && currentPrice < (rangeLow - effectiveATR)) {
        return { exit: true, reason: 'RANGE_BOUNDARY_BREAK', exitPrice: currentPrice };
      }
      if (position === 'short' && currentPrice > (rangeHigh + effectiveATR)) {
        return { exit: true, reason: 'RANGE_BOUNDARY_BREAK', exitPrice: currentPrice };
      }
    }
    
    // 其他震荡市出场条件...
    return { exit: false, reason: '继续持仓（震荡市）', exitPrice: null };
    
  } else if (marketType === '趋势市') {
    console.log('  ✅ 使用趋势市出场条件');
    
    // 趋势市出场条件
    const trend4h = analysisData?.trend4h?.trend === 'UPTREND' ? '多头' :
      analysisData?.trend4h?.trend === 'DOWNTREND' ? '空头' : '震荡';
    const score1h = analysisData?.hourlyConfirmation?.score || 0;
    
    // 趋势反转
    if ((position === 'long' && (trend4h !== '多头' || score1h < 3)) ||
      (position === 'short' && (trend4h !== '空头' || score1h < 3))) {
      return { exit: true, reason: 'TREND_REVERSAL', exitPrice: currentPrice };
    }
    
    // 其他趋势市出场条件...
    return { exit: false, reason: '继续持仓（趋势市）', exitPrice: null };
  }
  
  return { exit: false, reason: '继续持仓（默认）', exitPrice: null };
}

// 运行测试
testCheckExitConditions();
