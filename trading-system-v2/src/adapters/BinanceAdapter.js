/**
 * Binance交易所适配器
 * 实现加密货币市场交易接口
 */

const { IExchangeAdapter, MarketType, Timeframe, OrderSide, OrderType, OrderStatus, TimeInForce, MarketInfo, TradingHours, Kline, MarketMetrics, OrderRequest, OrderResponse, Account, Position } = require('../core/interfaces/IExchangeAdapter');
const BinanceAPI = require('../api/binance-api');
const logger = require('../utils/logger');

class BinanceAdapter extends IExchangeAdapter {
  constructor(config) {
    super();
    this.config = config;
    this.api = new BinanceAPI(config);

    // 市场信息
    this.marketInfo = new MarketInfo(
      MarketType.CRYPTO,
      new TradingHours('UTC', [
        { open: '00:00', close: '23:59', days: [0, 1, 2, 3, 4, 5, 6] } // 24/7交易
      ]),
      config.symbols || ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'BNBUSDT', 'XRPUSDT'],
      'UTC'
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

      const data = await this.api.getKlines(symbol, timeframe, limit);

      return data.map(k => new Kline(
        new Date(k[0]),           // timestamp
        parseFloat(k[1]),         // open
        parseFloat(k[2]),         // high
        parseFloat(k[3]),         // low
        parseFloat(k[4]),         // close
        parseFloat(k[5]),         // volume
        symbol,
        timeframe,
        MarketType.CRYPTO
      ));

    } catch (error) {
      logger.error(`[BinanceAdapter] Failed to get klines for ${symbol}:`, error);
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

      const ticker = await this.api.getTicker24hr(symbol);
      return parseFloat(ticker.lastPrice);

    } catch (error) {
      logger.error(`[BinanceAdapter] Failed to get ticker for ${symbol}:`, error);
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

      const orderBook = await this.api.getOrderBook(symbol);

      return {
        bids: orderBook.bids.map(bid => ({
          price: parseFloat(bid[0]),
          quantity: parseFloat(bid[1])
        })),
        asks: orderBook.asks.map(ask => ({
          price: parseFloat(ask[0]),
          quantity: parseFloat(ask[1])
        })),
        timestamp: new Date(orderBook.lastUpdateId)
      };

    } catch (error) {
      logger.error(`[BinanceAdapter] Failed to get order book for ${symbol}:`, error);
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
        quantity: order.quantity.toString()
      };

      // 添加价格相关参数
      if (order.type === OrderType.LIMIT || order.type === OrderType.STOP_LIMIT) {
        orderParams.price = order.price.toString();
      }

      if (order.type === OrderType.STOP || order.type === OrderType.STOP_LIMIT) {
        orderParams.stopPrice = order.stopPrice.toString();
      }

      // 添加时间在力
      if (order.timeInForce) {
        orderParams.timeInForce = order.timeInForce;
      }

      const response = await this.api.placeOrder(orderParams);

