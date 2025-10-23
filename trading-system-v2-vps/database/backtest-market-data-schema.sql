-- 回测市场数据表
-- 用于存储180天历史K线数据

USE trading_system;

-- 创建回测市场数据表
CREATE TABLE IF NOT EXISTS backtest_market_data (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL COMMENT '交易对',
    timeframe VARCHAR(10) NOT NULL COMMENT '时间周期',
    open_time TIMESTAMP NOT NULL COMMENT '开盘时间',
    close_time TIMESTAMP NOT NULL COMMENT '收盘时间',
    open_price DECIMAL(20, 8) NOT NULL COMMENT '开盘价',
    high_price DECIMAL(20, 8) NOT NULL COMMENT '最高价',
    low_price DECIMAL(20, 8) NOT NULL COMMENT '最低价',
    close_price DECIMAL(20, 8) NOT NULL COMMENT '收盘价',
    volume DECIMAL(20, 8) NOT NULL COMMENT '成交量',
    quote_volume DECIMAL(20, 8) NOT NULL COMMENT '成交额',
    trade_count INT NOT NULL COMMENT '成交笔数',
    taker_buy_volume DECIMAL(20, 8) NOT NULL COMMENT '主动买入成交量',
    taker_buy_quote_volume DECIMAL(20, 8) NOT NULL COMMENT '主动买入成交额',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE KEY uk_symbol_timeframe_time (symbol, timeframe, open_time),
    INDEX idx_symbol (symbol),
    INDEX idx_timeframe (timeframe),
    INDEX idx_open_time (open_time),
    INDEX idx_symbol_timeframe (symbol, timeframe)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='回测市场数据表';

SELECT 'Backtest market data table created successfully!' AS status;
