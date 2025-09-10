#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库路径
const dbPath = path.join(__dirname, 'smartflow.db');

// 删除时间点
const deleteBefore = '2025-09-10 16:43:00';

console.log('🗑️  开始删除模拟交易记录...');
console.log(`📅 删除时间点: ${deleteBefore}`);

// 打开数据库
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ 数据库连接失败:', err.message);
    process.exit(1);
  }
  console.log('✅ 数据库连接成功');
});

// 先查询要删除的记录数量
db.get(`
  SELECT COUNT(*) as count 
  FROM simulations 
  WHERE created_at < ?
`, [deleteBefore], (err, row) => {
  if (err) {
    console.error('❌ 查询失败:', err.message);
    db.close();
    process.exit(1);
  }
  
  const count = row.count;
  console.log(`📊 找到 ${count} 条需要删除的记录`);
  
  if (count === 0) {
    console.log('✅ 没有需要删除的记录');
    db.close();
    return;
  }
  
  // 执行删除操作
  db.run(`
    DELETE FROM simulations
    WHERE created_at < ?
  `, [deleteBefore], function(err) {
    if (err) {
      console.error('❌ 删除失败:', err.message);
      db.close();
      process.exit(1);
    }
    
    console.log(`✅ 成功删除 ${this.changes} 条记录`);
    
    // 验证删除结果
    db.get(`
      SELECT COUNT(*) as count 
      FROM simulations 
      WHERE created_at < ?
    `, [deleteBefore], (err, row) => {
      if (err) {
        console.error('❌ 验证失败:', err.message);
      } else {
        console.log(`📊 验证结果: 剩余 ${row.count} 条记录在删除时间点之前`);
      }
      
      // 显示剩余记录总数
      db.get(`
        SELECT COUNT(*) as total 
        FROM simulations
      `, (err, row) => {
        if (err) {
          console.error('❌ 查询总数失败:', err.message);
        } else {
          console.log(`📊 数据库中共有 ${row.total} 条模拟交易记录`);
        }
        
        db.close((err) => {
          if (err) {
            console.error('❌ 关闭数据库失败:', err.message);
          } else {
            console.log('✅ 数据库操作完成');
          }
        });
      });
    });
  });
});
