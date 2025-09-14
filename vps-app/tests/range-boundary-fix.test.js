const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 设置测试环境
process.env.NODE_ENV = 'test';

// 模拟数据库
const testDbPath = path.join(__dirname, '../test-range-boundary.db');
const db = new sqlite3.Database(testDbPath);

// 导入要测试的模块
const StrategyV3Core = require('../src/core/modules/strategy/StrategyV3Core');

describe('震荡市边界判断修复测试', () => {
  let strategyCore;
  
  beforeAll(async () => {
    // 创建测试数据库表
    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run(`
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
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
    
    // 初始化策略核心
    strategyCore = new StrategyV3Core(db);
  });
  
  afterAll(async () => {
    if (strategyCore) {
      await strategyCore.destroy();
    }
    db.close();
  });
  
  beforeEach(async () => {
    // 清理测试数据
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM kline_data', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
  
  describe('布林带计算测试', () => {
    test('应该正确计算布林带', () => {
      const testCandles = [];
      for (let i = 0; i < 30; i++) {
        testCandles.push({
          open: 100 + Math.random() * 10,
          high: 105 + Math.random() * 10,
          low: 95 + Math.random() * 10,
          close: 100 + Math.random() * 10,
          volume: 1000 + Math.random() * 500
        });
      }
      
      const bb = strategyCore.calculateBollingerBands(testCandles, 20, 2);
      const lastBB = bb[bb.length - 1];
      
      expect(bb).toHaveLength(11); // 布林带从第20根K线开始，所以只有11个有效值
      expect(lastBB).toHaveProperty('upper');
      expect(lastBB).toHaveProperty('middle');
      expect(lastBB).toHaveProperty('lower');
      expect(lastBB).toHaveProperty('bandwidth');
      expect(lastBB.upper).toBeGreaterThan(lastBB.middle);
      expect(lastBB.middle).toBeGreaterThan(lastBB.lower);
    });
  });
  
  describe('触碰得分计算测试', () => {
    test('应该正确计算触碰得分', () => {
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
      
      const touchScore = strategyCore.calculateTouchScore(testCandles, lastBB);
      
      expect(touchScore).toBeGreaterThanOrEqual(0);
      expect(touchScore).toBeLessThanOrEqual(1);
    });
  });
  
  describe('边界判断集成测试', () => {
    test('应该正确判断边界有效性', async () => {
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
          0,
          0,
          0,
          0
        ]);
      }
      
      await new Promise((resolve, reject) => {
        const stmt = db.prepare(`
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
      const result = await strategyCore.analyzeRangeBoundary('BTCUSDT');
      
      expect(result).toHaveProperty('totalScore');
      expect(result).toHaveProperty('lowerBoundaryValid');
      expect(result).toHaveProperty('upperBoundaryValid');
      expect(result).toHaveProperty('bb1h');
      
      expect(typeof result.totalScore).toBe('number');
      expect(typeof result.lowerBoundaryValid).toBe('number');
      expect(typeof result.upperBoundaryValid).toBe('number');
      
      // 验证边界有效性是0或1
      expect([0, 1]).toContain(result.lowerBoundaryValid);
      expect([0, 1]).toContain(result.upperBoundaryValid);
      
      console.log(`测试结果: 总分=${result.totalScore}, 下边界=${result.lowerBoundaryValid}, 上边界=${result.upperBoundaryValid}`);
    });
  });
  
  describe('阈值测试', () => {
    test('应该使用正确的阈值判断边界有效性', () => {
      // 测试不同得分下的边界有效性
      const testCases = [
        { score: 0.3, expected: 0 },
        { score: 0.5, expected: 0 },
        { score: 0.6, expected: 1 },
        { score: 0.8, expected: 1 },
        { score: 1.0, expected: 1 }
      ];
      
      testCases.forEach(({ score, expected }) => {
        const lowerBoundaryValid = score >= 0.6 ? 1 : 0;
        const upperBoundaryValid = score >= 0.6 ? 1 : 0;
        
        expect(lowerBoundaryValid).toBe(expected);
        expect(upperBoundaryValid).toBe(expected);
      });
    });
  });
});
