// test-alert.js - 测试告警功能
const { DataMonitor } = require('./modules/monitoring/DataMonitor');
const TelegramNotifier = require('./modules/notifications/TelegramNotifier');

async function testAlert() {
  console.log('🧪 开始测试告警功能...');
  
  try {
    // 创建DataMonitor实例
    const dataMonitor = new DataMonitor();
    
    // 创建TelegramNotifier实例
    const telegramNotifier = new TelegramNotifier();
    
    // 模拟一些低完成率的数据
    console.log('📊 模拟低完成率数据...');
    
    // 模拟数据收集失败
    dataMonitor.startAnalysis('TESTUSDT');
    dataMonitor.recordRawData('TESTUSDT', '测试数据', { test: 'data' }, false, new Error('模拟失败'));
    dataMonitor.completeDataCollection('TESTUSDT', false);
    
    // 模拟信号分析失败
    dataMonitor.startAnalysis('TESTUSDT2');
    dataMonitor.recordRawData('TESTUSDT2', '测试数据', { test: 'data' }, true);
    dataMonitor.recordSignal('TESTUSDT2', 'LONG', { signal: 'test' }, false, new Error('信号分析失败'));
    dataMonitor.completeDataCollection('TESTUSDT2', false);
    
    console.log('🔍 检查告警...');
    await dataMonitor.checkAndSendAlerts(telegramNotifier);
    
    console.log('✅ 告警测试完成');
    
  } catch (error) {
    console.error('❌ 告警测试失败:', error);
  }
}

testAlert().catch(console.error);
