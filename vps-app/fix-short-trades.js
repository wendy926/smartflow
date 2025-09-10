// 修复做空交易的止损止盈价格问题

const { DatabaseManager } = require('./modules/database/DatabaseManager');

async function fixShortTrades() {
  console.log('🔧 开始修复做空交易的止损止盈价格问题...');

  let db;
  try {
    // 初始化数据库
    db = new DatabaseManager();
    await db.init();

    // 1. 查看当前错误的做空交易数据
    console.log('\n📊 当前错误的做空交易数据:');
    const errorTrades = await db.runQuery(`
      SELECT 
          symbol,
          entry_price,
          stop_loss_price,
          take_profit_price,
          CASE 
              WHEN stop_loss_price > entry_price THEN '✅'
              ELSE '❌'
          END as stop_loss_check,
          CASE 
              WHEN take_profit_price < entry_price THEN '✅'
              ELSE '❌'
          END as take_profit_check,
          created_at
      FROM simulations 
      WHERE direction = 'SHORT' 
          AND (stop_loss_price < entry_price OR take_profit_price > entry_price)
      ORDER BY created_at DESC 
      LIMIT 10
    `);

    if (errorTrades.length === 0) {
      console.log('✅ 没有发现错误的做空交易数据');
      return;
    }

    console.log('错误的做空交易数量:', errorTrades.length);
    errorTrades.forEach(trade => {
      console.log(`${trade.symbol}: 入场${trade.entry_price}, 止损${trade.stop_loss_price}${trade.stop_loss_check}, 止盈${trade.take_profit_price}${trade.take_profit_check}`);
    });

    // 2. 统计需要修复的交易数量
    const countResult = await db.runQuery(`
      SELECT COUNT(*) as total_errors
      FROM simulations 
      WHERE direction = 'SHORT'
          AND stop_loss_price < entry_price
          AND take_profit_price > entry_price
    `);
    
    const totalErrors = countResult[0].total_errors;
    console.log(`\n📈 需要修复的做空交易总数: ${totalErrors}`);

    if (totalErrors === 0) {
      console.log('✅ 没有需要修复的交易');
      return;
    }

    // 3. 执行修复：交换止损和止盈价格
    console.log('\n🔧 开始修复...');
    
    // 使用临时表来安全地交换值
    await db.run(`
      UPDATE simulations 
      SET 
          stop_loss_price = (
              CASE 
                  WHEN direction = 'SHORT' 
                      AND stop_loss_price < entry_price 
                      AND take_profit_price > entry_price 
                  THEN take_profit_price 
                  ELSE stop_loss_price 
              END
          ),
          take_profit_price = (
              CASE 
                  WHEN direction = 'SHORT' 
                      AND stop_loss_price < entry_price 
                      AND take_profit_price > entry_price 
                  THEN stop_loss_price 
                  ELSE take_profit_price 
              END
          )
      WHERE direction = 'SHORT'
          AND stop_loss_price < entry_price
          AND take_profit_price > entry_price
    `);

    console.log('✅ 修复完成');

    // 4. 验证修复后的数据
    console.log('\n📊 修复后的做空交易数据验证:');
    const fixedTrades = await db.runQuery(`
      SELECT 
          symbol,
          entry_price,
          stop_loss_price,
          take_profit_price,
          CASE 
              WHEN stop_loss_price > entry_price THEN '✅'
              ELSE '❌'
          END as stop_loss_check,
          CASE 
              WHEN take_profit_price < entry_price THEN '✅'
              ELSE '❌'
          END as take_profit_check,
          created_at
      FROM simulations 
      WHERE direction = 'SHORT' 
      ORDER BY created_at DESC 
      LIMIT 10
    `);

    console.log('修复后的数据样本:');
    fixedTrades.forEach(trade => {
      console.log(`${trade.symbol}: 入场${trade.entry_price}, 止损${trade.stop_loss_price}${trade.stop_loss_check}, 止盈${trade.take_profit_price}${trade.take_profit_check}`);
    });

    // 5. 最终统计
    const remainingErrors = await db.runQuery(`
      SELECT COUNT(*) as remaining_errors
      FROM simulations 
      WHERE direction = 'SHORT'
          AND (stop_loss_price < entry_price OR take_profit_price > entry_price)
    `);

    console.log(`\n📈 修复统计:`);
    console.log(`修复前错误数量: ${totalErrors}`);
    console.log(`修复后错误数量: ${remainingErrors[0].remaining_errors}`);
    console.log(`成功修复数量: ${totalErrors - remainingErrors[0].remaining_errors}`);

    if (remainingErrors[0].remaining_errors === 0) {
      console.log('🎉 所有做空交易的止损止盈价格已修复！');
    } else {
      console.log('⚠️ 仍有部分交易未能修复，需要手动检查');
    }

  } catch (error) {
    console.error('❌ 修复过程中出现错误:', error);
  } finally {
    if (db) {
      await db.close();
    }
  }
}

// 运行修复
fixShortTrades();
