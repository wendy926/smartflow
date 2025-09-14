// test-ma-data-fix.js - 测试MA数据修复效果

const https = require('https');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function testMADataFix() {
  try {
    console.log('🧪 测试MA数据修复效果...\n');

    // 连接数据库
    const dbPath = path.join(__dirname, 'smartflow.db');
    const db = new sqlite3.Database(dbPath);

    // 1. 测试数据新鲜度检查
    console.log('1️⃣ 测试数据新鲜度检查...');
    await testDataFreshness(db);

    // 2. 测试实时数据获取
    console.log('\n2️⃣ 测试实时数据获取...');
    await testRealtimeDataFetch();

    // 3. 测试MA计算准确性
    console.log('\n3️⃣ 测试MA计算准确性...');
    await testMACalculation(db);

    // 4. 测试AAVEUSDT特定案例
    console.log('\n4️⃣ 测试AAVEUSDT特定案例...');
    await testAAVEUSDT(db);

    db.close();
    console.log('\n✅ 测试完成');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

async function testDataFreshness(db) {
  const symbols = ['AAVEUSDT', 'BTCUSDT', 'ETHUSDT'];
  
  for (const symbol of symbols) {
    const freshness = await getSymbolDataFreshness(db, symbol);
    const status = freshness.isStale ? '❌ 过期' : '✅ 新鲜';
    console.log(`${symbol}: ${status} (${freshness.ageHours.toFixed(1)}小时前)`);
  }
}

async function getSymbolDataFreshness(db, symbol) {
  return new Promise((resolve) => {
    const sql = `
      SELECT MAX(close_time) as latest_close_time
      FROM kline_data 
      WHERE symbol = ? AND interval = '4h'
    `;
    
    db.get(sql, [symbol], (err, row) => {
      if (err || !row || !row.latest_close_time) {
        resolve({ isStale: true, ageHours: 999 });
      } else {
        const ageMs = Date.now() - row.latest_close_time;
        const ageHours = ageMs / (1000 * 60 * 60);
        const isStale = ageHours > 8;
        resolve({ isStale, ageHours });
      }
    });
  });
}

async function testRealtimeDataFetch() {
  try {
    console.log('📊 测试从Binance API获取实时数据...');
    
    const klines = await fetchKlinesFromAPI('AAVEUSDT', '4h', 10);
    
    if (klines && klines.length > 0) {
      const latestKline = klines[klines.length - 1];
      const latestTime = new Date(parseInt(latestKline[0]));
      const ageHours = (Date.now() - latestTime.getTime()) / (1000 * 60 * 60);
      
      console.log(`✅ 获取到 ${klines.length} 条实时数据`);
      console.log(`📅 最新数据时间: ${latestTime.toISOString()}`);
      console.log(`⏰ 数据年龄: ${ageHours.toFixed(2)} 小时`);
      console.log(`💰 最新收盘价: ${parseFloat(latestKline[4]).toFixed(4)}`);
    } else {
      console.log('❌ 无法获取实时数据');
    }
    
  } catch (error) {
    console.error('❌ 实时数据获取失败:', error.message);
  }
}

async function fetchKlinesFromAPI(symbol, interval, limit) {
  return new Promise((resolve, reject) => {
    const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const klines = JSON.parse(data);
          resolve(klines);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

async function testMACalculation(db) {
  try {
    console.log('📊 测试MA计算准确性...');
    
    // 获取AAVEUSDT的4H数据
    const klines = await getKlinesFromDB(db, 'AAVEUSDT', '4h', 250);
    
    if (klines && klines.length >= 200) {
      const closes = klines.map(k => k.close_price);
      
      // 计算MA
      const ma20 = calculateMA(closes, 20);
      const ma50 = calculateMA(closes, 50);
      const ma200 = calculateMA(closes, 200);
      
      const currentMA20 = ma20[ma20.length - 1];
      const currentMA50 = ma50[ma50.length - 1];
      const currentMA200 = ma200[ma200.length - 1];
      const currentPrice = closes[closes.length - 1];
      
      console.log(`✅ MA计算完成:`);
      console.log(`MA20: ${currentMA20?.toFixed(4)}`);
      console.log(`MA50: ${currentMA50?.toFixed(4)}`);
      console.log(`MA200: ${currentMA200?.toFixed(4)}`);
      console.log(`当前价格: ${currentPrice?.toFixed(4)}`);
      
      // 验证MA排列
      const isBullish = currentPrice > currentMA20 && currentMA20 > currentMA50 && currentMA50 > currentMA200;
      const isBearish = currentPrice < currentMA20 && currentMA20 < currentMA50 && currentMA50 < currentMA200;
      
      if (isBullish) {
        console.log(`📈 趋势判断: 多头排列`);
      } else if (isBearish) {
        console.log(`📉 趋势判断: 空头排列`);
      } else {
        console.log(`📊 趋势判断: 震荡排列`);
      }
      
    } else {
      console.log('❌ 数据不足，无法计算MA');
    }
    
  } catch (error) {
    console.error('❌ MA计算测试失败:', error);
  }
}

async function getKlinesFromDB(db, symbol, interval, limit) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT close_price
      FROM kline_data 
      WHERE symbol = ? AND interval = ?
      ORDER BY open_time ASC
      LIMIT ?
    `;
    
    db.all(sql, [symbol, interval, limit], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

function calculateMA(data, period) {
  if (data.length < period) return [];
  const ma = [];
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    ma.push(sum / period);
  }
  return ma;
}

async function testAAVEUSDT(db) {
  try {
    console.log('🎯 测试AAVEUSDT特定案例...');
    
    // 获取最新数据
    const latestData = await getLatestKlineData(db, 'AAVEUSDT', '4h');
    
    if (latestData) {
      console.log(`📅 最新数据时间: ${new Date(latestData.open_time).toISOString()}`);
      console.log(`💰 最新收盘价: ${latestData.close_price}`);
      
      const ageHours = (Date.now() - latestData.open_time) / (1000 * 60 * 60);
      console.log(`⏰ 数据年龄: ${ageHours.toFixed(1)} 小时`);
      
      if (ageHours > 8) {
        console.log('⚠️ 数据仍然过期，需要更新');
      } else {
        console.log('✅ 数据已更新到最新');
      }
    } else {
      console.log('❌ 无法获取AAVEUSDT数据');
    }
    
  } catch (error) {
    console.error('❌ AAVEUSDT测试失败:', error);
  }
}

async function getLatestKlineData(db, symbol, interval) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT open_time, close_price
      FROM kline_data 
      WHERE symbol = ? AND interval = ?
      ORDER BY open_time DESC
      LIMIT 1
    `;
    
    db.get(sql, [symbol, interval], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

// 运行测试
if (require.main === module) {
  testMADataFix();
}

module.exports = { testMADataFix };
