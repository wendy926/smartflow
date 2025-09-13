const DatabaseManager = require('./modules/database/DatabaseManager');
const https = require('https');

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function fixETHUSDTKline() {
  const db = new DatabaseManager();

  try {
    console.log('🔧 初始化数据库连接...');
    await db.init();

    console.log('🚀 开始修复ETHUSDT K线数据...');

    const symbol = 'ETHUSDT';
    const intervals = ['4h', '1h', '15m'];

    for (const interval of intervals) {
      console.log(`\n📊 处理 ${symbol} ${interval} 数据...`);

      // 检查现有数据
      const existingData = await db.query(
        `SELECT COUNT(*) as count FROM kline_data WHERE symbol = ? AND interval = ?`,
        [symbol, interval]
      );
      const existingCount = existingData[0].count;
      console.log(`📋 现有数据: ${existingCount} 条`);

      if (existingCount >= 200) {
        console.log(`✅ ${symbol} ${interval}: 数据充足，无需修复`);
        continue;
      }

      // 获取K线数据
      console.log(`📡 获取 ${symbol} ${interval} K线数据...`);
      const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=250`;

      try {
        const klines = await makeRequest(url);

        let successCount = 0;
        let errorCount = 0;

        for (const kline of klines) {
          try {
            await db.query(
              `INSERT OR REPLACE INTO kline_data 
                            (symbol, interval, open_time, close_time, open_price, high_price, low_price, close_price, volume, quote_volume, trades_count, taker_buy_volume, taker_buy_quote_volume)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                symbol,
                interval,
                parseInt(kline[0]),
                parseInt(kline[6]),
                parseFloat(kline[1]),
                parseFloat(kline[2]),
                parseFloat(kline[3]),
                parseFloat(kline[4]),
                parseFloat(kline[5]),
                parseFloat(kline[7]),
                parseInt(kline[8]),
                parseFloat(kline[9]),
                parseFloat(kline[10])
              ]
            );
            successCount++;
          } catch (error) {
            errorCount++;
            console.log(`❌ 存储失败: ${error.message}`);
          }
        }

        console.log(`✅ ${symbol} ${interval}: 成功存储 ${successCount} 条，失败 ${errorCount} 条`);

      } catch (error) {
        console.log(`❌ 获取K线数据失败: ${error.message}`);
      }
    }

    // 验证修复结果
    console.log('\n🔍 验证修复结果...');

    for (const interval of intervals) {
      const result = await db.query(
        `SELECT COUNT(*) as count FROM kline_data WHERE symbol = ? AND interval = ?`,
        [symbol, interval]
      );
      const count = result[0].count;
      const required = interval === '4h' ? 200 : 40;
      const status = count >= required ? '✅' : '❌';
      console.log(`📋 ${symbol} ${interval}: ${count} 条 ${status} (需要: ${required})`);
    }

    console.log('\n✅ ETHUSDT K线数据修复完成!');

  } catch (error) {
    console.error('❌ 修复失败:', error.message);
  } finally {
    await db.close();
    console.log('🔒 数据库连接已关闭');
  }
}

fixETHUSDTKline();
