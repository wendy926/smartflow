const SafeDatabaseManager = require('./modules/database/SafeDatabaseManager');
const StrategyV3Core = require('./modules/strategy/StrategyV3Core');

async function testETHUSDTSafe() {
  const safeDB = new SafeDatabaseManager();
  let strategyCore = null;

  try {
    console.log('🔧 使用安全数据库连接...');

    // 使用安全方法创建策略实例
    strategyCore = await safeDB.createStrategyInstance(StrategyV3Core);

    console.log('🔍 分析ETHUSDT 4H趋势...');
    const result = await strategyCore.analyze4HTrend('ETHUSDT');

    console.log('\n📊 分析结果:');
    console.log('趋势:', result.trend4h);
    console.log('市场类型:', result.marketType);
    console.log('MA20:', result.ma20?.toFixed(2));
    console.log('MA50:', result.ma50?.toFixed(2));
    console.log('MA200:', result.ma200?.toFixed(2));
    console.log('多头得分:', result.bullScore);
    console.log('空头得分:', result.bearScore);
    console.log('总得分:', result.score);

    // 验证结果
    if (result.trend4h === '多头趋势') {
      console.log('\n✅ ETHUSDT趋势判断正确: 多头趋势');
    } else {
      console.log(`\n❌ ETHUSDT趋势判断错误: 期望多头趋势，实际${result.trend4h}`);
    }

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  } finally {
    // 安全清理资源
    if (strategyCore) {
      await strategyCore.destroy();
    }

    console.log('🔒 资源清理完成');
    console.log('📊 数据库连接状态:', safeDB.getStatus());
  }
}

testETHUSDTSafe();
