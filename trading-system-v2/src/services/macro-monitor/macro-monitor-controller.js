/**
 * 宏观监控主控制器
 * 统一管理所有宏观监控模块
 */

const FundFlowMonitor = require('./fund-flow-monitor');
const MarketSentimentMonitor = require('./market-sentiment-monitor');
const FuturesMarketMonitor = require('./futures-market-monitor');
const MacroEconomicMonitor = require('./macro-economic-monitor');
const PerformanceOptimizer = require('./performance-optimizer');
const logger = require('../../utils/logger');

class MacroMonitorController {
  constructor(database, cache) {
    this.database = database;
    this.cache = cache;
    this.isRunning = false;
    this.monitoringInterval = null;
    this.performanceOptimizer = new PerformanceOptimizer();

    // 初始化配置
    this.config = {
      // 资金流监控配置
      etherscanApiKey: process.env.ETHERSCAN_API_KEY || 'AZAZFVBNA16WCUMAHPGDFTVSXB5KJUHCIM',
      exchangeWallet: process.env.EXCHANGE_WALLET || '0x28C6c06298d514Db089934071355E5743bf21d60',
      btcThreshold: 10000000, // 10M USD
      ethThreshold: 1000, // 1000 ETH

      // 市场情绪配置
      lowThreshold: 20,
      highThreshold: 80,

      // 合约市场配置
      longShortRatioHigh: 2.0,
      longShortRatioLow: 0.5,

      // 宏观指标配置
      fredApiKey: process.env.FRED_API_KEY || 'fbfe3e85bdec733f71b17800eaa614fd',
      fedFundsHigh: 5.0,
      fedFundsLow: 2.0,
      cpiHigh: 4.0,
      cpiLow: 1.0,

      // 监控间隔
      monitoringInterval: 60000, // 1分钟
      alertCooldown: 30 // 30分钟冷却时间
    };

    // 初始化监控模块
    this.fundFlowMonitor = new FundFlowMonitor(database, this.config);
    this.sentimentMonitor = new MarketSentimentMonitor(database, this.config);
    this.futuresMonitor = new FuturesMarketMonitor(database, this.config);
    this.macroMonitor = new MacroEconomicMonitor(database, this.config);
  }

  /**
   * 启动宏观监控
   */
  async start() {
    try {
      if (this.isRunning) {
        logger.warn('宏观监控已在运行中');
        return;
      }

      logger.info('启动宏观监控服务...');

      // 启动性能优化器
      this.performanceOptimizer.start();

      // 加载配置
      await this.loadConfig();

      // 执行一次监控
      await this.runMonitoring();

      // 设置定时监控
      this.monitoringInterval = setInterval(async () => {
        try {
          // 检查是否应该暂停监控
          if (this.performanceOptimizer.shouldPauseMonitoring()) {
            logger.warn('内存使用过高，暂停监控');
            return;
          }

          await this.runMonitoring();
        } catch (error) {
          logger.error('定时监控执行失败:', error);
        }
      }, this.config.monitoringInterval);

      this.isRunning = true;
      logger.info('宏观监控服务启动成功');

    } catch (error) {
      logger.error('启动宏观监控服务失败:', error);
      throw error;
    }
  }

