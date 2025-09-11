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
    "setupCandleHigh": 112500.0,
    "setupCandleLow": 112000.0,
    "atr14": 1500.0,
    "maxLeverage": 20,
    "minMargin": 100.0,
    "stopLossDistance": 2.5,
    "atrValue": 1500.0,
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
- `setupCandleHigh`: Setup蜡烛高点
- `setupCandleLow`: Setup蜡烛低点
- `atr14`: ATR(14)指标值
- `maxLeverage`: 最大杠杆倍数
- `minMargin`: 最小保证金（USDT）
- `stopLossDistance`: 止损距离百分比
- `atrValue`: ATR值（与atr14相同）

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
- **功能**: 获取模拟交易历史（限制50条）
- **实现文件**: `server.js` (第269-279行)
- **入参**: 无
- **出参**:
```json
[
  {
    "id": 1,
    "symbol": "BTCUSDT",
    "entry_price": 112350.5,
    "stop_loss_price": 110000.0,
    "take_profit_price": 115000.0,
    "max_leverage": 20,
    "min_margin": 100.0,
    "stop_loss_distance": 2.5,
    "atr_value": 1500.0,
    "atr14": 1500.0,
    "direction": "LONG|SHORT",
    "status": "CLOSED|ACTIVE",
    "trigger_reason": "SIGNAL_多头回踩突破",
    "execution_mode_v3": "多头回踩突破",
    "market_type": "趋势市",
    "setup_candle_high": 112500.0,
    "setup_candle_low": 112000.0,
    "time_in_position": 12,
    "max_time_in_position": 48,
    "exit_price": 115000.0,
    "exit_reason": "止盈触发",
    "is_win": true,
    "profit_loss": 2649.5,
    "created_at": "2025-01-09T12:20:16.218Z",
    "closed_at": "2025-01-09T14:30:16.218Z"
  }
]
```

#### GET /api/simulation-history-all
- **功能**: 获取所有模拟交易历史（无限制）
- **实现文件**: `server.js` (第280-290行)
- **入参**: 无
- **出参**: 与`/api/simulation-history`相同，但返回所有记录

#### GET /api/simulation-history-paginated
- **功能**: 获取分页模拟交易历史
- **实现文件**: `server.js` (第291-303行)
- **入参**: 
  - `page`: 页码（默认1）
  - `pageSize`: 每页大小（默认20）
- **出参**:
```json
{
  "simulations": [...],
  "pagination": {
    "currentPage": 1,
    "pageSize": 20,
    "total": 240,
    "totalPages": 12,
    "hasNext": true,
    "hasPrev": false
  }
}
```

#### GET /api/win-rate-stats
- **功能**: 获取胜率统计
- **实现文件**: `server.js` (第304-314行)
- **入参**: 无
- **出参**:
```json
{
  "total_trades": 240,
  "winning_trades": 25,
  "losing_trades": 215,
  "win_rate": 10.42,
  "net_profit": -836.8152,
  "total_profit": 125.5,
  "total_loss": 962.3152
}
```

#### GET /api/direction-stats
- **功能**: 获取方向统计（做多/做空分别统计）
- **实现文件**: `server.js` (第315-325行)
- **入参**: 无
- **出参**:
```json
{
  "long": {
    "total_trades": 37,
    "winning_trades": 2,
    "losing_trades": 35,
    "win_rate": 5.41,
    "net_profit": -424.74,
    "total_profit": 1.96,
    "total_loss": 426.70
  },
  "short": {
    "total_trades": 203,
    "winning_trades": 20,
    "losing_trades": 183,
    "win_rate": 9.85,
    "net_profit": -412.08,
    "total_profit": 4.45,
    "total_loss": 416.53
  }
}
```

#### GET /api/symbol-stats
- **功能**: 获取交易对统计
- **实现文件**: `server.js` (第326-336行)
- **入参**: 无
- **出参**:
```json
[
  {
    "symbol": "BTCUSDT",
    "total_trades": 48,
    "winning_trades": 7,
    "losing_trades": 41,
    "win_rate": 14.58,
    "net_profit": -22.79,
    "avg_profit": -0.50
  }
]
```

#### GET /api/exit-reason-stats
- **功能**: 获取出场原因统计
- **实现文件**: `server.js` (第333-343行)
- **入参**: 无
- **出参**:
```json
[
  {
    "exit_reason": "STOP_LOSS",
    "count": 214,
    "wins": 214,
    "losses": 0,
    "win_rate": 100,
    "avg_profit": 50.34,
    "avg_loss": 0,
    "total_profit_loss": 10771.90
  },
  {
    "exit_reason": "RANGE_BOUNDARY_BREAK",
    "count": 15,
    "wins": 2,
    "losses": 13,
    "win_rate": 13.33,
    "avg_profit": 25.50,
    "avg_loss": -15.75,
    "total_profit_loss": -150.25
  }
]
```

