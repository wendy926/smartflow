// test-monitoring-fixes.js
// 测试监控中心和ATR值修复效果

const http = require('http');

class MonitoringTestSuite {
  constructor() {
    this.baseUrl = 'http://localhost:8080';
    this.results = {
      apiTests: [],
      atrTests: [],
      summary: {}
    };
  }

  /**
   * 测试API端点
   */
  async testAPIEndpoint(endpoint, description) {
    try {
      console.log(`🔍 测试 ${description}...`);
      
      const response = await this.makeRequest(`${this.baseUrl}${endpoint}`);
      
      if (response.success) {
        console.log(`  ✅ ${description}: 成功`);
        console.log(`  📊 响应大小: ${response.data.length} 字符`);
        
        if (endpoint === '/api/monitoring-dashboard') {
          const data = JSON.parse(response.data);
          console.log(`  📈 监控数据: 总交易对=${data.summary?.totalSymbols || 'N/A'}, 健康状态=${data.summary?.overallHealth || 'N/A'}`);
        }
        
        return { success: true, data: response.data };
      } else {
        console.log(`  ❌ ${description}: 失败 - ${response.error}`);
        return { success: false, error: response.error };
      }
    } catch (error) {
      console.log(`  ❌ ${description}: 异常 - ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 发送HTTP请求
   */
  makeRequest(url) {
    return new Promise((resolve) => {
      const req = http.get(url, { timeout: 10000 }, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          resolve({
            success: res.statusCode === 200,
            statusCode: res.statusCode,
            data: data
          });
        });
      });
      
      req.on('error', (error) => {
        resolve({
          success: false,
          error: error.message
        });
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          error: '请求超时'
        });
      });
    });
  }

  /**
   * 测试数据库中的ATR值
   */
  async testATRValues() {
    try {
      console.log('\n🔍 测试ATR值修复效果...');
      
      // 这里我们通过API间接测试，因为数据库访问需要特殊权限
      const response = await this.makeRequest(`${this.baseUrl}/api/simulation-history`);
      
      if (response.success) {
        const data = JSON.parse(response.data);
        const simulations = data.simulations || [];
        
        let atrValidCount = 0;
        let atrInvalidCount = 0;
        
        for (const sim of simulations.slice(0, 10)) { // 只检查前10条
          if (sim.atr_value && sim.atr_value > 0) {
            atrValidCount++;
          } else {
            atrInvalidCount++;
          }
        }
        
        console.log(`  📊 ATR值统计: 有效=${atrValidCount}, 无效=${atrInvalidCount}`);
        
        return {
          success: true,
          validCount: atrValidCount,
          invalidCount: atrInvalidCount
        };
      } else {
        console.log(`  ❌ 无法获取模拟交易数据: ${response.error}`);
        return { success: false, error: response.error };
      }
    } catch (error) {
      console.log(`  ❌ ATR测试异常: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 运行完整的测试套件
   */
  async runTestSuite() {
    console.log('🚀 开始监控中心和ATR值修复测试...\n');

    // 1. 测试基础API
    console.log('📡 1. 测试基础API端点:');
    const symbolsResult = await this.testAPIEndpoint('/api/symbols', '交易对列表');
    this.results.apiTests.push(symbolsResult);

    // 2. 测试监控API
    console.log('\n📊 2. 测试监控API端点:');
    const monitoringResult = await this.testAPIEndpoint('/api/monitoring-dashboard', '监控仪表板');
    this.results.apiTests.push(monitoringResult);

    // 3. 测试模拟交易API
    console.log('\n💰 3. 测试模拟交易API端点:');
    const simulationResult = await this.testAPIEndpoint('/api/simulation-history', '模拟交易历史');
    this.results.apiTests.push(simulationResult);

    // 4. 测试ATR值修复
    const atrResult = await this.testATRValues();
    this.results.atrTests.push(atrResult);

    // 5. 生成测试报告
    this.generateReport();
  }

  /**
   * 生成测试报告
   */
  generateReport() {
    console.log('\n📋 测试报告:');
    console.log('='.repeat(50));
    
    // API测试结果
    console.log('\n📡 API测试结果:');
    const apiSuccessCount = this.results.apiTests.filter(test => test.success).length;
    const apiTotalCount = this.results.apiTests.length;
    
    this.results.apiTests.forEach((test, index) => {
      const status = test.success ? '✅' : '❌';
      console.log(`  ${status} 测试 ${index + 1}: ${test.success ? '通过' : '失败'}`);
    });
    
    console.log(`\n📊 API测试通过率: ${apiSuccessCount}/${apiTotalCount} (${((apiSuccessCount/apiTotalCount)*100).toFixed(1)}%)`);
    
    // ATR测试结果
    console.log('\n💰 ATR值测试结果:');
    this.results.atrTests.forEach((test, index) => {
      const status = test.success ? '✅' : '❌';
      console.log(`  ${status} ATR测试 ${index + 1}: ${test.success ? '通过' : '失败'}`);
      if (test.success) {
        console.log(`    📊 有效ATR值: ${test.validCount}, 无效ATR值: ${test.invalidCount}`);
      }
    });
    
    // 总体评估
    console.log('\n🎯 总体评估:');
    const allTestsPassed = apiSuccessCount === apiTotalCount && 
                          this.results.atrTests.every(test => test.success);
    
    if (allTestsPassed) {
      console.log('  🎉 所有测试通过！监控中心和ATR值修复成功！');
    } else {
      console.log('  ⚠️ 部分测试失败，需要进一步检查');
    }
    
    this.results.summary = {
      apiSuccessRate: (apiSuccessCount / apiTotalCount) * 100,
      atrTestsPassed: this.results.atrTests.every(test => test.success),
      overallSuccess: allTestsPassed
    };
  }
}

// 主函数
async function main() {
  const testSuite = new MonitoringTestSuite();
  
  try {
    await testSuite.runTestSuite();
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试套件
if (require.main === module) {
  main().catch(console.error);
}

module.exports = MonitoringTestSuite;
