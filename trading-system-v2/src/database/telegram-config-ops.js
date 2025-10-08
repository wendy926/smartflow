/**
 * Telegram配置数据库操作
 */

const dbOps = require('./operations');
const logger = require('../utils/logger');

class TelegramConfigOps {
  /**
   * 保存或更新Telegram配置
   * @param {string} configType - 配置类型: 'trading', 'monitoring', 'macro'
   * @param {string} botToken - Bot Token
   * @param {string} chatId - Chat ID
   */
  static async saveConfig(configType, botToken, chatId) {
    try {
      const sql = `
        INSERT INTO telegram_config (config_type, bot_token, chat_id, enabled)
        VALUES (?, ?, ?, TRUE)
        ON DUPLICATE KEY UPDATE
          bot_token = VALUES(bot_token),
          chat_id = VALUES(chat_id),
          enabled = TRUE,
          updated_at = CURRENT_TIMESTAMP
      `;

      const result = await dbOps.executeQuery(sql, [configType, botToken, chatId]);

      logger.info(`Telegram配置已保存: ${configType}`);
      return {
        success: true,
        data: { configType, botToken: '***', chatId }
      };
    } catch (error) {
      logger.error(`保存Telegram配置失败: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取Telegram配置
   * @param {string} configType - 配置类型
   */
  static async getConfig(configType) {
    try {
      const sql = `
        SELECT config_type, bot_token, chat_id, enabled, updated_at
        FROM telegram_config
        WHERE config_type = ? AND enabled = TRUE
      `;

      const rows = await dbOps.executeQuery(sql, [configType]);

      if (rows && rows.length > 0) {
        return {
          success: true,
          data: rows[0]
        };
      } else {
        return {
          success: false,
          error: '配置不存在'
        };
      }
    } catch (error) {
      logger.error(`获取Telegram配置失败: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取所有Telegram配置
   */
  static async getAllConfigs() {
    try {
      const sql = `
        SELECT config_type, bot_token, chat_id, enabled, updated_at
        FROM telegram_config
        WHERE enabled = TRUE
        ORDER BY config_type
      `;

      const rows = await dbOps.executeQuery(sql);

      return {
        success: true,
        data: rows || []
      };
    } catch (error) {
      logger.error(`获取所有Telegram配置失败: ${error.message}`);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  /**
   * 禁用Telegram配置
   * @param {string} configType - 配置类型
   */
  static async disableConfig(configType) {
    try {
      const sql = `
        UPDATE telegram_config
        SET enabled = FALSE, updated_at = CURRENT_TIMESTAMP
        WHERE config_type = ?
      `;

      await dbOps.executeQuery(sql, [configType]);

      logger.info(`Telegram配置已禁用: ${configType}`);
      return { success: true };
    } catch (error) {
      logger.error(`禁用Telegram配置失败: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 删除Telegram配置
   * @param {string} configType - 配置类型
   */
  static async deleteConfig(configType) {
    try {
      const sql = `
        DELETE FROM telegram_config
        WHERE config_type = ?
      `;

      await dbOps.executeQuery(sql, [configType]);

      logger.info(`Telegram配置已删除: ${configType}`);
      return { success: true };
    } catch (error) {
      logger.error(`删除Telegram配置失败: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = TelegramConfigOps;

