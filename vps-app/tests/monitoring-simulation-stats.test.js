// tests/monitoring-simulation-stats.test.js
// 监控页面模拟交易统计数据测试

describe('监控页面模拟交易统计数据', () => {
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
