/**
 * 直接测试回测参数加载
 * 在VPS上运行此脚本验证参数是否正确加载
 */

const mysql = require('mysql2/promise');

async function testBacktestParams() {
  let connection;

  try {
    console.log('=== V3策略回测参数验证 ===\n');

    // 连接数据库
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'trading_system_2024',
      database: 'trading_system'
    });

    console.log('数据库连接成功\n');

    // 检查V3策略参数
    const modes = ['AGGRESSIVE', 'BALANCED', 'CONSERVATIVE'];

    for (const mode of modes) {
      console.log(`\n======== ${mode} 模式 ========`);

      const [rows] = await connection.execute(`
        SELECT param_name, param_value, category, is_active
        FROM strategy_params
        WHERE strategy_name = 'V3' AND strategy_mode = ?
        ORDER BY param_name
      `, [mode]);

      console.log(`参数数量: ${rows.length}`);

      const riskParams = rows.filter(r => r.category === 'risk_management');
      const trendParams = rows.filter(r => r.category === 'trend_thresholds');

      console.log('\n风险管理参数 (risk_management):');
      riskParams.forEach(r => {
        console.log(`  - ${r.param_name}: ${r.param_value} (is_active: ${r.is_active})`);
      });

      console.log('\n趋势阈值参数 (trend_thresholds):');
      trendParams.forEach(r => {
        console.log(`  - ${r.param_name}: ${r.param_value} (is_active: ${r.is_active})`);
      });
    }

    // 检查是否有is_active = 1的参数
    console.log('\n\n======== 检查 is_active 状态 ========');
    const [activeCheck] = await connection.execute(`
      SELECT strategy_mode, param_name, is_active
      FROM strategy_params
      WHERE strategy_name = 'V3'
        AND param_name IN ('stopLossATRMultiplier', 'takeProfitRatio')
      ORDER BY strategy_mode, param_name
    `);

    console.log('is_active 状态:');
    activeCheck.forEach(row => {
      console.log(`  ${row.strategy_mode}.${row.param_name}: is_active = ${row.is_active}`);
    });

    console.log('\n\n测试完成');
    await connection.end();

  } catch (error) {
    console.error('测试失败:', error.message);
    if (connection) {
      await connection.end();
    }
    process.exit(1);
  }
}

testBacktestParams();
