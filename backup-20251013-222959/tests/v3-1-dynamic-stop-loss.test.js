/**
 * V3.1动态止损策略模块单元测试
 */

const DynamicStopLossManager = require('../src/strategies/v3-1-dynamic-stop-loss');

describe('DynamicStopLossManager', () => {
  let manager;

  beforeEach(() => {
    manager = new DynamicStopLossManager();
  });

  describe('calculateInitial() - 计算初始止损', () => {
    test('应该为高置信度计算更紧的止损（多头）', () => {
      const entryPrice = 100;
      const atr15 = 2;
      
      const result = manager.calculateInitial(entryPrice, 'LONG', atr15, 'high');

      expect(result.initialSL).toBe(100 - 2 * 1.5); // 97
      expect(result.tp).toBe(100 + 2 * 1.5 * 1.3); // 103.9
      expect(result.kEntry).toBe(1.5);
      expect(result.trailStep).toBe(2 * 0.5); // 1
    });

    test('应该为中置信度计算适中止损（多头）', () => {
      const entryPrice = 100;
      const atr15 = 2;
      
      const result = manager.calculateInitial(entryPrice, 'LONG', atr15, 'med');

      expect(result.initialSL).toBe(100 - 2 * 2.0); // 96
      expect(result.tp).toBe(100 + 2 * 2.0 * 1.3); // 105.2
      expect(result.kEntry).toBe(2.0);
    });

    test('应该为低置信度计算更宽的止损（多头）', () => {
      const entryPrice = 100;
      const atr15 = 2;
      
      const result = manager.calculateInitial(entryPrice, 'LONG', atr15, 'low');

      expect(result.initialSL).toBe(100 - 2 * 2.6); // 94.8
      expect(result.tp).toBe(100 + 2 * 2.6 * 1.3); // 106.76
      expect(result.kEntry).toBe(2.6);
    });

    test('应该正确计算空头止损', () => {
      const entryPrice = 100;
      const atr15 = 2;
      
      const result = manager.calculateInitial(entryPrice, 'SHORT', atr15, 'high');

      expect(result.initialSL).toBe(100 + 2 * 1.5); // 103
      expect(result.tp).toBe(100 - 2 * 1.5 * 1.3); // 96.1
      expect(result.kEntry).toBe(1.5);
    });

    test('应该计算盈利触发价', () => {
      const entryPrice = 100;
      const atr15 = 2;
      
      const result = manager.calculateInitial(entryPrice, 'LONG', atr15, 'high');

      const stopDistance = 100 - result.initialSL; // 3
      expect(result.profitTriggerPrice).toBe(100 + stopDistance * 1.0); // 103
    });
  });

  describe('adjustForTrendConfirm() - 趋势确认调整', () => {
    test('应该在趋势确认时扩大止损', () => {
      const trade = {
        entryPrice: 100,
        side: 'LONG',
        initialSL: 97
      };

      const trendConfirm = {
        macdHistIncrease: 0.35, // >30%
        adxRising: true
      };

      const currentATR = 2;

      const result = manager.adjustForTrendConfirm(trade, trendConfirm, currentATR);

      expect(result.adjusted).toBe(true);
      expect(result.currentSL).toBeGreaterThan(trade.initialSL);
      expect(result.stopType).toBe('dynamic');
    });

    test('应该在趋势不够强时不调整', () => {
      const trade = {
        entryPrice: 100,
        side: 'LONG',
        initialSL: 97
      };

      const trendConfirm = {
        macdHistIncrease: 0.2, // <30%
        adxRising: false
      };

      const currentATR = 2;

      const result = manager.adjustForTrendConfirm(trade, trendConfirm, currentATR);

      expect(result.adjusted).toBe(false);
      expect(result.currentSL).toBe(trade.initialSL);
    });
  });

  describe('checkTimeStop() - 检查时间止损', () => {
    test('应该在持仓超时且未盈利时触发', () => {
      const trade = {
        entryTime: new Date(Date.now() - 65 * 60 * 1000), // 65分钟前
        entryPrice: 100,
        side: 'LONG'
      };

      const currentPrice = 99; // 未盈利

      const result = manager.checkTimeStop(trade, currentPrice);

      expect(result.triggered).toBe(true);
      expect(result.action).toBe('close');
      expect(result.minutesHeld).toBeGreaterThanOrEqual(60);
    });

    test('应该在持仓超时但盈利时不触发', () => {
      const trade = {
        entryTime: new Date(Date.now() - 65 * 60 * 1000),
        entryPrice: 100,
        side: 'LONG'
      };

      const currentPrice = 102; // 盈利

      const result = manager.checkTimeStop(trade, currentPrice);

      expect(result.triggered).toBe(false);
      expect(result.isProfitable).toBe(true);
    });

    test('应该在持仓未超时时不触发', () => {
      const trade = {
        entryTime: new Date(Date.now() - 30 * 60 * 1000), // 30分钟前
        entryPrice: 100,
        side: 'LONG'
      };

      const currentPrice = 99;

      const result = manager.checkTimeStop(trade, currentPrice);

      expect(result.triggered).toBe(false);
      expect(result.minutesHeld).toBeLessThan(60);
    });
  });

  describe('updateTrailingStop() - 更新追踪止损', () => {
    test('应该在达到盈利触发点后启动追踪', () => {
      const trade = {
        entryPrice: 100,
        side: 'LONG',
        initialSL: 97
      };

      const stopParams = {
        currentSL: 97,
        profitTriggerPrice: 103,
        trailStep: 1,
        trailingActivated: false
      };

      const currentPrice = 104; // 超过触发点

      const result = manager.updateTrailingStop(trade, currentPrice, stopParams);

      expect(result.trailingActivated).toBe(true);
      expect(result.profitTriggered).toBe(true);
      expect(result.currentSL).toBeGreaterThan(stopParams.currentSL);
    });

    test('应该在未达到触发点时不启动追踪', () => {
      const trade = {
        entryPrice: 100,
        side: 'LONG',
        initialSL: 97
      };

      const stopParams = {
        currentSL: 97,
        profitTriggerPrice: 103,
        trailStep: 1,
        trailingActivated: false
      };

      const currentPrice = 102; // 未达到触发点

      const result = manager.updateTrailingStop(trade, currentPrice, stopParams);

      expect(result.updated).toBe(false);
      expect(result.trailingActivated).toBe(false);
    });

    test('应该正确更新多头追踪止损', () => {
      const trade = {
        entryPrice: 100,
        side: 'LONG',
        initialSL: 97
      };

      const stopParams = {
        currentSL: 100, // 已移至保本
        profitTriggerPrice: 103,
        trailStep: 1,
        trailingActivated: true
      };

      const currentPrice = 105;

      const result = manager.updateTrailingStop(trade, currentPrice, stopParams);

      expect(result.currentSL).toBe(105 - 1); // 104
      expect(result.updated).toBe(true);
    });

    test('应该正确更新空头追踪止损', () => {
      const trade = {
        entryPrice: 100,
        side: 'SHORT',
        initialSL: 103
      };

      const stopParams = {
        currentSL: 100, // 已移至保本
        profitTriggerPrice: 97,
        trailStep: 1,
        trailingActivated: true
      };

      const currentPrice = 95;

      const result = manager.updateTrailingStop(trade, currentPrice, stopParams);

      expect(result.currentSL).toBe(95 + 1); // 96
      expect(result.updated).toBe(true);
    });
  });

  describe('checkStopLoss() - 检查止损触发', () => {
    test('应该检测到多头止损触发', () => {
      const trade = { side: 'LONG' };
      const currentPrice = 96;
      const currentSL = 97;

      const result = manager.checkStopLoss(trade, currentPrice, currentSL);

      expect(result.triggered).toBe(true);
    });

    test('应该检测到空头止损触发', () => {
      const trade = { side: 'SHORT' };
      const currentPrice = 104;
      const currentSL = 103;

      const result = manager.checkStopLoss(trade, currentPrice, currentSL);

      expect(result.triggered).toBe(true);
    });

    test('应该在止损未触发时返回false', () => {
      const trade = { side: 'LONG' };
      const currentPrice = 98;
      const currentSL = 97;

      const result = manager.checkStopLoss(trade, currentPrice, currentSL);

      expect(result.triggered).toBe(false);
    });
  });

  describe('checkTakeProfit() - 检查止盈触发', () => {
    test('应该检测到多头止盈触发', () => {
      const trade = { side: 'LONG' };
      const currentPrice = 106;
      const tp = 105;

      const result = manager.checkTakeProfit(trade, currentPrice, tp);

      expect(result.triggered).toBe(true);
    });

    test('应该检测到空头止盈触发', () => {
      const trade = { side: 'SHORT' };
      const currentPrice = 94;
      const tp = 95;

      const result = manager.checkTakeProfit(trade, currentPrice, tp);

      expect(result.triggered).toBe(true);
    });

    test('应该在止盈未触发时返回false', () => {
      const trade = { side: 'LONG' };
      const currentPrice = 104;
      const tp = 105;

      const result = manager.checkTakeProfit(trade, currentPrice, tp);

      expect(result.triggered).toBe(false);
    });
  });

  describe('getKEntry() - 获取ATR倍数', () => {
    test('应该返回正确的ATR倍数', () => {
      expect(manager.getKEntry('high')).toBe(1.5);
      expect(manager.getKEntry('med')).toBe(2.0);
      expect(manager.getKEntry('low')).toBe(2.6);
    });
  });
});

