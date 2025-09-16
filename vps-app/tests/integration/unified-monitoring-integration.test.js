// unified-monitoring-integration.test.js - 统一监控中心集成测试

const request = require('supertest');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 导入服务器模块
const { dataLayerIntegration } = require('../../src/core/modules/data/DataLayerIntegration');
const UnifiedMonitoringMigration = require('../../src/core/modules/database/UnifiedMonitoringMigration');
const UnifiedMonitoringAPI = require('../../src/core/modules/api/UnifiedMonitoringAPI');

describe('统一监控中心集成测试', () => {
  let app;
  let db;
  let api;

  beforeAll(async () => {
    // 初始化数据层
    await dataLayerIntegration.init();
    db = dataLayerIntegration.getDatabase();

    // 执行数据库迁移
    const migration = new UnifiedMonitoringMigration(db);
    await migration.migrate();

    // 创建Express应用
    app = express();
    app.use(express.json());

    // 初始化API
    api = new UnifiedMonitoringAPI(db);
    api.setupRoutes(app);

    // 添加测试数据
    await addTestData(db);
  });

  afterAll(async () => {
    if (db) {
      await new Promise((resolve) => {
        db.close((err) => {
          if (err) console.error('关闭数据库失败:', err);
          resolve();
        });
      });
    }
  });

  describe('端到端API测试', () => {
    test('应该完整支持统一监控中心工作流', async () => {
      // 1. 获取统一监控中心数据
      const dashboardResponse = await request(app)
        .get('/api/unified-monitoring/dashboard')
        .expect(200);

      expect(dashboardResponse.body.success).toBe(true);
      expect(dashboardResponse.body.data.summary).toHaveProperty('v3Strategy');
      expect(dashboardResponse.body.data.summary).toHaveProperty('ictStrategy');

      // 2. 获取数据刷新状态
      const refreshResponse = await request(app)
        .get('/api/data-refresh/status')
        .expect(200);

      expect(refreshResponse.body.success).toBe(true);
      expect(refreshResponse.body.data).toHaveProperty('v3Strategy');
      expect(refreshResponse.body.data).toHaveProperty('ictStrategy');

      // 3. 强制刷新数据
      const forceRefreshResponse = await request(app)
        .post('/api/data-refresh/force-refresh/BTCUSDT')
        .send({ strategyType: 'V3' })
        .expect(200);

      expect(forceRefreshResponse.body.success).toBe(true);

      // 4. 获取模拟交易历史
      const simulationResponse = await request(app)
        .get('/api/unified-simulations/history')
        .expect(200);

      expect(simulationResponse.body.success).toBe(true);
      expect(simulationResponse.body.data).toHaveProperty('simulations');
      expect(simulationResponse.body.data).toHaveProperty('pagination');

      // 5. 获取模拟交易统计
      const statsResponse = await request(app)
        .get('/api/unified-simulations/stats')
        .expect(200);

      expect(statsResponse.body.success).toBe(true);
      expect(statsResponse.body.data).toHaveProperty('overall');
      expect(statsResponse.body.data).toHaveProperty('byStrategy');

      // 6. 获取交易对管理统计
      const symbolStatsResponse = await request(app)
        .get('/api/symbol-management/stats')
        .expect(200);

      expect(symbolStatsResponse.body.success).toBe(true);
      expect(symbolStatsResponse.body.data).toHaveProperty('byStrategy');

      // 7. 获取监控告警
      const alertsResponse = await request(app)
        .get('/api/monitoring/alerts')
        .expect(200);

      expect(alertsResponse.body.success).toBe(true);
      expect(alertsResponse.body.data).toHaveProperty('alerts');
    });

    test('应该支持V3和ICT策略的完整数据流', async () => {
      // 测试V3策略数据
      const v3DashboardResponse = await request(app)
        .get('/api/unified-monitoring/dashboard')
        .expect(200);

      const v3Stats = v3DashboardResponse.body.data.summary.v3Strategy;
      expect(v3Stats).toHaveProperty('healthySymbols');
      expect(v3Stats).toHaveProperty('warningSymbols');
      expect(v3Stats).toHaveProperty('errorSymbols');

      // 测试ICT策略数据
      const ictStats = v3DashboardResponse.body.data.summary.ictStrategy;
      expect(ictStats).toHaveProperty('healthySymbols');
      expect(ictStats).toHaveProperty('warningSymbols');
      expect(ictStats).toHaveProperty('errorSymbols');

      // 测试完成率数据
      const completionRates = v3DashboardResponse.body.data.completionRates;
      expect(completionRates.v3Strategy).toHaveProperty('dataCollection');
      expect(completionRates.v3Strategy).toHaveProperty('dataValidation');
      expect(completionRates.v3Strategy).toHaveProperty('simulationTrading');
      expect(completionRates.ictStrategy).toHaveProperty('dataCollection');
      expect(completionRates.ictStrategy).toHaveProperty('dataValidation');
      expect(completionRates.ictStrategy).toHaveProperty('simulationTrading');
    });

    test('应该支持模拟交易的完整生命周期', async () => {
      // 1. 创建模拟交易
      const simulationData = {
        symbol: 'BTCUSDT',
        strategyType: 'V3',
        entryPrice: 50000,
        stopLossPrice: 49000,
        takeProfitPrice: 52000,
        maxLeverage: 10,
        minMargin: 100,
        direction: 'LONG',
        triggerReason: 'SIGNAL'
      };

      const simulationId = await api.recordUnifiedSimulation(simulationData);
      expect(typeof simulationId).toBe('number');
      expect(simulationId).toBeGreaterThan(0);

      // 2. 获取模拟交易历史（应该包含新创建的）
      const historyResponse = await request(app)
        .get('/api/unified-simulations/history')
        .expect(200);

      const simulations = historyResponse.body.data.simulations;
      const newSimulation = simulations.find(sim => sim.id === simulationId);
      expect(newSimulation).toBeDefined();
      expect(newSimulation.strategy_type).toBe('V3');
      expect(newSimulation.status).toBe('ACTIVE');

      // 3. 更新模拟交易状态
      const updateData = {
        status: 'CLOSED',
        closedAt: new Date().toISOString(),
        exitPrice: 52000,
        exitReason: 'TAKE_PROFIT',
        isWin: true,
        profitLoss: 2000
      };

      await api.updateUnifiedSimulation(simulationId, updateData);

      // 4. 验证更新后的状态
      const updatedHistoryResponse = await request(app)
        .get('/api/unified-simulations/history')
        .expect(200);

      const updatedSimulations = updatedHistoryResponse.body.data.simulations;
      const updatedSimulation = updatedSimulations.find(sim => sim.id === simulationId);
      expect(updatedSimulation.status).toBe('CLOSED');
      expect(updatedSimulation.is_win).toBe(true);
      expect(updatedSimulation.profit_loss).toBe(2000);
    });

    test('应该支持监控告警的完整生命周期', async () => {
      // 1. 创建告警
      await api.createAlert('BTCUSDT', 'V3', 'DATA_QUALITY', 'MEDIUM', '数据质量告警', {
        currentRate: 85.5,
        threshold: 90.0
      });

      // 2. 获取告警列表
      const alertsResponse = await request(app)
        .get('/api/monitoring/alerts')
        .expect(200);

      const alerts = alertsResponse.body.data.alerts;
      const newAlert = alerts.find(alert => alert.message === '数据质量告警');
      expect(newAlert).toBeDefined();
      expect(newAlert.resolved).toBe(false);

      // 3. 解决告警
      const resolveResponse = await request(app)
        .post(`/api/monitoring/alerts/${newAlert.id}/resolve`)
        .expect(200);

      expect(resolveResponse.body.success).toBe(true);

      // 4. 验证告警已解决
      const updatedAlertsResponse = await request(app)
        .get('/api/monitoring/alerts')
        .expect(200);

      const updatedAlerts = updatedAlertsResponse.body.data.alerts;
      const resolvedAlert = updatedAlerts.find(alert => alert.id === newAlert.id);
      expect(resolvedAlert.resolved).toBe(true);
    });

    test('应该支持数据刷新状态的完整管理', async () => {
      // 1. 获取初始刷新状态
      const initialStatusResponse = await request(app)
        .get('/api/data-refresh/status')
        .expect(200);

      const initialStatus = initialStatusResponse.body.data;
      expect(initialStatus.v3Strategy.BTCUSDT['4h_trend']).toHaveProperty('shouldRefresh');

      // 2. 强制刷新V3策略的4h_trend数据
      const forceRefreshResponse = await request(app)
        .post('/api/data-refresh/force-refresh/BTCUSDT')
        .send({ strategyType: 'V3', dataType: '4h_trend' })
        .expect(200);

      expect(forceRefreshResponse.body.success).toBe(true);

      // 3. 验证刷新状态已更新
      const updatedStatusResponse = await request(app)
        .get('/api/data-refresh/status')
        .expect(200);

      const updatedStatus = updatedStatusResponse.body.data;
      expect(updatedStatus.v3Strategy.BTCUSDT['4h_trend']).toHaveProperty('lastRefresh');
    });

    test('应该支持分页和筛选功能', async () => {
      // 测试模拟交易历史分页
      const page1Response = await request(app)
        .get('/api/unified-simulations/history?page=1&pageSize=5')
        .expect(200);

      expect(page1Response.body.data.pagination.currentPage).toBe(1);
      expect(page1Response.body.data.pagination.pageSize).toBe(5);
      expect(page1Response.body.data.simulations.length).toBeLessThanOrEqual(5);

      // 测试按策略筛选
      const v3FilterResponse = await request(app)
        .get('/api/unified-simulations/history?strategyType=V3')
        .expect(200);

      const v3Simulations = v3FilterResponse.body.data.simulations;
      expect(v3Simulations.every(sim => sim.strategy_type === 'V3')).toBe(true);

      // 测试告警分页
      const alertsPageResponse = await request(app)
        .get('/api/monitoring/alerts?page=1&pageSize=10')
        .expect(200);

      expect(alertsPageResponse.body.data.pagination.currentPage).toBe(1);
      expect(alertsPageResponse.body.data.pagination.pageSize).toBe(10);

      // 测试告警按策略筛选
      const v3AlertsResponse = await request(app)
        .get('/api/monitoring/alerts?strategyType=V3')
        .expect(200);

      const v3Alerts = v3AlertsResponse.body.data.alerts;
      expect(v3Alerts.every(alert => alert.strategy_type === 'V3')).toBe(true);
    });
  });

  describe('性能测试', () => {
    test('应该快速响应监控中心数据请求', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/unified-monitoring/dashboard')
        .expect(200);

      const responseTime = Date.now() - startTime;

      expect(responseTime).toBeLessThan(1000); // 应该在1秒内响应
      expect(response.body.success).toBe(true);
    });

    test('应该使用缓存提高后续请求性能', async () => {
      // 第一次请求
      const start1 = Date.now();
      await request(app).get('/api/unified-monitoring/dashboard');
      const time1 = Date.now() - start1;

      // 第二次请求（应该使用缓存）
      const start2 = Date.now();
      await request(app).get('/api/unified-monitoring/dashboard');
      const time2 = Date.now() - start2;

      // 第二次请求应该更快
      expect(time2).toBeLessThan(time1);
    });
  });

  describe('数据一致性测试', () => {
    test('应该保持V3和ICT策略数据的一致性', async () => {
      const dashboardResponse = await request(app)
        .get('/api/unified-monitoring/dashboard')
        .expect(200);

      const summary = dashboardResponse.body.data.summary;

      // V3和ICT策略的交易对数量应该一致
      expect(summary.v3Strategy.healthySymbols + summary.v3Strategy.warningSymbols + summary.v3Strategy.errorSymbols)
        .toBe(summary.ictStrategy.healthySymbols + summary.ictStrategy.warningSymbols + summary.ictStrategy.errorSymbols);
    });

    test('应该保持模拟交易数据的一致性', async () => {
      const statsResponse = await request(app)
        .get('/api/unified-simulations/stats')
        .expect(200);

      const overall = statsResponse.body.data.overall;
      const byStrategy = statsResponse.body.data.byStrategy;

      // 整体统计应该等于各策略统计之和
      expect(overall.totalTrades).toBe(byStrategy.V3.totalTrades + byStrategy.ICT.totalTrades);
      expect(overall.winningTrades).toBe(byStrategy.V3.winningTrades + byStrategy.ICT.winningTrades);
      expect(overall.losingTrades).toBe(byStrategy.V3.losingTrades + byStrategy.ICT.losingTrades);
    });
  });

  describe('错误恢复测试', () => {
    test('应该优雅处理数据库连接错误', async () => {
      // 模拟数据库连接错误
      const originalRun = db.run;
      db.run = jest.fn((sql, params, callback) => {
        callback(new Error('数据库连接错误'));
      });

      const response = await request(app)
        .get('/api/unified-monitoring/dashboard')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body).toHaveProperty('error');

      // 恢复原始方法
      db.run = originalRun;
    });

    test('应该处理无效的API参数', async () => {
      // 测试无效的交易对
      const response = await request(app)
        .get('/api/unified-monitoring/symbol/')
        .expect(404);

      // 测试无效的告警ID
      const alertResponse = await request(app)
        .post('/api/monitoring/alerts/invalid/resolve')
        .expect(500);

      expect(alertResponse.body.success).toBe(false);
    });
  });
});

