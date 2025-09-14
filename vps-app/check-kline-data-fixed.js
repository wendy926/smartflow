const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('smartflow.db');

console.log('🔍 检查1H K线数据（修正版）...\n');

// 检查1H K线数据
db.all(`
  SELECT 
    symbol,
    COUNT(*) as count,
    MAX(close_time) as latest
  FROM kline_data 
  WHERE interval = '1h' 
    AND close_time > (strftime('%s', 'now') - 7200) * 1000
  GROUP BY symbol
  ORDER BY count DESC
  LIMIT 10
`, (err, rows) => {
  if (err) {
    console.error('查询1H K线数据失败:', err);
    return;
  }
  
  console.log('📊 最近2小时的1H K线数据统计:');
  if (rows.length === 0) {
    console.log('❌ 最近2小时没有1H K线数据');
    
    // 检查最新的1H数据
    db.all(`
      SELECT 
        symbol,
        close_time,
        open_price,
        high_price,
        low_price,
        close_price,
        volume
      FROM kline_data 
      WHERE interval = '1h' 
      ORDER BY close_time DESC
      LIMIT 5
    `, (err, latestRows) => {
      if (err) {
        console.error('查询最新数据失败:', err);
        return;
      }
      
      console.log('\n📊 最新的1H K线数据:');
      latestRows.forEach((row, index) => {
        const time = new Date(parseInt(row.close_time));
        console.log(`${index + 1}. ${row.symbol}: ${time.toISOString()}`);
        console.log(`   OHLC: ${row.open_price} | ${row.high_price} | ${row.low_price} | ${row.close_price}`);
        console.log(`   成交量: ${row.volume}`);
      });
      
      db.close();
    });
  } else {
    rows.forEach(row => {
      const time = new Date(parseInt(row.latest));
      console.log(`${row.symbol}: ${row.count}条数据, 最新: ${time.toISOString()}`);
    });
    
    // 检查具体的数据内容
    console.log('\n📊 检查具体数据内容...');
    db.all(`
      SELECT 
        symbol,
        close_time,
        open_price,
        high_price,
        low_price,
        close_price,
        volume
      FROM kline_data 
      WHERE interval = '1h' 
        AND symbol = 'BTCUSDT'
      ORDER BY close_time DESC
      LIMIT 5
    `, (err, detailRows) => {
      if (err) {
        console.error('查询详细数据失败:', err);
        return;
      }
      
      console.log('\n📊 BTCUSDT 1H数据详情:');
      detailRows.forEach((row, index) => {
        const time = new Date(parseInt(row.close_time));
        console.log(`${index + 1}. 时间: ${time.toISOString()}`);
        console.log(`   OHLC: ${row.open_price} | ${row.high_price} | ${row.low_price} | ${row.close_price}`);
        console.log(`   成交量: ${row.volume}`);
      });
      
      db.close();
    });
  }
});
