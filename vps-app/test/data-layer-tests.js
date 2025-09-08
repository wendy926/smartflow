// test/data-layer-tests.js
// 数据层架构测试用例

const { DataLayerManager } = require('../modules/data/DataLayerManager');
const DatabaseManager = require('../modules/database/DatabaseManager');
const { DatabaseSchemaUpdater } = require('../modules/database/DatabaseSchemaUpdater');

/**
 * 数据层架构测试套件
 */
class DataLayerTestSuite {
  constructor() {
    this.db = null;
    this.dataLayer = null;
    this.testResults = [];
  }

  /**
   * 初始化测试环境
   */
  async init() {
    try {
      console.log('🧪 初始化测试环境...');
      
      // 初始化数据库
      this.db = new DatabaseManager();
      await this.db.init();
      
      // 更新数据库架构
      const schemaUpdater = new DatabaseSchemaUpdater(this.db);
      await schemaUpdater.performFullUpdate();
      
      // 初始化数据层管理器
      this.dataLayer = new DataLayerManager(this.db, {
        dal: {
          cacheConfig: {
            strategyAnalysis: 10000,    // 10秒测试用
            simulationData: 5000,       // 5秒测试用
            monitoringData: 2000,       // 2秒测试用
            userSettings: 30000,        // 30秒测试用
            alertHistory: 5000          // 5秒测试用
          }
        },
        consistency: {
          consistencyConfig: {
            checkInterval: 10000,       // 10秒测试用
            enableAutoSync: true
          }
        },
        persistence: {
          persistenceConfig: {
            autoSaveInterval: 5000,     // 5秒测试用
            enableAutoSave: true
          }
        }
      });
      
      console.log('✅ 测试环境初始化完成');
    } catch (error) {
      console.error('❌ 测试环境初始化失败:', error);
      throw error;
    }
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    console.log('🚀 开始运行数据层架构测试...');
    
    try {
      // 基础功能测试
      await this.testBasicFunctionality();
      
      // 缓存功能测试
      await this.testCacheFunctionality();
      
      // 数据一致性测试
      await this.testDataConsistency();
      
      // 数据持久化测试
      await this.testDataPersistence();
      
      // 性能测试
      await this.testPerformance();
      
      // 错误处理测试
      await this.testErrorHandling();
      
      // 清理测试
      await this.testCleanup();
      
      this.printTestResults();
      
    } catch (error) {
      console.error('❌ 测试运行失败:', error);
      throw error;
    }
  }

  /**
   * 基础功能测试
   */
  async testBasicFunctionality() {
    console.log('📋 运行基础功能测试...');
    
    const tests = [
      {
        name: '策略分析数据保存和获取',
        test: async () => {
          const testData = {
            symbol: 'TESTUSDT',
            trend: 'UPTREND',
            signal: 'LONG',
            execution: '做多_模式A',
            executionMode: '模式A',
            currentPrice: 100.0,
            dataValid: true
          };
          
          // 保存数据
          await this.dataLayer.saveStrategyAnalysis(testData);
          
          // 获取数据
          const retrieved = await this.dataLayer.getStrategyAnalysis('TESTUSDT', { latest: true });
          
          if (!retrieved || retrieved.symbol !== 'TESTUSDT') {
            throw new Error('策略分析数据保存或获取失败');
          }
          
          return '策略分析数据操作成功';
        }
      },
      {
        name: '模拟交易数据保存和获取',
        test: async () => {
          const testData = {
            symbol: 'TESTUSDT',
            entryPrice: 100.0,
            stopLossPrice: 95.0,
            takeProfitPrice: 110.0,
            maxLeverage: 10,
            minMargin: 10.0,
            triggerReason: 'SIGNAL_模式A_LONG',
            status: 'ACTIVE'
          };
          
          // 保存数据
          await this.dataLayer.saveSimulationData(testData);
          
          // 获取数据
          const retrieved = await this.dataLayer.getSimulationData('TESTUSDT', { active: true });
          
          if (!retrieved || retrieved.length === 0) {
            throw new Error('模拟交易数据保存或获取失败');
          }
          
          return '模拟交易数据操作成功';
        }
      },
      {
        name: '用户设置保存和获取',
        test: async () => {
          const testKey = 'test_setting';
          const testValue = 'test_value_123';
          
          // 保存设置
          await this.dataLayer.setUserSetting(testKey, testValue);
          
          // 获取设置
          const retrieved = await this.dataLayer.getUserSetting(testKey);
          
          if (retrieved !== testValue) {
            throw new Error('用户设置保存或获取失败');
          }
          
          return '用户设置操作成功';
        }
      }
    ];

    await this.runTestGroup('基础功能测试', tests);
  }

