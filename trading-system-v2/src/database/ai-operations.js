/**
 * AI相关数据库操作模块
 * 处理AI配置、分析记录、告警等数据的CRUD操作
 */

const logger = require('../utils/logger');

/**
 * AI数据库操作类
 */
class AIOperations {
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * 获取所有AI配置
   * @returns {Promise<Object>} - 配置对象
   */
  async getConfig() {
    try {
      const [rows] = await this.pool.query(
        'SELECT config_key, config_value, config_type FROM ai_config WHERE is_active = TRUE'
      );

      // 转换为对象格式
      const config = {};
      rows.forEach(row => {
        config[row.config_key] = row.config_value;
      });

      return config;
    } catch (error) {
      logger.error('获取AI配置失败:', error);
      throw error;
    }
  }

  /**
   * 获取单个配置项
   * @param {string} key - 配置键
   * @returns {Promise<string|null>}
   */
  async getConfigValue(key) {
    try {
      const [rows] = await this.pool.query(
        'SELECT config_value FROM ai_config WHERE config_key = ? AND is_active = TRUE',
        [key]
      );

      return rows.length > 0 ? rows[0].config_value : null;
    } catch (error) {
      logger.error(`获取配置 ${key} 失败:`, error);
      throw error;
    }
  }

  /**
   * 更新配置项
   * @param {string} key - 配置键
   * @param {string} value - 配置值
   * @returns {Promise<boolean>}
   */
  async updateConfig(key, value) {
    try {
      await this.pool.query(
        'UPDATE ai_config SET config_value = ?, updated_at = NOW() WHERE config_key = ?',
        [value, key]
      );
      return true;
    } catch (error) {
      logger.error(`更新配置 ${key} 失败:`, error);
      throw error;
    }
  }

