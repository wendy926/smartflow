const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('smartflow.db');

console.log('🔍 测试震荡市边界判断功能...\n');

// 测试布林带计算
function testBollingerBands() {
  console.log('📊 测试布林带计算...');
  
  // 模拟K线数据
  const testCandles = [];
  for (let i = 0; i < 30; i++) {
    testCandles.push({
      open: 100 + Math.random() * 10,
      high: 105 + Math.random() * 10,
      low: 95 + Math.random() * 10,
      close: 100 + Math.random() * 10,
      volume: 1000 + Math.random() * 500
    });
  }
  
  // 计算移动平均
  function calculateMA(candles, period) {
    const closes = candles.map(c => c.close);
    const ma = [];
    
    for (let i = period - 1; i < candles.length; i++) {
      const slice = closes.slice(i - period + 1, i + 1);
      const sum = slice.reduce((a, b) => a + b, 0);
      ma[i] = sum / period;
    }
    
    return ma;
  }
  
  // 计算布林带
  function calculateBollingerBands(candles, period = 20, k = 2) {
    const closes = candles.map(c => c.close);
    const ma = calculateMA(candles, period);
    const stdDev = [];

    for (let i = period - 1; i < candles.length; i++) {
      const slice = closes.slice(i - period + 1, i + 1);
      const mean = ma[i];
      const variance = slice.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / period;
      stdDev[i] = Math.sqrt(variance);
    }

    return ma.map((m, i) => ({
      middle: m,
      upper: m + (k * (stdDev[i] || 0)),
      lower: m - (k * (stdDev[i] || 0)),
      bandwidth: stdDev[i] ? (4 * stdDev[i] / m) : 0
    }));
  }
  
  const bb = calculateBollingerBands(testCandles, 20, 2);
  const lastBB = bb[bb.length - 1];
  
  console.log(`✅ 布林带计算成功:`);
  console.log(`   上轨: ${lastBB.upper.toFixed(4)}`);
  console.log(`   中轨: ${lastBB.middle.toFixed(4)}`);
  console.log(`   下轨: ${lastBB.lower.toFixed(4)}`);
  console.log(`   带宽: ${lastBB.bandwidth.toFixed(4)}`);
  
  return lastBB;
}

// 测试边界判断逻辑
function testBoundaryLogic(bb) {
  console.log('\n📊 测试边界判断逻辑...');
  
  // 模拟价格数据
  const testPrices = [bb.lower - 1, bb.lower, bb.lower + 1, bb.middle, bb.upper - 1, bb.upper, bb.upper + 1];
  
  testPrices.forEach(price => {
    const lowerDistance = Math.abs(price - bb.lower) / bb.middle;
    const upperDistance = Math.abs(price - bb.upper) / bb.middle;
    
    const lowerValid = lowerDistance <= 0.02 ? 1 : 0;
    const upperValid = upperDistance <= 0.02 ? 1 : 0;
    
    console.log(`价格: ${price.toFixed(4)} | 下边界有效: ${lowerValid} | 上边界有效: ${upperValid}`);
  });
}

// 检查数据库中的实际数据
function checkDatabaseData() {
  console.log('\n📊 检查数据库中的实际数据...');
  
  db.all(`
    SELECT 
      symbol,
      bb_upper,
      bb_middle,
      bb_lower,
      range_lower_boundary_valid,
      range_upper_boundary_valid,
      timestamp
    FROM strategy_analysis 
    WHERE market_type = '震荡市' 
      AND timestamp > datetime('now', '-1 hour')
    ORDER BY timestamp DESC 
    LIMIT 3
  `, (err, rows) => {
    if (err) {
      console.error('查询失败:', err);
      return;
    }
    
    console.log('数据库中的震荡市数据:');
    rows.forEach((row, index) => {
      console.log(`\n${index + 1}. ${row.symbol}:`);
      console.log(`   布林带上轨: ${row.bb_upper}`);
      console.log(`   布林带中轨: ${row.bb_middle}`);
      console.log(`   布林带下轨: ${row.bb_lower}`);
      console.log(`   下边界有效: ${row.range_lower_boundary_valid}`);
      console.log(`   上边界有效: ${row.range_upper_boundary_valid}`);
      console.log(`   时间: ${row.timestamp}`);
    });
    
    // 检查是否有1H K线数据
    console.log('\n🔍 检查1H K线数据...');
    
    db.all(`
      SELECT 
        symbol,
        COUNT(*) as count,
        MAX(timestamp) as latest
      FROM kline_data 
      WHERE interval = '1h' 
        AND timestamp > datetime('now', '-2 hours')
      GROUP BY symbol
      ORDER BY count DESC
      LIMIT 5
    `, (err, klineRows) => {
      if (err) {
        console.error('查询K线数据失败:', err);
        return;
      }
      
      console.log('1H K线数据统计:');
      klineRows.forEach(row => {
        console.log(`${row.symbol}: ${row.count}条数据, 最新: ${row.latest}`);
      });
      
      db.close();
    });
  });
}

// 运行测试
const bb = testBollingerBands();
testBoundaryLogic(bb);
checkDatabaseData();
