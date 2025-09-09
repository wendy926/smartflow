# SmartFlow V3策略 API说明文档

## 概述

本文档描述了SmartFlow V3策略系统的所有API接口，包括服务端接口、前端API客户端、数据字段映射和枚举值定义。

## 文件结构总览

```
vps-app/
├── server.js                          # 服务端主文件，包含所有API路由
├── modules/
│   ├── strategy/
│   │   ├── SmartFlowStrategyV3.js     # V3策略主入口
│   │   ├── StrategyV3Core.js          # 4H趋势过滤和1H多因子打分
│   │   └── StrategyV3Execution.js     # 15分钟入场执行
│   ├── database/
│   │   ├── DatabaseManager.js         # 数据库操作和V3数据存储
│   │   ├── SimulationManager.js       # 模拟交易管理
│   │   └── StrategyV3Migration.js     # V3策略数据库结构迁移
│   └── monitoring/
│       └── DataValidationSystem.js    # 数据验证系统
├── public/
│   ├── index.html                     # 主页面HTML结构
│   ├── js/
│   │   ├── main.js                    # 前端主应用逻辑
│   │   ├── api.js                     # API客户端核心实现
│   │   └── data/
│   │       └── DataManager.js         # 数据缓存和管理
│   └── css/
│       └── main.css                   # 前端样式定义
└── docs/
    └── API_DOCUMENTATION.md           # 本文档
```

## 1. 服务端API接口

### 1.1 核心信号API

#### GET /api/signals
- **功能**: 获取所有交易对的V3策略分析结果
- **实现文件**: `server.js` (第63-200行)
- **入参**: 无
- **出参**:
```json
[
  {
    "symbol": "BTCUSDT",
    "trend4h": "多头趋势|空头趋势|震荡市",
    "marketType": "趋势市|震荡市",
    "score1h": 0-6,
    "vwapDirectionConsistent": true|false,
    "factors": {
      "oi": true|false,
      "funding": true|false,
      "breakout": true|false,
      "volume": true|false,
      "delta": true|false
    },
    "execution": "做多_多头回踩突破|做空_空头反抽破位|做多_区间多头|做空_区间空头|做多_假突破反手|做空_假突破反手|null",
    "executionMode": "多头回踩突破|空头反抽破位|区间多头|区间空头|假突破反手|NONE",
    "entrySignal": 112350.5,
    "stopLoss": 110000.0,
    "takeProfit": 115000.0,
    "currentPrice": 112350.5,
    "dataCollectionRate": 95.5,
    "strategyVersion": "V3",
    "timestamp": "2025-01-09T12:20:16.218Z"
  }
]
```

**字段说明**:
- `trend4h`: 4小时趋势判断结果
- `marketType`: 市场类型（趋势市/震荡市）
- `score1h`: 1小时多因子得分（0-6分）
- `vwapDirectionConsistent`: VWAP方向一致性（必须满足）
- `factors`: 多因子打分详情
- `execution`: 15分钟入场执行信号
- `executionMode`: 执行模式
- `entrySignal`: 入场价格
- `stopLoss`: 止损价格
- `takeProfit`: 止盈价格

### 1.2 交易对管理API

#### GET /api/symbols
- **功能**: 获取交易对列表
- **实现文件**: `server.js` (第52-60行)
- **入参**: 无
- **出参**:
```json
[
  {"symbol": "BTCUSDT"},
  {"symbol": "ETHUSDT"},
  {"symbol": "LINKUSDT"}
]
```

#### POST /api/add-symbol
- **功能**: 添加交易对
- **实现文件**: `server.js` (第234-245行)
- **入参**: 
```json
{"symbol": "BTCUSDT"}
```
- **出参**: 
```json
{"success": true, "message": "交易对添加成功"}
```

#### POST /api/remove-symbol
- **功能**: 删除交易对
- **实现文件**: `server.js` (第246-257行)
- **入参**: 
```json
{"symbol": "BTCUSDT"}
```
- **出参**: 
```json
{"success": true, "message": "交易对删除成功"}
```

