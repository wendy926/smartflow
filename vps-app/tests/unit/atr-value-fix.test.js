/**
 * ATR值修复测试
 * 测试模拟交易记录中ATR值的计算和保存
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 设置测试环境
process.env.NODE_ENV = 'test';

// 导入要测试的模块
const SmartFlowStrategyV3 = require('../../src/core/modules/strategy/SmartFlowStrategyV3');
const SimulationManager = require('../../src/core/modules/database/SimulationManager');

describe('ATR值修复测试', () => {
  let simulationManager;
  let testDb;
  const testDbPath = path.join(__dirname, '../../test-atr-fix.db');

  beforeAll(async () => {
    // 创建测试数据库
    testDb = new sqlite3.Database(testDbPath);
    
    // 创建模拟交易表
    await new Promise((resolve, reject) => {
      testDb.serialize(() => {
        testDb.run(`
          CREATE TABLE IF NOT EXISTS simulations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            entry_price REAL NOT NULL,
            stop_loss_price REAL NOT NULL,
            take_profit_price REAL,
            atr_value REAL,
            atr14 REAL,
            leverage REAL,
            position_size REAL,
            max_loss_amount REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });

    simulationManager = new SimulationManager(testDb);
  });

  afterAll(async () => {
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
      testDb.run('DELETE FROM simulations', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  describe('calculateLeverageData ATR计算测试', () => {
    test('应该正确计算ATR值', () => {
      const mockKlineData = [];
      for (let i = 0; i < 20; i++) {
        mockKlineData.push({
          high: 100 + i * 0.1,
          low: 95 + i * 0.1,
          close: 98 + i * 0.1
        });
      }

      const leverageData = SmartFlowStrategyV3.calculateLeverageData(
        mockKlineData,
        100, // entryPrice
        95,  // stopLossPrice
        105  // takeProfitPrice
      );

      expect(leverageData).toHaveProperty('atrValue');
      expect(leverageData).toHaveProperty('atr14');
      expect(leverageData).toHaveProperty('maxLeverage');
      expect(leverageData).toHaveProperty('minMargin');
      expect(leverageData).toHaveProperty('stopLossDistance');

      // 验证ATR值有效性
      expect(leverageData.atrValue).toBeGreaterThan(0);
      expect(leverageData.atr14).toBeGreaterThan(0);
      expect(typeof leverageData.atrValue).toBe('number');
      expect(typeof leverageData.atr14).toBe('number');
    });

    test('应该处理ATR14为null的情况', () => {
      const mockKlineData = [];
      for (let i = 0; i < 5; i++) { // 数据不足，ATR14可能为null
        mockKlineData.push({
          high: 100 + i * 0.1,
          low: 95 + i * 0.1,
          close: 98 + i * 0.1
        });
      }

      const leverageData = SmartFlowStrategyV3.calculateLeverageData(
        mockKlineData,
        100, // entryPrice
        95,  // stopLossPrice
        105  // takeProfitPrice
      );

      // 即使ATR14为null，也应该有默认值
      expect(leverageData.atrValue).toBeGreaterThan(0);
      expect(leverageData.atr14).toBeGreaterThan(0);
    });

    test('应该处理ATR14为0的情况', () => {
      const mockKlineData = [];
      for (let i = 0; i < 20; i++) {
        // 创建价格变化很小的数据，可能导致ATR接近0
        mockKlineData.push({
          high: 100,
          low: 99.99,
          close: 100
        });
      }

      const leverageData = SmartFlowStrategyV3.calculateLeverageData(
        mockKlineData,
        100, // entryPrice
        95,  // stopLossPrice
        105  // takeProfitPrice
      );

      // 即使ATR14为0，也应该有默认值
      expect(leverageData.atrValue).toBeGreaterThan(0);
      expect(leverageData.atr14).toBeGreaterThan(0);
    });
  });

  describe('SimulationManager ATR保存测试', () => {
    test('应该正确保存ATR值到数据库', async () => {
      const simulationData = {
        symbol: 'BTCUSDT',
        entryPrice: 50000,
        stopLossPrice: 48000,
        takeProfitPrice: 52000,
        atrValue: 1000,
        atr14: 950,
        leverage: 10,
        positionSize: 0.1,
        maxLossAmount: 100
      };

      const simulationId = await simulationManager.createSimulation(simulationData);

      expect(simulationId).toBeGreaterThan(0);

      // 验证数据是否正确保存
      const savedData = await new Promise((resolve, reject) => {
        testDb.get(`
          SELECT atr_value, atr14, entry_price, stop_loss_price
          FROM simulations 
          WHERE id = ?
        `, [simulationId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(savedData).toBeDefined();
      expect(savedData.atr_value).toBe(1000);
      expect(savedData.atr14).toBe(950);
      expect(savedData.entry_price).toBe(50000);
      expect(savedData.stop_loss_price).toBe(48000);
    });

    test('应该处理ATR值为null的情况', async () => {
      const simulationData = {
        symbol: 'BTCUSDT',
        entryPrice: 50000,
        stopLossPrice: 48000,
        takeProfitPrice: 52000,
        atrValue: null,
        atr14: null,
        leverage: 10,
        positionSize: 0.1,
        maxLossAmount: 100
      };

      const simulationId = await simulationManager.createSimulation(simulationData);

      expect(simulationId).toBeGreaterThan(0);

      // 验证数据是否正确保存
      const savedData = await new Promise((resolve, reject) => {
        testDb.get(`
          SELECT atr_value, atr14
          FROM simulations 
          WHERE id = ?
        `, [simulationId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(savedData).toBeDefined();
      expect(savedData.atr_value).toBeNull();
      expect(savedData.atr14).toBeNull();
    });
  });

  describe('ATR值修复脚本测试', () => {
    test('应该能够修复缺失的ATR值', async () => {
      // 先插入一些缺失ATR值的记录
      await new Promise((resolve, reject) => {
        const stmt = testDb.prepare(`
          INSERT INTO simulations (symbol, entry_price, stop_loss_price, atr_value, atr14)
          VALUES (?, ?, ?, ?, ?)
        `);
        
        stmt.run(['BTCUSDT', 50000, 48000, null, null]);
        stmt.run(['ETHUSDT', 3000, 2800, 0, 0]);
        stmt.run(['ADAUSDT', 0.5, 0.45, '', '']);
        
        stmt.finalize((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // 模拟修复脚本的逻辑
      const rows = await new Promise((resolve, reject) => {
        testDb.all(`
          SELECT id, symbol, entry_price, stop_loss_price, atr_value, atr14
          FROM simulations
          WHERE atr_value IS NULL OR atr14 IS NULL OR atr_value = '' OR atr14 = '' OR atr_value = 0 OR atr14 = 0
        `, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(rows).toHaveLength(3);

      // 修复ATR值
      for (const row of rows) {
        const { id, symbol, entry_price, stop_loss_price } = row;

        if (entry_price && stop_loss_price) {
          // 计算止损距离
          const stopLossDistance = Math.abs(entry_price - stop_loss_price) / entry_price;
          // 使用止损距离的1/3作为ATR值的近似值
          const estimatedAtr = entry_price * stopLossDistance / 3;

          if (estimatedAtr > 0) {
            await new Promise((resolve, reject) => {
              testDb.run(`
                UPDATE simulations
                SET atr_value = ?, atr14 = ?
                WHERE id = ?
              `, [estimatedAtr, estimatedAtr, id], function(err) {
                if (err) reject(err);
                else resolve();
              });
            });
          }
        }
      }

      // 验证修复结果
      const fixedRows = await new Promise((resolve, reject) => {
        testDb.all(`
          SELECT id, symbol, atr_value, atr14
          FROM simulations
          ORDER BY id
        `, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(fixedRows).toHaveLength(3);
      
      fixedRows.forEach(row => {
        expect(row.atr_value).toBeGreaterThan(0);
        expect(row.atr14).toBeGreaterThan(0);
        expect(typeof row.atr_value).toBe('number');
        expect(typeof row.atr14).toBe('number');
      });
    });
  });

  describe('集成测试', () => {
    test('完整的模拟交易创建流程应该包含ATR值', async () => {
      const mockKlineData = [];
      for (let i = 0; i < 20; i++) {
        mockKlineData.push({
          high: 100 + i * 0.1,
          low: 95 + i * 0.1,
          close: 98 + i * 0.1
        });
      }

      // 计算杠杆数据（包含ATR）
      const leverageData = SmartFlowStrategyV3.calculateLeverageData(
        mockKlineData,
        50000, // entryPrice
        48000, // stopLossPrice
        52000  // takeProfitPrice
      );

      // 创建模拟交易记录
      const simulationData = {
        symbol: 'BTCUSDT',
        entryPrice: 50000,
        stopLossPrice: 48000,
        takeProfitPrice: 52000,
        atrValue: leverageData.atrValue,
        atr14: leverageData.atr14,
        leverage: leverageData.maxLeverage,
        positionSize: 0.1,
        maxLossAmount: 100
      };

      const simulationId = await simulationManager.createSimulation(simulationData);

      expect(simulationId).toBeGreaterThan(0);

      // 验证ATR值是否正确保存
      const savedData = await new Promise((resolve, reject) => {
        testDb.get(`
          SELECT atr_value, atr14, entry_price, stop_loss_price
          FROM simulations 
          WHERE id = ?
        `, [simulationId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(savedData).toBeDefined();
      expect(savedData.atr_value).toBe(leverageData.atrValue);
      expect(savedData.atr14).toBe(leverageData.atr14);
      expect(savedData.atr_value).toBeGreaterThan(0);
      expect(savedData.atr14).toBeGreaterThan(0);
    });
  });
});
