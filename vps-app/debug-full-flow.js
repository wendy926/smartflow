// 调试完整信号生成和模拟交易创建流程

const { SmartFlowStrategyV3 } = require('./modules/strategy/SmartFlowStrategyV3');
const { DatabaseManager } = require('./modules/database/DatabaseManager');
const { SimulationManager } = require('./modules/database/SimulationManager');

async function debugFullFlow() {
  console.log('🔍 开始调试完整信号生成和模拟交易创建流程...');

  let db;
  let simulationManager;

  try {
    // 初始化数据库
    db = new DatabaseManager();
    await db.init();
    
    simulationManager = new SimulationManager(db);

    console.log('📊 开始分析BTCUSDT信号...');
    
    // 分析BTCUSDT信号
    const analysis = await SmartFlowStrategyV3.analyzeAll('BTCUSDT', 100);
    
    console.log('\n📈 策略分析结果:');
    console.log('交易对:', analysis.symbol);
    console.log('市场类型:', analysis.marketType || 'N/A');
    console.log('执行信号:', analysis.execution);
    console.log('执行模式:', analysis.executionMode);
    console.log('入场价格:', analysis.entrySignal);
    console.log('止损价格:', analysis.stopLoss);
    console.log('止盈价格:', analysis.takeProfit);
    console.log('最大杠杆:', analysis.maxLeverage);
    console.log('最小保证金:', analysis.minMargin);
    console.log('ATR值:', analysis.atrValue);

    // 如果有做空信号，创建模拟交易
    if (analysis.execution && analysis.execution.includes('做空_')) {
      console.log('\n🎯 检测到做空信号，创建模拟交易...');
      
      const triggerReason = `SIGNAL_${analysis.executionMode}`;
      
      console.log('创建参数:');
      console.log('- 交易对:', analysis.symbol);
      console.log('- 入场价:', analysis.entrySignal);
      console.log('- 止损价:', analysis.stopLoss);
      console.log('- 止盈价:', analysis.takeProfit);
      console.log('- 触发原因:', triggerReason);
      
      // 验证价格逻辑
      const isStopLossCorrect = analysis.stopLoss > analysis.entrySignal;
      const isTakeProfitCorrect = analysis.takeProfit < analysis.entrySignal;
      
      console.log('\n✅ 创建前价格验证:');
      console.log('止损价格高于入场价:', isStopLossCorrect ? '✅' : '❌', `(${analysis.stopLoss} > ${analysis.entrySignal})`);
      console.log('止盈价格低于入场价:', isTakeProfitCorrect ? '✅' : '❌', `(${analysis.takeProfit} < ${analysis.entrySignal})`);
      
      if (!isStopLossCorrect || !isTakeProfitCorrect) {
        console.log('❌ 发现价格逻辑错误！');
        return;
      }
      
      // 创建模拟交易（不实际插入数据库，只测试逻辑）
      console.log('\n🔧 模拟创建模拟交易...');
      
      const testSimulation = {
        symbol: analysis.symbol,
        entryPrice: analysis.entrySignal,
        stopLossPrice: analysis.stopLoss,
        takeProfitPrice: analysis.takeProfit,
        maxLeverage: analysis.maxLeverage || 10,
        minMargin: analysis.minMargin || 100,
        triggerReason: triggerReason,
        direction: 'SHORT'
      };
      
      console.log('模拟交易数据:');
      console.log('- 交易对:', testSimulation.symbol);
      console.log('- 方向:', testSimulation.direction);
      console.log('- 入场价:', testSimulation.entryPrice);
      console.log('- 止损价:', testSimulation.stopLossPrice);
      console.log('- 止盈价:', testSimulation.takeProfitPrice);
      
      // 最终验证
      const finalStopLossCorrect = testSimulation.stopLossPrice > testSimulation.entryPrice;
      const finalTakeProfitCorrect = testSimulation.takeProfitPrice < testSimulation.entryPrice;
      
      console.log('\n✅ 最终价格验证:');
      console.log('止损价格高于入场价:', finalStopLossCorrect ? '✅' : '❌', `(${testSimulation.stopLossPrice} > ${testSimulation.entryPrice})`);
      console.log('止盈价格低于入场价:', finalTakeProfitCorrect ? '✅' : '❌', `(${testSimulation.takeProfitPrice} < ${testSimulation.entryPrice})`);
      
      if (finalStopLossCorrect && finalTakeProfitCorrect) {
        console.log('✅ 完整流程价格逻辑正确！');
      } else {
        console.log('❌ 完整流程中发现价格逻辑错误！');
      }
      
    } else {
      console.log('\n⚠️ 当前没有做空信号');
      console.log('执行信号:', analysis.execution || 'null');
    }

  } catch (error) {
    console.error('❌ 调试过程中出现错误:', error);
  } finally {
    if (db) {
      await db.close();
    }
  }
}

// 运行调试
debugFullFlow();