      return new OrderResponse(
        response.orderId.toString(),
        order.symbol,
        response.status,
        parseFloat(response.executedQty || 0),
        parseFloat(response.avgPrice || 0),
        new Date(response.transactTime)
      );

    } catch (error) {
      logger.error(`[BinanceAdapter] Failed to place order:`, error);
      throw error;
    }
  }

  /**
   * 取消订单
   */
  async cancelOrder(orderId) {
    try {
      const response = await this.api.cancelOrder(orderId);
      return response.status === 'CANCELED';

    } catch (error) {
      logger.error(`[BinanceAdapter] Failed to cancel order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * 获取订单列表
   */
  async getOrders(symbol) {
    try {
      const orders = await this.api.getOpenOrders(symbol);

      return orders.map(order => new OrderResponse(
        order.orderId.toString(),
        order.symbol,
        order.status,
        parseFloat(order.executedQty || 0),
        parseFloat(order.avgPrice || 0),
        new Date(order.time)
      ));

    } catch (error) {
      logger.error(`[BinanceAdapter] Failed to get orders:`, error);
      throw error;
    }
  }

  /**
   * 获取账户信息
   */
  async getAccount() {
    try {
      const accountInfo = await this.api.getAccount();

      const balance = accountInfo.balances.map(balance => ({
        asset: balance.asset,
        free: parseFloat(balance.free),
        locked: parseFloat(balance.locked)
      }));

      return new Account(balance, [], []);

    } catch (error) {
      logger.error(`[BinanceAdapter] Failed to get account:`, error);
      throw error;
    }
  }

  /**
   * 获取持仓信息
   */
  async getPositions(symbol) {
    try {
      const positions = await this.api.getPositions(symbol);

      return positions.map(position => new Position(
        position.symbol,
        parseFloat(position.positionAmt) > 0 ? OrderSide.BUY : OrderSide.SELL,
        Math.abs(parseFloat(position.positionAmt)),
        parseFloat(position.entryPrice),
        parseFloat(position.unrealizedPnl),
        parseFloat(position.realizedPnl)
      ));

    } catch (error) {
      logger.error(`[BinanceAdapter] Failed to get positions:`, error);
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

      const [fundingRate, openInterest, ticker, longShortRatio] = await Promise.all([
        this.api.getFundingRate(symbol).catch(() => ({ lastFundingRate: '0' })),
        this.api.getOpenInterest(symbol).catch(() => ({ openInterest: '0' })),
        this.api.getTicker24hr(symbol),
        this.api.getLongShortRatio(symbol).catch(() => ({ longShortRatio: '1' }))
      ]);

      return new MarketMetrics({
        volume: parseFloat(ticker.volume),
        turnover: parseFloat(ticker.quoteVolume),
        fundingRate: parseFloat(fundingRate.lastFundingRate),
        openInterest: parseFloat(openInterest.openInterest),
        delta: parseFloat(ticker.delta || 0),
        liquidation: {
          longShortRatio: parseFloat(longShortRatio.longShortRatio)
        }
      });

    } catch (error) {
      logger.error(`[BinanceAdapter] Failed to get market metrics for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 获取资金费率历史
   */
  async getFundingRateHistory(symbol, limit = 100) {
    try {
      const fundingRates = await this.api.getFundingRateHistory(symbol, limit);

      return fundingRates.map(rate => ({
        symbol: rate.symbol,
        fundingRate: parseFloat(rate.fundingRate),
        fundingTime: new Date(rate.fundingTime)
      }));

    } catch (error) {
      logger.error(`[BinanceAdapter] Failed to get funding rate history for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 获取持仓量历史
   */
  async getOpenInterestHistory(symbol, timeframe, limit = 100) {
    try {
      const oiHistory = await this.api.getOpenInterestHistory(symbol, timeframe, limit);

      return oiHistory.map(oi => ({
        symbol: oi.symbol,
        openInterest: parseFloat(oi.openInterest),
        timestamp: new Date(oi.timestamp)
      }));

    } catch (error) {
      logger.error(`[BinanceAdapter] Failed to get open interest history for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 获取爆仓数据
   */
  async getLiquidationData(symbol, limit = 100) {
    try {
      const liquidations = await this.api.getLiquidationOrders(symbol, limit);

      return liquidations.map(liq => ({
        symbol: liq.symbol,
        side: liq.side,
        quantity: parseFloat(liq.origQty),
        price: parseFloat(liq.price),
        timestamp: new Date(liq.time)
      }));

    } catch (error) {
      logger.error(`[BinanceAdapter] Failed to get liquidation data for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 获取交易对信息
   */
  async getSymbolInfo(symbol) {
    try {
      const exchangeInfo = await this.api.getExchangeInfo();
      const symbolInfo = exchangeInfo.symbols.find(s => s.symbol === symbol);

      if (!symbolInfo) {
        throw new Error(`Symbol ${symbol} not found`);
      }

      return {
        symbol: symbolInfo.symbol,
        baseAsset: symbolInfo.baseAsset,
        quoteAsset: symbolInfo.quoteAsset,
        status: symbolInfo.status,
        filters: symbolInfo.filters,
        permissions: symbolInfo.permissions
      };

    } catch (error) {
      logger.error(`[BinanceAdapter] Failed to get symbol info for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 获取服务器时间
   */
  async getServerTime() {
    try {
      const serverTime = await this.api.getServerTime();
      return new Date(serverTime.serverTime);

    } catch (error) {
      logger.error(`[BinanceAdapter] Failed to get server time:`, error);
      throw error;
    }
  }

  /**
   * 检查API连接状态
   */
  async checkConnection() {
    try {
      await this.api.ping();
      return true;

    } catch (error) {
      logger.error(`[BinanceAdapter] Connection check failed:`, error);
      return false;
    }
  }

  /**
   * 获取API限制信息
   */
  async getRateLimitInfo() {
    try {
      const rateLimit = await this.api.getRateLimitInfo();
      return rateLimit;

    } catch (error) {
      logger.error(`[BinanceAdapter] Failed to get rate limit info:`, error);
      throw error;
    }
  }
}

module.exports = BinanceAdapter;
