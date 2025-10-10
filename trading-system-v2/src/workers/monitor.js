/**
 * 系统监控工作进程
 * 负责监控系统资源使用情况
 */

const os = require('os');
const logger = require('../utils/logger');
const config = require('../config');
const TelegramMonitoringService = require('../services/telegram-monitoring');

class SystemMonitor {
  constructor() {
    this.isRunning = false;
    this.monitorInterval = 30 * 1000; // 30秒检查一次
    this.cpuThreshold = 60; // CPU使用率阈值
    this.memoryThreshold = 60; // 内存使用率阈值
    this.telegramService = new TelegramMonitoringService(); // Telegram通知服务
    this.alertCooldown = new Map(); // 告警冷却
    this.cooldownPeriod = 300000; // 5分钟冷却期
  }

  async start() {
    if (this.isRunning) {
      logger.warn('系统监控进程已在运行');
      return;
    }

    this.isRunning = true;
    logger.info('系统监控进程启动');

    // 定期监控系统资源
    setInterval(async () => {
      try {
        await this.checkSystemResources();
      } catch (error) {
        logger.error(`系统监控失败: ${error.message}`);
      }
    }, this.monitorInterval);
  }

  async checkSystemResources() {
    const cpuUsage = await this.getCpuUsage();
    const memoryUsage = this.getMemoryUsage();

    logger.info(`系统资源使用情况 - CPU: ${cpuUsage.toFixed(2)}%, 内存: ${memoryUsage.toFixed(2)}%`);

    // 检查是否超过阈值
    if (cpuUsage > this.cpuThreshold) {
      logger.warn(`CPU使用率过高: ${cpuUsage.toFixed(2)}% > ${this.cpuThreshold}%`);
      await this.sendAlert('CPU_HIGH', `CPU使用率过高: ${cpuUsage.toFixed(2)}%`, { cpu: cpuUsage, threshold: this.cpuThreshold });
    }

    if (memoryUsage > this.memoryThreshold) {
      logger.warn(`内存使用率过高: ${memoryUsage.toFixed(2)}% > ${this.memoryThreshold}%`);
      await this.sendAlert('MEMORY_HIGH', `内存使用率过高: ${memoryUsage.toFixed(2)}%`, { memory: memoryUsage, threshold: this.memoryThreshold });
    }

    // 检查API成功率
    await this.checkAPIStatus();
  }

  /**
   * 检查API状态
   */
  async checkAPIStatus() {
    try {
      const { getBinanceAPI } = require('../api/binance-api-singleton');
      const binanceAPI = getBinanceAPI();
      const apiStats = binanceAPI.getStats();

      // REST API成功率检查
      const restSuccessRate = apiStats.rest.successRate;
      if (restSuccessRate < 80 && apiStats.rest.totalRequests > 10) {
        logger.warn(`Binance REST API成功率过低: ${restSuccessRate}%`);
        await this.sendAlert(
          'API_REST_LOW',
          `Binance REST API成功率过低: ${restSuccessRate}%`,
          {
            successRate: restSuccessRate,
            totalRequests: apiStats.rest.totalRequests,
            failedRequests: apiStats.rest.failedRequests
          }
        );
      }

      // WebSocket成功率检查
      const wsSuccessRate = apiStats.ws.successRate;
      if (wsSuccessRate < 80 && apiStats.ws.totalConnections > 5) {
        logger.warn(`Binance WebSocket成功率过低: ${wsSuccessRate}%`);
        await this.sendAlert(
          'API_WS_LOW',
          `Binance WebSocket成功率过低: ${wsSuccessRate}%`,
          {
            successRate: wsSuccessRate,
            totalConnections: apiStats.ws.totalConnections,
            failedConnections: apiStats.ws.failedConnections
          }
        );
      }
    } catch (error) {
      logger.error(`检查API状态失败: ${error.message}`);
    }
  }

  /**
   * 发送告警（带冷却机制）
   */
  async sendAlert(type, message, data = {}) {
    const now = Date.now();
    const lastSent = this.alertCooldown.get(type);

    // 检查冷却期
    if (lastSent && (now - lastSent) < this.cooldownPeriod) {
      logger.debug(`告警类型 ${type} 在冷却期内，跳过发送`);
      return;
    }

    try {
      await this.telegramService.sendMonitoringAlert(type, message, data);
      this.alertCooldown.set(type, now);
      logger.info(`系统监控Telegram告警已发送: ${type}`);
    } catch (error) {
      logger.error(`发送系统监控Telegram告警失败: ${error.message}`);
    }
  }

  async getCpuUsage() {
    return new Promise((resolve) => {
      const startMeasure = this.cpuAverage();
      setTimeout(() => {
        const endMeasure = this.cpuAverage();
        const idleDifference = endMeasure.idle - startMeasure.idle;
        const totalDifference = endMeasure.total - startMeasure.total;
        const percentageCPU = 100 - ~~(100 * idleDifference / totalDifference);
        resolve(percentageCPU);
      }, 100);
    });
  }

  cpuAverage() {
    let totalIdle = 0;
    let totalTick = 0;
    const cpus = os.cpus();

    for (let i = 0; i < cpus.length; i++) {
      const cpu = cpus[i];
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    }

    return { idle: totalIdle, total: totalTick };
  }

  getMemoryUsage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    return (usedMemory / totalMemory) * 100;
  }

  stop() {
    this.isRunning = false;
    logger.info('系统监控进程停止');
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const monitor = new SystemMonitor();
  monitor.start();

  // 优雅关闭
  process.on('SIGINT', () => {
    logger.info('收到SIGINT信号，正在关闭系统监控进程...');
    monitor.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('收到SIGTERM信号，正在关闭系统监控进程...');
    monitor.stop();
    process.exit(0);
  });
}

module.exports = SystemMonitor;
