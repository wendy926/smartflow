#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库路径
const dbPath = path.join(__dirname, 'smartflow.db');

console.log('🔍 检查模拟交易记录...');

// 打开数据库
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ 数据库连接失败:', err.message);
    process.exit(1);
  }
  console.log('✅ 数据库连接成功');
});

// 查询所有记录的时间分布
db.all(`
  SELECT 
    DATE(created_at) as date,
    COUNT(*) as count,
    MIN(created_at) as earliest,
    MAX(created_at) as latest
  FROM simulations 
  GROUP BY DATE(created_at)
  ORDER BY date DESC
  LIMIT 10
`, (err, rows) => {
  if (err) {
    console.error('❌ 查询失败:', err.message);
    db.close();
    process.exit(1);
  }
  
  console.log('\n📊 模拟交易记录时间分布:');
  console.log('日期\t\t记录数\t最早时间\t\t最晚时间');
  console.log('------------------------------------------------------------');
  
  rows.forEach(row => {
    console.log(`${row.date}\t${row.count}\t${row.earliest}\t${row.latest}`);
  });
  
  // 查询总记录数
  db.get(`
    SELECT COUNT(*) as total 
    FROM simulations
  `, (err, row) => {
    if (err) {
      console.error('❌ 查询总数失败:', err.message);
    } else {
      console.log(`\n📊 总记录数: ${row.total}`);
    }
    
    // 查询指定时间点之前的记录
    db.get(`
      SELECT COUNT(*) as count 
      FROM simulations 
      WHERE created_at < '2025-09-10 16:43:00'
    `, (err, row) => {
      if (err) {
        console.error('❌ 查询指定时间点失败:', err.message);
      } else {
        console.log(`📅 2025-09-10 16:43:00 之前的记录数: ${row.count}`);
      }
      
      db.close((err) => {
        if (err) {
          console.error('❌ 关闭数据库失败:', err.message);
        } else {
          console.log('✅ 检查完成');
        }
      });
    });
  });
});
