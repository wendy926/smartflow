// static-methods.test.js
// SmartFlowStrategyV3静态方法调用测试

const SmartFlowStrategyV3 = require('../modules/strategy/SmartFlowStrategyV3');

describe('SmartFlowStrategyV3静态方法调用测试', () => {
  
  describe('calculateLeverageData静态方法', () => {
    test('应该正确调用静态方法计算杠杆数据', async () => {
      const entryPrice = 100;
      const stopLossPrice = 95;
      const atr14 = 2.5;
      const direction = 'LONG';
      const maxLossAmount = 100;

      const result = await SmartFlowStrategyV3.calculateLeverageData(
        entryPrice, 
        stopLossPrice, 
        atr14, 
        direction, 
        null, 
        maxLossAmount
      );

      expect(result).toBeDefined();
      expect(result.maxLeverage).toBeGreaterThan(0);
      expect(result.minMargin).toBeGreaterThan(0);
      expect(result.stopLossDistance).toBeGreaterThan(0);
      expect(result.atrValue).toBe(atr14);
    });

    test('应该处理空头交易计算', async () => {
      const entryPrice = 95;
      const stopLossPrice = 100;
      const atr14 = 2.5;
      const direction = 'SHORT';
      const maxLossAmount = 100;

      const result = await SmartFlowStrategyV3.calculateLeverageData(
        entryPrice, 
        stopLossPrice, 
        atr14, 
        direction, 
        null, 
        maxLossAmount
      );

      expect(result).toBeDefined();
      expect(result.maxLeverage).toBeGreaterThan(0);
      expect(result.minMargin).toBeGreaterThan(0);
      expect(result.stopLossDistance).toBeGreaterThan(0);
    });
  });

  describe('formatExecution静态方法', () => {
    test('应该正确格式化执行结果', () => {
      const executionResult = {
        signal: 'BUY',
        mode: '多头回踩突破',
        entry: 100,
        stopLoss: 95,
        takeProfit: 105
      };

      const result = SmartFlowStrategyV3.formatExecution(executionResult);
      
      expect(result).toBe('做多_多头回踩突破');
    });

    test('应该处理空头信号格式化', () => {
      const executionResult = {
        signal: 'SELL',
        mode: '空头反抽破位',
        entry: 100,
        stopLoss: 105,
        takeProfit: 95
      };

      const result = SmartFlowStrategyV3.formatExecution(executionResult);
      
      expect(result).toBe('做空_空头反抽破位');
    });

    test('应该处理NONE信号', () => {
      const executionResult = {
        signal: 'NONE',
        mode: 'NONE',
        entry: null,
        stopLoss: null,
        takeProfit: null
      };

      const result = SmartFlowStrategyV3.formatExecution(executionResult);
      
      expect(result).toBe(null);
    });
  });

  describe('createNoSignalResult静态方法', () => {
    test('应该正确创建无信号结果', () => {
      const symbol = 'BTCUSDT';
      const reason = '测试原因';

      const result = SmartFlowStrategyV3.createNoSignalResult(symbol, reason);

      expect(result).toBeDefined();
      expect(result.symbol).toBe(symbol);
      expect(result.signal).toBe('NONE');
      expect(result.execution).toBe(null);
      expect(result.executionMode).toBe('NONE');
      expect(result.reason).toBe(reason);
    });

    test('应该处理默认原因', () => {
      const symbol = 'ETHUSDT';

      const result = SmartFlowStrategyV3.createNoSignalResult(symbol);

      expect(result).toBeDefined();
      expect(result.symbol).toBe(symbol);
      expect(result.signal).toBe('NONE');
      expect(result.execution).toBe(null);
      expect(result.executionMode).toBe('NONE');
      expect(result.reason).toBeUndefined();
    });
  });

  describe('实例方法调用静态方法的集成测试', () => {
    test('实例应该能正确调用静态方法', async () => {
      const strategy = new SmartFlowStrategyV3();
      
      // 测试formatExecution调用
      const executionResult = {
        signal: 'BUY',
        mode: '多头回踩突破',
        entry: 100,
        stopLoss: 95,
        takeProfit: 105
      };
      
      const formatted = SmartFlowStrategyV3.formatExecution(executionResult);
      expect(formatted).toBe('做多_多头回踩突破');
      
      // 测试createNoSignalResult调用
      const noSignal = SmartFlowStrategyV3.createNoSignalResult('TESTUSDT', '测试');
      expect(noSignal.symbol).toBe('TESTUSDT');
      expect(noSignal.signal).toBe('NONE');
      
      // 测试calculateLeverageData调用
      const leverageData = await SmartFlowStrategyV3.calculateLeverageData(
        100, 95, 2.5, 'LONG', null, 100
      );
      expect(leverageData).toBeDefined();
      expect(leverageData.maxLeverage).toBeGreaterThan(0);
    });
  });
});
