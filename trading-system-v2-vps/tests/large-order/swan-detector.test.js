/**
 * SwanDetector单元测试
 */

const { SwanDetector, SwanLevel } = require('../../src/services/large-order/swan-detector');

describe('SwanDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new SwanDetector({});
  });

  describe('checkVolume24hRatio', () => {
    test('应该正确检测vol24h阈值', () => {
      const orderValue = 100_000_000; // 100M
      const volume24h = 3_000_000_000; // 3B
      
      const result = detector.checkVolume24hRatio(orderValue, volume24h);
      expect(result.passed).toBe(true);
      expect(result.ratio).toBeCloseTo(0.0333, 4);
    });

    test('应该拒绝低于阈值的订单', () => {
      const orderValue = 100_000_000; // 100M
      const volume24h = 10_000_000_000; // 10B
      
      const result = detector.checkVolume24hRatio(orderValue, volume24h);
      expect(result.passed).toBe(false);
    });
  });

  describe('checkOIRatio', () => {
    test('应该正确检测OI阈值', () => {
      const orderValue = 100_000_000; // 100M
      const oi = 1_500_000_000; // 1.5B
      
      const result = detector.checkOIRatio(orderValue, oi);
      expect(result.passed).toBe(true);
      expect(result.ratio).toBeCloseTo(0.0667, 4);
    });
  });

  describe('detectRapidSweep', () => {
    test('应该检测到快速消费', () => {
      const sweepPct = 0.4; // 40%被吃掉
      const priceDrop = 0.04; // 价格跌4%
      
      const result = detector.detectRapidSweep(sweepPct, priceDrop);
      expect(result.detected).toBe(true);
      expect(result.severity).toBe('HIGH');
    });

    test('应该检测到CRITICAL级别', () => {
      const sweepPct = 0.5; // 50%被吃掉
      const priceDrop = 0.06; // 价格跌6%
      
      const result = detector.detectRapidSweep(sweepPct, priceDrop);
      expect(result.detected).toBe(true);
      expect(result.severity).toBe('CRITICAL');
    });
  });

  describe('detectOICollapse', () => {
    test('应该检测到OI突降', () => {
      const prevOI = 1_000_000_000;
      const currentOI = 900_000_000;
      
      const result = detector.detectOICollapse(currentOI, prevOI);
      expect(result.detected).toBe(true);
      expect(result.dropPct).toBeCloseTo(0.1, 4);
    });
  });

  describe('classifySwanLevel', () => {
    test('应该返回CRITICAL级别', () => {
      const metrics = {
        orderValue: 100_000_000,
        impactRatio: 0.25,
        maxOrderValue: 150_000_000,
        vol24hCheck: { passed: true, ratio: 0.04 },
        oiCheck: { passed: true, ratio: 0.06 },
        sweepCheck: { detected: true, severity: 'CRITICAL', reason: 'fast sweep' },
        oiCollapseCheck: { detected: false }
      };

      const result = detector.classifySwanLevel(metrics);
      expect(result.level).toBe(SwanLevel.CRITICAL);
      expect(result.triggers.length).toBeGreaterThan(0);
    });

    test('应该返回WATCH级别', () => {
      const metrics = {
        orderValue: 100_000_000,
        impactRatio: 0.15,
        maxOrderValue: 100_000_000,
        vol24hCheck: { passed: false, ratio: 0.01 },
        oiCheck: { passed: false, ratio: 0.02 },
        sweepCheck: { detected: false, severity: 'NONE' },
        oiCollapseCheck: { detected: false }
      };

      const result = detector.classifySwanLevel(metrics);
      expect(result.level).toBe(SwanLevel.WATCH);
    });
  });

  describe('detect', () => {
    test('应该能完整检测黑天鹅信号', () => {
      const data = {
        trackedEntries: [{
          valueUSD: 150_000_000,
          impactRatio: 0.3,
          wasConsumed: true,
          qty: 1000,
          filledVolumeObserved: 500
        }],
        volume24h: 3_000_000_000,
        oi: 2_000_000_000,
        prevOI: 2_100_000_000,
        priceHistory: [
          { ts: Date.now() - 300000, price: 65000 },
          { ts: Date.now(), price: 63000 }
        ]
      };

      const result = detector.detect(data);
      expect(result).toHaveProperty('level');
      expect(result).toHaveProperty('metrics');
      expect(result).toHaveProperty('triggers');
    });
  });
});

