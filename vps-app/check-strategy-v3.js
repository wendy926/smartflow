#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('smartflow.db');

console.log('🔍 检查策略V3分析数据...');

// 检查 strategy_v3_analysis 表结构
db.all('PRAGMA table_info(strategy_v3_analysis)', (err, rows) => {
  if (err) {
    console.error('❌ 查询表结构失败:', err);
    return;
  }
  
  console.log('📊 strategy_v3_analysis 表结构:');
  rows.forEach(row => {
    console.log(`  ${row.name}: ${row.type}`);
  });
  
  // 查询最近的数据
  console.log('\n🔍 查询最近的策略V3分析数据...');
  db.all('SELECT * FROM strategy_v3_analysis ORDER BY timestamp DESC LIMIT 5', (err, dataRows) => {
    if (err) {
      console.error('❌ 查询数据失败:', err);
      return;
    }
    
    console.log('📊 最近的策略V3分析数据:');
    dataRows.forEach(row => {
      console.log(`  ${row.symbol}: 市场类型=${row.market_type}, 信号强度=${row.signal_strength}, 执行模式=${row.execution_mode} - ${row.timestamp}`);
    });
    
    db.close();
  });
});