  /**
   * 缓存功能测试
   */
  async testCacheFunctionality() {
    console.log('💾 运行缓存功能测试...');
    
    const tests = [
      {
        name: '缓存命中测试',
        test: async () => {
          const testData = {
            symbol: 'CACHETEST',
            trend: 'UPTREND',
            signal: 'LONG',
            execution: '做多_模式A',
            currentPrice: 100.0,
            dataValid: true
          };
          
          // 第一次获取（应该从数据库）
          const start1 = Date.now();
          await this.dataLayer.saveStrategyAnalysis(testData);
          const retrieved1 = await this.dataLayer.getStrategyAnalysis('CACHETEST', { latest: true });
          const time1 = Date.now() - start1;
          
          // 第二次获取（应该从缓存）
          const start2 = Date.now();
          const retrieved2 = await this.dataLayer.getStrategyAnalysis('CACHETEST', { latest: true });
          const time2 = Date.now() - start2;
          
          if (!retrieved1 || !retrieved2) {
            throw new Error('缓存测试数据获取失败');
          }
          
          // 缓存应该更快
          if (time2 >= time1) {
            console.warn('⚠️ 缓存可能未生效，时间差异不明显');
          }
          
          return `缓存测试完成 - 首次: ${time1}ms, 缓存: ${time2}ms`;
        }
      },
      {
        name: '缓存失效测试',
        test: async () => {
          // 清除缓存
          this.dataLayer.clearCacheByType('strategyAnalysis');
          
          // 获取缓存统计
          const stats = this.dataLayer.getCacheStats();
          
          if (stats.cacheSize > 0) {
            throw new Error('缓存清除失败');
          }
          
          return '缓存清除成功';
        }
      },
      {
        name: '缓存预热测试',
        test: async () => {
          const symbols = ['BTCUSDT', 'ETHUSDT', 'LINKUSDT'];
          
          // 预热缓存
          await this.dataLayer.warmupCache(symbols);
          
          // 检查缓存统计
          const stats = this.dataLayer.getCacheStats();
          
          if (stats.cacheSize === 0) {
            throw new Error('缓存预热失败');
          }
          
          return `缓存预热成功 - 缓存大小: ${stats.cacheSize}`;
        }
      }
    ];

    await this.runTestGroup('缓存功能测试', tests);
  }

  /**
   * 数据一致性测试
   */
  async testDataConsistency() {
    console.log('🔍 运行数据一致性测试...');
    
    const tests = [
      {
        name: '数据一致性检查',
        test: async () => {
          const testData = {
            symbol: 'CONSISTENCYTEST',
            trend: 'UPTREND',
            signal: 'LONG',
            execution: '做多_模式A',
            currentPrice: 100.0,
            dataValid: true
          };
          
          // 保存数据
          await this.dataLayer.saveStrategyAnalysis(testData);
          
          // 检查一致性
          const consistency = await this.dataLayer.checkDataConsistency('strategyAnalysis', 'CONSISTENCYTEST');
          
          if (!consistency.consistent) {
            throw new Error('数据一致性检查失败');
          }
          
          return '数据一致性检查通过';
        }
      },
      {
        name: '强制同步测试',
        test: async () => {
          // 强制同步数据
          const synced = await this.dataLayer.forceSync('strategyAnalysis', 'CONSISTENCYTEST');
          
          if (!synced) {
            throw new Error('强制同步失败');
          }
          
          return '强制同步成功';
        }
      },
      {
        name: '同步状态检查',
        test: async () => {
          const syncStatus = this.dataLayer.getSyncStatus();
          
          if (!syncStatus.enabled) {
            throw new Error('同步状态检查失败');
          }
          
          return '同步状态正常';
        }
      }
    ];

    await this.runTestGroup('数据一致性测试', tests);
  }

