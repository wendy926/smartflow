// memory-leak-fixes.js - 内存泄漏修复方案

/**
 * 内存泄漏修复方案
 * 解决VPS上内存占用80%、CPU占用45%的问题
 */

class MemoryLeakFixer {
  constructor() {
    this.timers = new Set();
    this.connections = new Set();
    this.cleanupInterval = null;
  }

  /**
   * 1. 修复定时器泄漏问题
   */
  createSafeInterval(callback, interval) {
    const timerId = setInterval(callback, interval);
    this.timers.add(timerId);
    return timerId;
  }

  createSafeTimeout(callback, delay) {
    const timerId = setTimeout(() => {
      this.timers.delete(timerId);
      callback();
    }, delay);
    this.timers.add(timerId);
    return timerId;
  }

  clearAllTimers() {
    console.log(`🧹 清理 ${this.timers.size} 个定时器`);
    for (const timerId of this.timers) {
      clearInterval(timerId);
      clearTimeout(timerId);
    }
    this.timers.clear();
  }

  /**
   * 2. 修复WebSocket连接泄漏问题
   */
  createSafeWebSocket(url, options = {}) {
    const ws = new (require('ws'))(url, options);
    this.connections.add(ws);

    ws.on('close', () => {
      this.connections.delete(ws);
    });

    return ws;
  }

  closeAllConnections() {
    console.log(`🔌 关闭 ${this.connections.size} 个WebSocket连接`);
    for (const ws of this.connections) {
      if (ws.readyState === 1) { // OPEN
        ws.close(1000, 'Server shutdown');
      }
    }
    this.connections.clear();
  }

  /**
   * 3. 启动内存监控和清理
   */
  startMemoryMonitoring() {
    this.cleanupInterval = setInterval(() => {
      this.performMemoryCleanup();
    }, 60000); // 每分钟检查一次

    // 监控内存使用
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const memMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const memTotal = Math.round(memUsage.heapTotal / 1024 / 1024);

      if (memMB > 200) { // 超过200MB时警告
        console.warn(`⚠️ 内存使用过高: ${memMB}MB / ${memTotal}MB`);
        this.performMemoryCleanup();
      }
    }, 30000); // 每30秒检查一次
  }

  performMemoryCleanup() {
    console.log('🧹 执行内存清理...');

    // 强制垃圾回收
    if (global.gc) {
      global.gc();
    }

    // 清理定时器
    this.clearAllTimers();

    // 清理连接
    this.closeAllConnections();

    console.log('✅ 内存清理完成');
  }

  /**
   * 4. 优雅关闭服务
   */
  setupGracefulShutdown(server) {
    const shutdown = () => {
      console.log('🛑 开始优雅关闭服务...');

      // 停止接受新连接
      server.close(() => {
        console.log('✅ HTTP服务器已关闭');
      });

      // 清理资源
      this.clearAllTimers();
      this.closeAllConnections();

      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }

      // 强制退出
      setTimeout(() => {
        console.log('🔚 强制退出进程');
        process.exit(0);
      }, 5000);
    };

    // 监听退出信号
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    process.on('SIGUSR2', shutdown); // PM2重启信号
  }

  /**
   * 5. 数据库连接管理优化
   */
  createSafeDatabaseManager() {
    const DatabaseManager = require('./modules/database/DatabaseManager');
    const dbManager = new DatabaseManager();

    // 添加连接池管理
    dbManager.connectionPool = new Set();

    const originalRunQuery = dbManager.runQuery.bind(dbManager);
    dbManager.runQuery = async (sql, params = []) => {
      try {
        const result = await originalRunQuery(sql, params);
        return result;
      } catch (error) {
        console.error('数据库查询失败:', error);
        throw error;
      }
    };

    // 添加连接清理方法
    dbManager.cleanupConnections = () => {
      if (dbManager.db) {
        dbManager.db.close();
        console.log('✅ 数据库连接已关闭');
      }
    };

    return dbManager;
  }
}

module.exports = MemoryLeakFixer;