  /**
   * 停止宏观监控
   */
  async stop() {
    try {
      if (!this.isRunning) {
        logger.warn('宏观监控未在运行');
        return;
      }

      logger.info('停止宏观监控服务...');

      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = null;
      }

      // 停止性能优化器
      this.performanceOptimizer.stop();

      this.isRunning = false;
      logger.info('宏观监控服务已停止');

    } catch (error) {
      logger.error('停止宏观监控服务失败:', error);
      throw error;
    }
  }

  /**
   * 执行监控任务
   */
  async runMonitoring() {
    try {
      logger.info('开始执行宏观监控任务...');

      const allAlerts = [];

      // 并行执行所有监控任务
      const [fundFlowAlerts, sentimentAlerts, futuresAlerts, macroAlerts] = await Promise.allSettled([
        this.fundFlowMonitor.monitor(),
        this.sentimentMonitor.monitor(),
        this.futuresMonitor.monitor(),
        this.macroMonitor.monitor()
      ]);

      // 收集所有告警
      if (fundFlowAlerts.status === 'fulfilled') {
        allAlerts.push(...fundFlowAlerts.value);
      } else {
        logger.error('资金流监控失败:', fundFlowAlerts.reason);
      }

      if (sentimentAlerts.status === 'fulfilled') {
        allAlerts.push(...sentimentAlerts.value);
      } else {
        logger.error('市场情绪监控失败:', sentimentAlerts.reason);
      }

      if (futuresAlerts.status === 'fulfilled') {
        allAlerts.push(...futuresAlerts.value);
      } else {
        logger.error('合约市场监控失败:', futuresAlerts.reason);
      }

      if (macroAlerts.status === 'fulfilled') {
        allAlerts.push(...macroAlerts.value);
      } else {
        logger.error('宏观指标监控失败:', macroAlerts.reason);
      }

      // 处理告警
      if (allAlerts.length > 0) {
        await this.processAlerts(allAlerts);
      }

      // 更新缓存
      await this.updateCache();

      logger.info(`宏观监控任务完成，发现 ${allAlerts.length} 个告警`);

    } catch (error) {
      logger.error('执行宏观监控任务失败:', error);
      throw error;
    }
  }

  /**
   * 处理告警
   */
  async processAlerts(alerts) {
    try {
      for (const alert of alerts) {
        // 检查冷却时间
        const canSendAlert = await this.checkAlertCooldown(alert);
        if (!canSendAlert) {
          logger.info(`告警冷却中，跳过: ${alert.title}`);
          continue;
        }

        // 发送Telegram通知
        await this.sendTelegramAlert(alert);

        // 更新冷却时间
        await this.updateAlertCooldown(alert);
      }
    } catch (error) {
      logger.error('处理告警失败:', error);
      throw error;
    }
  }

  /**
   * 检查告警冷却时间
   */
  async checkAlertCooldown(alert) {
    try {
      const cacheKey = `macro_alert_cooldown:${alert.type}:${alert.metric_name}`;
      const lastAlertTime = await this.cache.get(cacheKey);

      if (!lastAlertTime) {
        return true;
      }

      const timeDiff = Date.now() - parseInt(lastAlertTime);
      const cooldownMs = this.config.alertCooldown * 60 * 1000; // 转换为毫秒

      return timeDiff >= cooldownMs;
    } catch (error) {
      logger.error('检查告警冷却时间失败:', error);
      return true; // 出错时允许发送告警
    }
  }

  /**
   * 更新告警冷却时间
   */
  async updateAlertCooldown(alert) {
    try {
      const cacheKey = `macro_alert_cooldown:${alert.type}:${alert.metric_name}`;
      await this.cache.setex(cacheKey, this.config.alertCooldown * 60, Date.now().toString());
    } catch (error) {
      logger.error('更新告警冷却时间失败:', error);
    }
  }

  /**
   * 发送Telegram告警
   */
  async sendTelegramAlert(alert) {
    try {
      // 这里需要实现Telegram发送逻辑
      // 暂时只记录日志
      logger.info(`发送Telegram告警: ${alert.title} - ${alert.message}`);

      // TODO: 实现实际的Telegram发送
      // await this.telegramService.sendAlert(alert);

    } catch (error) {
      logger.error('发送Telegram告警失败:', error);
    }
  }

  /**
   * 更新缓存
   */
  async updateCache() {
    try {
      // 获取最新的监控数据
      const [fundFlowData, sentimentData, futuresData, macroData] = await Promise.all([
        this.fundFlowMonitor.getFundFlowData(10),
        this.sentimentMonitor.getSentimentData(10),
        this.futuresMonitor.getFuturesData(10),
        this.macroMonitor.getMacroData(10)
      ]);

      // 更新缓存
      await this.cache.setex('macro_monitor:fund_flow', 300, JSON.stringify(fundFlowData));
      await this.cache.setex('macro_monitor:sentiment', 300, JSON.stringify(sentimentData));
      await this.cache.setex('macro_monitor:futures', 300, JSON.stringify(futuresData));
      await this.cache.setex('macro_monitor:macro', 300, JSON.stringify(macroData));

    } catch (error) {
      logger.error('更新缓存失败:', error);
    }
  }

  /**
   * 加载配置
   */
  async loadConfig() {
    try {
      const query = 'SELECT config_key, config_value FROM macro_monitoring_config WHERE is_active = 1';
      const rows = await this.database.query(query);

      for (const row of rows) {
        const key = row.config_key;
        const value = row.config_value;

        // 更新配置
        if (key.includes('threshold') || key.includes('interval') || key.includes('cooldown')) {
          this.config[key] = parseFloat(value);
        } else if (key.includes('enabled')) {
          this.config[key] = value === 'true';
        } else {
          this.config[key] = value;
        }
      }

      logger.info('宏观监控配置加载完成');
    } catch (error) {
      logger.error('加载配置失败:', error);
    }
  }

  /**
   * 获取监控状态
   */
  async getStatus() {
    try {
      const [fundFlowData, sentimentData, futuresData, macroData] = await Promise.all([
        this.cache.get('macro_monitor:fund_flow'),
        this.cache.get('macro_monitor:sentiment'),
        this.cache.get('macro_monitor:futures'),
        this.cache.get('macro_monitor:macro')
      ]);

      // 获取性能统计
      const performanceStats = this.performanceOptimizer.getPerformanceStats();
      const optimizationSuggestions = this.performanceOptimizer.getOptimizationSuggestions();

      return {
        isRunning: this.isRunning,
        monitoringInterval: this.config.monitoringInterval,
        performance: performanceStats,
        optimizationSuggestions: optimizationSuggestions,
        data: {
          fundFlow: fundFlowData ? JSON.parse(fundFlowData) : [],
          sentiment: sentimentData ? JSON.parse(sentimentData) : [],
          futures: futuresData ? JSON.parse(futuresData) : [],
          macro: macroData ? JSON.parse(macroData) : []
        }
      };
    } catch (error) {
      logger.error('获取监控状态失败:', error);
      throw error;
    }
  }

  /**
   * 手动触发监控
   */
  async triggerMonitoring() {
    try {
      logger.info('手动触发宏观监控...');
      await this.runMonitoring();
      return { success: true, message: '监控任务已触发' };
    } catch (error) {
      logger.error('手动触发监控失败:', error);
      return { success: false, message: error.message };
    }
  }
}

module.exports = MacroMonitorController;
