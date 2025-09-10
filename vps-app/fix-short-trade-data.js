// fix-short-trade-data.js
// 修复做空交易历史数据中的止盈止损价格错误

const DatabaseManager = require('./modules/database/DatabaseManager');

async function fixShortTradeData() {
  const dbManager = new DatabaseManager();
  await dbManager.init();

  try {
    console.log('🔍 开始检查做空交易数据...');

    // 查询所有做空交易记录
    const shortTrades = await dbManager.runQuery(`
      SELECT id, symbol, entry_price, stop_loss_price, take_profit_price, 
             exit_price, exit_reason, is_win, profit_loss, created_at, trigger_reason
      FROM simulations 
      WHERE direction = 'SHORT'
      ORDER BY created_at DESC
    `);

    console.log(`📊 找到 ${shortTrades.length} 条做空交易记录`);

    let fixedCount = 0;
    let errorCount = 0;

    for (const trade of shortTrades) {
      const { id, symbol, entry_price, stop_loss_price, take_profit_price, 
              exit_price, exit_reason, is_win, profit_loss, created_at, trigger_reason } = trade;

      // 检查止盈止损价格是否正确
      const stopLossCorrect = stop_loss_price > entry_price; // 做空止损应该高于入场价
      const takeProfitCorrect = take_profit_price < entry_price; // 做空止盈应该低于入场价

      if (!stopLossCorrect || !takeProfitCorrect) {
        console.log(`❌ 发现错误记录 ID: ${id}, Symbol: ${symbol}`);
        console.log(`   入场价: ${entry_price}, 止损价: ${stop_loss_price}, 止盈价: ${take_profit_price}`);
        console.log(`   止损正确: ${stopLossCorrect}, 止盈正确: ${takeProfitCorrect}`);

        // 交换止盈止损价格
        const correctedStopLoss = take_profit_price; // 原来的止盈价作为止损价
        const correctedTakeProfit = stop_loss_price; // 原来的止损价作为止盈价

        console.log(`   修正后 - 止损价: ${correctedStopLoss}, 止盈价: ${correctedTakeProfit}`);

        // 重新计算盈亏
        let correctedIsWin = false;
        let correctedProfitLoss = 0;

        if (exit_price && exit_reason) {
          // 根据修正后的价格重新判断盈亏
          if (exit_reason === 'STOP_LOSS') {
            // 止损触发：价格应该上涨到止损价，做空亏损
            correctedIsWin = false;
            correctedProfitLoss = (entry_price - correctedStopLoss) / entry_price * 20 * 100; // 假设20倍杠杆
          } else if (exit_reason === 'TAKE_PROFIT') {
            // 止盈触发：价格应该下跌到止盈价，做空盈利
            correctedIsWin = true;
            correctedProfitLoss = (entry_price - correctedTakeProfit) / entry_price * 20 * 100; // 假设20倍杠杆
          } else {
            // 其他原因：根据实际出场价格计算
            if (exit_price < entry_price) {
              correctedIsWin = true; // 价格下跌，做空盈利
              correctedProfitLoss = (entry_price - exit_price) / entry_price * 20 * 100;
            } else {
              correctedIsWin = false; // 价格上涨，做空亏损
              correctedProfitLoss = (entry_price - exit_price) / entry_price * 20 * 100;
            }
          }
        }

        console.log(`   修正后 - 是否盈利: ${correctedIsWin}, 盈亏: ${correctedProfitLoss}`);

        // 更新数据库
        try {
          await dbManager.runQuery(`
            UPDATE simulations 
            SET stop_loss_price = ?, 
                take_profit_price = ?, 
                is_win = ?, 
                profit_loss = ?
            WHERE id = ?
          `, [correctedStopLoss, correctedTakeProfit, correctedIsWin, correctedProfitLoss, id]);

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
fixShortTradeData().catch(console.error);
