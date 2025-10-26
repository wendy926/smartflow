/**
 * A股市场适配器
 * 实现A股市场交易接口，集成Tushare和东方财富API
 */

const { IExchangeAdapter, MarketType, Timeframe, OrderSide, OrderType, OrderStatus, TimeInForce, MarketInfo, TradingHours, Kline, MarketMetrics, OrderRequest, OrderResponse, Account, Position } = require('../core/interfaces/IExchangeAdapter');
const logger = require('../utils/logger');

class ChinaStockAdapter extends IExchangeAdapter {
  constructor(config) {
    super();
    this.config = config;
    
    // 初始化数据源API
    this.tushareAPI = new TushareAPI(config.tushare);
    this.efinanceAPI = new EFinanceAPI(config.efinance);
    this.brokerAPI = new BrokerAPI(config.broker); // 券商API
    
    // 市场信息
    this.marketInfo = new MarketInfo(
      MarketType.CN_STOCK,
      new TradingHours('Asia/Shanghai', [
        { open: '09:30', close: '11:30', days: [1, 2, 3, 4, 5] }, // 上午
        { open: '13:00', close: '15:00', days: [1, 2, 3, 4, 5] }  // 下午
      ]),
      config.symbols || ['000001.SZ', '600000.SH', '000002.SZ', '600036.SH', '000858.SZ'],
      'Asia/Shanghai'
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
      const tushareTimeframe = this.convertTimeframe(timeframe);
      
      const data = await this.tushareAPI.getKlines(symbol, tushareTimeframe, limit);
      
      return data.map(k => new Kline(
        new Date(k.trade_date),    // timestamp
        parseFloat(k.open),       // open
        parseFloat(k.high),       // high
        parseFloat(k.low),        // low
        parseFloat(k.close),      // close
        parseFloat(k.vol),        // volume
        symbol,
        timeframe,
        MarketType.CN_STOCK
      ));

    } catch (error) {
      logger.error(`[ChinaStockAdapter] Failed to get klines for ${symbol}:`, error);
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

      const ticker = await this.efinanceAPI.getRealtimePrice(symbol);
      return parseFloat(ticker.price);

    } catch (error) {
      logger.error(`[ChinaStockAdapter] Failed to get ticker for ${symbol}:`, error);
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

      const orderBook = await this.efinanceAPI.getOrderBook(symbol);
      
      return {
        bids: orderBook.bids.map(bid => ({
          price: parseFloat(bid.price),
          quantity: parseFloat(bid.volume)
        })),
        asks: orderBook.asks.map(ask => ({
          price: parseFloat(ask.price),
          quantity: parseFloat(ask.volume)
        })),
        timestamp: new Date(orderBook.timestamp)
      };

    } catch (error) {
      logger.error(`[ChinaStockAdapter] Failed to get order book for ${symbol}:`, error);
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
        side: order.side,
        type: order.type,
        quantity: order.quantity,
        price: order.price
      };

      const response = await this.brokerAPI.placeOrder(orderParams);

      return new OrderResponse(
        response.orderId,
        order.symbol,
        response.status,
        parseFloat(response.filledQuantity || 0),
        parseFloat(response.avgPrice || 0),
        new Date(response.timestamp)
      );

    } catch (error) {
      logger.error(`[ChinaStockAdapter] Failed to place order:`, error);
      throw error;
    }
  }

  /**
   * 取消订单
   */
  async cancelOrder(orderId) {
    try {
      const response = await this.brokerAPI.cancelOrder(orderId);
      return response.success;

    } catch (error) {
      logger.error(`[ChinaStockAdapter] Failed to cancel order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * 获取订单列表
   */
  async getOrders(symbol) {
    try {
      const orders = await this.brokerAPI.getOrders(symbol);
      
      return orders.map(order => new OrderResponse(
        order.orderId,
        order.symbol,
        order.status,
        parseFloat(order.filledQuantity || 0),
        parseFloat(order.avgPrice || 0),
        new Date(order.timestamp)
      ));

    } catch (error) {
      logger.error(`[ChinaStockAdapter] Failed to get orders:`, error);
      throw error;
    }
  }

  /**
   * 获取账户信息
   */
  async getAccount() {
    try {
      const accountInfo = await this.brokerAPI.getAccount();
      
      const balance = accountInfo.balances.map(balance => ({
        asset: balance.asset,
        free: parseFloat(balance.available),
        locked: parseFloat(balance.frozen)
      }));

      return new Account(balance, [], []);

    } catch (error) {
      logger.error(`[ChinaStockAdapter] Failed to get account:`, error);
      throw error;
    }
  }

  /**
   * 获取持仓信息
   */
  async getPositions(symbol) {
    try {
      const positions = await this.brokerAPI.getPositions(symbol);
      
      return positions.map(position => new Position(
        position.symbol,
        position.side,
        parseFloat(position.quantity),
        parseFloat(position.entryPrice),
        parseFloat(position.unrealizedPnL || 0),
        parseFloat(position.realizedPnL || 0)
      ));

    } catch (error) {
      logger.error(`[ChinaStockAdapter] Failed to get positions:`, error);
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

      const [financing, northward, basic, moneyFlow] = await Promise.all([
        this.tushareAPI.getFinancingBalance(symbol).catch(() => ({ balance: 0 })),
        this.efinanceAPI.getNorthwardFunds().catch(() => ({ netInflow: 0 })),
        this.tushareAPI.getStockBasic(symbol).catch(() => ({ volume: 0, avgVolume: 1, pe: 0 })),
        this.efinanceAPI.getMoneyFlow(symbol).catch(() => ({ netInflow: 0 }))
      ]);

      return new MarketMetrics({
        volume: basic.volume,
        turnover: basic.turnover,
        financingBalance: financing.balance,
        northwardFunds: northward.netInflow,
        volumeRatio: basic.volume / basic.avgVolume,
        peRatio: basic.pe,
        moneyFlow: moneyFlow.netInflow
      });

    } catch (error) {
      logger.error(`[ChinaStockAdapter] Failed to get market metrics for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 获取融资融券数据
   */
  async getFinancingData(symbol, limit = 100) {
    try {
      const financingData = await this.tushareAPI.getFinancingHistory(symbol, limit);
      
      return financingData.map(data => ({
        symbol: data.ts_code,
        financingBalance: parseFloat(data.fin_balance),
        marginBalance: parseFloat(data.margin_balance),
        financingBuy: parseFloat(data.fin_buy_amt),
        marginBuy: parseFloat(data.margin_buy_amt),
        financingRepay: parseFloat(data.fin_repay_amt),
        marginRepay: parseFloat(data.margin_repay_amt),
        date: new Date(data.trade_date)
      }));

    } catch (error) {
      logger.error(`[ChinaStockAdapter] Failed to get financing data for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 获取北向资金数据
   */
  async getNorthwardFundsData(limit = 100) {
    try {
      const northwardData = await this.efinanceAPI.getNorthwardFundsHistory(limit);
      
      return northwardData.map(data => ({
        date: new Date(data.date),
        netInflow: parseFloat(data.net_inflow),
        buyAmount: parseFloat(data.buy_amount),
        sellAmount: parseFloat(data.sell_amount),
        totalAmount: parseFloat(data.total_amount)
      }));

    } catch (error) {
      logger.error(`[ChinaStockAdapter] Failed to get northward funds data:`, error);
      throw error;
    }
  }

  /**
   * 获取资金流向数据
   */
  async getMoneyFlowData(symbol, limit = 100) {
    try {
      const moneyFlowData = await this.efinanceAPI.getMoneyFlowHistory(symbol, limit);
      
      return moneyFlowData.map(data => ({
        symbol: data.symbol,
        date: new Date(data.date),
        netInflow: parseFloat(data.net_inflow),
        mainInflow: parseFloat(data.main_inflow),
        retailInflow: parseFloat(data.retail_inflow),
        superInflow: parseFloat(data.super_inflow)
      }));

    } catch (error) {
      logger.error(`[ChinaStockAdapter] Failed to get money flow data for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 获取股票基本信息
   */
  async getStockBasicInfo(symbol) {
    try {
      const basicInfo = await this.tushareAPI.getStockBasic(symbol);
      
      return {
        symbol: basicInfo.ts_code,
        name: basicInfo.name,
        industry: basicInfo.industry,
        area: basicInfo.area,
        market: basicInfo.market,
        listDate: new Date(basicInfo.list_date),
        pe: parseFloat(basicInfo.pe || 0),
        pb: parseFloat(basicInfo.pb || 0),
        totalShares: parseFloat(basicInfo.total_share || 0),
        floatShares: parseFloat(basicInfo.float_share || 0)
      };

    } catch (error) {
      logger.error(`[ChinaStockAdapter] Failed to get stock basic info for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 转换时间框架格式
   */
  convertTimeframe(timeframe) {
    const timeframeMap = {
      [Timeframe.MINUTE_1]: '1min',
      [Timeframe.MINUTE_5]: '5min',
      [Timeframe.MINUTE_15]: '15min',
      [Timeframe.MINUTE_30]: '30min',
      [Timeframe.HOUR_1]: '1hour',
      [Timeframe.HOUR_4]: '4hour',
      [Timeframe.DAY_1]: '1day',
      [Timeframe.WEEK_1]: '1week',
      [Timeframe.MONTH_1]: '1month'
    };

    return timeframeMap[timeframe] || '1day';
  }

  /**
   * 检查交易时间（包含集合竞价时间）
   */
  isTradingTime() {
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour12: false, 
      timeZone: 'Asia/Shanghai' 
    }).substring(0, 5);

    // 检查是否在交易日内
    if (currentDay === 0 || currentDay === 6) {
      return false;
    }

    // 检查是否在交易时间内（包含集合竞价）
    const tradingSessions = [
      { open: '09:15', close: '11:30' }, // 上午（包含集合竞价）
      { open: '13:00', close: '15:00' }  // 下午
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
      const calendar = await this.tushareAPI.getTradingCalendar(year, month);
      
      return calendar.map(day => ({
        date: new Date(day.cal_date),
        isTradingDay: day.is_open === 1,
        pretradeDate: day.pretrade_date ? new Date(day.pretrade_date) : null
      }));

    } catch (error) {
      logger.error(`[ChinaStockAdapter] Failed to get trading calendar:`, error);
      throw error;
    }
  }
}

// Tushare API封装
class TushareAPI {
  constructor(config) {
    this.token = config.token;
    this.baseURL = config.baseURL || 'http://api.tushare.pro';
  }

  async getKlines(symbol, timeframe, limit) {
    // 实现Tushare K线数据获取
    // 这里需要根据实际的Tushare API进行实现
    throw new Error('TushareAPI.getKlines not implemented');
  }

  async getFinancingBalance(symbol) {
    // 实现融资融券余额获取
    throw new Error('TushareAPI.getFinancingBalance not implemented');
  }

  async getStockBasic(symbol) {
    // 实现股票基本信息获取
    throw new Error('TushareAPI.getStockBasic not implemented');
  }
}

// 东方财富API封装
class EFinanceAPI {
  constructor(config) {
    this.baseURL = config.baseURL || 'https://push2.eastmoney.com';
  }

  async getRealtimePrice(symbol) {
    // 实现实时价格获取
    throw new Error('EFinanceAPI.getRealtimePrice not implemented');
  }

  async getOrderBook(symbol) {
    // 实现订单簿获取
    throw new Error('EFinanceAPI.getOrderBook not implemented');
  }

  async getNorthwardFunds() {
    // 实现北向资金获取
    throw new Error('EFinanceAPI.getNorthwardFunds not implemented');
  }

  async getMoneyFlow(symbol) {
    // 实现资金流向获取
    throw new Error('EFinanceAPI.getMoneyFlow not implemented');
  }
}

// 券商API封装
class BrokerAPI {
  constructor(config) {
    this.baseURL = config.baseURL;
    this.apiKey = config.apiKey;
    this.secretKey = config.secretKey;
  }

  async placeOrder(orderParams) {
    // 实现下单
    throw new Error('BrokerAPI.placeOrder not implemented');
  }

  async cancelOrder(orderId) {
    // 实现取消订单
    throw new Error('BrokerAPI.cancelOrder not implemented');
  }

  async getOrders(symbol) {
    // 实现获取订单列表
    throw new Error('BrokerAPI.getOrders not implemented');
  }

  async getAccount() {
    // 实现获取账户信息
    throw new Error('BrokerAPI.getAccount not implemented');
  }

  async getPositions(symbol) {
    // 实现获取持仓信息
    throw new Error('BrokerAPI.getPositions not implemented');
  }
}

module.exports = ChinaStockAdapter;
