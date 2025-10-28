#!/usr/bin/env node

/**
 * 直接测试V3策略参数加载
 * 验证不同模式是否加载了不同的参数
 */

const V3Strategy = require('./src/strategies/v3-strategy');
const DatabaseConnection = require('./src/database/connection');

async function testV3Parameters() {
  console.log('=== V3策略参数加载测试 ===');

  try {
    // 初始化数据库连接
    const db = new DatabaseConnection();
    await db.connect();
    console.log('✅ 数据库连接成功');

    const modes = ['AGGRESSIVE', 'BALANCED', 'CONSERVATIVE'];

    for (const mode of modes) {
      console.log(`\n--- 测试 ${mode} 模式 ---`);

      // 创建新的策略实例
      const strategy = new V3Strategy();

      // 加载参数
      await strategy.initializeParameters(mode);

      // 检查关键参数
      const keyParams = [
        'trend4HStrongThreshold',
        'entry15MStrongThreshold',
        'stopLossATRMultiplier',
        'takeProfitRatio'
      ];

      console.log(`模式: ${mode}`);
      keyParams.forEach(param => {
        let value = 'undefined';
        if (param.includes('trend4H')) {
          value = strategy.params.trend_thresholds?.[param] || 'undefined';
        } else if (param.includes('entry15M')) {
          value = strategy.params.entry_thresholds?.[param] || 'undefined';
        } else if (param.includes('ATR') || param.includes('Ratio')) {
          value = strategy.params.risk_management?.[param] || 'undefined';
        }
        console.log(`  ${param}: ${value}`);
      });

      // 测试getThreshold方法
      console.log('通过getThreshold方法获取:');
      console.log(`  trend4HStrongThreshold: ${strategy.getThreshold('trend', 'trend4HStrongThreshold', 999)}`);
      console.log(`  entry15MStrongThreshold: ${strategy.getThreshold('entry', 'entry15MStrongThreshold', 999)}`);
      console.log(`  stopLossATRMultiplier: ${strategy.getThreshold('risk_management', 'stopLossATRMultiplier', 999)}`);
      console.log(`  takeProfitRatio: ${strategy.getThreshold('risk_management', 'takeProfitRatio', 999)}`);
    }

    await db.close();
    console.log('\n✅ 测试完成');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 运行测试
testV3Parameters();
