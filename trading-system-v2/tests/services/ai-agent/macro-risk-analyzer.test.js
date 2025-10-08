/**
 * 宏观风险分析器单元测试
 */

const MacroRiskAnalyzer = require('../../../src/services/ai-agent/macro-risk-analyzer');

describe('MacroRiskAnalyzer', () => {
  let analyzer;
  let mockClaudeClient;
  let mockAIOps;

  beforeEach(() => {
    mockClaudeClient = {
      analyze: jest.fn()
    };

    mockAIOps = {
      saveAnalysis: jest.fn().mockResolvedValue(1),
      saveAPILog: jest.fn().mockResolvedValue(1)
    };

    analyzer = new MacroRiskAnalyzer(mockClaudeClient, mockAIOps);
  });

  describe('inferRiskLevel', () => {
    test('应该正确推断风险等级', () => {
      expect(analyzer.inferRiskLevel('市场极度危险')).toBe('EXTREME');
      expect(analyzer.inferRiskLevel('当前处于危险状态')).toBe('DANGER');
      expect(analyzer.inferRiskLevel('需要观察市场')).toBe('WATCH');
      expect(analyzer.inferRiskLevel('市场安全')).toBe('SAFE');
    });
  });

  describe('normalizeRiskLevel', () => {
    test('应该标准化风险等级', () => {
      expect(analyzer.normalizeRiskLevel('SAFE')).toBe('SAFE');
      expect(analyzer.normalizeRiskLevel('安全')).toBe('SAFE');
      expect(analyzer.normalizeRiskLevel('观察')).toBe('WATCH');
      expect(analyzer.normalizeRiskLevel('WARNING')).toBe('WATCH');
      expect(analyzer.normalizeRiskLevel('危险')).toBe('DANGER');
      expect(analyzer.normalizeRiskLevel('极度危险')).toBe('EXTREME');
    });

    test('无效等级应该返回WATCH', () => {
      expect(analyzer.normalizeRiskLevel('UNKNOWN')).toBe('WATCH');
      expect(analyzer.normalizeRiskLevel('随便什么')).toBe('WATCH');
    });
  });

  describe('shouldTriggerAlert', () => {
    test('危险等级应该触发告警', () => {
      expect(analyzer.shouldTriggerAlert('DANGER')).toBe(true);
      expect(analyzer.shouldTriggerAlert('EXTREME')).toBe(true);
    });

    test('安全和观察等级不应触发告警', () => {
      expect(analyzer.shouldTriggerAlert('SAFE')).toBe(false);
      expect(analyzer.shouldTriggerAlert('WATCH')).toBe(false);
    });
  });

  describe('getAlertType', () => {
    test('应该返回正确的告警类型', () => {
      expect(analyzer.getAlertType('EXTREME')).toBe('RISK_CRITICAL');
      expect(analyzer.getAlertType('DANGER')).toBe('RISK_WARNING');
    });
  });

  describe('parseResponse', () => {
    test('应该正确解析JSON响应', () => {
      const jsonResponse = JSON.stringify({
        coreFinding: '测试发现',
        riskLevel: 'WATCH',
        confidence: 85
      });

      const result = analyzer.parseResponse(jsonResponse, 'BTCUSDT');
      
      expect(result.coreFinding).toBe('测试发现');
      expect(result.riskLevel).toBe('WATCH');
      expect(result.confidence).toBe(85);
    });

    test('应该从文本中提取JSON', () => {
      const mixedResponse = `
        一些文本描述
        {
          "coreFinding": "市场分析",
          "riskLevel": "SAFE"
        }
        更多文本
      `;

      const result = analyzer.parseResponse(mixedResponse, 'ETHUSDT');
      
      expect(result.coreFinding).toBe('市场分析');
      expect(result.riskLevel).toBe('SAFE');
    });

    test('无法解析时应该返回文本解析结果', () => {
      const textResponse = '这是一个危险的市场状态';
      
      const result = analyzer.parseResponse(textResponse, 'BTCUSDT');
      
      expect(result.riskLevel).toBe('DANGER');
      expect(result.rawText).toBe(textResponse);
    });
  });

  describe('buildUserPrompt', () => {
    test('应该构建正确的用户提示词', () => {
      const marketData = {
        currentPrice: 50000,
        priceChange24h: 2.5,
        volume24h: 1000000000,
        fundingRate: 0.0001
      };

      const prompt = analyzer.buildUserPrompt('BTCUSDT', marketData);

      expect(prompt).toContain('BTC');
      expect(prompt).toContain('50000');
      expect(prompt).toContain('2.5');
      expect(prompt).toContain('1000000000');
    });
  });
});

