# 统一监控中心开发方案

## 项目概述

基于SmartFlow项目现有架构，实现V3策略和ICT策略的统一监控管理，包括数据刷新状态监控、模拟交易数据展示、交易对管理等功能。

## 1. 数据库表结构设计

### 1.1 统一策略监控表

#### strategy_monitoring_stats (策略监控统计表)
```sql
CREATE TABLE strategy_monitoring_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    strategy_type TEXT NOT NULL, -- 'V3' 或 'ICT'
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- 数据收集指标
    data_collection_rate REAL DEFAULT 0, -- 数据采集成功率 (0-100)
    data_collection_attempts INTEGER DEFAULT 0, -- 数据采集尝试次数
    data_collection_successes INTEGER DEFAULT 0, -- 数据采集成功次数
    data_collection_last_time DATETIME, -- 最后采集时间
    
    -- 数据验证指标
    data_validation_status TEXT DEFAULT 'UNKNOWN', -- VALID/INVALID/UNKNOWN
    data_validation_errors INTEGER DEFAULT 0, -- 数据验证错误数
    data_validation_warnings INTEGER DEFAULT 0, -- 数据验证警告数
    data_validation_last_check DATETIME, -- 最后验证时间
    
    -- 模拟交易指标
    simulation_completion_rate REAL DEFAULT 0, -- 模拟交易完成率 (0-100)
    simulation_triggers INTEGER DEFAULT 0, -- 模拟交易触发次数
    simulation_completions INTEGER DEFAULT 0, -- 模拟交易完成次数
    simulation_active_count INTEGER DEFAULT 0, -- 当前活跃模拟交易数
    
    -- 策略特定指标
    strategy_specific_data TEXT, -- JSON格式存储策略特定指标
    
    -- 健康状态
    overall_health TEXT DEFAULT 'UNKNOWN', -- HEALTHY/WARNING/ERROR
    last_error_message TEXT, -- 最后错误信息
    last_error_time DATETIME, -- 最后错误时间
    
    -- 索引
    UNIQUE(symbol, strategy_type, timestamp),
    INDEX idx_strategy_monitoring_symbol_type (symbol, strategy_type),
    INDEX idx_strategy_monitoring_timestamp (timestamp)
);
```

#### data_refresh_status (数据刷新状态表)
```sql
CREATE TABLE data_refresh_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    strategy_type TEXT NOT NULL, -- 'V3' 或 'ICT'
    data_type TEXT NOT NULL, -- '4h_trend', '1h_scoring', '15m_entry', 'daily_trend', 'mtf_analysis', 'ltf_analysis'
    last_refresh DATETIME,
    next_refresh DATETIME,
    should_refresh BOOLEAN DEFAULT TRUE,
    refresh_interval INTEGER DEFAULT 3600, -- 刷新间隔(秒)
    refresh_attempts INTEGER DEFAULT 0, -- 刷新尝试次数
    refresh_successes INTEGER DEFAULT 0, -- 刷新成功次数
    last_error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- 索引
    UNIQUE(symbol, strategy_type, data_type),
    INDEX idx_data_refresh_symbol_type (symbol, strategy_type),
    INDEX idx_data_refresh_should_refresh (should_refresh)
);
```

#### unified_simulations (统一模拟交易表)
```sql
CREATE TABLE unified_simulations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    strategy_type TEXT NOT NULL, -- 'V3' 或 'ICT'
    entry_price REAL NOT NULL,
    stop_loss_price REAL NOT NULL,
    take_profit_price REAL NOT NULL,
    max_leverage INTEGER NOT NULL,
    min_margin REAL NOT NULL,
    stop_loss_distance REAL,
    atr_value REAL,
    direction TEXT NOT NULL, -- 'LONG' 或 'SHORT'
    status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'CLOSED', 'CANCELLED'
    trigger_reason TEXT NOT NULL,
    execution_mode TEXT,
    market_type TEXT,
    setup_candle_high REAL,
    setup_candle_low REAL,
    atr14 REAL,
    time_in_position INTEGER DEFAULT 0,
    max_time_in_position INTEGER DEFAULT 48,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME,
    exit_price REAL,
    exit_reason TEXT,
    is_win BOOLEAN,
    profit_loss REAL,
    cache_version INTEGER DEFAULT 1,
    last_updated DATETIME,
    
    -- 索引
    INDEX idx_unified_simulations_symbol (symbol),
    INDEX idx_unified_simulations_strategy (strategy_type),
    INDEX idx_unified_simulations_status (status),
    INDEX idx_unified_simulations_created (created_at)
);
```

