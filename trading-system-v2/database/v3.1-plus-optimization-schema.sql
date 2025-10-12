-- V3.1-Plus策略优化数据库表结构
-- 基于strategy-v3.1-plus.md的三大优化：
-- 1. 入场时机优化（延迟确认 + 回撤分步入场）
-- 2. 止损/仓位优化（动态止损 + 分批建仓）
-- 3. 交易节律/频率控制（冷却 + 胜率驱动）

USE trading_system;

-- =======================
-- 1. 交易冷却管理表
-- =======================
CREATE TABLE IF NOT EXISTS v3_trade_cooldown (
  id INT AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL UNIQUE COMMENT '交易对符号',
  last_entry_time BIGINT NOT NULL COMMENT '最后入场时间戳(ms)',
  daily_trade_count INT DEFAULT 0 COMMENT '今日交易次数',
  last_reset_date DATE NOT NULL COMMENT '计数重置日期',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_symbol (symbol),
  INDEX idx_last_entry_time (last_entry_time),
  INDEX idx_last_reset_date (last_reset_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='V3交易冷却管理表';

-- =======================
-- 2. 交易历史记录表（用于胜率跟踪）
-- =======================
CREATE TABLE IF NOT EXISTS v3_trade_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL COMMENT '交易对符号',
  side ENUM('LONG', 'SHORT') NOT NULL COMMENT '交易方向',
  entry_price DECIMAL(20,8) NOT NULL COMMENT '入场价格',
  exit_price DECIMAL(20,8) DEFAULT NULL COMMENT '出场价格',
  entry_mode ENUM('breakout', 'pullback', 'momentum') NOT NULL COMMENT '入场模式',
  confidence ENUM('high', 'med', 'low') NOT NULL COMMENT '置信度等级',
  pnl DECIMAL(20,8) DEFAULT NULL COMMENT '盈亏',
  pnl_pct DECIMAL(10,4) DEFAULT NULL COMMENT '盈亏百分比',
  entry_time TIMESTAMP NOT NULL COMMENT '入场时间',
  exit_time TIMESTAMP DEFAULT NULL COMMENT '出场时间',
  duration_minutes INT DEFAULT NULL COMMENT '持仓时间(分钟)',
  exit_reason ENUM('SL', 'TP', 'TIME', 'MANUAL', 'TRAILING') DEFAULT NULL COMMENT '出场原因',
  confirmation_details JSON DEFAULT NULL COMMENT '确认详情: {volOk, deltaOk, earlyOk, smartOk, confirmCount}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_symbol_time (symbol, entry_time),
  INDEX idx_entry_time (entry_time DESC),
  INDEX idx_symbol (symbol),
  INDEX idx_pnl (pnl)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='V3交易历史记录表';

-- =======================
-- 3. 分批建仓订单表
-- =======================
CREATE TABLE IF NOT EXISTS v3_staged_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  parent_trade_id INT NOT NULL COMMENT '关联simulation_trades.id',
  stage INT NOT NULL COMMENT '第几批: 1=首仓, 2=补仓',
  symbol VARCHAR(20) NOT NULL COMMENT '交易对符号',
  side ENUM('LONG', 'SHORT') NOT NULL COMMENT '交易方向',
  size DECIMAL(20,8) NOT NULL COMMENT '订单数量',
  entry_price DECIMAL(20,8) NOT NULL COMMENT '入场价格',
  status ENUM('PENDING', 'FILLED', 'CANCELLED') DEFAULT 'PENDING' COMMENT '订单状态',
  filled_at TIMESTAMP NULL DEFAULT NULL COMMENT '成交时间',
  stop_loss DECIMAL(20,8) DEFAULT NULL COMMENT '止损价格',
  take_profit DECIMAL(20,8) DEFAULT NULL COMMENT '止盈价格',
  notes TEXT DEFAULT NULL COMMENT '备注',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_parent_trade (parent_trade_id),
  INDEX idx_symbol_status (symbol, status),
  INDEX idx_stage (stage),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='V3分批建仓订单表';

-- =======================
-- 4. 扩展simulation_trades表
-- =======================
-- 检查列是否存在，不存在则添加
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = 'trading_system' 
   AND TABLE_NAME = 'simulation_trades' 
   AND COLUMN_NAME = 'entry_mode') = 0,
  'ALTER TABLE simulation_trades ADD COLUMN entry_mode VARCHAR(20) DEFAULT NULL COMMENT ''入场模式: breakout/pullback/momentum'';',
  'SELECT ''Column entry_mode already exists'' AS result;'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = 'trading_system' 
   AND TABLE_NAME = 'simulation_trades' 
   AND COLUMN_NAME = 'confirmation_details') = 0,
  'ALTER TABLE simulation_trades ADD COLUMN confirmation_details JSON DEFAULT NULL COMMENT ''确认详情: {volOk, deltaOk, earlyOk, smartOk}'';',
  'SELECT ''Column confirmation_details already exists'' AS result;'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = 'trading_system' 
   AND TABLE_NAME = 'simulation_trades' 
   AND COLUMN_NAME = 'staged_entry') = 0,
  'ALTER TABLE simulation_trades ADD COLUMN staged_entry BOOLEAN DEFAULT FALSE COMMENT ''是否分批入场'';',
  'SELECT ''Column staged_entry already exists'' AS result;'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = 'trading_system' 
   AND TABLE_NAME = 'simulation_trades' 
   AND COLUMN_NAME = 'stage_count') = 0,
  'ALTER TABLE simulation_trades ADD COLUMN stage_count INT DEFAULT 1 COMMENT ''分批数量'';',
  'SELECT ''Column stage_count already exists'' AS result;'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = 'trading_system' 
   AND TABLE_NAME = 'simulation_trades' 
   AND COLUMN_NAME = 'breakout_multiplier') = 0,
  'ALTER TABLE simulation_trades ADD COLUMN breakout_multiplier DECIMAL(5,2) DEFAULT NULL COMMENT ''突破止损倍数'';',
  'SELECT ''Column breakout_multiplier already exists'' AS result;'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = 'trading_system' 
   AND TABLE_NAME = 'simulation_trades' 
   AND COLUMN_NAME = 'pullback_multiplier') = 0,
  'ALTER TABLE simulation_trades ADD COLUMN pullback_multiplier DECIMAL(5,2) DEFAULT NULL COMMENT ''回撤止损倍数'';',
  'SELECT ''Column pullback_multiplier already exists'' AS result;'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = 'trading_system' 
   AND TABLE_NAME = 'simulation_trades' 
   AND COLUMN_NAME = 'recent_winrate') = 0,
  'ALTER TABLE simulation_trades ADD COLUMN recent_winrate DECIMAL(5,2) DEFAULT NULL COMMENT ''入场时最近胜率'';',
  'SELECT ''Column recent_winrate already exists'' AS result;'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = 'trading_system' 
   AND TABLE_NAME = 'simulation_trades' 
   AND COLUMN_NAME = 'winrate_throttle_active') = 0,
  'ALTER TABLE simulation_trades ADD COLUMN winrate_throttle_active BOOLEAN DEFAULT FALSE COMMENT ''胜率保护是否激活'';',
  'SELECT ''Column winrate_throttle_active already exists'' AS result;'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =======================
