/**
 * SmartFlow 多周期共振交易策略系统
 * 基于日线趋势过滤 + 小时确认 + 15分钟执行
 */

import { STRATEGY_CONFIG, SIGNAL_TYPES, TREND_TYPES, getConfig } from './config.js';

// 技术指标计算库（简化版）
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

  static ema(values, period) {
    if (values.length < period) return [];
    const result = [];
    const multiplier = 2 / (period + 1);
    result[period - 1] = values.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < values.length; i++) {
      result[i] = (values[i] * multiplier) + (result[i - 1] * (1 - multiplier));
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

// Binance API 数据获取
class BinanceAPI {
  static BASE_URL = 'https://fapi.binance.com';
  static PROXY_URL = 'http://47.237.163.85:3000/api/binance';

  // 检测是否在受限地区
  static isRestrictedRegion(request) {
    const country = request.cf?.country;
    const restrictedCountries = [
      'US',    // 美国
      'CA',    // 加拿大
      'GB',    // 英国
      'NL',    // 荷兰
      'NG',    // 尼日利亚
      'BE',    // 比利时
      'CU',    // 古巴
      'IR',    // 伊朗
      'SY',    // 叙利亚
      'KP',    // 朝鲜
      'PH'     // 菲律宾
    ];
    return restrictedCountries.includes(country);
  }

  // 获取 API 基础 URL
  static getBaseUrl() {
    // 直接使用 Binance API，添加重试机制和错误处理
    return this.BASE_URL;
  }

  // 获取备用 URL
  static getFallbackUrl() {
    return this.BASE_URL;
  }

  // 通用 API 请求方法，支持重试机制
  static async _makeRequest(endpoint, params = {}, dataProcessor = null, retries = 3) {
    const queryString = new URLSearchParams(params).toString();
    const url = `${this.getBaseUrl()}${endpoint}?${queryString}`;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[API] 尝试 ${attempt}/${retries}: ${url}`);

        const response = await fetch(url, {
          headers: {
            'User-Agent': 'SmartFlow-Trader/1.0',
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        console.log(`[API] 成功: ${response.status}`);
        const data = await response.json();
        return dataProcessor ? dataProcessor(data) : data;

      } catch (error) {
        console.warn(`[API] 尝试 ${attempt} 失败: ${error.message}`);

        if (attempt === retries) {
          throw new Error(`所有重试失败: ${error.message}`);
        }

        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  static async getKlines(symbol, interval, limit = 500) {
    return await this._makeRequest('/fapi/v1/klines', {
      symbol,
      interval,
      limit
    }, (data) => data.map(k => ({
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
    })));
  }

  static async getFundingRate(symbol, limit = 1) {
    return await this._makeRequest('/fapi/v1/fundingRate', {
      symbol,
      limit
    }, (data) => parseFloat(data[0].fundingRate));
  }

  static async getOpenInterest(symbol, period = '1h', limit = 24) {
    return await this._makeRequest('/futures/data/openInterestHist', {
      symbol,
      period,
      limit
    }, (data) => data.map(d => ({
      time: d.timestamp,
      oi: parseFloat(d.sumOpenInterest)
    })));
  }

  static async getTicker24hr(symbol) {
    return await this._makeRequest('/fapi/v1/ticker/24hr', {
      symbol
    });
  }
}

// 策略分析核心类
class SmartFlowStrategy {
  constructor(env) {
    this.env = env;
    this.symbols = getConfig('symbols', ['BTCUSDT', 'ETHUSDT', 'LINKUSDT', 'LDOUSDT']);
    this.config = STRATEGY_CONFIG;
  }

  /**
   * 日线趋势分析
   */
  async analyzeDailyTrend(symbol) {
    try {
      const daily = await BinanceAPI.getKlines(symbol, '1d', 250);
      const closes = daily.map(k => k.close);

      const ma20 = TechnicalIndicators.sma(closes, 20);
      const ma50 = TechnicalIndicators.sma(closes, 50);
      const ma200 = TechnicalIndicators.sma(closes, 200);

      const latestClose = closes[closes.length - 1];
      const latestMA20 = ma20[ma20.length - 1];
      const latestMA50 = ma50[ma50.length - 1];
      const latestMA200 = ma200[ma200.length - 1];

      // 趋势判断
      let trend = 'RANGE';
      if (latestMA20 > latestMA50 && latestMA50 > latestMA200 && latestClose > latestMA20) {
        trend = 'UPTREND';
      } else if (latestMA20 < latestMA50 && latestMA50 < latestMA200 && latestClose < latestMA20) {
        trend = 'DOWNTREND';
      }

      return {
        trend,
        close: latestClose,
        ma20: latestMA20,
        ma50: latestMA50,
        ma200: latestMA200
      };
    } catch (error) {
      console.error(`日线趋势分析错误 ${symbol}:`, error);
      return { trend: 'ERROR', error: error.message };
    }
  }

  /**
   * 小时级别确认分析
   */
  async analyzeHourlyConfirmation(symbol, trend) {
    try {
      const hourly = await BinanceAPI.getKlines(symbol, '1h', 200);
      const closes = hourly.map(k => k.close);
      const volumes = hourly.map(k => k.volume);

      // VWAP计算
      const vwap = TechnicalIndicators.vwap(hourly);
      const lastVWAP = vwap[vwap.length - 1];
      const lastClose = closes[closes.length - 1];

      // 成交量分析
      const vol20 = TechnicalIndicators.sma(volumes, 20);
      const avgVol = vol20[vol20.length - 1];
      const lastVol = volumes[volumes.length - 1];

      // 突破分析
      const highs20 = hourly.slice(-20).map(k => k.high);
      const lows20 = hourly.slice(-20).map(k => k.low);
      const breakoutUp = lastClose > Math.max(...highs20);
      const breakoutDown = lastClose < Math.min(...lows20);

      // OI分析
      const oiHist = await BinanceAPI.getOpenInterest(symbol, '1h', 7);
      const oiChange = oiHist.length >= 2 ?
        ((oiHist[oiHist.length - 1].oi - oiHist[0].oi) / oiHist[0].oi) * 100 : 0;

      // 资金费率
      const funding = await BinanceAPI.getFundingRate(symbol);

      return {
        close: lastClose,
        vwap: lastVWAP,
        volume: lastVol,
        avgVol,
        volumeRatio: lastVol / avgVol,
        breakoutUp,
        breakoutDown,
        oiChange,
        funding,
        absFunding: Math.abs(funding)
      };
    } catch (error) {
      console.error(`小时确认分析错误 ${symbol}:`, error);
      return { error: error.message };
    }
  }

  /**
   * 15分钟执行时机分析
   */
  async analyze15mExecution(symbol, signal) {
    try {
      const m15 = await BinanceAPI.getKlines(symbol, '15m', 50);
      const setupK = m15[m15.length - 2]; // 最近一根完成的K线

      const atr = TechnicalIndicators.atr(m15, 14);
      const lastATR = atr[atr.length - 1];
      const currentPrice = m15[m15.length - 1].close;

      let setupHigh = setupK.high;
      let setupLow = setupK.low;
      let stopLoss = null;
      let targetPrice = null;
      let riskReward = null;

      if (signal === 'LONG_SIGNAL') {
        stopLoss = Math.min(setupLow, currentPrice - 1.2 * lastATR);
        targetPrice = currentPrice + 2 * (currentPrice - stopLoss);
        riskReward = (targetPrice - currentPrice) / (currentPrice - stopLoss);
      } else if (signal === 'SHORT_SIGNAL') {
        stopLoss = Math.max(setupHigh, currentPrice + 1.2 * lastATR);
        targetPrice = currentPrice - 2 * (stopLoss - currentPrice);
        riskReward = (currentPrice - targetPrice) / (stopLoss - currentPrice);
      }

      return {
        setupHigh,
        setupLow,
        stopLoss,
        targetPrice,
        riskReward,
        atr: lastATR,
        currentPrice
      };
    } catch (error) {
      console.error(`15分钟执行分析错误 ${symbol}:`, error);
      return { error: error.message };
    }
  }

  /**
   * 完整策略分析
   */
  async analyze(symbol) {
    const now = new Date().toISOString();
    console.log(`开始分析 ${symbol}...`);

    try {
      // 1. 日线趋势分析
      const dailyAnalysis = await this.analyzeDailyTrend(symbol);
      if (dailyAnalysis.trend === 'RANGE' || dailyAnalysis.trend === 'ERROR') {
        return {
          time: now,
          symbol,
          trend: dailyAnalysis.trend,
          signal: 'NO_SIGNAL',
          reason: dailyAnalysis.trend === 'RANGE' ? '趋势不明确' : dailyAnalysis.error
        };
      }

      // 2. 小时确认分析
      const hourlyAnalysis = await this.analyzeHourlyConfirmation(symbol, dailyAnalysis.trend);
      if (hourlyAnalysis.error) {
        return {
          time: now,
          symbol,
          trend: dailyAnalysis.trend,
          signal: 'ERROR',
          reason: hourlyAnalysis.error
        };
      }

      // 3. 信号判断
      let signal = 'NO_SIGNAL';
      let reason = '';

      if (dailyAnalysis.trend === 'UPTREND') {
        if (hourlyAnalysis.close > hourlyAnalysis.vwap &&
          hourlyAnalysis.breakoutUp &&
          hourlyAnalysis.volumeRatio >= 1.5 &&
          hourlyAnalysis.oiChange >= 2 &&
          hourlyAnalysis.absFunding <= 0.001) {
          signal = 'LONG_SIGNAL';
          reason = '多头信号：趋势向上+突破+放量+OI增加+资金费率温和';
        } else {
          reason = `多头条件不满足：VWAP=${hourlyAnalysis.close > hourlyAnalysis.vwap}, 突破=${hourlyAnalysis.breakoutUp}, 放量=${hourlyAnalysis.volumeRatio.toFixed(2)}x, OI=${hourlyAnalysis.oiChange.toFixed(2)}%, 资金费率=${hourlyAnalysis.absFunding.toFixed(4)}`;
        }
      } else if (dailyAnalysis.trend === 'DOWNTREND') {
        if (hourlyAnalysis.close < hourlyAnalysis.vwap &&
          hourlyAnalysis.breakoutDown &&
          hourlyAnalysis.volumeRatio >= 1.5 &&
          hourlyAnalysis.oiChange <= -2 &&
          hourlyAnalysis.absFunding <= 0.001) {
          signal = 'SHORT_SIGNAL';
          reason = '空头信号：趋势向下+突破+放量+OI减少+资金费率温和';
        } else {
          reason = `空头条件不满足：VWAP=${hourlyAnalysis.close < hourlyAnalysis.vwap}, 突破=${hourlyAnalysis.breakoutDown}, 放量=${hourlyAnalysis.volumeRatio.toFixed(2)}x, OI=${hourlyAnalysis.oiChange.toFixed(2)}%, 资金费率=${hourlyAnalysis.absFunding.toFixed(4)}`;
        }
      }

      // 4. 15分钟执行分析
      let execution = null;
      if (signal !== 'NO_SIGNAL') {
        execution = await this.analyze15mExecution(symbol, signal);
      }

      const result = {
        time: now,
        symbol,
        trend: dailyAnalysis.trend,
        close: hourlyAnalysis.close,
        vwap: hourlyAnalysis.vwap,
        volume: hourlyAnalysis.volume,
        avgVol: hourlyAnalysis.avgVol,
        volumeRatio: hourlyAnalysis.volumeRatio,
        oiChange: hourlyAnalysis.oiChange,
        funding: hourlyAnalysis.funding,
        signal,
        reason,
        ...execution
      };

      // 5. 保存到KV存储
      if (this.env.TRADE_LOG) {
        await this.env.TRADE_LOG.put(`${symbol}:${Date.now()}`, JSON.stringify(result));
      }

      return result;

    } catch (error) {
      console.error(`策略分析错误 ${symbol}:`, error);
      return {
        time: now,
        symbol,
        trend: 'ERROR',
        signal: 'ERROR',
        reason: error.message
      };
    }
  }

  /**
   * 批量分析所有品种
   */
  async analyzeAll() {
    const results = [];
    for (const symbol of this.symbols) {
      const result = await this.analyze(symbol);
      results.push(result);

      // 如果触发信号，发送Telegram通知
      if (result.signal !== 'NO_SIGNAL' && result.signal !== 'ERROR') {
        await this.sendTelegramNotification(result);
      }
    }
    return results;
  }

  /**
   * 发送Telegram通知
   */
  async sendTelegramNotification(signal) {
    if (!this.env.TG_BOT_TOKEN || !this.env.TG_CHAT_ID) {
      console.log('Telegram配置缺失，跳过通知');
      return;
    }

    try {
      const message = `⚡ ${signal.symbol} 交易信号触发！

📈 趋势: ${signal.trend}
🎯 信号: ${signal.signal}
💰 当前价格: ${signal.close}
📊 VWAP: ${signal.vwap}
📈 成交量倍数: ${signal.volumeRatio.toFixed(2)}x
📊 OI变化: ${signal.oiChange.toFixed(2)}%
💸 资金费率: ${signal.funding.toFixed(4)}

🎯 执行计划:
• 入场价: ${signal.currentPrice || signal.close}
• 止损: ${signal.stopLoss}
• 目标价: ${signal.targetPrice}
• 盈亏比: ${signal.riskReward ? signal.riskReward.toFixed(2) : 'N/A'}

📝 原因: ${signal.reason}`;

      const response = await fetch(`https://api.telegram.org/bot${this.env.TG_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.env.TG_CHAT_ID,
          text: message,
          parse_mode: 'HTML'
        })
      });

      if (!response.ok) {
        console.error('Telegram通知发送失败:', await response.text());
      } else {
        console.log(`Telegram通知已发送: ${signal.symbol}`);
      }
    } catch (error) {
      console.error('Telegram通知错误:', error);
    }
  }
}

