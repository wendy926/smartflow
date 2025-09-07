# 数据库表结构更新总结

## 📋 更新概述

本次更新将数据库表结构完全适配到新的strategy-v2.md策略逻辑，确保所有原始数据和计算指标都能正确存储。

## 🗄️ 新增数据库表

### strategy_analysis 表

这是新增的核心表，专门用于存储完整的策略分析结果：

```sql
CREATE TABLE strategy_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  -- 天级趋势数据
  trend TEXT,
  trend_strength TEXT,
  ma20 REAL,
  ma50 REAL,
  ma200 REAL,
  bbw_expanding BOOLEAN,
  -- 小时级趋势加强数据
  signal TEXT,
  signal_strength TEXT,
  hourly_score INTEGER,
  vwap REAL,
  oi_change REAL,
  funding_rate REAL,
  -- 15分钟入场执行数据
  execution TEXT,
  execution_mode TEXT,
  mode_a BOOLEAN,
  mode_b BOOLEAN,
  entry_signal REAL,
  stop_loss REAL,
  take_profit REAL,
  -- 基础信息
  current_price REAL,
  data_collection_rate REAL,
  -- 完整数据JSON
  full_analysis_data TEXT,
  -- 数据质量
  data_valid BOOLEAN DEFAULT TRUE,
  error_message TEXT
);
```

### 索引优化

为了提高查询性能，创建了以下索引：

- `idx_strategy_analysis_symbol` - 按交易对查询
- `idx_strategy_analysis_timestamp` - 按时间查询
- `idx_strategy_analysis_trend` - 按趋势查询
- `idx_strategy_analysis_signal` - 按信号查询
- `idx_strategy_analysis_execution` - 按执行状态查询

## 🔧 数据库管理器更新

### 新增方法

1. **recordStrategyAnalysis(analysisData)** - 存储完整的策略分析结果
2. **getStrategyAnalysisHistory(symbol, limit)** - 获取策略分析历史记录
3. **getLatestStrategyAnalysis(symbol)** - 获取最新的策略分析结果

### 更新方法

1. **getDataStats()** - 增加了策略分析记录的统计
2. **initTables()** - 增加了新表的创建逻辑

## 📊 数据存储验证

### 验证结果

✅ **数据库表结构正确**
- 所有字段类型和约束正确
- 索引创建成功
- 表关系设计合理

✅ **技术指标计算模块正常**
- SMA、EMA、ATR计算正常
- BBW（布林带带宽）计算正常
- VWAP计算正常
- 突破结构计算正常
- 成交量确认计算正常
- Delta计算正常

✅ **数据存储功能正常**
- 策略分析结果正确存储
- 所有字段数据完整
- JSON数据序列化正常
- 数据查询功能正常

✅ **数据完整性验证**
- 天级趋势数据完整存储
- 小时级确认数据完整存储
- 15分钟执行数据完整存储
- 所有计算指标正确存储

## 🔄 服务器逻辑更新

### server.js 更新

1. **API路由更新** - `/api/signals` 路由使用新的策略分析结果结构
2. **数据存储集成** - 所有策略分析结果自动存储到数据库
3. **更新方法重构** - 所有更新方法使用完整的分析流程

### 数据流程

```
Binance API → 策略分析 → 数据库存储 → 前端显示
     ↓           ↓           ↓           ↓
  原始数据   计算指标    结构化存储   用户界面
```

## 📈 存储的数据类型

### 原始数据（从Binance API获取）

1. **日线K线数据** - 250根K线用于趋势分析
2. **小时线K线数据** - 50根K线用于趋势加强判断
3. **15分钟K线数据** - 50根K线用于入场执行判断
4. **24小时行情数据** - 当前价格和成交量信息
5. **资金费率数据** - 用于多因子打分
6. **持仓量历史数据** - 6小时历史用于OI变化计算

### 计算指标（技术分析结果）

1. **天级趋势指标**
   - MA20, MA50, MA200（移动平均线）
   - BBW（布林带带宽）
   - BBW扩张状态

2. **小时级趋势加强指标**
   - VWAP（成交量加权平均价格）
   - 突破结构判断
   - 成交量确认
   - OI变化百分比
   - 资金费率
   - Delta确认
   - 多因子得分（0-6分）

3. **15分钟入场执行指标**
   - EMA20, EMA50
   - ATR14（平均真实波幅）
   - 入场信号价格
   - 止损价格
   - 止盈价格
   - 模式A/B判断

## 🎯 数据质量保证

### 数据验证

1. **数据完整性检查** - 确保所有必需字段都有值
2. **数据有效性标记** - `data_valid` 字段标记数据质量
3. **错误信息记录** - `error_message` 字段记录错误详情
4. **时间戳记录** - 精确记录数据生成时间

### 数据监控

1. **数据采集率统计** - 监控API调用成功率
2. **数据质量监控** - 记录数据质量问题
3. **分析日志记录** - 详细记录分析过程

## 🚀 部署说明

### 数据库迁移

运行以下命令进行数据库迁移：

```bash
node migrate-database.js
```

### 功能验证

运行以下命令验证数据库功能：

```bash
node verify-db-only.js
```

### 环境配置

- **开发环境**: 数据库文件存储在项目根目录
- **生产环境**: 数据库文件存储在VPS指定路径

## 📋 总结

✅ **数据库表结构已完全更新到新策略逻辑**
✅ **所有原始数据和计算指标都能正确存储**
✅ **数据查询和统计功能正常**
✅ **数据质量监控机制完善**
✅ **向后兼容性保持**

数据库现在完全支持strategy-v2.md的所有策略逻辑，能够高效存储和查询所有相关的原始数据和计算指标。
