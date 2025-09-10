// debug-signal-flow.js
// 调试信号流程问题

const SmartFlowStrategyV3 = require('./modules/strategy/SmartFlowStrategyV3');
const DatabaseManager = require('./modules/database/DatabaseManager');

async function debugSignalFlow() {
  const dbManager = new DatabaseManager();
  await dbManager.init();

  try {
    console.log('🔍 开始调试信号流程...');
    
    const symbol = 'TRXUSDT';
    
    // 1. 直接测试策略分析
    console.log(`📊 测试 ${symbol} 策略分析...`);
    const analysis = await SmartFlowStrategyV3.analyzeSymbol(symbol);
    
    console.log('策略分析结果:');
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
    
    // 2. 测试数据库记录
    console.log(`\n📊 测试数据库记录...`);
    try {
      await dbManager.recordStrategyAnalysis(analysis);
      console.log('✅ 数据库记录成功');
    } catch (error) {
      console.error('❌ 数据库记录失败:', error);
    }
    
    // 3. 模拟getAllSignals流程
    console.log(`\n📊 模拟getAllSignals流程...`);
    const symbols = await dbManager.getCustomSymbols();
    console.log(`获取到 ${symbols.length} 个交易对`);
    
    const signals = [];
    for (const sym of symbols.slice(0, 3)) { // 只测试前3个
      try {
        console.log(`\n🔍 分析 ${sym}...`);
        const analysis = await SmartFlowStrategyV3.analyzeSymbol(sym);
        
        console.log(`  ${sym} 分析结果:`, {
          signal: analysis.signal,
          execution: analysis.execution,
          atrValue: analysis.atrValue,
          atr14: analysis.atr14,
          stopLossDistance: analysis.stopLossDistance,
          maxLeverage: analysis.maxLeverage,
          minMargin: analysis.minMargin
        });
        
        signals.push({
          symbol: sym,
          signal: analysis.signal,
          execution: analysis.execution,
          entrySignal: analysis.entrySignal,
          stopLoss: analysis.stopLoss,
          takeProfit: analysis.takeProfit,
          maxLeverage: analysis.maxLeverage,
          minMargin: analysis.minMargin,
          stopLossDistance: analysis.stopLossDistance,
          atrValue: analysis.atrValue,
          atr14: analysis.atr14
        });
        
      } catch (error) {
        console.error(`❌ 分析 ${sym} 失败:`, error);
      }
    }
    
    console.log(`\n📊 最终信号数组:`);
    signals.forEach(signal => {
      console.log(`${signal.symbol}: ${signal.execution || 'NONE'} - ATR: ${signal.atrValue || 'null'}`);
    });
    
  } catch (error) {
    console.error('❌ 调试过程出错:', error);
    console.error('错误堆栈:', error.stack);
  } finally {
    await dbManager.close();
  }
}

// 运行调试
debugSignalFlow().catch(console.error);
