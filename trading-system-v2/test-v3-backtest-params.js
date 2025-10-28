/**
 * V3策略回测参数验证测试
 * 直接触发回测，验证参数是否正确加载
 */

const BacktestManagerV3 = require('./src/services/backtest-manager-v3');
const DatabaseConnection = require('./src/database/connection');
const logger = require('./src/utils/logger');

async function testV3Backtest() {
  try {
    console.log('=== 开始V3策略回测参数验证测试 ===\n');

    // 1. 初始化数据库连接
    console.log('[测试] 初始化数据库连接...');
    const database = new DatabaseConnection();
    await database.connect();
    console.log('[测试] 数据库连接成功\n');

    // 2. 创建回测管理器
    console.log('[测试] 创建回测管理器...');
    const backtestManager = new BacktestManagerV3(database);
    console.log('[测试] 回测管理器创建成功\n');

    // 3. 检查参数加载
    console.log('[测试] 检查参数加载...\n');
    const modes = ['AGGRESSIVE', 'BALANCED', 'CONSERVATIVE'];

    for (const mode of modes) {
      console.log(`\n[测试] ======== 检查V3-${mode}参数 ========`);

      const params = await backtestManager.getStrategyParameters('V3', mode);
      console.log(`[测试] V3-${mode}参数加载完成`);
      console.log(`[测试] 参数组数量: ${Object.keys(params).length}`);

      // 检查关键参数
      const riskParams = params.risk_management || {};
      console.log(`[测试] risk_management组参数:`);
      console.log(`  - stopLossATRMultiplier: ${riskParams.stopLossATRMultiplier}`);
      console.log(`  - takeProfitRatio: ${riskParams.takeProfitRatio}`);

      const trendParams = params.trend_thresholds || {};
      console.log(`[测试] trend_thresholds组参数:`);
      console.log(`  - trend4HStrongThreshold: ${trendParams.trend4HStrongThreshold}`);
      console.log(`  - entry15MStrongThreshold: ${trendParams.entry15MStrongThreshold}`);
    }

    // 4. 触发回测
    console.log('\n\n[测试] ======== 触发V3策略回测 ========');
    console.log('[测试] 模式: BALANCED');
    console.log('[测试] 交易对: BTCUSDT, ETHUSDT');
    console.log('[测试] 时间框架: 15m');

    const result = await backtestManager.startBacktest('V3', 'BALANCED', {
      symbols: ['BTCUSDT', 'ETHUSDT'],
      timeframe: '15m',
      forceRefresh: true
    });

    console.log('\n[测试] ======== 回测完成 ========');
    console.log('[测试] 回测结果:', JSON.stringify(result, null, 2));

    // 5. 输出回测统计
    if (result && result.data && result.data.metrics) {
      const metrics = result.data.metrics;
      console.log('\n[测试] ======== 回测统计 ========');
      console.log(`[测试] 胜率: ${(metrics.winRate * 100).toFixed(2)}%`);
      console.log(`[测试] 总交易数: ${metrics.totalTrades}`);
      console.log(`[测试] 盈利交易数: ${metrics.winningTrades}`);
      console.log(`[测试] 亏损交易数: ${metrics.losingTrades}`);
      console.log(`[测试] 总盈亏: ${metrics.totalPnl}`);
      console.log(`[测试] 最大回撤: ${(metrics.maxDrawdown * 100).toFixed(2)}%`);
    }

    await database.disconnect();
    console.log('\n[测试] 测试完成');
    process.exit(0);

  } catch (error) {
    console.error('[测试] 测试失败:', error);
    logger.error('[测试] 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
testV3Backtest();
