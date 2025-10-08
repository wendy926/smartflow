/**
 * V3策略增强版信号融合测试
 * 验证补偿机制和动态调整效果
 */

const V3StrategyEnhanced = require('../src/strategies/v3-strategy-enhanced');

function testSignalFusion() {
  console.log('🧪 开始V3策略增强版信号融合测试...\n');

  const strategy = new V3StrategyEnhanced();

  // 测试用例1：ETHUSDT实际数据（之前无法触发信号）
  console.log('=== 测试用例1：ETHUSDT实际数据 ===');
  const ethusdtData = {
    trend4H: { trend: 'UP', score: 8, trendDirection: 'UP' },
    factors1H: { score: 4, totalScore: 4 },
    execution15M: { score: 4, structureScore: 2 }
  };

  const ethusdtSignal = strategy.combineSignals(
    ethusdtData.trend4H,
    ethusdtData.factors1H,
    ethusdtData.execution15M
  );
  console.log(`ETHUSDT信号结果: ${ethusdtSignal}\n`);

  // 测试用例2：强信号场景
  console.log('=== 测试用例2：强信号场景 ===');
  const strongData = {
    trend4H: { trend: 'UP', score: 9, trendDirection: 'UP' },
    factors1H: { score: 5, totalScore: 5 },
    execution15M: { score: 5, structureScore: 2 }
  };

  const strongSignal = strategy.combineSignals(
    strongData.trend4H,
    strongData.factors1H,
    strongData.execution15M
  );
  console.log(`强信号结果: ${strongSignal}\n`);

  // 测试用例3：中等信号场景
  console.log('=== 测试用例3：中等信号场景 ===');
  const moderateData = {
    trend4H: { trend: 'UP', score: 6, trendDirection: 'UP' },
    factors1H: { score: 4, totalScore: 4 },
    execution15M: { score: 3, structureScore: 1 }
  };

  const moderateSignal = strategy.combineSignals(
    moderateData.trend4H,
    moderateData.factors1H,
    moderateData.execution15M
  );
  console.log(`中等信号结果: ${moderateSignal}\n`);

  // 测试用例4：弱信号场景
  console.log('=== 测试用例4：弱信号场景 ===');
  const weakData = {
    trend4H: { trend: 'UP', score: 5, trendDirection: 'UP' },
    factors1H: { score: 3, totalScore: 3 },
    execution15M: { score: 2, structureScore: 1 }
  };

  const weakSignal = strategy.combineSignals(
    weakData.trend4H,
    weakData.factors1H,
    weakData.execution15M
  );
  console.log(`弱信号结果: ${weakSignal}\n`);

  // 测试用例5：信号死区场景（高分但因子不足）
  console.log('=== 测试用例5：信号死区场景 ===');
  const deadZoneData = {
    trend4H: { trend: 'UP', score: 8, trendDirection: 'UP' },
    factors1H: { score: 3, totalScore: 3 }, // 因子不足
    execution15M: { score: 4, structureScore: 2 }
  };

  const deadZoneSignal = strategy.combineSignals(
    deadZoneData.trend4H,
    deadZoneData.factors1H,
    deadZoneData.execution15M
  );
  console.log(`信号死区结果: ${deadZoneSignal}\n`);

  // 测试用例6：震荡趋势
  console.log('=== 测试用例6：震荡趋势 ===');
  const rangeData = {
    trend4H: { trend: 'RANGE', score: 3, trendDirection: 'RANGE' },
    factors1H: { score: 4, totalScore: 4 },
    execution15M: { score: 4, structureScore: 2 }
  };

  const rangeSignal = strategy.combineSignals(
    rangeData.trend4H,
    rangeData.factors1H,
    rangeData.execution15M
  );
  console.log(`震荡趋势结果: ${rangeSignal}\n`);

  // 测试动态权重计算
  console.log('=== 动态权重测试 ===');
  const weights1 = strategy.calculateDynamicWeights(8, 4, 4); // 趋势很强
  const weights2 = strategy.calculateDynamicWeights(6, 5, 3); // 因子很强
  const weights3 = strategy.calculateDynamicWeights(7, 4, 4); // 入场很强
  const weights4 = strategy.calculateDynamicWeights(7, 4, 3); // 平衡

  console.log('趋势很强权重:', weights1);
  console.log('因子很强权重:', weights2);
  console.log('入场很强权重:', weights3);
  console.log('平衡权重:', weights4);
  console.log('');

  // 测试补偿机制
  console.log('=== 补偿机制测试 ===');
  const comp1 = strategy.calculateCompensation(80, 8, 4, 4); // 高分+强趋势
  const comp2 = strategy.calculateCompensation(75, 7, 4, 4); // 中高分+中强趋势
  const comp3 = strategy.calculateCompensation(70, 6, 4, 4); // 中等分+中等趋势

  console.log('高分+强趋势补偿:', comp1);
  console.log('中高分+中强趋势补偿:', comp2);
  console.log('中等分+中等趋势补偿:', comp3);
  console.log('');

  // 测试调整后门槛
  console.log('=== 调整后门槛测试 ===');
  const threshold1 = strategy.getAdjustedFactorThreshold(80, 8, 1.5);
  const threshold2 = strategy.getAdjustedFactorThreshold(75, 7, 1);
  const threshold3 = strategy.getAdjustedFactorThreshold(70, 6, 0.5);

  console.log('高分+强趋势门槛:', threshold1);
  console.log('中高分+中强趋势门槛:', threshold2);
  console.log('中等分+中等趋势门槛:', threshold3);

  console.log('\n✅ 所有测试完成！');
}

// 运行测试
testSignalFusion();
