/**
 * 测试回测系统V3
 * 验证是否直接调用Dashboard策略逻辑
 */

const BacktestManagerV3 = require('./src/services/backtest-manager-v3');
const DatabaseConnection = require('./src/database/connection');

async function testBacktestV3() {
  console.log('=== 测试回测系统V3 ===\n');

  try {
    // 初始化数据库
    console.log('1. 初始化数据库连接...');
    const database = DatabaseConnection; // 使用单例

    // 创建回测管理器
    console.log('2. 创建回测管理器...');
    const backtestManager = new BacktestManagerV3(database);

    // 测试ICT策略回测
    console.log('\n3. 测试ICT策略回测...');
    const ictResult = await backtestManager.startBacktest('ICT', 'AGGRESSIVE', {
      symbols: ['BTCUSDT'],
      timeframe: '1h'
    });
    console.log('ICT回测结果:', JSON.stringify(ictResult, null, 2));

    // 等待回测完成
    console.log('\n等待回测完成...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    // 查询回测结果
    const query = `
      SELECT * FROM strategy_parameter_backtest_results 
      WHERE strategy_name = 'ICT' AND strategy_mode = 'AGGRESSIVE'
      ORDER BY created_at DESC LIMIT 1
    `;
    const results = await database.query(query);
    
    if (results && results.length > 0) {
      const result = results[0];
      console.log('\n回测结果详情:');
      console.log(`- 总交易数: ${result.total_trades}`);
      console.log(`- 胜率: ${(result.win_rate * 100).toFixed(2)}%`);
      console.log(`- 净利润: ${result.net_profit} USDT`);
      console.log(`- 最大回撤: ${result.max_drawdown} USDT`);
      console.log(`- 盈亏比: ${result.profit_factor}`);
    } else {
      console.log('\n未找到回测结果');
    }

    console.log('\n测试完成！');

  } catch (error) {
    console.error('测试失败:', error);
    process.exit(1);
  }
}

testBacktestV3();

