// modules/middleware/MemoryMiddleware.js
// 轻量级内存监控中间件

class MemoryMiddleware {
  constructor(options = {}) {
    this.maxMemoryUsage = options.maxMemoryUsage || 0.85; // 最大内存使用率85%
    this.warningThreshold = options.warningThreshold || 0.75; // 警告阈值75%
    this.lastCleanup = 0;
    this.cleanupInterval = 5 * 60 * 1000; // 5分钟清理一次
  }

  /**
   * 获取系统内存使用率
   */
  getSystemMemoryUsage() {
    try {
      const os = require('os');
      const total = os.totalmem();
      const free = os.freemem();
      const used = total - free;
      return used / total;
    } catch (error) {
      console.error('获取系统内存失败:', error);
      return 0;
    }
  }

  /**
   * 获取进程内存使用
   */
  getProcessMemoryUsage() {
    try {
      const usage = process.memoryUsage();
      return {
        rss: usage.rss / 1024 / 1024, // MB
        heapUsed: usage.heapUsed / 1024 / 1024, // MB
        heapTotal: usage.heapTotal / 1024 / 1024, // MB
        external: usage.external / 1024 / 1024 // MB
      };
    } catch (error) {
      console.error('获取进程内存失败:', error);
      return { rss: 0, heapUsed: 0, heapTotal: 0, external: 0 };
    }
  }

  /**
   * 执行内存清理
   */
  performMemoryCleanup() {
    const now = Date.now();
    
    // 检查是否需要清理
    if (now - this.lastCleanup < this.cleanupInterval) {
      return;
    }

    this.lastCleanup = now;

    try {
      // 强制垃圾回收
      if (global.gc) {
        global.gc();
        console.log('🗑️ 执行垃圾回收');
      }

      // 清理模块缓存（谨慎使用）
      // Object.keys(require.cache).forEach(key => {
      //   if (key.includes('node_modules')) {
      //     delete require.cache[key];
      //   }
      // });

      console.log('🧹 内存清理完成');
    } catch (error) {
      console.error('内存清理失败:', error);
    }
  }

  /**
   * 中间件函数
   */
  middleware() {
    return (req, res, next) => {
      const systemUsage = this.getSystemMemoryUsage();
      const processUsage = this.getProcessMemoryUsage();

      // 如果系统内存使用率过高，拒绝请求
      if (systemUsage > this.maxMemoryUsage) {
        console.warn(`⚠️ 系统内存使用率过高: ${(systemUsage * 100).toFixed(1)}%`);
        return res.status(503).json({ 
          error: '服务器内存不足，请稍后重试',
          memoryUsage: `${(systemUsage * 100).toFixed(1)}%`
        });
      }

      // 如果内存使用率较高，执行清理
      if (systemUsage > this.warningThreshold) {
        console.warn(`⚠️ 内存使用率较高: ${(systemUsage * 100).toFixed(1)}%`);
        this.performMemoryCleanup();
      }

      // 添加内存信息到响应头
      res.set('X-Memory-Usage', `${(systemUsage * 100).toFixed(1)}%`);
      res.set('X-Process-Memory', `${processUsage.rss.toFixed(1)}MB`);

      next();
    };
  }

  /**
   * 获取内存状态
   */
  getMemoryStatus() {
    const systemUsage = this.getSystemMemoryUsage();
    const processUsage = this.getProcessMemoryUsage();

    let status = 'NORMAL';
    if (systemUsage > this.maxMemoryUsage) {
      status = 'CRITICAL';
    } else if (systemUsage > this.warningThreshold) {
      status = 'WARNING';
    }

    return {
      status,
      systemUsage: systemUsage * 100,
      processUsage,
      thresholds: {
        warning: this.warningThreshold * 100,
        max: this.maxMemoryUsage * 100
      },
      lastCleanup: new Date(this.lastCleanup).toISOString()
    };
  }
}

module.exports = { MemoryMiddleware };
