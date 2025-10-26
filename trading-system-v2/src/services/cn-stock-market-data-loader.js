/**
 * A股市场数据加载器
 * 从Tushare获取A股指数数据并存储到数据库
 */

const DatabaseConnection = require('../core/DatabaseConnection');
const { TushareAPI } = require('../api/cn-stock-api');
const logger = require('../utils/logger');

class CNStockMarketDataLoader {
  constructor(config) {
    this.config = config;
    this.tushareAPI = new TushareAPI(config.tushare || {});
    this.database = null;
  }

  /**
   * 初始化数据库连接
   */
  async initialize() {
    this.database = DatabaseConnection.getInstance();
    await this.database.connect();
    logger.info('A股市场数据加载器已初始化');
  }

  /**
   * 加载指数基本信息
   */
  async loadIndexBasic() {
    try {
      logger.info('开始加载指数基本信息...');
      
      const basicInfo = await this.tushareAPI.getIndexBasic();
      
      if (!basicInfo || basicInfo.length === 0) {
        logger.warn('未获取到指数基本信息');
        return;
      }

      let inserted = 0;
      for (const info of basicInfo) {
        try {
          await this.database.query(
            `INSERT INTO cn_stock_indices 
             (ts_code, index_name, market, publisher, index_type, category, 
              base_date, base_point, list_date, weight_rule, description) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
             index_name=VALUES(index_name),
             market=VALUES(market),
             publisher=VALUES(publisher),
             index_type=VALUES(index_type),
             category=VALUES(category)`,
            [
              info.ts_code,
              info.name,
              info.market,
              info.publisher,
              info.index_type,
              info.category,
              info.base_date,
              info.base_point,
              info.list_date,
              info.weight_rule,
              info.desc
            ]
          );
          inserted++;
        } catch (error) {
          logger.error(`插入指数信息失败: ${info.ts_code}, ${error.message}`);
        }
      }

      logger.info(`指数基本信息加载完成，共插入/更新 ${inserted} 条记录`);
    } catch (error) {
      logger.error(`加载指数基本信息失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 加载指数日线数据
   */
  async loadIndexDaily(tsCode, startDate, endDate) {
    try {
      logger.info(`加载指数日线数据: ${tsCode}, ${startDate} - ${endDate}`);
      
      const data = await this.tushareAPI.getIndexDaily(tsCode, startDate, endDate);
      
      if (!data || data.length === 0) {
        logger.warn(`未获取到日线数据: ${tsCode}`);
        return;
      }

      let inserted = 0;
      for (const item of data) {
        try {
          await this.database.query(
            `INSERT INTO cn_stock_market_data 
             (ts_code, trade_date, timeframe, open, high, low, close, volume, amount, 
              pre_close, change_pct) 
             VALUES (?, ?, '1d', ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
             open=VALUES(open),
             high=VALUES(high),
             low=VALUES(low),
             close=VALUES(close),
             volume=VALUES(volume),
             amount=VALUES(amount),
             pre_close=VALUES(pre_close),
             change_pct=VALUES(change_pct)`,
            [
              item.ts_code,
              item.trade_date,
              parseFloat(item.open),
              parseFloat(item.high),
              parseFloat(item.low),
              parseFloat(item.close),
              parseFloat(item.vol || 0),
              parseFloat(item.amount || 0),
              parseFloat(item.pre_close || 0),
              parseFloat(item.pct_chg || 0)
            ]
          );
          inserted++;
        } catch (error) {
          logger.error(`插入日线数据失败: ${item.trade_date}, ${error.message}`);
        }
      }

      logger.info(`指数 ${tsCode} 日线数据加载完成，共插入/更新 ${inserted} 条记录`);
    } catch (error) {
      logger.error(`加载日线数据失败: ${tsCode}, ${error.message}`);
      throw error;
    }
  }

  /**
   * 批量加载多个指数的历史数据
   */
  async loadHistoricalData(indices, startDate, endDate) {
    try {
      logger.info(`开始批量加载历史数据: ${indices.length} 个指数`);
      
      for (const indexCode of indices) {
        try {
          await this.loadIndexDaily(indexCode, startDate, endDate);
          // 添加延迟避免API限流
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          logger.error(`加载指数数据失败: ${indexCode}, ${error.message}`);
        }
      }

      logger.info('批量加载完成');
    } catch (error) {
      logger.error(`批量加载历史数据失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 更新最新数据
   */
  async updateLatestData(indices) {
    try {
      logger.info('开始更新最新数据...');
      
      const today = this.formatDate(new Date());
      const yesterday = this.formatDate(this.getPreviousTradingDay());
      
      for (const indexCode of indices) {
        try {
          await this.loadIndexDaily(indexCode, yesterday, today);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          logger.error(`更新最新数据失败: ${indexCode}, ${error.message}`);
        }
      }

      logger.info('最新数据更新完成');
    } catch (error) {
      logger.error(`更新最新数据失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取数据统计
   */
  async getDataStatistics() {
    try {
      const stats = await this.database.query(`
        SELECT 
          ts_code,
          MIN(trade_date) as first_date,
          MAX(trade_date) as last_date,
          COUNT(*) as total_records
        FROM cn_stock_market_data
        GROUP BY ts_code
        ORDER BY ts_code
      `);

      logger.info('数据统计:');
      stats.forEach(stat => {
        logger.info(`  ${stat.ts_code}: ${stat.first_date} - ${stat.last_date}, ${stat.total_records} 条记录`);
      });

      return stats;
    } catch (error) {
      logger.error(`获取数据统计失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 格式化日期
   */
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  /**
   * 获取上一个交易日
   */
  getPreviousTradingDay() {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    
    // 如果是周末，回退到周五
    while (date.getDay() === 0 || date.getDay() === 6) {
      date.setDate(date.getDate() - 1);
    }
    
    return date;
  }
}

module.exports = CNStockMarketDataLoader;

