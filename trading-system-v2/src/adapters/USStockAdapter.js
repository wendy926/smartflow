/**
 * 美股市场适配器
 * 实现美股市场交易接口，集成Alpaca和Alpha Vantage API
 */

const { IExchangeAdapter, MarketType, Timeframe, OrderSide, OrderType, OrderStatus, TimeInForce, MarketInfo, TradingHours, Kline, MarketMetrics, OrderRequest, OrderResponse, Account, Position } = require('../core/interfaces/IExchangeAdapter');
const logger = require('../utils/logger');

class USStockAdapter extends IExchangeAdapter {
  constructor(config) {
    super();
    this.config = config;
    
    // 初始化数据源API
    this.alpacaAPI = new AlpacaAPI(config.alpaca);
    this.alphaVantageAPI = new AlphaVantageAPI(config.alphaVantage);
    this.yahooFinanceAPI = new YahooFinanceAPI(config.yahooFinance);
    
    // 市场信息
    this.marketInfo = new MarketInfo(
      MarketType.US_STOCK,
      new TradingHours('America/New_York', [
        { open: '09:30', close: '16:00', days: [1, 2, 3, 4, 5] } // 周一到周五
      ]),
      config.symbols || ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'],
      'America/New_York'
    );
  }

  /**
   * 获取市场信息
   */
  getMarketInfo() {
    return this.marketInfo;
  }

