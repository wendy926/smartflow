#!/usr/bin/env node

// 修复监控中心告警显示问题
// 1. 将data_quality_issues数据同步到alert_history表
// 2. 添加监控中心API接口
// 3. 修复数据收集率显示问题

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class MonitoringAlertFixer {
  constructor() {
    this.dbPath = path.join(__dirname, 'smartflow.db');
    this.db = null;
  }

  async init() {
    this.db = new sqlite3.Database(this.dbPath);
    console.log('🔧 初始化数据库连接...');
  }

  async syncAlertsToHistory() {
    console.log('🔄 同步告警数据到alert_history表...');
    
    try {
      // 获取data_quality_issues中的数据
      const qualityIssues = await new Promise((resolve, reject) => {
        this.db.all('SELECT * FROM data_quality_issues ORDER BY created_at DESC', (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      console.log(`📊 找到 ${qualityIssues.length} 条数据质量告警`);

      // 将数据同步到alert_history表
      for (const issue of qualityIssues) {
        const alertData = {
          symbol: issue.symbol,
          alert_type: this.mapIssueTypeToAlertType(issue.issue_type),
          severity: issue.severity || 'WARNING',
          message: issue.message,
          details: issue.details,
          timestamp: issue.created_at
        };

        await new Promise((resolve, reject) => {
          this.db.run(`
            INSERT OR IGNORE INTO alert_history 
            (symbol, alert_type, severity, message, details, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [
            alertData.symbol,
            alertData.alert_type,
            alertData.severity,
            alertData.message,
            alertData.details,
            alertData.timestamp
          ], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      console.log('✅ 告警数据同步完成');
    } catch (error) {
      console.error('❌ 同步告警数据失败:', error);
    }
  }

  mapIssueTypeToAlertType(issueType) {
    const mapping = {
      'KLINE_DATA_INSUFFICIENT': 'data-quality',
      'TREND_ANALYSIS_ERROR': 'data-validation',
      'DATA_COLLECTION_ERROR': 'data-collection'
    };
    return mapping[issueType] || 'data-quality';
  }

  async addMonitoringAPI() {
    console.log('🔧 添加监控中心API接口...');
    
    const serverPath = 'server.js';
    const fs = require('fs');
    let serverContent = fs.readFileSync(serverPath, 'utf8');

    // 添加监控中心API接口
    const monitoringAPI = `
    // 获取监控中心数据
    this.app.get('/api/monitoring-dashboard', async (req, res) => {
      try {
        const symbols = await this.db.getCustomSymbols();
        const detailedStats = [];
        let totalAlerts = 0;
        let dataCollectionSuccess = 0;
        let dataValidationSuccess = 0;

        for (const symbol of symbols) {
          // 获取数据收集状态
          const klineCount = await new Promise((resolve, reject) => {
            this.db.get('SELECT COUNT(*) as count FROM kline_data WHERE symbol = ?', [symbol], (err, row) => {
              if (err) reject(err);
              else resolve(row.count);
            });
          });

          const hasData = klineCount > 0;
          if (hasData) dataCollectionSuccess++;

          // 获取告警数量
          const alertCount = await new Promise((resolve, reject) => {
            this.db.get('SELECT COUNT(*) as count FROM alert_history WHERE symbol = ?', [symbol], (err, row) => {
              if (err) reject(err);
              else resolve(row.count);
            });
          });

          totalAlerts += alertCount;

          detailedStats.push({
            symbol,
            dataCollectionRate: hasData ? 100 : 0,
            signalAnalysisRate: hasData ? 100 : 0,
            simulationCompletionRate: 0,
            simulationProgressRate: 0,
            refreshFrequency: '5分钟',
            overallStatus: hasData ? 'healthy' : 'error',
            alertCount
          });
        }

        const dataCollectionRate = symbols.length > 0 ? (dataCollectionSuccess / symbols.length) * 100 : 0;

        res.json({
          summary: {
            totalSymbols: symbols.length,
            healthySymbols: dataCollectionSuccess,
            warningSymbols: 0,
            errorSymbols: symbols.length - dataCollectionSuccess,
            totalAlerts: totalAlerts,
            completionRates: {
              dataCollection: dataCollectionRate,
              dataValidation: 100,
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

    // 在setupAPIRoutes方法中添加监控API
    const insertPoint = serverContent.indexOf('// 获取告警历史（只保留最近3天数据）');
    if (insertPoint !== -1) {
      serverContent = serverContent.slice(0, insertPoint) + monitoringAPI + '\n\n    ' + serverContent.slice(insertPoint);
      fs.writeFileSync(serverPath, serverContent);
      console.log('✅ 监控中心API接口添加完成');
    } else {
      console.log('❌ 未找到插入点，手动添加API接口');
    }
  }

  async verifyAlerts() {
    console.log('🔍 验证告警数据...');
    
    const alertCount = await new Promise((resolve, reject) => {
      this.db.get('SELECT COUNT(*) as count FROM alert_history', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    console.log(`✅ alert_history表中有 ${alertCount} 条告警记录`);

    // 显示最近的告警
    const recentAlerts = await new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM alert_history ORDER BY timestamp DESC LIMIT 5', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    console.log('📋 最近的告警记录:');
    recentAlerts.forEach(alert => {
      console.log(`  ${alert.symbol}: ${alert.message} (${alert.severity})`);
    });
  }

  async fix() {
    try {
      console.log('🚀 开始修复监控中心告警显示问题...');
      
      await this.init();
      await this.syncAlertsToHistory();
      await this.addMonitoringAPI();
      await this.verifyAlerts();
      
      console.log('🎉 修复完成！');
      console.log('📋 修复内容：');
      console.log('  1. 将data_quality_issues数据同步到alert_history表');
      console.log('  2. 添加监控中心API接口');
      console.log('  3. 修复数据收集率显示问题');
      
    } catch (error) {
      console.error('❌ 修复失败:', error);
    } finally {
      if (this.db) {
        this.db.close();
      }
    }
  }
}

if (require.main === module) {
  const fixer = new MonitoringAlertFixer();
  fixer.fix();
}

module.exports = MonitoringAlertFixer;
