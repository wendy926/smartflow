/**
 * ICT策略第二次优化集成测试
 * 测试完整的信号生成流程
 */

const ICTStrategyOptimized = require('../src/strategies/ict-strategy-optimized');
const fs = require('fs');
const path = require('path');

async function runIntegrationTest() {
  console.log('🚀 开始ICT策略第二次优化集成测试...\n');

  const strategy = new ICTStrategyOptimized();
  const testSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];

  const results = [];

  for (const symbol of testSymbols) {
    console.log(`📊 测试 ${symbol}...`);

    try {
      const result = await strategy.generateSignalWithConfirmation(symbol, {
        confirmationBars: 1, // 测试时使用1根K线确认
        minEngulfStrength: 0.6,
        minHarmonicScore: 0.6,
        accountUSD: 10000,
        historicalWinRate: 0.5
      });

      results.push({
        symbol,
        ...result,
        timestamp: new Date().toISOString()
      });

      console.log(`✅ ${symbol}: ${result.signal} (得分: ${result.totalScore}, 置信度: ${result.confidence?.toFixed(2)})`);

      if (result.reasons) {
        console.log(`   原因: ${result.reasons.join(', ')}`);
      }

    } catch (error) {
      console.error(`❌ ${symbol} 测试失败:`, error.message);
      results.push({
        symbol,
        signal: 'ERROR',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // 生成测试报告
  const report = {
    testName: 'ICT策略第二次优化集成测试',
    timestamp: new Date().toISOString(),
    totalSymbols: testSymbols.length,
    results: results,
    summary: {
      buy: results.filter(r => r.signal === 'BUY').length,
      sell: results.filter(r => r.signal === 'SELL').length,
      watch: results.filter(r => r.signal === 'WATCH').length,
      hold: results.filter(r => r.signal === 'HOLD').length,
      error: results.filter(r => r.signal === 'ERROR').length
    }
  };

  // 保存测试报告
  const reportFile = path.join(__dirname, '../logs/ict_optimization_test_report.json');
  const logDir = path.dirname(reportFile);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

  console.log('\n📋 测试报告:');
  console.log(`   买入信号: ${report.summary.buy}`);
  console.log(`   卖出信号: ${report.summary.sell}`);
  console.log(`   观望信号: ${report.summary.watch}`);
  console.log(`   持有信号: ${report.summary.hold}`);
  console.log(`   错误: ${report.summary.error}`);
  console.log(`\n📄 详细报告已保存到: ${reportFile}`);

  // 检查遥测日志
  const telemetryFile = path.join(__dirname, '../logs/ict_telemetry.log');
  if (fs.existsSync(telemetryFile)) {
    const telemetryContent = fs.readFileSync(telemetryFile, 'utf8');
    const telemetryLines = telemetryContent.trim().split('\n').length;
    console.log(`📊 遥测日志记录数: ${telemetryLines}`);
  }

  return report;
}

// 运行测试
if (require.main === module) {
  runIntegrationTest()
    .then(report => {
      console.log('\n🎉 集成测试完成!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ 集成测试失败:', error);
      process.exit(1);
    });
}

module.exports = { runIntegrationTest };