/**
 * 通用交易系统 - 市场适配器接口
 * 定义所有市场适配器必须实现的接口
 */

const logger = require('../../utils/logger');

// 市场类型枚举
const MarketType = {
  CRYPTO: 'crypto',
  CN_STOCK: 'cn_stock',
  US_STOCK: 'us_stock'
};

// 时间框架枚举
const Timeframe = {
  MINUTE_1: '1m',
  MINUTE_5: '5m',
  MINUTE_15: '15m',
  MINUTE_30: '30m',
  HOUR_1: '1h',
  HOUR_4: '4h',
  DAY_1: '1d',
  WEEK_1: '1w',
  MONTH_1: '1M'
};

// 订单方向
const OrderSide = {
  BUY: 'BUY',
  SELL: 'SELL'
};

// 订单类型
const OrderType = {
  MARKET: 'MARKET',
  LIMIT: 'LIMIT',
  STOP: 'STOP',
  STOP_LIMIT: 'STOP_LIMIT'
};

// 订单状态
const OrderStatus = {
  NEW: 'NEW',
  PARTIALLY_FILLED: 'PARTIALLY_FILLED',
  FILLED: 'FILLED',
  CANCELLED: 'CANCELLED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED'
};

// 时间在力
const TimeInForce = {
  GTC: 'GTC', // Good Till Cancel
  IOC: 'IOC', // Immediate Or Cancel
  FOK: 'FOK'  // Fill Or Kill
};

/**
 * 市场信息接口
 */
class MarketInfo {
  constructor(marketType, tradingHours, symbols, timezone) {
    this.marketType = marketType;
    this.tradingHours = tradingHours;
    this.symbols = symbols;
    this.timezone = timezone;
  }
}

/**
 * 交易时间配置
 */
class TradingHours {
  constructor(timezone, sessions) {
    this.timezone = timezone;
    this.sessions = sessions; // [{ open: '09:30', close: '15:00', days: [1,2,3,4,5] }]
  }

  /**
   * 检查当前是否在交易时间内
   */
  isTradingTime() {
    const now = new Date();
    const currentDay = now.getDay(); // 0=Sunday, 1=Monday, ...
    const currentTime = now.toLocaleTimeString('en-US', {
      hour12: false,
      timeZone: this.timezone
    }).substring(0, 5);

    return this.sessions.some(session =>
      session.days.includes(currentDay) &&
      currentTime >= session.open &&
      currentTime <= session.close
    );
  }
}

/**
 * K线数据模型
 */
class Kline {
  constructor(timestamp, open, high, low, close, volume, symbol, timeframe, marketType) {
    this.timestamp = timestamp;
    this.open = open;
    this.high = high;
    this.low = low;
    this.close = close;
    this.volume = volume;
    this.symbol = symbol;
    this.timeframe = timeframe;
    this.marketType = marketType;
  }
}

/**
 * 市场指标数据模型
 */
class MarketMetrics {
  constructor(data = {}) {
    // 通用指标
    this.volume = data.volume || 0;
    this.turnover = data.turnover || 0;

    // 加密货币特有
    this.fundingRate = data.fundingRate;
    this.openInterest = data.openInterest;
    this.delta = data.delta;
    this.liquidation = data.liquidation;

    // A股特有
    this.financingBalance = data.financingBalance;
    this.northwardFunds = data.northwardFunds;
    this.volumeRatio = data.volumeRatio;
    this.peRatio = data.peRatio;

    // 美股特有
    this.putCallRatio = data.putCallRatio;
    this.optionOIChange = data.optionOIChange;
    this.institutionalFlow = data.institutionalFlow;
    this.vixIndex = data.vixIndex;
    this.shortInterest = data.shortInterest;
  }
}

/**
 * 订单请求模型
 */
class OrderRequest {
  constructor(symbol, side, type, quantity, price, stopPrice, timeInForce) {
    this.symbol = symbol;
    this.side = side;
    this.type = type;
    this.quantity = quantity;
    this.price = price;
    this.stopPrice = stopPrice;
    this.timeInForce = timeInForce || TimeInForce.GTC;
  }
}

/**
 * 订单响应模型
 */
