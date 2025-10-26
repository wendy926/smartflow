/**
 * 美股API客户端
 * 集成Alpaca、Alpha Vantage和Yahoo Finance
 */

const axios = require('axios');
const logger = require('../utils/logger');

class AlpacaAPI {
  constructor(config) {
    this.apiKey = config.apiKey || process.env.ALPACA_API_KEY;
    this.secretKey = config.secretKey || process.env.ALPACA_SECRET_KEY;
    this.baseURL = config.baseURL || (config.useSandbox ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets');
    this.dataURL = config.dataURL || 'https://data.alpaca.markets';
  }

  /**
   * 获取历史K线数据
   */
  async getBars(symbol, timeframe, limit) {
    try {
      const url = `${this.dataURL}/v2/stocks/${symbol}/bars`;
      const params = {
        timeframe,
        limit,
        adjustment: 'all'
      };

      const response = await axios.get(url, {
        params,
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.secretKey
        }
      });

      return response.data.bars || [];

    } catch (error) {
      logger.error(`[AlpacaAPI] Failed to get bars for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 获取最新交易价格
   */
  async getLatestTrade(symbol) {
    try {
      const url = `${this.baseURL}/v2/stocks/${symbol}/trades/latest`;
      
      const response = await axios.get(url, {
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.secretKey
        }
      });

      return response.data.trade || { price: 0 };

    } catch (error) {
      logger.error(`[AlpacaAPI] Failed to get latest trade for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 获取订单簿
   */
  async getOrderBook(symbol) {
    try {
      const url = `${this.dataURL}/v2/stocks/${symbol}/quote`;
      
      const response = await axios.get(url, {
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.secretKey
        }
      });

      return {
        bids: response.data.ap || [],
        asks: response.data.bp || [],
        timestamp: response.data.t || Date.now()
      };

    } catch (error) {
      logger.error(`[AlpacaAPI] Failed to get order book for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 下单
   */
  async placeOrder(orderParams) {
    try {
      const url = `${this.baseURL}/v2/orders`;

      const response = await axios.post(url, orderParams, {
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.secretKey
        }
      });

      return response.data;

    } catch (error) {
      logger.error(`[AlpacaAPI] Failed to place order:`, error);
      throw error;
    }
  }

  /**
   * 取消订单
   */
  async cancelOrder(orderId) {
    try {
      const url = `${this.baseURL}/v2/orders/${orderId}`;

      const response = await axios.delete(url, {
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.secretKey
        }
      });

      return response.data;

    } catch (error) {
      logger.error(`[AlpacaAPI] Failed to cancel order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * 获取订单列表
   */
  async getOrders(symbol) {
    try {
      const url = `${this.baseURL}/v2/orders`;
      const params = symbol ? { symbols: symbol } : {};

      const response = await axios.get(url, {
        params,
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.secretKey
        }
      });

      return response.data || [];

    } catch (error) {
      logger.error(`[AlpacaAPI] Failed to get orders:`, error);
      throw error;
    }
  }

  /**
   * 获取账户信息
   */
  async getAccount() {
    try {
      const url = `${this.baseURL}/v2/account`;

      const response = await axios.get(url, {
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.secretKey
        }
      });

      return response.data;

    } catch (error) {
      logger.error(`[AlpacaAPI] Failed to get account:`, error);
      throw error;
    }
  }

  /**
   * 获取持仓信息
   */
  async getPositions(symbol) {
    try {
      const url = `${this.baseURL}/v2/positions`;
      const params = symbol ? { symbols: symbol } : {};

      const response = await axios.get(url, {
        params,
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.secretKey
        }
      });

      return response.data || [];

    } catch (error) {
      logger.error(`[AlpacaAPI] Failed to get positions:`, error);
      throw error;
    }
  }

  /**
   * 获取市场状态
   */
  async getMarketStatus() {
    try {
      const url = `${this.baseURL}/v2/clock`;

      const response = await axios.get(url, {
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.secretKey
        }
      });

      return response.data;

    } catch (error) {
      logger.error(`[AlpacaAPI] Failed to get market status:`, error);
      throw error;
    }
  }

  /**
   * 获取交易日历
   */
  async getTradingCalendar(year, month) {
    try {
      const url = `${this.baseURL}/v1/calendar`;
      const params = { start: `${year}-${String(month).padStart(2, '0')}-01` };

      const response = await axios.get(url, {
        params,
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.secretKey
        }
      });

      return response.data || [];

    } catch (error) {
      logger.error(`[AlpacaAPI] Failed to get trading calendar:`, error);
      throw error;
    }
  }
}

