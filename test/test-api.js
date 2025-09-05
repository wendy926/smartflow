/**
 * SmartFlow API 测试脚本
 * 用于在Cloudflare Worker环境中调试Binance API连接
 */

// 导入fetch polyfill for Node.js
import fetch from 'node-fetch';

// 模拟Cloudflare Worker环境
const mockEnv = {
  TG_BOT_TOKEN: process.env.TG_BOT_TOKEN || 'your_telegram_bot_token',
  TG_CHAT_ID: process.env.TG_CHAT_ID || 'your_telegram_chat_id'
};

// 技术指标计算（简化版）
class TechnicalIndicators {
  static sma(values, period) {
    if (values.length < period) return [];
    const result = [];
    for (let i = period - 1; i < values.length; i++) {
      const slice = values.slice(i - period + 1, i + 1);
      result.push(slice.reduce((a, b) => a + b, 0) / period);
    }
    return result;
  }

  static vwap(candles) {
    let cumulativePV = 0;
    let cumulativeVol = 0;
    return candles.map(c => {
      const typical = (c.high + c.low + c.close) / 3;
      cumulativePV += typical * c.volume;
      cumulativeVol += c.volume;
      return cumulativeVol > 0 ? cumulativePV / cumulativeVol : 0;
    });
  }

  static atr(candles, period = 14) {
    if (candles.length < period + 1) return [];
    const trueRanges = [];

    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i - 1].close;

      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);
    }

    return this.sma(trueRanges, period);
  }
}

// Binance API 测试类
class BinanceAPITest {
  static BASE_URL = 'https://fapi.binance.com';

