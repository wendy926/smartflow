// diagnose-monitoring-issues.js
// 诊断监控中心显示为空和ATR值为空的问题

const DatabaseManager = require('./modules/database/DatabaseManager');

class MonitoringDiagnostic {
  constructor() {
    this.db = null;
  }

  async init() {
    this.db = new DatabaseManager();
    await this.db.init();
    console.log('✅ 数据库连接初始化完成');
  }

  /**
   * 诊断监控中心数据问题
   */
  async diagnoseMonitoringData() {
    try {
      console.log('🔍 开始诊断监控中心数据问题...');

      // 1. 检查交易对数据
      const symbols = await this.db.getCustomSymbols();
      console.log(`📊 数据库中的交易对数量: ${symbols.length}`);
      console.log('📊 交易对列表:', symbols);

      // 2. 检查K线数据
      console.log('\n🔍 检查K线数据状态:');
      for (const symbol of symbols.slice(0, 5)) { // 只检查前5个
        const kline4hCount = await this.db.runQuery(`
          SELECT COUNT(*) as count FROM kline_data 
          WHERE symbol = ? AND interval = '4h'
        `, [symbol]);
        
        const kline1hCount = await this.db.runQuery(`
          SELECT COUNT(*) as count FROM kline_data 
          WHERE symbol = ? AND interval = '1h'
        `, [symbol]);

        console.log(`  ${symbol}: 4H数据=${kline4hCount[0].count}, 1H数据=${kline1hCount[0].count}`);
      }

      // 3. 检查策略分析数据
      console.log('\n🔍 检查策略分析数据状态:');
      for (const symbol of symbols.slice(0, 5)) {
        const analysisCount = await this.db.runQuery(`
          SELECT COUNT(*) as count FROM strategy_analysis 
          WHERE symbol = ?
        `, [symbol]);
        
        console.log(`  ${symbol}: 策略分析记录=${analysisCount[0].count}`);
      }

      // 4. 检查告警数据
      console.log('\n🔍 检查告警数据状态:');
      const alertCount = await this.db.runQuery(`
        SELECT COUNT(*) as count FROM alert_history
      `);
      console.log(`  总告警数量: ${alertCount[0].count}`);

      // 5. 模拟监控API调用
      console.log('\n🔍 模拟监控API调用:');
      const detailedStats = [];
      let totalAlerts = 0;
      let dataCollectionSuccess = 0;
      let signalAnalysisSuccess = 0;

      for (const symbol of symbols) {
        // 获取数据收集状态
        const klineCount4h = await this.db.runQuery(`
          SELECT COUNT(*) as count FROM kline_data 
          WHERE symbol = ? AND interval = '4h'
        `, [symbol]);
        
        const klineCount1h = await this.db.runQuery(`
          SELECT COUNT(*) as count FROM kline_data 
          WHERE symbol = ? AND interval = '1h'
        `, [symbol]);

        const hasData = klineCount4h[0].count > 0 && klineCount1h[0].count > 0;
        if (hasData) dataCollectionSuccess++;

        // 获取信号分析状态
        const analysisCount = await this.db.runQuery(`
          SELECT COUNT(*) as count FROM strategy_analysis 
          WHERE symbol = ?
        `, [symbol]);

        const hasAnalysis = analysisCount[0].count > 0;
        if (hasAnalysis) signalAnalysisSuccess++;

        // 获取告警数量
        const alertCount = await this.db.runQuery(`
          SELECT COUNT(*) as count FROM alert_history 
          WHERE symbol = ?
        `, [symbol]);

        totalAlerts += alertCount[0].count;

        detailedStats.push({
          symbol,
          dataCollection: {
            rate: hasData ? 100 : 0,
            attempts: 1,
            successes: hasData ? 1 : 0,
            lastTime: Date.now()
          },
          signalAnalysis: {
            rate: hasAnalysis ? 100 : 0,
            attempts: 1,
            successes: hasAnalysis ? 1 : 0,
            lastTime: Date.now()
          },
          simulationCompletion: {
            rate: 100,
            triggers: 0,
            completions: 0
          }
        });
      }

      const dataCollectionRate = symbols.length > 0 ? (dataCollectionSuccess / symbols.length) * 100 : 0;
      const signalAnalysisRate = symbols.length > 0 ? (signalAnalysisSuccess / symbols.length) * 100 : 0;

      console.log(`\n📊 计算结果:`);
      console.log(`  数据收集率: ${dataCollectionRate.toFixed(2)}% (${dataCollectionSuccess}/${symbols.length})`);
      console.log(`  信号分析率: ${signalAnalysisRate.toFixed(2)}% (${signalAnalysisSuccess}/${symbols.length})`);
      console.log(`  总告警数: ${totalAlerts}`);
      console.log(`  detailedStats长度: ${detailedStats.length}`);

      return {
        symbols,
        dataCollectionRate,
        signalAnalysisRate,
        totalAlerts,
        detailedStats
      };

    } catch (error) {
      console.error('❌ 诊断监控数据失败:', error);
      throw error;
    }
  }

