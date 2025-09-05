const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const axios = require('axios');
const { SMA, VWAP, ATR } = require('technicalindicators');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

// 初始化 CVD 管理器
const cvdManager = new CVDManager();
cvdManager.start();

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

// CVD WebSocket 管理
class CVDManager {
  constructor() {
    this.cvdData = new Map();
    this.connections = new Map();
    this.symbols = ['BTCUSDT', 'ETHUSDT', 'LINKUSDT', 'LDOUSDT', 'SOLUSDT'];
  }

  start() {
    this.symbols.forEach(symbol => {
      this.connectSymbol(symbol);
    });
  }

  connectSymbol(symbol) {
    const wsSymbol = symbol.toLowerCase();
    // 使用正确的 Binance WebSocket API 端点
    const ws = new WebSocket(`wss://fstream.binance.com/ws/${wsSymbol}@aggTrade`);

    this.cvdData.set(symbol, {
      cvd: 0,
      totalBuyVolume: 0,
      totalSellVolume: 0,
      lastUpdate: Date.now(),
      tradeCount: 0
    });

    ws.on('message', (data) => {
      try {
        const trade = JSON.parse(data);
        this.updateCVD(symbol, trade);
      } catch (error) {
        console.error(`[CVD] ${symbol} 数据解析失败:`, error.message);
      }
    });

    ws.on('open', () => {
      console.log(`✅ CVD WebSocket 已连接: ${symbol}`);
    });

    ws.on('close', (code, reason) => {
      console.log(`⚠️ CVD WebSocket 断开: ${symbol}, 代码: ${code}, 原因: ${reason}`);
      // 5秒后重连
      setTimeout(() => this.connectSymbol(symbol), 5000);
    });

    ws.on('error', (error) => {
      console.error(`❌ CVD WebSocket 错误 ${symbol}:`, error.message);
    });

    ws.on('ping', (data) => {
      // 响应 ping 消息以保持连接
      ws.pong(data);
    });

    this.connections.set(symbol, ws);
  }

  updateCVD(symbol, trade) {
    const data = this.cvdData.get(symbol);
    if (!data) return;

    const qty = parseFloat(trade.q);
    const isBuyerMaker = trade.m; // true表示卖方主动成交

    if (isBuyerMaker) {
      data.cvd -= qty;
      data.totalSellVolume += qty;
    } else {
      data.cvd += qty;
      data.totalBuyVolume += qty;
    }

    data.lastUpdate = Date.now();
    data.tradeCount++;
  }

  getCVD(symbol) {
    const data = this.cvdData.get(symbol);
    if (!data) return { cvd: 0, direction: 'N/A', isActive: false };

    const isActive = Date.now() - data.lastUpdate < 30000; // 30秒内有更新
    return {
      cvd: data.cvd,
      direction: data.cvd >= 0 ? 'CVD(+)' : 'CVD(-)',
      isActive,
      tradeCount: data.tradeCount,
      lastUpdate: data.lastUpdate
    };
  }

  // 获取所有连接状态
  getConnectionStatus() {
    const status = {};
    this.symbols.forEach(symbol => {
      const ws = this.connections.get(symbol);
      const cvdData = this.getCVD(symbol);
      status[symbol] = {
        connected: ws && ws.readyState === WebSocket.OPEN,
        cvd: cvdData,
        readyState: ws ? ws.readyState : -1
      };
    });
    return status;
  }

  // 关闭所有连接
  closeAll() {
    this.connections.forEach((ws, symbol) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
        console.log(`🔌 关闭 WebSocket 连接: ${symbol}`);
      }
    });
    this.connections.clear();
  }
}

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

  static calculateEMA(data, period) {
    const multiplier = 2 / (period + 1);
    const ema = [data[0]];

    for (let i = 1; i < data.length; i++) {
      ema.push((data[i] * multiplier) + (ema[i - 1] * (1 - multiplier)));
    }

    return ema;
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

  static async getOpenInterestHist(symbol, period = '1h', limit = 24) {
    try {
      const response = await axios.get(`${this.BASE_URL}/futures/data/openInterestHist`, {
        params: { symbol, period, limit },
        timeout: 10000
      });
      return response.data.map(d => ({
        time: d.timestamp,
        oi: parseFloat(d.sumOpenInterest)
      }));
    } catch (error) {
      console.error(`[BinanceAPI] 持仓量历史获取失败: ${error.message}`);
      throw error;
    }
  }
}

