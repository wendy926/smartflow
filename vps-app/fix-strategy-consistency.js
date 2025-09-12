// fix-strategy-consistency.js - 修复策略逻辑与文档一致性问题
const DatabaseManager = require('./modules/database/DatabaseManager');
const FactorWeightManager = require('./modules/strategy/FactorWeightManager');

async function fixStrategyConsistency() {
  console.log('🔧 开始修复策略逻辑与文档一致性问题...');
  
  const db = new DatabaseManager();
  await db.init();
  
  const factorWeightManager = new FactorWeightManager(db);
  
  try {
    // 1. 更新数据库中的分类名称
    console.log('📝 更新分类名称映射...');
    
    // 更新symbol_categories表中的分类名称
    await db.run('UPDATE symbol_categories SET category = ? WHERE category = ?', ['high-cap-trending', 'highcap']);
    
    // 更新factor_weights表中的分类名称
    await db.run('UPDATE factor_weights SET category = ? WHERE category = ?', ['high-cap-trending', 'highcap']);
    
    console.log('✅ 分类名称更新完成');
    
    // 2. 验证权重配置
    console.log('📊 验证权重配置...');
    
    const categories = ['mainstream', 'high-cap-trending', 'trending', 'smallcap'];
    const analysisTypes = ['1h_scoring', '1h_boundary', '15m_execution'];
    
    for (const category of categories) {
      for (const analysisType of analysisTypes) {
        const weights = await factorWeightManager.getFactorWeights(category, analysisType);
        console.log(`${category} - ${analysisType}:`, weights);
      }
    }
    
    // 3. 测试资金费率阈值修复
    console.log('💰 测试资金费率阈值...');
    
    const testFundingRates = [0.0003, 0.0005, 0.0008, 0.001, 0.002];
    for (const rate of testFundingRates) {
      const score = factorWeightManager.calculateFactorScore('funding', rate, '1h_scoring');
      console.log(`资金费率 ${rate}: 得分 ${score}`);
    }
    
    console.log('✅ 策略一致性修复完成');
    
  } catch (error) {
    console.error('❌ 修复过程中出现错误:', error);
  } finally {
    await db.close();
  }
}

// 运行修复
if (require.main === module) {
  fixStrategyConsistency().catch(console.error);
}

module.exports = { fixStrategyConsistency };
