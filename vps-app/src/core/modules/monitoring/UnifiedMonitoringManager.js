// UnifiedMonitoringManager.js - 统一监控中心管理器

class UnifiedMonitoringManager {
  constructor(database = null) {
    this.database = database;
    this.cache = new Map();
    this.cacheConfig = {
      dashboard: 10 * 1000, // 10秒
      symbolStats: 30 * 1000, // 30秒
      refreshStatus: 60 * 1000, // 1分钟
      alerts: 30 * 1000 // 30秒
    };
  }

  /**
   * 获取统一监控中心数据
   */
  async getUnifiedMonitoringDashboard() {
    try {
      const cacheKey = 'unified_monitoring_dashboard';

      // 检查缓存
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheConfig.dashboard) {
          return cached.data;
        }
      }

      // 获取所有交易对
      const symbols = await this.database.getCustomSymbols();

      // 并行获取V3和ICT策略的监控数据
      const [v3Stats, ictStats, recentAlerts] = await Promise.all([
        this.getStrategyMonitoringStats('V3', symbols),
        this.getStrategyMonitoringStats('ICT', symbols),
        this.getRecentAlerts(20)
      ]);

      // 计算汇总统计
      const summary = this.calculateSummaryStats(v3Stats, ictStats);

      // 计算完成率
      const completionRates = this.calculateCompletionRates(v3Stats, ictStats);

      // 构建详细统计
      const detailedStats = this.buildDetailedStats(symbols, v3Stats, ictStats);

      const dashboardData = {
        summary,
        completionRates,
        detailedStats,
        recentAlerts
      };

      // 缓存数据
      this.cache.set(cacheKey, {
        data: dashboardData,
        timestamp: Date.now()
      });

