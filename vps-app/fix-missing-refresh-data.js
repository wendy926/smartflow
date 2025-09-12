/**
 * 修复缺失的数据刷新记录
 * 确保所有交易对都有数据刷新记录
 */

const DatabaseManager = require('./modules/database/DatabaseManager');
const DataRefreshManager = require('./modules/data/DataRefreshManager');

async function fixMissingRefreshData() {
  const database = new DatabaseManager('./smartflow.db');
  await database.init();
  const dataRefreshManager = new DataRefreshManager(database);

  try {
    console.log('🔍 检查缺失的数据刷新记录...');

    // 获取所有交易对
    const customSymbols = await database.getCustomSymbols();
    console.log(`📊 总交易对数量: ${customSymbols.length}`);

    // 获取数据刷新日志中的交易对
    const refreshLogSymbols = await database.runQuery(`
      SELECT DISTINCT symbol FROM data_refresh_log ORDER BY symbol
    `);
    console.log(`📊 数据刷新日志中的交易对数量: ${refreshLogSymbols.length}`);

    // 找出缺失的交易对
    const refreshSymbolsSet = new Set(refreshLogSymbols.map(r => r.symbol));
    const missingSymbols = customSymbols.filter(symbol => !refreshSymbolsSet.has(symbol));
    
    console.log(`❌ 缺失的交易对: ${missingSymbols.join(', ')}`);

    if (missingSymbols.length > 0) {
      console.log('🔧 开始修复缺失的数据刷新记录...');
      
      for (const symbol of missingSymbols) {
        console.log(`处理交易对: ${symbol}`);
        
        try {
          // 为缺失的交易对创建数据刷新记录
          const dataTypes = [
            'trend_analysis',
            'trend_scoring',
            'trend_strength', 
            'trend_entry',
            'range_boundary',
            'range_entry'
          ];

          for (const dataType of dataTypes) {
            await dataRefreshManager.updateRefreshTime(symbol, dataType, 0); // 设置为过期状态
            console.log(`  ✅ 已创建 ${dataType} 记录`);
          }
        } catch (error) {
          console.error(`  ❌ 处理 ${symbol} 失败:`, error.message);
        }
      }
      
      console.log('✅ 修复完成！');
    } else {
      console.log('✅ 所有交易对都有数据刷新记录');
    }

    // 验证修复结果
    console.log('\n🔍 验证修复结果...');
    const newRefreshLogSymbols = await database.runQuery(`
      SELECT DISTINCT symbol FROM data_refresh_log ORDER BY symbol
    `);
    console.log(`📊 修复后数据刷新日志中的交易对数量: ${newRefreshLogSymbols.length}`);
    
    const newRefreshSymbolsSet = new Set(newRefreshLogSymbols.map(r => r.symbol));
    const stillMissingSymbols = customSymbols.filter(symbol => !newRefreshSymbolsSet.has(symbol));
    
    if (stillMissingSymbols.length === 0) {
      console.log('✅ 所有交易对都已修复！');
    } else {
      console.log(`❌ 仍有缺失的交易对: ${stillMissingSymbols.join(', ')}`);
    }

  } catch (error) {
    console.error('❌ 修复过程出错:', error);
  } finally {
    await database.close();
  }
}

// 运行修复脚本
if (require.main === module) {
  fixMissingRefreshData().catch(console.error);
}

module.exports = { fixMissingRefreshData };
