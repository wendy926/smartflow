/**
 * 实时指标收集器
 * 从WebSocket和REST API收集市场数据并计算指标
 * 传递给候选-确认检测器
 * 
 * 设计原则：
 * 1. 单一职责：专注于数据收集和指标计算
 * 2. 开闭原则：支持多种数据源扩展
 * 3. 依赖倒置：依赖抽象接口
 * 4. 接口隔离：提供简洁的指标接口
 * 5. 高性能：异步并行处理
 * 6. 可观测性：详细的日志和监控
 */

const logger = require('../../utils/logger');
const TechnicalIndicators = require('../../utils/technical-indicators');

/**
 * 实时指标收集器
 */
class RealtimeMetricsCollector {
  constructor(database, binanceAPI, detector, options = {}) {
    this.database = database;
    this.binanceAPI = binanceAPI;
    this.detector = detector;
    
    // 配置选项
    this.options = {
      updateIntervalSec: 1,        // 更新间隔（秒）
      klineInterval: '1m',         // K线周期
      cvdWindowMs: 4 * 60 * 60 * 1000, // 4小时CVD窗口
      volAvgWindow: 20,            // 成交量平均值窗口
      ...options
    };
    
    // 数据缓存：symbol -> data
    this.dataCache = new Map();
    
    // 定时器
    this.updateTimer = null;
    
    // 运行状态
    this.isRunning = false;
  }
  
  /**
   * 启动收集器
   */
  async start() {
    try {
      logger.info('[实时指标收集器] 启动...');
      
      this.isRunning = true;
      
      // 初始化数据缓存
      await this.initializeDataCache();
      
      // 启动定时更新
      this.startPeriodicUpdate();
      
      logger.info('[实时指标收集器] 启动完成');
    } catch (error) {
      logger.error('[实时指标收集器] 启动失败:', error);
      throw error;
    }
  }
  
  /**
   * 停止收集器
   */
  stop() {
    logger.info('[实时指标收集器] 停止...');
    
    this.isRunning = false;
    
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    
    logger.info('[实时指标收集器] 已停止');
  }
  
  /**
   * 初始化数据缓存
   */
  async initializeDataCache() {
    try {
      // 获取监控列表
      const sql = `
        SELECT symbol 
        FROM smart_money_watch_list 
        WHERE is_active = 1
      `;
      
      const rows = await this.database.query(sql);
      
      for (const row of rows) {
        const symbol = row.symbol;
        this.dataCache.set(symbol, {
          klines: [],
          trades: [],
          orderBook: null,
          funding: null,
          lastUpdate: 0
        });
      }
      
      logger.info(`[实时指标收集器] 初始化${rows.length}个交易对的数据缓存`);
    } catch (error) {
      logger.error('[实时指标收集器] 初始化数据缓存失败:', error);
      throw error;
    }
  }
  
  /**
   * 启动定时更新
   */
  startPeriodicUpdate() {
    const intervalMs = this.options.updateIntervalSec * 1000;
    
    this.updateTimer = setInterval(async () => {
      if (!this.isRunning) {
        return;
      }
      
      try {
        await this.updateAllSymbols();
      } catch (error) {
        logger.error('[实时指标收集器] 定时更新失败:', error);
      }
    }, intervalMs);
    
    // 立即执行一次
    this.updateAllSymbols().catch(error => {
      logger.error('[实时指标收集器] 初始更新失败:', error);
    });
  }
  
  /**
   * 更新所有交易对
   */
  async updateAllSymbols() {
    const symbols = Array.from(this.dataCache.keys());
    
    // 并行更新所有交易对
    const updatePromises = symbols.map(symbol => this.updateSymbol(symbol));
    await Promise.all(updatePromises);
  }
  
  /**
   * 更新单个交易对
   */
  async updateSymbol(symbol) {
    try {
      const now = Date.now();
      const cache = this.dataCache.get(symbol);
      
      if (!cache) {
        return;
      }
      
      // 并行获取所有数据
      const [klines, ticker, funding, orderBook] = await Promise.all([
        this.fetchKlines(symbol),
        this.fetchTicker(symbol),
        this.fetchFundingRate(symbol),
        this.fetchOrderBook(symbol)
      ]);
      
      // 更新缓存
      cache.klines = klines;
      cache.ticker = ticker;
      cache.funding = funding;
      cache.orderBook = orderBook;
      cache.lastUpdate = now;
      
      // 计算指标
      const metrics = this.calculateMetrics(symbol, cache);
      
      // 传递给检测器
      this.detector.onNewMetrics(symbol, metrics);
      
    } catch (error) {
      logger.error(`[实时指标收集器] 更新${symbol}失败:`, error);
    }
  }
  
