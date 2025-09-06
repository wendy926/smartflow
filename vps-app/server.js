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

    message += `🌐 <b>网页链接：</b>https://smart.aimaventop.com`;

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

  // 删除交易对连接
  removeSymbol(symbol) {
    const index = this.symbols.indexOf(symbol);
    if (index > -1) {
      this.symbols.splice(index, 1);

      // 关闭WebSocket连接
      const ws = this.connections.get(symbol);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
        console.log(`🔌 关闭 ${symbol} WebSocket 连接`);
      }

      // 移除连接和数据
      this.connections.delete(symbol);
      this.cvdData.delete(symbol);

      console.log(`➖ 删除交易对连接: ${symbol}`);
      return true;
    }
    return false;
  }

  // 检查连接是否已建立
  isConnected(symbol) {
    const ws = this.connections.get(symbol);
    return ws && ws.readyState === WebSocket.OPEN;
  }

  // 等待连接建立
  async waitForConnection(symbol, timeout = 15000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (this.isConnected(symbol)) {
        console.log(`✅ ${symbol} WebSocket 连接已建立`);
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.warn(`⚠️ ${symbol} WebSocket 连接超时`);
    return false;
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

// 智能API限速管理器
class SmartAPIRateLimiter {
  constructor() {
    this.requests = [];
    this.dataCache = new DataCache();

    // Binance官方限速规则
    this.limits = {
      // REST API限制
      rest: {
        requestsPerMinute: 100,        // IP限制：每分钟100个请求
        weightPerMinute: 2400,         // 权重限制：每分钟2400个权重
        ordersPer10Seconds: 300,       // 订单限制：每10秒300个订单
        ordersPerMinute: 1200          // 订单限制：每分钟1200个订单
      },
      // WebSocket限制
      websocket: {
        maxConnections: 5,             // 最大连接数
        heartbeatInterval: 180000,     // 心跳间隔：3分钟
        connectionTimeout: 600000      // 连接超时：10分钟
      }
    };

    // 请求权重映射（根据Binance文档）
    this.requestWeights = {
      'klines': 1,                    // K线数据
      'ticker/24hr': 1,               // 24小时价格
      'premiumIndex': 1,              // 资金费率
      'openInterest': 1,              // 持仓量
      'openInterestHist': 1,          // 持仓量历史
      'ticker/price': 1               // 实时价格
    };

    // 请求队列管理
    this.requestQueue = [];
    this.processing = false;
    this.symbolPriorities = new Map(); // 交易对优先级
  }

  // 设置交易对优先级
  setSymbolPriority(symbol, priority = 1) {
    this.symbolPriorities.set(symbol, priority);
  }

  // 获取交易对优先级
  getSymbolPriority(symbol) {
    return this.symbolPriorities.get(symbol) || 1;
  }

  // 计算请求权重
  getRequestWeight(endpoint) {
    return this.requestWeights[endpoint] || 1;
  }

  // 检查限速状态
  checkRateLimit() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const tenSecondsAgo = now - 10000;

    // 清理过期请求记录
    this.requests = this.requests.filter(req => req.timestamp > oneMinuteAgo);

    const recentRequests = this.requests.filter(req => req.timestamp > oneMinuteAgo);
    const recentWeight = recentRequests.reduce((sum, req) => sum + req.weight, 0);
    const tenSecondRequests = this.requests.filter(req => req.timestamp > tenSecondsAgo);

    return {
      requestsPerMinute: recentRequests.length,
      weightPerMinute: recentWeight,
      requestsPer10Seconds: tenSecondRequests.length,
      canMakeRequest: recentRequests.length < this.limits.rest.requestsPerMinute &&
        recentWeight < this.limits.rest.weightPerMinute &&
        tenSecondRequests.length < this.limits.rest.ordersPer10Seconds
    };
  }

  // 智能等待策略
  async waitForSlot(endpoint, symbol) {
    const weight = this.getRequestWeight(endpoint);
    const priority = this.getSymbolPriority(symbol);

    while (true) {
      const rateLimitStatus = this.checkRateLimit();

      if (rateLimitStatus.canMakeRequest) {
        // 记录请求
        this.requests.push({
          timestamp: Date.now(),
          weight: weight,
          symbol: symbol,
          endpoint: endpoint,
          priority: priority
        });
        return;
      }

      // 计算等待时间
      const now = Date.now();
      const oldestRequest = Math.min(...this.requests.map(req => req.timestamp));
      const waitTime = Math.max(
        60000 - (now - oldestRequest), // 每分钟限制
        1000 - (now - Math.min(...this.requests.filter(req => req.timestamp > now - 1000).map(req => req.timestamp))) // 每10秒限制
      );

      if (waitTime > 0) {
        console.log(`⏳ 限速等待: ${waitTime}ms (${symbol} - ${endpoint})`);
        await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 5000))); // 最多等待5秒
      }
    }
  }

  // 交易对数据获取队列
  async queueSymbolData(symbol, dataTypes) {
    const symbolKey = `${symbol}_${Date.now()}`;
    const priority = this.getSymbolPriority(symbol);

    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        symbol,
        dataTypes,
        priority,
        timestamp: Date.now(),
        resolve,
        reject,
        key: symbolKey
      });

      // 按优先级排序队列
      this.requestQueue.sort((a, b) => b.priority - a.priority);

      // 启动队列处理
      this.processQueue();
    });
  }

  // 处理请求队列
  async processQueue() {
    if (this.processing || this.requestQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();

      try {
        const results = {};

        // 为每个数据类型获取数据
        for (const dataType of request.dataTypes) {
          const cacheKey = `${request.symbol}_${dataType}_${Date.now()}`;
          const endpoint = this.getEndpointForDataType(dataType);

          // 等待限速槽位
          await this.waitForSlot(endpoint, request.symbol);

          // 获取数据
          const data = await this.fetchDataForType(request.symbol, dataType);
          results[dataType] = data;

          // 缓存数据
          this.dataCache.set(cacheKey, data);
        }

        request.resolve(results);
      } catch (error) {
        request.reject(error);
      }

      // 处理间隔，避免过于频繁
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.processing = false;
  }

  // 获取数据类型对应的API端点
  getEndpointForDataType(dataType) {
    const endpointMap = {
      'klines': 'klines',
      'ticker': 'ticker/24hr',
      'funding': 'premiumIndex',
      'openInterest': 'openInterest',
      'openInterestHist': 'openInterestHist',
      'price': 'ticker/price'
    };
    return endpointMap[dataType] || 'klines';
  }

  // 为特定类型获取数据
  async fetchDataForType(symbol, dataType) {
    const endpoint = this.getEndpointForDataType(dataType);
    const weight = this.getRequestWeight(endpoint);

    // 这里需要调用实际的API获取方法
    // 具体实现将在BinanceAPI类中完成
    return await this.callBinanceAPI(symbol, endpoint);
  }

  // 调用Binance API
  async callBinanceAPI(symbol, endpoint) {
    // 这个方法将在BinanceAPI类中实现
    throw new Error('需要在BinanceAPI类中实现');
  }

  // 带缓存的 API 调用（保持向后兼容）
  async cachedCall(cacheKey, apiCall, endpoint = 'klines', symbol = 'UNKNOWN') {
    // 先检查缓存
    const cached = this.dataCache.get(cacheKey);
    if (cached) {
      console.log(`📦 使用缓存数据: ${cacheKey}`);
      return cached;
    }

    // 等待 API 调用槽位
    await this.waitForSlot(endpoint, symbol);

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
  static rateLimiter = new SmartAPIRateLimiter();

  static async getKlines(symbol, interval, limit = 500) {
    try {
      const cacheKey = `klines_${symbol}_${interval}_${limit}`;
      return await this.rateLimiter.cachedCall(cacheKey, async () => {
        const response = await axios.get(`${this.BASE_URL}/fapi/v1/klines`, {
          params: { symbol, interval, limit },
          timeout: 10000
        });
        return response.data;
      }, 'klines', symbol);
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
      }, 'premiumIndex', symbol);
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
      }, 'openInterest', symbol);
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
      }, 'ticker/24hr', symbol);
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
      }, 'openInterestHist', symbol);
    } catch (error) {
      console.error(`[BinanceAPI] 持仓量历史获取失败: ${error.message}`);
      throw error;
    }
  }
}

