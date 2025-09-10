#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库路径
const dbPath = path.join(__dirname, 'smartflow.db');

console.log('🧪 测试多个交易对同时触发模拟交易时的并发问题...');

// 打开数据库
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ 数据库连接失败:', err.message);
    process.exit(1);
  }
  console.log('✅ 数据库连接成功');
});

// 查询最近的模拟交易记录，检查ATR和杠杆数据
db.all(`
  SELECT 
    symbol,
    direction,
    entry_price,
    stop_loss_price,
    take_profit_price,
    max_leverage,
    min_margin,
    stop_loss_distance,
    atr_value,
    atr14,
    trigger_reason,
    created_at
  FROM simulations 
  WHERE created_at > datetime('now', '+8 hours', '-1 hour')
  ORDER BY created_at DESC
  LIMIT 20
`, (err, rows) => {
  if (err) {
    console.error('❌ 查询失败:', err.message);
    db.close();
    process.exit(1);
  }

  console.log(`\n📊 最近1小时内的模拟交易记录 (${rows.length}条):`);
  console.log('交易对\t方向\t入场价\t止损价\t止盈价\t杠杆\t保证金\t止损距离\tATR值\tATR14\t触发原因\t创建时间');
  console.log('------------------------------------------------------------------------------------------------------------------------');

  let nullAtRCount = 0;
  let nullLeverageCount = 0;
  let nullMarginCount = 0;
  let nullStopLossDistanceCount = 0;

  rows.forEach(row => {
    const hasNullAtR = row.atr_value === null || row.atr14 === null;
    const hasNullLeverage = row.max_leverage === null || row.max_leverage === 0;
    const hasNullMargin = row.min_margin === null || row.min_margin === 0;
    const hasNullStopLossDistance = row.stop_loss_distance === null;

    if (hasNullAtR) nullAtRCount++;
    if (hasNullLeverage) nullLeverageCount++;
    if (hasNullMargin) nullMarginCount++;
    if (hasNullStopLossDistance) nullStopLossDistanceCount++;

    console.log(`${row.symbol}\t${row.direction}\t${row.entry_price}\t${row.stop_loss_price}\t${row.take_profit_price}\t${row.max_leverage}\t${row.min_margin}\t${row.stop_loss_distance}\t${row.atr_value}\t${row.atr14}\t${row.trigger_reason}\t${row.created_at}`);
  });

  console.log('\n📈 数据完整性统计:');
  console.log(`ATR值为null的记录: ${nullAtRCount}/${rows.length} (${((nullAtRCount / rows.length) * 100).toFixed(1)}%)`);
  console.log(`杠杆为null或0的记录: ${nullLeverageCount}/${rows.length} (${((nullLeverageCount / rows.length) * 100).toFixed(1)}%)`);
  console.log(`保证金为null或0的记录: ${nullMarginCount}/${rows.length} (${((nullMarginCount / rows.length) * 100).toFixed(1)}%)`);
  console.log(`止损距离为null的记录: ${nullStopLossDistanceCount}/${rows.length} (${((nullStopLossDistanceCount / rows.length) * 100).toFixed(1)}%)`);

  // 检查是否有并发创建的情况
  const concurrentRecords = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const current = new Date(rows[i].created_at);
    const next = new Date(rows[i + 1].created_at);
    const timeDiff = Math.abs(current - next);

    if (timeDiff < 60000) { // 1分钟内
      concurrentRecords.push({
        symbol1: rows[i].symbol,
        symbol2: rows[i + 1].symbol,
        time1: rows[i].created_at,
        time2: rows[i + 1].created_at,
        timeDiff: timeDiff
      });
    }
  }

  if (concurrentRecords.length > 0) {
    console.log('\n⚠️ 发现并发创建的记录:');
    concurrentRecords.forEach(record => {
      console.log(`${record.symbol1} (${record.time1}) 和 ${record.symbol2} (${record.time2}) 相差 ${record.timeDiff}ms`);
    });
  } else {
    console.log('\n✅ 未发现并发创建的情况');
  }

  db.close((err) => {
    if (err) {
      console.error('❌ 关闭数据库失败:', err.message);
    } else {
      console.log('✅ 测试完成');
    }
  });
});