  /**
   * 保存AI分析记录
   * @param {Object} data - 分析数据
   * @returns {Promise<number>} - 插入的记录ID
   */
  async saveAnalysis(data) {
    try {
      const { symbol, analysisType, analysisData, riskLevel, confidenceScore, alertTriggered, rawResponse } = data;

      const [result] = await this.pool.query(
        `INSERT INTO ai_market_analysis 
        (symbol, analysis_type, analysis_data, risk_level, confidence_score, alert_triggered, raw_response)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          symbol,
          analysisType,
          JSON.stringify(analysisData),
          riskLevel || null,
          confidenceScore || null,
          alertTriggered || false,
          rawResponse || null
        ]
      );

      logger.info(`AI分析记录已保存 - ID: ${result.insertId}, 交易对: ${symbol}, 类型: ${analysisType}`);
      return result.insertId;
    } catch (error) {
      logger.error('保存AI分析记录失败:', error);
      throw error;
    }
  }

  /**
   * 获取最新AI分析记录
   * @param {string} symbol - 交易对符号
   * @param {string} analysisType - 分析类型 (MACRO_RISK | SYMBOL_TREND)
   * @returns {Promise<Object|null>}
   */
  async getLatestAnalysis(symbol, analysisType) {
    try {
      const [rows] = await this.pool.query(
        `SELECT * FROM ai_market_analysis 
        WHERE symbol = ? AND analysis_type = ?
        ORDER BY created_at DESC LIMIT 1`,
        [symbol, analysisType]
      );

      if (rows.length === 0) {
        return null;
      }

      const row = rows[0];
      return {
        id: row.id,
        symbol: row.symbol,
        analysisType: row.analysis_type,
        analysisData: JSON.parse(row.analysis_data),
        riskLevel: row.risk_level,
        confidenceScore: row.confidence_score,
        alertTriggered: row.alert_triggered,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (error) {
      logger.error(`获取最新AI分析失败 - ${symbol} ${analysisType}:`, error);
      throw error;
    }
  }

  /**
   * 获取所有最新分析（通过视图）
   * @param {string} analysisType - 分析类型（可选）
   * @returns {Promise<Array>}
   */
  async getAllLatestAnalysis(analysisType = null) {
    try {
      let query = 'SELECT * FROM v_latest_ai_analysis';
      const params = [];

      if (analysisType) {
        query += ' WHERE analysis_type = ?';
        params.push(analysisType);
      }

      query += ' ORDER BY created_at DESC';

      const [rows] = await this.pool.query(query, params);

      return rows.map(row => ({
        symbol: row.symbol,
        analysisType: row.analysis_type,
        analysisData: JSON.parse(row.analysis_data),
        riskLevel: row.risk_level,
        confidenceScore: row.confidence_score,
        alertTriggered: row.alert_triggered,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastPrice: row.last_price,
        priceChange24h: row.price_change_24h
      }));
    } catch (error) {
      logger.error('获取所有最新AI分析失败:', error);
      throw error;
    }
  }

  /**
   * 保存告警记录
   * @param {Object} data - 告警数据
   * @returns {Promise<number>} - 插入的记录ID
   */
  async saveAlert(data) {
    try {
      const { analysisId, alertType, alertMessage, telegramSent, telegramMessageId } = data;

      const [result] = await this.pool.query(
        `INSERT INTO ai_alert_history 
        (analysis_id, alert_type, alert_message, telegram_sent, telegram_message_id)
        VALUES (?, ?, ?, ?, ?)`,
        [analysisId, alertType, alertMessage, telegramSent || false, telegramMessageId || null]
      );

      logger.info(`告警记录已保存 - ID: ${result.insertId}, 分析ID: ${analysisId}`);
      return result.insertId;
    } catch (error) {
      logger.error('保存告警记录失败:', error);
      throw error;
    }
  }

  /**
   * 检查是否在冷却期内
   * @param {string} symbol - 交易对符号
   * @param {number} cooldownSeconds - 冷却时间（秒）
   * @returns {Promise<boolean>}
   */
  async isInCooldown(symbol, cooldownSeconds = 3600) {
    try {
      const [rows] = await this.pool.query(
        `SELECT COUNT(*) as count FROM ai_alert_history aah
        INNER JOIN ai_market_analysis ama ON aah.analysis_id = ama.id
        WHERE ama.symbol = ? 
        AND aah.created_at > DATE_SUB(NOW(), INTERVAL ? SECOND)`,
        [symbol, cooldownSeconds]
      );

      return rows[0].count > 0;
    } catch (error) {
      logger.error(`检查告警冷却期失败 - ${symbol}:`, error);
      return false; // 出错时假设不在冷却期
    }
  }

  /**
   * 保存API调用日志
   * @param {Object} data - 日志数据
   * @returns {Promise<number>} - 插入的记录ID
   */
  async saveAPILog(data) {
    try {
      const { requestType, requestData, responseStatus, responseTimeMs, errorMessage, tokensUsed } = data;

      const [result] = await this.pool.query(
        `INSERT INTO ai_api_logs 
        (request_type, request_data, response_status, response_time_ms, error_message, tokens_used)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          requestType,
          requestData ? JSON.stringify(requestData) : null,
          responseStatus,
          responseTimeMs || null,
          errorMessage || null,
          tokensUsed || null
        ]
      );

      return result.insertId;
    } catch (error) {
      logger.error('保存API日志失败:', error);
      // API日志失败不影响主流程
      return null;
    }
  }

  /**
   * 获取API统计信息
   * @param {number} days - 统计天数
   * @returns {Promise<Object>}
   */
  async getAPIStats(days = 7) {
    try {
      const [rows] = await this.pool.query(
        `SELECT * FROM v_ai_analysis_stats WHERE analysis_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        ORDER BY analysis_date DESC, request_type`,
        [days]
      );

      // 计算总计
      const total = {
        totalRequests: 0,
        successCount: 0,
        errorCount: 0,
        timeoutCount: 0,
        totalTokens: 0,
        avgResponseTime: 0
      };

      rows.forEach(row => {
        total.totalRequests += row.total_requests;
        total.successCount += row.success_count;
        total.errorCount += row.error_count;
        total.timeoutCount += row.timeout_count;
        total.totalTokens += row.total_tokens_used;
      });

      if (rows.length > 0) {
        const sumResponseTime = rows.reduce((sum, row) => 
          sum + (row.avg_response_time_ms * row.total_requests), 0
        );
        total.avgResponseTime = Math.round(sumResponseTime / total.totalRequests);
      }

      return {
        details: rows,
        summary: {
          ...total,
          successRate: total.totalRequests > 0
            ? Math.round((total.successCount / total.totalRequests) * 100)
            : 0
        }
      };
    } catch (error) {
      logger.error(`获取API统计失败:`, error);
      throw error;
    }
  }

  /**
   * 关联AI分析到策略判断
   * @param {number} judgmentId - 策略判断ID
   * @param {number} analysisId - AI分析ID
   * @returns {Promise<boolean>}
   */
  async linkAnalysisToJudgment(judgmentId, analysisId) {
    try {
      await this.pool.query(
        'UPDATE strategy_judgments SET ai_analysis_id = ? WHERE id = ?',
        [analysisId, judgmentId]
      );
      return true;
    } catch (error) {
      logger.error(`关联AI分析失败 - 判断ID: ${judgmentId}, 分析ID: ${analysisId}:`, error);
      throw error;
    }
  }

  /**
   * 清理过期数据
   * @returns {Promise<Object>}
   */
  async cleanupExpiredData() {
    try {
      await this.pool.query('CALL CleanupAIAnalysisData()');
      logger.info('AI过期数据清理完成');
      return { success: true };
    } catch (error) {
      logger.error('清理AI过期数据失败:', error);
      throw error;
    }
  }
}

// 延迟初始化
let instance = null;

/**
 * 获取AIOperations实例
 * @returns {AIOperations}
 */
function getAIOperations() {
  if (!instance) {
    const { pool } = require('./connection');
    instance = new AIOperations(pool);
  }
  return instance;
}

module.exports = getAIOperations;
module.exports.AIOperations = AIOperations;

