/**
 * 运行策略回测
 * 用法: node run-backtest.js <策略> <交易对> <开始日期> <结束日期> [模式]
 * 示例: node run-backtest.js ICT BTCUSDT 2024-01-01 2024-01-31 BALANCED
 */

const BacktestManagerV3 = require('./src/services/backtest-manager-v3');
const DatabaseConnection = require('./src/database/connection');

async function runBacktest(strategy, symbol, startDate, endDate, mode = 'BALANCED') {
  console.log('\n=== 策略回测系统 ===');
  console.log(`策略: ${strategy}`);
  console.log(`交易对: ${symbol}`);
  console.log(`时间范围: ${startDate} 至 ${endDate}`);
  console.log(`模式: ${mode}`);
  console.log(`时间框架: 5m\n`);

  let db;
  
  try {
    // 1. 初始化数据库连接
    console.log('1. 初始化数据库连接...');
    db = DatabaseConnection;
    // 如果有getInstance方法，使用它；否则直接使用导出的实例
    if (typeof DatabaseConnection.getInstance === 'function') {
      db = DatabaseConnection.getInstance();
    }
    await db.connect();
    console.log('✅ 数据库连接成功\n');

    // 2. 创建回测管理器
    console.log('2. 创建回测管理器...');
    const backtestManager = new BacktestManagerV3();
    console.log('✅ 回测管理器创建成功\n');

    // 3. 运行回测
    console.log('3. 开始运行回测...');
    const result = await backtestManager.runBacktest({
      strategy: strategy,
      symbol: symbol,
      timeframe: '5m',
      startDate: startDate,
      endDate: endDate,
      mode: mode
    });
    console.log('✅ 回测运行完成\n');

    // 4. 输出结果
    console.log('=== 回测结果 ===');
    console.log(`策略: ${result.strategy || strategy}`);
    console.log(`模式: ${result.mode || mode}`);
    console.log(`总交易数: ${result.totalTrades || 0}笔`);
    console.log(`盈利交易: ${result.winningTrades || 0}笔`);
    console.log(`亏损交易: ${result.losingTrades || 0}笔`);
    console.log(`胜率: ${(result.winRate || 0).toFixed(2)}%`);
    console.log(`盈亏比: ${(result.profitFactor || 0).toFixed(2)}:1`);
    console.log(`净盈利: ${(result.netProfit || 0).toFixed(2)} USDT`);
    console.log(`平均盈利: ${(result.avgWin || 0).toFixed(2)} USDT`);
    console.log(`平均亏损: ${(result.avgLoss || 0).toFixed(2)} USDT`);
    console.log(`最大回撤: ${(result.maxDrawdown || 0).toFixed(2)}%`);
    console.log(`夏普比率: ${(result.sharpeRatio || 0).toFixed(2)}`);
    
    console.log('\n✅ 回测完成！');
    
    return result;

  } catch (error) {
    console.error('\n❌ 回测失败:', error.message);
    console.error('错误详情:', error.stack);
    throw error;
  } finally {
    // 5. 清理资源
    if (db) {
      try {
        await db.close();
        console.log('\n数据库连接已关闭');
      } catch (e) {
        // 忽略关闭错误
      }
    }
  }
}

// 解析命令行参数
const args = process.argv.slice(2);

if (args.length < 4) {
  console.log('用法: node run-backtest.js <策略> <交易对> <开始日期> <结束日期> [模式]');
  console.log('示例: node run-backtest.js ICT BTCUSDT 2024-01-01 2024-01-31 BALANCED');
  console.log('\n可用策略: ICT, V3');
  console.log('可用模式: AGGRESSIVE, BALANCED, CONSERVATIVE');
  process.exit(1);
}

const strategy = args[0];
const symbol = args[1];
const startDate = args[2];
const endDate = args[3];
const mode = args[4] || 'BALANCED';

// 验证参数
if (!['ICT', 'V3'].includes(strategy.toUpperCase())) {
  console.error('错误: 策略必须是 ICT 或 V3');
  process.exit(1);
}

if (!['AGGRESSIVE', 'BALANCED', 'CONSERVATIVE'].includes(mode.toUpperCase())) {
  console.error('错误: 模式必须是 AGGRESSIVE, BALANCED 或 CONSERVATIVE');
  process.exit(1);
}

// 运行回测
runBacktest(strategy.toUpperCase(), symbol.toUpperCase(), startDate, endDate, mode.toUpperCase())
  .then(() => {
    console.log('\n程序退出');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n程序异常退出:', error.message);
    process.exit(1);
  });

