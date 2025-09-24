/**
 * 创建用户设置表迁移
 * 用于存储用户偏好设置，如最大损失金额等
 */

const logger = require('../../utils/logger');

/**
 * 创建user_settings表
 * @param {Object} connection - 数据库连接
 */
async function createUserSettingsTable(connection) {
  try {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS user_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(100) NOT NULL UNIQUE,
        value TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_setting_key (setting_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;

    await connection.execute(createTableSQL);
    logger.info('✅ user_settings表创建成功');

    // 插入默认设置
    const defaultSettings = [
      { key: 'maxLossAmount', value: '100' },
      { key: 'defaultLeverage', value: '10' },
      { key: 'riskTolerance', value: 'medium' }
    ];

    for (const setting of defaultSettings) {
      try {
        await connection.execute(
          `INSERT IGNORE INTO user_settings (setting_key, value) VALUES (?, ?)`,
          [setting.key, setting.value]
        );
      } catch (error) {
        // 忽略重复键错误
        if (error.code !== 'ER_DUP_ENTRY') {
          throw error;
        }
      }
    }

    logger.info('✅ 默认用户设置插入成功');
  } catch (error) {
    logger.error('❌ 创建user_settings表失败:', error);
    throw error;
  }
}

module.exports = {
  createUserSettingsTable
};
