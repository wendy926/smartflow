// UnifiedMonitoringMigration.js - 统一监控中心数据库迁移脚本

class UnifiedMonitoringMigration {
  constructor(database) {
    this.db = database;
  }

  /**
   * 执行统一监控中心数据库迁移
   */
  async migrate() {
    try {
      console.log('🚀 开始统一监控中心数据库迁移...');

      // 1. 创建统一监控统计表
      await this.createStrategyMonitoringStatsTable();

      // 2. 创建数据刷新状态表
      await this.createDataRefreshStatusTable();

      // 3. 创建统一模拟交易表
      await this.createUnifiedSimulationsTable();

      // 4. 创建监控告警表
      await this.createMonitoringAlertsTable();

      // 5. 扩展现有表结构
      await this.extendExistingTables();

      // 6. 创建索引
      await this.createIndexes();

      // 7. 初始化数据（暂时跳过，避免内存问题）
      // await this.initializeData();

      console.log('✅ 统一监控中心数据库迁移完成');
      return true;
    } catch (error) {
      console.error('❌ 统一监控中心数据库迁移失败:', error);
      throw error;
    }
  }

  /**
   * 创建策略监控统计表
   */
  async createStrategyMonitoringStatsTable() {
    const createTableSQL = `
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
        
        -- 唯一约束
        UNIQUE(symbol, strategy_type, timestamp)
      )
    `;

    await new Promise((resolve, reject) => {
      this.db.run(createTableSQL, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('✅ 创建策略监控统计表完成');
  }

  /**
   * 创建数据刷新状态表
   */
  async createDataRefreshStatusTable() {
    const createTableSQL = `
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
        
        -- 唯一约束
        UNIQUE(symbol, strategy_type, data_type)
      )
    `;

    await new Promise((resolve, reject) => {
      this.db.run(createTableSQL, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('✅ 创建数据刷新状态表完成');
  }

  /**
   * 创建统一模拟交易表
   */
  async createUnifiedSimulationsTable() {
    const createTableSQL = `
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
    `;

    await new Promise((resolve, reject) => {
      this.db.run(createTableSQL, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('✅ 创建统一模拟交易表完成');
  }

  /**
   * 创建监控告警表
   */
  async createMonitoringAlertsTable() {
    const createTableSQL = `
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
    `;

    await new Promise((resolve, reject) => {
      this.db.run(createTableSQL, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('✅ 创建监控告警表完成');
  }

  /**
   * 扩展现有表结构
   */
  async extendExistingTables() {
    try {
      // 扩展 strategy_analysis 表
      await this.extendStrategyAnalysisTable();

      // 扩展 ict_strategy_analysis 表
      await this.extendICTStrategyAnalysisTable();

      console.log('✅ 扩展现有表结构完成');
    } catch (error) {
      console.log('⚠️ 扩展现有表结构时出现错误（可能字段已存在）:', error.message);
    }
  }

  /**
   * 扩展 strategy_analysis 表
   */
  async extendStrategyAnalysisTable() {
    // 检查表是否存在
    const tableExists = await this.checkTableExists('strategy_analysis');
    if (!tableExists) {
      console.log('⚠️ strategy_analysis 表不存在，跳过扩展');
      return;
    }

    const alterSQLs = [
      "ALTER TABLE strategy_analysis ADD COLUMN strategy_type TEXT DEFAULT 'V3'",
      "ALTER TABLE strategy_analysis ADD COLUMN unified_monitoring_data TEXT"
    ];

    for (const sql of alterSQLs) {
      try {
        await new Promise((resolve, reject) => {
          this.db.run(sql, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      } catch (error) {
        if (!error.message.includes('duplicate column name')) {
          console.warn(`⚠️ 扩展 strategy_analysis 表失败: ${error.message}`);
        }
      }
    }
  }

  /**
   * 扩展 ict_strategy_analysis 表
   */
  async extendICTStrategyAnalysisTable() {
    // 检查表是否存在
    const tableExists = await this.checkTableExists('ict_strategy_analysis');
    if (!tableExists) {
      console.log('⚠️ ict_strategy_analysis 表不存在，跳过扩展');
      return;
    }

    const alterSQLs = [
      "ALTER TABLE ict_strategy_analysis ADD COLUMN unified_monitoring_data TEXT",
      "ALTER TABLE ict_strategy_analysis ADD COLUMN strategy_type TEXT DEFAULT 'ICT'"
    ];

    for (const sql of alterSQLs) {
      try {
        await new Promise((resolve, reject) => {
          this.db.run(sql, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      } catch (error) {
        if (!error.message.includes('duplicate column name')) {
          console.warn(`⚠️ 扩展 ict_strategy_analysis 表失败: ${error.message}`);
        }
      }
    }
  }

  /**
   * 创建索引
   */
  async createIndexes() {
    const indexes = [
      // 策略监控统计表索引
      "CREATE INDEX IF NOT EXISTS idx_strategy_monitoring_symbol_type ON strategy_monitoring_stats(symbol, strategy_type)",
      "CREATE INDEX IF NOT EXISTS idx_strategy_monitoring_timestamp ON strategy_monitoring_stats(timestamp)",

      // 数据刷新状态表索引
      "CREATE INDEX IF NOT EXISTS idx_data_refresh_symbol_type ON data_refresh_status(symbol, strategy_type)",
      "CREATE INDEX IF NOT EXISTS idx_data_refresh_should_refresh ON data_refresh_status(should_refresh)",

      // 统一模拟交易表索引
      "CREATE INDEX IF NOT EXISTS idx_unified_simulations_symbol ON unified_simulations(symbol)",
      "CREATE INDEX IF NOT EXISTS idx_unified_simulations_strategy ON unified_simulations(strategy_type)",
      "CREATE INDEX IF NOT EXISTS idx_unified_simulations_status ON unified_simulations(status)",
      "CREATE INDEX IF NOT EXISTS idx_unified_simulations_created ON unified_simulations(created_at)",

      // 监控告警表索引
      "CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_symbol_strategy ON monitoring_alerts(symbol, strategy_type)",
      "CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_type ON monitoring_alerts(alert_type)",
      "CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_severity ON monitoring_alerts(severity)",
      "CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_resolved ON monitoring_alerts(resolved)",
      "CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_created ON monitoring_alerts(created_at)",

      // 现有表索引（如果表存在）
      // "CREATE INDEX IF NOT EXISTS idx_strategy_analysis_strategy_type ON strategy_analysis(strategy_type)"
    ];

    for (const sql of indexes) {
      try {
        await new Promise((resolve, reject) => {
          this.db.run(sql, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      } catch (error) {
        console.log('⚠️ 创建索引时出现错误（可能索引已存在）:', error.message);
      }
    }

    console.log('✅ 创建索引完成');
  }

  /**
   * 初始化数据
   */
  async initializeData() {
    try {
      // 获取所有交易对
      const symbols = await this.getCustomSymbols();
      console.log('📋 获取到交易对:', symbols);

      // 为每个交易对初始化数据刷新状态
      await this.initializeDataRefreshStatus(symbols);

      // 为每个交易对初始化监控统计
      await this.initializeMonitoringStats(symbols);

      console.log('✅ 初始化数据完成');
    } catch (error) {
      console.error('❌ 初始化数据失败:', error);
      // 不抛出错误，允许迁移继续
    }
  }

  /**
   * 初始化数据刷新状态
   */
  async initializeDataRefreshStatus(symbols) {
    const dataTypes = {
      'V3': ['4h_trend', '1h_scoring', '15m_entry'],
      'ICT': ['daily_trend', 'mtf_analysis', 'ltf_analysis']
    };

    const refreshIntervals = {
      '4h_trend': 14400,    // 4小时
      '1h_scoring': 3600,   // 1小时
      '15m_entry': 900,     // 15分钟
      'daily_trend': 86400, // 24小时
      'mtf_analysis': 14400, // 4小时
      'ltf_analysis': 900   // 15分钟
    };

    // 限制符号数量避免内存问题
    const limitedSymbols = symbols.slice(0, 5);

    for (const symbol of limitedSymbols) {
      for (const [strategyType, types] of Object.entries(dataTypes)) {
        for (const dataType of types) {
          try {
            const insertSQL = `
              INSERT OR IGNORE INTO data_refresh_status 
              (symbol, strategy_type, data_type, should_refresh, refresh_interval, created_at)
              VALUES (?, ?, ?, ?, ?, ?)
            `;

            await new Promise((resolve, reject) => {
              this.db.run(insertSQL, [
                symbol,
                strategyType,
                dataType,
                true,
                refreshIntervals[dataType],
                new Date().toISOString()
              ], (err) => {
                if (err) reject(err);
                else resolve();
              });
            });
          } catch (error) {
            console.warn(`⚠️ 初始化数据刷新状态失败 [${symbol}][${strategyType}][${dataType}]:`, error.message);
          }
        }
      }
    }
  }

  /**
   * 初始化监控统计
   */
  async initializeMonitoringStats(symbols) {
    const strategies = ['V3', 'ICT'];

    // 限制符号数量避免内存问题
    const limitedSymbols = symbols.slice(0, 5);

    for (const symbol of limitedSymbols) {
      for (const strategyType of strategies) {
        try {
          const insertSQL = `
            INSERT OR IGNORE INTO strategy_monitoring_stats 
            (symbol, strategy_type, data_collection_rate, data_validation_status, 
             simulation_completion_rate, overall_health, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `;

          await new Promise((resolve, reject) => {
            this.db.run(insertSQL, [
              symbol,
              strategyType,
              0,
              'UNKNOWN',
              0,
              'UNKNOWN',
              new Date().toISOString()
            ], (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        } catch (error) {
          console.warn(`⚠️ 初始化监控统计失败 [${symbol}][${strategyType}]:`, error.message);
        }
      }
    }
  }

  /**
   * 迁移现有模拟交易数据到统一表
   */
  async migrateExistingSimulations() {
    try {
      console.log('🔄 开始迁移现有模拟交易数据...');

      // 迁移V3策略模拟交易数据
      await this.migrateV3Simulations();

      // 迁移ICT策略模拟交易数据
      await this.migrateICTSimulations();

      console.log('✅ 模拟交易数据迁移完成');
    } catch (error) {
      console.error('❌ 模拟交易数据迁移失败:', error);
      throw error;
    }
  }

  /**
   * 迁移V3策略模拟交易数据
   */
  async migrateV3Simulations() {
    const selectSQL = `
      SELECT * FROM simulations 
      WHERE id NOT IN (SELECT id FROM unified_simulations WHERE strategy_type = 'V3')
    `;

    const simulations = await this.db.all(selectSQL);

    for (const sim of simulations) {
      const insertSQL = `
        INSERT INTO unified_simulations 
        (symbol, strategy_type, entry_price, stop_loss_price, take_profit_price,
         max_leverage, min_margin, stop_loss_distance, atr_value, direction,
         status, trigger_reason, execution_mode, market_type, setup_candle_high,
         setup_candle_low, atr14, time_in_position, max_time_in_position,
         created_at, closed_at, exit_price, exit_reason, is_win, profit_loss)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await new Promise((resolve, reject) => {
        this.db.run(insertSQL, [
          sim.symbol,
          'V3',
          sim.entry_price,
          sim.stop_loss_price,
          sim.take_profit_price,
          sim.max_leverage,
          sim.min_margin,
          sim.stop_loss_distance,
          sim.atr_value,
          sim.direction,
          sim.status,
          sim.trigger_reason,
          sim.execution_mode_v3,
          sim.market_type,
          sim.setup_candle_high,
          sim.setup_candle_low,
          sim.atr14,
          sim.time_in_position,
          sim.max_time_in_position,
          sim.created_at,
          sim.closed_at,
          sim.exit_price,
          sim.exit_reason,
          sim.is_win,
          sim.profit_loss
        ], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }

  /**
   * 迁移ICT策略模拟交易数据
   */
  async migrateICTSimulations() {
    const selectSQL = `
      SELECT * FROM ict_simulations 
      WHERE id NOT IN (SELECT id FROM unified_simulations WHERE strategy_type = 'ICT')
    `;

    const simulations = await this.db.all(selectSQL);

    for (const sim of simulations) {
      const insertSQL = `
        INSERT INTO unified_simulations 
        (symbol, strategy_type, entry_price, stop_loss_price, take_profit_price,
         max_leverage, min_margin, direction, status, trigger_reason, created_at,
         closed_at, exit_price, exit_reason, is_win, profit_loss)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await new Promise((resolve, reject) => {
        this.db.run(insertSQL, [
          sim.symbol,
          'ICT',
          sim.entry_price,
          sim.stop_loss,
          sim.take_profit,
          sim.max_leverage || 10,
          sim.min_margin || 100,
          sim.direction,
          sim.status,
          sim.trigger_reason || 'ICT_SIGNAL',
          sim.created_at,
          sim.closed_at,
          sim.exit_price,
          sim.exit_reason,
          sim.is_win,
          sim.profit_loss
        ], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }

  /**
   * 检查表是否存在
   */
  async checkTableExists(tableName) {
    try {
      const result = await this.db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        [tableName]
      );
      return !!result;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取自定义交易对列表
   */
  async getCustomSymbols() {
    try {
      const result = await this.db.all('SELECT symbol FROM custom_symbols ORDER BY symbol');
      return result.map(row => row.symbol);
    } catch (error) {
      console.warn('⚠️ 获取交易对列表失败，使用默认列表:', error.message);
      return ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'DOTUSDT'];
    }
  }

  /**
   * 获取迁移统计信息
   */
  async getMigrationStats() {
    try {
      const stats = {};

      // 策略监控统计表记录数
      try {
        const monitoringStats = await this.db.get('SELECT COUNT(*) as count FROM strategy_monitoring_stats');
        stats.strategyMonitoringStats = monitoringStats.count;
      } catch (error) {
        stats.strategyMonitoringStats = 0;
      }

      // 数据刷新状态表记录数
      try {
        const refreshStats = await this.db.get('SELECT COUNT(*) as count FROM data_refresh_status');
        stats.dataRefreshStatus = refreshStats.count;
      } catch (error) {
        stats.dataRefreshStatus = 0;
      }

      // 统一模拟交易表记录数
      try {
        const simulationStats = await this.db.get('SELECT COUNT(*) as count FROM unified_simulations');
        stats.unifiedSimulations = simulationStats.count;
      } catch (error) {
        stats.unifiedSimulations = 0;
      }

      // 监控告警表记录数
      try {
        const alertStats = await this.db.get('SELECT COUNT(*) as count FROM monitoring_alerts');
        stats.monitoringAlerts = alertStats.count;
      } catch (error) {
        stats.monitoringAlerts = 0;
      }

      return stats;
    } catch (error) {
      console.error('❌ 获取迁移统计信息失败:', error);
      return {};
    }
  }
}

module.exports = UnifiedMonitoringMigration;
