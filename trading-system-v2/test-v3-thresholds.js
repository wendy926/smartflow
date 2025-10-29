#!/usr/bin/env node

/**
 * 测试V3策略参数加载和getThreshold方法
 */

const V3Strategy = require('./src/strategies/v3-strategy');

async function testV3Thresholds() {
  console.log('=== V3策略阈值测试 ===');

  try {
    const modes = ['AGGRESSIVE', 'BALANCED', 'CONSERVATIVE'];

    for (const mode of modes) {
      console.log(`\n--- 测试模式: ${mode} ---`);

      const strategy = new V3Strategy();
      await strategy.initializeParameters(mode);

      console.log('getThreshold测试:');
      console.log(`  trend4HModerateThreshold: ${strategy.getThreshold('trend', 'trend4HModerateThreshold', 999)}`);
      console.log(`  entry15MModerateThreshold: ${strategy.getThreshold('entry', 'entry15MModerateThreshold', 999)}`);

      console.log('直接访问params:');
      console.log(`  trend_thresholds.trend4HModerateThreshold: ${strategy.params.trend_thresholds?.trend4HModerateThreshold || 'undefined'}`);
      console.log(`  entry_thresholds.entry15MModerateThreshold: ${strategy.params.entry_thresholds?.entry15MModerateThreshold || 'undefined'}`);
    }

  } catch (error) {
    console.error('测试失败:', error);
  }

  process.exit(0);
}

testV3Thresholds();
