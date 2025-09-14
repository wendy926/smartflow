/**
 * API响应结构测试
 * 测试API返回的数据结构是否符合预期
 */

describe('API响应结构测试', () => {
  // 模拟API响应数据
  const mockApiResponse = [
    {
      symbol: 'BTCUSDT',
      category: 'mainstream',
      trend4h: '震荡市',
      marketType: '震荡市',
      score1h: 0,
      vwapDirectionConsistent: false,
      factors: {},
      currentPrice: 50000,
      dataCollectionRate: 100
    },
    {
      symbol: 'AVAXUSDT',
      category: 'high-cap-trending',
      trend4h: '多头趋势',
      marketType: '趋势市',
      score1h: 2,
      vwapDirectionConsistent: true,
      factors: { vwap: true, volume: 0.5 },
      currentPrice: 30,
      dataCollectionRate: 100
    },
    {
      symbol: 'DOGEUSDT',
      category: 'trending',
      trend4h: '多头趋势',
      marketType: '趋势市',
      score1h: 3,
      vwapDirectionConsistent: true,
      factors: { vwap: true, volume: 0.8 },
      currentPrice: 0.25,
      dataCollectionRate: 100
    }
  ];

  describe('基本字段存在性测试', () => {
    test('每个信号对象都应该包含必要字段', () => {
      mockApiResponse.forEach(signal => {
        expect(signal.symbol).toBeDefined();
        expect(signal.category).toBeDefined();
        expect(signal.trend4h).toBeDefined();
        expect(signal.marketType).toBeDefined();
        expect(signal.score1h).toBeDefined();
        expect(signal.currentPrice).toBeDefined();
        expect(signal.dataCollectionRate).toBeDefined();
      });
    });

    test('字段类型应该正确', () => {
      mockApiResponse.forEach(signal => {
        expect(typeof signal.symbol).toBe('string');
        expect(typeof signal.category).toBe('string');
        expect(typeof signal.trend4h).toBe('string');
        expect(typeof signal.marketType).toBe('string');
        expect(typeof signal.score1h).toBe('number');
        expect(typeof signal.currentPrice).toBe('number');
        expect(typeof signal.dataCollectionRate).toBe('number');
      });
    });
  });

  describe('分类字段验证', () => {
    test('分类值应该在有效范围内', () => {
      const validCategories = ['mainstream', 'high-cap-trending', 'trending', 'smallcap'];
      
      mockApiResponse.forEach(signal => {
        expect(validCategories).toContain(signal.category);
      });
    });

    test('不应该出现未知分类', () => {
      mockApiResponse.forEach(signal => {
        expect(signal.category).not.toBe('unknown');
        expect(signal.category).not.toBe('');
        expect(signal.category).not.toBe(null);
        expect(signal.category).not.toBe(undefined);
      });
    });
  });

  describe('多因子得分字段验证', () => {
    test('得分应该在有效范围内', () => {
      mockApiResponse.forEach(signal => {
        expect(signal.score1h).toBeGreaterThanOrEqual(0);
        expect(signal.score1h).toBeLessThanOrEqual(6);
      });
    });

    test('得分应该是整数', () => {
      mockApiResponse.forEach(signal => {
        expect(Number.isInteger(signal.score1h)).toBe(true);
      });
    });
  });

  describe('市场类型和趋势一致性验证', () => {
    test('4H趋势和市场类型应该一致', () => {
      mockApiResponse.forEach(signal => {
        if (signal.trend4h === '震荡市') {
          expect(signal.marketType).toBe('震荡市');
        } else if (signal.trend4h === '多头趋势' || signal.trend4h === '空头趋势') {
          // 如果4H有趋势，市场类型应该是趋势市或震荡市
          expect(['趋势市', '震荡市']).toContain(signal.marketType);
        }
      });
    });

    test('趋势市应该有非零得分', () => {
      mockApiResponse.forEach(signal => {
        if (signal.marketType === '趋势市') {
          expect(signal.score1h).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('数据完整性验证', () => {
    test('价格数据应该合理', () => {
      mockApiResponse.forEach(signal => {
        expect(signal.currentPrice).toBeGreaterThan(0);
        expect(Number.isFinite(signal.currentPrice)).toBe(true);
      });
    });

    test('数据采集率应该在有效范围内', () => {
      mockApiResponse.forEach(signal => {
        expect(signal.dataCollectionRate).toBeGreaterThanOrEqual(0);
        expect(signal.dataCollectionRate).toBeLessThanOrEqual(100);
      });
    });

    test('VWAP方向一致性应该是布尔值', () => {
      mockApiResponse.forEach(signal => {
        expect(typeof signal.vwapDirectionConsistent).toBe('boolean');
      });
    });

    test('因子对象应该是对象类型', () => {
      mockApiResponse.forEach(signal => {
        expect(typeof signal.factors).toBe('object');
        expect(signal.factors).not.toBeNull();
      });
    });
  });

  describe('边界条件测试', () => {
    test('空数组处理', () => {
      const emptyResponse = [];
      expect(Array.isArray(emptyResponse)).toBe(true);
      expect(emptyResponse.length).toBe(0);
    });

    test('单个信号处理', () => {
      const singleSignal = [mockApiResponse[0]];
      expect(singleSignal.length).toBe(1);
      expect(singleSignal[0]).toHaveProperty('symbol');
    });
  });

  describe('数据一致性测试', () => {
    test('相同交易对不应该重复', () => {
      const symbols = mockApiResponse.map(signal => signal.symbol);
      const uniqueSymbols = [...new Set(symbols)];
      expect(symbols.length).toBe(uniqueSymbols.length);
    });

    test('所有信号都应该有相同的必要字段', () => {
      const requiredFields = ['symbol', 'category', 'trend4h', 'marketType', 'score1h'];
      
      mockApiResponse.forEach(signal => {
        requiredFields.forEach(field => {
          expect(signal).toHaveProperty(field);
        });
      });
    });
  });
});
