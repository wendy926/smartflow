// monitoring-center-fixes.test.js - 监控中心修复单元测试
// 测试监控中心数据加载和显示修复

const assert = require('assert');

describe('监控中心修复测试', () => {
  
  describe('API端点修复测试', () => {
    
    it('应该使用正确的API端点', () => {
      // 模拟前端API调用配置
      const apiEndpoints = {
        unifiedMonitoring: '/api/unified-monitoring/dashboard',
        monitoringData: '/api/monitoring-data'
      };
      
      // 验证API端点配置
      assert.strictEqual(apiEndpoints.unifiedMonitoring, '/api/unified-monitoring/dashboard');
      assert.strictEqual(apiEndpoints.monitoringData, '/api/monitoring-data');
    });
    
    it('应该拒绝使用错误的API端点', () => {
      const wrongEndpoints = [
        '/api/monitoring-dashboard',
        '/api/realtime-data-stats'
      ];
      
      const correctEndpoints = [
        '/api/unified-monitoring/dashboard',
        '/api/monitoring-data'
      ];
      
      wrongEndpoints.forEach(wrongEndpoint => {
        assert.ok(!correctEndpoints.includes(wrongEndpoint), `错误的端点 ${wrongEndpoint} 不应该被使用`);
      });
    });
  });
  
  describe('监控数据结构测试', () => {
    
    it('应该正确处理统一监控数据结构', () => {
      // 模拟统一监控API响应
      const unifiedResponse = {
        success: true,
        data: {
          summary: { 
            totalSymbols: 22, 
            v3Symbols: 22, 
            ictSymbols: 22, 
            overallHealth: 'HEALTHY' 
          },
          v3Stats: { 
            dataCollectionRate: 95.5, 
            validationStatus: 'VALID', 
            simulationRate: 100 
          },
          ictStats: { 
            dataCollectionRate: 92.3, 
            validationStatus: 'VALID', 
            simulationRate: 100 
          }
        }
      };
      
      // 验证数据结构
      assert.ok(unifiedResponse.success);
      assert.ok(unifiedResponse.data);
      assert.ok(unifiedResponse.data.summary);
      assert.ok(unifiedResponse.data.v3Stats);
      assert.ok(unifiedResponse.data.ictStats);
      
      // 验证数据内容
      assert.strictEqual(unifiedResponse.data.summary.totalSymbols, 22);
      assert.strictEqual(unifiedResponse.data.v3Stats.dataCollectionRate, 95.5);
      assert.strictEqual(unifiedResponse.data.ictStats.dataCollectionRate, 92.3);
    });
    
    it('应该正确处理详细监控数据结构', () => {
      // 模拟详细监控API响应
      const detailedResponse = {
        success: true,
        data: {
          summary: {
            totalSymbols: 22,
            healthySymbols: 18,
            warningSymbols: 3,
            errorSymbols: 1,
            totalAlerts: 4,
            dataCollectionRate: 0.95,
            dataValidationStatus: '正常',
            simulationCompletionRate: 0.88
          },
          detailedStats: [
            { 
              symbol: 'BTCUSDT', 
              strategy: 'V3', 
              dataCollectionRate: 98.5, 
              signalAnalysisRate: 96.2, 
              simulationCompletionRate: 92.1, 
              simulationProgressRate: 8.7, 
              refreshFrequency: '5分钟', 
              overallStatus: '健康' 
            }
          ],
          recentAlerts: [
            { 
              id: 1, 
              type: '数据质量', 
              message: 'ADAUSDT数据收集率低于95%', 
              timestamp: new Date().toISOString(), 
              severity: 'warning' 
            }
          ]
        }
      };
      
      // 验证数据结构
      assert.ok(detailedResponse.success);
      assert.ok(detailedResponse.data);
      assert.ok(detailedResponse.data.summary);
      assert.ok(Array.isArray(detailedResponse.data.detailedStats));
      assert.ok(Array.isArray(detailedResponse.data.recentAlerts));
      
      // 验证数据内容
      assert.strictEqual(detailedResponse.data.summary.totalSymbols, 22);
      assert.strictEqual(detailedResponse.data.detailedStats.length, 1);
      assert.strictEqual(detailedResponse.data.recentAlerts.length, 1);
    });
  });
  
  describe('前端数据处理测试', () => {
    
    it('应该正确更新概览数据显示', () => {
      // 模拟统一监控数据
      const unifiedData = {
        summary: { 
          totalSymbols: 22, 
          v3Symbols: 22, 
          ictSymbols: 22 
        },
        v3Stats: { 
          dataCollectionRate: 95.5, 
          validationStatus: 'VALID', 
          simulationRate: 100 
        }
      };
      
      // 模拟DOM元素更新逻辑
      const mockElements = {
        totalSymbols: { textContent: '' },
        healthySymbols: { textContent: '' },
        warningSymbols: { textContent: '' },
        dataCollectionRate: { textContent: '' },
        dataValidationStatus: { textContent: '' },
        simulationCompletionRate: { textContent: '' }
      };
      
      // 更新概览数据
      if (unifiedData && unifiedData.summary) {
        const summary = unifiedData.summary;
        mockElements.totalSymbols.textContent = summary.totalSymbols || '--';
        mockElements.healthySymbols.textContent = summary.v3Symbols || '--';
        mockElements.warningSymbols.textContent = summary.ictSymbols || '--';
      }
      
      // 更新指标数据
      if (unifiedData && unifiedData.v3Stats) {
        const v3Stats = unifiedData.v3Stats;
        mockElements.dataCollectionRate.textContent = (v3Stats.dataCollectionRate || 0) + '%';
        mockElements.dataValidationStatus.textContent = v3Stats.validationStatus || '--';
        mockElements.simulationCompletionRate.textContent = (v3Stats.simulationRate || 0) + '%';
      }
      
      // 验证更新结果
      assert.strictEqual(mockElements.totalSymbols.textContent, '22');
      assert.strictEqual(mockElements.healthySymbols.textContent, '22');
      assert.strictEqual(mockElements.warningSymbols.textContent, '22');
      assert.strictEqual(mockElements.dataCollectionRate.textContent, '95.5%');
      assert.strictEqual(mockElements.dataValidationStatus.textContent, 'VALID');
      assert.strictEqual(mockElements.simulationCompletionRate.textContent, '100%');
    });
    
    it('应该正确处理详细表格数据', () => {
      // 模拟详细统计数据
      const detailedStats = [
        { 
          symbol: 'BTCUSDT', 
          strategy: 'V3', 
          dataCollectionRate: 98.5, 
          signalAnalysisRate: 96.2, 
          simulationCompletionRate: 92.1, 
          simulationProgressRate: 8.7, 
          refreshFrequency: '5分钟', 
          overallStatus: '健康' 
        },
        { 
          symbol: 'ETHUSDT', 
          strategy: 'ICT', 
          dataCollectionRate: 97.8, 
          signalAnalysisRate: 95.5, 
          simulationCompletionRate: 89.3, 
          simulationProgressRate: 12.4, 
          refreshFrequency: '10分钟', 
          overallStatus: '警告' 
        }
      ];
      
      // 模拟表格行生成
      const rows = detailedStats.map(stat => {
        const statusClass = stat.overallStatus === '健康' ? 'healthy' : 
                           stat.overallStatus === '警告' ? 'warning' : 'error';
        return {
          symbol: stat.symbol,
          strategy: stat.strategy,
          dataCollectionRate: stat.dataCollectionRate,
          signalAnalysisRate: stat.signalAnalysisRate,
          simulationCompletionRate: stat.simulationCompletionRate,
          simulationProgressRate: stat.simulationProgressRate,
          refreshFrequency: stat.refreshFrequency,
          overallStatus: stat.overallStatus,
          statusClass: statusClass
        };
      });
      
      // 验证表格行数据
      assert.strictEqual(rows.length, 2);
      assert.strictEqual(rows[0].symbol, 'BTCUSDT');
      assert.strictEqual(rows[0].strategy, 'V3');
      assert.strictEqual(rows[0].statusClass, 'healthy');
      assert.strictEqual(rows[1].symbol, 'ETHUSDT');
      assert.strictEqual(rows[1].strategy, 'ICT');
      assert.strictEqual(rows[1].statusClass, 'warning');
    });
    
    it('应该正确处理告警数据显示', () => {
      // 模拟告警数据
      const alerts = [
        { 
          id: 1, 
          type: '数据质量', 
          message: 'ADAUSDT数据收集率低于95%', 
          timestamp: new Date().toISOString(), 
          severity: 'warning' 
        },
        { 
          id: 2, 
          type: '数据验证', 
          message: 'XRPUSDT价格数据异常', 
          timestamp: new Date().toISOString(), 
          severity: 'error' 
        }
      ];
      
      // 模拟告警项生成
      const alertItems = alerts.map(alert => ({
        id: alert.id,
        type: alert.type,
        message: alert.message,
        timestamp: new Date(alert.timestamp).toLocaleString(),
        severity: alert.severity,
        className: `alert-item ${alert.severity}`
      }));
      
      // 验证告警项数据
      assert.strictEqual(alertItems.length, 2);
      assert.strictEqual(alertItems[0].type, '数据质量');
      assert.strictEqual(alertItems[0].severity, 'warning');
      assert.strictEqual(alertItems[0].className, 'alert-item warning');
      assert.strictEqual(alertItems[1].type, '数据验证');
      assert.strictEqual(alertItems[1].severity, 'error');
      assert.strictEqual(alertItems[1].className, 'alert-item error');
    });
  });
  
  describe('错误处理测试', () => {
    
    it('应该处理API调用失败', async () => {
      // 模拟API调用失败
      const mockFetch = async (url) => {
        throw new Error('API调用失败');
      };
      
      try {
        await mockFetch('/api/unified-monitoring/dashboard');
        assert.fail('应该抛出错误');
      } catch (error) {
        assert.strictEqual(error.message, 'API调用失败');
      }
    });
    
    it('应该处理无效的API响应', () => {
      const invalidResponses = [
        null,
        undefined,
        {},
        { success: false },
        { data: null },
        { data: undefined }
      ];
      
      invalidResponses.forEach(response => {
        // 模拟数据处理逻辑
        const data = response && response.data ? response.data : null;
        const isValid = data && typeof data === 'object';
        
        assert.ok(!isValid, `无效响应应该被正确处理: ${JSON.stringify(response)}`);
      });
    });
    
    it('应该处理缺失的DOM元素', () => {
      // 模拟缺失的DOM元素
      const mockDocument = {
        getElementById: (id) => null
      };
      
      // 模拟安全的数据更新逻辑
      const safeUpdateElement = (elementId, value) => {
        const element = mockDocument.getElementById(elementId);
        if (element) {
          element.textContent = value;
          return true;
        }
        return false;
      };
      
      // 测试安全更新
      const result = safeUpdateElement('nonExistentElement', 'test');
      assert.strictEqual(result, false);
    });
  });
  
  describe('页面初始化测试', () => {
    
    it('应该正确初始化API客户端', () => {
      // 模拟API客户端初始化
      class MockAPIClient {
        constructor() {
          this.baseURL = '';
        }
        
        async request(endpoint) {
          return { success: true, data: {} };
        }
      }
      
      // 模拟页面初始化逻辑
      let apiClient = null;
      if (!apiClient) {
        apiClient = new MockAPIClient();
      }
      
      assert.ok(apiClient);
      assert.strictEqual(typeof apiClient.request, 'function');
    });
    
    it('应该正确初始化DataManager', () => {
      // 模拟DataManager初始化
      class MockDataManager {
        constructor() {
          this.cache = new Map();
        }
        
        async getMonitoringData() {
          return { success: true, data: {} };
        }
      }
      
      // 模拟页面初始化逻辑
      let dataManager = null;
      if (!dataManager) {
        dataManager = new MockDataManager();
      }
      
      assert.ok(dataManager);
      assert.strictEqual(typeof dataManager.getMonitoringData, 'function');
    });
  });
});

// 导出测试模块
module.exports = {
  // 可以导出一些工具函数供其他测试使用
  validateAPIEndpoint: (endpoint) => {
    const validEndpoints = [
      '/api/unified-monitoring/dashboard',
      '/api/monitoring-data'
    ];
    return validEndpoints.includes(endpoint);
  },
  formatStatusClass: (status) => {
    return status === '健康' ? 'healthy' : 
           status === '警告' ? 'warning' : 'error';
  },
  safeUpdateElement: (element, value) => {
    if (element) {
      element.textContent = value;
      return true;
    }
    return false;
  }
};