// 模拟交易管理器
class SimulationManager {
  constructor(db) {
    this.db = db;
    this.activeSimulations = new Map(); // 存储活跃的模拟交易
    this.priceCheckInterval = null;
    this.startPriceMonitoring();
  }

  // 开始价格监控
  startPriceMonitoring() {
    // 每30秒检查一次价格
    this.priceCheckInterval = setInterval(() => {
      this.checkActiveSimulations();
    }, 30000);
  }

  // 检查活跃的模拟交易
  async checkActiveSimulations() {
    if (this.activeSimulations.size === 0) return;

    for (const [simulationId, simulation] of this.activeSimulations) {
      try {
        // 获取当前价格
        const currentPrice = await this.getCurrentPrice(simulation.symbol);
        if (!currentPrice) continue;

        // 检查是否触发止损或止盈
        const exitReason = this.checkExitConditions(simulation, currentPrice);

        if (exitReason) {
          await this.closeSimulation(simulationId, currentPrice, exitReason);
        }
      } catch (error) {
        console.error(`检查模拟交易失败 ${simulation.symbol}:`, error.message);
      }
    }
  }

  // 获取当前价格
  async getCurrentPrice(symbol) {
    try {
      const response = await axios.get(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`);
      return parseFloat(response.data.price);
    } catch (error) {
      console.error(`获取价格失败 ${symbol}:`, error.message);
      return null;
    }
  }

  // 检查退出条件
  checkExitConditions(simulation, currentPrice) {
    const { entryPrice, stopLossPrice, takeProfitPrice } = simulation;

    // 检查止损
    if (currentPrice <= stopLossPrice) {
      return 'STOP_LOSS';
    }

    // 检查止盈
    if (currentPrice >= takeProfitPrice) {
      return 'TAKE_PROFIT';
    }

    return null;
  }

  // 关闭模拟交易
  async closeSimulation(simulationId, exitPrice, exitReason) {
    const simulation = this.activeSimulations.get(simulationId);
    if (!simulation) return;

    const isWin = exitReason === 'TAKE_PROFIT';
    const profitLoss = this.calculateProfitLoss(simulation, exitPrice);

    // 更新数据库
    await this.updateSimulationInDB(simulationId, exitPrice, exitReason, isWin, profitLoss);

    // 从活跃列表中移除
    this.activeSimulations.delete(simulationId);

    // 更新胜率统计
    await this.updateWinRateStats();

    console.log(`模拟交易结束 ${simulation.symbol}: ${exitReason}, 盈亏: ${profitLoss.toFixed(2)}`);
  }

  // 计算盈亏
  calculateProfitLoss(simulation, exitPrice) {
    const { entryPrice, maxLeverage } = simulation;
    const priceChange = (exitPrice - entryPrice) / entryPrice;
    return priceChange * maxLeverage * 100; // 假设100 USDT本金
  }

  // 更新数据库中的模拟交易
  updateSimulationInDB(simulationId, exitPrice, exitReason, isWin, profitLoss) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        UPDATE simulations 
        SET exit_time = ?, exit_price = ?, exit_reason = ?, is_win = ?, profit_loss = ?
        WHERE id = ?
      `);

      stmt.run([
        new Date().toISOString(),
        exitPrice,
        exitReason,
        isWin,
        profitLoss,
        simulationId
      ], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // 更新胜率统计
  async updateWinRateStats() {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT 
          COUNT(*) as total_trades,
          SUM(CASE WHEN is_win = 1 THEN 1 ELSE 0 END) as total_wins
        FROM simulations 
        WHERE exit_time IS NOT NULL
      `, (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        const winRate = row.total_trades > 0 ? (row.total_wins / row.total_trades * 100) : 0;

        this.db.run(`
          UPDATE win_rate_stats 
          SET total_trades = ?, total_wins = ?, win_rate = ?, last_updated = ?
        `, [row.total_trades, row.total_wins, winRate, new Date().toISOString()], (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    });
  }

  // 创建新的模拟交易
  async createSimulation(symbol, entryPrice, stopLossPrice, takeProfitPrice, maxLeverage, minMargin, triggerReason = 'SIGNAL') {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO simulations 
        (symbol, entry_price, stop_loss_price, take_profit_price, max_leverage, min_margin, entry_time, trigger_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run([
        symbol,
        entryPrice,
        stopLossPrice,
        takeProfitPrice,
        maxLeverage,
        minMargin,
        new Date().toISOString(),
        triggerReason
      ], function (err) {
        if (err) {
          reject(err);
        } else {
          const simulationId = this.lastID;
          const simulation = {
            id: simulationId,
            symbol,
            entryPrice,
            stopLossPrice,
            takeProfitPrice,
            maxLeverage,
            minMargin,
            triggerReason
          };

          // 添加到活跃列表
          this.activeSimulations.set(simulationId, simulation);
          resolve(simulationId);
        }
      }.bind(this));
    });
  }

  // 获取胜率统计
  async getWinRateStats() {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM win_rate_stats ORDER BY id DESC LIMIT 1', (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || { total_trades: 0, total_wins: 0, win_rate: 0.0 });
        }
      });
    });
  }

  // 获取模拟交易历史
  async getSimulationHistory(limit = 50) {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM simulations 
        ORDER BY created_at DESC 
        LIMIT ?
      `, [limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  // 清理历史数据（保留最近360天）
  async cleanOldData() {
    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 360);
    const cutoffDate = oneYearAgo.toISOString();

    console.log(`🧹 开始清理360天前的数据，截止日期: ${cutoffDate}`);

    try {
      // 清理信号记录
      await this.cleanTable('signal_records', cutoffDate);

      // 清理执行记录
      await this.cleanTable('execution_records', cutoffDate);

      // 清理模拟交易记录
      await this.cleanTable('simulations', cutoffDate);

      // 清理结果标记
      await this.cleanTable('result_markers', cutoffDate);

      console.log('✅ 历史数据清理完成（保留最近360天）');
    } catch (error) {
      console.error('❌ 清理历史数据失败:', error);
      throw error;
    }
  }

  // 清理指定表的历史数据
  async cleanTable(tableName, cutoffDate) {
    return new Promise((resolve, reject) => {
      this.db.run(`
        DELETE FROM ${tableName} 
        WHERE created_at < ?
      `, [cutoffDate], function (err) {
        if (err) {
          reject(err);
        } else {
          console.log(`🗑️ 清理 ${tableName} 表: 删除了 ${this.changes} 条记录`);
          resolve(this.changes);
        }
      });
    });
  }
}

// 数据库管理
class DatabaseManager {
  constructor() {
    // 使用绝对路径确保数据库文件位置正确
    const dbPath = process.cwd() + '/smartflow.db';
    console.log('📊 数据库路径:', dbPath);
    this.db = new sqlite3.Database(dbPath);
    this.initTables();
  }

  initTables() {
    console.log('📊 开始创建数据库表...');

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
    `, (err) => {
      if (err) console.error('创建signal_records表失败:', err);
    });

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
    `, (err) => {
      if (err) console.error('创建execution_records表失败:', err);
    });

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
    `, (err) => {
      if (err) console.error('创建result_markers表失败:', err);
    });

    // 创建模拟交易表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS simulations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        entry_price REAL NOT NULL,
        stop_loss_price REAL NOT NULL,
        take_profit_price REAL NOT NULL,
        max_leverage INTEGER NOT NULL,
        min_margin REAL NOT NULL,
        entry_time DATETIME NOT NULL,
        exit_time DATETIME,
        exit_price REAL,
        exit_reason TEXT,
        is_win BOOLEAN,
        profit_loss REAL,
        trigger_reason TEXT DEFAULT 'SIGNAL',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) console.error('创建simulations表失败:', err);
    });

    // 创建胜率统计表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS win_rate_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        total_trades INTEGER DEFAULT 0,
        total_wins INTEGER DEFAULT 0,
        win_rate REAL DEFAULT 0.0,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('创建win_rate_stats表失败:', err);
      } else {
        console.log('✅ win_rate_stats表创建成功');
        // 表创建成功后初始化数据
        this.initWinRateStats();
      }
    });

    // 创建交易对管理表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS custom_symbols (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT UNIQUE NOT NULL,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 1
      )
    `, (err) => {
      if (err) {
        console.error('创建custom_symbols表失败:', err);
      } else {
        console.log('✅ custom_symbols表创建成功');
        // 表创建成功后初始化数据
        setTimeout(() => {
          this.initCustomSymbols();
        }, 500);
      }
    });

    console.log('📊 数据库表创建命令已发送');
  }

  // 初始化胜率统计
  initWinRateStats() {
    this.db.get('SELECT COUNT(*) as count FROM win_rate_stats', (err, row) => {
      if (err) {
        console.error('检查胜率统计表失败:', err);
        return;
      }

      if (row.count === 0) {
        this.db.run('INSERT INTO win_rate_stats (total_trades, total_wins, win_rate) VALUES (0, 0, 0.0)', (err) => {
          if (err) {
            console.error('初始化胜率统计失败:', err);
          } else {
            console.log('胜率统计初始化完成');
          }
        });
      }
    });
  }

  // 初始化自定义交易对
  initCustomSymbols() {
    // 检查表是否存在
    this.db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='custom_symbols'", (err, row) => {
      if (err) {
        console.error('检查custom_symbols表失败:', err);
        return;
      }

      if (!row) {
        console.log('📋 custom_symbols表不存在，跳过加载自定义交易对');
        return;
      }

      this.db.all('SELECT symbol FROM custom_symbols WHERE is_active = 1', (err, rows) => {
        if (err) {
          console.error('获取自定义交易对失败:', err);
          return;
        }

        const customSymbols = rows.map(row => row.symbol);
        console.log('📋 加载自定义交易对:', customSymbols);

        // 将自定义交易对添加到CVD管理器
        if (typeof cvdManager !== 'undefined' && cvdManager) {
          customSymbols.forEach(symbol => {
            if (!cvdManager.symbols.includes(symbol)) {
              cvdManager.addSymbol(symbol);
            }
          });
        }
      });
    });
  }

