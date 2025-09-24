const mysql = require('mysql2/promise');
const redis = require('../cache/redis');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * 数据库操作类
 * 提供CRUD操作和缓存管理
 */
class DatabaseOperations {
  constructor() {
    this.pool = null;
    this.redis = redis;
    this.init();
  }

  /**
   * 初始化数据库连接池
   */
  async init() {
    try {
      this.pool = mysql.createPool({
        host: config.database.host,
        port: config.database.port,
        user: config.database.user,
        password: config.database.password,
        database: config.database.name,
        connectionLimit: config.database.connectionLimit,
        acquireTimeout: 60000,
        timeout: 60000,
        reconnect: true,
        charset: 'utf8mb4',
        timezone: config.database.timezone || '+08:00'
      });

      // 测试连接
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();

      logger.info('Database connection pool initialized');
    } catch (error) {
      logger.error('Database initialization error:', error);
      throw error;
    }
  }

  /**
   * 获取数据库连接
   */
  async getConnection() {
    if (!this.pool) {
      await this.init();
    }

    // 添加超时控制
    return await Promise.race([
      this.pool.getConnection(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection pool timeout')), 8000)
      )
    ]);
  }

  // ==================== 交易对管理 ====================

  /**
   * 插入交易对
   * @param {Object} symbolData - 交易对数据
   * @returns {Object} 插入结果
   */
  async insertSymbol(symbolData) {
    const connection = await this.getConnection();
    try {
      const { symbol, status = 'active', funding_rate = 0, last_price = 0, volume_24h = 0, price_change_24h = 0 } = symbolData;

      const [result] = await connection.execute(
        `INSERT INTO symbols (symbol, status, funding_rate, last_price, volume_24h, price_change_24h, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [symbol, status, funding_rate, last_price, volume_24h, price_change_24h]
      );

      // 清除相关缓存
      await this.redis.del('symbols:all');
      await this.redis.del(`symbol:${symbol}`);

      logger.info(`Symbol ${symbol} inserted with ID: ${result.insertId}`);
      return { success: true, id: result.insertId, symbol };
    } catch (error) {
      logger.error(`Error inserting symbol ${symbolData.symbol}:`, error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 获取交易对
   * @param {string} symbol - 交易对符号
   * @returns {Object} 交易对数据
   */
  async getSymbol(symbol) {
    // 先检查缓存
    const cacheKey = `symbol:${symbol}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM symbols WHERE symbol = ?',
        [symbol]
      );

      const result = rows[0] || null;

      // 缓存结果
      if (result) {
        await this.redis.set(cacheKey, result, 300); // 5分钟缓存
      }

      return result;
    } catch (error) {
      logger.error(`Error getting symbol ${symbol}:`, error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 更新交易对
   * @param {string} symbol - 交易对符号
   * @param {Object} updateData - 更新数据
   * @returns {Object} 更新结果
   */
  async updateSymbol(symbol, updateData) {
    const connection = await this.getConnection();
    try {
      const fields = [];
      const values = [];

      Object.entries(updateData).forEach(([key, value]) => {
        if (['status', 'funding_rate', 'last_price', 'volume_24h', 'price_change_24h'].includes(key)) {
          fields.push(`${key} = ?`);
          values.push(value);
        }
      });

      if (fields.length === 0) {
        return { success: false, message: 'No valid fields to update' };
      }

      fields.push('updated_at = NOW()');
      values.push(symbol);

      const [result] = await connection.execute(
        `UPDATE symbols SET ${fields.join(', ')} WHERE symbol = ?`,
        values
      );

      // 清除相关缓存
      await this.redis.del('symbols:all');
      await this.redis.del(`symbol:${symbol}`);

      logger.info(`Symbol ${symbol} updated, affected rows: ${result.affectedRows}`);
      return { success: true, affectedRows: result.affectedRows };
    } catch (error) {
      logger.error(`Error updating symbol ${symbol}:`, error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 删除交易对
   * @param {string} symbol - 交易对符号
   * @returns {Object} 删除结果
   */
  async deleteSymbol(symbol) {
    const connection = await this.getConnection();
    try {
      const [result] = await connection.execute(
        'DELETE FROM symbols WHERE symbol = ?',
        [symbol]
      );

      // 清除相关缓存
      await this.redis.del('symbols:all');
      await this.redis.del(`symbol:${symbol}`);

      logger.info(`Symbol ${symbol} deleted, affected rows: ${result.affectedRows}`);
      return { success: true, affectedRows: result.affectedRows };
    } catch (error) {
      logger.error(`Error deleting symbol ${symbol}:`, error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 获取所有交易对
   * @returns {Array} 交易对列表
   */
  async getAllSymbols() {
    try {
      logger.info('开始查询数据库获取交易对列表');

      const connection = await this.getConnection();

      try {
        logger.info('数据库连接获取成功，开始执行查询');

        const [rows] = await connection.execute(
          'SELECT * FROM symbols WHERE status = "active" ORDER BY symbol'
        );

        logger.info(`数据库查询成功，获取到 ${rows.length} 个交易对`);
        return rows;
      } finally {
        if (connection) {
          connection.release();
          logger.info('数据库连接已释放');
        }
      }
    } catch (error) {
      logger.error('Error getting all symbols:', error);
      throw error;
    }
  }

  // ==================== 策略判断管理 ====================

  /**
   * 插入策略判断
   * @param {Object} judgmentData - 判断数据
   * @returns {Object} 插入结果
   */
  async insertJudgment(judgmentData) {
    const connection = await this.getConnection();
    try {
      const {
        symbol,
        strategy,
        timeframe,
        signal,
        score,
        trend,
        confidence,
        reasons,
        indicators_data,
        created_at = new Date()
      } = judgmentData;

      const [result] = await connection.execute(
        `INSERT INTO strategy_judgments 
         (symbol, strategy, timeframe, signal, score, trend_direction, confidence, reasons, indicators_data, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [symbol, strategy, timeframe, signal, score, trend, confidence, reasons, JSON.stringify(indicators_data), created_at]
      );

      // 清除相关缓存
      await this.redis.del(`judgments:${strategy}:${symbol}`);
      await this.redis.del(`judgments:${strategy}:latest`);

      logger.info(`Judgment inserted for ${symbol} ${strategy}, ID: ${result.insertId}`);
      return { success: true, id: result.insertId };
    } catch (error) {
      logger.error(`Error inserting judgment for ${judgmentData.symbol}:`, error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 获取策略判断
   * @param {string} strategy - 策略名称
   * @param {string} symbol - 交易对符号
   * @param {number} limit - 限制数量
   * @returns {Array} 判断列表
   */
  async getJudgments(strategy, symbol = null, limit = 100) {
    const connection = await this.getConnection();
    try {
      let query = 'SELECT * FROM strategy_judgments WHERE strategy = ?';
      const params = [strategy];

      if (symbol) {
        query += ' AND symbol = ?';
        params.push(symbol);
      }

      query += ' ORDER BY created_at DESC LIMIT ?';
      params.push(limit);

      const [rows] = await connection.execute(query, params);
      return rows;
    } catch (error) {
      logger.error(`Error getting judgments for ${strategy}:`, error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // ==================== 模拟交易管理 ====================

  /**
   * 插入模拟交易
   * @param {Object} tradeData - 交易数据
   * @returns {Object} 插入结果
   */
  async insertTrade(tradeData) {
    const connection = await this.getConnection();
    try {
      const {
        symbol,
        strategy,
        side,
        entry_price,
        exit_price,
        quantity,
        leverage,
        stop_loss,
        take_profit,
        pnl,
        pnl_percentage,
        status,
        entry_time,
        exit_time,
        created_at = new Date()
      } = tradeData;

      const [result] = await connection.execute(
        `INSERT INTO simulation_trades 
         (symbol, strategy, side, entry_price, exit_price, quantity, leverage, stop_loss, take_profit, 
          pnl, pnl_percentage, status, entry_time, exit_time, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [symbol, strategy, side, entry_price, exit_price, quantity, leverage, stop_loss, take_profit,
          pnl, pnl_percentage, status, entry_time, exit_time, created_at]
      );

      // 清除相关缓存
      await this.redis.del(`trades:${strategy}:${symbol}`);
      await this.redis.del(`trades:${strategy}:latest`);

      logger.info(`Trade inserted for ${symbol} ${strategy}, ID: ${result.insertId}`);
      return { success: true, id: result.insertId };
    } catch (error) {
      logger.error(`Error inserting trade for ${tradeData.symbol}:`, error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 获取模拟交易
   * @param {string} strategy - 策略名称
   * @param {string} symbol - 交易对符号
   * @param {number} limit - 限制数量
   * @returns {Array} 交易列表
   */
  async getTrades(strategy, symbol = null, limit = 100) {
    const connection = await this.getConnection();
    try {
      // 如果没有提供strategy参数，返回空数组
      if (!strategy) {
        return [];
      }

      const strategyUpper = strategy.toUpperCase();
      const limitNum = Number(limit);

      let query = `
        SELECT st.*, s.symbol 
        FROM simulation_trades st 
        JOIN symbols s ON st.symbol_id = s.id 
        WHERE st.strategy_name = ?
      `;
      
      const params = [strategyUpper];

      if (symbol) {
        query += ` AND s.symbol = ?`;
        params.push(symbol);
      }

      query += ` ORDER BY st.created_at DESC LIMIT ?`;
      params.push(limitNum);

      const [rows] = await connection.execute(query, params);
      return rows;
    } catch (error) {
      logger.error(`Error getting trades for ${strategy}:`, error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 更新模拟交易
   * @param {number} tradeId - 交易ID
   * @param {Object} updateData - 更新数据
   * @returns {Object} 更新结果
   */
  async updateTrade(tradeId, updateData) {
    const connection = await this.getConnection();
    try {
      const fields = [];
      const values = [];

      Object.entries(updateData).forEach(([key, value]) => {
        if (['exit_price', 'pnl', 'pnl_percentage', 'status', 'exit_time', 'closed_at'].includes(key)) {
          fields.push(`${key} = ?`);
          values.push(value);
        }
      });

      if (fields.length === 0) {
        return { success: false, message: 'No valid fields to update' };
      }

      fields.push('updated_at = NOW()');
      values.push(tradeId);

      const [result] = await connection.execute(
        `UPDATE simulation_trades SET ${fields.join(', ')} WHERE id = ?`,
        values
      );

      logger.info(`Trade ${tradeId} updated, affected rows: ${result.affectedRows}`);
      return { success: true, affectedRows: result.affectedRows };
    } catch (error) {
      logger.error(`Error updating trade ${tradeId}:`, error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 添加模拟交易
   * @param {Object} tradeData - 交易数据
   * @returns {Object} 插入结果
   */
  async addTrade(tradeData) {
    const connection = await this.getConnection();
    try {
      const {
        symbol,
        strategy_type,
        direction,
        entry_price,
        stop_loss,
        take_profit,
        leverage = 1,
        margin_required,
        risk_amount,
        position_size,
        entry_reason = '',
        created_at = new Date()
      } = tradeData;

      // 获取交易对ID
      const [symbolRows] = await connection.execute(
        'SELECT id FROM symbols WHERE symbol = ?',
        [symbol]
      );

      if (symbolRows.length === 0) {
        throw new Error(`Symbol ${symbol} not found`);
      }

      const symbolId = symbolRows[0].id;

      const [result] = await connection.execute(
        `INSERT INTO simulation_trades 
         (symbol_id, strategy_type, direction, entry_price, stop_loss, take_profit, 
          leverage, margin_required, risk_amount, position_size, entry_reason, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          symbolId, strategy_type, direction, entry_price, stop_loss, take_profit,
          leverage, margin_required, risk_amount, position_size, entry_reason, created_at
        ]
      );

      logger.info(`Trade added with ID: ${result.insertId}`);
      return { success: true, id: result.insertId };
    } catch (error) {
      logger.error('Error adding trade:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 根据ID获取交易
   * @param {number} tradeId - 交易ID
   * @returns {Object} 交易信息
   */
  async getTradeById(tradeId) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT st.*, s.symbol 
         FROM simulation_trades st 
         JOIN symbols s ON st.symbol_id = s.id 
         WHERE st.id = ?`,
        [tradeId]
      );

      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error(`Error getting trade ${tradeId}:`, error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 获取交易统计
   * @param {string} strategy - 策略名称
   * @param {string} symbol - 交易对符号
   * @returns {Object} 统计数据
   */
  async getTradeStatistics(strategy, symbol = null) {
    const connection = await this.getConnection();
    try {
      let query = `
        SELECT 
          COUNT(*) as total_trades,
          SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
          SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losing_trades,
          SUM(pnl) as total_pnl,
          AVG(pnl) as avg_pnl,
          MAX(pnl) as best_trade,
          MIN(pnl) as worst_trade,
          AVG(pnl_percentage) as avg_pnl_percentage
        FROM simulation_trades st
        JOIN symbols s ON st.symbol_id = s.id
        WHERE st.strategy_type = ?
      `;

      const params = [strategy.toUpperCase()];

      if (symbol) {
        query += ' AND s.symbol = ?';
        params.push(symbol);
      }

      const [rows] = await connection.execute(query, params);
      const stats = rows[0];

      // 计算胜率
      const winRate = stats.total_trades > 0
        ? (stats.winning_trades / stats.total_trades) * 100
        : 0;

      return {
        total_trades: stats.total_trades || 0,
        winning_trades: stats.winning_trades || 0,
        losing_trades: stats.losing_trades || 0,
        win_rate: parseFloat(winRate.toFixed(2)),
        total_pnl: parseFloat((stats.total_pnl || 0).toFixed(2)),
        avg_pnl: parseFloat((stats.avg_pnl || 0).toFixed(2)),
        best_trade: parseFloat((stats.best_trade || 0).toFixed(2)),
        worst_trade: parseFloat((stats.worst_trade || 0).toFixed(2)),
        avg_pnl_percentage: parseFloat((stats.avg_pnl_percentage || 0).toFixed(2))
      };
    } catch (error) {
      logger.error('Error getting trade statistics:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // ==================== 系统监控管理 ====================

  /**
   * 插入系统监控数据
   * @param {Object} monitoringData - 监控数据
   * @returns {Object} 插入结果
   */
  async insertMonitoring(monitoringData) {
    const connection = await this.getConnection();
    try {
      const {
        component,
        metric_name,
        metric_value,
        status,
        message,
        created_at = new Date()
      } = monitoringData;

      const [result] = await connection.execute(
        `INSERT INTO system_monitoring 
         (component, metric_name, metric_value, status, message, created_at) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [component, metric_name, metric_value, status, message, created_at]
      );

      logger.info(`Monitoring data inserted for ${component}, ID: ${result.insertId}`);
      return { success: true, id: result.insertId };
    } catch (error) {
      logger.error(`Error inserting monitoring data for ${monitoringData.component}:`, error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 获取系统监控数据
   * @param {string} component - 组件名称
   * @param {number} limit - 限制数量
   * @returns {Array} 监控数据列表
   */
  async getMonitoring(component = null, limit = 100) {
    const connection = await this.getConnection();
    try {
      let query = 'SELECT * FROM system_monitoring';
      const params = [];

      if (component) {
        query += ' WHERE component = ?';
        params.push(component);
      }

      query += ' ORDER BY created_at DESC LIMIT ?';
      params.push(limit);

      const [rows] = await connection.execute(query, params);
      return rows;
    } catch (error) {
      logger.error(`Error getting monitoring data for ${component}:`, error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // ==================== 统计管理 ====================

  /**
   * 插入统计数据
   * @param {Object} statisticsData - 统计数据
   * @returns {Object} 插入结果
   */
  async insertStatistics(statisticsData) {
    const connection = await this.getConnection();
    try {
      const {
        symbol,
        strategy,
        timeframe,
        total_trades,
        winning_trades,
        losing_trades,
        win_rate,
        total_pnl,
        avg_pnl,
        max_drawdown,
        sharpe_ratio,
        created_at = new Date()
      } = statisticsData;

      const [result] = await connection.execute(
        `INSERT INTO symbol_statistics 
         (symbol, strategy, timeframe, total_trades, winning_trades, losing_trades, 
          win_rate, total_pnl, avg_pnl, max_drawdown, sharpe_ratio, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [symbol, strategy, timeframe, total_trades, winning_trades, losing_trades,
          win_rate, total_pnl, avg_pnl, max_drawdown, sharpe_ratio, created_at]
      );

      // 清除相关缓存
      await this.redis.del(`statistics:${strategy}:${symbol}`);
      await this.redis.del(`statistics:${strategy}:latest`);

      logger.info(`Statistics inserted for ${symbol} ${strategy}, ID: ${result.insertId}`);
      return { success: true, id: result.insertId };
    } catch (error) {
      logger.error(`Error inserting statistics for ${statisticsData.symbol}:`, error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 获取统计数据
   * @param {string} strategy - 策略名称
   * @param {string} symbol - 交易对符号
   * @returns {Array} 统计数据列表
   */
  async getStatistics(strategy, symbol = null) {
    const connection = await this.getConnection();
    try {
      let query = 'SELECT * FROM symbol_statistics WHERE strategy = ?';
      const params = [strategy];

      if (symbol) {
        query += ' AND symbol = ?';
        params.push(symbol);
      }

      query += ' ORDER BY created_at DESC';

      const [rows] = await connection.execute(query, params);
      return rows;
    } catch (error) {
      logger.error(`Error getting statistics for ${strategy}:`, error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 更新统计数据
   * @param {string} strategy - 策略名称
   * @param {string} symbol - 交易对符号
   * @param {Object} updateData - 更新数据
   * @returns {Object} 更新结果
   */
  async updateStatistics(strategy, symbol, updateData) {
    const connection = await this.getConnection();
    try {
      const fields = [];
      const values = [];

      Object.entries(updateData).forEach(([key, value]) => {
        if (['total_trades', 'winning_trades', 'losing_trades', 'win_rate', 'total_pnl',
          'avg_pnl', 'max_drawdown', 'sharpe_ratio'].includes(key)) {
          fields.push(`${key} = ?`);
          values.push(value);
        }
      });

      if (fields.length === 0) {
        return { success: false, message: 'No valid fields to update' };
      }

      fields.push('updated_at = NOW()');
      values.push(strategy, symbol);

      const [result] = await connection.execute(
        `UPDATE symbol_statistics SET ${fields.join(', ')} WHERE strategy = ? AND symbol = ?`,
        values
      );

      // 清除相关缓存
      await this.redis.del(`statistics:${strategy}:${symbol}`);

      logger.info(`Statistics updated for ${symbol} ${strategy}, affected rows: ${result.affectedRows}`);
      return { success: true, affectedRows: result.affectedRows };
    } catch (error) {
      logger.error(`Error updating statistics for ${strategy} ${symbol}:`, error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // ==================== 配置管理 ====================

  /**
   * 插入配置
   * @param {Object} configData - 配置数据
   * @returns {Object} 插入结果
   */
  async insertConfig(configData) {
    const connection = await this.getConnection();
    try {
      const { config_key, config_value, description, created_at = new Date() } = configData;

      const [result] = await connection.execute(
        `INSERT INTO system_config (config_key, config_value, description, created_at) 
         VALUES (?, ?, ?, ?)`,
        [config_key, config_value, description, created_at]
      );

      // 清除相关缓存
      await this.redis.del(`config:${config_key}`);
      await this.redis.del('config:all');

      logger.info(`Config inserted for ${config_key}, ID: ${result.insertId}`);
      return { success: true, id: result.insertId };
    } catch (error) {
      logger.error(`Error inserting config for ${configData.config_key}:`, error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 获取配置
   * @param {string} configKey - 配置键
   * @returns {Object} 配置数据
   */
  async getConfig(configKey) {
    // 先检查缓存
    const cacheKey = `config:${configKey}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM system_config WHERE config_key = ?',
        [configKey]
      );

      const result = rows[0] || null;

      // 缓存结果
      if (result) {
        await this.redis.set(cacheKey, result, 600); // 10分钟缓存
      }

      return result;
    } catch (error) {
      logger.error(`Error getting config for ${configKey}:`, error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 更新配置
   * @param {string} configKey - 配置键
   * @param {string} configValue - 配置值
   * @param {string} description - 描述
   * @returns {Object} 更新结果
   */
  async updateConfig(configKey, configValue, description = null) {
    const connection = await this.getConnection();
    try {
      const [result] = await connection.execute(
        `UPDATE system_config SET config_value = ?, description = ?, updated_at = NOW() 
         WHERE config_key = ?`,
        [configValue, description, configKey]
      );

      // 清除相关缓存
      await this.redis.del(`config:${configKey}`);
      await this.redis.del('config:all');

      logger.info(`Config updated for ${configKey}, affected rows: ${result.affectedRows}`);
      return { success: true, affectedRows: result.affectedRows };
    } catch (error) {
      logger.error(`Error updating config for ${configKey}:`, error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // ==================== 清理方法 ====================

  /**
   * 清理旧数据
   * @param {string} table - 表名
   * @param {number} days - 保留天数
   * @returns {Object} 清理结果
   */
  async cleanupOldData(table, days = 30) {
    const connection = await this.getConnection();
    try {
      const [result] = await connection.execute(
        `DELETE FROM ${table} WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
        [days]
      );

      logger.info(`Cleaned up ${result.affectedRows} old records from ${table}`);
      return { success: true, affectedRows: result.affectedRows };
    } catch (error) {
      logger.error(`Error cleaning up old data from ${table}:`, error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // ==================== 策略统计管理 ====================

  /**
   * 获取策略统计信息
   * @param {string} strategy - 策略名称
   * @returns {Object} 策略统计信息
   */
  async getStrategyStatistics(strategy) {
    const connection = await this.getConnection();
    try {
      // 获取总交易数
      const [totalTradesResult] = await connection.execute(
        'SELECT COUNT(*) as total FROM simulation_trades WHERE strategy_name = ?',
        [strategy.toUpperCase()]
      );
      const totalTrades = totalTradesResult[0].total;

      // 获取盈利交易数
      const [profitableTradesResult] = await connection.execute(
        'SELECT COUNT(*) as profitable FROM simulation_trades WHERE strategy_name = ? AND pnl > 0',
        [strategy.toUpperCase()]
      );
      const profitableTrades = profitableTradesResult[0].profitable;

      // 获取亏损交易数
      const [losingTradesResult] = await connection.execute(
        'SELECT COUNT(*) as losing FROM simulation_trades WHERE strategy_name = ? AND pnl < 0',
        [strategy.toUpperCase()]
      );
      const losingTrades = losingTradesResult[0].losing;

      // 计算胜率
      const winRate = totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0;

      // 获取总盈亏
      const [totalPnlResult] = await connection.execute(
        'SELECT COALESCE(SUM(pnl), 0) as totalPnl FROM simulation_trades WHERE strategy_name = ?',
        [strategy.toUpperCase()]
      );
      const totalPnl = totalPnlResult[0].totalPnl;

      // 获取最大回撤
      const [maxDrawdownResult] = await connection.execute(
        'SELECT COALESCE(MIN(pnl), 0) as maxDrawdown FROM simulation_trades WHERE strategy_name = ?',
        [strategy.toUpperCase()]
      );
      const maxDrawdown = Math.abs(maxDrawdownResult[0].maxDrawdown);

      return {
        totalTrades,
        profitableTrades,
        losingTrades,
        winRate: parseFloat(winRate.toFixed(2)),
        totalPnl: parseFloat(totalPnl.toFixed(2)),
        maxDrawdown: parseFloat(maxDrawdown.toFixed(2))
      };
    } catch (error) {
      logger.error(`Error getting strategy statistics for ${strategy}:`, error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 获取总体统计信息
   * @returns {Object} 总体统计信息
   */
  async getTotalStatistics() {
    const connection = await this.getConnection();
    try {
      // 获取总交易数
      const [totalTradesResult] = await connection.execute(
        'SELECT COUNT(*) as total FROM simulation_trades'
      );
      const totalTrades = totalTradesResult[0].total;

      // 获取盈利交易数
      const [profitableTradesResult] = await connection.execute(
        'SELECT COUNT(*) as profitable FROM simulation_trades WHERE pnl > 0'
      );
      const profitableTrades = profitableTradesResult[0].profitable;

      // 获取亏损交易数
      const [losingTradesResult] = await connection.execute(
        'SELECT COUNT(*) as losing FROM simulation_trades WHERE pnl < 0'
      );
      const losingTrades = losingTradesResult[0].losing;

      // 计算胜率
      const winRate = totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0;

      // 获取总盈亏
      const [totalPnlResult] = await connection.execute(
        'SELECT COALESCE(SUM(pnl), 0) as totalPnl FROM simulation_trades'
      );
      const totalPnl = totalPnlResult[0].totalPnl;

      // 获取最大回撤
      const [maxDrawdownResult] = await connection.execute(
        'SELECT COALESCE(MIN(pnl), 0) as maxDrawdown FROM simulation_trades'
      );
      const maxDrawdown = Math.abs(maxDrawdownResult[0].maxDrawdown);

      return {
        totalTrades,
        profitableTrades,
        losingTrades,
        winRate: parseFloat(winRate.toFixed(2)),
        totalPnl: parseFloat(totalPnl.toFixed(2)),
        maxDrawdown: parseFloat(maxDrawdown.toFixed(2))
      };
    } catch (error) {
      logger.error('Error getting total statistics:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 关闭连接池
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      logger.info('Database connection pool closed');
    }
  }
}

module.exports = new DatabaseOperations();
