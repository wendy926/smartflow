// tests/data-change-detector.test.js
// DataChangeDetector 单元测试

const DataChangeDetector = require('../modules/cache/DataChangeDetector');

describe('DataChangeDetector', () => {
  let detector;
  let mockDatabase;
  let mockCacheManager;

  beforeEach(() => {
    // 模拟数据库
    mockDatabase = {
      runQuery: jest.fn().mockResolvedValue([])
    };

    // 模拟缓存管理器
    mockCacheManager = {
      del: jest.fn().mockResolvedValue(true)
    };

    detector = new DataChangeDetector(mockDatabase, mockCacheManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('构造函数', () => {
    test('应该正确初始化', () => {
      expect(detector.db).toBe(mockDatabase);
      expect(detector.cacheManager).toBe(mockCacheManager);
      expect(detector.dataHashes).toBeInstanceOf(Map);
      expect(detector.changeListeners).toBeInstanceOf(Set);
    });
  });

  describe('calculateDataHash', () => {
    test('应该为相同数据生成相同哈希', () => {
      const data1 = { symbol: 'BTCUSDT', trend: '多头趋势', score: 85 };
      const data2 = { symbol: 'BTCUSDT', trend: '多头趋势', score: 85 };
      
      const hash1 = detector.calculateDataHash(data1);
      const hash2 = detector.calculateDataHash(data2);
      
      expect(hash1).toBe(hash2);
    });

    test('应该为不同数据生成不同哈希', () => {
      const data1 = { symbol: 'BTCUSDT', trend: '多头趋势', score: 85 };
      const data2 = { symbol: 'BTCUSDT', trend: '空头趋势', score: 85 };
      
      const hash1 = detector.calculateDataHash(data1);
      const hash2 = detector.calculateDataHash(data2);
      
      expect(hash1).not.toBe(hash2);
    });

    test('应该忽略对象属性顺序', () => {
      const data1 = { symbol: 'BTCUSDT', trend: '多头趋势', score: 85 };
      const data2 = { score: 85, symbol: 'BTCUSDT', trend: '多头趋势' };
      
      const hash1 = detector.calculateDataHash(data1);
      const hash2 = detector.calculateDataHash(data2);
      
      expect(hash1).toBe(hash2);
    });

    test('应该处理复杂嵌套对象', () => {
      const data = {
        symbol: 'BTCUSDT',
        analysis: {
          trend: '多头趋势',
          indicators: {
            ma20: 50000,
            ma50: 48000
          }
        },
        timestamp: Date.now()
      };
      
      const hash = detector.calculateDataHash(data);
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe('detectDataChange', () => {
    test('应该检测到首次数据变化', async () => {
      const symbol = 'BTCUSDT';
      const dataType = 'trend';
      const newData = { symbol, trend: '多头趋势', score: 85 };

      const result = await detector.detectDataChange(symbol, dataType, newData);

      expect(result).toBe(true);
      expect(detector.dataHashes.get(`${symbol}_${dataType}`)).toBeDefined();
    });

    test('应该检测到数据变化', async () => {
      const symbol = 'BTCUSDT';
      const dataType = 'trend';
      const data1 = { symbol, trend: '多头趋势', score: 85 };
      const data2 = { symbol, trend: '空头趋势', score: 75 };

      // 第一次检测
      await detector.detectDataChange(symbol, dataType, data1);
      
      // 第二次检测不同数据
      const result = await detector.detectDataChange(symbol, dataType, data2);

      expect(result).toBe(true);
    });

    test('应该检测到无数据变化', async () => {
      const symbol = 'BTCUSDT';
      const dataType = 'trend';
      const data = { symbol, trend: '多头趋势', score: 85 };

      // 第一次检测
      await detector.detectDataChange(symbol, dataType, data);
      
      // 第二次检测相同数据
      const result = await detector.detectDataChange(symbol, dataType, data);

      expect(result).toBe(false);
    });

    test('应该为不同交易对独立检测', async () => {
      const data1 = { symbol: 'BTCUSDT', trend: '多头趋势' };
      const data2 = { symbol: 'ETHUSDT', trend: '多头趋势' };

      const result1 = await detector.detectDataChange('BTCUSDT', 'trend', data1);
      const result2 = await detector.detectDataChange('ETHUSDT', 'trend', data2);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(detector.dataHashes.size).toBe(2);
    });

    test('应该为不同数据类型独立检测', async () => {
      const symbol = 'BTCUSDT';
      const data = { symbol, trend: '多头趋势' };

      const result1 = await detector.detectDataChange(symbol, 'trend', data);
      const result2 = await detector.detectDataChange(symbol, 'signal', data);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(detector.dataHashes.size).toBe(2);
    });

    test('应该处理检测错误', async () => {
      const symbol = 'BTCUSDT';
      const dataType = 'trend';
      const newData = null; // 无效数据

      const result = await detector.detectDataChange(symbol, dataType, newData);

      expect(result).toBe(false);
    });
  });

  describe('triggerDataChange', () => {
    test('应该触发变更事件并更新缓存', async () => {
      const symbol = 'BTCUSDT';
      const dataType = 'trend';
      const newData = { symbol, trend: '多头趋势' };

      await detector.triggerDataChange(symbol, dataType, newData);

      expect(mockCacheManager.del).toHaveBeenCalled();
    });

    test('应该通知所有监听器', async () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      detector.addChangeListener(listener1);
      detector.addChangeListener(listener2);

      const symbol = 'BTCUSDT';
      const dataType = 'trend';
      const newData = { symbol, trend: '多头趋势' };

      await detector.triggerDataChange(symbol, dataType, newData);

      expect(listener1).toHaveBeenCalledWith(symbol, dataType, newData);
      expect(listener2).toHaveBeenCalledWith(symbol, dataType, newData);
    });

    test('应该处理监听器错误', async () => {
      const errorListener = jest.fn().mockRejectedValue(new Error('Listener error'));
      const normalListener = jest.fn();
      
      detector.addChangeListener(errorListener);
      detector.addChangeListener(normalListener);

      const symbol = 'BTCUSDT';
      const dataType = 'trend';
      const newData = { symbol, trend: '多头趋势' };

      // 不应该抛出错误
      await expect(detector.triggerDataChange(symbol, dataType, newData)).resolves.not.toThrow();
      
      expect(normalListener).toHaveBeenCalled();
    });
  });

  describe('updateCache', () => {
    test('应该更新相关缓存', async () => {
      const symbol = 'BTCUSDT';
      const dataType = 'trend';
      const newData = { symbol, trend: '多头趋势' };

      await detector.updateCache(symbol, dataType, newData);

      expect(mockCacheManager.del).toHaveBeenCalledWith('strategy', `strategy_analysis:${symbol}`);
      expect(mockCacheManager.del).toHaveBeenCalledWith('strategy', `trend:${symbol}`);
      expect(mockCacheManager.del).toHaveBeenCalledWith('api', 'signals');
      expect(mockCacheManager.del).toHaveBeenCalledWith('api', 'stats');
    });

    test('应该处理缓存管理器未初始化', async () => {
      detector.cacheManager = null;
      
      const symbol = 'BTCUSDT';
      const dataType = 'trend';
      const newData = { symbol, trend: '多头趋势' };

      await expect(detector.updateCache(symbol, dataType, newData)).resolves.not.toThrow();
    });

    test('应该处理缓存更新错误', async () => {
      mockCacheManager.del.mockRejectedValue(new Error('Cache error'));

      const symbol = 'BTCUSDT';
      const dataType = 'trend';
      const newData = { symbol, trend: '多头趋势' };

      await expect(detector.updateCache(symbol, dataType, newData)).resolves.not.toThrow();
    });
  });

  describe('监听器管理', () => {
    test('应该添加和移除监听器', () => {
      const listener = jest.fn();
      
      expect(detector.changeListeners.size).toBe(0);
      
      detector.addChangeListener(listener);
      expect(detector.changeListeners.size).toBe(1);
      expect(detector.changeListeners.has(listener)).toBe(true);
      
      detector.removeChangeListener(listener);
      expect(detector.changeListeners.size).toBe(0);
      expect(detector.changeListeners.has(listener)).toBe(false);
    });

    test('应该支持多个监听器', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      detector.addChangeListener(listener1);
      detector.addChangeListener(listener2);
      
      expect(detector.changeListeners.size).toBe(2);
    });
  });

  describe('getHashStats', () => {
    test('应该返回正确的统计信息', async () => {
      // 添加一些测试数据
      await detector.detectDataChange('BTCUSDT', 'trend', { symbol: 'BTCUSDT', trend: '多头趋势' });
      await detector.detectDataChange('ETHUSDT', 'signal', { symbol: 'ETHUSDT', signal: 'NONE' });
      
      const listener = jest.fn();
      detector.addChangeListener(listener);

      const stats = detector.getHashStats();

      expect(stats.totalKeys).toBe(2);
      expect(stats.listeners).toBe(1);
      expect(stats.keys).toContain('BTCUSDT_trend');
      expect(stats.keys).toContain('ETHUSDT_signal');
    });
  });

  describe('cleanup', () => {
    test('应该清理过期的哈希记录', () => {
      // 添加大量测试数据
      for (let i = 0; i < 1200; i++) {
        detector.dataHashes.set(`key_${i}`, `hash_${i}`);
      }

      expect(detector.dataHashes.size).toBe(1200);

      detector.cleanup();

      expect(detector.dataHashes.size).toBeLessThanOrEqual(500);
    });
  });

  describe('集成测试', () => {
    test('应该完整工作流程', async () => {
      const listener = jest.fn();
      detector.addChangeListener(listener);

      const symbol = 'BTCUSDT';
      const dataType = 'trend';
      const data1 = { symbol, trend: '多头趋势', score: 85 };
      const data2 = { symbol, trend: '空头趋势', score: 75 };

      // 第一次检测
      const result1 = await detector.detectDataChange(symbol, dataType, data1);
      expect(result1).toBe(true);
      expect(listener).toHaveBeenCalledTimes(1);

      // 第二次检测相同数据
      const result2 = await detector.detectDataChange(symbol, dataType, data1);
      expect(result2).toBe(false);
      expect(listener).toHaveBeenCalledTimes(1);

      // 第三次检测不同数据
      const result3 = await detector.detectDataChange(symbol, dataType, data2);
      expect(result3).toBe(true);
      expect(listener).toHaveBeenCalledTimes(2);
    });
  });
});
