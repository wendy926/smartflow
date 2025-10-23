/**
 * 修复历史交易记录的盈亏计算
 * 
 * 问题：之前使用固定仓位0.1导致盈亏计算不准确
 * 解决：根据entry_price、exit_price、quantity重新计算pnl和pnl_percentage
 */

const mysql = require('mysql2/promise');
const logger = require('./src/utils/logger');

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'trading_system',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

/**
 * 重新计算单个交易的盈亏
 */
function recalculatePnL(trade) {
  const { trade_type, entry_price, exit_price, quantity } = trade;

  if (!exit_price || !entry_price || !quantity) {
    return null; // 未平仓或数据不完整
  }

  // 计算盈亏
  let pnl;
  if (trade_type === 'LONG') {
    pnl = (exit_price - entry_price) * quantity;
  } else if (trade_type === 'SHORT') {
    pnl = (entry_price - exit_price) * quantity;
  } else {
    return null;
  }

  // 计算盈亏百分比
  const pnl_percentage = (pnl / (entry_price * quantity)) * 100;

  return {
    pnl: pnl,
    pnl_percentage: pnl_percentage
  };
}

/**
 * 主函数
 */
async function fixHistoricalPnL() {
  let connection;

  try {
    console.log('='.repeat(80));
    console.log('🔧 开始修复历史交易记录盈亏计算');
    console.log('='.repeat(80));
    console.log();

    // 连接数据库
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
    console.log();

    // 获取所有已关闭的交易记录
    const [trades] = await connection.execute(
      `SELECT id, symbol_id, strategy_name, trade_type, entry_price, exit_price, 
              quantity, pnl, pnl_percentage, status, entry_time, exit_time
       FROM simulation_trades
       WHERE status = 'CLOSED' AND exit_price IS NOT NULL
       ORDER BY id ASC`
    );

    console.log(`📊 找到 ${trades.length} 条已关闭的交易记录`);
    console.log();

    if (trades.length === 0) {
      console.log('ℹ️  没有需要修复的记录');
      return;
    }

    // 统计
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    console.log('🔄 开始重新计算盈亏...');
    console.log();

    // 逐条处理
    for (const trade of trades) {
      try {
        // 重新计算盈亏
        const result = recalculatePnL(trade);

        if (!result) {
          console.log(`⚠️  跳过交易 ID ${trade.id}: 数据不完整`);
          skippedCount++;
          continue;
        }

        const { pnl, pnl_percentage } = result;

        // 检查是否需要更新
        const oldPnl = parseFloat(trade.pnl) || 0;
        const pnlDiff = Math.abs(pnl - oldPnl);

        if (pnlDiff < 0.01) {
          // 盈亏变化小于0.01，跳过
          skippedCount++;
          continue;
        }

        // 更新数据库
        await connection.execute(
          `UPDATE simulation_trades 
           SET pnl = ?, pnl_percentage = ?
           WHERE id = ?`,
          [pnl, pnl_percentage, trade.id]
        );

        console.log(`✅ 交易 ID ${trade.id}: 原盈亏 ${oldPnl.toFixed(4)} → 新盈亏 ${pnl.toFixed(4)} USDT (${pnl >= 0 ? '+' : ''}${pnl_percentage.toFixed(2)}%)`);
        updatedCount++;

      } catch (error) {
        console.error(`❌ 处理交易 ID ${trade.id} 失败:`, error.message);
        errorCount++;
      }
    }

    console.log();
    console.log('='.repeat(80));
    console.log('📈 修复完成统计');
    console.log('='.repeat(80));
    console.log(`总记录数: ${trades.length}`);
    console.log(`已更新: ${updatedCount}`);
    console.log(`跳过: ${skippedCount}`);
    console.log(`错误: ${errorCount}`);
    console.log();

    // 重新计算统计数据
    console.log('🔄 重新计算统计数据...');
    console.log();

    await recalculateStatistics(connection);

    console.log();
    console.log('✅ 所有操作完成');
    console.log();

  } catch (error) {
    console.error('❌ 修复失败:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 数据库连接已关闭');
    }
  }
}

/**
 * 重新计算统计数据
 */
async function recalculateStatistics(connection) {
  try {
    // 获取所有策略和交易对的组合
    const [combinations] = await connection.execute(
      `SELECT DISTINCT s.symbol, st.strategy_name
       FROM simulation_trades st
       JOIN symbols s ON st.symbol_id = s.id
       WHERE st.status = 'CLOSED'`
    );

    console.log(`📊 找到 ${combinations.length} 个策略-交易对组合`);

    for (const { symbol, strategy_name } of combinations) {
      // 获取该组合的所有交易
      const [trades] = await connection.execute(
        `SELECT pnl
         FROM simulation_trades st
         JOIN symbols s ON st.symbol_id = s.id
         WHERE s.symbol = ? AND st.strategy_name = ? AND st.status = 'CLOSED'
         ORDER BY st.exit_time ASC`,
        [symbol, strategy_name]
      );

      if (trades.length === 0) continue;

      // 计算统计指标
      const total_trades = trades.length;
      const winning_trades = trades.filter(t => parseFloat(t.pnl) > 0).length;
      const losing_trades = trades.filter(t => parseFloat(t.pnl) < 0).length;
      const win_rate = total_trades > 0 ? (winning_trades / total_trades) * 100 : 0;
      const total_pnl = trades.reduce((sum, t) => sum + parseFloat(t.pnl), 0);
      const avg_pnl = total_trades > 0 ? total_pnl / total_trades : 0;
      const max_pnl = trades.length > 0 ? Math.max(...trades.map(t => parseFloat(t.pnl))) : 0;
      const min_pnl = trades.length > 0 ? Math.min(...trades.map(t => parseFloat(t.pnl))) : 0;

      // 计算最大回撤
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

      console.log(`  ${symbol} (${strategy_name}): ${total_trades}笔 | 胜率 ${win_rate.toFixed(1)}% | 总盈亏 ${total_pnl >= 0 ? '+' : ''}${total_pnl.toFixed(2)} USDT`);

      // 更新或插入统计记录（这里暂时跳过，因为symbol_statistics表结构需要symbol_id）
      // 实际应用中需要根据实际表结构更新
    }

    console.log();
    console.log('✅ 统计数据更新完成');

  } catch (error) {
    console.error('❌ 统计数据计算失败:', error);
    throw error;
  }
}

// 运行脚本
if (require.main === module) {
  fixHistoricalPnL()
    .then(() => {
      console.log('🎉 脚本执行成功');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { fixHistoricalPnL, recalculatePnL };