      return dashboardData;
    } catch (error) {
      console.error('❌ 获取统一监控中心数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取指定交易对的详细监控数据
   */
  async getSymbolMonitoringData(symbol) {
    try {
      const cacheKey = `symbol_monitoring_${symbol}`;

      // 检查缓存
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheConfig.symbolStats) {
          return cached.data;
        }
      }

      // 获取V3和ICT策略的监控数据
      const [v3Stats, ictStats] = await Promise.all([
        this.getSymbolStrategyStats(symbol, 'V3'),
        this.getSymbolStrategyStats(symbol, 'ICT')
      ]);

      const symbolData = {
        symbol,
        v3Strategy: v3Stats,
        ictStrategy: ictStats
      };

      // 缓存数据
      this.cache.set(cacheKey, {
        data: symbolData,
        timestamp: Date.now()
      });

      return symbolData;
    } catch (error) {
      console.error(`❌ 获取交易对监控数据失败 [${symbol}]:`, error);
      throw error;
    }
  }

  /**
   * 获取数据刷新状态
   */
  async getDataRefreshStatus() {
    try {
      const cacheKey = 'data_refresh_status';

      // 检查缓存
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheConfig.refreshStatus) {
          return cached.data;
        }
      }

      const symbols = await this.database.getCustomSymbols();
      const refreshStatus = {};

      // 获取V3策略数据刷新状态
      refreshStatus.v3Strategy = {};
      for (const symbol of symbols) {
        refreshStatus.v3Strategy[symbol] = await this.getSymbolRefreshStatus(symbol, 'V3');
      }

      // 获取ICT策略数据刷新状态
      refreshStatus.ictStrategy = {};
      for (const symbol of symbols) {
        refreshStatus.ictStrategy[symbol] = await this.getSymbolRefreshStatus(symbol, 'ICT');
      }

      // 缓存数据
      this.cache.set(cacheKey, {
        data: refreshStatus,
        timestamp: Date.now()
      });

      return refreshStatus;
    } catch (error) {
      console.error('❌ 获取数据刷新状态失败:', error);
      throw error;
    }
  }

  /**
   * 强制刷新指定交易对的数据
   */
  async forceRefreshSymbolData(symbol, strategyType = null, dataType = null) {
    try {
      const refreshTypes = strategyType ? [strategyType] : ['V3', 'ICT'];

      for (const strategy of refreshTypes) {
        const dataTypes = dataType ? [dataType] : this.getDataTypesForStrategy(strategy);

        for (const type of dataTypes) {
          await this.updateRefreshStatus(symbol, strategy, type, {
            shouldRefresh: true,
            lastRefresh: new Date().toISOString(),
            nextRefresh: this.calculateNextRefresh(type),
            refreshAttempts: 0,
            refreshSuccesses: 0,
            lastErrorMessage: null
          });
        }
      }

      return { success: true, message: '数据刷新已触发' };
    } catch (error) {
      console.error(`❌ 强制刷新数据失败 [${symbol}]:`, error);
      throw error;
    }
  }

  /**
   * 获取统一模拟交易历史
   */
  async getUnifiedSimulationHistory(page = 1, pageSize = 20, strategyType = null) {
    try {
      const offset = (page - 1) * pageSize;
      let whereClause = '';
      let params = [];

      if (strategyType) {
        whereClause = 'WHERE strategy_type = ?';
        params.push(strategyType);
      }

      // 获取模拟交易数据
      const simulationsSQL = `
        SELECT * FROM unified_simulations 
        ${whereClause}
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `;
      params.push(pageSize, offset);

      const simulations = await this.database.all(simulationsSQL, params);

      // 获取总数
      const countSQL = `
        SELECT COUNT(*) as total FROM unified_simulations 
        ${whereClause}
      `;
      const countParams = strategyType ? [strategyType] : [];
      const countResult = await this.database.get(countSQL, countParams);
      const total = countResult.total;

      return {
        simulations,
        pagination: {
          currentPage: page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
          hasNext: page * pageSize < total,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('❌ 获取统一模拟交易历史失败:', error);
      throw error;
    }
  }

  /**
   * 获取统一模拟交易统计
   */
  async getUnifiedSimulationStats() {
    try {
      // 整体统计
      const overallStats = await this.getOverallSimulationStats();

      // 按策略统计
      const byStrategyStats = await this.getByStrategySimulationStats();

      // 按交易对统计
      const bySymbolStats = await this.getBySymbolSimulationStats();

      return {
        overall: overallStats,
        byStrategy: byStrategyStats,
        bySymbol: bySymbolStats
      };
    } catch (error) {
      console.error('❌ 获取统一模拟交易统计失败:', error);
      throw error;
    }
  }

  /**
   * 获取交易对管理统计
   */
  async getSymbolManagementStats() {
    try {
      const symbols = await this.database.getCustomSymbols();

      // 按策略统计
      const byStrategyStats = {};
      for (const strategy of ['V3', 'ICT']) {
        byStrategyStats[strategy] = await this.getStrategySymbolStats(symbols, strategy);
      }

      // 按分类统计
      const byCategoryStats = await this.getByCategorySymbolStats(symbols);

      return {
        totalSymbols: symbols.length,
        byStrategy: byStrategyStats,
        byCategory: byCategoryStats
      };
    } catch (error) {
      console.error('❌ 获取交易对管理统计失败:', error);
      throw error;
    }
  }

  /**
   * 获取监控告警列表
   */
  async getMonitoringAlerts(page = 1, pageSize = 20, strategyType = null, alertType = null) {
    try {
      const offset = (page - 1) * pageSize;
      let whereConditions = [];
      let params = [];

      if (strategyType) {
        whereConditions.push('strategy_type = ?');
        params.push(strategyType);
      }

      if (alertType) {
        whereConditions.push('alert_type = ?');
        params.push(alertType);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // 获取告警数据
      const alertsSQL = `
        SELECT * FROM monitoring_alerts 
        ${whereClause}
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `;
      params.push(pageSize, offset);

      const alerts = await this.database.all(alertsSQL, params);

      // 获取总数
      const countSQL = `
        SELECT COUNT(*) as total FROM monitoring_alerts 
        ${whereClause}
      `;
      const countParams = params.slice(0, -2); // 移除 LIMIT 和 OFFSET 参数
      const countResult = await this.database.get(countSQL, countParams);
      const total = countResult.total;

      return {
        alerts,
        pagination: {
          currentPage: page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
          hasNext: page * pageSize < total,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('❌ 获取监控告警列表失败:', error);
      throw error;
    }
  }

  /**
   * 解决指定告警
   */
  async resolveAlert(alertId) {
    try {
      const updateSQL = `
        UPDATE monitoring_alerts 
        SET resolved = TRUE, resolved_at = ? 
        WHERE id = ?
      `;

      await this.database.run(updateSQL, [new Date().toISOString(), alertId]);

      return { success: true, message: '告警已解决' };
    } catch (error) {
      console.error(`❌ 解决告警失败 [${alertId}]:`, error);
      throw error;
    }
  }

  // 私有辅助方法

  /**
   * 获取策略监控统计
   */
  async getStrategyMonitoringStats(strategyType, symbols) {
    const stats = new Map();

    for (const symbol of symbols) {
      const symbolStats = await this.getSymbolStrategyStats(symbol, strategyType);
      stats.set(symbol, symbolStats);
    }

    return stats;
  }

  /**
   * 获取交易对策略统计
   */
  async getSymbolStrategyStats(symbol, strategyType) {
    const sql = `
      SELECT * FROM strategy_monitoring_stats 
      WHERE symbol = ? AND strategy_type = ? 
      ORDER BY timestamp DESC 
      LIMIT 1
    `;

    const result = await this.database.get(sql, [symbol, strategyType]);

    if (!result) {
      return {
        dataCollection: { rate: 0, attempts: 0, successes: 0, lastTime: null },
        dataValidation: { status: 'UNKNOWN', errors: 0, warnings: 0, lastCheck: null },
        simulationCompletion: { rate: 0, triggers: 0, completions: 0, activeCount: 0 }
      };
    }

    return {
      dataCollection: {
        rate: result.data_collection_rate || 0,
        attempts: result.data_collection_attempts || 0,
        successes: result.data_collection_successes || 0,
        lastTime: result.data_collection_last_time
      },
      dataValidation: {
        status: result.data_validation_status || 'UNKNOWN',
        errors: result.data_validation_errors || 0,
        warnings: result.data_validation_warnings || 0,
        lastCheck: result.data_validation_last_check
      },
      simulationCompletion: {
        rate: result.simulation_completion_rate || 0,
        triggers: result.simulation_triggers || 0,
        completions: result.simulation_completions || 0,
        activeCount: result.simulation_active_count || 0
      }
    };
  }

  /**
   * 计算汇总统计
   */
  calculateSummaryStats(v3Stats, ictStats) {
    const v3Summary = this.calculateStrategySummary(v3Stats);
    const ictSummary = this.calculateStrategySummary(ictStats);

    return {
      totalSymbols: v3Stats.size,
      v3Strategy: v3Summary,
      ictStrategy: ictSummary,
      overallHealth: this.determineOverallHealth(v3Summary, ictSummary)
    };
  }

  /**
   * 计算策略汇总统计
   */
  calculateStrategySummary(stats) {
    let healthySymbols = 0;
    let warningSymbols = 0;
    let errorSymbols = 0;
    let totalErrors = 0;

    for (const [symbol, stat] of stats) {
      const health = this.determineSymbolHealth(stat);
      if (health === 'HEALTHY') healthySymbols++;
      else if (health === 'WARNING') warningSymbols++;
      else if (health === 'ERROR') errorSymbols++;

      totalErrors += stat.dataValidation.errors + stat.dataValidation.warnings;
    }

    return {
      healthySymbols,
      warningSymbols,
      errorSymbols,
      totalErrors
    };
  }

  /**
   * 确定交易对健康状态
   */
  determineSymbolHealth(stat) {
    if (stat.dataCollection.rate < 80 || stat.dataValidation.errors > 5) {
      return 'ERROR';
    } else if (stat.dataCollection.rate < 90 || stat.dataValidation.warnings > 3) {
      return 'WARNING';
    } else {
      return 'HEALTHY';
    }
  }

  /**
   * 确定整体健康状态
   */
  determineOverallHealth(v3Summary, ictSummary) {
    const totalErrorSymbols = v3Summary.errorSymbols + ictSummary.errorSymbols;
    const totalSymbols = v3Summary.healthySymbols + v3Summary.warningSymbols + v3Summary.errorSymbols;

    if (totalErrorSymbols > totalSymbols * 0.3) {
      return 'ERROR';
    } else if (totalErrorSymbols > totalSymbols * 0.1) {
      return 'WARNING';
    } else {
      return 'HEALTHY';
    }
  }

  /**
   * 计算完成率
   */
  calculateCompletionRates(v3Stats, ictStats) {
    const v3Rates = this.calculateStrategyCompletionRates(v3Stats);
    const ictRates = this.calculateStrategyCompletionRates(ictStats);

    return {
      v3Strategy: v3Rates,
      ictStrategy: ictRates
    };
  }

  /**
   * 计算策略完成率
   */
  calculateStrategyCompletionRates(stats) {
    let totalDataCollection = 0;
    let totalDataValidation = 0;
    let totalSimulationTrading = 0;
    let count = 0;

    for (const [symbol, stat] of stats) {
      totalDataCollection += stat.dataCollection.rate;
      totalDataValidation += stat.dataValidation.status === 'VALID' ? 100 : 0;
      totalSimulationTrading += stat.simulationCompletion.rate;
      count++;
    }

    return {
      dataCollection: count > 0 ? totalDataCollection / count : 0,
      dataValidation: count > 0 ? totalDataValidation / count : 0,
      simulationTrading: count > 0 ? totalSimulationTrading / count : 0
    };
  }

  /**
   * 构建详细统计
   */
  buildDetailedStats(symbols, v3Stats, ictStats) {
    return symbols.map(symbol => ({
      symbol,
      v3Strategy: v3Stats.get(symbol) || this.getDefaultSymbolStats(),
      ictStrategy: ictStats.get(symbol) || this.getDefaultSymbolStats()
    }));
  }

  /**
   * 获取默认交易对统计
   */
  getDefaultSymbolStats() {
    return {
      dataCollection: { rate: 0, attempts: 0, successes: 0, lastTime: null },
      dataValidation: { status: 'UNKNOWN', errors: 0, warnings: 0, lastCheck: null },
      simulationCompletion: { rate: 0, triggers: 0, completions: 0, activeCount: 0 }
    };
  }

  /**
   * 获取最近告警
   */
  async getRecentAlerts(limit = 20) {
    const sql = `
      SELECT * FROM monitoring_alerts 
      ORDER BY created_at DESC 
      LIMIT ?
    `;

    return await this.database.all(sql, [limit]);
  }

  /**
   * 获取交易对刷新状态
   */
  async getSymbolRefreshStatus(symbol, strategyType) {
    const sql = `
      SELECT * FROM data_refresh_status 
      WHERE symbol = ? AND strategy_type = ?
    `;

    const results = await this.database.all(sql, [symbol, strategyType]);
    const status = {};

    for (const row of results) {
      status[row.data_type] = {
        shouldRefresh: row.should_refresh,
        lastRefresh: row.last_refresh,
        nextRefresh: row.next_refresh,
        refreshInterval: row.refresh_interval
      };
    }

    return status;
  }

  /**
   * 更新刷新状态
   */
  async updateRefreshStatus(symbol, strategyType, dataType, status) {
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
  }

  /**
   * 获取策略的数据类型
   */
  getDataTypesForStrategy(strategyType) {
    const dataTypes = {
      'V3': ['4h_trend', '1h_scoring', '15m_entry'],
      'ICT': ['daily_trend', 'mtf_analysis', 'ltf_analysis']
    };
    return dataTypes[strategyType] || [];
  }

  /**
   * 计算下次刷新时间
   */
  calculateNextRefresh(dataType) {
    const intervals = {
      '4h_trend': 4 * 60 * 60 * 1000,    // 4小时
      '1h_scoring': 60 * 60 * 1000,      // 1小时
      '15m_entry': 15 * 60 * 1000,       // 15分钟
      'daily_trend': 24 * 60 * 60 * 1000, // 24小时
      'mtf_analysis': 4 * 60 * 60 * 1000, // 4小时
      'ltf_analysis': 15 * 60 * 1000     // 15分钟
    };

    const interval = intervals[dataType] || 60 * 60 * 1000; // 默认1小时
    return new Date(Date.now() + interval).toISOString();
  }

  /**
   * 获取整体模拟交易统计
   */
  async getOverallSimulationStats() {
    const sql = `
      SELECT 
        COUNT(*) as total_trades,
        SUM(CASE WHEN is_win = 1 THEN 1 ELSE 0 END) as winning_trades,
        SUM(CASE WHEN is_win = 0 THEN 1 ELSE 0 END) as losing_trades,
        SUM(COALESCE(profit_loss, 0)) as net_profit
      FROM unified_simulations 
      WHERE status = 'CLOSED'
    `;

    const result = await this.database.get(sql);

    return {
      totalTrades: result.total_trades || 0,
      winningTrades: result.winning_trades || 0,
      losingTrades: result.losing_trades || 0,
      winRate: result.total_trades > 0 ? (result.winning_trades / result.total_trades) * 100 : 0,
      netProfit: result.net_profit || 0
    };
  }

  /**
   * 获取按策略的模拟交易统计
   */
  async getByStrategySimulationStats() {
    const strategies = ['V3', 'ICT'];
    const stats = {};

    for (const strategy of strategies) {
      const sql = `
        SELECT 
          COUNT(*) as total_trades,
          SUM(CASE WHEN is_win = 1 THEN 1 ELSE 0 END) as winning_trades,
          SUM(CASE WHEN is_win = 0 THEN 1 ELSE 0 END) as losing_trades,
          SUM(COALESCE(profit_loss, 0)) as net_profit
        FROM unified_simulations 
        WHERE strategy_type = ? AND status = 'CLOSED'
      `;

      const result = await this.database.get(sql, [strategy]);

      stats[strategy] = {
        totalTrades: result.total_trades || 0,
        winningTrades: result.winning_trades || 0,
        losingTrades: result.losing_trades || 0,
        winRate: result.total_trades > 0 ? (result.winning_trades / result.total_trades) * 100 : 0,
        netProfit: result.net_profit || 0
      };
    }

    return stats;
  }

  /**
   * 获取按交易对的模拟交易统计
   */
  async getBySymbolSimulationStats() {
    const sql = `
      SELECT 
        symbol,
        strategy_type,
        COUNT(*) as total_trades,
        SUM(CASE WHEN is_win = 1 THEN 1 ELSE 0 END) as winning_trades,
        SUM(COALESCE(profit_loss, 0)) as net_profit
      FROM unified_simulations 
      WHERE status = 'CLOSED'
      GROUP BY symbol, strategy_type
      ORDER BY symbol, strategy_type
    `;

    const results = await this.database.all(sql);
    const stats = {};

    for (const row of results) {
      if (!stats[row.symbol]) {
        stats[row.symbol] = {};
      }

      stats[row.symbol][row.strategy_type] = {
        totalTrades: row.total_trades,
        winningTrades: row.winning_trades,
        winRate: row.total_trades > 0 ? (row.winning_trades / row.total_trades) * 100 : 0,
        netProfit: row.net_profit
      };
    }

    return Object.entries(stats).map(([symbol, data]) => ({
      symbol,
      v3Strategy: data.V3 || { totalTrades: 0, winRate: 0, netProfit: 0 },
      ictStrategy: data.ICT || { totalTrades: 0, winRate: 0, netProfit: 0 }
    }));
  }

  /**
   * 获取策略交易对统计
   */
  async getStrategySymbolStats(symbols, strategyType) {
    const stats = await this.getStrategyMonitoringStats(strategyType, symbols);

    let healthySymbols = 0;
    let warningSymbols = 0;
    let errorSymbols = 0;
    let totalDataCollectionRate = 0;
    let totalSimulationCompletionRate = 0;

    for (const [symbol, stat] of stats) {
      const health = this.determineSymbolHealth(stat);
      if (health === 'HEALTHY') healthySymbols++;
      else if (health === 'WARNING') warningSymbols++;
      else if (health === 'ERROR') errorSymbols++;

      totalDataCollectionRate += stat.dataCollection.rate;
      totalSimulationCompletionRate += stat.simulationCompletion.rate;
    }

    return {
      totalSymbols: symbols.length,
      healthySymbols,
      warningSymbols,
      errorSymbols,
      dataCollectionRate: symbols.length > 0 ? totalDataCollectionRate / symbols.length : 0,
      simulationCompletionRate: symbols.length > 0 ? totalSimulationCompletionRate / symbols.length : 0
    };
  }

  /**
   * 获取按分类的交易对统计
   */
  async getByCategorySymbolStats(symbols) {
    // 这里需要根据实际的分类逻辑来实现
    // 暂时返回空对象，后续可以根据需要实现
    return {};
  }
}

module.exports = UnifiedMonitoringManager;