  /**
   * 数据持久化测试
   */
  async testDataPersistence() {
    console.log('💾 运行数据持久化测试...');
    
    const tests = [
      {
        name: '数据持久化测试',
        test: async () => {
          const testData = {
            symbol: 'PERSISTENCETEST',
            trend: 'UPTREND',
            signal: 'LONG',
            execution: '做多_模式A',
            currentPrice: 100.0,
            dataValid: true
          };
          
          // 保存数据
          await this.dataLayer.saveStrategyAnalysis(testData);
          
          // 等待自动持久化
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // 检查待持久化数据统计
          const pendingStats = this.dataLayer.getPendingDataStats();
          
          return `待持久化数据统计: ${JSON.stringify(pendingStats)}`;
        }
      },
      {
        name: '强制保存测试',
        test: async () => {
          // 强制保存所有待持久化数据
          await this.dataLayer.forceSaveAll();
          
          // 检查待持久化数据统计
          const pendingStats = this.dataLayer.getPendingDataStats();
          
          if (pendingStats.totalRecords > 0) {
            console.warn('⚠️ 仍有待持久化数据');
          }
          
          return '强制保存完成';
        }
      }
    ];

    await this.runTestGroup('数据持久化测试', tests);
  }

  /**
   * 性能测试
   */
  async testPerformance() {
    console.log('⚡ 运行性能测试...');
    
    const tests = [
      {
        name: '批量数据操作性能测试',
        test: async () => {
          const start = Date.now();
          const promises = [];
          
          // 创建100条测试数据
          for (let i = 0; i < 100; i++) {
            const testData = {
              symbol: `PERFTEST${i}`,
              trend: 'UPTREND',
              signal: 'LONG',
              execution: '做多_模式A',
              currentPrice: 100.0 + i,
              dataValid: true
            };
            
            promises.push(this.dataLayer.saveStrategyAnalysis(testData));
          }
          
          await Promise.all(promises);
          const time = Date.now() - start;
          
          if (time > 10000) { // 超过10秒认为性能不佳
            throw new Error(`批量操作性能不佳: ${time}ms`);
          }
          
          return `批量操作完成 - 耗时: ${time}ms`;
        }
      },
      {
        name: '缓存性能测试',
        test: async () => {
          const testSymbol = 'PERFCACHETEST';
          const testData = {
            symbol: testSymbol,
            trend: 'UPTREND',
            signal: 'LONG',
            execution: '做多_模式A',
            currentPrice: 100.0,
            dataValid: true
          };
          
          // 保存数据
          await this.dataLayer.saveStrategyAnalysis(testData);
          
          // 测试缓存性能
          const start = Date.now();
          for (let i = 0; i < 1000; i++) {
            await this.dataLayer.getStrategyAnalysis(testSymbol, { latest: true });
          }
          const time = Date.now() - start;
          
          if (time > 5000) { // 超过5秒认为性能不佳
            throw new Error(`缓存性能不佳: ${time}ms`);
          }
          
          return `缓存性能测试完成 - 1000次查询耗时: ${time}ms`;
        }
      }
    ];

    await this.runTestGroup('性能测试', tests);
  }

  /**
   * 错误处理测试
   */
  async testErrorHandling() {
    console.log('🚨 运行错误处理测试...');
    
    const tests = [
      {
        name: '无效数据测试',
        test: async () => {
          try {
            await this.dataLayer.saveStrategyAnalysis(null);
            throw new Error('应该抛出错误');
          } catch (error) {
            if (error.message.includes('应该抛出错误')) {
              throw error;
            }
            return '无效数据处理正确';
          }
        }
      },
      {
        name: '数据库连接错误测试',
        test: async () => {
          // 模拟数据库连接错误
          const originalRunQuery = this.db.runQuery;
          this.db.runQuery = () => {
            throw new Error('模拟数据库连接错误');
          };
          
          try {
            await this.dataLayer.getStrategyAnalysis('ERROR_TEST', { latest: true });
            throw new Error('应该抛出错误');
          } catch (error) {
            if (error.message.includes('应该抛出错误')) {
              throw error;
            }
            return '数据库错误处理正确';
          } finally {
            // 恢复原始方法
            this.db.runQuery = originalRunQuery;
          }
        }
      }
    ];

    await this.runTestGroup('错误处理测试', tests);
  }

