-- 大额挂单黑天鹅检测扩展
-- 基于swan.md文档要求
-- 扩展large_order_detection_results表

USE trading_system;

-- ========================================
-- 1. 扩展large_order_detection_results表
-- ========================================

-- 检查并添加swan_alert_level字段
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = 'trading_system' 
   AND TABLE_NAME = 'large_order_detection_results' 
   AND COLUMN_NAME = 'swan_alert_level') = 0,
  'ALTER TABLE large_order_detection_results ADD COLUMN swan_alert_level VARCHAR(20) DEFAULT NULL COMMENT ''黑天鹅告警级别 (CRITICAL/HIGH/WATCH/NONE)'';',
  'SELECT ''✓ swan_alert_level exists'' AS status;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 检查并添加price_drop_pct字段
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = 'trading_system' 
   AND TABLE_NAME = 'large_order_detection_results' 
   AND COLUMN_NAME = 'price_drop_pct') = 0,
  'ALTER TABLE large_order_detection_results ADD COLUMN price_drop_pct DECIMAL(10,4) DEFAULT NULL COMMENT ''5分钟价格跌幅(%)'';',
  'SELECT ''✓ price_drop_pct exists'' AS status;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 检查并添加volume_24h字段
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = 'trading_system' 
   AND TABLE_NAME = 'large_order_detection_results' 
   AND COLUMN_NAME = 'volume_24h') = 0,
  'ALTER TABLE large_order_detection_results ADD COLUMN volume_24h DECIMAL(20,8) DEFAULT NULL COMMENT ''24小时成交额(USDT)'';',
  'SELECT ''✓ volume_24h exists'' AS status;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 检查并添加max_order_to_vol24h_ratio字段
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = 'trading_system' 
   AND TABLE_NAME = 'large_order_detection_results' 
   AND COLUMN_NAME = 'max_order_to_vol24h_ratio') = 0,
  'ALTER TABLE large_order_detection_results ADD COLUMN max_order_to_vol24h_ratio DECIMAL(10,6) DEFAULT NULL COMMENT ''最大挂单/24h成交额比率'';',
  'SELECT ''✓ max_order_to_vol24h_ratio exists'' AS status;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 检查并添加max_order_to_oi_ratio字段
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = 'trading_system' 
   AND TABLE_NAME = 'large_order_detection_results' 
   AND COLUMN_NAME = 'max_order_to_oi_ratio') = 0,
  'ALTER TABLE large_order_detection_results ADD COLUMN max_order_to_oi_ratio DECIMAL(10,6) DEFAULT NULL COMMENT ''最大挂单/持仓量比率'';',
  'SELECT ''✓ max_order_to_oi_ratio exists'' AS status;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 检查并添加sweep_detected字段
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = 'trading_system' 
   AND TABLE_NAME = 'large_order_detection_results' 
   AND COLUMN_NAME = 'sweep_detected') = 0,
  'ALTER TABLE large_order_detection_results ADD COLUMN sweep_detected BOOLEAN DEFAULT FALSE COMMENT ''是否检测到快速消费'';',
  'SELECT ''✓ sweep_detected exists'' AS status;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 检查并添加sweep_pct字段
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = 'trading_system' 
   AND TABLE_NAME = 'large_order_detection_results' 
   AND COLUMN_NAME = 'sweep_pct') = 0,
  'ALTER TABLE large_order_detection_results ADD COLUMN sweep_pct DECIMAL(10,4) DEFAULT NULL COMMENT ''被消费百分比(%)'';',
  'SELECT ''✓ sweep_pct exists'' AS status;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 检查并添加alert_triggers字段
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = 'trading_system' 
   AND TABLE_NAME = 'large_order_detection_results' 
   AND COLUMN_NAME = 'alert_triggers') = 0,
  'ALTER TABLE large_order_detection_results ADD COLUMN alert_triggers JSON DEFAULT NULL COMMENT ''触发的告警条件'';',
  'SELECT ''✓ alert_triggers exists'' AS status;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 添加索引（检查后创建）
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
   WHERE TABLE_SCHEMA = 'trading_system' 
   AND TABLE_NAME = 'large_order_detection_results' 
   AND INDEX_NAME = 'idx_swan_alert_level') = 0,
  'CREATE INDEX idx_swan_alert_level ON large_order_detection_results(swan_alert_level);',
  'SELECT ''✓ idx_swan_alert_level exists'' AS status;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
   WHERE TABLE_SCHEMA = 'trading_system' 
   AND TABLE_NAME = 'large_order_detection_results' 
   AND INDEX_NAME = 'idx_sweep_detected') = 0,
  'CREATE INDEX idx_sweep_detected ON large_order_detection_results(sweep_detected);',
  'SELECT ''✓ idx_sweep_detected exists'' AS status;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ========================================
-- 2. 添加Swan检测参数配置
-- ========================================

INSERT INTO large_order_config (config_key, config_value, config_type, description) VALUES
('SWAN_VOL24H_RATIO_THRESHOLD', '0.03', 'NUMBER', 'order/24h成交额阈值(3%)'),
('SWAN_OI_RATIO_THRESHOLD', '0.05', 'NUMBER', 'order/OI阈值(5%)'),
('SWAN_SWEEP_PCT_THRESHOLD', '0.30', 'NUMBER', '快速消费阈值(30%)'),
('SWAN_PRICE_DROP_THRESHOLD', '0.03', 'NUMBER', '价格跌幅阈值(3%)'),
('SWAN_CRITICAL_PRICE_DROP', '0.05', 'NUMBER', '严重价格跌幅(5%)'),
('SWAN_OI_COLLAPSE_THRESHOLD', '0.05', 'NUMBER', 'OI突降阈值(5%)'),
('SWAN_WINDOW_MS', '300000', 'NUMBER', '检测窗口(5分钟=300000ms)'),
('SWAN_IMPACT_RATIO_THRESHOLD', '0.20', 'NUMBER', '影响力比率阈值(20%，文档要求)')
ON DUPLICATE KEY UPDATE
    config_value = VALUES(config_value),
    updated_at = CURRENT_TIMESTAMP;

-- ========================================
-- 3. 创建黑天鹅告警视图
-- ========================================

CREATE OR REPLACE VIEW swan_alerts AS
SELECT 
    symbol,
    timestamp,
    final_action,
    swan_alert_level,
    price_drop_pct,
    max_order_to_vol24h_ratio,
    max_order_to_oi_ratio,
    sweep_detected,
    sweep_pct,
    alert_triggers,
    tracked_entries_count,
    spoof_count,
    created_at
FROM large_order_detection_results
WHERE swan_alert_level IN ('CRITICAL', 'HIGH', 'WATCH')
ORDER BY 
    CASE swan_alert_level
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH' THEN 2
        WHEN 'WATCH' THEN 3
    END,
    timestamp DESC;

-- ========================================
-- 4. 显示执行结果
-- ========================================

SELECT '✅ Swan detection extension completed!' as status;
SELECT COUNT(*) as swan_params_count 
FROM large_order_config 
WHERE config_key LIKE 'SWAN_%';

SELECT 
    '📊 Extended fields' as info,
    'large_order_detection_results: +8 fields (swan_alert_level, price_drop_pct, volume_24h, etc.)' as details
UNION ALL
SELECT 
    '📈 Created view' as info,
    'swan_alerts (filter CRITICAL/HIGH/WATCH)' as details
UNION ALL
SELECT
    '⚡ Performance' as info,
    '+8 fields, ~100bytes/record, indexed' as details;

