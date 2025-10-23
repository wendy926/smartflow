-- ICT 策略优化 V2.0 数据库迁移脚本（基础版）
-- 执行前请先备份数据库！

USE trading_system;

-- ============================================
-- 阶段 1：扩展 simulation_trades 表
-- ============================================

-- 1.1 添加分层止盈字段
ALTER TABLE simulation_trades 
ADD COLUMN take_profit_1 DECIMAL(20, 8) DEFAULT NULL COMMENT '第一止盈位（TP1）',
ADD COLUMN take_profit_2 DECIMAL(20, 8) DEFAULT NULL COMMENT '第二止盈位（TP2）',
ADD COLUMN tp1_quantity DECIMAL(20, 8) DEFAULT NULL COMMENT 'TP1平仓数量',
ADD COLUMN tp2_quantity DECIMAL(20, 8) DEFAULT NULL COMMENT 'TP2平仓数量',
ADD COLUMN tp1_filled BOOLEAN DEFAULT FALSE COMMENT 'TP1是否已平仓',
ADD COLUMN tp2_filled BOOLEAN DEFAULT FALSE COMMENT 'TP2是否已平仓';

-- 1.2 添加保本与移动止损字段
ALTER TABLE simulation_trades 
ADD COLUMN breakeven_price DECIMAL(20, 8) DEFAULT NULL COMMENT '保本价格',
ADD COLUMN breakeven_triggered BOOLEAN DEFAULT FALSE COMMENT '保本是否已触发',
ADD COLUMN trailing_stop_price DECIMAL(20, 8) DEFAULT NULL COMMENT '追踪止损价格',
ADD COLUMN trailing_stop_active BOOLEAN DEFAULT FALSE COMMENT '追踪止损是否激活';

-- 1.3 添加时间止损字段
ALTER TABLE simulation_trades 
ADD COLUMN max_holding_hours INT DEFAULT 48 COMMENT '最大持仓时长（小时）',
ADD COLUMN time_stop_triggered BOOLEAN DEFAULT FALSE COMMENT '时间止损是否触发',
ADD COLUMN time_stop_exit_pct DECIMAL(5, 4) DEFAULT 0.5000 COMMENT '时间止损平仓比例';

-- 1.4 添加风险与仓位管理字段
ALTER TABLE simulation_trades 
ADD COLUMN risk_cash DECIMAL(20, 8) DEFAULT NULL COMMENT '风险金额（USDT）',
ADD COLUMN stop_distance DECIMAL(20, 8) DEFAULT NULL COMMENT '止损距离',
ADD COLUMN risk_reward_ratio DECIMAL(10, 4) DEFAULT NULL COMMENT '风险回报比',
ADD COLUMN atr_multiplier DECIMAL(5, 3) DEFAULT 1.500 COMMENT 'ATR倍数',
ADD COLUMN position_management_mode VARCHAR(20) DEFAULT 'SIMPLE' COMMENT '仓位管理模式';

-- 1.5 添加数量与盈亏字段
ALTER TABLE simulation_trades 
ADD COLUMN remaining_quantity DECIMAL(20, 8) DEFAULT NULL COMMENT '剩余数量',
ADD COLUMN realized_pnl DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '已实现盈亏',
ADD COLUMN unrealized_pnl DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '未实现盈亏';

-- 1.6 添加入场与出场字段
ALTER TABLE simulation_trades 
ADD COLUMN confidence_score DECIMAL(5, 4) DEFAULT 0.0000 COMMENT '入场置信度(0-1)',
ADD COLUMN multi_timeframe_aligned BOOLEAN DEFAULT TRUE COMMENT '多时间框架是否对齐';

-- 1.7 添加索引
CREATE INDEX idx_tp1_filled ON simulation_trades(tp1_filled);
CREATE INDEX idx_tp2_filled ON simulation_trades(tp2_filled);
CREATE INDEX idx_time_stop ON simulation_trades(time_stop_triggered);
CREATE INDEX idx_breakeven ON simulation_trades(breakeven_triggered);
CREATE INDEX idx_trailing_stop ON simulation_trades(trailing_stop_active);
CREATE INDEX idx_confidence ON simulation_trades(confidence_score);