class OrderResponse {
  constructor(orderId, symbol, status, filledQuantity, avgPrice, timestamp) {
    this.orderId = orderId;
    this.symbol = symbol;
    this.status = status;
    this.filledQuantity = filledQuantity;
    this.avgPrice = avgPrice;
    this.timestamp = timestamp;
  }
}

/**
 * 账户信息模型
 */
class Account {
  constructor(balance, positions, orders) {
    this.balance = balance;
    this.positions = positions || [];
    this.orders = orders || [];
  }
}

/**
 * 持仓信息模型
 */
class Position {
  constructor(symbol, side, quantity, entryPrice, unrealizedPnL, realizedPnL) {
    this.symbol = symbol;
    this.side = side;
    this.quantity = quantity;
    this.entryPrice = entryPrice;
    this.unrealizedPnL = unrealizedPnL;
    this.realizedPnL = realizedPnL;
  }
}

/**
 * 市场适配器接口
 * 所有市场适配器必须实现此接口
 */
class IExchangeAdapter {
  constructor() {
    if (this.constructor === IExchangeAdapter) {
      throw new Error('IExchangeAdapter is an abstract class and cannot be instantiated');
    }
  }

  /**
   * 获取市场信息
   * @returns {MarketInfo} 市场信息
   */
  getMarketInfo() {
    throw new Error('getMarketInfo method must be implemented');
  }

  /**
   * 获取K线数据
   * @param {string} symbol - 交易对
   * @param {string} timeframe - 时间框架
   * @param {number} limit - 数据条数
   * @returns {Promise<Kline[]>} K线数据数组
   */
  async getKlines(symbol, timeframe, limit = 500) {
    throw new Error('getKlines method must be implemented');
  }

  /**
   * 获取实时价格
   * @param {string} symbol - 交易对
   * @returns {Promise<number>} 当前价格
   */
  async getTicker(symbol) {
    throw new Error('getTicker method must be implemented');
  }

  /**
   * 获取订单簿
   * @param {string} symbol - 交易对
   * @returns {Promise<Object>} 订单簿数据
   */
  async getOrderBook(symbol) {
    throw new Error('getOrderBook method must be implemented');
  }

  /**
   * 下单
   * @param {OrderRequest} order - 订单请求
   * @returns {Promise<OrderResponse>} 订单响应
   */
  async placeOrder(order) {
    throw new Error('placeOrder method must be implemented');
  }

  /**
   * 取消订单
   * @param {string} orderId - 订单ID
   * @returns {Promise<boolean>} 是否成功
   */
  async cancelOrder(orderId) {
    throw new Error('cancelOrder method must be implemented');
  }

  /**
   * 获取订单列表
   * @param {string} symbol - 交易对（可选）
   * @returns {Promise<OrderResponse[]>} 订单列表
   */
  async getOrders(symbol) {
    throw new Error('getOrders method must be implemented');
  }

  /**
   * 获取账户信息
   * @returns {Promise<Account>} 账户信息
   */
  async getAccount() {
    throw new Error('getAccount method must be implemented');
  }

  /**
   * 获取持仓信息
   * @param {string} symbol - 交易对（可选）
   * @returns {Promise<Position[]>} 持仓列表
   */
  async getPositions(symbol) {
    throw new Error('getPositions method must be implemented');
  }

  /**
   * 获取市场指标
   * @param {string} symbol - 交易对
   * @returns {Promise<MarketMetrics>} 市场指标
   */
  async getMarketMetrics(symbol) {
    throw new Error('getMarketMetrics method must be implemented');
  }

  /**
   * 检查是否在交易时间内
   * @returns {boolean} 是否在交易时间内
   */
  isTradingTime() {
    return this.getMarketInfo().tradingHours.isTradingTime();
  }

  /**
   * 验证交易对是否支持
   * @param {string} symbol - 交易对
   * @returns {boolean} 是否支持
   */
  isSymbolSupported(symbol) {
    return this.getMarketInfo().symbols.includes(symbol);
  }
}

module.exports = {
  IExchangeAdapter,
  MarketType,
  Timeframe,
  OrderSide,
  OrderType,
  OrderStatus,
  TimeInForce,
  MarketInfo,
  TradingHours,
  Kline,
  MarketMetrics,
  OrderRequest,
  OrderResponse,
  Account,
  Position,
  IExchangeAdapter
};
