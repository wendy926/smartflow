const PositionDurationManager = require('./trading-system-v2/src/utils/position-duration-manager');

// 测试获取BTC和ETH的时间止损配置
const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];

console.log('测试V3策略时间止损配置:');
console.log('================================\n');

symbols.forEach(symbol => {
  const config = PositionDurationManager.getPositionConfig(symbol, 'TREND');
  console.log(`${symbol} (TREND市):`);
  console.log(`  最大持仓时长: ${config.maxDurationHours}小时`);
  console.log(`  时间止损: ${config.timeStopMinutes}分钟 (${config.timeStopMinutes / 60}小时)`);
  console.log(`  止盈目标: ${config.profitTarget}倍ATR`);
  console.log(`  止损: ${config.stopLoss}倍ATR`);
  console.log('');
});

console.log('================================');
console.log('总结:');
console.log(`- BTC/ETH: ${PositionDurationManager.getPositionConfig('BTCUSDT', 'TREND').timeStopMinutes / 60}小时时间止损`);
console.log(`- 其他币: ${PositionDurationManager.getPositionConfig('SOLUSDT', 'TREND').timeStopMinutes / 60}小时时间止损`);

