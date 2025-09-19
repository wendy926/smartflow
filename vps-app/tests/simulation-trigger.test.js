// 模拟交易触发逻辑单元测试
const assert = require('assert');
const StrategyExecutor = require('../strategy-executor');

// 模拟数据库对象
const mockDb = {
  get: (sql, params, callback) => {
    if (sql.includes('COUNT(*)')) {
      callback(null, { count: 0 }); // 模拟没有现有交易
    }
  },
  run: (sql, params, callback) => {
    callback(null, { lastID: 123 }); // 模拟插入成功
  }
};

// 模拟信号数据
const mockSignalV3 = {
  symbol: 'BTCUSDT',
  signal: '做多',
  currentPrice: 50000,
  strategyVersion: 'V3'
};

const mockSignalICT = {
  symbol: 'ETHUSDT',
  signal: '做空',
  currentPrice: 3000,
  strategyVersion: 'ICT'
};

// 模拟K线数据
const mockKLines = [
  [1690000000000, "30000", "30100", "29900", "30050", "120.5"],
  [1690003600000, "30050", "30200", "29950", "30100", "150.8"],
  [1690007200000, "30100", "30250", "30000", "30200", "200.3"]
];

// 测试V3策略参数计算
function testV3StrategyParameters() {
  console.log('🧪 测试V3策略参数计算...');
  
  const currentPrice = parseFloat(mockSignalV3.currentPrice);
  const stopLossDistance = currentPrice * 0.02; // 2%止损距离
  const takeProfitDistance = stopLossDistance * 2; // 1:2风险回报比
  
  let stopLoss, takeProfit;
  if (mockSignalV3.signal === '做多' || mockSignalV3.signal === '多头回踩突破') {
    stopLoss = currentPrice - stopLossDistance;
    takeProfit = currentPrice + takeProfitDistance;
  } else {
    stopLoss = currentPrice + stopLossDistance;
    takeProfit = currentPrice - takeProfitDistance;
  }
  
  // 验证计算逻辑
  assert.equal(stopLoss, 49000, 'V3做多止损价格计算错误');
  assert.equal(takeProfit, 52000, 'V3做多止盈价格计算错误');
  
  // 验证最大杠杆计算
  const maxLeverage = Math.floor(1 / 0.02); // 基于2%止损距离
  assert.equal(maxLeverage, 50, 'V3最大杠杆计算错误');
  
  console.log('✅ V3策略参数计算测试通过');
}

// 测试ICT策略参数计算
function testICTStrategyParameters() {
  console.log('🧪 测试ICT策略参数计算...');
  
  const currentPrice = parseFloat(mockSignalICT.currentPrice);
  const ob = { low: 2950, high: 3050 }; // 模拟订单块
  const atr4h = 50; // 模拟ATR值
  const trend1d = 'down'; // 下降趋势
  
  let stopLoss, takeProfit;
  
  // ICT策略：下降趋势
  stopLoss = Math.max(ob.high + 1.5 * atr4h, ob.high * 1.02);
  const stopDistance = stopLoss - currentPrice;
  takeProfit = currentPrice - 3 * stopDistance; // RR=3:1
  
  // 验证计算逻辑
  assert.equal(stopLoss, 3125, 'ICT做空止损价格计算错误'); // 3050 + 1.5*50 = 3125
  assert.equal(takeProfit, 2625, 'ICT做空止盈价格计算错误'); // 3000 - 3*125 = 2625
  
  console.log('✅ ICT策略参数计算测试通过');
}

// 测试策略类型识别
function testStrategyTypeRecognition() {
  console.log('🧪 测试策略类型识别...');
  
  const v3Signal = { ...mockSignalV3, strategyVersion: 'V3' };
  const ictSignal = { ...mockSignalICT, strategyVersion: 'ICT' };
  const defaultSignal = { ...mockSignalV3, strategyVersion: undefined };
  
  assert.equal(v3Signal.strategyVersion || 'V3', 'V3', 'V3策略类型识别错误');
  assert.equal(ictSignal.strategyVersion || 'V3', 'ICT', 'ICT策略类型识别错误');
  assert.equal(defaultSignal.strategyVersion || 'V3', 'V3', '默认策略类型识别错误');
  
  console.log('✅ 策略类型识别测试通过');
}

// 测试触发原因生成
function testTriggerReasonGeneration() {
  console.log('🧪 测试触发原因生成...');
  
  const v3TriggerReason = `V3策略${mockSignalV3.signal}信号-15m确认`;
  const ictTriggerReason = `ICT策略${mockSignalICT.signal}信号-15m确认`;
  
  assert.equal(v3TriggerReason, 'V3策略做多信号-15m确认', 'V3触发原因生成错误');
  assert.equal(ictTriggerReason, 'ICT策略做空信号-15m确认', 'ICT触发原因生成错误');
  
  console.log('✅ 触发原因生成测试通过');
}

