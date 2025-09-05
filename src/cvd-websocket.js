/**
 * WebSocket CVD (Cumulative Volume Delta) 实时计算模块
 * 用于替代REST API中缺失的CVD数据
 */

export class CVDWebSocket {
  constructor(symbols = ['BTCUSDT', 'ETHUSDT', 'LINKUSDT', 'LDOUSDT']) {
    this.symbols = symbols;
    this.connections = new Map();
    this.cvdData = new Map();
    this.isConnected = false;
  }

  /**
   * 启动所有交易对的WebSocket连接
   */
  async start() {
    console.log('🔌 启动CVD WebSocket连接...');

    for (const symbol of this.symbols) {
      try {
        await this.connectSymbol(symbol);
        // 避免连接过于频繁
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ ${symbol} WebSocket连接失败:`, error.message);
      }
    }

    this.isConnected = true;
    console.log(`✅ CVD WebSocket已启动，监控 ${this.symbols.length} 个交易对`);
  }

  /**
   * 连接单个交易对的WebSocket
   */
  async connectSymbol(symbol) {
    return new Promise((resolve, reject) => {
      const wsUrl = `wss://fstream.binance.com/ws/${symbol.toLowerCase()}@aggTrade`;
      console.log(`连接 ${symbol}: ${wsUrl}`);

      const ws = new WebSocket(wsUrl);

      // 初始化CVD数据
      this.cvdData.set(symbol, {
        cvd: 0,
        totalBuyVolume: 0,
        totalSellVolume: 0,
        lastUpdate: Date.now(),
        tradeCount: 0
      });

      ws.onopen = () => {
        console.log(`✅ ${symbol} WebSocket连接成功`);
        this.connections.set(symbol, ws);
        resolve();
      };

      ws.onmessage = (event) => {
        try {
          const trade = JSON.parse(event.data);
          this.updateCVD(symbol, trade);
        } catch (error) {
          console.error(`❌ ${symbol} 消息解析错误:`, error.message);
        }
      };

      ws.onclose = (event) => {
        console.log(`⚠️ ${symbol} WebSocket连接关闭:`, event.code, event.reason);
        this.connections.delete(symbol);

        // 自动重连
        if (this.isConnected) {
          console.log(`🔄 ${symbol} 尝试重连...`);
          setTimeout(() => {
            this.connectSymbol(symbol).catch(console.error);
          }, 5000);
        }
      };

      ws.onerror = (error) => {
        console.error(`❌ ${symbol} WebSocket错误:`, error);
        reject(error);
      };

      // 连接超时
      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          reject(new Error('连接超时'));
        }
      }, 10000);
    });
  }

  /**
   * 更新CVD数据
   */
  updateCVD(symbol, trade) {
    const data = this.cvdData.get(symbol);
    if (!data) return;

    const qty = parseFloat(trade.q);
    const isBuyerMaker = trade.m; // true表示卖方主动成交（卖盘）

    if (isBuyerMaker) {
      // 卖方主动成交，CVD减少
      data.cvd -= qty;
      data.totalSellVolume += qty;
    } else {
      // 买方主动成交，CVD增加
      data.cvd += qty;
      data.totalBuyVolume += qty;
    }

    data.lastUpdate = Date.now();
    data.tradeCount++;

    // 每1000笔交易输出一次状态
    if (data.tradeCount % 1000 === 0) {
      console.log(`${symbol} CVD: ${data.cvd.toFixed(2)}, 交易数: ${data.tradeCount}`);
    }
  }

  /**
   * 获取指定交易对的CVD数据
   */
  getCVD(symbol) {
    const data = this.cvdData.get(symbol);
    if (!data) {
      return {
        cvd: 0,
        totalBuyVolume: 0,
        totalSellVolume: 0,
        lastUpdate: 0,
        tradeCount: 0,
        isActive: false
      };
    }

    const now = Date.now();
    const isActive = (now - data.lastUpdate) < 60000; // 1分钟内活跃

    return {
      ...data,
      isActive,
      buyRatio: data.totalBuyVolume / (data.totalBuyVolume + data.totalSellVolume) || 0
    };
  }

  /**
   * 获取所有交易对的CVD数据
   */
  getAllCVD() {
    const result = {};
    for (const symbol of this.symbols) {
      result[symbol] = this.getCVD(symbol);
    }
    return result;
  }

  /**
   * 获取CVD方向（用于策略判断）
   */
  getCVDDirection(symbol) {
    const data = this.getCVD(symbol);
    if (!data.isActive) {
      return 'INACTIVE';
    }

    if (data.cvd > 0) {
      return 'BULLISH'; // 买盘主导
    } else if (data.cvd < 0) {
      return 'BEARISH'; // 卖盘主导
    } else {
      return 'NEUTRAL'; // 平衡
    }
  }

  /**
   * 停止所有WebSocket连接
   */
  stop() {
    console.log('🛑 停止CVD WebSocket连接...');
    this.isConnected = false;

    for (const [symbol, ws] of this.connections) {
      try {
        ws.close();
        console.log(`✅ ${symbol} WebSocket已关闭`);
      } catch (error) {
        console.error(`❌ 关闭 ${symbol} WebSocket失败:`, error.message);
      }
    }

    this.connections.clear();
    console.log('✅ 所有CVD WebSocket连接已停止');
  }

  /**
   * 获取连接状态
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      activeConnections: this.connections.size,
      totalSymbols: this.symbols.length,
      cvdData: this.getAllCVD()
    };
  }
}

// 单例模式，便于在Worker中使用
let cvdInstance = null;

export function getCVDInstance(symbols) {
  if (!cvdInstance) {
    cvdInstance = new CVDWebSocket(symbols);
  }
  return cvdInstance;
}

export function startCVD(symbols) {
  const instance = getCVDInstance(symbols);
  return instance.start();
}

export function stopCVD() {
  if (cvdInstance) {
    cvdInstance.stop();
    cvdInstance = null;
  }
}

export function getCVDData(symbol) {
  if (!cvdInstance) return null;
  return cvdInstance.getCVD(symbol);
}

export function getCVDDirection(symbol) {
  if (!cvdInstance) return 'INACTIVE';
  return cvdInstance.getCVDDirection(symbol);
}
