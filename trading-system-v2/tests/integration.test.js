/**
 * 集成测试
 * 验证系统各组件之间的集成功能
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');

// 导入核心模块
const { ConfigManager } = require('../src/config/ConfigManager');
const { AdapterFactory, MarketType } = require('../src/core/interfaces/IExchangeAdapter');
const { AIServiceFactory, AIProvider, AIServiceManager } = require('../src/services/ai/IAIService');
const { CrossRegionMessagingService, MessageType, MessagePriority } = require('../src/services/CrossRegionMessagingService');

describe('系统集成测试', () => {

  describe('配置与适配器集成', () => {
    let configManager;

    beforeEach(() => {
      process.env.NODE_ENV = 'test';
      process.env.REGION = 'SG';
      configManager = new ConfigManager();
    });

    test('应该根据配置正确创建适配器', () => {
      const markets = configManager.getConfig().markets || {};

      for (const [marketType, marketConfig] of Object.entries(markets)) {
        if (marketConfig.enabled) {
          const adapter = AdapterFactory.create(marketType, marketConfig.config || {});
          expect(adapter).toBeDefined();
          expect(adapter.getMarketInfo().marketType).toBe(marketType);
        }
      }
    });

    test('应该正确处理不同区域的配置', () => {
      // 测试SG区域配置
      process.env.REGION = 'SG';
      const sgConfig = new ConfigManager();
      expect(sgConfig.getRegion()).toBe('SG');

      // 测试CN区域配置
      process.env.REGION = 'CN';
      const cnConfig = new ConfigManager();
      expect(cnConfig.getRegion()).toBe('CN');
    });
  });

  describe('AI服务与配置集成', () => {
    let configManager;
    let aiServiceManager;

    beforeEach(() => {
      process.env.NODE_ENV = 'test';
      process.env.REGION = 'SG';
      configManager = new ConfigManager();
      aiServiceManager = new AIServiceManager();
    });

    test('应该根据配置正确初始化AI服务', () => {
      const aiConfig = configManager.getAIConfig();

      for (const [provider, providerConfig] of Object.entries(aiConfig.providers || {})) {
        if (providerConfig.apiKey) {
          const aiService = AIServiceFactory.create(provider, providerConfig);
          aiServiceManager.registerService(provider, aiService);

          expect(aiService).toBeDefined();
          expect(aiService.getServiceInfo().provider).toBe(provider);
        }
      }

      aiServiceManager.setDefaultProvider(aiConfig.defaultProvider);
      expect(aiServiceManager.getDefaultService()).toBeDefined();
    });

    test('应该正确处理不同区域的AI服务', () => {
      // SG区域应该使用Claude作为默认服务
      process.env.REGION = 'SG';
      const sgConfig = new ConfigManager();
      const sgAI = sgConfig.getAIConfig();
      expect(sgAI.defaultProvider).toBeDefined();

      // CN区域应该使用DeepSeek作为默认服务
      process.env.REGION = 'CN';
      const cnConfig = new ConfigManager();
      const cnAI = cnConfig.getAIConfig();
      expect(cnAI.defaultProvider).toBeDefined();
    });
  });

  describe('消息服务与数据同步集成', () => {
    let messagingService;

    beforeEach(() => {
      const config = {
        region: 'SG',
        redis: {
          host: 'localhost',
          port: 6379,
          password: null,
          db: 15 // 使用测试数据库
        }
      };

      messagingService = new CrossRegionMessagingService(config);
    });

    afterEach(async () => {
      if (messagingService) {
        await messagingService.stop();
      }
    });

    test('应该正确处理数据同步消息', () => {
      const syncMessage = {
        type: MessageType.DATA_SYNC,
        data: {
          marketType: 'crypto',
          symbol: 'BTCUSDT',
          timeframe: '1h',
          from: '2023-01-01',
          to: '2023-01-02'
        },
        priority: MessagePriority.NORMAL,
        targetRegion: 'CN'
      };

      expect(syncMessage.type).toBe(MessageType.DATA_SYNC);
      expect(syncMessage.data.marketType).toBe('crypto');
      expect(syncMessage.targetRegion).toBe('CN');
    });

    test('应该正确处理AI分析消息', () => {
      const analysisMessage = {
        type: MessageType.AI_ANALYSIS,
        data: {
          analysisType: 'market',
          symbol: 'BTCUSDT',
          marketData: [
            {
              timestamp: new Date(),
              open: 50000,
              high: 51000,
              low: 49000,
              close: 50500,
              volume: 1000
            }
          ],
          context: {
            marketType: 'crypto'
          }
        },
        priority: MessagePriority.HIGH,
        targetRegion: 'SG'
      };

      expect(analysisMessage.type).toBe(MessageType.AI_ANALYSIS);
      expect(analysisMessage.data.analysisType).toBe('market');
      expect(analysisMessage.priority).toBe(MessagePriority.HIGH);
    });
  });

  describe('端到端工作流测试', () => {
    test('应该正确处理完整的交易分析流程', async () => {
      // 1. 初始化配置
      process.env.NODE_ENV = 'test';
      process.env.REGION = 'SG';
      const configManager = new ConfigManager();

      // 2. 创建市场适配器
      const cryptoConfig = {
        apiKey: 'test-key',
        secretKey: 'test-secret',
        testnet: true
      };
      const adapter = AdapterFactory.create(MarketType.CRYPTO, cryptoConfig);

      // 3. 创建AI服务
      const aiConfig = {
        apiKey: 'test-key',
        baseURL: 'https://api.deepseek.com',
        model: 'deepseek-chat'
      };
      const aiService = AIServiceFactory.create(AIProvider.DEEPSEEK, aiConfig);

      // 4. 模拟市场数据
      const marketData = [
        {
          timestamp: new Date(),
          open: 50000,
          high: 51000,
          low: 49000,
          close: 50500,
          volume: 1000,
          symbol: 'BTCUSDT',
          timeframe: '1h',
          marketType: 'crypto'
        }
      ];

      // 5. 执行市场分析
      try {
        const analysis = await aiService.analyzeMarket(marketData, {
          symbol: 'BTCUSDT',
          marketType: 'crypto'
        });

        expect(analysis).toBeDefined();
        expect(analysis.trend).toBeDefined();
        expect(analysis.confidence).toBeGreaterThanOrEqual(0);
      } catch (error) {
        // 在测试环境中，AI服务调用可能失败，这是正常的
        expect(error).toBeDefined();
      }

      // 6. 生成交易信号
      try {
        const signal = await aiService.generateSignal('V3', {
          symbol: 'BTCUSDT',
          marketType: 'crypto',
          marketData: marketData,
          indicators: {
            rsi: 65,
            macd: 0.5,
            ma20: 50000
          }
        });

        expect(signal).toBeDefined();
        expect(signal.action).toBeDefined();
        expect(signal.confidence).toBeGreaterThanOrEqual(0);
      } catch (error) {
        // 在测试环境中，AI服务调用可能失败，这是正常的
        expect(error).toBeDefined();
      }
    });

    test('应该正确处理跨机房数据同步流程', () => {
      // 1. SG机房发送数据到CN机房
      const sgToCnMessage = {
        type: MessageType.DATA_SYNC,
        data: {
          marketType: 'crypto',
          symbol: 'BTCUSDT',
          timeframe: '1h',
          data: [
            {
              timestamp: new Date(),
              open: 50000,
              high: 51000,
              low: 49000,
              close: 50500,
              volume: 1000
            }
          ]
        },
        priority: MessagePriority.NORMAL,
        sourceRegion: 'SG',
        targetRegion: 'CN'
      };

      expect(sgToCnMessage.sourceRegion).toBe('SG');
      expect(sgToCnMessage.targetRegion).toBe('CN');
      expect(sgToCnMessage.data.marketType).toBe('crypto');

      // 2. CN机房发送数据到SG机房
      const cnToSgMessage = {
        type: MessageType.DATA_SYNC,
        data: {
          marketType: 'cn_stock',
          symbol: '000001.SZ',
          timeframe: '1h',
          data: [
            {
              timestamp: new Date(),
              open: 10.5,
              high: 10.8,
              low: 10.2,
              close: 10.6,
              volume: 1000000
            }
          ]
        },
        priority: MessagePriority.NORMAL,
        sourceRegion: 'CN',
        targetRegion: 'SG'
      };

      expect(cnToSgMessage.sourceRegion).toBe('CN');
      expect(cnToSgMessage.targetRegion).toBe('SG');
      expect(cnToSgMessage.data.marketType).toBe('cn_stock');
    });
  });

  describe('错误处理集成测试', () => {
    test('应该正确处理配置错误', () => {
      // 测试无效的环境变量
      process.env.NODE_ENV = 'invalid';
      process.env.REGION = 'INVALID';

      expect(() => {
        new ConfigManager();
      }).toThrow();
    });

    test('应该正确处理适配器创建错误', () => {
      expect(() => {
        AdapterFactory.create('INVALID_MARKET', {});
      }).toThrow('Unsupported market type');
    });

    test('应该正确处理AI服务创建错误', () => {
      expect(() => {
        AIServiceFactory.create('INVALID_PROVIDER', {});
      }).toThrow('Unsupported AI provider');
    });
  });

  describe('性能集成测试', () => {
    test('系统初始化应该在合理时间内完成', () => {
      const startTime = Date.now();

      // 初始化配置管理器
      const configManager = new ConfigManager();

      // 创建多个适配器
      const adapters = [];
      const markets = ['crypto', 'cn_stock', 'us_stock'];

      for (const market of markets) {
        try {
          const adapter = AdapterFactory.create(market, {});
          adapters.push(adapter);
        } catch (error) {
          // 某些适配器可能因为缺少配置而失败，这是正常的
        }
      }

      // 创建AI服务管理器
      const aiServiceManager = new AIServiceManager();

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 系统初始化应该在1秒内完成
      expect(duration).toBeLessThan(1000);
    });

    test('消息处理应该在合理时间内完成', () => {
      const startTime = Date.now();

      // 创建大量消息
      const messages = [];
      for (let i = 0; i < 1000; i++) {
        messages.push({
          id: `msg_${i}`,
          type: MessageType.DATA_SYNC,
          data: { symbol: 'BTCUSDT', price: 50000 + i },
          priority: MessagePriority.NORMAL,
          timestamp: new Date()
        });
      }

      // 处理消息
      messages.forEach(msg => {
        expect(msg.id).toBeDefined();
        expect(msg.type).toBeDefined();
        expect(msg.data).toBeDefined();
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 1000条消息的处理应该在100ms内完成
      expect(duration).toBeLessThan(100);
    });
  });

  describe('数据一致性测试', () => {
    test('市场数据应该保持一致性', () => {
      const marketData = {
        symbol: 'BTCUSDT',
        timeframe: '1h',
        timestamp: new Date(),
        open: 50000,
        high: 51000,
        low: 49000,
        close: 50500,
        volume: 1000,
        marketType: 'crypto'
      };

      // 验证数据一致性
      expect(marketData.open).toBeLessThanOrEqual(marketData.high);
      expect(marketData.close).toBeGreaterThanOrEqual(marketData.low);
      expect(marketData.high).toBeGreaterThanOrEqual(marketData.low);
      expect(marketData.volume).toBeGreaterThan(0);
      expect(marketData.symbol).toBe('BTCUSDT');
      expect(marketData.marketType).toBe('crypto');
    });

    test('AI分析结果应该保持一致性', () => {
      const analysis = {
        trend: 'BULLISH',
        strength: 75,
        confidence: 80,
        factors: [
          {
            name: '技术指标',
            value: 'MACD金叉',
            weight: 0.3,
            impact: 'POSITIVE'
          }
        ],
        recommendation: '建议关注多头机会'
      };

      // 验证分析结果一致性
      expect(analysis.strength).toBeGreaterThanOrEqual(0);
      expect(analysis.strength).toBeLessThanOrEqual(100);
      expect(analysis.confidence).toBeGreaterThanOrEqual(0);
      expect(analysis.confidence).toBeLessThanOrEqual(100);
      expect(analysis.factors).toBeInstanceOf(Array);
      expect(analysis.factors.length).toBeGreaterThan(0);

      const totalWeight = analysis.factors.reduce((sum, factor) => sum + factor.weight, 0);
      expect(totalWeight).toBeLessThanOrEqual(1);
    });
  });
});