// 交易策略
class SmartFlowStrategy {
  static async analyzeDailyTrend(symbol) {
    try {
      const klines = await BinanceAPI.getKlines(symbol, '1d', 250);
      if (!klines || klines.length < 200) {
        throw new Error('日线数据不足');
      }

      const closes = klines.map(k => parseFloat(k[4]));
      const sma20 = TechnicalIndicators.calculateSMA(closes, 20);
      const sma50 = TechnicalIndicators.calculateSMA(closes, 50);
      const sma200 = TechnicalIndicators.calculateSMA(closes, 200);

      if (sma20.length < 1 || sma50.length < 1 || sma200.length < 1) {
        throw new Error('移动平均线计算失败');
      }

      const currentPrice = closes[closes.length - 1];
      const currentSma20 = sma20[sma20.length - 1];
      const currentSma50 = sma50[sma50.length - 1];
      const currentSma200 = sma200[sma200.length - 1];

      // 按照策略文档：MA20 > MA50 > MA200 且价格在 MA20 上
      if (currentSma20 > currentSma50 && currentSma50 > currentSma200 && currentPrice > currentSma20) {
        return { trend: 'UPTREND', dataValid: true };
      } else if (currentSma20 < currentSma50 && currentSma50 < currentSma200 && currentPrice < currentSma20) {
        return { trend: 'DOWNTREND', dataValid: true };
      } else {
        return { trend: 'RANGE', dataValid: true };
      }
    } catch (error) {
      console.error(`[Strategy] 日线趋势分析失败: ${error.message}`);
      return { trend: 'RANGE', dataValid: false, error: error.message };
    }
  }

  static async analyzeHourlyConfirmation(symbol) {
    try {
      const klines = await BinanceAPI.getKlines(symbol, '1h', 200);
      if (!klines || klines.length < 20) {
        throw new Error('小时数据不足');
      }

      const closes = klines.map(k => parseFloat(k[4]));
      const volumes = klines.map(k => parseFloat(k[5]));
      const highs = klines.map(k => parseFloat(k[2]));
      const lows = klines.map(k => parseFloat(k[3]));

      const currentPrice = closes[closes.length - 1];
      const currentVolume = volumes[volumes.length - 1];
      const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
      const volumeRatio = currentVolume / avgVolume;

      // 计算 VWAP
      const vwap = TechnicalIndicators.calculateVWAP(klines);
      if (!vwap || vwap.length < 1) {
        throw new Error('VWAP计算失败');
      }
      const currentVwap = vwap[vwap.length - 1];

      // 检查突破20根K线
      const highs20 = highs.slice(-20);
      const lows20 = lows.slice(-20);
      const breakoutUp = currentPrice > Math.max(...highs20);
      const breakoutDown = currentPrice < Math.min(...lows20);

      // 获取 OI 6小时变化
      const oiHist = await BinanceAPI.getOpenInterestHist(symbol, '1h', 7);
      if (!oiHist || oiHist.length < 2) {
        throw new Error('OI历史数据不足');
      }
      const oiChange = (oiHist[oiHist.length - 1].oi - oiHist[0].oi) / oiHist[0].oi * 100;

      // 获取资金费率
      const fundingRate = await BinanceAPI.getFundingRate(symbol);
      if (!fundingRate || !fundingRate.lastFundingRate) {
        throw new Error('资金费率数据获取失败');
      }
      const fundingRateValue = parseFloat(fundingRate.lastFundingRate);

      // 获取 CVD 数据
      const cvdData = cvdManager.getCVD(symbol);
      if (!cvdData.isActive) {
        throw new Error('CVD数据不可用');
      }

      return {
        confirmed: volumeRatio > 1.5 && Math.abs(fundingRateValue) <= 0.001,
        volumeRatio,
        vwap: currentVwap,
        priceVsVwap: (currentPrice - currentVwap) / currentVwap,
        breakoutUp,
        breakoutDown,
        oiChange,
        fundingRate: fundingRateValue,
        cvd: cvdData,
        dataValid: true
      };
    } catch (error) {
      console.error(`[Strategy] 小时确认分析失败: ${error.message}`);
      return {
        confirmed: false,
        volumeRatio: 1,
        vwap: 0,
        priceVsVwap: 0,
        breakoutUp: false,
        breakoutDown: false,
        oiChange: 0,
        fundingRate: 0,
        cvd: { cvd: 0, direction: 'N/A', isActive: false },
        dataValid: false,
        error: error.message
      };
    }
  }

