#!/usr/bin/env node

/**
 * 修复数据库中超过100%的新鲜度数据
 * 将超过100%的数据重新计算为100%
 */

const DatabaseManager = require('./modules/database/DatabaseManager');
const DataRefreshManager = require('./modules/data/DataRefreshManager');

async function fixFreshnessOver100() {
  try {
    console.log('🔧 开始修复超过100%的新鲜度数据...');
    
    const db = new DatabaseManager();
    const manager = new DataRefreshManager(db);
    
    // 查找所有超过100%的数据
    const over100Data = await db.runQuery(`
      SELECT symbol, data_type, data_freshness_score, last_update
      FROM data_refresh_log 
      WHERE data_freshness_score > 100
      ORDER BY data_freshness_score DESC
    `);
    
    console.log(`📊 发现 ${over100Data.length} 条超过100%的数据`);
    
    if (over100Data.length === 0) {
      console.log('✅ 没有需要修复的数据');
      return;
    }
    
    // 显示前5条数据
    console.log('\n📋 超过100%的数据示例:');
    over100Data.slice(0, 5).forEach((row, index) => {
      console.log(`${index + 1}. ${row.symbol} - ${row.data_type}: ${row.data_freshness_score}% (更新于: ${row.last_update})`);
    });
    
    // 重新计算这些数据的新鲜度
    let fixedCount = 0;
    for (const row of over100Data) {
      try {
        const newFreshness = await manager.calculateDataFreshnessScore(
          row.symbol, 
          row.data_type, 
          row.last_update
        );
        
        // 更新数据库
        await db.run(`
          UPDATE data_refresh_log 
          SET data_freshness_score = ?
          WHERE symbol = ? AND data_type = ?
        `, [newFreshness, row.symbol, row.data_type]);
        
        console.log(`✅ 修复 ${row.symbol} - ${row.data_type}: ${row.data_freshness_score}% → ${newFreshness}%`);
        fixedCount++;
        
      } catch (error) {
        console.error(`❌ 修复失败 ${row.symbol} - ${row.data_type}:`, error.message);
      }
    }
    
    console.log(`\n🎉 修复完成！共修复 ${fixedCount} 条数据`);
    
    // 验证修复结果
    const remainingOver100 = await db.runQuery(`
      SELECT COUNT(*) as count FROM data_refresh_log WHERE data_freshness_score > 100
    `);
    
    console.log(`📊 修复后超过100%的数据数量: ${remainingOver100[0].count}`);
    
    // 显示修复后的统计
    const stats = await manager.getRefreshStats();
    console.log('\n📈 修复后的新鲜度统计:');
    stats.forEach(stat => {
      console.log(`${stat.data_type}: 平均 ${stat.avg_freshness.toFixed(2)}%, 最高 ${stat.max_freshness.toFixed(2)}%, 最低 ${stat.min_freshness.toFixed(2)}%`);
    });
    
  } catch (error) {
    console.error('❌ 修复过程失败:', error);
  } finally {
    process.exit(0);
  }
}

// 运行修复脚本
fixFreshnessOver100();