  /**
   * 获取K线数据
   */
  async getKlines(symbol, timeframe, limit = 500) {
    try {
      if (!this.isSymbolSupported(symbol)) {
        throw new Error(`Symbol ${symbol} is not supported`);
      }

      // 转换时间框架格式
      const alpacaTimeframe = this.convertTimeframe(timeframe);
      
      const data = await this.alpacaAPI.getBars(symbol, alpacaTimeframe, limit);
      
      return data.map(bar => new Kline(
        new Date(bar.t),          // timestamp
        parseFloat(bar.o),        // open
        parseFloat(bar.h),        // high
        parseFloat(bar.l),        // low
        parseFloat(bar.c),        // close
        parseFloat(bar.v),        // volume
        symbol,
        timeframe,
        MarketType.US_STOCK
      ));

    } catch (error) {
      logger.error(`[USStockAdapter] Failed to get klines for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 获取实时价格
   */
  async getTicker(symbol) {
    try {
      if (!this.isSymbolSupported(symbol)) {
        throw new Error(`Symbol ${symbol} is not supported`);
      }

      const ticker = await this.alpacaAPI.getLatestTrade(symbol);
      return parseFloat(ticker.price);

    } catch (error) {
      logger.error(`[USStockAdapter] Failed to get ticker for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 获取订单簿
   */
  async getOrderBook(symbol) {
    try {
      if (!this.isSymbolSupported(symbol)) {
        throw new Error(`Symbol ${symbol} is not supported`);
      }

      const orderBook = await this.alpacaAPI.getOrderBook(symbol);
      
      return {
        bids: orderBook.bids.map(bid => ({
          price: parseFloat(bid.price),
          quantity: parseFloat(bid.size)
        })),
        asks: orderBook.asks.map(ask => ({
          price: parseFloat(ask.price),
          quantity: parseFloat(ask.size)
        })),
        timestamp: new Date(orderBook.timestamp)
      };

    } catch (error) {
      logger.error(`[USStockAdapter] Failed to get order book for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 下单
   */
  async placeOrder(order) {
    try {
      if (!this.isSymbolSupported(order.symbol)) {
        throw new Error(`Symbol ${order.symbol} is not supported`);
      }

      if (!this.isTradingTime()) {
        throw new Error('Market is closed');
      }

      const orderParams = {
        symbol: order.symbol,
        qty: order.quantity,
        side: order.side.toLowerCase(),
        type: order.type.toLowerCase(),
        time_in_force: order.timeInForce?.toLowerCase() || 'day'
      };

      // 添加价格相关参数
      if (order.type === OrderType.LIMIT || order.type === OrderType.STOP_LIMIT) {
        orderParams.limit_price = order.price;
      }

      if (order.type === OrderType.STOP || order.type === OrderType.STOP_LIMIT) {
        orderParams.stop_price = order.stopPrice;
      }

      const response = await this.alpacaAPI.placeOrder(orderParams);

      return new OrderResponse(
        response.id,
        order.symbol,
        response.status.toUpperCase(),
        parseFloat(response.filled_qty || 0),
        parseFloat(response.filled_avg_price || 0),
        new Date(response.created_at)
      );

    } catch (error) {
      logger.error(`[USStockAdapter] Failed to place order:`, error);
      throw error;
    }
  }

  /**
   * 取消订单
   */
  async cancelOrder(orderId) {
    try {
      const response = await this.alpacaAPI.cancelOrder(orderId);
      return response.status === 'cancelled';

    } catch (error) {
      logger.error(`[USStockAdapter] Failed to cancel order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * 获取订单列表
   */
  async getOrders(symbol) {
    try {
      const orders = await this.alpacaAPI.getOrders(symbol);
      
      return orders.map(order => new OrderResponse(
        order.id,
        order.symbol,
        order.status.toUpperCase(),
        parseFloat(order.filled_qty || 0),
        parseFloat(order.filled_avg_price || 0),
        new Date(order.created_at)
      ));

    } catch (error) {
      logger.error(`[USStockAdapter] Failed to get orders:`, error);
      throw error;
    }
  }

  /**
   * 获取账户信息
   */
  async getAccount() {
    try {
      const accountInfo = await this.alpacaAPI.getAccount();
      
      const balance = [
        {
          asset: 'USD',
          free: parseFloat(accountInfo.buying_power),
          locked: parseFloat(accountInfo.buying_power) - parseFloat(accountInfo.cash)
        }
      ];

      return new Account(balance, [], []);

    } catch (error) {
      logger.error(`[USStockAdapter] Failed to get account:`, error);
      throw error;
    }
  }

  /**
   * 获取持仓信息
   */
  async getPositions(symbol) {
    try {
      const positions = await this.alpacaAPI.getPositions(symbol);
      
      return positions.map(position => new Position(
        position.symbol,
        parseFloat(position.qty) > 0 ? OrderSide.BUY : OrderSide.SELL,
        Math.abs(parseFloat(position.qty)),
        parseFloat(position.avg_entry_price),
        parseFloat(position.unrealized_pl),
        parseFloat(position.realized_pl || 0)
      ));

    } catch (error) {
      logger.error(`[USStockAdapter] Failed to get positions:`, error);
      throw error;
    }
  }

  /**
   * 获取市场指标
   */
  async getMarketMetrics(symbol) {
    try {
      if (!this.isSymbolSupported(symbol)) {
        throw new Error(`Symbol ${symbol} is not supported`);
      }

      const [options, institutional, vix, shortInterest] = await Promise.all([
        this.alphaVantageAPI.getOptionsData(symbol).catch(() => ({ putCallRatio: 1, oiChange: 0 })),
        this.alphaVantageAPI.getInstitutionalFlow(symbol).catch(() => ({ netFlow: 0 })),
        this.alphaVantageAPI.getVIX().catch(() => ({ value: 20 })),
        this.yahooFinanceAPI.getShortInterest(symbol).catch(() => ({ shortInterest: 0 }))
      ]);

      return new MarketMetrics({
        volume: options.volume || 0,
        putCallRatio: options.putCallRatio,
        optionOIChange: options.oiChange,
        institutionalFlow: institutional.netFlow,
        vixIndex: vix.value,
        shortInterest: shortInterest.shortInterest
      });

    } catch (error) {
      logger.error(`[USStockAdapter] Failed to get market metrics for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 获取期权数据
   */
  async getOptionsData(symbol, limit = 100) {
    try {
      const optionsData = await this.alphaVantageAPI.getOptionsChain(symbol);
      
      return {
        symbol: symbol,
        putCallRatio: optionsData.putCallRatio,
        totalVolume: optionsData.totalVolume,
        openInterest: optionsData.openInterest,
        impliedVolatility: optionsData.impliedVolatility,
        timestamp: new Date(optionsData.timestamp)
      };

    } catch (error) {
      logger.error(`[USStockAdapter] Failed to get options data for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 获取机构资金流向
   */
  async getInstitutionalFlowData(symbol, limit = 100) {
    try {
      const flowData = await this.alphaVantageAPI.getInstitutionalFlowHistory(symbol, limit);
      
      return flowData.map(data => ({
        symbol: data.symbol,
        date: new Date(data.date),
        netFlow: parseFloat(data.netFlow),
        institutionalBuy: parseFloat(data.institutionalBuy),
        institutionalSell: parseFloat(data.institutionalSell),
        retailBuy: parseFloat(data.retailBuy),
        retailSell: parseFloat(data.retailSell)
      }));

    } catch (error) {
      logger.error(`[USStockAdapter] Failed to get institutional flow data for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 获取VIX恐慌指数
   */
  async getVIXData(limit = 100) {
    try {
      const vixData = await this.alphaVantageAPI.getVIXHistory(limit);
      
      return vixData.map(data => ({
        date: new Date(data.date),
        value: parseFloat(data.value),
        change: parseFloat(data.change),
        changePercent: parseFloat(data.changePercent)
      }));

    } catch (error) {
      logger.error(`[USStockAdapter] Failed to get VIX data:`, error);
      throw error;
    }
  }

  /**
   * 获取做空数据
   */
  async getShortInterestData(symbol, limit = 100) {
    try {
      const shortData = await this.yahooFinanceAPI.getShortInterestHistory(symbol, limit);
      
      return shortData.map(data => ({
        symbol: data.symbol,
        date: new Date(data.date),
        shortInterest: parseFloat(data.shortInterest),
        shortRatio: parseFloat(data.shortRatio),
        daysToCover: parseFloat(data.daysToCover)
      }));

    } catch (error) {
      logger.error(`[USStockAdapter] Failed to get short interest data for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 获取股票基本信息
   */
  async getStockBasicInfo(symbol) {
    try {
      const basicInfo = await this.yahooFinanceAPI.getStockInfo(symbol);
      
      return {
        symbol: basicInfo.symbol,
        name: basicInfo.longName,
        sector: basicInfo.sector,
        industry: basicInfo.industry,
        marketCap: parseFloat(basicInfo.marketCap || 0),
        peRatio: parseFloat(basicInfo.trailingPE || 0),
        pbRatio: parseFloat(basicInfo.priceToBook || 0),
        dividendYield: parseFloat(basicInfo.dividendYield || 0),
        beta: parseFloat(basicInfo.beta || 1),
        eps: parseFloat(basicInfo.trailingEps || 0)
      };

    } catch (error) {
      logger.error(`[USStockAdapter] Failed to get stock basic info for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 获取市场状态
   */
  async getMarketStatus() {
    try {
      const marketStatus = await this.alpacaAPI.getMarketStatus();
      
      return {
        isOpen: marketStatus.is_open,
        nextOpen: marketStatus.next_open ? new Date(marketStatus.next_open) : null,
        nextClose: marketStatus.next_close ? new Date(marketStatus.next_close) : null,
        timezone: marketStatus.timezone
      };

    } catch (error) {
      logger.error(`[USStockAdapter] Failed to get market status:`, error);
      throw error;
    }
  }

  /**
   * 转换时间框架格式
   */
  convertTimeframe(timeframe) {
    const timeframeMap = {
      [Timeframe.MINUTE_1]: '1Min',
      [Timeframe.MINUTE_5]: '5Min',
      [Timeframe.MINUTE_15]: '15Min',
      [Timeframe.MINUTE_30]: '30Min',
      [Timeframe.HOUR_1]: '1Hour',
      [Timeframe.HOUR_4]: '4Hour',
      [Timeframe.DAY_1]: '1Day',
      [Timeframe.WEEK_1]: '1Week',
      [Timeframe.MONTH_1]: '1Month'
    };

    return timeframeMap[timeframe] || '1Day';
  }

  /**
   * 检查交易时间（包含盘前盘后）
   */
  isTradingTime() {
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour12: false, 
      timeZone: 'America/New_York' 
    }).substring(0, 5);

    // 检查是否在交易日内
    if (currentDay === 0 || currentDay === 6) {
      return false;
    }

    // 检查是否在交易时间内（包含盘前盘后）
    const tradingSessions = [
      { open: '04:00', close: '09:30' }, // 盘前
      { open: '09:30', close: '16:00' }, // 正常交易
      { open: '16:00', close: '20:00' }  // 盘后
    ];

    return tradingSessions.some(session => 
      currentTime >= session.open && currentTime <= session.close
    );
  }

  /**
   * 获取交易日历
   */
  async getTradingCalendar(year, month) {
    try {
      const calendar = await this.alpacaAPI.getTradingCalendar(year, month);
      
      return calendar.map(day => ({
        date: new Date(day.date),
        isTradingDay: day.status === 'open',
        session: day.session
      }));

    } catch (error) {
      logger.error(`[USStockAdapter] Failed to get trading calendar:`, error);
      throw error;
    }
  }
}

// Alpaca API封装
class AlpacaAPI {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.secretKey = config.secretKey;
    this.baseURL = config.baseURL || 'https://paper-api.alpaca.markets';
    this.dataURL = config.dataURL || 'https://data.alpaca.markets';
  }

  async getBars(symbol, timeframe, limit) {
    // 实现Alpaca K线数据获取
    throw new Error('AlpacaAPI.getBars not implemented');
  }

  async getLatestTrade(symbol) {
    // 实现最新交易价格获取
    throw new Error('AlpacaAPI.getLatestTrade not implemented');
  }

  async getOrderBook(symbol) {
    // 实现订单簿获取
    throw new Error('AlpacaAPI.getOrderBook not implemented');
  }

  async placeOrder(orderParams) {
    // 实现下单
    throw new Error('AlpacaAPI.placeOrder not implemented');
  }

  async cancelOrder(orderId) {
    // 实现取消订单
    throw new Error('AlpacaAPI.cancelOrder not implemented');
  }

  async getOrders(symbol) {
    // 实现获取订单列表
    throw new Error('AlpacaAPI.getOrders not implemented');
  }

  async getAccount() {
    // 实现获取账户信息
    throw new Error('AlpacaAPI.getAccount not implemented');
  }

  async getPositions(symbol) {
    // 实现获取持仓信息
    throw new Error('AlpacaAPI.getPositions not implemented');
  }

  async getMarketStatus() {
    // 实现获取市场状态
    throw new Error('AlpacaAPI.getMarketStatus not implemented');
  }

  async getTradingCalendar(year, month) {
    // 实现获取交易日历
    throw new Error('AlpacaAPI.getTradingCalendar not implemented');
  }
}

// Alpha Vantage API封装
class AlphaVantageAPI {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || 'https://www.alphavantage.co/query';
  }

  async getOptionsData(symbol) {
    // 实现期权数据获取
    throw new Error('AlphaVantageAPI.getOptionsData not implemented');
  }

  async getInstitutionalFlow(symbol) {
    // 实现机构资金流向获取
    throw new Error('AlphaVantageAPI.getInstitutionalFlow not implemented');
  }

  async getVIX() {
    // 实现VIX指数获取
    throw new Error('AlphaVantageAPI.getVIX not implemented');
  }
}

// Yahoo Finance API封装
class YahooFinanceAPI {
  constructor(config) {
    this.baseURL = config.baseURL || 'https://query1.finance.yahoo.com';
  }

  async getShortInterest(symbol) {
    // 实现做空数据获取
    throw new Error('YahooFinanceAPI.getShortInterest not implemented');
  }

  async getStockInfo(symbol) {
    // 实现股票基本信息获取
    throw new Error('YahooFinanceAPI.getStockInfo not implemented');
  }
}

module.exports = USStockAdapter;
