/**
 * TrapDetector单元测试
 */

const { TrapDetector, TrapType } = require('../../src/services/smart-money/trap-detector');

describe('TrapDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new TrapDetector({});
  });

  describe('checkPersistence', () => {
    test('应该正确统计持续挂单和闪现挂单', () => {
      const now = Date.now();
      const entries = [
        { createdAt: now - 15000, canceledAt: null },          // 15s持续
        { createdAt: now - 2000, canceledAt: now },            // 2s闪现
        { createdAt: now - 1000, canceledAt: now },            // 1s闪现
        { createdAt: now - 12000, canceledAt: null }           // 12s持续
      ];

      const result = detector.checkPersistence(entries);
      
      expect(result.persistentCount).toBe(2);
      expect(result.flashCount).toBe(2);
      expect(result.flashRatio).toBe(0.5);
    });
  });

  describe('checkExecution', () => {
    test('应该检测到高撤单比率', () => {
      const entries = [
        { side: 'bid', wasConsumed: false, canceledAt: Date.now(), qty: 100, filledVolumeObserved: 10 },
        { side: 'bid', wasConsumed: false, canceledAt: Date.now(), qty: 100, filledVolumeObserved: 5 }
      ];

      const result = detector.checkExecution(entries, 50, 100, -20);
      
      expect(result.canceledCount).toBe(2);
      expect(result.avgCancelRatio).toBeGreaterThan(0.8);
    });

    test('应该检测CVD对齐', () => {
      const entries = [
        { side: 'bid', wasConsumed: true, qty: 100, filledVolumeObserved: 50 }
      ];

      const result = detector.checkExecution(entries, 1000, 500, 100); // CVD正，价格涨
      
      expect(result.cvdAligned).toBe(true);
      expect(result.priceAligned).toBe(true);
    });
  });

  describe('checkTemporalSequence', () => {
    test('应该检测到价格spike和反转', () => {
      const priceHistory = [
        { ts: Date.now() - 30000, price: 62000 },
        { ts: Date.now() - 15000, price: 63500 },  // Spike
        { ts: Date.now(), price: 62100 }           // Reversal
      ];

      const result = detector.checkTemporalSequence(priceHistory, [], []);
      
      expect(result.spikeDetected).toBe(true);
    });
  });

  describe('detect', () => {
    test('应该检测到诱多（Bull Trap）', () => {
      const now = Date.now();
      const data = {
        trackedEntries: [
          { 
            side: 'bid', 
            createdAt: now - 2000, 
            canceledAt: now,
            wasConsumed: false,
            qty: 100,
            filledVolumeObserved: 10
          },
          { 
            side: 'bid', 
            createdAt: now - 1500, 
            canceledAt: now - 500,
            wasConsumed: false,
            qty: 100,
            filledVolumeObserved: 5
          }
        ],
        cvdChange: -500,  // CVD下降（与买单矛盾）
        oiChange: 0,
        priceChange: -100,  // 价格下跌（与买单矛盾）
        priceHistory: [
          { ts: now - 10000, price: 62000 },
          { ts: now, price: 61900 }
        ],
        cvdSeries: [],
        oiSeries: []
      };

      const result = detector.detect(data);
      
      expect(result.detected).toBe(true);
      expect(result.type).toBe(TrapType.BULL_TRAP);
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    test('应该检测到诱空（Bear Trap）', () => {
      const now = Date.now();
      const data = {
        trackedEntries: [
          { 
            side: 'ask', 
            createdAt: now - 2500, 
            canceledAt: now,
            wasConsumed: false,
            qty: 100,
            filledVolumeObserved: 15
          }
        ],
        cvdChange: 500,   // CVD上升（与卖单矛盾）
        oiChange: 0,
        priceChange: 100,  // 价格上涨（与卖单矛盾）
        priceHistory: [
          { ts: now - 10000, price: 62000 },
          { ts: now, price: 62100 }
        ],
        cvdSeries: [],
        oiSeries: []
      };

      const result = detector.detect(data);
      
      expect(result.detected).toBe(true);
      expect(result.type).toBe(TrapType.BEAR_TRAP);
    });

    test('正常信号不应触发陷阱', () => {
      const now = Date.now();
      const data = {
        trackedEntries: [
          { 
            side: 'bid', 
            createdAt: now - 20000,  // 持续20s
            canceledAt: null,
            wasConsumed: true,
            qty: 100,
            filledVolumeObserved: 50  // 成交50%
          }
        ],
        cvdChange: 1000,  // CVD上升（与买单一致）
        oiChange: 500,
        priceChange: 200,  // 价格上涨（与买单一致）
        priceHistory: [
          { ts: now - 10000, price: 62000 },
          { ts: now, price: 62200 }
        ],
        cvdSeries: [],
        oiSeries: []
      };

      const result = detector.detect(data);
      
      expect(result.detected).toBe(false);
      expect(result.type).toBe(TrapType.NONE);
    });
  });
});

