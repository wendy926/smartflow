/**
 * WebSocket管理器 - 管理Binance Depth WebSocket连接
 * 使用 wss://stream.binance.com:9443/ws/{symbol_lower}@depth@100ms
 * 
 * @module WebSocketManager
 */

const WebSocket = require('ws');
const logger = require('../../utils/logger');

class WebSocketManager {
  constructor() {
    this.connections = new Map(); // symbol -> { ws, orderbook, status }
    this.baseURL = 'wss://stream.binance.com:9443/ws';
    this.reconnectDelay = 5000; // 5秒重连延迟
    this.reconnectAttempts = new Map(); // symbol -> attemptCount
  }

  /**
   * 订阅交易对的depth流
   * @param {string} symbol - 交易对（如BTCUSDT）
   * @param {Function} onDepthUpdate - 深度更新回调函数
   */
  subscribe(symbol, onDepthUpdate) {
    if (this.connections.has(symbol)) {
      logger.warn(`[WebSocketManager] ${symbol} 已订阅，跳过`);
      return;
    }

    const symbolLower = symbol.toLowerCase();
    const wsURL = `${this.baseURL}/${symbolLower}@depth@100ms`;
    
    logger.info(`[WebSocketManager] 订阅 ${symbol} depth流`, { wsURL });
    
    const ws = new WebSocket(wsURL);
    
    const connection = {
      ws,
      orderbook: { bids: [], asks: [] },
      status: 'connecting',
      lastUpdate: null
    };
    
    this.connections.set(symbol, connection);
    this.reconnectAttempts.set(symbol, 0);

    // WebSocket事件处理
    ws.on('open', () => {
      logger.info(`[WebSocketManager] ${symbol} WebSocket已连接`);
      connection.status = 'connected';
      this.reconnectAttempts.set(symbol, 0);
    });

    ws.on('message', (data) => {
      try {
        const depth = JSON.parse(data);
        
        // Binance depth@100ms格式：
        // {
        //   "e": "depthUpdate",
        //   "E": 123456789,
        //   "s": "BTCUSDT",
        //   "U": 157,
        //   "u": 160,
        //   "b": [["0.0024", "10"]],  // bids
        //   "a": [["0.0026", "100"]]  // asks
        // }
        
        if (depth.e === 'depthUpdate') {
          // 更新本地orderbook
          this._updateOrderbook(connection.orderbook, depth);
          connection.lastUpdate = Date.now();
          
          // 调用回调函数
          if (onDepthUpdate) {
            onDepthUpdate(symbol, connection.orderbook, depth.E);
          }
        }
      } catch (error) {
        logger.error(`[WebSocketManager] ${symbol} 消息解析失败`, { error: error.message });
      }
    });

    ws.on('error', (error) => {
      logger.error(`[WebSocketManager] ${symbol} WebSocket错误`, { error: error.message });
      connection.status = 'error';
    });

    ws.on('close', () => {
      logger.warn(`[WebSocketManager] ${symbol} WebSocket已断开`);
      connection.status = 'closed';
      this.connections.delete(symbol);
      
      // 自动重连
      this._scheduleReconnect(symbol, onDepthUpdate);
    });
  }

  /**
   * 更新本地orderbook（增量更新）
   * @private
   */
  _updateOrderbook(orderbook, depthUpdate) {
    // 更新bids
    for (const [price, qty] of depthUpdate.b) {
      const priceNum = parseFloat(price);
      const qtyNum = parseFloat(qty);
      
      if (qtyNum === 0) {
        // 删除该价位
        orderbook.bids = orderbook.bids.filter(([p]) => parseFloat(p) !== priceNum);
      } else {
        // 更新或添加
        const existingIndex = orderbook.bids.findIndex(([p]) => parseFloat(p) === priceNum);
        if (existingIndex >= 0) {
          orderbook.bids[existingIndex] = [price, qty];
        } else {
          orderbook.bids.push([price, qty]);
        }
      }
    }
    
    // 更新asks
    for (const [price, qty] of depthUpdate.a) {
      const priceNum = parseFloat(price);
      const qtyNum = parseFloat(qty);
      
      if (qtyNum === 0) {
        // 删除该价位
        orderbook.asks = orderbook.asks.filter(([p]) => parseFloat(p) !== priceNum);
      } else {
        // 更新或添加
        const existingIndex = orderbook.asks.findIndex(([p]) => parseFloat(p) === priceNum);
        if (existingIndex >= 0) {
          orderbook.asks[existingIndex] = [price, qty];
        } else {
          orderbook.asks.push([price, qty]);
        }
      }
    }
    
    // 排序（bids降序，asks升序）
    orderbook.bids.sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]));
    orderbook.asks.sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]));
    
    // 限制深度（保留前1000档）
    orderbook.bids = orderbook.bids.slice(0, 1000);
    orderbook.asks = orderbook.asks.slice(0, 1000);
  }

  /**
   * 安排重连
   * @private
   */
  _scheduleReconnect(symbol, onDepthUpdate) {
    const attempts = this.reconnectAttempts.get(symbol) || 0;
    
    if (attempts >= 10) {
      logger.error(`[WebSocketManager] ${symbol} 重连失败次数过多，放弃重连`);
      this.reconnectAttempts.delete(symbol);
      return;
    }
    
    this.reconnectAttempts.set(symbol, attempts + 1);
    
    const delay = this.reconnectDelay * Math.pow(1.5, attempts); // 指数退避
    logger.info(`[WebSocketManager] ${symbol} 将在 ${delay}ms 后重连（第${attempts + 1}次）`);
    
    setTimeout(() => {
      logger.info(`[WebSocketManager] ${symbol} 开始重连...`);
      this.subscribe(symbol, onDepthUpdate);
    }, delay);
  }

  /**
   * 取消订阅
   * @param {string} symbol - 交易对
   */
  unsubscribe(symbol) {
    const connection = this.connections.get(symbol);
    if (connection) {
      logger.info(`[WebSocketManager] 取消订阅 ${symbol}`);
      connection.ws.close();
      this.connections.delete(symbol);
      this.reconnectAttempts.delete(symbol);
    }
  }

  /**
   * 获取当前orderbook快照
   * @param {string} symbol - 交易对
   * @returns {Object|null} orderbook快照
   */
  getOrderbook(symbol) {
    const connection = this.connections.get(symbol);
    if (connection && connection.status === 'connected') {
      return {
        bids: [...connection.orderbook.bids],
        asks: [...connection.orderbook.asks],
        lastUpdate: connection.lastUpdate
      };
    }
    return null;
  }

  /**
   * 获取连接状态
   * @param {string} symbol - 交易对
   * @returns {string} 状态
   */
  getStatus(symbol) {
    const connection = this.connections.get(symbol);
    return connection ? connection.status : 'disconnected';
  }

  /**
   * 取消所有订阅
   */
  unsubscribeAll() {
    logger.info(`[WebSocketManager] 取消所有订阅`);
    for (const symbol of this.connections.keys()) {
      this.unsubscribe(symbol);
    }
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const stats = {
      totalConnections: this.connections.size,
      byStatus: {
        connected: 0,
        connecting: 0,
        error: 0,
        closed: 0
      }
    };
    
    for (const connection of this.connections.values()) {
      stats.byStatus[connection.status]++;
    }
    
    return stats;
  }
}

module.exports = WebSocketManager;

