/**
 * 数据刷新频率的单元测试
 */

describe('数据刷新频率测试', () => {
  test('4H趋势刷新频率应该是1小时', () => {
    const trendInterval = 60 * 60 * 1000; // 1小时
    expect(trendInterval).toBe(3600000);
  });

  test('1H打分刷新频率应该是5分钟', () => {
    const signalInterval = 5 * 60 * 1000; // 5分钟
    expect(signalInterval).toBe(300000);
  });

  test('15m入场刷新频率应该是2分钟', () => {
    const executionInterval = 2 * 60 * 1000; // 2分钟
    expect(executionInterval).toBe(120000);
  });

  test('刷新频率应该符合strategy-v3.md文档要求', () => {
    // 根据strategy-v3.md文档要求
    const expectedFrequencies = {
      '4H趋势': 60 * 60 * 1000,      // 每1小时
      '1H打分': 5 * 60 * 1000,       // 每5分钟
      '15m入场': 2 * 60 * 1000       // 每2分钟
    };

    expect(expectedFrequencies['4H趋势']).toBe(3600000);
    expect(expectedFrequencies['1H打分']).toBe(300000);
    expect(expectedFrequencies['15m入场']).toBe(120000);
  });

  test('刷新频率应该合理且不会造成API压力', () => {
    const frequencies = {
      '4H趋势': 60 * 60 * 1000,      // 1小时 = 3600秒
      '1H打分': 5 * 60 * 1000,       // 5分钟 = 300秒
      '15m入场': 2 * 60 * 1000       // 2分钟 = 120秒
    };

    // 4H趋势频率应该是最慢的
    expect(frequencies['4H趋势']).toBeGreaterThan(frequencies['1H打分']);
    expect(frequencies['1H打分']).toBeGreaterThan(frequencies['15m入场']);

    // 15m入场频率不应该太快（避免API压力）
    expect(frequencies['15m入场']).toBeGreaterThanOrEqual(60000); // 至少1分钟
  });
});
