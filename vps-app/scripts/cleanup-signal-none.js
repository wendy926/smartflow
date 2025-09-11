#!/usr/bin/env node

/**
 * 清理SIGNAL_NONE历史记录脚本
 * 功能：
 * 1. 删除所有trigger_reason为SIGNAL_NONE的模拟交易记录
 * 2. 这些记录不应该存在，因为SIGNAL_NONE不应该触发模拟交易
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库路径
const dbPath = path.join(__dirname, '..', 'smartflow.db');

async function cleanupSignalNoneRecords() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ 数据库连接失败:', err.message);
        reject(err);
        return;
      }
      console.log('✅ 数据库连接成功');
    });

    // 1. 先查询SIGNAL_NONE记录数量
    db.get("SELECT COUNT(*) as count FROM simulations WHERE trigger_reason = 'SIGNAL_NONE'", (err, row) => {
      if (err) {
        console.error('❌ 查询SIGNAL_NONE记录失败:', err.message);
        db.close();
        reject(err);
        return;
      }

      const signalNoneCount = row.count;
      console.log(`📊 发现 ${signalNoneCount} 条SIGNAL_NONE记录`);

      if (signalNoneCount === 0) {
        console.log('✅ 没有SIGNAL_NONE记录需要清理');
        db.close();
        resolve();
        return;
      }

      // 2. 显示要删除的记录详情
      console.log('\n📋 要删除的SIGNAL_NONE记录详情:');
      db.all("SELECT id, symbol, trigger_reason, status, profit_loss, created_at FROM simulations WHERE trigger_reason = 'SIGNAL_NONE' ORDER BY created_at DESC", (err, rows) => {
        if (err) {
          console.error('❌ 查询记录详情失败:', err.message);
          db.close();
          reject(err);
          return;
        }

        rows.forEach((row, index) => {
          console.log(`${index + 1}. ID:${row.id} ${row.symbol} - ${row.trigger_reason} - ${row.status} - 盈亏:${row.profit_loss} - 时间:${row.created_at}`);
        });

        // 3. 删除SIGNAL_NONE记录
        console.log('\n🗑️ 开始删除SIGNAL_NONE记录...');
        db.run("DELETE FROM simulations WHERE trigger_reason = 'SIGNAL_NONE'", function(err) {
          if (err) {
            console.error('❌ 删除SIGNAL_NONE记录失败:', err.message);
            db.close();
            reject(err);
            return;
          }

          console.log(`✅ 成功删除 ${this.changes} 条SIGNAL_NONE记录`);

          // 4. 验证删除结果
          db.get("SELECT COUNT(*) as count FROM simulations WHERE trigger_reason = 'SIGNAL_NONE'", (err, row) => {
            if (err) {
              console.error('❌ 验证删除结果失败:', err.message);
              db.close();
              reject(err);
              return;
            }

            const remainingCount = row.count;
            console.log(`📊 删除后剩余SIGNAL_NONE记录: ${remainingCount} 条`);

            if (remainingCount === 0) {
              console.log('✅ SIGNAL_NONE记录清理完成');
            } else {
              console.log('⚠️ 仍有SIGNAL_NONE记录未清理');
            }

            // 5. 显示清理后的总记录数
            db.get("SELECT COUNT(*) as total FROM simulations", (err, row) => {
              if (err) {
                console.error('❌ 查询总记录数失败:', err.message);
                db.close();
                reject(err);
                return;
              }

              console.log(`📊 清理后总模拟交易记录数: ${row.total} 条`);
              db.close();
              resolve();
            });
          });
        });
      });
    });
  });
}

// 执行清理
if (require.main === module) {
  cleanupSignalNoneRecords()
    .then(() => {
      console.log('\n🎉 SIGNAL_NONE历史记录清理完成！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 清理过程中发生错误:', error);
      process.exit(1);
    });
}

module.exports = { cleanupSignalNoneRecords };
