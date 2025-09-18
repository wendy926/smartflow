/**
 * 统一策略数据库迁移脚本
 * 支持V3和ICT策略的统一监控和管理
 */

const DatabaseManager = require('./DatabaseManager');

class UnifiedStrategyMigration {
  constructor(database) {
    this.db = database;
  }

  /**
   * 执行统一策略数据库迁移
   */
  async migrate() {
    console.log('🚀 开始统一策略数据库迁移...');

    try {
      // 1. 创建统一监控表
      await this.createUnifiedMonitoringTables();

      // 2. 扩展现有表结构
      await this.extendExistingTables();

      // 3. 创建索引
      await this.createIndexes();

      // 4. 迁移现有数据
      await this.migrateExistingData();

      console.log('✅ 统一策略数据库迁移完成');
      return true;
    } catch (error) {
      console.error('❌ 统一策略数据库迁移失败:', error);
      throw error;
    }
  }

  /**
   * 创建统一监控表
   */
  async createUnifiedMonitoringTables() {
    console.log('📊 创建统一监控表...');

    // 策略监控统计表
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS strategy_monitoring_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        strategy_type TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        -- 数据收集指标
        data_collection_rate REAL DEFAULT 0,
        data_collection_attempts INTEGER DEFAULT 0,
        data_collection_successes INTEGER DEFAULT 0,
        data_collection_last_time DATETIME,
        
        -- 数据验证指标
        data_validation_status TEXT DEFAULT 'UNKNOWN',
        data_validation_errors INTEGER DEFAULT 0,
        data_validation_warnings INTEGER DEFAULT 0,
        data_validation_last_check DATETIME,
        
        -- 模拟交易指标
        simulation_completion_rate REAL DEFAULT 0,
        simulation_triggers INTEGER DEFAULT 0,
        simulation_completions INTEGER DEFAULT 0,
        simulation_active_count INTEGER DEFAULT 0,
        
        -- 策略特定指标
        strategy_specific_data TEXT,
        
        -- 健康状态
        overall_health TEXT DEFAULT 'UNKNOWN',
        last_error_message TEXT,
        last_error_time DATETIME,
        
        UNIQUE(symbol, strategy_type, timestamp)
      )
    `);

    // 数据刷新状态表
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS data_refresh_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        strategy_type TEXT NOT NULL,
        data_type TEXT NOT NULL,
        last_refresh DATETIME,
        next_refresh DATETIME,
        should_refresh BOOLEAN DEFAULT TRUE,
        refresh_interval INTEGER DEFAULT 3600,
        refresh_attempts INTEGER DEFAULT 0,
        refresh_successes INTEGER DEFAULT 0,
        last_error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(symbol, strategy_type, data_type)
      )
    `);

    // 统一模拟交易表
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS unified_simulations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        strategy_type TEXT NOT NULL,
        entry_price REAL NOT NULL,
        stop_loss_price REAL NOT NULL,
        take_profit_price REAL NOT NULL,
        max_leverage INTEGER NOT NULL,
        min_margin REAL NOT NULL,
        stop_loss_distance REAL,
        atr_value REAL,
        direction TEXT NOT NULL,
        status TEXT DEFAULT 'ACTIVE',
        trigger_reason TEXT NOT NULL,
        execution_mode TEXT,
        market_type TEXT,
        setup_candle_high REAL,
        setup_candle_low REAL,
        atr14 REAL,
        time_in_position INTEGER DEFAULT 0,
        max_time_in_position INTEGER DEFAULT 48,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME,
        exit_price REAL,
        exit_reason TEXT,
        is_win BOOLEAN,
        profit_loss REAL,
        cache_version INTEGER DEFAULT 1,
        last_updated DATETIME
      )
    `);

    // 监控告警表
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS monitoring_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        strategy_type TEXT NOT NULL,
        alert_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        message TEXT NOT NULL,
        details TEXT,
        resolved BOOLEAN DEFAULT FALSE,
        resolved_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ 统一监控表创建完成');
  }

  /**
   * 扩展现有表结构
   */
  async extendExistingTables() {
    console.log('🔧 扩展现有表结构...');

    // 扩展strategy_analysis表
    const strategyAnalysisColumns = [
      'strategy_type TEXT DEFAULT "V3"',
      'unified_monitoring_data TEXT'
    ];

    for (const column of strategyAnalysisColumns) {
      try {
        await this.db.run(`ALTER TABLE strategy_analysis ADD COLUMN ${column}`);
        console.log(`✅ 添加列: strategy_analysis.${column.split(' ')[0]}`);
      } catch (error) {
        if (error.message.includes('duplicate column name')) {
          console.log(`ℹ️ 列已存在: strategy_analysis.${column.split(' ')[0]}`);
        } else {
          throw error;
        }
      }
    }

    // 扩展simulations表
    const simulationsColumns = [
      'strategy_type TEXT DEFAULT "V3"',
      'unified_monitoring_data TEXT'
    ];

    for (const column of simulationsColumns) {
      try {
        await this.db.run(`ALTER TABLE simulations ADD COLUMN ${column}`);
        console.log(`✅ 添加列: simulations.${column.split(' ')[0]}`);
      } catch (error) {
        if (error.message.includes('duplicate column name')) {
          console.log(`ℹ️ 列已存在: simulations.${column.split(' ')[0]}`);
        } else {
          throw error;
        }
      }
    }

    console.log('✅ 现有表结构扩展完成');
  }

  /**
   * 创建索引
   */
  async createIndexes() {
    console.log('📇 创建索引...');

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_strategy_monitoring_symbol_type ON strategy_monitoring_stats(symbol, strategy_type)',
      'CREATE INDEX IF NOT EXISTS idx_strategy_monitoring_timestamp ON strategy_monitoring_stats(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_data_refresh_symbol_type ON data_refresh_status(symbol, strategy_type)',
      'CREATE INDEX IF NOT EXISTS idx_data_refresh_should_refresh ON data_refresh_status(should_refresh)',
      'CREATE INDEX IF NOT EXISTS idx_unified_simulations_symbol ON unified_simulations(symbol)',
      'CREATE INDEX IF NOT EXISTS idx_unified_simulations_strategy ON unified_simulations(strategy_type)',
      'CREATE INDEX IF NOT EXISTS idx_unified_simulations_status ON unified_simulations(status)',
      'CREATE INDEX IF NOT EXISTS idx_unified_simulations_created ON unified_simulations(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_symbol_strategy ON monitoring_alerts(symbol, strategy_type)',
      'CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_type ON monitoring_alerts(alert_type)',
      'CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_severity ON monitoring_alerts(severity)',
      'CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_resolved ON monitoring_alerts(resolved)',
      'CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_created ON monitoring_alerts(created_at)'
    ];

    for (const indexSQL of indexes) {
      await this.db.run(indexSQL);
    }

    console.log('✅ 索引创建完成');
  }

  /**
   * 迁移现有数据
   */
  async migrateExistingData() {
    console.log('🔄 开始迁移现有数据...');

    // 迁移strategy_analysis数据
    const strategyData = await this.db.runQuery('SELECT * FROM strategy_analysis WHERE strategy_type IS NULL');
    if (strategyData.length > 0) {
      await this.db.runQuery('UPDATE strategy_analysis SET strategy_type = "V3" WHERE strategy_type IS NULL');
      console.log(`📊 策略分析数据迁移完成: ${strategyData.length} 条记录`);
    }

    // 迁移simulations数据
    const simulationData = await this.db.runQuery('SELECT * FROM simulations WHERE strategy_type IS NULL');
    if (simulationData.length > 0) {
      await this.db.runQuery('UPDATE simulations SET strategy_type = "V3" WHERE strategy_type IS NULL');
      console.log(`🎯 模拟交易数据迁移完成: ${simulationData.length} 条记录`);
    }

    // 初始化数据刷新状态
    const symbols = await this.db.runQuery('SELECT DISTINCT symbol FROM custom_symbols');
    for (const { symbol } of symbols) {
      const refreshTypes = [
        { strategy_type: 'V3', data_type: '4h_trend', refresh_interval: 14400 },
        { strategy_type: 'V3', data_type: '1h_scoring', refresh_interval: 3600 },
        { strategy_type: 'V3', data_type: '15m_entry', refresh_interval: 900 },
        { strategy_type: 'ICT', data_type: 'daily_trend', refresh_interval: 86400 },
        { strategy_type: 'ICT', data_type: 'mtf_analysis', refresh_interval: 14400 },
        { strategy_type: 'ICT', data_type: 'ltf_analysis', refresh_interval: 900 }
      ];

      for (const refreshType of refreshTypes) {
        await this.db.runQuery(`
          INSERT OR IGNORE INTO data_refresh_status 
          (symbol, strategy_type, data_type, refresh_interval, should_refresh)
          VALUES (?, ?, ?, ?, 1)
        `, [symbol, refreshType.strategy_type, refreshType.data_type, refreshType.refresh_interval]);
      }
    }

    console.log('✅ 数据迁移完成');
  }
}

module.exports = UnifiedStrategyMigration;
