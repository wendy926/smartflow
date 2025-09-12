// API响应验证测试
const request = require('supertest');
const app = require('../server');

describe('API响应验证测试', () => {
  let server;

  beforeAll(async () => {
    server = app.listen(0);
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe('/api/signals 端点', () => {
    test('应该返回所有交易对的信号数据', async () => {
      const response = await request(app)
        .get('/api/signals')
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
    });

    test('每个交易对应该包含必要的字段', async () => {
      const response = await request(app)
        .get('/api/signals')
        .expect(200);

      const signal = response.body[0];
      expect(signal).toHaveProperty('symbol');
      expect(signal).toHaveProperty('score');
      expect(signal).toHaveProperty('direction');
      expect(signal).toHaveProperty('trend4h');
      expect(signal).toHaveProperty('marketType');
      expect(signal).toHaveProperty('score1h');
      expect(signal).toHaveProperty('vwapDirectionConsistent');
      expect(signal).toHaveProperty('signal');
      expect(signal).toHaveProperty('execution');
      expect(signal).toHaveProperty('reason');
    });

    test('趋势打分应该为数值类型', async () => {
      const response = await request(app)
        .get('/api/signals')
        .expect(200);

      response.body.forEach(signal => {
        expect(typeof signal.score).toBe('number');
        expect(signal.score).toBeGreaterThanOrEqual(0);
        expect(signal.score).toBeLessThanOrEqual(5);
      });
    });

    test('多因子得分应该为数值类型', async () => {
      const response = await request(app)
        .get('/api/signals')
        .expect(200);

      response.body.forEach(signal => {
        expect(typeof signal.score1h).toBe('number');
        expect(signal.score1h).toBeGreaterThanOrEqual(0);
      });
    });

    test('当前价格应该为数值类型且大于0', async () => {
      const response = await request(app)
        .get('/api/signals')
        .expect(200);

      response.body.forEach(signal => {
        if (signal.currentPrice !== null) {
          expect(typeof signal.currentPrice).toBe('number');
          expect(signal.currentPrice).toBeGreaterThan(0);
        }
      });
    });

    test('VWAP方向一致性应该为布尔类型', async () => {
      const response = await request(app)
        .get('/api/signals')
        .expect(200);

      response.body.forEach(signal => {
        expect(typeof signal.vwapDirectionConsistent).toBe('boolean');
      });
    });

    test('趋势类型应该为有效值', async () => {
      const response = await request(app)
        .get('/api/signals')
        .expect(200);

      const validTrends = ['多头趋势', '空头趋势', '震荡市'];
      response.body.forEach(signal => {
        expect(validTrends).toContain(signal.trend4h);
      });
    });

    test('市场类型应该为有效值', async () => {
      const response = await request(app)
        .get('/api/signals')
        .expect(200);

      const validMarketTypes = ['趋势市', '震荡市'];
      response.body.forEach(signal => {
        expect(validMarketTypes).toContain(signal.marketType);
      });
    });

    test('信号类型应该为有效值', async () => {
      const response = await request(app)
        .get('/api/signals')
        .expect(200);

      const validSignals = ['BUY', 'SELL', 'NONE'];
      response.body.forEach(signal => {
        expect(validSignals).toContain(signal.signal);
      });
    });
  });

  describe('数据正确性验证', () => {
    test('空头趋势的交易对应该有正确的VWAP方向一致性', async () => {
      const response = await request(app)
        .get('/api/signals')
        .expect(200);

      const bearishTrends = response.body.filter(signal => signal.trend4h === '空头趋势');
      
      bearishTrends.forEach(signal => {
        // 空头趋势：当前价格应该低于VWAP
        if (signal.vwapDirectionConsistent) {
          expect(signal.currentPrice).toBeLessThan(signal.vwap || signal.currentPrice);
        }
      });
    });

    test('多头趋势的交易对应该有正确的VWAP方向一致性', async () => {
      const response = await request(app)
        .get('/api/signals')
        .expect(200);

      const bullishTrends = response.body.filter(signal => signal.trend4h === '多头趋势');
      
      bullishTrends.forEach(signal => {
        // 多头趋势：当前价格应该高于VWAP
        if (signal.vwapDirectionConsistent) {
          expect(signal.currentPrice).toBeGreaterThan(signal.vwap || signal.currentPrice);
        }
      });
    });

    test('得分≥3的交易对应该允许入场', async () => {
      const response = await request(app)
        .get('/api/signals')
        .expect(200);

      const highScoreSignals = response.body.filter(signal => signal.score1h >= 3);
      
      highScoreSignals.forEach(signal => {
        // 得分≥3且VWAP方向一致时，应该允许入场
        if (signal.vwapDirectionConsistent) {
          expect(signal.allowEntry).toBe(true);
        }
      });
    });

    test('趋势市应该基于1H多因子得分判断', async () => {
      const response = await request(app)
        .get('/api/signals')
        .expect(200);

      const trendMarkets = response.body.filter(signal => signal.marketType === '趋势市');
      
      trendMarkets.forEach(signal => {
        // 趋势市：1H多因子得分应该>0
        expect(signal.score1h).toBeGreaterThan(0);
      });
    });

    test('震荡市应该基于1H边界有效性判断', async () => {
      const response = await request(app)
        .get('/api/signals')
        .expect(200);

      const rangeMarkets = response.body.filter(signal => signal.marketType === '震荡市');
      
      rangeMarkets.forEach(signal => {
        // 震荡市：应该有边界有效性得分
        expect(signal.score1h).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('特定交易对验证', () => {
    test('AVAXUSDT应该有正确的数据结构', async () => {
      const response = await request(app)
        .get('/api/signals')
        .expect(200);

      const avaxSignal = response.body.find(signal => signal.symbol === 'AVAXUSDT');
      expect(avaxSignal).toBeDefined();
      
      if (avaxSignal) {
        expect(typeof avaxSignal.score).toBe('number');
        expect(typeof avaxSignal.score1h).toBe('number');
        expect(typeof avaxSignal.vwapDirectionConsistent).toBe('boolean');
        expect(typeof avaxSignal.currentPrice).toBe('number');
        expect(avaxSignal.currentPrice).toBeGreaterThan(0);
      }
    });

    test('LINKUSDT应该有正确的数据结构', async () => {
      const response = await request(app)
        .get('/api/signals')
        .expect(200);

      const linkSignal = response.body.find(signal => signal.symbol === 'LINKUSDT');
      expect(linkSignal).toBeDefined();
      
      if (linkSignal) {
        expect(typeof linkSignal.score).toBe('number');
        expect(typeof linkSignal.score1h).toBe('number');
        expect(typeof linkSignal.vwapDirectionConsistent).toBe('boolean');
        expect(typeof linkSignal.currentPrice).toBe('number');
        expect(linkSignal.currentPrice).toBeGreaterThan(0);
      }
    });

    test('SOLUSDT应该有正确的数据结构', async () => {
      const response = await request(app)
        .get('/api/signals')
        .expect(200);

      const solSignal = response.body.find(signal => signal.symbol === 'SOLUSDT');
      expect(solSignal).toBeDefined();
      
      if (solSignal) {
        expect(typeof solSignal.score).toBe('number');
        expect(typeof solSignal.score1h).toBe('number');
        expect(typeof solSignal.vwapDirectionConsistent).toBe('boolean');
        expect(typeof solSignal.currentPrice).toBe('number');
        expect(solSignal.currentPrice).toBeGreaterThan(0);
      }
    });
  });
});
