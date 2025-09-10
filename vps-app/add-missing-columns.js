#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库路径
const dbPath = path.join(__dirname, 'smartflow.db');

console.log('🔧 添加缺失的数据库字段...');

// 打开数据库
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ 数据库连接失败:', err.message);
    process.exit(1);
  }
  console.log('✅ 数据库连接成功');
});

// 添加缺失的字段
const alterQueries = [
  `ALTER TABLE simulations ADD COLUMN direction TEXT`,
  `ALTER TABLE simulations ADD COLUMN stop_loss_distance REAL`,
  `ALTER TABLE simulations ADD COLUMN atr_value REAL`
];

let completed = 0;
const total = alterQueries.length;

alterQueries.forEach((query, index) => {
  db.run(query, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log(`✅ 字段已存在: ${query.split(' ')[5]}`);
      } else {
        console.error(`❌ 添加字段失败: ${query}`, err.message);
      }
    } else {
      console.log(`✅ 成功添加字段: ${query.split(' ')[5]}`);
    }

    completed++;
    if (completed === total) {
      // 验证字段是否添加成功
      db.all(`PRAGMA table_info(simulations)`, (err, rows) => {
        if (err) {
          console.error('❌ 查询表结构失败:', err.message);
        } else {
          console.log('\n📊 更新后的simulations表结构:');
          console.log('列名\t\t类型\t\t非空\t默认值\t主键');
          console.log('--------------------------------------------------------');
          rows.forEach(row => {
            console.log(`${row.name}\t\t${row.type}\t\t${row.notnull}\t${row.dflt_value}\t${row.pk}`);
          });
        }

        db.close((err) => {
          if (err) {
            console.error('❌ 关闭数据库失败:', err.message);
          } else {
            console.log('✅ 字段添加完成');
          }
        });
      });
    }
  });
});
