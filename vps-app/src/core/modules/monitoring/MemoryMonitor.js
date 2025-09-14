// modules/monitoring/MemoryMonitor.js
// 内存监控和预警系统

class MemoryMonitor {
  constructor(options = {}) {
    this.maxMemoryUsage = options.maxMemoryUsage || 0.6; // 最大内存使用率60%
    this.warningThreshold = options.warningThreshold || 0.5; // 警告阈值50%
    this.criticalThreshold = options.criticalThreshold || 0.8; // 严重阈值80%
    
    this.memoryStats = {
      total: 0,
      used: 0,
      free: 0,
      usage: 0
    };
    
    this.processStats = {
      rss: 0, // 常驻内存
      heapTotal: 0, // 堆总大小
      heapUsed: 0, // 堆使用量
      external: 0, // 外部内存
      arrayBuffers: 0 // 数组缓冲区
    };
    
    this.alertHistory = [];
    this.lastAlertTime = 0;
    this.alertCooldown = 5 * 60 * 1000; // 5分钟冷却时间
    
    // 启动监控
    this.startMonitoring();
  }

  /**
   * 获取系统内存信息
   */
  getSystemMemory() {
    try {
      const os = require('os');
      const total = os.totalmem();
      const free = os.freemem();
      const used = total - free;
      
      this.memoryStats = {
        total: total,
        used: used,
        free: free,
        usage: used / total
      };
      
      return this.memoryStats;
    } catch (error) {
      console.error('获取系统内存信息失败:', error);
      return null;
    }
  }

  /**
   * 获取Node.js进程内存信息
   */
  getProcessMemory() {
    try {
      const usage = process.memoryUsage();
      
      this.processStats = {
        rss: usage.rss,
        heapTotal: usage.heapTotal,
        heapUsed: usage.heapUsed,
        external: usage.external,
        arrayBuffers: usage.arrayBuffers
      };
      
      return this.processStats;
    } catch (error) {
      console.error('获取进程内存信息失败:', error);
      return null;
    }
  }

  /**
   * 检查内存使用情况
   */
  checkMemoryUsage() {
    const systemMemory = this.getSystemMemory();
    const processMemory = this.getProcessMemory();
    
    if (!systemMemory || !processMemory) {
      return { status: 'ERROR', message: '无法获取内存信息' };
    }

    const systemUsage = systemMemory.usage;
    const processUsageMB = processMemory.rss / 1024 / 1024;
    
    let status = 'NORMAL';
    let message = '';
    
    if (systemUsage >= this.criticalThreshold) {
      status = 'CRITICAL';
      message = `系统内存使用率过高: ${(systemUsage * 100).toFixed(1)}%`;
    } else if (systemUsage >= this.maxMemoryUsage) {
      status = 'HIGH';
      message = `系统内存使用率较高: ${(systemUsage * 100).toFixed(1)}%`;
    } else if (systemUsage >= this.warningThreshold) {
      status = 'WARNING';
      message = `系统内存使用率警告: ${(systemUsage * 100).toFixed(1)}%`;
    } else {
      message = `系统内存使用率正常: ${(systemUsage * 100).toFixed(1)}%`;
    }

    const result = {
      status,
      message,
      systemMemory,
      processMemory: {
        ...processMemory,
        rssMB: processUsageMB,
        heapUsedMB: processMemory.heapUsed / 1024 / 1024,
        heapTotalMB: processMemory.heapTotal / 1024 / 1024
      },
      timestamp: new Date().toISOString()
    };

    // 记录到历史
    this.alertHistory.push(result);
    
    // 保持历史记录不超过100条
    if (this.alertHistory.length > 100) {
      this.alertHistory = this.alertHistory.slice(-100);
    }

    return result;
  }

  /**
   * 发送内存告警
   */
  async sendMemoryAlert(memoryInfo) {
    const now = Date.now();
    
    // 检查冷却时间
    if (now - this.lastAlertTime < this.alertCooldown) {
      return;
    }

    this.lastAlertTime = now;
    
    const alertMessage = `
🚨 内存使用告警
状态: ${memoryInfo.status}
系统内存: ${(memoryInfo.systemMemory.usage * 100).toFixed(1)}%
进程内存: ${memoryInfo.processMemory.rssMB.toFixed(1)}MB
堆使用: ${memoryInfo.processMemory.heapUsedMB.toFixed(1)}MB
时间: ${memoryInfo.timestamp}
    `.trim();

    console.warn(alertMessage);
    
    // 这里可以集成Telegram通知
    // await this.sendTelegramAlert(alertMessage);
  }

  /**
   * 获取内存优化建议
   */
  getOptimizationSuggestions(memoryInfo) {
    const suggestions = [];
    
    if (memoryInfo.systemMemory.usage > this.maxMemoryUsage) {
      suggestions.push('建议清理内存缓存数据');
      suggestions.push('建议减少并发处理数量');
      suggestions.push('建议优化数据结构');
    }
    
    if (memoryInfo.processMemory.heapUsedMB > 200) {
      suggestions.push('建议检查内存泄漏');
      suggestions.push('建议增加垃圾回收频率');
    }
    
    if (memoryInfo.processMemory.external > 50 * 1024 * 1024) {
      suggestions.push('建议检查外部内存使用');
      suggestions.push('建议优化网络请求缓存');
    }
    
    return suggestions;
  }

  /**
   * 启动内存监控
   */
  startMonitoring() {
    // 每30秒检查一次内存使用情况
    setInterval(() => {
      const memoryInfo = this.checkMemoryUsage();
      
      // 如果内存使用率超过阈值，发送告警
      if (memoryInfo.status !== 'NORMAL') {
        this.sendMemoryAlert(memoryInfo);
      }
      
      // 记录内存使用情况
      console.log(`📊 内存监控: ${memoryInfo.message}, 进程内存: ${memoryInfo.processMemory.rssMB.toFixed(1)}MB`);
      
    }, 30 * 1000);
  }

  /**
   * 获取内存使用报告
   */
  getMemoryReport() {
    const memoryInfo = this.checkMemoryUsage();
    const suggestions = this.getOptimizationSuggestions(memoryInfo);
    
    return {
      current: memoryInfo,
      suggestions,
      history: this.alertHistory.slice(-10), // 最近10条记录
      thresholds: {
        warning: this.warningThreshold,
        max: this.maxMemoryUsage,
        critical: this.criticalThreshold
      }
    };
  }

  /**
   * 强制垃圾回收
   */
  forceGarbageCollection() {
    if (global.gc) {
      global.gc();
      console.log('🗑️ 强制垃圾回收完成');
      return true;
    } else {
      console.warn('⚠️ 垃圾回收不可用，请使用 --expose-gc 参数启动Node.js');
      return false;
    }
  }
}

module.exports = { MemoryMonitor };
