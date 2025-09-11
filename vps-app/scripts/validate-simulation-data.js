#!/usr/bin/env node

/**
 * 模拟交易数据验证脚本
 * 检查监控数据与数据库数据的一致性
 */

const DatabaseManager = require('../modules/database/DatabaseManager');

async function validateSimulationData() {
  console.log('🔍 开始验证模拟交易数据一致性...');
  
  try {
    const dbManager = new DatabaseManager();
    await dbManager.init();
    
    // 1. 检查数据库中的模拟交易记录
    console.log('\n📊 数据库模拟交易记录:');
    const dbSimulations = await dbManager.runQuery(`
      SELECT symbol, status, COUNT(*) as count 
      FROM simulations 
      GROUP BY symbol, status 
      ORDER BY symbol, status
    `);
    
    if (dbSimulations.length === 0) {
      console.log('  ✅ 数据库中没有模拟交易记录');
    } else {
      dbSimulations.forEach(sim => {
        console.log(`  ${sim.symbol}: ${sim.status} - ${sim.count}条记录`);
      });
    }
    
    const totalDbSimulations = await dbManager.runQuery('SELECT COUNT(*) as count FROM simulations');
    console.log(`  📈 总计: ${totalDbSimulations[0].count}条记录`);
    
    // 2. 检查监控数据
    console.log('\n📊 监控数据统计:');
    const monitoringData = await fetchMonitoringData();
    
    if (monitoringData) {
      console.log(`  数据收集率: ${monitoringData.summary.completionRates.dataCollection}%`);
      console.log(`  信号分析率: ${monitoringData.summary.completionRates.signalAnalysis}%`);
      console.log(`  模拟交易完成率: ${monitoringData.summary.completionRates.simulationTrading}%`);
      
      // 3. 检查详细统计
      console.log('\n📊 各交易对模拟交易统计:');
      let totalTriggers = 0;
      let totalCompletions = 0;
      
      monitoringData.detailedStats.forEach(stats => {
        const simStats = stats.simulationCompletion;
        if (simStats.triggers > 0 || simStats.completions > 0) {
          console.log(`  ${stats.symbol}: 触发${simStats.triggers}次, 完成${simStats.completions}次 (${simStats.rate}%)`);
          totalTriggers += simStats.triggers;
          totalCompletions += simStats.completions;
        }
      });
      
      console.log(`\n📈 总计: 触发${totalTriggers}次, 完成${totalCompletions}次`);
      
      // 4. 数据一致性检查
      console.log('\n🔍 数据一致性检查:');
      const dbCount = totalDbSimulations[0].count;
      const monitoringCompletions = totalCompletions;
      
      if (dbCount === 0 && monitoringCompletions === 0) {
        console.log('  ✅ 数据一致: 数据库和监控数据都显示无模拟交易记录');
      } else if (dbCount > 0 && monitoringCompletions > 0) {
        console.log('  ✅ 数据一致: 数据库和监控数据都有模拟交易记录');
      } else {
        console.log('  ❌ 数据不一致:');
        console.log(`    数据库记录数: ${dbCount}`);
        console.log(`    监控完成数: ${monitoringCompletions}`);
        console.log('  💡 建议: 重置监控数据或检查数据同步逻辑');
      }
      
    } else {
      console.log('  ❌ 无法获取监控数据');
    }
    
    // 5. 检查数据质量问题
    console.log('\n🔍 数据质量问题检查:');
    const dataQualityIssues = await dbManager.runQuery(`
      SELECT issue_type, COUNT(*) as count 
      FROM data_quality_issues 
      WHERE timestamp > datetime('now', '-1 day')
      GROUP BY issue_type
    `);
    
    if (dataQualityIssues.length === 0) {
      console.log('  ✅ 最近24小时内无数据质量问题');
    } else {
      dataQualityIssues.forEach(issue => {
        console.log(`  ⚠️ ${issue.issue_type}: ${issue.count}个问题`);
      });
    }
    
    console.log('\n✅ 模拟交易数据验证完成！');
    
  } catch (error) {
    console.error('❌ 验证失败:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

async function fetchMonitoringData() {
  try {
    const response = await fetch('http://localhost:8080/api/monitoring-dashboard');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.warn('⚠️ 无法获取监控数据:', error.message);
    return null;
  }
}

// 运行验证
validateSimulationData();
