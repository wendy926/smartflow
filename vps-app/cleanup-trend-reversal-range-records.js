#!/usr/bin/env node

// 清理SIGNAL_区间空头 TREND_REVERSAL止损的模拟交易记录

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'smartflow.db');

async function cleanupTrendReversalRangeRecords() {
  const db = new sqlite3.Database(dbPath);

  try {
    console.log('🔍 检查SIGNAL_区间空头 TREND_REVERSAL止损的模拟交易记录...');

    // 检查有问题的记录
    const query = `
      SELECT id, symbol, direction, trigger_reason, exit_reason, market_type, execution_mode_v3, created_at
      FROM simulations
      WHERE exit_reason = 'TREND_REVERSAL' 
        AND (trigger_reason LIKE 'SIGNAL_区间%' OR execution_mode_v3 LIKE '区间%')
    `;

    const problematicRecords = await new Promise((resolve, reject) => {
      db.all(query, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    if (problematicRecords.length === 0) {
      console.log('✅ 没有发现SIGNAL_区间空头 TREND_REVERSAL止损的记录');
      return;
    }

    console.log(`⚠️ 发现 ${problematicRecords.length} 条有问题的记录:`);
    problematicRecords.forEach(record => {
      console.log(`   - ID: ${record.id}, Symbol: ${record.symbol}, Trigger: ${record.trigger_reason}, Exit: ${record.exit_reason}, Market: ${record.market_type}, Mode: ${record.execution_mode_v3}`);
    });

    // 确认删除
    console.log('\n🗑️ 开始清理有问题的记录...');

    for (const record of problematicRecords) {
      console.log(`   删除记录 ID: ${record.id}, Symbol: ${record.symbol}`);
      await new Promise((resolve, reject) => {
        db.run(`DELETE FROM simulations WHERE id = ?`, [record.id], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    console.log(`🎉 成功清理 ${problematicRecords.length} 条有问题的记录`);

    // 验证清理结果
    const remainingRecords = await new Promise((resolve, reject) => {
      db.all(query, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    if (remainingRecords.length === 0) {
      console.log('✅ 验证通过：所有有问题的记录已清理完成');
    } else {
      console.log(`⚠️ 仍有 ${remainingRecords.length} 条记录未清理`);
    }

  } catch (error) {
    console.error('❌ 清理过程中发生错误:', error);
  } finally {
    db.close((err) => {
      if (err) console.error('❌ 数据库关闭失败:', err.message);
      else console.log('✅ 数据库已关闭');
    });
  }
}

// 运行清理
cleanupTrendReversalRangeRecords().then(() => {
  console.log('🎉 清理任务完成');
  process.exit(0);
}).catch(error => {
  console.error('❌ 清理任务失败:', error);
  process.exit(1);
});
