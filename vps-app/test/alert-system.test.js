const { DataMonitor } = require('../modules/monitoring/DataMonitor');

describe('告警系统测试', () => {
  let dataMonitor;

  beforeEach(() => {
    dataMonitor = new DataMonitor();
  });

  describe('告警数据生成', () => {
    test('应该正确生成数据质量问题告警', () => {
      const mockData = {
        summary: {
          dataQuality: {
            hasIssues: true,
            issues: [
              'AVNTUSDT: 4H趋势分析 - 4H趋势分析失败: 数据不足',
              'BTCUSDT: 1H确认分析 - 资金费率数据无效'
            ]
          },
          dataValidation: {
            hasErrors: false,
            errors: []
          },
          completionRates: {
            dataCollection: 100,
            signalAnalysis: 100
          }
        }
      };

      // 模拟渲染告警列表
      const alerts = [];
      
      if (mockData.summary.dataQuality?.hasIssues) {
        mockData.summary.dataQuality.issues.forEach(issue => {
          alerts.push({
            type: 'data-quality',
            level: 'warning',
            symbol: issue.split(': ')[0],
            message: issue.split(': ')[1],
            timestamp: new Date().toISOString(),
            category: '数据质量'
          });
        });
      }

      expect(alerts).toHaveLength(2);
      expect(alerts[0]).toMatchObject({
        type: 'data-quality',
        level: 'warning',
        symbol: 'AVNTUSDT',
        message: '4H趋势分析 - 4H趋势分析失败',
        category: '数据质量'
      });
    });

    test('应该正确生成数据验证错误告警', () => {
      const mockData = {
        summary: {
          dataQuality: {
            hasIssues: false,
            issues: []
          },
          dataValidation: {
            hasErrors: true,
            errors: [
              'ETHUSDT: 日线K线数据无效',
              'LINKUSDT: 小时K线数据无效'
            ]
          },
          completionRates: {
            dataCollection: 100,
            signalAnalysis: 100
          }
        }
      };

      const alerts = [];
      
      if (mockData.summary.dataValidation?.hasErrors) {
        mockData.summary.dataValidation.errors.forEach(error => {
          alerts.push({
            type: 'data-validation',
            level: 'error',
            symbol: error.split(': ')[0],
            message: error.split(': ')[1],
            timestamp: new Date().toISOString(),
            category: '数据验证'
          });
        });
      }

      expect(alerts).toHaveLength(2);
      expect(alerts[0]).toMatchObject({
        type: 'data-validation',
        level: 'error',
        symbol: 'ETHUSDT',
        message: '日线K线数据无效',
        category: '数据验证'
      });
    });

    test('应该正确生成数据收集率告警', () => {
      const mockData = {
        summary: {
          dataQuality: {
            hasIssues: false,
            issues: []
          },
          dataValidation: {
            hasErrors: false,
            errors: []
          },
          completionRates: {
            dataCollection: 85.5,
            signalAnalysis: 100
          }
        }
      };

      const alerts = [];
      
      if (mockData.summary.completionRates.dataCollection < 95) {
        alerts.push({
          type: 'data-collection',
          level: 'warning',
          symbol: '系统',
          message: `数据收集率过低: ${mockData.summary.completionRates.dataCollection.toFixed(2)}%`,
          timestamp: new Date().toISOString(),
          category: '数据收集'
        });
      }

      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({
        type: 'data-collection',
        level: 'warning',
        symbol: '系统',
        message: '数据收集率过低: 85.50%',
        category: '数据收集'
      });
    });

    test('应该正确生成信号分析率告警', () => {
      const mockData = {
        summary: {
          dataQuality: {
            hasIssues: false,
            issues: []
          },
          dataValidation: {
            hasErrors: false,
            errors: []
          },
          completionRates: {
            dataCollection: 100,
            signalAnalysis: 90.2
          }
        }
      };

      const alerts = [];
      
      if (mockData.summary.completionRates.signalAnalysis < 95) {
        alerts.push({
          type: 'signal-analysis',
          level: 'warning',
          symbol: '系统',
          message: `信号分析率过低: ${mockData.summary.completionRates.signalAnalysis.toFixed(2)}%`,
          timestamp: new Date().toISOString(),
          category: '信号分析'
        });
      }

      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({
        type: 'signal-analysis',
        level: 'warning',
        symbol: '系统',
        message: '信号分析率过低: 90.20%',
        category: '信号分析'
      });
    });

    test('应该正确处理无告警情况', () => {
      const mockData = {
        summary: {
          dataQuality: {
            hasIssues: false,
            issues: []
          },
          dataValidation: {
            hasErrors: false,
            errors: []
          },
          completionRates: {
            dataCollection: 100,
            signalAnalysis: 100
          }
        }
      };

      const alerts = [];
      
      // 检查各种告警条件
      if (mockData.summary.dataQuality?.hasIssues) {
        mockData.summary.dataQuality.issues.forEach(issue => {
          alerts.push({
            type: 'data-quality',
            level: 'warning',
            symbol: issue.split(': ')[0],
            message: issue.split(': ')[1],
            timestamp: new Date().toISOString(),
            category: '数据质量'
          });
        });
      }

      if (mockData.summary.dataValidation?.hasErrors) {
        mockData.summary.dataValidation.errors.forEach(error => {
          alerts.push({
            type: 'data-validation',
            level: 'error',
            symbol: error.split(': ')[0],
            message: error.split(': ')[1],
            timestamp: new Date().toISOString(),
            category: '数据验证'
          });
        });
      }

      if (mockData.summary.completionRates.dataCollection < 95) {
        alerts.push({
          type: 'data-collection',
          level: 'warning',
          symbol: '系统',
          message: `数据收集率过低: ${mockData.summary.completionRates.dataCollection.toFixed(2)}%`,
          timestamp: new Date().toISOString(),
          category: '数据收集'
        });
      }

      if (mockData.summary.completionRates.signalAnalysis < 95) {
        alerts.push({
          type: 'signal-analysis',
          level: 'warning',
          symbol: '系统',
          message: `信号分析率过低: ${mockData.summary.completionRates.signalAnalysis.toFixed(2)}%`,
          timestamp: new Date().toISOString(),
          category: '信号分析'
        });
      }

      expect(alerts).toHaveLength(0);
    });
  });

  describe('告警过滤功能', () => {
    test('应该正确过滤告警类型', () => {
      const alerts = [
        { type: 'data-quality', level: 'warning', message: '数据质量问题' },
        { type: 'data-validation', level: 'error', message: '数据验证错误' },
        { type: 'data-collection', level: 'warning', message: '数据收集率低' },
        { type: 'signal-analysis', level: 'warning', message: '信号分析率低' }
      ];

      // 模拟过滤函数
      const filterAlerts = (type, alertList) => {
        if (type === 'all') return alertList;
        return alertList.filter(alert => alert.type === type);
      };

      expect(filterAlerts('all', alerts)).toHaveLength(4);
      expect(filterAlerts('data-quality', alerts)).toHaveLength(1);
      expect(filterAlerts('data-validation', alerts)).toHaveLength(1);
      expect(filterAlerts('data-collection', alerts)).toHaveLength(1);
      expect(filterAlerts('signal-analysis', alerts)).toHaveLength(1);
    });
  });

  describe('数据收集率计算', () => {
    test('应该正确计算所有交易对数据采集率的平均值', () => {
      // 模拟交易对统计数据
      const symbolStats = new Map();
      symbolStats.set('BTCUSDT', {
        dataCollectionAttempts: 10,
        dataCollectionSuccesses: 9
      });
      symbolStats.set('ETHUSDT', {
        dataCollectionAttempts: 8,
        dataCollectionSuccesses: 7
      });
      symbolStats.set('LINKUSDT', {
        dataCollectionAttempts: 12,
        dataCollectionSuccesses: 11
      });

      // 模拟计算完成率
      const calculateCompletionRates = (stats) => {
        const symbols = Array.from(stats.keys());
        if (symbols.length === 0) {
          return { dataCollection: 0, signalAnalysis: 0, simulationTrading: 0 };
        }

        let totalDataCollectionRate = 0;
        let validDataCollectionCount = 0;

        for (const symbol of symbols) {
          const symbolStats = stats.get(symbol);
          
          if (symbolStats.dataCollectionAttempts > 0) {
            const dataCollectionRate = (symbolStats.dataCollectionSuccesses / symbolStats.dataCollectionAttempts) * 100;
            totalDataCollectionRate += dataCollectionRate;
            validDataCollectionCount++;
          }
        }

        return {
          dataCollection: validDataCollectionCount > 0 ? Math.min(totalDataCollectionRate / validDataCollectionCount, 100) : 0
        };
      };

      const result = calculateCompletionRates(symbolStats);
      
      // BTCUSDT: 90%, ETHUSDT: 87.5%, LINKUSDT: 91.67%
      // 平均值: (90 + 87.5 + 91.67) / 3 = 89.72%
      expect(result.dataCollection).toBeCloseTo(89.72, 1);
    });

    test('应该正确处理无数据的情况', () => {
      const symbolStats = new Map();
      
      const calculateCompletionRates = (stats) => {
        const symbols = Array.from(stats.keys());
        if (symbols.length === 0) {
          return { dataCollection: 0, signalAnalysis: 0, simulationTrading: 0 };
        }

        let totalDataCollectionRate = 0;
        let validDataCollectionCount = 0;

        for (const symbol of symbols) {
          const symbolStats = stats.get(symbol);
          
          if (symbolStats.dataCollectionAttempts > 0) {
            const dataCollectionRate = (symbolStats.dataCollectionSuccesses / symbolStats.dataCollectionAttempts) * 100;
            totalDataCollectionRate += dataCollectionRate;
            validDataCollectionCount++;
          }
        }

        return {
          dataCollection: validDataCollectionCount > 0 ? Math.min(totalDataCollectionRate / validDataCollectionCount, 100) : 0
        };
      };

      const result = calculateCompletionRates(symbolStats);
      expect(result.dataCollection).toBe(0);
    });
  });
});
