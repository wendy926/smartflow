-- 数据库优化方案：支持实时指标监控
-- 创建时间：2025-01-07

-- 1. 指标监控表：存储所有交易对的关键指标状态
CREATE TABLE IF NOT EXISTS indicator_monitoring (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    indicator_name TEXT NOT NULL,
    indicator_value REAL,
    status TEXT NOT NULL, -- 'VALID', 'INVALID', 'MISSING', 'ERROR'
    error_message TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, indicator_name, timestamp)
);

-- 2. 指标历史表：存储指标变化历史
CREATE TABLE IF NOT EXISTS indicator_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    indicator_name TEXT NOT NULL,
    indicator_value REAL,
    previous_value REAL,
    change_rate REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. 系统健康状态表：整体系统指标健康度
CREATE TABLE IF NOT EXISTS system_health (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    check_type TEXT NOT NULL, -- 'INDICATORS', 'PERFORMANCE', 'DATA_QUALITY'
    total_symbols INTEGER,
    healthy_symbols INTEGER,
    unhealthy_symbols INTEGER,
    health_rate REAL, -- 健康率百分比
    details TEXT, -- JSON格式的详细信息
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. 指标配置表：定义每个指标的监控规则
CREATE TABLE IF NOT EXISTS indicator_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    indicator_name TEXT NOT NULL UNIQUE,
    is_required BOOLEAN DEFAULT 1,
    min_value REAL,
    max_value REAL,
    tolerance REAL, -- 允许的偏差范围
    check_interval INTEGER DEFAULT 300, -- 检查间隔（秒）
    alert_threshold INTEGER DEFAULT 3, -- 连续失败次数告警阈值
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. 告警记录表：记录指标异常告警
CREATE TABLE IF NOT EXISTS alert_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT,
    indicator_name TEXT,
    alert_type TEXT NOT NULL, -- 'MISSING', 'INVALID', 'THRESHOLD_EXCEEDED', 'CALCULATION_ERROR'
    severity TEXT NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    message TEXT NOT NULL,
    details TEXT, -- JSON格式的详细信息
    is_resolved BOOLEAN DEFAULT 0,
    resolved_at DATETIME,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认指标配置
INSERT OR REPLACE INTO indicator_config (indicator_name, is_required, min_value, max_value, tolerance, description) VALUES
-- 基础技术指标
('ma20', 1, 0, NULL, 0.1, '20期移动平均线'),
('ma50', 1, 0, NULL, 0.1, '50期移动平均线'),
('ma200', 1, 0, NULL, 0.1, '200期移动平均线'),
('ema20', 1, 0, NULL, 0.1, '20期指数移动平均线'),
('ema50', 1, 0, NULL, 0.1, '50期指数移动平均线'),
('adx14', 1, 0, 100, 5, '14期平均方向指数'),
('bbw', 1, 0, 1, 0.05, '布林带宽度'),
('vwap', 1, 0, NULL, 0.05, '成交量加权平均价'),
('vol15m', 1, 0, NULL, 0.2, '15分钟成交量'),
('vol1h', 1, 0, NULL, 0.2, '1小时成交量'),

-- 高级指标
('oiChange6h', 0, -1, 1, 0.1, '6小时持仓量变化率'),
('fundingRate', 0, -0.01, 0.01, 0.001, '资金费率'),
('deltaImbalance', 0, -1, 1, 0.1, 'Delta不平衡度'),

-- 策略指标
('bullScore', 1, 0, 10, 0.5, '多头得分'),
('bearScore', 1, 0, 10, 0.5, '空头得分'),
('score1h', 1, 0, 10, 0.5, '1小时得分'),
('trendStrength', 1, NULL, NULL, NULL, '趋势强度'),
('signalStrength', 1, NULL, NULL, NULL, '信号强度'),

-- 杠杆指标
('maxLeverage', 1, 1, 100, 1, '最大杠杆'),
('minMargin', 1, 10, 10000, 10, '最小保证金'),
('stopLossDistance', 1, 0, 1, 0.01, '止损距离');

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_indicator_monitoring_symbol ON indicator_monitoring(symbol);
CREATE INDEX IF NOT EXISTS idx_indicator_monitoring_timestamp ON indicator_monitoring(timestamp);
CREATE INDEX IF NOT EXISTS idx_indicator_history_symbol ON indicator_history(symbol);
CREATE INDEX IF NOT EXISTS idx_indicator_history_timestamp ON indicator_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_alert_records_symbol ON alert_records(symbol);
CREATE INDEX IF NOT EXISTS idx_alert_records_timestamp ON alert_records(timestamp);
CREATE INDEX IF NOT EXISTS idx_alert_records_resolved ON alert_records(is_resolved);

-- 创建视图：实时指标状态概览
CREATE VIEW IF NOT EXISTS indicator_status_overview AS
SELECT 
    symbol,
    COUNT(*) as total_indicators,
    SUM(CASE WHEN status = 'VALID' THEN 1 ELSE 0 END) as valid_indicators,
    SUM(CASE WHEN status = 'INVALID' THEN 1 ELSE 0 END) as invalid_indicators,
    SUM(CASE WHEN status = 'MISSING' THEN 1 ELSE 0 END) as missing_indicators,
    SUM(CASE WHEN status = 'ERROR' THEN 1 ELSE 0 END) as error_indicators,
    ROUND(SUM(CASE WHEN status = 'VALID' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as health_rate,
    MAX(timestamp) as last_check_time
FROM indicator_monitoring 
WHERE DATE(timestamp) = DATE('now')
GROUP BY symbol;

-- 创建视图：系统健康概览
CREATE VIEW IF NOT EXISTS system_health_overview AS
SELECT 
    check_type,
    total_symbols,
    healthy_symbols,
    unhealthy_symbols,
    health_rate,
    timestamp
FROM system_health 
WHERE DATE(timestamp) = DATE('now')
ORDER BY timestamp DESC;
