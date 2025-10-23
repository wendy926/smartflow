/**
 * 数据库适配器
 * 复用现有数据库表，提供统一的数据访问接口
 */

const DatabaseConnection = require('../database/connection');
const logger = require('../utils/logger');

class DatabaseAdapter {
  constructor() {
    this.db = DatabaseConnection;
  }

  /**
   * 获取市场数据
   * @param {string} timeframe - 时间框架
   * @param {string} startDate - 开始日期
   * @param {string} endDate - 结束日期
   * @param {string} symbol - 交易对
   * @returns {Array} 市场数据
   */
  async getMarketData(timeframe, startDate, endDate, symbol = 'BTCUSDT') {
    try {
      const query = `
        SELECT 
          timestamp,
          open,
          high,
          low,
          close,
          volume
        FROM backtest_market_data 
        WHERE symbol = ? 
          AND timeframe = ? 
          AND timestamp >= ? 
          AND timestamp <= ?
        ORDER BY timestamp ASC
      `;

      const results = await this.db.query(query, [symbol, timeframe, startDate, endDate]);

      // 转换为标准格式
      return results.map(row => ({
        timestamp: new Date(row.timestamp),
        open: parseFloat(row.open),
        high: parseFloat(row.high),
        low: parseFloat(row.low),
        close: parseFloat(row.close),
        volume: parseFloat(row.volume),
        currentPrice: parseFloat(row.close),
        symbol: symbol,
        klines: [[
          row.timestamp,
          parseFloat(row.open),
          parseFloat(row.high),
          parseFloat(row.low),
          parseFloat(row.close),
          parseFloat(row.volume)
        ]]
      }));
    } catch (error) {
      logger.error(`[数据库适配器] 获取市场数据失败: ${timeframe}`, error);
      return [];
    }
  }

  /**
   * 获取多时间框架数据
   * @param {string} symbol - 交易对
   * @param {string} startDate - 开始日期
   * @param {string} endDate - 结束日期
   * @returns {Object} 多时间框架数据
   */
  async getMultiTimeframeData(symbol, startDate, endDate) {
    try {
      const timeframes = ['5m', '15m', '1h', '4h'];
      const data = {};

      for (const tf of timeframes) {
        data[tf] = await this.getMarketData(tf, startDate, endDate, symbol);
      }

      return data;
    } catch (error) {
      logger.error(`[数据库适配器] 获取多时间框架数据失败`, error);
      return {};
    }
  }

  /**
   * 保存回测结果
   * @param {Object} result - 回测结果
   * @returns {boolean} 是否成功
   */
  async saveBacktestResult(result) {
    try {
      const query = `
        INSERT INTO strategy_parameter_backtest_results (
          strategy_name,
          mode,
          timeframe,
          status,
          total_trades,
          winning_trades,
          losing_trades,
          win_rate,
          net_profit,
          profit_factor,
          avg_win,
          avg_loss,
          max_drawdown,
          sharpe_ratio,
          total_fees,
          backtest_start_date,
          backtest_end_date,
          total_days,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        result.strategy,
        result.mode,
        result.timeframe,
        result.status,
        result.totalTrades,
        result.winningTrades,
        result.losingTrades,
        result.winRate,
        result.netProfit,
        result.profitFactor,
        result.avgWin,
        result.avgLoss,
        result.maxDrawdown,
        result.sharpeRatio,
        result.totalFees,
        result.backtestStartDate,
        result.backtestEndDate,
        result.totalDays,
        result.createdAt
      ];

      await this.db.query(query, values);
      logger.info(`[数据库适配器] 保存回测结果成功: ${result.strategy}-${result.mode}`);
      return true;
    } catch (error) {
      logger.error(`[数据库适配器] 保存回测结果失败`, error);
      return false;
    }
  }

  /**
   * 获取回测结果
   * @param {string} strategyName - 策略名称
   * @param {string} mode - 模式
   * @param {string} timeframe - 时间框架
   * @returns {Array} 回测结果
   */
  async getBacktestResults(strategyName, mode, timeframe) {
    try {
      let query = `
        SELECT * FROM strategy_parameter_backtest_results 
        WHERE 1=1
      `;
      const params = [];

      if (strategyName) {
        query += ` AND strategy_name = ?`;
        params.push(strategyName);
      }

      if (mode) {
        query += ` AND mode = ?`;
        params.push(mode);
      }

      if (timeframe) {
        query += ` AND timeframe = ?`;
        params.push(timeframe);
      }

      query += ` ORDER BY created_at DESC`;

      const results = await this.db.query(query, params);
      return results;
    } catch (error) {
      logger.error(`[数据库适配器] 获取回测结果失败`, error);
      return [];
    }
  }

  /**
   * 获取策略参数
   * @param {string} strategyName - 策略名称
   * @param {string} mode - 模式
   * @returns {Object} 策略参数
   */
  async getStrategyParameters(strategyName, mode) {
    try {
      const query = `
        SELECT parameters FROM strategy_params 
        WHERE strategy_name = ? AND mode = ? AND is_active = 1
        ORDER BY created_at DESC LIMIT 1
      `;

      const results = await this.db.query(query, [strategyName, mode]);

      if (results.length > 0) {
        return JSON.parse(results[0].parameters);
      }

      return {};
    } catch (error) {
      logger.error(`[数据库适配器] 获取策略参数失败`, error);
      return {};
    }
  }

  /**
   * 保存策略参数
   * @param {string} strategyName - 策略名称
   * @param {string} mode - 模式
   * @param {Object} parameters - 参数
   * @returns {boolean} 是否成功
   */
  async saveStrategyParameters(strategyName, mode, parameters) {
    try {
      // 先禁用旧的参数
      await this.db.query(
        'UPDATE strategy_params SET is_active = 0 WHERE strategy_name = ? AND mode = ?',
        [strategyName, mode]
      );

      // 插入新参数
      const query = `
        INSERT INTO strategy_params (
          strategy_name,
          mode,
          parameters,
          is_active,
          created_at
        ) VALUES (?, ?, ?, 1, NOW())
      `;

      await this.db.query(query, [strategyName, mode, JSON.stringify(parameters)]);
      logger.info(`[数据库适配器] 保存策略参数成功: ${strategyName}-${mode}`);
      return true;
    } catch (error) {
      logger.error(`[数据库适配器] 保存策略参数失败`, error);
      return false;
    }
  }

  /**
   * 检查数据库连接
   * @returns {boolean} 是否连接
   */
  async checkConnection() {
    try {
      await this.db.query('SELECT 1');
      return true;
    } catch (error) {
      logger.error(`[数据库适配器] 数据库连接失败`, error);
      return false;
    }
  }
}

module.exports = DatabaseAdapter;
