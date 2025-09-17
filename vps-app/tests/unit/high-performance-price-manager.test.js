// high-performance-price-manager.test.js - 高性能价格管理器单元测试

const Database = require('better-sqlite3');
const HighPerformancePriceManager = require('../../src/core/modules/price/HighPerformancePriceManager');

describe('高性能价格管理器测试', () => {
  let db;
  let priceManager;

  beforeEach(async () => {
    // 使用内存数据库进行测试
    db = new Database(':memory:');
    
    // 创建测试表
    await createTestTables(db);
    
    priceManager = new HighPerformancePriceManager(db);
    
    // 等待批处理器启动
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(() => {
    if (priceManager) {
      // 清理定时器
      priceManager.cache.clear();
    }
    if (db) {
      db.close();
    }
  });

  describe('ICT策略价格数据管理', () => {
    test('应该获取ICT价格区间', async () => {
      // 插入测试数据
      await insertTestICTData(db);
      
      const result = await priceManager.getICTPriceRanges('BTCUSDT');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('ob_upper_price');
      expect(result[0]).toHaveProperty('fvg_upper_price');
      expect(result[0]).toHaveProperty('formatted_prices');
    });

    test('应该支持ICT查询选项', async () => {
      await insertTestICTData(db);
      
      const options = {
        minStrength: 50,
        priceInRange: true,
        limit: 5
      };
      
      const result = await priceManager.getICTPriceRanges('BTCUSDT', options);
      
      expect(result.length).toBeLessThanOrEqual(5);
    });

    test('应该更新ICT价格数据', async () => {
      const priceData = {
        ob_upper_price: 45000,
        ob_lower_price: 44000,
        fvg_upper_price: 44500,
        fvg_lower_price: 44200,
        current_price: 44300,
        ob_strength: 75,
        fvg_strength: 60,
        priority_score: 80,
        is_active: true
      };

      await priceManager.updateICTPriceRanges('BTCUSDT', priceData);
      
      // 等待批处理完成
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // 验证数据是否插入
      const record = db.prepare('SELECT * FROM ict_price_ranges WHERE symbol = ?').get('BTCUSDT');
      expect(record).toBeDefined();
      expect(record.ob_upper_price).toBe(45000);
      expect(record.fvg_strength).toBe(60);
    });

    test('应该计算OB健康度', async () => {
      const testData = {
        ob_upper_price: 45000,
        ob_lower_price: 44000,
        ob_strength: 80,
        ob_age_hours: 12,
        ob_tested_count: 2,
        ob_range_width: 1000
      };

      const health = priceManager.calculateOBHealth(testData);
      
      expect(health).toBeGreaterThan(0);
      expect(health).toBeLessThanOrEqual(100);
    });

    test('应该计算FVG健康度', async () => {
      const testData = {
        fvg_upper_price: 44500,
        fvg_lower_price: 44200,
        fvg_strength: 70,
        fvg_age_hours: 6,
        fvg_filled_percentage: 20
      };

      const health = priceManager.calculateFVGHealth(testData);
      
      expect(health).toBeGreaterThan(0);
      expect(health).toBeLessThanOrEqual(100);
    });
  });

  describe('V3策略价格数据管理', () => {
    test('应该获取V3价格边界', async () => {
      await insertTestV3Data(db);
      
      const result = await priceManager.getV3PriceRanges('ETHUSDT');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('range_upper_boundary');
      expect(result[0]).toHaveProperty('trend_entry_price');
      expect(result[0]).toHaveProperty('formatted_prices');
    });

    test('应该支持V3查询选项', async () => {
      await insertTestV3Data(db);
      
      const options = {
        marketType: 'trending',
        minMomentum: 60,
        limit: 3
      };
      
      const result = await priceManager.getV3PriceRanges('ETHUSDT', options);
      
      expect(result.length).toBeLessThanOrEqual(3);
    });

    test('应该更新V3价格数据', async () => {
      const priceData = {
        range_upper_boundary: 2500,
        range_lower_boundary: 2400,
        trend_entry_price: 2450,
        trend_confirmation_price: 2460,
        current_price: 2430,
        market_type: 'ranging',
        trend_momentum_score: 65,
        priority_score: 75,
        is_active: true
      };

      await priceManager.updateV3PriceRanges('ETHUSDT', priceData);
      
      // 等待批处理完成
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // 验证数据是否插入
      const record = db.prepare('SELECT * FROM v3_price_ranges WHERE symbol = ?').get('ETHUSDT');
      expect(record).toBeDefined();
      expect(record.range_upper_boundary).toBe(2500);
      expect(record.market_type).toBe('ranging');
    });

    test('应该计算区间健康度', async () => {
      const testData = {
        range_upper_boundary: 2500,
        range_lower_boundary: 2400,
        range_width_percentage: 4,
        range_test_count_upper: 2,
        range_test_count_lower: 1,
        price_position_in_range: 0.6
      };

      const health = priceManager.calculateRangeHealth(testData);
      
      expect(health).toBeGreaterThan(0);
      expect(health).toBeLessThanOrEqual(100);
    });

    test('应该计算趋势健康度', async () => {
      const testData = {
        trend_momentum_score: 75,
        trend_volume_confirmation: 80,
        risk_reward_ratio: 3.5
      };

      const health = priceManager.calculateTrendHealth(testData);
      
      expect(health).toBeGreaterThan(0);
      expect(health).toBeLessThanOrEqual(100);
    });
  });

  describe('缓存管理', () => {
    test('应该缓存查询结果', async () => {
      await insertTestICTData(db);
      
      // 第一次查询
      const result1 = await priceManager.getICTPriceRanges('BTCUSDT');
      
      // 第二次查询应该来自缓存
      const result2 = await priceManager.getICTPriceRanges('BTCUSDT');
      
      expect(result1).toEqual(result2);
      
      const stats = priceManager.getPerformanceStats();
      expect(stats.cache.hits).toBeGreaterThan(0);
    });

    test('应该清除相关缓存', async () => {
      await insertTestICTData(db);
      
      // 查询以填充缓存
      await priceManager.getICTPriceRanges('BTCUSDT');
      
      // 更新数据应该清除缓存
      await priceManager.updateICTPriceRanges('BTCUSDT', {
        ob_upper_price: 46000,
        current_price: 45500,
        is_active: true
      });
      
      // 验证缓存被清除
      expect(priceManager.cache.size).toBeLessThanOrEqual(1);
    });

    test('应该支持LRU缓存淘汰', async () => {
      // 填满缓存
      for (let i = 0; i < 1005; i++) {
        priceManager.setCache(`test_key_${i}`, { data: i }, 60000);
      }
      
      // 缓存大小应该被限制
      expect(priceManager.cache.size).toBeLessThanOrEqual(1000);
    });

    test('缓存应该支持TTL过期', async () => {
      priceManager.setCache('test_key', { data: 'test' }, 100); // 100ms TTL
      
      // 立即获取应该成功
      let cached = priceManager.getFromCache('test_key');
      expect(cached).toEqual({ data: 'test' });
      
      // 等待过期
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // 过期后应该返回null
      cached = priceManager.getFromCache('test_key');
      expect(cached).toBeNull();
    });
  });

  describe('批处理操作', () => {
    test('应该支持批量更新', async () => {
      const updates = [
        {
          symbol: 'BTCUSDT',
          data: { ob_upper_price: 45000, current_price: 44500, is_active: true },
          type: 'ict'
        },
        {
          symbol: 'ETHUSDT',
          data: { range_upper_boundary: 2500, current_price: 2450, is_active: true },
          type: 'v3'
        }
      ];

      // 模拟批处理
      priceManager.batchQueue.set('test_batch', updates);
      await priceManager.processBatch('test_batch');
      
      // 验证数据插入
      const ictRecord = db.prepare('SELECT * FROM ict_price_ranges WHERE symbol = ?').get('BTCUSDT');
      const v3Record = db.prepare('SELECT * FROM v3_price_ranges WHERE symbol = ?').get('ETHUSDT');
      
      expect(ictRecord).toBeDefined();
      expect(v3Record).toBeDefined();
    });

    test('批处理应该处理大量数据', async () => {
      const batchSize = 100;
      const updates = Array.from({ length: batchSize }, (_, i) => ({
        symbol: `TEST${i}USDT`,
        data: { 
          ob_upper_price: 45000 + i, 
          current_price: 44500 + i,
          is_active: true
        },
        type: 'ict'
      }));

      const startTime = Date.now();
      await priceManager.batchUpdateICT(updates);
      const duration = Date.now() - startTime;

      // 批处理应该高效
      expect(duration).toBeLessThan(1000);
      
      // 验证数据插入
      const count = db.prepare('SELECT COUNT(*) as count FROM ict_price_ranges').get();
      expect(count.count).toBe(batchSize);
    });
  });

  describe('性能监控', () => {
    test('应该提供性能统计', async () => {
      await insertTestICTData(db);
      
      // 执行一些操作
      await priceManager.getICTPriceRanges('BTCUSDT');
      await priceManager.getICTPriceRanges('BTCUSDT'); // 缓存命中
      
      const stats = priceManager.getPerformanceStats();
      
      expect(stats).toHaveProperty('cache');
      expect(stats).toHaveProperty('batch');
      expect(stats).toHaveProperty('memory');
      expect(stats.cache).toHaveProperty('hitRate');
      expect(stats.cache.hitRate).toBeGreaterThan(0);
    });

    test('应该记录性能日志', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // 模拟慢操作
      priceManager.logPerformance('test_operation', 150, 10);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚡ 性能日志: test_operation - 150ms (10 项)')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('错误处理', () => {
    test('应该处理数据库查询错误', async () => {
      // 关闭数据库连接
      db.close();
      
      await expect(priceManager.getICTPriceRanges('BTCUSDT')).rejects.toThrow();
    });

    test('应该处理无效的查询参数', async () => {
      const options = {
        minStrength: 'invalid', // 无效参数
        limit: -1 // 无效限制
      };
      
      // 应该优雅处理无效参数
      await expect(priceManager.getICTPriceRanges('BTCUSDT', options)).resolves.toBeDefined();
    });

    test('批处理应该处理部分失败', async () => {
      const updates = [
        { symbol: 'VALID', data: { ob_upper_price: 45000, is_active: true }, type: 'ict' },
        { symbol: null, data: { invalid: 'data' }, type: 'invalid' } // 无效数据
      ];

      // 不应该完全失败
      priceManager.batchQueue.set('mixed_batch', updates);
      
      // 应该处理错误而不崩溃
      await expect(priceManager.processBatch('mixed_batch')).resolves.toBeDefined();
    });
  });

  describe('数据格式化', () => {
    test('应该正确格式化ICT价格', async () => {
      await insertTestICTData(db);
      
      const result = await priceManager.getICTPriceRanges('BTCUSDT');
      const firstItem = result[0];
      
      expect(firstItem.formatted_prices).toBeDefined();
      expect(firstItem.formatted_prices.ob_range).toMatch(/\d+\.\d+ - \d+\.\d+/);
      expect(firstItem.formatted_prices.fvg_range).toMatch(/\d+\.\d+ - \d+\.\d+/);
      expect(firstItem.formatted_prices.current).toMatch(/\d+\.\d+/);
    });

    test('应该正确格式化V3价格', async () => {
      await insertTestV3Data(db);
      
      const result = await priceManager.getV3PriceRanges('ETHUSDT');
      const firstItem = result[0];
      
      expect(firstItem.formatted_prices).toBeDefined();
      expect(firstItem.formatted_prices.range_boundary).toMatch(/\d+\.\d+ - \d+\.\d+/);
      expect(firstItem.formatted_prices.trend_entry).toMatch(/\d+\.\d+/);
      expect(firstItem.formatted_prices.current).toMatch(/\d+\.\d+/);
    });
  });
});

// 辅助函数

async function createTestTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ict_price_ranges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      timeframe TEXT NOT NULL DEFAULT '4H',
      ob_upper_price REAL,
      ob_lower_price REAL,
      ob_mid_price REAL,
      ob_range_width REAL,
      ob_strength REAL DEFAULT 0,
      ob_age_hours INTEGER DEFAULT 0,
      ob_tested_count INTEGER DEFAULT 0,
      fvg_upper_price REAL,
      fvg_lower_price REAL,
      fvg_mid_price REAL,
      fvg_range_width REAL,
      fvg_type TEXT,
      fvg_strength REAL DEFAULT 0,
      fvg_age_hours INTEGER DEFAULT 0,
      fvg_filled_percentage REAL DEFAULT 0,
      current_price REAL,
      distance_to_ob_upper REAL,
      distance_to_ob_lower REAL,
      distance_to_fvg_upper REAL,
      distance_to_fvg_lower REAL,
      ob_fvg_overlap BOOLEAN DEFAULT FALSE,
      price_in_ob BOOLEAN DEFAULT FALSE,
      price_in_fvg BOOLEAN DEFAULT FALSE,
      is_active BOOLEAN DEFAULT TRUE,
      priority_score REAL DEFAULT 0,
      last_calculated DATETIME DEFAULT CURRENT_TIMESTAMP,
      calculation_version INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS v3_price_ranges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      timeframe TEXT NOT NULL DEFAULT '1H',
      range_upper_boundary REAL,
      range_lower_boundary REAL,
      range_mid_price REAL,
      range_width REAL,
      range_width_percentage REAL,
      range_test_count_upper INTEGER DEFAULT 0,
      range_test_count_lower INTEGER DEFAULT 0,
      range_breakout_probability REAL DEFAULT 0,
      trend_entry_price REAL,
      trend_confirmation_price REAL,
      trend_breakout_price REAL,
      trend_momentum_score REAL DEFAULT 0,
      trend_volume_confirmation REAL DEFAULT 0,
      current_price REAL,
      price_position_in_range REAL,
      distance_to_upper_boundary REAL,
      distance_to_lower_boundary REAL,
      distance_to_trend_entry REAL,
      market_type TEXT,
      market_phase TEXT,
      risk_reward_ratio REAL,
      is_active BOOLEAN DEFAULT TRUE,
      priority_score REAL DEFAULT 0,
      last_calculated DATETIME DEFAULT CURRENT_TIMESTAMP,
      calculation_version INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function insertTestICTData(db) {
  db.exec(`
    INSERT INTO ict_price_ranges (
      symbol, ob_upper_price, ob_lower_price, fvg_upper_price, fvg_lower_price,
      current_price, ob_strength, fvg_strength, priority_score, is_active
    ) VALUES (
      'BTCUSDT', 45000, 44000, 44500, 44200, 44300, 80, 70, 90, 1
    );
  `);
}

async function insertTestV3Data(db) {
  db.exec(`
    INSERT INTO v3_price_ranges (
      symbol, range_upper_boundary, range_lower_boundary, trend_entry_price,
      trend_confirmation_price, current_price, market_type, trend_momentum_score,
      priority_score, is_active
    ) VALUES (
      'ETHUSDT', 2500, 2400, 2450, 2460, 2430, 'trending', 75, 85, 1
    );
  `);
}
