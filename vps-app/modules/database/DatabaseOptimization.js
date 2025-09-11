// modules/database/DatabaseOptimization.js
// 数据库优化模块 - 实施表结构优化建议

const DatabaseManager = require('./DatabaseManager');

class DatabaseOptimization {
  constructor(databaseManager = null) {
    this.db = databaseManager;
  }

  /**
   * 创建数据刷新状态表
   */
  async createDataRefreshStatusTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS data_refresh_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        data_type TEXT NOT NULL, -- '4h_trend', '1h_scoring', '15m_entry'
        last_refresh TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        next_refresh TIMESTAMP,
        should_refresh BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(symbol, data_type)
      )
    `;

    await this.db.run(sql);
    console.log('✅ 数据刷新状态表创建成功');
  }

  /**
   * 创建V3策略分析表
   */
  async createStrategyV3AnalysisTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS strategy_v3_analysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        trend4h TEXT, -- '多头趋势', '空头趋势', '震荡市'
        market_type TEXT, -- '趋势市', '震荡市'
        signal TEXT, -- 'BUY', 'SHORT', 'NONE'
        execution_mode TEXT, -- '趋势跟踪', '假突破反手', 'NONE'
        entry_signal REAL,
        stop_loss REAL,
        take_profit REAL,
        max_leverage INTEGER,
        min_margin REAL,
        stop_loss_distance REAL,
        atr_value REAL,
        atr14 REAL,
        current_price REAL,
        score1h INTEGER,
        vwap_direction_consistent BOOLEAN,
        range_lower_boundary_valid BOOLEAN,
        range_upper_boundary_valid BOOLEAN,
        factors TEXT, -- JSON格式存储多因子数据
        reason TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await this.db.run(sql);
    console.log('✅ V3策略分析表创建成功');
  }

  /**
   * 优化现有表结构
   */
  async optimizeExistingTables() {
    // 为strategy_analysis表添加V3策略字段
    const addV3Fields = [
      "ALTER TABLE strategy_analysis ADD COLUMN trend4h TEXT",
      "ALTER TABLE strategy_analysis ADD COLUMN market_type TEXT",
      "ALTER TABLE strategy_analysis ADD COLUMN range_lower_boundary_valid BOOLEAN DEFAULT FALSE",
      "ALTER TABLE strategy_analysis ADD COLUMN range_upper_boundary_valid BOOLEAN DEFAULT FALSE",
      "ALTER TABLE strategy_analysis ADD COLUMN factor_score INTEGER DEFAULT 0",
      "ALTER TABLE strategy_analysis ADD COLUMN boundary_score_1h INTEGER DEFAULT 0",
      "ALTER TABLE strategy_analysis ADD COLUMN bb_width_15m REAL",
      "ALTER TABLE strategy_analysis ADD COLUMN fake_breakout_detected BOOLEAN DEFAULT FALSE"
    ];

    for (const sql of addV3Fields) {
      try {
        await this.db.run(sql);
      } catch (error) {
        // 字段可能已存在，忽略错误
        if (!error.message.includes('duplicate column name')) {
          console.warn(`字段添加警告: ${error.message}`);
        }
      }
    }

    // 为simulations表添加V3策略字段
    const addSimulationFields = [
      "ALTER TABLE simulations ADD COLUMN strategy_version TEXT DEFAULT 'V3'",
      "ALTER TABLE simulations ADD COLUMN execution_mode TEXT",
      "ALTER TABLE simulations ADD COLUMN atr14 REAL",
      "ALTER TABLE simulations ADD COLUMN max_drawdown REAL DEFAULT 0",
      "ALTER TABLE simulations ADD COLUMN sharpe_ratio REAL DEFAULT 0"
    ];

    for (const sql of addSimulationFields) {
      try {
        await this.db.run(sql);
      } catch (error) {
        if (!error.message.includes('duplicate column name')) {
          console.warn(`字段添加警告: ${error.message}`);
        }
      }
    }

    console.log('✅ 现有表结构优化完成');
  }

  /**
   * 创建优化索引
   */
  async createOptimizedIndexes() {
    const indexes = [
      "CREATE INDEX IF NOT EXISTS idx_strategy_analysis_symbol_time ON strategy_analysis(symbol, timestamp)",
      "CREATE INDEX IF NOT EXISTS idx_strategy_v3_analysis_symbol_time ON strategy_v3_analysis(symbol, timestamp)",
      "CREATE INDEX IF NOT EXISTS idx_data_refresh_status_symbol_type ON data_refresh_status(symbol, data_type)",
      "CREATE INDEX IF NOT EXISTS idx_simulations_symbol_status ON simulations(symbol, status)",
      "CREATE INDEX IF NOT EXISTS idx_strategy_analysis_trend4h ON strategy_analysis(trend4h)",
      "CREATE INDEX IF NOT EXISTS idx_strategy_analysis_market_type ON strategy_analysis(market_type)",
      "CREATE INDEX IF NOT EXISTS idx_simulations_strategy_version ON simulations(strategy_version)"
    ];

    for (const sql of indexes) {
      try {
        await this.db.run(sql);
      } catch (error) {
        console.warn(`索引创建警告: ${error.message}`);
      }
    }

    console.log('✅ 优化索引创建完成');
  }

  /**
   * 实施数据清理策略
   */
  async implementDataCleanup() {
    // 清理30天前的详细数据
    const cleanupOldData = `
      DELETE FROM strategy_analysis 
      WHERE timestamp < datetime('now', '-30 days')
    `;

    await this.db.run(cleanupOldData);

    // 清理7天前的监控日志
    const cleanupLogs = `
      DELETE FROM analysis_logs 
      WHERE created_at < datetime('now', '-7 days')
    `;

    await this.db.run(cleanupLogs);

    console.log('✅ 数据清理完成');
  }

  /**
   * 执行完整的数据库优化
   */
  async optimizeDatabase() {
    try {
      console.log('🚀 开始数据库优化...');

      await this.createDataRefreshStatusTable();
      await this.createStrategyV3AnalysisTable();
      await this.optimizeExistingTables();
      await this.createOptimizedIndexes();
      await this.implementDataCleanup();

      console.log('✅ 数据库优化完成');
      return true;
    } catch (error) {
      console.error('❌ 数据库优化失败:', error);
      throw error;
    }
  }

  /**
   * 获取数据库性能统计
   */
  async getPerformanceStats() {
    if (!this.db) {
      return { error: '数据库连接未初始化' };
    }

    const stats = {};

    try {
      // 获取表大小统计
      const tableStats = await this.db.all(`
        SELECT 
          name,
          (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=m.name) as row_count
        FROM sqlite_master m 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `);

      stats.tables = tableStats;

      // 获取索引统计
      const indexStats = await this.db.all(`
        SELECT name, sql FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'
      `);

      stats.indexes = indexStats;

      return stats;
    } catch (error) {
      console.error('获取数据库统计失败:', error);
      return { error: error.message };
    }
  }
}

module.exports = DatabaseOptimization;
