// test-monitoring.js - 测试监控数据
const { DataMonitor } = require('./modules/monitoring/DataMonitor');
const { SmartFlowStrategy } = require('./modules/strategy/SmartFlowStrategy');

async function testMonitoring() {
  console.log('🧪 开始测试监控数据...');

  // 创建DataMonitor实例
  const dataMonitor = new DataMonitor();

  // 将DataMonitor实例传递给SmartFlowStrategy
  SmartFlowStrategy.dataMonitor = dataMonitor;

  console.log('📊 测试前的监控数据:');
  let dashboard = dataMonitor.getMonitoringDashboard();
  console.log('总交易对:', dashboard.summary.totalSymbols);
  console.log('详细统计:', dashboard.detailedStats.length);

  // 模拟分析一个交易对
  console.log('\n🔄 模拟分析 BTCUSDT...');
  try {
    await SmartFlowStrategy.analyzeAll('BTCUSDT');
    console.log('✅ 分析完成');
  } catch (error) {
    console.error('❌ 分析失败:', error.message);
  }

  console.log('\n📊 测试后的监控数据:');
  dashboard = dataMonitor.getMonitoringDashboard();
  console.log('总交易对:', dashboard.summary.totalSymbols);
  console.log('详细统计:', dashboard.detailedStats.length);

  if (dashboard.detailedStats.length > 0) {
    console.log('第一个交易对数据:', dashboard.detailedStats[0]);
  }

  console.log('\n✅ 测试完成');
}

testMonitoring().catch(console.error);
