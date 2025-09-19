// fix-simulation-prices.js - 修复模拟交易记录中的错误价格
// 将硬编码的错误价格更新为当前市场价格

const sqlite3 = require('sqlite3').verbose();
const https = require('https');

// 数据库连接
const db = new sqlite3.Database('smartflow.db');

/**
 * 获取实时价格
 */
async function getRealTimePrice(symbol) {
  return new Promise((resolve, reject) => {
    const url = `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`;
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(parseFloat(result.price));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * 修复单个模拟交易记录的价格
 */
async function fixSimulationPrice(simulation) {
  try {
    console.log(`\n🔧 修复 ${simulation.symbol} 的价格...`);
    console.log(`当前错误价格: 入场=${simulation.entry_price}, 止损=${simulation.stop_loss_price}, 止盈=${simulation.take_profit_price}`);
    
    // 获取当前市场价格
    const currentPrice = await getRealTimePrice(simulation.symbol);
    console.log(`当前市场价格: ${currentPrice}`);
    
    if (!currentPrice || currentPrice <= 0) {
      console.log(`❌ 无法获取 ${simulation.symbol} 的实时价格，跳过`);
      return;
    }
    
    // 计算合理的止损止盈价格
    const direction = simulation.trigger_reason?.includes('多头') || simulation.trigger_reason?.includes('做多') ? 'LONG' : 'SHORT';
    const atr = currentPrice * 0.02; // 2% ATR
    
    let stopLoss, takeProfit;
    if (direction === 'LONG') {
      stopLoss = currentPrice - atr * 1.2;
      takeProfit = currentPrice + atr * 2.4; // 1:2 风险回报比
    } else {
      stopLoss = currentPrice + atr * 1.2;
      takeProfit = currentPrice - atr * 2.4;
    }
    
    // 计算出场价格
    let exitPrice = null;
    if (simulation.status === 'CLOSED') {
      // 如果是盈利交易，使用止盈价格；如果是亏损交易，使用止损价格
      const profitLoss = parseFloat(simulation.profit_loss || 0);
      if (profitLoss > 0) {
        exitPrice = takeProfit;
      } else {
        exitPrice = stopLoss;
      }
    }
    
    console.log(`修复后价格: 入场=${currentPrice.toFixed(4)}, 止损=${stopLoss.toFixed(4)}, 止盈=${takeProfit.toFixed(4)}`);
    if (exitPrice) {
      console.log(`修复后出场价格: ${exitPrice.toFixed(4)}`);
    }
    
    // 更新数据库
    const sql = `
      UPDATE simulations 
      SET 
        entry_price = ?,
        stop_loss_price = ?,
        take_profit_price = ?,
        exit_price = ?,
        last_updated = ?
      WHERE id = ?
    `;
    
    const params = [
      currentPrice,
      stopLoss,
      takeProfit,
      exitPrice,
      new Date().toISOString(),
      simulation.id
    ];
    
    db.run(sql, params, function(err) {
      if (err) {
        console.error(`❌ 更新 ${simulation.symbol} 失败:`, err.message);
      } else {
        console.log(`✅ ${simulation.symbol} 价格修复成功 (ID: ${simulation.id})`);
      }
    });
    
  } catch (error) {
    console.error(`❌ 修复 ${simulation.symbol} 价格时出错:`, error.message);
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始修复模拟交易记录中的错误价格...\n');
  
  // 查询需要修复的记录
  const sql = `
    SELECT id, symbol, entry_price, stop_loss_price, take_profit_price, exit_price, 
           status, strategy_type, trigger_reason, profit_loss
    FROM simulations 
    WHERE entry_price IN (45000.0, 3000.0, 25.5)
    ORDER BY created_at DESC
  `;
  
  db.all(sql, [], async (err, rows) => {
    if (err) {
      console.error('❌ 查询数据库失败:', err.message);
      return;
    }
    
    if (rows.length === 0) {
      console.log('✅ 没有发现需要修复的价格记录');
      return;
    }
    
    console.log(`📊 发现 ${rows.length} 条需要修复的价格记录:`);
    rows.forEach(row => {
      console.log(`  - ${row.symbol}: 入场=${row.entry_price}, 状态=${row.status}, 创建时间=${row.trigger_reason}`);
    });
    
    // 修复每条记录
    for (const row of rows) {
      await fixSimulationPrice(row);
      // 添加延迟避免API限制
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n🎉 价格修复完成！');
    
    // 显示修复后的结果
    setTimeout(() => {
      console.log('\n📊 修复后的记录:');
      db.all(sql, [], (err, updatedRows) => {
        if (err) {
          console.error('❌ 查询修复后数据失败:', err.message);
        } else {
          updatedRows.forEach(row => {
            console.log(`  - ${row.symbol}: 入场=${row.entry_price}, 止损=${row.stop_loss_price}, 止盈=${row.take_profit_price}`);
          });
        }
        
        db.close((err) => {
          if (err) {
            console.error('❌ 关闭数据库失败:', err.message);
          } else {
            console.log('\n✅ 数据库连接已关闭');
          }
        });
      });
    }, 2000);
  });
}

// 运行修复脚本
main().catch(error => {
  console.error('❌ 修复脚本执行失败:', error);
  process.exit(1);
});
