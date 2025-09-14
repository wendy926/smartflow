const DatabaseManager = require('../database/DatabaseManager');

/**
 * 增强的指标监控系统
 * 负责实时监控所有交易对的关键指标有效性
 */
class EnhancedIndicatorMonitor {
  constructor(database = null) {
    this.database = database || new DatabaseManager();
    this.monitoringInterval = null;
    this.isRunning = false;
    this.alertThresholds = {
      MISSING: 3,      // 连续3次缺失触发告警
      INVALID: 2,      // 连续2次无效触发告警
      ERROR: 1         // 1次错误立即触发告警
    };
  }

  /**
   * 初始化监控系统
   */
  async initialize() {
    try {
      await this.database.init();
      await this.initializeDatabaseSchema();
      console.log('✅ 增强指标监控系统初始化完成');
    } catch (error) {
      console.error('❌ 增强指标监控系统初始化失败:', error);
      throw error;
    }
  }

  /**
   * 初始化数据库结构
   */
  async initializeDatabaseSchema() {
    try {
      // 执行数据库优化脚本
      const fs = require('fs');
      const path = require('path');
      const sqlScript = fs.readFileSync(
        path.join(__dirname, '../../database-schema-optimization.sql'), 
        'utf8'
      );
      
      // 分割SQL语句并执行
      const statements = sqlScript.split(';').filter(stmt => stmt.trim());
      for (const statement of statements) {
        if (statement.trim()) {
          await this.database.run(statement.trim());
        }
      }
      
      console.log('✅ 数据库结构初始化完成');
    } catch (error) {
      console.error('❌ 数据库结构初始化失败:', error);
      throw error;
    }
  }

