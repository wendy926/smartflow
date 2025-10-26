-- A股数据库表结构
-- 专注于指数交易，不进行真实交易

-- A股市场数据表
CREATE TABLE IF NOT EXISTS cn_stock_market_data (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    ts_code VARCHAR(20) NOT NULL COMMENT '指数代码',
    trade_date DATE NOT NULL COMMENT '交易日期',
    timeframe VARCHAR(10) NOT NULL COMMENT '时间框架',
    open DECIMAL(20, 4) NOT NULL COMMENT '开盘价',
    high DECIMAL(20, 4) NOT NULL COMMENT '最高价',
    low DECIMAL(20, 4) NOT NULL COMMENT '最低价',
    close DECIMAL(20, 4) NOT NULL COMMENT '收盘价',
    volume DECIMAL(20, 4) DEFAULT 0 COMMENT '成交量',
    amount DECIMAL(20, 4) DEFAULT 0 COMMENT '成交额',
    pre_close DECIMAL(20, 4) DEFAULT NULL COMMENT '昨收',
    change_pct DECIMAL(10, 4) DEFAULT NULL COMMENT '涨跌幅',
    pb DECIMAL(10, 4) DEFAULT NULL COMMENT '市净率',
    pe DECIMAL(10, 4) DEFAULT NULL COMMENT '市盈率',
    total_mv DECIMAL(20, 4) DEFAULT NULL COMMENT '总市值',
    float_mv DECIMAL(20, 4) DEFAULT NULL COMMENT '流通市值',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_code_date (ts_code, trade_date),
    INDEX idx_timeframe (timeframe),
    INDEX idx_date (trade_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='A股市场数据表';

-- A股模拟交易表
CREATE TABLE IF NOT EXISTS cn_stock_simulation_trades (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    trade_id VARCHAR(100) NOT NULL UNIQUE COMMENT '交易ID',
    ts_code VARCHAR(20) NOT NULL COMMENT '指数代码',
    index_name VARCHAR(50) DEFAULT NULL COMMENT '指数名称',
    strategy_type VARCHAR(50) NOT NULL COMMENT '策略类型',
    entry_time DATETIME NOT NULL COMMENT '入场时间',
    entry_price DECIMAL(20, 4) NOT NULL COMMENT '入场价格',
    entry_quantity DECIMAL(20, 8) NOT NULL COMMENT '入场数量',
    entry_value DECIMAL(20, 4) NOT NULL COMMENT '入场金额',
    exit_time DATETIME DEFAULT NULL COMMENT '出场时间',
    exit_price DECIMAL(20, 4) DEFAULT NULL COMMENT '出场价格',
    exit_quantity DECIMAL(20, 8) DEFAULT NULL COMMENT '出场数量',
    exit_value DECIMAL(20, 4) DEFAULT NULL COMMENT '出场金额',
    trade_type ENUM('LONG', 'SHORT') NOT NULL COMMENT '交易类型',
    trade_status ENUM('OPEN', 'CLOSED', 'CANCELLED') DEFAULT 'OPEN' COMMENT '交易状态',
    raw_pnl DECIMAL(20, 4) DEFAULT 0 COMMENT '原始盈亏',
    net_pnl DECIMAL(20, 4) DEFAULT 0 COMMENT '净盈亏',
    commission DECIMAL(20, 4) DEFAULT 0 COMMENT '手续费',
    stop_loss DECIMAL(20, 4) DEFAULT NULL COMMENT '止损价',
    take_profit DECIMAL(20, 4) DEFAULT NULL COMMENT '止盈价',
    leverage INT DEFAULT 1 COMMENT '杠杆倍数',
    margin_used DECIMAL(20, 4) DEFAULT NULL COMMENT '使用保证金',
    duration_hours INT DEFAULT NULL COMMENT '持仓时长（小时）',
    exit_reason VARCHAR(200) DEFAULT NULL COMMENT '出场原因',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_code (ts_code),
    INDEX idx_status (trade_status),
    INDEX idx_entry_time (entry_time),
    INDEX idx_strategy (strategy_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='A股模拟交易表';

-- A股回测结果表
CREATE TABLE IF NOT EXISTS cn_stock_backtest_results (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    strategy_type VARCHAR(50) NOT NULL COMMENT '策略类型',
    index_code VARCHAR(20) NOT NULL COMMENT '指数代码',
    index_name VARCHAR(50) DEFAULT NULL COMMENT '指数名称',
    start_date DATE NOT NULL COMMENT '开始日期',
    end_date DATE NOT NULL COMMENT '结束日期',
    timeframes VARCHAR(200) NOT NULL COMMENT '时间框架',
    total_trades INT DEFAULT 0 COMMENT '总交易次数',
    winning_trades INT DEFAULT 0 COMMENT '盈利交易次数',
    losing_trades INT DEFAULT 0 COMMENT '亏损交易次数',
    win_rate DECIMAL(10, 4) DEFAULT 0 COMMENT '胜率',
    total_pnl DECIMAL(20, 4) DEFAULT 0 COMMENT '总盈亏',
    total_profit DECIMAL(20, 4) DEFAULT 0 COMMENT '总盈利',
    total_loss DECIMAL(20, 4) DEFAULT 0 COMMENT '总亏损',
    profit_loss_ratio DECIMAL(10, 4) DEFAULT 0 COMMENT '盈亏比',
    average_win DECIMAL(20, 4) DEFAULT 0 COMMENT '平均盈利',
    average_loss DECIMAL(20, 4) DEFAULT 0 COMMENT '平均亏损',
    largest_win DECIMAL(20, 4) DEFAULT 0 COMMENT '最大盈利',
    largest_loss DECIMAL(20, 4) DEFAULT 0 COMMENT '最大亏损',
    sharpe_ratio DECIMAL(10, 4) DEFAULT NULL COMMENT '夏普比率',
    max_drawdown DECIMAL(10, 4) DEFAULT NULL COMMENT '最大回撤',
    max_drawdown_pct DECIMAL(10, 4) DEFAULT NULL COMMENT '最大回撤百分比',
    trading_days INT DEFAULT 0 COMMENT '交易天数',
    return_rate DECIMAL(10, 4) DEFAULT 0 COMMENT '收益率',
    total_commission DECIMAL(20, 4) DEFAULT 0 COMMENT '总手续费',
    total_funding_rate DECIMAL(20, 4) DEFAULT 0 COMMENT '总资金费率',
    backtest_duration_seconds INT DEFAULT NULL COMMENT '回测耗时（秒）',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_strategy (strategy_type),
    INDEX idx_index (index_code),
    INDEX idx_dates (start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='A股回测结果表';

-- A股策略参数表
CREATE TABLE IF NOT EXISTS cn_stock_strategy_params (
    id INT PRIMARY KEY AUTO_INCREMENT,
    strategy_name VARCHAR(50) NOT NULL COMMENT '策略名称',
    index_code VARCHAR(20) NOT NULL COMMENT '指数代码',
    param_name VARCHAR(100) NOT NULL COMMENT '参数名称',
    param_value VARCHAR(200) NOT NULL COMMENT '参数值',
    param_type VARCHAR(50) DEFAULT 'string' COMMENT '参数类型',
    description VARCHAR(500) DEFAULT NULL COMMENT '参数描述',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_strategy_index_param (strategy_name, index_code, param_name),
    INDEX idx_strategy (strategy_name),
    INDEX idx_index (index_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='A股策略参数表';

-- A股指数基本信息表
CREATE TABLE IF NOT EXISTS cn_stock_indices (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ts_code VARCHAR(20) NOT NULL UNIQUE COMMENT '指数代码',
    index_name VARCHAR(100) NOT NULL COMMENT '指数名称',
    market VARCHAR(20) DEFAULT NULL COMMENT '市场',
    publisher VARCHAR(100) DEFAULT NULL COMMENT '发布机构',
    index_type VARCHAR(50) DEFAULT NULL COMMENT '指数类型',
    category VARCHAR(50) DEFAULT NULL COMMENT '分类',
    base_date DATE DEFAULT NULL COMMENT '基准日期',
    base_point DECIMAL(10, 4) DEFAULT NULL COMMENT '基准点数',
    list_date DATE DEFAULT NULL COMMENT '上市日期',
    weight_rule VARCHAR(200) DEFAULT NULL COMMENT '加权规则',
    description TEXT DEFAULT NULL COMMENT '描述',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (index_name),
    INDEX idx_market (market)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='A股指数信息表';

-- 初始化常用指数数据
INSERT IGNORE INTO cn_stock_indices (ts_code, index_name, market, index_type, category) VALUES
('000300.SH', '沪深300', '沪市', '股票指数', '大盘指数'),
('000905.SH', '中证500', '中证', '股票指数', '中小盘指数'),
('000852.SH', '中证1000', '中证', '股票指数', '小盘指数'),
('399001.SZ', '深证成指', '深市', '股票指数', '大盘指数'),
('399006.SZ', '创业板指', '深市', '股票指数', '成长指数'),
('000688.SH', '科创50', '沪市', '股票指数', '科技指数'),
('000016.SH', '上证50', '沪市', '股票指数', '大盘蓝筹'),
('399905.SZ', '中证1000', '深市', '股票指数', '中小盘指数'),
('000017.SH', '新上证综合', '沪市', '综合指数', '综合指数'),
('399300.SZ', '沪深300', '深市', '股票指数', '大盘指数');

