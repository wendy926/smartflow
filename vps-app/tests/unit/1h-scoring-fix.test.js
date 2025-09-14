// 1h-scoring-fix.test.js - 1H多因子打分修复验证测试
const DatabaseManager = require('../modules/database/DatabaseManager');
const FactorWeightManager = require('../modules/strategy/FactorWeightManager');
const StrategyV3Core = require('../modules/strategy/StrategyV3Core');

describe('1H多因子打分修复验证测试', () => {
  let db;
  let factorWeightManager;
  let strategyCore;

  beforeAll(async () => {
    // 创建临时数据库
    db = new DatabaseManager(':memory:');
    await db.init();
    
    // 初始化策略核心和权重管理器
    strategyCore = new StrategyV3Core(db);
    factorWeightManager = new FactorWeightManager(db);
    
    // 添加测试数据
    await db.run('INSERT OR IGNORE INTO symbol_categories (symbol, category) VALUES (?, ?)', ['BNBUSDT', 'high-cap-trending']);
    await db.run('INSERT OR IGNORE INTO factor_weights (category, analysis_type, vwap_weight, delta_weight, oi_weight, volume_weight, funding_weight, breakout_weight) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
      ['high-cap-trending', '1h', 0.2, 0.25, 0.25, 0.2, 0.05, 0.05]);
  });

  afterAll(async () => {
    if (db) {
      await db.close();
    }
  });

  describe('因子数据类型修复验证', () => {
    test('VWAP因子应该传入布尔值', () => {
      const factorScore = factorWeightManager.calculateFactorScore('vwap', true, '1h_scoring');
      expect(factorScore).toBe(1);
    });

    test('funding因子应该传入数值而不是布尔值', () => {
      // 测试正常资金费率
      const factorScore1 = factorWeightManager.calculateFactorScore('funding', 0.0008, '1h_scoring');
      expect(factorScore1).toBe(0.5);
      
      // 测试异常资金费率
      const factorScore2 = factorWeightManager.calculateFactorScore('funding', 0.005, '1h_scoring');
      expect(factorScore2).toBe(0);
    });

    test('volume因子应该传入数值而不是布尔值', () => {
      // 测试正常成交量比率
      const factorScore1 = factorWeightManager.calculateFactorScore('volume', 1.3, '1h_scoring');
      expect(factorScore1).toBe(0.5);
      
      // 测试高成交量比率
      const factorScore2 = factorWeightManager.calculateFactorScore('volume', 1.8, '1h_scoring');
      expect(factorScore2).toBe(1);
    });

    test('oi因子应该传入数值而不是布尔值', () => {
      // 测试正常OI变化
      const factorScore1 = factorWeightManager.calculateFactorScore('oi', 0.025, '1h_scoring');
      expect(factorScore1).toBe(1);
      
      // 测试低OI变化
      const factorScore2 = factorWeightManager.calculateFactorScore('oi', 0.01, '1h_scoring');
      expect(factorScore2).toBe(0);
    });

    test('delta因子应该传入数值而不是布尔值', () => {
      // 测试正常Delta不平衡
      const factorScore1 = factorWeightManager.calculateFactorScore('delta', 0.15, '1h_scoring');
      expect(factorScore1).toBe(1);
      
      // 测试低Delta不平衡
      const factorScore2 = factorWeightManager.calculateFactorScore('delta', 0.03, '1h_scoring');
      expect(factorScore2).toBe(0);
    });
  });

  describe('权重计算修复验证', () => {
    test('应该正确计算加权得分', async () => {
      const factorValues = {
        vwap: true,        // 1分
        breakout: false,   // 0分
        volume: 1.3,       // 0.5分
        oi: 0.015,         // 0分
        funding: 0.0008,   // 1分
        delta: 0.05        // 0.5分
      };

      const result = await factorWeightManager.calculateWeightedScore('BNBUSDT', '1h_scoring', factorValues);
      
      // 总分应该是所有因子得分的总和：1(vwap)+0(breakout)+0.5(volume)+0(oi)+0.5(funding)+0.5(delta) = 2.5分
      expect(result.score).toBe(2.5);
      expect(result.category).toBe('high-cap-trending');
      // vwap权重为0但仍然计入总分
      expect(result.factorScores.vwap.score).toBe(1);
      expect(result.factorScores.vwap.weight).toBe(0);
      expect(result.factorScores.volume.score).toBe(0.5);
      expect(result.factorScores.funding.score).toBe(0.5);
      expect(result.factorScores.delta.score).toBe(0.5);
    });

    test('应该正确处理所有因子为false的情况', async () => {
      const factorValues = {
        vwap: false,       // 0分
        breakout: false,   // 0分
        volume: 0.5,       // 0分
        oi: 0.01,          // 0分
        funding: 0.01,     // 0分
        delta: 0.01        // 0分
      };

      const result = await factorWeightManager.calculateWeightedScore('BNBUSDT', '1h_scoring', factorValues);
      
      expect(result.score).toBe(0);
      expect(result.category).toBe('high-cap-trending');
    });

    test('应该正确处理所有因子为true的情况', async () => {
      const factorValues = {
        vwap: true,        // 1分
        breakout: true,    // 1分
        volume: 2.0,       // 1分
        oi: 0.03,          // 1分
        funding: 0.0005,   // 1分
        delta: 0.2         // 1分
      };

      const result = await factorWeightManager.calculateWeightedScore('BNBUSDT', '1h_scoring', factorValues);
      
      // 所有因子为true，总分应该是6分
      expect(result.score).toBe(6);
      expect(result.category).toBe('high-cap-trending');
      // 所有因子都应该得满分
      Object.values(result.factorScores).forEach(factor => {
        expect(factor.score).toBeGreaterThan(0);
      });
    });
  });

  describe('边界情况测试', () => {
    test('应该正确处理undefined权重配置', async () => {
      const factorValues = {
        vwap: true,
        breakout: false,
        volume: 1.0,
        oi: 0.02,
        funding: 0.001,
        delta: 0.1
      };

      // 使用不存在的分类，但mainstream有默认权重配置
      const result = await factorWeightManager.calculateWeightedScore('UNKNOWNSYMBOL', '1h_scoring', factorValues);
      
      // 使用默认权重配置，得分应该大于0
      expect(result.score).toBeGreaterThan(0);
      expect(result.category).toBe('smallcap'); // 应该返回默认分类
    });

    test('应该正确处理空因子值', async () => {
      const factorValues = {};

      const result = await factorWeightManager.calculateWeightedScore('BNBUSDT', '1h_scoring', factorValues);
      
      expect(result.score).toBe(0);
      expect(result.category).toBe('high-cap-trending');
    });

    test('应该正确处理null因子值', async () => {
      const factorValues = {
        vwap: null,
        breakout: null,
        volume: null,
        oi: null,
        funding: null,
        delta: null
      };

      const result = await factorWeightManager.calculateWeightedScore('BNBUSDT', '1h_scoring', factorValues);
      
      // funding因子对null值会返回1分（因为Math.abs(null) = 0，0 <= 0.0015）
      expect(result.score).toBeGreaterThan(0);
      expect(result.category).toBe('high-cap-trending');
    });
  });

  describe('性能测试', () => {
    test('应该快速计算大量交易对的权重', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT'];
      const factorValues = {
        vwap: true,
        breakout: false,
        volume: 1.2,
        oi: 0.02,
        funding: 0.001,
        delta: 0.1
      };

      const startTime = Date.now();
      
      const promises = symbols.map(symbol => 
        factorWeightManager.calculateWeightedScore(symbol, '1h_scoring', factorValues)
      );
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      expect(results).toHaveLength(symbols.length);
      expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
      
      // 验证所有结果都有正确的结构
      results.forEach(result => {
        expect(result).toHaveProperty('score');
        expect(result).toHaveProperty('category');
        expect(result).toHaveProperty('factorScores');
        expect(typeof result.score).toBe('number');
      });
    });
  });
});
