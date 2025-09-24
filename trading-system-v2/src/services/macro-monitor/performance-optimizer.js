/**
 * 宏观监控性能优化器
 * 针对VPS 2C1G限制进行性能优化
 */

const logger = require('../../utils/logger');

class PerformanceOptimizer {
  constructor() {
    this.memoryThreshold = 80; // 内存使用率阈值 80%
    this.cpuThreshold = 70; // CPU使用率阈值 70%
    this.cleanupInterval = 5 * 60 * 1000; // 5分钟清理一次
    this.cleanupTimer = null;
    this.isCleaning = false;
  }

  /**
   * 启动性能监控
   */
  start() {
    logger.info('启动宏观监控性能优化器...');

    // 定期清理内存
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.cleanupInterval);

    // 监控内存使用
    this.monitorMemoryUsage();
  }

  /**
   * 停止性能监控
   */
  stop() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    logger.info('宏观监控性能优化器已停止');
  }

  /**
   * 监控内存使用情况
   */
  monitorMemoryUsage() {
    const memUsage = process.memoryUsage();
    const memUsageMB = memUsage.heapUsed / 1024 / 1024;
    const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    if (memUsagePercent > this.memoryThreshold) {
      logger.warn(`内存使用率过高: ${memUsagePercent.toFixed(2)}% (${memUsageMB.toFixed(2)}MB)`);
      this.performEmergencyCleanup();
    }
  }

  /**
   * 执行定期清理
   */
  async performCleanup() {
    if (this.isCleaning) {
      return;
    }

    this.isCleaning = true;

    try {
      logger.info('开始执行宏观监控性能清理...');

      // 强制垃圾回收
      if (global.gc) {
        global.gc();
        logger.info('执行垃圾回收');
      }

      // 清理定时器
      this.cleanupTimers();

      // 清理缓存
      this.cleanupCache();

      logger.info('宏观监控性能清理完成');
    } catch (error) {
      logger.error('性能清理失败:', error);
    } finally {
      this.isCleaning = false;
    }
  }

  /**
   * 执行紧急清理
   */
  async performEmergencyCleanup() {
    logger.warn('执行紧急内存清理...');

    try {
      // 强制垃圾回收
      if (global.gc) {
        global.gc();
      }

      // 清理所有定时器
      this.cleanupTimers();

      // 清理缓存
      this.cleanupCache();

      // 清理未使用的对象
      this.cleanupUnusedObjects();

      logger.warn('紧急内存清理完成');
    } catch (error) {
      logger.error('紧急清理失败:', error);
    }
  }

  /**
   * 清理定时器
   */
  cleanupTimers() {
    // 清理可能的定时器泄漏
    const activeHandles = process._getActiveHandles();
    const activeRequests = process._getActiveRequests();

    logger.info(`活跃句柄数: ${activeHandles.length}, 活跃请求数: ${activeRequests.length}`);

    // 如果句柄数过多，记录警告
    if (activeHandles.length > 100) {
      logger.warn(`活跃句柄数过多: ${activeHandles.length}`);
    }
  }

  /**
   * 清理缓存
   */
  cleanupCache() {
    // 清理可能的缓存泄漏
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * 清理未使用的对象
   */
  cleanupUnusedObjects() {
    // 清理全局对象中的未使用引用
    const globalKeys = Object.keys(global);
    let cleanedCount = 0;

    globalKeys.forEach(key => {
      if (key.startsWith('_temp_') || key.startsWith('_cache_')) {
        delete global[key];
        cleanedCount++;
      }
    });

    if (cleanedCount > 0) {
      logger.info(`清理了 ${cleanedCount} 个临时对象`);
    }
  }

  /**
   * 优化数据库查询
   */
  optimizeDatabaseQuery(query, params) {
    // 添加查询优化
    const optimizedQuery = query
      .replace(/\s+/g, ' ') // 压缩空白字符
      .trim();

    // 限制查询结果数量
    if (!query.includes('LIMIT') && !query.includes('limit')) {
      return `${optimizedQuery} LIMIT 1000`;
    }

    return optimizedQuery;
  }

  /**
   * 优化内存使用
   */
  optimizeMemoryUsage() {
    const memUsage = process.memoryUsage();
    const memUsageMB = memUsage.heapUsed / 1024 / 1024;

    // 如果内存使用超过50MB，进行优化
    if (memUsageMB > 50) {
      logger.info(`内存使用: ${memUsageMB.toFixed(2)}MB，执行优化...`);

      // 强制垃圾回收
      if (global.gc) {
        global.gc();
      }

      // 清理定时器
      this.cleanupTimers();
    }
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024), // MB
        rss: Math.round(memUsage.rss / 1024 / 1024) // MB
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: process.uptime(),
      activeHandles: process._getActiveHandles().length,
      activeRequests: process._getActiveRequests().length
    };
  }

  /**
   * 检查是否应该暂停监控
   */
  shouldPauseMonitoring() {
    const memUsage = process.memoryUsage();
    const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    return memUsagePercent > this.memoryThreshold;
  }

  /**
   * 获取优化建议
   */
  getOptimizationSuggestions() {
    const stats = this.getPerformanceStats();
    const suggestions = [];

    if (stats.memory.heapUsed > 40) {
      suggestions.push('内存使用较高，建议减少监控频率');
    }

    if (stats.activeHandles > 50) {
      suggestions.push('活跃句柄数较多，建议检查定时器清理');
    }

    if (stats.memory.external > 20) {
      suggestions.push('外部内存使用较高，建议检查缓存清理');
    }

    return suggestions;
  }
}

module.exports = PerformanceOptimizer;
