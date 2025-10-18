/**
 * 资源监控模块
 */

const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const logger = require('../utils/logger');
const AlertEngine = require('../services/alert-engine');

const execAsync = promisify(exec);

class ResourceMonitor {
  constructor() {
    this.cpuThreshold = 70; // CPU使用率阈值
    this.memoryThreshold = 75; // 内存使用率阈值
    this.checkInterval = 30000; // 检查间隔30秒
    this.isMonitoring = false;
    this.alertEngine = new AlertEngine();
    this.previousCpuUsage = null; // 用于计算CPU使用率
  }

  /**
   * 开始监控
   */
  async start() {
    if (this.isMonitoring) {
      logger.warn('资源监控已在运行');
      return;
    }

    this.isMonitoring = true;
    logger.info('开始资源监控');

    // 立即检查一次
    await this.checkResources();

    // 设置定时检查
    this.intervalId = setInterval(async () => {
      await this.checkResources();
    }, this.checkInterval);
  }

  /**
   * 停止监控
   */
  stop() {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    logger.info('停止资源监控');
  }

  /**
   * 检查系统资源
   */
  async checkResources() {
    try {
      const cpuUsage = this.getCpuUsage();
      const memoryUsage = this.getMemoryUsage();
      const diskUsage = await this.getDiskUsage();

      // 使用北京时间
      const beijingTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
      logger.info(`系统资源状态 - CPU: ${cpuUsage.toFixed(2)}%, 内存: ${memoryUsage.toFixed(2)}%, 磁盘: ${diskUsage.toFixed(2)}% (${beijingTime})`);

      // 检查CPU使用率
      if (cpuUsage > this.cpuThreshold) {
        logger.warn(`CPU使用率过高: ${cpuUsage.toFixed(2)}% (阈值: ${this.cpuThreshold}%)`);
        await this.alertEngine.checkAlert('CPU_HIGH', cpuUsage, {
          cpu: cpuUsage,
          threshold: this.cpuThreshold
        });
      }

      // 检查内存使用率
      if (memoryUsage > this.memoryThreshold) {
        logger.warn(`内存使用率过高: ${memoryUsage.toFixed(2)}% (阈值: ${this.memoryThreshold}%)`);
        await this.alertEngine.checkAlert('MEMORY_HIGH', memoryUsage, {
          memory: memoryUsage,
          threshold: this.memoryThreshold
        });
      }

      return {
        cpu: cpuUsage,
        memory: memoryUsage,
        disk: diskUsage,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`资源监控检查失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 获取CPU使用率
   */
  getCpuUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);

    // 使用 load average 作为补充指标（更准确）
    const loadAvg = os.loadavg()[0]; // 1分钟平均负载
    const cpuCount = cpus.length;
    const loadBasedUsage = Math.min(100, (loadAvg / cpuCount) * 100);

    // 如果 load average 可用，使用它；否则使用瞬时值
    const finalUsage = loadAvg > 0 ? loadBasedUsage : Math.max(0, Math.min(100, usage));

    return finalUsage;
  }

  /**
   * 获取内存使用率
   */
  getMemoryUsage() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return (usedMem / totalMem) * 100;
  }

  /**
   * 获取磁盘使用率
   */
  async getDiskUsage() {
    try {
      // 使用 df 命令获取根目录磁盘使用率
      const { stdout } = await execAsync('df -h / | tail -1');
      const parts = stdout.trim().split(/\s+/);
      
      // df 输出格式: Filesystem Size Used Avail Use% Mounted
      // 例如: /dev/vda3 30G 15G 13G 54% /
      const usageStr = parts[4]; // Use% 列
      const usage = parseFloat(usageStr.replace('%', ''));
      
      return isNaN(usage) ? 0 : usage;
    } catch (error) {
      logger.error(`获取磁盘使用率失败: ${error.message}`);
      return 0;
    }
  }

  /**
   * 发送告警
   */
  sendAlert(type, usage) {
    const message = `⚠️ 系统告警: ${type}使用率过高 ${usage.toFixed(2)}%`;
    logger.error(message);

    // 这里可以集成Telegram、邮件等告警方式
    // 目前只记录日志
  }

  /**
   * 获取系统信息
   */
  getSystemInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpus: os.cpus().length,
      uptime: os.uptime(),
      loadAverage: os.loadavg()
    };
  }
}

// 创建单例实例
const resourceMonitor = new ResourceMonitor();

module.exports = resourceMonitor;
