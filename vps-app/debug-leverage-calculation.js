// debug-leverage-calculation.js
// 调试杠杆计算问题

const SmartFlowStrategyV3 = require('./modules/strategy/SmartFlowStrategyV3');

async function debugLeverageCalculation() {
  try {
    console.log('🔍 开始调试杠杆计算...');
    
    const entryPrice = 0.33583;
    const stopLossPrice = 0.3352406406524895;
    const atr14 = 0.0004911327895921251;
    const direction = 'LONG';
    
    console.log('输入参数:');
    console.log(`  入场价: ${entryPrice}`);
    console.log(`  止损价: ${stopLossPrice}`);
    console.log(`  ATR14: ${atr14}`);
    console.log(`  方向: ${direction}`);
    
    // 测试杠杆计算
    console.log('\n🧮 测试杠杆计算...');
    const leverageData = await SmartFlowStrategyV3.calculateLeverageData(entryPrice, stopLossPrice, atr14, direction);
    
    console.log('杠杆计算结果:');
    console.log(`  最大杠杆: ${leverageData.maxLeverage}`);
    console.log(`  最小保证金: ${leverageData.minMargin}`);
    console.log(`  止损距离: ${leverageData.stopLossDistance}`);
    console.log(`  ATR值: ${leverageData.atrValue}`);
    
    // 验证计算逻辑
    console.log('\n📊 验证计算逻辑...');
    const effectiveATR = atr14 && atr14 > 0 ? atr14 : entryPrice * 0.01;
    console.log(`有效ATR: ${effectiveATR}`);
    
    const stopLossDistance = (entryPrice - stopLossPrice) / entryPrice;
    console.log(`止损距离: ${stopLossDistance}`);
    
    const maxLeverage = Math.floor(1 / (stopLossDistance + 0.005));
    console.log(`最大杠杆: ${maxLeverage}`);
    
  } catch (error) {
    console.error('❌ 调试过程出错:', error);
    console.error('错误堆栈:', error.stack);
  }
}

// 运行调试
debugLeverageCalculation().catch(console.error);
