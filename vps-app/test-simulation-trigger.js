// 测试模拟交易触发逻辑
const DatabaseManager = require('./modules/database/DatabaseManager');

async function testSimulationTrigger() {
  console.log('🧪 测试模拟交易触发逻辑...');
  
  const db = new DatabaseManager();
  await db.init();
  
  // 1. 检查当前模拟交易记录
  const currentHistory = await db.runQuery(`
    SELECT symbol, trigger_reason, created_at, status
    FROM simulations 
    ORDER BY created_at DESC
  `);
  
  console.log(`📊 当前模拟交易记录总数: ${currentHistory.length}`);
  
  // 2. 按交易对分组统计
  const symbolCounts = {};
  currentHistory.forEach(trade => {
    if (!symbolCounts[trade.symbol]) {
      symbolCounts[trade.symbol] = 0;
    }
    symbolCounts[trade.symbol]++;
  });
  
  console.log('\n📈 各交易对的模拟交易记录数量:');
  Object.entries(symbolCounts).forEach(([symbol, count]) => {
    console.log(`  ${symbol}: ${count} 条记录`);
  });
  
  // 3. 检查是否有多个相同交易对的记录
  const multipleRecords = Object.entries(symbolCounts).filter(([symbol, count]) => count > 1);
  
  if (multipleRecords.length > 0) {
    console.log('\n✅ 发现多个相同交易对的记录（符合预期）:');
    multipleRecords.forEach(([symbol, count]) => {
      console.log(`  ${symbol}: ${count} 条记录`);
    });
  } else {
    console.log('\n❌ 没有发现多个相同交易对的记录（不符合预期）');
  }
  
  // 4. 检查时间分布
  const timeAnalysis = {};
  currentHistory.forEach(trade => {
    const date = trade.created_at.split(' ')[0];
    if (!timeAnalysis[date]) {
      timeAnalysis[date] = 0;
    }
    timeAnalysis[date]++;
  });
  
  console.log('\n📅 按日期分布:');
  Object.entries(timeAnalysis).forEach(([date, count]) => {
    console.log(`  ${date}: ${count} 条记录`);
  });
  
  // 5. 检查trigger_reason的多样性
  const triggerReasons = new Set(currentHistory.map(trade => trade.trigger_reason));
  console.log(`\n🎯 不同的trigger_reason类型: ${triggerReasons.size}`);
  Array.from(triggerReasons).forEach(reason => {
    console.log(`  - ${reason}`);
  });
  
  await db.close();
  console.log('\n✅ 测试完成');
}

testSimulationTrigger().catch(console.error);
