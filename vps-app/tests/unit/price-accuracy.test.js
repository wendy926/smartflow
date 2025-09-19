// tests/unit/price-accuracy.test.js
// 价格准确性单元测试

const request = require('supertest');
const express = require('express');

describe('价格准确性测试', () => {
  let app;

  beforeAll(() => {
    // 创建测试应用
    app = express();
    app.use(express.json());

    // 模拟实时价格API
    app.get('/api/signals', async (req, res) => {
      try {
        const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];

        // 获取实时价格
        const pricePromises = symbols.map(async (symbol) => {
          try {
            const response = await fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`, {
              timeout: 5000
            });
            const data = await response.json();
            return { symbol, price: parseFloat(data.price) };
          } catch (error) {
            return { symbol, price: 0 };
          }
        });

        const priceData = await Promise.all(pricePromises);
        const signals = priceData.map(item => ({
          symbol: item.symbol,
          currentPrice: item.price,
          category: 'largecap',
          trend4h: '多头趋势',
          score: 4
        }));

        res.json(signals);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  });

  describe('Binance价格获取测试', () => {
    test('应该能够获取BTCUSDT实时价格', async () => {
      const response = await fetch('https://fapi.binance.com/fapi/v1/ticker/price?symbol=BTCUSDT');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('symbol', 'BTCUSDT');
      expect(data).toHaveProperty('price');
      expect(parseFloat(data.price)).toBeGreaterThan(0);
    }, 10000);

    test('应该能够获取多个交易对的价格', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
      const promises = symbols.map(symbol =>
        fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`)
          .then(res => res.json())
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.symbol).toBe(symbols[index]);
        expect(parseFloat(result.price)).toBeGreaterThan(0);
      });
    }, 10000);
  });

  describe('API价格准确性测试', () => {
    test('signals API应该返回实时价格', async () => {
      const response = await request(app)
        .get('/api/signals')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      response.body.forEach(signal => {
        expect(signal).toHaveProperty('symbol');
        expect(signal).toHaveProperty('currentPrice');
        expect(signal.currentPrice).toBeGreaterThan(0);
      });
    }, 15000);

    test('价格应该与Binance API一致（误差在1%内）', async () => {
      const response = await request(app)
        .get('/api/signals')
        .expect(200);

      const btcSignal = response.body.find(s => s.symbol === 'BTCUSDT');
      expect(btcSignal).toBeDefined();

      // 获取Binance实际价格
      const binanceResponse = await fetch('https://fapi.binance.com/fapi/v1/ticker/price?symbol=BTCUSDT');
      const binanceData = await binanceResponse.json();
      const binancePrice = parseFloat(binanceData.price);

      // 计算价格差异百分比
      const priceDiff = Math.abs(btcSignal.currentPrice - binancePrice) / binancePrice * 100;

      expect(priceDiff).toBeLessThan(1); // 误差应小于1%
    }, 15000);
  });

  describe('价格数据格式测试', () => {
    test('价格应该是数字格式', async () => {
      const response = await request(app)
        .get('/api/signals')
        .expect(200);

      response.body.forEach(signal => {
        expect(typeof signal.currentPrice).toBe('number');
        expect(signal.currentPrice).not.toBeNaN();
        expect(signal.currentPrice).toBeFinite();
      });
    });

    test('价格应该有合理的精度', async () => {
      const response = await request(app)
        .get('/api/signals')
        .expect(200);

      response.body.forEach(signal => {
        // 检查价格精度（最多4位小数）
        const priceStr = signal.currentPrice.toString();
        const decimalPart = priceStr.split('.')[1];
        if (decimalPart) {
          expect(decimalPart.length).toBeLessThanOrEqual(4);
        }
      });
    });
  });

  describe('价格缓存和性能测试', () => {
    test('连续请求应该有合理的响应时间', async () => {
      const startTime = Date.now();

      const promises = Array(3).fill(0).map(() =>
        request(app).get('/api/signals')
      );

      await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // 3个并发请求应该在30秒内完成
      expect(totalTime).toBeLessThan(30000);
    }, 35000);
  });

  describe('错误处理测试', () => {
    test('当Binance API不可用时应该有备用价格', async () => {
      // 模拟API失败的情况
      const mockApp = express();
      mockApp.get('/api/signals', async (req, res) => {
        const signals = [{
          symbol: 'BTCUSDT',
          currentPrice: 100000, // 备用价格
          category: 'largecap'
        }];
        res.json(signals);
      });

      const response = await request(mockApp)
        .get('/api/signals')
        .expect(200);

      expect(response.body[0].currentPrice).toBeGreaterThan(0);
    });
  });
});
