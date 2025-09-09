#!/usr/bin/env node

// 更新胜率统计表脚本
const DatabaseManager = require('./modules/database/DatabaseManager');

async function updateWinRateStats() {
  const dbManager = new DatabaseManager();
  
  try {
    await dbManager.init();
    console.log('🔍 开始更新胜率统计...');
    
    // 获取所有已完成的模拟交易数据
    const stats = await dbManager.runQuery(`
      SELECT 
        COUNT(*) as total_trades,
        SUM(CASE WHEN is_win = 1 THEN 1 ELSE 0 END) as winning_trades,
        SUM(CASE WHEN is_win = 0 THEN 1 ELSE 0 END) as losing_trades,
        SUM(CASE WHEN is_win = 1 THEN profit_loss ELSE 0 END) as total_profit,
        SUM(CASE WHEN is_win = 0 THEN ABS(profit_loss) ELSE 0 END) as total_loss,
        SUM(profit_loss) as net_profit
      FROM simulations 
      WHERE status = 'CLOSED'
    `);
    
    if (stats.length > 0) {
      const stat = stats[0];
      const winRate = stat.total_trades > 0 ? (stat.winning_trades / stat.total_trades) * 100 : 0;
      
      console.log('📊 当前统计数据:');
      console.log(`  总交易数: ${stat.total_trades}`);
      console.log(`  盈利交易: ${stat.winning_trades}`);
      console.log(`  亏损交易: ${stat.losing_trades}`);
      console.log(`  胜率: ${winRate.toFixed(2)}%`);
      console.log(`  总盈利: ${stat.total_profit.toFixed(4)} USDT`);
      console.log(`  总亏损: ${stat.total_loss.toFixed(4)} USDT`);
      console.log(`  净盈亏: ${stat.net_profit.toFixed(4)} USDT`);
      
      // 更新或插入胜率统计
      await dbManager.run(`
        INSERT OR REPLACE INTO win_rate_stats 
        (id, total_trades, winning_trades, losing_trades, win_rate, total_profit, total_loss, net_profit, last_updated)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        stat.total_trades,
        stat.winning_trades,
        stat.losing_trades,
        winRate,
        stat.total_profit,
        stat.total_loss,
        stat.net_profit,
        new Date().toISOString()
      ]);
      
      console.log('✅ 胜率统计已更新');
    } else {
      console.log('⚠️ 没有找到已完成的模拟交易数据');
    }
    
  } catch (error) {
    console.error('❌ 更新胜率统计失败:', error);
  } finally {
    await dbManager.close();
  }
}

// 运行更新脚本
updateWinRateStats().then(() => {
  console.log('🎉 胜率统计更新完成');
  process.exit(0);
}).catch(error => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});
