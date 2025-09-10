const { SmartFlowStrategyV3 } = require('./modules/strategy/SmartFlowStrategyV3');

async function debugATRFlow() {
  try {
    console.log('🔍 开始调试ATR数据流...');
    
    // 创建策略实例
    const strategy = new SmartFlowStrategyV3();
    
    // 分析TRXUSDT
    const symbol = 'TRXUSDT';
    console.log(`\n📊 分析交易对: ${symbol}`);
    
    const analysis = await strategy.analyzeSymbol(symbol);
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