  // 添加自定义交易对
  addCustomSymbol(symbol) {
    return new Promise((resolve, reject) => {
      console.log(`📋 数据库操作: 添加交易对 ${symbol}`);
      this.db.run(
        'INSERT OR REPLACE INTO custom_symbols (symbol, is_active) VALUES (?, 1)',
        [symbol],
        function (err) {
          if (err) {
            console.error(`❌ 添加交易对 ${symbol} 到数据库失败:`, err);
            reject(err);
          } else {
            console.log(`✅ 交易对 ${symbol} 已成功添加到数据库，ID: ${this.lastID}`);
            resolve(this.lastID);
          }
        }
      );
    });
  }

  // 删除自定义交易对
  removeCustomSymbol(symbol) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE custom_symbols SET is_active = 0 WHERE symbol = ?',
        [symbol],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes);
          }
        }
      );
    });
  }

  // 获取所有自定义交易对
  getCustomSymbols() {
    return new Promise((resolve, reject) => {
      console.log('📋 数据库操作: 获取自定义交易对列表');
      this.db.all('SELECT symbol FROM custom_symbols WHERE is_active = 1', (err, rows) => {
        if (err) {
          console.error('❌ 获取自定义交易对失败:', err);
          reject(err);
        } else {
          const symbols = rows.map(row => row.symbol);
          console.log(`✅ 从数据库获取到 ${symbols.length} 个自定义交易对:`, symbols);
          resolve(symbols);
        }
      });
    });
  }

  // 获取数据统计信息
  getDataStats() {
    return new Promise((resolve, reject) => {
      const stats = {};
      let completed = 0;
      const total = 5;

      const checkComplete = () => {
        completed++;
        if (completed === total) {
          resolve(stats);
        }
      };

      // 信号记录统计
      this.db.get('SELECT COUNT(*) as count FROM signal_records', (err, row) => {
        if (err) {
          console.error('获取信号记录统计失败:', err);
          stats.signalRecords = 0;
        } else {
          stats.signalRecords = row.count;
        }
        checkComplete();
      });

      // 执行记录统计
      this.db.get('SELECT COUNT(*) as count FROM execution_records', (err, row) => {
        if (err) {
          console.error('获取执行记录统计失败:', err);
          stats.executionRecords = 0;
        } else {
          stats.executionRecords = row.count;
        }
        checkComplete();
      });

      // 模拟交易统计
      this.db.get('SELECT COUNT(*) as count FROM simulations', (err, row) => {
        if (err) {
          console.error('获取模拟交易统计失败:', err);
          stats.simulations = 0;
        } else {
          stats.simulations = row.count;
        }
        checkComplete();
      });

      // 活跃模拟交易统计
      this.db.get('SELECT COUNT(*) as count FROM simulations WHERE exit_time IS NULL', (err, row) => {
        if (err) {
          console.error('获取活跃模拟交易统计失败:', err);
          stats.activeSimulations = 0;
        } else {
          stats.activeSimulations = row.count;
        }
        checkComplete();
      });

      // 自定义交易对统计
      this.db.get('SELECT COUNT(*) as count FROM custom_symbols WHERE is_active = 1', (err, row) => {
        if (err) {
          console.error('获取自定义交易对统计失败:', err);
          stats.customSymbols = 0;
        } else {
          stats.customSymbols = row.count;
        }
        checkComplete();
      });
    });
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

// 增强的数据监控管理
class DataMonitor {
  constructor() {
    this.analysisLogs = new Map();
    this.completionRates = new Map(); // 完成率统计
    this.healthStatus = new Map(); // 健康状态
    this.alertThresholds = {
      dataCollection: 99, // 数据收集完成率阈值
      signalAnalysis: 99, // 信号判断完成率阈值
      simulationTrading: 99 // 模拟交易触发率阈值
    };
    this.startTime = Date.now();
  }

  /**
   * 开始分析，记录开始时间
   */
  startAnalysis(symbol) {
    const now = Date.now();
    this.analysisLogs.set(symbol, {
      startTime: now,
      rawData: {},
      indicators: {},
      signals: {},
      simulation: {},
      errors: [],
      success: true,
      phases: {
        dataCollection: { startTime: now, endTime: null, success: false },
        signalAnalysis: { startTime: null, endTime: null, success: false },
        simulationTrading: { startTime: null, endTime: null, success: false }
      }
    });
  }

  /**
   * 记录原始数据收集
   */
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

  /**
   * 记录指标计算
   */
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

  /**
   * 记录信号判断结果
   */
  recordSignal(symbol, signalType, signalData, success = true, error = null) {
    const log = this.analysisLogs.get(symbol);
    if (log) {
      log.signals[signalType] = {
        data: signalData,
        success,
        error: error ? error.message : null,
        timestamp: Date.now()
      };

      // 更新信号分析阶段状态
      if (log.phases.signalAnalysis.startTime === null) {
        log.phases.signalAnalysis.startTime = Date.now();
      }
      if (success) {
        log.phases.signalAnalysis.success = true;
        log.phases.signalAnalysis.endTime = Date.now();
      }
    }
  }

  /**
   * 记录模拟交易结果
   */
  recordSimulation(symbol, simulationType, simulationData, success = true, error = null) {
    const log = this.analysisLogs.get(symbol);
    if (log) {
      log.simulation[simulationType] = {
        data: simulationData,
        success,
        error: error ? error.message : null,
        timestamp: Date.now()
      };

      // 更新模拟交易阶段状态
      if (log.phases.simulationTrading.startTime === null) {
        log.phases.simulationTrading.startTime = Date.now();
      }
      if (success) {
        log.phases.simulationTrading.success = true;
        log.phases.simulationTrading.endTime = Date.now();
      }
    }
  }

  /**
   * 完成数据收集阶段
   */
  completeDataCollection(symbol, success = true) {
    const log = this.analysisLogs.get(symbol);
    if (log) {
      log.phases.dataCollection.endTime = Date.now();
      log.phases.dataCollection.success = success;
    }
  }

  /**
   * 获取分析日志
   */
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
      signals: log.signals,
      simulation: log.simulation,
      errors: log.errors,
      success: log.success,
      phases: log.phases,
      startTime: new Date(log.startTime).toISOString(),
      endTime: new Date(endTime).toISOString()
    };
  }

  /**
   * 计算完成率统计
   */
  calculateCompletionRates() {
    const now = Date.now();
    const rates = {
      dataCollection: {},
      signalAnalysis: {},
      simulationTrading: {},
      overall: {}
    };

    // 统计各交易对的完成率
    for (const [symbol, log] of this.analysisLogs.entries()) {
      // 数据收集完成率
      const dataCollectionSuccess = log.phases.dataCollection.success ? 1 : 0;
      rates.dataCollection[symbol] = dataCollectionSuccess * 100;

      // 信号判断完成率
      const signalAnalysisSuccess = log.phases.signalAnalysis.success ? 1 : 0;
      rates.signalAnalysis[symbol] = signalAnalysisSuccess * 100;

      // 模拟交易触发率
      const simulationSuccess = log.phases.simulationTrading.success ? 1 : 0;
      rates.simulationTrading[symbol] = simulationSuccess * 100;

      // 总体完成率
      const totalPhases = 3;
      const completedPhases = dataCollectionSuccess + signalAnalysisSuccess + simulationSuccess;
      rates.overall[symbol] = (completedPhases / totalPhases) * 100;
    }

    this.completionRates = rates;
    return rates;
  }

  /**
   * 检查健康状态
   */
  checkHealthStatus() {
    const rates = this.calculateCompletionRates();
    const healthStatus = {};

    for (const symbol of Object.keys(rates.overall)) {
      const dataRate = rates.dataCollection[symbol] || 0;
      const signalRate = rates.signalAnalysis[symbol] || 0;
      const simulationRate = rates.simulationTrading[symbol] || 0;

      healthStatus[symbol] = {
        dataCollection: {
          rate: dataRate,
          healthy: dataRate >= this.alertThresholds.dataCollection,
          status: dataRate >= this.alertThresholds.dataCollection ? 'healthy' : 'warning'
        },
        signalAnalysis: {
          rate: signalRate,
          healthy: signalRate >= this.alertThresholds.signalAnalysis,
          status: signalRate >= this.alertThresholds.signalAnalysis ? 'healthy' : 'warning'
        },
        simulationTrading: {
          rate: simulationRate,
          healthy: simulationRate >= this.alertThresholds.simulationTrading,
          status: simulationRate >= this.alertThresholds.simulationTrading ? 'healthy' : 'warning'
        },
        overall: {
          rate: rates.overall[symbol],
          healthy: rates.overall[symbol] >= 99, // 总体健康阈值
          status: rates.overall[symbol] >= 99 ? 'healthy' : 'critical'
        }
      };
    }

    this.healthStatus = healthStatus;
    return healthStatus;
  }

  /**
   * 获取监控仪表板数据
   */
  getMonitoringDashboard() {
    const rates = this.calculateCompletionRates();
    const health = this.checkHealthStatus();
    const now = Date.now();
    const uptime = now - this.startTime;

    // 计算平均完成率
    const symbols = Object.keys(rates.overall);
    const avgDataCollection = symbols.length > 0 ?
      symbols.reduce((sum, symbol) => sum + (rates.dataCollection[symbol] || 0), 0) / symbols.length : 0;
    const avgSignalAnalysis = symbols.length > 0 ?
      symbols.reduce((sum, symbol) => sum + (rates.signalAnalysis[symbol] || 0), 0) / symbols.length : 0;
    const avgSimulationTrading = symbols.length > 0 ?
      symbols.reduce((sum, symbol) => sum + (rates.simulationTrading[symbol] || 0), 0) / symbols.length : 0;
    const avgOverall = symbols.length > 0 ?
      symbols.reduce((sum, symbol) => sum + rates.overall[symbol], 0) / symbols.length : 0;

    return {
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime / 1000), // 秒
      summary: {
        totalSymbols: symbols.length,
        avgDataCollection: Math.round(avgDataCollection * 100) / 100,
        avgSignalAnalysis: Math.round(avgSignalAnalysis * 100) / 100,
        avgSimulationTrading: Math.round(avgSimulationTrading * 100) / 100,
        avgOverall: Math.round(avgOverall * 100) / 100
      },
      symbols: symbols.map(symbol => ({
        symbol,
        dataCollection: {
          rate: rates.dataCollection[symbol] || 0,
          status: health[symbol]?.dataCollection?.status || 'unknown'
        },
        signalAnalysis: {
          rate: rates.signalAnalysis[symbol] || 0,
          status: health[symbol]?.signalAnalysis?.status || 'unknown'
        },
        simulationTrading: {
          rate: rates.simulationTrading[symbol] || 0,
          status: health[symbol]?.simulationTrading?.status || 'unknown'
        },
        overall: {
          rate: rates.overall[symbol] || 0,
          status: health[symbol]?.overall?.status || 'unknown'
        }
      })),
      thresholds: this.alertThresholds,
      recentLogs: Array.from(this.analysisLogs.values())
        .sort((a, b) => b.startTime - a.startTime)
        .slice(0, 10)
        .map(log => this.getAnalysisLog(log.symbol || 'unknown'))
    };
  }

  /**
   * 清理过期日志
   */
  clearOldLogs() {
    const now = Date.now();
    for (const [symbol, log] of this.analysisLogs.entries()) {
      if (now - log.startTime > 300000) { // 5分钟
        this.analysisLogs.delete(symbol);
      }
    }
  }

  /**
   * 设置告警阈值
   */
  setAlertThresholds(thresholds) {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
  }

  /**
   * 检查并发送告警
   */
  checkAndSendAlerts(telegramNotifier) {
    const healthStatus = this.checkHealthStatus();
    const alerts = [];

    for (const [symbol, status] of Object.entries(healthStatus)) {
      // 检查数据收集告警
      if (!status.dataCollection.healthy) {
        alerts.push({
          type: 'dataCollection',
          symbol,
          rate: status.dataCollection.rate,
          threshold: this.alertThresholds.dataCollection,
          message: `⚠️ ${symbol} 数据收集完成率过低: ${status.dataCollection.rate}% (阈值: ${this.alertThresholds.dataCollection}%)`
        });
      }

      // 检查信号判断告警
      if (!status.signalAnalysis.healthy) {
        alerts.push({
          type: 'signalAnalysis',
          symbol,
          rate: status.signalAnalysis.rate,
          threshold: this.alertThresholds.signalAnalysis,
          message: `⚠️ ${symbol} 信号判断完成率过低: ${status.signalAnalysis.rate}% (阈值: ${this.alertThresholds.signalAnalysis}%)`
        });
      }

      // 检查模拟交易告警
      if (!status.simulationTrading.healthy) {
        alerts.push({
          type: 'simulationTrading',
          symbol,
          rate: status.simulationTrading.rate,
          threshold: this.alertThresholds.simulationTrading,
          message: `⚠️ ${symbol} 模拟交易触发率过低: ${status.simulationTrading.rate}% (阈值: ${this.alertThresholds.simulationTrading}%)`
        });
      }

      // 检查总体健康告警
      if (!status.overall.healthy) {
        alerts.push({
          type: 'overall',
          symbol,
          rate: status.overall.rate,
          threshold: 99,
          message: `🚨 ${symbol} 总体完成率严重过低: ${status.overall.rate}% (阈值: 99%)`
        });
      }
    }

    // 发送告警
    if (alerts.length > 0 && telegramNotifier) {
      const alertMessage = `🚨 <b>SmartFlow 系统告警</b>\n\n` +
        alerts.map(alert => alert.message).join('\n') +
        `\n\n🌐 <b>网页链接：</b>https://smart.aimaventop.com`;

      telegramNotifier.sendMessage(alertMessage);
    }

    return alerts;
  }
}