  /**
   * 诊断ATR值问题
   */
  async diagnoseATRData() {
    try {
      console.log('\n🔍 开始诊断ATR值问题...');

      // 1. 检查模拟交易记录中的ATR值
      const simulations = await this.db.runQuery(`
        SELECT symbol, entry_price, stop_loss_price, atr_value, atr14, created_at
        FROM simulations 
        WHERE status = 'ACTIVE'
        ORDER BY created_at DESC
      `);

      console.log(`📊 找到 ${simulations.length} 条进行中的模拟交易记录`);
      
      let atrValueCount = 0;
      let atr14Count = 0;

      for (const sim of simulations) {
        if (sim.atr_value) atrValueCount++;
        if (sim.atr14) atr14Count++;
        
        console.log(`  ${sim.symbol}: atr_value=${sim.atr_value}, atr14=${sim.atr14}`);
      }

      console.log(`\n📊 ATR统计:`);
      console.log(`  atr_value有值的记录: ${atrValueCount}/${simulations.length}`);
      console.log(`  atr14有值的记录: ${atr14Count}/${simulations.length}`);

      // 2. 检查K线数据是否足够计算ATR
      console.log('\n🔍 检查K线数据是否足够计算ATR:');
      for (const sim of simulations.slice(0, 3)) {
        const kline15mCount = await this.db.runQuery(`
          SELECT COUNT(*) as count FROM kline_data 
          WHERE symbol = ? AND interval = '15m'
        `, [sim.symbol]);

        console.log(`  ${sim.symbol}: 15分钟K线数据=${kline15mCount[0].count} (需要至少15根)`);
      }

      return {
        totalSimulations: simulations.length,
        atrValueCount,
        atr14Count,
        simulations
      };

    } catch (error) {
      console.error('❌ 诊断ATR数据失败:', error);
      throw error;
    }
  }

  /**
   * 运行完整的诊断
   */
  async runFullDiagnosis() {
    try {
      const monitoringResult = await this.diagnoseMonitoringData();
      const atrResult = await this.diagnoseATRData();

      console.log('\n🎯 诊断总结:');
      console.log('='.repeat(50));
      console.log('📊 监控中心问题:');
      console.log(`  交易对数量: ${monitoringResult.symbols.length}`);
      console.log(`  数据收集率: ${monitoringResult.dataCollectionRate.toFixed(2)}%`);
      console.log(`  信号分析率: ${monitoringResult.signalAnalysisRate.toFixed(2)}%`);
      console.log(`  详细统计数量: ${monitoringResult.detailedStats.length}`);
      
      console.log('\n📊 ATR值问题:');
      console.log(`  总模拟交易数: ${atrResult.totalSimulations}`);
      console.log(`  atr_value有值: ${atrResult.atrValueCount}/${atrResult.totalSimulations}`);
      console.log(`  atr14有值: ${atrResult.atr14Count}/${atrResult.totalSimulations}`);

    } catch (error) {
      console.error('❌ 诊断过程失败:', error);
      throw error;
    }
  }

  async close() {
    if (this.db) {
      await this.db.close();
      console.log('✅ 数据库连接已关闭');
    }
  }
}

// 主函数
async function main() {
  const diagnostic = new MonitoringDiagnostic();
  
  try {
    await diagnostic.init();
    await diagnostic.runFullDiagnosis();
  } catch (error) {
    console.error('❌ 诊断失败:', error);
    process.exit(1);
  } finally {
    await diagnostic.close();
  }
}

// 运行诊断脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = MonitoringDiagnostic;
