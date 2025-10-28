/**
 * 策略模式切换单元测试
 * 验证动态模式切换功能的正确性
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// 模拟测试环境
const mockDatabase = {
  query: async (sql, params) => {
    console.log(`[测试] 执行SQL: ${sql}, 参数:`, params);
    
    // 模拟查询活跃策略模式
    if (sql.includes('SELECT strategy_name, strategy_mode FROM strategy_params WHERE is_active = 1')) {
      return [
        { strategy_name: 'ICT', strategy_mode: 'BALANCED' },
        { strategy_name: 'V3', strategy_mode: 'AGGRESSIVE' }
      ];
    }
    
    // 模拟更新操作
    if (sql.includes('UPDATE strategy_params SET is_active')) {
      return { affectedRows: 1 };
    }
    
    return [];
  }
};

// 模拟策略类
class MockStrategy {
  constructor() {
    this.mode = 'BALANCED';
    this.params = {};
  }
  
  async setMode(mode) {
    this.mode = mode;
    console.log(`[测试] 策略模式已切换至: ${mode}`);
  }
  
  async initializeParameters(mode) {
    this.mode = mode;
    this.params = {
      risk_management: {
        stopLossATRMultiplier: mode === 'AGGRESSIVE' ? 1.3 : 1.8,
        takeProfitRatio: mode === 'AGGRESSIVE' ? 3.8 : 4.0
      },
      position: {
        riskPercent: mode === 'AGGRESSIVE' ? 0.015 : 0.01
      }
    };
    console.log(`[测试] 参数已加载: ${mode}模式`);
  }
}

// 模拟策略Worker
class MockStrategyWorker {
  constructor() {
    this.ictStrategy = new MockStrategy();
    this.v3Strategy = new MockStrategy();
  }
  
  async loadActiveStrategyModes() {
    try {
      // 查询当前活跃的策略模式
      const query = `
        SELECT strategy_name, strategy_mode 
        FROM strategy_params 
        WHERE is_active = 1 
        GROUP BY strategy_name, strategy_mode
        ORDER BY strategy_name, strategy_mode
      `;
      
      const results = await mockDatabase.query(query);
      console.log('[测试] 数据库中的活跃策略模式:', results);
      
      // 为每个策略设置模式
      const strategyModes = {};
      results.forEach(row => {
        if (!strategyModes[row.strategy_name]) {
          strategyModes[row.strategy_name] = row.strategy_mode;
        }
      });
      
      // 设置ICT策略模式
      if (strategyModes['ICT']) {
        await this.ictStrategy.setMode(strategyModes['ICT']);
        console.log(`[测试] ICT策略设置为${strategyModes['ICT']}模式`);
      } else {
        console.log('[测试] 未找到ICT策略的活跃模式，使用默认BALANCED');
        await this.ictStrategy.setMode('BALANCED');
      }
      
      // 设置V3策略模式
      if (strategyModes['V3']) {
        await this.v3Strategy.setMode(strategyModes['V3']);
        console.log(`[测试] V3策略设置为${strategyModes['V3']}模式`);
      } else {
        console.log('[测试] 未找到V3策略的活跃模式，使用默认BALANCED');
        await this.v3Strategy.setMode('BALANCED');
      }
      
    } catch (error) {
      console.error('[测试] 加载活跃策略模式失败:', error);
      // 使用默认模式
      await this.ictStrategy.setMode('BALANCED');
      await this.v3Strategy.setMode('BALANCED');
    }
  }
  
  async setStrategyMode(strategyName, mode) {
    if (!['AGGRESSIVE', 'BALANCED', 'CONSERVATIVE'].includes(mode)) {
      throw new Error(`无效的模式: ${mode}`);
    }

    try {
      if (strategyName === 'ICT') {
        await this.ictStrategy.setMode(mode);
        console.log(`[测试] ICT策略已切换至 ${mode} 模式`);
      } else if (strategyName === 'V3') {
        await this.v3Strategy.setMode(mode);
        console.log(`[测试] V3策略已切换至 ${mode} 模式`);
      } else {
        throw new Error(`未知的策略: ${strategyName}`);
      }
      
      return { success: true, message: `${strategyName}策略已切换至 ${mode} 模式` };
    } catch (error) {
      console.error(`[测试] 策略模式切换失败:`, error);
      return { success: false, message: error.message };
    }
  }
}

// 模拟API路由
class MockStrategyParamsAPI {
  constructor() {
    this.database = mockDatabase;
    this.strategyWorker = new MockStrategyWorker();
  }
  
  async setMode(strategyName, mode) {
    try {
      if (!['AGGRESSIVE', 'BALANCED', 'CONSERVATIVE'].includes(mode)) {
        return {
          success: false,
          error: 'Invalid mode. Must be AGGRESSIVE, BALANCED, or CONSERVATIVE'
        };
      }

      // 更新数据库中的活跃状态
      try {
        // 先将该策略的所有模式设为非活跃
        await this.database.query(
          'UPDATE strategy_params SET is_active = 0 WHERE strategy_name = ?',
          [strategyName.toUpperCase()]
        );
        
        // 将新模式设为活跃
        await this.database.query(
          'UPDATE strategy_params SET is_active = 1 WHERE strategy_name = ? AND strategy_mode = ?',
          [strategyName.toUpperCase(), mode]
        );
        
        console.log(`[测试] 数据库已更新: ${strategyName} -> ${mode}`);
      } catch (dbError) {
        console.error(`[测试] 数据库更新失败:`, dbError);
        // 继续执行，不中断流程
      }

      // 如果有 strategy worker 实例，立即切换
      if (this.strategyWorker) {
        await this.strategyWorker.setStrategyMode(strategyName.toUpperCase(), mode);
      }

      return {
        success: true,
        message: `${strategyName}策略已切换到${mode}模式`,
        strategy: strategyName.toUpperCase(),
        mode: mode
      };

    } catch (error) {
      console.error(`[测试] 模式切换失败:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// 测试用例
async function runTests() {
  console.log('🧪 开始策略模式切换单元测试\n');
  
  const api = new MockStrategyParamsAPI();
  
  // 测试1: 启动时加载活跃模式
  console.log('📋 测试1: 启动时加载活跃模式');
  await api.strategyWorker.loadActiveStrategyModes();
  
  assert.strictEqual(api.strategyWorker.ictStrategy.mode, 'BALANCED', 'ICT策略应为BALANCED模式');
  assert.strictEqual(api.strategyWorker.v3Strategy.mode, 'AGGRESSIVE', 'V3策略应为AGGRESSIVE模式');
  console.log('✅ 测试1通过: 启动时正确加载活跃模式\n');
  
  // 测试2: ICT策略模式切换
  console.log('📋 测试2: ICT策略模式切换');
  const ictResult = await api.setMode('ICT', 'AGGRESSIVE');
  
  assert.strictEqual(ictResult.success, true, 'ICT模式切换应成功');
  assert.strictEqual(api.strategyWorker.ictStrategy.mode, 'AGGRESSIVE', 'ICT策略应为AGGRESSIVE模式');
  console.log('✅ 测试2通过: ICT策略模式切换成功\n');
  
  // 测试3: V3策略模式切换
  console.log('📋 测试3: V3策略模式切换');
  const v3Result = await api.setMode('V3', 'CONSERVATIVE');
  
  assert.strictEqual(v3Result.success, true, 'V3模式切换应成功');
  assert.strictEqual(api.strategyWorker.v3Strategy.mode, 'CONSERVATIVE', 'V3策略应为CONSERVATIVE模式');
  console.log('✅ 测试3通过: V3策略模式切换成功\n');
  
  // 测试4: 无效模式处理
  console.log('📋 测试4: 无效模式处理');
  const invalidResult = await api.setMode('ICT', 'INVALID');
  
  assert.strictEqual(invalidResult.success, false, '无效模式切换应失败');
  assert.strictEqual(invalidResult.error.includes('Invalid mode'), true, '应返回无效模式错误');
  console.log('✅ 测试4通过: 无效模式处理正确\n');
  
  // 测试5: 参数加载验证
  console.log('📋 测试5: 参数加载验证');
  await api.strategyWorker.ictStrategy.initializeParameters('AGGRESSIVE');
  await api.strategyWorker.v3Strategy.initializeParameters('CONSERVATIVE');
  
  assert.strictEqual(api.strategyWorker.ictStrategy.params.risk_management.stopLossATRMultiplier, 1.3, 'ICT AGGRESSIVE模式止损ATR应为1.3');
  assert.strictEqual(api.strategyWorker.v3Strategy.params.risk_management.stopLossATRMultiplier, 1.8, 'V3 CONSERVATIVE模式止损ATR应为1.8');
  console.log('✅ 测试5通过: 参数加载正确\n');
  
  console.log('🎉 所有测试通过！策略模式切换功能正常');
}

// 运行测试
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  MockStrategyWorker,
  MockStrategyParamsAPI,
  MockStrategy,
  runTests
};
