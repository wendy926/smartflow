require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs').promises;

async function fixStrategyParams() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '47.237.163.85',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_ROOT_PASSWORD || process.env.MYSQL_PASSWORD,
    database: 'trading_system'
  });

  console.log('✅ 数据库连接成功');

  // 读取SQL文件
  const files = [
    'database/strategy-parameterization-aggressive.sql',
    'database/strategy-parameterization-balanced.sql',
    'database/strategy-parameterization-conservative.sql'
  ];

  for (const file of files) {
    console.log(`\n📄 处理文件: ${file}`);
    const sql = await fs.readFile(file, 'utf8');

    // 提取INSERT语句中的参数行
    const lines = sql.split('\n');
    const insertLines = lines.filter(line =>
      line.trim().startsWith('(') && line.includes('(ICT,') || line.includes('(V3,')
    );

    console.log(`找到 ${insertLines.length} 个参数行`);

    for (const line of insertLines) {
      try {
        // 构建完整的INSERT语句
        const tableName = line.includes('(ICT,') ? 'ICT' : 'V3';
        const insertSQL = `INSERT INTO strategy_params (strategy_name, strategy_mode, param_group, param_name, param_value, param_type, category, description, unit, min_value, max_value, is_active) VALUES ${line.trim()}`;

        await connection.query(insertSQL);
      } catch (error) {
        if (!error.message.includes('Duplicate entry')) {
          console.error(`错误插入参数: ${error.message}`);
        }
      }
    }
  }

  // 统计结果
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
  console.log('\n✅ 参数修复完成');
}

fixStrategyParams().catch(console.error);

