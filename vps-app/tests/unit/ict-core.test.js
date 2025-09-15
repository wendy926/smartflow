// ict-core.test.js - ICT核心逻辑单元测试

const ICTCore = require('../../src/core/modules/strategy/ict-trading/ICTCore');

describe('ICTCore 核心逻辑测试', () => {
  let ictCore;
  let mockDatabase;

  beforeEach(() => {
    mockDatabase = {
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn()
    };
    ictCore = new ICTCore(mockDatabase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('趋势检测 (detectTrend)', () => {
    test('应该正确识别上升趋势', () => {
      const data = [
        [1640995200000, '50000', '51000', '49000', '50500', '1000', 1640995259999, '5000', 100, '0', '0', '0'],
        [1640995260000, '50500', '52000', '50000', '51500', '1200', 1640995319999, '6000', 120, '0', '0', '0'],
        [1640995320000, '51500', '53000', '51000', '52500', '1500', 1640995379999, '7500', 150, '0', '0', '0']
      ];

      const result = ictCore.detectTrend(data, 3);

      expect(result.trend).toBe('up');
      expect(result.score).toBe(3);
      expect(result.first).toBe(50000);
      expect(result.last).toBe(52500);
    });

    test('应该正确识别下降趋势', () => {
      const data = [
        [1640995200000, '50000', '51000', '49000', '50500', '1000', 1640995259999, '5000', 100, '0', '0', '0'],
        [1640995260000, '50500', '52000', '50000', '51500', '1200', 1640995319999, '6000', 120, '0', '0', '0'],
        [1640995320000, '51500', '50000', '49000', '49500', '1500', 1640995379999, '7500', 150, '0', '0', '0']
      ];

      const result = ictCore.detectTrend(data, 3);

      expect(result.trend).toBe('down');
      expect(result.score).toBe(3);
    });

    test('应该正确识别震荡趋势', () => {
      const data = [
        [1640995200000, '50000', '51000', '49000', '50500', '1000', 1640995259999, '5000', 100, '0', '0', '0'],
        [1640995260000, '50500', '52000', '50000', '51500', '1200', 1640995319999, '6000', 120, '0', '0', '0'],
        [1640995320000, '51500', '52000', '51000', '51200', '1500', 1640995379999, '7500', 150, '0', '0', '0']
      ];

      const result = ictCore.detectTrend(data, 3);

      expect(result.trend).toBe('sideways');
      expect(result.score).toBeLessThan(3);
    });

    test('应该处理数据不足的情况', () => {
      const data = [
        [1640995200000, '50000', '51000', '49000', '50500', '1000', 1640995259999, '5000', 100, '0', '0', '0']
      ];

      const result = ictCore.detectTrend(data, 3);

      expect(result.trend).toBe('sideways');
      expect(result.error).toBe('数据不足');
    });
  });

  describe('OB检测 (detectOB)', () => {
    test('应该检测到有效的OB', () => {
      const data4H = [
        [1640995200000, '50000', '52000', '49000', '51000', '1000', 1640995259999, '5000', 100, '0', '0', '0'],
        [1640998800000, '51000', '53000', '50000', '52000', '1200', 1640998859999, '6000', 120, '0', '0', '0']
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
      const data4H = [
        [1640995200000, '50000', '50100', '49900', '50050', '1000', 1640995259999, '5000', 100, '0', '0', '0'],
        [1640998800000, '50050', '50150', '49950', '50100', '1200', 1640998859999, '6000', 120, '0', '0', '0']
      ];
      const atr4h = 1000;

      const result = ictCore.detectOB(data4H, atr4h, 30);

      expect(result).toBeNull();
    });

    test('应该过滤掉过期的OB', () => {
      const oldTime = Date.now() - (31 * 24 * 60 * 60 * 1000); // 31天前
      const data4H = [
        [oldTime, '50000', '52000', '49000', '51000', '1000', oldTime + 59999, '5000', 100, '0', '0', '0'],
        [oldTime + 3600000, '51000', '53000', '50000', '52000', '1200', oldTime + 3659999, '6000', 120, '0', '0', '0']
      ];
      const atr4h = 1000;

      const result = ictCore.detectOB(data4H, atr4h, 30);

      expect(result).toBeNull();
    });
  });

  describe('FVG检测 (detectFVG)', () => {
    test('应该检测到上升FVG', () => {
      const data4H = [
        [1640995200000, '50000', '51000', '49000', '50500', '1000', 1640995259999, '5000', 100, '0', '0', '0'],
        [1640998800000, '50500', '52000', '50000', '51500', '1200', 1640998859999, '6000', 120, '0', '0', '0'],
        [1641002400000, '51500', '53000', '51000', '52500', '1500', 1641002459999, '7500', 150, '0', '0', '0']
      ];

      const result = ictCore.detectFVG(data4H);

      expect(result).toBeTruthy();
      expect(result.type).toBe('bullish');
      expect(result.low).toBe(51000);
      expect(result.high).toBe(50000);
      expect(result.height).toBe(1000);
    });

    test('应该检测到下降FVG', () => {
      const data4H = [
        [1640995200000, '50000', '51000', '49000', '50500', '1000', 1640995259999, '5000', 100, '0', '0', '0'],
        [1640998800000, '50500', '50000', '48000', '48500', '1200', 1640998859999, '6000', 120, '0', '0', '0'],
        [1641002400000, '48500', '49000', '47000', '47500', '1500', 1641002459999, '7500', 150, '0', '0', '0']
      ];

      const result = ictCore.detectFVG(data4H);

      expect(result).toBeTruthy();
      expect(result.type).toBe('bearish');
      expect(result.low).toBe(50000);
      expect(result.high).toBe(48000);
      expect(result.height).toBe(2000);
    });

    test('应该在没有FVG时返回null', () => {
      const data4H = [
        [1640995200000, '50000', '51000', '49000', '50500', '1000', 1640995259999, '5000', 100, '0', '0', '0'],
        [1640998800000, '50500', '52000', '50000', '51500', '1200', 1640998859999, '6000', 120, '0', '0', '0']
      ];

      const result = ictCore.detectFVG(data4H);

      expect(result).toBeNull();
    });
  });

  describe('吞没形态检测 (detectEngulfing)', () => {
    test('应该检测到多头吞没', () => {
      const data15M = [
        [1640995200000, '50000', '50500', '49500', '49800', '1000', 1640995259999, '5000', 100, '0', '0', '0'],
        [1640995260000, '49800', '51000', '49500', '50800', '1200', 1640995319999, '6000', 120, '0', '0', '0']
      ];
      const atr15 = 500;

      const result = ictCore.detectEngulfing(data15M, atr15, 'up');

      expect(result.detected).toBe(true);
      expect(result.trend).toBe('up');
      expect(result.bodyRatio).toBeGreaterThan(1.5);
    });

    test('应该检测到空头吞没', () => {
      const data15M = [
        [1640995200000, '50000', '50500', '49500', '50200', '1000', 1640995259999, '5000', 100, '0', '0', '0'],
        [1640995260000, '50200', '50500', '49000', '49200', '1200', 1640995319999, '6000', 120, '0', '0', '0']
      ];
      const atr15 = 500;

      const result = ictCore.detectEngulfing(data15M, atr15, 'down');

      expect(result.detected).toBe(true);
      expect(result.trend).toBe('down');
    });

    test('应该过滤掉实体太小的吞没', () => {
      const data15M = [
        [1640995200000, '50000', '50500', '49500', '49800', '1000', 1640995259999, '5000', 100, '0', '0', '0'],
        [1640995260000, '49800', '50000', '49600', '49900', '1200', 1640995319999, '6000', 120, '0', '0', '0']
      ];
      const atr15 = 500;

      const result = ictCore.detectEngulfing(data15M, atr15, 'up');

      expect(result.detected).toBe(false);
      expect(result.reason).toBe('实体太小');
    });
  });

  describe('Sweep检测 (detectSweepHTF)', () => {
    test('应该检测到有效的4H Sweep', () => {
      const data4H = Array.from({ length: 25 }, (_, i) => {
        const time = 1640995200000 + (i * 4 * 60 * 60 * 1000);
        const basePrice = 50000;
        const high = basePrice + (i < 20 ? 1000 : 2000); // 前20根正常，后5根有突破
        return [time, basePrice, high, basePrice - 500, basePrice + 200, '1000', time + 59999, '5000', 100, '0', '0', '0'];
      });
      const atr4h = 1000;

      const result = ictCore.detectSweepHTF(data4H, atr4h);

      expect(result).toBe(true);
    });

    test('应该检测到有效的15m Sweep', () => {
      const data15M = Array.from({ length: 25 }, (_, i) => {
        const time = 1640995200000 + (i * 15 * 60 * 1000);
        const basePrice = 50000;
        const high = basePrice + (i < 20 ? 100 : 500); // 前20根正常，后5根有突破
        return [time, basePrice, high, basePrice - 50, basePrice + 20, '1000', time + 59999, '5000', 100, '0', '0', '0'];
      });
      const atr15 = 200;

      const result = ictCore.detectSweepLTF(data15M, atr15);

      expect(result.detected).toBe(true);
      expect(result.speed).toBeGreaterThan(0);
    });
  });

  describe('ATR计算 (calculateATR)', () => {
    test('应该正确计算ATR', () => {
      const data = [
        [1640995200000, '50000', '51000', '49000', '50500', '1000', 1640995259999, '5000', 100, '0', '0', '0'],
        [1640995260000, '50500', '52000', '50000', '51500', '1200', 1640995319999, '6000', 120, '0', '0', '0'],
        [1640995320000, '51500', '53000', '51000', '52500', '1500', 1640995379999, '7500', 150, '0', '0', '0']
      ];

      const atr = ictCore.calculateATR(data, 3);

      expect(atr).toBeGreaterThan(0);
      expect(typeof atr).toBe('number');
    });

    test('应该处理数据不足的情况', () => {
      const data = [
        [1640995200000, '50000', '51000', '49000', '50500', '1000', 1640995259999, '5000', 100, '0', '0', '0']
      ];

      const atr = ictCore.calculateATR(data, 3);

      expect(atr).toBe(0);
    });
  });

  describe('OB年龄检查 (checkOBAge)', () => {
    test('应该通过年龄检查', () => {
      const ob = {
        time: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 1天前
      };
      const fvg = {
        time: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() // 12小时前
      };

      const result = ictCore.checkOBAge(ob, fvg);

      expect(result.valid).toBe(true);
      expect(result.age).toBeLessThanOrEqual(1);
    });

    test('应该拒绝过期的OB', () => {
      const ob = {
        time: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() // 3天前
      };
      const fvg = null;

      const result = ictCore.checkOBAge(ob, fvg);

      expect(result.valid).toBe(false);
      expect(result.age).toBeGreaterThan(2);
    });
  });

  describe('成交量确认 (checkVolumeConfirmation)', () => {
    test('应该确认成交量', () => {
      const data15M = Array.from({ length: 25 }, (_, i) => {
        const time = 1640995200000 + (i * 15 * 60 * 1000);
        const volume = i === 24 ? 2000 : 1000; // 最后一根成交量翻倍
        return [time, '50000', '51000', '49000', '50500', volume.toString(), time + 59999, '5000', 100, '0', '0', '0'];
      });

      const result = ictCore.checkVolumeConfirmation(data15M);

      expect(result).toBe(true);
    });

    test('应该拒绝成交量不足', () => {
      const data15M = Array.from({ length: 25 }, (_, i) => {
        const time = 1640995200000 + (i * 15 * 60 * 1000);
        const volume = 1000; // 所有成交量相同
        return [time, '50000', '51000', '49000', '50500', volume.toString(), time + 59999, '5000', 100, '0', '0', '0'];
      });

      const result = ictCore.checkVolumeConfirmation(data15M);

      expect(result).toBe(false);
    });
  });
});
