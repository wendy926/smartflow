// modules/monitoring/PerformanceMonitor.js
// 性能监控系统

const os = require('os');
const process = require('process');

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      system: {
        cpu: { usage: 0, cores: os.cpus().length },
        memory: { total: 0, free: 0, used: 0, usage: 0 },
        uptime: 0,
        loadAverage: [0, 0, 0]
      },
      process: {
        pid: process.pid,
        uptime: 0,
        memory: { rss: 0, heapUsed: 0, heapTotal: 0, external: 0 },
        cpu: { user: 0, system: 0 }
      },
      application: {
        requests: { total: 0, success: 0, error: 0 },
        responseTime: { avg: 0, min: Infinity, max: 0 },
        cache: { hits: 0, misses: 0, hitRate: 0 },
        database: { queries: 0, avgTime: 0, slowQueries: 0 }
      },
      alerts: []
    };

    this.startTime = Date.now();
    this.requestTimes = [];
    this.slowQueryThreshold = 1000; // 1秒
    this.alertThresholds = {
      memory: 90,    // 内存使用率90%
      cpu: 80,       // CPU使用率80%
      responseTime: 5000, // 响应时间5秒
      errorRate: 10  // 错误率10%
    };
  }

  /**
   * 更新系统指标
   */
  updateSystemMetrics() {
    // CPU使用率
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    this.metrics.system.cpu.usage = 100 - ~~(100 * totalIdle / totalTick);

    // 内存使用情况
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    this.metrics.system.memory = {
      total: totalMem,
      free: freeMem,
      used: usedMem,
      usage: (usedMem / totalMem * 100).toFixed(2)
    };

    // 系统运行时间
    this.metrics.system.uptime = os.uptime();

    // 负载平均值
    this.metrics.system.loadAverage = os.loadavg();
  }

  /**
   * 更新进程指标
   */
  updateProcessMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    this.metrics.process.uptime = process.uptime();
    this.metrics.process.memory = {
      rss: memUsage.rss,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external
    };
    this.metrics.process.cpu = {
      user: cpuUsage.user,
      system: cpuUsage.system
    };
  }

  /**
   * 记录请求
   */
  recordRequest(success = true, responseTime = 0) {
    this.metrics.application.requests.total++;

    if (success) {
      this.metrics.application.requests.success++;
    } else {
      this.metrics.application.requests.error++;
    }

    // 记录响应时间
    if (responseTime > 0) {
      this.requestTimes.push(responseTime);

      // 保持最近1000个请求的响应时间
      if (this.requestTimes.length > 1000) {
        this.requestTimes.shift();
      }

      // 更新响应时间统计
      this.updateResponseTimeStats();
    }
  }

  /**
   * 更新响应时间统计
   */
  updateResponseTimeStats() {
    if (this.requestTimes.length === 0) return;

    const total = this.requestTimes.reduce((sum, time) => sum + time, 0);
    this.metrics.application.responseTime.avg = total / this.requestTimes.length;
    this.metrics.application.responseTime.min = Math.min(...this.requestTimes);
    this.metrics.application.responseTime.max = Math.max(...this.requestTimes);
  }

  /**
   * 记录缓存操作
   */
  recordCacheOperation(hit = true) {
    if (hit) {
      this.metrics.application.cache.hits++;
    } else {
      this.metrics.application.cache.misses++;
    }

    const total = this.metrics.application.cache.hits + this.metrics.application.cache.misses;
    this.metrics.application.cache.hitRate = total > 0 ?
      (this.metrics.application.cache.hits / total * 100).toFixed(2) : 0;
  }

  /**
   * 记录数据库查询
   */
  recordDatabaseQuery(queryTime = 0) {
    this.metrics.application.database.queries++;

    if (queryTime > this.slowQueryThreshold) {
      this.metrics.application.database.slowQueries++;
    }

    // 更新平均查询时间
    const totalQueries = this.metrics.application.database.queries;
    const currentAvg = this.metrics.application.database.avgTime;
    this.metrics.application.database.avgTime =
      (currentAvg * (totalQueries - 1) + queryTime) / totalQueries;
  }

  /**
   * 检查告警条件
   */
  checkAlerts() {
    const alerts = [];

    // 内存使用率告警
    if (this.metrics.system.memory.usage > this.alertThresholds.memory) {
      alerts.push({
        type: 'MEMORY_HIGH',
        level: 'WARNING',
        message: `内存使用率过高: ${this.metrics.system.memory.usage}%`,
        value: this.metrics.system.memory.usage,
        threshold: this.alertThresholds.memory,
        timestamp: new Date().toISOString()
      });
    }

    // CPU使用率告警
    if (this.metrics.system.cpu.usage > this.alertThresholds.cpu) {
      alerts.push({
        type: 'CPU_HIGH',
        level: 'WARNING',
        message: `CPU使用率过高: ${this.metrics.system.cpu.usage}%`,
        value: this.metrics.system.cpu.usage,
        threshold: this.alertThresholds.cpu,
        timestamp: new Date().toISOString()
      });
    }

    // 响应时间告警
    if (this.metrics.application.responseTime.avg > this.alertThresholds.responseTime) {
      alerts.push({
        type: 'RESPONSE_TIME_HIGH',
        level: 'WARNING',
        message: `平均响应时间过长: ${this.metrics.application.responseTime.avg}ms`,
        value: this.metrics.application.responseTime.avg,
        threshold: this.alertThresholds.responseTime,
        timestamp: new Date().toISOString()
      });
    }

    // 错误率告警
    const totalRequests = this.metrics.application.requests.total;
    if (totalRequests > 0) {
      const errorRate = (this.metrics.application.requests.error / totalRequests) * 100;
      if (errorRate > this.alertThresholds.errorRate) {
        alerts.push({
          type: 'ERROR_RATE_HIGH',
          level: 'ERROR',
          message: `错误率过高: ${errorRate.toFixed(2)}%`,
          value: errorRate,
          threshold: this.alertThresholds.errorRate,
          timestamp: new Date().toISOString()
        });
      }
    }

    this.metrics.alerts = alerts;
    return alerts;
  }

  /**
   * 获取性能指标
   */
  getMetrics() {
    this.updateSystemMetrics();
    this.updateProcessMetrics();
    this.checkAlerts();

    return {
      ...this.metrics,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime
    };
  }

  /**
   * 获取健康状态
   */
  getHealthStatus() {
    // 检查当前告警状态，不自动生成新的告警
    const alerts = this.metrics.alerts;

    if (alerts.some(alert => alert.level === 'ERROR')) {
      return 'ERROR';
    } else if (alerts.some(alert => alert.level === 'WARNING')) {
      return 'WARNING';
    } else {
      return 'HEALTHY';
    }
  }

  /**
   * 重置指标
   */
  reset() {
    this.metrics.application.requests = { total: 0, success: 0, error: 0 };
    this.metrics.application.responseTime = { avg: 0, min: Infinity, max: 0 };
    this.metrics.application.cache = { hits: 0, misses: 0, hitRate: 0 };
    this.metrics.application.database = { queries: 0, avgTime: 0, slowQueries: 0 };
    this.requestTimes = [];
    this.startTime = Date.now();
  }

  /**
   * 生成性能报告
   */
  generateReport() {
    const metrics = this.getMetrics();
    const health = this.getHealthStatus();

    return {
      health,
      summary: {
        uptime: metrics.uptime,
        memoryUsage: `${metrics.system.memory.usage}%`,
        cpuUsage: `${metrics.system.cpu.usage}%`,
        totalRequests: metrics.application.requests.total,
        successRate: metrics.application.requests.total > 0 ?
          `${(metrics.application.requests.success / metrics.application.requests.total * 100).toFixed(2)}%` : '0%',
        avgResponseTime: `${metrics.application.responseTime.avg.toFixed(2)}ms`,
        cacheHitRate: `${metrics.application.cache.hitRate}%`,
        slowQueries: metrics.application.database.slowQueries
      },
      details: metrics,
      recommendations: this.generateRecommendations(metrics)
    };
  }

  /**
   * 生成优化建议
   */
  generateRecommendations(metrics) {
    const recommendations = [];

    if (metrics.system.memory.usage > 80) {
      recommendations.push('考虑增加内存或优化内存使用');
    }

    if (metrics.system.cpu.usage > 70) {
      recommendations.push('考虑优化CPU密集型操作或增加CPU核心');
    }

    if (metrics.application.responseTime.avg > 2000) {
      recommendations.push('考虑优化数据库查询或增加缓存');
    }

    if (metrics.application.cache.hitRate < 50) {
      recommendations.push('考虑优化缓存策略或增加缓存容量');
    }

    if (metrics.application.database.slowQueries > 10) {
      recommendations.push('考虑优化数据库查询或添加索引');
    }

    return recommendations;
  }
}

module.exports = PerformanceMonitor;