-- 1.8 为现有 ICT 交易设置默认值
UPDATE simulation_trades 
SET 
  take_profit_1 = take_profit,
  take_profit_2 = take_profit * 1.5,
  tp1_quantity = quantity * 0.5,
  tp2_quantity = quantity * 0.5,
  tp1_filled = FALSE,
  tp2_filled = FALSE,
  breakeven_price = NULL,
  breakeven_triggered = FALSE,
  trailing_stop_active = FALSE,
  trailing_stop_price = NULL,
  max_holding_hours = 48,
  time_stop_triggered = FALSE,
  time_stop_exit_pct = 0.5,
  risk_cash = margin_used * 0.01,
  stop_distance = entry_price * 0.02,
  risk_reward_ratio = NULL,
  atr_multiplier = 1.5,
  position_management_mode = 'SIMPLE',
  remaining_quantity = quantity,
  realized_pnl = 0,
  unrealized_pnl = 0,
  confidence_score = 0.5,
  multi_timeframe_aligned = TRUE
WHERE strategy_name = 'ICT' AND status = 'OPEN';

-- 为有止损的交易更新 stop_distance
UPDATE simulation_trades 
SET stop_distance = ABS(entry_price - stop_loss)
WHERE strategy_name = 'ICT' 
  AND status = 'OPEN' 
  AND stop_loss IS NOT NULL;

-- ============================================
-- 阶段 2：新建辅助表
-- ============================================

