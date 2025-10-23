/**
 * ICT扫荡方向过滤器单元测试
 * 测试扫荡方向是否与趋势正确匹配
 */

const SweepDirectionFilter = require('../src/strategies/ict-sweep-filter');

describe('ICT Sweep Direction Filter', () => {
  describe('isValidSweepDirection', () => {
    // 上升趋势测试
    test('上升趋势应拒绝上方扫荡（诱多陷阱）', () => {
      const result = SweepDirectionFilter.isValidSweepDirection('UP', 'LIQUIDITY_SWEEP_UP');
      expect(result).toBe(false);
    });

    test('上升趋势应接受下方扫荡（买入机会）', () => {
      const result = SweepDirectionFilter.isValidSweepDirection('UP', 'LIQUIDITY_SWEEP_DOWN');
      expect(result).toBe(true);
    });

    // 下降趋势测试
    test('下降趋势应接受上方扫荡（卖出机会）', () => {
      const result = SweepDirectionFilter.isValidSweepDirection('DOWN', 'LIQUIDITY_SWEEP_UP');
      expect(result).toBe(true);
    });

    test('下降趋势应拒绝下方扫荡（诱空陷阱）', () => {
      const result = SweepDirectionFilter.isValidSweepDirection('DOWN', 'LIQUIDITY_SWEEP_DOWN');
      expect(result).toBe(false);
    });

    // 震荡市测试
    test('震荡市应拒绝任何扫荡', () => {
      const upResult = SweepDirectionFilter.isValidSweepDirection('RANGE', 'LIQUIDITY_SWEEP_UP');
      const downResult = SweepDirectionFilter.isValidSweepDirection('RANGE', 'LIQUIDITY_SWEEP_DOWN');
      expect(upResult).toBe(false);
      expect(downResult).toBe(false);
    });

    // 边界情况测试
    test('无扫荡信号应返回false', () => {
      const result = SweepDirectionFilter.isValidSweepDirection('UP', null);
      expect(result).toBe(false);
    });

    test('未知趋势应返回false', () => {
      const result = SweepDirectionFilter.isValidSweepDirection('UNKNOWN', 'LIQUIDITY_SWEEP_UP');
      expect(result).toBe(false);
    });
  });

  describe('validateSweep', () => {
    test('上升趋势+下方扫荡应返回有效', () => {
      const sweepResult = {
        detected: true,
        type: 'LIQUIDITY_SWEEP_DOWN',
        level: 100,
        confidence: 0.8
      };

      const result = SweepDirectionFilter.validateSweep('UP', sweepResult);

      expect(result.valid).toBe(true);
      expect(result.direction).toBe('LIQUIDITY_SWEEP_DOWN');
      expect(result.level).toBe(100);
      expect(result.confidence).toBe(0.8);
      expect(result.reason).toContain('买入机会');
    });

    test('上升趋势+上方扫荡应返回无效', () => {
      const sweepResult = {
        detected: true,
        type: 'LIQUIDITY_SWEEP_UP',
        level: 120,
        confidence: 0.7
      };

      const result = SweepDirectionFilter.validateSweep('UP', sweepResult);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('诱多陷阱');
    });

    test('无扫荡检测应返回无效', () => {
      const sweepResult = {
        detected: false,
        type: null
      };

      const result = SweepDirectionFilter.validateSweep('UP', sweepResult);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('未检测到有效扫荡');
    });

    test('null扫荡结果应返回无效', () => {
      const result = SweepDirectionFilter.validateSweep('UP', null);

      expect(result.valid).toBe(false);
      expect(result.direction).toBeNull();
    });
  });

  describe('getSweepExplanation', () => {
    test('有效的上升趋势+下方扫荡应返回正确说明', () => {
      const explanation = SweepDirectionFilter.getSweepExplanation('UP', 'LIQUIDITY_SWEEP_DOWN', true);
      expect(explanation).toContain('✅');
      expect(explanation).toContain('买入机会');
      expect(explanation).toContain('机构吸筹');
    });

    test('无效的上升趋势+上方扫荡应返回警告', () => {
      const explanation = SweepDirectionFilter.getSweepExplanation('UP', 'LIQUIDITY_SWEEP_UP', false);
      expect(explanation).toContain('⚠️');
      expect(explanation).toContain('诱多陷阱');
    });

    test('有效的下降趋势+上方扫荡应返回正确说明', () => {
      const explanation = SweepDirectionFilter.getSweepExplanation('DOWN', 'LIQUIDITY_SWEEP_UP', true);
      expect(explanation).toContain('✅');
      expect(explanation).toContain('卖出机会');
      expect(explanation).toContain('机构出货');
    });

    test('无效的下降趋势+下方扫荡应返回警告', () => {
      const explanation = SweepDirectionFilter.getSweepExplanation('DOWN', 'LIQUIDITY_SWEEP_DOWN', false);
      expect(explanation).toContain('⚠️');
      expect(explanation).toContain('诱空陷阱');
    });

    test('震荡市应返回不适用说明', () => {
      const explanation = SweepDirectionFilter.getSweepExplanation('RANGE', 'LIQUIDITY_SWEEP_UP', false);
      expect(explanation).toContain('震荡市');
    });
  });

  describe('getRecommendedDirection', () => {
    test('上升趋势+下方扫荡应推荐BUY', () => {
      const direction = SweepDirectionFilter.getRecommendedDirection('UP', 'LIQUIDITY_SWEEP_DOWN');
      expect(direction).toBe('BUY');
    });

    test('下降趋势+上方扫荡应推荐SELL', () => {
      const direction = SweepDirectionFilter.getRecommendedDirection('DOWN', 'LIQUIDITY_SWEEP_UP');
      expect(direction).toBe('SELL');
    });

    test('方向不匹配应返回null', () => {
      const direction1 = SweepDirectionFilter.getRecommendedDirection('UP', 'LIQUIDITY_SWEEP_UP');
      const direction2 = SweepDirectionFilter.getRecommendedDirection('DOWN', 'LIQUIDITY_SWEEP_DOWN');
      expect(direction1).toBeNull();
      expect(direction2).toBeNull();
    });

    test('震荡市应返回null', () => {
      const direction = SweepDirectionFilter.getRecommendedDirection('RANGE', 'LIQUIDITY_SWEEP_DOWN');
      expect(direction).toBeNull();
    });
  });

  describe('实际场景模拟', () => {
    test('场景1: BTCUSDT上升趋势中检测到下方扫荡', () => {
      const trend = 'UP';
      const sweepResult = {
        detected: true,
        type: 'LIQUIDITY_SWEEP_DOWN',
        level: 66500,
        confidence: 0.85,
        speed: 150
      };

      const validation = SweepDirectionFilter.validateSweep(trend, sweepResult);
      const recommendedDirection = SweepDirectionFilter.getRecommendedDirection(trend, sweepResult.type);

      expect(validation.valid).toBe(true);
      expect(recommendedDirection).toBe('BUY');
      expect(validation.reason).toContain('买入机会');
    });

    test('场景2: ETHUSDT上升趋势中检测到上方扫荡（应拒绝）', () => {
      const trend = 'UP';
      const sweepResult = {
        detected: true,
        type: 'LIQUIDITY_SWEEP_UP',
        level: 3600,
        confidence: 0.7,
        speed: 30
      };

      const validation = SweepDirectionFilter.validateSweep(trend, sweepResult);
      const recommendedDirection = SweepDirectionFilter.getRecommendedDirection(trend, sweepResult.type);

      expect(validation.valid).toBe(false);
      expect(recommendedDirection).toBeNull();
      expect(validation.reason).toContain('诱多陷阱');
    });

    test('场景3: SOLUSDT下降趋势中检测到上方扫荡', () => {
      const trend = 'DOWN';
      const sweepResult = {
        detected: true,
        type: 'LIQUIDITY_SWEEP_UP',
        level: 140,
        confidence: 0.9,
        speed: 2.5
      };

      const validation = SweepDirectionFilter.validateSweep(trend, sweepResult);
      const recommendedDirection = SweepDirectionFilter.getRecommendedDirection(trend, sweepResult.type);

      expect(validation.valid).toBe(true);
      expect(recommendedDirection).toBe('SELL');
      expect(validation.reason).toContain('卖出机会');
    });
  });
});

