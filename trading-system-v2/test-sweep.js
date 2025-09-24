const ICTStrategy = require('./src/strategies/ict-strategy');

// 创建测试用的K线数据
const createTestKlines = () => {
  const basePrice = 100000;
  const klines = [];
  
  // 创建一些测试K线，包含一个明显的扫荡情况
  for (let i = 0; i < 10; i++) {
    const open = basePrice + i * 100;
    const close = basePrice + i * 100 + 50;
    const high = basePrice + i * 100 + 100; // 最高价
    const low = basePrice + i * 100 - 50;   // 最低价
    const volume = 1000000;
    
    klines.push([
      Date.now() - (10 - i) * 900000, // 时间戳 (15分钟前)
      open.toString(),   // 开盘价
      high.toString(),   // 最高价
      low.toString(),    // 最低价
      close.toString(),  // 收盘价
      volume.toString(), // 成交量
      Date.now() - (10 - i) * 900000, // 收盘时间
      volume.toString(), // 成交额
      10, // 成交笔数
      volume.toString(), // 主动买入成交量
      volume.toString(), // 主动买入成交额
      "0" // 忽略
    ]);
  }
  
  // 创建一个明显的扫荡情况
  // 让倒数第二根K线有最高价，最后一根K线突破但收盘价收回
  const secondLastKline = klines[klines.length - 2];
  const lastKline = klines[klines.length - 1];
  
  // 设置倒数第二根K线的最高价
  const extremeHigh = basePrice + 8 * 100 + 500; // 比正常高500
  secondLastKline[2] = extremeHigh.toString();
  
  // 最后一根K线突破极值点但收盘价收回
  lastKline[2] = (extremeHigh + 200).toString(); // 最高价突破200点
  lastKline[4] = (extremeHigh - 200).toString(); // 收盘价收回
  
  return klines;
};

async function testSweepDetection() {
  const strategy = new ICTStrategy();
  
  console.log('=== 测试ICT策略扫荡检测 ===');
  
  // 测试HTF扫荡检测
  const klines4H = createTestKlines();
  const atr4H = [100, 110, 120, 130, 140, 150, 160, 170, 180, 190]; // 模拟ATR值
  
  // 计算极值点（排除最后一根K线）
  const klinesWithoutLast = klines4H.slice(0, -1);
  const highestHigh = Math.max(...klinesWithoutLast.map(k => parseFloat(k[2])));
  
  console.log(`最高价: ${highestHigh}`);
  console.log(`最后一根K线 - 最高价: ${klines4H[klines4H.length - 1][2]}, 收盘价: ${klines4H[klines4H.length - 1][4]}`);
  
  // 检查检测条件
  const lastHigh = parseFloat(klines4H[klines4H.length - 1][2]);
  const lastClose = parseFloat(klines4H[klines4H.length - 1][4]);
  console.log(`检测条件 - high > extreme: ${lastHigh} > ${highestHigh} = ${lastHigh > highestHigh}`);
  console.log(`检测条件 - close < extreme: ${lastClose} < ${highestHigh} = ${lastClose < highestHigh}`);
  
  console.log(`ATR值: ${atr4H[atr4H.length - 1]}`);
  console.log(`扫荡速率阈值: ${0.4 * atr4H[atr4H.length - 1]}`);
  
  const sweepHTF = strategy.detectSweepHTF(highestHigh, klines4H, atr4H[atr4H.length - 1]);
  console.log('HTF扫荡检测结果:', JSON.stringify(sweepHTF, null, 2));
  
  // 测试LTF扫荡检测
  const klines15m = createTestKlines();
  const atr15m = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95]; // 模拟ATR值
  
  const sweepLTF = strategy.detectSweepLTF(klines15m, atr15m[atr15m.length - 1]);
  console.log('LTF扫荡检测结果:', JSON.stringify(sweepLTF, null, 2));
}

testSweepDetection().catch(console.error);
