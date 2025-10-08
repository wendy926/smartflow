/**
 * 仓位计算测试脚本
 * 验证修复后的calculatePositionSize方法
 */

// 模拟calculatePositionSize方法
function calculatePositionSize(price, direction, stopLoss, maxLossAmount = 50) {
  if (!stopLoss || stopLoss <= 0) {
    console.warn('⚠️  止损价格无效，使用默认仓位');
    return 0.1;
  }

  const stopDistance = Math.abs(price - stopLoss);

  if (stopDistance === 0) {
    console.warn('⚠️  止损距离为0，使用默认仓位');
    return 0.1;
  }

  const quantity = maxLossAmount / stopDistance;

  console.log(`✅ 仓位计算: 价格=${price.toFixed(4)}, 止损=${stopLoss.toFixed(4)}, ` +
    `止损距离=${stopDistance.toFixed(4)}, 最大损失=${maxLossAmount}U, ` +
    `quantity=${quantity.toFixed(6)}`);

  return quantity;
}

// 计算预期盈亏
function calculatePnL(entryPrice, exitPrice, quantity, direction) {
  let pnl;
  if (direction === 'LONG') {
    pnl = (exitPrice - entryPrice) * quantity;
  } else {
    pnl = (entryPrice - exitPrice) * quantity;
  }
  return pnl;
}

console.log('='.repeat(80));
console.log('🧪 仓位计算测试 - 验证修复效果');
console.log('='.repeat(80));
console.log();

// 测试用例
const testCases = [
  {
    name: 'BTC - 主流币测试',
    symbol: 'BTCUSDT',
    direction: 'LONG',
    entryPrice: 60000,
    stopLoss: 58800,
    exitPrice: 61200, // +2% 盈利
    maxLossAmount: 50
  },
  {
    name: 'ETH - 主流币测试',
    symbol: 'ETHUSDT',
    direction: 'LONG',
    entryPrice: 3000,
    stopLoss: 2940,
    exitPrice: 3120, // +4% 盈利
    maxLossAmount: 50
  },
  {
    name: 'ONDO - 小币测试（修复前会显示0.00）',
    symbol: 'ONDOUSDT',
    direction: 'LONG',
    entryPrice: 1.50,
    stopLoss: 1.47,
    exitPrice: 1.53, // +2% 盈利
    maxLossAmount: 50
  },
  {
    name: 'SOL - 中等价格币测试',
    symbol: 'SOLUSDT',
    direction: 'SHORT',
    entryPrice: 150,
    stopLoss: 153,
    exitPrice: 147, // -2% 盈利（做空）
    maxLossAmount: 100
  },
  {
    name: 'BTC - 大损失金额测试',
    symbol: 'BTCUSDT',
    direction: 'LONG',
    entryPrice: 60000,
    stopLoss: 59400,
    exitPrice: 60900,
    maxLossAmount: 200
  }
];

// 执行测试
testCases.forEach((testCase, index) => {
  console.log(`\n📊 测试用例 ${index + 1}: ${testCase.name}`);
  console.log('-'.repeat(80));
  console.log(`交易对: ${testCase.symbol}`);
  console.log(`方向: ${testCase.direction}`);
  console.log(`入场价格: ${testCase.entryPrice} USDT`);
  console.log(`止损价格: ${testCase.stopLoss} USDT`);
  console.log(`出场价格: ${testCase.exitPrice} USDT`);
  console.log(`最大损失金额: ${testCase.maxLossAmount} USDT`);
  console.log();

  // 计算仓位
  const quantity = calculatePositionSize(
    testCase.entryPrice,
    testCase.direction,
    testCase.stopLoss,
    testCase.maxLossAmount
  );

  // 计算止损距离百分比
  const stopDistance = Math.abs(testCase.entryPrice - testCase.stopLoss);
  const stopDistancePct = (stopDistance / testCase.entryPrice) * 100;

  // 计算杠杆
  const maxLeverage = Math.floor(1 / (stopDistancePct / 100 + 0.005));
  const leverage = Math.min(maxLeverage, 20);

  // 计算保证金
  const notional = quantity * testCase.entryPrice;
  const margin = notional / leverage;

  console.log(`📈 计算结果:`);
  console.log(`  - 仓位数量: ${quantity.toFixed(6)}`);
  console.log(`  - 止损距离: ${stopDistance.toFixed(4)} USDT (${stopDistancePct.toFixed(2)}%)`);
  console.log(`  - 建议杠杆: ${leverage}x`);
  console.log(`  - 名义价值: ${notional.toFixed(2)} USDT`);
  console.log(`  - 所需保证金: ${margin.toFixed(2)} USDT`);

  // 计算盈亏
  const pnl = calculatePnL(testCase.entryPrice, testCase.exitPrice, quantity, testCase.direction);
  const pnlPct = (pnl / (testCase.entryPrice * quantity)) * 100;

  // 计算最大风险
  const maxRisk = calculatePnL(testCase.entryPrice, testCase.stopLoss, quantity, testCase.direction);

  console.log();
  console.log(`💰 盈亏分析:`);
  console.log(`  - 盈亏金额: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT`);
  console.log(`  - 盈亏百分比: ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`);
  console.log(`  - 最大风险: ${maxRisk.toFixed(2)} USDT (应约等于 ${testCase.maxLossAmount} USDT)`);

  // 验证
  const riskDiff = Math.abs(Math.abs(maxRisk) - testCase.maxLossAmount);
  if (riskDiff < 0.01) {
    console.log(`  - ✅ 风险控制正确（误差: ${riskDiff.toFixed(4)} USDT）`);
  } else {
    console.log(`  - ⚠️  风险控制异常（误差: ${riskDiff.toFixed(4)} USDT）`);
  }

  // 判断是否会显示0.00
  if (Math.abs(pnl) < 0.01) {
    console.log(`  - ⚠️  盈亏金额过小，可能显示为0.00`);
  } else {
    console.log(`  - ✅ 盈亏金额正常，不会显示为0.00`);
  }
});

console.log();
console.log('='.repeat(80));
console.log('✅ 测试完成');
console.log('='.repeat(80));
console.log();
console.log('📝 对比分析:');
console.log();
console.log('修复前 (固定0.1仓位):');
console.log('  - BTCUSDT: PnL = (61200-60000) × 0.1 = 120 USDT ✓');
console.log('  - ETHUSDT: PnL = (3120-3000) × 0.1 = 12 USDT ✓');
console.log('  - ONDOUSDT: PnL = (1.53-1.50) × 0.1 = 0.03 USDT ⚠️ 显示为0.00');
console.log();
console.log('修复后 (动态仓位):');
console.log('  - BTCUSDT: quantity = 50/1200 = 0.0417, PnL = (61200-60000) × 0.0417 = 50 USDT ✓');
console.log('  - ETHUSDT: quantity = 50/60 = 0.833, PnL = (3120-3000) × 0.833 = 100 USDT ✓');
console.log('  - ONDOUSDT: quantity = 50/0.03 = 1666.67, PnL = (1.53-1.50) × 1666.67 = 50 USDT ✓');
console.log();
console.log('🎯 关键改进:');
console.log('  1. 所有币种的盈亏金额都能正确显示（不再是0.00）');
console.log('  2. 每笔交易的最大风险都固定为设定金额（50/100/200 USDT）');
console.log('  3. 仓位大小自动适配不同价格的币种');
console.log();

