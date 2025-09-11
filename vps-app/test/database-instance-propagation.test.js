// 数据库实例传递集成测试
const SmartFlowStrategyV3 = require('../modules/strategy/SmartFlowStrategyV3');
const DatabaseManager = require('../modules/database/DatabaseManager');
const FactorWeightManager = require('../modules/strategy/FactorWeightManager');

describe('数据库实例传递集成测试', () => {
  let realDatabase;
  let tempDbPath;

  beforeAll(async () => {
    // 创建临时数据库文件
    tempDbPath = `./test_${Date.now()}.db`;
    realDatabase = new DatabaseManager(tempDbPath);
    await realDatabase.init();
    
    // 插入测试数据
    await realDatabase.runQuery(`
      INSERT OR IGNORE INTO symbol_categories (symbol, category) VALUES 
      ('BTCUSDT', 'mainstream'),
      ('ETHUSDT', 'mainstream'),
      ('ADAUSDT', 'high-cap-trending')
    `);
    
    await realDatabase.runQuery(`
      INSERT OR IGNORE INTO factor_weights (category, analysis_type, vwap_weight, delta_weight, oi_weight, volume_weight, breakout_weight, funding_weight) VALUES 
      ('mainstream', '1h', 0.25, 0.20, 0.20, 0.20, 0.10, 0.05),
      ('mainstream', '15m', 0.30, 0.25, 0.20, 0.15, 0.05, 0.05),
      ('high-cap-trending', '1h', 0.20, 0.25, 0.25, 0.20, 0.05, 0.05),
      ('high-cap-trending', '15m', 0.25, 0.30, 0.25, 0.15, 0.03, 0.02)
    `);
  });

  afterAll(async () => {
    // 清理数据库
    if (realDatabase) {
      await realDatabase.close();
    }
    // 删除临时数据库文件
    const fs = require('fs');
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
  });

  beforeEach(() => {
    // 重置静态属性
    SmartFlowStrategyV3.core = null;
    SmartFlowStrategyV3.execution = null;
    SmartFlowStrategyV3.dataMonitor = null;
  });

  afterEach(() => {
    // 清理静态属性
    SmartFlowStrategyV3.core = null;
    SmartFlowStrategyV3.execution = null;
    SmartFlowStrategyV3.dataMonitor = null;
  });

  describe('数据库实例传递验证', () => {
    test('SmartFlowStrategyV3.init应该正确传递数据库实例', () => {
      // 调用init方法
      SmartFlowStrategyV3.init(realDatabase);

      // 验证core被正确初始化
      expect(SmartFlowStrategyV3.core).toBeDefined();
      expect(SmartFlowStrategyV3.core.database).toBe(realDatabase);

      // 验证execution被正确初始化
      expect(SmartFlowStrategyV3.execution).toBeDefined();
      expect(SmartFlowStrategyV3.execution.database).toBe(realDatabase);

      // 验证dataMonitor被正确初始化
      expect(SmartFlowStrategyV3.dataMonitor).toBeDefined();
      expect(SmartFlowStrategyV3.dataMonitor.database).toBe(realDatabase);
    });

    test('FactorWeightManager应该能够访问数据库实例', () => {
      // 初始化SmartFlowStrategyV3
      SmartFlowStrategyV3.init(realDatabase);

      // 验证core中的FactorWeightManager有数据库实例
      expect(SmartFlowStrategyV3.core.factorWeightManager).toBeDefined();
      expect(SmartFlowStrategyV3.core.factorWeightManager.database).toBe(realDatabase);

      // 验证execution中的FactorWeightManager有数据库实例
      expect(SmartFlowStrategyV3.execution.factorWeightManager).toBeDefined();
      expect(SmartFlowStrategyV3.execution.factorWeightManager.database).toBe(realDatabase);
    });

    test('FactorWeightManager方法应该能够正常工作', async () => {
      // 初始化SmartFlowStrategyV3
      SmartFlowStrategyV3.init(realDatabase);

      // 测试getSymbolCategory方法
      const category = await SmartFlowStrategyV3.core.factorWeightManager.getSymbolCategory('BTCUSDT');
      expect(category).toBeDefined();
      expect(['mainstream', 'high-cap-trending', 'hot', 'small-cap']).toContain(category);

      // 测试getFactorWeights方法
      const weights = await SmartFlowStrategyV3.core.factorWeightManager.getFactorWeights('mainstream', '1h');
      expect(weights).toBeDefined();
      expect(weights).toHaveProperty('vwap');
      expect(weights).toHaveProperty('delta');
      expect(weights).toHaveProperty('oi');
      expect(weights).toHaveProperty('volume');
    });

    test('数据库查询应该能够正常工作', async () => {
      // 初始化SmartFlowStrategyV3
      SmartFlowStrategyV3.init(realDatabase);

      // 测试数据库查询
      const weights = await SmartFlowStrategyV3.core.factorWeightManager.getAllWeights();
      expect(Array.isArray(weights)).toBe(true);
    });
  });

  describe('错误场景测试', () => {
    test('应该处理数据库连接失败的情况', async () => {
      // 创建一个无效的数据库实例
      const invalidDatabase = null;

      // 初始化应该不会抛出错误
      expect(() => {
        SmartFlowStrategyV3.init(invalidDatabase);
      }).not.toThrow();

      // 但是FactorWeightManager方法应该返回默认值
      const category = await SmartFlowStrategyV3.core.factorWeightManager.getSymbolCategory('BTCUSDT');
      expect(category).toBe('mainstream'); // 默认分类
      
      // 测试getFactorWeights也应该返回默认值
      const weights = await SmartFlowStrategyV3.core.factorWeightManager.getFactorWeights('mainstream', '1h_scoring');
      expect(weights).toBeDefined();
      expect(weights).toHaveProperty('vwap');
      expect(weights).toHaveProperty('delta');
    });

    test('应该处理数据库查询错误', async () => {
      // 创建一个会抛出错误的数据库mock
      const errorDatabase = {
        getSymbolCategory: jest.fn().mockRejectedValue(new Error('Database query failed')),
        getAllSymbolCategories: jest.fn().mockRejectedValue(new Error('Database query failed')),
        getFactorWeights: jest.fn().mockRejectedValue(new Error('Database query failed')),
        getAllFactorWeights: jest.fn().mockRejectedValue(new Error('Database query failed'))
      };

      SmartFlowStrategyV3.init(errorDatabase);

      // FactorWeightManager应该处理数据库错误
      const category = await SmartFlowStrategyV3.core.factorWeightManager.getSymbolCategory('BTCUSDT');
      expect(category).toBe('mainstream'); // 应该返回默认值而不是抛出错误
      
      // 测试getFactorWeights也应该返回默认值
      const weights = await SmartFlowStrategyV3.core.factorWeightManager.getFactorWeights('mainstream', '1h_scoring');
      expect(weights).toBeDefined();
      expect(weights).toHaveProperty('vwap');
    });
  });
});
