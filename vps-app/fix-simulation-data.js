const DatabaseManager = require('./modules/database/DatabaseManager');

async function fixSimulationData() {
  const db = new DatabaseManager();
  
  try {
    await db.init();
    console.log('开始修复模拟交易数据...');
    
    // 获取所有已关闭的模拟交易
    const closedSimulations = await db.runQuery(`
      SELECT * FROM simulations 
      WHERE status = 'CLOSED' 
      ORDER BY id DESC
    `);
    
    console.log(`找到 ${closedSimulations.length} 条已关闭的模拟交易记录`);
    
    for (const sim of closedSimulations) {
      console.log(`\n处理交易 ID: ${sim.id}, 交易对: ${sim.symbol}, 方向: ${sim.direction}`);
      
      // 重新计算盈亏
      let priceChange;
      if (sim.direction === 'LONG') {
        // 做多：价格上涨为盈利
        priceChange = (sim.exit_price - sim.entry_price) / sim.entry_price;
      } else if (sim.direction === 'SHORT') {
        // 做空：价格下跌为盈利
        priceChange = (sim.entry_price - sim.exit_price) / sim.entry_price;
      } else {
        // 兼容旧数据，假设为做多
        priceChange = (sim.exit_price - sim.entry_price) / sim.entry_price;
      }
      
      const leveragedReturn = priceChange * sim.max_leverage;
      const newProfitLoss = parseFloat((sim.min_margin * leveragedReturn).toFixed(4));
      const newIsWin = newProfitLoss > 0;
      
      console.log(`  入场价格: ${sim.entry_price}`);
      console.log(`  出场价格: ${sim.exit_price}`);
      console.log(`  方向: ${sim.direction}`);
      console.log(`  价格变化: ${(priceChange * 100).toFixed(4)}%`);
      console.log(`  原盈亏: ${sim.profit_loss}, 新盈亏: ${newProfitLoss}`);
      console.log(`  原胜负: ${sim.is_win}, 新胜负: ${newIsWin ? 1 : 0}`);
      
      // 更新数据库
      await db.run(`
        UPDATE simulations 
        SET profit_loss = ?, is_win = ?
        WHERE id = ?
      `, [newProfitLoss, newIsWin ? 1 : 0, sim.id]);
      
      console.log(`  ✅ 已更新`);
    }
    
    console.log('\n✅ 所有模拟交易数据修复完成');
    
  } catch (error) {
    console.error('修复数据时出错:', error);
  } finally {
    await db.close();
  }
}

// 运行修复脚本
fixSimulationData();
