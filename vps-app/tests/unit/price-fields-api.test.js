// price-fields-api.test.js - 价格字段API单元测试

const request = require('supertest');
const express = require('express');
const Database = require('better-sqlite3');
const PriceFieldsAPI = require('../../src/core/modules/api/PriceFieldsAPI');
const HighPerformancePriceManager = require('../../src/core/modules/price/HighPerformancePriceManager');

describe('价格字段API测试', () => {
  let app;
  let db;
  let priceManager;
  let api;

  beforeEach(async () => {
    // 创建测试应用
    app = express();
    app.use(express.json());

    // 创建内存数据库
    db = new Database(':memory:');
    await createTestTables(db);
    await insertTestData(db);

    // 创建价格管理器和API
    priceManager = new HighPerformancePriceManager(db);
    api = new PriceFieldsAPI(db, priceManager);
    
    // 设置路由
    api.setupRoutes(app);

    // 等待初始化完成
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  describe('ICT策略价格区间API', () => {
    test('GET /api/ict/price-ranges/:symbol 应该返回价格区间', async () => {
      const response = await request(app)
        .get('/api/ict/price-ranges/BTCUSDT')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.symbol).toBe('BTCUSDT');
      expect(response.body.data.timeframe).toBe('4H');
      expect(response.body.data.ranges).toBeDefined();
      expect(Array.isArray(response.body.data.ranges)).toBe(true);
    });

    test('GET /api/ict/price-ranges/:symbol 应该支持查询参数', async () => {
      const response = await request(app)
        .get('/api/ict/price-ranges/BTCUSDT?minStrength=50&limit=5')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.ranges.length).toBeLessThanOrEqual(5);
    });

    test('POST /api/ict/price-ranges/:symbol 应该更新价格区间', async () => {
      const priceData = {
        ob_upper_price: 46000,
        ob_lower_price: 45000,
        fvg_upper_price: 45500,
        fvg_lower_price: 45200,
        current_price: 45300,
        ob_strength: 85,
        fvg_strength: 75,
        priority_score: 90,
        is_active: true
      };

      const response = await request(app)
        .post('/api/ict/price-ranges/BTCUSDT')
        .send(priceData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.symbol).toBe('BTCUSDT');
      expect(response.body.data.updated).toBe(true);
    });

    test('POST /api/ict/price-ranges/:symbol 应该验证输入数据', async () => {
      const invalidData = {
        ob_upper_price: 45000,
        ob_lower_price: 46000, // 无效：上沿小于下沿
        current_price: 45500
      };

      const response = await request(app)
        .post('/api/ict/price-ranges/BTCUSDT')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toContain('OB上沿价格必须大于下沿价格');
    });

    test('GET /api/ict/price-summary 应该返回价格摘要', async () => {
      const response = await request(app)
        .get('/api/ict/price-summary')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary).toBeDefined();
      expect(Array.isArray(response.body.data.summary)).toBe(true);
    });

    test('GET /api/ict/price-summary 应该支持符号筛选', async () => {
      const response = await request(app)
        .get('/api/ict/price-summary?symbols=BTCUSDT,ETHUSDT')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.length).toBeLessThanOrEqual(2);
    });
  });

  describe('V3策略价格边界API', () => {
    test('GET /api/v3/price-boundaries/:symbol 应该返回价格边界', async () => {
      const response = await request(app)
        .get('/api/v3/price-boundaries/ETHUSDT')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.symbol).toBe('ETHUSDT');
      expect(response.body.data.timeframe).toBe('1H');
      expect(response.body.data.boundaries).toBeDefined();
      expect(Array.isArray(response.body.data.boundaries)).toBe(true);
    });

    test('GET /api/v3/price-boundaries/:symbol 应该支持市场类型筛选', async () => {
      const response = await request(app)
        .get('/api/v3/price-boundaries/ETHUSDT?marketType=trending')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('POST /api/v3/price-boundaries/:symbol 应该更新价格边界', async () => {
      const priceData = {
        range_upper_boundary: 2600,
        range_lower_boundary: 2400,
        trend_entry_price: 2500,
        trend_confirmation_price: 2520,
        current_price: 2480,
        market_type: 'ranging',
        trend_momentum_score: 70,
        priority_score: 80,
        is_active: true
      };

      const response = await request(app)
        .post('/api/v3/price-boundaries/ETHUSDT')
        .send(priceData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.symbol).toBe('ETHUSDT');
      expect(response.body.data.updated).toBe(true);
    });

    test('POST /api/v3/price-boundaries/:symbol 应该验证边界价格', async () => {
      const invalidData = {
        range_upper_boundary: 2400,
        range_lower_boundary: 2500, // 无效：上边界小于下边界
        current_price: 2450
      };

      const response = await request(app)
        .post('/api/v3/price-boundaries/ETHUSDT')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.details).toContain('区间上边界必须大于下边界');
    });

    test('GET /api/v3/price-summary 应该返回V3价格摘要', async () => {
      const response = await request(app)
        .get('/api/v3/price-summary')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary).toBeDefined();
      expect(Array.isArray(response.body.data.summary)).toBe(true);
    });
  });

  describe('统一价格数据API', () => {
    test('GET /api/price-fields/unified/:symbol 应该返回统一数据', async () => {
      const response = await request(app)
        .get('/api/price-fields/unified/BTCUSDT')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.symbol).toBe('BTCUSDT');
      expect(response.body.data.strategies).toBeDefined();
      expect(response.body.data.strategies.ict).toBeDefined();
      expect(response.body.data.strategies.v3).toBeDefined();
    });

    test('GET /api/price-fields/performance 应该返回性能统计', async () => {
      const response = await request(app)
        .get('/api/price-fields/performance')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.performance).toBeDefined();
      expect(response.body.data.database).toBeDefined();
      expect(response.body.data.performance.cache).toBeDefined();
      expect(response.body.data.performance.memory).toBeDefined();
    });

    test('GET /api/price-fields/health 应该返回健康状态', async () => {
      const response = await request(app)
        .get('/api/price-fields/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBeDefined();
      expect(response.body.data.checks).toBeDefined();
      expect(response.body.data.checks.database).toBeDefined();
      expect(response.body.data.checks.cache).toBeDefined();
      expect(response.body.data.checks.performance).toBeDefined();
    });

    test('GET /api/price-fields/active-symbols 应该返回活跃交易对', async () => {
      const response = await request(app)
        .get('/api/price-fields/active-symbols')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.symbols).toBeDefined();
      expect(Array.isArray(response.body.data.symbols)).toBe(true);
      expect(response.body.data.count).toBeDefined();
    });
  });

  describe('批量操作API', () => {
    test('POST /api/price-fields/batch-update 应该支持批量更新', async () => {
      const updates = [
        {
          symbol: 'BTCUSDT',
          strategy: 'ict',
          data: {
            ob_upper_price: 46000,
            ob_lower_price: 45000,
            current_price: 45500,
            is_active: true
          }
        },
        {
          symbol: 'ETHUSDT',
          strategy: 'v3',
          data: {
            range_upper_boundary: 2600,
            range_lower_boundary: 2400,
            current_price: 2500,
            is_active: true
          }
        }
      ];

      const response = await request(app)
        .post('/api/price-fields/batch-update')
        .send({ updates })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.successful).toBe(2);
      expect(response.body.data.failed).toBe(0);
    });

    test('POST /api/price-fields/batch-update 应该处理部分失败', async () => {
      const updates = [
        {
          symbol: 'BTCUSDT',
          strategy: 'ict',
          data: { ob_upper_price: 46000, is_active: true }
        },
        {
          symbol: 'INVALID',
          strategy: 'unknown', // 无效策略
          data: { invalid: 'data' }
        }
      ];

      const response = await request(app)
        .post('/api/price-fields/batch-update')
        .send({ updates })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.successful).toBe(1);
      expect(response.body.data.failed).toBe(1);
      expect(response.body.data.errors).toBeDefined();
      expect(response.body.data.errors.length).toBe(1);
    });

    test('POST /api/price-fields/batch-update 应该验证输入格式', async () => {
      const response = await request(app)
        .post('/api/price-fields/batch-update')
        .send({ updates: 'invalid' }) // 无效格式
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid updates array');
    });
  });

  describe('错误处理', () => {
    test('应该处理数据库错误', async () => {
      // 关闭数据库连接
      db.close();

      const response = await request(app)
        .get('/api/ict/price-ranges/BTCUSDT')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Internal server error');
    });

    test('应该处理无效的交易对', async () => {
      const response = await request(app)
        .get('/api/ict/price-ranges/INVALID_SYMBOL')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.ranges).toBeDefined();
      expect(response.body.data.ranges.length).toBe(0);
    });

    test('应该处理无效的查询参数', async () => {
      const response = await request(app)
        .get('/api/ict/price-ranges/BTCUSDT?minStrength=invalid&limit=abc')
        .expect(200);

      expect(response.body.success).toBe(true);
      // 应该使用默认值
    });
  });

  describe('数据验证', () => {
    test('ICT数据验证应该检查价格关系', async () => {
      const api = new PriceFieldsAPI(db, priceManager);
      
      const validation = api.validateICTPriceData({
        ob_upper_price: 45000,
        ob_lower_price: 46000, // 错误：上沿小于下沿
        ob_strength: 150 // 错误：超出范围
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(2);
      expect(validation.errors).toContain('OB上沿价格必须大于下沿价格');
      expect(validation.errors).toContain('OB强度必须在0-100之间');
    });

    test('V3数据验证应该检查边界关系', async () => {
      const api = new PriceFieldsAPI(db, priceManager);
      
      const validation = api.validateV3PriceData({
        range_upper_boundary: 2400,
        range_lower_boundary: 2500, // 错误：上边界小于下边界
        trend_momentum_score: -10, // 错误：负数
        risk_reward_ratio: -1 // 错误：负数
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(3);
    });
  });

  describe('数据增强', () => {
    test('ICT数据增强应该计算辅助字段', async () => {
      const api = new PriceFieldsAPI(db, priceManager);
      
      const enriched = api.enrichICTPriceData({
        ob_upper_price: 45000,
        ob_lower_price: 44000,
        fvg_upper_price: 44500,
        fvg_lower_price: 44200,
        current_price: 44300
      });

      expect(enriched.ob_mid_price).toBe(44500);
      expect(enriched.ob_range_width).toBe(1000);
      expect(enriched.fvg_mid_price).toBe(44350);
      expect(enriched.price_in_fvg).toBe(true);
      expect(enriched.distance_to_ob_upper).toBe(700);
    });

    test('V3数据增强应该计算区间指标', async () => {
      const api = new PriceFieldsAPI(db, priceManager);
      
      const enriched = api.enrichV3PriceData({
        range_upper_boundary: 2500,
        range_lower_boundary: 2400,
        trend_entry_price: 2450,
        current_price: 2430
      });

      expect(enriched.range_mid_price).toBe(2450);
      expect(enriched.range_width).toBe(100);
      expect(enriched.price_position_in_range).toBe(0.3);
      expect(enriched.distance_to_trend_entry).toBe(20);
    });
  });

  describe('性能测试', () => {
    test('API响应时间应该合理', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/ict/price-ranges/BTCUSDT')
        .expect(200);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // 应该在1秒内响应
    });

    test('批量操作应该高效处理', async () => {
      const updates = Array.from({ length: 50 }, (_, i) => ({
        symbol: `TEST${i}USDT`,
        strategy: 'ict',
        data: {
          ob_upper_price: 45000 + i,
          current_price: 44500 + i,
          is_active: true
        }
      }));

      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/price-fields/batch-update')
        .send({ updates })
        .expect(200);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(3000); // 批量操作应该在3秒内完成
      expect(response.body.data.successful).toBe(50);
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

async function insertTestData(db) {
  db.exec(`
    INSERT INTO ict_price_ranges (
      symbol, ob_upper_price, ob_lower_price, fvg_upper_price, fvg_lower_price,
      current_price, ob_strength, fvg_strength, priority_score, is_active
    ) VALUES 
    ('BTCUSDT', 45000, 44000, 44500, 44200, 44300, 80, 70, 90, 1),
    ('ETHUSDT', 2500, 2400, 2450, 2420, 2430, 75, 65, 85, 1);

    INSERT INTO v3_price_ranges (
      symbol, range_upper_boundary, range_lower_boundary, trend_entry_price,
      trend_confirmation_price, current_price, market_type, trend_momentum_score,
      priority_score, is_active
    ) VALUES 
    ('BTCUSDT', 45500, 44500, 45000, 45100, 44800, 'trending', 80, 90, 1),
    ('ETHUSDT', 2500, 2400, 2450, 2460, 2430, 'ranging', 75, 85, 1);
  `);
}
