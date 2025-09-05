/**
 * SmartFlow 模拟测试脚本
 * 用于本地测试，不依赖外部API
 */

// 模拟数据生成器
class MockDataGenerator {
  static generateKlineData(symbol, interval, count = 100) {
    const data = [];
    const basePrice = symbol === 'BTCUSDT' ? 50000 : 
                     symbol === 'ETHUSDT' ? 3000 :
                     symbol === 'LINKUSDT' ? 15 : 2;
    
    let currentPrice = basePrice;
    const now = Date.now();
    const intervalMs = interval === '1d' ? 24 * 60 * 60 * 1000 :
                      interval === '1h' ? 60 * 60 * 1000 :
                      interval === '15m' ? 15 * 60 * 1000 : 1000;
    
    for (let i = 0; i < count; i++) {
      const time = now - (count - i) * intervalMs;
      const volatility = 0.02; // 2%波动
      const change = (Math.random() - 0.5) * volatility;
      const open = currentPrice;
      const close = currentPrice * (1 + change);
      const high = Math.max(open, close) * (1 + Math.random() * 0.01);
      const low = Math.min(open, close) * (1 - Math.random() * 0.01);
      const volume = Math.random() * 1000 + 500;
      
      data.push([
        time,
        open.toFixed(2),
        high.toFixed(2),
        low.toFixed(2),
        close.toFixed(2),
        volume.toFixed(2),
        time + intervalMs - 1,
        (volume * close).toFixed(2),
        Math.floor(Math.random() * 1000),
        (volume * 0.6).toFixed(2),
        (volume * close * 0.6).toFixed(2)
      ]);
      
      currentPrice = close;
    }
    
    return data;
  }
  
  static generateFundingRate() {
    return (Math.random() - 0.5) * 0.002; // -0.1% 到 +0.1%
  }
  
  static generateOpenInterest(count = 24) {
    const data = [];
    const baseOI = 1000000;
    const now = Date.now();
    
    for (let i = 0; i < count; i++) {
      const time = now - (count - i) * 60 * 60 * 1000; // 每小时
      const change = (Math.random() - 0.5) * 0.1; // ±5%变化
      const oi = baseOI * (1 + change);
      
      data.push({
        timestamp: time,
        sumOpenInterest: oi.toFixed(2)
      });
    }
    
    return data;
  }
  
  static generateTicker24hr(symbol) {
    const basePrice = symbol === 'BTCUSDT' ? 50000 : 
                     symbol === 'ETHUSDT' ? 3000 :
                     symbol === 'LINKUSDT' ? 15 : 2;
    
    const change = (Math.random() - 0.5) * 0.1; // ±5%变化
    const currentPrice = basePrice * (1 + change);
    const priceChange = currentPrice - basePrice;
    const priceChangePercent = (priceChange / basePrice) * 100;
    
    return {
      symbol: symbol,
      lastPrice: currentPrice.toFixed(2),
      priceChange: priceChange.toFixed(2),
      priceChangePercent: priceChangePercent.toFixed(2),
      volume: (Math.random() * 10000 + 1000).toFixed(2)
    };
  }
}

// 模拟Binance API
class MockBinanceAPI {
  static async getKlines(symbol, interval, limit = 500) {
    console.log(`📊 模拟获取K线数据: ${symbol} ${interval} ${limit}条`);
    await new Promise(resolve => setTimeout(resolve, 100)); // 模拟网络延迟
    
    const data = MockDataGenerator.generateKlineData(symbol, interval, limit);
    return data.map(k => ({
      time: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      closeTime: k[6],
      quoteVolume: parseFloat(k[7]),
      trades: parseInt(k[8]),
      takerBuyBaseVolume: parseFloat(k[9]),
      takerBuyQuoteVolume: parseFloat(k[10])
    }));
  }
  
  static async getFundingRate(symbol, limit = 1) {
    console.log(`💰 模拟获取资金费率: ${symbol}`);
    await new Promise(resolve => setTimeout(resolve, 50));
    return MockDataGenerator.generateFundingRate();
  }
  
  static async getOpenInterest(symbol, period = '1h', limit = 24) {
    console.log(`📈 模拟获取持仓量: ${symbol} ${period}`);
    await new Promise(resolve => setTimeout(resolve, 50));
    return MockDataGenerator.generateOpenInterest(limit);
  }
  
  static async getTicker24hr(symbol) {
    console.log(`📊 模拟获取24小时数据: ${symbol}`);
    await new Promise(resolve => setTimeout(resolve, 50));
    return MockDataGenerator.generateTicker24hr(symbol);
  }
}

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

