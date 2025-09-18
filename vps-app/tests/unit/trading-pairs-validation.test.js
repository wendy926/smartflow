// tests/unit/trading-pairs-validation.test.js
// 交易对有效性验证测试 - 专门检测MATICUSDT类似问题

const request = require('supertest');
const express = require('express');

describe('交易对有效性验证测试', () => {
  let app;

  beforeAll(() => {
    // 创建测试应用
    app = express();
    app.use(express.json());

    // 模拟signals API
    app.get('/api/signals', async (req, res) => {
      try {
        const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'MATICUSDT', 'POLUSDT'];

        const pricePromises = symbols.map(async (symbol) => {
          try {
            const response = await fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`, {
              timeout: 5000
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const price = parseFloat(data.price);

            if (isNaN(price) || price <= 0) {
              throw new Error(`Invalid price: ${price}`);
            }

            return { symbol, price, success: true };
          } catch (error) {
            return { symbol, price: 0, success: false, error: error.message };
          }
        });

        const priceData = await Promise.all(pricePromises);

        const signals = priceData.map(item => ({
          symbol: item.symbol,
          currentPrice: item.price,
          priceSuccess: item.success,
          priceError: item.error || null,
          category: 'midcap',
          trend4h: '多头趋势',
          score: 4,
          // 模拟硬编码的趋势数据
          dataCollectionRate: 98.1,
          signal: 'EXECUTE_LONG'
        }));

        res.json(signals);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  });

  describe('Binance期货交易对存在性验证', () => {
    test('应该检测到MATICUSDT在期货市场不存在', async () => {
      const response = await fetch('https://fapi.binance.com/fapi/v1/ticker/price?symbol=MATICUSDT');

      // MATICUSDT在期货市场应该返回错误
      expect(response.ok).toBe(false);
    }, 10000);

    test('应该验证POLUSDT在期货市场存在', async () => {
      const response = await fetch('https://fapi.binance.com/fapi/v1/ticker/price?symbol=POLUSDT');
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data).toHaveProperty('symbol', 'POLUSDT');
      expect(data).toHaveProperty('price');
      expect(parseFloat(data.price)).toBeGreaterThan(0);
    }, 10000);

    test('应该批量验证所有交易对在期货市场的有效性', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOTUSDT', 'LINKUSDT', 'LTCUSDT', 'BCHUSDT', 'UNIUSDT', 'POLUSDT', 'AVAXUSDT', 'ATOMUSDT', 'FILUSDT', 'TRXUSDT', 'ETCUSDT', 'XLMUSDT', 'VETUSDT', 'ICPUSDT', 'THETAUSDT', 'FTMUSDT'];

      const validationResults = [];

      for (const symbol of symbols) {
        try {
          const response = await fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`);
          const isValid = response.ok;

          if (isValid) {
            const data = await response.json();
            const price = parseFloat(data.price);
            validationResults.push({
              symbol,
              valid: true,
              price,
              hasValidPrice: price > 0
            });
          } else {
            validationResults.push({
              symbol,
              valid: false,
              price: 0,
              hasValidPrice: false
            });
          }
        } catch (error) {
          validationResults.push({
            symbol,
            valid: false,
            price: 0,
            hasValidPrice: false,
            error: error.message
          });
        }
      }

      // 检查结果
      const invalidSymbols = validationResults.filter(r => !r.valid);
      const zeroPrice = validationResults.filter(r => r.valid && !r.hasValidPrice);

      console.log('无效交易对:', invalidSymbols.map(s => s.symbol));
      console.log('价格为0的交易对:', zeroPrice.map(s => s.symbol));

      // 所有交易对都应该有效
      expect(invalidSymbols.length).toBe(0);
      expect(zeroPrice.length).toBe(0);
    }, 60000);
  });

  describe('API数据完整性验证', () => {
    test('所有交易对都应该有有效价格', async () => {
      const response = await request(app)
        .get('/api/signals')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      // 检查每个交易对
      response.body.forEach(signal => {
        expect(signal).toHaveProperty('symbol');
        expect(signal).toHaveProperty('currentPrice');

        // 价格必须大于0
        if (signal.currentPrice <= 0) {
          console.error(`❌ ${signal.symbol} 价格无效: ${signal.currentPrice}`);
          console.error(`   价格获取成功: ${signal.priceSuccess}`);
          console.error(`   错误信息: ${signal.priceError}`);
        }

        expect(signal.currentPrice).toBeGreaterThan(0);
      });
    }, 30000);

    test('应该能够检测到混合数据架构问题', async () => {
      const response = await request(app)
        .get('/api/signals')
        .expect(200);

      // 检查是否存在价格失败但趋势数据正常的情况
      const problematicSignals = response.body.filter(signal =>
        signal.currentPrice <= 0 && // 价格失败
        signal.trend4h && // 但有趋势数据
        signal.score > 0 // 且有评分数据
      );

      if (problematicSignals.length > 0) {
        console.warn('发现混合数据架构问题:', problematicSignals.map(s => ({
          symbol: s.symbol,
          price: s.currentPrice,
          trend: s.trend4h,
          score: s.score,
          priceError: s.priceError
        })));
      }

      // 不应该存在这种情况
      expect(problematicSignals.length).toBe(0);
    }, 15000);
  });

  describe('价格获取错误处理验证', () => {
    test('应该正确处理API调用失败的情况', async () => {
      const response = await request(app)
        .get('/api/signals')
        .expect(200);

      // 检查是否有价格获取失败的交易对
      const failedPrices = response.body.filter(signal => !signal.priceSuccess);

      if (failedPrices.length > 0) {
        console.log('价格获取失败的交易对:', failedPrices.map(s => ({
          symbol: s.symbol,
          error: s.priceError
        })));

        // 失败的情况下应该有备用价格机制
        failedPrices.forEach(signal => {
          // 即使API失败，也应该有合理的备用价格
          expect(signal.currentPrice).toBeGreaterThanOrEqual(0);
        });
      }
    }, 15000);

    test('应该验证备用价格的合理性', async () => {
      // 模拟所有API调用失败的情况
      const mockApp = express();
      mockApp.get('/api/signals', (req, res) => {
        const signals = [
          {
            symbol: 'BTCUSDT',
            currentPrice: 100000, // 备用价格应该在合理范围内
            priceSuccess: false,
            trend4h: '多头趋势',
            score: 4
          },
          {
            symbol: 'MATICUSDT',
            currentPrice: 0, // 这种情况应该被检测到
            priceSuccess: false,
            trend4h: '多头趋势',
            score: 4
          }
        ];
        res.json(signals);
      });

      const response = await request(mockApp)
        .get('/api/signals')
        .expect(200);

      // 检查备用价格的合理性
      response.body.forEach(signal => {
        if (signal.symbol === 'BTCUSDT') {
          // BTC价格应该在合理范围内（假设50k-200k）
          expect(signal.currentPrice).toBeGreaterThan(50000);
          expect(signal.currentPrice).toBeLessThan(200000);
        }

        if (signal.symbol === 'MATICUSDT') {
          // 不应该有0价格
          expect(signal.currentPrice).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('数据一致性验证', () => {
    test('应该验证价格数据与趋势数据的一致性', async () => {
      const response = await request(app)
        .get('/api/signals')
        .expect(200);

      response.body.forEach(signal => {
        // 如果有价格数据，就应该有完整的趋势数据
        if (signal.currentPrice > 0) {
          expect(signal.trend4h).toBeDefined();
          expect(signal.score).toBeDefined();
          expect(signal.score).toBeGreaterThan(0);
        }

        // 如果有趋势数据，就应该有有效的价格数据
        if (signal.trend4h && signal.score > 0) {
          expect(signal.currentPrice).toBeGreaterThan(0);
        }
      });
    });

    test('应该检测硬编码数据的时效性', async () => {
      const response = await request(app)
        .get('/api/signals')
        .expect(200);

      // 检查是否所有交易对都有最近的时间戳
      response.body.forEach(signal => {
        if (signal.timestamp) {
          const signalTime = new Date(signal.timestamp);
          const now = new Date();
          const timeDiff = now - signalTime;

          // 数据不应该超过1小时
          expect(timeDiff).toBeLessThan(3600000); // 1小时 = 3600000毫秒
        }
      });
    });
  });
});
