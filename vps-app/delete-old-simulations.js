#!/usr/bin/env node

/**
 * 删除2025/09/10 16:00以前的模拟交易记录
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库路径
const dbPath = path.join(__dirname, 'smartflow.db');

// 创建数据库连接
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ 数据库连接失败:', err.message);
    process.exit(1);
  }
  console.log('✅ 数据库连接成功');
});

async function deleteOldSimulations() {
  try {
    // 先查看要删除的记录
    console.log('🔍 查询2025/09/10 16:00以前的模拟交易记录...');

    const countResult = await new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as count FROM simulations 
         WHERE created_at < '2025-09-10 16:00:00'`,
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    console.log(`📊 找到 ${countResult.count} 条需要删除的记录`);

    if (countResult.count === 0) {
      console.log('✅ 没有需要删除的记录');
      return;
    }

    // 显示要删除的记录详情
    const records = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, symbol, direction, created_at, status, exit_reason, is_win, profit_loss 
         FROM simulations 
         WHERE created_at < '2025-09-10 16:00:00'
         ORDER BY created_at DESC
         LIMIT 10`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    console.log('\n📋 要删除的记录示例（前10条）:');
    console.table(records);

    // 确认删除
    console.log('\n⚠️  即将删除这些记录，此操作不可逆！');
    console.log('按 Ctrl+C 取消，或等待5秒后自动执行...');

    await new Promise(resolve => setTimeout(resolve, 5000));

    // 执行删除
    console.log('\n🗑️  开始删除记录...');

    const deleteResult = await new Promise((resolve, reject) => {
      db.run(
        `DELETE FROM simulations 
         WHERE created_at < '2025-09-10 16:00:00'`,
        function (err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });

    console.log(`✅ 成功删除 ${deleteResult.changes} 条记录`);

    // 验证删除结果
    const remainingCount = await new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as count FROM simulations`,
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    console.log(`📊 删除后剩余记录数: ${remainingCount.count}`);

    // 显示最新的几条记录
    const latestRecords = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, symbol, direction, created_at, status 
         FROM simulations 
         ORDER BY created_at DESC
         LIMIT 5`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    console.log('\n📋 最新的记录（删除后）:');
    console.table(latestRecords);

  } catch (error) {
    console.error('❌ 删除操作失败:', error.message);
    process.exit(1);
  } finally {
    // 关闭数据库连接
    db.close((err) => {
      if (err) {
        console.error('❌ 关闭数据库失败:', err.message);
      } else {
        console.log('✅ 数据库连接已关闭');
      }
    });
  }
}

// 执行删除操作
deleteOldSimulations().catch(console.error);
