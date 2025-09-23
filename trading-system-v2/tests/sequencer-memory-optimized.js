/**
 * 内存优化的测试序列器
 * 确保测试按顺序运行，避免内存泄漏
 */

class MemoryOptimizedSequencer {
  constructor() {
    this.testResults = new Map();
  }

  sort(tests) {
    // 按测试文件排序，确保策略测试先运行
    const testOrder = [
      'v3-strategy.test.js',
      'ict-strategy.test.js',
      'rolling-strategy.test.js',
      'api',
      'services'
    ];

    return tests.sort((a, b) => {
      const aIndex = testOrder.findIndex(order => a.path.includes(order));
      const bIndex = testOrder.findIndex(order => b.path.includes(order));

      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;

      return aIndex - bIndex;
    });
  }

  cacheResults(tests, results) {
    // 缓存测试结果，用于内存优化
    tests.forEach((test, index) => {
      if (results[index]) {
        this.testResults.set(test.path, results[index]);
      }
    });
  }

  getCachedResult(testPath) {
    return this.testResults.get(testPath);
  }

  clearCache() {
    this.testResults.clear();
  }
}

module.exports = MemoryOptimizedSequencer;