### 1.3 监控数据API

#### GET /api/monitoring-dashboard
- **功能**: 获取监控仪表板数据
- **实现文件**: `server.js` (第399-409行)
- **入参**: 无
- **出参**:
```json
{
  "summary": {
    "totalSymbols": 16,
    "healthySymbols": 0,
    "warningSymbols": 12,
    "errorSymbols": 1,
    "totalErrors": 144,
    "overallHealth": "ERROR|WARNING|HEALTHY",
    "completionRates": {
      "dataCollection": 0,
      "signalAnalysis": 0,
      "simulationTrading": 100
    }
  },
  "detailedStats": [
    {
      "symbol": "BTCUSDT",
      "dataCollection": {
        "rate": 0,
        "attempts": 0,
        "successes": 0,
        "lastTime": 0
      },
      "signalAnalysis": {
        "rate": 0,
        "attempts": 0,
        "successes": 0,
        "lastTime": 0
      },
      "simulationCompletion": {
        "rate": 100,
        "triggers": 35,
        "completions": 35
      }
    }
  ],
  "recentLogs": [...],
  "dataValidation": {
    "errors": [...],
    "errorCount": 144,
    "hasErrors": true
  }
}
```

#### GET /api/update-times
- **功能**: 获取数据更新时间
- **实现文件**: `server.js` (第502-517行)
- **入参**: 无
- **出参**:
```json
{
  "trend": "2025-01-09T12:20:16.218Z",
  "signal": "2025-01-09T12:20:16.218Z",
  "execution": "2025-01-09T12:20:16.218Z"
}
```

### 1.4 用户设置API

#### GET /api/user-settings
- **功能**: 获取用户设置
- **实现文件**: `server.js` (第590-599行)
- **入参**: 无
- **出参**:
```json
{
  "maxLossAmount": "100"
}
```

#### POST /api/user-settings
- **功能**: 设置用户配置
- **实现文件**: `server.js` (第600-610行)
- **入参**: 
```json
{"key": "maxLossAmount", "value": "100"}
```
- **出参**: 
```json
{"success": true, "message": "设置保存成功"}
```

### 1.5 模拟交易API

#### GET /api/simulation-history
- **功能**: 获取模拟交易历史
- **实现文件**: `server.js` (第269-279行)
- **入参**: 无
- **出参**:
```json
[
  {
    "id": 1,
    "symbol": "BTCUSDT",
    "entryPrice": 112350.5,
    "exitPrice": 115000.0,
    "direction": "LONG|SHORT",
    "status": "CLOSED|OPEN",
    "profitLoss": 2649.5,
    "profitLossPercent": 2.35,
    "createdAt": "2025-01-09T12:20:16.218Z",
    "closedAt": "2025-01-09T14:30:16.218Z"
  }
]
```

#### POST /api/simulation/start
- **功能**: 启动模拟交易
- **实现文件**: `server.js` (第280-312行)
- **入参**: 
```json
{
  "symbol": "BTCUSDT",
  "entryPrice": 112350.5,
  "stopLoss": 110000.0,
  "takeProfit": 115000.0,
  "direction": "LONG",
  "executionMode": "多头回踩突破"
}
```
- **出参**: 
```json
{"success": true, "simulationId": 123}
```

### 1.6 健康检查API

#### GET /api/health-check
- **功能**: 系统健康检查
- **实现文件**: `server.js` (第410-420行)
- **入参**: 无
- **出参**:
```json
{
  "status": "healthy|unhealthy",
  "timestamp": "2025-01-09T12:20:16.218Z",
  "uptime": 3600,
  "version": "1.0.0"
}
```

## 2. 前端API客户端

### 2.1 实现文件
- **主要实现**: `public/js/api.js` - API客户端核心实现
- **使用位置**: `public/js/main.js` - 主应用逻辑中调用
- **数据管理**: `public/js/data/DataManager.js` - 数据缓存和管理

### 2.2 核心方法

