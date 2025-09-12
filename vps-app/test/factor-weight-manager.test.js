// factor-weight-manager.test.js - 多因子权重管理器单元测试

const FactorWeightManager = require('../modules/strategy/FactorWeightManager');

describe('FactorWeightManager', () => {
  let factorWeightManager;
  let mockDatabase;

  beforeEach(() => {
    // 创建模拟数据库
    mockDatabase = {
      getSymbolCategory: jest.fn(),
      getAllSymbolCategories: jest.fn(),
      recordFactorWeights: jest.fn(),
      getFactorWeights: jest.fn(),
      getAllFactorWeights: jest.fn()
    };

    factorWeightManager = new FactorWeightManager(mockDatabase);
  });

  afterEach(() => {
    // 清理资源
    if (factorWeightManager) {
      factorWeightManager = null;
    }
    if (mockDatabase) {
      mockDatabase = null;
    }
  });

  describe('getSymbolCategory', () => {
    test('应该从数据库获取交易对分类', async () => {
      mockDatabase.getSymbolCategory.mockResolvedValue({ category: 'mainstream' });

      const category = await factorWeightManager.getSymbolCategory('BTCUSDT');

      expect(mockDatabase.getSymbolCategory).toHaveBeenCalledWith('BTCUSDT');
      expect(category).toBe('mainstream');
    });

    test('应该处理数据库方法调用错误', async () => {
      // 模拟DatabaseManager方法调用错误（this.get不存在）
      mockDatabase.getSymbolCategory.mockRejectedValue(new Error('this.get is not a function'));

      const category = await factorWeightManager.getSymbolCategory('BTCUSDT');

      // 应该降级到默认分类逻辑
      expect(category).toBe('mainstream');
    });

    test('数据库中没有分类时应该使用默认分类逻辑', async () => {
      mockDatabase.getSymbolCategory.mockResolvedValue(null);

      const category = await factorWeightManager.getSymbolCategory('BTCUSDT');

      expect(category).toBe('mainstream');
    });

    test('应该正确识别主流币', async () => {
      mockDatabase.getSymbolCategory.mockResolvedValue(null);

      expect(await factorWeightManager.getSymbolCategory('BTCUSDT')).toBe('mainstream');
      expect(await factorWeightManager.getSymbolCategory('ETHUSDT')).toBe('mainstream');
    });

    test('应该正确识别高市值强趋势币', async () => {
      mockDatabase.getSymbolCategory.mockResolvedValue(null);

      expect(await factorWeightManager.getSymbolCategory('BNBUSDT')).toBe('high-cap-trending');
      expect(await factorWeightManager.getSymbolCategory('SOLUSDT')).toBe('high-cap-trending');
    });

    test('应该正确识别热点币', async () => {
      mockDatabase.getSymbolCategory.mockResolvedValue(null);

      expect(await factorWeightManager.getSymbolCategory('PEPEUSDT')).toBe('trending');
      expect(await factorWeightManager.getSymbolCategory('MEMEUSDT')).toBe('trending');
    });

    test('应该正确识别小币', async () => {
      mockDatabase.getSymbolCategory.mockResolvedValue(null);

      expect(await factorWeightManager.getSymbolCategory('UNKNOWNUSDT')).toBe('smallcap');
    });
  });

  describe('getFactorWeights', () => {
    test('应该从数据库获取权重配置', async () => {
      const mockWeights = {
        vwap_weight: 0.3,
        delta_weight: 0.3,
        oi_weight: 0.2,
        volume_weight: 0.2
      };
      mockDatabase.getFactorWeights.mockResolvedValue(mockWeights);

      const weights = await factorWeightManager.getFactorWeights('mainstream', '15m_execution');

      expect(mockDatabase.getFactorWeights).toHaveBeenCalledWith('mainstream', '15m_execution');
      expect(weights).toEqual({
        vwap: 0.3,
        delta: 0.3,
        oi: 0.2,
        volume: 0.2,
        breakout: undefined,
        funding: undefined
      });
    });

    test('数据库中没有权重时应该使用默认权重', async () => {
      mockDatabase.getFactorWeights.mockResolvedValue(null);

      const weights = await factorWeightManager.getFactorWeights('mainstream', '15m_execution');

      expect(weights).toEqual({
        vwap: 0.3,
        delta: 0.3,
        oi: 0.2,
        volume: 0.2
      });
    });

    test('应该返回正确的默认权重配置', async () => {
      const weights = await factorWeightManager.getFactorWeights('trending', '15m_execution');

      expect(weights).toEqual({
        vwap: 0.2,
        delta: 0.2,
        oi: 0.2,
        volume: 0.4
      });
    });
  });

  describe('calculateWeightedScore', () => {
    test('应该正确计算加权得分', async () => {
      mockDatabase.getSymbolCategory.mockResolvedValue({ category: 'mainstream' });
      mockDatabase.getFactorWeights.mockResolvedValue(null);

      const factorValues = {
        vwap: true,
        delta: true,
        oi: true,
        volume: true
      };

      const result = await factorWeightManager.calculateWeightedScore('BTCUSDT', '15m_execution', factorValues);

      expect(result.category).toBe('mainstream');
      expect(result.score).toBeGreaterThan(0);
      expect(result.factorScores).toBeDefined();
      expect(result.weights).toBeDefined();
    });

    test('应该处理数据库错误', async () => {
      mockDatabase.getSymbolCategory.mockRejectedValue(new Error('Database error'));

      const factorValues = {
        vwap: true,
        delta: true,
        oi: true,
        volume: true
      };

      const result = await factorWeightManager.calculateWeightedScore('BTCUSDT', '15m_execution', factorValues);

      expect(result.category).toBe('mainstream');
      expect(result.score).toBeGreaterThan(0);
    });
  });

  describe('calculateFactorScore', () => {
    test('应该正确计算VWAP因子得分', () => {
      const score = factorWeightManager.calculateFactorScore('vwap', true, '15m_execution');
      expect(score).toBe(1);

      const score2 = factorWeightManager.calculateFactorScore('vwap', false, '15m_execution');
      expect(score2).toBe(0);
    });

    test('应该正确计算成交量因子得分', () => {
      const score = factorWeightManager.calculateFactorScore('volume', 1.5, '15m_execution');
      expect(score).toBe(1);

      const score2 = factorWeightManager.calculateFactorScore('volume', 1.2, '15m_execution');
      expect(score2).toBe(0.5);

      const score3 = factorWeightManager.calculateFactorScore('volume', 1.0, '15m_execution');
      expect(score3).toBe(0);
    });

    test('应该正确计算OI因子得分', () => {
      const score = factorWeightManager.calculateFactorScore('oi', 0.03, '15m_execution');
      expect(score).toBe(1);

      const score2 = factorWeightManager.calculateFactorScore('oi', 0.01, '15m_execution');
      expect(score2).toBe(0);
    });

    test('应该正确计算Delta因子得分', () => {
      const score = factorWeightManager.calculateFactorScore('delta', 0.15, '15m_execution');
      expect(score).toBe(1);

      const score2 = factorWeightManager.calculateFactorScore('delta', 0.08, '15m_execution');
      expect(score2).toBe(0.5);

      const score3 = factorWeightManager.calculateFactorScore('delta', 0.02, '15m_execution');
      expect(score3).toBe(0);
    });

    test('应该正确计算资金费率因子得分', () => {
      const score = factorWeightManager.calculateFactorScore('funding', 0.0003, '15m_execution');
      expect(score).toBe(1);

      const score2 = factorWeightManager.calculateFactorScore('funding', 0.0008, '15m_execution');
      expect(score2).toBe(0.5);

      const score3 = factorWeightManager.calculateFactorScore('funding', 0.005, '15m_execution');
      expect(score3).toBe(0);
    });
  });

  describe('initializeDefaultWeights', () => {
    test('应该初始化默认权重配置', async () => {
      mockDatabase.recordFactorWeights.mockResolvedValue({ id: 1 });

      await factorWeightManager.initializeDefaultWeights();

      // 验证调用了recordFactorWeights
      expect(mockDatabase.recordFactorWeights).toHaveBeenCalled();
    });

    test('应该处理数据库未初始化的情况', async () => {
      const manager = new FactorWeightManager(null);

      // 不应该抛出错误
      await expect(manager.initializeDefaultWeights()).resolves.toBeUndefined();
    });
  });

  describe('updateWeights', () => {
    test('应该更新权重配置', async () => {
      mockDatabase.recordFactorWeights.mockResolvedValue({ id: 1 });

      const newWeights = {
        vwap: 0.4,
        delta: 0.3,
        oi: 0.2,
        volume: 0.1
      };

      const result = await factorWeightManager.updateWeights('mainstream', '15m_execution', newWeights);

      expect(result).toBe(true);
      expect(mockDatabase.recordFactorWeights).toHaveBeenCalledWith({
        category: 'mainstream',
        analysisType: '15m_execution',
        vwapWeight: 0.4,
        deltaWeight: 0.3,
        oiWeight: 0.2,
        volumeWeight: 0.1,
        breakoutWeight: 0,
        fundingWeight: 0
      });
    });

    test('应该处理数据库未初始化的情况', async () => {
      const manager = new FactorWeightManager(null);

      const result = await manager.updateWeights('mainstream', '15m_execution', {});

      expect(result).toBe(false);
    });
  });

  describe('getAllWeights', () => {
    test('应该获取所有权重配置', async () => {
      const mockWeights = [
        { category: 'mainstream', analysis_type: '15m_execution' },
        { category: 'highcap', analysis_type: '15m_execution' }
      ];
      mockDatabase.getAllFactorWeights.mockResolvedValue(mockWeights);

      const weights = await factorWeightManager.getAllWeights();

      expect(weights).toEqual(mockWeights);
      expect(mockDatabase.getAllFactorWeights).toHaveBeenCalled();
    });

    test('应该处理数据库错误', async () => {
      mockDatabase.getAllFactorWeights.mockRejectedValue(new Error('Database error'));

      const weights = await factorWeightManager.getAllWeights();

      expect(weights).toEqual([]);
    });
  });
});
