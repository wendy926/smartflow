-- 美股交易系统数据库表结构

-- 1. 美股市场数据表
CREATE TABLE IF NOT EXISTS us_stock_market_data (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    symbol VARCHAR(20) NOT NULL COMMENT '股票代码',
    timeframe VARCHAR(10) NOT NULL COMMENT '时间框架',
    timestamp TIMESTAMP NOT NULL COMMENT '时间戳',
    open DECIMAL(18, 8) NOT NULL COMMENT '开盘价',
    high DECIMAL(18, 8) NOT NULL COMMENT '最高价',
    low DECIMAL(18, 8) NOT NULL COMMENT '最低价',
    close DECIMAL(18, 8) NOT NULL COMMENT '收盘价',
    volume BIGINT NOT NULL COMMENT '成交量',
    
    UNIQUE KEY uk_symbol_timeframe_timestamp (symbol, timeframe, timestamp),
    INDEX idx_symbol (symbol),
    INDEX idx_timestamp (timestamp),
    INDEX idx_timeframe (timeframe)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='美股市场数据表';

-- 2. 美股模拟交易记录表
CREATE TABLE IF NOT EXISTS us_stock_trades (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id VARCHAR(50) NOT NULL UNIQUE COMMENT '订单ID',
    symbol VARCHAR(20) NOT NULL COMMENT '股票代码',
    side ENUM('BUY', 'SELL') NOT NULL COMMENT '方向',
    type ENUM('MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT') NOT NULL COMMENT '订单类型',
    quantity DECIMAL(18, 8) NOT NULL COMMENT '数量',
    price DECIMAL(18, 8) COMMENT '订单价格',
    stop_price DECIMAL(18, 8) COMMENT '止损价格',
    status ENUM('PENDING', 'FILLED', 'CANCELLED', 'REJECTED') NOT NULL DEFAULT 'PENDING' COMMENT '状态',
    filled_quantity DECIMAL(18, 8) COMMENT '成交数量',
    avg_fill_price DECIMAL(18, 8) COMMENT '平均成交价',
    
    -- PnL计算
    entry_price DECIMAL(18, 8) COMMENT '入场价格',
    exit_price DECIMAL(18, 8) COMMENT '出场价格',
    realized_pnl DECIMAL(18, 8) DEFAULT 0 COMMENT '实现盈亏',
    unrealized_pnl DECIMAL(18, 8) DEFAULT 0 COMMENT '未实现盈亏',
    
    -- 策略信息
    strategy_name VARCHAR(50) NOT NULL COMMENT '策略名称',
    strategy_mode VARCHAR(20) DEFAULT 'BALANCED' COMMENT '策略模式',
    stop_loss DECIMAL(18, 8) COMMENT '止损价',
    take_profit DECIMAL(18, 8) COMMENT '止盈价',
    
    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    filled_at TIMESTAMP NULL COMMENT '成交时间',
    closed_at TIMESTAMP NULL COMMENT '平仓时间',
    
    INDEX idx_symbol (symbol),
    INDEX idx_status (status),
    INDEX idx_strategy (strategy_name),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='美股模拟交易记录表';

-- 3. 美股回测结果表
CREATE TABLE IF NOT EXISTS us_stock_backtest_results (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    strategy_name VARCHAR(50) NOT NULL COMMENT '策略名称',
    strategy_mode VARCHAR(20) NOT NULL DEFAULT 'BALANCED' COMMENT '策略模式',
    symbol VARCHAR(20) NOT NULL COMMENT '股票代码',
    start_date DATE NOT NULL COMMENT '开始日期',
    end_date DATE NOT NULL COMMENT '结束日期',
    
    -- 交易统计
    total_trades INT NOT NULL DEFAULT 0 COMMENT '总交易次数',
    winning_trades INT NOT NULL DEFAULT 0 COMMENT '盈利次数',
    losing_trades INT NOT NULL DEFAULT 0 COMMENT '亏损次数',
    win_rate DECIMAL(5, 2) NOT NULL DEFAULT 0 COMMENT '胜率',
    
    -- 盈亏统计
    total_profit DECIMAL(18, 8) DEFAULT 0 COMMENT '总盈利',
    total_loss DECIMAL(18, 8) DEFAULT 0 COMMENT '总亏损',
    net_pnl DECIMAL(18, 8) NOT NULL DEFAULT 0 COMMENT '净利润',
    
    -- 风险指标
    max_drawdown DECIMAL(18, 8) DEFAULT 0 COMMENT '最大回撤',
    sharpe_ratio DECIMAL(10, 4) DEFAULT 0 COMMENT '夏普比率',
    profit_factor DECIMAL(10, 4) DEFAULT 0 COMMENT '盈亏比',
    
    -- 平均指标
    avg_win DECIMAL(18, 8) DEFAULT 0 COMMENT '平均盈利',
    avg_loss DECIMAL(18, 8) DEFAULT 0 COMMENT '平均亏损',
    avg_holding_period DECIMAL(10, 2) DEFAULT 0 COMMENT '平均持仓天数',
    
    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    INDEX idx_strategy (strategy_name),
    INDEX idx_symbol (symbol),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='美股回测结果表';

-- 4. 美股策略参数表（如果不存在则创建）
CREATE TABLE IF NOT EXISTS us_stock_strategy_params (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    strategy_name VARCHAR(50) NOT NULL COMMENT '策略名称',
    strategy_mode VARCHAR(20) NOT NULL COMMENT '策略模式',
    param_name VARCHAR(50) NOT NULL COMMENT '参数名称',
    param_value VARCHAR(255) NOT NULL COMMENT '参数值',
    param_type VARCHAR(20) DEFAULT 'string' COMMENT '参数类型',
    description VARCHAR(255) COMMENT '参数描述',
    
    UNIQUE KEY uk_strategy_mode_param (strategy_name, strategy_mode, param_name),
    INDEX idx_strategy (strategy_name),
    INDEX idx_mode (strategy_mode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='美股策略参数表';