-- 5. 插入V3.1-Plus策略参数
-- =======================
INSERT INTO strategy_params (strategy_name, param_key, param_value, param_type, description) VALUES
-- 入场确认参数
('V3.1-PLUS', 'confirmation_wait', '1', 'NUMBER', '突破确认等待(15M根数)'),
('V3.1-PLUS', 'vol_factor', '1.2', 'NUMBER', '成交量确认倍数'),
('V3.1-PLUS', 'delta_threshold', '0.04', 'NUMBER', 'Delta阈值'),
('V3.1-PLUS', 'pullback_first_leg_ratio', '0.5', 'NUMBER', 'Pullback首仓比例'),
('V3.1-PLUS', 'confirm_count_min', '2', 'NUMBER', '最少确认项数'),

-- 动态止损参数（优化版）
('V3.1-PLUS', 'k_entry_high', '1.4', 'NUMBER', 'High置信度止损ATR倍数'),
('V3.1-PLUS', 'k_entry_med', '2.0', 'NUMBER', 'Med置信度止损ATR倍数'),
('V3.1-PLUS', 'k_entry_low', '3.0', 'NUMBER', 'Low置信度止损ATR倍数'),
('V3.1-PLUS', 'breakout_multiplier', '1.25', 'NUMBER', '突破模式止损倍数'),
('V3.1-PLUS', 'pullback_multiplier', '0.9', 'NUMBER', '回撤模式止损倍数'),
('V3.1-PLUS', 'trail_step', '0.4', 'NUMBER', '追踪止盈步长(ATR倍数)'),
('V3.1-PLUS', 'tp_factor', '2.0', 'NUMBER', '止盈倍数因子'),

