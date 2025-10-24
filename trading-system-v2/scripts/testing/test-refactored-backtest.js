/**
 * 重构后回测系统测试脚本
 */

const BacktestManagerRefactored = require('./src/services/backtest-manager-refactored');
const logger = require('./src/utils/logger');

async function testRefactoredBacktest() {
  try {
    console.log('=== 重构后回测系统测试 ===');

    const backtestManager = new BacktestManagerRefactored();

    // 测试1: 获取支持的策略列表
    console.log('\n1. 获取支持的策略列表:');
    const strategies = backtestManager.getSupportedStrategies();
    console.log(strategies);

    // 测试2: 获取支持的时间框架
    console.log('\n2. 获取支持的时间框架:');
    const timeframes = backtestManager.getSupportedTimeframes();
    console.log(timeframes);

    // 测试3: 设置V3策略参数
    console.log('\n3. 设置V3策略参数:');
    const v3Parameters = {
      trend4HStrongThreshold: 0.6,
      trend4HModerateThreshold: 0.4,
      trend4HWeakThreshold: 0.2,
      entry15MStrongThreshold: 0.5,
      entry15MModerateThreshold: 0.3,
      entry15MWeakThreshold: 0.15,
      stopLossATRMultiplier: 0.5,
      takeProfitRatio: 3.0
    };

    const setResult = await backtestManager.setStrategyParameters('V3', 'BALANCED', v3Parameters);
    console.log('设置结果:', setResult);

    // 测试4: 获取V3策略参数
    console.log('\n4. 获取V3策略参数:');
    const getResult = await backtestManager.getStrategyParameters('V3', 'BALANCED');
    console.log('获取结果:', getResult);

    // 测试5: 启动V3策略回测
    console.log('\n5. 启动V3策略回测:');
    const backtestResult = await backtestManager.startBacktest('V3', 'BALANCED', {
      timeframe: '1h',
      startDate: '2025-04-25',
      endDate: '2025-10-22'
    });
    console.log('回测结果:', backtestResult);

    // 测试6: 获取回测结果
    console.log('\n6. 获取回测结果:');
    const results = await backtestManager.getBacktestResults('V3', 'BALANCED', '1h');
    console.log('回测结果列表:', results);

    // 测试7: 批量回测
    console.log('\n7. 批量回测:');
    const batchConfigs = [
      {
        strategyName: 'V3',
        mode: 'AGGRESSIVE',
        options: { timeframe: '1h' }
      },
      {
        strategyName: 'V3',
        mode: 'BALANCED',
        options: { timeframe: '1h' }
      },
      {
        strategyName: 'V3',
        mode: 'CONSERVATIVE',
        options: { timeframe: '1h' }
      }
    ];

    const batchResults = await backtestManager.batchBacktest(batchConfigs);
    console.log('批量回测结果:', batchResults);

    console.log('\n=== 测试完成 ===');

  } catch (error) {
    console.error('测试失败:', error);
    logger.error('重构后回测系统测试失败', error);
  }
}

// 运行测试
if (require.main === module) {
  testRefactoredBacktest();
}

module.exports = testRefactoredBacktest;
