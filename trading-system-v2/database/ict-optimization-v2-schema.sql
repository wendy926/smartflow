-- ICT策略优化 V2.0 数据库表结构
-- 基于 ict-plus-2.0.md 文档的优化方案
-- 目标：解决长时间持仓和胜率高但亏损多的问题

USE trading_system;

-- ============================================
-- 1. 扩展 simulation_trades 表（复用现有表）
-- ============================================

-- 添加 ICT 优化相关字段
ALTER TABLE simulation_trades 
ADD COLUMN IF NOT EXISTS take_profit_1 DECIMAL(20, 8) DEFAULT NULL COMMENT '第一止盈位（TP1）',
ADD COLUMN IF NOT EXISTS take_profit_2 DECIMAL(20, 8) DEFAULT NULL COMMENT '第二止盈位（TP2）',
ADD COLUMN IF NOT EXISTS tp1_quantity DECIMAL(20, 8) DEFAULT NULL COMMENT 'TP1平仓数量',
ADD COLUMN IF NOT EXISTS tp2_quantity DECIMAL(20, 8) DEFAULT NULL COMMENT 'TP2平仓数量',
ADD COLUMN IF NOT EXISTS tp1_filled BOOLEAN DEFAULT FALSE COMMENT 'TP1是否已平仓',
ADD COLUMN IF NOT EXISTS tp2_filled BOOLEAN DEFAULT FALSE COMMENT 'TP2是否已平仓',
ADD COLUMN IF NOT EXISTS breakeven_price DECIMAL(20, 8) DEFAULT NULL COMMENT '保本价格',
ADD COLUMN IF NOT EXISTS breakeven_triggered BOOLEAN DEFAULT FALSE COMMENT '保本是否已触发',
ADD COLUMN IF NOT EXISTS trailing_stop_price DECIMAL(20, 8) DEFAULT NULL COMMENT '追踪止损价格',
ADD COLUMN IF NOT EXISTS trailing_stop_active BOOLEAN DEFAULT FALSE COMMENT '追踪止损是否激活',
ADD COLUMN IF NOT EXISTS max_holding_hours INT DEFAULT 48 COMMENT '最大持仓时长（小时）',
ADD COLUMN IF NOT EXISTS time_stop_triggered BOOLEAN DEFAULT FALSE COMMENT '时间止损是否触发',
ADD COLUMN IF NOT EXISTS time_stop_exit_pct DECIMAL(5, 4) DEFAULT 0.5000 COMMENT '时间止损平仓比例',
ADD COLUMN IF NOT EXISTS risk_cash DECIMAL(20, 8) DEFAULT NULL COMMENT '风险金额（USDT）',
ADD COLUMN IF NOT EXISTS stop_distance DECIMAL(20, 8) DEFAULT NULL COMMENT '止损距离',
ADD COLUMN IF NOT EXISTS risk_reward_ratio DECIMAL(10, 4) DEFAULT NULL COMMENT '风险回报比',
ADD COLUMN IF NOT EXISTS atr_multiplier DECIMAL(5, 3) DEFAULT 1.500 COMMENT 'ATR倍数',
ADD COLUMN IF NOT EXISTS position_management_mode ENUM('SIMPLE', 'LAYERED', 'TRAILING') DEFAULT 'SIMPLE' COMMENT '仓位管理模式',
ADD COLUMN IF NOT EXISTS remaining_quantity DECIMAL(20, 8) DEFAULT NULL COMMENT '剩余数量',
ADD COLUMN IF NOT EXISTS realized_pnl DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '已实现盈亏',
ADD COLUMN IF NOT EXISTS unrealized_pnl DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '未实现盈亏',
ADD COLUMN IF NOT EXISTS entry_reason TEXT DEFAULT NULL COMMENT '入场原因',
ADD COLUMN IF NOT EXISTS exit_reason TEXT DEFAULT NULL COMMENT '出场原因',
ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(5, 4) DEFAULT 0.0000 COMMENT '入场置信度(0-1)',
ADD COLUMN IF NOT EXISTS multi_timeframe_aligned BOOLEAN DEFAULT FALSE COMMENT '多时间框架是否对齐';

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_tp1_filled ON simulation_trades(tp1_filled);
CREATE INDEX IF NOT EXISTS idx_tp2_filled ON simulation_trades(tp2_filled);
CREATE INDEX IF NOT EXISTS idx_time_stop ON simulation_trades(time_stop_triggered);
CREATE INDEX IF NOT EXISTS idx_breakeven ON simulation_trades(breakeven_triggered);
CREATE INDEX IF NOT EXISTS idx_trailing_stop ON simulation_trades(trailing_stop_active);
CREATE INDEX IF NOT EXISTS idx_confidence ON simulation_trades(confidence_score);

