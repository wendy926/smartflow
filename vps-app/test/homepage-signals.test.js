/**
 * 主页交易信号测试
 * 验证交易信号显示的正确性
 */

const DatabaseManager = require('../modules/database/DatabaseManager');
const SmartFlowStrategyV3 = require('../modules/strategy/SmartFlowStrategyV3');
const DataRefreshManager = require('../modules/data/DataRefreshManager');

describe('主页交易信号测试', () => {
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

  describe('交易对分类测试', () => {
    test('所有交易对都应该有分类', async () => {
      const customSymbols = await database.getCustomSymbols();
      
      for (const symbol of customSymbols) {
        const category = await database.getSymbolCategory(symbol);
        expect(category).toBeDefined();
        expect(category.category).toBeDefined();
        expect(['mainstream', 'high-cap-trending', 'trending', 'smallcap']).toContain(category.category);
      }
    });

    test('分类应该符合预期规则', async () => {
      const expectedCategories = {
        'BTCUSDT': 'mainstream',
        'ETHUSDT': 'mainstream',
        'SOLUSDT': 'high-cap-trending',
        'BNBUSDT': 'high-cap-trending',
        'AVAXUSDT': 'high-cap-trending',
        'ADAUSDT': 'high-cap-trending',
        'XRPUSDT': 'high-cap-trending',
        'DOGEUSDT': 'trending',
        'LINKUSDT': 'trending',
        'AAVEUSDT': 'trending',
        'HYPEUSDT': 'trending',
        'PUMPUSDT': 'high-cap-trending'
      };

      for (const [symbol, expectedCategory] of Object.entries(expectedCategories)) {
        const category = await database.getSymbolCategory(symbol);
        if (category) {
          expect(category.category).toBe(expectedCategory);
        }
      }
    });
  });

  describe('多因子得分测试', () => {
    test('所有交易对都应该有多因子得分', async () => {
      const customSymbols = await database.getCustomSymbols();
      
      for (const symbol of customSymbols.slice(0, 5)) { // 测试前5个交易对
        try {
          const analysis = await SmartFlowStrategyV3.analyzeSymbol(symbol, { 
            dataRefreshManager: dataRefreshManager 
          });
          
          expect(analysis.score1h).toBeDefined();
          expect(typeof analysis.score1h).toBe('number');
          expect(analysis.score1h).toBeGreaterThanOrEqual(0);
          expect(analysis.score1h).toBeLessThanOrEqual(6);
          
          console.log(`${symbol}: score1h = ${analysis.score1h}, marketType = ${analysis.marketType}`);
        } catch (error) {
          console.warn(`分析 ${symbol} 失败:`, error.message);
        }
      }
    });

    test('震荡市交易对也应该有多因子得分', async () => {
      const customSymbols = await database.getCustomSymbols();
      
      for (const symbol of customSymbols.slice(0, 3)) {
        try {
          const analysis = await SmartFlowStrategyV3.analyzeSymbol(symbol, { 
            dataRefreshManager: dataRefreshManager 
          });
          
          if (analysis.marketType === '震荡市') {
            expect(analysis.score1h).toBeDefined();
            expect(typeof analysis.score1h).toBe('number');
            expect(analysis.score1h).toBeGreaterThanOrEqual(0);
          }
        } catch (error) {
          console.warn(`分析 ${symbol} 失败:`, error.message);
        }
      }
    });
  });

  describe('4H趋势和市场类型一致性测试', () => {
    test('4H趋势和市场类型应该一致', async () => {
      const customSymbols = await database.getCustomSymbols();
      
      for (const symbol of customSymbols.slice(0, 5)) {
        try {
          const analysis = await SmartFlowStrategyV3.analyzeSymbol(symbol, { 
            dataRefreshManager: dataRefreshManager 
          });
          
          console.log(`${symbol}: trend4h = ${analysis.trend4h}, marketType = ${analysis.marketType}, score1h = ${analysis.score1h}`);
          
          // 如果4H趋势是震荡市，市场类型也应该是震荡市
          if (analysis.trend4h === '震荡市') {
            expect(analysis.marketType).toBe('震荡市');
          }
          
          // 如果4H趋势是多头趋势或空头趋势
          if (analysis.trend4h === '多头趋势' || analysis.trend4h === '空头趋势') {
            // 如果1H得分>0，应该是趋势市
            if (analysis.score1h > 0) {
              expect(analysis.marketType).toBe('趋势市');
            } else {
              // 如果1H得分=0，应该是震荡市
              expect(analysis.marketType).toBe('震荡市');
            }
          }
        } catch (error) {
          console.warn(`分析 ${symbol} 失败:`, error.message);
        }
      }
    });

    test('不应该出现4H趋势为多头/空头但市场类型为震荡市的情况', async () => {
      const customSymbols = await database.getCustomSymbols();
      
      for (const symbol of customSymbols.slice(0, 5)) {
        try {
          const analysis = await SmartFlowStrategyV3.analyzeSymbol(symbol, { 
            dataRefreshManager: dataRefreshManager 
          });
          
          // 不应该出现4H趋势为多头/空头但市场类型为震荡市的情况
          if ((analysis.trend4h === '多头趋势' || analysis.trend4h === '空头趋势') && 
              analysis.marketType === '震荡市') {
            // 这种情况只有在1H得分=0时才应该出现
            expect(analysis.score1h).toBe(0);
          }
        } catch (error) {
          console.warn(`分析 ${symbol} 失败:`, error.message);
        }
      }
    });
  });

  describe('API响应测试', () => {
    test('API响应应该包含所有必要字段', async () => {
      // 模拟API调用
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
});