```javascript
class APIClient {
  constructor() {
    this.baseURL = '';
  }

  // 获取所有信号
  async getAllSignals() {
    return await this.request('/api/signals');
  }

  // 获取交易对列表
  async getSymbols() {
    return await this.request('/api/symbols');
  }

  // 刷新所有信号
  async refreshAllSignals() {
    return await this.request('/api/refresh-all', { method: 'POST' });
  }

  // 添加交易对
  async addSymbol(symbol) {
    return await this.request('/api/add-symbol', {
      method: 'POST',
      body: JSON.stringify({ symbol })
    });
  }

  // 删除交易对
  async removeSymbol(symbol) {
    return await this.request('/api/remove-symbol', {
      method: 'POST',
      body: JSON.stringify({ symbol })
    });
  }

  // 获取模拟交易历史
  async getSimulationHistory() {
    return await this.request('/api/simulation-history');
  }

  // 获取胜率统计
  async getWinRateStats() {
    return await this.request('/api/win-rate-stats');
  }

  // 获取监控数据
  async getMonitoringDashboard() {
    return await this.request('/api/monitoring-dashboard');
  }

  // 获取健康检查数据
  async getHealthCheck() {
    return await this.request('/api/health-check');
  }

  // 获取更新时间
  async getUpdateTimes() {
    return await this.request('/api/update-times');
  }

  // 用户设置管理
  async getUserSettings() {
    return await this.request('/api/user-settings');
  }

  async setUserSetting(key, value) {
    return await this.request('/api/user-settings', {
      method: 'POST',
      body: JSON.stringify({ key, value })
    });
  }

  // 测试功能
  async testTelegramNotification() {
    return await this.request('/api/test-telegram', { method: 'POST' });
  }

  async testDataQualityAlert() {
    return await this.request('/api/test-data-quality-alert', { method: 'POST' });
  }
}
```

## 3. V3策略核心实现文件

### 3.1 策略核心模块
- **主策略类**: `modules/strategy/SmartFlowStrategyV3.js` - V3策略主入口
- **核心逻辑**: `modules/strategy/StrategyV3Core.js` - 4H趋势过滤和1H多因子打分
- **执行逻辑**: `modules/strategy/StrategyV3Execution.js` - 15分钟入场执行
- **数据库迁移**: `modules/database/StrategyV3Migration.js` - V3策略数据库结构迁移

### 3.2 数据管理模块
- **数据库管理**: `modules/database/DatabaseManager.js` - 数据库操作和V3数据存储
- **模拟交易**: `modules/database/SimulationManager.js` - 模拟交易管理
- **数据监控**: `modules/monitoring/DataValidationSystem.js` - 数据验证系统

### 3.3 前端显示模块
- **主页面**: `public/index.html` - 主页面HTML结构
- **主逻辑**: `public/js/main.js` - 前端主应用逻辑
- **样式文件**: `public/css/main.css` - 前端样式定义

## 4. 前端表格字段映射

| 表格列 | 数据字段 | 显示逻辑 | 说明 |
|--------|----------|----------|------|
| 详情 | - | 操作按钮 | 查看详情弹窗 |
| 交易对 | `symbol` | 直接显示 | 如：BTCUSDT |
| 4H趋势 | `trend4h` + `marketType` | 趋势+市场类型 | 如：多头趋势<br>趋势市 |
| 多因子得分 | `score1h` | 震荡市显示"--" | 0-6分，震荡市显示-- |
| 1H加强趋势 | `signal` + `vwapDirectionConsistent` | 信号+VWAP状态 | 如：BUY<br>VWAP: ✅ |
| 15min信号 | `execution` + `executionMode` | 执行+模式 | 如：做多_多头回踩突破<br>多头回踩突破 |
| 当前价格 | `currentPrice` | 格式化显示 | 如：$112,350.50 |
| 数据采集率 | `dataCollectionRate` | 百分比显示 | 如：95.5% |

## 5. 枚举值定义

### 5.1 趋势类型
- `"多头趋势"` - 4H多头趋势（MA20>MA50>MA200且收盘价>MA20）
- `"空头趋势"` - 4H空头趋势（MA20<MA50<MA200且收盘价<MA20）
- `"震荡市"` - 4H震荡市场（不满足趋势条件）