class AlphaVantageAPI {
  constructor(config) {
    this.apiKey = config.apiKey || process.env.ALPHA_VANTAGE_API_KEY;
    this.baseURL = config.baseURL || 'https://www.alphavantage.co/query';
  }

  /**
   * 获取期权数据
   */
  async getOptionsData(symbol) {
    try {
      const url = this.baseURL;
      const params = {
        function: 'OPTION_DATA',
        symbol,
        apikey: this.apiKey
      };

      const response = await axios.get(url, { params });
      
      return {
        putCallRatio: parseFloat(response.data.putCallRatio || 1),
        oiChange: parseFloat(response.data.oiChange || 0),
        volume: parseFloat(response.data.volume || 0)
      };

    } catch (error) {
      logger.error(`[AlphaVantageAPI] Failed to get options data for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 获取机构资金流向
   */
  async getInstitutionalFlow(symbol) {
    try {
      const url = this.baseURL;
      const params = {
        function: 'INSTITUTIONAL_FLOW',
        symbol,
        apikey: this.apiKey
      };

      const response = await axios.get(url, { params });
      
      return {
        netFlow: parseFloat(response.data.netFlow || 0),
        institutionalBuy: parseFloat(response.data.institutionalBuy || 0),
        institutionalSell: parseFloat(response.data.institutionalSell || 0)
      };

    } catch (error) {
      logger.error(`[AlphaVantageAPI] Failed to get institutional flow for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 获取VIX恐慌指数
   */
  async getVIX() {
    try {
      const url = this.baseURL;
      const params = {
        function: 'INDICATOR',
        indicator: 'VIX',
        apikey: this.apiKey
      };

      const response = await axios.get(url, { params });
      
      const latest = response.data.data?.[0];
      
      return {
        value: parseFloat(latest?.value || 20),
        timestamp: latest?.timestamp || new Date()
      };

    } catch (error) {
      logger.error(`[AlphaVantageAPI] Failed to get VIX:`, error);
      throw error;
    }
  }
}

class YahooFinanceAPI {
  constructor(config) {
    this.baseURL = config.baseURL || 'https://query1.finance.yahoo.com';
  }

  /**
   * 获取做空数据
   */
  async getShortInterest(symbol) {
    try {
      // Yahoo Finance 做空数据API
      const url = `${this.baseURL}/v8/finance/chart/${symbol}`;
      const params = {
        interval: '1d',
        range: '1y',
        indicators: 'shortInterest'
      };

      const response = await axios.get(url, { params });
      
      const shortInterest = response.data.chart?.result?.[0]?.indicators?.shortInterest?.[0];
      
      return {
        shortInterest: parseFloat(shortInterest || 0),
        timestamp: new Date()
      };

    } catch (error) {
      logger.error(`[YahooFinanceAPI] Failed to get short interest for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 获取股票基本信息
   */
  async getStockInfo(symbol) {
    try {
      const url = `${this.baseURL}/v10/finance/quoteSummary/${symbol}`;
      const params = {
        modules: 'assetProfile,summaryProfile,defaultKeyStatistics,financialData,summaryDetail'
      };

      const response = await axios.get(url, { params });
      const quoteSummary = response.data.quoteSummary?.result?.[0];
      
      return {
        symbol,
        longName: quoteSummary?.quoteType?.longName || symbol,
        sector: quoteSummary?.assetProfile?.sector || '',
        industry: quoteSummary?.assetProfile?.industry || '',
        marketCap: quoteSummary?.summaryDetail?.marketCap?.raw || 0,
        trailingPE: quoteSummary?.summaryDetail?.trailingPE?.raw || 0,
        priceToBook: quoteSummary?.summaryDetail?.priceToBook?.raw || 0,
        dividendYield: quoteSummary?.summaryDetail?.dividendYield?.raw || 0,
        beta: quoteSummary?.summaryDetail?.beta?.raw || 1,
        trailingEps: quoteSummary?.defaultKeyStatistics?.trailingEps?.raw || 0
      };

    } catch (error) {
      logger.error(`[YahooFinanceAPI] Failed to get stock info for ${symbol}:`, error);
      throw error;
    }
  }
}

module.exports = {
  AlpacaAPI,
  AlphaVantageAPI,
  YahooFinanceAPI
};

