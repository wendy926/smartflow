// test-monitoring-fix.js - 测试监控数据修复
const { DataMonitor } = require('./modules/monitoring/DataMonitor');
const DatabaseManager = require('./modules/database/DatabaseManager');

async function testMonitoringFix() {
  console.log('🧪 开始测试监控数据修复...');

  try {
    // 初始化数据库
    const db = new DatabaseManager();
    await db.init();
    console.log('✅ 数据库初始化完成');

    // 创建DataMonitor实例
    const dataMonitor = new DataMonitor();
    dataMonitor.db = db;

    // 测试获取监控数据
    console.log('📊 获取监控数据...');
    const dashboard = await dataMonitor.getMonitoringDashboard();

    console.log('监控数据结果:');
    console.log('- 总交易对:', dashboard.summary.totalSymbols);
    console.log('- 健康状态:', dashboard.summary.healthySymbols);
    console.log('- 警告状态:', dashboard.summary.warningSymbols);
    console.log('- 详细统计数量:', dashboard.detailedStats.length);

    if (dashboard.detailedStats.length > 0) {
      console.log('第一个交易对:', dashboard.detailedStats[0].symbol);
    }

    // 关闭数据库
    await db.close();
    console.log('✅ 测试完成');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

testMonitoringFix().catch(console.error);
