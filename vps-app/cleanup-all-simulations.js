#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库路径
const dbPath = path.join(__dirname, 'smartflow.db');

console.log('🗑️  开始清理所有历史模拟交易记录...');

// 打开数据库
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ 数据库连接失败:', err.message);
    process.exit(1);
  }
  console.log('✅ 数据库连接成功');
});

// 先查询记录数量
db.get(`
  SELECT COUNT(*) as count 
  FROM simulations
`, (err, row) => {
  if (err) {
    console.error('❌ 查询失败:', err.message);
    db.close();
    process.exit(1);
  }
  
  const totalCount = row.count;
  console.log(`📊 数据库中共有 ${totalCount} 条模拟交易记录`);
  
  if (totalCount === 0) {
    console.log('✅ 没有需要清理的记录');
    db.close();
    return;
  }
  
  // 确认删除
  console.log('⚠️  即将删除所有模拟交易记录，此操作不可恢复！');
  console.log('按 Ctrl+C 取消操作，或等待5秒后自动执行...');
  
  setTimeout(() => {
    // 执行删除操作
    db.run(`
      DELETE FROM simulations
    `, function(err) {
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
      `, (err, row) => {
        if (err) {
          console.error('❌ 验证失败:', err.message);
        } else {
          console.log(`📊 验证结果: 剩余 ${row.count} 条记录`);
        }
        
        // 重置自增ID
        db.run(`
          DELETE FROM sqlite_sequence WHERE name='simulations'
        `, (err) => {
          if (err) {
            console.warn('⚠️  重置自增ID失败:', err.message);
          } else {
            console.log('✅ 已重置自增ID');
          }
          
          db.close((err) => {
            if (err) {
              console.error('❌ 关闭数据库失败:', err.message);
            } else {
              console.log('✅ 清理完成');
            }
          });
        });
      });
    });
  }, 5000);
});
