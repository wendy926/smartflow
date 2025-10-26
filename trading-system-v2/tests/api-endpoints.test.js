/**
 * API接口测试
 * 验证REST API端点的功能
 */

const request = require('supertest');
const express = require('express');

// 创建测试应用
const app = express();
app.use(express.json());

// 模拟API路由
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    region: process.env.REGION || 'SG',
    environment: process.env.NODE_ENV || 'test'
  });
});

app.get('/api/config', (req, res) => {
  res.json({
    environment: process.env.NODE_ENV || 'test',
    region: process.env.REGION || 'SG',
    enabledMarkets: ['crypto', 'us_stock'],
    defaultAIProvider: 'claude'
  });
});

app.get('/api/markets', (req, res) => {
  res.json({
    markets: [
      {
        type: 'crypto',
        enabled: true,
        symbols: ['BTCUSDT', 'ETHUSDT'],
        tradingHours: '24/7'
      },
      {
        type: 'us_stock',
        enabled: true,
        symbols: ['AAPL', 'MSFT'],
        tradingHours: '09:30-16:00 ET'
      }
    ]
  });
});

app.get('/api/ai/providers', (req, res) => {
  res.json({
    providers: [
      {
        name: 'claude',
        model: 'claude-3.5-sonnet',
        region: 'SG',
        status: 'active'
      },
      {
        name: 'deepseek',
        model: 'deepseek-chat',
        region: 'CN',
        status: 'active'
      }
    ],
    defaultProvider: 'claude'
  });
});

app.post('/api/ai/analyze', (req, res) => {
  const { symbol, marketType, data } = req.body;

  if (!symbol || !marketType || !data) {
    return res.status(400).json({
      error: 'Missing required parameters'
    });
  }

  res.json({
    analysis: {
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
    },
    timestamp: new Date().toISOString()
  });
});