// 辅助函数

async function addTestData(db) {
  // 添加测试交易对
  const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'];

  for (const symbol of symbols) {
    await db.run('INSERT OR IGNORE INTO custom_symbols (symbol) VALUES (?)', [symbol]);
  }

  // 添加数据刷新状态
  const strategies = ['V3', 'ICT'];
  const v3DataTypes = ['4h_trend', '1h_scoring', '15m_entry'];
  const ictDataTypes = ['daily_trend', 'mtf_analysis', 'ltf_analysis'];

  for (const symbol of symbols) {
    for (const strategy of strategies) {
      const dataTypes = strategy === 'V3' ? v3DataTypes : ictDataTypes;
      for (const dataType of dataTypes) {
        await db.run(
          'INSERT OR IGNORE INTO data_refresh_status (symbol, strategy_type, data_type, should_refresh, refresh_interval) VALUES (?, ?, ?, ?, ?)',
          [symbol, strategy, dataType, true, 3600]
        );
      }
    }
  }

  // 添加监控统计
  for (const symbol of symbols) {
    for (const strategy of strategies) {
      await db.run(
        'INSERT OR IGNORE INTO strategy_monitoring_stats (symbol, strategy_type, data_collection_rate, data_validation_status, simulation_completion_rate, overall_health) VALUES (?, ?, ?, ?, ?, ?)',
        [symbol, strategy, 95.5, 'VALID', 100.0, 'HEALTHY']
      );
    }
  }

  // 添加模拟交易数据
  for (const symbol of symbols) {
    for (const strategy of strategies) {
      await db.run(
        'INSERT OR IGNORE INTO unified_simulations (symbol, strategy_type, entry_price, stop_loss_price, take_profit_price, max_leverage, min_margin, direction, status, trigger_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [symbol, strategy, 50000, 49000, 52000, 10, 100, 'LONG', 'CLOSED', 'SIGNAL']
      );
    }
  }
}
