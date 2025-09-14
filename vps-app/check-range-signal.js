const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('smartflow.db');

console.log('🔍 检查VPS上震荡市15min信号为空的问题...\n');

// 查询最近的震荡市数据
db.all(`
  SELECT 
    symbol,
    market_type,
    execution,
    execution_mode,
    execution_mode_v3,
    range_lower_boundary_valid,
    range_upper_boundary_valid,
    error_message,
    timestamp
  FROM strategy_analysis 
  WHERE market_type = '震荡市' 
    AND timestamp > datetime('now', '-6 hours')
  ORDER BY timestamp DESC 
  LIMIT 10
`, (err, rows) => {
  if (err) {
    console.error('查询失败:', err);
    return;
  }
  
  console.log('📊 最近6小时的震荡市数据:');
  console.log('='.repeat(100));
  rows.forEach(row => {
    console.log(`交易对: ${row.symbol}`);
    console.log(`市场类型: ${row.market_type}`);
    console.log(`执行信号: ${row.execution}`);
    console.log(`执行模式: ${row.execution_mode}`);
    console.log(`V3执行模式: ${row.execution_mode_v3}`);
    console.log(`下边界有效: ${row.range_lower_boundary_valid}`);
    console.log(`上边界有效: ${row.range_upper_boundary_valid}`);
    console.log(`错误信息: ${row.error_message}`);
    console.log(`时间: ${row.timestamp}`);
    console.log('-'.repeat(50));
  });
  
  if (rows.length === 0) {
    console.log('❌ 没有找到震荡市数据，查询所有最近数据...\n');
    
    // 查询所有最近数据
    db.all(`
      SELECT 
        symbol,
        market_type,
        execution,
        execution_mode,
        execution_mode_v3,
        range_lower_boundary_valid,
        range_upper_boundary_valid,
        error_message,
        timestamp
      FROM strategy_analysis 
      WHERE timestamp > datetime('now', '-6 hours')
      ORDER BY timestamp DESC 
      LIMIT 10
    `, (err, allRows) => {
      if (err) {
        console.error('查询失败:', err);
        return;
      }
      
      console.log('📊 最近6小时的所有数据:');
      console.log('='.repeat(100));
      allRows.forEach(row => {
        console.log(`交易对: ${row.symbol}`);
        console.log(`市场类型: ${row.market_type}`);
        console.log(`执行信号: ${row.execution}`);
        console.log(`执行模式: ${row.execution_mode}`);
        console.log(`V3执行模式: ${row.execution_mode_v3}`);
        console.log(`下边界有效: ${row.range_lower_boundary_valid}`);
        console.log(`上边界有效: ${row.range_upper_boundary_valid}`);
        console.log(`错误信息: ${row.error_message}`);
        console.log(`时间: ${row.timestamp}`);
        console.log('-'.repeat(50));
      });
      
      db.close();
    });
  } else {
    db.close();
  }
});
