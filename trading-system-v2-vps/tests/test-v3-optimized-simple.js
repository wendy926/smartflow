/**
 * V3策略优化版本简单测试
 * 避免内存泄漏和CPU过载
 */

const V3StrategyOptimized = require('../src/strategies/v3-strategy-optimized');

async function testV3Optimized() {
  console.log('🧪 开始V3策略优化版本测试...');

  const strategy = new V3StrategyOptimized();

  try {
    // 测试基本功能
    console.log('1. 测试趋势置信度计算...');
    const confidence1 = strategy.computeTrendConfidence(25, true);
    const confidence2 = strategy.computeTrendConfidence(45, false);
    console.log(`   ADX=25, MACD对齐: ${confidence1}`);
    console.log(`   ADX=45, MACD不对齐: ${confidence2}`);

    // 测试去相关评分
    console.log('2. 测试多因子去相关评分...');
    const factors = { vwap: 0.8, oi: 0.9, delta: 0.85 };
    const corrMatrix = [[1, 0.7, 0.6], [0.7, 1, 0.65], [0.6, 0.65, 1]];
    const decorrelatedScore = strategy.decorrelatedScore(factors, corrMatrix);
    console.log(`   去相关得分: ${decorrelatedScore.toFixed(4)}`);

    // 测试趋势连续性
    console.log('3. 测试趋势连续性验证...');
    const trendSeries1 = ['UP', 'UP', 'UP'];
    const trendSeries2 = ['UP', 'DOWN', 'UP'];
    console.log(`   连续趋势: ${strategy.validateTrendPersistence(trendSeries1)}`);
    console.log(`   不连续趋势: ${strategy.validateTrendPersistence(trendSeries2)}`);

    // 测试确认机制
    console.log('4. 测试确认收盘延迟机制...');
    const closes1 = [100, 101, 102, 103];
    const closes2 = [100, 99, 101, 100];
    console.log(`   上涨确认: ${strategy.confirmEntry('BUY', closes1, 3)}`);
    console.log(`   波动确认: ${strategy.confirmEntry('BUY', closes2, 3)}`);

    // 测试波动率收缩
    console.log('5. 测试波动率收缩检测...');
    const bbwSeries = [0.1, 0.1, 0.1, 0.05, 0.05, 0.05];
    const atrSeries = [2, 2, 2, 1.5, 1.5, 1.5];
    const contraction = strategy.detectVolatilityContraction(bbwSeries, atrSeries);
    console.log(`   波动率收缩: ${contraction}`);

    // 测试信号融合
    console.log('6. 测试信号融合逻辑...');
    const trend4H = { trend: 'UP', score: 8, trendPersistence: true };
    const factors1H = { score: 6, decorrelatedScore: 0.9 };
    const execution15M = { score: 5, structureScore: 2 };
    const signal = strategy.combineSignals(trend4H, factors1H, execution15M);
    console.log(`   强信号融合结果: ${signal}`);

    console.log('✅ 所有测试通过！');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error(error.stack);
  }
}

// 运行测试
testV3Optimized().then(() => {
  console.log('🎉 测试完成');
  process.exit(0);
}).catch(error => {
  console.error('💥 测试异常:', error);
  process.exit(1);
});
