-- 诱多/诱空检测数据库扩展
-- 基于smartmoney.md文档（行681-858）

USE trading_system;

-- 扩展large_order_detection_results表

-- trap_detected
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = 'trading_system' 
   AND TABLE_NAME = 'large_order_detection_results' 
   AND COLUMN_NAME = 'trap_detected') = 0,
  'ALTER TABLE large_order_detection_results ADD COLUMN trap_detected BOOLEAN DEFAULT FALSE COMMENT ''是否检测到诱多/诱空'';',
  'SELECT ''✓ trap_detected exists'' AS status;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- trap_type
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = 'trading_system' 
   AND TABLE_NAME = 'large_order_detection_results' 
   AND COLUMN_NAME = 'trap_type') = 0,
  'ALTER TABLE large_order_detection_results ADD COLUMN trap_type VARCHAR(20) DEFAULT NULL COMMENT ''陷阱类型 (BULL_TRAP/BEAR_TRAP/NONE)'';',
  'SELECT ''✓ trap_type exists'' AS status;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- trap_confidence
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = 'trading_system' 
   AND TABLE_NAME = 'large_order_detection_results' 
   AND COLUMN_NAME = 'trap_confidence') = 0,
  'ALTER TABLE large_order_detection_results ADD COLUMN trap_confidence DECIMAL(5,2) DEFAULT NULL COMMENT ''陷阱置信度(0-100)'';',
  'SELECT ''✓ trap_confidence exists'' AS status;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- trap_indicators
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = 'trading_system' 
   AND TABLE_NAME = 'large_order_detection_results' 
   AND COLUMN_NAME = 'trap_indicators') = 0,
  'ALTER TABLE large_order_detection_results ADD COLUMN trap_indicators JSON DEFAULT NULL COMMENT ''陷阱指标详情'';',
  'SELECT ''✓ trap_indicators exists'' AS status;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- persistent_orders_count
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = 'trading_system' 
   AND TABLE_NAME = 'large_order_detection_results' 
   AND COLUMN_NAME = 'persistent_orders_count') = 0,
  'ALTER TABLE large_order_detection_results ADD COLUMN persistent_orders_count INT DEFAULT 0 COMMENT ''持续挂单数量(>=10s)'';',
  'SELECT ''✓ persistent_orders_count exists'' AS status;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- flash_orders_count
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = 'trading_system' 
   AND TABLE_NAME = 'large_order_detection_results' 
   AND COLUMN_NAME = 'flash_orders_count') = 0,
  'ALTER TABLE large_order_detection_results ADD COLUMN flash_orders_count INT DEFAULT 0 COMMENT ''闪现挂单数量(<3s)'';',
  'SELECT ''✓ flash_orders_count exists'' AS status;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- cancel_ratio
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = 'trading_system' 
   AND TABLE_NAME = 'large_order_detection_results' 
   AND COLUMN_NAME = 'cancel_ratio') = 0,
  'ALTER TABLE large_order_detection_results ADD COLUMN cancel_ratio DECIMAL(5,2) DEFAULT NULL COMMENT ''撤单比率(%)'';',
  'SELECT ''✓ cancel_ratio exists'' AS status;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 添加索引
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
   WHERE TABLE_SCHEMA = 'trading_system' 
   AND TABLE_NAME = 'large_order_detection_results' 
   AND INDEX_NAME = 'idx_trap_detected') = 0,
  'CREATE INDEX idx_trap_detected ON large_order_detection_results(trap_detected);',
  'SELECT ''✓ idx_trap_detected exists'' AS status;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
   WHERE TABLE_SCHEMA = 'trading_system' 
   AND TABLE_NAME = 'large_order_detection_results' 
   AND INDEX_NAME = 'idx_trap_type') = 0,
  'CREATE INDEX idx_trap_type ON large_order_detection_results(trap_type);',
  'SELECT ''✓ idx_trap_type exists'' AS status;'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT '✅ Trap detection extension completed!' as status;

