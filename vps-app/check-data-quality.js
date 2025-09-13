const SafeDatabaseManager = require('./modules/database/SafeDatabaseManager');
const EnhancedDataQualityMonitor = require('./modules/monitoring/EnhancedDataQualityMonitor');
const StrategyV3Core = require('./modules/strategy/StrategyV3Core');

/**
 * 数据质量检查脚本
 * 检查所有交易对的MA数据时效性和计算质量
 */
async function checkDataQuality() {
  const safeDB = new SafeDatabaseManager();
  const qualityMonitor = new EnhancedDataQualityMonitor(safeDB.database);

  try {
    await safeDB.init();
    console.log('🚀 开始数据质量检查...\n');

    // 获取所有交易对
    const symbols = [
      'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT', 'SOLUSDT',
      'DOGEUSDT', 'TRXUSDT', 'MATICUSDT', 'DOTUSDT', 'AVAXUSDT', 'LINKUSDT'
    ];

    const results = {
      total: 0,
      healthy: 0,
      warnings: 0,
      errors: 0,
      issues: []
    };

    console.log('📊 检查K线数据时效性...');
    for (const symbol of symbols) {
      console.log(`\n🔍 检查 ${symbol}...`);

      // 1. 检查K线数据时效性
      const klineCheck = await qualityMonitor.performComprehensiveCheck(symbol);
      if (klineCheck) {
        results.total++;
        if (klineCheck.overallStatus === 'HEALTHY') {
          results.healthy++;
          console.log(`✅ ${symbol}: 数据质量正常`);
        } else if (klineCheck.overallStatus === 'WARNING') {
          results.warnings++;
          console.log(`⚠️ ${symbol}: 数据质量警告`);
          results.issues.push(`${symbol}: ${klineCheck.overallStatus}`);
        } else {
          results.errors++;
          console.log(`❌ ${symbol}: 数据质量错误`);
          results.issues.push(`${symbol}: ${klineCheck.overallStatus}`);
        }
      }

      // 2. 检查MA计算结果质量
      const strategyCore = await safeDB.createStrategyInstance(StrategyV3Core);
      const trendResult = await strategyCore.analyze4HTrend(symbol);
      await strategyCore.destroy();

      if (trendResult && !trendResult.error) {
        console.log(`   MA20: ${trendResult.ma20?.toFixed(2) || 'N/A'}`);
        console.log(`   MA50: ${trendResult.ma50?.toFixed(2) || 'N/A'}`);
        console.log(`   MA200: ${trendResult.ma200?.toFixed(2) || 'N/A'}`);
        console.log(`   趋势: ${trendResult.trend4h}`);
        console.log(`   得分: 多头${trendResult.bullScore}, 空头${trendResult.bearScore}, 总分${trendResult.score}`);

        // 验证MA数据合理性
        if (trendResult.ma20 && trendResult.ma50 && trendResult.ma200) {
          const currentPrice = trendResult.ma20 * 1.1; // 假设当前价格接近MA20
          const maQualityCheck = await qualityMonitor.checkMACalculationQuality(
            symbol,
            trendResult.ma20,
            trendResult.ma50,
            trendResult.ma200,
            currentPrice
          );

          if (!maQualityCheck.isValid) {
            console.log(`   ⚠️ MA数据质量问题: ${maQualityCheck.issues.join(', ')}`);
            results.issues.push(`${symbol} MA: ${maQualityCheck.issues.join(', ')}`);
          }
        }
      } else {
        console.log(`   ❌ 趋势分析失败: ${trendResult?.error || '未知错误'}`);
        results.issues.push(`${symbol}: 趋势分析失败`);
      }

      // 避免请求过于频繁
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n' + '='.repeat(60));
    console.log('📋 数据质量检查报告');
    console.log('='.repeat(60));

    console.log(`\n📊 总体统计:`);
    console.log(`   总检查数: ${results.total}`);
    console.log(`   正常: ${results.healthy}`);
    console.log(`   警告: ${results.warnings}`);
    console.log(`   错误: ${results.errors}`);
    console.log(`   健康率: ${((results.healthy / results.total) * 100).toFixed(1)}%`);

    if (results.issues.length > 0) {
      console.log(`\n⚠️ 发现的问题:`);
      results.issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
    } else {
      console.log(`\n🎉 未发现数据质量问题！`);
    }

    // 获取数据质量报告
    console.log(`\n📈 详细数据质量报告:`);
    const qualityReport = await qualityMonitor.getDataQualityReport();
    if (qualityReport) {
      console.log(`   24小时内总问题数: ${qualityReport.totalIssues}`);
      Object.entries(qualityReport.groupedIssues).forEach(([type, issues]) => {
        console.log(`   ${type}: ${issues.length}个`);
      });
    }

    console.log('\n' + '='.repeat(60));

    return {
      success: results.errors === 0,
      results,
      qualityReport
    };

  } catch (error) {
    console.error('❌ 数据质量检查失败:', error.message);
    return {
      success: false,
      error: error.message
    };
  } finally {
    await safeDB.close();
  }
}

// 运行检查
checkDataQuality().then(result => {
  if (result.success) {
    console.log('\n🎉 数据质量检查完成！');
    process.exit(0);
  } else {
    console.log('\n⚠️ 发现数据质量问题，请检查！');
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ 检查执行失败:', error.message);
  process.exit(1);
});
