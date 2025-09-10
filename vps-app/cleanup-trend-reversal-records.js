#!/usr/bin/env node

// 清理有问题的历史模拟交易记录
// 删除TREND_REVERSAL + SIGNAL_区间空头的记录

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'smartflow.db');

async function cleanupTrendReversalRecords() {
  const db = new sqlite3.Database(dbPath);

  try {
    console.log('🔍 检查有问题的模拟交易记录...');

    // 查找TREND_REVERSAL + SIGNAL_区间空头的记录
    const problematicRecords = await new Promise((resolve, reject) => {
      db.all(`
        SELECT id, symbol, direction, trigger_reason, exit_reason, market_type, created_at
        FROM simulations 
        WHERE exit_reason = 'TREND_REVERSAL' 
        AND trigger_reason LIKE '%区间%'
        ORDER BY created_at DESC
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    if (problematicRecords.length === 0) {
      console.log('✅ 没有发现TREND_REVERSAL + SIGNAL_区间空头的记录');
      return;
    }

    console.log(`❌ 发现 ${problematicRecords.length} 条有问题的记录:`);
    problematicRecords.forEach(record => {
      console.log(`  - ID: ${record.id}, ${record.symbol}, ${record.direction}, ${record.trigger_reason} -> ${record.exit_reason}, 市场类型: ${record.market_type || 'NULL'}, 时间: ${record.created_at}`);
    });

    // 删除这些记录
    const deleteResult = await new Promise((resolve, reject) => {
      db.run(`
        DELETE FROM simulations 
        WHERE exit_reason = 'TREND_REVERSAL' 
        AND trigger_reason LIKE '%区间%'
      `, function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });

    console.log(`✅ 已删除 ${deleteResult} 条有问题的记录`);

    // 检查是否还有其他TREND_REVERSAL记录
    const remainingTrendReversal = await new Promise((resolve, reject) => {
      db.all(`
        SELECT COUNT(*) as count FROM simulations 
        WHERE exit_reason = 'TREND_REVERSAL'
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows[0].count);
      });
    });

    console.log(`📊 剩余TREND_REVERSAL记录数量: ${remainingTrendReversal}`);

    // 检查震荡市记录
    const rangeMarketRecords = await new Promise((resolve, reject) => {
      db.all(`
        SELECT COUNT(*) as count FROM simulations 
        WHERE trigger_reason LIKE '%区间%'
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows[0].count);
      });
    });

    console.log(`📊 震荡市记录数量: ${rangeMarketRecords}`);

  } catch (error) {
    console.error('❌ 清理记录时出错:', error);
  } finally {
    db.close();
  }
}

// 运行清理
cleanupTrendReversalRecords().then(() => {
  console.log('🎉 清理完成');
  process.exit(0);
}).catch(error => {
  console.error('❌ 清理失败:', error);
  process.exit(1);
});
