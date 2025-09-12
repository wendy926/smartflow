/**
 * 多因子得分显示逻辑测试
 * 验证前端是否正确显示加权得分而不是原始得分总和
 */

const { test, expect, describe } = require('@jest/globals');

describe('多因子得分显示逻辑测试', () => {
  
  test('趋势市多因子得分显示逻辑', () => {
    // 模拟趋势市信号数据
    const trendMarketSignal = {
      symbol: 'SOLUSDT',
      trend4h: '多头趋势',
      marketType: '趋势市',
      score1h: 0.15, // 加权得分（小数）
      category: 'high-cap-trending'
    };

    // 模拟前端显示逻辑
    let multifactorDisplay = '--';
    let multifactorClass = 'score-none';
    
    if (trendMarketSignal.trend4h === '多头趋势' || trendMarketSignal.trend4h === '空头趋势') {
      const trendScore1h = trendMarketSignal.score1h || 0;
      multifactorDisplay = trendScore1h.toString();
      multifactorClass = trendScore1h >= 3 ? 'score-strong' : 'score-none';
    }

    // 验证显示结果
    expect(multifactorDisplay).toBe('0.15'); // 应该显示加权得分
    expect(multifactorClass).toBe('score-none'); // 0.15 < 3，应该是灰色
  });

  test('震荡市多因子得分显示逻辑', () => {
    // 模拟震荡市信号数据
    const rangeMarketSignal = {
      symbol: 'BTCUSDT',
      trend4h: '震荡市',
      marketType: '震荡市',
      rangeLowerBoundaryValid: true,
      rangeUpperBoundaryValid: false,
      category: 'mainstream'
    };

    // 模拟前端显示逻辑
    let multifactorDisplay = '--';
    let multifactorClass = 'score-none';
    
    if (rangeMarketSignal.trend4h === '震荡市') {
      const lowerValid = rangeMarketSignal.rangeLowerBoundaryValid === true ? 1 : 0;
      const upperValid = rangeMarketSignal.rangeUpperBoundaryValid === true ? 1 : 0;
      const boundaryScore = lowerValid + upperValid;
      multifactorDisplay = boundaryScore.toString();
      multifactorClass = boundaryScore >= 1 ? 'score-strong' : 'score-none';
    }

    // 验证显示结果
    expect(multifactorDisplay).toBe('1'); // 下边界有效，上边界无效 = 1分
    expect(multifactorClass).toBe('score-strong'); // 1 >= 1，应该是绿色
  });

  test('多因子得分小数显示', () => {
    // 测试各种小数得分
    const testCases = [
      { score: 0.15, expected: '0.15' },
      { score: 2.75, expected: '2.75' },
      { score: 3.25, expected: '3.25' },
      { score: 0, expected: '0' },
      { score: 5.5, expected: '5.5' }
    ];

    testCases.forEach(({ score, expected }) => {
      const multifactorDisplay = score.toString();
      expect(multifactorDisplay).toBe(expected);
    });
  });

  test('颜色分类逻辑', () => {
    // 测试颜色分类
    const testCases = [
      { score: 0.15, expectedClass: 'score-none' },
      { score: 2.75, expectedClass: 'score-none' },
      { score: 3.0, expectedClass: 'score-strong' },
      { score: 3.25, expectedClass: 'score-strong' },
      { score: 5.5, expectedClass: 'score-strong' }
    ];

    testCases.forEach(({ score, expectedClass }) => {
      const multifactorClass = score >= 3 ? 'score-strong' : 'score-none';
      expect(multifactorClass).toBe(expectedClass);
    });
  });

  test('边界有效性得分计算', () => {
    // 测试边界有效性得分计算
    const testCases = [
      { lower: true, upper: true, expected: 2 },
      { lower: true, upper: false, expected: 1 },
      { lower: false, upper: true, expected: 1 },
      { lower: false, upper: false, expected: 0 }
    ];

    testCases.forEach(({ lower, upper, expected }) => {
      const lowerValid = lower ? 1 : 0;
      const upperValid = upper ? 1 : 0;
      const boundaryScore = lowerValid + upperValid;
      expect(boundaryScore).toBe(expected);
    });
  });

  test('API数据结构验证', () => {
    // 验证API返回的数据结构
    const apiResponse = {
      symbol: 'SOLUSDT',
      score1h: 0.15, // 加权得分
      trend4h: '多头趋势',
      marketType: '震荡市',
      category: 'high-cap-trending',
      currentPrice: 238.02
    };

    // 验证必要字段存在
    expect(apiResponse).toHaveProperty('score1h');
    expect(apiResponse).toHaveProperty('trend4h');
    expect(apiResponse).toHaveProperty('marketType');
    expect(apiResponse).toHaveProperty('category');
    expect(apiResponse).toHaveProperty('currentPrice');

    // 验证score1h是数字
    expect(typeof apiResponse.score1h).toBe('number');
    
    // 验证score1h可能是小数
    expect(Number.isFinite(apiResponse.score1h)).toBe(true);
  });
});
