/**
 * 权重分配逻辑测试
 * 测试不同交易对分类的权重分配和计算逻辑
 */

const FactorWeightManager = require('../modules/strategy/FactorWeightManager');
const DatabaseManager = require('../modules/database/DatabaseManager');

describe('权重分配逻辑测试', () => {
  let factorWeightManager;
  let database;

  beforeAll(async () => {
    database = new DatabaseManager();
    factorWeightManager = new FactorWeightManager(database);
  });

  afterAll(async () => {
    if (database) {
      await database.close();
    }
  });

  describe('趋势市1H多因子打分权重测试', () => {
    test('主流币权重分配应该符合文档要求', async () => {
      const factorValues = {
        vwap: true,
        breakout: true,
        volume: 1.5,
        oi: 0.025,
        delta: 0.15,
        funding: 0.0003
      };

      const result = await factorWeightManager.calculateWeightedScore('BTCUSDT', '1h_scoring', factorValues);
      
      expect(result).toBeDefined();
      expect(result.category).toBe('mainstream');
      expect(result.score).toBeGreaterThan(0);
      expect(result.factorScores).toBeDefined();
      
      // 验证VWAP权重为0但计入总分
      expect(result.factorScores.vwap).toBeDefined();
      expect(result.factorScores.vwap.weight).toBe(0);
      expect(result.factorScores.vwap.score).toBe(1);
      
      // 验证其他因子权重
      expect(result.factorScores.breakout.weight).toBe(0.30);
      expect(result.factorScores.volume.weight).toBe(0.20);
      expect(result.factorScores.oi.weight).toBe(0.25);
      expect(result.factorScores.delta.weight).toBe(0.15);
      expect(result.factorScores.funding.weight).toBe(0.10);
    });

    test('高市值强趋势币权重分配应该符合文档要求', async () => {
      const factorValues = {
        vwap: true,
        breakout: true,
        volume: 1.5,
        oi: 0.025,
        delta: 0.15,
        funding: 0.0003
      };

      const result = await factorWeightManager.calculateWeightedScore('BNBUSDT', '1h_scoring', factorValues);
      
      expect(result).toBeDefined();
      expect(result.category).toBe('high-cap-trending');
      expect(result.score).toBeGreaterThan(0);
      
      // 验证权重分配
      expect(result.factorScores.breakout.weight).toBe(0.25);
      expect(result.factorScores.volume.weight).toBe(0.25);
      expect(result.factorScores.oi.weight).toBe(0.20);
      expect(result.factorScores.delta.weight).toBe(0.20);
      expect(result.factorScores.funding.weight).toBe(0.10);
    });

    test('热点币权重分配应该符合文档要求', async () => {
      const factorValues = {
        vwap: true,
        breakout: true,
        volume: 1.5,
        oi: 0.025,
        delta: 0.15,
        funding: 0.0003
      };

      const result = await factorWeightManager.calculateWeightedScore('PEPEUSDT', '1h_scoring', factorValues);
      
      expect(result).toBeDefined();
      expect(result.category).toBe('trending');
      expect(result.score).toBeGreaterThan(0);
      
      // 验证权重分配
      expect(result.factorScores.breakout.weight).toBe(0.15);
      expect(result.factorScores.volume.weight).toBe(0.30);
      expect(result.factorScores.oi.weight).toBe(0.15);
      expect(result.factorScores.delta.weight).toBe(0.30);
      expect(result.factorScores.funding.weight).toBe(0.10);
    });

    test('小币权重分配应该符合文档要求', async () => {
      const factorValues = {
        vwap: true,
        breakout: true,
        volume: 1.5,
        oi: 0.025,
        delta: 0.15,
        funding: 0.0003
      };

      const result = await factorWeightManager.calculateWeightedScore('UNKNOWNUSDT', '1h_scoring', factorValues);
      
      expect(result).toBeDefined();
      expect(result.category).toBe('smallcap');
      expect(result.score).toBeGreaterThan(0);
      
      // 验证权重分配
      expect(result.factorScores.breakout.weight).toBe(0.15);
      expect(result.factorScores.volume.weight).toBe(0.30);
      expect(result.factorScores.oi.weight).toBe(0.15);
      expect(result.factorScores.delta.weight).toBe(0.30);
      expect(result.factorScores.funding.weight).toBe(0.10);
    });
  });

  describe('震荡市1H边界确认权重测试', () => {
    test('主流币1H边界权重分配应该符合文档要求', async () => {
      const factorValues = {
        vwap: true,
        touch: 2,
        volume: 1.2,
        delta: 0.01,
        oi: 0.01,
        no_breakout: true
      };

      const result = await factorWeightManager.calculateWeightedScore('BTCUSDT', '1h_boundary', factorValues);
      
      expect(result).toBeDefined();
      expect(result.category).toBe('mainstream');
      expect(result.score).toBeGreaterThan(0);
      
      // 验证权重分配
      expect(result.factorScores.vwap.weight).toBe(0.20);
      expect(result.factorScores.touch.weight).toBe(0.30);
      expect(result.factorScores.volume.weight).toBe(0.20);
      expect(result.factorScores.delta.weight).toBe(0.15);
      expect(result.factorScores.oi.weight).toBe(0.10);
      expect(result.factorScores.no_breakout.weight).toBe(0.05);
    });

    test('高市值趋势币1H边界权重分配应该符合文档要求', async () => {
      const factorValues = {
        vwap: true,
        touch: 2,
        volume: 1.2,
        delta: 0.01,
        oi: 0.01,
        no_breakout: false
      };

      const result = await factorWeightManager.calculateWeightedScore('BNBUSDT', '1h_boundary', factorValues);
      
      expect(result).toBeDefined();
      expect(result.category).toBe('high-cap-trending');
      expect(result.score).toBeGreaterThan(0);
      
      // 验证权重分配
      expect(result.factorScores.vwap.weight).toBe(0.20);
      expect(result.factorScores.touch.weight).toBe(0.30);
      expect(result.factorScores.volume.weight).toBe(0.25);
      expect(result.factorScores.delta.weight).toBe(0.15);
      expect(result.factorScores.oi.weight).toBe(0.10);
      expect(result.factorScores.no_breakout.weight).toBe(0);
    });

    test('热点币1H边界权重分配应该符合文档要求', async () => {
      const factorValues = {
        vwap: true,
        touch: 2,
        volume: 1.2,
        delta: 0.01,
        oi: 0.01,
        no_breakout: false
      };

      const result = await factorWeightManager.calculateWeightedScore('PEPEUSDT', '1h_boundary', factorValues);
      
      expect(result).toBeDefined();
      expect(result.category).toBe('trending');
      expect(result.score).toBeGreaterThan(0);
      
      // 验证权重分配
      expect(result.factorScores.vwap.weight).toBe(0.10);
      expect(result.factorScores.touch.weight).toBe(0.25);
      expect(result.factorScores.volume.weight).toBe(0.30);
      expect(result.factorScores.delta.weight).toBe(0.25);
      expect(result.factorScores.oi.weight).toBe(0.10);
      expect(result.factorScores.no_breakout.weight).toBe(0);
    });
  });

  describe('震荡市15分钟入场执行权重测试', () => {
    test('主流币15分钟入场权重分配应该符合文档要求', async () => {
      const factorValues = {
        vwap: 1,
        delta: 0.1,
        oi: 0.02,
        volume: 1.3
      };

      const result = await factorWeightManager.calculateWeightedScore('BTCUSDT', '15m_execution', factorValues);
      
      expect(result).toBeDefined();
      expect(result.category).toBe('mainstream');
      expect(result.score).toBeGreaterThan(0);
      
      // 验证权重分配
      expect(result.factorScores.vwap.weight).toBe(0.30);
      expect(result.factorScores.delta.weight).toBe(0.30);
      expect(result.factorScores.oi.weight).toBe(0.20);
      expect(result.factorScores.volume.weight).toBe(0.20);
    });

    test('高市值趋势币15分钟入场权重分配应该符合文档要求', async () => {
      const factorValues = {
        vwap: 1,
        delta: 0.1,
        oi: 0.02,
        volume: 1.3
      };

      const result = await factorWeightManager.calculateWeightedScore('BNBUSDT', '15m_execution', factorValues);
      
      expect(result).toBeDefined();
      expect(result.category).toBe('high-cap-trending');
      expect(result.score).toBeGreaterThan(0);
      
      // 验证权重分配
      expect(result.factorScores.vwap.weight).toBe(0.20);
      expect(result.factorScores.delta.weight).toBe(0.30);
      expect(result.factorScores.oi.weight).toBe(0.30);
      expect(result.factorScores.volume.weight).toBe(0.20);
    });

    test('热点币15分钟入场权重分配应该符合文档要求', async () => {
      const factorValues = {
        vwap: 1,
        delta: 0.1,
        oi: 0.02,
        volume: 1.3
      };

      const result = await factorWeightManager.calculateWeightedScore('PEPEUSDT', '15m_execution', factorValues);
      
      expect(result).toBeDefined();
      expect(result.category).toBe('trending');
      expect(result.score).toBeGreaterThan(0);
      
      // 验证权重分配
      expect(result.factorScores.vwap.weight).toBe(0.20);
      expect(result.factorScores.delta.weight).toBe(0.20);
      expect(result.factorScores.oi.weight).toBe(0.20);
      expect(result.factorScores.volume.weight).toBe(0.40);
    });

    test('小币15分钟入场权重分配应该符合文档要求', async () => {
      const factorValues = {
        vwap: 1,
        delta: 0.1,
        oi: 0.02,
        volume: 1.3
      };

      const result = await factorWeightManager.calculateWeightedScore('UNKNOWNUSDT', '15m_execution', factorValues);
      
      expect(result).toBeDefined();
      expect(result.category).toBe('smallcap');
      expect(result.score).toBeGreaterThan(0);
      
      // 验证权重分配
      expect(result.factorScores.vwap.weight).toBe(0.10);
      expect(result.factorScores.delta.weight).toBe(0.20);
      expect(result.factorScores.oi.weight).toBe(0.20);
      expect(result.factorScores.volume.weight).toBe(0.50);
    });
  });

  describe('权重计算逻辑验证', () => {
    test('所有权重总和应该为1', async () => {
      const analysisTypes = ['1h_scoring', '1h_boundary', '15m_execution'];
      const categories = ['mainstream', 'high-cap-trending', 'trending', 'smallcap'];

      for (const analysisType of analysisTypes) {
        for (const category of categories) {
          const weights = factorWeightManager.getDefaultWeights()[analysisType][category];
          const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
          
          expect(totalWeight).toBeCloseTo(1, 2);
        }
      }
    });

    test('VWAP在趋势市1H打分中权重应该为0', async () => {
      const weights = factorWeightManager.getDefaultWeights()['1h_scoring'];
      
      Object.values(weights).forEach(categoryWeights => {
        expect(categoryWeights.vwap).toBe(0);
      });
    });

    test('VWAP在震荡市分析中应该有非零权重', async () => {
      const boundaryWeights = factorWeightManager.getDefaultWeights()['1h_boundary'];
      const executionWeights = factorWeightManager.getDefaultWeights()['15m_execution'];
      
      Object.values(boundaryWeights).forEach(categoryWeights => {
        expect(categoryWeights.vwap).toBeGreaterThan(0);
      });
      
      Object.values(executionWeights).forEach(categoryWeights => {
        expect(categoryWeights.vwap).toBeGreaterThan(0);
      });
    });

    test('无突破因子只在主流币1H边界中有权重', async () => {
      const boundaryWeights = factorWeightManager.getDefaultWeights()['1h_boundary'];
      
      expect(boundaryWeights.mainstream.no_breakout).toBe(0.05);
      expect(boundaryWeights['high-cap-trending'].no_breakout).toBe(0);
      expect(boundaryWeights.trending.no_breakout).toBe(0);
      expect(boundaryWeights.smallcap.no_breakout).toBe(0);
    });
  });

  describe('因子得分计算测试', () => {
    test('应该正确计算成交量因子得分', () => {
      // 趋势市1H打分：高成交量更好
      const score1 = factorWeightManager.calculateFactorScore('volume', 1.5, '1h_scoring');
      expect(score1).toBe(1);
      
      const score2 = factorWeightManager.calculateFactorScore('volume', 1.2, '1h_scoring');
      expect(score2).toBe(0.5);
      
      const score3 = factorWeightManager.calculateFactorScore('volume', 1.0, '1h_scoring');
      expect(score3).toBe(0);
      
      // 震荡市1H边界：低成交量更好
      const score4 = factorWeightManager.calculateFactorScore('volume', 1.0, '1h_boundary');
      expect(score4).toBe(1);
      
      const score5 = factorWeightManager.calculateFactorScore('volume', 1.2, '1h_boundary');
      expect(score5).toBe(0.5);
      
      const score6 = factorWeightManager.calculateFactorScore('volume', 1.5, '1h_boundary');
      expect(score6).toBe(0);
    });

    test('应该正确计算资金费率因子得分', () => {
      const score1 = factorWeightManager.calculateFactorScore('funding', 0.0003, '1h_scoring');
      expect(score1).toBe(1);
      
      const score2 = factorWeightManager.calculateFactorScore('funding', 0.0008, '1h_scoring');
      expect(score2).toBe(0.5);
      
      const score3 = factorWeightManager.calculateFactorScore('funding', 0.002, '1h_scoring');
      expect(score3).toBe(0);
    });

    test('应该正确计算Delta因子得分', () => {
      const score1 = factorWeightManager.calculateFactorScore('delta', 0.15, '1h_scoring');
      expect(score1).toBe(1);
      
      const score2 = factorWeightManager.calculateFactorScore('delta', 0.05, '1h_scoring');
      expect(score2).toBe(0.5);
      
      const score3 = factorWeightManager.calculateFactorScore('delta', 0.02, '1h_scoring');
      expect(score3).toBe(0);
    });
  });
});