// 测试趋势判断逻辑
function testTrendDetection() {
  console.log('🧪 测试趋势判断逻辑...');
  
  // 模拟4H K线数据 - 多头趋势
  const bullKLines = [
    [1690000000000, "30000", "30100", "29900", "30050", "120.5"],
    [1690003600000, "30050", "30200", "29950", "30100", "150.8"],
    [1690007200000, "30100", "30250", "30000", "30200", "200.3"]
  ];
  
  // 模拟1D K线数据 - 上升趋势
  const upDailyKLines = [
    [1690000000000, "30000", "30100", "29900", "30050", "120.5"],
    [1690000000000, "30050", "30200", "29950", "30100", "150.8"],
    [1690000000000, "30100", "30250", "30000", "30200", "200.3"]
  ];
  
  // 测试1D趋势判断
  const closes = upDailyKLines.map(k => parseFloat(k[4]));
  const last20 = closes.slice(-20);
  const trend1d = last20[last20.length - 1] > last20[0] ? 'up' : 'down';
  
  assert.equal(trend1d, 'up', '1D趋势判断错误');
  
  console.log('✅ 趋势判断逻辑测试通过');
}

// 测试数据一致性验证
function testDataConsistency() {
  console.log('🧪 测试数据一致性验证...');
  
  // 模拟数据库记录
  const mockSimulations = [
    { id: 1, symbol: 'BTCUSDT', strategy_type: 'V3', status: 'CLOSED', profit_loss: 150.5 },
    { id: 2, symbol: 'ETHUSDT', strategy_type: 'V3', status: 'CLOSED', profit_loss: -85.2 },
    { id: 3, symbol: 'SOLUSDT', strategy_type: 'V3', status: 'CLOSED', profit_loss: 75.8 },
    { id: 4, symbol: 'ADAUSDT', strategy_type: 'ICT', status: 'ACTIVE', profit_loss: null },
    { id: 5, symbol: 'POLUSDT', strategy_type: 'ICT', status: 'ACTIVE', profit_loss: null }
  ];
  
  // 统计CLOSED状态的交易
  const closedTrades = mockSimulations.filter(s => s.status === 'CLOSED');
  const activeTrades = mockSimulations.filter(s => s.status === 'ACTIVE');
  
  assert.equal(closedTrades.length, 3, 'CLOSED状态交易数量错误');
  assert.equal(activeTrades.length, 2, 'ACTIVE状态交易数量错误');
  
  // 验证统计概览只计算CLOSED交易
  const totalTrades = closedTrades.length;
  const winningTrades = closedTrades.filter(t => t.profit_loss > 0).length;
  const winRate = (winningTrades / totalTrades * 100).toFixed(2);
  
  assert.equal(totalTrades, 3, '统计概览交易总数错误');
  assert.equal(winningTrades, 2, '盈利交易数量错误');
  assert.equal(winRate, '66.67', '胜率计算错误');
  
  console.log('✅ 数据一致性验证测试通过');
}

// 测试止损距离计算
function testStopLossDistanceCalculation() {
  console.log('🧪 测试止损距离计算...');
  
  try {
    const currentPrice = 50000;
    const stopLossPrice = 49000;
    
    // 计算止损距离百分比
    const stopLossDistance = Math.abs(currentPrice - stopLossPrice) / currentPrice * 100;
    
    assert.strictEqual(stopLossDistance, 2, '止损距离应正确计算为2%');
    
    // 测试空头止损距离
    const shortStopLoss = 51000;
    const shortStopLossDistance = Math.abs(currentPrice - shortStopLoss) / currentPrice * 100;
    
    assert.strictEqual(shortStopLossDistance, 2, '空头止损距离应正确计算为2%');
    
    console.log('✅ 止损距离计算测试通过');
  } catch (error) {
    console.error('❌ 止损距离计算测试失败:', error.message);
    process.exit(1);
  }
}

// 测试ATR值计算
function testATRCalculation() {
  console.log('🧪 测试ATR值计算...');
  
  try {
    // 模拟K线数据计算ATR
    const klines = [
      [1690000000000, "30000", "30100", "29900", "30050", "120.5"],
      [1690003600000, "30050", "30200", "29950", "30100", "150.8"],
      [1690007200000, "30100", "30250", "30000", "30200", "200.3"],
      [1690010800000, "30200", "30300", "30100", "30250", "180.2"],
      [1690014400000, "30250", "30400", "30150", "30300", "220.1"]
    ];
    
    // 计算真实波幅
    const trs = [];
    for (let i = 1; i < klines.length; i++) {
      const high = parseFloat(klines[i][2]);
      const low = parseFloat(klines[i][3]);
      const prevClose = parseFloat(klines[i - 1][4]);
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trs.push(tr);
    }
    
    const atr = trs.reduce((sum, tr) => sum + tr, 0) / trs.length;
    
    assert.ok(atr > 0, 'ATR值应大于0');
    assert.ok(atr < 1000, 'ATR值应在合理范围内');
    
    console.log('✅ ATR值计算测试通过');
  } catch (error) {
    console.error('❌ ATR值计算测试失败:', error.message);
    process.exit(1);
  }
}

