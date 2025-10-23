-- 聪明钱跟踪功能数据库表结构
-- 用于存储用户配置的监控交易对列表

USE trading_system;

-- 1. 聪明钱监控配置表（存储用户监控的交易对）
CREATE TABLE IF NOT EXISTS smart_money_watch_list (
    id INT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL UNIQUE COMMENT '交易对符号',
    is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用监控',
    is_default TINYINT(1) DEFAULT 0 COMMENT '是否为默认监控',
    added_by VARCHAR(50) DEFAULT 'system' COMMENT '添加者',
    notes TEXT DEFAULT NULL COMMENT '备注信息',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_is_active (is_active),
    INDEX idx_symbol (symbol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='聪明钱监控交易对列表';

-- 2. 插入默认监控交易对
INSERT INTO smart_money_watch_list (symbol, is_active, is_default, added_by, notes) VALUES
('BTCUSDT', 1, 1, 'system', 'BTC - 比特币'),
('ETHUSDT', 1, 1, 'system', 'ETH - 以太坊'),
('SOLUSDT', 1, 1, 'system', 'SOL - Solana')
ON DUPLICATE KEY UPDATE 
    is_active = VALUES(is_active),
    updated_at = CURRENT_TIMESTAMP;

-- 3. 聪明钱检测参数配置（复用strategy_params表）
-- 使用已有的strategy_params表，添加smart_money类别的参数
INSERT INTO strategy_params (param_name, param_value, param_type, category, description) VALUES
-- 基础参数
('sm_kline_interval', '15m', 'string', 'smart_money', 'K线时间间隔'),
('sm_kline_limit', '200', 'number', 'smart_money', 'K线数据量'),
('sm_cvd_window_hours', '4', 'number', 'smart_money', 'CVD窗口(小时)'),
('sm_refresh_interval_sec', '900', 'number', 'smart_money', '刷新间隔(秒，默认15分钟)'),
('sm_obi_top_n', '20', 'number', 'smart_money', 'OBI计算深度档位数'),
('sm_dyn_window', '12', 'number', 'smart_money', '动态阈值窗口大小'),

-- 阈值参数
('sm_thresh_obi_z', '1.0', 'number', 'smart_money', 'OBI Z-score阈值'),
('sm_thresh_cvd_z', '0.8', 'number', 'smart_money', 'CVD Z-score阈值'),
('sm_thresh_oi_z', '0.8', 'number', 'smart_money', 'OI变化Z-score阈值'),
('sm_thresh_vol_z', '0.8', 'number', 'smart_money', '成交量Z-score阈值')
ON DUPLICATE KEY UPDATE
    param_value = VALUES(param_value),
    updated_at = CURRENT_TIMESTAMP;

-- 显示结果
SELECT 'Smart Money Tracking schema created successfully!' as status;
SELECT COUNT(*) as watch_list_count FROM smart_money_watch_list WHERE is_active = 1;
SELECT COUNT(*) as params_count FROM strategy_params WHERE category = 'smart_money';

