// test-simulation-fixes.js
// 测试模拟交易修复

const SimulationManager = require('./modules/database/SimulationManager');
const DatabaseManager = require('./modules/database/DatabaseManager');

/**
 * 测试模拟交易修复
 */
async function testSimulationFixes() {
  console.log('🧪 测试模拟交易修复...');
  
  const db = new DatabaseManager();
  await db.init();
  
  const simulationManager = new SimulationManager(db);
  
  // 测试1: 检查数据库表结构
  console.log('\n📋 测试1: 检查数据库表结构');
  const tableInfo = await db.runQuery("PRAGMA table_info(simulations)");
  const hasDirectionColumn = tableInfo.some(col => col.name === 'direction');
  console.log('✅ 数据库表包含direction列:', hasDirectionColumn);
  
  // 测试2: 检查现有记录的方向字段
  console.log('\n📋 测试2: 检查现有记录的方向字段');
  const existingRecords = await db.runQuery(`
    SELECT id, symbol, trigger_reason, direction, entry_price, stop_loss_price, take_profit_price, exit_price, exit_reason, is_win
    FROM simulations 
    WHERE status = 'CLOSED' 
    ORDER BY created_at DESC 
    LIMIT 5
  `);
  
  console.log('现有记录示例:');
  existingRecords.forEach(record => {
    console.log(`ID: ${record.id}, 交易对: ${record.symbol}, 方向: ${record.direction}, 触发原因: ${record.trigger_reason}`);
    console.log(`  入场价: ${record.entry_price}, 止损价: ${record.stop_loss_price}, 止盈价: ${record.take_profit_price}`);
    console.log(`  出场价: ${record.exit_price}, 出场原因: ${record.exit_reason}, 盈亏: ${record.is_win}`);
  });
  
  // 测试3: 测试价格格式化
  console.log('\n📋 测试3: 测试价格格式化');
  const testPrices = [100.123456789, 0.000123456, 50000.987654321];
  testPrices.forEach(price => {
    const formatted = parseFloat(price.toFixed(4));
    console.log(`原价格: ${price} -> 格式化后: ${formatted}`);
  });
  
  // 测试4: 测试止盈止损逻辑
  console.log('\n📋 测试4: 测试止盈止损逻辑');
  
  // 测试多头交易
  const longSimulation = {
    id: 999,
    entry_price: 100.0000,
    stop_loss_price: 95.0000,
    take_profit_price: 110.0000,
    trigger_reason: 'SIGNAL_模式A_LONG'
  };
  
  console.log('多头交易测试:');
  console.log('价格94.5 < 止损95.0:', simulationManager.checkExitConditions(longSimulation, 94.5));
  console.log('价格95.0 = 止损95.0:', simulationManager.checkExitConditions(longSimulation, 95.0));
  console.log('价格110.0 = 止盈110.0:', simulationManager.checkExitConditions(longSimulation, 110.0));
  console.log('价格110.5 > 止盈110.0:', simulationManager.checkExitConditions(longSimulation, 110.5));
  console.log('价格105.0 在止损止盈之间:', simulationManager.checkExitConditions(longSimulation, 105.0));
  
  // 测试空头交易
  const shortSimulation = {
    id: 998,
    entry_price: 100.0000,
    stop_loss_price: 105.0000,
    take_profit_price: 90.0000,
    trigger_reason: 'SIGNAL_模式A_SHORT'
  };
  
  console.log('\n空头交易测试:');
  console.log('价格105.5 > 止损105.0:', simulationManager.checkExitConditions(shortSimulation, 105.5));
  console.log('价格105.0 = 止损105.0:', simulationManager.checkExitConditions(shortSimulation, 105.0));
  console.log('价格90.0 = 止盈90.0:', simulationManager.checkExitConditions(shortSimulation, 90.0));
  console.log('价格89.5 < 止盈90.0:', simulationManager.checkExitConditions(shortSimulation, 89.5));
  console.log('价格95.0 在止损止盈之间:', simulationManager.checkExitConditions(shortSimulation, 95.0));
  
  // 测试5: 测试盈亏计算
  console.log('\n📋 测试5: 测试盈亏计算');
  const testSimulation = {
    entry_price: 100.0000,
    max_leverage: 10,
    min_margin: 100
  };
  
  // 测试止盈情况
  const takeProfitPrice = 110.0000;
  const takeProfitLoss = simulationManager.calculateProfitLoss(testSimulation, takeProfitPrice);
  console.log(`止盈测试 - 入场价: ${testSimulation.entry_price}, 出场价: ${takeProfitPrice}, 盈亏: ${takeProfitLoss}`);
  
  // 测试止损情况
  const stopLossPrice = 95.0000;
  const stopLossLoss = simulationManager.calculateProfitLoss(testSimulation, stopLossPrice);
  console.log(`止损测试 - 入场价: ${testSimulation.entry_price}, 出场价: ${stopLossPrice}, 盈亏: ${stopLossLoss}`);
  
  console.log('\n✅ 模拟交易修复测试完成');
  
  await db.close();
}

// 运行测试
testSimulationFixes().catch(console.error);
