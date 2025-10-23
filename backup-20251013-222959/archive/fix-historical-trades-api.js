/**
 * 通过API修复历史交易记录的盈亏计算
 * 使用数据库操作类，避免直接连接数据库
 */

const DatabaseOperations = require('./src/database/operations');
const logger = require('./src/utils/logger');

const dbOps = new DatabaseOperations();

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
async function fixHistoricalTrades() {
  try {
    console.log('='.repeat(80));
    console.log('🔧 开始修复历史交易记录盈亏计算');
    console.log('='.repeat(80));
    console.log();

    // 初始化数据库
    await dbOps.initialize();
    console.log('✅ 数据库连接成功');
    console.log();

    // 获取V3策略的所有交易
    console.log('📊 获取V3策略交易记录...');
    const v3Trades = await dbOps.getTrades('V3', null, 1000);
    
    // 获取ICT策略的所有交易
    console.log('📊 获取ICT策略交易记录...');
    const ictTrades = await dbOps.getTrades('ICT', null, 1000);

    const allTrades = [...v3Trades, ...ictTrades];
    const closedTrades = allTrades.filter(t => t.status === 'CLOSED' && t.exit_price);

    console.log(`📊 总记录数: ${allTrades.length}`);
    console.log(`📊 已关闭记录: ${closedTrades.length}`);
    console.log();

    if (closedTrades.length === 0) {
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
    for (const trade of closedTrades) {
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

        if (pnlDiff < 0.000001) {
          // 盈亏变化极小，跳过
          skippedCount++;
          continue;
        }

        // 更新数据库
        await dbOps.updateTrade(trade.id, {
          pnl: pnl,
          pnl_percentage: pnl_percentage
        });

        console.log(`✅ 交易 ID ${trade.id} (${trade.symbol} ${trade.strategy_name}): ` +
                    `原盈亏 ${oldPnl.toFixed(4)} → 新盈亏 ${pnl.toFixed(4)} USDT ` +
                    `(${pnl >= 0 ? '+' : ''}${pnl_percentage.toFixed(2)}%)`);
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
    console.log(`总记录数: ${closedTrades.length}`);
    console.log(`已更新: ${updatedCount}`);
    console.log(`跳过: ${skippedCount}`);
    console.log(`错误: ${errorCount}`);
    console.log();

    // 显示统计信息
    await showStatistics();

    console.log();
    console.log('✅ 所有操作完成');
    console.log();

  } catch (error) {
    console.error('❌ 修复失败:', error);
    throw error;
  }
}

/**
 * 显示统计信息
 */
async function showStatistics() {
  try {
    console.log('='.repeat(80));
    console.log('📊 当前统计数据');
    console.log('='.repeat(80));
    console.log();

    // V3策略统计
    const v3Trades = await dbOps.getTrades('V3', null, 1000);
    const v3Closed = v3Trades.filter(t => t.status === 'CLOSED');
    
    if (v3Closed.length > 0) {
      const v3Winning = v3Closed.filter(t => parseFloat(t.pnl) > 0).length;
      const v3Losing = v3Closed.filter(t => parseFloat(t.pnl) < 0).length;
      const v3WinRate = (v3Winning / v3Closed.length) * 100;
      const v3TotalPnl = v3Closed.reduce((sum, t) => sum + parseFloat(t.pnl || 0), 0);
      
      console.log('📈 V3策略:');
      console.log(`  总交易数: ${v3Closed.length}`);
      console.log(`  盈利交易: ${v3Winning}`);
      console.log(`  亏损交易: ${v3Losing}`);
      console.log(`  胜率: ${v3WinRate.toFixed(2)}%`);
      console.log(`  总盈亏: ${v3TotalPnl >= 0 ? '+' : ''}${v3TotalPnl.toFixed(2)} USDT`);
      console.log();
    }

    // ICT策略统计
    const ictTrades = await dbOps.getTrades('ICT', null, 1000);
    const ictClosed = ictTrades.filter(t => t.status === 'CLOSED');
    
    if (ictClosed.length > 0) {
      const ictWinning = ictClosed.filter(t => parseFloat(t.pnl) > 0).length;
      const ictLosing = ictClosed.filter(t => parseFloat(t.pnl) < 0).length;
      const ictWinRate = (ictWinning / ictClosed.length) * 100;
      const ictTotalPnl = ictClosed.reduce((sum, t) => sum + parseFloat(t.pnl || 0), 0);
      
      console.log('📈 ICT策略:');
      console.log(`  总交易数: ${ictClosed.length}`);
      console.log(`  盈利交易: ${ictWinning}`);
      console.log(`  亏损交易: ${ictLosing}`);
      console.log(`  胜率: ${ictWinRate.toFixed(2)}%`);
      console.log(`  总盈亏: ${ictTotalPnl >= 0 ? '+' : ''}${ictTotalPnl.toFixed(2)} USDT`);
      console.log();
    }

  } catch (error) {
    console.error('❌ 获取统计信息失败:', error);
  }
}

// 运行脚本
if (require.main === module) {
  fixHistoricalTrades()
    .then(() => {
      console.log('🎉 脚本执行成功');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { fixHistoricalTrades, recalculatePnL };

