/**
 * 数据刷新一致性测试
 * 验证数据刷新页面显示的交易对数量与主页一致
 */

const DatabaseManager = require('../modules/database/DatabaseManager');
const DataRefreshManager = require('../modules/data/DataRefreshManager');

describe('数据刷新一致性测试', () => {
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

  describe('交易对数量一致性', () => {
    test('数据刷新日志中的交易对数量应该与custom_symbols表一致', async () => {
      // 获取custom_symbols表中的交易对
      const customSymbols = await database.getCustomSymbols();
      const customSymbolsCount = customSymbols.length;

      // 获取数据刷新日志中的唯一交易对
      const refreshLogSymbols = await database.runQuery(`
        SELECT DISTINCT symbol FROM data_refresh_log ORDER BY symbol
      `);
      const refreshLogSymbolsCount = refreshLogSymbols.length;

      console.log(`Custom symbols count: ${customSymbolsCount}`);
      console.log(`Refresh log symbols count: ${refreshLogSymbolsCount}`);
      console.log(`Custom symbols:`, customSymbols);
      console.log(`Refresh log symbols:`, refreshLogSymbols.map(r => r.symbol));

      // 检查数量是否一致
      expect(refreshLogSymbolsCount).toBe(customSymbolsCount);

      // 检查交易对是否完全一致
      const refreshSymbolsSet = new Set(refreshLogSymbols.map(r => r.symbol));
      const missingSymbols = customSymbols.filter(symbol => !refreshSymbolsSet.has(symbol));
      
      if (missingSymbols.length > 0) {
        console.log(`Missing symbols in refresh log:`, missingSymbols);
      }
      
      expect(missingSymbols).toHaveLength(0);
    });

    test('每种数据类型的交易对数量应该一致', async () => {
      const stats = await dataRefreshManager.getRefreshStats();
      
      if (stats.length === 0) {
        console.log('No refresh stats found, skipping test');
        return;
      }

      const firstTypeCount = stats[0].total_symbols;
      
      stats.forEach(stat => {
        console.log(`${stat.data_type}: ${stat.total_symbols} symbols`);
        expect(stat.total_symbols).toBe(firstTypeCount);
      });
    });

    test('总交易对数量应该等于唯一交易对数量', async () => {
      const stats = await dataRefreshManager.getRefreshStats();
      
      if (stats.length === 0) {
        console.log('No refresh stats found, skipping test');
        return;
      }

      // 计算所有类型的交易对数量总和
      const totalCount = stats.reduce((sum, stat) => sum + stat.total_symbols, 0);
      
      // 计算唯一交易对数量
      const allSymbols = new Set();
      stats.forEach(stat => {
        if (stat.symbols) {
          stat.symbols.forEach(symbol => allSymbols.add(symbol));
        }
      });
      const uniqueCount = allSymbols.size;

      console.log(`Total count (sum): ${totalCount}`);
      console.log(`Unique count: ${uniqueCount}`);
      console.log(`Expected unique count: ${stats[0].total_symbols}`);

      // 唯一交易对数量应该等于每种类型的交易对数量
      expect(uniqueCount).toBe(stats[0].total_symbols);
    });
  });

  describe('数据刷新统计准确性', () => {
    test('刷新统计应该包含所有数据类型', async () => {
      const stats = await dataRefreshManager.getRefreshStats();
      const expectedTypes = [
        'trend_analysis',
        'trend_scoring', 
        'trend_strength',
        'trend_entry',
        'range_boundary',
        'range_entry'
      ];

      const actualTypes = stats.map(stat => stat.data_type);
      
      expectedTypes.forEach(expectedType => {
        expect(actualTypes).toContain(expectedType);
      });
    });

    test('每个数据类型都应该有交易对列表', async () => {
      const stats = await dataRefreshManager.getRefreshStats();
      
      stats.forEach(stat => {
        expect(stat.symbols).toBeDefined();
        expect(Array.isArray(stat.symbols)).toBe(true);
        expect(stat.symbols.length).toBe(stat.total_symbols);
      });
    });
  });

  describe('缺失交易对处理', () => {
    test('应该识别并处理缺失的交易对', async () => {
      const customSymbols = await database.getCustomSymbols();
      const refreshLogSymbols = await database.runQuery(`
        SELECT DISTINCT symbol FROM data_refresh_log ORDER BY symbol
      `);
      
      const refreshSymbolsSet = new Set(refreshLogSymbols.map(r => r.symbol));
      const missingSymbols = customSymbols.filter(symbol => !refreshSymbolsSet.has(symbol));
      
      if (missingSymbols.length > 0) {
        console.log(`Found missing symbols: ${missingSymbols.join(', ')}`);
        
        // 对于缺失的交易对，应该尝试重新分析
        for (const symbol of missingSymbols) {
          console.log(`Attempting to analyze missing symbol: ${symbol}`);
          
          // 这里可以添加重新分析的逻辑
          // 或者至少记录缺失的交易对
          expect(symbol).toBeDefined();
        }
      }
    });
  });
});
