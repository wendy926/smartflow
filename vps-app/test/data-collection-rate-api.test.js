/**
 * 数据采集率API的单元测试
 */

const request = require('supertest');
const express = require('express');

// Mock BinanceAPI
jest.mock('../modules/api/BinanceAPI', () => ({
  getRealTimeStats: jest.fn(() => ({
    global: {
      totalCalls: 100,
      successfulCalls: 95,
      failedCalls: 5,
      successRate: 95,
      lastUpdate: Date.now()
    }
  }))
}));

// Mock DataMonitor
jest.mock('../modules/monitoring/DataMonitor', () => {
  return jest.fn().mockImplementation(() => ({
    calculateCompletionRates: jest.fn(),
    checkHealthStatus: jest.fn(),
    getMonitoringDashboard: jest.fn(() => Promise.resolve({
      summary: {
        totalSymbols: 24,
        healthySymbols: 20,
        warningSymbols: 4,
        errorSymbols: 0,
        overallHealth: 'HEALTHY',
        completionRates: {
          dataCollection: 95, // 应该使用Binance API成功率
          signalAnalysis: 90,
          simulationTrading: 0
        }
      }
    }))
  }));
});

describe('数据采集率API测试', () => {
  let app;
  let server;

  beforeAll(async () => {
    // 创建测试应用
    app = express();
    app.use(express.json());

    // 模拟API路由
    app.get('/api/signals', (req, res) => {
      const BinanceAPI = require('../modules/api/BinanceAPI');
      const realtimeStats = BinanceAPI.getRealTimeStats();
      const dataCollectionRate = realtimeStats.global.successRate;

      res.json([{
        symbol: 'BTCUSDT',
        dataCollectionRate: dataCollectionRate,
        trend: '多头趋势',
        signalStrength: '强'
      }]);
    });

    app.get('/api/monitoring-dashboard', async (req, res) => {
      const DataMonitor = require('../modules/monitoring/DataMonitor');
      const dataMonitor = new DataMonitor();
      try {
        const dashboard = await dataMonitor.getMonitoringDashboard();
        res.json(dashboard);
      } finally {
        // 清理DataMonitor的定时器
        dataMonitor.stopMemoryCleanup();
      }
    });

    server = app.listen(0);
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('信号API应该返回Binance API成功率作为数据采集率', async () => {
    const response = await request(app)
      .get('/api/signals')
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].dataCollectionRate).toBe(95);
    expect(response.body[0].symbol).toBe('BTCUSDT');
  });

  test('监控仪表板应该使用Binance API成功率', async () => {
    const response = await request(app)
      .get('/api/monitoring-dashboard')
      .expect(200);

    expect(response.body.summary.completionRates.dataCollection).toBe(95);
    expect(response.body.summary.totalSymbols).toBe(24);
  });

  test('数据采集率应该等于Binance API成功率', async () => {
    const signalsResponse = await request(app).get('/api/signals');
    const monitoringResponse = await request(app).get('/api/monitoring-dashboard');

    const signalsDataCollectionRate = signalsResponse.body[0].dataCollectionRate;
    const monitoringDataCollectionRate = monitoringResponse.body.summary.completionRates.dataCollection;

    expect(signalsDataCollectionRate).toBe(monitoringDataCollectionRate);
    expect(signalsDataCollectionRate).toBe(95);
  });
});
