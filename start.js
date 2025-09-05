#!/usr/bin/env node

/**
 * SmartFlow 启动脚本
 * 用于本地开发和测试
 */

import { runMockTests } from './test/test-mock.js';

console.log('🚀 SmartFlow 交易策略系统启动中...\n');

// 显示系统信息
console.log('📊 系统配置:');
console.log('- 策略版本: SmartFlow v1.0.0');
console.log('- 监控品种: BTCUSDT, ETHUSDT, LINKUSDT, LDOUSDT');
console.log('- 时间周期: 日线趋势 + 小时确认 + 15分钟执行');
console.log('- 风险控制: 单笔1%风险，最大3笔持仓，日损-3R限制');
console.log('');

// 运行模拟测试
console.log('🧪 开始模拟测试...\n');
try {
  const testResults = await runMockTests();

  if (testResults.summary.failed === 0) {
    console.log('✅ 所有测试通过，系统就绪！');
    console.log('\n🎯 下一步操作:');
    console.log('1. 运行 "npm run dev" 启动本地开发服务器');
    console.log('2. 运行 "./deploy.sh" 部署到Cloudflare');
    console.log('3. 访问 Worker URL 查看仪表板');
  } else {
    console.log('⚠️  部分测试失败，请检查网络连接和配置');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ 测试过程中发生错误:', error.message);
  process.exit(1);
}