### 5.2 市场类型
- `"趋势市"` - 趋势市场（满足4H趋势条件）
- `"震荡市"` - 震荡市场（不满足4H趋势条件）

### 5.3 执行模式
- `"多头回踩突破"` - 趋势市多头模式（价格回踩EMA支撑后突破）
- `"空头反抽破位"` - 趋势市空头模式（价格反抽EMA阻力后破位）
- `"区间多头"` - 震荡市多头模式（价格接近下轨且边界有效）
- `"区间空头"` - 震荡市空头模式（价格接近上轨且边界有效）
- `"假突破反手"` - 假突破反手模式（突破后快速收回）
- `"NONE"` - 无信号

### 5.4 系统状态
- `"HEALTHY"` - 系统健康
- `"WARNING"` - 系统警告
- `"ERROR"` - 系统错误

### 5.5 模拟交易状态
- `"OPEN"` - 持仓中
- `"CLOSED"` - 已平仓

### 5.6 交易方向
- `"LONG"` - 多头
- `"SHORT"` - 空头

## 6. 数据刷新频率

| 数据类型 | 刷新频率 | 说明 |
|----------|----------|------|
| 4H趋势 | 每1小时 | 足够稳定，减少API压力 |
| 1H打分 | 每5分钟 | 提前捕捉突破和VWAP偏移 |
| 15m入场 | 每1-3分钟 | 精确捕捉setup突破 |
| Delta/盘口 | 实时（WebSocket） | 否则失去意义 |

## 7. 错误处理

### 7.1 常见错误码
- `400` - 请求参数错误
- `404` - 资源不存在
- `500` - 服务器内部错误

### 7.2 错误响应格式
```json
{
  "error": "错误描述",
  "code": "ERROR_CODE",
  "timestamp": "2025-01-09T12:20:16.218Z"
}
```

## 8. 版本历史

- **V3.0** - 当前版本，支持多周期共振策略
- **V2.0** - 上一版本，基础趋势策略
- **V1.0** - 初始版本

## 9. 数据库表结构Schema

### 9.1 strategy_analysis表结构

