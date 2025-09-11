const WebSocket = require('ws');

/**
 * Delta实时计算管理器
 * 按照strategy-v3.md实现不同时间级别的Delta平滑处理
 */
class DeltaRealTimeManager {
  constructor() {
    this.deltaData = new Map(); // 存储各交易对的Delta数据
    this.connections = new Map(); // 存储WebSocket连接
    this.trades = new Map(); // 存储原始交易数据
    this.isRunning = false;
    
    // 15分钟Delta平滑配置
    this.delta15m = new Map(); // 15分钟Delta数据
    this.ema15mPeriod = 3; // EMA(3)平滑
    
    // 1小时Delta平滑配置
    this.delta1h = new Map(); // 1小时Delta数据
    this.ema1hPeriod = 6; // EMA(6)平滑
    
    // 定时器ID存储
    this.timer15m = null;
    this.timer1h = null;
  }

  /**
   * 启动Delta数据收集
   * @param {Array} symbols - 交易对列表
   */
  async start(symbols) {
    this.isRunning = true;
    console.log(`🚀 启动Delta实时计算管理器，监控 ${symbols.length} 个交易对`);
    
    // 启动定时器
    this.startTimers();
    
    for (const symbol of symbols) {
      await this.startSymbolDelta(symbol);
    }
  }

  /**
   * 为单个交易对启动Delta数据收集
   * @param {string} symbol - 交易对
   */
  async startSymbolDelta(symbol) {
    try {
      const symbolLower = symbol.toLowerCase();

      // 初始化Delta数据
      this.deltaData.set(symbol, {
        deltaBuy: 0,
        deltaSell: 0,
        lastUpdate: Date.now(),
        imbalance: 0,
        delta15m: 0,
        delta1h: 0
      });

      // 初始化时间级别数据
      this.delta15m.set(symbol, []);
      this.delta1h.set(symbol, []);
      this.trades.set(symbol, []);

      // 连接aggTrade WebSocket
      const tradeWs = new WebSocket(`wss://fstream.binance.com/ws/${symbolLower}@aggTrade`);

      tradeWs.on('open', () => {
        console.log(`📊 Delta WebSocket已连接: ${symbol}`);
      });

      tradeWs.on('message', (data) => {
        try {
          const trade = JSON.parse(data);
          this.processTrade(symbol, trade);
        } catch (error) {
          console.error(`Delta数据处理失败 ${symbol}:`, error);
        }
      });

      tradeWs.on('error', (error) => {
        console.error(`Delta WebSocket错误 ${symbol}:`, error);
      });

      tradeWs.on('close', () => {
        console.log(`Delta WebSocket已断开: ${symbol}`);
        // 尝试重连
        setTimeout(() => {
          if (this.isRunning) {
            this.startSymbolDelta(symbol);
          }
        }, 5000);
      });

      this.connections.set(symbol, tradeWs);

    } catch (error) {
      console.error(`启动Delta数据收集失败 ${symbol}:`, error);
    }
  }

  /**
   * 处理交易数据
   * @param {string} symbol - 交易对
   * @param {Object} trade - 交易数据
   */
  processTrade(symbol, trade) {
    const trades = this.trades.get(symbol) || [];

    // 添加交易记录
    trades.push({
      T: trade.T,  // 成交时间
      q: trade.q,  // 成交数量
      p: trade.p,  // 成交价格
      maker: trade.m // true=买方是maker（卖单主动），false=卖方是maker（买单主动）
    });

    // 保留最近1小时的交易数据
    const cutoff = Date.now() - 60 * 60 * 1000;
    const filteredTrades = trades.filter(t => t.T >= cutoff);
    this.trades.set(symbol, filteredTrades);

    // 更新实时Delta数据
    this.updateRealTimeDelta(symbol, trade);
  }

  /**
   * 更新实时Delta数据
   * @param {string} symbol - 交易对
   * @param {Object} trade - 交易数据
   */
  updateRealTimeDelta(symbol, trade) {
    const deltaData = this.deltaData.get(symbol);
    if (!deltaData) return;

    const quantity = parseFloat(trade.q);

    if (trade.m) {
      // maker = true 表示买方被动成交 → 主动卖单
      deltaData.deltaSell += quantity;
    } else {
      // maker = false 表示卖方被动成交 → 主动买单
      deltaData.deltaBuy += quantity;
    }

    const total = deltaData.deltaBuy + deltaData.deltaSell;
    deltaData.imbalance = total > 0 ? (deltaData.deltaBuy - deltaData.deltaSell) / total : 0;
    deltaData.lastUpdate = Date.now();
  }

  /**
   * 计算聚合Delta
   * @param {Array} tradeList - 交易列表
   * @returns {number} Delta值 (-1到+1之间)
   */
  calcDelta(tradeList) {
    let buy = 0, sell = 0;
    for (let t of tradeList) {
      if (t.maker) {
        // maker = true 表示买方被动成交 → 主动卖单
        sell += parseFloat(t.q);
      } else {
        // maker = false 表示卖方被动成交 → 主动买单
        buy += parseFloat(t.q);
      }
    }
    let total = buy + sell;
    if (total === 0) return 0;
    return (buy - sell) / total; // -1~+1 之间
  }

  /**
   * 计算EMA
   * @param {Array} values - 数值数组
   * @param {number} period - 周期
   * @returns {number|null} EMA值
   */
  calculateEMA(values, period) {
    if (values.length === 0) return null;
    let k = 2 / (period + 1);
    return values.reduce((prev, curr, i) => {
      if (i === 0) return curr;
      return curr * k + prev * (1 - k);
    });
  }

