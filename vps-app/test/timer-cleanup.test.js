const { DataMonitor } = require('../modules/monitoring/DataMonitor');
const { MemoryOptimizedManager } = require('../modules/data/MemoryOptimizedManager');
const { OptimizedDataMonitor } = require('../modules/monitoring/OptimizedDataMonitor');

describe('定时器清理机制测试', () => {
  let dataMonitor;
  let memoryManager;
  let optimizedMonitor;

  beforeEach(() => {
    dataMonitor = new DataMonitor();
    memoryManager = new MemoryOptimizedManager();
    optimizedMonitor = new OptimizedDataMonitor();
  });

  afterEach(() => {
    // 清理所有定时器
    if (dataMonitor) {
      dataMonitor.stopMemoryCleanup();
      dataMonitor.reset();
    }
    if (memoryManager) {
      memoryManager.stopMemoryCleanup();
    }
    if (optimizedMonitor) {
      optimizedMonitor.stopMemoryCleanup();
    }
    
    // 清理对象引用
    dataMonitor = null;
    memoryManager = null;
    optimizedMonitor = null;
  });

  describe('DataMonitor定时器清理', () => {
    test('应该正确启动和停止内存清理定时器', () => {
      // 启动定时器
      dataMonitor.startMemoryCleanup();
      expect(dataMonitor.memoryCleanupTimer).toBeDefined();
      expect(dataMonitor.memoryCleanupTimer).not.toBeNull();

      // 停止定时器
      dataMonitor.stopMemoryCleanup();
      expect(dataMonitor.memoryCleanupTimer).toBeNull();
    });

    test('重复启动定时器应该先清理旧的', () => {
      // 第一次启动
      dataMonitor.startMemoryCleanup();
      const firstTimer = dataMonitor.memoryCleanupTimer;

      // 第二次启动
      dataMonitor.startMemoryCleanup();
      const secondTimer = dataMonitor.memoryCleanupTimer;

      // 应该是不同的定时器ID
      expect(firstTimer).not.toBe(secondTimer);
      expect(secondTimer).toBeDefined();
    });
  });

  describe('MemoryOptimizedManager定时器清理', () => {
    test('应该正确启动和停止内存清理定时器', () => {
      // 启动定时器
      memoryManager.startMemoryCleanup();
      expect(memoryManager.memoryCleanupTimer).toBeDefined();
      expect(memoryManager.memoryCleanupTimer).not.toBeNull();

      // 停止定时器
      memoryManager.stopMemoryCleanup();
      expect(memoryManager.memoryCleanupTimer).toBeNull();
    });

    test('重复启动定时器应该先清理旧的', () => {
      // 第一次启动
      memoryManager.startMemoryCleanup();
      const firstTimer = memoryManager.memoryCleanupTimer;

      // 第二次启动
      memoryManager.startMemoryCleanup();
      const secondTimer = memoryManager.memoryCleanupTimer;

      // 应该是不同的定时器ID
      expect(firstTimer).not.toBe(secondTimer);
      expect(secondTimer).toBeDefined();
    });
  });

  describe('OptimizedDataMonitor定时器清理', () => {
    test('应该正确启动和停止内存清理定时器', () => {
      // 启动定时器
      optimizedMonitor.startMemoryCleanup();
      expect(optimizedMonitor.memoryCleanupTimer).toBeDefined();
      expect(optimizedMonitor.memoryCleanupTimer).not.toBeNull();

      // 停止定时器
      optimizedMonitor.stopMemoryCleanup();
      expect(optimizedMonitor.memoryCleanupTimer).toBeNull();
    });

    test('重复启动定时器应该先清理旧的', () => {
      // 第一次启动
      optimizedMonitor.startMemoryCleanup();
      const firstTimer = optimizedMonitor.memoryCleanupTimer;

      // 第二次启动
      optimizedMonitor.startMemoryCleanup();
      const secondTimer = optimizedMonitor.memoryCleanupTimer;

      // 应该是不同的定时器ID
      expect(firstTimer).not.toBe(secondTimer);
      expect(secondTimer).toBeDefined();
    });
  });

  describe('定时器内存泄漏防护', () => {
    test('应该能够安全地多次启动和停止定时器', () => {
      // 多次启动和停止
      for (let i = 0; i < 5; i++) {
        dataMonitor.startMemoryCleanup();
        expect(dataMonitor.memoryCleanupTimer).toBeDefined();
        
        dataMonitor.stopMemoryCleanup();
        expect(dataMonitor.memoryCleanupTimer).toBeNull();
      }
    });

    test('停止不存在的定时器应该不会报错', () => {
      // 直接停止（没有启动过）
      expect(() => {
        dataMonitor.stopMemoryCleanup();
      }).not.toThrow();
    });
  });
});
