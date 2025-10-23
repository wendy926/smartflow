/**
 * Binance API单测 - 字段格式验证
 * 测试Binance API数据返回格式和字段验证
 */

const request = require('supertest');
const express = require('express');

// 模拟API路由
const app = express();
app.use(express.json());

// 模拟中间件
const mockAuth = (req, res, next) => {
  req.user = { id: 1, role: 'user' };
  next();
};

// Binance API数据格式模拟
const mockBinanceData = {
  // K线数据格式
  klines: (symbol, interval, limit = 100) => {
    const klines = [];
    const now = Date.now();
    const intervalMs = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };

    const intervalTime = intervalMs[interval] || intervalMs['15m'];
    let basePrice = symbol === 'BTCUSDT' ? 50000 :
      symbol === 'ETHUSDT' ? 3500 :
        symbol === 'ONDOUSDT' ? 0.25 :
          symbol === 'MKRUSDT' ? 2500 :
            symbol === 'PENDLEUSDT' ? 2.5 :
              symbol === 'MPLUSDT' ? 0.15 :
                symbol === 'LINKUSDT' ? 15 :
                  symbol === 'LDOUSDT' ? 3.5 : 100;

    for (let i = 0; i < limit; i++) {
      const change = (Math.random() - 0.5) * 0.02; // ±1%变化
      basePrice = basePrice * (1 + change);

      const high = basePrice * (1 + Math.random() * 0.01);
      const low = basePrice * (1 - Math.random() * 0.01);
      const open = basePrice * (1 + (Math.random() - 0.5) * 0.005);
      const close = basePrice;
      const volume = Math.random() * 1000000;

      klines.push([
        now - (limit - i) * intervalTime, // 开盘时间
        open.toFixed(8), // 开盘价
        high.toFixed(8), // 最高价
        low.toFixed(8), // 最低价
        close.toFixed(8), // 收盘价
        volume.toFixed(8), // 成交量
        now - (limit - i) * intervalTime + intervalTime - 1, // 收盘时间
        volume.toFixed(8), // 成交额
        10, // 成交笔数
        volume.toFixed(8), // 主动买入成交量
        volume.toFixed(8), // 主动买入成交额
        '0' // 忽略
      ]);
    }

    return klines;
  },

  // 24小时价格变动统计
  ticker24hr: (symbol) => ({
    symbol: symbol,
    priceChange: (Math.random() - 0.5) * 1000 + '',
    priceChangePercent: (Math.random() - 0.5) * 10 + '',
    weightedAvgPrice: (Math.random() * 100000).toFixed(8),
    prevClosePrice: (Math.random() * 100000).toFixed(8),
    lastPrice: (Math.random() * 100000).toFixed(8),
    lastQty: (Math.random() * 10).toFixed(8),
    bidPrice: (Math.random() * 100000).toFixed(8),
    bidQty: (Math.random() * 10).toFixed(8),
    askPrice: (Math.random() * 100000).toFixed(8),
    askQty: (Math.random() * 10).toFixed(8),
    openPrice: (Math.random() * 100000).toFixed(8),
    highPrice: (Math.random() * 100000).toFixed(8),
    lowPrice: (Math.random() * 100000).toFixed(8),
    volume: (Math.random() * 1000000).toFixed(8),
    quoteVolume: (Math.random() * 100000000).toFixed(8),
    openTime: Date.now() - 24 * 60 * 60 * 1000,
    closeTime: Date.now(),
    firstId: Math.floor(Math.random() * 1000000),
    lastId: Math.floor(Math.random() * 1000000) + 1000000,
    count: Math.floor(Math.random() * 1000000)
  }),

  // 资金费率
  fundingRate: (symbol) => ({
    symbol: symbol,
    markPrice: (Math.random() * 100000).toFixed(8),
    indexPrice: (Math.random() * 100000).toFixed(8),
    estimatedSettlePrice: (Math.random() * 100000).toFixed(8),
    lastFundingRate: (Math.random() * 0.001 - 0.0005).toFixed(8),
    nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
    interestRate: (Math.random() * 0.001 - 0.0005).toFixed(8),
    time: Date.now()
  }),

  // 持仓量历史
  openInterestHist: (symbol) => ({
    symbol: symbol,
    sumOpenInterest: (Math.random() * 1000000).toFixed(8),
    sumOpenInterestValue: (Math.random() * 1000000000).toFixed(8),
    timestamp: Date.now()
  }),

  // 交易信息
  exchangeInfo: () => ({
    timezone: "UTC",
    serverTime: Date.now(),
    rateLimits: [
      {
        rateLimitType: "REQUEST_WEIGHT",
        interval: "MINUTE",
        intervalNum: 1,
        limit: 1200
      },
      {
        rateLimitType: "ORDERS",
        interval: "SECOND",
        intervalNum: 10,
        limit: 100
      }
    ],
    symbols: [
      {
        symbol: "BTCUSDT",
        status: "TRADING",
        baseAsset: "BTC",
        baseAssetPrecision: 8,
        quoteAsset: "USDT",
        quotePrecision: 8,
        orderTypes: ["LIMIT", "MARKET", "STOP_LOSS_LIMIT", "TAKE_PROFIT_LIMIT"],
        icebergAllowed: true,
        filters: [
          {
            filterType: "PRICE_FILTER",
            minPrice: "0.01",
            maxPrice: "1000000.00",
            tickSize: "0.01"
          },
          {
            filterType: "LOT_SIZE",
            minQty: "0.00001",
            maxQty: "9000.00000000",
            stepSize: "0.00001"
          }
        ]
      }
    ]
  })
};

