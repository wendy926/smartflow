// ICTMigration.js - ICT策略数据库迁移脚本

class ICTMigration {
  constructor(database) {
    this.db = database;
  }

  /**
   * 执行ICT数据库迁移
   */
  async migrate() {
    try {
      console.log('🔄 开始ICT数据库迁移...');

      // 1. 创建ICT数据库管理器
      const ICTDatabaseManager = require('./ICTDatabaseManager');
      const ictDb = new ICTDatabaseManager(this.db);

      // 2. 初始化ICT表结构
      await ictDb.initICTTables();

      // 3. 创建枚举值表
      await this.createICTEnumTables();

      // 4. 创建视图
      await this.createICTViews();

      // 5. 插入默认数据
      await this.insertDefaultData();

      console.log('✅ ICT数据库迁移完成');
    } catch (error) {
      console.error('❌ ICT数据库迁移失败:', error);
      throw error;
    }
  }

  /**
   * 创建ICT枚举值表
   */
  async createICTEnumTables() {
    try {
      const enumTables = [
        // ICT信号类型枚举表
        `CREATE TABLE IF NOT EXISTS ict_signal_types (
          id INTEGER PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          description TEXT
        )`,

        // ICT执行模式枚举表
        `CREATE TABLE IF NOT EXISTS ict_execution_modes (
          id INTEGER PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          description TEXT
        )`,

        // ICT趋势类型枚举表
        `CREATE TABLE IF NOT EXISTS ict_trend_types (
          id INTEGER PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          description TEXT
        )`
      ];

      for (const table of enumTables) {
        await this.db.run(table);
      }

      // 插入枚举值
      await this.insertEnumValues();

      console.log('✅ ICT枚举值表创建完成');
    } catch (error) {
      console.error('❌ ICT枚举值表创建失败:', error);
      throw error;
    }
  }

  /**
   * 插入枚举值
   */
  async insertEnumValues() {
    try {
      // ICT信号类型
      const signalTypes = [
        [1, 'LONG', '做多信号'],
        [2, 'SHORT', '做空信号'],
        [3, 'NONE', '无信号']
      ];

      for (const [id, name, description] of signalTypes) {
        await this.db.run(
          'INSERT OR IGNORE INTO ict_signal_types (id, name, description) VALUES (?, ?, ?)',
          [id, name, description]
        );
      }

      // ICT执行模式
      const executionModes = [
        [1, 'OB_ENGULFING', 'OB吞没模式'],
        [2, 'FVG_SWEEP', 'FVG扫荡模式'],
        [3, 'ENGULFING_SWEEP', '吞没扫荡模式'],
        [4, 'NONE', '无执行模式']
      ];

      for (const [id, name, description] of executionModes) {
        await this.db.run(
          'INSERT OR IGNORE INTO ict_execution_modes (id, name, description) VALUES (?, ?, ?)',
          [id, name, description]
        );
      }

      // ICT趋势类型
      const trendTypes = [
        [1, 'up', '上升趋势'],
        [2, 'down', '下降趋势'],
        [3, 'sideways', '震荡趋势']
      ];

      for (const [id, name, description] of trendTypes) {
        await this.db.run(
          'INSERT OR IGNORE INTO ict_trend_types (id, name, description) VALUES (?, ?, ?)',
          [id, name, description]
        );
      }

      console.log('✅ ICT枚举值插入完成');
    } catch (error) {
      console.error('❌ ICT枚举值插入失败:', error);
      throw error;
    }
  }

  /**
   * 创建ICT相关视图
   */
  async createICTViews() {
    try {
      const views = [
        // ICT策略分析汇总视图
        `CREATE VIEW IF NOT EXISTS ict_analysis_summary AS
         SELECT 
           symbol,
           MAX(timestamp) as last_analysis,
           COUNT(*) as total_analyses,
           SUM(CASE WHEN signal_type = 'LONG' THEN 1 ELSE 0 END) as long_signals,
           SUM(CASE WHEN signal_type = 'SHORT' THEN 1 ELSE 0 END) as short_signals,
           SUM(CASE WHEN signal_type = 'NONE' THEN 1 ELSE 0 END) as no_signals,
           AVG(data_collection_rate) as avg_data_collection_rate
         FROM ict_strategy_analysis 
         GROUP BY symbol`,

        // ICT模拟交易统计视图
        `CREATE VIEW IF NOT EXISTS ict_simulation_stats AS
         SELECT 
           symbol,
           COUNT(*) as total_trades,
           SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END) as closed_trades,
           SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active_trades,
           SUM(CASE WHEN is_win = 1 THEN 1 ELSE 0 END) as winning_trades,
           SUM(CASE WHEN is_win = 0 THEN 1 ELSE 0 END) as losing_trades,
           AVG(profit_loss) as avg_profit_loss,
           SUM(profit_loss) as total_profit_loss
         FROM ict_simulations 
         GROUP BY symbol`,

        // ICT信号强度统计视图
        `CREATE VIEW IF NOT EXISTS ict_signal_strength_stats AS
         SELECT 
           signal_strength,
           COUNT(*) as count,
           AVG(CASE WHEN signal_type = 'LONG' THEN 1 ELSE 0 END) as long_ratio,
           AVG(CASE WHEN signal_type = 'SHORT' THEN 1 ELSE 0 END) as short_ratio
         FROM ict_strategy_analysis 
         WHERE signal_type != 'NONE'
         GROUP BY signal_strength`
      ];

      for (const view of views) {
        await this.db.run(view);
      }

      console.log('✅ ICT视图创建完成');
    } catch (error) {
      console.error('❌ ICT视图创建失败:', error);
      throw error;
    }
  }

