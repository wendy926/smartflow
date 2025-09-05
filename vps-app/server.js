const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const axios = require('axios');
const { SMA, VWAP, ATR } = require('technicalindicators');
const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();

// 加载环境变量（如果dotenv可用）
try {
  require('dotenv').config();
} catch (error) {
  console.log('dotenv未安装，使用系统环境变量');
}

const app = express();
const PORT = process.env.PORT || 8080;

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

// Telegram 通知管理
class TelegramNotifier {
  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_CHAT_ID;
    this.enabled = !!(this.botToken && this.chatId);
    this.lastSignals = new Map(); // 记录上次的信号状态
    this.lastExecutions = new Map(); // 记录上次的入场执行状态
  }

  async sendMessage(message) {
    if (!this.enabled) {
      console.log('Telegram通知未配置，跳过发送:', message);
      return;
    }

    try {
      const response = await axios.post(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        chat_id: this.chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: false
      });

      if (response.data.ok) {
        console.log('Telegram消息发送成功');
      } else {
        console.error('Telegram消息发送失败:', response.data);
      }
    } catch (error) {
      console.error('Telegram API调用失败:', error.message);
    }
  }

  formatSignalMessage(symbol, signalData, executionData, keyReasons) {
    const signalChange = this.getSignalChange(symbol, signalData);
    const executionChange = this.getExecutionChange(symbol, executionData);

    if (!signalChange && !executionChange) {
      return null; // 没有变化，不发送消息
    }

    let message = `🚨 <b>SmartFlow 交易信号提醒</b>\n\n`;
    message += `📊 <b>交易对：</b>${symbol}\n\n`;

    if (signalChange) {
      message += `📈 <b>信号变化：</b>${signalChange}\n\n`;
    }

    if (executionChange) {
      message += `⚡ <b>入场执行变化：</b>${executionChange}\n\n`;
    }

    if (keyReasons && keyReasons.length > 0) {
      message += `🔍 <b>关键判断依据：</b>\n`;
      keyReasons.forEach((reason, index) => {
        message += `${index + 1}. ${reason}\n`;
      });
      message += `\n`;
    }

    message += `🌐 <b>网页链接：</b>https://smartflow-trader.wendy-wang926.workers.dev`;

    return message;
  }

  getSignalChange(symbol, currentSignal) {
    const lastSignal = this.lastSignals.get(symbol);
    this.lastSignals.set(symbol, currentSignal);

    if (!lastSignal) {
      return currentSignal ? `新信号: ${currentSignal}` : null;
    }

    if (lastSignal !== currentSignal) {
      return `从 "${lastSignal}" 变为 "${currentSignal || '无信号'}"`;
    }

    return null;
  }

  getExecutionChange(symbol, currentExecution) {
    const lastExecution = this.lastExecutions.get(symbol);
    this.lastExecutions.set(symbol, currentExecution);

    if (!lastExecution) {
      return currentExecution ? `新入场执行: ${currentExecution}` : null;
    }

    if (lastExecution !== currentExecution) {
      return `从 "${lastExecution}" 变为 "${currentExecution || '无执行'}"`;
    }

    return null;
  }

  extractKeyReasons(analysis) {
    const reasons = [];

    if (analysis.dailyTrend) {
      const trend = analysis.dailyTrend;
      if (trend.trend) {
        reasons.push(`日线趋势: ${trend.trend}`);
      }
      if (trend.maAlignment) {
        reasons.push(`MA排列: ${trend.maAlignment}`);
      }
    }

    if (analysis.hourlyConfirmation) {
      const hourly = analysis.hourlyConfirmation;
      if (hourly.signal) {
        reasons.push(`小时确认: ${hourly.signal}`);
      }
      if (hourly.vwapPosition) {
        reasons.push(`VWAP位置: ${hourly.vwapPosition}`);
      }
      if (hourly.volumeAnalysis) {
        reasons.push(`成交量分析: ${hourly.volumeAnalysis}`);
      }
    }

    if (analysis.execution) {
      const exec = analysis.execution;
      if (exec.execution) {
        reasons.push(`15分钟执行: ${exec.execution}`);
      }
      if (exec.atrAnalysis) {
        reasons.push(`ATR分析: ${exec.atrAnalysis}`);
      }
    }

    return reasons.slice(0, 5); // 最多返回5个关键原因
  }

  async checkAndNotify(symbol, analysis) {
    if (!this.enabled) return;

    const signalData = analysis.hourlyConfirmation?.signal;
    const executionData = analysis.execution?.execution;
    const keyReasons = this.extractKeyReasons(analysis);

    const message = this.formatSignalMessage(symbol, signalData, executionData, keyReasons);

    if (message) {
      await this.sendMessage(message);
    }
  }
}

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
    if (!data) {
      return { cvd: 0, direction: 'N/A', isActive: false };
    }

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

  // 添加新的交易对连接
  addSymbol(symbol) {
    if (!this.symbols.includes(symbol)) {
      this.symbols.push(symbol);
      this.connectSymbol(symbol);
      console.log(`➕ 添加新的交易对连接: ${symbol}`);
    }
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

// 数据缓存管理
class DataCache {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30秒缓存过期
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > this.cacheTimeout) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  set(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clear() {
    this.cache.clear();
  }
}

// API 调用限制管理
class APIRateLimiter {
  constructor() {
    this.requests = [];
    this.maxRequestsPerMinute = 1200; // Binance 限制
    this.maxRequestsPerSecond = 10;   // 保守限制
    this.dataCache = new DataCache();
  }

  async waitForSlot() {
    const now = Date.now();

    // 清理1分钟前的请求记录
    this.requests = this.requests.filter(time => now - time < 60000);

    // 检查每分钟限制
    if (this.requests.length >= this.maxRequestsPerMinute) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = 60000 - (now - oldestRequest);
      if (waitTime > 0) {
        console.log(`⏳ API 限制：等待 ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    // 检查每秒限制
    const recentRequests = this.requests.filter(time => now - time < 1000);
    if (recentRequests.length >= this.maxRequestsPerSecond) {
      const waitTime = 1000 - (now - Math.min(...recentRequests));
      if (waitTime > 0) {
        console.log(`⏳ 每秒限制：等待 ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    // 记录当前请求
    this.requests.push(now);
  }

  // 带缓存的 API 调用
  async cachedCall(cacheKey, apiCall) {
    // 先检查缓存
    const cached = this.dataCache.get(cacheKey);
    if (cached) {
      console.log(`📦 使用缓存数据: ${cacheKey}`);
      return cached;
    }

    // 等待 API 调用槽位
    await this.waitForSlot();

    // 执行 API 调用
    const data = await apiCall();

    // 缓存结果
    this.dataCache.set(cacheKey, data);

    return data;
  }
}

// Binance API 数据获取
class BinanceAPI {
  static BASE_URL = 'https://fapi.binance.com';
  static rateLimiter = new APIRateLimiter();

  static async getKlines(symbol, interval, limit = 500) {
    try {
      const cacheKey = `klines_${symbol}_${interval}_${limit}`;
      return await this.rateLimiter.cachedCall(cacheKey, async () => {
        const response = await axios.get(`${this.BASE_URL}/fapi/v1/klines`, {
          params: { symbol, interval, limit },
          timeout: 10000
        });
        return response.data;
      });
    } catch (error) {
      console.error(`[BinanceAPI] K线数据获取失败: ${error.message}`);
      throw error;
    }
  }

  static async getFundingRate(symbol) {
    try {
      const cacheKey = `funding_${symbol}`;
      return await this.rateLimiter.cachedCall(cacheKey, async () => {
        const response = await axios.get(`${this.BASE_URL}/fapi/v1/premiumIndex`, {
          params: { symbol },
          timeout: 10000
        });
        return response.data;
      });
    } catch (error) {
      console.error(`[BinanceAPI] 资金费率获取失败: ${error.message}`);
      throw error;
    }
  }

  static async getOpenInterest(symbol) {
    try {
      const cacheKey = `oi_${symbol}`;
      return await this.rateLimiter.cachedCall(cacheKey, async () => {
        const response = await axios.get(`${this.BASE_URL}/fapi/v1/openInterest`, {
          params: { symbol },
          timeout: 10000
        });
        return response.data;
      });
    } catch (error) {
      console.error(`[BinanceAPI] 持仓量获取失败: ${error.message}`);
      throw error;
    }
  }

  static async get24hrTicker(symbol) {
    try {
      const cacheKey = `ticker_${symbol}`;
      return await this.rateLimiter.cachedCall(cacheKey, async () => {
        const response = await axios.get(`${this.BASE_URL}/fapi/v1/ticker/24hr`, {
          params: { symbol },
          timeout: 10000
        });
        return response.data;
      });
    } catch (error) {
      console.error(`[BinanceAPI] 24小时价格获取失败: ${error.message}`);
      throw error;
    }
  }

  static async getOpenInterestHist(symbol, period = '1h', limit = 24) {
    try {
      const cacheKey = `oi_hist_${symbol}_${period}_${limit}`;
      return await this.rateLimiter.cachedCall(cacheKey, async () => {
        const response = await axios.get(`${this.BASE_URL}/futures/data/openInterestHist`, {
          params: { symbol, period, limit },
          timeout: 10000
        });
        return response.data.map(d => ({
          time: d.timestamp,
          oi: parseFloat(d.sumOpenInterest)
        }));
      });
    } catch (error) {
      console.error(`[BinanceAPI] 持仓量历史获取失败: ${error.message}`);
      throw error;
    }
  }
}

// 数据库管理
class DatabaseManager {
  constructor() {
    this.db = new sqlite3.Database('./smartflow.db');
    this.initTables();
  }

  initTables() {
    // 创建信号记录表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS signal_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        signal_time DATETIME NOT NULL,
        trend TEXT NOT NULL,
        signal TEXT NOT NULL,
        current_price REAL NOT NULL,
        vwap REAL,
        volume_ratio REAL,
        oi_change REAL,
        funding_rate REAL,
        cvd_direction TEXT,
        raw_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建入场执行记录表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS execution_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        execution_time DATETIME NOT NULL,
        trend TEXT NOT NULL,
        signal TEXT NOT NULL,
        execution TEXT NOT NULL,
        current_price REAL NOT NULL,
        vwap REAL,
        volume_ratio REAL,
        oi_change REAL,
        funding_rate REAL,
        cvd_direction TEXT,
        stop_price REAL,
        target_price REAL,
        max_leverage INTEGER,
        min_margin REAL,
        risk_reward_ratio REAL,
        raw_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建标记结果表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS result_markers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id INTEGER NOT NULL,
        record_type TEXT NOT NULL,
        symbol TEXT NOT NULL,
        marker_result TEXT NOT NULL,
        marker_notes TEXT,
        marked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (record_id) REFERENCES signal_records(id) ON DELETE CASCADE
      )
    `);

    console.log('📊 数据库表初始化完成');
  }

  // 记录信号
  recordSignal(symbol, signalData) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO signal_records 
        (symbol, signal_time, trend, signal, current_price, vwap, volume_ratio, 
         oi_change, funding_rate, cvd_direction, raw_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run([
        symbol,
        new Date().toISOString(),
        signalData.trend,
        signalData.signal,
        signalData.currentPrice,
        signalData.vwap || null,
        signalData.volumeRatio || null,
        signalData.oiChange || null,
        signalData.fundingRate || null,
        signalData.cvdDirection || null,
        JSON.stringify(signalData.rawData || {})
      ], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });

      stmt.finalize();
    });
  }

  // 记录入场执行
  recordExecution(symbol, executionData) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO execution_records 
        (symbol, execution_time, trend, signal, execution, current_price, vwap, 
         volume_ratio, oi_change, funding_rate, cvd_direction, stop_price, 
         target_price, max_leverage, min_margin, risk_reward_ratio, raw_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run([
        symbol,
        new Date().toISOString(),
        executionData.trend,
        executionData.signal,
        executionData.execution,
        executionData.currentPrice,
        executionData.vwap || null,
        executionData.volumeRatio || null,
        executionData.oiChange || null,
        executionData.fundingRate || null,
        executionData.cvdDirection || null,
        executionData.stopPrice || null,
        executionData.targetPrice || null,
        executionData.maxLeverage || null,
        executionData.minMargin || null,
        executionData.riskRewardRatio || null,
        JSON.stringify(executionData.rawData || {})
      ], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });

      stmt.finalize();
    });
  }

  // 标记结果
  markResult(recordId, recordType, symbol, result, notes = '') {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO result_markers 
        (record_id, record_type, symbol, marker_result, marker_notes)
        VALUES (?, ?, ?, ?, ?)
      `);

      stmt.run([recordId, recordType, symbol, result, notes], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });

      stmt.finalize();
    });
  }

  // 获取历史记录
  getHistoryRecords(symbol = null, limit = 100) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT 
          s.id, s.symbol, s.signal_time, s.trend, s.signal, s.current_price,
          s.vwap, s.volume_ratio, s.oi_change, s.funding_rate, s.cvd_direction,
          e.execution_time, e.execution, e.stop_price, e.target_price,
          e.max_leverage, e.min_margin, e.risk_reward_ratio,
          m.marker_result, m.marker_notes
        FROM signal_records s
        LEFT JOIN execution_records e ON s.symbol = e.symbol AND s.signal_time = e.execution_time
        LEFT JOIN result_markers m ON s.id = m.record_id
        ${symbol ? 'WHERE s.symbol = ?' : ''}
        ORDER BY s.signal_time DESC
        LIMIT ?
      `;

      const params = symbol ? [symbol, limit] : [limit];

      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  close() {
    this.db.close();
  }
}

// 数据监控管理
class DataMonitor {
  constructor() {
    this.analysisLogs = new Map();
  }

  startAnalysis(symbol) {
    this.analysisLogs.set(symbol, {
      startTime: Date.now(),
      rawData: {},
      indicators: {},
      errors: [],
      success: true
    });
  }

  recordRawData(symbol, dataType, data, success = true, error = null) {
    const log = this.analysisLogs.get(symbol);
    if (log) {
      log.rawData[dataType] = {
        data: success ? data : null,
        success,
        error: error ? error.message : null,
        timestamp: Date.now()
      };
      if (!success) {
        log.errors.push(`${dataType}: ${error ? error.message : '未知错误'}`);
        log.success = false;
      }
    }
  }

  recordIndicator(symbol, indicatorType, data, calculationTime) {
    const log = this.analysisLogs.get(symbol);
    if (log) {
      log.indicators[indicatorType] = {
        data,
        calculationTime,
        timestamp: Date.now()
      };
    }
  }

  getAnalysisLog(symbol) {
    const log = this.analysisLogs.get(symbol);
    if (!log) return null;

    const endTime = Date.now();
    const totalTime = endTime - log.startTime;

    return {
      symbol,
      totalTime,
      rawData: log.rawData,
      indicators: log.indicators,
      errors: log.errors,
      success: log.success,
      startTime: new Date(log.startTime).toISOString(),
      endTime: new Date(endTime).toISOString()
    };
  }

  clearOldLogs() {
    const now = Date.now();
    for (const [symbol, log] of this.analysisLogs.entries()) {
      if (now - log.startTime > 300000) { // 5分钟
        this.analysisLogs.delete(symbol);
      }
    }
  }
}

// 交易策略
class SmartFlowStrategy {
  static dataMonitor = new DataMonitor();

  static async analyzeDailyTrend(symbol) {
    try {
      const klines = await BinanceAPI.getKlines(symbol, '1d', 250);
      if (!klines || klines.length < 200) {
        this.dataMonitor.recordRawData(symbol, '日线K线', null, false, new Error('日线数据不足'));
        throw new Error('日线数据不足');
      }

      this.dataMonitor.recordRawData(symbol, '日线K线', klines, true);

      const closes = klines.map(k => parseFloat(k[4]));
      const indicatorStart = Date.now();
      const sma20 = TechnicalIndicators.calculateSMA(closes, 20);
      const sma50 = TechnicalIndicators.calculateSMA(closes, 50);
      const sma200 = TechnicalIndicators.calculateSMA(closes, 200);
      const indicatorTime = Date.now() - indicatorStart;

      this.dataMonitor.recordIndicator(symbol, '日线MA指标', { sma20, sma50, sma200 }, indicatorTime);

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
        this.dataMonitor.recordRawData(symbol, '小时线K线', null, false, new Error('小时数据不足'));
        throw new Error('小时数据不足');
      }

      this.dataMonitor.recordRawData(symbol, '小时线K线', klines, true);

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
        this.dataMonitor.recordRawData(symbol, '持仓量历史', null, false, new Error('OI历史数据不足'));
        throw new Error('OI历史数据不足');
      }

      this.dataMonitor.recordRawData(symbol, '持仓量历史', oiHist, true);
      const oiChange = (oiHist[oiHist.length - 1].oi - oiHist[0].oi) / oiHist[0].oi * 100;

      // 获取资金费率
      const fundingRate = await BinanceAPI.getFundingRate(symbol);
      if (!fundingRate || !fundingRate.lastFundingRate) {
        this.dataMonitor.recordRawData(symbol, '资金费率', null, false, new Error('资金费率数据获取失败'));
        throw new Error('资金费率数据获取失败');
      }

      this.dataMonitor.recordRawData(symbol, '资金费率', fundingRate, true);
      const fundingRateValue = parseFloat(fundingRate.lastFundingRate);

      // 获取 CVD 数据
      const cvdData = cvdManager.getCVD(symbol);
      if (!cvdData.isActive) {
        this.dataMonitor.recordRawData(symbol, 'CVD数据', null, false, new Error('CVD数据不可用'));
        throw new Error('CVD数据不可用');
      }

      this.dataMonitor.recordRawData(symbol, 'CVD数据', cvdData, true);

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
        this.dataMonitor.recordRawData(symbol, '15分钟K线', null, false, new Error('15分钟数据不足'));
        throw new Error('15分钟数据不足');
      }

      this.dataMonitor.recordRawData(symbol, '15分钟K线', klines, true);

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
      const startTime = Date.now();
      console.log(`⏱️ 开始分析 ${symbol}，时间: ${new Date().toISOString()}`);

      // 开始数据监控
      this.dataMonitor.startAnalysis(symbol);

      const [dailyTrend, hourlyConfirmation, execution15m, ticker24hr] = await Promise.all([
        this.analyzeDailyTrend(symbol),
        this.analyzeHourlyConfirmation(symbol),
        this.analyze15mExecution(symbol),
        BinanceAPI.get24hrTicker(symbol)
      ]);

      // 记录24小时价格数据
      if (ticker24hr) {
        this.dataMonitor.recordRawData(symbol, '24小时价格', ticker24hr, true);
      } else {
        this.dataMonitor.recordRawData(symbol, '24小时价格', null, false, new Error('24小时价格数据获取失败'));
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      console.log(`✅ ${symbol} 分析完成，耗时: ${duration}ms`);

      // 检查数据获取时间是否超过30秒
      if (duration > 30000) {
        console.warn(`⚠️ ${symbol} 数据获取耗时过长: ${duration}ms`);
      }

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

      const result = {
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

      // 记录历史数据
      try {
        // 如果有信号，记录信号数据
        if (signal !== 'NO_SIGNAL') {
          const signalData = {
            trend: trend,
            signal: signal,
            currentPrice: currentPrice,
            vwap: hourlyConfirmation.vwap,
            volumeRatio: hourlyConfirmation.volumeRatio,
            oiChange: hourlyConfirmation.oiChange,
            fundingRate: hourlyConfirmation.fundingRate,
            cvdDirection: hourlyConfirmation.cvd.direction,
            rawData: {
              dailyTrend,
              hourlyConfirmation,
              ticker24hr
            }
          };
          await dbManager.recordSignal(symbol, signalData);
        }

        // 如果有入场执行，记录执行数据
        if (execution !== 'NO_SIGNAL') {
          const executionData = {
            trend: trend,
            signal: signal,
            execution: execution,
            currentPrice: currentPrice,
            vwap: hourlyConfirmation.vwap,
            volumeRatio: hourlyConfirmation.volumeRatio,
            oiChange: hourlyConfirmation.oiChange,
            fundingRate: hourlyConfirmation.fundingRate,
            cvdDirection: hourlyConfirmation.cvd.direction,
            stopPrice: stopLoss,
            targetPrice: targetPrice,
            maxLeverage: maxLeverage,
            minMargin: minMargin,
            riskRewardRatio: signal !== 'NO_SIGNAL' ? 2 : 0,
            rawData: {
              dailyTrend,
              hourlyConfirmation,
              execution15m,
              ticker24hr
            }
          };
          await dbManager.recordExecution(symbol, executionData);
        }
      } catch (dbError) {
        console.error(`[Database] 记录历史数据失败 ${symbol}:`, dbError.message);
        // 数据库错误不影响主要功能
      }

      // 发送Telegram通知
      try {
        const analysis = {
          dailyTrend,
          hourlyConfirmation,
          execution: execution15m
        };
        await telegramNotifier.checkAndNotify(symbol, analysis);
      } catch (telegramError) {
        console.error(`[Telegram] 通知发送失败 ${symbol}:`, telegramError.message);
        // Telegram错误不影响主要功能
      }

      return result;
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

// 初始化 CVD 管理器
const cvdManager = new CVDManager();
cvdManager.start();
const telegramNotifier = new TelegramNotifier();

// 初始化数据库
const dbManager = new DatabaseManager();

// 定时刷新数据 (每5分钟)
setInterval(() => {
  console.log('🔄 定时刷新数据缓存...');
  BinanceAPI.rateLimiter.dataCache.clear();
}, 5 * 60 * 1000); // 5分钟

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

// 历史记录API
app.get('/api/history/:symbol?', async (req, res) => {
  try {
    const { symbol } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const records = await dbManager.getHistoryRecords(symbol, limit);

    res.json({
      success: true,
      data: records,
      count: records.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '获取历史记录失败',
      message: error.message
    });
  }
});

// 标记结果API
app.post('/api/mark-result', async (req, res) => {
  try {
    const { recordId, recordType, symbol, result, notes } = req.body;

    if (!recordId || !recordType || !symbol || !result) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }

    await dbManager.markResult(recordId, recordType, symbol, result, notes);

    res.json({
      success: true,
      message: '标记成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '标记失败',
      message: error.message
    });
  }
});

// 数据监控状态API
app.get('/api/data-monitor', (req, res) => {
  try {
    const allLogs = [];
    for (const [symbol, log] of SmartFlowStrategy.dataMonitor.analysisLogs.entries()) {
      allLogs.push(SmartFlowStrategy.dataMonitor.getAnalysisLog(symbol));
    }

    // 计算总体成功率
    const totalAnalyses = allLogs.length;
    const successfulAnalyses = allLogs.filter(log => log.success).length;
    const overallSuccessRate = totalAnalyses > 0 ? (successfulAnalyses / totalAnalyses * 100).toFixed(2) : 100;

    // 统计原始数据成功率
    const rawDataStats = {};
    allLogs.forEach(log => {
      Object.entries(log.rawData).forEach(([dataType, data]) => {
        if (!rawDataStats[dataType]) {
          rawDataStats[dataType] = { total: 0, success: 0, failures: [] };
        }
        rawDataStats[dataType].total++;
        if (data.success) {
          rawDataStats[dataType].success++;
        } else {
          rawDataStats[dataType].failures.push({
            symbol: log.symbol,
            error: data.error,
            timestamp: new Date(data.timestamp).toISOString()
          });
        }
      });
    });

    // 计算各数据类型成功率
    Object.keys(rawDataStats).forEach(dataType => {
      const stats = rawDataStats[dataType];
      stats.successRate = stats.total > 0 ? (stats.success / stats.total * 100).toFixed(2) : 100;
    });

    res.json({
      timestamp: new Date().toISOString(),
      overall: {
        totalAnalyses,
        successfulAnalyses,
        successRate: overallSuccessRate,
        isHealthy: overallSuccessRate >= 100
      },
      rawDataStats,
      recentLogs: allLogs.sort((a, b) => b.startTime.localeCompare(a.startTime)).slice(0, 10)
    });
  } catch (error) {
    res.status(500).json({
      error: '获取监控数据失败',
      message: error.message
    });
  }
});

// Telegram配置API
app.get('/api/telegram-status', (req, res) => {
  try {
    const debugInfo = {
      enabled: telegramNotifier.enabled,
      configured: !!(telegramNotifier.botToken && telegramNotifier.chatId),
      hasToken: !!telegramNotifier.botToken,
      hasChatId: !!telegramNotifier.chatId,
      debug: {
        botTokenLength: telegramNotifier.botToken ? telegramNotifier.botToken.length : 0,
        chatIdValue: telegramNotifier.chatId,
        envBotToken: process.env.TELEGRAM_BOT_TOKEN ? 'set' : 'not set',
        envChatId: process.env.TELEGRAM_CHAT_ID ? 'set' : 'not set',
        nodeEnv: process.env.NODE_ENV || 'undefined'
      }
    };

    console.log('Telegram状态调试信息:', debugInfo);
    res.json(debugInfo);
  } catch (error) {
    console.error('Telegram状态API错误:', error);
    res.status(500).json({ error: 'Telegram状态获取失败' });
  }
});

// 测试Telegram通知
app.post('/api/test-telegram', async (req, res) => {
  try {
    if (!telegramNotifier.enabled) {
      return res.status(400).json({ error: 'Telegram未配置' });
    }

    const testMessage = `🧪 <b>SmartFlow 测试消息</b>\n\n📊 <b>交易对：</b>BTCUSDT\n📈 <b>信号变化：</b>测试信号\n⚡ <b>入场执行变化：</b>测试执行\n🔍 <b>关键判断依据：</b>\n1. 这是一个测试消息\n2. 如果您收到此消息，说明Telegram通知配置成功\n\n🌐 <b>网页链接：</b>https://smartflow-trader.wendy-wang926.workers.dev`;

    await telegramNotifier.sendMessage(testMessage);
    res.json({ success: true, message: '测试消息已发送' });
  } catch (error) {
    console.error('Telegram测试API错误:', error);
    res.status(500).json({ error: 'Telegram测试失败: ' + error.message });
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

    // 预先添加交易对到 CVD 连接
    cvdManager.addSymbol(symbol);

    // 等待 WebSocket 连接建立并收集数据
    console.log(`⏳ 等待 ${symbol} WebSocket 连接建立...`);
    await new Promise(resolve => setTimeout(resolve, 5000)); // 增加等待时间到5秒

    // 检查 CVD 连接状态
    const cvdStatus = cvdManager.getCVD(symbol);
    if (!cvdStatus.isActive) {
      console.warn(`⚠️ ${symbol} CVD 连接未建立，继续分析但可能缺少 CVD 数据`);
    } else {
      console.log(`✅ ${symbol} CVD 连接已建立`);
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

// 检查特定交易对的 CVD 状态
app.get('/api/cvd-status/:symbol', (req, res) => {
  try {
    const { symbol } = req.params;
    const cvdData = cvdManager.getCVD(symbol);
    const ws = cvdManager.connections.get(symbol);

    res.json({
      symbol,
      cvd: cvdData,
      websocketConnected: ws && ws.readyState === WebSocket.OPEN,
      websocketState: ws ? ws.readyState : -1,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API 限制状态监控
app.get('/api/rate-limit-status', (req, res) => {
  try {
    const now = Date.now();
    const recentRequests = BinanceAPI.rateLimiter.requests.filter(time => now - time < 60000);
    const cacheSize = BinanceAPI.rateLimiter.dataCache.cache.size;

    res.json({
      timestamp: new Date().toISOString(),
      rateLimit: {
        requestsLastMinute: recentRequests.length,
        maxRequestsPerMinute: BinanceAPI.rateLimiter.maxRequestsPerMinute,
        maxRequestsPerSecond: BinanceAPI.rateLimiter.maxRequestsPerSecond,
        cacheSize: cacheSize
      },
      cache: {
        size: cacheSize,
        timeout: BinanceAPI.rateLimiter.dataCache.cacheTimeout
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
