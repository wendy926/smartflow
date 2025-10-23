/**
 * AI告警服务
 * 处理AI分析触发的告警通知
 */

const logger = require('../../utils/logger');

/**
 * AI告警服务类
 */
class AIAlertService {
  constructor(aiOperations, telegramService) {
    this.aiOps = aiOperations;
    this.telegram = telegramService;
  }

  /**
   * 检查并触发告警
   * @param {Object} analysisResult - AI分析结果
   * @returns {Promise<boolean>}
   */
  async checkAndTriggerAlert(analysisResult) {
    try {
      const { symbol, riskLevel, analysisId, coreFinding } = analysisResult;

      // 检查是否需要告警
      if (!this.shouldAlert(riskLevel)) {
        logger.debug(`${symbol} 风险等级 ${riskLevel} 不需要告警`);
        return false;
      }

      // 检查告警冷却期
      const config = await this.aiOps.getConfig();
      const cooldownSeconds = parseInt(config.alert_cooldown_seconds) || 3600;
      
      const isInCooldown = await this.aiOps.isInCooldown(symbol, cooldownSeconds);
      if (isInCooldown) {
        logger.info(`${symbol} 在告警冷却期内，跳过告警`);
        return false;
      }

      // 构建告警消息
      const alertMessage = this.buildAlertMessage(analysisResult);
      const alertType = this.getAlertType(riskLevel);

      // 发送Telegram告警
      let telegramSent = false;
      let telegramMessageId = null;

      if (this.telegram && config.alert_danger_enabled === 'true') {
        try {
          const result = await this.telegram.sendAlert(alertMessage, 'CRITICAL');
          telegramSent = result.success;
          telegramMessageId = result.messageId;
          logger.info(`Telegram告警已发送 - ${symbol}`);
        } catch (error) {
          logger.error(`Telegram告警发送失败 - ${symbol}:`, error);
        }
      }

      // 保存告警记录
      await this.aiOps.saveAlert({
        analysisId,
        alertType,
        alertMessage,
        telegramSent,
        telegramMessageId
      });

      // 更新分析记录的告警触发状态
      await this.updateAnalysisAlertStatus(analysisId);

      logger.info(`AI告警已触发 - ${symbol}, 风险等级: ${riskLevel}`);
      return true;

    } catch (error) {
      logger.error('检查并触发AI告警失败:', error);
      return false;
    }
  }

  /**
   * 判断是否应该告警
   * @param {string} riskLevel - 风险等级
   * @returns {boolean}
   */
  shouldAlert(riskLevel) {
    return riskLevel === 'DANGER' || riskLevel === 'EXTREME';
  }

  /**
   * 获取告警类型
   * @param {string} riskLevel - 风险等级
   * @returns {string}
   */
  getAlertType(riskLevel) {
    return riskLevel === 'EXTREME' ? 'RISK_CRITICAL' : 'RISK_WARNING';
  }

  /**
   * 构建告警消息
   * @param {Object} analysisResult - 分析结果
   * @returns {string}
   */
  buildAlertMessage(analysisResult) {
    const { symbol, riskLevel, coreFinding, dataSupport, suggestions, confidence } = analysisResult;

    const emoji = riskLevel === 'EXTREME' ? '⚫' : '🔴';
    const levelText = riskLevel === 'EXTREME' ? '极度危险' : '危险';

    let message = `${emoji} AI市场风险告警\n\n`;
    message += `交易对: ${symbol}\n`;
    message += `风险等级: ${levelText}\n`;
    message += `置信度: ${confidence}%\n\n`;

    message += `📊 核心发现:\n${coreFinding}\n\n`;

    if (dataSupport) {
      message += `📈 数据支持:\n`;
      if (dataSupport.fundingRate) {
        message += `• 资金费率: ${dataSupport.fundingRate}\n`;
      }
      if (dataSupport.openInterest) {
        message += `• 持仓量: ${dataSupport.openInterest}\n`;
      }
      if (dataSupport.etfFlow) {
        message += `• ETF流向: ${dataSupport.etfFlow}\n`;
      }
      message += '\n';
    }

    if (suggestions && suggestions.length > 0) {
      message += `💡 操作建议:\n`;
      suggestions.slice(0, 3).forEach((suggestion, index) => {
        message += `${index + 1}. ${suggestion}\n`;
      });
    }

    message += `\n⏰ 时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;

    return message;
  }

  /**
   * 更新分析记录的告警触发状态
   * @param {number} analysisId - 分析记录ID
   * @returns {Promise<void>}
   */
  async updateAnalysisAlertStatus(analysisId) {
    try {
      await this.aiOps.pool.query(
        'UPDATE ai_market_analysis SET alert_triggered = TRUE WHERE id = ?',
        [analysisId]
      );
    } catch (error) {
      logger.error('更新告警状态失败:', error);
    }
  }

  /**
   * 批量检查告警
   * @param {Array} analysisResults - 分析结果数组
   * @returns {Promise<Array>}
   */
  async checkMultipleAlerts(analysisResults) {
    const results = [];

    for (const result of analysisResults) {
      if (result.success) {
        const alertTriggered = await this.checkAndTriggerAlert(result);
        results.push({
          symbol: result.symbol,
          riskLevel: result.riskLevel,
          alertTriggered
        });
      }
    }

    return results;
  }

  /**
   * 获取告警统计
   * @param {number} days - 统计天数
   * @returns {Promise<Object>}
   */
  async getAlertStats(days = 7) {
    try {
      const [rows] = await this.aiOps.pool.query(
        `SELECT 
          DATE(aah.created_at) as alert_date,
          aah.alert_type,
          COUNT(*) as count,
          SUM(CASE WHEN aah.telegram_sent = TRUE THEN 1 ELSE 0 END) as telegram_sent_count
        FROM ai_alert_history aah
        WHERE aah.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY DATE(aah.created_at), aah.alert_type
        ORDER BY alert_date DESC`,
        [days]
      );

      return {
        details: rows,
        total: rows.reduce((sum, row) => sum + row.count, 0),
        telegramSent: rows.reduce((sum, row) => sum + row.telegram_sent_count, 0)
      };
    } catch (error) {
      logger.error('获取告警统计失败:', error);
      throw error;
    }
  }
}

module.exports = AIAlertService;

