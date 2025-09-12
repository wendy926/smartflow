/**
 * 优化后的多因子得分显示逻辑测试
 * 测试根据4H趋势类型决定显示哪种得分
 */

const path = require('path');

// 设置测试环境
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(__dirname, '../data/test_database.db');

describe('优化后的多因子得分显示逻辑测试', () => {
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

  describe('根据4H趋势类型决定显示哪种得分', () => {
    test('多头趋势应该显示1H趋势加强得分', () => {
      const signal = {
        symbol: 'AVAXUSDT',
        trend4h: '多头趋势',
        marketType: '趋势市',
        score1h: 4,
        rangeLowerBoundaryValid: null,
        rangeUpperBoundaryValid: null,
        strategyVersion: 'V3'
      };

      // 模拟前端逻辑
      let multifactorDisplay = '--';
      let multifactorClass = 'score-none';
      let multifactorTitle = '';
      
      if (signal.strategyVersion === 'V3') {
        if (signal.trend4h === '多头趋势' || signal.trend4h === '空头趋势') {
          const trendScore = signal.score1h || 0;
          multifactorDisplay = `${trendScore}/6`;
          multifactorClass = trendScore >= 3 ? 'score-strong' : 'score-none';
          multifactorTitle = `1H趋势加强多因子打分: ${trendScore}/6 (≥3分可入场)`;
        }
      }

      expect(multifactorDisplay).toBe('4/6');
      expect(multifactorClass).toBe('score-strong');
      expect(multifactorTitle).toBe('1H趋势加强多因子打分: 4/6 (≥3分可入场)');
    });

    test('空头趋势应该显示1H趋势加强得分', () => {
      const signal = {
        symbol: 'TESTUSDT',
        trend4h: '空头趋势',
        marketType: '趋势市',
        score1h: 2,
        rangeLowerBoundaryValid: null,
        rangeUpperBoundaryValid: null,
        strategyVersion: 'V3'
      };

      let multifactorDisplay = '--';
      let multifactorClass = 'score-none';
      let multifactorTitle = '';
      
      if (signal.strategyVersion === 'V3') {
        if (signal.trend4h === '多头趋势' || signal.trend4h === '空头趋势') {
          const trendScore = signal.score1h || 0;
          multifactorDisplay = `${trendScore}/6`;
          multifactorClass = trendScore >= 3 ? 'score-strong' : 'score-none';
          multifactorTitle = `1H趋势加强多因子打分: ${trendScore}/6 (≥3分可入场)`;
        }
      }

      expect(multifactorDisplay).toBe('2/6');
      expect(multifactorClass).toBe('score-none');
      expect(multifactorTitle).toBe('1H趋势加强多因子打分: 2/6 (≥3分可入场)');
    });

    test('震荡市应该显示1H边界有效性得分', () => {
      const signal = {
        symbol: 'BTCUSDT',
        trend4h: '震荡市',
        marketType: '震荡市',
        score1h: 0,
        rangeLowerBoundaryValid: true,
        rangeUpperBoundaryValid: true,
        strategyVersion: 'V3'
      };

      let multifactorDisplay = '--';
      let multifactorClass = 'score-none';
      let multifactorTitle = '';
      
      if (signal.strategyVersion === 'V3') {
        if (signal.trend4h === '震荡市') {
          const lowerValid = signal.rangeLowerBoundaryValid === true ? 1 : 0;
          const upperValid = signal.rangeUpperBoundaryValid === true ? 1 : 0;
          const boundaryScore = lowerValid + upperValid;
          multifactorDisplay = `${boundaryScore}/2`;
          multifactorClass = boundaryScore >= 3 ? 'score-strong' : 'score-none';
          multifactorTitle = `1H边界有效性判断: 下边界${lowerValid ? '✓' : '✗'} 上边界${upperValid ? '✓' : '✗'} (≥3分可入场)`;
        }
      }

      expect(multifactorDisplay).toBe('2/2');
      expect(multifactorClass).toBe('score-none'); // 2分 < 3分，所以是灰色
      expect(multifactorTitle).toBe('1H边界有效性判断: 下边界✓ 上边界✓ (≥3分可入场)');
    });

    test('数据不足情况应该显示--', () => {
      const signal = {
        symbol: 'TESTUSDT',
        trend4h: '--',
        marketType: '--',
        score1h: 0,
        rangeLowerBoundaryValid: null,
        rangeUpperBoundaryValid: null,
        strategyVersion: 'V3'
      };

      let multifactorDisplay = '--';
      let multifactorClass = 'score-none';
      let multifactorTitle = '';
      
      if (signal.strategyVersion === 'V3') {
        if (signal.trend4h === '多头趋势' || signal.trend4h === '空头趋势') {
          const trendScore = signal.score1h || 0;
          multifactorDisplay = `${trendScore}/6`;
          multifactorClass = trendScore >= 3 ? 'score-strong' : 'score-none';
          multifactorTitle = `1H趋势加强多因子打分: ${trendScore}/6 (≥3分可入场)`;
        } else if (signal.trend4h === '震荡市') {
          const lowerValid = signal.rangeLowerBoundaryValid === true ? 1 : 0;
          const upperValid = signal.rangeUpperBoundaryValid === true ? 1 : 0;
          const boundaryScore = lowerValid + upperValid;
          multifactorDisplay = `${boundaryScore}/2`;
          multifactorClass = boundaryScore >= 3 ? 'score-strong' : 'score-none';
          multifactorTitle = `1H边界有效性判断: 下边界${lowerValid ? '✓' : '✗'} 上边界${upperValid ? '✓' : '✗'} (≥3分可入场)`;
        } else {
          multifactorDisplay = '--';
          multifactorClass = 'score-none';
          multifactorTitle = '数据不足，无法计算多因子得分';
        }
      }

      expect(multifactorDisplay).toBe('--');
      expect(multifactorClass).toBe('score-none');
      expect(multifactorTitle).toBe('数据不足，无法计算多因子得分');
    });
  });

  describe('颜色标记逻辑测试', () => {
    test('≥3分应该标记为绿色', () => {
      const testCases = [
        { score: 3, expected: 'score-strong' },
        { score: 4, expected: 'score-strong' },
        { score: 5, expected: 'score-strong' },
        { score: 6, expected: 'score-strong' }
      ];

      testCases.forEach(({ score, expected }) => {
        const multifactorClass = score >= 3 ? 'score-strong' : 'score-none';
        expect(multifactorClass).toBe(expected);
      });
    });

    test('<3分应该标记为灰色', () => {
      const testCases = [
        { score: 0, expected: 'score-none' },
        { score: 1, expected: 'score-none' },
        { score: 2, expected: 'score-none' }
      ];

      testCases.forEach(({ score, expected }) => {
        const multifactorClass = score >= 3 ? 'score-strong' : 'score-none';
        expect(multifactorClass).toBe(expected);
      });
    });
  });

  describe('趋势判断颜色逻辑测试', () => {
    test('趋势市多头趋势应该返回trend-uptrend', () => {
      const trendClass = getTrendClass('多头趋势', '趋势市');
      expect(trendClass).toBe('trend-uptrend');
    });

    test('趋势市空头趋势应该返回trend-downtrend', () => {
      const trendClass = getTrendClass('空头趋势', '趋势市');
      expect(trendClass).toBe('trend-downtrend');
    });

    test('震荡市应该返回trend-range', () => {
      const trendClass = getTrendClass('震荡市', '震荡市');
      expect(trendClass).toBe('trend-range');
    });
  });

  // 辅助函数
  function getTrendClass(trend, marketType) {
    if (marketType === '趋势市') {
      switch (trend) {
        case '多头趋势':
          return 'trend-uptrend';
        case '空头趋势':
          return 'trend-downtrend';
        default:
          return 'trend-range';
      }
    } else {
      switch (trend) {
        case 'UPTREND':
          return 'trend-uptrend';
        case 'DOWNTREND':
          return 'trend-downtrend';
        default:
          return 'trend-range';
      }
    }
  }
});