// 智能数据获取管理器
class SmartDataManager {
  constructor() {
    this.rateLimiter = new SmartAPIRateLimiter();
    this.symbolDataCache = new Map(); // 交易对数据缓存
    this.pendingRequests = new Map(); // 待处理请求
    this.retryQueue = new Map(); // 重试队列
  }

  // 为交易对设置优先级
  setSymbolPriority(symbol, priority = 1) {
    this.rateLimiter.setSymbolPriority(symbol, priority);
  }

  // 获取交易对的所有必需数据
  async getSymbolData(symbol, dataTypes = ['klines', 'ticker', 'funding', 'openInterest', 'openInterestHist']) {
    const cacheKey = `${symbol}_${dataTypes.join('_')}`;

    // 检查缓存
    if (this.symbolDataCache.has(cacheKey)) {
      const cached = this.symbolDataCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 30000) { // 30秒缓存
        return cached.data;
      }
    }

    // 检查是否有待处理的请求
    if (this.pendingRequests.has(cacheKey)) {
      return await this.pendingRequests.get(cacheKey);
    }

    // 创建新的请求
    const requestPromise = this.fetchSymbolDataWithRetry(symbol, dataTypes);
    this.pendingRequests.set(cacheKey, requestPromise);

    try {
      const data = await requestPromise;

      // 缓存结果
      this.symbolDataCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      return data;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  // 带重试的数据获取
  async fetchSymbolDataWithRetry(symbol, dataTypes, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const results = {};

        // 按优先级获取数据
        const priorityOrder = this.getDataPriorityOrder(dataTypes);

        for (const dataType of priorityOrder) {
          try {
            results[dataType] = await this.fetchSingleDataType(symbol, dataType);
          } catch (error) {
            console.warn(`获取 ${symbol} ${dataType} 失败 (尝试 ${attempt}/${maxRetries}):`, error.message);

            if (attempt === maxRetries) {
              throw new Error(`获取 ${symbol} ${dataType} 失败: ${error.message}`);
            }

            // 等待后重试
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }

        return results;
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }

        // 指数退避重试
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        console.log(`重试 ${symbol} 数据获取，等待 ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  // 获取数据类型优先级顺序
  getDataPriorityOrder(dataTypes) {
    const priority = {
      'klines': 1,      // 最高优先级
      'ticker': 2,      // 价格数据
      'funding': 3,     // 资金费率
      'openInterest': 4, // 持仓量
      'openInterestHist': 5 // 持仓量历史
    };

    return dataTypes.sort((a, b) => (priority[a] || 999) - (priority[b] || 999));
  }

  // 获取单个数据类型
  async fetchSingleDataType(symbol, dataType) {
    const endpoint = this.rateLimiter.getEndpointForDataType(dataType);
    const cacheKey = `${symbol}_${dataType}_${Date.now()}`;

    return await this.rateLimiter.cachedCall(cacheKey, async () => {
      return await this.callBinanceAPI(symbol, endpoint);
    }, endpoint, symbol);
  }

  // 调用Binance API
  async callBinanceAPI(symbol, endpoint) {
    const url = `${BinanceAPI.BASE_URL}/fapi/v1/${endpoint}`;
    const params = { symbol };

    const response = await axios.get(url, {
      params,
      timeout: 15000
    });

    return response.data;
  }

  // 清理过期缓存
  cleanExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.symbolDataCache.entries()) {
      if (now - value.timestamp > 300000) { // 5分钟过期
        this.symbolDataCache.delete(key);
      }
    }
  }
}

// 交易策略
class SmartFlowStrategy {
  static dataMonitor = new DataMonitor();
  static dataManager = new SmartDataManager();

  static async analyzeDailyTrend(symbol, symbolData = null) {
    try {
      let klines;
      if (symbolData && symbolData.klines) {
        klines = symbolData.klines;
      } else {
        klines = await BinanceAPI.getKlines(symbol, '1d', 250);
      }

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

  static async analyzeHourlyConfirmation(symbol, symbolData = null) {
    try {
      let klines;
      if (symbolData && symbolData.klines) {
        klines = symbolData.klines;
      } else {
        klines = await BinanceAPI.getKlines(symbol, '1h', 200);
      }

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
      let oiHist;
      if (symbolData && symbolData.openInterestHist) {
        oiHist = symbolData.openInterestHist;
      } else {
        oiHist = await BinanceAPI.getOpenInterestHist(symbol, '1h', 7);
      }

      if (!oiHist || oiHist.length < 2) {
        this.dataMonitor.recordRawData(symbol, '持仓量历史', null, false, new Error('OI历史数据不足'));
        throw new Error('OI历史数据不足');
      }

      this.dataMonitor.recordRawData(symbol, '持仓量历史', oiHist, true);
      const oiChange = (oiHist[oiHist.length - 1].oi - oiHist[0].oi) / oiHist[0].oi * 100;

      // 获取资金费率
      let fundingRate;
      if (symbolData && symbolData.funding) {
        fundingRate = symbolData.funding;
      } else {
        fundingRate = await BinanceAPI.getFundingRate(symbol);
      }

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
        console.warn(`⚠️ ${symbol} CVD数据不可用，继续分析但可能影响信号准确性`);
        // 不抛出错误，而是使用默认的CVD数据继续分析
        const defaultCvdData = { cvd: 0, direction: 'N/A', isActive: false };
        this.dataMonitor.recordRawData(symbol, 'CVD数据', defaultCvdData, false);
      } else {
        this.dataMonitor.recordRawData(symbol, 'CVD数据', cvdData, true);
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
        cvd: cvdData.isActive ? cvdData : { cvd: 0, direction: 'N/A', isActive: false },
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

  static async analyze15mExecution(symbol, symbolData = null) {
    try {
      let klines;
      if (symbolData && symbolData.klines) {
        klines = symbolData.klines;
      } else {
        klines = await BinanceAPI.getKlines(symbol, '15m', 96);
      }

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

      // 设置交易对优先级（默认交易对优先级更高）
      const defaultSymbols = ['BTCUSDT', 'ETHUSDT', 'LINKUSDT', 'LDOUSDT', 'SOLUSDT'];
      const priority = defaultSymbols.includes(symbol) ? 10 : 5;
      this.dataManager.setSymbolPriority(symbol, priority);

      // 使用智能数据管理器获取所有必需数据
      const symbolData = await this.dataManager.getSymbolData(symbol, [
        'klines', 'ticker', 'funding', 'openInterest', 'openInterestHist'
      ]);

      // 完成数据收集阶段
      this.dataMonitor.completeDataCollection(symbol, true);

      // 并行分析各个组件
      const [dailyTrend, hourlyConfirmation, execution15m] = await Promise.all([
        this.analyzeDailyTrend(symbol, symbolData),
        this.analyzeHourlyConfirmation(symbol, symbolData),
        this.analyze15mExecution(symbol, symbolData)
      ]);

      const ticker24hr = symbolData.ticker;

      // 记录24小时价格数据
      if (ticker24hr) {
        this.dataMonitor.recordRawData(symbol, '24小时价格', ticker24hr, true);
      } else {
        this.dataMonitor.recordRawData(symbol, '24小时价格', null, false, new Error('24小时价格数据获取失败'));
      }

      // 记录信号判断结果
      const signalData = {
        dailyTrend,
        hourlyConfirmation,
        execution15m,
        timestamp: Date.now()
      };
      this.dataMonitor.recordSignal(symbol, '综合分析', signalData, true);

      // 记录模拟交易结果（如果有交易信号）
      if (execution15m && execution15m.signal) {
        const simulationData = {
          signal: execution15m.signal,
          entryPrice: execution15m.entryPrice,
          stopLoss: execution15m.stopLoss,
          takeProfit: execution15m.takeProfit,
          riskReward: execution15m.riskReward,
          timestamp: Date.now()
        };
        this.dataMonitor.recordSimulation(symbol, '交易信号', simulationData, true);
      } else {
        this.dataMonitor.recordSimulation(symbol, '交易信号', null, false, new Error('无交易信号'));
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

      // 检查CVD数据是否可用
      const cvdAvailable = hourlyConfirmation.cvd.isActive;
      const cvdDirection = hourlyConfirmation.cvd.direction;

      console.log(`🔍 [${symbol}] 信号判断条件:`);
      console.log(`  - 趋势: ${trend}`);
      console.log(`  - 小时确认: ${hourlyConfirmation.confirmed}`);
      console.log(`  - 价格vsVWAP: ${hourlyConfirmation.priceVsVwap}`);
      console.log(`  - 突破高点: ${hourlyConfirmation.breakoutUp}, 突破低点: ${hourlyConfirmation.breakoutDown}`);
      console.log(`  - OI变化: ${hourlyConfirmation.oiChange}%`);
      console.log(`  - CVD可用: ${cvdAvailable}, CVD方向: ${cvdDirection}`);

      if (trend === 'UPTREND' &&
        hourlyConfirmation.confirmed &&
        hourlyConfirmation.priceVsVwap > 0 &&
        hourlyConfirmation.breakoutUp &&
        hourlyConfirmation.oiChange >= 2 && // 恢复严格的OI变化要求：≥2%
        (cvdAvailable ? cvdDirection === 'CVD(+)' : true)) {
        signal = 'LONG';
        console.log(`✅ [${symbol}] 生成多头信号`);
      } else if (trend === 'DOWNTREND' &&
        hourlyConfirmation.confirmed &&
        hourlyConfirmation.priceVsVwap < 0 &&
        hourlyConfirmation.breakoutDown &&
        hourlyConfirmation.oiChange <= -2 && // 恢复严格的OI变化要求：≤-2%
        (cvdAvailable ? cvdDirection === 'CVD(-)' : true)) {
        signal = 'SHORT';
        console.log(`✅ [${symbol}] 生成空头信号`);
      } else {
        console.log(`❌ [${symbol}] 不满足信号条件，无信号`);
      }

      // 3. 入场执行判断 (15分钟数据)
      // 按照strategy.md要求：等待回踩EMA20/50或前高/前低支撑，然后突破setup candle触发
      let execution = 'NO_EXECUTION';

      if (signal === 'LONG') {
        console.log(`🔍 [${symbol}] 多头执行条件检查:`);
        console.log(`  - 回踩EMA20: ${execution15m.pullbackToEma20}`);
        console.log(`  - 回踩EMA50: ${execution15m.pullbackToEma50}`);
        console.log(`  - 突破setup高点: ${execution15m.breakSetupHigh}`);
        console.log(`  - Setup高点: ${execution15m.setupHigh}, Setup低点: ${execution15m.setupLow}`);

        // 多头执行条件：回踩到EMA20/50或前高支撑，然后突破setup candle高点
        if (execution15m.pullbackToEma20 || execution15m.pullbackToEma50) {
          if (execution15m.breakSetupHigh) {
            execution = 'LONG_EXECUTE';
            console.log(`✅ [${symbol}] 多头执行触发`);
          } else {
            execution = 'LONG_WAIT_PULLBACK';
            console.log(`⏳ [${symbol}] 多头等待突破setup高点`);
          }
        } else {
          execution = 'LONG_WAIT_PULLBACK';
          console.log(`⏳ [${symbol}] 多头等待回踩EMA20/50`);
        }
      } else if (signal === 'SHORT') {
        console.log(`🔍 [${symbol}] 空头执行条件检查:`);
        console.log(`  - 回踩EMA20: ${execution15m.pullbackToEma20}`);
        console.log(`  - 回踩EMA50: ${execution15m.pullbackToEma50}`);
        console.log(`  - 突破setup低点: ${execution15m.breakSetupLow}`);
        console.log(`  - Setup高点: ${execution15m.setupHigh}, Setup低点: ${execution15m.setupLow}`);

        // 空头执行条件：回踩到EMA20/50或前低支撑，然后突破setup candle低点
        if (execution15m.pullbackToEma20 || execution15m.pullbackToEma50) {
          if (execution15m.breakSetupLow) {
            execution = 'SHORT_EXECUTE';
            console.log(`✅ [${symbol}] 空头执行触发`);
          } else {
            execution = 'SHORT_WAIT_PULLBACK';
            console.log(`⏳ [${symbol}] 空头等待突破setup低点`);
          }
        } else {
          execution = 'SHORT_WAIT_PULLBACK';
          console.log(`⏳ [${symbol}] 空头等待回踩EMA20/50`);
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
        // 注意：minMargin将在前端根据用户选择的损失金额动态计算
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
        riskReward: signal !== 'NO_SIGNAL' ? 2 : 0
      };

      // 记录历史数据
      try {
        // 如果有信号，记录信号数据并创建模拟交易
        if (signal === 'LONG' || signal === 'SHORT') {
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

          // 为信号创建模拟交易
          try {
            const minMargin = Math.ceil(20 / (maxLeverage * stopDistance)); // 使用默认20 USDT
            await simulationManager.createSimulation(
              symbol,
              currentPrice,
              stopLoss,
              targetPrice,
              maxLeverage,
              minMargin,
              'SIGNAL' // 触发原因：信号
            );
            console.log(`📊 创建信号模拟交易: ${symbol} @ ${currentPrice}`);
          } catch (simError) {
            console.error(`信号模拟交易创建失败 ${symbol}:`, simError.message);
          }
        }

        // 如果有入场执行，记录执行数据并创建模拟交易
        if (execution !== 'NO_EXECUTION' && execution.includes('EXECUTE')) {
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
            riskRewardRatio: signal !== 'NO_SIGNAL' ? 2 : 0,
            rawData: {
              dailyTrend,
              hourlyConfirmation,
              execution15m,
              ticker24hr
            }
          };
          await dbManager.recordExecution(symbol, executionData);

          // 为入场执行创建模拟交易
          try {
            const minMargin = Math.ceil(20 / (maxLeverage * stopDistance)); // 使用默认20 USDT
            await simulationManager.createSimulation(
              symbol,
              currentPrice,
              stopLoss,
              targetPrice,
              maxLeverage,
              minMargin,
              'EXECUTION' // 触发原因：入场执行
            );
            console.log(`📊 创建执行模拟交易: ${symbol} @ ${currentPrice}`);
          } catch (simError) {
            console.error(`执行模拟交易创建失败 ${symbol}:`, simError.message);
          }
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

// 初始化数据库
const dbManager = new DatabaseManager();

// 初始化 CVD 管理器
const cvdManager = new CVDManager();
cvdManager.start();

// 初始化数据库后加载自定义交易对
setTimeout(() => {
  dbManager.initCustomSymbols();
}, 3000); // 延迟1秒确保CVD管理器已启动

const telegramNotifier = new TelegramNotifier();
const simulationManager = new SimulationManager(dbManager.db);

// 定时刷新数据 (每5分钟)
setInterval(() => {
  console.log('🔄 定时刷新数据缓存...');
  BinanceAPI.rateLimiter.dataCache.clear();
  SmartFlowStrategy.dataManager.cleanExpiredCache();
}, 5 * 60 * 1000);

// 定时检查告警 (每2分钟)
setInterval(() => {
  try {
    console.log('🔍 检查系统告警...');
    const alerts = SmartFlowStrategy.dataMonitor.checkAndSendAlerts(telegramNotifier);
    if (alerts.length > 0) {
      console.log(`⚠️ 发现 ${alerts.length} 个告警`);
    } else {
      console.log('✅ 系统运行正常');
    }
  } catch (error) {
    console.error('❌ 告警检查失败:', error);
  }
}, 2 * 60 * 1000);

// 定期清理历史数据 (每天凌晨2点)
setInterval(() => {
  const now = new Date();
  const hour = now.getHours();

  if (hour === 2) {
    console.log('🧹 开始清理历史数据...');
    simulationManager.cleanOldData().catch(error => {
      console.error('清理历史数据失败:', error);
    });
  }
}, 60 * 60 * 1000); // 每小时检查一次 // 5分钟

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

// 数据监控状态API（保持向后兼容）
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

// 新的监控仪表板API
app.get('/api/monitoring-dashboard', (req, res) => {
  try {
    const dashboardData = SmartFlowStrategy.dataMonitor.getMonitoringDashboard();
    res.json(dashboardData);
  } catch (error) {
    res.status(500).json({
      error: '获取监控仪表板数据失败',
      message: error.message
    });
  }
});

// 设置告警阈值API
app.post('/api/monitoring-thresholds', (req, res) => {
  try {
    const { thresholds } = req.body;
    if (!thresholds || typeof thresholds !== 'object') {
      return res.status(400).json({
        error: '无效的阈值配置',
        message: '请提供有效的阈值对象'
      });
    }

    SmartFlowStrategy.dataMonitor.setAlertThresholds(thresholds);

    res.json({
      success: true,
      message: '告警阈值设置成功',
      thresholds: SmartFlowStrategy.dataMonitor.alertThresholds
    });
  } catch (error) {
    res.status(500).json({
      error: '设置告警阈值失败',
      message: error.message
    });
  }
});

// 健康检查API
app.get('/api/health-check', (req, res) => {
  try {
    const healthStatus = SmartFlowStrategy.dataMonitor.checkHealthStatus();
    const rates = SmartFlowStrategy.dataMonitor.calculateCompletionRates();

    // 检查是否有任何交易对处于不健康状态
    const unhealthySymbols = Object.entries(healthStatus).filter(([symbol, status]) =>
      !status.overall.healthy
    );

    const isSystemHealthy = unhealthySymbols.length === 0;

    res.json({
      timestamp: new Date().toISOString(),
      systemHealth: isSystemHealthy ? 'healthy' : 'unhealthy',
      unhealthySymbols: unhealthySymbols.map(([symbol, status]) => ({
        symbol,
        overallRate: status.overall.rate,
        status: status.overall.status
      })),
      healthStatus,
      completionRates: rates
    });
  } catch (error) {
    res.status(500).json({
      error: '健康检查失败',
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

    const testMessage = `🧪 <b>SmartFlow 测试消息</b>\n\n📊 <b>交易对：</b>BTCUSDT\n📈 <b>信号变化：</b>测试信号\n⚡ <b>入场执行变化：</b>测试执行\n🔍 <b>关键判断依据：</b>\n1. 这是一个测试消息\n2. 如果您收到此消息，说明Telegram通知配置成功\n\n🌐 <b>网页链接：</b>https://smart.aimaventop.com`;

    await telegramNotifier.sendMessage(testMessage);
    res.json({ success: true, message: '测试消息已发送' });
  } catch (error) {
    console.error('Telegram测试API错误:', error);
    res.status(500).json({ error: 'Telegram测试失败: ' + error.message });
  }
});

// 获取胜率统计
app.get('/api/win-rate-stats', async (req, res) => {
  try {
    const stats = await simulationManager.getWinRateStats();
    res.json(stats);
  } catch (error) {
    console.error('获取胜率统计失败:', error);
    res.status(500).json({ error: '获取胜率统计失败' });
  }
});

// 获取模拟交易历史
app.get('/api/simulation-history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const history = await simulationManager.getSimulationHistory(limit);
    res.json(history);
  } catch (error) {
    console.error('获取模拟交易历史失败:', error);
    res.status(500).json({ error: '获取模拟交易历史失败' });
  }
});

