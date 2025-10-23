-- 宏观数据监控模块数据库表结构
-- 基于 smonitor.md 文档设计

-- 1. 宏观监控数据表
CREATE TABLE IF NOT EXISTS macro_monitoring_data (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    data_type ENUM('FUND_FLOW', 'MARKET_SENTIMENT', 'FUTURES_MARKET', 'MACRO_ECONOMIC') NOT NULL COMMENT '数据类型',
    source VARCHAR(50) NOT NULL COMMENT '数据源',
    metric_name VARCHAR(100) NOT NULL COMMENT '指标名称',
    metric_value DECIMAL(20, 8) NOT NULL COMMENT '指标值',
    metric_unit VARCHAR(20) DEFAULT NULL COMMENT '指标单位',
    alert_level ENUM('NORMAL', 'WARNING', 'CRITICAL') DEFAULT 'NORMAL' COMMENT '告警级别',
    raw_data JSON DEFAULT NULL COMMENT '原始数据',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_data_type (data_type),
    INDEX idx_source (source),
    INDEX idx_alert_level (alert_level),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='宏观监控数据表';

-- 2. 宏观监控配置表
CREATE TABLE IF NOT EXISTS macro_monitoring_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE COMMENT '配置键',
    config_value TEXT NOT NULL COMMENT '配置值',
    config_type ENUM('STRING', 'NUMBER', 'BOOLEAN', 'JSON') DEFAULT 'STRING COMMENT '配置类型',
    description TEXT DEFAULT NULL COMMENT '配置描述',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否激活',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_config_key (config_key),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='宏观监控配置表';

-- 3. 宏观监控告警记录表
CREATE TABLE IF NOT EXISTS macro_monitoring_alerts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    alert_type ENUM('FUND_FLOW', 'MARKET_SENTIMENT', 'FUTURES_MARKET', 'MACRO_ECONOMIC') NOT NULL COMMENT '告警类型',
    alert_level ENUM('WARNING', 'CRITICAL') NOT NULL COMMENT '告警级别',
    title VARCHAR(200) NOT NULL COMMENT '告警标题',
    message TEXT NOT NULL COMMENT '告警消息',
    metric_name VARCHAR(100) NOT NULL COMMENT '指标名称',
    metric_value DECIMAL(20, 8) NOT NULL COMMENT '指标值',
    threshold_value DECIMAL(20, 8) NOT NULL COMMENT '阈值',
    is_sent BOOLEAN DEFAULT FALSE COMMENT '是否已发送',
    sent_at TIMESTAMP NULL DEFAULT NULL COMMENT '发送时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_alert_type (alert_type),
    INDEX idx_alert_level (alert_level),
    INDEX idx_is_sent (is_sent),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='宏观监控告警记录表';

-- 插入宏观监控默认配置
INSERT INTO macro_monitoring_config (config_key, config_value, config_type, description) VALUES
('fund_flow_btc_threshold', '10000000', 'NUMBER', 'BTC大额转账告警阈值USD'),
('fund_flow_eth_threshold', '1000', 'NUMBER', 'ETH大额转账告警阈值ETH'),
('fund_flow_enabled', 'true', 'BOOLEAN', '资金流监控是否启用'),
('fear_greed_low_threshold', '20', 'NUMBER', '恐惧贪婪指数低阈值'),
('fear_greed_high_threshold', '80', 'NUMBER', '恐惧贪婪指数高阈值'),
('market_sentiment_enabled', 'true', 'BOOLEAN', '市场情绪监控是否启用'),
('long_short_ratio_high', '2.0', 'NUMBER', '多空比高阈值'),
('long_short_ratio_low', '0.5', 'NUMBER', '多空比低阈值'),
('futures_market_enabled', 'true', 'BOOLEAN', '合约市场监控是否启用'),
('fed_funds_high_threshold', '5.0', 'NUMBER', '美联储利率高阈值'),
('fed_funds_low_threshold', '2.0', 'NUMBER', '美联储利率低阈值'),
('cpi_high_threshold', '4.0', 'NUMBER', 'CPI通胀率高阈值'),
('cpi_low_threshold', '1.0', 'NUMBER', 'CPI通胀率低阈值'),
('macro_economic_enabled', 'true', 'BOOLEAN', '宏观指标监控是否启用'),
('etherscan_api_key', 'AZAZFVBNA16WCUMAHPGDFTVSXB5KJUHCIM', 'STRING', 'Etherscan API密钥'),
('fred_api_key', 'fbfe3e85bdec733f71b17800eaa614fd', 'STRING', 'FRED API密钥'),
('exchange_wallet_address', '0x28C6c06298d514Db089934071355E5743bf21d60', 'STRING', '交易所钱包地址'),
('monitoring_interval', '60', 'NUMBER', '监控间隔秒'),
('data_retention_days', '30', 'NUMBER', '数据保留天数'),
('alert_cooldown_minutes', '30', 'NUMBER', '告警冷却时间分钟'),
('telegram_macro_enabled', 'false', 'BOOLEAN', '宏观监控Telegram通知是否启用'),
('telegram_macro_bot_token', '', 'STRING', '宏观监控Telegram机器人令牌'),
('telegram_macro_chat_id', '', 'STRING', '宏观监控Telegram聊天ID')
ON DUPLICATE KEY UPDATE 
    config_value = VALUES(config_value),
    updated_at = CURRENT_TIMESTAMP;
