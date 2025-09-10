// fix-exit-reason-logic.js
// 修复做空交易出场原因和盈亏逻辑错误

const DatabaseManager = require('./modules/database/DatabaseManager');

async function fixExitReasonLogic() {
  const dbManager = new DatabaseManager();
  await dbManager.init();

  try {
    console.log('🔍 开始检查做空交易出场原因逻辑...');

    // 查询所有做空交易记录
    const shortTrades = await dbManager.runQuery(`
      SELECT id, symbol, entry_price, stop_loss_price, take_profit_price, 
             exit_price, exit_reason, is_win, profit_loss, created_at, closed_at
      FROM simulations 
      WHERE direction = 'SHORT' AND status = 'CLOSED'
      ORDER BY created_at DESC
    `);

    console.log(`📊 找到 ${shortTrades.length} 条做空交易记录`);

    let fixedCount = 0;
    let errorCount = 0;

    for (const trade of shortTrades) {
      const { id, symbol, entry_price, stop_loss_price, take_profit_price, 
              exit_price, exit_reason, is_win, profit_loss, created_at, closed_at } = trade;

      // 检查出场原因是否正确
      let correctExitReason = exit_reason;
      let correctIsWin = is_win;
      let correctProfitLoss = profit_loss;

      if (exit_price && stop_loss_price && take_profit_price) {
        // 计算价格差异的容差（0.0001）
        const tolerance = 0.0001;
        
        // 检查是否触发止损
        const isStopLoss = Math.abs(exit_price - stop_loss_price) < tolerance;
        // 检查是否触发止盈
        const isTakeProfit = Math.abs(exit_price - take_profit_price) < tolerance;
        
        if (isStopLoss && isTakeProfit) {
          // 如果同时满足止损和止盈条件，优先选择止盈（因为止盈是目标）
          correctExitReason = 'TAKE_PROFIT';
        } else if (isStopLoss) {
          correctExitReason = 'STOP_LOSS';
        } else if (isTakeProfit) {
          correctExitReason = 'TAKE_PROFIT';
        }

        // 重新计算盈亏
        if (correctExitReason === 'STOP_LOSS') {
          // 止损触发：做空亏损
          correctIsWin = false;
          correctProfitLoss = (entry_price - stop_loss_price) / entry_price * 20 * 100; // 假设20倍杠杆
        } else if (correctExitReason === 'TAKE_PROFIT') {
          // 止盈触发：做空盈利
          correctIsWin = true;
          correctProfitLoss = (entry_price - take_profit_price) / entry_price * 20 * 100; // 假设20倍杠杆
        } else {
          // 其他原因：根据实际出场价格计算
          if (exit_price < entry_price) {
            correctIsWin = true; // 价格下跌，做空盈利
            correctProfitLoss = (entry_price - exit_price) / entry_price * 20 * 100;
          } else {
            correctIsWin = false; // 价格上涨，做空亏损
            correctProfitLoss = (entry_price - exit_price) / entry_price * 20 * 100;
          }
        }

        // 检查是否需要修复
        if (correctExitReason !== exit_reason || correctIsWin !== is_win) {
          console.log(`❌ 发现错误记录 ID: ${id}, Symbol: ${symbol}`);
          console.log(`   入场价: ${entry_price}, 止损价: ${stop_loss_price}, 止盈价: ${take_profit_price}`);
          console.log(`   出场价: ${exit_price}, 原出场原因: ${exit_reason}, 修正后: ${correctExitReason}`);
          console.log(`   原盈亏: ${is_win ? '盈利' : '亏损'} ${profit_loss}, 修正后: ${correctIsWin ? '盈利' : '亏损'} ${correctProfitLoss}`);

          // 更新数据库
          try {
            await dbManager.runQuery(`
              UPDATE simulations 
              SET exit_reason = ?, 
                  is_win = ?, 
                  profit_loss = ?
              WHERE id = ?
            `, [correctExitReason, correctIsWin, correctProfitLoss, id]);

            console.log(`✅ 已修复记录 ID: ${id}`);
            fixedCount++;
          } catch (error) {
            console.error(`❌ 修复记录 ID: ${id} 失败:`, error);
            errorCount++;
          }
        } else {
          console.log(`✅ 记录 ID: ${id} 数据正确`);
        }
      }
    }

    console.log(`\n📊 修复完成:`);
    console.log(`   总记录数: ${shortTrades.length}`);
    console.log(`   修复成功: ${fixedCount}`);
    console.log(`   修复失败: ${errorCount}`);

  } catch (error) {
    console.error('❌ 修复过程出错:', error);
  } finally {
    await dbManager.close();
  }
}

// 运行修复
fixExitReasonLogic().catch(console.error);
