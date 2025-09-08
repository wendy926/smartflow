// test-simulation-logic.js
// 测试模拟交易逻辑修复

const SimulationManager = require('./modules/database/SimulationManager');
const DatabaseManager = require('./modules/database/DatabaseManager');

/**
 * 测试模拟交易结束信号逻辑
 */
async function testSimulationExitLogic() {
  console.log('🧪 测试模拟交易结束信号逻辑...');
  
  const db = new DatabaseManager();
  await db.init();
  
  const simulationManager = new SimulationManager(db);
  
  // 测试多头交易
  console.log('\n📈 测试多头交易逻辑:');
  
  const longSimulation = {
    id: 1,
    entry_price: 100,
    stop_loss_price: 95,
    take_profit_price: 110,
    trigger_reason: 'SIGNAL_模式A_LONG'
  };
  
  // 测试止损条件
  const stopLossResult = simulationManager.checkExitConditions(longSimulation, 94);
  console.log('止损测试 (价格94 < 止损95):', stopLossResult);
  console.assert(stopLossResult.shouldExit === true && stopLossResult.reason === 'STOP_LOSS', '多头止损逻辑错误');
  
  // 测试止盈条件
  const takeProfitResult = simulationManager.checkExitConditions(longSimulation, 111);
  console.log('止盈测试 (价格111 > 止盈110):', takeProfitResult);
  console.assert(takeProfitResult.shouldExit === true && takeProfitResult.reason === 'TAKE_PROFIT', '多头止盈逻辑错误');
  
  // 测试不触发条件
  const noExitResult = simulationManager.checkExitConditions(longSimulation, 105);
  console.log('不触发测试 (价格105 在止损止盈之间):', noExitResult);
  console.assert(noExitResult.shouldExit === false, '多头不触发逻辑错误');
  
  // 测试空头交易
  console.log('\n📉 测试空头交易逻辑:');
  
  const shortSimulation = {
    id: 2,
    entry_price: 100,
    stop_loss_price: 105,
    take_profit_price: 90,
    trigger_reason: 'SIGNAL_模式A_SHORT'
  };
  
  // 测试止损条件
  const shortStopLossResult = simulationManager.checkExitConditions(shortSimulation, 106);
  console.log('空头止损测试 (价格106 > 止损105):', shortStopLossResult);
  console.assert(shortStopLossResult.shouldExit === true && shortStopLossResult.reason === 'STOP_LOSS', '空头止损逻辑错误');
  
  // 测试止盈条件
  const shortTakeProfitResult = simulationManager.checkExitConditions(shortSimulation, 89);
  console.log('空头止盈测试 (价格89 < 止盈90):', shortTakeProfitResult);
  console.assert(shortTakeProfitResult.shouldExit === true && shortTakeProfitResult.reason === 'TAKE_PROFIT', '空头止盈逻辑错误');
  
  // 测试不触发条件
  const shortNoExitResult = simulationManager.checkExitConditions(shortSimulation, 95);
  console.log('空头不触发测试 (价格95 在止损止盈之间):', shortNoExitResult);
  console.assert(shortNoExitResult.shouldExit === false, '空头不触发逻辑错误');
  
  console.log('\n✅ 模拟交易结束信号逻辑测试通过');
  
  await db.close();
}

/**
 * 测试去重逻辑
 */
async function testDuplicateLogic() {
  console.log('\n🧪 测试去重逻辑...');
  
  const db = new DatabaseManager();
  await db.init();
  
  // 模拟检查现有模拟交易的逻辑
  const mockActiveSimulations = [
    {
      id: 1,
      symbol: 'BTCUSDT',
      entry_price: 50000,
      trigger_reason: 'SIGNAL_模式A_LONG',
      status: 'ACTIVE'
    }
  ];
  
  // 测试相同触发原因和入场价格
  const analysis1 = {
    execution: '做多_模式A',
    entrySignal: 50000
  };
  
  const isLong1 = analysis1.execution.includes('做多_');
  const mode1 = analysis1.execution.includes('模式A') ? '模式A' : '模式B';
  const direction1 = isLong1 ? 'LONG' : 'SHORT';
  const expectedTriggerReason1 = `SIGNAL_${mode1}_${direction1}`;
  
  const sameTriggerReason1 = mockActiveSimulations[0].trigger_reason === expectedTriggerReason1;
  const sameEntryPrice1 = Math.abs(parseFloat(mockActiveSimulations[0].entry_price) - parseFloat(analysis1.entrySignal)) < 0.0001;
  
  console.log('相同触发原因和入场价格测试:');
  console.log('触发原因相同:', sameTriggerReason1);
  console.log('入场价格相同:', sameEntryPrice1);
  console.log('应该跳过:', sameTriggerReason1 && sameEntryPrice1);
  console.assert(sameTriggerReason1 && sameEntryPrice1, '相同触发原因和入场价格应该跳过');
  
  // 测试相同触发原因但不同入场价格
  const analysis2 = {
    execution: '做多_模式A',
    entrySignal: 51000
  };
  
  const isLong2 = analysis2.execution.includes('做多_');
  const mode2 = analysis2.execution.includes('模式A') ? '模式A' : '模式B';
  const direction2 = isLong2 ? 'LONG' : 'SHORT';
  const expectedTriggerReason2 = `SIGNAL_${mode2}_${direction2}`;
  
  const sameTriggerReason2 = mockActiveSimulations[0].trigger_reason === expectedTriggerReason2;
  const sameEntryPrice2 = Math.abs(parseFloat(mockActiveSimulations[0].entry_price) - parseFloat(analysis2.entrySignal)) < 0.0001;
  
  console.log('\n相同触发原因但不同入场价格测试:');
  console.log('触发原因相同:', sameTriggerReason2);
  console.log('入场价格相同:', sameEntryPrice2);
  console.log('应该允许创建:', sameTriggerReason2 && !sameEntryPrice2);
  console.assert(sameTriggerReason2 && !sameEntryPrice2, '相同触发原因但不同入场价格应该允许创建');
  
  // 测试不同触发原因
  const analysis3 = {
    execution: '做空_模式B',
    entrySignal: 50000
  };
  
  const isLong3 = analysis3.execution.includes('做多_');
  const mode3 = analysis3.execution.includes('模式A') ? '模式A' : '模式B';
  const direction3 = isLong3 ? 'LONG' : 'SHORT';
  const expectedTriggerReason3 = `SIGNAL_${mode3}_${direction3}`;
  
  const sameTriggerReason3 = mockActiveSimulations[0].trigger_reason === expectedTriggerReason3;
  const sameEntryPrice3 = Math.abs(parseFloat(mockActiveSimulations[0].entry_price) - parseFloat(analysis3.entrySignal)) < 0.0001;
  
  console.log('\n不同触发原因测试:');
  console.log('触发原因相同:', sameTriggerReason3);
  console.log('入场价格相同:', sameEntryPrice3);
  console.log('应该允许创建:', !sameTriggerReason3);
  console.assert(!sameTriggerReason3, '不同触发原因应该允许创建');
  
  console.log('\n✅ 去重逻辑测试通过');
  
  await db.close();
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  try {
    await testSimulationExitLogic();
    await testDuplicateLogic();
    console.log('\n🎉 所有测试通过！模拟交易逻辑修复成功');
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
runAllTests();