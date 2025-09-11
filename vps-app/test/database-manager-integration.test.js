/**
 * DatabaseManager集成测试 - 测试真实的数据库方法调用
 */

const DatabaseManager = require('../modules/database/DatabaseManager');
const path = require('path');
const fs = require('fs');

describe('DatabaseManager集成测试', () => {
  let dbManager;
  let testDbPath;

  beforeAll(async () => {
    // 创建测试数据库
    testDbPath = path.join(__dirname, 'test-database.db');
    
    // 删除可能存在的测试数据库
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    dbManager = new DatabaseManager(testDbPath);
    await dbManager.init();
  });

  afterAll(async () => {
    if (dbManager) {
      await dbManager.close();
    }
    
    // 清理测试数据库
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('交易对分类相关方法', () => {
    test('getSymbolCategory应该正确工作', async () => {
      // 先插入测试数据
      await dbManager.run(`
        INSERT INTO symbol_categories (symbol, category, description, created_at)
        VALUES ('BTCUSDT', 'mainstream', '主流币', datetime('now'))
      `);

      const result = await dbManager.getSymbolCategory('BTCUSDT');
      
      expect(result).toBeDefined();
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.category).toBe('mainstream');
    });

    test('getSymbolCategory应该返回null当交易对不存在时', async () => {
      const result = await dbManager.getSymbolCategory('NONEXISTENT');
      expect(result).toBeNull();
    });

    test('getAllSymbolCategories应该正确工作', async () => {
      // 插入更多测试数据
      await dbManager.run(`
        INSERT INTO symbol_categories (symbol, category, description, created_at)
        VALUES ('ETHUSDT', 'mainstream', '主流币', datetime('now'))
      `);

      const results = await dbManager.getAllSymbolCategories();
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      const btcResult = results.find(r => r.symbol === 'BTCUSDT');
      expect(btcResult).toBeDefined();
      expect(btcResult.category).toBe('mainstream');
    });
  });

  describe('多因子权重相关方法', () => {
    test('getFactorWeights应该正确工作', async () => {
      // 先插入测试数据
      await dbManager.run(`
        INSERT INTO factor_weights (category, analysis_type, vwap_weight, delta_weight, oi_weight, volume_weight, created_at)
        VALUES ('mainstream', '15m_execution', 0.3, 0.3, 0.2, 0.2, datetime('now'))
      `);

      const result = await dbManager.getFactorWeights('mainstream', '15m_execution');
      
      expect(result).toBeDefined();
      expect(result.category).toBe('mainstream');
      expect(result.analysis_type).toBe('15m_execution');
      expect(result.vwap_weight).toBe(0.3);
    });

    test('getFactorWeights应该返回null当配置不存在时', async () => {
      const result = await dbManager.getFactorWeights('nonexistent', '15m_execution');
      expect(result).toBeNull();
    });

    test('getAllFactorWeights应该正确工作', async () => {
      // 插入更多测试数据
      await dbManager.run(`
        INSERT INTO factor_weights (category, analysis_type, vwap_weight, delta_weight, oi_weight, volume_weight, created_at)
        VALUES ('trending', '15m_execution', 0.4, 0.2, 0.2, 0.2, datetime('now'))
      `);

      const results = await dbManager.getAllFactorWeights();
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      const mainstreamResult = results.find(r => r.category === 'mainstream');
      expect(mainstreamResult).toBeDefined();
    });
  });

  describe('策略分析记录方法', () => {
    test('recordStrategyAnalysis应该正确工作', async () => {
      const analysisData = {
        symbol: 'BTCUSDT',
        category: 'mainstream',
        trend4h: '多头趋势',
        marketType: '趋势市',
        signal: 'LONG',
        execution: '做多_多头回踩突破',
        executionMode: '多头回踩突破',
        currentPrice: 50000,
        dataCollectionRate: 100,
        strategyVersion: 'V3'
      };

      const result = await dbManager.recordStrategyAnalysis(analysisData);
      
      expect(result).toBeDefined();
      expect(result.changes).toBeGreaterThan(0);
    });

    test('recordStrategyAnalysis应该处理category字段', async () => {
      const analysisData = {
        symbol: 'ETHUSDT',
        category: 'mainstream',
        trend4h: '震荡市',
        marketType: '震荡市',
        signal: 'NONE',
        execution: 'NONE',
        executionMode: 'NONE',
        currentPrice: 3000,
        dataCollectionRate: 100,
        strategyVersion: 'V3'
      };

      const result = await dbManager.recordStrategyAnalysis(analysisData);
      
      expect(result).toBeDefined();
      expect(result.changes).toBeGreaterThan(0);

      // 验证数据是否正确插入
      const inserted = await dbManager.runQuery(
        'SELECT * FROM strategy_analysis WHERE symbol = ? ORDER BY timestamp DESC LIMIT 1',
        ['ETHUSDT']
      );
      
      expect(inserted.length).toBe(1);
      expect(inserted[0].category).toBe('mainstream');
    });
  });

  describe('数据库表结构验证', () => {
    test('strategy_analysis表应该有category字段', async () => {
      const columns = await dbManager.runQuery(`
        PRAGMA table_info(strategy_analysis)
      `);
      
      const categoryColumn = columns.find(col => col.name === 'category');
      expect(categoryColumn).toBeDefined();
      expect(categoryColumn.type).toBe('TEXT');
    });

    test('symbol_categories表应该存在', async () => {
      const tables = await dbManager.runQuery(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='symbol_categories'
      `);
      
      expect(tables.length).toBe(1);
    });

    test('factor_weights表应该存在', async () => {
      const tables = await dbManager.runQuery(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='factor_weights'
      `);
      
      expect(tables.length).toBe(1);
    });
  });

  describe('错误处理', () => {
    test('应该正确处理数据库连接错误', async () => {
      // 关闭数据库连接
      await dbManager.close();
      
      // 尝试执行查询应该抛出错误
      await expect(dbManager.getSymbolCategory('BTCUSDT')).rejects.toThrow();
    });
  });
});
