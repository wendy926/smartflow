// 测试去重逻辑是否真的解决了问题
const DatabaseManager = require('./modules/database/DatabaseManager');

async function testDeduplicationLogic() {
  console.log('🧪 测试去重逻辑是否解决了问题...');
  
  const db = new DatabaseManager();
  await db.init();
  
  // 1. 检查当前模拟交易记录
  const currentHistory = await db.runQuery(`
    SELECT symbol, trigger_reason, created_at, status
    FROM simulations 
    ORDER BY created_at DESC
  `);
  
  console.log(`📊 当前模拟交易记录总数: ${currentHistory.length}`);
  
  // 按交易对分组统计
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
  
  // 2. 检查是否有重复的trigger_reason
  const triggerReasonCounts = {};
  currentHistory.forEach(trade => {
    const key = `${trade.symbol}_${trade.trigger_reason}`;
    if (!triggerReasonCounts[key]) {
      triggerReasonCounts[key] = 0;
    }
    triggerReasonCounts[key]++;
  });
  
  console.log('\n🔑 各信号组合的记录数量:');
  Object.entries(triggerReasonCounts).forEach(([key, count]) => {
    console.log(`  ${key}: ${count} 条记录`);
  });
  
  // 3. 检查是否有相同交易对的不同模式记录
  const modeAnalysis = {};
  currentHistory.forEach(trade => {
    if (!modeAnalysis[trade.symbol]) {
      modeAnalysis[trade.symbol] = new Set();
    }
    modeAnalysis[trade.symbol].add(trade.trigger_reason);
  });
  
  console.log('\n🎯 各交易对的模式分析:');
  Object.entries(modeAnalysis).forEach(([symbol, modes]) => {
    const modeArray = Array.from(modes);
    console.log(`  ${symbol}: ${modeArray.length} 种模式 - ${modeArray.join(', ')}`);
  });
  
  // 4. 检查时间分布
  const timeAnalysis = {};
  currentHistory.forEach(trade => {
    const date = trade.created_at.split(' ')[0]; // 只取日期部分
    if (!timeAnalysis[date]) {
      timeAnalysis[date] = 0;
    }
    timeAnalysis[date]++;
  });
  
  console.log('\n📅 按日期分布:');
  Object.entries(timeAnalysis).forEach(([date, count]) => {
    console.log(`  ${date}: ${count} 条记录`);
  });
  
  await db.close();
  console.log('\n✅ 分析完成');
}

testDeduplicationLogic().catch(console.error);
