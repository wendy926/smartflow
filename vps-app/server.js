const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const axios = require('axios');
const { SMA, VWAP, ATR } = require('technicalindicators');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100 // 限制每个IP 15分钟内最多100个请求
});
app.use('/api/', limiter);

// 技术指标计算
class TechnicalIndicators {
  static calculateSMA(data, period) {
    return SMA.calculate({ values: data, period });
  }

  static calculateVWAP(klines) {
    const prices = klines.map(k => (parseFloat(k[2]) + parseFloat(k[3]) + parseFloat(k[4])) / 3);
    const volumes = klines.map(k => parseFloat(k[5]));
    return VWAP.calculate({ high: prices, low: prices, close: prices, volume: volumes });
  }

  static calculateATR(klines, period = 14) {
    const high = klines.map(k => parseFloat(k[2]));
    const low = klines.map(k => parseFloat(k[3]));
    const close = klines.map(k => parseFloat(k[4]));
    return ATR.calculate({ high, low, close, period });
  }
}

// Binance API 数据获取
class BinanceAPI {
  static BASE_URL = 'https://fapi.binance.com';

  static async getKlines(symbol, interval, limit = 500) {
    try {
      const response = await axios.get(`${this.BASE_URL}/fapi/v1/klines`, {
        params: { symbol, interval, limit },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error(`[BinanceAPI] K线数据获取失败: ${error.message}`);
      throw error;
    }
  }

  static async getFundingRate(symbol) {
    try {
      const response = await axios.get(`${this.BASE_URL}/fapi/v1/premiumIndex`, {
        params: { symbol },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error(`[BinanceAPI] 资金费率获取失败: ${error.message}`);
      throw error;
    }
  }

  static async getOpenInterest(symbol) {
    try {
      const response = await axios.get(`${this.BASE_URL}/fapi/v1/openInterest`, {
        params: { symbol },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error(`[BinanceAPI] 持仓量获取失败: ${error.message}`);
      throw error;
    }
  }

  static async get24hrTicker(symbol) {
    try {
      const response = await axios.get(`${this.BASE_URL}/fapi/v1/ticker/24hr`, {
        params: { symbol },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error(`[BinanceAPI] 24小时价格获取失败: ${error.message}`);
      throw error;
    }
  }
}

// 交易策略
class SmartFlowStrategy {
  static async analyzeDailyTrend(symbol) {
    try {
      const klines = await BinanceAPI.getKlines(symbol, '1d', 100);
      const closes = klines.map(k => parseFloat(k[4]));
      const sma20 = TechnicalIndicators.calculateSMA(closes, 20);
      const sma50 = TechnicalIndicators.calculateSMA(closes, 50);

      const currentPrice = closes[closes.length - 1];
      const currentSma20 = sma20[sma20.length - 1];
      const currentSma50 = sma50[sma50.length - 1];

      if (currentPrice > currentSma20 && currentSma20 > currentSma50) {
        return 'UPTREND';
      } else if (currentPrice < currentSma20 && currentSma20 < currentSma50) {
        return 'DOWNTREND';
      } else {
        return 'RANGE';
      }
    } catch (error) {
      console.error(`[Strategy] 日线趋势分析失败: ${error.message}`);
      return 'RANGE';
    }
  }

  static async analyzeHourlyConfirmation(symbol) {
    try {
      const klines = await BinanceAPI.getKlines(symbol, '1h', 24);
      const closes = klines.map(k => parseFloat(k[4]));
      const volumes = klines.map(k => parseFloat(k[5]));

      const currentPrice = closes[closes.length - 1];
      const currentVolume = volumes[volumes.length - 1];
      const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;

      const volumeRatio = currentVolume / avgVolume;

      if (volumeRatio > 1.5) {
        return { confirmed: true, volumeRatio };
      } else {
        return { confirmed: false, volumeRatio };
      }
    } catch (error) {
      console.error(`[Strategy] 小时确认分析失败: ${error.message}`);
      return { confirmed: false, volumeRatio: 1 };
    }
  }

  static async analyze15mExecution(symbol) {
    try {
      const klines = await BinanceAPI.getKlines(symbol, '15m', 96);
      const vwap = TechnicalIndicators.calculateVWAP(klines);
      const atr = TechnicalIndicators.calculateATR(klines);

      const currentPrice = parseFloat(klines[klines.length - 1][4]);
      const currentVwap = vwap[vwap.length - 1];
      const currentAtr = atr[atr.length - 1];

      const priceVsVwap = (currentPrice - currentVwap) / currentVwap;

      if (priceVsVwap > 0.002) {
        return { signal: 'LONG', priceVsVwap, atr: currentAtr };
      } else if (priceVsVwap < -0.002) {
        return { signal: 'SHORT', priceVsVwap, atr: currentAtr };
      } else {
        return { signal: 'NO_SIGNAL', priceVsVwap, atr: currentAtr };
      }
    } catch (error) {
      console.error(`[Strategy] 15分钟执行分析失败: ${error.message}`);
      return { signal: 'NO_SIGNAL', priceVsVwap: 0, atr: 0 };
    }
  }

  static async analyzeAll(symbol) {
    try {
      const [dailyTrend, hourlyConfirmation, execution15m, fundingRate, openInterest, ticker24hr] = await Promise.all([
        this.analyzeDailyTrend(symbol),
        this.analyzeHourlyConfirmation(symbol),
        this.analyze15mExecution(symbol),
        BinanceAPI.getFundingRate(symbol),
        BinanceAPI.getOpenInterest(symbol),
        BinanceAPI.get24hrTicker(symbol)
      ]);

      const currentPrice = parseFloat(ticker24hr.lastPrice);
      const fundingRateValue = parseFloat(fundingRate.lastFundingRate);
      const oiChange = parseFloat(openInterest.openInterest);

      let signal = 'NO_SIGNAL';
      let reason = '';

      if (dailyTrend === 'UPTREND' && hourlyConfirmation.confirmed && execution15m.signal === 'LONG') {
        signal = 'LONG';
        reason = '多周期共振多头信号';
      } else if (dailyTrend === 'DOWNTREND' && hourlyConfirmation.confirmed && execution15m.signal === 'SHORT') {
        signal = 'SHORT';
        reason = '多周期共振空头信号';
      } else {
        reason = '趋势不明确';
      }

      return {
        time: new Date().toISOString(),
        symbol,
        trend: dailyTrend,
        signal,
        currentPrice,
        vwap: execution15m.priceVsVwap,
        volumeRatio: hourlyConfirmation.volumeRatio,
        oiChange,
        fundingRate: fundingRateValue,
        stopLoss: signal === 'LONG' ? currentPrice - execution15m.atr * 2 :
          signal === 'SHORT' ? currentPrice + execution15m.atr * 2 : 0,
        targetPrice: signal === 'LONG' ? currentPrice + execution15m.atr * 3 :
          signal === 'SHORT' ? currentPrice - execution15m.atr * 3 : 0,
        riskReward: signal !== 'NO_SIGNAL' ? 1.5 : 0,
        reason
      };
    } catch (error) {
      console.error(`[Strategy] 综合分析失败: ${error.message}`);
      return {
        time: new Date().toISOString(),
        symbol,
        trend: 'RANGE',
        signal: 'NO_SIGNAL',
        reason: '分析失败'
      };
    }
  }
}

// API 路由
app.get('/api/test', async (req, res) => {
  try {
    const tests = [
      {
        test: 'K线数据',
        status: 'PASS',
        data: (await BinanceAPI.getKlines('BTCUSDT', '1h', 5)).length
      },
      {
        test: '资金费率',
        status: 'PASS',
        data: (await BinanceAPI.getFundingRate('BTCUSDT')).length
      },
      {
        test: '持仓量',
        status: 'PASS',
        data: (await BinanceAPI.getOpenInterest('BTCUSDT')).openInterest
      }
    ];

    res.json({
      timestamp: new Date().toISOString(),
      tests,
      summary: {
        total: tests.length,
        passed: tests.filter(t => t.status === 'PASS').length,
        failed: tests.filter(t => t.status === 'FAIL').length
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'API测试失败',
      message: error.message
    });
  }
});

app.get('/api/analyze/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const result = await SmartFlowStrategy.analyzeAll(symbol);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: '分析失败',
      message: error.message
    });
  }
});

app.get('/api/analyze-all', async (req, res) => {
  try {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'LINKUSDT', 'LDOUSDT'];
    const results = await Promise.all(
      symbols.map(symbol => SmartFlowStrategy.analyzeAll(symbol))
    );
    res.json(results);
  } catch (error) {
    res.status(500).json({
      error: '批量分析失败',
      message: error.message
    });
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    server: 'SmartFlow VPS Application',
    location: 'Singapore'
  });
});

// 前端页面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SmartFlow VPS 应用启动成功！`);
  console.log(`📊 端口: ${PORT}`);
  console.log(`🌍 访问地址: http://localhost:${PORT}`);
  console.log(`🔗 API 地址: http://localhost:${PORT}/api/test`);
});