  /**
   * 获取K线数据
   */
  async fetchKlines(symbol) {
    try {
      const klines = await this.binanceAPI.getKlines(symbol, this.options.klineInterval, 100);
      
      return klines.map(k => ({
        time: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));
    } catch (error) {
      logger.error(`[实时指标收集器] 获取${symbol}K线失败:`, error);
      return [];
    }
  }
  
  /**
   * 获取Ticker数据
   */
  async fetchTicker(symbol) {
    try {
      const ticker = await this.binanceAPI.getTicker(symbol);
      
      return {
        price: parseFloat(ticker.lastPrice),
        volume: parseFloat(ticker.volume),
        priceChange: parseFloat(ticker.priceChangePercent)
      };
    } catch (error) {
      logger.error(`[实时指标收集器] 获取${symbol}Ticker失败:`, error);
      return null;
    }
  }
  
  /**
   * 获取资金费率
   */
  async fetchFundingRate(symbol) {
    try {
      const funding = await this.binanceAPI.getFundingRate(symbol);
      
      return {
        rate: parseFloat(funding.lastFundingRate),
        nextFundingTime: funding.nextFundingTime
      };
    } catch (error) {
      logger.error(`[实时指标收集器] 获取${symbol}资金费率失败:`, error);
      return null;
    }
  }
  
  /**
   * 获取订单簿
   */
  async fetchOrderBook(symbol) {
    try {
      const orderBook = await this.binanceAPI.getOrderBook(symbol, 50);
      
      return {
        bids: orderBook.bids.map(([price, qty]) => ({
          price: parseFloat(price),
          qty: parseFloat(qty)
        })),
        asks: orderBook.asks.map(([price, qty]) => ({
          price: parseFloat(price),
          qty: parseFloat(qty)
        }))
      };
    } catch (error) {
      logger.error(`[实时指标收集器] 获取${symbol}订单簿失败:`, error);
      return null;
    }
  }
  
  /**
   * 计算指标
   */
  calculateMetrics(symbol, cache) {
    const klines = cache.klines;
    const ticker = cache.ticker;
    
    if (!klines || klines.length === 0 || !ticker) {
      return null;
    }
    
    const now = Date.now();
    const currentPrice = ticker.price;
    const currentVolume = ticker.volume;
    
    // 计算CVD（累积成交量差）
    const cvd = this.calculateCVD(klines);
    
    // 计算CVD Z-Score
    const cvdZ = this.calculateCVDZScore(klines, cvd);
    
    // 计算OBI（订单簿不平衡）
    const obi = this.calculateOBI(cache.orderBook);
    
    // 计算OBI Z-Score
    const obiZ = this.calculateOBIZScore(klines, obi);
    
    // 计算成交量比率
    const volAvg = this.calculateVolAvg(klines);
    const volRatio = currentVolume / volAvg;
    
    // 计算Delta（15分钟）
    const delta15 = this.calculateDelta15(klines);
    
    // 计算价格跌幅
    const priceDropPct = this.calculatePriceDropPct(klines);
    
    // 计算ATR（15分钟）
    const atr15 = this.calculateATR15(klines);
    
    // 获取持仓量变化
    const oiChange = this.calculateOIChange(symbol);
    
    // 计算趋势得分
    const trendScore = this.calculateTrendScore(klines);
    
    // 构建指标对象
    const metrics = {
      time: now,
      price: currentPrice,
      volume: currentVolume,
      volAvg: volAvg,
      CVD: cvd,
      prevCVD: this.getPrevCVD(symbol),
      OI: oiChange.current,
      prevOI: oiChange.prev,
      trendScore: trendScore,
      obi: obi,
      obiZ: obiZ,
      cvdZ: cvdZ,
      volRatio: volRatio,
      delta15: delta15,
      priceDropPct: priceDropPct,
      atr15: atr15,
      oiChange: oiChange.change,
      volume24h: currentVolume,
      lastVol: klines[klines.length - 1]?.volume || 0
    };
    
    return metrics;
  }
  
  /**
   * 计算CVD
   */
  calculateCVD(klines) {
    let cvd = 0;
    
    for (const kline of klines) {
      // 简化计算：假设价格上涨时买方主导，价格下跌时卖方主导
      const priceChange = (kline.close - kline.open) / kline.open;
      const volume = kline.volume;
      
      if (priceChange > 0) {
        cvd += volume;
      } else if (priceChange < 0) {
        cvd -= volume;
      }
    }
    
    return cvd;
  }
  
  /**
   * 计算CVD Z-Score
   */
  calculateCVDZScore(klines, currentCVD) {
    const cvdValues = [];
    let runningCVD = 0;
    
    for (const kline of klines) {
      const priceChange = (kline.close - kline.open) / kline.open;
      const volume = kline.volume;
      
      if (priceChange > 0) {
        runningCVD += volume;
      } else if (priceChange < 0) {
        runningCVD -= volume;
      }
      
      cvdValues.push(runningCVD);
    }
    
    const mean = cvdValues.reduce((a, b) => a + b, 0) / cvdValues.length;
    const variance = cvdValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / cvdValues.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return 0;
    
    return (currentCVD - mean) / stdDev;
  }
  
  /**
   * 计算OBI
   */
  calculateOBI(orderBook) {
    if (!orderBook || !orderBook.bids || !orderBook.asks) {
      return 0;
    }
    
    const bidVolume = orderBook.bids.reduce((sum, bid) => sum + bid.qty, 0);
    const askVolume = orderBook.asks.reduce((sum, ask) => sum + ask.qty, 0);
    
    if (bidVolume + askVolume === 0) return 0;
    
    return (bidVolume - askVolume) / (bidVolume + askVolume);
  }
  
  /**
   * 计算OBI Z-Score
   */
  calculateOBIZScore(klines, currentOBI) {
    // 简化实现，实际应该基于历史OBI数据
    return currentOBI;
  }
  
  /**
   * 计算成交量平均值
   */
  calculateVolAvg(klines) {
    if (klines.length === 0) return 0;
    
    const window = Math.min(this.options.volAvgWindow, klines.length);
    const recentKlines = klines.slice(-window);
    
    const sum = recentKlines.reduce((acc, kline) => acc + kline.volume, 0);
    return sum / recentKlines.length;
  }
  
  /**
   * 计算Delta（15分钟）
   */
  calculateDelta15(klines) {
    if (klines.length < 15) return 0;
    
    const recent15 = klines.slice(-15);
    let delta = 0;
    
    for (const kline of recent15) {
      const priceChange = (kline.close - kline.open) / kline.open;
      const volume = kline.volume;
      
      if (priceChange > 0) {
        delta += volume;
      } else if (priceChange < 0) {
        delta -= volume;
      }
    }
    
    return delta;
  }
  
  /**
   * 计算价格跌幅
   */
  calculatePriceDropPct(klines) {
    if (klines.length < 2) return 0;
    
    const currentPrice = klines[klines.length - 1].close;
    const prevPrice = klines[klines.length - 2].close;
    
    return (currentPrice - prevPrice) / prevPrice;
  }
  
  /**
   * 计算ATR（15分钟）
   */
  calculateATR15(klines) {
    if (klines.length < 15) return 0;
    
    const recent15 = klines.slice(-15);
    let trSum = 0;
    
    for (let i = 1; i < recent15.length; i++) {
      const prev = recent15[i - 1];
      const curr = recent15[i];
      
      const hl = curr.high - curr.low;
      const hc = Math.abs(curr.high - prev.close);
      const lc = Math.abs(curr.low - prev.close);
      
      trSum += Math.max(hl, hc, lc);
    }
    
    return trSum / (recent15.length - 1);
  }
  
  /**
   * 计算持仓量变化
   */
  calculateOIChange(symbol) {
    // 简化实现，实际应该从数据库或API获取
    return {
      current: 0,
      prev: 0,
      change: 0
    };
  }
  
  /**
   * 计算趋势得分
   */
  calculateTrendScore(klines) {
    if (klines.length < 50) return 50;
    
    const closes = klines.slice(-50).map(k => k.close);
    const ema20 = TechnicalIndicators.calculateEMA(closes, 20);
    const ema50 = TechnicalIndicators.calculateEMA(closes, 50);
    
    if (ema20 > ema50) {
      return 60 + (ema20 - ema50) / ema50 * 40;
    } else {
      return 40 + (ema50 - ema20) / ema50 * 40;
    }
  }
  
  /**
   * 获取前一个CVD值
   */
  getPrevCVD(symbol) {
    const cache = this.dataCache.get(symbol);
    if (!cache || !cache.klines || cache.klines.length < 2) {
      return 0;
    }
    
    // 计算前一个CVD
    const prevKlines = cache.klines.slice(0, -1);
    return this.calculateCVD(prevKlines);
  }
}

module.exports = {
  RealtimeMetricsCollector
};

