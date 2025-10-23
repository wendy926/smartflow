#!/usr/bin/env node

/**
 * 运行所有测试的脚本
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 开始运行Trading System V2.0 所有测试...\n');

// 测试配置
const testConfigs = [
  {
    name: '核心功能测试',
    pattern: 'tests/core/**/*.test.js',
    description: '测试交易管理器等核心功能'
  },
  {
    name: '服务层测试',
    pattern: 'tests/services/**/*.test.js',
    description: '测试Telegram监控等服务'
  },
  {
    name: 'API路由测试',
    pattern: 'tests/api/**/*.test.js',
    description: '测试所有API路由'
  },
  {
    name: '策略测试',
    pattern: 'tests/strategies/**/*.test.js',
    description: '测试V3和ICT策略'
  }
];

// 运行测试的函数
function runTests(config) {
  console.log(`\n📋 ${config.name}`);
  console.log(`📝 ${config.description}`);
  console.log('─'.repeat(50));

  try {
    const command = `npx jest ${config.pattern} --verbose --coverage --testTimeout=10000`;
    console.log(`🔧 执行命令: ${command}\n`);

    execSync(command, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    console.log(`\n✅ ${config.name} 完成\n`);
    return true;
  } catch (error) {
    console.error(`\n❌ ${config.name} 失败:`, error.message);
    return false;
  }
}

// 运行所有测试
async function runAllTests() {
  const startTime = Date.now();
  const results = [];

  console.log('🎯 测试环境信息:');
  console.log(`   Node.js版本: ${process.version}`);
  console.log(`   工作目录: ${process.cwd()}`);
  console.log(`   测试目录: ${__dirname}`);

  // 运行各个测试组
  for (const config of testConfigs) {
    const success = runTests(config);
    results.push({ name: config.name, success });
  }

  // 运行完整测试套件
  console.log('\n📊 运行完整测试套件...');
  console.log('─'.repeat(50));

  try {
    const command = 'npx jest --verbose --coverage --testTimeout=10000';
    console.log(`🔧 执行命令: ${command}\n`);

    execSync(command, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    console.log('\n✅ 完整测试套件完成\n');
    results.push({ name: '完整测试套件', success: true });
  } catch (error) {
    console.error('\n❌ 完整测试套件失败:', error.message);
    results.push({ name: '完整测试套件', success: false });
  }

  // 显示测试结果摘要
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log('\n📈 测试结果摘要');
  console.log('═'.repeat(50));

  results.forEach(result => {
    const status = result.success ? '✅ 通过' : '❌ 失败';
    console.log(`${status} ${result.name}`);
  });

  const passedTests = results.filter(r => r.success).length;
  const totalTests = results.length;
  const successRate = ((passedTests / totalTests) * 100).toFixed(1);

  console.log('\n📊 统计信息:');
  console.log(`   总测试组: ${totalTests}`);
  console.log(`   通过测试: ${passedTests}`);
  console.log(`   失败测试: ${totalTests - passedTests}`);
  console.log(`   成功率: ${successRate}%`);
  console.log(`   总耗时: ${duration}秒`);

  if (passedTests === totalTests) {
    console.log('\n🎉 所有测试通过！系统功能正常。');
    process.exit(0);
  } else {
    console.log('\n⚠️  部分测试失败，请检查错误信息。');
    process.exit(1);
  }
}

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('\n💥 未捕获的异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n💥 未处理的Promise拒绝:', reason);
  process.exit(1);
});

// 运行测试
runAllTests().catch(error => {
  console.error('\n💥 测试运行失败:', error);
  process.exit(1);
});