  /**
   * 开始实时监控
   */
  async startMonitoring(intervalMs = 60000) { // 默认1分钟检查一次
    if (this.isRunning) {
      console.log('⚠️ 监控系统已在运行中');
      return;
    }

    try {
      this.isRunning = true;
      console.log(`🚀 开始实时指标监控，检查间隔: ${intervalMs}ms`);
      
      // 立即执行一次检查
      await this.performHealthCheck();
      
      // 设置定时检查
      this.monitoringInterval = setInterval(async () => {
        try {
          await this.performHealthCheck();
        } catch (error) {
          console.error('❌ 定时健康检查失败:', error);
        }
      }, intervalMs);
      
    } catch (error) {
      console.error('❌ 启动监控失败:', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * 停止监控
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isRunning = false;
    console.log('🛑 指标监控已停止');
  }

  /**
   * 执行健康检查
   */
  async performHealthCheck() {
    try {
      console.log('🔍 开始执行指标健康检查...');
      
      // 获取所有交易对
      const symbols = await this.database.getCustomSymbols();
      const totalSymbols = symbols.length;
      let healthySymbols = 0;
      let unhealthySymbols = 0;
      const symbolHealthDetails = [];

      // 检查每个交易对的指标
      for (const symbol of symbols) {
        try {
          const healthStatus = await this.checkSymbolIndicators(symbol);
          symbolHealthDetails.push({
            symbol,
            healthRate: healthStatus.healthRate,
            issues: healthStatus.issues,
            totalIndicators: healthStatus.totalIndicators,
            validIndicators: healthStatus.validIndicators
          });

          if (healthStatus.healthRate >= 80) {
            healthySymbols++;
          } else {
            unhealthySymbols++;
          }
        } catch (error) {
          console.error(`❌ 检查 ${symbol} 指标失败:`, error.message);
          unhealthySymbols++;
          symbolHealthDetails.push({
            symbol,
            healthRate: 0,
            issues: [`检查失败: ${error.message}`],
            totalIndicators: 0,
            validIndicators: 0
          });
        }
      }

      // 计算整体健康率
      const healthRate = totalSymbols > 0 ? (healthySymbols / totalSymbols) * 100 : 0;

      // 记录系统健康状态
      await this.recordSystemHealth({
        totalSymbols,
        healthySymbols,
        unhealthySymbols,
        healthRate,
        details: JSON.stringify(symbolHealthDetails)
      });

      console.log(`📊 健康检查完成: 总交易对=${totalSymbols}, 健康=${healthySymbols}, 异常=${unhealthySymbols}, 健康率=${healthRate.toFixed(2)}%`);

      // 如果健康率过低，触发告警
      if (healthRate < 70) {
        await this.triggerSystemAlert('LOW_HEALTH_RATE', 'HIGH', 
          `系统健康率过低: ${healthRate.toFixed(2)}%`, {
            healthRate,
            healthySymbols,
            unhealthySymbols,
            totalSymbols
          });
      }

      return {
        totalSymbols,
        healthySymbols,
        unhealthySymbols,
        healthRate,
        details: symbolHealthDetails
      };

    } catch (error) {
      console.error('❌ 健康检查执行失败:', error);
      throw error;
    }
  }

  /**
   * 检查单个交易对的指标
   */
  async checkSymbolIndicators(symbol) {
    try {
      // 获取指标配置
      const indicatorConfigs = await this.database.all(
        'SELECT * FROM indicator_config WHERE is_required = 1'
      );

      const issues = [];
      let validCount = 0;
      let totalCount = 0;

      // 检查每个必需指标
      for (const config of indicatorConfigs) {
        totalCount++;
        const indicatorName = config.indicator_name;
        
        try {
          // 从最新的策略分析结果中获取指标值
          const latestAnalysis = await this.getLatestAnalysis(symbol);
          const indicatorValue = latestAnalysis[indicatorName];
          
          // 验证指标值
          const validation = this.validateIndicator(indicatorName, indicatorValue, config);
          
          // 记录指标状态
          await this.recordIndicatorStatus(symbol, indicatorName, indicatorValue, validation);
          
          if (validation.isValid) {
            validCount++;
          } else {
            issues.push(`${indicatorName}: ${validation.reason}`);
            
            // 检查是否需要触发告警
            await this.checkAndTriggerAlert(symbol, indicatorName, validation);
          }
        } catch (error) {
          issues.push(`${indicatorName}: 检查失败 - ${error.message}`);
          await this.recordIndicatorStatus(symbol, indicatorName, null, {
            isValid: false,
            status: 'ERROR',
            reason: error.message
          });
        }
      }

      const healthRate = totalCount > 0 ? (validCount / totalCount) * 100 : 0;

      return {
        symbol,
        healthRate,
        issues,
        totalIndicators: totalCount,
        validIndicators: validCount
      };

    } catch (error) {
      console.error(`❌ 检查 ${symbol} 指标失败:`, error);
      throw error;
    }
  }

  /**
   * 获取最新的策略分析结果
   */
  async getLatestAnalysis(symbol) {
    try {
      const result = await this.database.get(
        'SELECT * FROM strategy_v3_analysis WHERE symbol = ? ORDER BY timestamp DESC LIMIT 1',
        [symbol]
      );
      
      if (!result) {
        throw new Error('未找到策略分析结果');
      }
      
      return result;
    } catch (error) {
      console.error(`获取 ${symbol} 最新分析失败:`, error);
      throw error;
    }
  }

  /**
   * 验证指标值
   */
  validateIndicator(indicatorName, value, config) {
    // 检查是否为null或undefined
    if (value === null || value === undefined) {
      return {
        isValid: false,
        status: 'MISSING',
        reason: '指标值为空'
      };
    }

    // 检查数值范围
    if (config.min_value !== null && value < config.min_value) {
      return {
        isValid: false,
        status: 'INVALID',
        reason: `值 ${value} 小于最小值 ${config.min_value}`
      };
    }

    if (config.max_value !== null && value > config.max_value) {
      return {
        isValid: false,
        status: 'INVALID',
        reason: `值 ${value} 大于最大值 ${config.max_value}`
      };
    }

    // 检查字符串类型指标
    if (['trendStrength', 'signalStrength'].includes(indicatorName)) {
      if (typeof value !== 'string' || value === 'NONE' || value === '') {
        return {
          isValid: false,
          status: 'INVALID',
          reason: '指标值为无效字符串'
        };
      }
    }

    return {
      isValid: true,
      status: 'VALID',
      reason: '指标值有效'
    };
  }

  /**
   * 记录指标状态
   */
  async recordIndicatorStatus(symbol, indicatorName, value, validation) {
    try {
      await this.database.run(
        `INSERT OR REPLACE INTO indicator_monitoring 
         (symbol, indicator_name, indicator_value, status, error_message, timestamp) 
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [symbol, indicatorName, value, validation.status, validation.reason]
      );
    } catch (error) {
      console.error(`记录指标状态失败 [${symbol}.${indicatorName}]:`, error);
    }
  }

  /**
   * 检查并触发告警
   */
  async checkAndTriggerAlert(symbol, indicatorName, validation) {
    try {
      // 检查连续失败次数
      const recentFailures = await this.database.all(
        `SELECT COUNT(*) as count FROM indicator_monitoring 
         WHERE symbol = ? AND indicator_name = ? AND status != 'VALID' 
         AND timestamp >= datetime('now', '-1 hour')`,
        [symbol, indicatorName]
      );

      const failureCount = recentFailures[0]?.count || 0;
      const threshold = this.alertThresholds[validation.status] || 1;

      if (failureCount >= threshold) {
        await this.triggerIndicatorAlert(symbol, indicatorName, validation, failureCount);
      }
    } catch (error) {
      console.error(`检查告警条件失败 [${symbol}.${indicatorName}]:`, error);
    }
  }

  /**
   * 触发指标告警
   */
  async triggerIndicatorAlert(symbol, indicatorName, validation, failureCount) {
    try {
      const severity = this.determineAlertSeverity(validation.status, failureCount);
      const message = `${symbol} ${indicatorName} 指标异常: ${validation.reason} (连续失败${failureCount}次)`;
      
      await this.database.run(
        `INSERT INTO alert_records 
         (symbol, indicator_name, alert_type, severity, message, details, timestamp) 
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          symbol, 
          indicatorName, 
          validation.status, 
          severity, 
          message, 
          JSON.stringify({
            validation,
            failureCount,
            timestamp: new Date().toISOString()
          })
        ]
      );

      console.log(`🚨 指标告警: ${message}`);
    } catch (error) {
      console.error(`触发指标告警失败 [${symbol}.${indicatorName}]:`, error);
    }
  }

  /**
   * 触发系统告警
   */
  async triggerSystemAlert(alertType, severity, message, details) {
    try {
      await this.database.run(
        `INSERT INTO alert_records 
         (alert_type, severity, message, details, timestamp) 
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [alertType, severity, message, JSON.stringify(details)]
      );

      console.log(`🚨 系统告警: ${message}`);
    } catch (error) {
      console.error(`触发系统告警失败:`, error);
    }
  }

  /**
   * 确定告警严重程度
   */
  determineAlertSeverity(status, failureCount) {
    switch (status) {
      case 'ERROR':
        return 'HIGH';
      case 'MISSING':
        return failureCount >= 5 ? 'HIGH' : 'MEDIUM';
      case 'INVALID':
        return failureCount >= 3 ? 'MEDIUM' : 'LOW';
      default:
        return 'LOW';
    }
  }

  /**
   * 记录系统健康状态
   */
  async recordSystemHealth(healthData) {
    try {
      await this.database.run(
        `INSERT INTO system_health 
         (check_type, total_symbols, healthy_symbols, unhealthy_symbols, health_rate, details, timestamp) 
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          'INDICATORS',
          healthData.totalSymbols,
          healthData.healthySymbols,
          healthData.unhealthySymbols,
          healthData.healthRate,
          healthData.details
        ]
      );
    } catch (error) {
      console.error('记录系统健康状态失败:', error);
    }
  }

