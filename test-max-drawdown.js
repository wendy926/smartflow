const mysql = require('mysql2/promise');

async function testMaxDrawdown() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'SmartFlow2024!',
    database: 'trading_system'
  });

  try {
    // 获取V3策略的已完成交易
    const [trades] = await connection.execute(
      `SELECT pnl, created_at FROM simulation_trades
       WHERE strategy_name = 'V3' AND pnl IS NOT NULL AND status = 'CLOSED'
       ORDER BY created_at ASC`
    );

    console.log('V3策略交易数:', trades.length);

    if (trades.length === 0) {
      console.log('无交易记录');
      return;
    }

    let peak = 0;
    let maxDrawdown = 0;
    let cumulative = 0;

    for (const trade of trades) {
      cumulative += parseFloat(trade.pnl);

      if (cumulative > peak) {
        peak = cumulative;
      }

      const drawdown = peak - cumulative;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    console.log('累计收益:', cumulative);
    console.log('历史峰值:', peak);
    console.log('最大回撤:', maxDrawdown);

    // ICT策略
    const [ictTrades] = await connection.execute(
      `SELECT pnl, created_at FROM simulation_trades
       WHERE strategy_name = 'ICT' AND pnl IS NOT NULL AND status = 'CLOSED'
       ORDER BY created_at ASC`
    );

    console.log('\nICT策略交易数:', ictTrades.length);

    let ictPeak = 0;
    let ictMaxDrawdown = 0;
    let ictCumulative = 0;

    for (const trade of ictTrades) {
      ictCumulative += parseFloat(trade.pnl);

      if (ictCumulative > ictPeak) {
        ictPeak = ictCumulative;
      }

      const drawdown = ictPeak - ictCumulative;
      if (drawdown > ictMaxDrawdown) {
        ictMaxDrawdown = drawdown;
      }
    }

    console.log('ICT累计收益:', ictCumulative);
    console.log('ICT历史峰值:', ictPeak);
    console.log('ICT最大回撤:', ictMaxDrawdown);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

testMaxDrawdown();

