/**
 * 触发V3策略回测并验证结果
 * 通过直接调用BacktestManager来避免API认证问题
 */

const BacktestManagerV3 = require('./trading-system-v2/src/services/backtest-manager-v3');
const DatabaseConnection = require('./trading-system-v2/src/database/connection');

async function triggerBacktest() {
  console.log('\n=== 触发V3策略回测 ===\n');

  try {
    // 初始化数据库
    console.log('1. 初始化数据库连接...');
    const db = DatabaseConnection.getInstance ? DatabaseConnection.getInstance() : DatabaseConnection;
    await db.connect();
    console.log('✅ 数据库连接成功\n');

    // 创建回测管理器
    console.log('2. 创建回测管理器...');
    const backtestManager = new BacktestManagerV3(db);
    console.log('✅ 回测管理器创建成功\n');

    // 触发三个模式的回测
    const modes = ['AGGRESSIVE', 'BALANCED', 'CONSERVATIVE'];
    const results = {};

    for (const mode of modes) {
      console.log(`\n=== 触发 V3-${mode} 回测 ===`);
      try {
        const result = await backtestManager.startBacktest('V3', mode, {
          symbols: backtestManager.getDefaultSymbols(),
          timeframe: '15m',
          forceRefresh: false
        });

        console.log(`✅ V3-${mode} 回测已启动:`, {
          taskId: result.taskId,
          status: result.status
        });

        results[mode] = result;
      } catch (error) {
        console.error(`❌ V3-${mode} 回测启动失败:`, error.message);
        results[mode] = { error: error.message };
      }
    }

    // 等待回测完成（回测是异步的，这里等待一段时间）
    console.log('\n\n3. 等待回测完成（预计需要1-2分钟）...');
    console.log('   回测正在后台运行，请稍后查询结果...\n');

    // 等待60秒让回测有时间完成
    await new Promise(resolve => setTimeout(resolve, 60000));

    // 查询回测结果
    console.log('4. 查询回测结果...\n');
    const query = `
      SELECT
        strategy_mode as mode,
        ROUND(win_rate * 100, 2) as win_rate_pct,
        ROUND(total_pnl, 2) as total_pnl,
        ROUND(max_drawdown * 100, 2) as max_drawdown_pct,
        total_trades,
        ROUND(IFNULL(avg_win/ABS(avg_loss), 0), 2) as rr_ratio,
        created_at
      FROM strategy_parameter_backtest_results
      WHERE strategy_name = 'V3'
        AND created_at > DATE_SUB(NOW(), INTERVAL 10 MINUTE)
      ORDER BY created_at DESC
      LIMIT 3
    `;

    const dbResults = await db.query(query);

    console.log('📊 最新回测结果:');
    console.log('='.repeat(80));
    console.table(dbResults.map(r => ({
      模式: r.mode,
      胜率: `${r.win_rate_pct}%`,
      总盈亏: r.total_pnl,
      最大回撤: `${r.max_drawdown_pct}%`,
      总交易数: r.total_trades,
      盈亏比: r.rr_ratio,
      创建时间: r.created_at
    })));

    // 验证是否达标
    console.log('\n🎯 验证结果:');
    console.log('='.repeat(80));

    let allPassed = true;
    for (const result of dbResults) {
      const winRateOK = result.win_rate_pct >= 50;
      const rrOK = result.rr_ratio >= 3.0;
      const profitOK = result.total_pnl >= 0;

      const status = (winRateOK && rrOK && profitOK) ? '✅' : '❌';
      console.log(`${status} ${result.mode}: 胜率${winRateOK ? '✅' : '❌'} ${result.win_rate_pct}%, 盈亏比${rrOK ? '✅' : '❌'} ${result.rr_ratio}, 盈亏${profitOK ? '✅' : '❌'} ${result.total_pnl}`);

      if (!winRateOK || !rrOK || !profitOK) {
        allPassed = false;
      }
    }

    console.log('\n' + '='.repeat(80));
    if (allPassed) {
      console.log('✅ 所有模式均已达到目标！');
    } else {
      console.log('⚠️  部分模式未达到目标，需要进一步优化');
    }

    process.exit(allPassed ? 0 : 1);

  } catch (error) {
    console.error('❌ 回测触发失败:', error);
    process.exit(1);
  }
}

triggerBacktest();

