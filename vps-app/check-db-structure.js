#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('smartflow.db');

console.log('🔍 检查数据库表结构...');

// 检查 range_boundary_analysis 表结构
db.all('PRAGMA table_info(range_boundary_analysis)', (err, rows) => {
  if (err) {
    console.error('❌ 查询表结构失败:', err);
    return;
  }
  
  console.log('📊 range_boundary_analysis 表结构:');
  rows.forEach(row => {
    console.log(`  ${row.name}: ${row.type}`);
  });
  
  // 查询最近的数据
  console.log('\n🔍 查询最近的边界分析数据...');
  db.all('SELECT * FROM range_boundary_analysis ORDER BY timestamp DESC LIMIT 5', (err, dataRows) => {
    if (err) {
      console.error('❌ 查询数据失败:', err);
      return;
    }
    
    console.log('📊 最近的边界分析数据:');
    dataRows.forEach(row => {
      console.log(`  ${row.symbol}: 总分=${row.total_score}, 下边界=${row.lower_boundary_valid}, 上边界=${row.upper_boundary_valid} - ${row.timestamp}`);
    });
    
    db.close();
  });
});
