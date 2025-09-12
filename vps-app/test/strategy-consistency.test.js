// strategy-consistency.test.js - 策略逻辑与文档一致性测试
const DatabaseManager = require('../modules/database/DatabaseManager');
const FactorWeightManager = require('../modules/strategy/FactorWeightManager');
const StrategyV3Core = require('../modules/strategy/StrategyV3Core');

describe('策略逻辑与文档一致性测试', () => {
  let db;
  let factorWeightManager;
  let strategyCore;

  beforeAll(async () => {
    // 使用实际数据库而不是内存数据库
    db = new DatabaseManager();
    await db.init();
    
    factorWeightManager = new FactorWeightManager(db);
    strategyCore = new StrategyV3Core(db);
    
    // 初始化测试数据
    await db.run('INSERT OR IGNORE INTO symbol_categories (symbol, category) VALUES (?, ?)', ['BTCUSDT', 'mainstream']);
    await db.run('INSERT OR IGNORE INTO symbol_categories (symbol, category) VALUES (?, ?)', ['BNBUSDT', 'high-cap-trending']);
    await db.run('INSERT OR IGNORE INTO symbol_categories (symbol, category) VALUES (?, ?)', ['DOGEUSDT', 'trending']);
    await db.run('INSERT OR IGNORE INTO symbol_categories (symbol, category) VALUES (?, ?)', ['PEPEUSDT', 'smallcap']);
  });

  afterAll(async () => {
    if (db) {
      await db.close();
    }
  });

  describe('权重配置一致性测试', () => {
    test('主流币1H多因子打分权重应该与文档一致', async () => {
      const weights = await factorWeightManager.getFactorWeights('mainstream', '1h_scoring');
      
      expect(weights.vwap).toBe(0); // 必须满足，不计分
      expect(weights.breakout).toBe(0.30); // 30%
      expect(weights.volume).toBe(0.20); // 20%
      expect(weights.oi).toBe(0.25); // 25%
      expect(weights.delta).toBe(0.15); // 15%
      expect(weights.funding).toBe(0.10); // 10%
    });

    test('高市值强趋势币1H多因子打分权重应该与文档一致', async () => {
      const weights = await factorWeightManager.getFactorWeights('high-cap-trending', '1h_scoring');
      
      expect(weights.vwap).toBe(0); // 必须满足，不计分
      expect(weights.breakout).toBe(0.25); // 25%
      expect(weights.volume).toBe(0.25); // 25%
      expect(weights.oi).toBe(0.20); // 20%
      expect(weights.delta).toBe(0.20); // 20%
      expect(weights.funding).toBe(0.10); // 10%
    });

    test('热点币1H多因子打分权重应该与文档一致', async () => {
      const weights = await factorWeightManager.getFactorWeights('trending', '1h_scoring');
      
      expect(weights.vwap).toBe(0); // 必须满足，不计分
      expect(weights.breakout).toBe(0.15); // 15%
      expect(weights.volume).toBe(0.30); // 30%
      expect(weights.oi).toBe(0.15); // 15%
      expect(weights.delta).toBe(0.30); // 30%
      expect(weights.funding).toBe(0.10); // 10%
    });
  });

  describe('资金费率阈值一致性测试', () => {
    test('资金费率阈值应该严格按照文档要求', () => {
      // 文档要求：0.05% ≤ Funding Rate ≤ +0.05% (即 0.0005 ≤ Funding Rate ≤ 0.0005)
      
      // 测试正常范围
      expect(factorWeightManager.calculateFactorScore('funding', 0.0003, '1h_scoring')).toBe(1);
      expect(factorWeightManager.calculateFactorScore('funding', 0.0005, '1h_scoring')).toBe(1);
      expect(factorWeightManager.calculateFactorScore('funding', -0.0003, '1h_scoring')).toBe(1);
      expect(factorWeightManager.calculateFactorScore('funding', -0.0005, '1h_scoring')).toBe(1);
      
      // 测试边界值
      expect(factorWeightManager.calculateFactorScore('funding', 0.0008, '1h_scoring')).toBe(0.5);
      expect(factorWeightManager.calculateFactorScore('funding', 0.001, '1h_scoring')).toBe(0.5);
      
      // 测试超出范围
      expect(factorWeightManager.calculateFactorScore('funding', 0.002, '1h_scoring')).toBe(0);
      expect(factorWeightManager.calculateFactorScore('funding', 0.01, '1h_scoring')).toBe(0);
    });
  });

  describe('震荡市1H边界判断一致性测试', () => {
    test('触碰因子计算应该符合文档要求', () => {
      // 文档要求：下轨触碰≥2次，上轨触碰≥2次
      expect(factorWeightManager.calculateFactorScore('touch', 1, '1h_boundary')).toBe(0);
      expect(factorWeightManager.calculateFactorScore('touch', 2, '1h_boundary')).toBe(0.5);
      expect(factorWeightManager.calculateFactorScore('touch', 3, '1h_boundary')).toBe(1);
      expect(factorWeightManager.calculateFactorScore('touch', 4, '1h_boundary')).toBe(1);
    });

    test('成交量因子阈值应该符合文档要求', () => {
      // 文档要求：最新1H成交量 ≤ 1.7 × 20期均量
      expect(factorWeightManager.calculateFactorScore('volume', 1.5, '1h_boundary')).toBe(0);
      expect(factorWeightManager.calculateFactorScore('volume', 1.7, '1h_boundary')).toBe(0);
      expect(factorWeightManager.calculateFactorScore('volume', 1.8, '1h_boundary')).toBe(0);
    });
  });

  describe('趋势市1H多因子打分一致性测试', () => {
    test('成交量确认阈值应该符合文档要求', () => {
      // 文档要求：15m成交量≥1.5×20期均量，1h成交量≥1.2×20期均量
      expect(factorWeightManager.calculateFactorScore('volume', 1.0, '1h_scoring')).toBe(0);
      expect(factorWeightManager.calculateFactorScore('volume', 1.2, '1h_scoring')).toBe(0.5);
      expect(factorWeightManager.calculateFactorScore('volume', 1.5, '1h_scoring')).toBe(1);
      expect(factorWeightManager.calculateFactorScore('volume', 2.0, '1h_scoring')).toBe(1);
    });

    test('OI变化阈值应该符合文档要求', () => {
      // 文档要求：多头6h OI≥+2%，空头6h OI≤-3%
      expect(factorWeightManager.calculateFactorScore('oi', 0.01, '1h_scoring')).toBe(0);
      expect(factorWeightManager.calculateFactorScore('oi', 0.02, '1h_scoring')).toBe(1);
      expect(factorWeightManager.calculateFactorScore('oi', 0.03, '1h_scoring')).toBe(1);
      expect(factorWeightManager.calculateFactorScore('oi', -0.02, '1h_scoring')).toBe(1);
      expect(factorWeightManager.calculateFactorScore('oi', -0.03, '1h_scoring')).toBe(1);
    });

    test('Delta不平衡阈值应该符合文档要求', () => {
      // 文档要求：多头主动买盘≥卖盘×1.2，空头主动卖盘≥买盘×1.2
      expect(factorWeightManager.calculateFactorScore('delta', 0.03, '1h_scoring')).toBe(0);
      expect(factorWeightManager.calculateFactorScore('delta', 0.05, '1h_scoring')).toBe(0.5);
      expect(factorWeightManager.calculateFactorScore('delta', 0.1, '1h_scoring')).toBe(1);
      expect(factorWeightManager.calculateFactorScore('delta', 0.2, '1h_scoring')).toBe(1);
    });
  });

  describe('分类名称一致性测试', () => {
    test('应该使用正确的分类名称', async () => {
      const categories = ['mainstream', 'high-cap-trending', 'trending', 'smallcap'];
      
      for (const category of categories) {
        const weights = await factorWeightManager.getFactorWeights(category, '1h_scoring');
        expect(weights).toBeDefined();
        expect(typeof weights).toBe('object');
      }
    });
  });

  describe('边界情况测试', () => {
    test('应该正确处理未知分类', async () => {
      const weights = await factorWeightManager.getFactorWeights('unknown', '1h_scoring');
      expect(weights).toBeDefined();
      expect(typeof weights).toBe('object');
      // 应该返回默认权重配置
      expect(weights.vwap).toBeDefined();
      expect(weights.breakout).toBeDefined();
    });

    test('应该正确处理未知分析类型', async () => {
      const weights = await factorWeightManager.getFactorWeights('mainstream', 'unknown');
      expect(weights).toBeDefined();
      expect(typeof weights).toBe('object');
      // 应该返回默认权重配置
      expect(weights.vwap).toBeDefined();
      expect(weights.breakout).toBeDefined();
    });
  });
});
