/**
 * 统一策略API接口
 * 提供V3和ICT策略的统一API接口
 */

const UnifiedStrategyMonitor = require('../monitoring/UnifiedStrategyMonitor');

class UnifiedStrategyAPI {
  constructor(database) {
    this.db = database;
    this.monitor = new UnifiedStrategyMonitor(database);
  }

  /**
   * 设置API路由
   */
  setupRoutes(app) {
    console.log('✅ 统一策略API路由设置完成');

    // 统一监控中心API
    app.get('/api/unified-monitoring/dashboard', this.getUnifiedDashboard.bind(this));
    app.get('/api/unified-monitoring/symbol/:symbol', this.getSymbolMonitoring.bind(this));

    // 数据刷新状态API
    app.get('/api/data-refresh/status', this.getDataRefreshStatus.bind(this));
    app.post('/api/data-refresh/force-refresh/:symbol', this.forceRefreshData.bind(this));

    // 统一模拟交易API
    app.get('/api/unified-simulations/history', this.getUnifiedSimulationHistory.bind(this));
    app.get('/api/unified-simulations/stats', this.getUnifiedSimulationStats.bind(this));

    // 交易对管理API
    app.get('/api/symbol-management/stats', this.getSymbolManagementStats.bind(this));

    // 监控告警API
    app.get('/api/monitoring/alerts', this.getMonitoringAlerts.bind(this));
    app.post('/api/monitoring/alerts/:id/resolve', this.resolveAlert.bind(this));
  }

