const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('smartflow.db');

console.log('🔍 检查1H K线数据...\n');

// 检查kline_data表结构
db.all("PRAGMA table_info(kline_data)", (err, columns) => {
  if (err) {
    console.error('查询表结构失败:', err);
    return;
  }
  
  console.log('📊 kline_data表结构:');
  columns.forEach(col => {
    console.log(`  ${col.name}: ${col.type}`);
  });
  
  // 检查1H K线数据
  db.all(`
    SELECT 
      symbol,
      COUNT(*) as count,
      MAX(close_time) as latest
    FROM kline_data 
    WHERE interval = '1h' 
      AND close_time > datetime('now', '-2 hours')
    GROUP BY symbol
    ORDER BY count DESC
    LIMIT 10
  `, (err, rows) => {
    if (err) {
      console.error('查询1H K线数据失败:', err);
      return;
    }
    
    console.log('\n📊 1H K线数据统计:');
    if (rows.length === 0) {
      console.log('❌ 没有找到1H K线数据');
      
      // 检查是否有任何K线数据
      db.all(`
        SELECT 
          interval,
          COUNT(*) as count
        FROM kline_data 
        GROUP BY interval
        ORDER BY count DESC
      `, (err, allRows) => {
        if (err) {
          console.error('查询所有K线数据失败:', err);
          return;
        }
        
        console.log('\n📊 所有K线数据统计:');
        allRows.forEach(row => {
          console.log(`${row.interval}: ${row.count}条数据`);
        });
        
        db.close();
      });
    } else {
      rows.forEach(row => {
        console.log(`${row.symbol}: ${row.count}条数据, 最新: ${row.latest}`);
      });
      
      // 检查具体的数据内容
      console.log('\n📊 检查具体数据内容...');
      db.all(`
        SELECT 
          symbol,
          open_time,
          close_time,
          open,
          high,
          low,
          close,
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
          console.log(`${index + 1}. 时间: ${row.close_time}`);
          console.log(`   OHLC: ${row.open} | ${row.high} | ${row.low} | ${row.close}`);
          console.log(`   成交量: ${row.volume}`);
        });
        
        db.close();
      });
    }
  });
});
