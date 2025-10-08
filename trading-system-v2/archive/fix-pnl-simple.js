/**
 * 简化版历史交易盈亏修复脚本
 * 直接使用MySQL连接
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'trading_system'
};

/**
 * 重新计算盈亏
 */
function recalculatePnL(trade) {
  const { trade_type, entry_price, exit_price, quantity } = trade;

  if (!exit_price || !entry_price || !quantity) {
    return null;
  }

  let pnl;
  if (trade_type === 'LONG') {
    pnl = (exit_price - entry_price) * quantity;
  } else if (trade_type === 'SHORT') {
    pnl = (entry_price - exit_price) * quantity;
  } else {
    return null;
  }

  const pnl_percentage = (pnl / (entry_price * quantity)) * 100;

  return { pnl, pnl_percentage };
}

/**
 * 主函数
 */
async function fixPnL() {
  let connection;

  try {
    console.log('='.repeat(80));
    console.log('🔧 开始修复VPS历史交易记录盈亏');
    console.log('='.repeat(80));
    console.log();

    // 连接数据库
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
    console.log();

    // 获取所有已关闭的交易
    const [trades] = await connection.execute(
      `SELECT st.id, s.symbol, st.strategy_name, st.trade_type, 
              st.entry_price, st.exit_price, st.quantity, st.pnl, st.pnl_percentage
       FROM simulation_trades st
       JOIN symbols s ON st.symbol_id = s.id
       WHERE st.status = 'CLOSED' AND st.exit_price IS NOT NULL
       ORDER BY st.id ASC`
    );

    console.log(`📊 找到 ${trades.length} 条已关闭的交易记录`);
    console.log();

    if (trades.length === 0) {
      console.log('ℹ️  没有需要修复的记录');
      return;
    }

    let updatedCount = 0;
    let skippedCount = 0;

    console.log('🔄 开始重新计算盈亏...');
    console.log();

    for (const trade of trades) {
      const result = recalculatePnL(trade);

      if (!result) {
        skippedCount++;
        continue;
      }

      const { pnl, pnl_percentage } = result;
      const oldPnl = parseFloat(trade.pnl) || 0;
      const pnlDiff = Math.abs(pnl - oldPnl);

      if (pnlDiff < 0.000001) {
        skippedCount++;
        continue;
      }

      // 更新数据库
      await connection.execute(
        `UPDATE simulation_trades SET pnl = ?, pnl_percentage = ? WHERE id = ?`,
        [pnl, pnl_percentage, trade.id]
      );

      console.log(`✅ ID ${trade.id} (${trade.symbol} ${trade.strategy_name}): ` +
        `${oldPnl.toFixed(4)} → ${pnl.toFixed(4)} USDT (${pnl >= 0 ? '+' : ''}${pnl_percentage.toFixed(2)}%)`);
      updatedCount++;
    }

    console.log();
    console.log('='.repeat(80));
    console.log('📈 修复完成');
    console.log('='.repeat(80));
    console.log(`总记录: ${trades.length}`);
    console.log(`已更新: ${updatedCount}`);
    console.log(`跳过: ${skippedCount}`);
    console.log();

    // 显示统计
    await showStats(connection);

  } catch (error) {
    console.error('❌ 修复失败:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 数据库连接已关闭');
    }
  }
}

/**
 * 显示统计信息
 */
async function showStats(connection) {
  console.log('='.repeat(80));
  console.log('📊 当前统计数据');
  console.log('='.repeat(80));
  console.log();

  // V3策略统计
  const [v3Stats] = await connection.execute(
    `SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as winning,
      SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losing,
      SUM(pnl) as total_pnl
     FROM simulation_trades
     WHERE strategy_name = 'V3' AND status = 'CLOSED'`
  );

  if (v3Stats[0].total > 0) {
    const winRate = (v3Stats[0].winning / v3Stats[0].total) * 100;
    console.log('📈 V3策略:');
    console.log(`  总交易: ${v3Stats[0].total}`);
    console.log(`  盈利: ${v3Stats[0].winning} | 亏损: ${v3Stats[0].losing}`);
    console.log(`  胜率: ${winRate.toFixed(2)}%`);
    console.log(`  总盈亏: ${v3Stats[0].total_pnl >= 0 ? '+' : ''}${parseFloat(v3Stats[0].total_pnl).toFixed(2)} USDT`);
    console.log();
  }

  // ICT策略统计
  const [ictStats] = await connection.execute(
    `SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as winning,
      SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losing,
      SUM(pnl) as total_pnl
     FROM simulation_trades
     WHERE strategy_name = 'ICT' AND status = 'CLOSED'`
  );

  if (ictStats[0].total > 0) {
    const winRate = (ictStats[0].winning / ictStats[0].total) * 100;
    console.log('📈 ICT策略:');
    console.log(`  总交易: ${ictStats[0].total}`);
    console.log(`  盈利: ${ictStats[0].winning} | 亏损: ${ictStats[0].losing}`);
    console.log(`  胜率: ${winRate.toFixed(2)}%`);
    console.log(`  总盈亏: ${ictStats[0].total_pnl >= 0 ? '+' : ''}${parseFloat(ictStats[0].total_pnl).toFixed(2)} USDT`);
    console.log();
  }
}

// 运行
if (require.main === module) {
  fixPnL()
    .then(() => {
      console.log('🎉 修复完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 修复失败:', error);
      process.exit(1);
    });
}

module.exports = { fixPnL, recalculatePnL };