  /**
   * 获取统一监控仪表板数据
   */
  async getUnifiedDashboard(req, res) {
    try {
      const data = await this.monitor.getUnifiedDashboard();
      res.json({
        success: true,
        data,
        message: '统一监控仪表板数据获取成功',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('获取统一监控仪表板数据失败:', error);
      res.status(500).json({
        success: false,
        error: '获取统一监控仪表板数据失败',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 获取指定交易对的监控数据
   */
  async getSymbolMonitoring(req, res) {
    try {
      const { symbol } = req.params;

      const v3Stats = await this.monitor.getSymbolStats(symbol, 'V3');
      const ictStats = await this.monitor.getSymbolStats(symbol, 'ICT');

      res.json({
        success: true,
        data: {
          symbol,
          v3Strategy: v3Stats,
          ictStrategy: ictStats
        },
        message: `${symbol} 监控数据获取成功`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`获取交易对监控数据失败 [${req.params.symbol}]:`, error);
      res.status(500).json({
        success: false,
        error: '获取交易对监控数据失败',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 获取数据刷新状态
   */
  async getDataRefreshStatus(req, res) {
    try {
      const data = await this.monitor.getDataRefreshStatus();
      res.json({
        success: true,
        data,
        message: '数据刷新状态获取成功',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('获取数据刷新状态失败:', error);
      res.status(500).json({
        success: false,
        error: '获取数据刷新状态失败',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 强制刷新数据
   */
  async forceRefreshData(req, res) {
    try {
      const { symbol } = req.params;
      const { strategyType, dataType } = req.body;

      const result = await this.monitor.forceRefreshData(symbol, strategyType, dataType);

      res.json({
        success: result.success,
        message: result.message,
        data: {
          symbol,
          strategyType,
          dataType,
          refreshedAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('强制刷新数据失败:', error);
      res.status(500).json({
        success: false,
        error: '强制刷新数据失败',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 获取统一模拟交易历史
   */
  async getUnifiedSimulationHistory(req, res) {
    try {
      const { page = 1, pageSize = 20, strategyType, symbol } = req.query;
      const offset = (page - 1) * pageSize;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (strategyType) {
        whereClause += ' AND strategy_type = ?';
        params.push(strategyType);
      }

      if (symbol) {
        whereClause += ' AND symbol = ?';
        params.push(symbol);
      }

      // 获取总数
      const countResult = await this.db.runQuery(`
        SELECT COUNT(*) as total FROM unified_simulations ${whereClause}
      `, params);

      // 获取数据
      const simulations = await this.db.runQuery(`
        SELECT 
          id, symbol, strategy_type, entry_price, stop_loss_price, 
          take_profit_price, max_leverage, min_margin, direction, 
          status, trigger_reason, created_at, closed_at, exit_price, 
          exit_reason, is_win, profit_loss
        FROM unified_simulations 
        ${whereClause}
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `, [...params, pageSize, offset]);

      const total = countResult.total;
      const totalPages = Math.ceil(total / pageSize);

      res.json({
        success: true,
        data: {
          simulations: simulations.map(sim => ({
            id: sim.id,
            symbol: sim.symbol,
            strategyType: sim.strategy_type,
            entryPrice: sim.entry_price,
            stopLoss: sim.stop_loss_price,
            takeProfit: sim.take_profit_price,
            maxLeverage: sim.max_leverage,
            minMargin: sim.min_margin,
            direction: sim.direction,
            status: sim.status,
            triggerReason: sim.trigger_reason,
            createdAt: sim.created_at,
            closedAt: sim.closed_at,
            exitPrice: sim.exit_price,
            exitReason: sim.exit_reason,
            isWin: sim.is_win,
            profitLoss: sim.profit_loss
          })),
          pagination: {
            currentPage: parseInt(page),
            pageSize: parseInt(pageSize),
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
          }
        },
        message: '统一模拟交易历史获取成功',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('获取统一模拟交易历史失败:', error);
      res.status(500).json({
        success: false,
        error: '获取统一模拟交易历史失败',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 获取统一模拟交易统计
   */
  async getUnifiedSimulationStats(req, res) {
    try {
      // 整体统计
      const overallStats = await this.db.get(`
        SELECT 
          COUNT(*) as total_trades,
          SUM(CASE WHEN is_win = 1 THEN 1 ELSE 0 END) as winning_trades,
          SUM(CASE WHEN is_win = 0 THEN 1 ELSE 0 END) as losing_trades,
          SUM(profit_loss) as net_profit
        FROM unified_simulations 
        WHERE status = 'CLOSED'
      `);

      // 按策略统计
      const byStrategy = await this.db.all(`
        SELECT 
          strategy_type,
          COUNT(*) as total_trades,
          SUM(CASE WHEN is_win = 1 THEN 1 ELSE 0 END) as winning_trades,
          SUM(CASE WHEN is_win = 0 THEN 1 ELSE 0 END) as losing_trades,
          SUM(profit_loss) as net_profit
        FROM unified_simulations 
        WHERE status = 'CLOSED'
        GROUP BY strategy_type
      `);

      // 按交易对统计
      const bySymbol = await this.db.all(`
        SELECT 
          symbol,
          strategy_type,
          COUNT(*) as total_trades,
          SUM(CASE WHEN is_win = 1 THEN 1 ELSE 0 END) as winning_trades,
          SUM(CASE WHEN is_win = 0 THEN 1 ELSE 0 END) as losing_trades,
          SUM(profit_loss) as net_profit
        FROM unified_simulations 
        WHERE status = 'CLOSED'
        GROUP BY symbol, strategy_type
        ORDER BY symbol, strategy_type
      `);

      const winRate = overallStats.total_trades > 0
        ? (overallStats.winning_trades / overallStats.total_trades * 100).toFixed(2)
        : 0;

      res.json({
        success: true,
        data: {
          overall: {
            totalTrades: overallStats.total_trades || 0,
            winningTrades: overallStats.winning_trades || 0,
            losingTrades: overallStats.losing_trades || 0,
            winRate: parseFloat(winRate),
            netProfit: overallStats.net_profit || 0
          },
          byStrategy: byStrategy.reduce((acc, stat) => {
            const winRate = stat.total_trades > 0
              ? (stat.winning_trades / stat.total_trades * 100).toFixed(2)
              : 0;

            acc[stat.strategy_type] = {
              totalTrades: stat.total_trades,
              winningTrades: stat.winning_trades,
              losingTrades: stat.losing_trades,
              winRate: parseFloat(winRate),
              netProfit: stat.net_profit
            };
            return acc;
          }, {}),
          bySymbol: bySymbol.map(stat => {
            const winRate = stat.total_trades > 0
              ? (stat.winning_trades / stat.total_trades * 100).toFixed(2)
              : 0;

            return {
              symbol: stat.symbol,
              strategyType: stat.strategy_type,
              totalTrades: stat.total_trades,
              winningTrades: stat.winning_trades,
              losingTrades: stat.losing_trades,
              winRate: parseFloat(winRate),
              netProfit: stat.net_profit
            };
          })
        },
        message: '统一模拟交易统计获取成功',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('获取统一模拟交易统计失败:', error);
      res.status(500).json({
        success: false,
        error: '获取统一模拟交易统计失败',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 获取交易对管理统计
   */
  async getSymbolManagementStats(req, res) {
    try {
      const symbols = await this.db.all('SELECT DISTINCT symbol FROM custom_symbols');
      const totalSymbols = symbols.length;

      // 按策略统计
      const v3Stats = await this.monitor.getStrategyStats('V3');
      const ictStats = await this.monitor.getStrategyStats('ICT');

      // 按分类统计
      const byCategory = await this.getSymbolsByCategory();

      res.json({
        success: true,
        data: {
          totalSymbols,
          byStrategy: {
            V3: {
              totalSymbols,
              healthySymbols: v3Stats.healthySymbols,
              warningSymbols: v3Stats.warningSymbols,
              errorSymbols: v3Stats.errorSymbols,
              dataCollectionRate: await this.getAverageDataCollectionRate('V3'),
              simulationCompletionRate: await this.getAverageSimulationCompletionRate('V3')
            },
            ICT: {
              totalSymbols,
              healthySymbols: ictStats.healthySymbols,
              warningSymbols: ictStats.warningSymbols,
              errorSymbols: ictStats.errorSymbols,
              dataCollectionRate: await this.getAverageDataCollectionRate('ICT'),
              simulationCompletionRate: await this.getAverageSimulationCompletionRate('ICT')
            }
          },
          byCategory
        },
        message: '交易对管理统计获取成功',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('获取交易对管理统计失败:', error);
      res.status(500).json({
        success: false,
        error: '获取交易对管理统计失败',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 获取监控告警列表
   */
  async getMonitoringAlerts(req, res) {
    try {
      const { page = 1, pageSize = 20, strategyType, severity } = req.query;
      const offset = (page - 1) * pageSize;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (strategyType) {
        whereClause += ' AND strategy_type = ?';
        params.push(strategyType);
      }

      if (severity) {
        whereClause += ' AND severity = ?';
        params.push(severity);
      }

      // 获取总数
      const countResult = await this.db.get(`
        SELECT COUNT(*) as total FROM monitoring_alerts ${whereClause}
      `, params);

      // 获取数据
      const alerts = await this.db.all(`
        SELECT 
          id, symbol, strategy_type, alert_type, severity, 
          message, details, resolved, created_at
        FROM monitoring_alerts 
        ${whereClause}
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `, [...params, pageSize, offset]);

      const total = countResult.total;
      const totalPages = Math.ceil(total / pageSize);

      res.json({
        success: true,
        data: {
          alerts: alerts.map(alert => ({
            id: alert.id,
            symbol: alert.symbol,
            strategyType: alert.strategy_type,
            alertType: alert.alert_type,
            severity: alert.severity,
            message: alert.message,
            details: alert.details ? JSON.parse(alert.details) : null,
            resolved: alert.resolved === 1,
            createdAt: alert.created_at
          })),
          pagination: {
            currentPage: parseInt(page),
            pageSize: parseInt(pageSize),
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
          }
        },
        message: '监控告警列表获取成功',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('获取监控告警列表失败:', error);
      res.status(500).json({
        success: false,
        error: '获取监控告警列表失败',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 解决告警
   */
  async resolveAlert(req, res) {
    try {
      const { id } = req.params;

      await this.db.run(`
        UPDATE monitoring_alerts 
        SET resolved = TRUE, resolved_at = datetime('now')
        WHERE id = ?
      `, [id]);

      res.json({
        success: true,
        message: '告警已解决',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('解决告警失败:', error);
      res.status(500).json({
        success: false,
        error: '解决告警失败',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // 辅助方法
  async getSymbolsByCategory() {
    // 这里可以根据实际需求实现分类逻辑
    return {
      mainstream: {
        symbols: ['BTCUSDT', 'ETHUSDT'],
        v3Strategy: { count: 2, avgDataCollectionRate: 98.5 },
        ictStrategy: { count: 2, avgDataCollectionRate: 95.0 }
      },
      trending: {
        symbols: ['LINKUSDT', 'LDOUSDT'],
        v3Strategy: { count: 2, avgDataCollectionRate: 92.0 },
        ictStrategy: { count: 2, avgDataCollectionRate: 90.0 }
      }
    };
  }

  async getAverageDataCollectionRate(strategyType) {
    const result = await this.db.get(`
      SELECT AVG(data_collection_rate) as avg_rate
      FROM strategy_monitoring_stats 
      WHERE strategy_type = ?
    `, [strategyType]);

    return result?.avg_rate || 0;
  }

  async getAverageSimulationCompletionRate(strategyType) {
    const result = await this.db.get(`
      SELECT AVG(simulation_completion_rate) as avg_rate
      FROM strategy_monitoring_stats 
      WHERE strategy_type = ?
    `, [strategyType]);

    return result?.avg_rate || 0;
  }
}

module.exports = UnifiedStrategyAPI;
