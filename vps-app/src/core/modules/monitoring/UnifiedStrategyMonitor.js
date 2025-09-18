/**
 * 统一策略监控管理器
 * 支持V3和ICT策略的统一监控和管理
 */

class UnifiedStrategyMonitor {
  constructor(database) {
    this.db = database;
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30秒缓存
  }

  /**
   * 获取统一监控仪表板数据
   */
  async getUnifiedDashboard() {
    try {
      const cacheKey = 'unified_dashboard';
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      const result = {
        summary: await this.getSummaryStats(),
        completionRates: await this.getCompletionRates(),
        detailedStats: await this.getDetailedStats(),
        recentAlerts: await this.getRecentAlerts()
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('获取统一监控仪表板数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取汇总统计
   */
  async getSummaryStats() {
    const symbols = await this.db.runQuery('SELECT DISTINCT symbol FROM custom_symbols');
    const totalSymbols = symbols.length;

    // V3策略统计
    const v3Stats = await this.getStrategyStats('V3');

    // ICT策略统计
    const ictStats = await this.getStrategyStats('ICT');

    // 计算整体健康状态
    const totalErrors = v3Stats.totalErrors + ictStats.totalErrors;
    let overallHealth = 'HEALTHY';
    if (totalErrors > 0) overallHealth = 'WARNING';
    if (totalErrors > 10) overallHealth = 'ERROR';

    return {
      totalSymbols,
      v3Strategy: v3Stats,
      ictStrategy: ictStats,
      overallHealth
    };
  }

  /**
   * 获取策略统计
   */
  async getStrategyStats(strategyType) {
    const symbols = await this.db.runQuery('SELECT DISTINCT symbol FROM custom_symbols');

    let healthySymbols = 0;
    let warningSymbols = 0;
    let errorSymbols = 0;
    let totalErrors = 0;

    for (const { symbol } of symbols) {
      const stats = await this.getSymbolStats(symbol, strategyType);

      if (stats.overallHealth === 'HEALTHY') {
        healthySymbols++;
      } else if (stats.overallHealth === 'WARNING') {
        warningSymbols++;
      } else {
        errorSymbols++;
      }

      totalErrors += stats.totalErrors || 0;
    }

    return {
      healthySymbols,
      warningSymbols,
      errorSymbols,
      totalErrors
    };
  }

  /**
   * 获取完成率统计
   */
  async getCompletionRates() {
    const v3Rates = await this.getStrategyCompletionRates('V3');
    const ictRates = await this.getStrategyCompletionRates('ICT');

    return {
      v3Strategy: v3Rates,
      ictStrategy: ictRates
    };
  }

  /**
   * 获取策略完成率
   */
  async getStrategyCompletionRates(strategyType) {
    const symbols = await this.db.runQuery('SELECT DISTINCT symbol FROM custom_symbols');

    let totalDataCollection = 0;
    let totalDataValidation = 0;
    let totalSimulationTrading = 0;
    let count = 0;

    for (const { symbol } of symbols) {
      const stats = await this.getSymbolStats(symbol, strategyType);

      totalDataCollection += stats.dataCollection?.rate || 0;
      totalDataValidation += stats.dataValidation?.rate || 0;
      totalSimulationTrading += stats.simulationCompletion?.rate || 0;
      count++;
    }

    return {
      dataCollection: count > 0 ? totalDataCollection / count : 0,
      dataValidation: count > 0 ? totalDataValidation / count : 0,
      simulationTrading: count > 0 ? totalSimulationTrading / count : 0
    };
  }

  /**
   * 获取详细统计
   */
  async getDetailedStats() {
    const symbols = await this.db.runQuery('SELECT DISTINCT symbol FROM custom_symbols');
    const detailedStats = [];

    for (const { symbol } of symbols) {
      const v3Stats = await this.getSymbolStats(symbol, 'V3');
      const ictStats = await this.getSymbolStats(symbol, 'ICT');

      detailedStats.push({
        symbol,
        v3Strategy: v3Stats,
        ictStrategy: ictStats
      });
    }

    return detailedStats;
  }

  /**
   * 获取交易对统计
   */
  async getSymbolStats(symbol, strategyType) {
    try {
      // 获取数据收集统计
      const dataCollection = await this.getDataCollectionStats(symbol, strategyType);

      // 获取数据验证统计
      const dataValidation = await this.getDataValidationStats(symbol, strategyType);

      // 获取模拟交易统计
      const simulationCompletion = await this.getSimulationStats(symbol, strategyType);

      // 计算整体健康状态
      let overallHealth = 'HEALTHY';
      let totalErrors = 0;

      if (dataCollection.rate < 90) {
        overallHealth = 'WARNING';
        totalErrors++;
      }
      if (dataValidation.status === 'INVALID') {
        overallHealth = 'ERROR';
        totalErrors += dataValidation.errors || 0;
      }
      if (simulationCompletion.rate < 95) {
        overallHealth = 'WARNING';
        totalErrors++;
      }

      return {
        dataCollection,
        dataValidation,
        simulationCompletion,
        overallHealth,
        totalErrors
      };
    } catch (error) {
      console.error(`获取交易对统计失败 [${symbol}-${strategyType}]:`, error);
      return {
        dataCollection: { rate: 0, attempts: 0, successes: 0, lastTime: 0 },
        dataValidation: { status: 'UNKNOWN', errors: 0, warnings: 0 },
        simulationCompletion: { rate: 0, triggers: 0, completions: 0 },
        overallHealth: 'ERROR',
        totalErrors: 1
      };
    }
  }

  /**
   * 获取数据收集统计
   */
  async getDataCollectionStats(symbol, strategyType) {
    const result = await this.db.runQuery(`
      SELECT 
        data_collection_rate,
        data_collection_attempts,
        data_collection_successes,
        data_collection_last_time
      FROM strategy_monitoring_stats 
      WHERE symbol = ? AND strategy_type = ?
      ORDER BY timestamp DESC LIMIT 1
    `, [symbol, strategyType]);

    const stats = result[0] || {};
    return {
      rate: stats.data_collection_rate || 0,
      attempts: stats.data_collection_attempts || 0,
      successes: stats.data_collection_successes || 0,
      lastTime: stats.data_collection_last_time || 0
    };
  }

  /**
   * 获取数据验证统计
   */
  async getDataValidationStats(symbol, strategyType) {
    const result = await this.db.runQuery(`
      SELECT 
        data_validation_status,
        data_validation_errors,
        data_validation_warnings,
        data_validation_last_check
      FROM strategy_monitoring_stats 
      WHERE symbol = ? AND strategy_type = ?
      ORDER BY timestamp DESC LIMIT 1
    `, [symbol, strategyType]);

    const stats = result[0] || {};
    return {
      status: stats.data_validation_status || 'UNKNOWN',
      errors: stats.data_validation_errors || 0,
      warnings: stats.data_validation_warnings || 0,
      lastCheck: stats.data_validation_last_check || 0
    };
  }

  /**
   * 获取模拟交易统计
   */
  async getSimulationStats(symbol, strategyType) {
    const result = await this.db.runQuery(`
      SELECT 
        simulation_completion_rate,
        simulation_triggers,
        simulation_completions,
        simulation_active_count
      FROM strategy_monitoring_stats 
      WHERE symbol = ? AND strategy_type = ?
      ORDER BY timestamp DESC LIMIT 1
    `, [symbol, strategyType]);

    const stats = result[0] || {};
    return {
      rate: stats.simulation_completion_rate || 0,
      triggers: stats.simulation_triggers || 0,
      completions: stats.simulation_completions || 0,
      activeCount: stats.simulation_active_count || 0
    };
  }

  /**
   * 获取最近告警
   */
  async getRecentAlerts() {
    const alerts = await this.db.runQuery(`
      SELECT 
        id, symbol, strategy_type, alert_type, severity, 
        message, created_at
      FROM monitoring_alerts 
      WHERE resolved = FALSE
      ORDER BY created_at DESC 
      LIMIT 20
    `);

    return alerts.map(alert => ({
      id: alert.id,
      symbol: alert.symbol,
      strategyType: alert.strategy_type,
      alertType: alert.alert_type,
      severity: alert.severity,
      message: alert.message,
      createdAt: alert.created_at
    }));
  }

  /**
   * 获取数据刷新状态
   */
  async getDataRefreshStatus() {
    const symbols = await this.db.runQuery('SELECT DISTINCT symbol FROM custom_symbols');
    const result = { v3Strategy: {}, ictStrategy: {} };

    for (const { symbol } of symbols) {
      const refreshStatus = await this.db.runQuery(`
        SELECT data_type, last_refresh, next_refresh, should_refresh, refresh_interval
        FROM data_refresh_status 
        WHERE symbol = ?
        ORDER BY strategy_type, data_type
      `, [symbol]);

      result.v3Strategy[symbol] = {};
      result.ictStrategy[symbol] = {};

      for (const status of refreshStatus) {
        const strategyKey = status.strategy_type === 'V3' ? 'v3Strategy' : 'ictStrategy';
        result[strategyKey][symbol][status.data_type] = {
          shouldRefresh: status.should_refresh === 1,
          lastRefresh: status.last_refresh,
          nextRefresh: status.next_refresh,
          refreshInterval: status.refresh_interval
        };
      }
    }

    return result;
  }

  /**
   * 强制刷新数据
   */
  async forceRefreshData(symbol, strategyType, dataType) {
    try {
      // 更新刷新状态
      await this.db.run(`
        UPDATE data_refresh_status 
        SET last_refresh = datetime('now'), should_refresh = FALSE
        WHERE symbol = ? AND strategy_type = ? AND data_type = ?
      `, [symbol, strategyType, dataType]);

      // 清除相关缓存
      this.clearCache();

      return { success: true, message: '数据刷新成功' };
    } catch (error) {
      console.error('强制刷新数据失败:', error);
      return { success: false, message: '数据刷新失败' };
    }
  }

  /**
   * 缓存管理
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clearCache() {
    this.cache.clear();
  }
}

module.exports = UnifiedStrategyMonitor;
