// strategy-display-fixes.test.js - 策略显示修复单元测试
// 测试V3策略胜率显示和ICT策略时间框架更新的修复

const assert = require('assert');

describe('策略显示修复测试', () => {
  
  describe('V3策略胜率显示修复', () => {
    
    it('应该正确处理API响应结构 - 有data字段', () => {
      // 模拟API响应结构
      const apiResponse = {
        success: true,
        data: {
          winRate: 66.67,
          totalTrades: 3,
          winningTrades: 2,
          losingTrades: 1
        }
      };
      
      // 模拟前端处理逻辑
      const statsData = apiResponse && apiResponse.data ? apiResponse.data : apiResponse;
      
      assert.strictEqual(statsData.winRate, 66.67);
      assert.strictEqual(statsData.totalTrades, 3);
      assert.strictEqual(statsData.winningTrades, 2);
      assert.strictEqual(statsData.losingTrades, 1);
    });
    
    it('应该正确处理API响应结构 - 无data字段', () => {
      // 模拟直接返回数据的情况
      const apiResponse = {
        winRate: 75.5,
        totalTrades: 4,
        winningTrades: 3,
        losingTrades: 1
      };
      
      // 模拟前端处理逻辑
      const statsData = apiResponse && apiResponse.data ? apiResponse.data : apiResponse;
      
      assert.strictEqual(statsData.winRate, 75.5);
      assert.strictEqual(statsData.totalTrades, 4);
    });
    
    it('应该正确处理胜率显示格式', () => {
      const winRate = 66.67;
      const displayText = winRate > 0 ? `${winRate.toFixed(1)}%` : '0%';
      
      assert.strictEqual(displayText, '66.7%');
    });
    
    it('应该正确处理零胜率显示', () => {
      const winRate = 0;
      const displayText = winRate > 0 ? `${winRate.toFixed(1)}%` : '0%';
      
      assert.strictEqual(displayText, '0%');
    });
    
    it('应该正确处理胜率详情格式', () => {
      const winningTrades = 2;
      const totalTrades = 3;
      const detailsText = `${winningTrades}/${totalTrades}`;
      
      assert.strictEqual(detailsText, '2/3');
    });
  });
  
  describe('ICT策略时间框架更新修复', () => {
    
    it('应该正确更新时间戳格式', () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('zh-CN');
      
      // 验证时间格式包含时分秒
      assert.ok(timeStr.includes(':'));
      assert.ok(timeStr.length > 5);
    });
    
    it('应该正确处理ICT信号统计', () => {
      // 模拟ICT信号数据
      const signals = [
        { symbol: 'BTCUSDT', signalType: 'BOS_LONG' },
        { symbol: 'ETHUSDT', signalType: 'MIT_SHORT' },
        { symbol: 'SOLUSDT', signalType: 'BOS_LONG' },
        { symbol: 'ADAUSDT', signalType: 'WAIT' },
        { symbol: 'TRXUSDT', signalType: 'CHoCH_LONG' }
      ];
      
      const totalSignals = signals.length;
      const longSignals = signals.filter(s => s.signalType && s.signalType.includes('LONG')).length;
      const shortSignals = signals.filter(s => s.signalType && s.signalType.includes('SHORT')).length;
      
      assert.strictEqual(totalSignals, 5);
      assert.strictEqual(longSignals, 3); // BOS_LONG, BOS_LONG, CHoCH_LONG
      assert.strictEqual(shortSignals, 1); // MIT_SHORT
    });
    
    it('应该正确处理ICT策略胜率统计 - 按策略分组', () => {
      // 模拟按策略分组的统计数据
      const statsData = {
        byStrategy: {
          ICT: {
            winRate: 80.0,
            totalTrades: 5,
            winningTrades: 4,
            losingTrades: 1
          },
          V3: {
            winRate: 66.67,
            totalTrades: 3,
            winningTrades: 2,
            losingTrades: 1
          }
        }
      };
      
      const ictStats = statsData.byStrategy.ICT;
      
      assert.strictEqual(ictStats.winRate, 80.0);
      assert.strictEqual(ictStats.totalTrades, 5);
      assert.strictEqual(ictStats.winningTrades, 4);
      assert.strictEqual(ictStats.losingTrades, 1);
    });
    
    it('应该正确处理ICT策略胜率统计 - 无按策略分组', () => {
      // 模拟整体统计数据
      const statsData = {
        winRate: 70.5,
        totalTrades: 8,
        winningTrades: 6,
        losingTrades: 2
      };
      
      // 使用整体数据作为ICT策略数据
      const ictWinRate = statsData.winRate || statsData.win_rate || 0;
      const ictTotalTrades = statsData.totalTrades || statsData.total_trades || 0;
      const ictWinTrades = statsData.winTrades || statsData.winning_trades || 0;
      
      assert.strictEqual(ictWinRate, 70.5);
      assert.strictEqual(ictTotalTrades, 8);
      assert.strictEqual(ictWinTrades, 6);
    });
  });
  
  describe('方向判断逻辑修复', () => {
    
    it('应该正确识别LONG方向信号', () => {
      const triggerReasons = [
        'ICT策略BOS_LONG信号确认',
        'V3策略多头回踩突破信号',
        'ICT策略CHoCH_LONG信号确认',
        'V3策略做多信号'
      ];
      
      triggerReasons.forEach(triggerReason => {
        const direction = triggerReason?.includes('多头') || 
                         triggerReason?.includes('做多') || 
                         triggerReason?.includes('LONG') ? 'LONG' : 'SHORT';
        
        assert.strictEqual(direction, 'LONG', `Trigger reason "${triggerReason}" should be LONG`);
      });
    });
    
    it('应该正确识别SHORT方向信号', () => {
      const triggerReasons = [
        'ICT策略BOS_SHORT信号确认',
        'V3策略空头反抽破位',
        'ICT策略MIT_SHORT信号确认',
        'V3策略做空信号'
      ];
      
      triggerReasons.forEach(triggerReason => {
        const direction = triggerReason?.includes('多头') || 
                         triggerReason?.includes('做多') || 
                         triggerReason?.includes('LONG') ? 'LONG' : 'SHORT';
        
        assert.strictEqual(direction, 'SHORT', `Trigger reason "${triggerReason}" should be SHORT`);
      });
    });
    
    it('应该处理空或未定义的triggerReason', () => {
      const triggerReasons = [null, undefined, '', ' '];
      
      triggerReasons.forEach(triggerReason => {
        const direction = triggerReason?.includes('多头') || 
                         triggerReason?.includes('做多') || 
                         triggerReason?.includes('LONG') ? 'LONG' : 'SHORT';
        
        assert.strictEqual(direction, 'SHORT', `Empty trigger reason should default to SHORT`);
      });
    });
  });
  
  describe('错误处理', () => {
    
    it('应该处理胜率统计API调用失败', async () => {
      // 模拟API调用失败
      const mockGetWinRateStats = async () => {
        throw new Error('API调用失败');
      };
      
      try {
        await mockGetWinRateStats();
        assert.fail('应该抛出错误');
      } catch (error) {
        assert.strictEqual(error.message, 'API调用失败');
      }
    });
    
    it('应该处理无效的胜率数据', () => {
      const invalidStats = [
        null,
        undefined,
        {},
        { winRate: 'invalid' },
        { totalTrades: -1 }
      ];
      
      invalidStats.forEach(stats => {
        const winRate = stats?.winRate || stats?.win_rate || 0;
        const totalTrades = stats?.totalTrades || stats?.total_trades || 0;
        const winTrades = stats?.winTrades || stats?.winning_trades || 0;
        
        // 验证默认值处理
        assert.ok(typeof winRate === 'number');
        assert.ok(typeof totalTrades === 'number');
        assert.ok(typeof winTrades === 'number');
      });
    });
  });
});

// 导出测试模块
module.exports = {
  // 可以导出一些工具函数供其他测试使用
  formatWinRate: (winRate) => winRate > 0 ? `${winRate.toFixed(1)}%` : '0%',
  formatWinRateDetails: (winTrades, totalTrades) => `${winTrades}/${totalTrades}`,
  determineDirection: (triggerReason) => 
    triggerReason?.includes('多头') || 
    triggerReason?.includes('做多') || 
    triggerReason?.includes('LONG') ? 'LONG' : 'SHORT'
};