// 策略分析测试
class MockStrategyTest {
  static async testDailyTrend(symbol = 'BTCUSDT') {
    console.log(`\n🧪 测试日线趋势分析: ${symbol}`);
    try {
      const data = await MockBinanceAPI.getKlines(symbol, '1d', 250);
      const closes = data.map(k => k.close);
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
      console.log(`收盘价: ${latestClose.toFixed(2)}`);
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
      const data = await MockBinanceAPI.getKlines(symbol, '1h', 200);
      const candles = data.map(k => ({
        time: k.time,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        volume: k.volume
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
      console.log(`收盘价: ${lastClose.toFixed(2)}`);
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

  static async testFullStrategy(symbol = 'BTCUSDT') {
    console.log(`\n🧪 测试完整策略分析: ${symbol}`);
    try {
      // 1. 日线趋势
      const dailyResult = await this.testDailyTrend(symbol);
      if (!dailyResult.success || dailyResult.trend === 'RANGE') {
        return {
          success: true,
          signal: 'NO_SIGNAL',
          reason: '日线趋势不明确'
        };
      }
      
      // 2. 小时确认
      const hourlyResult = await this.testHourlyConfirmation(symbol);
      if (!hourlyResult.success) {
        return {
          success: false,
          error: hourlyResult.error
        };
      }
      
      // 3. 资金费率
      const funding = await MockBinanceAPI.getFundingRate(symbol);
      console.log(`资金费率: ${(funding * 100).toFixed(4)}%`);
      
      // 4. OI变化
      const oiData = await MockBinanceAPI.getOpenInterest(symbol, '1h', 7);
      const oiChange = oiData.length >= 2 ? 
        ((oiData[oiData.length - 1].sumOpenInterest - oiData[0].sumOpenInterest) / oiData[0].sumOpenInterest) * 100 : 0;
      console.log(`OI变化: ${oiChange.toFixed(2)}%`);
      
      // 5. 信号判断
      let signal = 'NO_SIGNAL';
      let reason = '';
      
      if (dailyResult.trend === 'UPTREND') {
        if (hourlyResult.close > hourlyResult.vwap &&
            hourlyResult.breakoutUp &&
            hourlyResult.volumeRatio >= 1.5 &&
            oiChange >= 2 &&
            Math.abs(funding) <= 0.001) {
          signal = 'LONG_SIGNAL';
          reason = '多头信号：趋势向上+突破+放量+OI增加+资金费率温和';
        } else {
          reason = `多头条件不满足：VWAP=${hourlyResult.close > hourlyResult.vwap}, 突破=${hourlyResult.breakoutUp}, 放量=${hourlyResult.volumeRatio.toFixed(2)}x, OI=${oiChange.toFixed(2)}%, 资金费率=${Math.abs(funding).toFixed(4)}`;
        }
      } else if (dailyResult.trend === 'DOWNTREND') {
        if (hourlyResult.close < hourlyResult.vwap &&
            hourlyResult.breakoutDown &&
            hourlyResult.volumeRatio >= 1.5 &&
            oiChange <= -2 &&
            Math.abs(funding) <= 0.001) {
          signal = 'SHORT_SIGNAL';
          reason = '空头信号：趋势向下+突破+放量+OI减少+资金费率温和';
        } else {
          reason = `空头条件不满足：VWAP=${hourlyResult.close < hourlyResult.vwap}, 突破=${hourlyResult.breakoutDown}, 放量=${hourlyResult.volumeRatio.toFixed(2)}x, OI=${oiChange.toFixed(2)}%, 资金费率=${Math.abs(funding).toFixed(4)}`;
        }
      }
      
      console.log(`✅ 完整策略分析完成`);
      console.log(`信号: ${signal}`);
      console.log(`原因: ${reason}`);
      
      return {
        success: true,
        signal,
        reason,
        trend: dailyResult.trend,
        close: hourlyResult.close,
        vwap: hourlyResult.vwap,
        volumeRatio: hourlyResult.volumeRatio,
        oiChange,
        funding
      };
      
    } catch (error) {
      console.error(`❌ 完整策略分析失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

// 主测试函数
async function runMockTests() {
  console.log('🚀 开始SmartFlow模拟测试...\n');
  console.log('=' * 50);
  
  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    summary: { total: 0, passed: 0, failed: 0 }
  };
  
  // 测试API模拟
  const apiTests = [
    { name: 'K线数据模拟', test: () => MockBinanceAPI.getKlines('BTCUSDT', '1h', 10) },
    { name: '资金费率模拟', test: () => MockBinanceAPI.getFundingRate('BTCUSDT') },
    { name: '持仓量模拟', test: () => MockBinanceAPI.getOpenInterest('BTCUSDT', '1h', 5) },
    { name: '24小时数据模拟', test: () => MockBinanceAPI.getTicker24hr('BTCUSDT') }
  ];
  
  for (const apiTest of apiTests) {
    try {
      const result = await apiTest.test();
      results.tests.push({
        name: apiTest.name,
        success: true,
        data: result
      });
      results.summary.total++;
      results.summary.passed++;
    } catch (error) {
      results.tests.push({
        name: apiTest.name,
        success: false,
        error: error.message
      });
      results.summary.total++;
      results.summary.failed++;
    }
  }
  
  // 测试策略分析
  const strategyTests = [
    { name: '日线趋势模拟', test: () => MockStrategyTest.testDailyTrend() },
    { name: '小时确认模拟', test: () => MockStrategyTest.testHourlyConfirmation() },
    { name: '完整策略模拟', test: () => MockStrategyTest.testFullStrategy() }
  ];
  
  for (const strategyTest of strategyTests) {
    const result = await strategyTest.test();
    results.tests.push({
      name: strategyTest.name,
      success: result.success,
      error: result.error,
      data: result
    });
    results.summary.total++;
    if (result.success) results.summary.passed++;
    else results.summary.failed++;
  }
  
  // 输出测试结果
  console.log('\n' + '=' * 50);
  console.log('📊 模拟测试结果汇总:');
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
  
  console.log('\n🎯 模拟测试完成！');
  console.log('💡 提示: 这是模拟测试，实际部署到Cloudflare后会自动使用真实API');
  return results;
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  runMockTests().catch(console.error);
}

export { runMockTests, MockBinanceAPI, MockStrategyTest };
