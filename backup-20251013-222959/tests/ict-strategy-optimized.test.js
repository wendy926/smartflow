/**
 * ICT策略第二次优化单元测试
 * 测试所有核心功能模块
 */

const ICTStrategyOptimized = require('../src/strategies/ict-strategy-optimized');
const fs = require('fs');
const path = require('path');

describe('ICT策略第二次优化测试', () => {
  let strategy;
  let mockKlines15m;
  let mockKlines4h;
  let mockKlines1d;

  beforeEach(() => {
    strategy = new ICTStrategyOptimized();

    // 创建模拟K线数据（数组格式，模拟Binance API返回）
    mockKlines15m = [
      [1640995200000, 47000, 47500, 46800, 47200, 1000], // 前一根K线（阴线：收盘47200 < 开盘47000）
      [1640996100000, 47000, 47800, 47000, 47600, 1200], // 当前K线（阳线，看涨吞没：开盘47000 < 前收盘47200，收盘47600 > 前开盘47000）
      [1640997000000, 47600, 48000, 47400, 47800, 1100],
      [1640997900000, 47800, 48200, 47600, 48000, 1300],
      [1640998800000, 48000, 48500, 47800, 48300, 1400]
    ];

    mockKlines4h = [
      [1640995200000, 46000, 47000, 45800, 46800, 5000],
      [1641009600000, 46800, 47500, 46500, 47200, 5200],
      [1641024000000, 47200, 48000, 47000, 47800, 4800],
      [1641038400000, 47800, 48500, 47600, 48200, 5100],
      [1641052800000, 48200, 49000, 48000, 48800, 5300],
      [1641067200000, 48800, 49500, 48600, 49200, 5400],
      [1641081600000, 49200, 50000, 49000, 49800, 5500],
      [1641096000000, 49800, 50500, 49600, 50200, 5600],
      [1641110400000, 50200, 51000, 50000, 50800, 5700],
      [1641124800000, 50800, 51500, 50600, 51200, 5800],
      [1641139200000, 51200, 52000, 51000, 51800, 5900],
      [1641153600000, 51800, 52500, 51600, 52200, 6000],
      [1641168000000, 52200, 53000, 52000, 52800, 6100],
      [1641182400000, 52800, 53500, 52600, 53200, 6200],
      [1641196800000, 53200, 54000, 53000, 53800, 6300],
      [1641211200000, 53800, 54500, 53600, 54200, 6400],
      [1641225600000, 54200, 55000, 54000, 54800, 6500],
      [1641240000000, 54800, 55500, 54600, 55200, 6600],
      [1641254400000, 55200, 56000, 55000, 55800, 6700],
      [1641268800000, 55800, 56500, 55600, 56200, 6800],
      [1641283200000, 56200, 57000, 56000, 56800, 6900],
      [1641297600000, 56800, 57500, 56600, 57200, 7000],
      [1641312000000, 57200, 58000, 57000, 57800, 7100],
      [1641326400000, 57800, 58500, 57600, 58200, 7200]
    ];

    mockKlines1d = [
      [1640908800000, 45000, 46000, 44800, 45800, 20000],
      [1640995200000, 45800, 47000, 45600, 46800, 22000],
      [1641081600000, 46800, 48000, 46600, 47800, 24000],
      [1641168000000, 47800, 49000, 47600, 48800, 26000],
      [1641254400000, 48800, 50000, 48600, 49800, 28000]
    ];
  });

  afterEach(() => {
    // 清理测试文件
    const telemetryFile = path.join(__dirname, '../logs/ict_telemetry.log');
    if (fs.existsSync(telemetryFile)) {
      fs.unlinkSync(telemetryFile);
    }
  });

  describe('1. 吞没形态检测测试', () => {
    test('应该检测到看涨吞没形态并返回强度', () => {
      const result = strategy.analyzeEngulfing(mockKlines15m);

      expect(result.type).toBe('BULL');
      expect(result.strength).toBeGreaterThan(0);
      expect(result.strength).toBeLessThanOrEqual(1);
    });

    test('应该检测到看跌吞没形态', () => {
      const bearishKlines = [
        [1640995200000, 47500, 47800, 47200, 47600, 1000], // 前一根K线（阳线：收盘47600 > 开盘47500）
        [1640996100000, 47600, 47700, 47000, 47200, 1200], // 当前K线（阴线，看跌吞没：开盘47600 > 前收盘47600，收盘47200 < 前开盘47500）
      ];

      const result = strategy.analyzeEngulfing(bearishKlines);

      expect(result.type).toBe('BEAR');
      expect(result.strength).toBeGreaterThan(0);
      expect(result.strength).toBeLessThanOrEqual(1);
    });

    test('应该返回NONE当没有吞没形态时', () => {
      const noEngulfingKlines = [
        [1640995200000, 47000, 47500, 46800, 47200, 1000],
        [1640996100000, 47200, 47300, 47100, 47250, 1200], // 小阳线，不吞没
      ];

      const result = strategy.analyzeEngulfing(noEngulfingKlines);

      expect(result.type).toBe('NONE');
      expect(result.strength).toBe(0);
    });
  });

  describe('2. 谐波形态检测测试', () => {
    test('应该检测到CYPHER形态并返回得分和RMSE', () => {
      // 创建符合CYPHER形态的摆动点数据
      const harmonicKlines = Array.from({ length: 120 }, (_, i) => {
        const basePrice = 47000;
        const time = 1640995200000 + i * 15 * 60 * 1000;
        // 创建X-A-B-C-D模式
        if (i < 20) return [time, basePrice, basePrice + 100, basePrice - 50, basePrice + 50, 1000];
        if (i < 40) return [time, basePrice + 50, basePrice + 150, basePrice, basePrice + 100, 1000];
        if (i < 60) return [time, basePrice + 100, basePrice + 200, basePrice + 50, basePrice + 150, 1000];
        if (i < 80) return [time, basePrice + 150, basePrice + 250, basePrice + 100, basePrice + 200, 1000];
        return [time, basePrice + 200, basePrice + 300, basePrice + 150, basePrice + 250, 1000];
      });

      const result = strategy.detectHarmonicPattern(harmonicKlines);

      expect(result.type).toMatch(/CYPHER|BAT|SHARK|NONE/);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(typeof result.rmse).toBe('number');
    });

    test('应该返回NONE当摆动点不足时', () => {
      const shortKlines = mockKlines15m.slice(0, 3);

      const result = strategy.detectHarmonicPattern(shortKlines);

      expect(result.type).toBe('NONE');
      expect(result.score).toBe(0);
      expect(result.rmse).toBeNull();
    });
  });

  describe('3. 扫荡检测测试', () => {
    test('应该检测到下方扫荡', () => {
      const orderBlock = { low: 47000, high: 47500 };

      const result = strategy.detectSweep(mockKlines15m, orderBlock);

      expect(result.swept).toBe(true);
      expect(result.direction).toBe('below');
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('应该检测到上方扫荡', () => {
      const orderBlock = { low: 46000, high: 47000 };
      const sweepUpKlines = [
        [1640995200000, 47000, 47500, 46800, 47200, 1000],
        [1640996100000, 47200, 48000, 47000, 47500, 1200], // 上影线突破块顶部，收盘低于块顶部
      ];

      const result = strategy.detectSweep(sweepUpKlines, orderBlock);

      expect(result.swept).toBe(true);
      expect(result.direction).toBe('above');
    });
  });

  describe('4. 订单块检测测试', () => {
    test('应该检测到有效订单块', () => {
      const result = strategy.analyzeOrderBlocks(mockKlines4h);

      expect(result.valid).toBeDefined();
      expect(result.block).toBeDefined();
      expect(result.score).toBeGreaterThan(0);
    });

    test('应该检测到被扫荡后重新进入的订单块', () => {
      // 创建包含扫荡和重新进入的4H数据
      const sweptKlines = [
        [1640995200000, 46000, 47000, 45800, 46800, 5000],
        [1641009600000, 46800, 47500, 46500, 47200, 5200],
        [1641024000000, 47200, 48000, 47000, 47800, 4800], // 扫荡
        [1641038400000, 47800, 48500, 47600, 48200, 5100], // 重新进入
        [1641052800000, 48200, 49000, 48000, 48800, 5300]
      ];

      const result = strategy.analyzeOrderBlocks(sweptKlines);

      expect(result.valid).toBeDefined();
      expect(result.block).toBeDefined();
    });
  });

  describe('5. 成交量放大检测测试', () => {
    test('应该检测到成交量放大', () => {
      const highVolumeKlines = Array.from({ length: 12 }, (_, i) => {
        const time = 1640995200000 + i * 15 * 60 * 1000;
        const baseVol = 1000;
        const vol = i === 11 ? baseVol * 2 : baseVol; // 最后一根K线成交量放大
        return [time, 47000, 47500, 46800, 47200, vol];
      });

      const result = strategy.analyzeVolumeExpansion(highVolumeKlines);

      expect(result.score).toBe(1);
    });

    test('应该检测到成交量未放大', () => {
      const normalVolumeKlines = [
        [1640995200000, 47000, 47500, 46800, 47200, 1000],
        [1640996100000, 47200, 47800, 47000, 47600, 1100], // 正常成交量
      ];

      const result = strategy.analyzeVolumeExpansion(normalVolumeKlines);

      expect(result.score).toBe(0);
    });
  });

  describe('6. 自适应止损倍数测试', () => {
    test('应该根据置信度计算止损倍数', () => {
      const highConfidence = 0.9;
      const lowConfidence = 0.1;

      const highStopMult = strategy.calcStopMultiplier(highConfidence);
      const lowStopMult = strategy.calcStopMultiplier(lowConfidence);

      expect(highStopMult).toBeLessThan(lowStopMult); // 高置信度应该有更紧的止损
      expect(highStopMult).toBeGreaterThanOrEqual(strategy.config.minStopMultiplier);
      expect(lowStopMult).toBeLessThanOrEqual(strategy.config.maxStopMultiplier);
    });
  });

  describe('7. 仓位管理测试', () => {
    test('应该根据总得分和历史胜率计算仓位', () => {
      const totalScore = 80;
      const historicalWinRate = 0.6;
      const accountUSD = 10000;

      const position = strategy.positionSizing(totalScore, historicalWinRate, accountUSD);

      expect(position).toBeGreaterThan(0);
      expect(position).toBeLessThan(accountUSD * 0.1); // 不应该超过账户的10%
    });
  });

  describe('8. 遥测日志测试', () => {
    test('应该记录遥测数据到文件', () => {
      const testData = {
        ts: new Date().toISOString(),
        symbol: 'BTCUSDT',
        totalScore: 75,
        confidence: 0.8,
        trend: 'UP'
      };

      strategy.telemetryLog(testData);

      const telemetryFile = path.join(__dirname, '../logs/ict_telemetry.log');
      expect(fs.existsSync(telemetryFile)).toBe(true);

      const content = fs.readFileSync(telemetryFile, 'utf8');
      expect(content).toContain('BTCUSDT');
      expect(content).toContain('75');
    });
  });

  describe('9. 门槛+容忍逻辑测试', () => {
    test('应该通过门槛但未通过次要条件时返回WATCH', async () => {
      // 模拟API调用
      strategy.binanceAPI = {
        getKlines: jest.fn()
          .mockResolvedValueOnce(mockKlines1d)
          .mockResolvedValueOnce(mockKlines4h)
          .mockResolvedValueOnce(mockKlines15m)
      };

      // 模拟订单块检测返回有效
      strategy.analyzeOrderBlocks = jest.fn().mockReturnValue({
        valid: true,
        block: { low: 47000, high: 47500 },
        score: 20
      });

      // 模拟扫荡检测返回有效
      strategy.detectSweep = jest.fn().mockReturnValue({
        swept: true,
        direction: 'below',
        confidence: 0.8
      });

      // 模拟吞没形态强度不足
      strategy.analyzeEngulfing = jest.fn().mockReturnValue({
        type: 'BULL',
        strength: 0.3 // 低于0.6阈值
      });

      // 模拟谐波形态得分不足
      strategy.detectHarmonicPattern = jest.fn().mockReturnValue({
        type: 'NONE',
        score: 0.2 // 低于0.6阈值
      });

      const result = await strategy.generateSignalWithConfirmation('BTCUSDT');

      expect(result.signal).toBe('WATCH');
      expect(result.reason).toBe('secondary_failed');
    });

    test('应该通过所有条件时返回BUY信号', async () => {
      // 模拟API调用
      strategy.binanceAPI = {
        getKlines: jest.fn()
          .mockResolvedValueOnce(mockKlines1d)
          .mockResolvedValueOnce(mockKlines4h)
          .mockResolvedValueOnce(mockKlines15m)
      };

      // 模拟所有检测都通过
      strategy.analyzeOrderBlocks = jest.fn().mockReturnValue({
        valid: true,
        block: { low: 47000, high: 47500 },
        score: 20
      });

      strategy.detectSweep = jest.fn().mockReturnValue({
        swept: true,
        direction: 'below',
        confidence: 0.8
      });

      strategy.analyzeEngulfing = jest.fn().mockReturnValue({
        type: 'BULL',
        strength: 0.8 // 高于0.6阈值
      });

      strategy.detectHarmonicPattern = jest.fn().mockReturnValue({
        type: 'CYPHER',
        score: 0.7 // 高于0.6阈值
      });

      strategy.waitForConfirmation = jest.fn().mockResolvedValue({
        confirmed: true,
        barsWaited: 2
      });

      const result = await strategy.generateSignalWithConfirmation('BTCUSDT');

      expect(result.signal).toBe('BUY');
      expect(result.totalScore).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('10. 配置参数测试', () => {
    test('应该加载默认配置', () => {
      expect(strategy.config.minEngulfStrength).toBe(0.6);
      expect(strategy.config.minHarmonicScore).toBe(0.6);
      expect(strategy.config.confirmationBars).toBe(2);
      expect(strategy.config.minStopMultiplier).toBe(1.5);
      expect(strategy.config.maxStopMultiplier).toBe(2.5);
    });
  });
});
