#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('smartflow.db');

console.log('🔍 查询震荡市15min信号数据...');

// 查询震荡市信号
db.all(`
  SELECT 
    symbol, 
    market_type, 
    signal_strength, 
    execution_mode_v3, 
    timestamp,
    range_boundary_result
  FROM strategy_execution_log 
  WHERE market_type = '震荡市' 
    AND signal_strength IS NOT NULL 
  ORDER BY timestamp DESC 
  LIMIT 10
`, (err, rows) => {
  if (err) {
    console.error('❌ 查询失败:', err);
    return;
  }
  
  console.log('📊 震荡市信号数据:');
  rows.forEach(row => {
    console.log(`  ${row.symbol}: ${row.signal_strength} (${row.execution_mode_v3}) - ${row.timestamp}`);
    if (row.range_boundary_result) {
      try {
        const boundary = JSON.parse(row.range_boundary_result);
        console.log(`    边界结果: 总分=${boundary.totalScore}, 下边界=${boundary.lowerBoundaryValid}, 上边界=${boundary.upperBoundaryValid}`);
      } catch (e) {
        console.log(`    边界结果: ${row.range_boundary_result}`);
      }
    }
  });
  
  // 查询最近的震荡市边界判断结果
  console.log('\n🔍 查询震荡市边界判断结果...');
  db.all(`
    SELECT 
      symbol,
      range_boundary_result,
      timestamp
    FROM strategy_execution_log 
    WHERE market_type = '震荡市' 
      AND range_boundary_result IS NOT NULL
    ORDER BY timestamp DESC 
    LIMIT 5
  `, (err, boundaryRows) => {
    if (err) {
      console.error('❌ 边界查询失败:', err);
      return;
    }
    
    console.log('📊 震荡市边界判断结果:');
    boundaryRows.forEach(row => {
      try {
        const boundary = JSON.parse(row.range_boundary_result);
        console.log(`  ${row.symbol}: 总分=${boundary.totalScore}, 下边界=${boundary.lowerBoundaryValid}, 上边界=${boundary.upperBoundaryValid} - ${row.timestamp}`);
      } catch (e) {
        console.log(`  ${row.symbol}: ${row.range_boundary_result} - ${row.timestamp}`);
      }
    });
    
    db.close();
  });
});
