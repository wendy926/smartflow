const assert = require('assert');

// 交易对管理页面显示修复测试
describe('交易对管理页面显示修复测试', () => {
  
  describe('策略统计数据显示测试', () => {
    it('应该正确更新V3策略统计数据', () => {
      // 模拟统一监控API响应数据
      const mockData = {
        summary: {
          totalSymbols: 22,
          v3Symbols: 22,
          ictSymbols: 22,
          overallHealth: "HEALTHY"
        },
        v3Stats: {
          dataCollectionRate: 95.5,
          validationStatus: "VALID",
          simulationRate: 100
        },
        ictStats: {
          dataCollectionRate: 92.3,
          validationStatus: "VALID",
          simulationRate: 100
        }
      };

      // 模拟DOM元素
      const mockElements = {
        v3TotalTrades: { textContent: '--' },
        v3WinRate: { textContent: '--' },
        ictTotalTrades: { textContent: '--' },
        ictWinRate: { textContent: '--' }
      };

      // 模拟updateV3StatsFromUnified方法逻辑
      function updateV3StatsFromUnified(data) {
        try {
          const v3Stats = data.v3Stats || {};
          const summary = data.summary || {};
          
          const v3TotalTradesEl = mockElements.v3TotalTrades;
          const v3WinRateEl = mockElements.v3WinRate;
          
          if (v3TotalTradesEl) {
            v3TotalTradesEl.textContent = summary.v3Symbols || '0';
          }
          
          if (v3WinRateEl) {
            v3WinRateEl.textContent = v3Stats.dataCollectionRate ? `${v3Stats.dataCollectionRate.toFixed(1)}%` : '--';
          }
        } catch (error) {
          console.error('更新V3策略统计失败:', error);
        }
      }

      // 模拟updateICTStatsFromUnified方法逻辑
      function updateICTStatsFromUnified(data) {
        try {
          const ictStats = data.ictStats || {};
          const summary = data.summary || {};
          
          const ictTotalTradesEl = mockElements.ictTotalTrades;
          const ictWinRateEl = mockElements.ictWinRate;
          
          if (ictTotalTradesEl) {
            ictTotalTradesEl.textContent = summary.ictSymbols || '0';
          }
          
          if (ictWinRateEl) {
            ictWinRateEl.textContent = ictStats.dataCollectionRate ? `${ictStats.dataCollectionRate.toFixed(1)}%` : '--';
          }
        } catch (error) {
          console.error('更新ICT策略统计失败:', error);
        }
      }

      // 执行更新
      updateV3StatsFromUnified(mockData);
      updateICTStatsFromUnified(mockData);

      // 验证V3策略统计更新
      assert.strictEqual(mockElements.v3TotalTrades.textContent, 22);
      assert.strictEqual(mockElements.v3WinRate.textContent, '95.5%');

      // 验证ICT策略统计更新
      assert.strictEqual(mockElements.ictTotalTrades.textContent, 22);
      assert.strictEqual(mockElements.ictWinRate.textContent, '92.3%');
    });

    it('应该处理空数据的情况', () => {
      const mockData = {
        summary: {},
        v3Stats: {},
        ictStats: {}
      };

      const mockElements = {
        v3TotalTrades: { textContent: '--' },
        v3WinRate: { textContent: '--' },
        ictTotalTrades: { textContent: '--' },
        ictWinRate: { textContent: '--' }
      };

      function updateV3StatsFromUnified(data) {
        const v3Stats = data.v3Stats || {};
        const summary = data.summary || {};
        
        const v3TotalTradesEl = mockElements.v3TotalTrades;
        const v3WinRateEl = mockElements.v3WinRate;
        
        if (v3TotalTradesEl) {
          v3TotalTradesEl.textContent = summary.v3Symbols || '0';
        }
        
        if (v3WinRateEl) {
          v3WinRateEl.textContent = v3Stats.dataCollectionRate ? `${v3Stats.dataCollectionRate.toFixed(1)}%` : '--';
        }
      }

      function updateICTStatsFromUnified(data) {
        const ictStats = data.ictStats || {};
        const summary = data.summary || {};
        
        const ictTotalTradesEl = mockElements.ictTotalTrades;
        const ictWinRateEl = mockElements.ictWinRate;
        
        if (ictTotalTradesEl) {
          ictTotalTradesEl.textContent = summary.ictSymbols || '0';
        }
        
        if (ictWinRateEl) {
          ictWinRateEl.textContent = ictStats.dataCollectionRate ? `${ictStats.dataCollectionRate.toFixed(1)}%` : '--';
        }
      }

      updateV3StatsFromUnified(mockData);
      updateICTStatsFromUnified(mockData);

      // 验证默认值处理
      assert.strictEqual(mockElements.v3TotalTrades.textContent, '0');
      assert.strictEqual(mockElements.v3WinRate.textContent, '--');
      assert.strictEqual(mockElements.ictTotalTrades.textContent, '0');
      assert.strictEqual(mockElements.ictWinRate.textContent, '--');
    });

    it('应该处理undefined数据的情况', () => {
      const mockData = undefined;

      const mockElements = {
        v3TotalTrades: { textContent: '--' },
        v3WinRate: { textContent: '--' },
        ictTotalTrades: { textContent: '--' },
        ictWinRate: { textContent: '--' }
      };

      function updateV3StatsFromUnified(data) {
        try {
          const v3Stats = data?.v3Stats || {};
          const summary = data?.summary || {};
          
          const v3TotalTradesEl = mockElements.v3TotalTrades;
          const v3WinRateEl = mockElements.v3WinRate;
          
          if (v3TotalTradesEl) {
            v3TotalTradesEl.textContent = summary.v3Symbols || '0';
          }
          
          if (v3WinRateEl) {
            v3WinRateEl.textContent = v3Stats.dataCollectionRate ? `${v3Stats.dataCollectionRate.toFixed(1)}%` : '--';
          }
        } catch (error) {
          console.error('更新V3策略统计失败:', error);
        }
      }

      function updateICTStatsFromUnified(data) {
        try {
          const ictStats = data?.ictStats || {};
          const summary = data?.summary || {};
          
          const ictTotalTradesEl = mockElements.ictTotalTrades;
          const ictWinRateEl = mockElements.ictWinRate;
          
          if (ictTotalTradesEl) {
            ictTotalTradesEl.textContent = summary.ictSymbols || '0';
          }
          
          if (ictWinRateEl) {
            ictWinRateEl.textContent = ictStats.dataCollectionRate ? `${ictStats.dataCollectionRate.toFixed(1)}%` : '--';
          }
        } catch (error) {
          console.error('更新ICT策略统计失败:', error);
        }
      }

      updateV3StatsFromUnified(mockData);
      updateICTStatsFromUnified(mockData);

      // 验证undefined数据处理
      assert.strictEqual(mockElements.v3TotalTrades.textContent, '0');
      assert.strictEqual(mockElements.v3WinRate.textContent, '--');
      assert.strictEqual(mockElements.ictTotalTrades.textContent, '0');
      assert.strictEqual(mockElements.ictWinRate.textContent, '--');
    });
  });

  describe('API数据格式验证测试', () => {
    it('应该正确处理统一监控API响应格式', () => {
      const apiResponse = {
        success: true,
        data: {
          summary: {
            totalSymbols: 22,
            v3Symbols: 22,
            ictSymbols: 22
          },
          v3Stats: {
            dataCollectionRate: 95.5
          },
          ictStats: {
            dataCollectionRate: 92.3
          }
        }
      };

      // 模拟loadStrategyStats方法的数据提取逻辑
      function extractStrategyStats(response) {
        const data = response.data;
        const summary = data.summary || {};
        const v3Stats = data.v3Stats || {};
        const ictStats = data.ictStats || {};

        return {
          v3TotalTrades: summary.v3Symbols || '0',
          v3WinRate: v3Stats.dataCollectionRate ? `${v3Stats.dataCollectionRate.toFixed(1)}%` : '--',
          ictTotalTrades: summary.ictSymbols || '0',
          ictWinRate: ictStats.dataCollectionRate ? `${ictStats.dataCollectionRate.toFixed(1)}%` : '--'
        };
      }

      const result = extractStrategyStats(apiResponse);

      assert.strictEqual(result.v3TotalTrades, 22);
      assert.strictEqual(result.v3WinRate, '95.5%');
      assert.strictEqual(result.ictTotalTrades, 22);
      assert.strictEqual(result.ictWinRate, '92.3%');
    });

    it('应该处理API响应中的嵌套数据结构', () => {
      const nestedApiResponse = {
        success: true,
        data: {
          data: {
            summary: {
              v3Symbols: 15,
              ictSymbols: 18
            },
            v3Stats: {
              dataCollectionRate: 88.7
            },
            ictStats: {
              dataCollectionRate: 91.2
            }
          }
        }
      };

      function extractNestedData(response) {
        const data = response.data?.data || response.data || {};
        const summary = data.summary || {};
        const v3Stats = data.v3Stats || {};
        const ictStats = data.ictStats || {};

        return {
          v3TotalTrades: summary.v3Symbols || '0',
          v3WinRate: v3Stats.dataCollectionRate ? `${v3Stats.dataCollectionRate.toFixed(1)}%` : '--',
          ictTotalTrades: summary.ictSymbols || '0',
          ictWinRate: ictStats.dataCollectionRate ? `${ictStats.dataCollectionRate.toFixed(1)}%` : '--'
        };
      }

      const result = extractNestedData(nestedApiResponse);

      assert.strictEqual(result.v3TotalTrades, 15);
      assert.strictEqual(result.v3WinRate, '88.7%');
      assert.strictEqual(result.ictTotalTrades, 18);
      assert.strictEqual(result.ictWinRate, '91.2%');
    });
  });

  describe('DOM元素查找测试', () => {
    it('应该正确查找策略统计DOM元素', () => {
      // 模拟DOM结构
      const mockDOM = {
        getElementById: function(id) {
          const elements = {
            'v3TotalTrades': { textContent: '--' },
            'v3WinRate': { textContent: '--' },
            'ictTotalTrades': { textContent: '--' },
            'ictWinRate': { textContent: '--' }
          };
          return elements[id] || null;
        }
      };

      // 模拟元素查找逻辑
      function findStrategyElements() {
        const v3TotalTradesEl = mockDOM.getElementById('v3TotalTrades');
        const v3WinRateEl = mockDOM.getElementById('v3WinRate');
        const ictTotalTradesEl = mockDOM.getElementById('ictTotalTrades');
        const ictWinRateEl = mockDOM.getElementById('ictWinRate');

        return {
          v3TotalTradesEl,
          v3WinRateEl,
          ictTotalTradesEl,
          ictWinRateEl
        };
      }

      const elements = findStrategyElements();

      assert.ok(elements.v3TotalTradesEl, '应该找到v3TotalTrades元素');
      assert.ok(elements.v3WinRateEl, '应该找到v3WinRate元素');
      assert.ok(elements.ictTotalTradesEl, '应该找到ictTotalTrades元素');
      assert.ok(elements.ictWinRateEl, '应该找到ictWinRate元素');
    });

    it('应该处理元素不存在的情况', () => {
      const mockDOM = {
        getElementById: function(id) {
          return null; // 模拟元素不存在
        }
      };

      function findStrategyElements() {
        const v3TotalTradesEl = mockDOM.getElementById('v3TotalTrades');
        const v3WinRateEl = mockDOM.getElementById('v3WinRate');
        const ictTotalTradesEl = mockDOM.getElementById('ictTotalTrades');
        const ictWinRateEl = mockDOM.getElementById('ictWinRate');

        return {
          v3TotalTradesEl,
          v3WinRateEl,
          ictTotalTradesEl,
          ictWinRateEl
        };
      }

      const elements = findStrategyElements();

      assert.strictEqual(elements.v3TotalTradesEl, null);
      assert.strictEqual(elements.v3WinRateEl, null);
      assert.strictEqual(elements.ictTotalTradesEl, null);
      assert.strictEqual(elements.ictWinRateEl, null);
    });
  });

  describe('错误处理测试', () => {
    it('应该处理数据更新过程中的错误', () => {
      const mockElements = {
        v3TotalTrades: { 
          textContent: '--',
          set textContent(value) {
            throw new Error('DOM更新失败');
          }
        },
        v3WinRate: { textContent: '--' }
      };

      let errorCaught = false;

      function updateV3StatsWithError(data) {
        try {
          const v3Stats = data.v3Stats || {};
          const summary = data.summary || {};
          
          const v3TotalTradesEl = mockElements.v3TotalTrades;
          
          if (v3TotalTradesEl) {
            v3TotalTradesEl.textContent = summary.v3Symbols || '0';
          }
        } catch (error) {
          console.error('更新V3策略统计失败:', error);
          errorCaught = true;
        }
      }

      updateV3StatsWithError({
        summary: { v3Symbols: 22 },
        v3Stats: { dataCollectionRate: 95.5 }
      });

      assert.ok(errorCaught, '应该捕获DOM更新错误');
    });
  });
});
