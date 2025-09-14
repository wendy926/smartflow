// check-data-collection-health.js
// 数据收集健康检查工具

const fetch = require('node-fetch');

async function checkDataCollectionHealth() {
  try {
    console.log('🔍 检查数据收集健康状态...\n');

    // 获取所有信号数据
    const signalsResponse = await fetch('http://localhost:8080/api/signals');
    const signals = await signalsResponse.json();

    // 获取监控数据
    const monitoringResponse = await fetch('http://localhost:8080/api/monitoring-dashboard');
    const monitoring = await monitoringResponse.json();

    console.log('📊 数据收集健康状态报告');
    console.log('='.repeat(50));

    // 统计信息
    const totalSymbols = signals.length;
    let healthyCount = 0;
    let warningCount = 0;
    let errorCount = 0;

    console.log(`\n📈 总体统计:`);
    console.log(`- 总交易对数: ${totalSymbols}`);
    console.log(`- 主页API数据收集率: ${monitoring.summary.completionRates.dataCollection}%`);
    console.log(`- 监控API数据收集率: ${monitoring.summary.completionRates.dataCollection}%`);

    console.log(`\n📋 各交易对详细状态:`);
    console.log('-'.repeat(80));
    console.log('交易对'.padEnd(12) + '主页API'.padEnd(10) + '监控API'.padEnd(15) + '状态'.padEnd(10) + '备注');
    console.log('-'.repeat(80));

    signals.forEach((signal, index) => {
      const monitoringStats = monitoring.detailedStats.find(s => s.symbol === signal.symbol);
      const homeRate = signal.dataCollectionRate;
      const monitoringRate = monitoringStats?.dataCollection?.rate || 0;
      const attempts = monitoringStats?.dataCollection?.attempts || 0;
      const successes = monitoringStats?.dataCollection?.successes || 0;

      let status = '❌ 错误';
      let note = '';

      if (homeRate >= 95) {
        status = '✅ 健康';
        healthyCount++;
      } else if (homeRate >= 80) {
        status = '⚠️ 警告';
        warningCount++;
      } else {
        errorCount++;
      }

      if (attempts === 0) {
        note = '无统计数据';
        status = '❌ 错误';
        errorCount++;
        healthyCount = Math.max(0, healthyCount - 1);
      } else if (monitoringRate !== homeRate) {
        note = '数据不一致';
      }

      console.log(
        signal.symbol.padEnd(12) +
        `${homeRate}%`.padEnd(10) +
        `${monitoringRate}%`.padEnd(15) +
        status.padEnd(10) +
        note
      );
    });

    console.log('-'.repeat(80));
    console.log(`\n📊 健康状态汇总:`);
    console.log(`- ✅ 健康: ${healthyCount} 个`);
    console.log(`- ⚠️ 警告: ${warningCount} 个`);
    console.log(`- ❌ 错误: ${errorCount} 个`);

    // 建议
    console.log(`\n💡 建议:`);
    if (errorCount > 0) {
      console.log(`- 有 ${errorCount} 个交易对数据收集异常，建议检查API调用`);
    }
    if (monitoring.summary.completionRates.dataCollection === 0) {
      console.log(`- 监控API显示数据收集率为0%，建议检查数据收集统计逻辑`);
    }
    if (healthyCount === totalSymbols) {
      console.log(`- 所有交易对数据收集正常 ✅`);
    }

  } catch (error) {
    console.error('❌ 检查失败:', error.message);
  }
}

// 运行检查
checkDataCollectionHealth();
