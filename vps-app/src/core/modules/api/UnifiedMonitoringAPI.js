// UnifiedMonitoringAPI.js - 统一监控中心API接口

const UnifiedMonitoringManager = require('../monitoring/UnifiedMonitoringManager');

class UnifiedMonitoringAPI {
  constructor(database) {
    this.database = database;
    this.monitoringManager = new UnifiedMonitoringManager(database);
  }

  /**
   * 设置统一监控中心API路由
   */
  setupRoutes(app) {
    // 统一监控中心仪表板
    app.get('/api/unified-monitoring/dashboard', this.getUnifiedMonitoringDashboard.bind(this));

    // 交易对详细监控数据
    app.get('/api/unified-monitoring/symbol/:symbol', this.getSymbolMonitoringData.bind(this));

    // 数据刷新状态
    app.get('/api/data-refresh/status', this.getDataRefreshStatus.bind(this));
    app.post('/api/data-refresh/force-refresh/:symbol', this.forceRefreshSymbolData.bind(this));

    // 统一模拟交易
    app.get('/api/unified-simulations/history', this.getUnifiedSimulationHistory.bind(this));
    app.get('/api/unified-simulations/stats', this.getUnifiedSimulationStats.bind(this));

    // 交易对管理统计
    app.get('/api/symbol-management/stats', this.getSymbolManagementStats.bind(this));

    // 监控告警
    app.get('/api/monitoring/alerts', this.getMonitoringAlerts.bind(this));
    app.post('/api/monitoring/alerts/:id/resolve', this.resolveAlert.bind(this));
  }

