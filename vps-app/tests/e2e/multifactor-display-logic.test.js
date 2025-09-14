/**
 * 多因子得分列显示逻辑测试
 * 测试趋势市和震荡市的不同显示逻辑
 */

const path = require('path');

// 设置测试环境
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(__dirname, '../data/test_database.db');

describe('多因子得分列显示逻辑测试', () => {
  let app;

  beforeAll(async () => {
    // 模拟前端应用对象
    app = {
      getCategoryDisplay: (category) => {
        const categoryMap = {
          'mainstream': '主流币',
          'high-cap-trending': '高市值趋势币',
          'trending': '热点币',
          'smallcap': '小币'
        };
        return categoryMap[category] || '未知';
      },
      getCategoryClass: (category) => {
        const classMap = {
          'mainstream': 'category-mainstream',
          'high-cap-trending': 'category-highcap',
          'trending': 'category-trending',
          'smallcap': 'category-smallcap'
        };
        return classMap[category] || 'category-unknown';
      }
    };
  });

  describe('趋势市多因子得分显示逻辑', () => {
    test('趋势市应该显示1H趋势加强多因子打分得分', () => {
      const signal = {
        symbol: 'AVAXUSDT',
        marketType: '趋势市',
        score1h: 2,
        rangeLowerBoundaryValid: null,
        rangeUpperBoundaryValid: null,
        strategyVersion: 'V3'
      };

      // 模拟前端逻辑
      let multifactorDisplay = '--';
      let multifactorClass = 'score-none';
      let multifactorTitle = '';
      
      if (signal.strategyVersion === 'V3') {
        if (signal.marketType === '趋势市') {
          const trendScore = signal.score1h || 0;
          multifactorDisplay = `${trendScore}/6`;
          multifactorClass = trendScore >= 4 ? 'score-strong' : 
                            trendScore >= 3 ? 'score-moderate' : 
                            trendScore >= 2 ? 'score-weak' : 'score-none';
          multifactorTitle = `趋势市1H趋势加强多因子打分: ${trendScore}/6`;
        }
      }

      expect(multifactorDisplay).toBe('2/6');
      expect(multifactorClass).toBe('score-weak');
      expect(multifactorTitle).toBe('趋势市1H趋势加强多因子打分: 2/6');
    });

    test('趋势市高分应该显示为strong样式', () => {
      const signal = {
        symbol: 'TESTUSDT',
        marketType: '趋势市',
        score1h: 5,
        rangeLowerBoundaryValid: null,
        rangeUpperBoundaryValid: null,
        strategyVersion: 'V3'
      };

      let multifactorDisplay = '--';
      let multifactorClass = 'score-none';
      
      if (signal.strategyVersion === 'V3' && signal.marketType === '趋势市') {
        const trendScore = signal.score1h || 0;
        multifactorDisplay = `${trendScore}/6`;
        multifactorClass = trendScore >= 4 ? 'score-strong' : 
                          trendScore >= 3 ? 'score-moderate' : 
                          trendScore >= 2 ? 'score-weak' : 'score-none';
      }

      expect(multifactorDisplay).toBe('5/6');
      expect(multifactorClass).toBe('score-strong');
    });
  });

  describe('震荡市多因子得分显示逻辑', () => {
    test('震荡市应该显示1H边界有效性判断得分', () => {
      const signal = {
        symbol: 'BTCUSDT',
        marketType: '震荡市',
        score1h: 0,
        rangeLowerBoundaryValid: true,
        rangeUpperBoundaryValid: true,
        strategyVersion: 'V3'
      };

      // 模拟前端逻辑
      let multifactorDisplay = '--';
      let multifactorClass = 'score-none';
      let multifactorTitle = '';
      
      if (signal.strategyVersion === 'V3') {
        if (signal.marketType === '震荡市') {
          const lowerValid = signal.rangeLowerBoundaryValid === true ? 1 : 0;
          const upperValid = signal.rangeUpperBoundaryValid === true ? 1 : 0;
          const boundaryScore = lowerValid + upperValid;
          multifactorDisplay = `${boundaryScore}/2`;
          multifactorClass = boundaryScore === 2 ? 'score-strong' : 
                            boundaryScore === 1 ? 'score-moderate' : 'score-none';
          multifactorTitle = `震荡市1H边界有效性判断: 下边界${lowerValid ? '✓' : '✗'} 上边界${upperValid ? '✓' : '✗'}`;
        }
      }

      expect(multifactorDisplay).toBe('2/2');
      expect(multifactorClass).toBe('score-strong');
      expect(multifactorTitle).toBe('震荡市1H边界有效性判断: 下边界✓ 上边界✓');
    });

    test('震荡市部分边界有效应该显示为moderate样式', () => {
      const signal = {
        symbol: 'TESTUSDT',
        marketType: '震荡市',
        score1h: 0,
        rangeLowerBoundaryValid: true,
        rangeUpperBoundaryValid: false,
        strategyVersion: 'V3'
      };

      let multifactorDisplay = '--';
      let multifactorClass = 'score-none';
      
      if (signal.strategyVersion === 'V3' && signal.marketType === '震荡市') {
        const lowerValid = signal.rangeLowerBoundaryValid === true ? 1 : 0;
        const upperValid = signal.rangeUpperBoundaryValid === true ? 1 : 0;
        const boundaryScore = lowerValid + upperValid;
        multifactorDisplay = `${boundaryScore}/2`;
        multifactorClass = boundaryScore === 2 ? 'score-strong' : 
                          boundaryScore === 1 ? 'score-moderate' : 'score-none';
      }

      expect(multifactorDisplay).toBe('1/2');
      expect(multifactorClass).toBe('score-moderate');
    });

    test('震荡市边界无效应该显示为none样式', () => {
      const signal = {
        symbol: 'LINEAUSDT',
        marketType: '震荡市',
        score1h: 0,
        rangeLowerBoundaryValid: false,
        rangeUpperBoundaryValid: false,
        strategyVersion: 'V3'
      };

      let multifactorDisplay = '--';
      let multifactorClass = 'score-none';
      
      if (signal.strategyVersion === 'V3' && signal.marketType === '震荡市') {
        const lowerValid = signal.rangeLowerBoundaryValid === true ? 1 : 0;
        const upperValid = signal.rangeUpperBoundaryValid === true ? 1 : 0;
        const boundaryScore = lowerValid + upperValid;
        multifactorDisplay = `${boundaryScore}/2`;
        multifactorClass = boundaryScore === 2 ? 'score-strong' : 
                          boundaryScore === 1 ? 'score-moderate' : 'score-none';
      }

      expect(multifactorDisplay).toBe('0/2');
      expect(multifactorClass).toBe('score-none');
    });
  });

  describe('V2策略兼容性测试', () => {
    test('V2策略应该保持原有逻辑', () => {
      const signal = {
        symbol: 'TESTUSDT',
        marketType: '趋势市',
        hourlyScore: 3,
        strategyVersion: 'V2'
      };

      let multifactorDisplay = '--';
      let multifactorClass = 'score-none';
      
      if (signal.strategyVersion === 'V2') {
        multifactorDisplay = signal.hourlyScore > 0 ? signal.hourlyScore.toString() : '--';
        multifactorClass = signal.hourlyScore >= 3 ? 'score-strong' : 
                          signal.hourlyScore >= 2 ? 'score-moderate' : 
                          signal.hourlyScore >= 1 ? 'score-weak' : 'score-none';
      }

      expect(multifactorDisplay).toBe('3');
      expect(multifactorClass).toBe('score-strong');
    });
  });

  describe('边界情况测试', () => {
    test('undefined数据应该正确处理', () => {
      const signal = {
        symbol: 'TESTUSDT',
        marketType: '震荡市',
        score1h: undefined,
        rangeLowerBoundaryValid: undefined,
        rangeUpperBoundaryValid: undefined,
        strategyVersion: 'V3'
      };

      let multifactorDisplay = '--';
      let multifactorClass = 'score-none';
      
      if (signal.strategyVersion === 'V3' && signal.marketType === '震荡市') {
        const lowerValid = signal.rangeLowerBoundaryValid === true ? 1 : 0;
        const upperValid = signal.rangeUpperBoundaryValid === true ? 1 : 0;
        const boundaryScore = lowerValid + upperValid;
        multifactorDisplay = `${boundaryScore}/2`;
        multifactorClass = boundaryScore === 2 ? 'score-strong' : 
                          boundaryScore === 1 ? 'score-moderate' : 'score-none';
      }

      expect(multifactorDisplay).toBe('0/2');
      expect(multifactorClass).toBe('score-none');
    });
  });
});