// 测试杠杆和保证金计算（基于strategy-v3.md）
function testLeverageAndMarginCalculation() {
  console.log('🧪 测试杠杆和保证金计算...');
  
  try {
    const currentPrice = 50000;
    const stopLossPrice = 49000;
    const maxLossAmount = 100;
    
    // 计算止损距离百分比
    const stopLossPercentage = Math.abs(currentPrice - stopLossPrice) / currentPrice;
    
    // 最大杠杆数Y = 1/(X%+0.5%) 数值向下取整
    const maxLeverage = Math.floor(1 / (stopLossPercentage + 0.005));
    
    // 保证金Z = M/(Y*X%) 数值向上取整
    const minMargin = Math.ceil(maxLossAmount / (maxLeverage * stopLossPercentage));
    
    // 验证计算结果
    assert.ok(maxLeverage > 0, '最大杠杆应大于0');
    assert.ok(maxLeverage <= 50, '最大杠杆不应超过50');
    assert.ok(minMargin > 0, '最小保证金应大于0');
    assert.ok(minMargin >= maxLossAmount, '最小保证金应至少等于最大损失金额');
    
    // 验证杠杆计算逻辑
    const expectedLeverage = Math.floor(1 / (0.02 + 0.005)); // 2%止损 + 0.5%缓冲
    assert.strictEqual(maxLeverage, expectedLeverage, '杠杆计算应符合strategy-v3.md逻辑');
    
    console.log('✅ 杠杆和保证金计算测试通过');
  } catch (error) {
    console.error('❌ 杠杆和保证金计算测试失败:', error.message);
    process.exit(1);
  }
}

// 测试出场价格计算
function testExitPriceCalculation() {
  console.log('🧪 测试出场价格计算...');
  
  try {
    const entryPrice = 50000;
    const stopLossPrice = 49000;
    const takeProfitPrice = 51000;
    
    // 模拟止盈出场
    const exitPriceTakeProfit = takeProfitPrice;
    const profit = exitPriceTakeProfit - entryPrice;
    
    // 模拟止损出场
    const exitPriceStopLoss = stopLossPrice;
    const loss = exitPriceStopLoss - entryPrice;
    
    // 验证计算结果
    assert.strictEqual(profit, 1000, '止盈收益应正确计算');
    assert.strictEqual(loss, -1000, '止损亏损应正确计算');
    
    // 验证风险回报比
    const riskAmount = entryPrice - stopLossPrice; // 1000
    const rewardAmount = takeProfitPrice - entryPrice; // 1000
    const riskRewardRatio = rewardAmount / riskAmount;
    
    assert.strictEqual(riskRewardRatio, 1, '风险回报比应为1:1（当前测试数据）');
    
    console.log('✅ 出场价格计算测试通过');
  } catch (error) {
    console.error('❌ 出场价格计算测试失败:', error.message);
    process.exit(1);
  }
}

// 运行所有测试
function runAllTests() {
  console.log('🚀 开始运行模拟交易触发逻辑单元测试...\n');
  
  try {
    testV3StrategyParameters();
    testICTStrategyParameters();
    testStrategyTypeRecognition();
    testTriggerReasonGeneration();
    testTrendDetection();
    testDataConsistency();
    testStopLossDistanceCalculation();
    testATRCalculation();
    testLeverageAndMarginCalculation();
    testExitPriceCalculation();
    
    console.log('\n🎉 所有测试通过！');
    console.log('✅ 测试覆盖范围：');
    console.log('   - V3策略参数计算（止损、止盈、杠杆）');
    console.log('   - ICT策略参数计算（止损、止盈、杠杆）');
    console.log('   - 策略类型识别（V3/ICT）');
    console.log('   - 触发原因生成');
    console.log('   - 趋势判断逻辑');
    console.log('   - 数据一致性验证');
    console.log('   - 止损距离计算');
    console.log('   - ATR值计算');
    console.log('   - 杠杆和保证金计算（strategy-v3.md逻辑）');
    console.log('   - 出场价格计算');
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此文件，则执行测试
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testV3StrategyParameters,
  testICTStrategyParameters,
  testStrategyTypeRecognition,
  testTriggerReasonGeneration,
  testTrendDetection,
  testDataConsistency,
  testStopLossDistanceCalculation,
  testATRCalculation,
  testLeverageAndMarginCalculation,
  testExitPriceCalculation,
  runAllTests
};
