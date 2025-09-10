// debug-full-analysis.js
// 调试完整的策略分析流程

const SmartFlowStrategyV3 = require('./modules/strategy/SmartFlowStrategyV3');

async function debugFullAnalysis() {
  try {
    console.log('🔍 开始调试完整策略分析流程...');
    
    const symbol = 'TRXUSDT';
    
    // 测试完整的策略分析
    console.log(`📊 测试 ${symbol} 完整策略分析...`);
    const analysis = await SmartFlowStrategyV3.analyzeSymbol(symbol);
    
    console.log('完整分析结果:');
    console.log(`  市场类型: ${analysis.marketType}`);
    console.log(`  信号: ${analysis.signal}`);
    console.log(`  执行: ${analysis.execution}`);
    console.log(`  入场价: ${analysis.entrySignal}`);
    console.log(`  止损价: ${analysis.stopLoss}`);
    console.log(`  止盈价: ${analysis.takeProfit}`);
    console.log(`  最大杠杆: ${analysis.maxLeverage}`);
    console.log(`  最小保证金: ${analysis.minMargin}`);
    console.log(`  止损距离: ${analysis.stopLossDistance}`);
    console.log(`  ATR值: ${analysis.atrValue}`);
    console.log(`  ATR14: ${analysis.atr14}`);
    
    // 检查关键字段
    console.log('\n🔍 关键字段检查:');
    console.log(`  atrValue 是否为 null: ${analysis.atrValue === null}`);
    console.log(`  atrValue 是否为 undefined: ${analysis.atrValue === undefined}`);
    console.log(`  atrValue 类型: ${typeof analysis.atrValue}`);
    console.log(`  atrValue 值: ${analysis.atrValue}`);
    
    console.log(`  stopLossDistance 是否为 null: ${analysis.stopLossDistance === null}`);
    console.log(`  stopLossDistance 是否为 undefined: ${analysis.stopLossDistance === undefined}`);
    console.log(`  stopLossDistance 类型: ${typeof analysis.stopLossDistance}`);
    console.log(`  stopLossDistance 值: ${analysis.stopLossDistance}`);
    
    console.log(`  maxLeverage 是否为 null: ${analysis.maxLeverage === null}`);
    console.log(`  maxLeverage 是否为 undefined: ${analysis.maxLeverage === undefined}`);
    console.log(`  maxLeverage 类型: ${typeof analysis.maxLeverage}`);
    console.log(`  maxLeverage 值: ${analysis.maxLeverage}`);
    
  } catch (error) {
    console.error('❌ 调试过程出错:', error);
    console.error('错误堆栈:', error.stack);
  }
}

// 运行调试
debugFullAnalysis().catch(console.error);
