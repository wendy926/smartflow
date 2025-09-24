/**
 * 资金流监控模块
 * 监控链上大额资金流和交易所钱包转账
 */

const logger = require('../../utils/logger');

class FundFlowMonitor {
  constructor(database, config) {
    this.database = database;
    this.config = config;
    this.etherscanApiKey = config.etherscanApiKey || 'AZAZFVBNA16WCUMAHPGDFTVSXB5KJUHCIM';
    this.blockchairApiKey = config.blockchairApiKey || '';
    this.exchangeWallet = config.exchangeWallet || '0x28C6c06298d514Db089934071355E5743bf21d60';
    this.btcThreshold = config.btcThreshold || 10000000; // 10M USD
    this.ethThreshold = config.ethThreshold || 1000; // 1000 ETH
  }

  /**
   * 检查BTC大额交易
   */
  async checkLargeBTCTransactions() {
    try {
      const fetch = (await import('node-fetch')).default;
      const url = this.blockchairApiKey
        ? `https://api.blockchair.com/bitcoin/transactions?q=value_usd(gt.1000000)&key=${this.blockchairApiKey}`
        : 'https://api.blockchair.com/bitcoin/transactions?q=value_usd(gt.1000000)';
      const response = await fetch(url);
      const data = await response.json();

      if (data.data && data.data.length > 0) {
        const alerts = [];

        for (const tx of data.data) {
          const usdValue = parseFloat(tx.value_usd || 0);
          if (usdValue > 0) {
            // 记录数据
            await this.saveFundFlowData('FUND_FLOW', 'Blockchair', 'BTC大额交易', usdValue, 'USD', 'NORMAL', {
              transaction_hash: tx.transaction_hash,
              value_btc: tx.value,
              value_usd: usdValue,
              timestamp: tx.time
            });

            // 检查告警阈值
            if (usdValue > this.btcThreshold) {
              alerts.push({
                type: 'FUND_FLOW',
                level: 'CRITICAL',
                title: 'BTC大额转账告警',
                message: `检测到BTC大额转账: $${usdValue.toLocaleString()} USD`,
                metric_name: 'BTC大额交易',
                metric_value: usdValue,
                threshold_value: this.btcThreshold
              });
            }
          }
        }

        return alerts;
      }
    } catch (error) {
      logger.error('检查BTC大额交易失败:', error);
      throw error;
    }

    return [];
  }

  /**
   * 检查交易所钱包大额转账
   */
  async checkExchangeWalletFlows() {
    try {
      const fetch = (await import('node-fetch')).default;
      const url = `https://api.etherscan.io/api?module=account&action=txlist&address=${this.exchangeWallet}&apikey=${this.etherscanApiKey}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === '1' && data.result) {
        const alerts = [];
        const recentTxs = data.result.slice(-5); // 最近5笔交易

        for (const tx of recentTxs) {
          const valueEth = parseFloat(tx.value) / 1e18;
          if (valueEth > 0) {
            // 记录数据
            await this.saveFundFlowData('FUND_FLOW', 'Etherscan', 'ETH大额转账', valueEth, 'ETH', 'NORMAL', {
              transaction_hash: tx.hash,
              value_eth: valueEth,
              from: tx.from,
              to: tx.to,
              timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString()
            });

            // 检查告警阈值
            if (valueEth > this.ethThreshold) {
              alerts.push({
                type: 'FUND_FLOW',
                level: 'CRITICAL',
                title: '交易所钱包大额转账告警',
                message: `检测到交易所钱包大额转账: ${valueEth.toFixed(2)} ETH`,
                metric_name: 'ETH大额转账',
                metric_value: valueEth,
                threshold_value: this.ethThreshold
              });
            }
          }
        }

        return alerts;
      }
    } catch (error) {
      logger.error('检查交易所钱包转账失败:', error);
      throw error;
    }

    return [];
  }

  /**
   * 执行资金流监控
   */
  async monitor() {
    try {
      logger.info('开始资金流监控...');

      const alerts = [];

      // 检查BTC大额交易
      const btcAlerts = await this.checkLargeBTCTransactions();
      alerts.push(...btcAlerts);

      // 检查交易所钱包转账
      const ethAlerts = await this.checkExchangeWalletFlows();
      alerts.push(...ethAlerts);

      // 处理告警
      for (const alert of alerts) {
        await this.saveAlert(alert);
      }

      logger.info(`资金流监控完成，发现 ${alerts.length} 个告警`);
      return alerts;

    } catch (error) {
      logger.error('资金流监控失败:', error);
      throw error;
    }
  }

  /**
   * 保存资金流数据
   */
  async saveFundFlowData(dataType, source, metricName, metricValue, metricUnit, alertLevel, rawData) {
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
      logger.error('保存资金流数据失败:', error);
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
   * 获取资金流数据
   */
  async getFundFlowData(limit = 50) {
    try {
      const query = `
        SELECT * FROM macro_monitoring_data 
        WHERE data_type = 'FUND_FLOW' 
        ORDER BY created_at DESC 
        LIMIT 50
      `;

      const rows = await this.database.query(query);
      return rows;

    } catch (error) {
      logger.error('获取资金流数据失败:', error);
      throw error;
    }
  }
}

module.exports = FundFlowMonitor;
