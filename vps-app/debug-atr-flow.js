const SmartFlowStrategyV3 = require('./modules/strategy/SmartFlowStrategyV3');

async function debugATRFlow() {
  try {
    console.log('🔍 开始调试ATR数据流...');
    
    // 分析TRXUSDT - 模拟getAllSignals的调用方式
    const symbol = 'TRXUSDT';
    console.log(`\n📊 分析交易对: ${symbol}`);
    
    // 模拟getAllSignals中的调用
    const maxLossAmount = 100; // 默认值
    const analysis = await SmartFlowStrategyV3.analyzeSymbol(symbol, { maxLossAmount: parseFloat(maxLossAmount) });
    console.log('分析结果:');
    console.log(`  市场类型: ${analysis.marketType}`);
    console.log(`  信号: ${analysis.signal}`);
    console.log(`  ATR值: ${analysis.atrValue}`);
    console.log(`  ATR14: ${analysis.atr14}`);
    console.log(`  最大杠杆: ${analysis.maxLeverage}`);
    console.log(`  最小保证金: ${analysis.minMargin}`);
    console.log(`  止损距离: ${analysis.stopLossDistance}`);
    
    console.log('\n✅ 调试完成');
    
  } catch (error) {
    console.error('❌ 调试失败:', error);
  }
}

debugATRFlow();