#### POST /api/simulation/start
- **功能**: 启动模拟交易
- **实现文件**: `server.js` (第337-365行)
- **入参**: 
```json
{
  "symbol": "BTCUSDT",
  "entryPrice": 112350.5,
  "stopLoss": 110000.0,
  "takeProfit": 115000.0,
  "maxLeverage": 20,
  "minMargin": 100.0,
  "stopLossDistance": 2.5,
  "atrValue": 1500.0,
  "atr14": 1500.0,
  "executionMode": "多头回踩突破",
  "direction": "LONG"
}
```
- **出参**: 
```json
{"success": true, "simulation": 123}
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

  // 获取所有模拟交易历史
  async getSimulationHistoryAll() {
    return await this.request('/api/simulation-history-all');
  }

  // 获取分页模拟交易历史
  async getSimulationHistoryPaginated(page = 1, pageSize = 20) {
    return await this.request(`/api/simulation-history-paginated?page=${page}&pageSize=${pageSize}`);
  }

  // 获取胜率统计
  async getWinRateStats() {
    return await this.request('/api/win-rate-stats');
  }

  // 获取方向统计
  async getDirectionStats() {
    return await this.request('/api/direction-stats');
  }

  // 获取交易对统计
  async getSymbolStats() {
    return await this.request('/api/symbol-stats');
  }

  // 获取出场原因统计
  async getExitReasonStats() {
    return await this.request('/api/exit-reason-stats');
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

### 4.1 主页面交易对表格

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

### 4.2 模拟交易数据页面表格

| 表格列 | 数据字段 | 显示逻辑 | 说明 |
|--------|----------|----------|------|
| 交易对 | `symbol` | 直接显示 | 如：BTCUSDT |
| 方向 | `direction` | 直接显示 | LONG/SHORT |
| 入场价格 | `entry_price` | 4位小数 | 如：112350.5000 |
| 止损价格 | `stop_loss_price` | 4位小数 | 如：110000.0000 |
| 止盈价格 | `take_profit_price` | 4位小数 | 如：115000.0000 |
| 杠杆倍数 | `max_leverage` | 直接显示 | 如：20 |
| 最小保证金 | `min_margin` | 2位小数 | 如：100.00 USDT |
| 止损距离 | `stop_loss_distance` | 2位小数+% | 如：2.50% |
| ATR值 | `atr_value` | 4位小数 | 如：1500.0000 |
| 入场时间 | `created_at` | 格式化时间 | 如：2025-01-09 12:20:16 |
| 出场时间 | `closed_at` | 格式化时间 | 如：2025-01-09 14:30:16 |
| 出场价格 | `exit_price` | 4位小数 | 如：115000.0000 |
| 出场原因 | `exit_reason` | 直接显示 | 如：止盈触发 |
| 触发原因 | `trigger_reason` | 直接显示 | 如：SIGNAL_多头回踩突破 |
| 盈亏 | `profit_loss` | 4位小数+颜色 | 如：+2649.5000 USDT |
| 结果 | `is_win` | 图标+文字 | 如：✅ 盈利 / ❌ 亏损 |

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

### 5.7 出场原因
- `"STOP_LOSS"` - 止损触发
- `"TAKE_PROFIT"` - 止盈触发
- `"TREND_REVERSAL"` - 趋势反转
- `"DELTA_WEAKENING"` - Delta/主动买卖盘减弱
- `"SUPPORT_RESISTANCE_BREAK"` - 跌破支撑或突破阻力
- `"TIME_STOP"` - 时间止损
- `"RANGE_BOUNDARY_BREAK"` - 震荡市区间边界失效（新增）

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
    
    -- 新增：震荡市假突破和多因子打分字段
    bb_width_15m REAL,             -- 15分钟布林带宽
    fake_breakout_detected BOOLEAN DEFAULT FALSE, -- 假突破检测
    factor_score INTEGER DEFAULT 0, -- 多因子得分
    vwap_factor REAL,              -- VWAP因子
    delta_factor REAL,             -- Delta因子
    oi_factor REAL,                -- OI因子
    volume_factor REAL,            -- Volume因子
    
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
| `setupCandleHigh` | `setup_candle_high` | REAL | Setup蜡烛高点 |
| `setupCandleLow` | `setup_candle_low` | REAL | Setup蜡烛低点 |
| `atr14` | `atr14` | REAL | ATR(14)指标值 |
| `maxLeverage` | `max_leverage` | INTEGER | 最大杠杆倍数 |
| `minMargin` | `min_margin` | REAL | 最小保证金 |
| `stopLossDistance` | `stop_loss_distance` | REAL | 止损距离百分比 |
| `atrValue` | `atr_value` | REAL | ATR值 |

### 9.3 模拟交易表结构

```sql
CREATE TABLE simulations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    entry_price REAL NOT NULL,
    stop_loss_price REAL NOT NULL,
    take_profit_price REAL NOT NULL,
    max_leverage INTEGER NOT NULL,
    min_margin REAL NOT NULL,
    trigger_reason TEXT NOT NULL,
    status TEXT DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME,
    exit_price REAL,
    exit_reason TEXT,
    is_win BOOLEAN,
    profit_loss REAL,
    stop_loss_distance REAL,
    atr_value REAL,
    cache_version INTEGER DEFAULT 1,
    last_updated DATETIME,
    direction TEXT,
    execution_mode_v3 TEXT,
    market_type TEXT,
    setup_candle_high REAL,
    setup_candle_low REAL,
    atr14 REAL,
    time_in_position INTEGER DEFAULT 0,
    max_time_in_position INTEGER DEFAULT 48
);
```

### 9.4 监控数据表结构

#### analysis_logs表
```sql
CREATE TABLE analysis_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    success BOOLEAN DEFAULT FALSE,
    phases TEXT, -- JSON格式存储各阶段结果
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### data_quality_issues表
```sql
CREATE TABLE data_quality_issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    issue_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    message TEXT NOT NULL,
    details TEXT, -- JSON格式存储详细信息
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### validation_results表
```sql
CREATE TABLE validation_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    overall_status TEXT NOT NULL,
    errors TEXT, -- JSON格式存储错误列表
    warnings TEXT, -- JSON格式存储警告列表
    details TEXT, -- JSON格式存储详细信息
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 10. 注意事项