app.post('/api/trading/signal', (req, res) => {
  const { strategy, symbol, context } = req.body;

  if (!strategy || !symbol || !context) {
    return res.status(400).json({
      error: 'Missing required parameters'
    });
  }

  res.json({
    signal: {
      action: 'BUY',
      confidence: 85,
      reasoning: '基于技术分析，当前价格突破关键阻力位',
      riskLevel: 'MEDIUM',
      expectedReturn: 0.05,
      stopLoss: 45000,
      takeProfit: 55000,
      positionSize: 0.1
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/api/sync/status', (req, res) => {
  res.json({
    region: process.env.REGION || 'SG',
    isRunning: true,
    stats: {
      syncRequests: 100,
      syncSuccess: 95,
      syncFailed: 5,
      dataTransferred: 1024000,
      lastSyncTime: new Date().toISOString()
    }
  });
});

app.get('/api/messaging/stats', (req, res) => {
  res.json({
    region: process.env.REGION || 'SG',
    isRunning: true,
    stats: {
      messagesSent: 500,
      messagesReceived: 480,
      messagesProcessed: 475,
      messagesFailed: 5,
      lastActivity: new Date().toISOString()
    }
  });
});

describe('API接口测试', () => {

  describe('健康检查端点', () => {
    test('GET /health 应该返回健康状态', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.region).toBeDefined();
      expect(response.body.environment).toBeDefined();
    });
  });

  describe('配置端点', () => {
    test('GET /api/config 应该返回系统配置', async () => {
      const response = await request(app)
        .get('/api/config')
        .expect(200);

      expect(response.body.environment).toBeDefined();
      expect(response.body.region).toBeDefined();
      expect(response.body.enabledMarkets).toBeInstanceOf(Array);
      expect(response.body.defaultAIProvider).toBeDefined();
    });
  });

  describe('市场端点', () => {
    test('GET /api/markets 应该返回市场信息', async () => {
      const response = await request(app)
        .get('/api/markets')
        .expect(200);

      expect(response.body.markets).toBeInstanceOf(Array);
      expect(response.body.markets.length).toBeGreaterThan(0);

      const cryptoMarket = response.body.markets.find(m => m.type === 'crypto');
      expect(cryptoMarket).toBeDefined();
      expect(cryptoMarket.enabled).toBe(true);
      expect(cryptoMarket.symbols).toBeInstanceOf(Array);
    });
  });

  describe('AI服务端点', () => {
    test('GET /api/ai/providers 应该返回AI提供商信息', async () => {
      const response = await request(app)
        .get('/api/ai/providers')
        .expect(200);

      expect(response.body.providers).toBeInstanceOf(Array);
      expect(response.body.providers.length).toBeGreaterThan(0);
      expect(response.body.defaultProvider).toBeDefined();

      const claudeProvider = response.body.providers.find(p => p.name === 'claude');
      expect(claudeProvider).toBeDefined();
      expect(claudeProvider.model).toBeDefined();
      expect(claudeProvider.region).toBeDefined();
    });

    test('POST /api/ai/analyze 应该正确分析市场数据', async () => {
      const analysisRequest = {
        symbol: 'BTCUSDT',
        marketType: 'crypto',
        data: [
          {
            timestamp: new Date().toISOString(),
            open: 50000,
            high: 51000,
            low: 49000,
            close: 50500,
            volume: 1000
          }
        ]
      };

      const response = await request(app)
        .post('/api/ai/analyze')
        .send(analysisRequest)
        .expect(200);

      expect(response.body.analysis).toBeDefined();
      expect(response.body.analysis.trend).toBeDefined();
      expect(response.body.analysis.strength).toBeGreaterThanOrEqual(0);
      expect(response.body.analysis.strength).toBeLessThanOrEqual(100);
      expect(response.body.analysis.confidence).toBeGreaterThanOrEqual(0);
      expect(response.body.analysis.confidence).toBeLessThanOrEqual(100);
      expect(response.body.analysis.factors).toBeInstanceOf(Array);
      expect(response.body.timestamp).toBeDefined();
    });

    test('POST /api/ai/analyze 应该处理缺少参数的情况', async () => {
      const response = await request(app)
        .post('/api/ai/analyze')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Missing required parameters');
    });
  });

  describe('交易信号端点', () => {
    test('POST /api/trading/signal 应该正确生成交易信号', async () => {
      const signalRequest = {
        strategy: 'V3',
        symbol: 'BTCUSDT',
        context: {
          marketData: [
            {
              timestamp: new Date().toISOString(),
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
        }
      };

      const response = await request(app)
        .post('/api/trading/signal')
        .send(signalRequest)
        .expect(200);

      expect(response.body.signal).toBeDefined();
      expect(response.body.signal.action).toBeDefined();
      expect(response.body.signal.confidence).toBeGreaterThanOrEqual(0);
      expect(response.body.signal.confidence).toBeLessThanOrEqual(100);
      expect(response.body.signal.reasoning).toBeDefined();
      expect(response.body.signal.riskLevel).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });

    test('POST /api/trading/signal 应该处理缺少参数的情况', async () => {
      const response = await request(app)
        .post('/api/trading/signal')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Missing required parameters');
    });
  });

  describe('数据同步端点', () => {
    test('GET /api/sync/status 应该返回同步状态', async () => {
      const response = await request(app)
        .get('/api/sync/status')
        .expect(200);

      expect(response.body.region).toBeDefined();
      expect(response.body.isRunning).toBe(true);
      expect(response.body.stats).toBeDefined();
      expect(response.body.stats.syncRequests).toBeGreaterThanOrEqual(0);
      expect(response.body.stats.syncSuccess).toBeGreaterThanOrEqual(0);
      expect(response.body.stats.syncFailed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('消息队列端点', () => {
    test('GET /api/messaging/stats 应该返回消息队列统计', async () => {
      const response = await request(app)
        .get('/api/messaging/stats')
        .expect(200);

      expect(response.body.region).toBeDefined();
      expect(response.body.isRunning).toBe(true);
      expect(response.body.stats).toBeDefined();
      expect(response.body.stats.messagesSent).toBeGreaterThanOrEqual(0);
      expect(response.body.stats.messagesReceived).toBeGreaterThanOrEqual(0);
      expect(response.body.stats.messagesProcessed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('错误处理测试', () => {
    test('应该正确处理404错误', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);
    });

    test('应该正确处理无效的JSON', async () => {
      const response = await request(app)
        .post('/api/ai/analyze')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
    });
  });

  describe('性能测试', () => {
    test('健康检查端点应该快速响应', async () => {
      const startTime = Date.now();

      await request(app)
        .get('/health')
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 健康检查应该在100ms内完成
      expect(duration).toBeLessThan(100);
    });

    test('配置端点应该快速响应', async () => {
      const startTime = Date.now();

      await request(app)
        .get('/api/config')
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 配置端点应该在100ms内完成
      expect(duration).toBeLessThan(100);
    });
  });

  describe('并发测试', () => {
    test('应该正确处理并发请求', async () => {
      const requests = [];

      // 发送10个并发请求
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .get('/health')
            .expect(200)
        );
      }

      const responses = await Promise.all(requests);

      // 所有请求都应该成功
      responses.forEach(response => {
        expect(response.body.status).toBe('healthy');
      });
    });
  });
});
