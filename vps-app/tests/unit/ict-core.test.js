// ict-core.test.js - ICT核心逻辑单元测试
const ICTCore = require('../../src/core/modules/strategy/ict-trading/ICTCore');

describe('ICTCore 核心逻辑测试', () => {
  let ictCore;

  beforeEach(() => {
    ictCore = new ICTCore();
  });

  describe('趋势检测 (detectTrend)', () => {
    test('应该正确识别上升趋势', () => {
      const now = Date.now();
      const data = [
        [now - 7200000, '50000', '51000', '49000', '50000', '1000', now - 6600000, '5000', 100, '0', '0', '0'],
        [now - 3600000, '50000', '52000', '50000', '51500', '1200', now - 3000000, '6000', 120, '0', '0', '0'],
        [now, '51500', '53000', '51000', '52500', '1500', now + 600000, '7500', 150, '0', '0', '0']
      ];

      const result = ictCore.detectTrend(data, 3);

      expect(result.trend).toBe('up');
      expect(result.score).toBe(3);
      expect(result.first).toBe(50000);
      expect(result.last).toBe(52500);
    });

    test('应该正确识别下降趋势', () => {
      const now = Date.now();
      const data = [
        [now - 7200000, '50000', '51000', '49000', '50000', '1000', now - 6600000, '5000', 100, '0', '0', '0'],
        [now - 3600000, '50000', '52000', '50000', '51500', '1200', now - 3000000, '6000', 120, '0', '0', '0'],
        [now, '51500', '50000', '49000', '48000', '1500', now + 600000, '7500', 150, '0', '0', '0']
      ];

      const result = ictCore.detectTrend(data, 3);

      expect(result.trend).toBe('down');
      expect(result.score).toBe(3);
    });

    test('应该正确识别震荡趋势', () => {
      const now = Date.now();
      const data = [
        [now - 7200000, '50000', '51000', '49000', '50500', '1000', now - 6600000, '5000', 100, '0', '0', '0'],
        [now - 3600000, '50500', '52000', '50000', '51500', '1200', now - 3000000, '6000', 120, '0', '0', '0'],
        [now, '51500', '52000', '51000', '51200', '1500', now + 600000, '7500', 150, '0', '0', '0']
      ];

      const result = ictCore.detectTrend(data, 3);

      expect(result.trend).toBe('sideways');
      expect(result.score).toBeLessThan(3);
    });

    test('应该处理数据不足的情况', () => {
      const data = [
        [Date.now() - 3600000, '50000', '51000', '49000', '50500', '1000', Date.now() - 3000000, '5000', 100, '0', '0', '0']
      ];

      const result = ictCore.detectTrend(data, 3);

      expect(result.trend).toBe('sideways');
      expect(result.error).toBe('数据不足');
    });
  });

  describe('OB检测 (detectOB)', () => {
    test('应该检测到有效的OB', () => {
      const now = Date.now();
      const data4H = [
        [now - 3600000, '50000', '52000', '49000', '51000', '1000', now - 3000000, '5000', 100, '0', '0', '0'],
        [now - 1800000, '51000', '53000', '50000', '52000', '1200', now - 1200000, '6000', 120, '0', '0', '0']
      ];
      const atr4h = 1000;

      const result = ictCore.detectOB(data4H, atr4h, 30);

      expect(result).toBeTruthy();
      expect(result.low).toBe(49000);
      expect(result.high).toBe(52000);
      expect(result.height).toBe(3000);
      expect(result.ageDays).toBeGreaterThan(0);
    });

    test('应该过滤掉过小的OB', () => {
      const now = Date.now();
      const data4H = [
        [now - 3600000, '50000', '50100', '49900', '50050', '1000', now - 3000000, '5000', 100, '0', '0', '0'],
        [now - 1800000, '50050', '50150', '49950', '50100', '1200', now - 1200000, '6000', 120, '0', '0', '0']
      ];
      const atr4h = 1000;

      const result = ictCore.detectOB(data4H, atr4h, 30);

      expect(result).toBeNull();
    });

    test('应该过滤掉过期的OB', () => {
      const now = Date.now();
      const data4H = [
        [now - 86400000 * 35, '50000', '52000', '49000', '51000', '1000', now - 86400000 * 35 + 300000, '5000', 100, '0', '0', '0'],
        [now - 86400000 * 34, '51000', '53000', '50000', '52000', '1200', now - 86400000 * 34 + 300000, '6000', 120, '0', '0', '0']
      ];
      const atr4h = 1000;

      const result = ictCore.detectOB(data4H, atr4h, 30);

      expect(result).toBeNull();
    });
  });

  describe('FVG检测 (detectFVG)', () => {
    test('应该检测到上升FVG', () => {
      const now = Date.now();
      const data4H = [
        [now - 7200000, '50000', '50000', '49000', '49000', '1000', now - 6600000, '5000', 100, '0', '0', '0'],
        [now - 3600000, '49000', '52000', '50500', '51500', '1200', now - 3000000, '6000', 120, '0', '0', '0'],
        [now, '51500', '53000', '51000', '52500', '1500', now + 600000, '7500', 150, '0', '0', '0']
      ];

      const result = ictCore.detectFVG(data4H);

      expect(result).toBeTruthy();
      expect(result.type).toBe('bullish');
      expect(result.low).toBe(50000);
      expect(result.high).toBe(50500);
      expect(result.height).toBe(500);
    });

    test('应该检测到下降FVG', () => {
      const now = Date.now();
      const data4H = [
        [now - 7200000, '50000', '50000', '49000', '49000', '1000', now - 6600000, '5000', 100, '0', '0', '0'],
        [now - 3600000, '49000', '48800', '48500', '48500', '1200', now - 3000000, '6000', 120, '0', '0', '0'],
        [now, '48500', '49000', '47000', '47500', '1500', now + 600000, '7500', 150, '0', '0', '0']
      ];

      const result = ictCore.detectFVG(data4H);

      expect(result).toBeTruthy();
      expect(result.type).toBe('bearish');
      expect(result.low).toBe(48800);
      expect(result.high).toBe(49000);
      expect(result.height).toBe(200);
    });

    test('应该在没有FVG时返回null', () => {
      const now = Date.now();
      const data4H = [
        [now - 7200000, '50000', '51000', '49000', '50500', '1000', now - 6600000, '5000', 100, '0', '0', '0'],
        [now - 3600000, '50500', '52000', '50000', '51500', '1200', now - 3000000, '6000', 120, '0', '0', '0'],
        [now, '51500', '52000', '51000', '51200', '1500', now + 600000, '7500', 150, '0', '0', '0']
      ];

      const result = ictCore.detectFVG(data4H);

      expect(result).toBeNull();
    });
  });

  describe('吞没形态检测 (detectEngulfing)', () => {
    test('应该检测到多头吞没', () => {
      const now = Date.now();
      const data15M = [
        [now - 1800000, '50000', '50500', '49500', '49800', '1000', now - 1200000, '5000', 100, '0', '0', '0'],
        [now - 900000, '49500', '51000', '49500', '50800', '1200', now - 300000, '6000', 120, '0', '0', '0']
      ];
      const atr15 = 500;

      const result = ictCore.detectEngulfing(data15M, atr15, 'up');

      expect(result.detected).toBe(true);
      expect(result.trend).toBe('up');
      expect(result.bodyRatio).toBeGreaterThan(1.5);
    });

    test('应该检测到空头吞没', () => {
      const now = Date.now();
      const data15M = [
        [now - 1800000, '50000', '50500', '49500', '50200', '1000', now - 1200000, '5000', 100, '0', '0', '0'],
        [now - 900000, '50500', '50500', '49000', '49200', '1200', now - 300000, '6000', 120, '0', '0', '0']
      ];
      const atr15 = 500;

      const result = ictCore.detectEngulfing(data15M, atr15, 'down');

      expect(result.detected).toBe(true);
      expect(result.trend).toBe('down');
    });

    test('应该过滤掉实体太小的吞没', () => {
      const now = Date.now();
      const data15M = [
        [now - 1800000, '50000', '50500', '49500', '49800', '1000', now - 1200000, '5000', 100, '0', '0', '0'],
        [now - 900000, '49800', '50000', '49600', '49900', '1200', now - 300000, '6000', 120, '0', '0', '0']
      ];
      const atr15 = 500;

      const result = ictCore.detectEngulfing(data15M, atr15, 'up');

      expect(result.detected).toBe(false);
      expect(result.reason).toBe('实体太小');
    });
  });

  describe('Sweep检测 (detectSweepHTF)', () => {
    test('应该检测到有效的4H Sweep', () => {
      const now = Date.now();
      const data4H = [];
      // 生成20根4H K线数据
      for (let i = 19; i >= 0; i--) {
        const timestamp = now - (i * 14400000); // 每根K线间隔4小时
        data4H.push([
          timestamp, '50000', '51000', '49000', '50500', '1000',
          timestamp + 600000, '5000', 100, '0', '0', '0'
        ]);
      }
      // 创建sweep模式：第0-16根最高点52000，第17-19根刺破并收回
      data4H[10][2] = '52000'; // 第10根设为历史最高点52000
      // 第17根开始刺破
      data4H[17][2] = '53000'; // 刺破到53000，exceed=1000
      data4H[17][4] = '50500'; // 收盘不变
      // 第18根继续刺破或收回
      data4H[18][2] = '52500'; // 高点回落  
      data4H[18][4] = '51500'; // 收回到51500 < 52000，满足收回条件
      const atr4h = 1000; // ATR=1000，exceed=1000，barsToReturn=1，speed=1000 >= 400

      const result = ictCore.detectSweepHTF(data4H, atr4h);

      expect(result).toBe(true);
    });

    test('应该检测到有效的15m Sweep', () => {
      const now = Date.now();
      const data15M = [];
      // 生成20根15m K线数据
      for (let i = 19; i >= 0; i--) {
        const timestamp = now - (i * 900000); // 每根K线间隔15分钟
        data15M.push([
          timestamp, '50000', '51000', '49000', '50500', '1000',
          timestamp + 600000, '5000', 100, '0', '0', '0'
        ]);
      }
      // 创建sweep模式：前15根最高点52000，最后5根刺破并收回
      data15M[10][2] = '52000'; // 第10根设为历史最高点52000
      // 最后5根中刺破
      data15M[15][2] = '53000'; // 第15根刺破到53000，exceed=1000
      data15M[15][4] = '50500'; // 收盘不变
      data15M[16][2] = '52500'; // 第16根高点回落  
      data15M[16][4] = '51500'; // 收回到51500 < 52000，满足收回条件
      const atr15 = 500; // ATR=500，exceed=1000，barsToReturn=1，speed=1000 >= 100

      const result = ictCore.detectSweepLTF(data15M, atr15);

      expect(result.detected).toBe(true);
      expect(result.speed).toBeGreaterThan(0);
    });
  });

  describe('ATR计算 (calculateATR)', () => {
    test('应该正确计算ATR', () => {
      const now = Date.now();
      const data = [];
      // 生成4根K线数据（period=3需要至少4根）
      for (let i = 3; i >= 0; i--) {
        const timestamp = now - (i * 3600000); // 每根K线间隔1小时
        data.push([
          timestamp, '50000', '51000', '49000', '50500', '1000',
          timestamp + 600000, '5000', 100, '0', '0', '0'
        ]);
      }

      const atr = ictCore.calculateATR(data, 3);

      expect(atr).toBeGreaterThan(0);
      expect(typeof atr).toBe('number');
    });

    test('应该处理数据不足的情况', () => {
      const data = [
        [Date.now() - 3600000, '50000', '51000', '49000', '50500', '1000', Date.now() - 3000000, '5000', 100, '0', '0', '0']
      ];

      const atr = ictCore.calculateATR(data, 3);

      expect(atr).toBe(0);
    });
  });

  describe('OB年龄检查 (checkOBAge)', () => {
    test('应该通过年龄检查', () => {
      const now = Date.now();
      const ob = {
        time: new Date(now - 86400000).toISOString() // 1天前
      };
      const fvg = {
        time: new Date(now - 129600000).toISOString() // 1.5天前
      };

      const result = ictCore.checkOBAge(ob, fvg);

      expect(result.valid).toBe(true);
      expect(result.age).toBeLessThanOrEqual(2);
    });

    test('应该拒绝过期的OB', () => {
      const now = Date.now();
      const ob = {
        time: new Date(now - 259200000).toISOString() // 3天前
      };
      const fvg = {
        time: new Date(now - 345600000).toISOString() // 4天前
      };

      const result = ictCore.checkOBAge(ob, fvg);

      expect(result.valid).toBe(false);
      expect(result.age).toBeGreaterThan(2);
    });
  });

  describe('成交量确认 (checkVolumeConfirmation)', () => {
    test('应该确认成交量', () => {
      const now = Date.now();
      const data15M = [];
      // 生成20根K线数据
      for (let i = 19; i >= 0; i--) {
        const timestamp = now - (i * 900000); // 每根K线间隔15分钟
        data15M.push([
          timestamp, '50000', '51000', '49000', '50500', '1000',
          timestamp + 600000, '5000', 100, '0', '0', '0'
        ]);
      }
      // 最后一根K线成交量较大
      data15M[19][5] = '2000'; // 成交量

      const result = ictCore.checkVolumeConfirmation(data15M);

      expect(result).toBe(true);
    });

    test('应该拒绝成交量不足', () => {
      const now = Date.now();
      const data15M = [
        [now - 1800000, '50000', '51000', '49000', '50500', '1000', now - 1200000, '5000', 100, '0', '0', '0'],
        [now - 900000, '50500', '52000', '50000', '51500', '500', now - 300000, '2500', 50, '0', '0', '0'],
        [now, '51500', '53000', '51000', '52500', '800', now + 600000, '4000', 80, '0', '0', '0']
      ];

      const result = ictCore.checkVolumeConfirmation(data15M);

      expect(result).toBe(false);
    });
  });
});