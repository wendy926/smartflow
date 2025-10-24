/**
 * 策略参数管理器
 * 负责管理 ICT 和 V3 策略的激进/保守/平衡三种参数配置
 * 
 * @module StrategyParameterManager
 */

const logger = require('../utils/logger');

class StrategyParameterManager {
  constructor(database) {
    this.database = database;
    this.cache = new Map(); // 缓存参数配置
    this.cacheExpiry = 5 * 60 * 1000; // 缓存5分钟
  }

  /**
   * 获取策略参数
   * @param {string} strategyName - 策略名称 (ICT/V3)
   * @param {string} strategyMode - 策略模式 (AGGRESSIVE/CONSERVATIVE/BALANCED)
   * @param {string} paramGroup - 参数分组 (可选)
   * @returns {Promise<Object>} 参数对象
   */
  async getStrategyParams(strategyName, strategyMode = 'BALANCED', paramGroup = null) {
    try {
      const cacheKey = `${strategyName}_${strategyMode}_${paramGroup || 'all'}`;

      // 检查缓存
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheExpiry) {
          return cached.params;
        }
      }

      // 构建查询 - 参数调优使用 is_active = 1 的活跃参数
      let query = `
        SELECT param_group, param_name, param_value, param_type, category, 
               description, unit, min_value, max_value
        FROM strategy_params
        WHERE strategy_name = ? AND strategy_mode = ? AND is_active = 1
      `;
      const params = [strategyName, strategyMode];

      if (paramGroup) {
        query += ' AND param_group = ?';
        params.push(paramGroup);
      }

      query += ' ORDER BY param_group, param_name';

      const [rows] = await this.database.pool.query(query, params);

      // 转换为对象结构
      const result = {};
      rows.forEach(row => {
        if (!result[row.param_group]) {
          result[row.param_group] = {};
        }
        result[row.param_group][row.param_name] = {
          value: this.convertValue(row.param_value, row.param_type),
          type: row.param_type,
          category: row.category,
          description: row.description,
          unit: row.unit,
          min: row.min_value ? parseFloat(row.min_value) : null,
          max: row.max_value ? parseFloat(row.max_value) : null
        };
      });

      // 更新缓存
      this.cache.set(cacheKey, {
        params: result,
        timestamp: Date.now()
      });

