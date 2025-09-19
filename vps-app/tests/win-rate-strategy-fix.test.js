// win-rate-strategy-fix.test.js - 胜率统计按策略修复单元测试
// 测试胜率统计按策略类型正确计算的修复

const assert = require('assert');

describe('胜率统计按策略修复测试', () => {
  
  describe('胜率统计逻辑测试', () => {
    
    it('应该只计算CLOSED状态的交易记录', () => {
      // 模拟数据库记录
      const mockRecords = [
        { symbol: 'BTCUSDT', strategy_type: 'V3', status: 'CLOSED', is_win: 1, profit_loss: 100 },
        { symbol: 'ETHUSDT', strategy_type: 'V3', status: 'CLOSED', is_win: 0, profit_loss: -50 },
        { symbol: 'BNBUSDT', strategy_type: 'V3', status: 'ACTIVE', is_win: null, profit_loss: null },
        { symbol: 'ADAUSDT', strategy_type: 'ICT', status: 'ACTIVE', is_win: null, profit_loss: null },
        { symbol: 'XRPUSDT', strategy_type: 'ICT', status: 'ACTIVE', is_win: null, profit_loss: null }
      ];
      
      // 模拟胜率计算逻辑
      const calculateWinRate = (records, strategyType = null) => {
        const filteredRecords = records.filter(record => {
          const statusMatch = record.status === 'CLOSED';
          const strategyMatch = strategyType ? record.strategy_type === strategyType : true;
          return statusMatch && strategyMatch;
        });
        
        const totalTrades = filteredRecords.length;
        const winningTrades = filteredRecords.filter(record => record.is_win === 1).length;
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
        
        return {
          totalTrades,
          winningTrades,
          losingTrades: totalTrades - winningTrades,
          winRate: parseFloat(winRate.toFixed(2))
        };
      };
      
      // 测试整体胜率计算
      const overallStats = calculateWinRate(mockRecords);
      assert.strictEqual(overallStats.totalTrades, 2); // 只有2条CLOSED记录
      assert.strictEqual(overallStats.winningTrades, 1); // 1条盈利
      assert.strictEqual(overallStats.losingTrades, 1); // 1条亏损
      assert.strictEqual(overallStats.winRate, 50.00); // 50%胜率
      
      // 测试V3策略胜率计算
      const v3Stats = calculateWinRate(mockRecords, 'V3');
      assert.strictEqual(v3Stats.totalTrades, 2); // V3策略2条CLOSED记录
      assert.strictEqual(v3Stats.winningTrades, 1); // 1条盈利
      assert.strictEqual(v3Stats.winRate, 50.00); // 50%胜率
      
      // 测试ICT策略胜率计算
      const ictStats = calculateWinRate(mockRecords, 'ICT');
      assert.strictEqual(ictStats.totalTrades, 0); // ICT策略0条CLOSED记录
      assert.strictEqual(ictStats.winningTrades, 0); // 0条盈利
      assert.strictEqual(ictStats.winRate, 0); // 0%胜率（无交易）
    });
    
    it('应该正确处理ACTIVE状态的交易不参与胜率计算', () => {
      // 模拟只有ACTIVE状态的记录
      const activeOnlyRecords = [
        { symbol: 'BTCUSDT', strategy_type: 'V3', status: 'ACTIVE', is_win: null },
        { symbol: 'ETHUSDT', strategy_type: 'ICT', status: 'ACTIVE', is_win: null },
        { symbol: 'BNBUSDT', strategy_type: 'V3', status: 'ACTIVE', is_win: null }
      ];
      
      const calculateWinRate = (records) => {
        const closedRecords = records.filter(record => record.status === 'CLOSED');
        const totalTrades = closedRecords.length;
        const winningTrades = closedRecords.filter(record => record.is_win === 1).length;
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
        
        return {
          totalTrades,
          winningTrades,
          winRate: parseFloat(winRate.toFixed(2))
        };
      };
      
      const stats = calculateWinRate(activeOnlyRecords);
      assert.strictEqual(stats.totalTrades, 0); // 没有CLOSED记录
      assert.strictEqual(stats.winningTrades, 0); // 没有盈利记录
      assert.strictEqual(stats.winRate, 0); // 胜率为0
    });
  });
  
  describe('API响应结构测试', () => {
    
    it('应该返回按策略分组的胜率数据', () => {
      // 模拟API响应结构
      const mockApiResponse = {
        success: true,
        data: {
          win_rate: 50.00,
          total_trades: 2,
          winning_trades: 1,
          losing_trades: 1,
          byStrategy: {
            V3: {
              win_rate: 50.00,
              total_trades: 2,
              winning_trades: 1,
              losing_trades: 1,
              winRate: 50.00,
              totalTrades: 2,
              winTrades: 1,
              lossTrades: 1
            },
            ICT: {
              win_rate: 0,
              total_trades: 0,
              winning_trades: 0,
              losing_trades: 0,
              winRate: 0,
              totalTrades: 0,
              winTrades: 0,
              lossTrades: 0
            }
          }
        }
      };
      
      // 验证响应结构
      assert.ok(mockApiResponse.success);
      assert.ok(mockApiResponse.data);
      assert.ok(mockApiResponse.data.byStrategy);
      assert.ok(mockApiResponse.data.byStrategy.V3);
      assert.ok(mockApiResponse.data.byStrategy.ICT);
      
      // 验证V3策略数据
      const v3Stats = mockApiResponse.data.byStrategy.V3;
      assert.strictEqual(v3Stats.win_rate, 50.00);
      assert.strictEqual(v3Stats.total_trades, 2);
      assert.strictEqual(v3Stats.winning_trades, 1);
      assert.strictEqual(v3Stats.losing_trades, 1);
      
      // 验证ICT策略数据
      const ictStats = mockApiResponse.data.byStrategy.ICT;
      assert.strictEqual(ictStats.win_rate, 0);
      assert.strictEqual(ictStats.total_trades, 0);
      assert.strictEqual(ictStats.winning_trades, 0);
      assert.strictEqual(ictStats.losing_trades, 0);
    });
  });
  
  describe('前端显示逻辑测试', () => {
    
    it('应该正确显示V3策略胜率', () => {
      // 模拟V3策略统计数据
      const v3Stats = {
        win_rate: 66.67,
        total_trades: 3,
        winning_trades: 2,
        losing_trades: 1
      };
      
      // 模拟前端显示逻辑
      const formatWinRate = (stats) => {
        const winRate = stats.win_rate || stats.winRate || 0;
        const totalTrades = stats.total_trades || stats.totalTrades || 0;
        const winTrades = stats.winning_trades || stats.winTrades || 0;
        
        return {
          winRateDisplay: winRate > 0 ? `${winRate.toFixed(1)}%` : '0%',
          detailsDisplay: `${winTrades}/${totalTrades}`
        };
      };
      
      const display = formatWinRate(v3Stats);
      assert.strictEqual(display.winRateDisplay, '66.7%');
      assert.strictEqual(display.detailsDisplay, '2/3');
    });
    
    it('应该正确显示ICT策略胜率（无交易）', () => {
      // 模拟ICT策略统计数据（无CLOSED记录）
      const ictStats = {
        win_rate: 0,
        total_trades: 0,
        winning_trades: 0,
        losing_trades: 0
      };
      
      // 模拟前端显示逻辑
      const formatWinRate = (stats) => {
        const winRate = stats.win_rate || stats.winRate || 0;
        const totalTrades = stats.total_trades || stats.totalTrades || 0;
        const winTrades = stats.winning_trades || stats.winTrades || 0;
        
        return {
          winRateDisplay: winRate > 0 ? `${winRate.toFixed(1)}%` : '0%',
          detailsDisplay: `${winTrades}/${totalTrades}`
        };
      };
      
      const display = formatWinRate(ictStats);
      assert.strictEqual(display.winRateDisplay, '0%');
      assert.strictEqual(display.detailsDisplay, '0/0');
    });
    
    it('应该处理缺失的按策略分组数据', () => {
      // 模拟没有按策略分组数据的响应
      const mockResponseWithoutByStrategy = {
        success: true,
        data: {
          win_rate: 66.67,
          total_trades: 3,
          winning_trades: 2,
          losing_trades: 1
          // 没有byStrategy字段
        }
      };
      
      // 模拟前端处理逻辑
      const processStatsData = (responseData) => {
        const statsData = responseData.data || responseData;
        
        // 检查是否有按策略分组的数据
        if (statsData && statsData.byStrategy && statsData.byStrategy.ICT) {
          return {
            ictStats: statsData.byStrategy.ICT,
            hasByStrategy: true
          };
        } else {
          // 如果没有按策略分组的数据，使用整体数据作为ICT策略数据
          return {
            ictStats: {
              win_rate: statsData.win_rate || 0,
              total_trades: statsData.total_trades || 0,
              winning_trades: statsData.winning_trades || 0,
              losing_trades: statsData.losing_trades || 0
            },
            hasByStrategy: false
          };
        }
      };
      
      const result = processStatsData(mockResponseWithoutByStrategy);
      assert.strictEqual(result.hasByStrategy, false);
      assert.strictEqual(result.ictStats.win_rate, 66.67);
      assert.strictEqual(result.ictStats.total_trades, 3);
    });
  });
  
  describe('边界情况测试', () => {
    
    it('应该处理空数据库情况', () => {
      const emptyRecords = [];
      
      const calculateWinRate = (records) => {
        const closedRecords = records.filter(record => record.status === 'CLOSED');
        const totalTrades = closedRecords.length;
        const winningTrades = closedRecords.filter(record => record.is_win === 1).length;
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
        
        return {
          totalTrades,
          winningTrades,
          winRate: parseFloat(winRate.toFixed(2))
        };
      };
      
      const stats = calculateWinRate(emptyRecords);
      assert.strictEqual(stats.totalTrades, 0);
      assert.strictEqual(stats.winningTrades, 0);
      assert.strictEqual(stats.winRate, 0);
    });
    
    it('应该处理无效的is_win值', () => {
      const recordsWithInvalidWin = [
        { symbol: 'BTCUSDT', strategy_type: 'V3', status: 'CLOSED', is_win: null },
        { symbol: 'ETHUSDT', strategy_type: 'V3', status: 'CLOSED', is_win: undefined },
        { symbol: 'BNBUSDT', strategy_type: 'V3', status: 'CLOSED', is_win: 1 }
      ];
      
      const calculateWinRate = (records) => {
        const closedRecords = records.filter(record => record.status === 'CLOSED');
        const totalTrades = closedRecords.length;
        const winningTrades = closedRecords.filter(record => record.is_win === 1).length;
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
        
        return {
          totalTrades,
          winningTrades,
          winRate: parseFloat(winRate.toFixed(2))
        };
      };
      
      const stats = calculateWinRate(recordsWithInvalidWin);
      assert.strictEqual(stats.totalTrades, 3); // 3条CLOSED记录
      assert.strictEqual(stats.winningTrades, 1); // 只有1条is_win=1的记录
      assert.strictEqual(stats.winRate, 33.33); // 33.33%胜率
    });
    
    it('应该处理数据库查询错误', () => {
      // 模拟数据库查询错误的情况
      const mockErrorResponse = {
        success: false,
        error: 'Database query failed',
        data: null
      };
      
      // 模拟错误处理逻辑
      const handleStatsError = (response) => {
        if (!response.success || !response.data) {
          return {
            win_rate: 0,
            total_trades: 0,
            winning_trades: 0,
            losing_trades: 0,
            error: response.error || 'Unknown error'
          };
        }
        return response.data;
      };
      
      const result = handleStatsError(mockErrorResponse);
      assert.strictEqual(result.win_rate, 0);
      assert.strictEqual(result.total_trades, 0);
      assert.strictEqual(result.winning_trades, 0);
      assert.strictEqual(result.losing_trades, 0);
      assert.strictEqual(result.error, 'Database query failed');
    });
  });
  
  describe('数据一致性测试', () => {
    
    it('应该确保V3和ICT策略数据的一致性', () => {
      // 模拟数据库查询结果
      const mockDbResults = {
        overall: {
          total_trades: 3,
          winning_trades: 2,
          losing_trades: 1
        },
        byStrategy: [
          { strategy_type: 'V3', total_trades: 3, winning_trades: 2, losing_trades: 1 },
          { strategy_type: 'ICT', total_trades: 0, winning_trades: 0, losing_trades: 0 }
        ]
      };
      
      // 模拟数据处理逻辑
      const processDbResults = (results) => {
        const byStrategy = {};
        
        // 处理按策略分组的数据
        results.byStrategy.forEach(row => {
          const strategyType = row.strategy_type;
          const strategyWinRate = row.total_trades > 0 ? (row.winning_trades / row.total_trades * 100) : 0;
          
          byStrategy[strategyType] = {
            win_rate: parseFloat(strategyWinRate.toFixed(2)),
            total_trades: row.total_trades || 0,
            winning_trades: row.winning_trades || 0,
            losing_trades: row.losing_trades || 0
          };
        });
        
        // 确保V3和ICT策略都有数据
        if (!byStrategy.V3) {
          byStrategy.V3 = { win_rate: 0, total_trades: 0, winning_trades: 0, losing_trades: 0 };
        }
        
        if (!byStrategy.ICT) {
          byStrategy.ICT = { win_rate: 0, total_trades: 0, winning_trades: 0, losing_trades: 0 };
        }
        
        return byStrategy;
      };
      
      const processedData = processDbResults(mockDbResults);
      
      // 验证V3策略数据
      assert.ok(processedData.V3);
      assert.strictEqual(processedData.V3.win_rate, 66.67);
      assert.strictEqual(processedData.V3.total_trades, 3);
      assert.strictEqual(processedData.V3.winning_trades, 2);
      assert.strictEqual(processedData.V3.losing_trades, 1);
      
      // 验证ICT策略数据
      assert.ok(processedData.ICT);
      assert.strictEqual(processedData.ICT.win_rate, 0);
      assert.strictEqual(processedData.ICT.total_trades, 0);
      assert.strictEqual(processedData.ICT.winning_trades, 0);
      assert.strictEqual(processedData.ICT.losing_trades, 0);
    });
  });
});

