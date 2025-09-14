const EnhancedIndicatorMonitor = require('../modules/monitoring/EnhancedIndicatorMonitor');
const DatabaseManager = require('../modules/database/DatabaseManager');

describe('增强指标监控系统测试', () => {
  let monitor;
  let db;

  beforeAll(async () => {
    // 初始化数据库和监控系统
    db = new DatabaseManager();
    await db.init();
    
    monitor = new EnhancedIndicatorMonitor(db);
    await monitor.initialize();
  });

  afterAll(async () => {
    // 清理资源
    if (monitor) {
      await monitor.close();
    }
    if (db) {
      await db.close();
    }
  });

  beforeEach(async () => {
    // 清理测试数据
    await db.run('DELETE FROM indicator_monitoring WHERE symbol LIKE "TEST_%"');
    await db.run('DELETE FROM alert_records WHERE symbol LIKE "TEST_%"');
    await db.run('DELETE FROM system_health WHERE check_type = "TEST"');
  });

  describe('指标验证功能', () => {
    test('应该正确验证有效的指标值', () => {
      const config = {
        indicator_name: 'ma20',
        min_value: 0,
        max_value: null,
        tolerance: 0.1
      };

      const validation = monitor.validateIndicator('ma20', 100.5, config);
      
      expect(validation.isValid).toBe(true);
      expect(validation.status).toBe('VALID');
    });

    test('应该检测到缺失的指标值', () => {
      const config = {
        indicator_name: 'ma20',
        min_value: 0,
        max_value: null,
        tolerance: 0.1
      };

      const validation = monitor.validateIndicator('ma20', null, config);
      
      expect(validation.isValid).toBe(false);
      expect(validation.status).toBe('MISSING');
      expect(validation.reason).toBe('指标值为空');
    });

    test('应该检测到超出范围的指标值', () => {
      const config = {
        indicator_name: 'adx14',
        min_value: 0,
        max_value: 100,
        tolerance: 5
      };

      const validation = monitor.validateIndicator('adx14', 150, config);
      
      expect(validation.isValid).toBe(false);
      expect(validation.status).toBe('INVALID');
      expect(validation.reason).toContain('大于最大值');
    });

    test('应该检测到无效的字符串指标', () => {
      const config = {
        indicator_name: 'trendStrength',
        min_value: null,
        max_value: null,
        tolerance: null
      };

      const validation = monitor.validateIndicator('trendStrength', 'NONE', config);
      
      expect(validation.isValid).toBe(false);
      expect(validation.status).toBe('INVALID');
      expect(validation.reason).toBe('指标值为无效字符串');
    });
  });

  describe('指标状态记录', () => {
    test('应该正确记录指标状态', async () => {
      const symbol = 'TEST_BTCUSDT';
      const indicatorName = 'ma20';
      const value = 100.5;
      const validation = {
        isValid: true,
        status: 'VALID',
        reason: '指标值有效'
      };

      await monitor.recordIndicatorStatus(symbol, indicatorName, value, validation);

      const result = await db.get(
        'SELECT * FROM indicator_monitoring WHERE symbol = ? AND indicator_name = ?',
        [symbol, indicatorName]
      );

      expect(result).toBeTruthy();
      expect(result.symbol).toBe(symbol);
      expect(result.indicator_name).toBe(indicatorName);
      expect(result.indicator_value).toBe(value);
      expect(result.status).toBe('VALID');
    });
  });

  describe('告警系统', () => {
    test('应该正确触发指标告警', async () => {
      const symbol = 'TEST_ETHUSDT';
      const indicatorName = 'ma20';
      const validation = {
        isValid: false,
        status: 'MISSING',
        reason: '指标值为空'
      };

      await monitor.triggerIndicatorAlert(symbol, indicatorName, validation, 3);

      const alert = await db.get(
        'SELECT * FROM alert_records WHERE symbol = ? AND indicator_name = ?',
        [symbol, indicatorName]
      );

      expect(alert).toBeTruthy();
      expect(alert.symbol).toBe(symbol);
      expect(alert.indicator_name).toBe(indicatorName);
      expect(alert.alert_type).toBe('MISSING');
      expect(alert.severity).toBe('MEDIUM');
      expect(alert.is_resolved).toBe(0);
    });

    test('应该正确解决告警', async () => {
      // 先创建一个告警
      await db.run(
        `INSERT INTO alert_records 
         (symbol, indicator_name, alert_type, severity, message, timestamp) 
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        ['TEST_SOLUSDT', 'ma20', 'MISSING', 'MEDIUM', '测试告警']
      );

      const alert = await db.get(
        'SELECT * FROM alert_records WHERE symbol = ?',
        ['TEST_SOLUSDT']
      );

      await monitor.resolveAlert(alert.id);

      const resolvedAlert = await db.get(
        'SELECT * FROM alert_records WHERE id = ?',
        [alert.id]
      );

      expect(resolvedAlert.is_resolved).toBe(1);
      expect(resolvedAlert.resolved_at).toBeTruthy();
    });
  });

  describe('系统健康检查', () => {
    test('应该正确记录系统健康状态', async () => {
      const healthData = {
        totalSymbols: 10,
        healthySymbols: 8,
        unhealthySymbols: 2,
        healthRate: 80,
        details: JSON.stringify([
          { symbol: 'BTCUSDT', healthRate: 90 },
          { symbol: 'ETHUSDT', healthRate: 70 }
        ])
      };

      await monitor.recordSystemHealth(healthData);

      const result = await db.get(
        'SELECT * FROM system_health WHERE check_type = "INDICATORS" ORDER BY timestamp DESC LIMIT 1'
      );

      expect(result).toBeTruthy();
      expect(result.total_symbols).toBe(10);
      expect(result.healthy_symbols).toBe(8);
      expect(result.unhealthy_symbols).toBe(2);
      expect(result.health_rate).toBe(80);
    });
  });

  describe('指标概览查询', () => {
    test('应该正确获取指标状态概览', async () => {
      // 插入测试数据
      await db.run(
        `INSERT INTO indicator_monitoring 
         (symbol, indicator_name, indicator_value, status, timestamp) 
         VALUES 
         ('TEST_BTCUSDT', 'ma20', 100, 'VALID', CURRENT_TIMESTAMP),
         ('TEST_BTCUSDT', 'ma50', 95, 'VALID', CURRENT_TIMESTAMP),
         ('TEST_ETHUSDT', 'ma20', NULL, 'MISSING', CURRENT_TIMESTAMP)`
      );

      const overview = await monitor.getIndicatorStatusOverview();

      expect(overview).toBeTruthy();
      expect(overview.length).toBeGreaterThan(0);
      
      const btcOverview = overview.find(item => item.symbol === 'TEST_BTCUSDT');
      expect(btcOverview).toBeTruthy();
      expect(btcOverview.valid_indicators).toBe(2);
      expect(btcOverview.health_rate).toBe(100);
    });
  });

  describe('监控系统生命周期', () => {
    test('应该正确启动和停止监控', async () => {
      expect(monitor.isRunning).toBe(false);

      await monitor.startMonitoring(100); // 100ms间隔用于测试
      expect(monitor.isRunning).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 150)); // 等待一次检查

      monitor.stopMonitoring();
      expect(monitor.isRunning).toBe(false);
    });

    test('应该防止重复启动监控', async () => {
      await monitor.startMonitoring(100);
      expect(monitor.isRunning).toBe(true);

      // 尝试再次启动
      await monitor.startMonitoring(100);
      expect(monitor.isRunning).toBe(true); // 应该保持运行状态

      monitor.stopMonitoring();
    });
  });

  describe('性能测试', () => {
    test('应该能够处理大量指标数据', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'AVAXUSDT', 'LINKUSDT'];
      const indicators = ['ma20', 'ma50', 'ma200', 'ema20', 'ema50', 'adx14', 'bbw'];

      const startTime = Date.now();

      // 批量插入指标数据
      for (const symbol of symbols) {
        for (const indicator of indicators) {
          const value = Math.random() * 1000;
          const validation = {
            isValid: true,
            status: 'VALID',
            reason: '指标值有效'
          };
          await monitor.recordIndicatorStatus(symbol, indicator, value, validation);
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`批量处理 ${symbols.length * indicators.length} 个指标耗时: ${duration}ms`);
      expect(duration).toBeLessThan(5000); // 应该在5秒内完成

      // 验证数据正确插入
      const count = await db.get(
        'SELECT COUNT(*) as count FROM indicator_monitoring WHERE symbol IN (?, ?, ?, ?, ?)',
        symbols
      );
      expect(count.count).toBe(symbols.length * indicators.length);
    });
  });

  describe('错误处理', () => {
    test('应该正确处理数据库错误', async () => {
      // 模拟数据库错误
      const originalRun = db.run;
      db.run = jest.fn().mockRejectedValue(new Error('数据库连接失败'));

      await expect(monitor.recordIndicatorStatus('TEST', 'ma20', 100, {
        isValid: true,
        status: 'VALID',
        reason: '测试'
      })).rejects.toThrow('数据库连接失败');

      // 恢复原始方法
      db.run = originalRun;
    });

    test('应该正确处理无效的指标配置', () => {
      const config = null;
      const validation = monitor.validateIndicator('ma20', 100, config);
      
      expect(validation.isValid).toBe(false);
      expect(validation.status).toBe('ERROR');
    });
  });
});

describe('监控系统集成测试', () => {
  let monitor;
  let db;

  beforeAll(async () => {
    db = new DatabaseManager();
    await db.init();
    monitor = new EnhancedIndicatorMonitor(db);
    await monitor.initialize();
  });

  afterAll(async () => {
    await monitor.close();
    await db.close();
  });

  test('应该能够执行完整的健康检查流程', async () => {
    // 模拟插入一些策略分析数据
    await db.run(
      `INSERT OR REPLACE INTO strategy_v3_analysis 
       (symbol, ma20, ma50, ma200, ema20, ema50, adx14, bbw, timestamp) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      ['TEST_INTEGRATION', 100, 95, 90, 98, 93, 25, 0.05, 'now']
    );

    const healthCheck = await monitor.performHealthCheck();

    expect(healthCheck).toBeTruthy();
    expect(healthCheck.totalSymbols).toBeGreaterThan(0);
    expect(healthCheck.healthRate).toBeGreaterThanOrEqual(0);
    expect(healthCheck.healthRate).toBeLessThanOrEqual(100);
  });
});
