#!/usr/bin/env node

/**
 * 诊断监控中心问题
 * 检查为什么MA数据为空但监控中心没有显示异常
 */

const DatabaseManager = require('./modules/database/DatabaseManager.js');
const StrategyV3Core = require('./modules/strategy/StrategyV3Core.js');

async function diagnoseMonitoringIssue() {
  console.log('🔍 开始诊断监控中心问题...\n');

  const db = new DatabaseManager('./smartflow.db');
  await db.init();

  const strategyCore = new StrategyV3Core(db);

  // 1. 检查数据库连接
  console.log('✅ 数据库连接正常');

  // 2. 检查交易对数据
  const symbols = await db.getCustomSymbols();
  console.log(`📊 发现 ${symbols.length} 个交易对`);

  // 3. 检查K线数据
  console.log('\n🔍 检查K线数据状态:');
  for (const symbol of symbols.slice(0, 3)) {
    try {
      const klines = await strategyCore.getKlineData(symbol, '4h', 50);
      if (klines && klines.length > 0) {
        console.log(`  ✅ ${symbol}: ${klines.length} 条数据`);
      } else {
        console.log(`  ❌ ${symbol}: 无数据`);
      }
    } catch (error) {
      console.log(`  ❌ ${symbol}: 错误 - ${error.message}`);
    }
  }

  // 4. 检查MA计算
  console.log('\n🔍 检查MA计算状态:');
  const testSymbol = symbols[0];
  try {
    const klines = await strategyCore.getKlineData(testSymbol, '4h', 50);
    const ma20 = strategyCore.calculateMA(klines, 20);
    const ma50 = strategyCore.calculateMA(klines, 50);

    console.log(`  ✅ ${testSymbol} MA计算:`);
    console.log(`     MA20: ${ma20[ma20.length - 1]?.toFixed(4) || 'null'}`);
    console.log(`     MA50: ${ma50[ma50.length - 1]?.toFixed(4) || 'null'}`);
  } catch (error) {
    console.log(`  ❌ ${testSymbol} MA计算失败: ${error.message}`);
  }

  // 5. 检查策略分析表
  console.log('\n🔍 检查策略分析表状态:');
  try {
    const analysisCount = await db.runQuery('SELECT COUNT(*) as count FROM strategy_v3_analysis');
    const latestAnalysis = await db.runQuery('SELECT MAX(created_at) as latest FROM strategy_v3_analysis');

    console.log(`  📊 策略分析记录总数: ${analysisCount[0].count}`);
    console.log(`  📅 最新分析时间: ${latestAnalysis[0].latest || '无记录'}`);

    if (analysisCount[0].count === 0) {
      console.log('  ❌ 策略分析表为空 - 这是问题所在！');
    }
  } catch (error) {
    console.log(`  ❌ 策略分析表检查失败: ${error.message}`);
  }

  // 6. 检查监控统计表
  console.log('\n🔍 检查监控统计表状态:');
  try {
    const statsCount = await db.runQuery('SELECT COUNT(*) as count FROM monitoring_stats');
    const latestStats = await db.runQuery('SELECT MAX(updated_at) as latest FROM monitoring_stats');

    console.log(`  📊 监控统计记录总数: ${statsCount[0].count}`);
    console.log(`  📅 最新更新时间: ${latestStats[0].latest || '无记录'}`);

    const now = new Date();
    const latestTime = new Date(latestStats[0].latest);
    const daysDiff = Math.floor((now - latestTime) / (1000 * 60 * 60 * 24));

    if (daysDiff > 1) {
      console.log(`  ❌ 监控数据过期 ${daysDiff} 天 - 这是问题所在！`);
    }
  } catch (error) {
    console.log(`  ❌ 监控统计表检查失败: ${error.message}`);
  }

  // 7. 检查数据质量问题表
  console.log('\n🔍 检查数据质量问题表:');
  try {
    const qualityIssues = await db.runQuery('SELECT COUNT(*) as count FROM data_quality_issues WHERE created_at > datetime("now", "-1 day")');
    console.log(`  📊 最近24小时数据质量问题: ${qualityIssues[0].count} 个`);

    if (qualityIssues[0].count > 0) {
      const recentIssues = await db.runQuery('SELECT symbol, issue_type, description FROM data_quality_issues WHERE created_at > datetime("now", "-1 day") ORDER BY created_at DESC LIMIT 5');
      console.log('  🚨 最近的数据质量问题:');
      recentIssues.forEach(issue => {
        console.log(`     ${issue.symbol}: ${issue.issue_type} - ${issue.description}`);
      });
    }
  } catch (error) {
    console.log(`  ❌ 数据质量问题表检查失败: ${error.message}`);
  }

  // 8. 尝试运行策略分析
  console.log('\n🔍 尝试运行策略分析:');
  try {
    const testSymbol = symbols[0];
    console.log(`  正在分析 ${testSymbol}...`);

    const analysisResult = await strategyCore.analyzeSymbol(testSymbol);

    if (analysisResult) {
      console.log(`  ✅ ${testSymbol} 分析成功`);
      console.log(`     趋势: ${analysisResult.trend4h}`);
      console.log(`     市场类型: ${analysisResult.market_type}`);
      console.log(`     信号: ${analysisResult.signal}`);
    } else {
      console.log(`  ❌ ${testSymbol} 分析失败 - 返回null`);
    }
  } catch (error) {
    console.log(`  ❌ 策略分析失败: ${error.message}`);
    console.log(`     错误堆栈: ${error.stack}`);
  }

  await db.close();

  console.log('\n📋 诊断总结:');
  console.log('  1. 检查数据库连接状态');
  console.log('  2. 检查K线数据可用性');
  console.log('  3. 检查MA计算功能');
  console.log('  4. 检查策略分析表数据');
  console.log('  5. 检查监控统计表更新');
  console.log('  6. 检查数据质量问题记录');
  console.log('  7. 测试策略分析功能');
  console.log('\n🚀 根据以上检查结果确定问题根源');
}

// 如果直接运行此脚本
if (require.main === module) {
  diagnoseMonitoringIssue().catch(console.error);
}

module.exports = { diagnoseMonitoringIssue };