// 独立的测试函数
async function testBinanceAPI() {
  const tests = [];

  try {
    // 测试K线数据
    const klines = await BinanceAPI.getKlines('BTCUSDT', '1h', 10);
    tests.push({ test: 'K线数据', status: 'PASS', data: klines.length });
  } catch (error) {
    tests.push({ test: 'K线数据', status: 'FAIL', error: error.message });
  }

  try {
    // 测试资金费率
    const funding = await BinanceAPI.getFundingRate('BTCUSDT');
    tests.push({ test: '资金费率', status: 'PASS', data: funding });
  } catch (error) {
    tests.push({ test: '资金费率', status: 'FAIL', error: error.message });
  }

  try {
    // 测试持仓量
    const oi = await BinanceAPI.getOpenInterest('BTCUSDT', '1h', 5);
    tests.push({ test: '持仓量', status: 'PASS', data: oi.length });
  } catch (error) {
    tests.push({ test: '持仓量', status: 'FAIL', error: error.message });
  }

  return {
    timestamp: new Date().toISOString(),
    tests,
    summary: {
      total: tests.length,
      passed: tests.filter(t => t.status === 'PASS').length,
      failed: tests.filter(t => t.status === 'FAIL').length
    }
  };
}

// Cloudflare Worker 主入口
export default {
  async scheduled(event, env, ctx) {
    console.log('定时任务开始执行...');
    const strategy = new SmartFlowStrategy(env);
    const results = await strategy.analyzeAll();
    console.log('定时任务完成，分析结果:', results.length);
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    const strategy = new SmartFlowStrategy(env);

    // 直接访问 Binance API

    // API路由
    if (url.pathname === '/api/analyze') {
      const symbol = url.searchParams.get('symbol') || 'BTCUSDT';
      const result = await strategy.analyze(symbol);
      return new Response(JSON.stringify(result, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (url.pathname === '/api/analyze-all') {
      const results = await strategy.analyzeAll();
      return new Response(JSON.stringify(results, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (url.pathname === '/api/test') {
      const testResult = await testBinanceAPI();
      return new Response(JSON.stringify(testResult, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 前端页面
    if (url.pathname === '/' || url.pathname === '/dashboard') {
      return new Response(this.generateDashboard(), {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });
    }

    return new Response('SmartFlow Trading Strategy API', { status: 200 });
  },


  generateDashboard() {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SmartFlow 交易策略仪表板</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container { 
            max-width: 1400px; 
            margin: 0 auto; 
            background: rgba(255,255,255,0.95);
            border-radius: 20px;
            padding: 30px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }
        h1 { 
            text-align: center; 
            color: #333; 
            margin-bottom: 30px;
            font-size: 2.5em;
            background: linear-gradient(45deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .controls {
            display: flex;
            gap: 15px;
            margin-bottom: 30px;
            flex-wrap: wrap;
            justify-content: center;
        }
        button {
            padding: 12px 24px;
            border: none;
            border-radius: 25px;
            background: linear-gradient(45deg, #667eea, #764ba2);
            color: white;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s ease;
        }
        button:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.2); }
        .status { 
            text-align: center; 
            margin: 20px 0; 
            padding: 15px;
            border-radius: 10px;
            background: #f8f9fa;
        }
        .signal-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 20px;
            background: white;
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        th, td { 
            padding: 15px; 
            text-align: center; 
            border-bottom: 1px solid #eee;
        }
        th { 
            background: linear-gradient(45deg, #667eea, #764ba2);
            color: white;
            font-weight: 600;
        }
        tr:hover { background: #f8f9fa; }
        .signal-long { color: #28a745; font-weight: bold; }
        .signal-short { color: #dc3545; font-weight: bold; }
        .signal-none { color: #6c757d; }
        .trend-up { color: #28a745; }
        .trend-down { color: #dc3545; }
        .trend-range { color: #ffc107; }
        .loading { 
            text-align: center; 
            padding: 40px; 
            color: #666;
        }
        .error { 
            background: #f8d7da; 
            color: #721c24; 
            padding: 15px; 
            border-radius: 10px; 
            margin: 10px 0;
        }
        .success { 
            background: #d4edda; 
            color: #155724; 
            padding: 15px; 
            border-radius: 10px; 
            margin: 10px 0;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: linear-gradient(45deg, #667eea, #764ba2);
            color: white;
            padding: 20px;
            border-radius: 15px;
            text-align: center;
        }
        .stat-value {
            font-size: 2em;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .stat-label {
            opacity: 0.9;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 SmartFlow 交易策略仪表板</h1>
        
        <div class="controls">
            <button onclick="analyzeAll()">🔄 刷新所有信号</button>
            <button onclick="testAPI()">🧪 测试API连接</button>
            <button onclick="toggleAutoRefresh()">⏰ 自动刷新</button>
        </div>
        
        <div id="status" class="status">点击"刷新所有信号"开始分析</div>
        
        <div id="stats" class="stats" style="display: none;">
            <div class="stat-card">
                <div class="stat-value" id="totalSignals">0</div>
                <div class="stat-label">总信号数</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="longSignals">0</div>
                <div class="stat-label">多头信号</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="shortSignals">0</div>
                <div class="stat-label">空头信号</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="lastUpdate">--</div>
                <div class="stat-label">最后更新</div>
            </div>
        </div>
        
        <table class="signal-table">
            <thead>
                <tr>
                    <th>交易对</th>
                    <th>趋势</th>
                    <th>信号</th>
                    <th>当前价格</th>
                    <th>VWAP</th>
                    <th>成交量倍数</th>
                    <th>OI变化%</th>
                    <th>资金费率</th>
                    <th>止损价</th>
                    <th>目标价</th>
                    <th>盈亏比</th>
                    <th>原因</th>
                </tr>
            </thead>
            <tbody id="signalTableBody">
                <tr>
                    <td colspan="12" class="loading">加载中...</td>
                </tr>
            </tbody>
        </table>
    </div>

    <script>
        let autoRefreshInterval = null;
        
        async function analyzeAll() {
            updateStatus('正在分析所有交易对...', 'loading');
            try {
                const response = await fetch('/api/analyze-all');
                const data = await response.json();
                updateTable(data);
                updateStats(data);
                updateStatus('分析完成！', 'success');
            } catch (error) {
                updateStatus('分析失败: ' + error.message, 'error');
            }
        }
        
        async function testAPI() {
            updateStatus('正在测试API连接...', 'loading');
            try {
                const response = await fetch('/api/test');
                const data = await response.json();
                updateStatus('API测试完成: ' + data.summary.passed + '/' + data.summary.total + ' 通过', 
                           data.summary.failed === 0 ? 'success' : 'error');
            } catch (error) {
                updateStatus('API测试失败: ' + error.message, 'error');
            }
        }
        
        function toggleAutoRefresh() {
            if (autoRefreshInterval) {
                clearInterval(autoRefreshInterval);
                autoRefreshInterval = null;
                updateStatus('自动刷新已停止', '');
            } else {
                autoRefreshInterval = setInterval(analyzeAll, 60000); // 每分钟刷新
                updateStatus('自动刷新已启动（每分钟）', 'success');
            }
        }
        
        function updateStatus(message, type) {
            const status = document.getElementById('status');
            status.textContent = message;
            status.className = 'status ' + type;
        }
        
        function updateTable(data) {
            const tbody = document.getElementById('signalTableBody');
            tbody.innerHTML = '';
            
            data.forEach(item => {
                const row = document.createElement('tr');
                
                const signalClass = item.signal === 'LONG_SIGNAL' ? 'signal-long' : 
                                  item.signal === 'SHORT_SIGNAL' ? 'signal-short' : 'signal-none';
                
                const trendClass = item.trend === 'UPTREND' ? 'trend-up' : 
                                 item.trend === 'DOWNTREND' ? 'trend-down' : 'trend-range';
                
                row.innerHTML = \`
                    <td><strong>\${item.symbol}</strong></td>
                    <td class="\${trendClass}">\${item.trend}</td>
                    <td class="\${signalClass}">\${item.signal}</td>
                    <td>\${item.close ? item.close.toFixed(2) : '--'}</td>
                    <td>\${item.vwap ? item.vwap.toFixed(2) : '--'}</td>
                    <td>\${item.volumeRatio ? item.volumeRatio.toFixed(2) + 'x' : '--'}</td>
                    <td>\${item.oiChange ? item.oiChange.toFixed(2) + '%' : '--'}</td>
                    <td>\${item.funding ? (item.funding * 100).toFixed(4) + '%' : '--'}</td>
                    <td>\${item.stopLoss ? item.stopLoss.toFixed(2) : '--'}</td>
                    <td>\${item.targetPrice ? item.targetPrice.toFixed(2) : '--'}</td>
                    <td>\${item.riskReward ? item.riskReward.toFixed(2) : '--'}</td>
                    <td style="text-align: left; max-width: 200px; word-wrap: break-word;">\${item.reason || '--'}</td>
                \`;
                
                tbody.appendChild(row);
            });
        }
        
        function updateStats(data) {
            const stats = document.getElementById('stats');
            stats.style.display = 'grid';
            
            const totalSignals = data.filter(item => item.signal !== 'NO_SIGNAL' && item.signal !== 'ERROR').length;
            const longSignals = data.filter(item => item.signal === 'LONG_SIGNAL').length;
            const shortSignals = data.filter(item => item.signal === 'SHORT_SIGNAL').length;
            
            document.getElementById('totalSignals').textContent = totalSignals;
            document.getElementById('longSignals').textContent = longSignals;
            document.getElementById('shortSignals').textContent = shortSignals;
            document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
        }
        
        // 页面加载时自动分析
        window.onload = () => {
            analyzeAll();
        };
    </script>
</body>
</html>`;
  }
};
