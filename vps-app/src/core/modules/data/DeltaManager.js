const WebSocket = require('ws');

/**
 * Delta数据管理器 - 实时获取买卖盘不平衡数据
 * 按照strategy-v2.md中的Delta计算逻辑实现
 */
class DeltaManager {
  constructor() {
    this.deltaData = new Map(); // 存储每个交易对的Delta数据
    this.connections = new Map(); // 存储WebSocket连接
    this.isRunning = false;
  }

  /**
   * 启动Delta数据收集
   * @param {Array} symbols - 交易对列表
   */
  async start(symbols) {
    if (this.isRunning) {
      console.log('Delta数据收集已在运行中');
      return;
    }

    this.isRunning = true;
    console.log('🚀 启动Delta数据实时收集...');

    for (const symbol of symbols) {
      await this.startSymbolDelta(symbol);
    }

    console.log(`✅ Delta数据收集已启动，监控 ${symbols.length} 个交易对`);
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
        imbalance: 0
      });

      // 连接aggTrade WebSocket
      const tradeWs = new WebSocket(`wss://fstream.binance.com/ws/${symbolLower}@aggTrade`);

      tradeWs.on('open', () => {
        console.log(`📊 Delta WebSocket已连接: ${symbol}`);
      });

      tradeWs.on('message', (data) => {
        try {
          const trade = JSON.parse(data);
          this.updateDeltaData(symbol, trade);
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
   * 更新Delta数据
   * @param {string} symbol - 交易对
   * @param {Object} trade - 交易数据
   */
  updateDeltaData(symbol, trade) {
    const currentData = this.deltaData.get(symbol) || { deltaBuy: 0, deltaSell: 0 };
    const qty = parseFloat(trade.q);

    if (trade.m === false) {
      // 买方主动（taker是买）
      currentData.deltaBuy += qty;
    } else {
      // 卖方主动（taker是卖）
      currentData.deltaSell += qty;
    }

    // 计算买卖盘不平衡
    if (currentData.deltaSell > 0) {
      currentData.imbalance = currentData.deltaBuy / currentData.deltaSell;
    } else {
      currentData.imbalance = currentData.deltaBuy > 0 ? Infinity : 0;
    }

    currentData.lastUpdate = Date.now();
    this.deltaData.set(symbol, currentData);
  }

  /**
   * 获取Delta数据
   * @param {string} symbol - 交易对
   * @param {string} interval - 时间级别（兼容V3策略）
   * @returns {Object} Delta数据
   */
  getDeltaData(symbol, interval = '1h') {
    const data = this.deltaData.get(symbol) || {
      deltaBuy: 0,
      deltaSell: 0,
      lastUpdate: 0,
      imbalance: 0
    };

    // 计算Delta不平衡值
    const delta = data.deltaSell > 0 ? data.deltaBuy / data.deltaSell : 0;

    return {
      ...data,
      delta: delta,
      delta15m: delta, // 简化处理，15分钟和1小时使用相同值
      delta1h: delta
    };
  }

  /**
   * 获取所有Delta数据
   * @returns {Map} 所有Delta数据
   */
  getAllDeltaData() {
    return this.deltaData;
  }

  /**
   * 重置Delta数据（定期重置避免无限累积）
   * @param {string} symbol - 交易对
   */
  resetDeltaData(symbol) {
    const currentData = this.deltaData.get(symbol);
    if (currentData) {
      currentData.deltaBuy = 0;
      currentData.deltaSell = 0;
      currentData.imbalance = 0;
      currentData.lastUpdate = Date.now();
      this.deltaData.set(symbol, currentData);
    }
  }

  /**
   * 重置所有Delta数据
   */
  resetAllDeltaData() {
    for (const symbol of this.deltaData.keys()) {
      this.resetDeltaData(symbol);
    }
  }

  /**
   * 停止Delta数据收集
   */
  stop() {
    this.isRunning = false;

    for (const [symbol, ws] of this.connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }

    this.connections.clear();
    console.log('🛑 Delta数据收集已停止');
  }

  /**
   * 添加新的交易对
   * @param {string} symbol - 交易对
   */
  async addSymbol(symbol) {
    if (!this.connections.has(symbol)) {
      await this.startSymbolDelta(symbol);
    }
  }

  /**
   * 移除交易对
   * @param {string} symbol - 交易对
   */
  removeSymbol(symbol) {
    const ws = this.connections.get(symbol);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    this.connections.delete(symbol);
    this.deltaData.delete(symbol);
  }
}

module.exports = DeltaManager;