-- ============================================
-- 2. ICT 仓位管理状态表（新增）
-- ============================================

CREATE TABLE IF NOT EXISTS ict_position_management (
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

-- ============================================
-- 3. ICT 部分平仓记录表（新增）
-- ============================================

CREATE TABLE IF NOT EXISTS ict_partial_closes (
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

-- ============================================
-- 4. ICT 策略统计表（新增）
-- ============================================

CREATE TABLE IF NOT EXISTS ict_strategy_stats (
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
-- 5. 初始化 ICT 策略统计表
-- ============================================

-- 为所有交易对创建初始统计记录
INSERT INTO ict_strategy_stats (symbol_id, total_trades, winning_trades, losing_trades, win_rate, total_pnl, avg_win, avg_loss, avg_rr_ratio, max_drawdown, avg_holding_hours, tp1_hit_rate, tp2_hit_rate, time_stop_rate, breakeven_rate, trailing_stop_rate)
SELECT 
    id, 
    0, 0, 0, 0.0000, 
    0.00000000, 0.00000000, 0.00000000, 
    0.0000, 0.0000, 0.00, 
    0.0000, 0.0000, 0.0000, 0.0000, 0.0000
FROM symbols
WHERE id NOT IN (SELECT symbol_id FROM ict_strategy_stats)
ON DUPLICATE KEY UPDATE id = id;

-- ============================================
-- 6. 添加注释说明
-- ============================================

-- simulation_trades 表新字段说明：
-- take_profit_1, take_profit_2: 分层止盈位，TP1=2R, TP2=3R
-- tp1_quantity, tp2_quantity: 各止盈位的平仓数量（默认50%）
-- tp1_filled, tp2_filled: 标记各止盈位是否已平仓
-- breakeven_price: 保本价格 = entry + 0.25 * stopDistance
-- breakeven_triggered: 保本是否已触发
-- trailing_stop_price: 追踪止损价格
-- trailing_stop_active: 追踪止损是否激活
-- max_holding_hours: 最大持仓时长（默认48小时）
-- time_stop_triggered: 时间止损是否触发
-- time_stop_exit_pct: 时间止损平仓比例（默认50%）
-- risk_cash: 风险金额 = accountBalance * riskPercent
-- stop_distance: 止损距离 = abs(entry - stop)
-- risk_reward_ratio: 风险回报比
-- atr_multiplier: ATR倍数（默认1.5）
-- position_management_mode: 仓位管理模式（SIMPLE/LAYERED/TRAILING）
-- remaining_quantity: 剩余数量
-- realized_pnl: 已实现盈亏
-- unrealized_pnl: 未实现盈亏
-- entry_reason: 入场原因
-- exit_reason: 出场原因
-- confidence_score: 入场置信度
-- multi_timeframe_aligned: 多时间框架是否对齐

-- ict_position_management 表说明：
-- 实时跟踪每个交易的仓位管理状态
-- 每5分钟更新一次当前价格、剩余数量、已实现/未实现盈亏
-- 跟踪 TP1/TP2 平仓状态、保本触发状态、追踪止损状态
-- 跟踪已持仓时长，判断是否触发时间止损

-- ict_partial_closes 表说明：
-- 记录所有部分平仓操作
-- 包括 TP1、TP2、时间止损、追踪止损、保本、手动平仓
-- 记录平仓价格、数量、比例、盈亏

-- ict_strategy_stats 表说明：
-- 统计 ICT 策略的整体表现
-- 包括胜率、平均盈亏、平均 RR 比、最大回撤
-- 包括 TP1/TP2 命中率、时间止损率、保本触发率、追踪止损触发率