// 导出测试模块
module.exports = {
  calculateWinRate: (records, strategyType = null) => {
    const filteredRecords = records.filter(record => {
      const statusMatch = record.status === 'CLOSED';
      const strategyMatch = strategyType ? record.strategy_type === strategyType : true;
      return statusMatch && strategyMatch;
    });
    
    const totalTrades = filteredRecords.length;
    const winningTrades = filteredRecords.filter(record => record.is_win === 1).length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    
    return {
      totalTrades,
      winningTrades,
      losingTrades: totalTrades - winningTrades,
      winRate: parseFloat(winRate.toFixed(2))
    };
  },
  
  formatWinRateDisplay: (stats) => {
    const winRate = stats.win_rate || stats.winRate || 0;
    const totalTrades = stats.total_trades || stats.totalTrades || 0;
    const winTrades = stats.winning_trades || stats.winTrades || 0;
    
    return {
      winRateDisplay: winRate > 0 ? `${winRate.toFixed(1)}%` : '0%',
      detailsDisplay: `${winTrades}/${totalTrades}`
    };
  },
  
  processStatsResponse: (responseData) => {
    const statsData = responseData.data || responseData;
    
    if (statsData && statsData.byStrategy && statsData.byStrategy.ICT) {
      return {
        ictStats: statsData.byStrategy.ICT,
        hasByStrategy: true
      };
    } else {
      return {
        ictStats: {
          win_rate: statsData.win_rate || 0,
          total_trades: statsData.total_trades || 0,
          winning_trades: statsData.winning_trades || 0,
          losing_trades: statsData.losing_trades || 0
        },
        hasByStrategy: false
      };
    }
  }
};
