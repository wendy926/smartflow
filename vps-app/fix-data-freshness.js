#!/usr/bin/env node
/**
 * 修复数据新鲜度计算脚本
 * 重新计算所有交易对的数据新鲜度，基于实际K线数据时间
 */

const DatabaseManager = require('./modules/database/DatabaseManager');
const DataRefreshManager = require('./modules/data/DataRefreshManager');

async function fixDataFreshness() {
  console.log('🔧 开始修复数据新鲜度计算...');
  
  let dbManager;
  let dataRefreshManager;
  
  try {
    // 初始化数据库
    dbManager = new DatabaseManager();
    await dbManager.init();
    
    dataRefreshManager = new DataRefreshManager(dbManager);
    
    // 获取所有交易对
    const symbols = await dbManager.runQuery(`
      SELECT DISTINCT symbol FROM kline_data 
      ORDER BY symbol
    `);
    
    console.log(`📊 找到 ${symbols.length} 个交易对`);
    
    // 获取所有数据类型
    const dataTypes = Object.keys(dataRefreshManager.refreshIntervals);
    console.log(`📊 数据类型: ${dataTypes.join(', ')}`);
    
    let totalUpdated = 0;
    
    // 为每个交易对和数据类型重新计算新鲜度
    for (const { symbol } of symbols) {
      console.log(`\n🔄 处理交易对: ${symbol}`);
      
      for (const dataType of dataTypes) {
        try {
          // 计算基于K线数据的新鲜度
          const freshnessScore = await dataRefreshManager.calculateDataFreshnessScore(
            symbol, 
            dataType, 
            new Date().toISOString()
          );
          
          // 更新数据刷新日志
          await dataRefreshManager.updateRefreshTime(symbol, dataType, freshnessScore);
          
          console.log(`  ✅ ${dataType}: ${freshnessScore.toFixed(2)}%`);
          totalUpdated++;
          
        } catch (error) {
          console.error(`  ❌ ${dataType}: ${error.message}`);
        }
      }
    }
    
    console.log(`\n✅ 数据新鲜度修复完成！共更新 ${totalUpdated} 条记录`);
    
    // 显示修复后的统计
    console.log('\n📊 修复后的数据新鲜度统计:');
    const stats = await dataRefreshManager.getRefreshStats();
    for (const stat of stats) {
      console.log(`${stat.data_type}: 平均 ${stat.avg_freshness.toFixed(2)}%, 最低 ${stat.min_freshness.toFixed(2)}%, 最高 ${stat.max_freshness.toFixed(2)}%`);
    }
    
  } catch (error) {
    console.error('❌ 修复数据新鲜度失败:', error);
  } finally {
    if (dbManager) {
      await dbManager.close();
    }
  }
}

// 运行修复脚本
if (require.main === module) {
  fixDataFreshness().catch(console.error);
}

module.exports = { fixDataFreshness };
