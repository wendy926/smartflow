# 数据库表结构优化分析报告

## 当前数据库表结构分析

### 1. 表数量统计
当前数据库共有 **22个表**，包括：
- 核心业务表：6个
- 监控日志表：8个  
- 配置状态表：4个
- 缓存元数据表：4个

### 2. 主要问题分析

#### 2.1 表结构冗余问题

**问题1：strategy_analysis表字段过多**
- 当前字段数：**60+个字段**
- 问题：单表字段过多，维护困难
- 影响：查询性能下降，存储空间浪费

**问题2：重复字段定义**
- `trend` vs `trend4h`：功能重复
- `signal_strength` vs `signal`：语义重复
- `execution_mode` vs `execution_mode_v3`：版本冗余

**问题3：数据类型不一致**
- `BOOLEAN` vs `INTEGER`：布尔值存储不统一
- `REAL` vs `TEXT`：数值类型混用
- `DATETIME` vs `INTEGER`：时间戳格式不统一

#### 2.2 索引设计问题

**问题1：索引过多**
- `strategy_analysis`表有**8个索引**
- 问题：影响写入性能，占用存储空间

**问题2：复合索引缺失**
- 缺少`(symbol, timestamp, trend4h)`复合索引
- 缺少`(symbol, timestamp, market_type)`复合索引

**问题3：部分索引使用率低**
- 单字段索引可能使用率不高
- 需要根据实际查询模式优化

#### 2.3 数据一致性问题

**问题1：外键约束缺失**
- 表之间缺少外键约束
- 数据完整性无法保证

**问题2：枚举值不统一**
- `status`字段值不统一
- `signal`字段值不统一

### 3. 优化建议

#### 3.1 表结构重构建议

**建议1：拆分strategy_analysis表**
```sql
-- 主表：策略分析基础信息
CREATE TABLE strategy_analysis_base (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    trend4h TEXT,
    market_type TEXT,
    signal TEXT,
    execution TEXT,
    current_price REAL,
    data_quality_score REAL DEFAULT 0,
    strategy_version TEXT DEFAULT 'V3'
);

-- 子表1：4H趋势数据
CREATE TABLE strategy_trend_4h (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    analysis_id INTEGER NOT NULL,
    adx14 REAL,
    bbw REAL,
    trend_confirmed BOOLEAN DEFAULT FALSE,
    ma20 REAL,
    ma50 REAL,
    ma200 REAL,
    FOREIGN KEY (analysis_id) REFERENCES strategy_analysis_base(id)
);

-- 子表2：1H多因子数据
CREATE TABLE strategy_factors_1h (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    analysis_id INTEGER NOT NULL,
    vwap_direction_consistent BOOLEAN DEFAULT FALSE,
    breakout_confirmed BOOLEAN DEFAULT FALSE,
    volume_15m_ratio REAL,
    volume_1h_ratio REAL,
    oi_change_6h REAL,
    delta_imbalance REAL,
    factors TEXT, -- JSON格式
    FOREIGN KEY (analysis_id) REFERENCES strategy_analysis_base(id)
);

-- 子表3：15m执行数据
CREATE TABLE strategy_execution_15m (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    analysis_id INTEGER NOT NULL,
    execution_mode_v3 TEXT,
    setup_candle_high REAL,
    setup_candle_low REAL,
    atr14 REAL,
    entry_signal REAL,
    stop_loss REAL,
    take_profit REAL,
    FOREIGN KEY (analysis_id) REFERENCES strategy_analysis_base(id)
);
```

**建议2：统一数据类型**
```sql
-- 统一布尔值类型
ALTER TABLE strategy_analysis_base 
ADD COLUMN trend_confirmed INTEGER DEFAULT 0; -- 0=false, 1=true

-- 统一时间戳类型
ALTER TABLE strategy_analysis_base 
ADD COLUMN created_at INTEGER DEFAULT (strftime('%s', 'now'));

-- 统一枚举值
CREATE TABLE signal_types (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT
);
INSERT INTO signal_types VALUES 
(1, 'LONG', '做多信号'),
(2, 'SHORT', '做空信号'),
(3, 'NONE', '无信号');
```

#### 3.2 索引优化建议

**建议1：创建复合索引**
```sql
-- 主要查询模式索引
CREATE INDEX idx_strategy_analysis_symbol_time_trend 
ON strategy_analysis_base(symbol, timestamp, trend4h);

CREATE INDEX idx_strategy_analysis_symbol_time_market 
ON strategy_analysis_base(symbol, timestamp, market_type);

CREATE INDEX idx_strategy_analysis_symbol_time_signal 
ON strategy_analysis_base(symbol, timestamp, signal);

-- 监控查询索引
CREATE INDEX idx_analysis_logs_symbol_time_type 
ON analysis_logs(symbol, timestamp, analysis_type);

CREATE INDEX idx_simulations_symbol_status_time 
ON simulations(symbol, status, created_at);
```

**建议2：删除冗余索引**
```sql
-- 删除单字段索引，保留复合索引
DROP INDEX idx_strategy_analysis_trend;
DROP INDEX idx_strategy_analysis_signal;
DROP INDEX idx_strategy_analysis_execution;
```

#### 3.3 数据清理建议

**建议1：历史数据归档**
```sql
-- 创建归档表
CREATE TABLE strategy_analysis_archive AS 
SELECT * FROM strategy_analysis 
WHERE timestamp < datetime('now', '-30 days');

-- 清理历史数据
DELETE FROM strategy_analysis 
WHERE timestamp < datetime('now', '-30 days');
```

**建议2：数据压缩**
```sql
-- 执行VACUUM优化
VACUUM;

-- 重建索引
REINDEX;
```

### 4. 性能优化建议

#### 4.1 查询优化
- 使用`EXPLAIN QUERY PLAN`分析查询性能
- 避免`SELECT *`，只查询需要的字段
- 使用`LIMIT`限制返回结果数量

#### 4.2 写入优化
- 使用事务批量插入
- 避免频繁的`INSERT`操作
- 使用`PRAGMA synchronous = NORMAL`提高写入性能

#### 4.3 存储优化
- 定期执行`VACUUM`
- 监控数据库文件大小
- 考虑数据分区策略

### 5. 监控和维护建议

#### 5.1 性能监控
- 监控查询执行时间
- 监控索引使用率
- 监控数据库文件大小

#### 5.2 数据质量监控
- 定期检查数据完整性
- 监控数据一致性
- 设置数据质量告警

#### 5.3 备份策略
- 定期备份数据库
- 测试恢复流程
- 监控备份完整性

## 总结

当前数据库表结构存在以下主要问题：
1. **表结构冗余**：strategy_analysis表字段过多
2. **索引设计不合理**：索引过多且缺少复合索引
3. **数据类型不统一**：影响查询性能和存储效率
4. **缺少外键约束**：数据完整性无法保证

建议采用**分表策略**和**索引优化**来解决这些问题，提高数据库性能和可维护性。
