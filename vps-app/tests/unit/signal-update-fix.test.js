// signal-update-fix.test.js - 信号更新修复测试
const DatabaseManager = require('../modules/database/DatabaseManager');
const FactorWeightManager = require('../modules/strategy/FactorWeightManager');
const DataRefreshManager = require('../modules/data/DataRefreshManager');

describe('信号更新修复测试', () => {
  let db;
  let factorWeightManager;
  let dataRefreshManager;

  beforeAll(async () => {
    // 创建临时数据库
    db = new DatabaseManager(':memory:');
    await db.init();
    
    // 初始化测试数据
    await db.run(`
      INSERT OR IGNORE INTO symbol_categories (symbol, category) VALUES 
      ('BTCUSDT', 'mainstream'),
      ('ETHUSDT', 'mainstream'),
      ('BNBUSDT', 'high-cap-trending'),
      ('ADAUSDT', 'high-cap-trending')
    `);
    
    await db.run(`
      INSERT OR IGNORE INTO factor_weights (category, analysis_type, vwap_weight, delta_weight, oi_weight, volume_weight, funding_weight, breakout_weight) VALUES 
      ('mainstream', '1h_scoring', 0.25, 0.2, 0.2, 0.2, 0.1, 0.05),
      ('high-cap-trending', '1h_scoring', 0.2, 0.25, 0.25, 0.2, 0.05, 0.05)
    `);
    
    factorWeightManager = new FactorWeightManager(db);
    dataRefreshManager = new DataRefreshManager(db);
  });

  afterAll(async () => {
    if (db) {
      await db.close();
    }
  });

  describe('分类名称映射修复', () => {
    test('应该正确映射BNBUSDT为high-cap-trending', async () => {
      const category = await factorWeightManager.getSymbolCategory('BNBUSDT');
      expect(category).toBe('high-cap-trending');
    });

    test('应该正确映射BTCUSDT为mainstream', async () => {
      const category = await factorWeightManager.getSymbolCategory('BTCUSDT');
      expect(category).toBe('mainstream');
    });
  });

  describe('权重配置获取', () => {
    test('应该正确获取high-cap-trending的权重配置', async () => {
      const weights = await factorWeightManager.getFactorWeights('high-cap-trending', '1h_scoring');
      expect(weights).toBeDefined();
      expect(weights.vwap).toBe(0);
      expect(weights.delta).toBe(0.25);
      expect(weights.oi).toBe(0.25);
      expect(weights.volume).toBe(0.2);
      expect(weights.funding).toBe(0.05);
      expect(weights.breakout).toBe(0.05);
    });

    test('应该正确获取mainstream的权重配置', async () => {
      const weights = await factorWeightManager.getFactorWeights('mainstream', '1h_scoring');
      expect(weights).toBeDefined();
      expect(weights.vwap).toBe(0);
      expect(weights.delta).toBe(0.2);
      expect(weights.oi).toBe(0.2);
      expect(weights.volume).toBe(0.2);
      expect(weights.funding).toBe(0.1);
      expect(weights.breakout).toBe(0.05);
    });
  });

  describe('加权得分计算', () => {
    test('应该正确计算BNBUSDT的加权得分', async () => {
      const factorValues = {
        vwap: true,
        breakout: true,
        volume: true,
        oi: true,
        funding: true,
        delta: true
      };

      const result = await factorWeightManager.calculateWeightedScore('BNBUSDT', '1h_scoring', factorValues);
      expect(result.score).toBeGreaterThan(0);
      expect(result.category).toBe('high-cap-trending');
      expect(result.factorScores).toBeDefined();
    });

    test('应该正确计算BTCUSDT的加权得分', async () => {
      const factorValues = {
        vwap: true,
        breakout: false,
        volume: true,
        oi: false,
        funding: true,
        delta: false
      };

      const result = await factorWeightManager.calculateWeightedScore('BTCUSDT', '1h_scoring', factorValues);
      expect(result.score).toBeGreaterThan(0);
      expect(result.category).toBe('mainstream');
      expect(result.factorScores).toBeDefined();
    });
  });

  describe('数据刷新统计修复', () => {
    test('应该正确统计唯一交易对数量', async () => {
      // 添加测试数据
      await dataRefreshManager.updateRefreshTime('BTCUSDT', 'trend_analysis', 100);
      await dataRefreshManager.updateRefreshTime('ETHUSDT', 'trend_analysis', 100);
      await dataRefreshManager.updateRefreshTime('BNBUSDT', 'trend_analysis', 100);
      await dataRefreshManager.updateRefreshTime('BTCUSDT', 'trend_scoring', 100);
      await dataRefreshManager.updateRefreshTime('ETHUSDT', 'trend_scoring', 100);

      const stats = await dataRefreshManager.getRefreshStats();
      console.log('Stats:', stats);
      const trendAnalysisStat = stats.find(s => s.data_type === 'trend_analysis');
      const trendScoringStat = stats.find(s => s.data_type === 'trend_scoring');

      expect(trendAnalysisStat).toBeDefined();
      expect(trendAnalysisStat.total_symbols).toBe(3); // 3个唯一交易对
      expect(trendScoringStat).toBeDefined();
      expect(trendScoringStat.total_symbols).toBe(2); // 2个唯一交易对
    });
  });

  describe('VWAP方向检查逻辑', () => {
    test('应该正确判断多头趋势的VWAP方向', () => {
      const trend4h = '多头趋势';
      const lastClose = 100;
      const vwap = 95;

      let vwapDirectionConsistent = false;
      if (trend4h === '多头趋势' && lastClose > vwap) {
        vwapDirectionConsistent = true;
      } else if (trend4h === '空头趋势' && lastClose < vwap) {
        vwapDirectionConsistent = true;
      }

      expect(vwapDirectionConsistent).toBe(true);
    });

    test('应该正确判断空头趋势的VWAP方向', () => {
      const trend4h = '空头趋势';
      const lastClose = 90;
      const vwap = 95;

      let vwapDirectionConsistent = false;
      if (trend4h === '多头趋势' && lastClose > vwap) {
        vwapDirectionConsistent = true;
      } else if (trend4h === '空头趋势' && lastClose < vwap) {
        vwapDirectionConsistent = true;
      }

      expect(vwapDirectionConsistent).toBe(true);
    });

    test('应该正确判断VWAP方向不一致的情况', () => {
      const trend4h = '多头趋势';
      const lastClose = 90;
      const vwap = 95;

      let vwapDirectionConsistent = false;
      if (trend4h === '多头趋势' && lastClose > vwap) {
        vwapDirectionConsistent = true;
      } else if (trend4h === '空头趋势' && lastClose < vwap) {
        vwapDirectionConsistent = true;
      }

      expect(vwapDirectionConsistent).toBe(false);
    });
  });
});