  /**
   * 获取指标状态概览
   */
  async getIndicatorStatusOverview() {
    try {
      const overview = await this.database.all(
        'SELECT * FROM indicator_status_overview ORDER BY health_rate DESC'
      );
      return overview;
    } catch (error) {
      console.error('获取指标状态概览失败:', error);
      return [];
    }
  }

  /**
   * 获取系统健康概览
   */
  async getSystemHealthOverview() {
    try {
      const overview = await this.database.all(
        'SELECT * FROM system_health_overview ORDER BY timestamp DESC LIMIT 10'
      );
      return overview;
    } catch (error) {
      console.error('获取系统健康概览失败:', error);
      return [];
    }
  }

  /**
   * 获取未解决的告警
   */
  async getUnresolvedAlerts() {
    try {
      const alerts = await this.database.all(
        'SELECT * FROM alert_records WHERE is_resolved = 0 ORDER BY timestamp DESC'
      );
      return alerts;
    } catch (error) {
      console.error('获取未解决告警失败:', error);
      return [];
    }
  }

  /**
   * 解决告警
   */
  async resolveAlert(alertId) {
    try {
      await this.database.run(
        'UPDATE alert_records SET is_resolved = 1, resolved_at = CURRENT_TIMESTAMP WHERE id = ?',
        [alertId]
      );
      console.log(`✅ 告警 ${alertId} 已解决`);
    } catch (error) {
      console.error(`解决告警 ${alertId} 失败:`, error);
    }
  }

  /**
   * 关闭数据库连接
   */
  async close() {
    try {
      this.stopMonitoring();
      if (this.database && this.database.close) {
        await this.database.close();
      }
      console.log('✅ 增强指标监控系统已关闭');
    } catch (error) {
      console.error('❌ 关闭监控系统失败:', error);
    }
  }
}

module.exports = EnhancedIndicatorMonitor;
