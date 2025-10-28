#!/usr/bin/env node

/**
 * 直接测试策略参数加载器
 * 验证不同模式是否加载了不同的参数
 */

const StrategyParameterLoader = require('./src/utils/strategy-param-loader');
const DatabaseConnection = require('./src/database/connection');

async function testParameterLoader() {
  console.log('=== 策略参数加载器测试 ===');

  try {
    // 初始化数据库连接
    const db = new DatabaseConnection();
    await db.connect();
    console.log('✅ 数据库连接成功');

    const loader = new StrategyParameterLoader(db);
    const modes = ['AGGRESSIVE', 'BALANCED', 'CONSERVATIVE'];

    for (const mode of modes) {
      console.log(`\n--- 测试 V3-${mode} 模式 ---`);

      // 加载参数
      const params = await loader.loadParameters('V3', mode);

      // 检查关键参数
      const keyParams = [
        'trend4HStrongThreshold',
        'entry15MStrongThreshold',
        'stopLossATRMultiplier',
        'takeProfitRatio'
      ];

      console.log(`模式: ${mode}`);
      console.log(`参数组: ${Object.keys(params).join(', ')}`);

      keyParams.forEach(param => {
        let value = 'undefined';
        if (param.includes('trend4H')) {
          value = params.trend_thresholds?.[param] || 'undefined';
        } else if (param.includes('entry15M')) {
          value = params.entry_thresholds?.[param] || 'undefined';
        } else if (param.includes('ATR') || param.includes('Ratio')) {
          value = params.risk_management?.[param] || 'undefined';
        }
        console.log(`  ${param}: ${value}`);
      });
    }

    await db.close();
    console.log('\n✅ 测试完成');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 运行测试
testParameterLoader();
