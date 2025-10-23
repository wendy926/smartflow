-- 策略参数化调优 - 基础数据库扩展
-- 扩展现有 strategy_params 表，支持激进/保守/平衡三种策略模式

USE trading_system;

-- 扩展 strategy_params 表
ALTER TABLE strategy_params
ADD COLUMN strategy_name VARCHAR(20) DEFAULT 'ICT' COMMENT '策略名称',
ADD COLUMN strategy_mode ENUM('AGGRESSIVE', 'CONSERVATIVE', 'BALANCED') DEFAULT 'BALANCED' COMMENT '策略模式',
ADD COLUMN param_group VARCHAR(50) DEFAULT 'general' COMMENT '参数分组',
ADD COLUMN unit VARCHAR(20) COMMENT '参数单位',
ADD COLUMN min_value VARCHAR(50) COMMENT '最小值',
ADD COLUMN max_value VARCHAR(50) COMMENT '最大值';

-- 添加索引
CREATE INDEX idx_strategy_mode ON strategy_params(strategy_name, strategy_mode);
CREATE INDEX idx_param_group ON strategy_params(param_group);

-- 创建参数历史表
CREATE TABLE IF NOT EXISTS strategy_parameter_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    strategy_name VARCHAR(20) NOT NULL COMMENT '策略名称',
    strategy_mode VARCHAR(20) NOT NULL COMMENT '策略模式',
    param_group VARCHAR(50) NOT NULL COMMENT '参数分组',
    param_name VARCHAR(50) NOT NULL COMMENT '参数名称',
    old_value VARCHAR(100) COMMENT '旧值',
    new_value VARCHAR(100) COMMENT '新值',
    changed_by VARCHAR(50) COMMENT '修改人',
    reason TEXT COMMENT '修改原因',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_strategy (strategy_name, strategy_mode),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='策略参数历史表';

-- 创建参数回测结果表
CREATE TABLE IF NOT EXISTS strategy_parameter_backtest_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    strategy_name VARCHAR(20) NOT NULL COMMENT '策略名称',
    strategy_mode VARCHAR(20) NOT NULL COMMENT '策略模式',
    backtest_period VARCHAR(20) NOT NULL COMMENT '回测周期',
    total_trades INT DEFAULT 0 COMMENT '总交易数',
    winning_trades INT DEFAULT 0 COMMENT '盈利交易数',
    losing_trades INT DEFAULT 0 COMMENT '亏损交易数',
    win_rate DECIMAL(5, 4) DEFAULT 0.0000 COMMENT '胜率',
    total_pnl DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '总盈亏',
    avg_win DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '平均盈利',
    avg_loss DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '平均亏损',
    max_drawdown DECIMAL(10, 4) DEFAULT 0.0000 COMMENT '最大回撤',
    sharpe_ratio DECIMAL(10, 4) DEFAULT 0.0000 COMMENT '夏普比率',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_strategy (strategy_name, strategy_mode),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='策略参数回测结果表';

SELECT 'Strategy parameterization base schema created successfully!' AS status;