  /**
   * 处理15分钟Delta聚合
   * @param {string} symbol - 交易对
   */
  process15mDelta(symbol) {
    const trades = this.trades.get(symbol) || [];
    const now = Date.now();
    const cutoff = now - 15 * 60 * 1000; // 15分钟前

    // 筛选15分钟窗口内的交易
    const windowTrades = trades.filter(t => t.T >= cutoff);
    const rawDelta = this.calcDelta(windowTrades);

    // 添加到15分钟Delta数组
    const delta15mArray = this.delta15m.get(symbol) || [];
    delta15mArray.push(rawDelta);
    if (delta15mArray.length > 20) delta15mArray.shift(); // 保留最近20个周期
    this.delta15m.set(symbol, delta15mArray);

    // EMA(3)平滑处理
    const smoothedDelta = this.calculateEMA(delta15mArray, this.ema15mPeriod);

    // 更新Delta数据
    const deltaData = this.deltaData.get(symbol);
    if (deltaData && smoothedDelta !== null) {
      deltaData.delta15m = smoothedDelta;
    }

    console.log(`[${symbol} 15m Delta] 原始=${rawDelta.toFixed(4)} 平滑=${smoothedDelta?.toFixed(4)}`);
  }

  /**
   * 处理1小时Delta聚合
   * @param {string} symbol - 交易对
   */
  process1hDelta(symbol) {
    const trades = this.trades.get(symbol) || [];
    const now = Date.now();
    const cutoff = now - 60 * 60 * 1000; // 1小时前

    // 筛选1小时窗口内的交易
    const windowTrades = trades.filter(t => t.T >= cutoff);
    const rawDelta = this.calcDelta(windowTrades);

    // 添加到1小时Delta数组
    const delta1hArray = this.delta1h.get(symbol) || [];
    delta1hArray.push(rawDelta);
    if (delta1hArray.length > 20) delta1hArray.shift(); // 保留最近20个周期
    this.delta1h.set(symbol, delta1hArray);

    // EMA(6)平滑处理
    const smoothedDelta = this.calculateEMA(delta1hArray, this.ema1hPeriod);

    // 更新Delta数据
    const deltaData = this.deltaData.get(symbol);
    if (deltaData && smoothedDelta !== null) {
      deltaData.delta1h = smoothedDelta;
    }

    console.log(`[${symbol} 1h Delta] 原始=${rawDelta.toFixed(4)} 平滑=${smoothedDelta?.toFixed(4)}`);
  }

  /**
   * 启动定时器
   */
  startTimers() {
    // 清理现有定时器
    this.stopTimers();
    
    // 15分钟Delta聚合定时器
    this.timer15m = setInterval(() => {
      if (this.isRunning) {
        for (const symbol of this.deltaData.keys()) {
          this.process15mDelta(symbol);
        }
      }
    }, 15 * 60 * 1000); // 每15分钟

    // 1小时Delta聚合定时器
    this.timer1h = setInterval(() => {
      if (this.isRunning) {
        for (const symbol of this.deltaData.keys()) {
          this.process1hDelta(symbol);
        }
      }
    }, 60 * 60 * 1000); // 每1小时
  }

  /**
   * 停止定时器
   */
  stopTimers() {
    if (this.timer15m) {
      clearInterval(this.timer15m);
      this.timer15m = null;
    }
    if (this.timer1h) {
      clearInterval(this.timer1h);
      this.timer1h = null;
    }
  }

  /**
   * 获取Delta数据
   * @param {string} symbol - 交易对
   * @param {string} type - 类型：'realtime', '15m', '1h'
   * @returns {Object} Delta数据
   */
  getDeltaData(symbol, type = 'realtime') {
    const deltaData = this.deltaData.get(symbol);
    if (!deltaData) return null;

    switch (type) {
      case '15m':
        return {
          delta: deltaData.delta15m,
          lastUpdate: deltaData.lastUpdate
        };
      case '1h':
        return {
          delta: deltaData.delta1h,
          lastUpdate: deltaData.lastUpdate
        };
      case 'realtime':
      default:
        return {
          deltaBuy: deltaData.deltaBuy,
          deltaSell: deltaData.deltaSell,
          imbalance: deltaData.imbalance,
          lastUpdate: deltaData.lastUpdate
        };
    }
  }

  /**
   * 停止Delta数据收集
   */
  stop() {
    this.isRunning = false;
    
    // 停止定时器
    this.stopTimers();
    
    // 关闭所有WebSocket连接
    for (const [symbol, ws] of this.connections) {
      ws.close();
      console.log(`Delta WebSocket已关闭: ${symbol}`);
    }
    
    this.connections.clear();
    this.deltaData.clear();
    this.delta15m.clear();
    this.delta1h.clear();
    this.trades.clear();
    
    console.log('Delta实时计算管理器已停止');
  }

  /**
   * 获取所有交易对的Delta统计
   * @returns {Object} 统计信息
   */
  getStats() {
    const stats = {
      totalSymbols: this.deltaData.size,
      activeConnections: this.connections.size,
      symbols: []
    };

    for (const [symbol, data] of this.deltaData) {
      stats.symbols.push({
        symbol,
        deltaBuy: data.deltaBuy,
        deltaSell: data.deltaSell,
        imbalance: data.imbalance,
        delta15m: data.delta15m,
        delta1h: data.delta1h,
        lastUpdate: data.lastUpdate
      });
    }

    return stats;
  }
}

module.exports = DeltaRealTimeManager;
