/**
 * Claude客户端单元测试
 */

const ClaudeClient = require('../../../src/services/ai-agent/claude-client');

describe('ClaudeClient', () => {
  let claudeClient;

  beforeEach(() => {
    claudeClient = new ClaudeClient({
      apiKey: 'test-api-key',
      proxyUrl: 'https://api.anthropic.com',
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 1000,
      temperature: 0.3
    });
  });

  describe('初始化', () => {
    test('应该正确初始化配置', () => {
      expect(claudeClient.apiKey).toBe('test-api-key');
      expect(claudeClient.model).toBe('claude-3-5-sonnet-20241022');
      expect(claudeClient.maxTokens).toBe(1000);
      expect(claudeClient.temperature).toBe(0.3);
    });

    test('应该初始化统计信息', () => {
      expect(claudeClient.stats.totalRequests).toBe(0);
      expect(claudeClient.stats.successRequests).toBe(0);
      expect(claudeClient.stats.errorRequests).toBe(0);
    });
  });

  describe('getUsageStats', () => {
    test('应该返回正确的统计信息', () => {
      const stats = claudeClient.getUsageStats();
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('successRequests');
      expect(stats).toHaveProperty('errorRequests');
      expect(stats).toHaveProperty('successRate');
      expect(stats).toHaveProperty('totalTokensUsed');
      expect(stats).toHaveProperty('avgResponseTime');
    });

    test('初始状态应该返回零值', () => {
      const stats = claudeClient.getUsageStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.successRate).toBe('0%');
      expect(stats.totalTokensUsed).toBe(0);
    });
  });

  describe('resetStats', () => {
    test('应该重置统计信息', () => {
      // 手动设置一些统计数据
      claudeClient.stats.totalRequests = 10;
      claudeClient.stats.successRequests = 8;
      claudeClient.stats.totalTokens = 1000;

      // 重置
      claudeClient.resetStats();

      // 验证
      expect(claudeClient.stats.totalRequests).toBe(0);
      expect(claudeClient.stats.successRequests).toBe(0);
      expect(claudeClient.stats.totalTokens).toBe(0);
    });
  });

  describe('getMaskedApiKey', () => {
    test('应该返回脱敏的API Key', () => {
      const masked = claudeClient.getMaskedApiKey();
      expect(masked).toContain('*');
      expect(masked.length).toBeGreaterThan(0);
    });
  });
});

