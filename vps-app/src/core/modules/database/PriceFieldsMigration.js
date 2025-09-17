// PriceFieldsMigration.js - 高性能价格字段数据库迁移脚本

class PriceFieldsMigration {
  constructor(database) {
    this.db = database;
    this.migrationVersion = '1.0.0';
  }

  /**
   * 兼容的数据库执行方法
   */
  async execSQL(sql, params = []) {
    if (typeof this.db.run === 'function') {
      // 传统sqlite3 API
      return new Promise((resolve, reject) => {
        this.db.run(sql, params, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } else {
      // better-sqlite3 API
      if (params.length > 0) {
        const stmt = this.db.prepare(sql);
        return stmt.run(params);
      } else {
        return this.db.exec(sql);
      }
    }
  }

  async getSQL(sql, params = []) {
    if (typeof this.db.get === 'function') {
      // 传统sqlite3 API
      return new Promise((resolve, reject) => {
        this.db.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    } else {
      // better-sqlite3 API
      const stmt = this.db.prepare(sql);
      return stmt.get(params);
    }
  }

  async allSQL(sql, params = []) {
    if (typeof this.db.all === 'function') {
      // 传统sqlite3 API
      return new Promise((resolve, reject) => {
        this.db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    } else {
      // better-sqlite3 API
      const stmt = this.db.prepare(sql);
      return stmt.all(params);
    }
  }

  /**
   * 执行价格字段迁移
   */
  async migrate() {
    console.log('🚀 开始高性能价格字段数据库迁移...');
    
    try {
      // 1. 检查迁移状态
      await this.checkMigrationStatus();
      
      // 2. 创建价格数据专用表
      await this.createPriceDataTables();
      
      // 3. 扩展现有表结构
      await this.extendExistingTables();
      
      // 4. 创建高性能索引
      await this.createPerformanceIndexes();
      
      // 5. 创建物化视图
      await this.createMaterializedViews();
      
      // 6. 初始化默认数据
      await this.initializeDefaultData();
      
      // 7. 验证迁移结果
      await this.validateMigration();
      
      // 8. 记录迁移状态
      await this.recordMigrationStatus();
      
      console.log('✅ 高性能价格字段数据库迁移完成');
      return {
        success: true,
        version: this.migrationVersion,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ 价格字段数据库迁移失败:', error);
      throw error;
    }
  }

  /**
   * 检查迁移状态
   */
  async checkMigrationStatus() {
    const query = `
      CREATE TABLE IF NOT EXISTS migration_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        migration_name TEXT NOT NULL,
        version TEXT NOT NULL,
        status TEXT NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(migration_name, version)
      )
    `;
    
    await this.execSQL(query);

    // 检查是否已经执行过此迁移
    const existingMigration = await this.getSQL(
      'SELECT * FROM migration_history WHERE migration_name = ? AND version = ?',
      ['PriceFieldsMigration', this.migrationVersion]
    );

    if (existingMigration && existingMigration.status === 'completed') {
      console.log('⚠️ 价格字段迁移已完成，跳过执行');
      return false;
    }

    return true;
  }

  /**
   * 创建价格数据专用表
   */
  async createPriceDataTables() {
    console.log('📊 创建价格数据专用表...');

    // ICT策略价格表
    const ictPriceTableSQL = `
      CREATE TABLE IF NOT EXISTS ict_price_ranges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        timeframe TEXT NOT NULL DEFAULT '4H',
        
        -- OB价格区间 (Order Block)
        ob_upper_price REAL,
        ob_lower_price REAL,
        ob_mid_price REAL,
        ob_range_width REAL,
        ob_volume REAL,
        ob_strength REAL DEFAULT 0,
        ob_age_hours INTEGER DEFAULT 0,
        ob_tested_count INTEGER DEFAULT 0,
        ob_last_test_time DATETIME,
        
        -- FVG价格区间 (Fair Value Gap)  
        fvg_upper_price REAL,
        fvg_lower_price REAL,
        fvg_mid_price REAL,
        fvg_range_width REAL,
        fvg_type TEXT,
        fvg_strength REAL DEFAULT 0,
        fvg_age_hours INTEGER DEFAULT 0,
        fvg_filled_percentage REAL DEFAULT 0,
        
        -- 当前价格相关 (预计算距离)
        current_price REAL,
        distance_to_ob_upper REAL,
        distance_to_ob_lower REAL,
        distance_to_fvg_upper REAL,
        distance_to_fvg_lower REAL,
        
        -- 区间关系 (预计算)
        ob_fvg_overlap BOOLEAN DEFAULT FALSE,
        ob_fvg_gap_size REAL,
        price_in_ob BOOLEAN DEFAULT FALSE,
        price_in_fvg BOOLEAN DEFAULT FALSE,
        
        -- 性能优化字段
        is_active BOOLEAN DEFAULT TRUE,
        priority_score REAL DEFAULT 0,
        last_calculated DATETIME DEFAULT CURRENT_TIMESTAMP,
        calculation_version INTEGER DEFAULT 1,
        
        -- 时间戳
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        -- 复合唯一索引
        UNIQUE(symbol, timeframe)
      )
    `;

    // V3策略价格表
    const v3PriceTableSQL = `
      CREATE TABLE IF NOT EXISTS v3_price_ranges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        timeframe TEXT NOT NULL DEFAULT '1H',
        
        -- 震荡市区间价格
        range_upper_boundary REAL,
        range_lower_boundary REAL,
        range_mid_price REAL,
        range_width REAL,
        range_width_percentage REAL,
        range_volume_profile TEXT,
        range_test_count_upper INTEGER DEFAULT 0,
        range_test_count_lower INTEGER DEFAULT 0,
        range_breakout_probability REAL DEFAULT 0,
        
        -- 趋势市入场价格
        trend_entry_price REAL,
        trend_confirmation_price REAL,
        trend_breakout_price REAL,
        trend_invalidation_price REAL,
        trend_momentum_score REAL DEFAULT 0,
        trend_volume_confirmation REAL DEFAULT 0,
        
        -- 当前价格相关 (预计算)
        current_price REAL,
        price_position_in_range REAL,
        distance_to_upper_boundary REAL,
        distance_to_lower_boundary REAL,
        distance_to_trend_entry REAL,
        
        -- 市场状态判断 (预计算)
        market_type TEXT,
        market_phase TEXT,
        volatility_regime TEXT,
        
        -- 风险管理 (预计算)
        optimal_stop_loss REAL,
        risk_reward_ratio REAL,
        position_size_suggestion REAL,
        
        -- 性能优化字段
        is_active BOOLEAN DEFAULT TRUE,
        priority_score REAL DEFAULT 0,
        last_calculated DATETIME DEFAULT CURRENT_TIMESTAMP,
        calculation_version INTEGER DEFAULT 1,
        
        -- 时间戳
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        -- 复合唯一索引
        UNIQUE(symbol, timeframe)
      )
    `;

    // 执行表创建
    await this.execSQL(ictPriceTableSQL);
    console.log('✅ ICT价格表创建完成');

    await this.execSQL(v3PriceTableSQL);
    console.log('✅ V3价格表创建完成');
  }

  /**
   * 扩展现有表结构
   */
  async extendExistingTables() {
    console.log('🔧 扩展现有表结构...');

    // 获取现有表的列信息
    const getTableColumns = async (tableName) => {
      try {
        const rows = await this.allSQL(`PRAGMA table_info(${tableName})`);
        return rows.map(row => row.name);
      } catch (error) {
        return [];
      }
    };

    // 扩展ICT策略表
    const ictColumns = await getTableColumns('ict_strategy_analysis').catch(() => []);
    if (ictColumns.length > 0) {
      const ictExtensions = [
        'ALTER TABLE ict_strategy_analysis ADD COLUMN price_range_id INTEGER',
        'ALTER TABLE ict_strategy_analysis ADD COLUMN price_data_version INTEGER DEFAULT 1',
        'ALTER TABLE ict_strategy_analysis ADD COLUMN price_last_updated DATETIME'
      ];

      for (const sql of ictExtensions) {
        try {
          await this.execSQL(sql);
        } catch (error) {
          if (!error.message.includes('duplicate column')) {
            console.warn(`⚠️ ICT表扩展警告: ${error.message}`);
          }
        }
      }
      console.log('✅ ICT策略表扩展完成');
    }

    // 扩展V3策略表
    const v3Columns = await getTableColumns('strategy_analysis').catch(() => []);
    if (v3Columns.length > 0) {
      const v3Extensions = [
        'ALTER TABLE strategy_analysis ADD COLUMN price_range_id INTEGER',
        'ALTER TABLE strategy_analysis ADD COLUMN price_data_version INTEGER DEFAULT 1',
        'ALTER TABLE strategy_analysis ADD COLUMN price_last_updated DATETIME'
      ];

      for (const sql of v3Extensions) {
        try {
          await this.execSQL(sql);
        } catch (error) {
          if (!error.message.includes('duplicate column')) {
            console.warn(`⚠️ V3表扩展警告: ${error.message}`);
          }
        }
      }
      console.log('✅ V3策略表扩展完成');
    }
  }

  /**
   * 创建高性能索引
   */
  async createPerformanceIndexes() {
    console.log('⚡ 创建高性能索引...');

    const indexes = [
      // ICT价格表索引
      'CREATE INDEX IF NOT EXISTS idx_ict_symbol_active ON ict_price_ranges(symbol, is_active, priority_score DESC)',
      'CREATE INDEX IF NOT EXISTS idx_ict_timeframe_updated ON ict_price_ranges(timeframe, updated_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_ict_price_in_ranges ON ict_price_ranges(symbol, price_in_ob, price_in_fvg)',
      'CREATE INDEX IF NOT EXISTS idx_ict_strength_scores ON ict_price_ranges(symbol, ob_strength DESC, fvg_strength DESC)',
      'CREATE INDEX IF NOT EXISTS idx_ict_active_updated ON ict_price_ranges(symbol, is_active, updated_at DESC, priority_score DESC)',

      // V3价格表索引
      'CREATE INDEX IF NOT EXISTS idx_v3_symbol_active ON v3_price_ranges(symbol, is_active, priority_score DESC)',
      'CREATE INDEX IF NOT EXISTS idx_v3_market_type ON v3_price_ranges(symbol, market_type, market_phase)',
      'CREATE INDEX IF NOT EXISTS idx_v3_price_position ON v3_price_ranges(symbol, price_position_in_range)',
      'CREATE INDEX IF NOT EXISTS idx_v3_updated_priority ON v3_price_ranges(updated_at DESC, priority_score DESC)',
      'CREATE INDEX IF NOT EXISTS idx_v3_active_updated ON v3_price_ranges(symbol, is_active, updated_at DESC, priority_score DESC)',

      // 关联索引
      'CREATE INDEX IF NOT EXISTS idx_ict_analysis_price_range ON ict_strategy_analysis(price_range_id)',
      'CREATE INDEX IF NOT EXISTS idx_v3_analysis_price_range ON strategy_analysis(price_range_id)'
    ];

    for (const indexSQL of indexes) {
      try {
        await this.execSQL(indexSQL);
      } catch (error) {
        console.warn(`⚠️ 索引创建警告: ${error.message}`);
      }
    }

    console.log('✅ 高性能索引创建完成');
  }

  /**
   * 创建物化视图
   */
  async createMaterializedViews() {
    console.log('📈 创建物化视图...');

    // 活跃价格摘要视图
    const activePriceSummaryView = `
      CREATE VIEW IF NOT EXISTS active_price_summary AS
      SELECT 
        'ICT' as strategy_type,
        symbol,
        COUNT(*) as record_count,
        AVG(priority_score) as avg_priority,
        MAX(updated_at) as last_update,
        AVG(ob_strength) as avg_ob_strength,
        AVG(fvg_strength) as avg_fvg_strength,
        SUM(CASE WHEN price_in_ob OR price_in_fvg THEN 1 ELSE 0 END) as active_ranges
      FROM ict_price_ranges 
      WHERE is_active = TRUE 
      GROUP BY symbol
      
      UNION ALL
      
      SELECT 
        'V3' as strategy_type,
        symbol,
        COUNT(*) as record_count,
        AVG(priority_score) as avg_priority,
        MAX(updated_at) as last_update,
        AVG(trend_momentum_score) as avg_ob_strength,
        AVG(range_breakout_probability) as avg_fvg_strength,
        SUM(CASE WHEN market_type = 'trending' THEN 1 ELSE 0 END) as active_ranges
      FROM v3_price_ranges 
      WHERE is_active = TRUE 
      GROUP BY symbol
    `;

    await this.execSQL(activePriceSummaryView);

    console.log('✅ 物化视图创建完成');
  }

  /**
   * 初始化默认数据
   */
  async initializeDefaultData() {
    console.log('🔄 初始化默认数据...');

    // 获取现有交易对列表
    const symbols = await this.getExistingSymbols();
    
    if (symbols.length === 0) {
      console.log('⚠️ 未找到现有交易对，跳过数据初始化');
      return;
    }

    // 为每个交易对创建默认价格记录
    const defaultRecords = symbols.map(symbol => ({
      symbol,
      priority_score: 50, // 默认优先级
      is_active: true,
      calculation_version: 1
    }));

    // 批量插入默认记录
    await this.batchInsertDefaultRecords('ict_price_ranges', defaultRecords);
    await this.batchInsertDefaultRecords('v3_price_ranges', defaultRecords);

    console.log(`✅ 为 ${symbols.length} 个交易对初始化默认数据完成`);
  }

  /**
   * 获取现有交易对列表
   */
  async getExistingSymbols() {
    const tables = ['strategy_analysis', 'ict_strategy_analysis', 'simulations'];
    const symbols = new Set();

    for (const table of tables) {
      try {
        const rows = await this.allSQL(`SELECT DISTINCT symbol FROM ${table} LIMIT 100`);

        rows.forEach(row => symbols.add(row.symbol));
      } catch (error) {
        // 忽略表不存在的错误
      }
    }

    return Array.from(symbols).slice(0, 50); // 限制数量避免初始化过多数据
  }

  /**
   * 批量插入默认记录
   */
  async batchInsertDefaultRecords(tableName, records) {
    if (records.length === 0) return;

    const placeholders = records.map(() => '(?, ?, ?, ?)').join(', ');
    const values = records.flatMap(record => [
      record.symbol,
      record.priority_score,
      record.is_active ? 1 : 0,
      record.calculation_version
    ]);

    const sql = `
      INSERT OR IGNORE INTO ${tableName} 
      (symbol, priority_score, is_active, calculation_version) 
      VALUES ${placeholders}
    `;

    await this.execSQL(sql, values);
  }

  /**
   * 验证迁移结果
   */
  async validateMigration() {
    console.log('🔍 验证迁移结果...');

    const validations = [
      { table: 'ict_price_ranges', expectedColumns: ['ob_upper_price', 'fvg_upper_price', 'priority_score'] },
      { table: 'v3_price_ranges', expectedColumns: ['range_upper_boundary', 'trend_entry_price', 'priority_score'] }
    ];

    for (const validation of validations) {
      const rows = await this.allSQL(`PRAGMA table_info(${validation.table})`);
      const columns = rows.map(row => row.name);

      for (const expectedColumn of validation.expectedColumns) {
        if (!columns.includes(expectedColumn)) {
          throw new Error(`验证失败: ${validation.table} 表缺少 ${expectedColumn} 字段`);
        }
      }

      console.log(`✅ ${validation.table} 表验证通过`);
    }

    // 验证索引
    const indexRows = await this.allSQL("SELECT name FROM sqlite_master WHERE type='index'");
    const indexes = indexRows.map(row => row.name);

    const requiredIndexes = ['idx_ict_symbol_active', 'idx_v3_symbol_active'];
    for (const requiredIndex of requiredIndexes) {
      if (!indexes.includes(requiredIndex)) {
        console.warn(`⚠️ 索引验证警告: 缺少 ${requiredIndex} 索引`);
      }
    }

    console.log('✅ 迁移结果验证完成');
  }

  /**
   * 记录迁移状态
   */
  async recordMigrationStatus() {
    const insertSQL = `
      INSERT OR REPLACE INTO migration_history 
      (migration_name, version, status, executed_at) 
      VALUES (?, ?, ?, ?)
    `;

    await this.execSQL(insertSQL, [
      'PriceFieldsMigration',
      this.migrationVersion,
      'completed',
      new Date().toISOString()
    ]);

    console.log('📝 迁移状态记录完成');
  }
}

module.exports = PriceFieldsMigration;
