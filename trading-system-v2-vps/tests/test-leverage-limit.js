const ICTStrategy = require('./src/strategies/ict-strategy');
const V3Strategy = require('./src/strategies/v3-strategy');

async function testLeverageLimit() {
  console.log('🔍 测试策略最大杠杆限制 (24倍)\n');
  
  const ictStrategy = new ICTStrategy();
  const v3Strategy = new V3Strategy();
  
  // 测试不同止损距离下的杠杆计算
  const testCases = [
    { entryPrice: 100, stopLoss: 99.5, direction: 'BUY', maxLoss: 100 },   // 0.5%止损
    { entryPrice: 100, stopLoss: 99, direction: 'BUY', maxLoss: 100 },     // 1%止损
    { entryPrice: 100, stopLoss: 98, direction: 'BUY', maxLoss: 100 },     // 2%止损
    { entryPrice: 100, stopLoss: 95, direction: 'BUY', maxLoss: 100 },     // 5%止损
    { entryPrice: 100, stopLoss: 90, direction: 'BUY', maxLoss: 100 },     // 10%止损
    { entryPrice: 100, stopLoss: 80, direction: 'BUY', maxLoss: 100 },     // 20%止损
  ];
  
  console.log('📊 杠杆计算测试结果:\n');
  
  for (const testCase of testCases) {
    const { entryPrice, stopLoss, direction, maxLoss } = testCase;
    
    // 计算止损距离百分比
    const stopLossDistance = direction === 'BUY' 
      ? (entryPrice - stopLoss) / entryPrice 
      : (stopLoss - entryPrice) / entryPrice;
    
    // 计算理论最大杠杆
    const theoreticalMaxLeverage = Math.floor(1 / (stopLossDistance + 0.005));
    
    // ICT策略杠杆计算
    const equity = maxLoss / stopLossDistance; // 模拟账户资金
    const ictParams = ictStrategy.calculatePositionSize(
      equity, 
      stopLossDistance, 
      entryPrice, 
      stopLoss
    );
    
    // V3策略杠杆计算 (模拟)
    const v3MaxLeverage = Math.min(theoreticalMaxLeverage, 24);
    const v3Margin = stopLossDistance > 0 ? Math.ceil(maxLoss / (v3MaxLeverage * stopLossDistance)) : 0;
    
    console.log(`止损距离: ${(stopLossDistance * 100).toFixed(1)}%`);
    console.log(`理论最大杠杆: ${theoreticalMaxLeverage}`);
    console.log(`ICT策略 - 杠杆: ${ictParams.leverage}, 保证金: ${ictParams.margin.toFixed(2)}`);
    console.log(`V3策略 - 杠杆: ${v3MaxLeverage}, 保证金: ${v3Margin}`);
    console.log(`是否超过24倍限制: ${theoreticalMaxLeverage > 24 ? '是' : '否'}`);
    console.log('---\n');
  }
  
  console.log('✅ 测试完成');
}

// 运行测试
testLeverageLimit().catch(console.error);
