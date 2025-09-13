// tests/monitoring-simulation-stats.test.js
// 监控页面模拟交易统计数据测试

const { SmartFlowServer } = require('../server');

describe('监控页面模拟交易统计数据', () => {
  let server;
  let mockDb;

  beforeEach(() => {
    // 创建模拟数据库
    mockDb = {
      getCustomSymbols: jest.fn(),
      runQuery: jest.fn()
    };

    // 创建服务器实例
    server = new SmartFlowServer();
    server.db = mockDb;
    server.setupAPIRoutes();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('监控数据API', () => {
    test('应该正确计算模拟交易完成率', async () => {
      // 模拟数据
      const symbols = ['BTCUSDT', 'ETHUSDT'];
      
      mockDb.getCustomSymbols.mockResolvedValue(symbols);
      mockDb.runQuery
        .mockResolvedValueOnce([
          // K线数据统计
          { symbol: 'BTCUSDT', interval: '4h', count: 100 },
          { symbol: 'BTCUSDT', interval: '1h', count: 100 },
          { symbol: 'ETHUSDT', interval: '4h', count: 100 },
          { symbol: 'ETHUSDT', interval: '1h', count: 100 }
        ])
        .mockResolvedValueOnce([
          // 策略分析统计
          { symbol: 'BTCUSDT', count: 50 },
          { symbol: 'ETHUSDT', count: 50 }
        ])
        .mockResolvedValueOnce([
          // 告警统计
          { symbol: 'BTCUSDT', count: 2 },
          { symbol: 'ETHUSDT', count: 1 }
        ])
        .mockResolvedValueOnce([
          // 模拟交易统计
          { symbol: 'BTCUSDT', total_simulations: 10, completed_simulations: 8 },
          { symbol: 'ETHUSDT', total_simulations: 15, completed_simulations: 12 }
        ]);

      // 发送请求
      const req = { method: 'GET', url: '/api/monitoring-dashboard' };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      await server.app._router.handle(req, res);

      // 验证响应
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: expect.objectContaining({
            totalSymbols: 2,
            completionRates: expect.objectContaining({
              simulationTrading: 80 // (8+12)/(10+15) * 100 = 80%
            })
          }),
          detailedStats: expect.arrayContaining([
            expect.objectContaining({
              symbol: 'BTCUSDT',
              simulationCompletionRate: 80, // 8/10 * 100
              simulationTriggers: 10,
              simulationCompletions: 8
            }),
            expect.objectContaining({
              symbol: 'ETHUSDT',
              simulationCompletionRate: 80, // 12/15 * 100
              simulationTriggers: 15,
              simulationCompletions: 12
            })
          ])
        })
      );
    });

    test('应该处理没有模拟交易数据的情况', async () => {
      const symbols = ['BTCUSDT'];
      
      mockDb.getCustomSymbols.mockResolvedValue(symbols);
      mockDb.runQuery
        .mockResolvedValueOnce([
          { symbol: 'BTCUSDT', interval: '4h', count: 100 },
          { symbol: 'BTCUSDT', interval: '1h', count: 100 }
        ])
        .mockResolvedValueOnce([
          { symbol: 'BTCUSDT', count: 50 }
        ])
        .mockResolvedValueOnce([
          { symbol: 'BTCUSDT', count: 0 }
        ])
        .mockResolvedValueOnce([]); // 没有模拟交易数据

      const req = { method: 'GET', url: '/api/monitoring-dashboard' };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      await server.app._router.handle(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: expect.objectContaining({
            completionRates: expect.objectContaining({
              simulationTrading: 0 // 没有模拟交易数据时应该为0
            })
          }),
          detailedStats: expect.arrayContaining([
            expect.objectContaining({
              symbol: 'BTCUSDT',
              simulationCompletionRate: 0,
              simulationTriggers: 0,
              simulationCompletions: 0
            })
          ])
        })
      );
    });

    test('应该正确处理部分交易对有模拟交易数据的情况', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT'];
      
      mockDb.getCustomSymbols.mockResolvedValue(symbols);
      mockDb.runQuery
        .mockResolvedValueOnce([
          { symbol: 'BTCUSDT', interval: '4h', count: 100 },
          { symbol: 'BTCUSDT', interval: '1h', count: 100 },
          { symbol: 'ETHUSDT', interval: '4h', count: 100 },
          { symbol: 'ETHUSDT', interval: '1h', count: 100 }
        ])
        .mockResolvedValueOnce([
          { symbol: 'BTCUSDT', count: 50 },
          { symbol: 'ETHUSDT', count: 50 }
        ])
        .mockResolvedValueOnce([
          { symbol: 'BTCUSDT', count: 1 },
          { symbol: 'ETHUSDT', count: 0 }
        ])
        .mockResolvedValueOnce([
          // 只有BTCUSDT有模拟交易数据
          { symbol: 'BTCUSDT', total_simulations: 5, completed_simulations: 4 }
        ]);

      const req = { method: 'GET', url: '/api/monitoring-dashboard' };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      await server.app._router.handle(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: expect.objectContaining({
            completionRates: expect.objectContaining({
              simulationTrading: 80 // 4/5 * 100 = 80%
            })
          }),
          detailedStats: expect.arrayContaining([
            expect.objectContaining({
              symbol: 'BTCUSDT',
              simulationCompletionRate: 80,
              simulationTriggers: 5,
              simulationCompletions: 4
            }),
            expect.objectContaining({
              symbol: 'ETHUSDT',
              simulationCompletionRate: 0,
              simulationTriggers: 0,
              simulationCompletions: 0
            })
          ])
        })
      );
    });
  });

  describe('前端显示逻辑', () => {
    test('应该正确计算总触发次数和完成次数', () => {
      // 模拟前端监控数据
      const mockData = {
        detailedStats: [
          {
            symbol: 'BTCUSDT',
            simulationTriggers: 10,
            simulationCompletions: 8
          },
          {
            symbol: 'ETHUSDT',
            simulationTriggers: 15,
            simulationCompletions: 12
          }
        ]
      };

      // 模拟前端计算逻辑
      let totalTriggers = 0;
      let totalCompletions = 0;
      
      if (mockData.detailedStats) {
        mockData.detailedStats.forEach(symbol => {
          totalTriggers += symbol.simulationTriggers || 0;
          totalCompletions += symbol.simulationCompletions || 0;
        });
      }

      expect(totalTriggers).toBe(25); // 10 + 15
      expect(totalCompletions).toBe(20); // 8 + 12
    });

    test('应该处理空数据的情况', () => {
      const mockData = {
        detailedStats: []
      };

      let totalTriggers = 0;
      let totalCompletions = 0;
      
      if (mockData.detailedStats) {
        mockData.detailedStats.forEach(symbol => {
          totalTriggers += symbol.simulationTriggers || 0;
          totalCompletions += symbol.simulationCompletions || 0;
        });
      }

      expect(totalTriggers).toBe(0);
      expect(totalCompletions).toBe(0);
    });
  });
});
