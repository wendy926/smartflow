/**
 * V3.1策略数据库操作模块
 * 提供对strategy_execution_logs和strategy_params表的操作
 * 
 * @module v3-1-operations
 */

const logger = require('../utils/logger');

/**
 * V3.1策略数据库操作类
 */
class V31Operations {
  constructor(database) {
    this.database = database;
  }

  /**
   * 保存信号日志到strategy_execution_logs表
   * 
   * @param {Object} signalData - 信号数据
   * @returns {Promise<number>} 插入的ID
   */
  async saveSignalLog(signalData) {
    try {
      const query = `
        INSERT INTO strategy_execution_logs (
          symbol_id, signal_time, strategy_type,
          
          -- 早期趋势探测
          early_trend_detected, early_trend_type, 
          macd_hist_1h, macd_hist_prev_1h, delta_1h,
          vwap_price_relation, adx_1h, adx_4h, early_trend_reason,
          
          -- 假突破过滤器
          fake_breakout_filter_result, volume_ratio, volume_passed,
          delta_15m, delta_same_direction, confirm_bars, reclaim_pct,
          at_range_edge, filter_details,
          
          -- 市场状态
          market_regime, trend_direction,
          
          -- 评分
          trend_score_4h, factor_score_1h, entry_score_15m,
          total_score, confidence,
          
          -- 动态止损
          atr_15m, initial_sl_multiplier, dynamic_sl_multiplier,
          time_stop_minutes, profit_trigger, trail_step, tp_factor,
          
          -- 最终信号
          final_signal, executed, rejection_reason
        ) VALUES (
          ?, NOW(), ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?,
          ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?
        )
      `;

      const params = [
        signalData.symbolId,
        signalData.strategyType || 'V3.1',

        // 早期趋势
        signalData.earlyTrend?.detected ? 1 : 0,
        signalData.earlyTrend?.signalType || null,
        signalData.earlyTrend?.indicators?.macdHist || null,
        signalData.earlyTrend?.indicators?.macdHistPrev || null,
        signalData.earlyTrend?.indicators?.delta1H || null,
        signalData.earlyTrend?.indicators?.vwapDirection === 1 ? 'above' : 'below',
        signalData.earlyTrend?.indicators?.adx1H || null,
        signalData.earlyTrend?.indicators?.adx4H || null,
        signalData.earlyTrend?.reason || null,

        // 假突破过滤器
        signalData.filter?.passed ? 'pass' : 'fail',
        signalData.filter?.details?.volumeCheck?.ratio || null,
        signalData.filter?.details?.volumeCheck?.passed ? 1 : 0,
        signalData.filter?.details?.deltaCheck?.delta15m || null,
        signalData.filter?.details?.deltaCheck?.aligned ? 1 : 0,
        1,
        signalData.filter?.details?.confirmCheck?.reclaimDiff || null,
        signalData.filter?.details?.boundaryCheck?.atEdge ? 1 : 0,
        signalData.filter?.details ? JSON.stringify(signalData.filter.details) : null,

        // 市场状态
        signalData.marketRegime || 'UNKNOWN',
        signalData.trendDirection || null,

        // 评分
        signalData.scores?.trend4H || 0,
        signalData.scores?.factor1H || 0,
        signalData.scores?.entry15M || 0,
        signalData.scores?.total || 0,
        signalData.confidence || 'reject',

        // 动态止损
        signalData.dynamicStop?.atr15 || null,
        signalData.dynamicStop?.kEntry || 2.0,
        signalData.dynamicStop?.kHold || 2.8,
        signalData.dynamicStop?.timeStopMinutes || 60,
        signalData.dynamicStop?.profitTrigger || 1.0,
        signalData.dynamicStop?.trailStep || 0.5,
        signalData.dynamicStop?.tpFactor || 1.3,

        // 最终信号
        signalData.finalSignal || 'HOLD',
        signalData.executed ? 1 : 0,
        signalData.rejectionReason || null
      ];

      const result = await this.database.query(query, params);
      const insertId = result.insertId;

      logger.debug(`信号日志已保存: ID=${insertId}, 信号=${signalData.finalSignal}`);
      return insertId;
    } catch (error) {
      logger.error(`保存信号日志失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 从strategy_params表加载参数
   * 
   * @param {string} category - 参数分类（可选）
   * @returns {Promise<Object>} 参数对象
   */
  async loadParams(category = null) {
    try {
      let query = `
        SELECT param_name, param_value, param_type
        FROM strategy_params
        WHERE is_active = 1
      `;
      const params = [];

      if (category) {
        query += ' AND category = ?';
        params.push(category);
      }

      const rows = await this.database.query(query, params);

      const config = {};
      rows.forEach(row => {
        const value = this._parseParamValue(row.param_value, row.param_type);
        config[row.param_name] = value;
      });

      logger.debug(`已加载${rows.length}个参数${category ? `(类别: ${category})` : ''}`);
      return config;
    } catch (error) {
      logger.error(`加载参数失败: ${error.message}`);
      return {};
    }
  }

  /**
   * 更新参数值
   * 
   * @param {string} paramName - 参数名称
   * @param {any} paramValue - 参数值
   * @returns {Promise<void>}
   */
  async updateParam(paramName, paramValue) {
    try {
      const query = `
        UPDATE strategy_params
        SET param_value = ?, updated_at = CURRENT_TIMESTAMP
        WHERE param_name = ? AND is_active = 1
      `;

      await this.database.query(query, [String(paramValue), paramName]);
      logger.info(`参数已更新: ${paramName} = ${paramValue}`);
    } catch (error) {
      logger.error(`更新参数失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取性能统计
   * 
   * @param {number} days - 天数
   * @returns {Promise<Object>} 性能统计
   */
  async getPerformanceStats(days = 7) {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_signals,
          SUM(early_trend_detected) as early_trend_count,
          SUM(CASE WHEN fake_breakout_filter_result = 'pass' THEN 1 ELSE 0 END) as filter_passed,
          SUM(executed) as executed_count,
          COUNT(DISTINCT symbol_id) as symbols_analyzed,
          AVG(CASE WHEN confidence = 'high' THEN 1 WHEN confidence = 'med' THEN 0.6 WHEN confidence = 'low' THEN 0.3 ELSE 0 END) as avg_confidence_score
        FROM strategy_execution_logs
        WHERE signal_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
      `;

      const rows = await this.database.query(query, [days]);

      if (rows.length === 0) {
        return null;
      }

      const stats = rows[0];

      // 计算比率
      stats.early_trend_rate = stats.total_signals > 0
        ? (stats.early_trend_count / stats.total_signals * 100).toFixed(2)
        : 0;

      stats.filter_pass_rate = stats.total_signals > 0
        ? (stats.filter_passed / stats.total_signals * 100).toFixed(2)
        : 0;

      stats.execution_rate = stats.total_signals > 0
        ? (stats.executed_count / stats.total_signals * 100).toFixed(2)
        : 0;

      return stats;
    } catch (error) {
      logger.error(`获取性能统计失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 查询信号日志
   * 
   * @param {Object} filters - 过滤条件
   * @returns {Promise<Array>} 信号日志数组
   */
  async querySignalLogs(filters = {}) {
    try {
      let query = `
        SELECT * FROM strategy_execution_logs
        WHERE 1=1
      `;
      const params = [];

      if (filters.symbolId) {
        query += ' AND symbol_id = ?';
        params.push(filters.symbolId);
      }

      if (filters.confidence) {
        query += ' AND confidence = ?';
        params.push(filters.confidence);
      }

      if (filters.executed !== undefined) {
        query += ' AND executed = ?';
        params.push(filters.executed ? 1 : 0);
      }

      if (filters.hours) {
        query += ' AND signal_time >= DATE_SUB(NOW(), INTERVAL ? HOUR)';
        params.push(filters.hours);
      }

      query += ' ORDER BY signal_time DESC LIMIT ?';
      params.push(filters.limit || 100);

      const rows = await this.database.query(query, params);

      return rows.map(row => ({
        ...row,
        filter_details: row.filter_details ? JSON.parse(row.filter_details) : null
      }));
    } catch (error) {
      logger.error(`查询信号日志失败: ${error.message}`);
      return [];
    }
  }

  /**
   * 解析参数值
   * @private
   */
  _parseParamValue(value, type) {
    switch (type) {
      case 'number':
        return parseFloat(value);
      case 'boolean':
        return value === 'true' || value === '1';
      default:
        return value;
    }
  }
}

module.exports = V31Operations;

