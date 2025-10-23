/**
 * 宏观监控API路由单元测试
 */

const request = require('supertest');
const express = require('express');

// Mock宏观监控控制器
const mockMacroMonitor = {
  getStatus: jest.fn(),
  triggerMonitoring: jest.fn(),
  fundFlowMonitor: {
    getFundFlowData: jest.fn()
  },
  sentimentMonitor: {
    getSentimentData: jest.fn(),
    getCurrentFearGreedIndex: jest.fn()
  },
  futuresMonitor: {
    getFuturesData: jest.fn()
  },
  macroMonitor: {
    getMacroData: jest.fn(),
    getCurrentFedFundsRate: jest.fn(),
    getCurrentCPIRate: jest.fn()
  },
  database: {
    execute: jest.fn()
  }
};

// 创建测试应用
const app = express();
app.use(express.json());
app.set('macroMonitor', mockMacroMonitor);

// 导入路由
const macroMonitorRoutes = require('../../src/api/routes/macro-monitor');
app.use('/api/v1/macro-monitor', macroMonitorRoutes);

describe('宏观监控API路由测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/macro-monitor/status', () => {
    test('应该返回监控状态', async () => {
      const mockStatus = {
        isRunning: true,
        monitoringInterval: 60000,
        data: {
          fundFlow: [],
          sentiment: [],
          futures: [],
          macro: []
        }
      };
      mockMacroMonitor.getStatus.mockResolvedValue(mockStatus);

      const response = await request(app)
        .get('/api/v1/macro-monitor/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStatus);
    });

    test('应该处理错误', async () => {
      mockMacroMonitor.getStatus.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/v1/macro-monitor/status')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database error');
    });
  });

  describe('POST /api/v1/macro-monitor/trigger', () => {
    test('应该触发监控', async () => {
      const mockResult = { success: true, message: '监控任务已触发' };
      mockMacroMonitor.triggerMonitoring.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/v1/macro-monitor/trigger')
        .expect(200);

      expect(response.body).toEqual(mockResult);
    });
  });

  describe('GET /api/v1/macro-monitor/fund-flow', () => {
    test('应该返回资金流数据', async () => {
      const mockData = [
        { id: 1, metric_name: 'BTC大额交易', metric_value: 1000000 }
      ];
      mockMacroMonitor.fundFlowMonitor.getFundFlowData.mockResolvedValue(mockData);

      const response = await request(app)
        .get('/api/v1/macro-monitor/fund-flow?limit=10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockData);
      expect(mockMacroMonitor.fundFlowMonitor.getFundFlowData).toHaveBeenCalledWith(10);
    });
  });

  describe('GET /api/v1/macro-monitor/sentiment', () => {
    test('应该返回市场情绪数据', async () => {
      const mockData = [
        { id: 1, metric_name: '恐惧贪婪指数', metric_value: 50 }
      ];
      mockMacroMonitor.sentimentMonitor.getSentimentData.mockResolvedValue(mockData);

      const response = await request(app)
        .get('/api/v1/macro-monitor/sentiment?limit=20')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockData);
      expect(mockMacroMonitor.sentimentMonitor.getSentimentData).toHaveBeenCalledWith(20);
    });
  });

  describe('GET /api/v1/macro-monitor/sentiment/current', () => {
    test('应该返回当前恐惧贪婪指数', async () => {
      const mockData = {
        value: 50,
        classification: 'Neutral',
        timestamp: '2024-01-01 12:00:00'
      };
      mockMacroMonitor.sentimentMonitor.getCurrentFearGreedIndex.mockResolvedValue(mockData);

      const response = await request(app)
        .get('/api/v1/macro-monitor/sentiment/current')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockData);
    });
  });

  describe('GET /api/v1/macro-monitor/futures', () => {
    test('应该返回合约市场数据', async () => {
      const mockData = [
        { id: 1, metric_name: '多空比', metric_value: 1.5 }
      ];
      mockMacroMonitor.futuresMonitor.getFuturesData.mockResolvedValue(mockData);

      const response = await request(app)
        .get('/api/v1/macro-monitor/futures')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockData);
    });
  });

  describe('GET /api/v1/macro-monitor/macro', () => {
    test('应该返回宏观指标数据', async () => {
      const mockData = [
        { id: 1, metric_name: '美联储利率', metric_value: 3.5 }
      ];
      mockMacroMonitor.macroMonitor.getMacroData.mockResolvedValue(mockData);

      const response = await request(app)
        .get('/api/v1/macro-monitor/macro')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockData);
    });
  });

  describe('GET /api/v1/macro-monitor/macro/fed-funds', () => {
    test('应该返回当前美联储利率', async () => {
      const mockData = {
        value: 3.5,
        date: '2024-01-01',
        timestamp: '2024-01-01 12:00:00'
      };
      mockMacroMonitor.macroMonitor.getCurrentFedFundsRate.mockResolvedValue(mockData);

      const response = await request(app)
        .get('/api/v1/macro-monitor/macro/fed-funds')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockData);
    });
  });

  describe('GET /api/v1/macro-monitor/macro/cpi', () => {
    test('应该返回当前CPI通胀率', async () => {
      const mockData = {
        value: 2.5,
        currentCPI: 300,
        lastYearCPI: 292.5,
        currentDate: '2024-01-01',
        lastYearDate: '2023-01-01',
        timestamp: '2024-01-01 12:00:00'
      };
      mockMacroMonitor.macroMonitor.getCurrentCPIRate.mockResolvedValue(mockData);

      const response = await request(app)
        .get('/api/v1/macro-monitor/macro/cpi')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockData);
    });
  });

  describe('GET /api/v1/macro-monitor/alerts', () => {
    test('应该返回告警记录', async () => {
      const mockData = [
        { id: 1, alert_type: 'FUND_FLOW', alert_level: 'CRITICAL', title: 'BTC大额转账告警' }
      ];
      mockMacroMonitor.database.execute.mockResolvedValue([mockData, {}]);

      const response = await request(app)
        .get('/api/v1/macro-monitor/alerts?type=FUND_FLOW&level=CRITICAL&limit=50')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockData);
      expect(mockMacroMonitor.database.execute).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM macro_monitoring_alerts'),
        ['FUND_FLOW', 'CRITICAL', 50]
      );
    });
  });

  describe('GET /api/v1/macro-monitor/overview', () => {
    test('应该返回监控数据概览', async () => {
      const mockStatus = {
        isRunning: true,
        monitoringInterval: 60000,
        data: {
          fundFlow: [],
          sentiment: [],
          futures: [],
          macro: []
        }
      };
      const mockFundFlowData = [{ id: 1, metric_name: 'BTC大额交易' }];
      const mockSentimentData = [{ id: 1, metric_name: '恐惧贪婪指数' }];
      const mockFuturesData = [{ id: 1, metric_name: '多空比' }];
      const mockMacroData = [{ id: 1, metric_name: '美联储利率' }];
      const mockCurrentFearGreed = { value: 50, classification: 'Neutral' };
      const mockCurrentFedFunds = { value: 3.5, date: '2024-01-01' };
      const mockCurrentCPI = { value: 2.5, currentCPI: 300 };

      mockMacroMonitor.getStatus.mockResolvedValue(mockStatus);
      mockMacroMonitor.fundFlowMonitor.getFundFlowData.mockResolvedValue(mockFundFlowData);
      mockMacroMonitor.sentimentMonitor.getSentimentData.mockResolvedValue(mockSentimentData);
      mockMacroMonitor.sentimentMonitor.getCurrentFearGreedIndex.mockResolvedValue(mockCurrentFearGreed);
      mockMacroMonitor.futuresMonitor.getFuturesData.mockResolvedValue(mockFuturesData);
      mockMacroMonitor.macroMonitor.getMacroData.mockResolvedValue(mockMacroData);
      mockMacroMonitor.macroMonitor.getCurrentFedFundsRate.mockResolvedValue(mockCurrentFedFunds);
      mockMacroMonitor.macroMonitor.getCurrentCPIRate.mockResolvedValue(mockCurrentCPI);

      const response = await request(app)
        .get('/api/v1/macro-monitor/overview')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(true);
      expect(response.body.data.fundFlow.latest).toEqual(mockFundFlowData.slice(0, 3));
      expect(response.body.data.sentiment.current).toEqual(mockCurrentFearGreed);
      expect(response.body.data.macro.current.fedFunds).toEqual(mockCurrentFedFunds);
      expect(response.body.data.macro.current.cpi).toEqual(mockCurrentCPI);
    });
  });
});