1. **VWAP方向一致性** - 趋势市必须满足VWAP方向一致性才能入场
2. **多因子得分** - 震荡市不需要1H多因子打分，前端显示为"--"
3. **数据采集率** - 监控系统需要正确识别V3策略数据结构
4. **Delta数据** - 当前使用模拟数据，需要实现WebSocket实时获取
5. **数据库字段** - 数据库表结构已包含V3策略的所有字段
6. **杠杆计算** - 严格按照strategy-v2.md文档实现，区分多头空头止损距离计算
7. **模拟交易字段** - 所有模拟交易记录包含完整的杠杆、保证金、止损距离、ATR值等字段
8. **分页功能** - 模拟交易历史支持分页查询，提高大数据量下的性能
9. **方向统计** - 支持按交易方向（做多/做空）分别统计胜率和盈亏
10. **4H趋势过滤** - 严格按照strategy-v3.md文档实现：
    - **MA排列**：MA20 > MA50 > MA200（多头）或 MA20 < MA50 < MA200（空头）
    - **价格位置**：收盘价 > MA20（多头）或 收盘价 < MA20（空头）
    - **连续确认**：至少2根4H K线满足上述条件
    - **ADX条件**：ADX(14) > 20 且 DI方向正确
    - **布林带扩张**：带宽呈扩张趋势（后半段比前半段大5%以上）
11. **震荡市止损止盈** - 严格按照strategy-v3.md文档实现：
    - 多头止损：`min(bb1h.lower * 0.995, last15m.low - last15m.low * 0.005)`
    - 空头止损：`max(bb1h.upper * 1.005, last15m.high + last15m.high * 0.005)`
    - 多头止盈：`bb1h.middle`（mid_or_opposite模式）或 `bb1h.upper`
    - 空头止盈：`bb1h.middle`（mid_or_opposite模式）或 `bb1h.lower`
    - 区间边界失效止损：多头跌破`rangeLow - ATR`，空头突破`rangeHigh + ATR`

## 11. 新增功能说明

### 11.1 模拟交易数据页面
- **分页展示**: 支持分页浏览模拟交易历史记录
- **统计功能**: 提供整体胜率、方向统计、交易对统计等
- **字段完整**: 显示杠杆倍数、最小保证金、止损距离、ATR值等完整信息

### 11.2 杠杆计算逻辑
- **止损距离**: 多头`(entrySignal - stopLoss) / entrySignal`，空头`(stopLoss - entrySignal) / entrySignal`
- **最大杠杆**: `1/(止损距离% + 0.5%)` 数值向下取整
- **最小保证金**: `最大损失金额/(杠杆数 × 止损距离%)` 数值向上取整