-- 冷却与频率控制
('V3.1-PLUS', 'cooldown_minutes', '45', 'NUMBER', '冷却时间(分钟)'),
('V3.1-PLUS', 'max_daily_trades', '6', 'NUMBER', '每日最大交易次数'),
('V3.1-PLUS', 'recent_window', '12', 'NUMBER', '胜率跟踪窗口(笔数)'),
('V3.1-PLUS', 'winrate_threshold', '0.30', 'NUMBER', '胜率保护阈值'),
('V3.1-PLUS', 'winrate_score_penalty', '10', 'NUMBER', '胜率保护分数惩罚'),
('V3.1-PLUS', 'winrate_size_reduction', '0.5', 'NUMBER', '胜率保护仓位缩减'),
('V3.1-PLUS', 'time_stop_base', '60', 'NUMBER', '时间止损基准(分钟)'),
('V3.1-PLUS', 'time_stop_extended', '120', 'NUMBER', '时间止损延长(分钟)'),

-- Pullback检测参数
('V3.1-PLUS', 'pullback_retrace_pct', '0.015', 'NUMBER', 'Pullback回撤百分比(1.5%)'),
('V3.1-PLUS', 'pullback_ema20_required', 'true', 'BOOLEAN', 'Pullback是否要求在EMA20上方'),

-- SmartMoney过滤参数
('V3.1-PLUS', 'smart_money_weight', '0.6', 'NUMBER', 'SmartMoney最低分数要求'),
('V3.1-PLUS', 'smart_money_required', 'false', 'BOOLEAN', 'SmartMoney是否必需')

ON DUPLICATE KEY UPDATE
    param_value = VALUES(param_value),
    updated_at = CURRENT_TIMESTAMP;

