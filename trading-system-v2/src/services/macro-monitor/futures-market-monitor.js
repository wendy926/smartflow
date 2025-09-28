/**
 * 合约市场监控模块
 * 监控多空比、未平仓合约、资金费率等合约市场指标
 */

const logger = require('../../utils/logger');

class FuturesMarketMonitor {
  constructor(database, config) {
    this.database = database;
    this.config = config;
    this.longShortRatioHigh = config.longShortRatioHigh || 2.0;
    this.longShortRatioLow = config.longShortRatioLow || 0.5;

    // API端点
    this.binanceLongShort = 'https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=5m';
    this.binanceOI = 'https://fapi.binance.com/futures/data/openInterestHist?symbol=BTCUSDT&period=5m';
    this.bybitLongShort = 'https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=BTCUSDT&period=5m';
    this.bybitFunding = 'https://api.bybit.com/v5/market/funding/history?category=linear&symbol=BTCUSDT&limit=1';
    this.okxOI = 'https://www.okx.com/api/v5/public/open-interest?instId=BTC-USDT-SWAP';
    this.okxFunding = 'https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USDT-SWAP';
  }

  /**
   * 检查Binance合约市场数据
   */
  async checkBinanceFutures() {
    try {
      const fetch = (await import('node-fetch')).default;
      const alerts = [];

      // 检查多空比
      const longShortResponse = await fetch(this.binanceLongShort);
      const longShortData = await longShortResponse.json();

      if (Array.isArray(longShortData) && longShortData.length > 0) {
        const latest = longShortData[longShortData.length - 1];
        const ratio = parseFloat(latest.longShortRatio);

        // 记录数据
        await this.saveFuturesData('FUTURES_MARKET', 'Binance', '多空比', ratio, '比率', 'NORMAL', {
          longShortRatio: ratio,
          timestamp: latest.timestamp
        });

        // 检查告警阈值
        if (ratio > this.longShortRatioHigh) {
          alerts.push({
            type: 'FUTURES_MARKET',
            level: 'WARNING',
            title: 'Binance多头过热告警',
            message: `Binance多空比过高: ${ratio.toFixed(2)}`,
            metric_name: '多空比',
            metric_value: ratio,
            threshold_value: this.longShortRatioHigh
          });
        } else if (ratio < this.longShortRatioLow) {
          alerts.push({
            type: 'FUTURES_MARKET',
            level: 'WARNING',
            title: 'Binance空头过重告警',
            message: `Binance多空比过低: ${ratio.toFixed(2)}`,
            metric_name: '多空比',
            metric_value: ratio,
            threshold_value: this.longShortRatioLow
          });
        }
      }

      // 检查未平仓合约
      const oiResponse = await fetch(this.binanceOI);
      const oiData = await oiResponse.json();

      if (Array.isArray(oiData) && oiData.length > 0) {
        const latest = oiData[oiData.length - 1];
        const oi = parseFloat(latest.sumOpenInterest);

        // 计算4小时涨跌百分比
        let oiChangePercent = 0;
        if (oiData.length >= 2) {
          const previous = parseFloat(oiData[oiData.length - 2].sumOpenInterest);
          if (previous > 0) {
            oiChangePercent = ((oi - previous) / previous) * 100;
          }
        }

        // 记录数据，包含涨跌百分比
        await this.saveFuturesData('FUTURES_MARKET', 'Binance', '未平仓合约', oi, 'USD', 'NORMAL', {
          openInterest: oi,
          oiChangePercent: oiChangePercent,
          timestamp: latest.timestamp
        });

        logger.info(`Binance未平仓合约更新: ${oi.toFixed(2)} USD (${oiChangePercent >= 0 ? '+' : ''}${oiChangePercent.toFixed(2)}%)`);
      }

      return alerts;
    } catch (error) {
      logger.error('检查Binance合约市场数据失败:', error);
      throw error;
    }
  }

  /**
   * 检查Bybit合约市场数据
   */
  async checkBybitFutures() {
    try {
      const fetch = (await import('node-fetch')).default;
      const alerts = [];

      // 检查多空比
      const longShortResponse = await fetch(this.bybitLongShort);
      const longShortData = await longShortResponse.json();

      if (longShortData.result && longShortData.result.length > 0) {
        const latest = longShortData.result[longShortData.result.length - 1];
        const ratio = parseFloat(latest.longShortRatio);

        // 记录数据
        await this.saveFuturesData('FUTURES_MARKET', 'Bybit', '多空比', ratio, '比率', 'NORMAL', {
          longShortRatio: ratio,
          timestamp: latest.timestamp
        });

        // 检查告警阈值
        if (ratio > this.longShortRatioHigh) {
          alerts.push({
            type: 'FUTURES_MARKET',
            level: 'WARNING',
            title: 'Bybit多头过热告警',
            message: `Bybit多空比过高: ${ratio.toFixed(2)}`,
            metric_name: '多空比',
            metric_value: ratio,
            threshold_value: this.longShortRatioHigh
          });
        } else if (ratio < this.longShortRatioLow) {
          alerts.push({
            type: 'FUTURES_MARKET',
            level: 'WARNING',
            title: 'Bybit空头过重告警',
            message: `Bybit多空比过低: ${ratio.toFixed(2)}`,
            metric_name: '多空比',
            metric_value: ratio,
            threshold_value: this.longShortRatioLow
          });
        }
      }

      // 检查资金费率
      const fundingResponse = await fetch(this.bybitFunding);
      const fundingData = await fundingResponse.json();

      if (fundingData.result && fundingData.result.length > 0) {
        const fundingRate = parseFloat(fundingData.result[0].fundingRate);

        // 记录数据
        await this.saveFuturesData('FUTURES_MARKET', 'Bybit', '资金费率', fundingRate, '费率', 'NORMAL', {
          fundingRate: fundingRate,
          timestamp: fundingData.result[0].fundingTime
        });
      }

      return alerts;
    } catch (error) {
      logger.error('检查Bybit合约市场数据失败:', error);
      throw error;
    }
  }