// 设置路由
app.get('/api/v1/binance/klines/:symbol/:interval', mockAuth, (req, res) => {
  const { symbol, interval } = req.params;
  const { limit = 100, startTime, endTime } = req.query;

  // 验证参数
  const validIntervals = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'];
  if (!validIntervals.includes(interval)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid interval',
      code: 'INVALID_INTERVAL',
      valid_intervals: validIntervals,
      timestamp: new Date().toISOString()
    });
  }

  const klines = mockBinanceData.klines(symbol, interval, parseInt(limit));

  res.json({
    success: true,
    data: klines,
    symbol: symbol,
    interval: interval,
    limit: parseInt(limit),
    startTime: startTime || null,
    endTime: endTime || null,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/v1/binance/ticker/24hr/:symbol', mockAuth, (req, res) => {
  const { symbol } = req.params;
  const ticker = mockBinanceData.ticker24hr(symbol);

  res.json({
    success: true,
    data: ticker,
    symbol: symbol,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/v1/binance/funding-rate/:symbol', mockAuth, (req, res) => {
  const { symbol } = req.params;
  const fundingRate = mockBinanceData.fundingRate(symbol);

  res.json({
    success: true,
    data: fundingRate,
    symbol: symbol,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/v1/binance/open-interest/:symbol', mockAuth, (req, res) => {
  const { symbol } = req.params;
  const openInterest = mockBinanceData.openInterestHist(symbol);

  res.json({
    success: true,
    data: openInterest,
    symbol: symbol,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/v1/binance/exchange-info', mockAuth, (req, res) => {
  const exchangeInfo = mockBinanceData.exchangeInfo();

  res.json({
    success: true,
    data: exchangeInfo,
    timestamp: new Date().toISOString()
  });
});

describe('Binance API - 字段格式验证', () => {
  describe('GET /api/v1/binance/klines/:symbol/:interval', () => {
    it('应该返回K线数据的完整格式', async () => {
      const response = await request(app)
        .get('/api/v1/binance/klines/BTCUSDT/15m?limit=10')
        .expect(200);

      // 验证响应结构
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('symbol', 'BTCUSDT');
      expect(response.body).toHaveProperty('interval', '15m');
      expect(response.body).toHaveProperty('limit', 10);
      expect(response.body).toHaveProperty('timestamp');

      // 验证K线数据格式
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(10);

      // 验证每根K线的格式
      response.body.data.forEach(kline => {
        expect(Array.isArray(kline)).toBe(true);
        expect(kline.length).toBe(12);

        // 验证字段类型和格式
        expect(typeof kline[0]).toBe('number'); // 开盘时间
        expect(typeof kline[1]).toBe('string'); // 开盘价
        expect(typeof kline[2]).toBe('string'); // 最高价
        expect(typeof kline[3]).toBe('string'); // 最低价
        expect(typeof kline[4]).toBe('string'); // 收盘价
        expect(typeof kline[5]).toBe('string'); // 成交量
        expect(typeof kline[6]).toBe('number'); // 收盘时间
        expect(typeof kline[7]).toBe('string'); // 成交额
        expect(typeof kline[8]).toBe('number'); // 成交笔数
        expect(typeof kline[9]).toBe('string'); // 主动买入成交量
        expect(typeof kline[10]).toBe('string'); // 主动买入成交额
        expect(typeof kline[11]).toBe('string'); // 忽略

        // 验证价格格式（8位小数）
        expect(kline[1]).toMatch(/^\d+\.\d{8}$/);
        expect(kline[2]).toMatch(/^\d+\.\d{8}$/);
        expect(kline[3]).toMatch(/^\d+\.\d{8}$/);
        expect(kline[4]).toMatch(/^\d+\.\d{8}$/);
      });
    });

    it('应该支持不同的时间间隔', async () => {
      const intervals = ['1m', '5m', '15m', '1h', '4h', '1d'];

      for (const interval of intervals) {
        const response = await request(app)
          .get(`/api/v1/binance/klines/BTCUSDT/${interval}`)
          .expect(200);

        expect(response.body.interval).toBe(interval);
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });

    it('应该返回400当时间间隔无效', async () => {
      const response = await request(app)
        .get('/api/v1/binance/klines/BTCUSDT/invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid interval');
      expect(response.body.code).toBe('INVALID_INTERVAL');
      expect(response.body.valid_intervals).toBeDefined();
    });

    it('应该支持不同的交易对', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'ONDOUSDT', 'MKRUSDT'];

      for (const symbol of symbols) {
        const response = await request(app)
          .get(`/api/v1/binance/klines/${symbol}/15m`)
          .expect(200);

        expect(response.body.symbol).toBe(symbol);
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });
  });

  describe('GET /api/v1/binance/ticker/24hr/:symbol', () => {
    it('应该返回24小时价格统计的完整格式', async () => {
      const response = await request(app)
        .get('/api/v1/binance/ticker/24hr/BTCUSDT')
        .expect(200);

      // 验证响应结构
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('symbol', 'BTCUSDT');
      expect(response.body).toHaveProperty('timestamp');

      // 验证数据格式
      const ticker = response.body.data;
      expect(ticker).toHaveProperty('symbol', 'BTCUSDT');
      expect(ticker).toHaveProperty('priceChange');
      expect(ticker).toHaveProperty('priceChangePercent');
      expect(ticker).toHaveProperty('weightedAvgPrice');
      expect(ticker).toHaveProperty('prevClosePrice');
      expect(ticker).toHaveProperty('lastPrice');
      expect(ticker).toHaveProperty('lastQty');
      expect(ticker).toHaveProperty('bidPrice');
      expect(ticker).toHaveProperty('bidQty');
      expect(ticker).toHaveProperty('askPrice');
      expect(ticker).toHaveProperty('askQty');
      expect(ticker).toHaveProperty('openPrice');
      expect(ticker).toHaveProperty('highPrice');
      expect(ticker).toHaveProperty('lowPrice');
      expect(ticker).toHaveProperty('volume');
      expect(ticker).toHaveProperty('quoteVolume');
      expect(ticker).toHaveProperty('openTime');
      expect(ticker).toHaveProperty('closeTime');
      expect(ticker).toHaveProperty('firstId');
      expect(ticker).toHaveProperty('lastId');
      expect(ticker).toHaveProperty('count');

      // 验证字段类型
      expect(typeof ticker.priceChange).toBe('string');
      expect(typeof ticker.priceChangePercent).toBe('string');
      expect(typeof ticker.weightedAvgPrice).toBe('string');
      expect(typeof ticker.lastPrice).toBe('string');
      expect(typeof ticker.volume).toBe('string');
      expect(typeof ticker.quoteVolume).toBe('string');
      expect(typeof ticker.openTime).toBe('number');
      expect(typeof ticker.closeTime).toBe('number');
      expect(typeof ticker.firstId).toBe('number');
      expect(typeof ticker.lastId).toBe('number');
      expect(typeof ticker.count).toBe('number');
    });
  });

  describe('GET /api/v1/binance/funding-rate/:symbol', () => {
    it('应该返回资金费率的完整格式', async () => {
      const response = await request(app)
        .get('/api/v1/binance/funding-rate/BTCUSDT')
        .expect(200);

      // 验证响应结构
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('symbol', 'BTCUSDT');
      expect(response.body).toHaveProperty('timestamp');

      // 验证数据格式
      const fundingRate = response.body.data;
      expect(fundingRate).toHaveProperty('symbol', 'BTCUSDT');
      expect(fundingRate).toHaveProperty('markPrice');
      expect(fundingRate).toHaveProperty('indexPrice');
      expect(fundingRate).toHaveProperty('estimatedSettlePrice');
      expect(fundingRate).toHaveProperty('lastFundingRate');
      expect(fundingRate).toHaveProperty('nextFundingTime');
      expect(fundingRate).toHaveProperty('interestRate');
      expect(fundingRate).toHaveProperty('time');

      // 验证字段类型
      expect(typeof fundingRate.markPrice).toBe('string');
      expect(typeof fundingRate.indexPrice).toBe('string');
      expect(typeof fundingRate.estimatedSettlePrice).toBe('string');
      expect(typeof fundingRate.lastFundingRate).toBe('string');
      expect(typeof fundingRate.nextFundingTime).toBe('number');
      expect(typeof fundingRate.interestRate).toBe('string');
      expect(typeof fundingRate.time).toBe('number');
    });
  });

  describe('GET /api/v1/binance/open-interest/:symbol', () => {
    it('应该返回持仓量历史的完整格式', async () => {
      const response = await request(app)
        .get('/api/v1/binance/open-interest/BTCUSDT')
        .expect(200);

      // 验证响应结构
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('symbol', 'BTCUSDT');
      expect(response.body).toHaveProperty('timestamp');

      // 验证数据格式
      const openInterest = response.body.data;
      expect(openInterest).toHaveProperty('symbol', 'BTCUSDT');
      expect(openInterest).toHaveProperty('sumOpenInterest');
      expect(openInterest).toHaveProperty('sumOpenInterestValue');
      expect(openInterest).toHaveProperty('timestamp');

      // 验证字段类型
      expect(typeof openInterest.sumOpenInterest).toBe('string');
      expect(typeof openInterest.sumOpenInterestValue).toBe('string');
      expect(typeof openInterest.timestamp).toBe('number');
    });
  });

  describe('GET /api/v1/binance/exchange-info', () => {
    it('应该返回交易所信息的完整格式', async () => {
      const response = await request(app)
        .get('/api/v1/binance/exchange-info')
        .expect(200);

      // 验证响应结构
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('timestamp');

      // 验证数据格式
      const exchangeInfo = response.body.data;
      expect(exchangeInfo).toHaveProperty('timezone', 'UTC');
      expect(exchangeInfo).toHaveProperty('serverTime');
      expect(exchangeInfo).toHaveProperty('rateLimits');
      expect(exchangeInfo).toHaveProperty('symbols');

      // 验证字段类型
      expect(typeof exchangeInfo.timezone).toBe('string');
      expect(typeof exchangeInfo.serverTime).toBe('number');
      expect(Array.isArray(exchangeInfo.rateLimits)).toBe(true);
      expect(Array.isArray(exchangeInfo.symbols)).toBe(true);

      // 验证速率限制格式
      exchangeInfo.rateLimits.forEach(limit => {
        expect(limit).toHaveProperty('rateLimitType');
        expect(limit).toHaveProperty('interval');
        expect(limit).toHaveProperty('intervalNum');
        expect(limit).toHaveProperty('limit');
        expect(typeof limit.rateLimitType).toBe('string');
        expect(typeof limit.interval).toBe('string');
        expect(typeof limit.intervalNum).toBe('number');
        expect(typeof limit.limit).toBe('number');
      });

      // 验证交易对格式
      exchangeInfo.symbols.forEach(symbol => {
        expect(symbol).toHaveProperty('symbol');
        expect(symbol).toHaveProperty('status');
        expect(symbol).toHaveProperty('baseAsset');
        expect(symbol).toHaveProperty('quoteAsset');
        expect(symbol).toHaveProperty('baseAssetPrecision');
        expect(symbol).toHaveProperty('quotePrecision');
        expect(symbol).toHaveProperty('orderTypes');
        expect(symbol).toHaveProperty('icebergAllowed');
        expect(symbol).toHaveProperty('filters');
        expect(typeof symbol.symbol).toBe('string');
        expect(typeof symbol.status).toBe('string');
        expect(typeof symbol.baseAsset).toBe('string');
        expect(typeof symbol.quoteAsset).toBe('string');
        expect(typeof symbol.baseAssetPrecision).toBe('number');
        expect(typeof symbol.quotePrecision).toBe('number');
        expect(Array.isArray(symbol.orderTypes)).toBe(true);
        expect(typeof symbol.icebergAllowed).toBe('boolean');
        expect(Array.isArray(symbol.filters)).toBe(true);
      });
    });
  });
});
