// tests/symbol-management.test.js - 交易对管理功能测试

const APIClient = require('../public/js/api.js');

// Mock fetch for testing
global.fetch = jest.fn();

describe('交易对管理功能', () => {
  let apiClient;

  beforeEach(() => {
    apiClient = new APIClient();
    fetch.mockClear();
  });

  describe('API客户端方法', () => {
    test('应该正确获取交易对列表', async () => {
      const mockSymbols = [
        { symbol: 'BTCUSDT' },
        { symbol: 'ETHUSDT' },
        { symbol: 'LINKUSDT' }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSymbols
      });

      const result = await apiClient.getSymbols();
      
      expect(fetch).toHaveBeenCalledWith('/api/symbols');
      expect(result).toEqual(mockSymbols);
    });

    test('应该正确获取主流币交易对', async () => {
      const mockMainstreamSymbols = [
        {
          symbol: 'BTCUSDT',
          name: 'Bitcoin',
          marketCap: 2311402735666,
          price: 116013,
          category: 'mainstream'
        }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMainstreamSymbols
      });

      const result = await apiClient.getMainstreamSymbols();
      
      expect(fetch).toHaveBeenCalledWith('/api/symbols/mainstream');
      expect(result).toEqual(mockMainstreamSymbols);
    });

    test('应该正确获取高市值交易对', async () => {
      const mockHighCapSymbols = [
        {
          symbol: 'SOLUSDT',
          name: 'Solana',
          marketCap: 131553905321,
          price: 242.33,
          category: 'highcap'
        }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockHighCapSymbols
      });

      const result = await apiClient.getHighCapSymbols();
      
      expect(fetch).toHaveBeenCalledWith('/api/symbols/highcap');
      expect(result).toEqual(mockHighCapSymbols);
    });

    test('应该正确处理API错误', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(apiClient.getSymbols()).rejects.toThrow('Network error');
    });
  });

  describe('SymbolManagement类模拟测试', () => {
    let symbolManager;

    beforeEach(() => {
      // 模拟DOM环境
      document.body.innerHTML = `
        <div id="currentSymbolsList"></div>
        <div id="currentCount">0</div>
        <div id="mainstreamSymbols"></div>
        <div id="highcapSymbols"></div>
        <div id="trendingSymbols"></div>
        <div id="smallcapSymbols"></div>
        <button id="refreshBtn">🔄 刷新数据</button>
      `;

      // 模拟SymbolManagement类
      symbolManager = {
        apiClient: apiClient,
        currentSymbols: new Set(),
        symbolData: {
          mainstream: [],
          highcap: [],
          trending: [],
          smallcap: []
        },
        tradeCounts: new Map()
      };
    });

    test('应该正确加载当前交易对', async () => {
      const mockSymbols = [
        { symbol: 'BTCUSDT' },
        { symbol: 'ETHUSDT' }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSymbols
      });

      // 模拟loadCurrentSymbols方法
      const symbols = await symbolManager.apiClient.getSymbols();
      symbolManager.currentSymbols = new Set(symbols.map(s => s.symbol));

      expect(symbolManager.currentSymbols.size).toBe(2);
      expect(symbolManager.currentSymbols.has('BTCUSDT')).toBe(true);
      expect(symbolManager.currentSymbols.has('ETHUSDT')).toBe(true);
    });

    test('应该正确加载分类交易对', async () => {
      const mockMainstreamSymbols = [
        {
          symbol: 'BTCUSDT',
          name: 'Bitcoin',
          marketCap: 2311402735666,
          price: 116013,
          category: 'mainstream'
        }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMainstreamSymbols
      });

      const symbols = await symbolManager.apiClient.getMainstreamSymbols();
      symbolManager.symbolData.mainstream = symbols;

      expect(symbolManager.symbolData.mainstream).toHaveLength(1);
      expect(symbolManager.symbolData.mainstream[0].symbol).toBe('BTCUSDT');
    });

    test('应该正确处理刷新数据流程', async () => {
      const mockSymbols = [{ symbol: 'BTCUSDT' }];
      const mockMainstreamSymbols = [{
        symbol: 'BTCUSDT',
        name: 'Bitcoin',
        marketCap: 2311402735666,
        price: 116013,
        category: 'mainstream'
      }];

      // 模拟多个API调用
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSymbols
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockMainstreamSymbols
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        });

      // 模拟refreshAllData流程
      const symbols = await symbolManager.apiClient.getSymbols();
      symbolManager.currentSymbols = new Set(symbols.map(s => s.symbol));

      const mainstreamSymbols = await symbolManager.apiClient.getMainstreamSymbols();
      symbolManager.symbolData.mainstream = mainstreamSymbols;

      expect(symbolManager.currentSymbols.size).toBe(1);
      expect(symbolManager.symbolData.mainstream).toHaveLength(1);
    });
  });

  describe('错误处理', () => {
    test('应该正确处理网络错误', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(apiClient.getSymbols()).rejects.toThrow('Network error');
    });

    test('应该正确处理API错误响应', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' })
      });

      await expect(apiClient.getSymbols()).rejects.toThrow();
    });
  });

  describe('数据格式化', () => {
    test('应该正确格式化市值', () => {
      // 模拟formatMarketCap方法
      const formatMarketCap = (marketCap) => {
        if (typeof marketCap === 'string') return marketCap;
        if (marketCap >= 1e9) return `$${(marketCap / 1e9).toFixed(1)}B`;
        if (marketCap >= 1e6) return `$${(marketCap / 1e6).toFixed(1)}M`;
        if (marketCap >= 1e3) return `$${(marketCap / 1e3).toFixed(1)}K`;
        return `$${marketCap.toFixed(0)}`;
      };

      expect(formatMarketCap(2311402735666)).toBe('$2311.4B');
      expect(formatMarketCap(131553905321)).toBe('$131.6B');
      expect(formatMarketCap(1000000)).toBe('$1.0M');
      expect(formatMarketCap(1000)).toBe('$1.0K');
      expect(formatMarketCap(100)).toBe('$100');
    });

    test('应该正确格式化价格', () => {
      // 模拟formatPrice方法
      const formatPrice = (price) => {
        if (typeof price === 'string') return price;
        if (price >= 1000) return `$${price.toFixed(0)}`;
        if (price >= 1) return `$${price.toFixed(2)}`;
        if (price >= 0.01) return `$${price.toFixed(4)}`;
        return `$${price.toFixed(6)}`;
      };

      expect(formatPrice(116013)).toBe('$116013');
      expect(formatPrice(242.33)).toBe('$242.33');
      expect(formatPrice(0.295983)).toBe('$0.2960');
      expect(formatPrice(0.001)).toBe('$0.001000');
    });
  });
});
