/**
 * 系统监控工作进程
 * 负责监控系统资源使用情况
 */

const os = require('os');
const logger = require('../utils/logger');
const config = require('../config');

class SystemMonitor {
  constructor() {
    this.isRunning = false;
    this.monitorInterval = 30 * 1000; // 30秒检查一次
    this.cpuThreshold = 60; // CPU使用率阈值
    this.memoryThreshold = 60; // 内存使用率阈值
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
    }

    if (memoryUsage > this.memoryThreshold) {
      logger.warn(`内存使用率过高: ${memoryUsage.toFixed(2)}% > ${this.memoryThreshold}%`);
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
