/**
 * A股市场API客户端
 * 集成Tushare Pro API用于获取A股市场数据
 */

const tushare = require('tushare');
const logger = require('../utils/logger');

/**
 * Tushare API客户端
 */
class TushareAPI {
  constructor(config) {
    this.token = config.token;
    this.pro = tushare.pro;
    
    // 初始化Tushare
    if (this.token) {
      this.pro.set_token(this.token);
    }
  }

  /**
   * 获取指数基本信息
   * @param {string} indexCode - 指数代码，如'000300.SH'（沪深300）
   * @returns {Promise<Object>} 指数基本信息
   */
  async getIndexBasic(indexCode = null) {
    try {
      const fields = 'ts_code,name,market,publisher,index_type,category,base_date,base_point,list_date,weight_rule,desc,exp_date';
      const result = await this.pro.index_basic({
        index_code: indexCode || '',
        fields: fields
      });
      return result.data || [];
    } catch (error) {
      logger.error(`获取指数信息失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取指数日线行情
   * @param {string} tsCode - 指数代码
   * @param {string} startDate - 开始日期 'YYYYMMDD'
   * @param {string} endDate - 结束日期 'YYYYMMDD'
   * @returns {Promise<Array>} K线数据
   */
  async getIndexDaily(tsCode, startDate = null, endDate = null) {
    try {
      const result = await this.pro.index_daily({
        ts_code: tsCode,
        start_date: startDate,
        end_date: endDate,
        fields: 'ts_code,trade_date,open,high,low,close,pre_close,change,pct_chg,vol,amount'
      });
      return result.data || [];
    } catch (error) {
      logger.error(`获取指数日线数据失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取指数日线行情（带复权）
   * @param {string} tsCode - 指数代码
   * @param {string} startDate - 开始日期
   * @param {string} endDate - 结束日期
   * @returns {Promise<Array>} 复权K线数据
   */
  async getIndexDailyBasic(tsCode, startDate = null, endDate = null) {
    try {
      const result = await this.pro.index_dailybasic({
        ts_code: tsCode,
        start_date: startDate,
        end_date: endDate,
        fields: 'ts_code,trade_date,close,turnover,pb,pe,total_mv,float_mv'
      });
      return result.data || [];
    } catch (error) {
      logger.error(`获取指数基本面数据失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取指数权重
   * @param {string} indexCode - 指数代码
   * @param {string} tradeDate - 交易日期
   * @returns {Promise<Array>} 指数成分股权重
   */
  async getIndexWeight(indexCode, tradeDate = null) {
    try {
      const result = await this.pro.index_weight({
        index_code: indexCode,
        trade_date: tradeDate
      });
      return result.data || [];
    } catch (error) {
      logger.error(`获取指数权重失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取指数成分股
   * @param {string} indexCode - 指数代码
   * @returns {Promise<Array>} 指数成分股列表
   */
  async getIndexConstitute(indexCode) {
    try {
      const result = await this.pro.index_classify({
        index_code: indexCode
      });
      return result.data || [];
    } catch (error) {
      logger.error(`获取指数成分股失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取沪深港通十大成交股
   * @param {string} tradeDate - 交易日期
   * @returns {Promise<Array>} 沪深港通数据
   */
  async getHKExTrade(tradeDate) {
    try {
      const result = await this.pro.ggt_daily({
        trade_date: tradeDate,
        exchange: 'SSE'
      });
      return result.data || [];
    } catch (error) {
      logger.error(`获取沪深港通数据失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取融资融券交易汇总
   * @param {string} tradeDate - 交易日期
   * @returns {Promise<Object>} 融资融券数据
   */
  async getMarginTrade(tradeDate) {
    try {
      const result = await this.pro.margin({
        trade_date: tradeDate,
        exchange: 'SSE'
      });
      return result.data || [];
    } catch (error) {
      logger.error(`获取融资融券数据失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取交易日历
   * @param {string} startDate - 开始日期
   * @param {string} endDate - 结束日期
   * @param {string} exchange - 交易所 SSE/SZSE
   * @returns {Promise<Array>} 交易日历
   */
  async getTradeCal(startDate, endDate, exchange = 'SSE') {
    try {
      const result = await this.pro.trade_cal({
        exchange: exchange,
        start_date: startDate,
        end_date: endDate,
        fields: 'exchange,cal_date,is_open,pretrade_date'
      });
      return result.data || [];
    } catch (error) {
      logger.error(`获取交易日历失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取指数分钟数据（如果Tushare支持）
   * @param {string} tsCode - 指数代码
   * @param {string} tradeDate - 交易日期
   * @returns {Promise<Array>} 分钟数据
   */
  async getIndexMinute(tsCode, tradeDate) {
    try {
      // 注意：Tushare的分钟数据可能有权限限制
      const result = await this.pro.index_min({
        ts_code: tsCode,
        trade_date: tradeDate,
        fields: 'ts_code,close,open,high,low,vol,amount'
      });
      return result.data || [];
    } catch (error) {
      logger.error(`获取指数分钟数据失败: ${error.message}`);
      throw error;
    }
  }
}

module.exports = { TushareAPI };

