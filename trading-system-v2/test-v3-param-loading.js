#!/usr/bin/env node

/**
 * 测试V3策略参数加载
 * 验证不同模式是否加载了不同的参数
 */

const V3Strategy = require('./src/strategies/v3-strategy');
const DatabaseConnection = require('./src/database/connection');

async function testV3ParameterLoading() {
  console.log('=== V3策略参数加载测试 ===');

  try {
    // 测试三个模式
    const modes = ['AGGRESSIVE', 'BALANCED', 'CONSERVATIVE'];

    for (const mode of modes) {
      console.log(`\n--- 测试模式: ${mode} ---`);

      // 创建新的策略实例
      const strategy = new V3Strategy();

      // 等待参数加载完成
      await strategy.initializeParameters(mode);

      // 输出关键参数
      console.log('策略实例参数:');
      console.log(`  mode: ${strategy.mode}`);
      console.log(`  trend4HStrongThreshold: ${strategy.params?.trend_thresholds?.trend4HStrongThreshold || 'undefined'}`);
      console.log(`  entry15MStrongThreshold: ${strategy.params?.entry_thresholds?.entry15MStrongThreshold || 'undefined'}`);
      console.log(`  stopLossATRMultiplier: ${strategy.params?.risk_management?.stopLossATRMultiplier || 'undefined'}`);
      console.log(`  takeProfitRatio: ${strategy.params?.risk_management?.takeProfitRatio || 'undefined'}`);

      // 输出完整的params结构
      console.log('完整params结构:');
      console.log(JSON.stringify(strategy.params, null, 2));
    }

  } catch (error) {
    console.error('测试失败:', error);
  }

  process.exit(0);
}

testV3ParameterLoading();