      logger.debug(`[参数管理器] 加载${strategyName} ${strategyMode}参数: ${Object.keys(result).length}个分组`);
      return result;

    } catch (error) {
      logger.error(`[参数管理器] 获取${strategyName} ${strategyMode}参数失败:`, error);
      throw error;
    }
  }

  /**
   * 获取单个参数值
   * @param {string} strategyName - 策略名称
   * @param {string} strategyMode - 策略模式
   * @param {string} paramGroup - 参数分组
   * @param {string} paramName - 参数名称
   * @returns {Promise<any>} 参数值
   */
  async getParam(strategyName, strategyMode, paramGroup, paramName) {
    try {
      const params = await this.getStrategyParams(strategyName, strategyMode);
      if (params[paramGroup] && params[paramGroup][paramName]) {
        return params[paramGroup][paramName].value;
      }
      logger.warn(`[参数管理器] 参数不存在: ${strategyName}.${strategyMode}.${paramGroup}.${paramName}`);
      return null;
    } catch (error) {
      logger.error(`[参数管理器] 获取参数失败:`, error);
      return null;
    }
  }

  /**
   * 更新策略参数
   * @param {string} strategyName - 策略名称
   * @param {string} strategyMode - 策略模式
   * @param {string} paramGroup - 参数分组
   * @param {string} paramName - 参数名称
   * @param {any} newValue - 新值
   * @param {string} changedBy - 修改人
   * @param {string} reason - 修改原因
   * @returns {Promise<boolean>} 是否成功
   */
  async updateParam(strategyName, strategyMode, paramGroup, paramName, newValue, changedBy = 'system', reason = '') {
    try {
      // 获取旧值
      const oldValue = await this.getParam(strategyName, strategyMode, paramGroup, paramName);
      if (oldValue === null) {
        logger.error(`[参数管理器] 参数不存在: ${strategyName}.${strategyMode}.${paramGroup}.${paramName}`);
        return false;
      }

      // 验证新值
      const params = await this.getStrategyParams(strategyName, strategyMode, paramGroup);
      const paramInfo = params[paramGroup][paramName];
      if (paramInfo.min !== null && newValue < paramInfo.min) {
        logger.error(`[参数管理器] 新值${newValue}小于最小值${paramInfo.min}`);
        return false;
      }
      if (paramInfo.max !== null && newValue > paramInfo.max) {
        logger.error(`[参数管理器] 新值${newValue}大于最大值${paramInfo.max}`);
        return false;
      }

      // 更新参数
      await this.database.pool.query(
        `UPDATE strategy_params 
         SET param_value = ?, updated_at = NOW()
         WHERE strategy_name = ? AND strategy_mode = ? 
           AND param_group = ? AND param_name = ? AND is_active = 0`,
        [String(newValue), strategyName, strategyMode, paramGroup, paramName]
      );

      // 记录历史
      await this.database.pool.query(
        `INSERT INTO strategy_parameter_history 
         (strategy_name, strategy_mode, param_group, param_name, old_value, new_value, changed_by, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [strategyName, strategyMode, paramGroup, paramName, String(oldValue), String(newValue), changedBy, reason]
      );

      // 清除缓存
      this.clearCache();

      logger.info(`[参数管理器] 更新参数: ${strategyName}.${strategyMode}.${paramGroup}.${paramName} = ${newValue} (旧值: ${oldValue})`);
      return true;

    } catch (error) {
      logger.error(`[参数管理器] 更新参数失败:`, error);
      return false;
    }
  }

  /**
   * 批量更新策略参数
   * @param {string} strategyName - 策略名称
   * @param {string} strategyMode - 策略模式
   * @param {Object} updates - 更新对象 { paramGroup: { paramName: newValue } }
   * @param {string} changedBy - 修改人
   * @param {string} reason - 修改原因
   * @returns {Promise<Object>} 更新结果 { success: [], failed: [] }
   */
  async updateParams(strategyName, strategyMode, updates, changedBy = 'system', reason = '') {
    const result = { success: [], failed: [] };

    for (const [paramGroup, params] of Object.entries(updates)) {
      for (const [paramName, newValue] of Object.entries(params)) {
        const success = await this.updateParam(
          strategyName, strategyMode, paramGroup, paramName, newValue, changedBy, reason
        );
        if (success) {
          result.success.push(`${paramGroup}.${paramName}`);
        } else {
          result.failed.push(`${paramGroup}.${paramName}`);
        }
      }
    }

    logger.info(`[参数管理器] 批量更新完成: 成功${result.success.length}个, 失败${result.failed.length}个`);
    return result;
  }

  /**
   * 获取参数历史
   * @param {string} strategyName - 策略名称
   * @param {string} strategyMode - 策略模式
   * @param {number} limit - 限制数量
   * @returns {Promise<Array>} 历史记录
   */
  async getParamHistory(strategyName, strategyMode, limit = 50) {
    try {
      const [rows] = await this.database.pool.query(
        `SELECT param_group, param_name, old_value, new_value, changed_by, reason, created_at
         FROM strategy_parameter_history
         WHERE strategy_name = ? AND strategy_mode = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [strategyName, strategyMode, limit]
      );
      return rows;
    } catch (error) {
      logger.error(`[参数管理器] 获取参数历史失败:`, error);
      return [];
    }
  }

  /**
   * 添加回测结果
   * @param {Object} result - 回测结果
   * @returns {Promise<boolean>} 是否成功
   */
  async addBacktestResult(result) {
    try {
      await this.database.pool.query(
        `INSERT INTO strategy_parameter_backtest_results
         (strategy_name, strategy_mode, backtest_period, total_trades, winning_trades, losing_trades,
          win_rate, total_pnl, avg_win, avg_loss, max_drawdown, sharpe_ratio)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          result.strategyName,
          result.strategyMode,
          result.backtestPeriod,
          result.totalTrades || 0,
          result.winningTrades || 0,
          result.losingTrades || 0,
          result.winRate || 0,
          result.totalPnl || 0,
          result.avgWin || 0,
          result.avgLoss || 0,
          result.maxDrawdown || 0,
          result.sharpeRatio || 0
        ]
      );
      logger.info(`[参数管理器] 添加回测结果: ${result.strategyName} ${result.strategyMode}`);
      return true;
    } catch (error) {
      logger.error(`[参数管理器] 添加回测结果失败:`, error);
      return false;
    }
  }

  /**
   * 获取回测结果
   * @param {string} strategyName - 策略名称
   * @param {string} strategyMode - 策略模式
   * @param {number} limit - 限制数量
   * @returns {Promise<Array>} 回测结果
   */
  async getBacktestResults(strategyName, strategyMode, limit = 10) {
    try {
      const [rows] = await this.database.pool.query(
        `SELECT backtest_period, total_trades, winning_trades, losing_trades,
                win_rate, total_pnl, avg_win, avg_loss, max_drawdown, sharpe_ratio, created_at
         FROM strategy_parameter_backtest_results
         WHERE strategy_name = ? AND strategy_mode = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [strategyName, strategyMode, limit]
      );
      return rows;
    } catch (error) {
      logger.error(`[参数管理器] 获取回测结果失败:`, error);
      return [];
    }
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.cache.clear();
    this.lastCacheUpdate = 0;
    logger.debug('[参数管理器] 缓存已清除');
  }

  /**
   * 转换参数值类型
   * @param {string} value - 原始值
   * @param {string} type - 类型
   * @returns {any} 转换后的值
   */
  convertValue(value, type) {
    if (value === null || value === undefined) return null;

    switch (type) {
      case 'number':
        return parseFloat(value);
      case 'boolean':
        return value === 'true' || value === true;
      case 'string':
        return String(value);
      default:
        return value;
    }
  }

  /**
   * 获取所有策略模式
   * @returns {Array<string>} 策略模式列表
   */
  getStrategyModes() {
    return ['AGGRESSIVE', 'CONSERVATIVE', 'BALANCED'];
  }

  /**
   * 获取所有策略名称
   * @returns {Array<string>} 策略名称列表
   */
  getStrategyNames() {
    return ['ICT', 'V3'];
  }
}

module.exports = StrategyParameterManager;

