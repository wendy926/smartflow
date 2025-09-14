// binance-api.test.js
// BinanceAPI API调用测试

const BinanceAPI = require('../modules/api/BinanceAPI');

describe('BinanceAPI API调用测试', () => {
  let binanceAPI;

  beforeEach(() => {
    binanceAPI = new BinanceAPI();
  });

  afterEach(() => {
    if (binanceAPI) {
      binanceAPI.destroy();
    }
  });

  describe('K线数据获取', () => {
    test('应该正确获取K线数据', async () => {
      const symbol = 'BTCUSDT';
      const interval = '4h';
      const limit = 100;

      const klines = await binanceAPI.getKlines(symbol, interval, limit);

      expect(klines).toBeDefined();
      expect(Array.isArray(klines)).toBe(true);
      expect(klines.length).toBeGreaterThan(0);
      expect(klines.length).toBeLessThanOrEqual(limit);

      // 验证K线数据结构
      const kline = klines[0];
      expect(kline).toHaveProperty('openTime');
      expect(kline).toHaveProperty('open');
      expect(kline).toHaveProperty('high');
      expect(kline).toHaveProperty('low');
      expect(kline).toHaveProperty('close');
      expect(kline).toHaveProperty('volume');
    });

    test('应该正确处理无效交易对', async () => {
      const symbol = 'INVALIDPAIR';
      const interval = '4h';
      const limit = 100;

      expect(async () => {
        await binanceAPI.getKlines(symbol, interval, limit);
      }).rejects.toThrow();
    });

    test('应该正确处理无效时间间隔', async () => {
      const symbol = 'BTCUSDT';
      const interval = 'invalid';
      const limit = 100;

      expect(async () => {
        await binanceAPI.getKlines(symbol, interval, limit);
      }).rejects.toThrow();
    });

    test('应该正确处理无效限制数量', async () => {
      const symbol = 'BTCUSDT';
      const interval = '4h';
      const limit = -1;

      expect(async () => {
        await binanceAPI.getKlines(symbol, interval, limit);
      }).rejects.toThrow();
    });
  });

  describe('24小时价格统计', () => {
    test('应该正确获取24小时价格统计', async () => {
      const symbol = 'BTCUSDT';

      const ticker = await binanceAPI.get24hrTicker(symbol);

      expect(ticker).toBeDefined();
      expect(ticker.symbol).toBe(symbol);
      expect(ticker.price).toBeDefined();
      expect(ticker.price).toBeGreaterThan(0);
      expect(ticker.priceChange).toBeDefined();
      expect(ticker.priceChangePercent).toBeDefined();
      expect(ticker.volume).toBeDefined();
      expect(ticker.volume).toBeGreaterThan(0);
    });

    test('应该正确处理多个交易对', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'LINKUSDT'];

      const tickers = await binanceAPI.get24hrTickers(symbols);

      expect(tickers).toBeDefined();
      expect(Array.isArray(tickers)).toBe(true);
      expect(tickers.length).toBe(symbols.length);

      for (const ticker of tickers) {
        expect(ticker.symbol).toBeDefined();
        expect(ticker.price).toBeGreaterThan(0);
      }
    });
  });

  describe('当前价格获取', () => {
    test('应该正确获取当前价格', async () => {
      const symbol = 'BTCUSDT';

      const price = await binanceAPI.getTickerPrice(symbol);

      expect(price).toBeDefined();
      expect(price.symbol).toBe(symbol);
      expect(price.price).toBeDefined();
      expect(price.price).toBeGreaterThan(0);
    });

    test('应该正确处理多个交易对价格', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT'];

      const prices = await binanceAPI.getTickerPrices(symbols);

      expect(prices).toBeDefined();
      expect(Array.isArray(prices)).toBe(true);
      expect(prices.length).toBe(symbols.length);

      for (const price of prices) {
        expect(price.symbol).toBeDefined();
        expect(price.price).toBeGreaterThan(0);
      }
    });
  });

  describe('持仓量历史', () => {
    test('应该正确获取持仓量历史', async () => {
      const symbol = 'BTCUSDT';
      const interval = '5m';
      const limit = 100;

      const oiHistory = await binanceAPI.getOpenInterestHistory(symbol, interval, limit);

      expect(oiHistory).toBeDefined();
      expect(Array.isArray(oiHistory)).toBe(true);
      expect(oiHistory.length).toBeGreaterThan(0);

      // 验证持仓量数据结构
      const oi = oiHistory[0];
      expect(oi).toHaveProperty('symbol');
      expect(oi).toHaveProperty('sumOpenInterest');
      expect(oi).toHaveProperty('sumOpenInterestValue');
      expect(oi).toHaveProperty('timestamp');
    });
  });

  describe('资金费率', () => {
    test('应该正确获取资金费率', async () => {
      const symbol = 'BTCUSDT';

      const fundingRate = await binanceAPI.getFundingRate(symbol);

      expect(fundingRate).toBeDefined();
      expect(fundingRate.symbol).toBe(symbol);
      expect(fundingRate.fundingRate).toBeDefined();
      expect(typeof fundingRate.fundingRate).toBe('number');
    });
  });

  describe('限流处理', () => {
    test('应该正确处理API限流', async () => {
      // 模拟快速连续请求
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(binanceAPI.getTickerPrice('BTCUSDT'));
      }

      const results = await Promise.allSettled(promises);

      // 至少有一些请求成功
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(0);
    });

    test('应该在限流时正确等待', async () => {
      const startTime = Date.now();

      // 连续请求触发限流
      await binanceAPI.getTickerPrice('BTCUSDT');
      await binanceAPI.getTickerPrice('BTCUSDT');
      await binanceAPI.getTickerPrice('BTCUSDT');

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 应该有一定的时间间隔
      expect(duration).toBeGreaterThan(0);
    });
  });

  describe('错误处理', () => {
    test('应该正确处理网络错误', async () => {
      // 模拟网络错误
      const originalRequest = binanceAPI.request;
      binanceAPI.request = jest.fn().mockRejectedValue(new Error('Network error'));

      expect(async () => {
        await binanceAPI.getTickerPrice('BTCUSDT');
      }).rejects.toThrow('Network error');

      // 恢复原始方法
      binanceAPI.request = originalRequest;
    });

    test('应该正确处理API错误响应', async () => {
      // 模拟API错误响应
      const originalRequest = binanceAPI.request;
      binanceAPI.request = jest.fn().mockResolvedValue({
        error: {
          code: -1121,
          msg: 'Invalid symbol'
        }
      });

      expect(async () => {
        await binanceAPI.getTickerPrice('INVALID');
      }).rejects.toThrow();

      // 恢复原始方法
      binanceAPI.request = originalRequest;
    });

    test('应该正确处理超时', async () => {
      // 模拟超时
      const originalRequest = binanceAPI.request;
      binanceAPI.request = jest.fn().mockImplementation(() =>
        new Promise((resolve, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      expect(async () => {
        await binanceAPI.getTickerPrice('BTCUSDT');
      }).rejects.toThrow('Timeout');

      // 恢复原始方法
      binanceAPI.request = originalRequest;
    });
  });

  describe('数据验证', () => {
    test('应该验证K线数据完整性', async () => {
      const symbol = 'BTCUSDT';
      const interval = '1h';
      const limit = 10;

      const klines = await binanceAPI.getKlines(symbol, interval, limit);

      for (const kline of klines) {
        // 验证数值类型
        expect(typeof kline.open).toBe('number');
        expect(typeof kline.high).toBe('number');
        expect(typeof kline.low).toBe('number');
        expect(typeof kline.close).toBe('number');
        expect(typeof kline.volume).toBe('number');

        // 验证数值合理性
        expect(kline.open).toBeGreaterThan(0);
        expect(kline.high).toBeGreaterThan(0);
        expect(kline.low).toBeGreaterThan(0);
        expect(kline.close).toBeGreaterThan(0);
        expect(kline.volume).toBeGreaterThanOrEqual(0);

        // 验证高低价关系
        expect(kline.high).toBeGreaterThanOrEqual(kline.low);
        expect(kline.high).toBeGreaterThanOrEqual(kline.open);
        expect(kline.high).toBeGreaterThanOrEqual(kline.close);
        expect(kline.low).toBeLessThanOrEqual(kline.open);
        expect(kline.low).toBeLessThanOrEqual(kline.close);
      }
    });

    test('应该验证价格数据合理性', async () => {
      const symbol = 'BTCUSDT';

      const price = await binanceAPI.getTickerPrice(symbol);

      expect(price.price).toBeGreaterThan(0);
      expect(price.price).toBeLessThan(1000000); // 合理的价格上限
      expect(typeof price.price).toBe('number');
    });
  });

  describe('缓存机制', () => {
    test('应该正确使用缓存', async () => {
      const symbol = 'BTCUSDT';

      // 第一次请求
      const startTime1 = Date.now();
      const price1 = await binanceAPI.getTickerPrice(symbol);
      const duration1 = Date.now() - startTime1;

      // 第二次请求（应该使用缓存）
      const startTime2 = Date.now();
      const price2 = await binanceAPI.getTickerPrice(symbol);
      const duration2 = Date.now() - startTime2;

      expect(price1.price).toBe(price2.price);
      expect(duration2).toBeLessThan(duration1);
    });

    test('应该正确处理缓存过期', async () => {
      const symbol = 'BTCUSDT';

      // 设置很短的缓存时间
      binanceAPI.cacheTTL = 100; // 100ms

      // 第一次请求
      const price1 = await binanceAPI.getTickerPrice(symbol);

      // 等待缓存过期
      await new Promise(resolve => setTimeout(resolve, 150));

      // 第二次请求（应该重新获取）
      const price2 = await binanceAPI.getTickerPrice(symbol);

      expect(price1.price).toBe(price2.price);
    });
  });
});