  static async testKlines(symbol = 'BTCUSDT') {
    console.log(`\n🧪 测试K线数据获取: ${symbol}`);
    try {
      const url = `${this.BASE_URL}/fapi/v1/klines?symbol=${symbol}&interval=1h&limit=10`;
      console.log(`请求URL: ${url}`);

      const response = await fetch(url);
      console.log(`响应状态: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ K线数据获取成功，返回 ${data.length} 条记录`);

      // 显示最新K线数据
      const latest = data[data.length - 1];
      console.log(`最新K线: 时间=${new Date(latest[0])}, 收盘=${latest[4]}, 成交量=${latest[5]}`);

      return {
        success: true,
        count: data.length,
        latest: {
          time: new Date(latest[0]).toISOString(),
          close: parseFloat(latest[4]),
          volume: parseFloat(latest[5])
        }
      };
    } catch (error) {
      console.error(`❌ K线数据获取失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  static async testFundingRate(symbol = 'BTCUSDT') {
    console.log(`\n🧪 测试资金费率获取: ${symbol}`);
    try {
      const url = `${this.BASE_URL}/fapi/v1/fundingRate?symbol=${symbol}&limit=1`;
      console.log(`请求URL: ${url}`);

      const response = await fetch(url);
      console.log(`响应状态: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const fundingRate = parseFloat(data[0].fundingRate);
      console.log(`✅ 资金费率获取成功: ${(fundingRate * 100).toFixed(4)}%`);

      return {
        success: true,
        fundingRate,
        nextFundingTime: new Date(parseInt(data[0].fundingTime)).toISOString()
      };
    } catch (error) {
      console.error(`❌ 资金费率获取失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  static async testOpenInterest(symbol = 'BTCUSDT') {
    console.log(`\n🧪 测试持仓量数据获取: ${symbol}`);
    try {
      const url = `${this.BASE_URL}/futures/data/openInterestHist?symbol=${symbol}&period=1h&limit=5`;
      console.log(`请求URL: ${url}`);

      const response = await fetch(url);
      console.log(`响应状态: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ 持仓量数据获取成功，返回 ${data.length} 条记录`);

      // 计算OI变化
      if (data.length >= 2) {
        const latest = parseFloat(data[data.length - 1].sumOpenInterest);
        const previous = parseFloat(data[0].sumOpenInterest);
        const change = ((latest - previous) / previous) * 100;
        console.log(`OI变化: ${change.toFixed(2)}% (${previous} -> ${latest})`);
      }

      return {
        success: true,
        count: data.length,
        data: data.map(d => ({
          time: new Date(parseInt(d.timestamp)).toISOString(),
          oi: parseFloat(d.sumOpenInterest)
        }))
      };
    } catch (error) {
      console.error(`❌ 持仓量数据获取失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  static async testTicker24hr(symbol = 'BTCUSDT') {
    console.log(`\n🧪 测试24小时价格变动: ${symbol}`);
    try {
      const url = `${this.BASE_URL}/fapi/v1/ticker/24hr?symbol=${symbol}`;
      console.log(`请求URL: ${url}`);

      const response = await fetch(url);
      console.log(`响应状态: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ 24小时数据获取成功`);
      console.log(`当前价格: ${data.lastPrice}`);
      console.log(`24h变化: ${data.priceChangePercent}%`);
      console.log(`24h成交量: ${data.volume}`);

      return {
        success: true,
        lastPrice: parseFloat(data.lastPrice),
        priceChangePercent: parseFloat(data.priceChangePercent),
        volume: parseFloat(data.volume)
      };
    } catch (error) {
      console.error(`❌ 24小时数据获取失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

// 策略分析测试
class StrategyTest {
  static async testDailyTrend(symbol = 'BTCUSDT') {
    console.log(`\n🧪 测试日线趋势分析: ${symbol}`);
    try {
      const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=1d&limit=250`;
      const response = await fetch(url);
      const data = await response.json();

      const closes = data.map(k => parseFloat(k[4]));
      const ma20 = TechnicalIndicators.sma(closes, 20);
      const ma50 = TechnicalIndicators.sma(closes, 50);
      const ma200 = TechnicalIndicators.sma(closes, 200);

      const latestClose = closes[closes.length - 1];
      const latestMA20 = ma20[ma20.length - 1];
      const latestMA50 = ma50[ma50.length - 1];
      const latestMA200 = ma200[ma200.length - 1];

      let trend = 'RANGE';
      if (latestMA20 > latestMA50 && latestMA50 > latestMA200 && latestClose > latestMA20) {
        trend = 'UPTREND';
      } else if (latestMA20 < latestMA50 && latestMA50 < latestMA200 && latestClose < latestMA20) {
        trend = 'DOWNTREND';
      }

      console.log(`✅ 日线趋势分析完成`);
      console.log(`收盘价: ${latestClose}`);
      console.log(`MA20: ${latestMA20.toFixed(2)}`);
      console.log(`MA50: ${latestMA50.toFixed(2)}`);
      console.log(`MA200: ${latestMA200.toFixed(2)}`);
      console.log(`趋势: ${trend}`);

      return {
        success: true,
        trend,
        close: latestClose,
        ma20: latestMA20,
        ma50: latestMA50,
        ma200: latestMA200
      };
    } catch (error) {
      console.error(`❌ 日线趋势分析失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  static async testHourlyConfirmation(symbol = 'BTCUSDT') {
    console.log(`\n🧪 测试小时确认分析: ${symbol}`);
    try {
      const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=1h&limit=200`;
      const response = await fetch(url);
      const data = await response.json();

      const candles = data.map(k => ({
        time: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));

      const closes = candles.map(c => c.close);
      const volumes = candles.map(c => c.volume);

      // VWAP计算
      const vwap = TechnicalIndicators.vwap(candles);
      const lastVWAP = vwap[vwap.length - 1];
      const lastClose = closes[closes.length - 1];

      // 成交量分析
      const vol20 = TechnicalIndicators.sma(volumes, 20);
      const avgVol = vol20[vol20.length - 1];
      const lastVol = volumes[volumes.length - 1];
      const volumeRatio = lastVol / avgVol;

      // 突破分析
      const highs20 = candles.slice(-20).map(c => c.high);
      const lows20 = candles.slice(-20).map(c => c.low);
      const breakoutUp = lastClose > Math.max(...highs20);
      const breakoutDown = lastClose < Math.min(...lows20);

      console.log(`✅ 小时确认分析完成`);
      console.log(`收盘价: ${lastClose}`);
      console.log(`VWAP: ${lastVWAP.toFixed(2)}`);
      console.log(`成交量倍数: ${volumeRatio.toFixed(2)}x`);
      console.log(`突破向上: ${breakoutUp}`);
      console.log(`突破向下: ${breakoutDown}`);

      return {
        success: true,
        close: lastClose,
        vwap: lastVWAP,
        volumeRatio,
        breakoutUp,
        breakoutDown
      };
    } catch (error) {
      console.error(`❌ 小时确认分析失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

// 主测试函数
async function runAllTests() {
  console.log('🚀 开始SmartFlow API测试...\n');
  console.log('=' * 50);

  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    summary: { total: 0, passed: 0, failed: 0 }
  };

  // 测试API连接
  const apiTests = [
    { name: 'K线数据', test: () => BinanceAPITest.testKlines() },
    { name: '资金费率', test: () => BinanceAPITest.testFundingRate() },
    { name: '持仓量', test: () => BinanceAPITest.testOpenInterest() },
    { name: '24小时数据', test: () => BinanceAPITest.testTicker24hr() }
  ];

  for (const apiTest of apiTests) {
    const result = await apiTest.test();
    results.tests.push({
      name: apiTest.name,
      success: result.success,
      error: result.error
    });
    results.summary.total++;
    if (result.success) results.summary.passed++;
    else results.summary.failed++;
  }

  // 测试策略分析
  const strategyTests = [
    { name: '日线趋势', test: () => StrategyTest.testDailyTrend() },
    { name: '小时确认', test: () => StrategyTest.testHourlyConfirmation() }
  ];

  for (const strategyTest of strategyTests) {
    const result = await strategyTest.test();
    results.tests.push({
      name: strategyTest.name,
      success: result.success,
      error: result.error
    });
    results.summary.total++;
    if (result.success) results.summary.passed++;
    else results.summary.failed++;
  }

  // 输出测试结果
  console.log('\n' + '=' * 50);
  console.log('📊 测试结果汇总:');
  console.log(`总测试数: ${results.summary.total}`);
  console.log(`通过: ${results.summary.passed} ✅`);
  console.log(`失败: ${results.summary.failed} ❌`);
  console.log(`成功率: ${((results.summary.passed / results.summary.total) * 100).toFixed(1)}%`);

  if (results.summary.failed > 0) {
    console.log('\n❌ 失败的测试:');
    results.tests.filter(t => !t.success).forEach(test => {
      console.log(`- ${test.name}: ${test.error}`);
    });
  }

  console.log('\n🎯 测试完成！');
  return results;
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

export { runAllTests, BinanceAPITest, StrategyTest };
