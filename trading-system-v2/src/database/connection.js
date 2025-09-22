/**
 * 数据库连接管理
 * 基于MySQL2的连接池
 */

const mysql = require('mysql2/promise');
const config = require('../config');
const logger = require('../utils/logger');

class DatabaseConnection {
  constructor() {
    this.pool = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.pool = mysql.createPool({
        host: config.database.host,
        port: config.database.port,
        user: config.database.user,
        password: config.database.password,
        database: config.database.name,
        connectionLimit: config.database.connectionLimit,
        acquireTimeout: config.database.acquireTimeout,
        timeout: config.database.timeout,
        reconnect: config.database.reconnect,
        idleTimeout: config.database.idleTimeout,
        queueLimit: config.database.queueLimit,
        // 内存优化配置
        multipleStatements: config.database.multipleStatements,
        dateStrings: config.database.dateStrings,
        supportBigNumbers: config.database.supportBigNumbers,
        bigNumberStrings: config.database.bigNumberStrings
      });

      // 测试连接
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();

      this.isConnected = true;
      logger.info('Database connected successfully', {
        host: config.database.host,
        port: config.database.port,
        database: config.database.name
      });

    } catch (error) {
      logger.error('Database connection failed:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      logger.info('Database disconnected');
    }
  }

  async query(sql, params = []) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    try {
      const [rows] = await this.pool.execute(sql, params);
      return rows;
    } catch (error) {
      logger.error('Database query failed:', { sql, params, error: error.message });
      throw error;
    }
  }

  async transaction(callback) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    const connection = await this.pool.getConnection();
    await connection.beginTransaction();

    try {
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  getPool() {
    return this.pool;
  }

  isHealthy() {
    return this.isConnected && this.pool !== null;
  }

  async getStats() {
    if (!this.pool) {
      return null;
    }

    return {
      totalConnections: this.pool.pool._allConnections.length,
      freeConnections: this.pool.pool._freeConnections.length,
      acquiringConnections: this.pool.pool._acquiringConnections.length,
      isConnected: this.isConnected
    };
  }
}

// 创建单例实例
const database = new DatabaseConnection();

module.exports = database;