  static async analyze15mExecution(symbol) {
    try {
      const klines = await BinanceAPI.getKlines(symbol, '15m', 96);
      if (!klines || klines.length < 50) {
        throw new Error('15分钟数据不足');
      }

      const atr = TechnicalIndicators.calculateATR(klines);
      if (!atr || atr.length < 1) {
        throw new Error('ATR计算失败');
      }
      const currentAtr = atr[atr.length - 1];

      // 计算 EMA20 和 EMA50
      const closes = klines.map(k => parseFloat(k[4]));
      const ema20 = TechnicalIndicators.calculateEMA(closes, 20);
      const ema50 = TechnicalIndicators.calculateEMA(closes, 50);

      if (!ema20 || !ema50 || ema20.length < 1 || ema50.length < 1) {
        throw new Error('EMA计算失败');
      }

      const currentPrice = parseFloat(klines[klines.length - 1][4]);
      const currentEma20 = ema20[ema20.length - 1];
      const currentEma50 = ema50[ema50.length - 1];

      // 检查回踩 EMA20/50 (1% 范围内)
      const pullbackToEma20 = Math.abs(currentPrice - currentEma20) / currentEma20 < 0.01;
      const pullbackToEma50 = Math.abs(currentPrice - currentEma50) / currentEma50 < 0.01;

      // Setup candle (前一根完成的K线)
      const setupCandle = klines[klines.length - 2];
      const setupHigh = parseFloat(setupCandle[2]);
      const setupLow = parseFloat(setupCandle[3]);

      // 检查突破 setup candle
      const breakSetupHigh = currentPrice > setupHigh;
      const breakSetupLow = currentPrice < setupLow;

      return {
        signal: 'NO_SIGNAL',
        atr: currentAtr,
        ema20: currentEma20,
        ema50: currentEma50,
        pullbackToEma20,
        pullbackToEma50,
        setupHigh,
        setupLow,
        breakSetupHigh,
        breakSetupLow,
        dataValid: true
      };
    } catch (error) {
      console.error(`[Strategy] 15分钟执行分析失败: ${error.message}`);
      return {
        signal: 'NO_SIGNAL',
        atr: 0,
        ema20: 0,
        ema50: 0,
        pullbackToEma20: false,
        pullbackToEma50: false,
        setupHigh: 0,
        setupLow: 0,
        breakSetupHigh: false,
        breakSetupLow: false,
        dataValid: false,
        error: error.message
      };
    }
  }

