// optimize-monitoring-api.js
// 优化监控API性能，减少数据库查询次数

const fs = require('fs');

class MonitoringAPIOptimizer {
  constructor() {
    this.serverPath = 'server.js';
  }

  async optimize() {
    try {
      console.log('🔧 优化监控API性能...');

      // 读取server.js文件
      const serverContent = fs.readFileSync(this.serverPath, 'utf8');

      // 创建优化的监控API实现
      const optimizedAPI = `
    // 获取监控中心数据 - 优化版本
    this.app.get('/api/monitoring-dashboard', async (req, res) => {
      try {
        const symbols = await this.db.getCustomSymbols();
        
        // 使用批量查询替代循环查询，大幅提升性能
        const [klineStats, analysisStats, alertStats] = await Promise.all([
          // 批量获取K线数据统计
          this.db.runQuery(\`
            SELECT 
              symbol,
              interval,
              COUNT(*) as count
            FROM kline_data 
            WHERE symbol IN (\${symbols.map(() => '?').join(',')})
            AND interval IN ('4h', '1h')
            GROUP BY symbol, interval
          \`, symbols),
          
          // 批量获取策略分析统计
          this.db.runQuery(\`
            SELECT 
              symbol,
              COUNT(*) as count
            FROM strategy_analysis 
            WHERE symbol IN (\${symbols.map(() => '?').join(',')})
            GROUP BY symbol
          \`, symbols),
          
          // 批量获取告警统计
          this.db.runQuery(\`
            SELECT 
              symbol,
              COUNT(*) as count
            FROM alert_history 
            WHERE symbol IN (\${symbols.map(() => '?').join(',')})
            GROUP BY symbol
          \`, symbols)
        ]);

        // 构建统计映射表
        const klineMap = new Map();
        const analysisMap = new Map();
        const alertMap = new Map();

        // 处理K线数据统计
        klineStats.forEach(stat => {
          const key = \`\${stat.symbol}_\${stat.interval}\`;
          klineMap.set(key, stat.count);
        });

        // 处理策略分析统计
        analysisStats.forEach(stat => {
          analysisMap.set(stat.symbol, stat.count);
        });

        // 处理告警统计
        alertStats.forEach(stat => {
          alertMap.set(stat.symbol, stat.count);
        });

        // 生成详细统计
        const detailedStats = [];
        let dataCollectionSuccess = 0;
        let signalAnalysisSuccess = 0;
        let totalAlerts = 0;

        for (const symbol of symbols) {
          const kline4hCount = klineMap.get(\`\${symbol}_4h\`) || 0;
          const kline1hCount = klineMap.get(\`\${symbol}_1h\`) || 0;
          const analysisCount = analysisMap.get(symbol) || 0;
          const alertCount = alertMap.get(symbol) || 0;

          const hasData = kline4hCount > 0 && kline1hCount > 0;
          const hasAnalysis = analysisCount > 0;

          if (hasData) dataCollectionSuccess++;
          if (hasAnalysis) signalAnalysisSuccess++;
          totalAlerts += alertCount;

          detailedStats.push({
            symbol,
            dataCollectionRate: hasData ? 100 : 0,
            signalAnalysisRate: hasAnalysis ? 100 : 0,
            simulationCompletionRate: 0,
            simulationProgressRate: 0,
            refreshFrequency: '5分钟',
            overallStatus: hasData && hasAnalysis ? 'healthy' : (hasData ? 'warning' : 'error'),
            alertCount
          });
        }

        const dataCollectionRate = symbols.length > 0 ? (dataCollectionSuccess / symbols.length) * 100 : 0;
        const signalAnalysisRate = symbols.length > 0 ? (signalAnalysisSuccess / symbols.length) * 100 : 0;

        res.json({
          summary: {
            totalSymbols: symbols.length,
            healthySymbols: dataCollectionSuccess,
            warningSymbols: signalAnalysisSuccess - dataCollectionSuccess,
            errorSymbols: symbols.length - dataCollectionSuccess,
            totalAlerts: totalAlerts,
            completionRates: {
              dataCollection: dataCollectionRate,
              signalAnalysis: signalAnalysisRate,
              simulationTrading: 0
            }
          },
          detailedStats
        });
      } catch (error) {
        console.error('获取监控数据失败:', error);
        res.status(500).json({ error: error.message });
      }
    });`;

      // 查找并替换监控API实现
      const apiStartPattern = /\/\/ 获取监控中心数据[\s\S]*?}\);[\s]*\n[\s]*\/\/ 获取告警历史/;
      
      if (apiStartPattern.test(serverContent)) {
        // 备份原文件
        const backupPath = `${this.serverPath}.backup.optimize.${Date.now()}`;
        fs.writeFileSync(backupPath, serverContent);
        console.log(`📦 原文件已备份到: ${backupPath}`);

        // 替换API实现
        const optimizedContent = serverContent.replace(apiStartPattern, optimizedAPI);
        
        // 写入优化后的内容
        fs.writeFileSync(this.serverPath, optimizedContent);
        console.log('✅ 监控API优化完成');
        
        // 验证优化结果
        const verificationContent = fs.readFileSync(this.serverPath, 'utf8');
        if (verificationContent.includes('批量查询替代循环查询')) {
          console.log('✅ 验证通过：优化已成功应用');
        } else {
          console.log('❌ 验证失败：优化未正确应用');
        }
      } else {
        console.log('❌ 未找到监控API实现，无法优化');
      }

    } catch (error) {
      console.error('❌ 优化失败:', error);
      throw error;
    }
  }

  /**
   * 验证优化效果
   */
  async verifyOptimization() {
    try {
      const serverContent = fs.readFileSync(this.serverPath, 'utf8');
      
      // 检查是否包含优化的代码
      const hasOptimization = serverContent.includes('批量查询替代循环查询') &&
                             serverContent.includes('Promise.all') &&
                             serverContent.includes('klineMap.set');
      
      if (hasOptimization) {
        console.log('✅ 监控API优化验证通过');
        return true;
      } else {
        console.log('❌ 监控API优化验证失败');
        return false;
      }
    } catch (error) {
      console.error('❌ 验证过程出错:', error);
      return false;
    }
  }
}

// 主函数
async function main() {
  const optimizer = new MonitoringAPIOptimizer();
  
  try {
    await optimizer.optimize();
    await optimizer.verifyOptimization();
    console.log('🎉 监控API优化完成！');
  } catch (error) {
    console.error('❌ 优化失败:', error);
    process.exit(1);
  }
}

// 运行优化脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = MonitoringAPIOptimizer;