-- =======================
-- 6. 创建胜率统计视图
-- =======================
CREATE OR REPLACE VIEW v3_winrate_summary AS
SELECT 
    symbol,
    COUNT(*) as total_trades,
    SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as win_count,
    ROUND(SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as win_rate,
    ROUND(AVG(pnl), 2) as avg_pnl,
    ROUND(SUM(pnl), 2) as total_pnl,
    ROUND(AVG(CASE WHEN pnl > 0 THEN pnl END), 2) as avg_win,
    ROUND(AVG(CASE WHEN pnl < 0 THEN pnl END), 2) as avg_loss,
    ROUND(AVG(CASE WHEN pnl > 0 THEN pnl END) / ABS(AVG(CASE WHEN pnl < 0 THEN pnl END)), 2) as reward_risk_ratio,
    MAX(entry_time) as last_trade_time
FROM v3_trade_history
WHERE exit_time IS NOT NULL
GROUP BY symbol
ORDER BY win_rate DESC;

-- =======================
-- 7. 创建存储过程：检查冷却状态
-- =======================
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS CheckV3Cooldown(
    IN p_symbol VARCHAR(20),
    IN p_cooldown_minutes INT,
    IN p_max_daily_trades INT
)
BEGIN
    DECLARE v_last_entry_time BIGINT;
    DECLARE v_daily_count INT;
    DECLARE v_last_reset_date DATE;
    DECLARE v_now_ts BIGINT;
    DECLARE v_today DATE;
    DECLARE v_can_enter BOOLEAN;
    DECLARE v_reason VARCHAR(100);
    
    SET v_now_ts = UNIX_TIMESTAMP() * 1000;
    SET v_today = CURDATE();
    
    -- 获取冷却信息
    SELECT last_entry_time, daily_trade_count, last_reset_date
    INTO v_last_entry_time, v_daily_count, v_last_reset_date
    FROM v3_trade_cooldown
    WHERE symbol = p_symbol;
    
    -- 如果记录不存在，允许入场
    IF v_last_entry_time IS NULL THEN
        SET v_can_enter = TRUE;
        SET v_reason = 'first_entry';
    ELSE
        -- 检查日期是否需要重置
        IF v_last_reset_date <> v_today THEN
            SET v_daily_count = 0;
        END IF;
        
        -- 检查冷却时间
        IF (v_now_ts - v_last_entry_time) / 1000 / 60 < p_cooldown_minutes THEN
            SET v_can_enter = FALSE;
            SET v_reason = 'cooldown_active';
        -- 检查每日交易次数
        ELSEIF v_daily_count >= p_max_daily_trades THEN
            SET v_can_enter = FALSE;
            SET v_reason = 'daily_limit_reached';
        ELSE
            SET v_can_enter = TRUE;
            SET v_reason = 'ok';
        END IF;
    END IF;
    
    -- 返回结果
    SELECT v_can_enter as can_enter, v_reason as reason, v_daily_count as daily_count,
           ROUND((v_now_ts - COALESCE(v_last_entry_time, 0)) / 1000 / 60, 1) as minutes_since_last;
END //
DELIMITER ;

-- =======================
-- 8. 创建存储过程：更新冷却状态
-- =======================
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS UpdateV3Cooldown(
    IN p_symbol VARCHAR(20)
)
BEGIN
    DECLARE v_now_ts BIGINT;
    DECLARE v_today DATE;
    DECLARE v_last_reset_date DATE;
    DECLARE v_daily_count INT;
    
    SET v_now_ts = UNIX_TIMESTAMP() * 1000;
    SET v_today = CURDATE();
    
    -- 获取现有记录
    SELECT last_reset_date, daily_trade_count
    INTO v_last_reset_date, v_daily_count
    FROM v3_trade_cooldown
    WHERE symbol = p_symbol;
    
    -- 检查是否需要重置每日计数
    IF v_last_reset_date IS NULL OR v_last_reset_date <> v_today THEN
        SET v_daily_count = 1;
        SET v_last_reset_date = v_today;
    ELSE
        SET v_daily_count = v_daily_count + 1;
    END IF;
    
    -- 插入或更新记录
    INSERT INTO v3_trade_cooldown (symbol, last_entry_time, daily_trade_count, last_reset_date)
    VALUES (p_symbol, v_now_ts, v_daily_count, v_last_reset_date)
    ON DUPLICATE KEY UPDATE
        last_entry_time = v_now_ts,
        daily_trade_count = v_daily_count,
        last_reset_date = v_last_reset_date,
        updated_at = CURRENT_TIMESTAMP;
END //
DELIMITER ;

-- =======================
-- 9. 创建存储过程：获取最近胜率
-- =======================
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS GetV3RecentWinRate(
    IN p_symbol VARCHAR(20),
    IN p_window INT
)
BEGIN
    DECLARE v_total INT;
    DECLARE v_wins INT;
    DECLARE v_winrate DECIMAL(5,2);
    
    -- 查询最近N笔已完成交易
    SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins
    INTO v_total, v_wins
    FROM (
        SELECT pnl
        FROM v3_trade_history
        WHERE symbol = p_symbol AND exit_time IS NOT NULL
        ORDER BY exit_time DESC
        LIMIT p_window
    ) recent;
    
    -- 计算胜率
    IF v_total > 0 THEN
        SET v_winrate = (v_wins * 100.0) / v_total;
    ELSE
        SET v_winrate = NULL;
    END IF;
    
    -- 返回结果
    SELECT v_total as trade_count, v_wins as win_count, v_winrate as win_rate;
END //
DELIMITER ;

-- =======================
-- 10. 创建清理任务（删除30天前的历史数据）
-- =======================
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS CleanV3History()
BEGIN
    DELETE FROM v3_trade_history 
    WHERE entry_time < DATE_SUB(NOW(), INTERVAL 30 DAY);
    
    SELECT ROW_COUNT() as deleted_rows;
END //
DELIMITER ;

-- =======================
-- 显示执行结果
-- =======================
SELECT 'V3.1-Plus optimization schema created successfully!' as status;
SELECT COUNT(*) as v3_plus_params_count FROM strategy_params WHERE strategy_name = 'V3.1-PLUS';
SELECT 'Tables created: v3_trade_cooldown, v3_trade_history, v3_staged_orders' as tables;
SELECT 'Extended: simulation_trades with 8 new columns' as extended_tables;
SELECT 'Stored procedures: CheckV3Cooldown, UpdateV3Cooldown, GetV3RecentWinRate, CleanV3History' as procedures;


