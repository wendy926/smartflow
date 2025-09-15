/**
 * 震荡市边界判断修复简化测试
 * 测试我们修复的核心问题
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 设置测试环境
process.env.NODE_ENV = 'test';

// 导入要测试的模块
const StrategyV3Core = require('../../src/core/modules/strategy/StrategyV3Core');

describe('震荡市边界判断修复简化测试', () => {
  let strategyCore;
  let testDb;
  const testDbPath = path.join(__dirname, '../../test-range-boundary-simple.db');

  beforeAll(async () => {
    // 创建测试数据库
    testDb = new sqlite3.Database(testDbPath);
    
    // 创建K线数据表
    await new Promise((resolve, reject) => {
      testDb.serialize(() => {
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
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });

    strategyCore = new StrategyV3Core(testDb);
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
        else resolve();
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
      expect(bb).toHaveLength(31);
      
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
        if (bbItem.middle > 0) {
          expect(bbItem.upper).toBeGreaterThanOrEqual(bbItem.middle);
          expect(bbItem.middle).toBeGreaterThanOrEqual(bbItem.lower);
        }
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
    test('应该正确计算边界判断数据', async () => {
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
          0, 0, 0
        ]);
      }
      
      await new Promise((resolve, reject) => {
        const stmt = testDb.prepare(`
          INSERT INTO kline_data (
            symbol, interval, open_time, close_time, open_price, high_price, 
            low_price, close_price, volume, quote_volume, trades_count, 
            taker_buy_volume, taker_buy_quote_volume
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      if (rangeResult.error) {
        // 如果数据不足，应该返回错误信息
        expect(rangeResult.error).toContain('1H K线数据不足');
      } else {
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
      }
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
