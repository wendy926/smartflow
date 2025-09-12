/**
 * 修复交易对分类问题
 * 为缺失的交易对添加分类
 */

const DatabaseManager = require('./modules/database/DatabaseManager');

async function fixSymbolCategories() {
  const database = new DatabaseManager('./smartflow.db');
  await database.init();

  try {
    console.log('🔍 检查交易对分类...');

    // 获取所有交易对
    const customSymbols = await database.getCustomSymbols();
    console.log(`📊 总交易对数量: ${customSymbols.length}`);

    // 获取已有分类的交易对
    const existingCategories = await database.runQuery(`
      SELECT symbol, category FROM symbol_categories ORDER BY symbol
    `);
    console.log(`📊 已有分类的交易对数量: ${existingCategories.length}`);

    // 找出缺失分类的交易对
    const existingSymbols = new Set(existingCategories.map(row => row.symbol));
    const missingSymbols = customSymbols.filter(symbol => !existingSymbols.has(symbol));
    
    console.log(`❌ 缺失分类的交易对: ${missingSymbols.join(', ')}`);

    if (missingSymbols.length > 0) {
      console.log('🔧 开始添加缺失的交易对分类...');
      
      // 定义分类规则
      const categoryRules = {
        // 主流币
        'BTCUSDT': 'mainstream',
        'ETHUSDT': 'mainstream',
        
        // 高市值趋势币
        'SOLUSDT': 'high-cap-trending',
        'BNBUSDT': 'high-cap-trending',
        'AVAXUSDT': 'high-cap-trending',
        'ADAUSDT': 'high-cap-trending',
        'XRPUSDT': 'high-cap-trending',
        'DOGEUSDT': 'trending',
        'PUMPUSDT': 'high-cap-trending',
        
        // 热点币
        'LINKUSDT': 'trending',
        'AAVEUSDT': 'trending',
        'HYPEUSDT': 'trending',
        
        // 小币
        'LDOUSDT': 'smallcap',
        'SUIUSDT': 'smallcap',
        'TAOUSDT': 'smallcap',
        'ONDOUSDT': 'smallcap',
        'FETUSDT': 'smallcap',
        'ENAUSDT': 'smallcap',
        'TRXUSDT': 'smallcap',
        'XLMUSDT': 'smallcap',
        'LINEAUSDT': 'smallcap'
      };

      for (const symbol of missingSymbols) {
        const category = categoryRules[symbol] || 'smallcap'; // 默认为小币
        
        try {
          await database.runQuery(`
            INSERT INTO symbol_categories (symbol, category, created_at)
            VALUES (?, ?, datetime('now'))
          `, [symbol, category]);
          
          console.log(`  ✅ ${symbol} -> ${category}`);
        } catch (error) {
          console.error(`  ❌ 添加 ${symbol} 分类失败:`, error.message);
        }
      }
      
      console.log('✅ 分类添加完成！');
    } else {
      console.log('✅ 所有交易对都有分类');
    }

    // 验证修复结果
    console.log('\n🔍 验证修复结果...');
    const allCategories = await database.runQuery(`
      SELECT symbol, category FROM symbol_categories ORDER BY symbol
    `);
    console.log(`📊 修复后分类数量: ${allCategories.length}`);
    
    // 按分类统计
    const categoryStats = {};
    allCategories.forEach(row => {
      categoryStats[row.category] = (categoryStats[row.category] || 0) + 1;
    });
    
    console.log('📊 分类统计:');
    Object.entries(categoryStats).forEach(([category, count]) => {
      console.log(`  ${category}: ${count}个`);
    });

  } catch (error) {
    console.error('❌ 修复过程出错:', error);
  } finally {
    await database.close();
  }
}

// 运行修复脚本
if (require.main === module) {
  fixSymbolCategories().catch(console.error);
}

module.exports = { fixSymbolCategories };
