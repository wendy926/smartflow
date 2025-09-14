// check-kline-timestamps.js - 检查K线数据的时间戳

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function checkKlineTimestamps() {
  try {
    console.log('🔍 检查AAVEUSDT K线数据的时间戳...\n');

    // 连接数据库
    const dbPath = path.join(__dirname, 'smartflow.db');
    const db = new sqlite3.Database(dbPath);

    // 检查kline_data表是否存在
    const tableExists = await new Promise((resolve, reject) => {
      db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='kline_data'", (err, row) => {
        if (err) reject(err);
        else resolve(!!row);
      });
    });

    if (!tableExists) {
      console.log('❌ kline_data表不存在');
      return;
    }

    console.log('✅ kline_data表存在');

    // 检查AAVEUSDT的4H K线数据
    const aaveusdt4h = await new Promise((resolve, reject) => {
      db.all(`
        SELECT open_time, close_time, open_price, high_price, low_price, close_price, volume
        FROM kline_data 
        WHERE symbol = 'AAVEUSDT' AND interval = '4h'
        ORDER BY open_time DESC 
        LIMIT 10
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    if (!aaveusdt4h || aaveusdt4h.length === 0) {
      console.log('❌ 未找到AAVEUSDT的4H K线数据');
      return;
    }

    console.log(`📊 找到 ${aaveusdt4h.length} 条AAVEUSDT 4H K线数据\n`);

    // 显示最新的10条数据
    console.log('📈 最新10条4H K线数据:');
    aaveusdt4h.forEach((kline, index) => {
      const openTime = new Date(kline.open_time);
      const closeTime = new Date(kline.close_time);
      const now = new Date();

      const openTimeStr = openTime.toISOString();
      const closeTimeStr = closeTime.toISOString();
      const timeDiff = (now - closeTime) / (1000 * 60 * 60); // 小时差

      console.log(`${index + 1}. 开盘时间: ${openTimeStr} (${openTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })})`);
      console.log(`   收盘时间: ${closeTimeStr} (${closeTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })})`);
      console.log(`   收盘价: ${kline.close_price}`);
      console.log(`   数据年龄: ${timeDiff.toFixed(2)} 小时前`);
      console.log('');
    });

    // 计算MA数据
    const closes = aaveusdt4h.map(k => k.close_price).reverse(); // 从旧到新排序
    const ma20 = calculateMA(closes, 20);
    const ma50 = calculateMA(closes, 50);
    const ma200 = calculateMA(closes, 200);

    console.log('📊 基于最新K线数据计算的MA:');
    console.log(`MA20: ${ma20 ? ma20[ma20.length - 1]?.toFixed(4) : 'N/A'}`);
    console.log(`MA50: ${ma50 ? ma50[ma50.length - 1]?.toFixed(4) : 'N/A'}`);
    console.log(`MA200: ${ma200 ? ma200[ma200.length - 1]?.toFixed(4) : 'N/A'}`);
    console.log(`最新收盘价: ${aaveusdt4h[0].close_price}`);

    // 检查数据新鲜度
    const latestKline = aaveusdt4h[0];
    const latestCloseTime = new Date(latestKline.close_time);
    const now = new Date();
    const ageHours = (now - latestCloseTime) / (1000 * 60 * 60);

    console.log('\n⏰ 数据新鲜度评估:');
    console.log(`最新K线收盘时间: ${latestCloseTime.toISOString()}`);
    console.log(`当前时间: ${now.toISOString()}`);
    console.log(`数据年龄: ${ageHours.toFixed(2)} 小时`);

    if (ageHours > 8) {
      console.log('⚠️ 警告: 4H K线数据可能过期！');
      console.log('建议检查:');
      console.log('1. 数据收集服务是否正常运行');
      console.log('2. Binance API连接是否正常');
      console.log('3. 数据同步机制是否工作');
    } else if (ageHours > 4) {
      console.log('⚠️ 注意: 4H K线数据正在老化');
    } else {
      console.log('✅ 4H K线数据新鲜度正常');
    }

    // 检查所有交易对的数据新鲜度
    console.log('\n🔍 检查所有交易对的数据新鲜度:');
    const allSymbols = await new Promise((resolve, reject) => {
      db.all(`
        SELECT symbol, MAX(close_time) as latest_close_time, COUNT(*) as count
        FROM kline_data 
        WHERE interval = '4h'
        GROUP BY symbol
        ORDER BY latest_close_time ASC
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    console.log('交易对数据新鲜度排名 (从最旧到最新):');
    allSymbols.forEach((symbol, index) => {
      const latestTime = new Date(symbol.latest_close_time);
      const ageHours = (now - latestTime) / (1000 * 60 * 60);
      const status = ageHours > 8 ? '❌' : ageHours > 4 ? '⚠️' : '✅';

      console.log(`${index + 1}. ${symbol.symbol}: ${ageHours.toFixed(2)}小时前 ${status}`);
    });

    db.close();

  } catch (error) {
    console.error('❌ 检查失败:', error.message);
    console.error('错误详情:', error);
  }
}

function calculateMA(data, period) {
  if (data.length < period) return null;
  const ma = [];
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    ma.push(sum / period);
  }
  return ma;
}

checkKlineTimestamps();
