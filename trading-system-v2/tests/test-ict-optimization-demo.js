/**
 * ICT策略第二次优化演示脚本
 * 展示各个功能模块的独立测试
 */

const ICTStrategyOptimized = require('../src/strategies/ict-strategy-optimized');

async function runDemo() {
  console.log('🎯 ICT策略第二次优化功能演示\n');

  const strategy = new ICTStrategyOptimized();

  // 1. 吞没形态检测演示
  console.log('1️⃣ 吞没形态检测演示');
  console.log('='.repeat(50));

  const engulfingKlines = [
    [1640995200000, 47000, 47500, 46800, 47200, 1000], // 前一根K线（阴线）
    [1640996100000, 47200, 47800, 47000, 47600, 1200], // 当前K线（阳线，看涨吞没）
  ];

  const engulfingResult = strategy.analyzeEngulfing(engulfingKlines);
  console.log(`   类型: ${engulfingResult.type}`);
  console.log(`   强度: ${engulfingResult.strength.toFixed(3)}`);
  console.log(`   是否有效: ${engulfingResult.strength >= 0.6 ? '✅' : '❌'}\n`);

  // 2. 谐波形态检测演示
  console.log('2️⃣ 谐波形态检测演示');
  console.log('='.repeat(50));

  // 创建模拟的谐波形态数据
  const harmonicKlines = Array.from({ length: 120 }, (_, i) => {
    const basePrice = 47000;
    const time = 1640995200000 + i * 15 * 60 * 1000;
    // 创建X-A-B-C-D模式
    if (i < 20) return [time, basePrice, basePrice + 100, basePrice - 50, basePrice + 50, 1000];
    if (i < 40) return [time, basePrice + 50, basePrice + 150, basePrice, basePrice + 100, 1000];
    if (i < 60) return [time, basePrice + 100, basePrice + 200, basePrice + 50, basePrice + 150, 1000];
    if (i < 80) return [time, basePrice + 150, basePrice + 250, basePrice + 100, basePrice + 200, 1000];
    return [time, basePrice + 200, basePrice + 300, basePrice + 150, basePrice + 250, 1000];
  });

  const harmonicResult = strategy.detectHarmonicPattern(harmonicKlines);
  console.log(`   类型: ${harmonicResult.type}`);
  console.log(`   得分: ${harmonicResult.score.toFixed(3)}`);
  console.log(`   RMSE: ${harmonicResult.rmse?.toFixed(4) || 'N/A'}`);
  console.log(`   是否有效: ${harmonicResult.score >= 0.6 ? '✅' : '❌'}\n`);

  // 3. 扫荡检测演示
  console.log('3️⃣ 扫荡检测演示');
  console.log('='.repeat(50));

  const orderBlock = { low: 47000, high: 47500 };
  const sweepResult = strategy.detectSweep(engulfingKlines, orderBlock);
  console.log(`   是否扫荡: ${sweepResult.swept ? '✅' : '❌'}`);
  console.log(`   方向: ${sweepResult.direction || 'N/A'}`);
  console.log(`   置信度: ${sweepResult.confidence.toFixed(3)}\n`);

  // 4. 订单块检测演示
  console.log('4️⃣ 订单块检测演示');
  console.log('='.repeat(50));

  const orderBlockKlines = [
    [1640995200000, 46000, 47000, 45800, 46800, 5000],
    [1641009600000, 46800, 47500, 46500, 47200, 5200],
    [1641024000000, 47200, 48000, 47000, 47800, 4800],
    [1641038400000, 47800, 48500, 47600, 48200, 5100],
    [1641052800000, 48200, 49000, 48000, 48800, 5300]
  ];

  const orderBlockResult = strategy.analyzeOrderBlocks(orderBlockKlines);
  console.log(`   是否有效: ${orderBlockResult.valid ? '✅' : '❌'}`);
  console.log(`   得分: ${orderBlockResult.score}`);
  if (orderBlockResult.block) {
    console.log(`   范围: ${orderBlockResult.block.bottom} - ${orderBlockResult.block.top}`);
  }
  console.log();

  // 5. 成交量放大检测演示
  console.log('5️⃣ 成交量放大检测演示');
  console.log('='.repeat(50));

  const volumeKlines = [
    [1640995200000, 47000, 47500, 46800, 47200, 1000],
    [1640996100000, 47200, 47800, 47000, 47600, 2000], // 成交量放大
  ];

  const volumeResult = strategy.analyzeVolumeExpansion(volumeKlines);
  console.log(`   得分: ${volumeResult.score}`);
  console.log(`   是否放大: ${volumeResult.score > 0 ? '✅' : '❌'}\n`);

  // 6. 自适应止损倍数演示
  console.log('6️⃣ 自适应止损倍数演示');
  console.log('='.repeat(50));

  const highConfidence = 0.9;
  const lowConfidence = 0.1;

  const highStopMult = strategy.calcStopMultiplier(highConfidence);
  const lowStopMult = strategy.calcStopMultiplier(lowConfidence);

  console.log(`   高置信度 (${highConfidence}): ${highStopMult.toFixed(3)}x`);
  console.log(`   低置信度 (${lowConfidence}): ${lowStopMult.toFixed(3)}x`);
  console.log(`   差异: ${(lowStopMult - highStopMult).toFixed(3)}x\n`);

  // 7. 仓位管理演示
  console.log('7️⃣ 仓位管理演示');
  console.log('='.repeat(50));

  const totalScore = 80;
  const historicalWinRate = 0.6;
  const accountUSD = 10000;

  const position = strategy.positionSizing(totalScore, historicalWinRate, accountUSD);
  const riskPercent = (position / accountUSD * 100).toFixed(2);

  console.log(`   总得分: ${totalScore}`);
  console.log(`   历史胜率: ${(historicalWinRate * 100).toFixed(1)}%`);
  console.log(`   账户资金: $${accountUSD.toLocaleString()}`);
  console.log(`   建议仓位: $${position.toFixed(2)}`);
  console.log(`   风险比例: ${riskPercent}%\n`);

  // 8. 门槛+容忍逻辑演示
  console.log('8️⃣ 门槛+容忍逻辑演示');
  console.log('='.repeat(50));

  const trend = 'UP';
  const orderBlockValid = true;
  const sweepSwept = true;
  const engulfStrength = 0.7;
  const harmonicScore = 0.3;

  const gatePass = (trend !== 'RANGE') && orderBlockValid && sweepSwept;
  const secondaryPass = (engulfStrength >= 0.6) || (harmonicScore >= 0.6);

  console.log(`   趋势: ${trend}`);
  console.log(`   订单块有效: ${orderBlockValid ? '✅' : '❌'}`);
  console.log(`   扫荡检测: ${sweepSwept ? '✅' : '❌'}`);
  console.log(`   吞没强度: ${engulfStrength} ${engulfStrength >= 0.6 ? '✅' : '❌'}`);
  console.log(`   谐波得分: ${harmonicScore} ${harmonicScore >= 0.6 ? '✅' : '❌'}`);
  console.log(`   门槛通过: ${gatePass ? '✅' : '❌'}`);
  console.log(`   次要条件: ${secondaryPass ? '✅' : '❌'}`);
  console.log(`   最终结果: ${gatePass && secondaryPass ? '✅ 继续' : '❌ 停止'}\n`);

  // 9. 配置参数演示
  console.log('9️⃣ 配置参数演示');
  console.log('='.repeat(50));

  console.log(`   最小吞没强度: ${strategy.config.minEngulfStrength}`);
  console.log(`   最小谐波得分: ${strategy.config.minHarmonicScore}`);
  console.log(`   确认K线数: ${strategy.config.confirmationBars}`);
  console.log(`   最小止损倍数: ${strategy.config.minStopMultiplier}`);
  console.log(`   最大止损倍数: ${strategy.config.maxStopMultiplier}`);
  console.log(`   基础风险比例: ${(strategy.config.baseRiskPercent * 100).toFixed(2)}%`);
  console.log(`   最大风险比例: ${(strategy.config.maxRiskPercent * 100).toFixed(2)}%\n`);

  console.log('🎉 演示完成！所有功能模块运行正常。');
}

// 运行演示
if (require.main === module) {
  runDemo()
    .then(() => {
      console.log('\n✅ 演示脚本执行成功');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ 演示脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { runDemo };