#### monitoring_alerts (监控告警表)
```sql
CREATE TABLE monitoring_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    strategy_type TEXT NOT NULL, -- 'V3' 或 'ICT'
    alert_type TEXT NOT NULL, -- 'DATA_QUALITY', 'DATA_VALIDATION', 'DATA_COLLECTION', 'SIMULATION_ERROR'
    severity TEXT NOT NULL, -- 'HIGH', 'MEDIUM', 'LOW'
    message TEXT NOT NULL,
    details TEXT, -- JSON格式存储详细信息
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- 索引
    INDEX idx_monitoring_alerts_symbol_strategy (symbol, strategy_type),
    INDEX idx_monitoring_alerts_type (alert_type),
    INDEX idx_monitoring_alerts_severity (severity),
    INDEX idx_monitoring_alerts_resolved (resolved),
    INDEX idx_monitoring_alerts_created (created_at)
);
```

### 1.2 策略特定表扩展

#### 扩展 strategy_analysis 表
```sql
-- 添加策略类型字段
ALTER TABLE strategy_analysis ADD COLUMN strategy_type TEXT DEFAULT 'V3';
ALTER TABLE strategy_analysis ADD COLUMN unified_monitoring_data TEXT; -- JSON格式统一监控数据

-- 添加索引
CREATE INDEX idx_strategy_analysis_strategy_type ON strategy_analysis(strategy_type);
```

#### 扩展 ict_strategy_analysis 表
```sql
-- 添加统一监控数据字段
ALTER TABLE ict_strategy_analysis ADD COLUMN unified_monitoring_data TEXT; -- JSON格式统一监控数据

-- 确保策略类型字段存在
ALTER TABLE ict_strategy_analysis ADD COLUMN strategy_type TEXT DEFAULT 'ICT';
```

## 2. 服务端API设计

### 2.1 统一监控中心API

