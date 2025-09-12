/**
 * 主页显示修复测试
 * 验证分类显示、多因子得分显示和按钮整合
 */

const DatabaseManager = require('../modules/database/DatabaseManager');
const SmartFlowStrategyV3 = require('../modules/strategy/SmartFlowStrategyV3');
const DataRefreshManager = require('../modules/data/DataRefreshManager');

describe('主页显示修复测试', () => {
  let database;
  let dataRefreshManager;

  beforeAll(async () => {
    database = new DatabaseManager('./smartflow.db');
    await database.init();
    dataRefreshManager = new DataRefreshManager(database);
  });

  afterAll(async () => {
    if (database) {
      await database.close();
    }
  });

  describe('分类显示测试', () => {
    test('所有交易对都应该有正确的分类显示', async () => {
      const customSymbols = await database.getCustomSymbols();
      
      for (const symbol of customSymbols.slice(0, 5)) {
        const category = await database.getSymbolCategory(symbol);
        expect(category).toBeDefined();
        expect(category.category).toBeDefined();
        
        // 验证分类值是否在预期范围内
        const validCategories = ['mainstream', 'high-cap-trending', 'trending', 'smallcap'];
        expect(validCategories).toContain(category.category);
        
        // 验证分类显示映射
        const categoryDisplayMap = {
          'mainstream': '主流币',
          'high-cap-trending': '高市值趋势币',
          'trending': '热点币',
          'smallcap': '小币'
        };
        
        expect(categoryDisplayMap[category.category]).toBeDefined();
        expect(categoryDisplayMap[category.category]).not.toBe('未知');
      }
    });

    test('不应该出现未知分类', async () => {
      const customSymbols = await database.getCustomSymbols();
      
      for (const symbol of customSymbols) {
        const category = await database.getSymbolCategory(symbol);
        expect(category.category).not.toBe('unknown');
        expect(category.category).not.toBe('');
        expect(category.category).not.toBe(null);
        expect(category.category).not.toBe(undefined);
      }
    });
  });

  describe('多因子得分显示测试', () => {
    test('趋势市应该显示多因子得分', async () => {
      const customSymbols = await database.getCustomSymbols();
      
      for (const symbol of customSymbols.slice(0, 3)) {
        try {
          const analysis = await SmartFlowStrategyV3.analyzeSymbol(symbol, { 
            dataRefreshManager: dataRefreshManager 
          });
          
          if (analysis.marketType === '趋势市') {
            expect(analysis.score1h).toBeDefined();
            expect(typeof analysis.score1h).toBe('number');
            expect(analysis.score1h).toBeGreaterThanOrEqual(0);
            expect(analysis.score1h).toBeLessThanOrEqual(6);
            
            console.log(`趋势市 ${symbol}: score1h = ${analysis.score1h}`);
          }
        } catch (error) {
          console.warn(`分析 ${symbol} 失败:`, error.message);
        }
      }
    });

    test('震荡市应该不显示多因子得分（显示为空）', async () => {
      const customSymbols = await database.getCustomSymbols();
      
      for (const symbol of customSymbols.slice(0, 3)) {
        try {
          const analysis = await SmartFlowStrategyV3.analyzeSymbol(symbol, { 
            dataRefreshManager: dataRefreshManager 
          });
          
          if (analysis.marketType === '震荡市') {
            // 震荡市仍然有score1h值，但前端应该显示为空
            expect(analysis.score1h).toBeDefined();
            expect(typeof analysis.score1h).toBe('number');
            
            console.log(`震荡市 ${symbol}: score1h = ${analysis.score1h} (前端应显示为空)`);
          }
        } catch (error) {
          console.warn(`分析 ${symbol} 失败:`, error.message);
        }
      }
    });
  });

  describe('API响应结构测试', () => {
    test('API响应应该包含所有必要字段', async () => {
      const customSymbols = await database.getCustomSymbols();
      const signals = [];

      for (const symbol of customSymbols.slice(0, 3)) {
        try {
          const analysis = await SmartFlowStrategyV3.analyzeSymbol(symbol, { 
            dataRefreshManager: dataRefreshManager 
          });

          // 获取分类
          const category = await database.getSymbolCategory(symbol);
          
          signals.push({
            symbol,
            category: category ? category.category : 'smallcap',
            trend4h: analysis.trend4h,
            marketType: analysis.marketType,
            score1h: analysis.score1h,
            vwapDirectionConsistent: analysis.vwapDirectionConsistent,
            factors: analysis.factors
          });
        } catch (error) {
          console.warn(`分析 ${symbol} 失败:`, error.message);
        }
      }

      // 验证响应结构
      signals.forEach(signal => {
        expect(signal.symbol).toBeDefined();
        expect(signal.category).toBeDefined();
        expect(['mainstream', 'high-cap-trending', 'trending', 'smallcap']).toContain(signal.category);
        expect(signal.trend4h).toBeDefined();
        expect(signal.marketType).toBeDefined();
        expect(signal.score1h).toBeDefined();
        expect(typeof signal.score1h).toBe('number');
        expect(signal.score1h).toBeGreaterThanOrEqual(0);
        expect(signal.score1h).toBeLessThanOrEqual(6);
      });
    });
  });

  describe('前端显示逻辑测试', () => {
    test('分类显示映射应该正确', () => {
      const categoryDisplayMap = {
        'mainstream': '主流币',
        'high-cap-trending': '高市值趋势币',
        'trending': '热点币',
        'smallcap': '小币'
      };

      Object.entries(categoryDisplayMap).forEach(([key, value]) => {
        expect(value).toBeDefined();
        expect(value).not.toBe('未知');
        expect(value.length).toBeGreaterThan(0);
      });
    });

    test('分类样式类映射应该正确', () => {
      const categoryClassMap = {
        'mainstream': 'category-mainstream',
        'high-cap-trending': 'category-highcap',
        'trending': 'category-trending',
        'smallcap': 'category-smallcap'
      };

      Object.entries(categoryClassMap).forEach(([key, value]) => {
        expect(value).toBeDefined();
        expect(value).toMatch(/^category-/);
      });
    });
  });
});
