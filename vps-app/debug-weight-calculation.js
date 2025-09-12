// debug-weight-calculation.js - 调试权重计算问题
const DatabaseManager = require('./modules/database/DatabaseManager');
const FactorWeightManager = require('./modules/strategy/FactorWeightManager');

async function debugWeightCalculation() {
  try {
    console.log('🔍 开始调试权重计算问题...\n');

    // 初始化数据库
    const db = new DatabaseManager('./smartflow.db');
    await db.init();

    // 初始化权重管理器
    const factorWeightManager = new FactorWeightManager(db);

    const symbol = 'BNBUSDT';
    const analysisType = '1h_scoring';

    console.log(`📊 调试交易对: ${symbol}`);
    console.log('='.repeat(50));

    // 1. 检查分类
    const category = await factorWeightManager.getSymbolCategory(symbol);
    console.log(`分类: ${category || '未分类'}`);

    // 2. 检查权重配置
    const weights = await factorWeightManager.getFactorWeights(category, analysisType);
    console.log(`权重配置:`, weights);

    // 3. 模拟因子数据（使用实际数值）
    const factorValues = {
      vwap: true,        // VWAP方向一致（布尔值）
      breakout: false,   // 突破失败（布尔值）
      volume: 1.3,       // 成交量比率（数值）
      oi: 0.015,         // OI变化（数值）
      funding: 0.0008,   // 资金费率（数值）
      delta: 0.05        // Delta不平衡（数值）
    };

    console.log(`因子数据:`, factorValues);

    // 4. 计算各因子得分
    console.log('\n各因子得分详情:');
    for (const [factor, value] of Object.entries(factorValues)) {
      if (weights && weights[factor]) {
        const factorScore = factorWeightManager.calculateFactorScore(factor, value, analysisType);
        const weightedScore = factorScore * weights[factor];
        console.log(`  ${factor}: 值=${value}, 权重=${weights[factor]}, 得分=${factorScore}, 加权得分=${weightedScore}`);
      } else {
        console.log(`  ${factor}: 值=${value}, 权重=未配置`);
      }
    }

    // 5. 计算加权得分
    const weightedResult = await factorWeightManager.calculateWeightedScore(
      symbol,
      analysisType,
      factorValues
    );

    console.log(`\n加权得分结果:`, weightedResult);

    await db.close();
    console.log('\n✅ 调试完成');

  } catch (error) {
    console.error('❌ 调试失败:', error);
  }
}

// 运行调试
debugWeightCalculation();
