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
    this.leakMonitorInterval = null;
  }

  async connect() {
    try {
      this.pool = mysql.createPool({
        host: config.database.host,
        port: config.database.port,
        user: config.database.user,
        password: config.database.password,
        database: config.database.name,
        connectionLimit: config.database.connectionLimit || 3, // 进一步减少连接数
        // 连接超时配置（防止连接泄漏）
        connectTimeout: 10000, // 10秒连接超时
        // 队列限制
        queueLimit: config.database.queueLimit || 0,
        // 内存优化配置
        multipleStatements: config.database.multipleStatements || false,
        dateStrings: config.database.dateStrings || false,
        supportBigNumbers: config.database.supportBigNumbers || true,
        bigNumberStrings: config.database.bigNumberStrings || true,
        // 启用连接泄漏检测
        enableKeepAlive: true,
        keepAliveInitialDelay: 0
        // 移除无效的配置选项以避免警告
      });

      // 测试连接
      const connection = await this.pool.getConnection();
      await connection.ping();

      // 初始化必要的表
      await this.initializeTables(connection);

      connection.release();

      this.isConnected = true;
      logger.info('Database connected successfully', {
        host: config.database.host,
        port: config.database.port,
        database: config.database.name
      });

      // 启动连接泄漏监控
      this.startLeakMonitor();

    } catch (error) {
      logger.error('Database connection failed:', error);
      throw error;
    }
  }

  async disconnect() {
    // 停止连接泄漏监控
    this.stopLeakMonitor();

    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      logger.info('Database disconnected');
    }
  }

  /**
   * 初始化必要的数据库表
   * @param {Object} connection - 数据库连接
   */
  async initializeTables(connection) {
    try {
      const { createUserSettingsTable } = require('./migrations/create_user_settings_table');
      await createUserSettingsTable(connection);
    } catch (error) {
      logger.error('初始化数据库表失败:', error);
      throw error;
    }
  }

  async query(sql, params = []) {
    if (!this.isConnected || !this.pool) {
      logger.warn('[数据库] 连接池未初始化，尝试重新连接');
      await this.connect();
    }

    try {
      // 检查连接池状态
      if (!this.pool || this.pool.pool._closed) {
        logger.warn('[数据库] 连接池已关闭，重新创建');
        await this.connect();
      }

      const [rows] = await this.pool.execute(sql, params);
      return rows;
    } catch (error) {
      logger.error('Database query failed:', { sql, params, error: error.message });

      // 如果是连接错误，尝试重新连接
      if (error.code === 'PROTOCOL_CONNECTION_LOST' || error.code === 'ECONNRESET' || error.message.includes('Pool is closed')) {
        logger.warn('[数据库] 检测到连接问题，尝试重新连接');
        try {
          await this.connect();
          // 重试查询
          const [rows] = await this.pool.execute(sql, params);
          return rows;
        } catch (retryError) {
          logger.error('[数据库] 重连失败:', retryError.message);
          throw retryError;
        }
      }

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

  /**
   * 启动连接泄漏监控
   * 每5分钟检查一次连接池状态
   */
  startLeakMonitor() {
    if (this.leakMonitorInterval) {
      return;
    }

    this.leakMonitorInterval = setInterval(() => {
      if (!this.pool) {
        return;
      }

      try {
        const stats = this.pool.pool;
        if (!stats || !stats._allConnections) {
          return;
        }

        const totalConnections = stats._allConnections.length;
        const freeConnections = stats._freeConnections.length;
        const activeConnections = totalConnections - freeConnections;
        const connectionUsage = totalConnections > 0 ? (activeConnections / totalConnections * 100).toFixed(2) : 0;

        logger.info('[数据库连接池] 状态监控', {
          totalConnections,
          freeConnections,
          activeConnections,
          connectionUsage: `${connectionUsage}%`,
          acquiringConnections: stats._acquiringConnections ? stats._acquiringConnections.length : 0
        });

        // 如果连接使用率超过80%，发出警告
        if (connectionUsage > 80) {
          logger.warn('[数据库连接池] ⚠️ 连接使用率过高', {
            connectionUsage: `${connectionUsage}%`,
            totalConnections,
            activeConnections
          });
        }

        // 如果活跃连接数接近连接池上限，发出警告
        if (activeConnections >= this.pool.config.connectionLimit * 0.9) {
          logger.warn('[数据库连接池] ⚠️ 活跃连接数接近上限', {
            activeConnections,
            connectionLimit: this.pool.config.connectionLimit
          });
        }

        // 检查连接池是否关闭
        if (this.pool.pool._closed) {
          logger.error('[数据库连接池] 连接池已关闭，尝试重新连接');
          this.connect().catch(err => logger.error('[数据库连接池] 重连失败:', err.message));
        }
      } catch (error) {
        // 忽略监控错误，避免影响主程序
        logger.debug('[数据库连接池] 监控错误:', error.message);
      }
    }, 5 * 60 * 1000); // 每5分钟检查一次

    logger.info('[数据库连接池] 连接泄漏监控已启动');
  }

  /**
   * 停止连接泄漏监控
   */
  stopLeakMonitor() {
    if (this.leakMonitorInterval) {
      clearInterval(this.leakMonitorInterval);
      this.leakMonitorInterval = null;
      logger.info('[数据库连接池] 连接泄漏监控已停止');
    }
  }
}

// 单例管理器
let instance = null;

/**
 * 获取数据库连接单例
 * @returns {DatabaseConnection} 数据库连接实例
 */
function getInstance() {
  if (!instance) {
    instance = new DatabaseConnection();
  }
  return instance;
}

/**
 * 重置单例（用于测试或强制重新连接）
 */
function resetInstance() {
  if (instance) {
    instance.disconnect().catch(err => logger.error('断开连接失败:', err));
    instance = null;
  }
}

// 导出类和单例管理器
module.exports = DatabaseConnection;
module.exports.getInstance = getInstance;
module.exports.resetInstance = resetInstance;
module.exports.default = getInstance(); // 兼容旧代码：默认导出单例
