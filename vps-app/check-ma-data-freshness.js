// check-ma-data-freshness.js - 检查MA数据的时间戳和最新性

const https = require('https');

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
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

function calculateMA(data, period) {
  if (data.length < period) return null;
  const ma = [];
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    ma.push(sum / period);
  }
  return ma;
}

async function checkMADataFreshness() {
  try {
    console.log('🔍 检查AAVEUSDT MA数据的时间戳和最新性...\n');

    // 1. 获取Binance API的实时4H K线数据
    console.log('📊 获取Binance API实时4H K线数据...');
    const binanceKlines = await makeRequest('https://fapi.binance.com/fapi/v1/klines?symbol=AAVEUSDT&interval=4h&limit=200');

    console.log(`获取到 ${binanceKlines.length} 条4H K线数据`);

    // 显示最新的几根K线数据
    const latestKlines = binanceKlines.slice(-5);
    console.log('\n📈 最新5根4H K线数据:');
    latestKlines.forEach((kline, index) => {
      const timestamp = parseInt(kline[0]);
      const date = new Date(timestamp);
      const close = parseFloat(kline[4]);
      console.log(`${index + 1}. 时间: ${date.toISOString()} (${date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })})`);
      console.log(`   收盘价: ${close.toFixed(4)}`);
    });

    // 计算实时MA数据
    const closes = binanceKlines.map(k => parseFloat(k[4]));
    const realtimeMA20 = calculateMA(closes, 20);
    const realtimeMA50 = calculateMA(closes, 50);
    const realtimeMA200 = calculateMA(closes, 200);

    const latestMA20 = realtimeMA20[realtimeMA20.length - 1];
    const latestMA50 = realtimeMA50[realtimeMA50.length - 1];
    const latestMA200 = realtimeMA200[realtimeMA200.length - 1];

    console.log('\n📊 实时计算的MA数据:');
    console.log(`MA20: ${latestMA20?.toFixed(4)}`);
    console.log(`MA50: ${latestMA50?.toFixed(4)}`);
    console.log(`MA200: ${latestMA200?.toFixed(4)}`);

    // 2. 获取系统API的MA数据
    console.log('\n🔍 获取系统API的MA数据...');
    const systemResponse = await makeRequest('https://smart.aimaventop.com/api/signals');
    const aaveusdtData = systemResponse.find(item => item.symbol === 'AAVEUSDT');

    if (aaveusdtData) {
      console.log('\n📊 系统API返回的MA数据:');
      console.log(`MA20: ${aaveusdtData.ma20?.toFixed(4)}`);
      console.log(`MA50: ${aaveusdtData.ma50?.toFixed(4)}`);
      console.log(`MA200: ${aaveusdtData.ma200?.toFixed(4)}`);
      console.log(`当前价格: ${aaveusdtData.currentPrice?.toFixed(4)}`);

      // 3. 对比数据差异
      console.log('\n🔍 数据对比分析:');
      const ma20Diff = Math.abs((latestMA20 - aaveusdtData.ma20) / aaveusdtData.ma20 * 100);
      const ma50Diff = Math.abs((latestMA50 - aaveusdtData.ma50) / aaveusdtData.ma50 * 100);
      const ma200Diff = Math.abs((latestMA200 - aaveusdtData.ma200) / aaveusdtData.ma200 * 100);

      console.log(`MA20差异: ${ma20Diff.toFixed(4)}% (实时: ${latestMA20?.toFixed(4)}, 系统: ${aaveusdtData.ma20?.toFixed(4)})`);
      console.log(`MA50差异: ${ma50Diff.toFixed(4)}% (实时: ${latestMA50?.toFixed(4)}, 系统: ${aaveusdtData.ma50?.toFixed(4)})`);
      console.log(`MA200差异: ${ma200Diff.toFixed(4)}% (实时: ${latestMA200?.toFixed(4)}, 系统: ${aaveusdtData.ma200?.toFixed(4)})`);

      // 判断数据是否过期
      const threshold = 0.1; // 0.1%的差异阈值
      const isMA20Fresh = ma20Diff < threshold;
      const isMA50Fresh = ma50Diff < threshold;
      const isMA200Fresh = ma200Diff < threshold;

      console.log('\n✅ 数据新鲜度评估:');
      console.log(`MA20数据: ${isMA20Fresh ? '✅ 最新' : '❌ 可能过期'}`);
      console.log(`MA50数据: ${isMA50Fresh ? '✅ 最新' : '❌ 可能过期'}`);
      console.log(`MA200数据: ${isMA200Fresh ? '✅ 最新' : '❌ 可能过期'}`);

      if (!isMA20Fresh || !isMA50Fresh || !isMA200Fresh) {
        console.log('\n⚠️ 警告: 检测到MA数据可能过期！');
        console.log('建议检查:');
        console.log('1. 数据库中的K线数据是否及时更新');
        console.log('2. MA计算逻辑是否正确');
        console.log('3. 数据同步机制是否正常工作');
      } else {
        console.log('\n✅ 所有MA数据都是最新的！');
      }

      // 4. 分析趋势判断
      console.log('\n🎯 趋势判断分析:');
      const currentPrice = aaveusdtData.currentPrice;

      console.log(`当前价格: ${currentPrice?.toFixed(4)}`);
      console.log(`MA20: ${aaveusdtData.ma20?.toFixed(4)} (价格${currentPrice > aaveusdtData.ma20 ? '>' : '<'}MA20)`);
      console.log(`MA50: ${aaveusdtData.ma50?.toFixed(4)} (MA20${aaveusdtData.ma20 > aaveusdtData.ma50 ? '>' : '<'}MA50)`);
      console.log(`MA200: ${aaveusdtData.ma200?.toFixed(4)} (MA50${aaveusdtData.ma50 > aaveusdtData.ma200 ? '>' : '<'}MA200)`);

      // 重新计算趋势得分
      let bullScore = 0;
      let bearScore = 0;

      if (currentPrice > aaveusdtData.ma20) bullScore++;
      if (aaveusdtData.ma20 > aaveusdtData.ma50) bullScore++;
      if (aaveusdtData.ma50 > aaveusdtData.ma200) bullScore++;

      if (currentPrice < aaveusdtData.ma20) bearScore++;
      if (aaveusdtData.ma20 < aaveusdtData.ma50) bearScore++;
      if (aaveusdtData.ma50 < aaveusdtData.ma200) bearScore++;

      console.log(`\n趋势得分: 多头${bullScore}分, 空头${bearScore}分`);
      console.log(`系统判断: ${aaveusdtData.trend4h} (${aaveusdtData.marketType})`);

    } else {
      console.log('❌ 未找到AAVEUSDT的系统数据');
    }

    // 5. 检查最新K线的时间
    const latestKline = binanceKlines[binanceKlines.length - 1];
    const latestTimestamp = parseInt(latestKline[0]);
    const latestTime = new Date(latestTimestamp);
    const now = new Date();
    const timeDiff = (now - latestTime) / (1000 * 60); // 分钟

    console.log('\n⏰ 时间同步检查:');
    console.log(`最新K线时间: ${latestTime.toISOString()} (${latestTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })})`);
    console.log(`当前时间: ${now.toISOString()} (${now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })})`);
    console.log(`时间差: ${timeDiff.toFixed(2)} 分钟`);

    if (timeDiff > 60) { // 超过1小时
      console.log('⚠️ 警告: 最新K线数据可能不是最新的！');
    } else {
      console.log('✅ K线数据时间正常');
    }

  } catch (error) {
    console.error('❌ 检查失败:', error.message);
    console.error('错误详情:', error);
  }
}

checkMADataFreshness();
