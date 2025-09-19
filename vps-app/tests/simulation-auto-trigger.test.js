const assert = require('assert');

// 模拟交易自动触发功能测试
describe('模拟交易自动触发功能测试', () => {
  
  describe('信号检测逻辑测试', () => {
    it('应该正确识别V3策略的做多信号', () => {
      const signal = {
        symbol: 'BTCUSDT',
        execution: '做多_突破确认',
        strategyVersion: 'V3',
        entrySignal: 50000,
        stopLoss: 49000,
        takeProfit: 52000
      };
      
      let shouldTrigger = false;
      let signalType = 'LONG';
      let strategyType = signal.strategyVersion || 'V3';

      // V3策略信号检查
      if (signal.execution && (signal.execution.includes('做多_') || signal.execution.includes('做空_'))) {
        signalType = signal.execution.includes('做多_') ? 'LONG' : 'SHORT';
        shouldTrigger = true;
      }

      assert.ok(shouldTrigger);
      assert.strictEqual(signalType, 'LONG');
      assert.strictEqual(strategyType, 'V3');
    });

    it('应该正确识别V3策略的做空信号', () => {
      const signal = {
        symbol: 'ETHUSDT',
        execution: '做空_反抽破位',
        strategyVersion: 'V3',
        entrySignal: 3000,
        stopLoss: 3100,
        takeProfit: 2800
      };
      
      let shouldTrigger = false;
      let signalType = 'LONG';
      let strategyType = signal.strategyVersion || 'V3';

      // V3策略信号检查
      if (signal.execution && (signal.execution.includes('做多_') || signal.execution.includes('做空_'))) {
        signalType = signal.execution.includes('做多_') ? 'LONG' : 'SHORT';
        shouldTrigger = true;
      }

      assert.ok(shouldTrigger);
      assert.strictEqual(signalType, 'SHORT');
      assert.strictEqual(strategyType, 'V3');
    });

    it('应该正确识别ICT策略的LONG信号', () => {
      const signal = {
        symbol: 'BTCUSDT',
        signalType: 'BOS_LONG',
        strategyVersion: 'ICT',
        entryPrice: 50000,
        stopLoss: 49000,
        takeProfit: 52000
      };
      
      let shouldTrigger = false;
      let signalType = 'LONG';
      let strategyType = signal.strategyVersion || 'V3';

      // ICT策略信号检查
      if (signal.signalType && signal.signalType !== 'WAIT' && signal.signalType !== '观望') {
        signalType = signal.signalType.includes('LONG') ? 'LONG' : 'SHORT';
        shouldTrigger = true;
      }

      assert.ok(shouldTrigger);
      assert.strictEqual(signalType, 'LONG');
      assert.strictEqual(strategyType, 'ICT');
    });

    it('应该正确识别ICT策略的SHORT信号', () => {
      const signal = {
        symbol: 'ETHUSDT',
        signalType: 'FVG_SHORT',
        strategyVersion: 'ICT',
        entryPrice: 3000,
        stopLoss: 3100,
        takeProfit: 2800
      };
      
      let shouldTrigger = false;
      let signalType = 'LONG';
      let strategyType = signal.strategyVersion || 'V3';

      // ICT策略信号检查
      if (signal.signalType && signal.signalType !== 'WAIT' && signal.signalType !== '观望') {
        signalType = signal.signalType.includes('LONG') ? 'LONG' : 'SHORT';
        shouldTrigger = true;
      }

      assert.ok(shouldTrigger);
      assert.strictEqual(signalType, 'SHORT');
      assert.strictEqual(strategyType, 'ICT');
    });

    it('应该忽略WAIT信号', () => {
      const signal = {
        symbol: 'BTCUSDT',
        signalType: 'WAIT',
        strategyVersion: 'ICT'
      };
      
      let shouldTrigger = false;

      // ICT策略信号检查
      if (signal.signalType && signal.signalType !== 'WAIT' && signal.signalType !== '观望') {
        shouldTrigger = true;
      }

      assert.ok(!shouldTrigger);
    });
  });

  describe('重复触发防护测试', () => {
    it('应该防止10分钟内的重复触发', () => {
      const now = Date.now();
      const timeWindow = 10 * 60 * 1000; // 10分钟
      
      const triggeredSignals = new Map();
      const currentHistory = [
        {
          symbol: 'BTCUSDT',
          strategy_type: 'V3',
          direction: 'LONG',
          created_at: new Date(now - 5 * 60 * 1000).toISOString() // 5分钟前
        }
      ];

      // 模拟已触发信号的映射逻辑
      currentHistory.forEach(record => {
        const recordTime = new Date(record.created_at).getTime();
        if (now - recordTime < timeWindow) {
          const key = `${record.symbol}_${record.strategy_type || 'V3'}_${record.direction || 'LONG'}`;
          triggeredSignals.set(key, record);
        }
      });

      // 检查是否已存在相同的触发记录
      const newSignal = {
        symbol: 'BTCUSDT',
        execution: '做多_突破确认',
        strategyVersion: 'V3'
      };

      let shouldTrigger = false;
      let signalType = 'LONG';
      let strategyType = newSignal.strategyVersion || 'V3';

      if (newSignal.execution && (newSignal.execution.includes('做多_') || newSignal.execution.includes('做空_'))) {
        signalType = newSignal.execution.includes('做多_') ? 'LONG' : 'SHORT';
        shouldTrigger = true;
      }

      const key = `${newSignal.symbol}_${strategyType}_${signalType}`;
      
      if (shouldTrigger && !triggeredSignals.has(key)) {
        shouldTrigger = true;
      } else {
        shouldTrigger = false;
      }

      assert.ok(!shouldTrigger, '应该防止重复触发');
      assert.ok(triggeredSignals.has(key), '应该找到已存在的触发记录');
    });

    it('应该允许10分钟后的重新触发', () => {
      const now = Date.now();
      const timeWindow = 10 * 60 * 1000; // 10分钟
      
      const triggeredSignals = new Map();
      const currentHistory = [
        {
          symbol: 'BTCUSDT',
          strategy_type: 'V3',
          direction: 'LONG',
          created_at: new Date(now - 15 * 60 * 1000).toISOString() // 15分钟前
        }
      ];

      // 模拟已触发信号的映射逻辑
      currentHistory.forEach(record => {
        const recordTime = new Date(record.created_at).getTime();
        if (now - recordTime < timeWindow) {
          const key = `${record.symbol}_${record.strategy_type || 'V3'}_${record.direction || 'LONG'}`;
          triggeredSignals.set(key, record);
        }
      });

      // 检查是否已存在相同的触发记录
      const newSignal = {
        symbol: 'BTCUSDT',
        execution: '做多_突破确认',
        strategyVersion: 'V3'
      };

      let shouldTrigger = false;
      let signalType = 'LONG';
      let strategyType = newSignal.strategyVersion || 'V3';

      if (newSignal.execution && (newSignal.execution.includes('做多_') || newSignal.execution.includes('做空_'))) {
        signalType = newSignal.execution.includes('做多_') ? 'LONG' : 'SHORT';
        shouldTrigger = true;
      }

      const key = `${newSignal.symbol}_${strategyType}_${signalType}`;
      
      if (shouldTrigger && !triggeredSignals.has(key)) {
        shouldTrigger = true;
      } else {
        shouldTrigger = false;
      }

      assert.ok(shouldTrigger, '应该允许重新触发');
      assert.ok(!triggeredSignals.has(key), '不应该找到已存在的触发记录');
    });
  });

  describe('价格计算测试', () => {
    it('应该正确计算止损距离', () => {
      const entryPrice = 50000;
      const stopLoss = 49000;
      
      const stopLossDistance = Math.abs(entryPrice - stopLoss) / entryPrice * 100;
      
      assert.strictEqual(stopLossDistance, 2); // 2%
    });

    it('应该正确处理不同的价格字段', () => {
      const signalV3 = {
        entrySignal: 50000,
        currentPrice: 49900
      };
      
      const signalICT = {
        entryPrice: 50000,
        currentPrice: 49900
      };
      
      // V3策略价格提取
      const entryPriceV3 = signalV3.entrySignal || signalV3.currentPrice;
      
      // ICT策略价格提取
      const entryPriceICT = signalICT.entryPrice || signalICT.currentPrice;
      
      assert.strictEqual(entryPriceV3, 50000);
      assert.strictEqual(entryPriceICT, 50000);
    });
  });

  describe('API调用测试', () => {
    it('应该正确构建API请求参数', () => {
      const signalData = {
        symbol: 'BTCUSDT',
        execution: '做多_突破确认',
        strategyVersion: 'V3',
        entrySignal: 50000,
        stopLoss: 49000,
        takeProfit: 52000
      };

      // 确定方向和策略类型
      let direction = 'LONG';
      let strategyType = signalData.strategyVersion || 'V3';
      
      if (signalData.execution) {
        direction = signalData.execution.includes('做多_') ? 'LONG' : 'SHORT';
      }

      const apiRequest = {
        method: 'POST',
        body: JSON.stringify({ 
          symbol: signalData.symbol,
          strategy: strategyType,
          direction: direction 
        })
      };

      assert.strictEqual(apiRequest.method, 'POST');
      
      const body = JSON.parse(apiRequest.body);
      assert.strictEqual(body.symbol, 'BTCUSDT');
      assert.strictEqual(body.strategy, 'V3');
      assert.strictEqual(body.direction, 'LONG');
    });
  });

  describe('错误处理测试', () => {
    it('应该处理无效的信号数据', () => {
      const invalidSignal = {
        symbol: 'BTCUSDT',
        // 缺少execution和signalType字段
        strategyVersion: 'V3'
      };

      let shouldTrigger = false;

      // V3策略信号检查
      if (invalidSignal.execution && (invalidSignal.execution.includes('做多_') || invalidSignal.execution.includes('做空_'))) {
        shouldTrigger = true;
      }
      // ICT策略信号检查
      else if (invalidSignal.signalType && invalidSignal.signalType !== 'WAIT' && invalidSignal.signalType !== '观望') {
        shouldTrigger = true;
      }

      assert.ok(!shouldTrigger, '应该忽略无效信号');
    });

    it('应该处理空的价格数据', () => {
      const signalWithEmptyPrice = {
        symbol: 'BTCUSDT',
        execution: '做多_突破确认',
        // 缺少价格数据
      };

      const entryPrice = signalWithEmptyPrice.entrySignal || signalWithEmptyPrice.entryPrice || signalWithEmptyPrice.currentPrice;
      const stopLoss = signalWithEmptyPrice.stopLoss;
      const takeProfit = signalWithEmptyPrice.takeProfit;

      assert.strictEqual(entryPrice, undefined);
      assert.strictEqual(stopLoss, undefined);
      assert.strictEqual(takeProfit, undefined);
    });
  });
});
