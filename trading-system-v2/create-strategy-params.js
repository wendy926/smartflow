const mysql = require('mysql2/promise');

const params = [
  // ICT BALANCED
  ['ICT', 'BALANCED', 'position', 'riskPercent', '0.01', 'number', 'position', '单笔风险百分比（平衡）', '%', '0.005', '0.02', 1],
  ['ICT', 'BALANCED', 'position', 'maxLeverage', '24', 'number', 'position', '最大杠杆倍数（平衡）', '倍', '10', '24', 1],
  ['ICT', 'BALANCED', 'position', 'stopLossATRMultiplier', '1.8', 'number', 'position', '止损ATR倍数（平衡）', '× ATR', '1.5', '2.5', 1],
  ['ICT', 'BALANCED', 'position', 'takeProfitRatio', '4.0', 'number', 'position', '止盈比例（平衡）', 'R', '2.0', '5.0', 1],

  // ICT AGGRESSIVE
  ['ICT', 'AGGRESSIVE', 'position', 'riskPercent', '0.015', 'number', 'position', '单笔风险百分比（激进）', '%', '0.005', '0.02', 1],
  ['ICT', 'AGGRESSIVE', 'position', 'maxLeverage', '20', 'number', 'position', '最大杠杆倍数（激进）', '倍', '10', '24', 1],
  ['ICT', 'AGGRESSIVE', 'position', 'stopLossATRMultiplier', '1.5', 'number', 'position', '止损ATR倍数（激进）', '× ATR', '1.2', '2.0', 1],
  ['ICT', 'AGGRESSIVE', 'position', 'takeProfitRatio', '3.5', 'number', 'position', '止盈比例（激进）', 'R', '2.0', '5.0', 1],

  // ICT CONSERVATIVE
  ['ICT', 'CONSERVATIVE', 'position', 'riskPercent', '0.0075', 'number', 'position', '单笔风险百分比（保守）', '%', '0.005', '0.02', 1],
  ['ICT', 'CONSERVATIVE', 'position', 'maxLeverage', '15', 'number', 'position', '最大杠杆倍数（保守）', '倍', '10', '24', 1],
  ['ICT', 'CONSERVATIVE', 'position', 'stopLossATRMultiplier', '2.0', 'number', 'position', '止损ATR倍数（保守）', '× ATR', '1.5', '2.5', 1],
  ['ICT', 'CONSERVATIVE', 'position', 'takeProfitRatio', '4.5', 'number', 'position', '止盈比例（保守）', 'R', '2.0', '5.0', 1],

  // V3 BALANCED
  ['V3', 'BALANCED', 'risk_management', 'riskPercent', '0.01', 'number', 'risk_management', '单笔风险百分比（平衡）', '%', '0.005', '0.02', 1],
  ['V3', 'BALANCED', 'risk_management', 'maxLeverage', '24', 'number', 'risk_management', '最大杠杆倍数（平衡）', '倍', '10', '24', 1],
  ['V3', 'BALANCED', 'risk_management', 'stopLossATRMultiplier', '1.5', 'number', 'risk_management', '止损ATR倍数（平衡）', '× ATR', '1.2', '2.0', 1],
  ['V3', 'BALANCED', 'risk_management', 'takeProfitRatio', '4.5', 'number', 'risk_management', '止盈比例（平衡）', 'R', '3.5', '6.0', 1],

  // V3 AGGRESSIVE
  ['V3', 'AGGRESSIVE', 'risk_management', 'riskPercent', '0.015', 'number', 'risk_management', '单笔风险百分比（激进）', '%', '0.005', '0.02', 1],
  ['V3', 'AGGRESSIVE', 'risk_management', 'maxLeverage', '20', 'number', 'risk_management', '最大杠杆倍数（激进）', '倍', '10', '24', 1],
  ['V3', 'AGGRESSIVE', 'risk_management', 'stopLossATRMultiplier', '1.3', 'number', 'risk_management', '止损ATR倍数（激进）', '× ATR', '1.2', '2.0', 1],
  ['V3', 'AGGRESSIVE', 'risk_management', 'takeProfitRatio', '3.8', 'number', 'risk_management', '止盈比例（激进）', 'R', '3.5', '6.0', 1],

  // V3 CONSERVATIVE
  ['V3', 'CONSERVATIVE', 'risk_management', 'riskPercent', '0.0075', 'number', 'risk_management', '单笔风险百分比（保守）', '%', '0.005', '0.02', 1],
  ['V3', 'CONSERVATIVE', 'risk_management', 'maxLeverage', '15', 'number', 'risk_management', '最大杠杆倍数（保守）', '倍', '10', '24', 1],
  ['V3', 'CONSERVATIVE', 'risk_management', 'stopLossATRMultiplier', '1.8', 'number', 'risk_management', '止损ATR倍数（保守）', '× ATR', '1.5', '2.5', 1],
  ['V3', 'CONSERVATIVE', 'risk_management', 'takeProfitRatio', '5.5', 'number', 'risk_management', '止盈比例（保守）', 'R', '3.5', '6.0', 1],
];

async function createParams() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: process.env.MYSQL_ROOT_PASSWORD || '',
    database: 'trading_system'
  });

  console.log('✅ 连接数据库成功');

  let count = 0;
  for (const param of params) {
    try {
      await connection.query(`
        INSERT INTO strategy_params
        (strategy_name, strategy_mode, param_group, param_name, param_value, param_type, category, description, unit, min_value, max_value, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          param_value = VALUES(param_value),
          updated_at = NOW()
      `, param);
      count++;
    } catch (error) {
      console.error(`插入参数失败:`, error.message);
    }
  }

  const [rows] = await connection.query(`
    SELECT strategy_name, strategy_mode, COUNT(*) as count
    FROM strategy_params
    WHERE strategy_name IN ('ICT', 'V3')
    GROUP BY strategy_name, strategy_mode
    ORDER BY strategy_name, strategy_mode
  `);

  console.log('\n📊 参数统计:');
  for (const row of rows) {
    console.log(`${row.strategy_name} ${row.strategy_mode}: ${row.count} 个参数`);
  }

  await connection.end();
  console.log('\n✅ 参数创建完成');
}

createParams().catch(console.error);

