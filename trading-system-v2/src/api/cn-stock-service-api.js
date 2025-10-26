/**
 * A股数据服务API客户端
 * 调用独立的Python数据服务
 */

const logger = require('../utils/logger');

class CNStockServiceAPI {
  constructor(config) {
    this.baseURL = config.baseURL || 'http://localhost:5001';
    this.timeout = config.timeout || 30000;
  }

  /**
   * 发起HTTP请求
   */
  async request(endpoint, options = {}) {
    try {
      const url = `${this.baseURL}${endpoint}`;
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error(`API请求失败: ${endpoint}, ${error.message}`);
      throw error;
    }
  }

  /**
   * 健康检查
   */
  async health() {
    return await this.request('/health');
  }

  /**
   * 获取支持的指数列表
   */
  async getIndexes() {
    try {
      const result = await this.request('/api/v1/indexes');
      return result.data || [];
    } catch (error) {
      logger.error(`获取指数列表失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取指数日线数据
   * @param {string} code - 指数代码，如 '000300'
   * @param {string} startDate - 开始日期 'YYYYMMDD'
   * @param {string} endDate - 结束日期 'YYYYMMDD'
   * @param {number} limit - 数据条数
   * @returns {Promise<Array>} K线数据
   */
  async getIndexDaily(code, startDate = null, endDate = null, limit = 100) {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (limit) params.append('limit', limit);

      const result = await this.request(`/api/v1/index/${code}/daily?${params.toString()}`);
      
      // 转换为统一格式
      return result.data.map(item => ({
        trade_date: item.date,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        vol: item.volume,
        pct_chg: item.change_pct,
        ts_code: `${code}.SH` // 默认沪市
      }));
    } catch (error) {
      logger.error(`获取指数日线数据失败: ${code}, ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取指数基本信息
   */
  async getIndexInfo(code) {
    try {
      const result = await this.request(`/api/v1/index/${code}/info`);
      return result.data;
    } catch (error) {
      logger.error(`获取指数信息失败: ${code}, ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取实时行情
   */
  async getIndexRealtime(code) {
    try {
      const result = await this.request(`/api/v1/index/${code}/realtime`);
      return {
        symbol: code,
        price: result.price,
        change: result.change,
        changePercent: result.change,
        volume: result.volume,
        timestamp: new Date(result.timestamp)
      };
    } catch (error) {
      logger.error(`获取实时行情失败: ${code}, ${error.message}`);
      throw error;
    }
  }

  /**
   * 转换为Tushare格式（兼容性）
   */
  convertToTushareFormat(data) {
    return data.map(item => ({
      ts_code: item.ts_code,
      trade_date: item.trade_date.replace(/-/g, ''),
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      vol: item.vol,
      amount: 0,
      pre_close: 0,
      pct_chg: item.pct_chg || 0
    }));
  }
}

module.exports = CNStockServiceAPI;

