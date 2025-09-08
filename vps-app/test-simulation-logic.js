// 测试模拟交易去重逻辑
const { SmartFlowStrategy } = require('./modules/strategy/SmartFlowStrategy');
const DatabaseManager = require('./modules/database/DatabaseManager');

async function testSimulationLogic() {
  console.log('🧪 开始测试模拟交易去重逻辑...');
  
  const db = new DatabaseManager();
  await db.init();
  
  // 获取当前所有信号
  const signals = await db.runQuery(`
    SELECT symbol, execution, entry_signal, stop_loss, take_profit
    FROM strategy_analysis 
    WHERE execution LIKE '%做多_%' OR execution LIKE '%做空_%'
    ORDER BY timestamp DESC
  `);
  
  console.log(`📊 找到 ${signals.length} 个入场执行信号`);
  
  if (signals.length === 0) {
    console.log('❌ 当前没有入场执行信号，无法测试');
    return;
  }
  
  // 获取当前模拟交易记录
  const currentHistory = await db.runQuery(`
    SELECT symbol, trigger_reason, created_at 
    FROM simulations 
    ORDER BY created_at DESC
  `);
  
  console.log(`📈 当前模拟交易记录数量: ${currentHistory.length}`);
  
  // 模拟去重逻辑测试
  const recentHistory = await db.runQuery(`
    SELECT symbol, trigger_reason, created_at 
    FROM simulations 
    WHERE created_at >= datetime('now', '-1 minutes')
    ORDER BY created_at DESC
  `);
  
  console.log(`⏰ 最近1分钟内的模拟交易记录: ${recentHistory.length}`);
  
  // 创建已触发信号的映射
  const triggeredSignals = new Map();
  recentHistory.forEach(trade => {
    const key = `${trade.symbol}_${trade.trigger_reason}`;
    triggeredSignals.set(key, trade);
  });
  
  console.log('🔍 开始检查每个信号...');
  
  for (const signal of signals) {
    if (signal.execution && (signal.execution.includes('做多_') || signal.execution.includes('做空_'))) {
      // 从execution中提取模式信息
      const isLong = signal.execution.includes('做多_');
      const mode = signal.execution.includes('模式A') ? '模式A' : '模式B';
      const direction = isLong ? 'LONG' : 'SHORT';
      
      // 创建与数据库中trigger_reason格式一致的键
      const signalKey = `${signal.symbol}_SIGNAL_${mode}_${direction}`;
      
      console.log(`\n📋 检查信号: ${signal.symbol} - ${signal.execution}`);
      console.log(`🔑 信号键: ${signalKey}`);
      console.log(`❓ 是否已触发: ${triggeredSignals.has(signalKey) ? '是' : '否'}`);
      
      if (!triggeredSignals.has(signalKey)) {
        console.log(`✅ 可以创建新的模拟交易: ${signal.symbol} - ${signal.execution}`);
      } else {
        console.log(`⏭️ 跳过已触发的信号: ${signal.symbol} - ${signal.execution}`);
      }
    }
  }
  
  await db.close();
  console.log('\n🎯 测试完成');
}

testSimulationLogic().catch(console.error);