  /**
   * 检查OKX合约市场数据
   */
  async checkOKXFutures() {
    try {
      const fetch = (await import('node-fetch')).default;
      const alerts = [];

      // 检查未平仓合约
      const oiResponse = await fetch(this.okxOI);
      const oiData = await oiResponse.json();

      if (oiData.data && oiData.data.length > 0) {
        const oi = parseFloat(oiData.data[0].oi);

        // 获取历史数据计算涨跌百分比
        let oiChangePercent = 0;
        try {
          const historicalQuery = `
            SELECT metric_value FROM macro_monitoring_data 
            WHERE data_type = 'FUTURES_MARKET' 
            AND source = 'OKX' 
            AND metric_name = '未平仓合约'
            AND created_at >= DATE_SUB(NOW(), INTERVAL 5 HOUR)
            ORDER BY created_at DESC 
            LIMIT 1
          `;
          const historicalRows = await this.database.query(historicalQuery);
          
          if (historicalRows.length > 0) {
            const previousOI = parseFloat(historicalRows[0].metric_value);
            if (previousOI > 0) {
              oiChangePercent = ((oi - previousOI) / previousOI) * 100;
            }
          }
        } catch (error) {
          logger.warn('获取OKX历史未平仓合约数据失败:', error.message);
        }

        // 记录数据，包含涨跌百分比
        await this.saveFuturesData('FUTURES_MARKET', 'OKX', '未平仓合约', oi, 'USD', 'NORMAL', {
          openInterest: oi,
          oiChangePercent: oiChangePercent,
          timestamp: oiData.data[0].ts
        });

        logger.info(`OKX未平仓合约更新: ${oi.toFixed(2)} USD (${oiChangePercent >= 0 ? '+' : ''}${oiChangePercent.toFixed(2)}%)`);
      }

      // 检查资金费率
      const fundingResponse = await fetch(this.okxFunding);
      const fundingData = await fundingResponse.json();

      if (fundingData.data && fundingData.data.length > 0) {
        const fundingRate = parseFloat(fundingData.data[0].fundingRate);

        // 记录数据
        await this.saveFuturesData('FUTURES_MARKET', 'OKX', '资金费率', fundingRate, '费率', 'NORMAL', {
          fundingRate: fundingRate,
          timestamp: fundingData.data[0].fundingTime
        });
      }

      return alerts;
    } catch (error) {
      logger.error('检查OKX合约市场数据失败:', error);
      throw error;
    }
  }

  /**
   * 执行合约市场监控
   */
  async monitor() {
    try {
      logger.info('开始合约市场监控...');

      const alerts = [];

      // 检查各个交易所
      const binanceAlerts = await this.checkBinanceFutures();
      alerts.push(...binanceAlerts);

      const bybitAlerts = await this.checkBybitFutures();
      alerts.push(...bybitAlerts);

      const okxAlerts = await this.checkOKXFutures();
      alerts.push(...okxAlerts);

      // 处理告警
      for (const alert of alerts) {
        await this.saveAlert(alert);
      }

      logger.info(`合约市场监控完成，发现 ${alerts.length} 个告警`);
      return alerts;

    } catch (error) {
      logger.error('合约市场监控失败:', error);
      throw error;
    }
  }

  /**
   * 保存合约市场数据
   */
  async saveFuturesData(dataType, source, metricName, metricValue, metricUnit, alertLevel, rawData) {
    try {
      const query = `
        INSERT INTO macro_monitoring_data 
        (data_type, source, metric_name, metric_value, metric_unit, alert_level, raw_data, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      `;

      await this.database.query(query, [
        dataType,
        source,
        metricName,
        metricValue,
        metricUnit,
        alertLevel,
        JSON.stringify(rawData)
      ]);

    } catch (error) {
      logger.error('保存合约市场数据失败:', error);
      throw error;
    }
  }

  /**
   * 保存告警记录
   */
  async saveAlert(alert) {
    try {
      const query = `
        INSERT INTO macro_monitoring_alerts 
        (alert_type, alert_level, title, message, metric_name, metric_value, threshold_value, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      `;

      await this.database.query(query, [
        alert.type,
        alert.level,
        alert.title,
        alert.message,
        alert.metric_name,
        alert.metric_value,
        alert.threshold_value
      ]);

    } catch (error) {
      logger.error('保存告警记录失败:', error);
      throw error;
    }
  }

  /**
   * 获取合约市场数据
   */
  async getFuturesData(limit = 50) {
    try {
      const query = `
        SELECT * FROM macro_monitoring_data 
        WHERE data_type = 'FUTURES_MARKET' 
        ORDER BY created_at DESC 
        LIMIT 50
      `;

      const rows = await this.database.query(query);
      return rows;

    } catch (error) {
      logger.error('获取合约市场数据失败:', error);
      throw error;
    }
  }
}

module.exports = FuturesMarketMonitor;
