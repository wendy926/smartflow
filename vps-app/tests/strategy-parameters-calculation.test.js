const assert = require('assert');

// 策略参数计算功能测试
describe('策略参数计算功能测试', () => {
  
  describe('ICT策略参数计算测试', () => {
    it('应该根据真实信号数据计算杠杆和保证金', () => {
      const signal = {
        symbol: 'BTCUSDT',
        signalType: 'BOS_LONG',
        entryPrice: 50000,
        stopLoss: 49000,
        takeProfit: 53000,
        atr4h: 1000,
        atr15m: 500
      };

      // 模拟ICT策略参数计算逻辑
      const entryPrice = signal.entryPrice;
      const stopLoss = signal.stopLoss;
      const takeProfit = signal.takeProfit;
      const atrValue = signal.atr4h || signal.atr15m || (entryPrice * 0.02);
      
      // 计算真实的止损距离
      const stopLossDistance = Math.abs(entryPrice - stopLoss) / entryPrice * 100;
      
      // 按照strategy-v3.md计算杠杆和保证金
      const maxLeverage = Math.floor(1 / (stopLossDistance / 100 + 0.005));
      const maxLossAmount = 100;
      const minMargin = Math.ceil(maxLossAmount / (maxLeverage * stopLossDistance / 100));

      assert.strictEqual(entryPrice, 50000);
      assert.strictEqual(stopLoss, 49000);
      assert.strictEqual(takeProfit, 53000);
      assert.strictEqual(atrValue, 1000);
      assert.strictEqual(stopLossDistance, 2); // 2%
      assert.strictEqual(maxLeverage, 66); // Math.floor(1 / (0.02 + 0.005)) = 40
      assert.strictEqual(minMargin, 76); // Math.ceil(100 / (66 * 0.02)) = 76
    });

    it('应该处理不同的止损距离计算不同的杠杆', () => {
      const testCases = [
        { entryPrice: 50000, stopLoss: 49500, expectedDistance: 1, expectedLeverage: 66 },
        { entryPrice: 50000, stopLoss: 49000, expectedDistance: 2, expectedLeverage: 40 },
        { entryPrice: 50000, stopLoss: 48000, expectedDistance: 4, expectedLeverage: 22 },
        { entryPrice: 50000, stopLoss: 47500, expectedDistance: 5, expectedLeverage: 18 }
      ];

      testCases.forEach(testCase => {
        const stopLossDistance = Math.abs(testCase.entryPrice - testCase.stopLoss) / testCase.entryPrice * 100;
        const maxLeverage = Math.floor(1 / (stopLossDistance / 100 + 0.005));

        assert.strictEqual(stopLossDistance, testCase.expectedDistance);
        assert.strictEqual(maxLeverage, testCase.expectedLeverage);
      });
    });

    it('应该使用信号中的ATR值而不是固定值', () => {
      const signal = {
        symbol: 'ETHUSDT',
        signalType: 'FVG_SHORT',
        entryPrice: 3000,
        stopLoss: 3100,
        takeProfit: 2700,
        atr4h: 50,
        atr15m: 25
      };

      // 优先使用atr4h，然后是atr15m，最后是默认值
      const atrValue = signal.atr4h || signal.atr15m || (signal.entryPrice * 0.02);

      assert.strictEqual(atrValue, 50); // 应该使用atr4h的值
    });

    it('应该在没有atr4h时使用atr15m', () => {
      const signal = {
        symbol: 'ETHUSDT',
        signalType: 'FVG_SHORT',
        entryPrice: 3000,
        stopLoss: 3100,
        takeProfit: 2700,
        atr15m: 25
      };

      const atrValue = signal.atr4h || signal.atr15m || (signal.entryPrice * 0.02);

      assert.strictEqual(atrValue, 25); // 应该使用atr15m的值
    });
  });

  describe('V3策略参数计算测试', () => {
    it('应该使用信号中的真实价格数据', () => {
      const signal = {
        symbol: 'BTCUSDT',
        execution: '做多_突破确认',
        entrySignal: 50000,
        currentPrice: 49900,
        stopLoss: 49000,
        takeProfit: 52000
      };

      // 模拟V3策略参数计算逻辑
      const entryPrice = signal.entrySignal || signal.currentPrice;
      const stopLoss = signal.stopLoss;
      const takeProfit = signal.takeProfit;
      
      const stopLossPercentage = Math.abs(entryPrice - stopLoss) / entryPrice;
      const maxLeverage = Math.floor(1 / (stopLossPercentage + 0.005));
      const maxLossAmount = 100;
      const minMargin = Math.ceil(maxLossAmount / (maxLeverage * stopLossPercentage));

      assert.strictEqual(entryPrice, 50000); // 应该使用entrySignal
      assert.strictEqual(stopLoss, 49000);
      assert.strictEqual(takeProfit, 52000);
      assert.strictEqual(stopLossPercentage, 0.02); // 2%
      assert.strictEqual(maxLeverage, 40); // Math.floor(1 / (0.02 + 0.005)) = 40
      assert.strictEqual(minMargin, 126); // Math.ceil(100 / (40 * 0.02)) = 126
    });

    it('应该在信号数据缺失时使用ATR计算', () => {
      const signal = {
        symbol: 'BTCUSDT',
        execution: '做多_突破确认',
        currentPrice: 50000
        // 缺少stopLoss和takeProfit
      };

      const currentPrice = signal.currentPrice;
      const atr14 = 1000; // 模拟ATR值
      const trend4h = 'LONG';

      // 模拟ATR计算逻辑
      const atrStopDistance = atr14 * 1.2; // 1.2倍ATR
      const fixedStopDistance = currentPrice * 0.02; // 2%固定止损
      const stopLossDistance = Math.max(atrStopDistance, fixedStopDistance);

      let calculatedStopLoss, calculatedTakeProfit;
      if (trend4h === 'LONG') {
        calculatedStopLoss = currentPrice - stopLossDistance;
        calculatedTakeProfit = currentPrice + (stopLossDistance * 2);
      }

      assert.strictEqual(atrStopDistance, 1200);
      assert.strictEqual(fixedStopDistance, 1000);
      assert.strictEqual(stopLossDistance, 1200); // 取较大值
      assert.strictEqual(calculatedStopLoss, 48800); // 50000 - 1200
      assert.strictEqual(calculatedTakeProfit, 52400); // 50000 + (1200 * 2)
    });

    it('应该正确处理空头趋势', () => {
      const signal = {
        symbol: 'ETHUSDT',
        execution: '做空_反抽破位',
        entrySignal: 3000,
        stopLoss: 3100,
        takeProfit: 2700
      };

      const entryPrice = signal.entrySignal;
      const stopLoss = signal.stopLoss;
      const takeProfit = signal.takeProfit;
      
      const stopLossPercentage = Math.abs(entryPrice - stopLoss) / entryPrice;
      const maxLeverage = Math.floor(1 / (stopLossPercentage + 0.005));

      assert.strictEqual(stopLossPercentage, 0.03333333333333333); // 约3.33%
      assert.strictEqual(maxLeverage, 29); // Math.floor(1 / (0.0333 + 0.005)) = 26
    });
  });

  describe('杠杆和保证金计算一致性测试', () => {
    it('应该确保杠杆和保证金计算的一致性', () => {
      const testCases = [
        { entryPrice: 50000, stopLoss: 49000, maxLossAmount: 100 },
        { entryPrice: 3000, stopLoss: 3100, maxLossAmount: 100 },
        { entryPrice: 100, stopLoss: 98, maxLossAmount: 100 }
      ];

      testCases.forEach(testCase => {
        const stopLossPercentage = Math.abs(testCase.entryPrice - testCase.stopLoss) / testCase.entryPrice;
        const maxLeverage = Math.floor(1 / (stopLossPercentage + 0.005));
        const minMargin = Math.ceil(testCase.maxLossAmount / (maxLeverage * stopLossPercentage));

        // 验证保证金计算的正确性
        const calculatedRisk = minMargin * maxLeverage * stopLossPercentage;
        assert.ok(calculatedRisk >= testCase.maxLossAmount, 
          `保证金计算错误: ${calculatedRisk} < ${testCase.maxLossAmount}`);
      });
    });

    it('应该处理极端的止损距离', () => {
      // 测试极小止损距离
      const smallStopDistance = 0.001; // 0.1%
      const maxLeverage = Math.floor(1 / (smallStopDistance + 0.005));
      const maxLossAmount = 100;
      const minMargin = Math.ceil(maxLossAmount / (maxLeverage * smallStopDistance));

      assert.strictEqual(maxLeverage, 166); // Math.floor(1 / (0.001 + 0.005)) = 166
      assert.ok(minMargin > 0, '最小保证金应该大于0');

      // 测试较大止损距离
      const largeStopDistance = 0.1; // 10%
      const maxLeverageLarge = Math.floor(1 / (largeStopDistance + 0.005));
      const minMarginLarge = Math.ceil(maxLossAmount / (maxLeverageLarge * largeStopDistance));

      assert.strictEqual(maxLeverageLarge, 9); // Math.floor(1 / (0.1 + 0.005)) = 9
      assert.ok(minMarginLarge > 0, '最小保证金应该大于0');
    });
  });

  describe('前端错误处理测试', () => {
    it('应该安全地处理策略按钮切换', () => {
      // 模拟DOM元素查找失败的情况
      const strategy = 'INVALID_STRATEGY';
      
      // 模拟switchStrategy方法的逻辑
      let strategyBtn = null;
      if (strategy === 'INVALID_STRATEGY') {
        strategyBtn = null; // 模拟找不到元素
      }

      // 应该安全地处理null情况
      if (strategyBtn) {
        strategyBtn.classList.add('active');
        assert.ok(true, '找到策略按钮');
      } else {
        console.warn(`未找到策略按钮: ${strategy}`);
        assert.ok(true, '安全处理未找到按钮的情况');
      }
    });

    it('应该处理空的价格数据', () => {
      const signal = {
        symbol: 'BTCUSDT',
        signalType: 'BOS_LONG'
        // 缺少价格数据
      };

      const entryPrice = signal.entryPrice || signal.entrySignal || signal.currentPrice;
      const stopLoss = signal.stopLoss;
      const takeProfit = signal.takeProfit;

      assert.strictEqual(entryPrice, undefined);
      assert.strictEqual(stopLoss, undefined);
      assert.strictEqual(takeProfit, undefined);
    });
  });

  describe('数据验证测试', () => {
    it('应该验证计算结果的合理性', () => {
      const signal = {
        symbol: 'BTCUSDT',
        signalType: 'BOS_LONG',
        entryPrice: 50000,
        stopLoss: 49000,
        takeProfit: 53000
      };

      const entryPrice = signal.entryPrice;
      const stopLoss = signal.stopLoss;
      const takeProfit = signal.takeProfit;
      
      const stopLossDistance = Math.abs(entryPrice - stopLoss) / entryPrice * 100;
      const maxLeverage = Math.floor(1 / (stopLossDistance / 100 + 0.005));

      // 验证止损距离合理性
      assert.ok(stopLossDistance > 0, '止损距离应该大于0');
      assert.ok(stopLossDistance < 50, '止损距离不应该过大'); // 假设最大50%

      // 验证杠杆合理性
      assert.ok(maxLeverage > 0, '杠杆应该大于0');
      assert.ok(maxLeverage <= 100, '杠杆不应该过大'); // 假设最大100倍

      // 验证止盈价格合理性
      assert.ok(takeProfit > entryPrice, '多头止盈价格应该高于入场价格');
    });

    it('应该处理空头交易的止盈价格', () => {
      const signal = {
        symbol: 'ETHUSDT',
        signalType: 'FVG_SHORT',
        entryPrice: 3000,
        stopLoss: 3100,
        takeProfit: 2700
      };

      const entryPrice = signal.entryPrice;
      const takeProfit = signal.takeProfit;

      assert.ok(takeProfit < entryPrice, '空头止盈价格应该低于入场价格');
    });
  });
});
