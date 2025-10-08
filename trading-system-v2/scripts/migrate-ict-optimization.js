/**
 * ICT策略第二次优化数据库迁移脚本
 * 执行数据库表结构变更
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const logger = require('../src/utils/logger');

class ICTOptimizationMigration {
  constructor() {
    this.connection = null;
  }

  async connect() {
    try {
      this.connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'trading_system',
        charset: 'utf8mb4'
      });
      logger.info('数据库连接成功');
    } catch (error) {
      logger.error(`数据库连接失败: ${error.message}`);
      throw error;
    }
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.end();
      logger.info('数据库连接已关闭');
    }
  }

  async executeMigration() {
    try {
      await this.connect();
      
      // 读取SQL文件
      const sqlFile = path.join(__dirname, '../database/ict-optimization-schema.sql');
      const sqlContent = fs.readFileSync(sqlFile, 'utf8');
      
      // 分割SQL语句
      const statements = sqlContent
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
      
      logger.info(`开始执行 ${statements.length} 条SQL语句`);
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        try {
          await this.connection.execute(statement);
          logger.info(`SQL语句 ${i + 1} 执行成功`);
        } catch (error) {
          // 如果是表已存在的错误，继续执行
          if (error.code === 'ER_TABLE_EXISTS_ERROR' || 
              error.code === 'ER_DUP_FIELDNAME' ||
              error.code === 'ER_DUP_KEYNAME') {
            logger.warn(`SQL语句 ${i + 1} 跳过（已存在）: ${error.message}`);
            continue;
          }
          logger.error(`SQL语句 ${i + 1} 执行失败: ${error.message}`);
          throw error;
        }
      }
      
      logger.info('数据库迁移完成');
      
      // 验证迁移结果
      await this.verifyMigration();
      
    } catch (error) {
      logger.error(`数据库迁移失败: ${error.message}`);
      throw error;
    } finally {
      await this.disconnect();
    }
  }

  async verifyMigration() {
    try {
      // 检查strategy_judgments表是否添加了新字段
      const [columns] = await this.connection.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'strategy_judgments'
        AND COLUMN_NAME IN ('harmonic_type', 'harmonic_score', 'engulfing_strength', 'confirmation_bars')
      `, [process.env.DB_NAME || 'trading_system']);
      
      if (columns.length >= 4) {
        logger.info('strategy_judgments表新字段添加成功');
      } else {
        logger.warn('strategy_judgments表新字段可能未完全添加');
      }
      
      // 检查ict_telemetry表是否存在
      const [tables] = await this.connection.execute(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'ict_telemetry'
      `, [process.env.DB_NAME || 'trading_system']);
      
      if (tables.length > 0) {
        logger.info('ict_telemetry表创建成功');
      } else {
        logger.warn('ict_telemetry表可能未创建');
      }
      
      // 检查ict_strategy_config表是否有数据
      const [configs] = await this.connection.execute(`
        SELECT COUNT(*) as count FROM ict_strategy_config
      `);
      
      if (configs[0].count > 0) {
        logger.info(`ict_strategy_config表已插入 ${configs[0].count} 条配置数据`);
      } else {
        logger.warn('ict_strategy_config表可能未插入配置数据');
      }
      
    } catch (error) {
      logger.error(`迁移验证失败: ${error.message}`);
    }
  }

  async rollback() {
    try {
      await this.connect();
      
      logger.info('开始回滚ICT优化相关表结构...');
      
      // 删除新增的表
      const dropTables = [
        'DROP TABLE IF EXISTS ict_win_rate_history',
        'DROP TABLE IF EXISTS ict_strategy_config',
        'DROP TABLE IF EXISTS ict_telemetry',
        'DROP VIEW IF EXISTS ict_strategy_performance'
      ];
      
      for (const sql of dropTables) {
        try {
          await this.connection.execute(sql);
          logger.info(`删除表/视图成功: ${sql}`);
        } catch (error) {
          logger.warn(`删除表/视图失败: ${error.message}`);
        }
      }
      
      // 删除strategy_judgments表的新字段
      const dropColumns = [
        'ALTER TABLE strategy_judgments DROP COLUMN IF EXISTS harmonic_type',
        'ALTER TABLE strategy_judgments DROP COLUMN IF EXISTS harmonic_score',
        'ALTER TABLE strategy_judgments DROP COLUMN IF EXISTS harmonic_rmse',
        'ALTER TABLE strategy_judgments DROP COLUMN IF EXISTS engulfing_strength',
        'ALTER TABLE strategy_judgments DROP COLUMN IF EXISTS confirmation_bars',
        'ALTER TABLE strategy_judgments DROP COLUMN IF EXISTS confirmation_status',
        'ALTER TABLE strategy_judgments DROP COLUMN IF EXISTS adaptive_stop_multiplier',
        'ALTER TABLE strategy_judgments DROP COLUMN IF EXISTS position_size_usd',
        'ALTER TABLE strategy_judgments DROP COLUMN IF EXISTS historical_win_rate',
        'ALTER TABLE strategy_judgments DROP COLUMN IF EXISTS total_confidence',
        'ALTER TABLE strategy_judgments DROP COLUMN IF EXISTS gate_passed',
        'ALTER TABLE strategy_judgments DROP COLUMN IF EXISTS secondary_passed',
        'ALTER TABLE strategy_judgments DROP COLUMN IF EXISTS sweep_direction',
        'ALTER TABLE strategy_judgments DROP COLUMN IF EXISTS sweep_confidence',
        'ALTER TABLE strategy_judgments DROP COLUMN IF EXISTS order_block_valid',
        'ALTER TABLE strategy_judgments DROP COLUMN IF EXISTS order_block_swept',
        'ALTER TABLE strategy_judgments DROP COLUMN IF EXISTS order_block_reentry'
      ];
      
      for (const sql of dropColumns) {
        try {
          await this.connection.execute(sql);
          logger.info(`删除字段成功: ${sql}`);
        } catch (error) {
          logger.warn(`删除字段失败: ${error.message}`);
        }
      }
      
      logger.info('回滚完成');
      
    } catch (error) {
      logger.error(`回滚失败: ${error.message}`);
      throw error;
    } finally {
      await this.disconnect();
    }
  }
}

// 命令行执行
if (require.main === module) {
  const migration = new ICTOptimizationMigration();
  const command = process.argv[2];
  
  if (command === 'rollback') {
    migration.rollback().catch(console.error);
  } else {
    migration.executeMigration().catch(console.error);
  }
}

module.exports = ICTOptimizationMigration;
