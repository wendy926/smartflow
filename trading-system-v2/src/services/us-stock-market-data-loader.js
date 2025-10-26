/**
 * 美股市场数据预加载器
 * 从Alpha Vantage和Alpaca获取K线数据
 */

const DatabaseConnection = require('../database/database-connection');
const { USStockAdapter } = require('../adapters/USStockAdapter');
const logger = require('../utils/logger');

class USStockMarketDataLoader {
  constructor() {
    this.database = DatabaseConnection.getInstance();
    this.adapter = null;
  }

  /**
   * 初始化适配器
   */
  async initialize() {
    const config = {
      symbols: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX'],
      alpaca: {
        apiKey: process.env.ALPACA_API_KEY
      },
      alphaVantage: {
        apiKey: process.env.ALPHA_VANTAGE_API_KEY
      }
    };

    this.adapter = new USStockAdapter(config);
    logger.info('[USStockMarketDataLoader] Initialized');
  }

  /**
   * 加载单个交易对的K线数据
   */
  async loadSymbolData(symbol, timeframe, limit = 500) {
    try {
      logger.info(`[USStockMarketDataLoader] Loading data for ${symbol} ${timeframe}`);

      // 获取K线数据
      const klines = await this.adapter.getKlines(symbol, timeframe, limit);

      // 批量插入数据库
      const values = klines.map(k => [
        symbol,
        timeframe,
        k.timestamp,
        k.open,
        k.high,
        k.low,
        k.close,
        k.volume
      ]);

      if (values.length > 0) {
        const sql = `
          INSERT INTO us_stock_market_data 
          (symbol, timeframe, timestamp, open, high, low, close, volume)
          VALUES ?
          ON DUPLICATE KEY UPDATE 
          open = VALUES(open),
          high = VALUES(high),
          low = VALUES(low),
          close = VALUES(close),
          volume = VALUES(volume)
        `;

        await this.database.query(sql, [values]);
        logger.info(`[USStockMarketDataLoader] Loaded ${values.length} bars for ${symbol} ${timeframe}`);
      }

      return klines.length;

    } catch (error) {
      logger.error(`[USStockMarketDataLoader] Failed to load ${symbol} ${timeframe}:`, error);
      throw error;
    }
  }

  /**
   * 加载所有交易对的数据
   */
  async loadAllSymbols(timeframes = ['15m', '1h', '4h', '1d'], symbols = null) {
    try {
      const defaultSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'];
      const targetSymbols = symbols || defaultSymbols;

      logger.info(`[USStockMarketDataLoader] Loading data for ${targetSymbols.length} symbols, ${timeframes.length} timeframes`);

      let totalLoaded = 0;

      for (const symbol of targetSymbols) {
        for (const timeframe of timeframes) {
          try {
            const count = await this.loadSymbolData(symbol, timeframe, 500);
            totalLoaded += count;

            // 避免API限流
            await this.sleep(1000);
          } catch (error) {
            logger.error(`[USStockMarketDataLoader] Error loading ${symbol} ${timeframe}:`, error);
          }
        }
      }

      logger.info(`[USStockMarketDataLoader] Total loaded: ${totalLoaded} bars`);

      return {
        totalBars: totalLoaded,
        symbols: targetSymbols,
        timeframes
      };

    } catch (error) {
      logger.error('[USStockMarketDataLoader] Failed to load all symbols:', error);
      throw error;
    }
  }

  /**
   * 加载历史数据
   */
  async loadHistoricalData(symbol, timeframe, startDate, endDate) {
    try {
      logger.info(`[USStockMarketDataLoader] Loading historical data for ${symbol} from ${startDate} to ${endDate}`);

      const klines = await this.adapter.getKlines(symbol, timeframe, 500);

      // 过滤日期范围
      const start = new Date(startDate);
      const end = new Date(endDate);

      const filteredKlines = klines.filter(k => {
        const kDate = new Date(k.timestamp);
        return kDate >= start && kDate <= end;
      });

      // 批量插入
      const values = filteredKlines.map(k => [
        symbol,
        timeframe,
        k.timestamp,
        k.open,
        k.high,
        k.low,
        k.close,
        k.volume
      ]);

      if (values.length > 0) {
        const sql = `
          INSERT INTO us_stock_market_data 
          (symbol, timeframe, timestamp, open, high, low, close, volume)
          VALUES ?
          ON DUPLICATE KEY UPDATE 
          open = VALUES(open),
          high = VALUES(high),
          low = VALUES(low),
          close = VALUES(close),
          volume = VALUES(volume)
        `;

        await this.database.query(sql, [values]);
        logger.info(`[USStockMarketDataLoader] Loaded ${values.length} historical bars for ${symbol}`);
      }

      return filteredKlines.length;

    } catch (error) {
      logger.error(`[USStockMarketDataLoader] Failed to load historical data for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * 检查数据是否已存在
   */
  async checkDataExists(symbol, timeframe, limit = 100) {
    try {
      const sql = `
        SELECT COUNT(*) as count 
        FROM us_stock_market_data 
        WHERE symbol = ? AND timeframe = ?
        ORDER BY timestamp DESC 
        LIMIT ?
      `;

      const result = await this.database.query(sql, [symbol, timeframe, limit]);
      return result[0].count > 0;

    } catch (error) {
      logger.error(`[USStockMarketDataLoader] Failed to check data existence:`, error);
      return false;
    }
  }

  /**
   * 获取数据库中的数据
   */
  async getKlinesFromDB(symbol, timeframe, limit = 100) {
    try {
      const sql = `
        SELECT symbol, timeframe, timestamp, open, high, low, close, volume
        FROM us_stock_market_data
        WHERE symbol = ? AND timeframe = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `;

      const klines = await this.database.query(sql, [symbol, timeframe, limit]);
      
      // 转换为策略引擎格式
      return klines.reverse().map(k => ({
        timestamp: k.timestamp,
        open: parseFloat(k.open),
        high: parseFloat(k.high),
        low: parseFloat(k.low),
        close: parseFloat(k.close),
        volume: parseFloat(k.volume),
        symbol,
        timeframe
      }));

    } catch (error) {
      logger.error(`[USStockMarketDataLoader] Failed to get klines from DB:`, error);
      throw error;
    }
  }

  /**
   * 延迟函数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = USStockMarketDataLoader;