  static async analyzeAll(symbol) {
    try {
      const [dailyTrend, hourlyConfirmation, execution15m, ticker24hr] = await Promise.all([
        this.analyzeDailyTrend(symbol),
        this.analyzeHourlyConfirmation(symbol),
        this.analyze15mExecution(symbol),
        BinanceAPI.get24hrTicker(symbol)
      ]);

      // 检查数据有效性
      if (!dailyTrend.dataValid || !hourlyConfirmation.dataValid || !execution15m.dataValid) {
        const missingData = [];
        if (!dailyTrend.dataValid) missingData.push(`日线趋势: ${dailyTrend.error || '数据无效'}`);
        if (!hourlyConfirmation.dataValid) missingData.push(`小时确认: ${hourlyConfirmation.error || '数据无效'}`);
        if (!execution15m.dataValid) missingData.push(`15分钟执行: ${execution15m.error || '数据无效'}`);

        return {
          time: new Date().toISOString(),
          symbol,
          trend: 'DATA_ERROR',
          signal: 'DATA_ERROR',
          execution: 'DATA_ERROR',
          currentPrice: 0,
          dataError: missingData.join('; ')
        };
      }

      const currentPrice = parseFloat(ticker24hr.lastPrice);

      // 1. 趋势判断 (日线数据)
      const trend = dailyTrend.trend;

      // 2. 信号判断 (日线 + 小时数据)
      let signal = 'NO_SIGNAL';
      if (trend === 'UPTREND' &&
        hourlyConfirmation.confirmed &&
        hourlyConfirmation.priceVsVwap > 0 &&
        hourlyConfirmation.breakoutUp &&
        hourlyConfirmation.oiChange >= 2 &&
        hourlyConfirmation.cvd.direction === 'CVD(+)') {
        signal = 'LONG';
      } else if (trend === 'DOWNTREND' &&
        hourlyConfirmation.confirmed &&
        hourlyConfirmation.priceVsVwap < 0 &&
        hourlyConfirmation.breakoutDown &&
        hourlyConfirmation.oiChange <= -2 &&
        hourlyConfirmation.cvd.direction === 'CVD(-)') {
        signal = 'SHORT';
      }

      // 3. 入场执行判断 (15分钟数据)
      let execution = 'NO_EXECUTION';
      if (signal === 'LONG') {
        if (execution15m.pullbackToEma20 || execution15m.pullbackToEma50) {
          if (execution15m.breakSetupHigh) {
            execution = 'LONG_EXECUTE';
          } else {
            execution = 'LONG_WAIT_PULLBACK';
          }
        } else {
          execution = 'LONG_WAIT_PULLBACK';
        }
      } else if (signal === 'SHORT') {
        if (execution15m.pullbackToEma20 || execution15m.pullbackToEma50) {
          if (execution15m.breakSetupLow) {
            execution = 'SHORT_EXECUTE';
          } else {
            execution = 'SHORT_WAIT_PULLBACK';
          }
        } else {
          execution = 'SHORT_WAIT_PULLBACK';
        }
      }

      // 计算止损和目标价
      let stopLoss = 0;
      let targetPrice = 0;
      let stopDistance = 0;
      let maxLeverage = 0;
      let minMargin = 0;

      if (signal !== 'NO_SIGNAL' && execution.includes('EXECUTE')) {
        // 使用 setup candle 或 ATR 计算止损
        const setupStop = signal === 'LONG' ? execution15m.setupLow : execution15m.setupHigh;
        const atrStop = signal === 'LONG' ?
          currentPrice - execution15m.atr * 1.2 :
          currentPrice + execution15m.atr * 1.2;

        // 取更远的止损
        stopLoss = signal === 'LONG' ?
          Math.min(setupStop, atrStop) :
          Math.max(setupStop, atrStop);

        // 目标价：2R 盈亏比
        targetPrice = signal === 'LONG' ?
          currentPrice + 2 * (currentPrice - stopLoss) :
          currentPrice - 2 * (stopLoss - currentPrice);

        // 计算新增字段
        stopDistance = Math.abs(currentPrice - stopLoss) / currentPrice;
        maxLeverage = Math.floor(1 / (stopDistance + 0.005)); // 0.5% 缓冲
        minMargin = Math.ceil(200 / (maxLeverage * stopDistance));
      }

      return {
        time: new Date().toISOString(),
        symbol,
        trend,
        signal,
        execution,
        currentPrice,
        vwap: hourlyConfirmation.vwap,
        priceVsVwap: hourlyConfirmation.priceVsVwap,
        volumeRatio: hourlyConfirmation.volumeRatio,
        oiChange: hourlyConfirmation.oiChange,
        fundingRate: hourlyConfirmation.fundingRate,
        cvd: hourlyConfirmation.cvd.direction,
        stopLoss,
        targetPrice,
        stopDistance,
        maxLeverage,
        minMargin,
        riskReward: signal !== 'NO_SIGNAL' ? 2 : 0
      };
    } catch (error) {
      console.error(`[Strategy] 综合分析失败: ${error.message}`);
      return {
        time: new Date().toISOString(),
        symbol,
        trend: 'ERROR',
        signal: 'ERROR',
        execution: 'ERROR',
        currentPrice: 0,
        dataError: `综合分析失败: ${error.message}`
      };
    }
  }
}

