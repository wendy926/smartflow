/**
 * 数据更新服务
 * 从Binance API获取真实价格数据并更新数据库
 */

const axios = require('axios');
const logger = require('../utils/logger');

class DataUpdater {
  constructor(database, redis) {
    this.database = database;
    this.redis = redis;
    this.binanceBaseUrl = 'https://fapi.binance.com';
    this.updateInterval = 60000; // 1分钟更新一次
    this.isRunning = false;
    this.symbols = [
      'BTCUSDT', 'ETHUSDT', 'ONDOUSDT', 'MKRUSDT', 
      'PENDLEUSDT', 'MPLUSDT', 'LINKUSDT', 'LDOUSDT'
    ];
  }

  /**
   * 启动数据更新服务
   */
  start() {
    if (this.isRunning) {
      logger.warn('数据更新服务已在运行');
      return;
    }

    this.isRunning = true;
    logger.info('启动数据更新服务');
    
    // 立即执行一次更新
    this.updateAllSymbols();
    
    // 设置定时更新
    this.intervalId = setInterval(() => {
      this.updateAllSymbols();
    }, this.updateInterval);
  }

  /**
   * 停止数据更新服务
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    logger.info('停止数据更新服务');
  }

  /**
   * 更新所有交易对数据
   */
  async updateAllSymbols() {
    try {
      logger.info('开始更新交易对数据');
      
      for (const symbol of this.symbols) {
        try {
          await this.updateSymbolData(symbol);
          // 添加延迟避免API限制
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          logger.error(`更新 ${symbol} 数据失败:`, error.message);
        }
      }
      
      logger.info('交易对数据更新完成');
    } catch (error) {
      logger.error('更新交易对数据失败:', error);
    }
  }

  /**
   * 更新单个交易对数据
   */
  async updateSymbolData(symbol) {
    try {
      // 获取24小时价格统计
      const tickerResponse = await axios.get(`${this.binanceBaseUrl}/fapi/v1/ticker/24hr?symbol=${symbol}`, {
        timeout: 5000
      });

      if (tickerResponse.data) {
        const tickerData = tickerResponse.data;
        
        // 获取资金费率
        let fundingRate = '0.00010000';
        try {
          const fundingResponse = await axios.get(`${this.binanceBaseUrl}/fapi/v1/premiumIndex?symbol=${symbol}`, {
            timeout: 3000
          });
          if (fundingResponse.data && fundingResponse.data.lastFundingRate) {
            fundingRate = fundingResponse.data.lastFundingRate;
          }
        } catch (error) {
          logger.warn(`获取 ${symbol} 资金费率失败:`, error.message);
        }

        // 更新数据库 - 使用北京时间
        await this.updateSymbolInDatabase(symbol, {
          last_price: parseFloat(tickerData.lastPrice),
          volume_24h: parseFloat(tickerData.volume),
          price_change_24h: parseFloat(tickerData.priceChangePercent) / 100,
          funding_rate: fundingRate
        });

        // 获取北京时间
        const beijingTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
        logger.info(`✅ 更新 ${symbol}: 价格=${tickerData.lastPrice}, 变化=${tickerData.priceChangePercent}% (${beijingTime})`);
      }
    } catch (error) {
      logger.error(`更新 ${symbol} 数据失败:`, error.message);
    }
  }

  /**
   * 更新数据库中的交易对数据
   */
  async updateSymbolInDatabase(symbol, data) {
    try {
      // 使用数据库操作模块
      const DatabaseOperations = require('../database/operations');
      const dbOps = DatabaseOperations;
      
      // 直接使用SQL更新 - 使用北京时间
      const connection = await dbOps.getConnection();
      await connection.execute(
        `UPDATE symbols 
         SET last_price = ?, 
             volume_24h = ?, 
             price_change_24h = ?, 
             funding_rate = ?, 
             updated_at = CONVERT_TZ(NOW(), '+00:00', '+08:00')
         WHERE symbol = ?`,
        [
          data.last_price,
          data.volume_24h,
          data.price_change_24h,
          data.funding_rate,
          symbol
        ]
      );

      // 清除相关缓存
      await this.redis.del('symbols:all');
      await this.redis.del(`symbol:${symbol}`);
      
      logger.debug(`数据库更新完成: ${symbol}`);
    } catch (error) {
      logger.error(`更新数据库失败 ${symbol}:`, error);
    }
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    // 使用北京时间
    const beijingTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    return {
      isRunning: this.isRunning,
      updateInterval: this.updateInterval,
      symbols: this.symbols,
      lastUpdate: beijingTime,
      timezone: 'Asia/Shanghai (UTC+8)'
    };
  }
}

module.exports = DataUpdater;