#### GET /api/unified-monitoring/dashboard
获取统一监控中心数据
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalSymbols": 16,
      "v3Strategy": {
        "healthySymbols": 8,
        "warningSymbols": 4,
        "errorSymbols": 2,
        "totalErrors": 12
      },
      "ictStrategy": {
        "healthySymbols": 6,
        "warningSymbols": 6,
        "errorSymbols": 2,
        "totalErrors": 8
      },
      "overallHealth": "WARNING"
    },
    "completionRates": {
      "v3Strategy": {
        "dataCollection": 95.5,
        "dataValidation": 98.2,
        "simulationTrading": 100.0
      },
      "ictStrategy": {
        "dataCollection": 92.3,
        "dataValidation": 96.8,
        "simulationTrading": 100.0
      }
    },
    "detailedStats": [
      {
        "symbol": "BTCUSDT",
        "v3Strategy": {
          "dataCollection": { "rate": 95.5, "attempts": 100, "successes": 95 },
          "dataValidation": { "status": "VALID", "errors": 0, "warnings": 2 },
          "simulationCompletion": { "rate": 100, "triggers": 10, "completions": 10 }
        },
        "ictStrategy": {
          "dataCollection": { "rate": 92.3, "attempts": 100, "successes": 92 },
          "dataValidation": { "status": "VALID", "errors": 0, "warnings": 1 },
          "simulationCompletion": { "rate": 100, "triggers": 8, "completions": 8 }
        }
      }
    ],
    "recentAlerts": [
      {
        "id": 1,
        "symbol": "BTCUSDT",
        "strategyType": "V3",
        "alertType": "DATA_QUALITY",
        "severity": "MEDIUM",
        "message": "数据采集率低于阈值",
        "createdAt": "2025-01-15T10:30:00.000Z"
      }
    ]
  }
}
```

#### GET /api/unified-monitoring/symbol/:symbol
获取指定交易对的详细监控数据
```json
{
  "success": true,
  "data": {
    "symbol": "BTCUSDT",
    "v3Strategy": {
      "dataCollection": { "rate": 95.5, "lastUpdate": "2025-01-15T10:30:00.000Z" },
      "dataValidation": { "status": "VALID", "lastCheck": "2025-01-15T10:25:00.000Z" },
      "simulationCompletion": { "rate": 100, "activeCount": 2 }
    },
    "ictStrategy": {
      "dataCollection": { "rate": 92.3, "lastUpdate": "2025-01-15T10:30:00.000Z" },
      "dataValidation": { "status": "VALID", "lastCheck": "2025-01-15T10:25:00.000Z" },
      "simulationCompletion": { "rate": 100, "activeCount": 1 }
    }
  }
}
```

### 2.2 数据刷新状态API

#### GET /api/data-refresh/status
获取所有交易对的数据刷新状态
```json
{
  "success": true,
  "data": {
    "v3Strategy": {
      "BTCUSDT": {
        "4h_trend": {
          "shouldRefresh": false,
          "lastRefresh": "2025-01-15T08:00:00.000Z",
          "nextRefresh": "2025-01-15T12:00:00.000Z",
          "refreshInterval": 14400
        },
        "1h_scoring": {
          "shouldRefresh": true,
          "lastRefresh": "2025-01-15T10:00:00.000Z",
          "nextRefresh": "2025-01-15T11:00:00.000Z",
          "refreshInterval": 3600
        },
        "15m_entry": {
          "shouldRefresh": true,
          "lastRefresh": "2025-01-15T10:45:00.000Z",
          "nextRefresh": "2025-01-15T11:00:00.000Z",
          "refreshInterval": 900
        }
      }
    },
    "ictStrategy": {
      "BTCUSDT": {
        "daily_trend": {
          "shouldRefresh": false,
          "lastRefresh": "2025-01-15T00:00:00.000Z",
          "nextRefresh": "2025-01-16T00:00:00.000Z",
          "refreshInterval": 86400
        },
        "mtf_analysis": {
          "shouldRefresh": true,
          "lastRefresh": "2025-01-15T08:00:00.000Z",
          "nextRefresh": "2025-01-15T12:00:00.000Z",
          "refreshInterval": 14400
        },
        "ltf_analysis": {
          "shouldRefresh": true,
          "lastRefresh": "2025-01-15T10:45:00.000Z",
          "nextRefresh": "2025-01-15T11:00:00.000Z",
          "refreshInterval": 900
        }
      }
    }
  }
}
```

#### POST /api/data-refresh/force-refresh/:symbol
强制刷新指定交易对的数据
```json
{
  "strategyType": "V3", // 可选，不指定则刷新所有策略
  "dataType": "4h_trend" // 可选，不指定则刷新所有数据类型
}
```

### 2.3 统一模拟交易API

#### GET /api/unified-simulations/history
获取统一模拟交易历史
```json
{
  "success": true,
  "data": {
    "simulations": [
      {
        "id": 1,
        "symbol": "BTCUSDT",
        "strategyType": "V3",
        "entryPrice": 45000.50,
        "stopLoss": 44000.00,
        "takeProfit": 47000.00,
        "direction": "LONG",
        "status": "CLOSED",
        "profitLoss": 1000.50,
        "createdAt": "2025-01-15T10:30:00.000Z"
      },
      {
        "id": 2,
        "symbol": "ETHUSDT",
        "strategyType": "ICT",
        "entryPrice": 3000.25,
        "stopLoss": 2950.00,
        "takeProfit": 3100.00,
        "direction": "SHORT",
        "status": "ACTIVE",
        "profitLoss": null,
        "createdAt": "2025-01-15T11:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "pageSize": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

#### GET /api/unified-simulations/stats
获取统一模拟交易统计
```json
{
  "success": true,
  "data": {
    "overall": {
      "totalTrades": 100,
      "winningTrades": 60,
      "losingTrades": 40,
      "winRate": 60.0,
      "netProfit": 5000.50
    },
    "byStrategy": {
      "V3": {
        "totalTrades": 70,
        "winningTrades": 45,
        "losingTrades": 25,
        "winRate": 64.3,
        "netProfit": 3500.25
      },
      "ICT": {
        "totalTrades": 30,
        "winningTrades": 15,
        "losingTrades": 15,
        "winRate": 50.0,
        "netProfit": 1500.25
      }
    },
    "bySymbol": [
      {
        "symbol": "BTCUSDT",
        "v3Strategy": { "totalTrades": 20, "winRate": 65.0, "netProfit": 1000.00 },
        "ictStrategy": { "totalTrades": 10, "winRate": 60.0, "netProfit": 500.00 }
      }
    ]
  }
}
```

### 2.4 交易对管理API

#### GET /api/symbol-management/stats
获取交易对管理统计
```json
{
  "success": true,
  "data": {
    "totalSymbols": 16,
    "byStrategy": {
      "V3": {
        "totalSymbols": 16,
        "healthySymbols": 8,
        "warningSymbols": 4,
        "errorSymbols": 2,
        "dataCollectionRate": 95.5,
        "simulationCompletionRate": 100.0
      },
      "ICT": {
        "totalSymbols": 16,
        "healthySymbols": 6,
        "warningSymbols": 6,
        "errorSymbols": 2,
        "dataCollectionRate": 92.3,
        "simulationCompletionRate": 100.0
      }
    },
    "byCategory": {
      "mainstream": {
        "symbols": ["BTCUSDT", "ETHUSDT"],
        "v3Strategy": { "count": 2, "avgDataCollectionRate": 98.5 },
        "ictStrategy": { "count": 2, "avgDataCollectionRate": 95.0 }
      },
      "trending": {
        "symbols": ["SOLUSDT", "ADAUSDT"],
        "v3Strategy": { "count": 2, "avgDataCollectionRate": 92.0 },
        "ictStrategy": { "count": 2, "avgDataCollectionRate": 90.0 }
      }
    }
  }
}
```

### 2.5 监控告警API

#### GET /api/monitoring/alerts
获取监控告警列表
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": 1,
        "symbol": "BTCUSDT",
        "strategyType": "V3",
        "alertType": "DATA_QUALITY",
        "severity": "MEDIUM",
        "message": "数据采集率低于阈值",
        "details": { "currentRate": 85.5, "threshold": 90.0 },
        "resolved": false,
        "createdAt": "2025-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "pageSize": 20,
      "total": 50,
      "totalPages": 3
    }
  }
}
```

#### POST /api/monitoring/alerts/:id/resolve
解决指定告警
```json
{
  "success": true,
  "message": "告警已解决"
}
```

## 3. 前端页面设计

### 3.1 统一监控中心页面 (monitoring.html)
- 合并数据刷新状态功能
- 分别展示V3和ICT策略的监控数据
- 交易对详细监控表格增加策略列
- 告警明细支持策略过滤

### 3.2 模拟交易数据页面 (simulation-data.html)
- 增加策略列显示
- 支持按策略筛选
- 统一展示V3和ICT策略的模拟交易数据

### 3.3 交易对管理页面 (symbol-management.html)
- 分别展示V3和ICT策略的交易统计
- 按策略分类显示交易对健康状态

## 4. 实现优先级

### Phase 1: 数据库表结构
1. 创建统一监控相关表
2. 扩展现有表结构
3. 数据迁移脚本

### Phase 2: 服务端API
1. 统一监控中心API
2. 数据刷新状态API
3. 统一模拟交易API

### Phase 3: 前端页面
1. 监控中心页面合并
2. 模拟交易页面增强
3. 交易对管理页面优化

### Phase 4: 测试和部署
1. 单元测试
2. 集成测试
3. VPS部署验证

## 5. 技术要点

### 5.1 性能优化
- 数据库索引优化
- 缓存策略设计
- 批量查询优化

### 5.2 数据一致性
- 事务处理
- 数据同步机制
- 错误恢复策略

### 5.3 监控告警
- 实时监控
- 告警分级
- 自动恢复机制

## 6. 风险评估

### 6.1 数据迁移风险
- 现有数据兼容性
- 数据丢失风险
- 回滚方案

### 6.2 性能风险
- 数据库查询性能
- 内存使用增加
- 响应时间延长

### 6.3 功能风险
- 现有功能影响
- 新功能稳定性
- 用户体验变化

## 7. 成功标准

1. 监控中心数据正常显示
2. 数据刷新状态功能完整
3. 模拟交易数据统一展示
4. 交易对管理功能增强
5. 所有单测通过
6. VPS部署成功运行
