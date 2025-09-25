/**
 * 资金流监控模块
 * 监控链上大额资金流和交易所钱包转账
 */

const logger = require('../../utils/logger');

// 地址标签库
const walletLabels = {
  BTC: {
    binance: ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"],
    coinbase: ["3Cbq7aT1tY8kMxWLbitaG7yT6bPbKChq64"],
    kraken: ["3M219KRhuz2Q2DcbLNCgH3BeE4Y3H3w8sN"],
    whales: ["1FeexV6bAHb8ybZjqQMjJrcCrHGW9sb6uF"],
  },
  ETH: {
    binance: ["0x564286362092D8e7936f0549571a803B203aAceD".toLowerCase()],
    coinbase: ["0x503828976D22510aad0201ac7EC88293211D23Da".toLowerCase()],
    kraken: ["0x0a869d79a7052c7f1b55a8ebabbea3420f0d1e13".toLowerCase()],
    whales: ["0x742d35Cc6634C0532925a3b844Bc454e4438f44e".toLowerCase()],
  },
};

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
   * 判断地址标签
   */
  getAddressLabel(addr, chain = "BTC") {
    if (!addr) return "unknown";
    const labels = walletLabels[chain];
    for (const [name, list] of Object.entries(labels)) {
      if (list.includes(addr.toLowerCase())) return name;
    }
    return "unknown";
  }

  /**
   * 检查BTC大额交易
   */
  async checkLargeBTCTransactions() {
    try {
      const fetch = (await import('node-fetch')).default;
      const threshold = 5000000; // 500万美元阈值
      const url = this.blockchairApiKey
        ? `https://api.blockchair.com/bitcoin/transactions?q=value_usd(${threshold}..)&key=${this.blockchairApiKey}`
        : `https://api.blockchair.com/bitcoin/transactions?q=value_usd(${threshold}..)`;
      
      logger.info(`检查BTC大额交易，阈值: $${threshold.toLocaleString()}`);
      const response = await fetch(url);
      const data = await response.json();

      if (data.data && data.data.length > 0) {
        const alerts = [];
        logger.info(`发现 ${data.data.length} 笔BTC大额交易`);

        for (const tx of data.data) {
          const usdValue = parseFloat(tx.value_usd || 0);
          if (usdValue > 0 && !isNaN(usdValue)) {
            // 分析输入输出地址
            const inputs = tx.inputs ? tx.inputs.map(i => i.recipient) : [];
            const outputs = tx.outputs ? tx.outputs.map(o => o.recipient) : [];
            
            const inputLabels = inputs.map(addr => this.getAddressLabel(addr, 'BTC'));
            const outputLabels = outputs.map(addr => this.getAddressLabel(addr, 'BTC'));

            // 记录数据
            await this.saveFundFlowData('FUND_FLOW', 'Blockchair', 'BTC大额交易', usdValue, 'USD', 'NORMAL', {
              transaction_hash: tx.transaction_hash,
              value_btc: tx.value,
              value_usd: usdValue,
              timestamp: tx.time,
              inputs: inputs,
              outputs: outputs,
              input_labels: inputLabels,
              output_labels: outputLabels
            });

            // 检查特殊转账模式
            let alertMessage = `检测到BTC大额转账: $${usdValue.toLocaleString()} USD`;
            let alertLevel = 'NORMAL';

            if (inputLabels.includes('binance') && !outputLabels.includes('binance')) {
              alertMessage = `🚨 Binance → 外部, 转出 $${usdValue.toLocaleString()} USD`;
              alertLevel = 'CRITICAL';
            } else if (!inputLabels.includes('binance') && outputLabels.includes('binance')) {
              alertMessage = `🚨 外部 → Binance, 转入 $${usdValue.toLocaleString()} USD`;
              alertLevel = 'CRITICAL';
            } else if (inputLabels.includes('whales') || outputLabels.includes('whales')) {
              alertMessage = `🐋 巨鲸转账: $${usdValue.toLocaleString()} USD`;
              alertLevel = 'WARNING';
            }

            // 检查告警阈值
            if (usdValue > this.btcThreshold) {
              alerts.push({
                type: 'FUND_FLOW',
                level: alertLevel,
                title: 'BTC大额转账告警',
                message: alertMessage,
                metric_name: 'BTC大额交易',
                metric_value: usdValue,
                threshold_value: this.btcThreshold
              });
            }
          }
        }

        return alerts;
      } else {
        logger.info('未发现BTC大额交易');
      }
    } catch (error) {
      logger.error('检查BTC大额交易失败:', error);
      throw error;
    }

    return [];
  }

  /**
   * 检查ETH大额转账
   */
  async checkExchangeWalletFlows() {
    try {
      const fetch = (await import('node-fetch')).default;
      const threshold = 10000000; // 1000万美元阈值
      
      // 使用Ethplorer API获取大额交易
      const url = `https://api.ethplorer.io/getTopTransactions?apiKey=freekey`;
      logger.info(`检查ETH大额交易，阈值: $${threshold.toLocaleString()}`);
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.operations && data.operations.length > 0) {
        const alerts = [];
        logger.info(`发现 ${data.operations.length} 笔ETH大额交易`);

        for (const op of data.operations) {
          const from = op.from?.toLowerCase();
          const to = op.to?.toLowerCase();
          const valueUSD = (op.value || 0) * (op.tokenInfo?.price?.rate || 0);

          if (valueUSD > threshold && !isNaN(valueUSD)) {
            const fromLabel = this.getAddressLabel(from, 'ETH');
            const toLabel = this.getAddressLabel(to, 'ETH');

            // 记录数据
            await this.saveFundFlowData('FUND_FLOW', 'Ethplorer', 'ETH大额转账', valueUSD, 'USD', 'NORMAL', {
              transaction_hash: op.transactionHash,
              value_usd: valueUSD,
              from: from,
              to: to,
              from_label: fromLabel,
              to_label: toLabel,
              timestamp: new Date().toISOString()
            });

            // 检查特殊转账模式
            let alertMessage = `检测到ETH大额转账: $${valueUSD.toLocaleString()} USD`;
            let alertLevel = 'NORMAL';

            if (fromLabel !== 'unknown' && toLabel === 'unknown') {
              alertMessage = `🚨 ${fromLabel} → 外部, 转出 $${valueUSD.toLocaleString()} USD`;
              alertLevel = 'CRITICAL';
            } else if (fromLabel === 'unknown' && toLabel !== 'unknown') {
              alertMessage = `🚨 外部 → ${toLabel}, 转入 $${valueUSD.toLocaleString()} USD`;
              alertLevel = 'CRITICAL';
            } else if (fromLabel === 'whales' || toLabel === 'whales') {
              alertMessage = `🐋 巨鲸转账: $${valueUSD.toLocaleString()} USD`;
              alertLevel = 'WARNING';
            }

            // 检查告警阈值
            if (valueUSD > this.btcThreshold) {
              alerts.push({
                type: 'FUND_FLOW',
                level: alertLevel,
                title: 'ETH大额转账告警',
                message: alertMessage,
                metric_name: 'ETH大额转账',
                metric_value: valueUSD,
                threshold_value: this.btcThreshold
              });
            }
          }
        }

        return alerts;
      } else {
        logger.info('未发现ETH大额交易');
      }
    } catch (error) {
      logger.error('检查ETH大额交易失败:', error);
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
