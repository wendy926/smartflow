/**
 * 美股适配器单元测试
 */

const USStockAdapter = require('../../src/adapters/USStockAdapter');
const { MarketType, Timeframe, OrderType, OrderSide } = require('../../src/core/interfaces/IExchangeAdapter');

describe('USStockAdapter', () => {
  let adapter;
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      symbols: ['AAPL', 'MSFT', 'GOOGL'],
      alpaca: {
        apiKey: 'test-alpaca-key',
        secretKey: 'test-alpaca-secret',
        useSandbox: true
      },
      alphaVantage: {
        apiKey: 'test-alpha-vantage-key'
      },
      yahooFinance: {
        baseURL: 'https://query1.finance.yahoo.com'
      }
    };

    adapter = new USStockAdapter(mockConfig);
  });

  describe('构造函数', () => {
    it('应该正确初始化', () => {
      expect(adapter).toBeDefined();
      expect(adapter.config).toBe(mockConfig);
      expect(adapter.alpacaAPI).toBeDefined();
      expect(adapter.alphaVantageAPI).toBeDefined();
      expect(adapter.yahooFinanceAPI).toBeDefined();
    });

    it('应该设置市场信息', () => {
      const marketInfo = adapter.getMarketInfo();
      expect(marketInfo.marketType).toBe(MarketType.US_STOCK);
      expect(marketInfo.symbols).toEqual(['AAPL', 'MSFT', 'GOOGL']);
      expect(marketInfo.timezone).toBe('America/New_York');
    });

    it('应该设置交易时间', () => {
      const marketInfo = adapter.getMarketInfo();
      expect(marketInfo.tradingHours.sessions).toHaveLength(1);
      expect(marketInfo.tradingHours.sessions[0].open).toBe('09:30');
      expect(marketInfo.tradingHours.sessions[0].close).toBe('16:00');
      expect(marketInfo.tradingHours.sessions[0].days).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('isSymbolSupported', () => {
    it('应该正确验证支持的交易对', () => {
      expect(adapter.isSymbolSupported('AAPL')).toBe(true);
      expect(adapter.isSymbolSupported('MSFT')).toBe(true);
      expect(adapter.isSymbolSupported('GOOGL')).toBe(true);
      expect(adapter.isSymbolSupported('TSLA')).toBe(false);
    });
  });

  describe('convertTimeframe', () => {
    it('应该正确转换时间框架', () => {
      expect(adapter.convertTimeframe(Timeframe.MINUTE_1)).toBe('1Min');
      expect(adapter.convertTimeframe(Timeframe.MINUTE_5)).toBe('5Min');
      expect(adapter.convertTimeframe(Timeframe.MINUTE_15)).toBe('15Min');
      expect(adapter.convertTimeframe(Timeframe.HOUR_1)).toBe('1Hour');
      expect(adapter.convertTimeframe(Timeframe.HOUR_4)).toBe('4Hour');
      expect(adapter.convertTimeframe(Timeframe.DAY_1)).toBe('1Day');
    });
  });

  describe('getKlines', () => {
    it('应该获取K线数据', async () => {
      const mockKlines = [
        {
          t: new Date('2024-01-01T00:00:00Z').getTime(),
          o: 150.0,
          h: 155.0,
          l: 149.0,
          c: 152.0,
          v: 1000000
        }
      ];

      jest.spyOn(adapter.alpacaAPI, 'getBars').mockResolvedValue(mockKlines);

      const klines = await adapter.getKlines('AAPL', Timeframe.MINUTE_15, 100);

      expect(klines).toHaveLength(1);
      expect(klines[0].symbol).toBe('AAPL');
      expect(klines[0].timeframe).toBe(Timeframe.MINUTE_15);
      expect(klines[0].marketType).toBe(MarketType.US_STOCK);
      expect(klines[0].open).toBe(150.0);
      expect(klines[0].high).toBe(155.0);
      expect(klines[0].low).toBe(149.0);
      expect(klines[0].close).toBe(152.0);
      expect(klines[0].volume).toBe(1000000);
    });

    it('应该在不支持的交易对时抛出错误', async () => {
      await expect(adapter.getKlines('INVALID', Timeframe.MINUTE_15)).rejects.toThrow();
    });
  });

  describe('getTicker', () => {
    it('应该获取实时价格', async () => {
      jest.spyOn(adapter.alpacaAPI, 'getLatestTrade').mockResolvedValue({ price: 152.50 });

      const price = await adapter.getTicker('AAPL');

      expect(price).toBe(152.50);
    });
  });

  describe('getOrderBook', () => {
    it('应该获取订单簿', async () => {
      const mockOrderBook = {
        bids: [{ price: '151.00', size: '100' }, { price: '150.00', size: '200' }],
        asks: [{ price: '152.00', size: '150' }, { price: '153.00', size: '300' }],
        timestamp: Date.now()
      };

      jest.spyOn(adapter.alpacaAPI, 'getOrderBook').mockResolvedValue(mockOrderBook);

      const orderBook = await adapter.getOrderBook('AAPL');

      expect(orderBook.bids).toHaveLength(2);
      expect(orderBook.asks).toHaveLength(2);
      expect(orderBook.bids[0].price).toBe(151.00);
      expect(orderBook.asks[0].price).toBe(152.00);
    });
  });

  describe('placeOrder', () => {
    it('应该创建市价买单', async () => {
      const order = {
        symbol: 'AAPL',
        side: OrderSide.BUY,
        type: OrderType.MARKET,
        quantity: 10,
        timeInForce: 'day'
      };

      const mockResponse = {
        id: 'order-123',
        symbol: 'AAPL',
        status: 'new',
        filled_qty: '0',
        filled_avg_price: null,
        created_at: new Date().toISOString()
      };

      jest.spyOn(adapter.alpacaAPI, 'placeOrder').mockResolvedValue(mockResponse);

      const result = await adapter.placeOrder(order);

      expect(result.orderId).toBe('order-123');
      expect(result.symbol).toBe('AAPL');
      expect(result.status).toBe('NEW');
    });

    it('应该创建限价单', async () => {
      const order = {
        symbol: 'AAPL',
        side: OrderSide.SELL,
        type: OrderType.LIMIT,
        quantity: 5,
        price: 155.00,
        timeInForce: 'day'
      };

      const mockResponse = {
        id: 'order-124',
        symbol: 'AAPL',
        status: 'new',
        filled_qty: '0',
        filled_avg_price: null,
        created_at: new Date().toISOString()
      };

      jest.spyOn(adapter.alpacaAPI, 'placeOrder').mockResolvedValue(mockResponse);

      const result = await adapter.placeOrder(order);

      expect(adapter.alpacaAPI.placeOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'AAPL',
          qty: 5,
          side: 'sell',
          type: 'limit',
          limit_price: 155.00,
          time_in_force: 'day'
        })
      );
    });
  });

  describe('getAccount', () => {
    it('应该获取账户信息', async () => {
      const mockAccount = {
        buying_power: '100000.00',
        cash: '50000.00'
      };

      jest.spyOn(adapter.alpacaAPI, 'getAccount').mockResolvedValue(mockAccount);

      const account = await adapter.getAccount();

      expect(account.balance).toHaveLength(1);
      expect(account.balance[0].asset).toBe('USD');
      expect(account.balance[0].free).toBe(100000.00);
    });
  });

  describe('getPositions', () => {
    it('应该获取持仓信息', async () => {
      const mockPositions = [
        {
          symbol: 'AAPL',
          qty: '10',
          avg_entry_price: '150.00',
          unrealized_pl: '50.00',
          realized_pl: '0'
        }
      ];

      jest.spyOn(adapter.alpacaAPI, 'getPositions').mockResolvedValue(mockPositions);

      const positions = await adapter.getPositions('AAPL');

      expect(positions).toHaveLength(1);
      expect(positions[0].symbol).toBe('AAPL');
      expect(positions[0].quantity).toBe(10);
      expect(positions[0].entryPrice).toBe(150.00);
      expect(positions[0].unrealizedPnL).toBe(50.00);
    });
  });

  describe('getMarketMetrics', () => {
    it('应该获取市场指标', async () => {
      const mockOptions = { putCallRatio: 1.5, oiChange: 10000, volume: 5000000 };
      const mockInstitutional = { netFlow: 50000 };
      const mockVIX = { value: 25.5 };
      const mockShortInterest = { shortInterest: 5000000 };

      jest.spyOn(adapter.alphaVantageAPI, 'getOptionsData').mockResolvedValue(mockOptions);
      jest.spyOn(adapter.alphaVantageAPI, 'getInstitutionalFlow').mockResolvedValue(mockInstitutional);
      jest.spyOn(adapter.alphaVantageAPI, 'getVIX').mockResolvedValue(mockVIX);
      jest.spyOn(adapter.yahooFinanceAPI, 'getShortInterest').mockResolvedValue(mockShortInterest);

      const metrics = await adapter.getMarketMetrics('AAPL');

      expect(metrics.putCallRatio).toBe(1.5);
      expect(metrics.institutionalFlow).toBe(50000);
      expect(metrics.vixIndex).toBe(25.5);
      expect(metrics.shortInterest).toBe(5000000);
    });
  });

  describe('getMarketStatus', () => {
    it('应该获取市场状态', async () => {
      const mockStatus = {
        is_open: true,
        next_open: '2024-01-02T09:30:00Z',
        next_close: '2024-01-02T16:00:00Z',
        timezone: 'America/New_York'
      };

      jest.spyOn(adapter.alpacaAPI, 'getMarketStatus').mockResolvedValue(mockStatus);

      const status = await adapter.getMarketStatus();

      expect(status.isOpen).toBe(true);
      expect(status.nextOpen).toBeInstanceOf(Date);
      expect(status.nextClose).toBeInstanceOf(Date);
    });
  });
});