### 11.3 API扩展
- **分页API**: `/api/simulation-history-paginated` 支持分页查询
- **统计API**: `/api/direction-stats` 和 `/api/symbol-stats` 提供详细统计
- **完整字段**: 所有API返回完整的模拟交易字段信息

---

*最后更新: 2025-01-09*
*版本: V3.2*

## 12. 更新日志

### V3.2 (2025-01-09)
- **修复震荡市止损止盈逻辑** - 严格按照strategy-v3.md文档实现止损止盈计算
- **添加区间边界失效止损** - 支持震荡市区间边界失效止损逻辑
- **新增出场原因统计API** - 提供`/api/exit-reason-stats`端点统计各种出场原因
- **完善API文档** - 更新文档以反映最新的震荡市止损止盈逻辑和新增API

### V3.3 (2025-01-09)
- **修复4H趋势过滤逻辑** - 严格按照strategy-v3.md文档实现布林带带宽扩张检查
- **完善趋势强度确认** - ADX条件 AND 布林带带宽扩张双重确认
- **优化趋势市判定** - 确保所有条件（MA排列+连续确认+趋势强度确认）都满足才判定为趋势市
- **更新API文档** - 反映最新的4H趋势过滤逻辑和震荡市止损止盈计算

### V3.4 (2025-01-09)
- **修复XLMUSDT TREND_REVERSAL问题** - 解决震荡市交易被错误应用趋势市TREND_REVERSAL逻辑的问题
- **修复marketType获取逻辑** - checkExitConditions方法优先从模拟交易记录获取market_type字段
- **完善signalData字段** - getAllSignals方法添加V3策略关键字段（marketType、trend4h、score1h等）
- **增强调试功能** - 添加调试日志帮助诊断市场类型判断问题
- **数据清理** - 清理历史SIGNAL_区间空头 TREND_REVERSAL止损的错误记录

### V3.5 (2025-01-09)
- **重新实现震荡市策略逻辑** - 严格按照strategy-v3.md文档重新实现震荡市策略
- **1H区间边界有效性检查** - 增加连续触碰、成交量、Delta、OI因子验证
- **15分钟假突破入场判断** - 增加布林带宽收窄检查，实现真正的假突破逻辑
- **多因子打分系统** - 实现VWAP、Delta、OI、Volume四个因子的量化打分
- **止盈止损策略优化** - 结构性止损 + 多因子打分止损 + 时间止盈 + 固定RR目标
- **数据库表结构更新** - 添加震荡市假突破和多因子打分相关字段
- **数据验证监控增强** - 新增震荡市策略验证方法和多因子打分验证

### V3.6 (2025-01-09)
- **修复监控页面显示问题** - 修复模拟交易完成率显示格式，保留小数点后一位
- **修复模拟交易状态显示** - 进行中记录正确显示为"进行中"而不是"亏损"
- **修复SIGNAL_NONE触发问题** - 添加NONE检查，防止SIGNAL_NONE触发模拟交易
- **重构监控数据存储** - 将日志数据从内存迁移到数据库，减少内存占用
- **新增数据库表** - 添加analysis_logs、data_quality_issues、validation_results表
- **数据库表结构自动更新** - 服务器启动时自动更新数据库表结构

### V3.7 (2025-01-09)
- **修复4H趋势显示问题** - 确保4H趋势和市场类型不会返回空值，数据不足时默认返回"震荡市"
- **修复止损止盈价格逻辑** - 确保做空交易时止损价格高于止盈价格，做多交易时止损价格低于止盈价格
- **完善SIGNAL_NONE过滤** - 在服务端和前端都添加了SIGNAL_NONE、NONE、null等无效信号的过滤
- **修复盈亏状态一致性** - 确保有盈亏金额时交易状态为已关闭，添加数据清理功能修复历史记录
- **优化震荡市策略** - 实现1H边界多因子打分和15分钟假突破入场判断
- **数据刷新频率管理** - 实现不同时间级别数据的刷新频率管理（4H每1小时，1H每5分钟，15m每1-3分钟）

### V3.8 (2025-01-09)
- **修复15min信号显示问题** - 解决前端显示"做空_undefined NONE"的问题，完善formatExecution方法处理undefined mode
- **修复executionMode字段赋值** - 确保analyzeRangeExecution中mode字段正确设置为"假突破反手"或"NONE"
- **修复日志显示问题** - 解决日志中显示"模式=undefined"的问题，所有executionMode字段都有默认值
- **增强代码健壮性** - 添加单元测试保障代码质量，防止undefined值导致的显示问题
- **完善错误处理** - 确保所有信号格式化都有适当的默认值处理
