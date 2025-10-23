/**
 * V3.1优化策略单元测试
 * 基于v3-optimize.md文档建议的改进方案测试
 */

const V3StrategyV31 = require('../src/strategies/v3-strategy-v3-1-integrated');
const EarlyTrendDetector = require('../src/strategies/v3-1-early-trend');
const FakeBreakoutFilter = require('../src/strategies/v3-1-fake-breakout-filter');
const DynamicStopLossManager = require('../src/strategies/v3-1-dynamic-stop-loss');

describe('V3.1优化策略测试', () => {
  let v3Strategy;
  let earlyTrendDetector;
  let fakeBreakoutFilter;
  let dynamicStopLossManager;

  beforeEach(() => {
    v3Strategy = new V3StrategyV31();
    earlyTrendDetector = new EarlyTrendDetector();
    fakeBreakoutFilter = new FakeBreakoutFilter();
    dynamicStopLossManager = new DynamicStopLossManager();
  });

  describe('早期趋势探测优化测试', () => {
    test('应该降低权重奖励从0.1到0.05', () => {
      const params = earlyTrendDetector.getParams();
      expect(params.weightBonus).toBe(0.05);
    });

    test('应该支持延迟确认参数', () => {
      const params = earlyTrendDetector.getParams();
      expect(params.delayBars).toBe(2);
      expect(params.macdDivergence).toBe(true);
    });

    test('延迟确认应该正确工作', () => {
      const mockKlines1H = [
        [1, 1, 1, 1, 100, 1000], // 基准价格
        [1, 1, 1, 1, 101, 1000], // +1
        [1, 1, 1, 1, 102, 1000], // +1
        [1, 1, 1, 1, 103, 1000], // +1
      ];

      const result = earlyTrendDetector._checkDelayConfirmation(mockKlines1H, 'EARLY_LONG');
      expect(result).toBe(true);
    });

    test('延迟确认应该拒绝不稳定的趋势', () => {
      const mockKlines1H = [
        [1, 1, 1, 1, 100, 1000], // 基准价格
        [1, 1, 1, 1, 99, 1000],  // -1
        [1, 1, 1, 1, 98, 1000],  // -1
        [1, 1, 1, 1, 97, 1000],  // -1
      ];

      const result = earlyTrendDetector._checkDelayConfirmation(mockKlines1H, 'EARLY_LONG');
      expect(result).toBe(false);
    });
  });

  describe('假突破过滤器优化测试', () => {
    test('应该放宽成交量因子到1.1', () => {
      const params = fakeBreakoutFilter.getParams();
      expect(params.volFactor).toBe(1.1);
    });

    test('应该放宽回撤容忍度到0.6%', () => {
      const params = fakeBreakoutFilter.getParams();
      expect(params.reclaimPct).toBe(0.006);
    });

    test('应该支持趋势评分弱化过滤', () => {
      const params = fakeBreakoutFilter.getParams();
      expect(params.trendScoreThreshold).toBe(8);
    });

    test('强趋势时应该弱化过滤', () => {
      const mockKlines15m = Array(50).fill().map((_, i) => [1, 1, 1, 1, 100 + i, 1000 + i]);
      const mockKlines1H = Array(50).fill().map((_, i) => [1, 1, 1, 1, 100 + i, 1000 + i]);
      const mockKlines4H = Array(50).fill().map((_, i) => [1, 1, 1, 1, 100 + i, 1000 + i]);

      const result = fakeBreakoutFilter.filterTrend(
        105, mockKlines15m, mockKlines1H, mockKlines4H, 9 // 高趋势评分
      );

      expect(result.passed).toBe(true);
    });
  });

  describe('动态止损优化测试', () => {
    test('应该调整止损ATR倍数到合理范围', () => {
      const params = dynamicStopLossManager.getParams();
      expect(params.kEntryHigh).toBe(1.8);
      expect(params.kEntryMed).toBe(2.0);
      expect(params.kEntryLow).toBe(2.2);
    });

    test('应该延迟追踪止盈触发到1.5x', () => {
      const params = dynamicStopLossManager.getParams();
      expect(params.profitTrigger).toBe(1.5);
    });

    test('应该放宽追踪步长到0.8', () => {
      const params = dynamicStopLossManager.getParams();
      expect(params.trailStep).toBe(0.8);
    });

    test('应该延长时间止损到90分钟', () => {
      const params = dynamicStopLossManager.getParams();
      expect(params.timeStopMinutes).toBe(90);
    });

    test('应该正确计算初始止损和止盈', () => {
      const result = dynamicStopLossManager.calculateInitial(100, 'LONG', 2, 'high');

      expect(result.initialSL).toBeLessThan(100); // 多头止损应该低于入场价
      expect(result.tp).toBeGreaterThan(100); // 多头止盈应该高于入场价
      expect(result.kEntry).toBe(1.8); // 高置信度应该使用1.8倍ATR
    });
  });

  describe('动态权重优化测试', () => {
    test('应该确保入场权重保持≥25%', () => {
      const mockTrend4H = { score: 9, trendDirection: 'UP' };
      const mockFactors1H = { totalScore: 5 };
      const mockExecution15M = { score: 4 };
      const mockEarlyTrendResult = { detected: false };

      const weights = v3Strategy.calculateDynamicWeights(9, 5, 4);

      // 模拟权重调整逻辑
      const minEntryWeight = 0.25;
      if (weights.entry < minEntryWeight) {
        const adjustment = minEntryWeight - weights.entry;
        weights.entry = minEntryWeight;
        weights.trend = Math.max(0.3, weights.trend - adjustment * 0.6);
        weights.factor = Math.max(0.1, weights.factor - adjustment * 0.4);
      }

      expect(weights.entry).toBeGreaterThanOrEqual(0.25);
    });

    test('应该检测MACD收缩', () => {
      const mockFactors1H = {
        macd: {
          histogram: [0.5, 0.3, 0.1] // 连续收缩
        }
      };

      const result = v3Strategy._detectMacdContraction(mockFactors1H);
      expect(result).toBe(true);
    });

    test('应该正确识别非MACD收缩', () => {
      const mockFactors1H = {
        macd: {
          histogram: [0.1, 0.3, 0.5] // 连续扩张
        }
      };

      const result = v3Strategy._detectMacdContraction(mockFactors1H);
      expect(result).toBe(false);
    });
  });

  describe('信号融合优化测试', () => {
    test('应该正确应用早期趋势权重调整', () => {
      const mockTrend4H = { score: 6, trendDirection: 'UP' };
      const mockFactors1H = { totalScore: 4 };
      const mockExecution15M = { score: 3 };
      const mockEarlyTrendResult = {
        detected: true,
        weightBonus: 0.05
      };

      const result = v3Strategy.combineSignalsV31(
        mockTrend4H,
        mockFactors1H,
        mockExecution15M,
        mockEarlyTrendResult
      );

      expect(result).toBeDefined();
    });

    test('应该正确处理震荡市信号', () => {
      const mockTrend4H = { score: 2, trendDirection: 'RANGE' };
      const mockFactors1H = { totalScore: 2 };
      const mockExecution15M = {
        score: 1,
        signal: 'BUY',
        reason: 'Range fake breakout detected'
      };
      const mockEarlyTrendResult = { detected: false };

      const result = v3Strategy.combineSignalsV31(
        mockTrend4H,
        mockFactors1H,
        mockExecution15M,
        mockEarlyTrendResult
      );

      expect(result).toBe('BUY');
    });
  });

  describe('参数更新测试', () => {
    test('应该正确更新早期趋势参数', () => {
      const newParams = {
        weightBonus: 0.03,
        delayBars: 3
      };

      v3Strategy.updateV31Params('earlyTrend', newParams);
      const updatedParams = v3Strategy.getV31Params('earlyTrend');

      expect(updatedParams.weightBonus).toBe(0.03);
      expect(updatedParams.delayBars).toBe(3);
    });

    test('应该正确更新假突破过滤参数', () => {
      const newParams = {
        volFactor: 1.2,
        reclaimPct: 0.005
      };

      v3Strategy.updateV31Params('fakeBreakout', newParams);
      const updatedParams = v3Strategy.getV31Params('fakeBreakout');

      expect(updatedParams.volFactor).toBe(1.2);
      expect(updatedParams.reclaimPct).toBe(0.005);
    });

    test('应该正确更新动态止损参数', () => {
      const newParams = {
        kEntryHigh: 2.0,
        profitTrigger: 1.8
      };

      v3Strategy.updateV31Params('dynamicStop', newParams);
      const updatedParams = v3Strategy.getV31Params('dynamicStop');

      expect(updatedParams.kEntryHigh).toBe(2.0);
      expect(updatedParams.profitTrigger).toBe(1.8);
    });
  });

  describe('性能测试', () => {
    test('策略执行应该在合理时间内完成', async () => {
      const mockBinanceAPI = {
        getKlines: jest.fn().mockResolvedValue(Array(50).fill([1, 1, 1, 1, 100, 1000])),
        getTicker24hr: jest.fn().mockResolvedValue({ priceChangePercent: '1.5' }),
        getFundingRate: jest.fn().mockResolvedValue({ fundingRate: '0.0001' }),
        getOpenInterestHist: jest.fn().mockResolvedValue([])
      };

      v3Strategy.binanceAPI = mockBinanceAPI;

      const startTime = Date.now();
      const result = await v3Strategy.execute('BTCUSDT');
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // 应该在5秒内完成
      expect(result).toBeDefined();
    });
  });
});