// 清理历史数据（保留最近360天）
app.post('/api/clean-old-data', async (req, res) => {
  try {
    await simulationManager.cleanOldData();
    res.json({
      success: true,
      message: '历史数据清理完成（保留最近360天）',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('清理历史数据失败:', error);
    res.status(500).json({
      success: false,
      error: '清理历史数据失败',
      message: error.message
    });
  }
});

// 获取数据统计信息
app.get('/api/data-stats', async (req, res) => {
  try {
    const stats = await dbManager.getDataStats();
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取数据统计失败:', error);
    res.status(500).json({
      success: false,
      error: '获取数据统计失败',
      message: error.message
    });
  }
});

app.get('/api/analyze/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;

    // 验证交易对格式
    if (!symbol || !symbol.endsWith('USDT')) {
      return res.status(400).json({
        symbol,
        trend: 'ERROR',
        signal: 'ERROR',
        execution: 'ERROR',
        currentPrice: 0,
        dataError: '无效的交易对格式'
      });
    }

    const result = await SmartFlowStrategy.analyzeAll(symbol);
    res.json(result);
  } catch (error) {
    console.error(`分析 ${req.params.symbol} 失败:`, error);

    // 确保返回正确的JSON格式
    res.status(500).json({
      symbol: req.params.symbol || 'UNKNOWN',
      trend: 'ERROR',
      signal: 'ERROR',
      execution: 'ERROR',
      currentPrice: 0,
      dataError: `分析失败: ${error.message}`
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

// 获取当前交易对列表
app.get('/api/symbols', async (req, res) => {
  try {
    const defaultSymbols = ['BTCUSDT', 'ETHUSDT', 'LINKUSDT', 'LDOUSDT', 'SOLUSDT'];
    const customSymbols = await dbManager.getCustomSymbols();
    const allSymbols = [...defaultSymbols, ...customSymbols];

    console.log('📋 API /api/symbols 被调用:');
    console.log('  - 默认交易对:', defaultSymbols);
    console.log('  - 自定义交易对:', customSymbols);
    console.log('  - 所有交易对:', allSymbols);

    res.json({
      success: true,
      data: {
        defaultSymbols,
        customSymbols,
        allSymbols
      }
    });
  } catch (error) {
    console.error('❌ 获取交易对列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取交易对列表失败',
      message: error.message
    });
  }
});

// 删除交易对
app.delete('/api/symbol/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;

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

    // 检查是否为默认交易对（不允许删除）
    const defaultSymbols = ['BTCUSDT', 'ETHUSDT', 'LINKUSDT', 'LDOUSDT', 'SOLUSDT'];
    if (defaultSymbols.includes(symbol)) {
      return res.status(400).json({
        error: '不允许删除默认交易对',
        message: '默认交易对不能删除'
      });
    }

    // 从数据库删除交易对
    const dbResult = await dbManager.removeCustomSymbol(symbol);

    if (dbResult > 0) {
      // 从CVD管理器删除交易对
      cvdManager.removeSymbol(symbol);

      res.json({
        success: true,
        message: `交易对 ${symbol} 已成功删除`
      });
    } else {
      res.status(404).json({
        success: false,
        error: '交易对不存在',
        message: `交易对 ${symbol} 不存在`
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '删除交易对失败',
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

    // 检查是否为默认交易对
    const defaultSymbols = ['BTCUSDT', 'ETHUSDT', 'LINKUSDT', 'LDOUSDT', 'SOLUSDT'];
    if (!defaultSymbols.includes(symbol)) {
      // 添加到数据库
      console.log(`📋 开始添加交易对 ${symbol} 到数据库...`);
      await dbManager.addCustomSymbol(symbol);
      console.log(`✅ 交易对 ${symbol} 已保存到数据库`);
    } else {
      console.log(`ℹ️ 交易对 ${symbol} 是默认交易对，无需保存到数据库`);
    }

    // 预先添加交易对到 CVD 连接
    cvdManager.addSymbol(symbol);

    // 等待 WebSocket 连接建立
    console.log(`⏳ 等待 ${symbol} WebSocket 连接建立...`);
    const connected = await cvdManager.waitForConnection(symbol, 15000);

    if (connected) {
      // 连接建立后，再等待一段时间收集CVD数据
      console.log(`⏳ 等待 ${symbol} CVD 数据收集...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // 检查 CVD 连接状态
    const cvdStatus = cvdManager.getCVD(symbol);
    if (!cvdStatus.isActive) {
      console.warn(`⚠️ ${symbol} CVD 连接未建立或数据不足，继续分析但可能缺少 CVD 数据`);
    } else {
      console.log(`✅ ${symbol} CVD 连接已建立，数据可用`);
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
    const rateLimitStatus = BinanceAPI.rateLimiter.checkRateLimit();
    const cacheSize = BinanceAPI.rateLimiter.dataCache.cache.size;
    const queueSize = BinanceAPI.rateLimiter.requestQueue.length;
    const processing = BinanceAPI.rateLimiter.processing;

    res.json({
      timestamp: new Date().toISOString(),
      rateLimit: {
        requestsPerMinute: rateLimitStatus.requestsPerMinute,
        weightPerMinute: rateLimitStatus.weightPerMinute,
        requestsPer10Seconds: rateLimitStatus.requestsPer10Seconds,
        canMakeRequest: rateLimitStatus.canMakeRequest,
        limits: BinanceAPI.rateLimiter.limits.rest
      },
      queue: {
        size: queueSize,
        processing: processing
      },
      cache: {
        size: cacheSize,
        timeout: BinanceAPI.rateLimiter.dataCache.cacheTimeout
      },
      dataManager: {
        symbolCacheSize: SmartFlowStrategy.dataManager.symbolDataCache.size,
        pendingRequests: SmartFlowStrategy.dataManager.pendingRequests.size
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
