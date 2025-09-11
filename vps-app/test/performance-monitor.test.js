// test/performance-monitor.test.js
// 性能监控模块单元测试

const PerformanceMonitor = require('../modules/monitoring/PerformanceMonitor');

describe('PerformanceMonitor', () => {
  let performanceMonitor;

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('recordRequest', () => {
    test('应该记录成功的请求', () => {
      performanceMonitor.recordRequest(true, 100);

      expect(performanceMonitor.metrics.application.requests.total).toBe(1);
      expect(performanceMonitor.metrics.application.requests.success).toBe(1);
      expect(performanceMonitor.metrics.application.requests.error).toBe(0);
    });

    test('应该记录失败的请求', () => {
      performanceMonitor.recordRequest(false, 200);

      expect(performanceMonitor.metrics.application.requests.total).toBe(1);
      expect(performanceMonitor.metrics.application.requests.success).toBe(0);
      expect(performanceMonitor.metrics.application.requests.error).toBe(1);
    });

    test('应该记录响应时间', () => {
      performanceMonitor.recordRequest(true, 150);
      performanceMonitor.recordRequest(true, 250);

      expect(performanceMonitor.requestTimes).toHaveLength(2);
      expect(performanceMonitor.requestTimes).toEqual([150, 250]);
    });

    test('应该限制请求时间数组大小', () => {
      // 添加超过1000个请求时间
      for (let i = 0; i < 1001; i++) {
        performanceMonitor.recordRequest(true, i);
      }

      expect(performanceMonitor.requestTimes).toHaveLength(1000);
      expect(performanceMonitor.requestTimes[0]).toBe(1); // 第一个被移除
    });
  });

  describe('updateResponseTimeStats', () => {
    test('应该更新响应时间统计', () => {
      performanceMonitor.requestTimes = [100, 200, 300, 400, 500];
      performanceMonitor.updateResponseTimeStats();

      expect(performanceMonitor.metrics.application.responseTime.avg).toBe(300);
      expect(performanceMonitor.metrics.application.responseTime.min).toBe(100);
      expect(performanceMonitor.metrics.application.responseTime.max).toBe(500);
    });

    test('应该处理空数组', () => {
      performanceMonitor.requestTimes = [];
      performanceMonitor.updateResponseTimeStats();

      expect(performanceMonitor.metrics.application.responseTime.avg).toBe(0);
      expect(performanceMonitor.metrics.application.responseTime.min).toBe(Infinity);
      expect(performanceMonitor.metrics.application.responseTime.max).toBe(0);
    });
  });

  describe('recordCacheOperation', () => {
    test('应该记录缓存命中', () => {
      performanceMonitor.recordCacheOperation(true);

      expect(performanceMonitor.metrics.application.cache.hits).toBe(1);
      expect(performanceMonitor.metrics.application.cache.misses).toBe(0);
      expect(performanceMonitor.metrics.application.cache.hitRate).toBe('100.00');
    });

    test('应该记录缓存未命中', () => {
      performanceMonitor.recordCacheOperation(false);

      expect(performanceMonitor.metrics.application.cache.hits).toBe(0);
      expect(performanceMonitor.metrics.application.cache.misses).toBe(1);
      expect(performanceMonitor.metrics.application.cache.hitRate).toBe('0.00');
    });

    test('应该计算正确的命中率', () => {
      performanceMonitor.recordCacheOperation(true);
      performanceMonitor.recordCacheOperation(true);
      performanceMonitor.recordCacheOperation(false);

      expect(performanceMonitor.metrics.application.cache.hitRate).toBe('66.67');
    });
  });

  describe('recordDatabaseQuery', () => {
    test('应该记录数据库查询', () => {
      performanceMonitor.recordDatabaseQuery(50);

      expect(performanceMonitor.metrics.application.database.queries).toBe(1);
      expect(performanceMonitor.metrics.application.database.avgTime).toBe(50);
      expect(performanceMonitor.metrics.application.database.slowQueries).toBe(0);
    });

    test('应该记录慢查询', () => {
      performanceMonitor.recordDatabaseQuery(1500); // 超过1秒阈值

      expect(performanceMonitor.metrics.application.database.slowQueries).toBe(1);
    });

    test('应该计算平均查询时间', () => {
      performanceMonitor.recordDatabaseQuery(100);
      performanceMonitor.recordDatabaseQuery(200);
      performanceMonitor.recordDatabaseQuery(300);

      expect(performanceMonitor.metrics.application.database.avgTime).toBe(200);
    });
  });

  describe('checkAlerts', () => {
    test('应该检查内存使用率告警', () => {
      performanceMonitor.metrics.system.memory.usage = 95; // 超过90%阈值

      const alerts = performanceMonitor.checkAlerts();

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('MEMORY_HIGH');
      expect(alerts[0].level).toBe('WARNING');
    });

    test('应该检查CPU使用率告警', () => {
      performanceMonitor.metrics.system.cpu.usage = 85; // 超过80%阈值

      const alerts = performanceMonitor.checkAlerts();

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('CPU_HIGH');
      expect(alerts[0].level).toBe('WARNING');
    });

    test('应该检查响应时间告警', () => {
      performanceMonitor.metrics.application.responseTime.avg = 6000; // 超过5秒阈值

      const alerts = performanceMonitor.checkAlerts();

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('RESPONSE_TIME_HIGH');
      expect(alerts[0].level).toBe('WARNING');
    });

    test('应该检查错误率告警', () => {
      performanceMonitor.metrics.application.requests.total = 100;
      performanceMonitor.metrics.application.requests.error = 15; // 15%错误率

      const alerts = performanceMonitor.checkAlerts();

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('ERROR_RATE_HIGH');
      expect(alerts[0].level).toBe('ERROR');
    });

    test('应该返回多个告警', () => {
      performanceMonitor.metrics.system.memory.usage = 95;
      performanceMonitor.metrics.system.cpu.usage = 85;
      performanceMonitor.metrics.application.responseTime.avg = 6000;

      const alerts = performanceMonitor.checkAlerts();

      expect(alerts).toHaveLength(3);
    });
  });

  describe('getHealthStatus', () => {
    test('应该返回ERROR状态', () => {
      // 手动设置ERROR告警
      performanceMonitor.metrics.alerts = [
        { level: 'ERROR', type: 'ERROR_RATE_HIGH' },
        { level: 'WARNING', type: 'MEMORY_HIGH' }
      ];

      const status = performanceMonitor.getHealthStatus();

      expect(status).toBe('ERROR');
    });

    test('应该返回WARNING状态', () => {
      // 手动设置WARNING告警
      performanceMonitor.metrics.alerts = [
        { level: 'WARNING', type: 'MEMORY_HIGH' }
      ];

      const status = performanceMonitor.getHealthStatus();

      expect(status).toBe('WARNING');
    });

    test('应该返回HEALTHY状态', () => {
      // 手动设置alerts为空数组
      performanceMonitor.metrics.alerts = [];

      const status = performanceMonitor.getHealthStatus();

      expect(status).toBe('HEALTHY');
    });
  });

  describe('getMetrics', () => {
    test('应该返回完整的性能指标', () => {
      const metrics = performanceMonitor.getMetrics();

      expect(metrics).toHaveProperty('system');
      expect(metrics).toHaveProperty('process');
      expect(metrics).toHaveProperty('application');
      expect(metrics).toHaveProperty('alerts');
      expect(metrics).toHaveProperty('timestamp');
      expect(metrics).toHaveProperty('uptime');
    });
  });

  describe('reset', () => {
    test('应该重置所有指标', () => {
      // 设置一些数据
      performanceMonitor.recordRequest(true, 100);
      performanceMonitor.recordCacheOperation(true);
      performanceMonitor.recordDatabaseQuery(50);

      performanceMonitor.reset();

      expect(performanceMonitor.metrics.application.requests.total).toBe(0);
      expect(performanceMonitor.metrics.application.cache.hits).toBe(0);
      expect(performanceMonitor.metrics.application.database.queries).toBe(0);
      expect(performanceMonitor.requestTimes).toHaveLength(0);
    });
  });

  describe('generateRecommendations', () => {
    test('应该生成内存优化建议', () => {
      performanceMonitor.metrics.system.memory.usage = 85;

      const recommendations = performanceMonitor.generateRecommendations(performanceMonitor.metrics);

      expect(recommendations).toContain('考虑增加内存或优化内存使用');
    });

    test('应该生成CPU优化建议', () => {
      performanceMonitor.metrics.system.cpu.usage = 75;

      const recommendations = performanceMonitor.generateRecommendations(performanceMonitor.metrics);

      expect(recommendations).toContain('考虑优化CPU密集型操作或增加CPU核心');
    });

    test('应该生成响应时间优化建议', () => {
      performanceMonitor.metrics.application.responseTime.avg = 3000;

      const recommendations = performanceMonitor.generateRecommendations(performanceMonitor.metrics);

      expect(recommendations).toContain('考虑优化数据库查询或增加缓存');
    });

    test('应该生成缓存优化建议', () => {
      performanceMonitor.metrics.application.cache.hitRate = 30;

      const recommendations = performanceMonitor.generateRecommendations(performanceMonitor.metrics);

      expect(recommendations).toContain('考虑优化缓存策略或增加缓存容量');
    });

    test('应该生成数据库优化建议', () => {
      performanceMonitor.metrics.application.database.slowQueries = 15;

      const recommendations = performanceMonitor.generateRecommendations(performanceMonitor.metrics);

      expect(recommendations).toContain('考虑优化数据库查询或添加索引');
    });
  });
});
