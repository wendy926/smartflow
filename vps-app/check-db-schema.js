#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库路径
const dbPath = path.join(__dirname, 'smartflow.db');

console.log('🔍 检查数据库表结构...');

// 打开数据库
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ 数据库连接失败:', err.message);
    process.exit(1);
  }
  console.log('✅ 数据库连接成功');
});

// 查询表结构
db.all(`
  PRAGMA table_info(simulations)
`, (err, rows) => {
  if (err) {
    console.error('❌ 查询表结构失败:', err.message);
    db.close();
    process.exit(1);
  }

  console.log('\n📊 simulations表结构:');
  console.log('列名\t\t类型\t\t非空\t默认值\t主键');
  console.log('--------------------------------------------------------');
  rows.forEach(row => {
    console.log(`${row.name}\t\t${row.type}\t\t${row.notnull}\t${row.dflt_value}\t${row.pk}`);
  });

  // 查询最近几条记录
  db.all(`
    SELECT * FROM simulations 
    ORDER BY created_at DESC 
    LIMIT 3
  `, (err, records) => {
    if (err) {
      console.error('❌ 查询记录失败:', err.message);
    } else {
      console.log('\n📊 最近3条记录:');
      records.forEach((record, index) => {
        console.log(`\n记录 ${index + 1}:`);
        Object.keys(record).forEach(key => {
          console.log(`  ${key}: ${record[key]}`);
        });
      });
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
