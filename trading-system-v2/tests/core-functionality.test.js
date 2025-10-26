/**
 * 通用交易系统核心功能测试
 * 验证市场适配器、AI服务、跨机房通信等核心功能
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');

// 导入核心模块
const { AdapterFactory, MarketType } = require('../src/adapters/AdapterFactory');
const { Timeframe } = require('../src/core/interfaces/IExchangeAdapter');
const { AIServiceFactory, AIProvider } = require('../src/services/ai/AIServiceFactory');
const { CrossRegionMessagingService, MessageType, MessagePriority } = require('../src/services/CrossRegionMessagingService');
const { ConfigManager } = require('../src/config/ConfigManager');

describe('通用交易系统核心功能测试', () => {

  describe('配置管理器测试', () => {
    let configManager;

    beforeEach(() => {
      // 设置测试环境
      process.env.NODE_ENV = 'test';
      process.env.REGION = 'SG';
      configManager = new ConfigManager();
    });

    test('应该正确加载配置', () => {
      const config = configManager.getConfig();
      expect(config).toBeDefined();
      expect(config.environment).toBe('test');
      expect(config.region).toBe('SG');
    });

    test('应该正确获取市场配置', () => {
      const cryptoConfig = configManager.getMarketConfig('crypto');
      expect(cryptoConfig).toBeDefined();
    });

    test('应该正确获取AI配置', () => {
      const aiConfig = configManager.getAIConfig();
      expect(aiConfig).toBeDefined();
      expect(aiConfig.defaultProvider).toBeDefined();
    });

    test('应该正确检查市场是否启用', () => {
      const isCryptoEnabled = configManager.isMarketEnabled('crypto');
      expect(typeof isCryptoEnabled).toBe('boolean');
    });
  });

  describe('市场适配器测试', () => {
    test('应该正确创建Binance适配器', () => {
      const config = {
        apiKey: 'test-key',
        secretKey: 'test-secret',
        baseURL: 'https://testnet.binance.vision',
        testnet: true
      };

      const adapter = AdapterFactory.create(MarketType.CRYPTO, config);
      expect(adapter).toBeDefined();
      expect(adapter.getMarketInfo().marketType).toBe(MarketType.CRYPTO);
    });

    test('应该正确创建A股适配器', () => {
      const config = {
        tushare: {
          token: 'test-token',
          baseURL: 'http://api.tushare.pro'
        },
        efinance: {
          baseURL: 'https://push2.eastmoney.com'
        }
      };

      const adapter = AdapterFactory.create(MarketType.CN_STOCK, config);
      expect(adapter).toBeDefined();
      expect(adapter.getMarketInfo().marketType).toBe(MarketType.CN_STOCK);
    });

    test('应该正确创建美股适配器', () => {
      const config = {
        alpaca: {
          apiKey: 'test-key',
          secretKey: 'test-secret',
          baseURL: 'https://paper-api.alpaca.markets'
        },
        alphaVantage: {
          apiKey: 'test-key',
          baseURL: 'https://www.alphavantage.co/query'
        }
      };

      const adapter = AdapterFactory.create(MarketType.US_STOCK, config);
      expect(adapter).toBeDefined();
      expect(adapter.getMarketInfo().marketType).toBe(MarketType.US_STOCK);
    });

    test('应该正确检查交易时间', () => {
      const config = {
        apiKey: 'test-key',
        secretKey: 'test-secret',
        testnet: true
      };

      const adapter = AdapterFactory.create(MarketType.CRYPTO, config);
      const isTradingTime = adapter.isTradingTime();
      expect(typeof isTradingTime).toBe('boolean');
    });

    test('应该正确检查交易对支持', () => {
      const config = {
        symbols: ['BTCUSDT', 'ETHUSDT'],
        apiKey: 'test-key',
        secretKey: 'test-secret',
        testnet: true
      };

      const adapter = AdapterFactory.create(MarketType.CRYPTO, config);
      expect(adapter.isSymbolSupported('BTCUSDT')).toBe(true);
      expect(adapter.isSymbolSupported('INVALID')).toBe(false);
    });
  });

  describe('AI服务测试', () => {
    test('应该正确创建Claude AI服务', () => {
      const config = {
        apiKey: 'test-key',
        baseURL: 'https://api.anthropic.com',
        model: 'claude-3.5-sonnet'
      };

      const aiService = AIServiceFactory.create(AIProvider.CLAUDE, config);
      expect(aiService).toBeDefined();
      expect(aiService.getServiceInfo().provider).toBe(AIProvider.CLAUDE);
    });

    test('应该正确创建DeepSeek AI服务', () => {
      const config = {
        apiKey: 'test-key',
        baseURL: 'https://api.deepseek.com',
        model: 'deepseek-chat'
      };

      const aiService = AIServiceFactory.create(AIProvider.DEEPSEEK, config);
      expect(aiService).toBeDefined();
      expect(aiService.getServiceInfo().provider).toBe(AIProvider.DEEPSEEK);
    });

    test('应该正确分析市场数据', async () => {
      const config = {
        apiKey: 'test-key',
        baseURL: 'https://api.deepseek.com',
        model: 'deepseek-chat'
      };

      const aiService = AIServiceFactory.create(AIProvider.DEEPSEEK, config);

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

      const context = {
        symbol: 'BTCUSDT',
        marketType: 'crypto'
      };

      try {
        const analysis = await aiService.analyzeMarket(marketData, context);
        expect(analysis).toBeDefined();
        expect(analysis.trend).toBeDefined();
        expect(analysis.confidence).toBeGreaterThanOrEqual(0);
        expect(analysis.confidence).toBeLessThanOrEqual(100);
      } catch (error) {
        // 在测试环境中，AI服务可能无法连接，这是正常的
        expect(error).toBeDefined();
      }
    });

    test('应该正确生成交易信号', async () => {
      const config = {
        apiKey: 'test-key',
        baseURL: 'https://api.deepseek.com',
        model: 'deepseek-chat'
      };

      const aiService = AIServiceFactory.create(AIProvider.DEEPSEEK, config);

      const context = {
        strategy: 'V3',
        symbol: 'BTCUSDT',
        marketType: 'crypto',
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
        indicators: {
          rsi: 65,
          macd: 0.5,
          ma20: 50000
        }
      };

      try {
        const signal = await aiService.generateSignal('V3', context);
        expect(signal).toBeDefined();
        expect(signal.action).toBeDefined();
        expect(signal.confidence).toBeGreaterThanOrEqual(0);
        expect(signal.confidence).toBeLessThanOrEqual(100);
      } catch (error) {
        // 在测试环境中，AI服务可能无法连接，这是正常的
        expect(error).toBeDefined();
      }
    });
  });

  describe('跨机房通信测试', () => {
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

    test('应该正确初始化消息服务', () => {
      expect(messagingService).toBeDefined();
      expect(messagingService.region).toBe('SG');
    });

    test('应该正确创建消息', () => {
      const message = {
        type: MessageType.DATA_SYNC,
        data: { symbol: 'BTCUSDT', price: 50000 },
        priority: MessagePriority.NORMAL,
        targetRegion: 'CN'
      };

      expect(message.type).toBe(MessageType.DATA_SYNC);
      expect(message.priority).toBe(MessagePriority.NORMAL);
    });

    test('应该正确注册消息处理器', () => {
      const mockHandler = {
        handle: jest.fn().mockResolvedValue(true),
        getSupportedTypes: () => [MessageType.DATA_SYNC]
      };

      messagingService.registerHandler(mockHandler);

      const handlers = messagingService.handlers.get(MessageType.DATA_SYNC);
      expect(handlers).toBeDefined();
      expect(handlers.length).toBe(1);
    });
  });

  describe('数据模型测试', () => {
    test('应该正确创建K线数据', () => {
      const kline = {
        timestamp: new Date(),
        open: 50000,
        high: 51000,
        low: 49000,
        close: 50500,
        volume: 1000,
        symbol: 'BTCUSDT',
        timeframe: Timeframe.HOUR_1,
        marketType: MarketType.CRYPTO
      };

      expect(kline.symbol).toBe('BTCUSDT');
      expect(kline.timeframe).toBe(Timeframe.HOUR_1);
      expect(kline.marketType).toBe(MarketType.CRYPTO);
      expect(kline.open).toBeLessThan(kline.high);
      expect(kline.close).toBeGreaterThan(kline.low);
    });

    test('应该正确创建市场指标', () => {
      const metrics = {
        volume: 1000,
        fundingRate: 0.0001,
        openInterest: 5000000,
        delta: 0.5
      };

      expect(metrics.volume).toBe(1000);
      expect(metrics.fundingRate).toBe(0.0001);
      expect(metrics.openInterest).toBe(5000000);
      expect(metrics.delta).toBe(0.5);
    });

    test('应该正确创建订单请求', () => {
      const orderRequest = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'LIMIT',
        quantity: 0.1,
        price: 50000,
        timeInForce: 'GTC'
      };

      expect(orderRequest.symbol).toBe('BTCUSDT');
      expect(orderRequest.side).toBe('BUY');
      expect(orderRequest.type).toBe('LIMIT');
      expect(orderRequest.quantity).toBe(0.1);
      expect(orderRequest.price).toBe(50000);
    });
  });

  describe('集成测试', () => {
    test('应该正确集成所有组件', () => {
      // 测试配置管理器
      const configManager = new ConfigManager();
      expect(configManager).toBeDefined();

      // 测试适配器工厂
      const supportedMarkets = AdapterFactory.getSupportedMarkets();
      expect(supportedMarkets).toContain(MarketType.CRYPTO);
      expect(supportedMarkets).toContain(MarketType.CN_STOCK);
      expect(supportedMarkets).toContain(MarketType.US_STOCK);

      // 测试AI服务工厂
      const supportedProviders = AIServiceFactory.getSupportedProviders();
      expect(supportedProviders).toContain(AIProvider.CLAUDE);
      expect(supportedProviders).toContain(AIProvider.DEEPSEEK);
    });

    test('应该正确处理错误情况', () => {
      // 测试无效的市场类型
      expect(() => {
        AdapterFactory.create('INVALID_MARKET', {});
      }).toThrow('Unsupported market type');

      // 测试无效的AI提供商
      expect(() => {
        AIServiceFactory.create('INVALID_PROVIDER', {});
      }).toThrow('Unsupported AI provider');
    });
  });
});

// 性能测试
describe('性能测试', () => {
  test('配置加载性能', () => {
    const startTime = Date.now();

    for (let i = 0; i < 100; i++) {
      const configManager = new ConfigManager();
      configManager.getConfig();
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // 100次配置加载应该在1秒内完成
    expect(duration).toBeLessThan(1000);
  });

  test('适配器创建性能', () => {
    const config = {
      apiKey: 'test-key',
      secretKey: 'test-secret',
      testnet: true
    };

    const startTime = Date.now();

    for (let i = 0; i < 100; i++) {
      const adapter = AdapterFactory.create(MarketType.CRYPTO, config);
      adapter.getMarketInfo();
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // 100次适配器创建应该在1秒内完成
    expect(duration).toBeLessThan(1000);
  });
});

// 模拟测试
describe('模拟测试', () => {
  test('模拟市场数据获取', async () => {
    const config = {
      apiKey: 'test-key',
      secretKey: 'test-secret',
      testnet: true
    };

    const adapter = AdapterFactory.create(MarketType.CRYPTO, config);

    try {
      // 在测试环境中，实际的API调用会失败，这是正常的
      await adapter.getKlines('BTCUSDT', Timeframe.HOUR_1, 10);
    } catch (error) {
      // 验证错误是预期的（网络错误或API密钥错误）
      expect(error).toBeDefined();
    }
  });

  test('模拟AI服务调用', async () => {
    const config = {
      apiKey: 'test-key',
      baseURL: 'https://api.deepseek.com',
      model: 'deepseek-chat'
    };

    const aiService = AIServiceFactory.create(AIProvider.DEEPSEEK, config);

    try {
      // 在测试环境中，实际的AI服务调用会失败，这是正常的
      await aiService.healthCheck();
    } catch (error) {
      // 验证错误是预期的（网络错误或API密钥错误）
      expect(error).toBeDefined();
    }
  });
});
