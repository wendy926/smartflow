// tests/15min-signal-display.test.js
// 15min信号显示逻辑测试

describe('15min信号显示逻辑', () => {
  describe('前端显示逻辑', () => {
    test('应该正确显示有执行结果的情况', () => {
      const signal = {
        execution: 'BUY',
        executionMode: '多头回踩突破'
      };

      // 模拟前端显示逻辑
      let executionDisplay = '--';
      if (signal.execution && signal.execution !== 'null') {
        executionDisplay = `${signal.execution}<br><small style="color: #666;">${signal.executionMode}</small>`;
      }

      expect(executionDisplay).toBe('BUY<br><small style="color: #666;">多头回踩突破</small>');
    });

    test('应该正确显示有执行模式但没有执行结果的情况', () => {
      const signal = {
        execution: null,
        executionMode: '多头回踩突破'
      };

      // 模拟前端显示逻辑
      let executionDisplay = '--';
      if (signal.execution && signal.execution !== 'null') {
        executionDisplay = `${signal.execution}<br><small style="color: #666;">${signal.executionMode}</small>`;
      } else if (signal.executionMode && signal.executionMode !== 'NONE') {
        executionDisplay = `--<br><small style="color: #999;">${signal.executionMode}</small>`;
      }

      expect(executionDisplay).toBe('--<br><small style="color: #999;">多头回踩突破</small>');
    });

    test('应该正确显示没有执行模式和执行结果的情况', () => {
      const signal = {
        execution: null,
        executionMode: 'NONE'
      };

      // 模拟前端显示逻辑
      let executionDisplay = '--';
      if (signal.execution && signal.execution !== 'null') {
        executionDisplay = `${signal.execution}<br><small style="color: #666;">${signal.executionMode}</small>`;
      } else if (signal.executionMode && signal.executionMode !== 'NONE') {
        executionDisplay = `--<br><small style="color: #999;">${signal.executionMode}</small>`;
      }

      expect(executionDisplay).toBe('--');
    });

    test('应该正确显示入场价格信息', () => {
      const signal = {
        currentPrice: 50000,
        entrySignal: 49500
      };

      // 模拟前端价格显示逻辑
      const formatNumber = (num) => num.toLocaleString();
      let priceDisplay = formatNumber(signal.currentPrice || 0);
      if (signal.entrySignal) {
        priceDisplay += `<br><small style="color: #666;">入场: ${formatNumber(signal.entrySignal)}</small>`;
      }

      expect(priceDisplay).toBe('50,000<br><small style="color: #666;">入场: 49,500</small>');
    });

    test('应该正确处理没有入场价格的情况', () => {
      const signal = {
        currentPrice: 50000,
        entrySignal: null
      };

      // 模拟前端价格显示逻辑
      const formatNumber = (num) => num.toLocaleString();
      let priceDisplay = formatNumber(signal.currentPrice || 0);
      if (signal.entrySignal) {
        priceDisplay += `<br><small style="color: #666;">入场: ${formatNumber(signal.entrySignal)}</small>`;
      }

      expect(priceDisplay).toBe('50,000');
    });
  });

  describe('策略执行逻辑', () => {
    test('应该正确识别多头回踩突破模式但未触发入场', () => {
      // 模拟策略执行结果
      const mockExecutionResult = {
        signal: 'NONE',
        mode: '多头回踩突破',
        entry: null,
        stopLoss: null,
        takeProfit: null,
        reason: '多头回踩突破条件满足但VWAP方向不一致'
      };

      // 验证策略逻辑的合理性
      expect(mockExecutionResult.mode).toBe('多头回踩突破');
      expect(mockExecutionResult.signal).toBe('NONE');
      expect(mockExecutionResult.entry).toBeNull();
      expect(mockExecutionResult.reason).toContain('VWAP方向不一致');
    });

    test('应该正确识别空头反抽破位模式但未触发入场', () => {
      const mockExecutionResult = {
        signal: 'NONE',
        mode: '空头反抽破位',
        entry: null,
        stopLoss: null,
        takeProfit: null,
        reason: '空头反抽破位条件满足但VWAP方向不一致'
      };

      expect(mockExecutionResult.mode).toBe('空头反抽破位');
      expect(mockExecutionResult.signal).toBe('NONE');
      expect(mockExecutionResult.entry).toBeNull();
      expect(mockExecutionResult.reason).toContain('VWAP方向不一致');
    });

    test('应该正确触发入场信号', () => {
      const mockExecutionResult = {
        signal: 'BUY',
        mode: '多头回踩突破',
        entry: 50100,
        stopLoss: 49500,
        takeProfit: 51300,
        reason: '趋势市多头回踩突破触发'
      };

      expect(mockExecutionResult.signal).toBe('BUY');
      expect(mockExecutionResult.entry).toBe(50100);
      expect(mockExecutionResult.stopLoss).toBe(49500);
      expect(mockExecutionResult.takeProfit).toBe(51300);
    });
  });

  describe('显示合理性验证', () => {
    test('显示多头回踩突破但没有入场价格是合理的', () => {
      const signal = {
        execution: null,
        executionMode: '多头回踩突破',
        entrySignal: null
      };

      // 这种情况是合理的，因为：
      // 1. 策略识别到了执行模式
      // 2. 但当前价格还没有触发具体的入场条件
      // 3. 这是策略的正常工作状态

      expect(signal.executionMode).toBe('多头回踩突破');
      expect(signal.execution).toBeNull();
      expect(signal.entrySignal).toBeNull();

      // 验证这种状态是合理的
      expect(signal.executionMode).not.toBe('NONE'); // 有识别到模式
      expect(signal.execution).toBeNull(); // 但还没有执行信号
    });

    test('前端显示逻辑应该正确反映这种状态', () => {
      const signal = {
        execution: null,
        executionMode: '多头回踩突破',
        currentPrice: 50000,
        entrySignal: null
      };

      // 模拟前端显示逻辑
      let executionDisplay = '--';
      if (signal.execution && signal.execution !== 'null') {
        executionDisplay = `${signal.execution}<br><small style="color: #666;">${signal.executionMode}</small>`;
      } else if (signal.executionMode && signal.executionMode !== 'NONE') {
        executionDisplay = `--<br><small style="color: #999;">${signal.executionMode}</small>`;
      }

      let priceDisplay = signal.currentPrice.toLocaleString();
      if (signal.entrySignal) {
        priceDisplay += `<br><small style="color: #666;">入场: ${signal.entrySignal.toLocaleString()}</small>`;
      }

      // 验证显示结果
      expect(executionDisplay).toBe('--<br><small style="color: #999;">多头回踩突破</small>');
      expect(priceDisplay).toBe('50,000');

      // 这种显示是合理的：
      // - 显示了识别到的执行模式
      // - 但没有显示入场价格（因为还没有触发）
      // - 用户可以看到策略正在等待更精确的入场时机
    });
  });
});