  /**
   * 插入默认数据
   */
  async insertDefaultData() {
    try {
      // 插入默认的ICT数据刷新状态
      const defaultSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
      const dataTypes = ['daily_trend', 'mtf_analysis', 'ltf_analysis'];
      const intervals = [1440, 240, 15]; // 1天, 4小时, 15分钟

      for (const symbol of defaultSymbols) {
        for (let i = 0; i < dataTypes.length; i++) {
          const dataType = dataTypes[i];
          const interval = intervals[i];
          const now = new Date();
          const nextRefresh = new Date(now.getTime() + interval * 60 * 1000);

          await this.db.run(
            `INSERT OR IGNORE INTO ict_data_refresh_status 
             (symbol, data_type, last_refresh, next_refresh, should_refresh, refresh_interval)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [symbol, dataType, null, nextRefresh.toISOString(), true, interval]
          );
        }
      }

      console.log('✅ ICT默认数据插入完成');
    } catch (error) {
      console.error('❌ ICT默认数据插入失败:', error);
      throw error;
    }
  }

  /**
   * 验证ICT数据库结构
   */
  async validateICTStructure() {
    try {
      const requiredTables = [
        'ict_strategy_analysis',
        'ict_simulations',
        'ict_data_refresh_status',
        'ict_signal_types',
        'ict_execution_modes',
        'ict_trend_types'
      ];

      const requiredViews = [
        'ict_analysis_summary',
        'ict_simulation_stats',
        'ict_signal_strength_stats'
      ];

      // 检查表是否存在
      for (const table of requiredTables) {
        const result = await new Promise((resolve, reject) => { this.db.get(
          "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
          [table]
        );
        if (!result) {
          throw new Error(`缺少必需的表: ${table}`);
        }
      }

      // 检查视图是否存在
      for (const view of requiredViews) {
        const result = await new Promise((resolve, reject) => { this.db.get(
          "SELECT name FROM sqlite_master WHERE type='view' AND name=?",
          [view]
        );
        if (!result) {
          throw new Error(`缺少必需的视图: ${view}`);
        }
      }

      console.log('✅ ICT数据库结构验证通过');
      return true;
    } catch (error) {
      console.error('❌ ICT数据库结构验证失败:', error);
      return false;
    }
  }

  /**
   * 清理ICT测试数据
   */
  async cleanupTestData() {
    try {
      const cleanupQueries = [
        'DELETE FROM ict_strategy_analysis WHERE symbol LIKE "%TEST%"',
        'DELETE FROM ict_simulations WHERE symbol LIKE "%TEST%"',
        'DELETE FROM ict_data_refresh_status WHERE symbol LIKE "%TEST%"'
      ];

      for (const query of cleanupQueries) {
        await this.db.run(query);
      }

      console.log('✅ ICT测试数据清理完成');
    } catch (error) {
      console.error('❌ ICT测试数据清理失败:', error);
    }
  }

  /**
   * 获取ICT数据库统计信息
   */
  async getICTStats() {
    try {
      const stats = {};

      // 策略分析统计
      const analysisStats = await new Promise((resolve, reject) => { this.db.get(
        'SELECT COUNT(*) as total, MAX(timestamp) as latest FROM ict_strategy_analysis'
      );
      stats.analysis = analysisStats;

      // 模拟交易统计
      const simulationStats = await new Promise((resolve, reject) => { this.db.get(
        'SELECT COUNT(*) as total, SUM(CASE WHEN status = "ACTIVE" THEN 1 ELSE 0 END) as active FROM ict_simulations'
      );
      stats.simulations = simulationStats;

      // 信号类型统计
      const signalStats = await new Promise((resolve, reject) => { this.db.all(
        'SELECT signal_type, COUNT(*) as count FROM ict_strategy_analysis GROUP BY signal_type'
      );
      stats.signals = signalStats;

      // 执行模式统计
      const executionStats = await new Promise((resolve, reject) => { this.db.all(
        'SELECT execution_mode, COUNT(*) as count FROM ict_strategy_analysis GROUP BY execution_mode'
      );
      stats.executions = executionStats;

      return stats;
    } catch (error) {
      console.error('❌ 获取ICT统计信息失败:', error);
      return {};
    }
  }
}

module.exports = ICTMigration;