```sql
CREATE TABLE strategy_analysis (
    -- 基础字段
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- V2策略字段（向后兼容）
    trend TEXT,                    -- 天级趋势
    trend_strength TEXT,           -- 趋势强度
    ma20 REAL,                     -- 20期移动平均
    ma50 REAL,                     -- 50期移动平均
    ma200 REAL,                    -- 200期移动平均
    bbw_expanding BOOLEAN,         -- 布林带带宽扩张
    signal TEXT,                   -- 小时级信号
    signal_strength TEXT,          -- 信号强度
    hourly_score INTEGER,          -- 小时得分
    vwap REAL,                     -- 成交量加权均价
    oi_change REAL,                -- 持仓量变化
    funding_rate REAL,             -- 资金费率
    execution TEXT,                -- 15分钟执行信号
    execution_mode TEXT,           -- 执行模式
    mode_a BOOLEAN,                -- 模式A
    mode_b BOOLEAN,                -- 模式B
    entry_signal REAL,             -- 入场信号价格
    stop_loss REAL,                -- 止损价格
    take_profit REAL,              -- 止盈价格
    current_price REAL,            -- 当前价格
    data_collection_rate REAL,     -- 数据采集率
    full_analysis_data TEXT,       -- 完整分析数据JSON
    data_valid BOOLEAN DEFAULT TRUE, -- 数据有效性
    error_message TEXT,            -- 错误信息
    
    -- V3策略新增字段
    trend4h TEXT,                  -- 4H趋势（多头趋势/空头趋势/震荡市）
    market_type TEXT,              -- 市场类型（趋势市/震荡市）
    adx14 REAL,                    -- ADX(14)指标
    bbw REAL,                      -- 布林带带宽
    trend_confirmed BOOLEAN DEFAULT FALSE, -- 趋势确认
    vwap_direction_consistent BOOLEAN DEFAULT FALSE, -- VWAP方向一致性
    breakout_confirmed BOOLEAN DEFAULT FALSE, -- 突破确认
    volume_15m_ratio REAL,         -- 15分钟成交量比率
    volume_1h_ratio REAL,          -- 1小时成交量比率
    oi_change_6h REAL,             -- 6小时持仓量变化
    delta_buy REAL,                -- 主动买盘
    delta_sell REAL,               -- 主动卖盘
    delta_imbalance REAL,          -- Delta不平衡
    factors TEXT,                  -- 多因子打分详情（JSON）
    vol15m_ratio REAL,             -- 15分钟成交量比率
    vol1h_ratio REAL,              -- 1小时成交量比率
    strategy_version TEXT DEFAULT 'V2', -- 策略版本
    
    -- 震荡市相关字段
    range_lower_boundary_valid BOOLEAN DEFAULT FALSE, -- 下轨边界有效性
    range_upper_boundary_valid BOOLEAN DEFAULT FALSE, -- 上轨边界有效性
    bb_upper REAL,                 -- 布林带上轨
    bb_middle REAL,                -- 布林带中轨
    bb_lower REAL,                 -- 布林带下轨
    range_touches_lower INTEGER DEFAULT 0, -- 下轨触碰次数
    range_touches_upper INTEGER DEFAULT 0, -- 上轨触碰次数
    last_breakout BOOLEAN DEFAULT FALSE, -- 最近突破
    
    -- 15分钟执行相关字段
    execution_mode_v3 TEXT,        -- V3执行模式
    setup_candle_high REAL,        -- Setup蜡烛高点
    setup_candle_low REAL,         -- Setup蜡烛低点
    atr14 REAL,                    -- ATR(14)指标
    time_in_position INTEGER DEFAULT 0, -- 持仓时间
    max_time_in_position INTEGER DEFAULT 48, -- 最大持仓时间
    
    -- 数据质量字段
    data_quality_score REAL DEFAULT 0, -- 数据质量得分
    cache_version INTEGER DEFAULT 1    -- 缓存版本
);

-- 索引
CREATE INDEX idx_strategy_analysis_symbol ON strategy_analysis(symbol);
CREATE INDEX idx_strategy_analysis_timestamp ON strategy_analysis(timestamp);
CREATE INDEX idx_strategy_analysis_trend ON strategy_analysis(trend);
CREATE INDEX idx_strategy_analysis_signal ON strategy_analysis(signal);
CREATE INDEX idx_strategy_analysis_execution ON strategy_analysis(execution);
CREATE INDEX idx_strategy_analysis_symbol_timestamp ON strategy_analysis(symbol, timestamp);
```

### 9.2 字段映射关系

| API字段 | 数据库字段 | 类型 | 说明 |
|---------|------------|------|------|
| `trend4h` | `trend4h` | TEXT | 4H趋势判断结果 |
| `marketType` | `market_type` | TEXT | 市场类型 |
| `score1h` | `hourly_score` | INTEGER | 1H多因子得分 |
| `vwapDirectionConsistent` | `vwap_direction_consistent` | BOOLEAN | VWAP方向一致性 |
| `factors` | `factors` | TEXT | 多因子打分详情（JSON） |
| `execution` | `execution` | TEXT | 15分钟执行信号 |
| `executionMode` | `execution_mode_v3` | TEXT | V3执行模式 |
| `strategyVersion` | `strategy_version` | TEXT | 策略版本 |

## 10. 注意事项

1. **VWAP方向一致性** - 趋势市必须满足VWAP方向一致性才能入场
2. **多因子得分** - 震荡市不需要1H多因子打分，前端显示为"--"
3. **数据采集率** - 监控系统需要正确识别V3策略数据结构
4. **Delta数据** - 当前使用模拟数据，需要实现WebSocket实时获取
5. **数据库字段** - 数据库表结构已包含V3策略的所有字段

---

*最后更新: 2025-01-09*
*版本: V3.0*
