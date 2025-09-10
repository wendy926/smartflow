// StrategyV3Migration.js - 策略V3数据库迁移脚本

class StrategyV3Migration {
  constructor(database) {
    this.db = database;
  }

  async migrateToV3() {
    try {
      console.log('🔄 开始策略V3数据库迁移...');

      // 1. 更新strategy_analysis表结构
      await this.updateStrategyAnalysisTable();

      // 2. 创建新的趋势市/震荡市判断表
      await this.createTrendMarketTable();

      // 3. 创建震荡市边界判断表
      await this.createRangeBoundaryTable();

      // 4. 更新模拟交易表以支持新的出场原因
      await this.updateSimulationTable();

      console.log('✅ 策略V3数据库迁移完成');
    } catch (error) {
      console.error('❌ 策略V3数据库迁移失败:', error);
      throw error;
    }
  }

  async updateStrategyAnalysisTable() {
    // 添加V3策略相关字段
    const alterQueries = [
      // 4H趋势过滤字段
      `ALTER TABLE strategy_analysis ADD COLUMN trend4h TEXT`, // 多头趋势/空头趋势/震荡市
      `ALTER TABLE strategy_analysis ADD COLUMN market_type TEXT`, // 趋势市/震荡市
      `ALTER TABLE strategy_analysis ADD COLUMN adx14 REAL`,
      `ALTER TABLE strategy_analysis ADD COLUMN bbw REAL`, // 布林带带宽
      `ALTER TABLE strategy_analysis ADD COLUMN trend_confirmed BOOLEAN DEFAULT FALSE`, // 连续确认机制

      // 1H多因子打分字段
      `ALTER TABLE strategy_analysis ADD COLUMN vwap_direction_consistent BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE strategy_analysis ADD COLUMN breakout_confirmed BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE strategy_analysis ADD COLUMN volume_15m_ratio REAL`,
      `ALTER TABLE strategy_analysis ADD COLUMN volume_1h_ratio REAL`,
      `ALTER TABLE strategy_analysis ADD COLUMN oi_change_6h REAL`,
      `ALTER TABLE strategy_analysis ADD COLUMN delta_buy REAL`,
      `ALTER TABLE strategy_analysis ADD COLUMN delta_sell REAL`,
      `ALTER TABLE strategy_analysis ADD COLUMN delta_imbalance REAL`,

      // V3策略新增字段
      `ALTER TABLE strategy_analysis ADD COLUMN market_type TEXT`,
      `ALTER TABLE strategy_analysis ADD COLUMN factors TEXT`, // JSON格式存储因子信息
      `ALTER TABLE strategy_analysis ADD COLUMN vol15m_ratio REAL`,
      `ALTER TABLE strategy_analysis ADD COLUMN vol1h_ratio REAL`,
      `ALTER TABLE strategy_analysis ADD COLUMN strategy_version TEXT DEFAULT 'V2'`,

      // 震荡市相关字段
      `ALTER TABLE strategy_analysis ADD COLUMN range_lower_boundary_valid BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE strategy_analysis ADD COLUMN range_upper_boundary_valid BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE strategy_analysis ADD COLUMN bb_upper REAL`,
      `ALTER TABLE strategy_analysis ADD COLUMN bb_middle REAL`,
      `ALTER TABLE strategy_analysis ADD COLUMN bb_lower REAL`,

      // 新增：震荡市假突破和多因子打分字段
      `ALTER TABLE strategy_analysis ADD COLUMN bb_width_15m REAL`, // 15分钟布林带宽
      `ALTER TABLE strategy_analysis ADD COLUMN fake_breakout_detected BOOLEAN DEFAULT FALSE`, // 假突破检测
      `ALTER TABLE strategy_analysis ADD COLUMN factor_score INTEGER DEFAULT 0`, // 多因子得分
      `ALTER TABLE strategy_analysis ADD COLUMN vwap_factor REAL`, // VWAP因子
      `ALTER TABLE strategy_analysis ADD COLUMN delta_factor REAL`, // Delta因子
      `ALTER TABLE strategy_analysis ADD COLUMN oi_factor REAL`, // OI因子
      `ALTER TABLE strategy_analysis ADD COLUMN volume_factor REAL`, // Volume因子
      `ALTER TABLE strategy_analysis ADD COLUMN range_touches_lower INTEGER DEFAULT 0`,
      `ALTER TABLE strategy_analysis ADD COLUMN range_touches_upper INTEGER DEFAULT 0`,
      `ALTER TABLE strategy_analysis ADD COLUMN last_breakout BOOLEAN DEFAULT FALSE`,

      // 15m执行字段
      `ALTER TABLE strategy_analysis ADD COLUMN execution_mode_v3 TEXT`, // 趋势市/震荡市/假突破
      `ALTER TABLE strategy_analysis ADD COLUMN setup_candle_high REAL`,
      `ALTER TABLE strategy_analysis ADD COLUMN setup_candle_low REAL`,
      `ALTER TABLE strategy_analysis ADD COLUMN atr14 REAL`,
      `ALTER TABLE strategy_analysis ADD COLUMN time_in_position INTEGER DEFAULT 0`,
      `ALTER TABLE strategy_analysis ADD COLUMN max_time_in_position INTEGER DEFAULT 48` // 12小时 = 48个15m
    ];

    for (const query of alterQueries) {
      try {
        await this.db.run(query);
      } catch (error) {
        // 忽略字段已存在的错误
        if (!error.message.includes('duplicate column name')) {
          console.warn('⚠️ 执行SQL失败:', query, error.message);
        }
      }
    }
  }

