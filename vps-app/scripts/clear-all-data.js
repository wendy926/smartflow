#!/usr/bin/env node

/**
 * 清空所有相关数据的脚本
 * 包括：simulations表、win_rate_stats表、strategy_v3_analysis表等
 */

const DatabaseManager = require('../modules/database/DatabaseManager');

async function clearAllData() {
  console.log('🧹 开始清空所有相关数据...');
  
  try {
    const dbManager = new DatabaseManager();
    await dbManager.initialize();
    
    // 清空所有相关表
    const tablesToClear = [
      'simulations',
      'win_rate_stats', 
      'strategy_v3_analysis',
      'analysis_logs',
      'data_quality_issues',
      'validation_results'
    ];
    
    for (const table of tablesToClear) {
      try {
        const result = await dbManager.runQuery(`DELETE FROM ${table}`);
        console.log(`✅ 已清空表 ${table}: 删除了 ${result.changes || 0} 条记录`);
      } catch (error) {
        console.warn(`⚠️ 清空表 ${table} 失败: ${error.message}`);
      }
    }
    
    // 重置win_rate_stats表，插入默认记录
    try {
      await dbManager.runQuery(`
        INSERT INTO win_rate_stats (total_trades, winning_trades, losing_trades, win_rate, total_profit, total_loss, net_profit, last_updated)
        VALUES (0, 0, 0, 0, 0, 0, 0, datetime('now'))
      `);
      console.log('✅ 已重置win_rate_stats表为默认值');
    } catch (error) {
      console.warn(`⚠️ 重置win_rate_stats表失败: ${error.message}`);
    }
    
    // 执行VACUUM优化数据库
    await dbManager.runQuery('VACUUM');
    console.log('✅ 已执行数据库VACUUM优化');
    
    console.log('🎉 所有数据清空完成！');
    
  } catch (error) {
    console.error('❌ 清空数据失败:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// 运行脚本
clearAllData();