// API 路由
app.get('/api/test', async (req, res) => {
  try {
    const tests = [];

    // 测试 Binance API 连接
    try {
      const klines = await BinanceAPI.getKlines('BTCUSDT', '1h', 5);
      tests.push({ test: 'K线数据', status: 'PASS', data: `${klines.length} 条记录` });
    } catch (error) {
      tests.push({ test: 'K线数据', status: 'FAIL', error: error.message });
    }

    try {
      const funding = await BinanceAPI.getFundingRate('BTCUSDT');
      tests.push({ test: '资金费率', status: 'PASS', data: funding.lastFundingRate });
    } catch (error) {
      tests.push({ test: '资金费率', status: 'FAIL', error: error.message });
    }

    try {
      const oi = await BinanceAPI.getOpenInterest('BTCUSDT');
      tests.push({ test: '持仓量', status: 'PASS', data: oi.openInterest });
    } catch (error) {
      tests.push({ test: '持仓量', status: 'FAIL', error: error.message });
    }

    // 测试 WebSocket 连接状态
    const wsStatus = cvdManager.getConnectionStatus();
    const wsTests = Object.entries(wsStatus).map(([symbol, status]) => ({
      test: `WebSocket ${symbol}`,
      status: status.connected ? 'PASS' : 'FAIL',
      data: status.connected ?
        `CVD: ${status.cvd.direction}, 交易数: ${status.cvd.tradeCount}` :
        `连接状态: ${status.readyState}`
    }));
    tests.push(...wsTests);

    res.json({
      timestamp: new Date().toISOString(),
      tests,
      summary: {
        total: tests.length,
        passed: tests.filter(t => t.status === 'PASS').length,
        failed: tests.filter(t => t.status === 'FAIL').length
      },
      websocketStatus: wsStatus
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
    const symbols = ['BTCUSDT', 'ETHUSDT', 'LINKUSDT', 'LDOUSDT', 'SOLUSDT'];
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

// 自定义交易对分析
app.post('/api/analyze-custom', async (req, res) => {
  try {
    const { symbol } = req.body;

    if (!symbol) {
      return res.status(400).json({
        error: '缺少交易对参数',
        message: '请提供 symbol 参数'
      });
    }

    // 验证交易对格式
    if (!symbol.endsWith('USDT')) {
      return res.status(400).json({
        error: '交易对格式错误',
        message: '交易对必须以 USDT 结尾'
      });
    }

    const result = await SmartFlowStrategy.analyzeAll(symbol);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: '自定义分析失败',
      message: error.message
    });
  }
});

// WebSocket 状态监控
app.get('/api/websocket-status', (req, res) => {
  try {
    const status = cvdManager.getConnectionStatus();
    res.json({
      timestamp: new Date().toISOString(),
      websocketStatus: status,
      summary: {
        total: Object.keys(status).length,
        connected: Object.values(status).filter(s => s.connected).length,
        disconnected: Object.values(status).filter(s => !s.connected).length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 健康检查
app.get('/health', (req, res) => {
  const wsStatus = cvdManager.getConnectionStatus();
  const connectedCount = Object.values(wsStatus).filter(s => s.connected).length;

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    server: 'SmartFlow VPS Application',
    location: 'Singapore',
    websocketConnections: connectedCount,
    totalSymbols: Object.keys(wsStatus).length
  });
});

// 前端页面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动服务器
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SmartFlow VPS 应用启动成功！`);
  console.log(`📊 端口: ${PORT}`);
  console.log(`🌍 访问地址: http://localhost:${PORT}`);
  console.log(`🔗 API 地址: http://localhost:${PORT}/api/test`);
  console.log(`🔌 WebSocket 状态: http://localhost:${PORT}/api/websocket-status`);
});

// 优雅关闭处理
process.on('SIGINT', () => {
  console.log('\n🛑 收到 SIGINT 信号，正在优雅关闭...');

  // 关闭 WebSocket 连接
  cvdManager.closeAll();

  // 关闭 HTTP 服务器
  server.close(() => {
    console.log('✅ 服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 收到 SIGTERM 信号，正在优雅关闭...');

  // 关闭 WebSocket 连接
  cvdManager.closeAll();

  // 关闭 HTTP 服务器
  server.close(() => {
    console.log('✅ 服务器已关闭');
    process.exit(0);
  });
});
