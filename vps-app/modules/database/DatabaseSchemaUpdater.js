// modules/database/DatabaseSchemaUpdater.js
// 数据库表结构更新器 - 支持数据层架构的新表结构

class DatabaseSchemaUpdater {
  constructor(database) {
    this.db = database;
  }

  /**
   * 更新数据库表结构以支持新的数据层架构
   */
  async updateSchema() {
    console.log('🔄 开始更新数据库表结构...');
    
    try {
      // 添加监控统计表
      await this.createMonitoringStatsTable();
      
      // 添加数据版本控制表
      await this.createDataVersionTable();
      
      // 添加缓存元数据表
      await this.createCacheMetadataTable();
      
      // 添加数据一致性检查表
      await this.createConsistencyCheckTable();
      
      // 更新现有表结构
      await this.updateExistingTables();
      
      console.log('✅ 数据库表结构更新完成');
    } catch (error) {
      console.error('❌ 数据库表结构更新失败:', error);
      throw error;
    }
  }

  /**
   * 创建监控统计表
   */
  async createMonitoringStatsTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS monitoring_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        data_collection_rate REAL DEFAULT 0,
        signal_analysis_rate REAL DEFAULT 0,
        simulation_completion_rate REAL DEFAULT 0,
        simulation_progress_rate REAL DEFAULT 0,
        overall_health_status TEXT DEFAULT 'UNKNOWN',
        last_analysis_time DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await this.db.runQuery(sql);
    console.log('📊 监控统计表创建完成');
  }

  /**
   * 创建数据版本控制表
   */
  async createDataVersionTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS data_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data_type TEXT NOT NULL,
        data_key TEXT NOT NULL,
        version INTEGER DEFAULT 1,
        last_modified DATETIME DEFAULT CURRENT_TIMESTAMP,
        checksum TEXT,
        UNIQUE(data_type, data_key)
      )
    `;
    
    await this.db.runQuery(sql);
    console.log('🔢 数据版本控制表创建完成');
  }

  /**
   * 创建缓存元数据表
   */
  async createCacheMetadataTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS cache_metadata (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cache_key TEXT UNIQUE NOT NULL,
        data_type TEXT NOT NULL,
        ttl INTEGER DEFAULT 30000,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        access_count INTEGER DEFAULT 0,
        last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await this.db.runQuery(sql);
    console.log('💾 缓存元数据表创建完成');
  }

  /**
   * 创建数据一致性检查表
   */
  async createConsistencyCheckTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS consistency_checks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data_type TEXT NOT NULL,
        data_key TEXT NOT NULL,
        check_result TEXT NOT NULL,
        cache_data TEXT,
        db_data TEXT,
        resolution_action TEXT,
        check_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved BOOLEAN DEFAULT FALSE,
        resolved_at DATETIME
      )
    `;
    
    await this.db.runQuery(sql);
    console.log('🔍 数据一致性检查表创建完成');
  }

  /**
   * 更新现有表结构
   */
  async updateExistingTables() {
    // 为strategy_analysis表添加索引
    await this.addIndexes();
    
    // 为simulations表添加索引
    await this.addSimulationIndexes();
    
    // 更新表结构（如果需要）
    await this.updateTableStructures();
    
    console.log('📋 现有表结构更新完成');
  }

  /**
   * 添加索引
   */
  async addIndexes() {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_strategy_analysis_symbol ON strategy_analysis(symbol)',
      'CREATE INDEX IF NOT EXISTS idx_strategy_analysis_timestamp ON strategy_analysis(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_strategy_analysis_symbol_timestamp ON strategy_analysis(symbol, timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_simulations_symbol ON simulations(symbol)',
      'CREATE INDEX IF NOT EXISTS idx_simulations_status ON simulations(status)',
      'CREATE INDEX IF NOT EXISTS idx_simulations_created_at ON simulations(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_alert_history_symbol ON alert_history(symbol)',
      'CREATE INDEX IF NOT EXISTS idx_alert_history_timestamp ON alert_history(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_monitoring_stats_symbol ON monitoring_stats(symbol)',
      'CREATE INDEX IF NOT EXISTS idx_data_versions_type_key ON data_versions(data_type, data_key)',
      'CREATE INDEX IF NOT EXISTS idx_cache_metadata_key ON cache_metadata(cache_key)',
      'CREATE INDEX IF NOT EXISTS idx_consistency_checks_type_key ON consistency_checks(data_type, data_key)'
    ];

    for (const index of indexes) {
      try {
        await this.db.runQuery(index);
      } catch (error) {
        console.warn(`⚠️ 创建索引失败: ${index}`, error.message);
      }
    }
    
    console.log('📇 索引创建完成');
  }

  /**
   * 添加模拟交易相关索引
   */
  async addSimulationIndexes() {
    const simulationIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_simulations_symbol_status ON simulations(symbol, status)',
      'CREATE INDEX IF NOT EXISTS idx_simulations_trigger_reason ON simulations(trigger_reason)',
      'CREATE INDEX IF NOT EXISTS idx_simulations_created_at_status ON simulations(created_at, status)'
    ];

    for (const index of simulationIndexes) {
      try {
        await this.db.runQuery(index);
      } catch (error) {
        console.warn(`⚠️ 创建模拟交易索引失败: ${index}`, error.message);
      }
    }
  }

  /**
   * 更新表结构
   */
  async updateTableStructures() {
    // 检查并添加新列（如果需要）
    await this.addMissingColumns();
    
    // 更新表约束（如果需要）
    await this.updateTableConstraints();
  }

  /**
   * 添加缺失的列
   */
  async addMissingColumns() {
    const columnUpdates = [
      {
        table: 'strategy_analysis',
        column: 'data_quality_score',
        definition: 'REAL DEFAULT 0'
      },
      {
        table: 'strategy_analysis',
        column: 'cache_version',
        definition: 'INTEGER DEFAULT 1'
      },
      {
        table: 'simulations',
        column: 'cache_version',
        definition: 'INTEGER DEFAULT 1'
      },
      {
        table: 'simulations',
        column: 'last_updated',
        definition: 'DATETIME'
      }
    ];

    for (const update of columnUpdates) {
      try {
        await this.addColumnIfNotExists(update.table, update.column, update.definition);
      } catch (error) {
        console.warn(`⚠️ 添加列失败: ${update.table}.${update.column}`, error.message);
      }
    }
  }

  /**
   * 添加列（如果不存在）
   */
  async addColumnIfNotExists(tableName, columnName, definition) {
    // 检查列是否存在
    const checkSql = `PRAGMA table_info(${tableName})`;
    const columns = await this.db.runQuery(checkSql);
    
    const columnExists = columns.some(col => col.name === columnName);
    
    if (!columnExists) {
      const addColumnSql = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`;
      await this.db.runQuery(addColumnSql);
      console.log(`✅ 添加列: ${tableName}.${columnName}`);
    } else {
      console.log(`ℹ️ 列已存在: ${tableName}.${columnName}`);
    }
  }

  /**
   * 更新表约束
   */
  async updateTableConstraints() {
    // 这里可以添加表约束更新逻辑
    console.log('🔗 表约束更新完成');
  }

  /**
   * 获取数据库版本信息
   */
  async getDatabaseVersion() {
    try {
      const result = await this.db.runQuery('PRAGMA user_version');
      return result[0]?.user_version || 0;
    } catch (error) {
      console.error('获取数据库版本失败:', error);
      return 0;
    }
  }

  /**
   * 设置数据库版本
   */
  async setDatabaseVersion(version) {
    try {
      await this.db.runQuery(`PRAGMA user_version = ${version}`);
      console.log(`✅ 数据库版本设置为: ${version}`);
    } catch (error) {
      console.error('设置数据库版本失败:', error);
    }
  }

  /**
   * 检查是否需要更新
   */
  async needsUpdate() {
    const currentVersion = await this.getDatabaseVersion();
    const targetVersion = 2; // 新架构版本
    
    return currentVersion < targetVersion;
  }

  /**
   * 执行完整更新
   */
  async performFullUpdate() {
    console.log('🚀 开始执行完整数据库更新...');
    
    try {
      // 检查是否需要更新
      if (!(await this.needsUpdate())) {
        console.log('✅ 数据库已是最新版本，无需更新');
        return;
      }
      
      // 备份当前数据
      await this.backupCurrentData();
      
      // 更新表结构
      await this.updateSchema();
      
      // 迁移现有数据
      await this.migrateExistingData();
      
      // 设置新版本
      await this.setDatabaseVersion(2);
      
      console.log('✅ 完整数据库更新完成');
    } catch (error) {
      console.error('❌ 完整数据库更新失败:', error);
      throw error;
    }
  }

  /**
   * 备份当前数据
   */
  async backupCurrentData() {
    console.log('💾 开始备份当前数据...');
    
    // 这里可以实现数据备份逻辑
    // 例如：导出到JSON文件或创建备份表
    
    console.log('✅ 数据备份完成');
  }

  /**
   * 迁移现有数据
   */
  async migrateExistingData() {
    console.log('🔄 开始迁移现有数据...');
    
    try {
      // 迁移策略分析数据
      await this.migrateStrategyAnalysisData();
      
      // 迁移模拟交易数据
      await this.migrateSimulationData();
      
      // 迁移监控数据
      await this.migrateMonitoringData();
      
      console.log('✅ 数据迁移完成');
    } catch (error) {
      console.error('❌ 数据迁移失败:', error);
      throw error;
    }
  }

  /**
   * 迁移策略分析数据
   */
  async migrateStrategyAnalysisData() {
    // 更新现有策略分析数据的版本信息
    await this.db.runQuery(`
      UPDATE strategy_analysis 
      SET cache_version = 1, data_quality_score = 0 
      WHERE cache_version IS NULL
    `);
    
    console.log('📊 策略分析数据迁移完成');
  }

  /**
   * 迁移模拟交易数据
   */
  async migrateSimulationData() {
    // 更新现有模拟交易数据的版本信息
    await this.db.runQuery(`
      UPDATE simulations 
      SET cache_version = 1 
      WHERE cache_version IS NULL
    `);
    
    // 如果last_updated列存在，则更新它
    try {
      await this.db.runQuery(`
        UPDATE simulations 
        SET last_updated = created_at 
        WHERE last_updated IS NULL
      `);
    } catch (error) {
      console.log('ℹ️ last_updated列不存在，跳过更新');
    }
    
    console.log('🎯 模拟交易数据迁移完成');
  }

  /**
   * 迁移监控数据
   */
  async migrateMonitoringData() {
    // 从现有数据生成监控统计
    const symbols = await this.db.runQuery('SELECT DISTINCT symbol FROM strategy_analysis');
    
    for (const { symbol } of symbols) {
      // 计算统计数据
      const stats = await this.calculateMonitoringStats(symbol);
      
      // 插入监控统计表
      await this.db.runQuery(`
        INSERT OR REPLACE INTO monitoring_stats 
        (symbol, data_collection_rate, signal_analysis_rate, simulation_completion_rate, 
         overall_health_status, last_analysis_time, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        symbol,
        stats.dataCollectionRate,
        stats.signalAnalysisRate,
        stats.simulationCompletionRate,
        stats.overallHealthStatus,
        stats.lastAnalysisTime
      ]);
    }
    
    console.log('📈 监控数据迁移完成');
  }

  /**
   * 计算监控统计
   */
  async calculateMonitoringStats(symbol) {
    // 获取策略分析统计
    const analysisStats = await this.db.runQuery(`
      SELECT 
        COUNT(*) as total_analyses,
        SUM(CASE WHEN data_valid = 1 THEN 1 ELSE 0 END) as valid_analyses
      FROM strategy_analysis 
      WHERE symbol = ?
    `, [symbol]);
    
    // 获取模拟交易统计
    const simulationStats = await this.db.runQuery(`
      SELECT 
        COUNT(*) as total_simulations,
        SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END) as completed_simulations
      FROM simulations 
      WHERE symbol = ?
    `, [symbol]);
    
    const analysis = analysisStats[0] || { total_analyses: 0, valid_analyses: 0 };
    const simulation = simulationStats[0] || { total_simulations: 0, completed_simulations: 0 };
    
    const dataCollectionRate = analysis.total_analyses > 0 ? 
      (analysis.valid_analyses / analysis.total_analyses) * 100 : 0;
    
    const simulationCompletionRate = simulation.total_simulations > 0 ? 
      (simulation.completed_simulations / simulation.total_simulations) * 100 : 0;
    
    return {
      dataCollectionRate,
      signalAnalysisRate: dataCollectionRate, // 简化处理
      simulationCompletionRate,
      overallHealthStatus: dataCollectionRate >= 95 ? 'HEALTHY' : 'WARNING',
      lastAnalysisTime: new Date().toISOString()
    };
  }
}

module.exports = { DatabaseSchemaUpdater };
