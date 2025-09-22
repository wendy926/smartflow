/**
 * K线数据获取模块
 * 从Binance API获取真实的K线数据
 */

class KlineDataFetcher {
  constructor() {
    this.baseUrl = 'https://fapi.binance.com/fapi/v1';
    this.requestTimeout = 5000; // 5秒超时
    this.rateLimitDelay = 100; // 请求间隔100ms
  }

  /**
   * 获取K线数据
   * @param {string} symbol - 交易对符号，如 'BTCUSDT'
   * @param {string} interval - 时间间隔 '1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'
   * @param {number} limit - 数据条数，最大1000
   * @param {number} startTime - 开始时间戳（可选）
   * @param {number} endTime - 结束时间戳（可选）
   * @returns {Promise<Array>} K线数据数组
   */
  async fetchKlines(symbol, interval, limit = 500, startTime = null, endTime = null) {
    try {
      let url = `${this.baseUrl}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

      if (startTime) {
        url += `&startTime=${startTime}`;
      }
      if (endTime) {
        url += `&endTime=${endTime}`;
      }

      console.log(`📊 获取K线数据: ${symbol} ${interval} (${limit}条)`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: this.requestTimeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // 转换数据格式
      const klines = data.map(kline => ({
        openTime: parseInt(kline[0]),
        closeTime: parseInt(kline[6]),
        open: parseFloat(kline[1]),
        high: parseFloat(kline[2]),
        low: parseFloat(kline[3]),
        close: parseFloat(kline[4]),
        volume: parseFloat(kline[5]),
        quoteVolume: parseFloat(kline[7]),
        tradesCount: parseInt(kline[8]),
        takerBuyBaseVolume: parseFloat(kline[9]),
        takerBuyQuoteVolume: parseFloat(kline[10])
      }));

      console.log(`✅ 成功获取 ${klines.length} 条K线数据: ${symbol} ${interval}`);
      return klines;

    } catch (error) {
      console.error(`❌ 获取K线数据失败 ${symbol} ${interval}:`, error.message);
      throw error;
    }
  }

  /**
   * 获取多个时间框架的K线数据
   * @param {string} symbol - 交易对符号
   * @param {Array} intervals - 时间间隔数组
   * @param {number} limit - 每个时间框架的数据条数
   * @returns {Promise<Object>} 按时间框架分组的数据
   */
  async fetchMultipleTimeframes(symbol, intervals = ['1d', '4h', '1h', '15m'], limit = 500) {
    const results = {};

    for (const interval of intervals) {
      try {
        // 添加请求间隔，避免触发频率限制
        await this.delay(this.rateLimitDelay);

        results[interval] = await this.fetchKlines(symbol, interval, limit);
      } catch (error) {
        console.error(`❌ 获取${interval}数据失败:`, error.message);
        results[interval] = [];
      }
    }

    return results;
  }

  /**
   * 获取最新价格
   * @param {string} symbol - 交易对符号
   * @returns {Promise<number>} 最新价格
   */
  async fetchLatestPrice(symbol) {
    try {
      const response = await fetch(`${this.baseUrl}/ticker/price?symbol=${symbol}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: this.requestTimeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return parseFloat(data.price);

    } catch (error) {
      console.error(`❌ 获取最新价格失败 ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * 获取24小时价格变动统计
   * @param {string} symbol - 交易对符号
   * @returns {Promise<Object>} 24小时统计数据
   */
  async fetch24hrTicker(symbol) {
    try {
      const response = await fetch(`${this.baseUrl}/ticker/24hr?symbol=${symbol}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: this.requestTimeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        symbol: data.symbol,
        priceChange: parseFloat(data.priceChange),
        priceChangePercent: parseFloat(data.priceChangePercent),
        weightedAvgPrice: parseFloat(data.weightedAvgPrice),
        prevClosePrice: parseFloat(data.prevClosePrice),
        lastPrice: parseFloat(data.lastPrice),
        lastQty: parseFloat(data.lastQty),
        bidPrice: parseFloat(data.bidPrice),
        bidQty: parseFloat(data.bidQty),
        askPrice: parseFloat(data.askPrice),
        askQty: parseFloat(data.askQty),
        openPrice: parseFloat(data.openPrice),
        highPrice: parseFloat(data.highPrice),
        lowPrice: parseFloat(data.lowPrice),
        volume: parseFloat(data.volume),
        quoteVolume: parseFloat(data.quoteVolume),
        openTime: parseInt(data.openTime),
        closeTime: parseInt(data.closeTime),
        firstId: parseInt(data.firstId),
        lastId: parseInt(data.lastId),
        count: parseInt(data.count)
      };

    } catch (error) {
      console.error(`❌ 获取24小时统计失败 ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * 获取资金费率
   * @param {string} symbol - 交易对符号
   * @returns {Promise<number>} 资金费率
   */
  async fetchFundingRate(symbol) {
    try {
      const response = await fetch(`${this.baseUrl}/premiumIndex?symbol=${symbol}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: this.requestTimeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return parseFloat(data.lastFundingRate);

    } catch (error) {
      console.error(`❌ 获取资金费率失败 ${symbol}:`, error.message);
      return 0; // 返回默认值
    }
  }

  /**
   * 获取持仓量历史数据
   * @param {string} symbol - 交易对符号
   * @param {string} period - 时间周期 '5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d'
   * @param {number} limit - 数据条数
   * @returns {Promise<Array>} 持仓量历史数据
   */
  async fetchOpenInterestHistory(symbol, period = '1h', limit = 30) {
    try {
      const response = await fetch(`${this.baseUrl}/openInterestHist?symbol=${symbol}&period=${period}&limit=${limit}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: this.requestTimeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return data.map(item => ({
        symbol: item.symbol,
        sumOpenInterest: parseFloat(item.sumOpenInterest),
        sumOpenInterestValue: parseFloat(item.sumOpenInterestValue),
        timestamp: parseInt(item.timestamp)
      }));

    } catch (error) {
      console.error(`❌ 获取持仓量历史失败 ${symbol}:`, error.message);
      return [];
    }
  }

  /**
   * 验证交易对是否支持
   * @param {string} symbol - 交易对符号
   * @returns {Promise<boolean>} 是否支持
   */
  async validateSymbol(symbol) {
    try {
      const response = await fetch(`${this.baseUrl}/exchangeInfo`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: this.requestTimeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const symbolInfo = data.symbols.find(s => s.symbol === symbol);

      return symbolInfo && symbolInfo.status === 'TRADING';

    } catch (error) {
      console.error(`❌ 验证交易对失败 ${symbol}:`, error.message);
      return false;
    }
  }

  /**
   * 延迟函数
   * @param {number} ms - 延迟毫秒数
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 批量获取多个交易对的数据
   * @param {Array} symbols - 交易对数组
   * @param {Array} intervals - 时间间隔数组
   * @param {number} limit - 每个时间框架的数据条数
   * @returns {Promise<Object>} 按交易对和时间框架分组的数据
   */
  async fetchBatchData(symbols, intervals = ['1d', '4h', '1h', '15m'], limit = 500) {
    const results = {};

    for (const symbol of symbols) {
      console.log(`🔄 开始获取 ${symbol} 数据...`);

      try {
        results[symbol] = await this.fetchMultipleTimeframes(symbol, intervals, limit);
        console.log(`✅ ${symbol} 数据获取完成`);

        // 添加交易对间的延迟，避免触发频率限制
        await this.delay(this.rateLimitDelay * 2);

      } catch (error) {
        console.error(`❌ ${symbol} 数据获取失败:`, error.message);
        results[symbol] = {};
      }
    }

    return results;
  }
}

module.exports = KlineDataFetcher;