  /**
   * 清理测试
   */
  async testCleanup() {
    console.log('🧹 运行清理测试...');
    
    const tests = [
      {
        name: '数据清理测试',
        test: async () => {
          // 清理测试数据
          await this.db.runQuery('DELETE FROM strategy_analysis WHERE symbol LIKE ?', ['%TEST%']);
          await this.db.runQuery('DELETE FROM simulations WHERE symbol LIKE ?', ['%TEST%']);
          await this.db.runQuery('DELETE FROM user_settings WHERE setting_key LIKE ?', ['%test%']);
          
          return '测试数据清理完成';
        }
      },
      {
        name: '缓存清理测试',
        test: async () => {
          // 清除所有缓存
          this.dataLayer.clearAllCache();
          
          const stats = this.dataLayer.getCacheStats();
          
          if (stats.cacheSize > 0) {
            throw new Error('缓存清理失败');
          }
          
          return '缓存清理完成';
        }
      }
    ];

    await this.runTestGroup('清理测试', tests);
  }

  /**
   * 运行测试组
   */
  async runTestGroup(groupName, tests) {
    console.log(`\n📋 开始运行 ${groupName}...`);
    
    for (const test of tests) {
      try {
        const start = Date.now();
        const result = await test.test();
        const time = Date.now() - start;
        
        this.testResults.push({
          group: groupName,
          name: test.name,
          status: 'PASS',
          result: result,
          time: time
        });
        
        console.log(`✅ ${test.name} - ${time}ms`);
      } catch (error) {
        this.testResults.push({
          group: groupName,
          name: test.name,
          status: 'FAIL',
          error: error.message,
          time: 0
        });
        
        console.log(`❌ ${test.name} - ${error.message}`);
      }
    }
  }

  /**
   * 打印测试结果
   */
  printTestResults() {
    console.log('\n📊 测试结果汇总:');
    console.log('='.repeat(80));
    
    const groups = {};
    this.testResults.forEach(result => {
      if (!groups[result.group]) {
        groups[result.group] = { pass: 0, fail: 0, total: 0 };
      }
      groups[result.group].total++;
      if (result.status === 'PASS') {
        groups[result.group].pass++;
      } else {
        groups[result.group].fail++;
      }
    });
    
    for (const [groupName, stats] of Object.entries(groups)) {
      console.log(`\n📋 ${groupName}:`);
      console.log(`   ✅ 通过: ${stats.pass}`);
      console.log(`   ❌ 失败: ${stats.fail}`);
      console.log(`   📊 总计: ${stats.total}`);
      console.log(`   📈 成功率: ${((stats.pass / stats.total) * 100).toFixed(1)}%`);
    }
    
    const totalPass = this.testResults.filter(r => r.status === 'PASS').length;
    const totalTests = this.testResults.length;
    const overallSuccess = ((totalPass / totalTests) * 100).toFixed(1);
    
    console.log('\n🎯 总体结果:');
    console.log(`   ✅ 通过: ${totalPass}`);
    console.log(`   ❌ 失败: ${totalTests - totalPass}`);
    console.log(`   📊 总计: ${totalTests}`);
    console.log(`   📈 成功率: ${overallSuccess}%`);
    
    if (overallSuccess >= 90) {
      console.log('\n🎉 测试通过！数据层架构运行正常');
    } else {
      console.log('\n⚠️ 测试未完全通过，请检查失败的测试用例');
    }
  }

  /**
   * 清理测试环境
   */
  async cleanup() {
    try {
      if (this.dataLayer) {
        await this.dataLayer.gracefulShutdown();
      }
      
      if (this.db) {
        await this.db.close();
      }
      
      console.log('🧹 测试环境清理完成');
    } catch (error) {
      console.error('❌ 测试环境清理失败:', error);
    }
  }
}

// 运行测试
async function runTests() {
  const testSuite = new DataLayerTestSuite();
  
  try {
    await testSuite.init();
    await testSuite.runAllTests();
  } catch (error) {
    console.error('❌ 测试运行失败:', error);
    process.exit(1);
  } finally {
    await testSuite.cleanup();
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runTests();
}

module.exports = { DataLayerTestSuite };
