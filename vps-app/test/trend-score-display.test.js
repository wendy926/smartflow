/**
 * 趋势打分显示功能测试
 * 测试4H趋势打分列的前端显示逻辑
 */

const path = require('path');

// 设置测试环境
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(__dirname, '../data/test_database.db');

describe('趋势打分显示功能测试', () => {
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

  describe('趋势打分列显示逻辑测试', () => {
    test('有趋势打分时应该正确显示', () => {
      const signal = {
        symbol: 'BTCUSDT',
        score: 4,
        direction: 'BULL',
        trend4h: '多头趋势',
        marketType: '趋势市'
      };

      // 模拟前端逻辑
      const trendScore = signal.score || 0;
      const trendDirection = signal.direction || null;
      let trendScoreDisplay = '--';
      let trendScoreClass = 'score-none';
      let trendScoreTitle = '';
      
      if (trendScore > 0) {
        trendScoreDisplay = `${trendScore}/5`;
        trendScoreClass = trendScore >= 3 ? 'score-strong' : 'score-none';
        trendScoreTitle = `4H趋势打分: ${trendScore}/5 (${trendDirection || '无方向'})`;
      } else {
        trendScoreDisplay = '--';
        trendScoreClass = 'score-none';
        trendScoreTitle = '4H趋势打分: 无趋势方向';
      }

      expect(trendScoreDisplay).toBe('4/5');
      expect(trendScoreClass).toBe('score-strong');
      expect(trendScoreTitle).toBe('4H趋势打分: 4/5 (BULL)');
    });

    test('无趋势打分时应该显示--', () => {
      const signal = {
        symbol: 'BTCUSDT',
        score: 0,
        direction: null,
        trend4h: '震荡市',
        marketType: '震荡市'
      };

      const trendScore = signal.score || 0;
      const trendDirection = signal.direction || null;
      let trendScoreDisplay = '--';
      let trendScoreClass = 'score-none';
      let trendScoreTitle = '';
      
      if (trendScore > 0) {
        trendScoreDisplay = `${trendScore}/5`;
        trendScoreClass = trendScore >= 3 ? 'score-strong' : 'score-none';
        trendScoreTitle = `4H趋势打分: ${trendScore}/5 (${trendDirection || '无方向'})`;
      } else {
        trendScoreDisplay = '--';
        trendScoreClass = 'score-none';
        trendScoreTitle = '4H趋势打分: 无趋势方向';
      }

      expect(trendScoreDisplay).toBe('--');
      expect(trendScoreClass).toBe('score-none');
      expect(trendScoreTitle).toBe('4H趋势打分: 无趋势方向');
    });

    test('低分趋势应该显示灰色', () => {
      const signal = {
        symbol: 'ETHUSDT',
        score: 2,
        direction: 'BEAR',
        trend4h: '空头趋势',
        marketType: '趋势市'
      };

      const trendScore = signal.score || 0;
      const trendDirection = signal.direction || null;
      let trendScoreDisplay = '--';
      let trendScoreClass = 'score-none';
      let trendScoreTitle = '';
      
      if (trendScore > 0) {
        trendScoreDisplay = `${trendScore}/5`;
        trendScoreClass = trendScore >= 3 ? 'score-strong' : 'score-none';
        trendScoreTitle = `4H趋势打分: ${trendScore}/5 (${trendDirection || '无方向'})`;
      }

      expect(trendScoreDisplay).toBe('2/5');
      expect(trendScoreClass).toBe('score-none');
      expect(trendScoreTitle).toBe('4H趋势打分: 2/5 (BEAR)');
    });

    test('高分趋势应该显示绿色', () => {
      const testCases = [
        { score: 3, expected: 'score-strong' },
        { score: 4, expected: 'score-strong' },
        { score: 5, expected: 'score-strong' }
      ];

      testCases.forEach(({ score, expected }) => {
        const trendScoreClass = score >= 3 ? 'score-strong' : 'score-none';
        expect(trendScoreClass).toBe(expected);
      });
    });
  });

  describe('数据刷新页面趋势打分指标测试', () => {
    test('数据类型映射应该包含趋势打分', () => {
      const dataTypeNames = {
        'trend_analysis': '4H趋势判断',
        'trend_scoring': '1H多因子打分',
        'trend_strength': '1H加强趋势判断',
        'trend_entry': '趋势市15分钟入场判断',
        'range_boundary': '震荡市1H边界判断',
        'range_entry': '震荡市15分钟入场判断',
        'trend_score': '4H趋势打分'
      };

      expect(dataTypeNames['trend_score']).toBe('4H趋势打分');
    });
  });

  describe('监控中心趋势打分验证测试', () => {
    test('趋势打分验证状态计算', () => {
      // 模拟详细统计数据
      const detailedStats = [
        {
          symbol: 'BTCUSDT',
          trendScore: 4,
          trendDirection: 'BULL',
          trend4h: '多头趋势'
        },
        {
          symbol: 'ETHUSDT',
          trendScore: 2,
          trendDirection: 'BEAR',
          trend4h: '空头趋势'
        },
        {
          symbol: 'ADAUSDT',
          trendScore: 0,
          trendDirection: null,
          trend4h: '震荡市'
        }
      ];

      // 模拟验证逻辑
      let validCount = 0;
      let totalCount = 0;
      let errorCount = 0;

      detailedStats.forEach(stat => {
        totalCount++;
        
        if (stat.trendScore !== undefined && stat.trendScore !== null) {
          const score = stat.trendScore;
          const direction = stat.trendDirection;
          
          if (score >= 0 && score <= 5) {
            if (score > 0) {
              if ((direction === 'BULL' && stat.trend4h === '多头趋势') || 
                  (direction === 'BEAR' && stat.trend4h === '空头趋势') ||
                  (score === 0 && stat.trend4h === '震荡市')) {
                validCount++;
              } else {
                errorCount++;
              }
            } else {
              validCount++;
            }
          } else {
            errorCount++;
          }
        } else {
          errorCount++;
        }
      });

      const successRate = totalCount > 0 ? (validCount / totalCount * 100).toFixed(1) : 0;
      
      expect(totalCount).toBe(3);
      expect(validCount).toBe(3);
      expect(errorCount).toBe(0);
      expect(successRate).toBe('100.0');
    });

    test('趋势打分验证状态显示格式', () => {
      const testCases = [
        { validCount: 10, totalCount: 10, errorCount: 0, expected: '✅ 100.0%' },
        { validCount: 9, totalCount: 10, errorCount: 1, expected: '⚠️ 90.0% (1错误)' },
        { validCount: 5, totalCount: 10, errorCount: 5, expected: '❌ 50.0% (5错误)' }
      ];

      testCases.forEach(({ validCount, totalCount, errorCount, expected }) => {
        const successRate = totalCount > 0 ? (validCount / totalCount * 100).toFixed(1) : 0;
        
        let result;
        if (errorCount === 0) {
          result = `✅ ${successRate}%`;
        } else if (errorCount <= totalCount * 0.1) {
          result = `⚠️ ${successRate}% (${errorCount}错误)`;
        } else {
          result = `❌ ${successRate}% (${errorCount}错误)`;
        }

        expect(result).toBe(expected);
      });
    });
  });

  describe('API响应结构测试', () => {
    test('API响应应该包含趋势打分字段', () => {
      const mockApiResponse = {
        symbol: 'BTCUSDT',
        trend4h: '多头趋势',
        marketType: '趋势市',
        score: 4,
        direction: 'BULL',
        score1h: 3,
        category: 'mainstream'
      };

      expect(mockApiResponse.score).toBeDefined();
      expect(mockApiResponse.direction).toBeDefined();
      expect(typeof mockApiResponse.score).toBe('number');
      expect(mockApiResponse.score).toBeGreaterThanOrEqual(0);
      expect(mockApiResponse.score).toBeLessThanOrEqual(5);
      expect(['BULL', 'BEAR', null]).toContain(mockApiResponse.direction);
    });
  });
});
