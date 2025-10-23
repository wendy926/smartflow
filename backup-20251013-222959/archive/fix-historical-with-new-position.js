/**
 * 用新的仓位计算逻辑修复历史交易记录
 * 
 * 逻辑：
 * 1. 根据entry_price和stop_loss，计算新的quantity（基于maxLossAmount=100）
 * 2. 用新的quantity重新计算pnl和pnl_percentage
 * 3. 同时更新leverage和margin_used
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'trading_system'
};

/**
 * 计算新的仓位大小
 */
function calculateNewQuantity(entryPrice, stopLoss, maxLossAmount = 100) {
  if (!stopLoss || stopLoss <= 0) {
    return null;
  }

  const stopDistance = Math.abs(entryPrice - stopLoss);

  if (stopDistance === 0) {
    return null;
  }

  const quantity = maxLossAmount / stopDistance;

  return quantity;
}

/**
 * 计算新的杠杆和保证金
 */
function calculateLeverageAndMargin(entryPrice, stopLoss, quantity) {
  const stopDistance = Math.abs(entryPrice - stopLoss);
  const stopDistancePct = stopDistance / entryPrice;

  // 最大杠杆 = 1 / (止损距离% + 0.5%安全边际)
  const maxLeverage = Math.floor(1 / (stopDistancePct + 0.005));
  const leverage = Math.min(maxLeverage, 20); // 最大20倍

  // 保证金 = 名义价值 / 杠杆
  const notional = quantity * entryPrice;
  const margin = notional / leverage;

  return { leverage, margin };
}

/**
 * 重新计算盈亏
 */
function recalculatePnL(trade, newQuantity) {
  const { trade_type, entry_price, exit_price } = trade;

  if (!exit_price || !entry_price || !newQuantity) {
    return null;
  }

  let pnl;
  if (trade_type === 'LONG') {
    pnl = (exit_price - entry_price) * newQuantity;
  } else if (trade_type === 'SHORT') {
    pnl = (entry_price - exit_price) * newQuantity;
  } else {
    return null;
  }

  const pnl_percentage = (pnl / (entry_price * newQuantity)) * 100;

  return { pnl, pnl_percentage };
}

/**
 * 主函数
 */