  /**
   * 获取统一监控中心数据
   */
  async getUnifiedMonitoringDashboard(req, res) {
    try {
      const dashboardData = await this.monitoringManager.getUnifiedMonitoringDashboard();

      res.json({
        success: true,
        data: dashboardData,
        message: '统一监控中心数据获取成功',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ 获取统一监控中心数据失败:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'UNIFIED_MONITORING_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 获取指定交易对的详细监控数据
   */
  async getSymbolMonitoringData(req, res) {
    try {
      const { symbol } = req.params;

      if (!symbol) {
        return res.status(400).json({
          success: false,
          error: '交易对参数缺失',
          code: 'MISSING_SYMBOL_PARAM',
          timestamp: new Date().toISOString()
        });
      }

      const symbolData = await this.monitoringManager.getSymbolMonitoringData(symbol);

      res.json({
        success: true,
        data: symbolData,
        message: `${symbol} 监控数据获取成功`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`❌ 获取交易对监控数据失败 [${req.params.symbol}]:`, error);
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'SYMBOL_MONITORING_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 获取数据刷新状态
   */
  async getDataRefreshStatus(req, res) {
    try {
      const refreshStatus = await this.monitoringManager.getDataRefreshStatus();

      res.json({
        success: true,
        data: refreshStatus,
        message: '数据刷新状态获取成功',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ 获取数据刷新状态失败:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'DATA_REFRESH_STATUS_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 强制刷新指定交易对的数据
   */
  async forceRefreshSymbolData(req, res) {
    try {
      const { symbol } = req.params;
      const { strategyType, dataType } = req.body;

      if (!symbol) {
        return res.status(400).json({
          success: false,
          error: '交易对参数缺失',
          code: 'MISSING_SYMBOL_PARAM',
          timestamp: new Date().toISOString()
        });
      }

      const result = await this.monitoringManager.forceRefreshSymbolData(symbol, strategyType, dataType);

      res.json({
        success: true,
        data: result,
        message: `${symbol} 数据刷新已触发`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`❌ 强制刷新数据失败 [${req.params.symbol}]:`, error);
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'FORCE_REFRESH_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 获取统一模拟交易历史
   */
  async getUnifiedSimulationHistory(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.pageSize) || 20;
      const strategyType = req.query.strategyType || null;

      const result = await this.monitoringManager.getUnifiedSimulationHistory(page, pageSize, strategyType);

      res.json({
        success: true,
        data: result,
        message: '统一模拟交易历史获取成功',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ 获取统一模拟交易历史失败:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'UNIFIED_SIMULATION_HISTORY_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 获取统一模拟交易统计
   */
  async getUnifiedSimulationStats(req, res) {
    try {
      const stats = await this.monitoringManager.getUnifiedSimulationStats();

      res.json({
        success: true,
        data: stats,
        message: '统一模拟交易统计获取成功',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ 获取统一模拟交易统计失败:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'UNIFIED_SIMULATION_STATS_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 获取交易对管理统计
   */
  async getSymbolManagementStats(req, res) {
    try {
      const stats = await this.monitoringManager.getSymbolManagementStats();

      res.json({
        success: true,
        data: stats,
        message: '交易对管理统计获取成功',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ 获取交易对管理统计失败:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'SYMBOL_MANAGEMENT_STATS_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 获取监控告警列表
   */
  async getMonitoringAlerts(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.pageSize) || 20;
      const strategyType = req.query.strategyType || null;
      const alertType = req.query.alertType || null;

      const result = await this.monitoringManager.getMonitoringAlerts(page, pageSize, strategyType, alertType);

      res.json({
        success: true,
        data: result,
        message: '监控告警列表获取成功',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ 获取监控告警列表失败:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'MONITORING_ALERTS_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 解决指定告警
   */
  async resolveAlert(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: '告警ID参数缺失',
          code: 'MISSING_ALERT_ID_PARAM',
          timestamp: new Date().toISOString()
        });
      }

      const result = await this.monitoringManager.resolveAlert(parseInt(id));

      res.json({
        success: true,
        data: result,
        message: '告警已解决',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`❌ 解决告警失败 [${req.params.id}]:`, error);
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'RESOLVE_ALERT_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 创建监控告警
   */
  async createAlert(symbol, strategyType, alertType, severity, message, details = null) {
    try {
      const sql = `
        INSERT INTO monitoring_alerts 
        (symbol, strategy_type, alert_type, severity, message, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      await this.database.run(sql, [
        symbol,
        strategyType,
        alertType,
        severity,
        message,
        details ? JSON.stringify(details) : null,
        new Date().toISOString()
      ]);

      console.log(`📢 创建监控告警 [${symbol}][${strategyType}]: ${message}`);
    } catch (error) {
      console.error(`❌ 创建监控告警失败 [${symbol}][${strategyType}]:`, error);
    }
  }

  /**
   * 更新策略监控统计
   */
  async updateStrategyMonitoringStats(symbol, strategyType, stats) {
    try {
      const sql = `
        INSERT OR REPLACE INTO strategy_monitoring_stats 
        (symbol, strategy_type, data_collection_rate, data_collection_attempts, 
         data_collection_successes, data_collection_last_time, data_validation_status,
         data_validation_errors, data_validation_warnings, data_validation_last_check,
         simulation_completion_rate, simulation_triggers, simulation_completions,
         simulation_active_count, strategy_specific_data, overall_health,
         last_error_message, last_error_time, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.database.run(sql, [
        symbol,
        strategyType,
        stats.dataCollectionRate || 0,
        stats.dataCollectionAttempts || 0,
        stats.dataCollectionSuccesses || 0,
        stats.dataCollectionLastTime,
        stats.dataValidationStatus || 'UNKNOWN',
        stats.dataValidationErrors || 0,
        stats.dataValidationWarnings || 0,
        stats.dataValidationLastCheck,
        stats.simulationCompletionRate || 0,
        stats.simulationTriggers || 0,
        stats.simulationCompletions || 0,
        stats.simulationActiveCount || 0,
        stats.strategySpecificData ? JSON.stringify(stats.strategySpecificData) : null,
        stats.overallHealth || 'UNKNOWN',
        stats.lastErrorMessage,
        stats.lastErrorTime,
        new Date().toISOString()
      ]);
    } catch (error) {
      console.error(`❌ 更新策略监控统计失败 [${symbol}][${strategyType}]:`, error);
    }
  }

  /**
   * 更新数据刷新状态
   */
  async updateDataRefreshStatus(symbol, strategyType, dataType, status) {
    try {
      const sql = `
        UPDATE data_refresh_status 
        SET should_refresh = ?, last_refresh = ?, next_refresh = ?,
            refresh_attempts = ?, refresh_successes = ?, last_error_message = ?,
            updated_at = ?
        WHERE symbol = ? AND strategy_type = ? AND data_type = ?
      `;

      await this.database.run(sql, [
        status.shouldRefresh,
        status.lastRefresh,
        status.nextRefresh,
        status.refreshAttempts,
        status.refreshSuccesses,
        status.lastErrorMessage,
        new Date().toISOString(),
        symbol,
        strategyType,
        dataType
      ]);
    } catch (error) {
      console.error(`❌ 更新数据刷新状态失败 [${symbol}][${strategyType}][${dataType}]:`, error);
    }
  }

  /**
   * 记录统一模拟交易
   */
  async recordUnifiedSimulation(simulationData) {
    try {
      const sql = `
        INSERT INTO unified_simulations 
        (symbol, strategy_type, entry_price, stop_loss_price, take_profit_price,
         max_leverage, min_margin, stop_loss_distance, atr_value, direction,
         status, trigger_reason, execution_mode, market_type, setup_candle_high,
         setup_candle_low, atr14, time_in_position, max_time_in_position,
         created_at, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const result = await this.database.run(sql, [
        simulationData.symbol,
        simulationData.strategyType,
        simulationData.entryPrice,
        simulationData.stopLossPrice,
        simulationData.takeProfitPrice,
        simulationData.maxLeverage,
        simulationData.minMargin,
        simulationData.stopLossDistance,
        simulationData.atrValue,
        simulationData.direction,
        simulationData.status || 'ACTIVE',
        simulationData.triggerReason,
        simulationData.executionMode,
        simulationData.marketType,
        simulationData.setupCandleHigh,
        simulationData.setupCandleLow,
        simulationData.atr14,
        simulationData.timeInPosition || 0,
        simulationData.maxTimeInPosition || 48,
        simulationData.createdAt || new Date().toISOString(),
        new Date().toISOString()
      ]);

      return result.lastID;
    } catch (error) {
      console.error(`❌ 记录统一模拟交易失败 [${simulationData.symbol}]:`, error);
      throw error;
    }
  }

  /**
   * 更新统一模拟交易状态
   */
  async updateUnifiedSimulation(id, updateData) {
    try {
      const fields = [];
      const values = [];

      if (updateData.status !== undefined) {
        fields.push('status = ?');
        values.push(updateData.status);
      }

      if (updateData.closedAt !== undefined) {
        fields.push('closed_at = ?');
        values.push(updateData.closedAt);
      }

      if (updateData.exitPrice !== undefined) {
        fields.push('exit_price = ?');
        values.push(updateData.exitPrice);
      }

      if (updateData.exitReason !== undefined) {
        fields.push('exit_reason = ?');
        values.push(updateData.exitReason);
      }

      if (updateData.isWin !== undefined) {
        fields.push('is_win = ?');
        values.push(updateData.isWin);
      }

      if (updateData.profitLoss !== undefined) {
        fields.push('profit_loss = ?');
        values.push(updateData.profitLoss);
      }

      if (updateData.timeInPosition !== undefined) {
        fields.push('time_in_position = ?');
        values.push(updateData.timeInPosition);
      }

      fields.push('last_updated = ?');
      values.push(new Date().toISOString());

      values.push(id);

      const sql = `UPDATE unified_simulations SET ${fields.join(', ')} WHERE id = ?`;

      await this.database.run(sql, values);
    } catch (error) {
      console.error(`❌ 更新统一模拟交易失败 [${id}]:`, error);
      throw error;
    }
  }
}

module.exports = UnifiedMonitoringAPI;