-- 2.1 创建 ICT 仓位管理状态表
CREATE TABLE ict_position_management (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    trade_id BIGINT NOT NULL COMMENT '交易ID',
    symbol_id INT NOT NULL COMMENT '交易对ID',
    current_price DECIMAL(20, 8) NOT NULL COMMENT '当前价格',
    remaining_qty DECIMAL(20, 8) NOT NULL COMMENT '剩余数量',
    realized_pnl DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '已实现盈亏',
    unrealized_pnl DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '未实现盈亏',
    tp1_filled BOOLEAN DEFAULT FALSE COMMENT 'TP1是否已平仓',
    tp2_filled BOOLEAN DEFAULT FALSE COMMENT 'TP2是否已平仓',
    breakeven_triggered BOOLEAN DEFAULT FALSE COMMENT '保本是否已触发',
    trailing_stop_active BOOLEAN DEFAULT FALSE COMMENT '追踪止损是否激活',
    trailing_stop_price DECIMAL(20, 8) DEFAULT NULL COMMENT '追踪止损价格',
    time_elapsed_hours DECIMAL(10, 2) DEFAULT 0.00 COMMENT '已持仓时长（小时）',
    time_stop_triggered BOOLEAN DEFAULT FALSE COMMENT '时间止损是否触发',
    last_update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_trade_id (trade_id),
    INDEX idx_symbol_id (symbol_id),
    INDEX idx_last_update (last_update_time),
    FOREIGN KEY (trade_id) REFERENCES simulation_trades(id) ON DELETE CASCADE,
    FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ICT仓位管理状态表';

-- 2.2 创建 ICT 部分平仓记录表
CREATE TABLE ict_partial_closes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    trade_id BIGINT NOT NULL COMMENT '交易ID',
    symbol_id INT NOT NULL COMMENT '交易对ID',
    close_type ENUM('TP1', 'TP2', 'TIME_STOP', 'TRAILING_STOP', 'BREAKEVEN', 'MANUAL') NOT NULL COMMENT '平仓类型',
    close_price DECIMAL(20, 8) NOT NULL COMMENT '平仓价格',
    close_quantity DECIMAL(20, 8) NOT NULL COMMENT '平仓数量',
    close_pct DECIMAL(5, 4) NOT NULL COMMENT '平仓比例(0-1)',
    realized_pnl DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '已实现盈亏',
    realized_pnl_pct DECIMAL(10, 4) DEFAULT 0.0000 COMMENT '已实现盈亏百分比',
    remaining_qty DECIMAL(20, 8) NOT NULL COMMENT '剩余数量',
    close_reason TEXT DEFAULT NULL COMMENT '平仓原因',
    close_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '平仓时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_trade_id (trade_id),
    INDEX idx_symbol_id (symbol_id),
    INDEX idx_close_type (close_type),
    INDEX idx_close_time (close_time),
    FOREIGN KEY (trade_id) REFERENCES simulation_trades(id) ON DELETE CASCADE,
    FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ICT部分平仓记录表';

-- 2.3 创建 ICT 策略统计表
CREATE TABLE ict_strategy_stats (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    symbol_id INT NOT NULL COMMENT '交易对ID',
    total_trades INT DEFAULT 0 COMMENT '总交易数',
    winning_trades INT DEFAULT 0 COMMENT '盈利交易数',
    losing_trades INT DEFAULT 0 COMMENT '亏损交易数',
    win_rate DECIMAL(5, 4) DEFAULT 0.0000 COMMENT '胜率',
    total_pnl DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '总盈亏',
    avg_win DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '平均盈利',
    avg_loss DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '平均亏损',
    avg_rr_ratio DECIMAL(10, 4) DEFAULT 0.0000 COMMENT '平均风险回报比',
    max_drawdown DECIMAL(10, 4) DEFAULT 0.0000 COMMENT '最大回撤',
    avg_holding_hours DECIMAL(10, 2) DEFAULT 0.00 COMMENT '平均持仓时长（小时）',
    tp1_hit_rate DECIMAL(5, 4) DEFAULT 0.0000 COMMENT 'TP1命中率',
    tp2_hit_rate DECIMAL(5, 4) DEFAULT 0.0000 COMMENT 'TP2命中率',
    time_stop_rate DECIMAL(5, 4) DEFAULT 0.0000 COMMENT '时间止损率',
    breakeven_rate DECIMAL(5, 4) DEFAULT 0.0000 COMMENT '保本触发率',
    trailing_stop_rate DECIMAL(5, 4) DEFAULT 0.0000 COMMENT '追踪止损触发率',
    last_update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_symbol_id (symbol_id),
    INDEX idx_last_update (last_update_time),
    FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ICT策略统计表';

-- ============================================
-- 阶段 3：数据迁移
-- ============================================

-- 3.1 为现有 OPEN 状态的 ICT 交易创建仓位管理记录
INSERT INTO ict_position_management (
    trade_id, symbol_id, current_price, remaining_qty, 
    realized_pnl, unrealized_pnl, tp1_filled, tp2_filled, 
    breakeven_triggered, trailing_stop_active, trailing_stop_price,
    time_elapsed_hours, time_stop_triggered
)
SELECT 
    st.id,
    st.symbol_id,
    st.entry_price,
    st.remaining_quantity,
    st.realized_pnl,
    st.unrealized_pnl,
    st.tp1_filled,
    st.tp2_filled,
    st.breakeven_triggered,
    st.trailing_stop_active,
    st.trailing_stop_price,
    TIMESTAMPDIFF(HOUR, st.entry_time, NOW()),
    st.time_stop_triggered
FROM simulation_trades st
WHERE st.strategy_name = 'ICT' 
  AND st.status = 'OPEN'
  AND NOT EXISTS (
    SELECT 1 FROM ict_position_management ipm 
    WHERE ipm.trade_id = st.id
  );

-- 3.2 为所有交易对创建初始统计记录
INSERT INTO ict_strategy_stats (
    symbol_id, total_trades, winning_trades, losing_trades, 
    win_rate, total_pnl, avg_win, avg_loss, avg_rr_ratio, 
    max_drawdown, avg_holding_hours, tp1_hit_rate, tp2_hit_rate,
    time_stop_rate, breakeven_rate, trailing_stop_rate
)
SELECT 
    s.id,
    0, 0, 0, 0.0000,
    0.00000000, 0.00000000, 0.00000000,
    0.0000, 0.0000, 0.00,
    0.0000, 0.0000, 0.0000, 0.0000, 0.0000
FROM symbols s
WHERE NOT EXISTS (
    SELECT 1 FROM ict_strategy_stats iss 
    WHERE iss.symbol_id = s.id
);

-- ============================================
-- 阶段 4：验证和测试
-- ============================================

-- 4.1 验证字段添加成功
SELECT 
    COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'trading_system'
  AND TABLE_NAME = 'simulation_trades'
  AND COLUMN_NAME IN (
    'take_profit_1', 'take_profit_2', 'tp1_filled', 'tp2_filled',
    'breakeven_price', 'trailing_stop_active', 'max_holding_hours',
    'risk_cash', 'stop_distance', 'remaining_quantity', 'realized_pnl',
    'unrealized_pnl', 'confidence_score', 'position_management_mode'
  )
ORDER BY ORDINAL_POSITION;

-- 4.2 验证表创建成功
SHOW TABLES LIKE 'ict_%';

-- 4.3 验证数据一致性
SELECT 
    'simulation_trades OPEN ICT' AS source,
    COUNT(*) AS count
FROM simulation_trades
WHERE strategy_name = 'ICT' AND status = 'OPEN'
UNION ALL
SELECT 
    'ict_position_management' AS source,
    COUNT(*) AS count
FROM ict_position_management;

-- 4.4 验证索引创建成功
SHOW INDEX FROM simulation_trades WHERE Key_name LIKE 'idx_%';

-- 4.5 显示迁移结果
SELECT 
    'Migration completed successfully!' AS status,
    NOW() AS completed_at;