  async createTrendMarketTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS trend_market_analysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        trend4h TEXT NOT NULL, -- 多头趋势/空头趋势/震荡市
        market_type TEXT NOT NULL, -- 趋势市/震荡市
        ma20 REAL,
        ma50 REAL,
        ma200 REAL,
        close_price REAL,
        adx14 REAL,
        bbw REAL,
        trend_confirmed BOOLEAN DEFAULT FALSE,
        score1h INTEGER DEFAULT 0,
        vwap_direction_consistent BOOLEAN DEFAULT FALSE,
        breakout_confirmed BOOLEAN DEFAULT FALSE,
        volume_15m_ratio REAL,
        volume_1h_ratio REAL,
        oi_change_6h REAL,
        delta_imbalance REAL,
        funding_rate REAL,
        entry_allowed BOOLEAN DEFAULT FALSE,
        is_ranging BOOLEAN DEFAULT FALSE,
        analysis_data TEXT, -- JSON格式的完整分析数据
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await this.db.run(query);
  }

  async createRangeBoundaryTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS range_boundary_analysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        lower_boundary_valid BOOLEAN DEFAULT FALSE,
        upper_boundary_valid BOOLEAN DEFAULT FALSE,
        bb_upper REAL,
        bb_middle REAL,
        bb_lower REAL,
        bb_bandwidth REAL,
        vwap REAL,
        delta REAL,
        oi_change REAL,
        touches_lower INTEGER DEFAULT 0,
        touches_upper INTEGER DEFAULT 0,
        volume_factor REAL,
        last_breakout BOOLEAN DEFAULT FALSE,
        analysis_data TEXT, -- JSON格式的完整分析数据
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await this.db.run(query);
  }

  async updateSimulationTable() {
    // 更新模拟交易表以支持V3的6种出场原因
    const alterQueries = [
      `ALTER TABLE simulations ADD COLUMN execution_mode_v3 TEXT`, // 趋势市/震荡市/假突破
      `ALTER TABLE simulations ADD COLUMN market_type TEXT`, // 趋势市/震荡市
      `ALTER TABLE simulations ADD COLUMN setup_candle_high REAL`,
      `ALTER TABLE simulations ADD COLUMN setup_candle_low REAL`,
      `ALTER TABLE simulations ADD COLUMN atr14 REAL`,
      `ALTER TABLE simulations ADD COLUMN time_in_position INTEGER DEFAULT 0`,
      `ALTER TABLE simulations ADD COLUMN max_time_in_position INTEGER DEFAULT 48`
    ];

    for (const query of alterQueries) {
      try {
        await this.db.run(query);
      } catch (error) {
        if (!error.message.includes('duplicate column name')) {
          console.warn('⚠️ 执行SQL失败:', query, error.message);
        }
      }
    }
  }

  async rollback() {
    try {
      console.log('🔄 开始回滚策略V3数据库迁移...');

      // 删除新增的表
      await this.db.run('DROP TABLE IF EXISTS trend_market_analysis');
      await this.db.run('DROP TABLE IF EXISTS range_boundary_analysis');

      console.log('✅ 策略V3数据库迁移回滚完成');
    } catch (error) {
      console.error('❌ 策略V3数据库迁移回滚失败:', error);
      throw error;
    }
  }
}

module.exports = StrategyV3Migration;
