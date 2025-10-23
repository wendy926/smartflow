-- ICT 策略优化 V2.0 数据库迁移脚本

USE trading_system;

-- 阶段 1：扩展 simulation_trades 表

ALTER TABLE simulation_trades 
ADD COLUMN take_profit_1 DECIMAL(20, 8) DEFAULT NULL,
ADD COLUMN take_profit_2 DECIMAL(20, 8) DEFAULT NULL,
ADD COLUMN tp1_quantity DECIMAL(20, 8) DEFAULT NULL,
ADD COLUMN tp2_quantity DECIMAL(20, 8) DEFAULT NULL,
ADD COLUMN tp1_filled BOOLEAN DEFAULT FALSE,
ADD COLUMN tp2_filled BOOLEAN DEFAULT FALSE,
ADD COLUMN breakeven_price DECIMAL(20, 8) DEFAULT NULL,
ADD COLUMN breakeven_triggered BOOLEAN DEFAULT FALSE,
ADD COLUMN trailing_stop_price DECIMAL(20, 8) DEFAULT NULL,
ADD COLUMN trailing_stop_active BOOLEAN DEFAULT FALSE,
ADD COLUMN max_holding_hours INT DEFAULT 48,
ADD COLUMN time_stop_triggered BOOLEAN DEFAULT FALSE,
ADD COLUMN time_stop_exit_pct DECIMAL(5, 4) DEFAULT 0.5000,
ADD COLUMN risk_cash DECIMAL(20, 8) DEFAULT NULL,
ADD COLUMN stop_distance DECIMAL(20, 8) DEFAULT NULL,
ADD COLUMN risk_reward_ratio DECIMAL(10, 4) DEFAULT NULL,
ADD COLUMN atr_multiplier DECIMAL(5, 3) DEFAULT 1.500,
ADD COLUMN position_management_mode VARCHAR(20) DEFAULT 'SIMPLE',
ADD COLUMN remaining_quantity DECIMAL(20, 8) DEFAULT NULL,
ADD COLUMN realized_pnl DECIMAL(20, 8) DEFAULT 0.00000000,
ADD COLUMN unrealized_pnl DECIMAL(20, 8) DEFAULT 0.00000000,
ADD COLUMN confidence_score DECIMAL(5, 4) DEFAULT 0.0000,
ADD COLUMN multi_timeframe_aligned BOOLEAN DEFAULT TRUE;

CREATE INDEX idx_tp1_filled ON simulation_trades(tp1_filled);
CREATE INDEX idx_tp2_filled ON simulation_trades(tp2_filled);
CREATE INDEX idx_time_stop ON simulation_trades(time_stop_triggered);
CREATE INDEX idx_breakeven ON simulation_trades(breakeven_triggered);
CREATE INDEX idx_trailing_stop ON simulation_trades(trailing_stop_active);
CREATE INDEX idx_confidence ON simulation_trades(confidence_score);

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

UPDATE simulation_trades 
SET stop_distance = ABS(entry_price - stop_loss)
WHERE strategy_name = 'ICT' 
  AND status = 'OPEN' 
  AND stop_loss IS NOT NULL;

-- 阶段 2：新建辅助表

CREATE TABLE ict_position_management (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    trade_id BIGINT NOT NULL,
    symbol_id INT NOT NULL,
    current_price DECIMAL(20, 8) NOT NULL,
    remaining_qty DECIMAL(20, 8) NOT NULL,
    realized_pnl DECIMAL(20, 8) DEFAULT 0.00000000,
    unrealized_pnl DECIMAL(20, 8) DEFAULT 0.00000000,
    tp1_filled BOOLEAN DEFAULT FALSE,
    tp2_filled BOOLEAN DEFAULT FALSE,
    breakeven_triggered BOOLEAN DEFAULT FALSE,
    trailing_stop_active BOOLEAN DEFAULT FALSE,
    trailing_stop_price DECIMAL(20, 8) DEFAULT NULL,
    time_elapsed_hours DECIMAL(10, 2) DEFAULT 0.00,
    time_stop_triggered BOOLEAN DEFAULT FALSE,
    last_update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_trade_id (trade_id),
    INDEX idx_symbol_id (symbol_id),
    INDEX idx_last_update (last_update_time),
    FOREIGN KEY (trade_id) REFERENCES simulation_trades(id) ON DELETE CASCADE,
    FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ict_partial_closes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    trade_id BIGINT NOT NULL,
    symbol_id INT NOT NULL,
    close_type ENUM('TP1', 'TP2', 'TIME_STOP', 'TRAILING_STOP', 'BREAKEVEN', 'MANUAL') NOT NULL,
    close_price DECIMAL(20, 8) NOT NULL,
    close_quantity DECIMAL(20, 8) NOT NULL,
    close_pct DECIMAL(5, 4) NOT NULL,
    realized_pnl DECIMAL(20, 8) DEFAULT 0.00000000,
    realized_pnl_pct DECIMAL(10, 4) DEFAULT 0.0000,
    remaining_qty DECIMAL(20, 8) NOT NULL,
    close_reason TEXT DEFAULT NULL,
    close_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_trade_id (trade_id),
    INDEX idx_symbol_id (symbol_id),
    INDEX idx_close_type (close_type),
    INDEX idx_close_time (close_time),
    FOREIGN KEY (trade_id) REFERENCES simulation_trades(id) ON DELETE CASCADE,
    FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ict_strategy_stats (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    symbol_id INT NOT NULL,
    total_trades INT DEFAULT 0,
    winning_trades INT DEFAULT 0,
    losing_trades INT DEFAULT 0,
    win_rate DECIMAL(5, 4) DEFAULT 0.0000,
    total_pnl DECIMAL(20, 8) DEFAULT 0.00000000,
    avg_win DECIMAL(20, 8) DEFAULT 0.00000000,
    avg_loss DECIMAL(20, 8) DEFAULT 0.00000000,
    avg_rr_ratio DECIMAL(10, 4) DEFAULT 0.0000,
    max_drawdown DECIMAL(10, 4) DEFAULT 0.0000,
    avg_holding_hours DECIMAL(10, 2) DEFAULT 0.00,
    tp1_hit_rate DECIMAL(5, 4) DEFAULT 0.0000,
    tp2_hit_rate DECIMAL(5, 4) DEFAULT 0.0000,
    time_stop_rate DECIMAL(5, 4) DEFAULT 0.0000,
    breakeven_rate DECIMAL(5, 4) DEFAULT 0.0000,
    trailing_stop_rate DECIMAL(5, 4) DEFAULT 0.0000,
    last_update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_symbol_id (symbol_id),
    INDEX idx_last_update (last_update_time),
    FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 阶段 3：数据迁移

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

-- 阶段 4：验证

SELECT 'Migration completed!' AS status;
