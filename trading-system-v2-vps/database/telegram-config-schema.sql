-- Telegram配置表
CREATE TABLE IF NOT EXISTS telegram_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  config_type VARCHAR(50) NOT NULL COMMENT '配置类型: trading, monitoring, macro',
  bot_token VARCHAR(255) NOT NULL COMMENT 'Telegram Bot Token',
  chat_id VARCHAR(100) NOT NULL COMMENT 'Telegram Chat ID',
  enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_config_type (config_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Telegram配置表';

-- 宏观监控阈值配置表（已废弃，保留用于数据迁移）
CREATE TABLE IF NOT EXISTS macro_alert_thresholds (
  id INT PRIMARY KEY AUTO_INCREMENT,
  btc_threshold DECIMAL(15,2) DEFAULT 10000000 COMMENT 'BTC大额转账阈值(USD)',
  eth_threshold DECIMAL(15,2) DEFAULT 1000 COMMENT 'ETH大额转账阈值(ETH)',
  fear_greed_low INT DEFAULT 20 COMMENT '恐惧贪婪指数低阈值',
  fear_greed_high INT DEFAULT 80 COMMENT '恐惧贪婪指数高阈值',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='宏观监控阈值配置（已废弃）';

-- 创建索引
CREATE INDEX idx_config_type ON telegram_config(config_type);
CREATE INDEX idx_enabled ON telegram_config(enabled);

