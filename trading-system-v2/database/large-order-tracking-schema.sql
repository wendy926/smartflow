-- 大额挂单聪明钱追踪数据库表结构
-- 基于 smartmoney.md 文档设计
-- 监控大额挂单 (>100M USD)、检测 spoof、计算 impact ratio

USE trading_system;

-- 1. 大额挂单追踪表
CREATE TABLE IF NOT EXISTS large_order_tracking (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL COMMENT '交易对',
    side ENUM('bid', 'ask') NOT NULL COMMENT '买卖方向',
    price DECIMAL(20,8) NOT NULL COMMENT '价格',
    qty DECIMAL(20,8) NOT NULL COMMENT '数量',
    value_usd DECIMAL(20,2) NOT NULL COMMENT 'USD价值',
    
    created_at BIGINT NOT NULL COMMENT '首次发现时间(ms)',
    last_seen_at BIGINT NOT NULL COMMENT '最后发现时间(ms)',
    canceled_at BIGINT DEFAULT NULL COMMENT '撤销时间(ms)',
    seen_count INT DEFAULT 1 COMMENT '连续发现次数',
    
    filled_volume_observed DECIMAL(20,8) DEFAULT 0 COMMENT '观察到的成交量',
    impact_ratio DECIMAL(6,4) DEFAULT 0 COMMENT '影响力比率',
    
    classification VARCHAR(50) DEFAULT 'UNKNOWN' COMMENT '分类',
    is_persistent BOOLEAN DEFAULT FALSE COMMENT '是否持续',
    is_spoof BOOLEAN DEFAULT FALSE COMMENT '是否为诱导单',
    was_consumed BOOLEAN DEFAULT FALSE COMMENT '是否被吃掉',
    
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    INDEX idx_symbol_time (symbol, created_at),
    INDEX idx_side (side),
    INDEX idx_classification (classification),
    INDEX idx_canceled (canceled_at),
    INDEX idx_persistent (is_persistent),
    UNIQUE KEY uk_symbol_side_price_created (symbol, side, price, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='大额挂单追踪表';

-- 2. 大额挂单检测结果表
CREATE TABLE IF NOT EXISTS large_order_detection_results (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL COMMENT '交易对',
    timestamp BIGINT NOT NULL COMMENT '检测时间(ms)',
    
    final_action VARCHAR(50) NOT NULL COMMENT '最终动作',
    buy_score DECIMAL(6,2) DEFAULT 0 COMMENT '买入得分',
    sell_score DECIMAL(6,2) DEFAULT 0 COMMENT '卖出得分',
    cvd_cum DECIMAL(20,8) DEFAULT 0 COMMENT 'CVD累积值',
    oi DECIMAL(20,8) DEFAULT NULL COMMENT '持仓量',
    oi_change_pct DECIMAL(10,4) DEFAULT NULL COMMENT 'OI变化百分比',
    spoof_count INT DEFAULT 0 COMMENT 'Spoof数量',
    
    tracked_entries_count INT DEFAULT 0 COMMENT '追踪挂单数量',
    detection_data JSON DEFAULT NULL COMMENT '完整检测数据',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    INDEX idx_symbol_time (symbol, timestamp),
    INDEX idx_final_action (final_action),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='大额挂单检测结果表';

-- 3. 大额挂单配置表
CREATE TABLE IF NOT EXISTS large_order_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE COMMENT '配置键',
    config_value TEXT NOT NULL COMMENT '配置值',
    config_type ENUM('NUMBER', 'STRING', 'BOOLEAN') DEFAULT 'NUMBER' COMMENT '配置类型',
    description TEXT DEFAULT NULL COMMENT '描述',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='大额挂单配置表';

-- 4. 插入默认配置
INSERT INTO large_order_config (config_key, config_value, config_type, description) VALUES
('LARGE_USD_THRESHOLD', '100000000', 'NUMBER', '大额挂单阈值(USD)'),
('POLL_INTERVAL_MS', '15000', 'NUMBER', '深度轮询间隔(ms) - 优化后15秒'),
('DEPTH_LIMIT', '1000', 'NUMBER', 'REST depth limit'),
('TOPN', '50', 'NUMBER', '计算影响力的深度档位数'),
('PERSIST_SNAPSHOTS', '3', 'NUMBER', '持续挂单最小检测次数'),
('SPOOF_WINDOW_MS', '3000', 'NUMBER', 'Spoof判定时间窗口(ms)'),
('IMPACT_RATIO_THRESHOLD', '0.25', 'NUMBER', '影响力比率阈值'),
('CVD_WINDOW_MS', '14400000', 'NUMBER', 'CVD窗口(ms, 4小时)'),
('PRICE_TOLERANCE', '0.0005', 'NUMBER', '价格匹配容差(0.05%)'),
('MAX_TRACKED_ENTRIES', '100', 'NUMBER', '最大追踪挂单数')
ON DUPLICATE KEY UPDATE
    config_value = VALUES(config_value),
    updated_at = CURRENT_TIMESTAMP;

-- 5. 复用 smart_money_watch_list 表存储监控交易对
-- 添加新的默认监控交易对
INSERT INTO smart_money_watch_list (symbol, is_active, is_default, added_by, notes) VALUES
('BTCUSDT', 1, 1, 'system', 'BTC - 比特币 (大额挂单监控)'),
('ETHUSDT', 1, 1, 'system', 'ETH - 以太坊 (大额挂单监控)')
ON DUPLICATE KEY UPDATE
    notes = CONCAT(notes, ' | 大额挂单监控'),
    updated_at = CURRENT_TIMESTAMP;

-- 显示结果
SELECT 'Large Order Tracking schema created successfully!' as status;
SELECT COUNT(*) as config_count FROM large_order_config;
SELECT COUNT(*) as watch_list_count FROM smart_money_watch_list WHERE is_active = 1;