async function fixHistoricalTrades() {
  let connection;

  try {
    console.log('='.repeat(80));
    console.log('🔧 用新仓位逻辑修复VPS历史交易记录');
    console.log('='.repeat(80));
    console.log();

    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');
    console.log();

    // 获取所有已关闭的交易
    const [trades] = await connection.execute(
      `SELECT st.id, s.symbol, st.strategy_name, st.trade_type,
              st.entry_price, st.exit_price, st.stop_loss, st.take_profit,
              st.quantity as old_quantity, st.leverage as old_leverage, 
              st.margin_used as old_margin, st.pnl as old_pnl, st.pnl_percentage as old_pnl_pct
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

    const maxLossAmount = 100; // 统一使用100 USDT作为最大损失金额
    console.log(`💰 使用最大损失金额: ${maxLossAmount} USDT`);
    console.log();

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    console.log('🔄 开始重新计算...');
    console.log();
    console.log('格式: ID | 交易对 | 策略 | 旧quantity → 新quantity | 旧盈亏 → 新盈亏');
    console.log('-'.repeat(80));

    for (const trade of trades) {
      try {
        const entryPrice = parseFloat(trade.entry_price);
        const exitPrice = parseFloat(trade.exit_price);
        const stopLoss = parseFloat(trade.stop_loss);
        const oldQuantity = parseFloat(trade.old_quantity);
        const oldPnl = parseFloat(trade.old_pnl);

        // 计算新的quantity
        const newQuantity = calculateNewQuantity(entryPrice, stopLoss, maxLossAmount);

        if (!newQuantity) {
          console.log(`⚠️  ID ${trade.id}: 无法计算新仓位（止损数据无效）`);
          skippedCount++;
          continue;
        }

        // 计算新的盈亏
        const pnlResult = recalculatePnL(trade, newQuantity);

        if (!pnlResult) {
          console.log(`⚠️  ID ${trade.id}: 无法计算新盈亏`);
          skippedCount++;
          continue;
        }

        const { pnl: newPnl, pnl_percentage: newPnlPct } = pnlResult;

        // 计算新的杠杆和保证金
        const { leverage: newLeverage, margin: newMargin } = calculateLeverageAndMargin(
          entryPrice, stopLoss, newQuantity
        );

        // 更新数据库
        await connection.execute(
          `UPDATE simulation_trades 
           SET quantity = ?, leverage = ?, margin_used = ?, pnl = ?, pnl_percentage = ?
           WHERE id = ?`,
          [newQuantity, newLeverage, newMargin, newPnl, newPnlPct, trade.id]
        );

        console.log(`✅ ${trade.id.toString().padStart(3)} | ${trade.symbol.padEnd(10)} | ` +
          `${trade.strategy_name.padEnd(3)} | ` +
          `${oldQuantity.toFixed(4)} → ${newQuantity.toFixed(4)} | ` +
          `${oldPnl >= 0 ? '+' : ''}${oldPnl.toFixed(2).padStart(8)}U → ` +
          `${newPnl >= 0 ? '+' : ''}${newPnl.toFixed(2).padStart(8)}U`);

        updatedCount++;

      } catch (error) {
        console.error(`❌ ID ${trade.id} 处理失败:`, error.message);
        errorCount++;
      }
    }

    console.log('-'.repeat(80));
    console.log();
    console.log('='.repeat(80));
    console.log('📈 修复完成统计');
    console.log('='.repeat(80));
    console.log(`总记录: ${trades.length}`);
    console.log(`已更新: ${updatedCount}`);
    console.log(`跳过: ${skippedCount}`);
    console.log(`错误: ${errorCount}`);
    console.log();

    // 显示新的统计
    await showNewStatistics(connection);

    console.log();
    console.log('✅ 所有操作完成');
    console.log();

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
 * 显示新的统计信息
 */
async function showNewStatistics(connection) {
  console.log('='.repeat(80));
  console.log('📊 修复后的统计数据');
  console.log('='.repeat(80));
  console.log();

  // V3策略
  const [v3Stats] = await connection.execute(
    `SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as winning,
      SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losing,
      SUM(pnl) as total_pnl,
      AVG(pnl) as avg_pnl,
      MAX(pnl) as max_pnl,
      MIN(pnl) as min_pnl
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
    console.log(`  平均盈亏: ${parseFloat(v3Stats[0].avg_pnl).toFixed(2)} USDT`);
    console.log(`  最大盈利: ${parseFloat(v3Stats[0].max_pnl).toFixed(2)} USDT`);
    console.log(`  最大亏损: ${parseFloat(v3Stats[0].min_pnl).toFixed(2)} USDT`);
    console.log();
  }

  // ICT策略
  const [ictStats] = await connection.execute(
    `SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as winning,
      SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losing,
      SUM(pnl) as total_pnl,
      AVG(pnl) as avg_pnl,
      MAX(pnl) as max_pnl,
      MIN(pnl) as min_pnl
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
    console.log(`  平均盈亏: ${parseFloat(ictStats[0].avg_pnl).toFixed(2)} USDT`);
    console.log(`  最大盈利: ${parseFloat(ictStats[0].max_pnl).toFixed(2)} USDT`);
    console.log(`  最大亏损: ${parseFloat(ictStats[0].min_pnl).toFixed(2)} USDT`);
    console.log();
  }

  // 显示一些修复后的示例
  console.log('='.repeat(80));
  console.log('📋 修复后的交易示例（最近10条）');
  console.log('='.repeat(80));
  console.log();

  const [examples] = await connection.execute(
    `SELECT s.symbol, st.strategy_name, st.trade_type,
            st.entry_price, st.exit_price, st.quantity, 
            st.leverage, st.pnl
     FROM simulation_trades st
     JOIN symbols s ON st.symbol_id = s.id
     WHERE st.status = 'CLOSED'
     ORDER BY st.id DESC
     LIMIT 10`
  );

  console.log('交易对'.padEnd(12) + '策略'.padEnd(6) + '方向'.padEnd(8) +
    '入场价'.padEnd(12) + '仓位'.padEnd(12) + '杠杆'.padEnd(6) + '盈亏(USDT)');
  console.log('-'.repeat(80));

  examples.forEach(t => {
    console.log(
      t.symbol.padEnd(12) +
      t.strategy_name.padEnd(6) +
      t.trade_type.padEnd(8) +
      parseFloat(t.entry_price).toFixed(2).padEnd(12) +
      parseFloat(t.quantity).toFixed(4).padEnd(12) +
      parseFloat(t.leverage).toFixed(0).padEnd(6) +
      `${parseFloat(t.pnl) >= 0 ? '+' : ''}${parseFloat(t.pnl).toFixed(2)}`
    );
  });
}

/**
 * 主函数
 */
async function main() {
  let connection;

  try {
    connection = await mysql.createConnection(dbConfig);

    // 先显示修复前的统计
    console.log('='.repeat(80));
    console.log('📊 修复前的统计数据');
    console.log('='.repeat(80));
    console.log();
    await showBeforeStats(connection);

    // 执行修复
    await fixHistoricalTrades();

  } catch (error) {
    console.error('💥 执行失败:', error);
    process.exit(1);
  }
}

/**
 * 显示修复前统计
 */
async function showBeforeStats(connection) {
  const [v3] = await connection.execute(
    `SELECT COUNT(*) as total, SUM(pnl) as total_pnl
     FROM simulation_trades WHERE strategy_name = 'V3' AND status = 'CLOSED'`
  );

  const [ict] = await connection.execute(
    `SELECT COUNT(*) as total, SUM(pnl) as total_pnl
     FROM simulation_trades WHERE strategy_name = 'ICT' AND status = 'CLOSED'`
  );

  console.log(`V3策略:  ${v3[0].total}笔交易, 总盈亏 ${parseFloat(v3[0].total_pnl || 0).toFixed(2)} USDT`);
  console.log(`ICT策略: ${ict[0].total}笔交易, 总盈亏 ${parseFloat(ict[0].total_pnl || 0).toFixed(2)} USDT`);
  console.log();
}

// 运行
if (require.main === module) {
  main()
    .then(() => {
      console.log('🎉 修复完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 修复失败:', error);
      process.exit(1);
    });
}

module.exports = { fixHistoricalTrades, calculateNewQuantity, recalculatePnL };

