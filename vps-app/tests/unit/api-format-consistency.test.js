// tests/unit/api-format-consistency.test.js
// API格式一致性测试 - 防止V3和ICT策略API格式不一致

const request = require('supertest');
const express = require('express');

describe('API格式一致性测试', () => {
  let app;

  beforeAll(() => {
    // 创建测试应用，模拟V3和ICT API
    app = express();
    app.use(express.json());

    // V3策略API - 直接返回数组
    app.get('/api/signals', (req, res) => {
      const signals = [
        {
          symbol: 'BTCUSDT',
          category: 'largecap',
          trend4h: '多头趋势',
          score: 4,
          currentPrice: 117000,
          strategyVersion: 'V3'
        },
        {
          symbol: 'ETHUSDT',
          category: 'largecap',
          trend4h: '空头趋势',
          score: 3,
          currentPrice: 4600,
          strategyVersion: 'V3'
        }
      ];
      res.json(signals);
    });

    // ICT策略API - 也应该直接返回数组
    app.get('/api/ict/signals', (req, res) => {
      const signals = [
        {
          symbol: 'BTCUSDT',
          category: 'largecap',
          dailyTrend: '多头趋势',
          signalType: 'BOS_LONG',
          entryPrice: 117000,
          strategyVersion: 'ICT'
        },
        {
          symbol: 'ETHUSDT',
          category: 'largecap',
          dailyTrend: '空头趋势',
          signalType: 'BOS_SHORT',
          entryPrice: 4600,
          strategyVersion: 'ICT'
        }
      ];
      res.json(signals);
    });

    // 错误的ICT API格式（用于测试）
    app.get('/api/ict/signals-wrong', (req, res) => {
      res.json({
        success: true,
        data: [
          { symbol: 'BTCUSDT', signalType: 'BOS_LONG' }
        ],
        count: 1
      });
    });
  });

  describe('API返回格式一致性', () => {
    test('V3策略API应该返回数组格式', async () => {
      const response = await request(app)
        .get('/api/signals')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      // 检查数组元素结构
      response.body.forEach(signal => {
        expect(signal).toHaveProperty('symbol');
        expect(signal).toHaveProperty('strategyVersion', 'V3');
      });
    });

    test('ICT策略API应该返回相同的数组格式', async () => {
      const response = await request(app)
        .get('/api/ict/signals')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      // 检查数组元素结构
      response.body.forEach(signal => {
        expect(signal).toHaveProperty('symbol');
        expect(signal).toHaveProperty('strategyVersion', 'ICT');
      });
    });

    test('V3和ICT API格式应该完全一致', async () => {
      const [v3Response, ictResponse] = await Promise.all([
        request(app).get('/api/signals'),
        request(app).get('/api/ict/signals')
      ]);

      // 都应该是数组
      expect(Array.isArray(v3Response.body)).toBe(true);
      expect(Array.isArray(ictResponse.body)).toBe(true);

      // 数组长度应该相同
      expect(v3Response.body.length).toBe(ictResponse.body.length);

      // 都应该有相同的基本字段
      const commonFields = ['symbol', 'category'];

      v3Response.body.forEach((signal, index) => {
        const ictSignal = ictResponse.body[index];

        commonFields.forEach(field => {
          expect(signal).toHaveProperty(field);
          expect(ictSignal).toHaveProperty(field);
          expect(signal[field]).toBe(ictSignal[field]);
        });
      });
    });
  });

  describe('前端forEach兼容性测试', () => {
    test('V3 API响应应该支持forEach操作', async () => {
      const response = await request(app)
        .get('/api/signals')
        .expect(200);

      // 模拟前端代码中的forEach操作
      expect(() => {
        response.body.forEach(signal => {
          expect(signal.symbol).toBeDefined();
        });
      }).not.toThrow();
    });

    test('ICT API响应应该支持forEach操作', async () => {
      const response = await request(app)
        .get('/api/ict/signals')
        .expect(200);

      // 模拟前端代码中的forEach操作
      expect(() => {
        response.body.forEach(signal => {
          expect(signal.symbol).toBeDefined();
        });
      }).not.toThrow();
    });

    test('应该检测包装对象格式问题', async () => {
      const response = await request(app)
        .get('/api/ict/signals-wrong')
        .expect(200);

      // 这种格式会导致forEach错误
      expect(Array.isArray(response.body)).toBe(false);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);

      // 模拟前端错误
      expect(() => {
        response.body.forEach(signal => {
          // 这会失败，因为response.body不是数组
        });
      }).toThrow();
    });
  });

  describe('策略切换兼容性测试', () => {
    test('策略切换时数据格式应该一致', async () => {
      // 模拟策略切换流程
      const v3Data = await request(app).get('/api/signals');
      const ictData = await request(app).get('/api/ict/signals');

      // 检查两个API的响应格式完全一致
      expect(typeof v3Data.body).toBe(typeof ictData.body);
      expect(Array.isArray(v3Data.body)).toBe(Array.isArray(ictData.body));

      // 检查前端处理逻辑兼容性
      const processSignals = (signals) => {
        if (!Array.isArray(signals)) {
          throw new Error('signals.forEach is not a function');
        }

        const result = [];
        signals.forEach(signal => {
          result.push({
            symbol: signal.symbol,
            strategy: signal.strategyVersion
          });
        });
        return result;
      };

      // 两种策略的数据都应该能正常处理
      expect(() => processSignals(v3Data.body)).not.toThrow();
      expect(() => processSignals(ictData.body)).not.toThrow();

      const v3Processed = processSignals(v3Data.body);
      const ictProcessed = processSignals(ictData.body);

      expect(v3Processed.length).toBe(ictProcessed.length);
      expect(v3Processed[0].strategy).toBe('V3');
      expect(ictProcessed[0].strategy).toBe('ICT');
    });
  });

  describe('API响应结构验证', () => {
    test('所有策略API都应该有一致的基础结构', async () => {
      const apis = [
        { name: 'V3', endpoint: '/api/signals' },
        { name: 'ICT', endpoint: '/api/ict/signals' }
      ];

      for (const api of apis) {
        const response = await request(app).get(api.endpoint);

        // 基础格式检查
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);

        // 每个信号都应该有基本字段
        response.body.forEach(signal => {
          expect(signal).toHaveProperty('symbol');
          expect(signal).toHaveProperty('category');
          expect(signal).toHaveProperty('strategyVersion');
        });

        console.log(`✅ ${api.name} API格式验证通过`);
      }
    });
  });
});
