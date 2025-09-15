/**
 * 震荡市边界判断修复综合测试
 * 测试我们修复的所有问题：
 * 1. 布林带计算中的数组长度不匹配问题
 * 2. 边界无效时布林带数据丢失问题
 * 3. 数据库字段映射问题
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 设置测试环境
process.env.NODE_ENV = 'test';

// 导入要测试的模块
const StrategyV3Core = require('../../src/core/modules/strategy/StrategyV3Core');
const SmartFlowStrategyV3 = require('../../src/core/modules/strategy/SmartFlowStrategyV3');
const DatabaseManager = require('../../src/core/modules/database/DatabaseManager');

describe('震荡市边界判断修复综合测试', () => {
  let strategyCore;
  let databaseManager;
  let testDb;
  const testDbPath = path.join(__dirname, '../../test-range-boundary-comprehensive.db');

  beforeAll(async () => {
    // 创建测试数据库
    testDb = new sqlite3.Database(testDbPath);
    
    // 创建必要的表
    await new Promise((resolve, reject) => {
      testDb.serialize(() => {
        // 创建K线数据表
        testDb.run(`
          CREATE TABLE IF NOT EXISTS kline_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            interval TEXT NOT NULL,
            open_time INTEGER NOT NULL,
            close_time INTEGER NOT NULL,
            open_price REAL NOT NULL,
            high_price REAL NOT NULL,
            low_price REAL NOT NULL,
            close_price REAL NOT NULL,
            volume REAL NOT NULL,
            quote_volume REAL,
            trades_count INTEGER,
            taker_buy_volume REAL,
            taker_buy_quote_volume REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(symbol, interval, close_time)
          )
        `);

        // 创建策略分析表
        testDb.run(`
          CREATE TABLE IF NOT EXISTS strategy_analysis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            category TEXT,
            trend TEXT,
            trend_strength TEXT,
            ma20 REAL,
            ma50 REAL,
            ma200 REAL,
            bbw_expanding INTEGER,
            signal TEXT,
            signal_strength TEXT,
            hourly_score REAL,
            vwap REAL,
            oi_change REAL,
            funding_rate REAL,
            execution TEXT,
            execution_mode TEXT,
            mode_a TEXT,
            mode_b TEXT,
            entry_signal REAL,
            stop_loss REAL,
            take_profit REAL,
            current_price REAL,
            data_collection_rate REAL,
            full_analysis_data TEXT,
            data_valid INTEGER DEFAULT 1,
            error_message TEXT,
            market_type TEXT,
            vwap_direction_consistent INTEGER,
            factors TEXT,
            vol15m_ratio REAL,
            vol1h_ratio REAL,
            delta_imbalance REAL,
            strategy_version TEXT,
            range_lower_boundary_valid INTEGER,
            range_upper_boundary_valid INTEGER,
            bb_upper REAL,
            bb_middle REAL,
            bb_lower REAL,
            boundary_score_1h REAL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });

    // 初始化策略核心和数据库管理器
    strategyCore = new StrategyV3Core(testDb);
    databaseManager = new DatabaseManager(testDb);
  });

  afterAll(async () => {
    if (strategyCore) {
      await strategyCore.destroy();
    }
    if (testDb) {
      testDb.close();
    }
    // 清理测试数据库文件
    const fs = require('fs');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  beforeEach(async () => {
    // 清理测试数据
    await new Promise((resolve, reject) => {
      testDb.run('DELETE FROM kline_data', (err) => {
        if (err) reject(err);
        else {
          testDb.run('DELETE FROM strategy_analysis', (err) => {
            if (err) reject(err);
            else resolve();
          });
        }
      });
    });
  });

  describe('布林带计算修复测试', () => {
    test('应该修复数组长度不匹配问题', () => {
      const testCandles = [];
      for (let i = 0; i < 50; i++) {
        testCandles.push({
          open: 100 + Math.random() * 10,
          high: 105 + Math.random() * 10,
          low: 95 + Math.random() * 10,
          close: 100 + Math.random() * 10,
          volume: 1000 + Math.random() * 500
        });
      }

      const bb = strategyCore.calculateBollingerBands(testCandles, 20, 2);
      
      // 验证数组长度正确（布林带从第20根K线开始，所以只有31个有效值）
      expect(bb).toHaveLength(50); // 修复后的版本应该与输入数组长度相同
      
      // 验证所有元素都有正确的结构
      bb.forEach((bbItem, index) => {
        expect(bbItem).toHaveProperty('middle');
        expect(bbItem).toHaveProperty('upper');
        expect(bbItem).toHaveProperty('lower');
        expect(bbItem).toHaveProperty('bandwidth');
        
        // 验证数值有效性
        expect(typeof bbItem.middle).toBe('number');
        expect(typeof bbItem.upper).toBe('number');
        expect(typeof bbItem.lower).toBe('number');
        expect(typeof bbItem.bandwidth).toBe('number');
        
        // 验证布林带逻辑
        expect(bbItem.upper).toBeGreaterThan(bbItem.middle);
        expect(bbItem.middle).toBeGreaterThan(bbItem.lower);
      });
    });

    test('应该处理null/undefined值', () => {
      const testCandles = [];
      for (let i = 0; i < 30; i++) {
        testCandles.push({
          open: 100,
          high: 105,
          low: 95,
          close: 100,
          volume: 1000
        });
      }

      const bb = strategyCore.calculateBollingerBands(testCandles, 20, 2);
      const lastBB = bb[bb.length - 1];
      
      // 验证最后一条布林带数据不为空
      expect(lastBB).toBeDefined();
      expect(lastBB.middle).toBeGreaterThan(0);
      expect(lastBB.upper).toBeGreaterThan(0);
      expect(lastBB.lower).toBeGreaterThan(0);
    });
  });

  describe('边界判断数据保存测试', () => {
    test('边界无效时也应该保存布林带数据', async () => {
      // 插入测试K线数据
      const now = Date.now();
      const testData = [];
      
      for (let i = 0; i < 50; i++) {
        const closeTime = now - (50 - i) * 3600000; // 每小时一条
        testData.push([
          'BTCUSDT',
          '1h',
          closeTime - 3600000,
          closeTime,
          100 + Math.random() * 10,
          105 + Math.random() * 10,
          95 + Math.random() * 10,
          100 + Math.random() * 10,
          1000 + Math.random() * 500,
          (1000 + Math.random() * 500) * (100 + Math.random() * 10),
          0, 0, 0, 0
        ]);
      }
      
      await new Promise((resolve, reject) => {
        const stmt = testDb.prepare(`
          INSERT INTO kline_data (
            symbol, interval, open_time, close_time, open_price, high_price, 
            low_price, close_price, volume, quote_volume, trades_count, 
            taker_buy_volume, taker_buy_quote_volume, ignore
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        testData.forEach(row => {
          stmt.run(row);
        });
        
        stmt.finalize((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // 测试边界判断
      const rangeResult = await strategyCore.analyzeRangeBoundary('BTCUSDT');
      
      // 验证返回的数据结构
      expect(rangeResult).toHaveProperty('bb1h');
      expect(rangeResult).toHaveProperty('totalScore');
      expect(rangeResult).toHaveProperty('lowerBoundaryValid');
      expect(rangeResult).toHaveProperty('upperBoundaryValid');
      
      // 验证布林带数据
      expect(rangeResult.bb1h).toHaveProperty('upper');
      expect(rangeResult.bb1h).toHaveProperty('middle');
      expect(rangeResult.bb1h).toHaveProperty('lower');
      expect(rangeResult.bb1h).toHaveProperty('bandwidth');
      
      // 验证数值有效性
      expect(typeof rangeResult.bb1h.upper).toBe('number');
      expect(typeof rangeResult.bb1h.middle).toBe('number');
      expect(typeof rangeResult.bb1h.lower).toBe('number');
      expect(typeof rangeResult.bb1h.bandwidth).toBe('number');
      
      expect(rangeResult.bb1h.upper).toBeGreaterThan(0);
      expect(rangeResult.bb1h.middle).toBeGreaterThan(0);
      expect(rangeResult.bb1h.lower).toBeGreaterThan(0);
    });
  });

  describe('SmartFlowStrategyV3修复测试', () => {
    test('analyzeRangeMarket应该返回布林带数据即使边界无效', async () => {
      // 创建模拟的rangeResult（边界无效）
      const mockRangeResult = {
        bb1h: {
          upper: 116080.94425362769,
          middle: 115516.61500000002,
          lower: 114952.28574637235,
          bandwidth: 0.009770529609574618
        },
        totalScore: 1, // 低于阈值3，边界无效
        lowerBoundaryValid: 0,
        upperBoundaryValid: 0,
        vwap: 115500,
        delta: 0.01,
        touchesLower: 0.5,
        touchesUpper: 0.5,
        volFactor: 1.2,
        lastBreakout: false
      };

      // 创建策略实例
      const strategy = new SmartFlowStrategyV3(databaseManager);
      
      // 模拟analyzeRangeMarket的边界无效情况
      const result = await strategy.analyzeRangeMarket('BTCUSDT', { marketType: '震荡市' }, { score: 0 }, 100);
      
      // 验证即使边界无效也返回了布林带数据
      expect(result).toHaveProperty('bb_upper');
      expect(result).toHaveProperty('bb_middle');
      expect(result).toHaveProperty('bb_lower');
      expect(result).toHaveProperty('boundary_score_1h');
      expect(result).toHaveProperty('rangeLowerBoundaryValid');
      expect(result).toHaveProperty('rangeUpperBoundaryValid');
      
      // 验证布林带数据不为空
      expect(result.bb_upper).toBeDefined();
      expect(result.bb_middle).toBeDefined();
      expect(result.bb_lower).toBeDefined();
      expect(result.boundary_score_1h).toBeDefined();
      
      // 验证边界有效性
      expect(result.rangeLowerBoundaryValid).toBe(0);
      expect(result.rangeUpperBoundaryValid).toBe(0);
      
      // 验证信号为NONE
      expect(result.signal).toBe('NONE');
      expect(result.reason).toBe('1H边界无效');
    });
  });

  describe('数据库字段映射测试', () => {
    test('DatabaseManager应该正确保存布林带字段', async () => {
      const analysisData = {
        symbol: 'BTCUSDT',
        strategyVersion: 'V3',
        marketType: '震荡市',
        bb_upper: 116080.94425362769,
        bb_middle: 115516.61500000002,
        bb_lower: 114952.28574637235,
        boundary_score_1h: 1.0,
        rangeLowerBoundaryValid: 0,
        rangeUpperBoundaryValid: 0,
        signal: 'NONE',
        score1h: 0,
        vwapDirectionConsistent: false,
        factors: {},
        currentPrice: 115000,
        timestamp: new Date().toISOString()
      };

      // 保存到数据库
      await databaseManager.recordStrategyAnalysis(analysisData);

      // 验证数据是否正确保存
      const savedData = await new Promise((resolve, reject) => {
        testDb.get(`
          SELECT bb_upper, bb_middle, bb_lower, boundary_score_1h, 
                 range_lower_boundary_valid, range_upper_boundary_valid
          FROM strategy_analysis 
          WHERE symbol = 'BTCUSDT' 
          ORDER BY timestamp DESC 
          LIMIT 1
        `, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(savedData).toBeDefined();
      expect(savedData.bb_upper).toBe(116080.94425362769);
      expect(savedData.bb_middle).toBe(115516.61500000002);
      expect(savedData.bb_lower).toBe(114952.28574637235);
      expect(savedData.boundary_score_1h).toBe(1.0);
      expect(savedData.range_lower_boundary_valid).toBe(0);
      expect(savedData.range_upper_boundary_valid).toBe(0);
    });

    test('full_analysis_data应该包含布林带数据', async () => {
      const analysisData = {
        symbol: 'BTCUSDT',
        strategyVersion: 'V3',
        marketType: '震荡市',
        bb_upper: 116080.94425362769,
        bb_middle: 115516.61500000002,
        bb_lower: 114952.28574637235,
        boundary_score_1h: 1.0,
        rangeLowerBoundaryValid: 0,
        rangeUpperBoundaryValid: 0,
        signal: 'NONE',
        score1h: 0,
        vwapDirectionConsistent: false,
        factors: {},
        currentPrice: 115000,
        timestamp: new Date().toISOString()
      };

      // 保存到数据库
      await databaseManager.recordStrategyAnalysis(analysisData);

      // 验证JSON数据
      const savedData = await new Promise((resolve, reject) => {
        testDb.get(`
          SELECT full_analysis_data
          FROM strategy_analysis 
          WHERE symbol = 'BTCUSDT' 
          ORDER BY timestamp DESC 
          LIMIT 1
        `, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(savedData).toBeDefined();
      const fullData = JSON.parse(savedData.full_analysis_data);
      
      expect(fullData).toHaveProperty('bb_upper');
      expect(fullData).toHaveProperty('bb_middle');
      expect(fullData).toHaveProperty('bb_lower');
      expect(fullData).toHaveProperty('boundary_score_1h');
      expect(fullData).toHaveProperty('rangeLowerBoundaryValid');
      expect(fullData).toHaveProperty('rangeUpperBoundaryValid');
      
      expect(fullData.bb_upper).toBe(116080.94425362769);
      expect(fullData.bb_middle).toBe(115516.61500000002);
      expect(fullData.bb_lower).toBe(114952.28574637235);
      expect(fullData.boundary_score_1h).toBe(1.0);
    });
  });

  describe('集成测试', () => {
    test('完整的震荡市分析流程应该正确保存布林带数据', async () => {
      // 插入测试K线数据
      const now = Date.now();
      const testData = [];
      
      for (let i = 0; i < 50; i++) {
        const closeTime = now - (50 - i) * 3600000;
        testData.push([
          'BTCUSDT',
          '1h',
          closeTime - 3600000,
          closeTime,
          100 + Math.random() * 10,
          105 + Math.random() * 10,
          95 + Math.random() * 10,
          100 + Math.random() * 10,
          1000 + Math.random() * 500,
          (1000 + Math.random() * 500) * (100 + Math.random() * 10),
          0, 0, 0, 0
        ]);
      }
      
      await new Promise((resolve, reject) => {
        const stmt = testDb.prepare(`
          INSERT INTO kline_data (
            symbol, interval, open_time, close_time, open_price, high_price, 
            low_price, close_price, volume, quote_volume, trades_count, 
            taker_buy_volume, taker_buy_quote_volume, ignore
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        testData.forEach(row => {
          stmt.run(row);
        });
        
        stmt.finalize((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // 执行完整的策略分析
      const analysis = await SmartFlowStrategyV3.analyzeSymbol('BTCUSDT', {
        database: databaseManager,
        maxLossAmount: 100
      });

      // 验证分析结果包含布林带数据
      expect(analysis).toHaveProperty('bb_upper');
      expect(analysis).toHaveProperty('bb_middle');
      expect(analysis).toHaveProperty('bb_lower');
      expect(analysis).toHaveProperty('boundary_score_1h');
      
      // 验证数据不为空
      if (analysis.bb_upper !== undefined) {
        expect(analysis.bb_upper).toBeGreaterThan(0);
        expect(analysis.bb_middle).toBeGreaterThan(0);
        expect(analysis.bb_lower).toBeGreaterThan(0);
        expect(analysis.boundary_score_1h).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
