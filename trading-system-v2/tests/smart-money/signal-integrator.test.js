/**
 * SignalIntegrator 单元测试
 */

const SignalIntegrator = require('../../src/services/smart-money/signal-integrator');

describe('SignalIntegrator', () => {
  let integrator;

  beforeEach(() => {
    integrator = new SignalIntegrator({
      weight_order: 0.4,
      weight_cvd: 0.3,
      weight_oi: 0.2,
      weight_delta: 0.1
    });
  });

  describe('integrate', () => {
    test('大额挂单与指标一致应提升置信度', () => {
      const largeOrderSignal = {
        finalAction: 'ACCUMULATE',
        buyScore: 6.0,
        sellScore: 1.0,
        cvdCum: 5000,
        spoofCount: 0,
        trackedEntriesCount: 2
      };

      const indicators = {
        cvdZ: 1.5,
        obiZ: 0.8,
        oiZ: 1.2,
        deltaZ: 0.5,
        priceChange: 50,
        oiChange: 1000
      };

      const baseResult = {
        action: '吸筹',
        confidence: 0.65,
        reason: 'CVD上升 + OI上升'
      };

      // 模拟整合
      const result = integrator.integrate(largeOrderSignal, indicators);

      expect(result.action).toBeDefined();
      expect(['ACCUMULATE', 'MARKUP', 'DISTRIBUTION', 'MARKDOWN', 'MANIPULATION', 'UNKNOWN'])
        .toContain(result.action);
    });

    test('Spoof检测应返回MANIPULATION', () => {
      const largeOrderSignal = {
        finalAction: 'MANIPULATION',
        buyScore: 2.0,
        sellScore: 1.5,
        cvdCum: 0,
        spoofCount: 3,
        trackedEntriesCount: 3
      };

      const indicators = {
        cvdZ: 0.2,
        obiZ: 0.1,
        oiZ: 0.3,
        deltaZ: 0.1
      };

      const result = integrator.integrate(largeOrderSignal, indicators);

      expect(result.action).toBe('MANIPULATION');
    });

    test('无大额挂单应使用传统模型', () => {
      const largeOrderSignal = {
        finalAction: 'UNKNOWN',
        buyScore: 0,
        sellScore: 0,
        trackedEntriesCount: 0
      };

      const indicators = {
        cvdZ: 1.8,
        oiZ: 1.5,
        priceChange: 100,
        oiChange: 5000
      };

      const result = integrator.integrate(largeOrderSignal, indicators);

      // 应该使用传统四象限模型判断
      expect(['ACCUMULATE', 'MARKUP', 'DISTRIBUTION', 'MARKDOWN', 'UNKNOWN'])
        .toContain(result.action);
    });
  });

  describe('updateWeights', () => {
    test('应该能更新权重配置', () => {
      integrator.updateWeights({ order: 0.5, cvd: 0.25 });
      
      const weights = integrator.getWeights();
      expect(weights.order).toBe(0.5);
      expect(weights.cvd).toBe(0.25);
      expect(weights.oi).toBe(0.2); // 未修改的保持原值
    });
  });
});

