# SmartFlow API参考文档

**版本**: v1.3.0  
**更新时间**: 2025-10-10  
**Base URL**: `https://smart.aimaventop.com/api/v1`

---

## 📋 API概览

所有API响应格式：
```json
{
  "success": true,
  "data": {...},
  "timestamp": "2025-10-10T07:30:00.000Z"
}
```

错误响应格式：
```json
{
  "success": false,
  "error": "错误描述"
}
```

---

## 策略相关API

### 获取策略当前状态

**端点**: `GET /strategies/current-status`

**参数**:
- `limit` (可选): 返回交易对数量，默认20

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "symbol": "BTCUSDT",
      "lastPrice": 121420.5,
      "priceChange24h": -0.0297,
      "timestamp": "2025-10-10T07:30:00.000Z",
      "aiAnalysis": {...},  // AI分析数据
      "v3": {
        "signal": "BUY",
        "timeframes": {
          "4H": {...},
          "1H": {...},
          "15M": {...}
        }
      },
      "ict": {
        "signal": "HOLD",
        "timeframes": {
          "1D": {...},
          "4H": {...},
          "15M": {...}
        }
      }
    }
  ]
}
```

**说明**:
- 实时计算策略判断，不从数据库读取
- 包含AI分析数据（从数据库读取最新记录）
- 前端每5分钟调用一次

---

### 执行V3策略

**端点**: `POST /strategies/v3/execute`

**请求体**:
```json
{
  "symbol": "BTCUSDT"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "symbol": "BTCUSDT",
    "signal": "BUY",
    "timeframes": {
      "4H": {
        "trend": "UP",
        "score": 8,
        "confidence": 0.85
      },
      "1H": {
        "totalScore": 5,
        "factors": {...}
      },
      "15M": {
        "signal": "valid",
        "score": 4
      }
    },
    "entryPrice": 121420.5,
    "stopLoss": 119500.0,
    "takeProfit": 125800.0
  }
}
```

---

### 获取策略统计

**端点**: `GET /strategies/statistics`

**参数**:
- `strategy` (可选): v3 或 ict
- `symbol` (可选): 交易对符号

**响应**:
```json
{
  "success": true,
  "data": {
    "overall": {
      "totalTrades": 45,
      "winningTrades": 28,
      "losingTrades": 17,
      "winRate": 62.22,
      "totalPnl": 1250.5,
      "maxDrawdown": 5.8
    },
    "v3": {...},
    "ict": {...}
  }
}
```

---

## AI分析API

### 获取宏观风险分析

**端点**: `GET /ai/macro-risk`

**参数**:
- `symbols`: 逗号分隔的交易对，如 `BTCUSDT,ETHUSDT`

**响应**:
```json
{
  "success": true,
  "data": {
    "BTCUSDT": {
      "symbol": "BTCUSDT",
      "riskLevel": "WATCH",
      "analysisData": {
        "currentPrice": 121315.1,
        "coreFinding": "BTC市场表现平稳...",
        "confidence": 85,
        "shortTermPrediction": {...},
        "midTermPrediction": {...}
      },
      "realtimePrice": 121420.5,    // 实时价格
      "analysisPrice": 121315.1,    // 分析时价格
      "realtimeTimestamp": "2025-10-10T07:30:00Z",
      "updatedAt": "2025-10-10 15:00:15"
    }
  },
  "lastUpdate": "2025-10-10T07:00:15.464Z"
}
```

**说明**:
- AI分析每小时更新一次
- 返回实时价格和分析时价格
- 用于AI市场风险分析模块

---

### 获取符号趋势分析

**端点**: `GET /ai/symbol-analysis`

**参数**:
- `symbol`: 交易对符号，如 `BTCUSDT`

**响应**:
```json
{
  "success": true,
  "data": {
    "symbol": "BTCUSDT",
    "analysisData": {
      "tradingPair": "BTCUSDT",
      "currentPrice": 121315.1,
      "shortTermTrend": {
        "direction": "up",
        "confidence": 78,
        "priceRange": [120000, 123000],
        "reasoning": "..."
      },
      "midTermTrend": {
        "direction": "up",
        "confidence": 82,
        "priceRange": [119000, 128000],
        "reasoning": "..."
      },
      "overallScore": {
        "4hTrend": 8,
        "1hFactors": 7,
        "15mEntry": 4,
        "totalScore": 75,
        "signalRecommendation": "mediumBuy"
      }
    },
    "confidence": "75.00",
    "updatedAt": "2025-10-10 15:00:15"
  }
}
```

---

## 监控相关API

### 获取系统监控数据

**端点**: `GET /monitoring/system`

**响应**:
```json
{
  "success": true,
  "data": {
    "system": {
      "platform": "linux",
      "arch": "x64",
      "totalMemory": 938045440,
      "freeMemory": 172474368,
      "cpus": 2,
      "uptime": 150458.66,
      "loadAverage": [0.31, 0.2, 0.14]
    },
    "resources": {
      "cpu": 45.2,
      "memory": 81.6,
      "disk": 45
    },
    "apiStats": {
      "rest": {
        "totalRequests": 245,
        "successRequests": 242,
        "failedRequests": 3,
        "successRate": 98.78
      },
      "ws": {
        "totalConnections": 10,
        "activeConnections": 8,
        "failedConnections": 2,
        "successRate": 80.0
      }
    }
  }
}
```

**说明**:
- 系统数据来自VPS真实os模块
- API统计基于过去1小时数据
- 每小时自动重置统计

---

### 获取宏观监控概览

**端点**: `GET /macro-monitor/overview`

**响应**:
```json
{
  "success": true,
  "data": {
    "sentiment": {
      "current": {
        "value": 64,
        "classification": "Greed"
      },
      "latest": [...]
    },
    "fundFlow": {...},
    "futures": {...},
    "macro": {...}
  }
}
```

---

## 交易相关API

### 获取交易记录

**端点**: `GET /trades`

**参数**:
- `limit` (可选): 返回记录数，默认100
- `strategy` (可选): v3 或 ict
- `status` (可选): OPEN 或 CLOSED

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "symbol": "BTCUSDT",
      "strategy_type": "V3",
      "trade_type": "LONG",
      "entry_price": 121420.5,
      "stop_loss": 119500.0,
      "take_profit": 125800.0,
      "quantity": 0.01,
      "leverage": 5,
      "margin_used": 50.25,
      "status": "OPEN",
      "entry_time": "2025-10-10 15:30:00",
      "pnl": null,
      "pnl_percentage": null
    }
  ],
  "count": 1
}
```

---

### 获取交易统计

**端点**: `GET /trades/statistics`

**参数**:
- `strategy` (可选): v3 或 ict
- `symbol` (可选): 交易对符号

**响应**:
```json
{
  "success": true,
  "data": {
    "totalTrades": 45,
    "winningTrades": 28,
    "losingTrades": 17,
    "winRate": 62.22,
    "totalPnl": 1250.5,
    "avgPnl": 27.79,
    "maxDrawdown": 5.8,
    "profitFactor": 2.15
  }
}
```

---

## 数据更新频率

| 数据类型 | API端点 | 更新频率 | 数据来源 |
|---------|---------|---------|---------|
| 策略状态 | `/strategies/current-status` | 实时计算 | Binance API + 策略计算 |
| AI分析 | `/ai/symbol-analysis` | 1小时 | 数据库缓存 |
| 交易记录 | `/trades` | 触发时 | 数据库 |
| 系统监控 | `/monitoring/system` | 实时 | VPS os模块 + API统计 |

---

## 错误码说明

| HTTP状态码 | 说明 |
|-----------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
| 502 | Bad Gateway（通常是服务重启） |

---

## 速率限制

**前端调用**:
- 无严格限制
- 建议间隔至少5秒

**后端调用Binance**:
- 1200次/分钟
- 自动速率限制检查
- 超限抛出错误

---

## 相关文档

- [系统架构](./ARCHITECTURE.md)
- [用户指南](./USER_GUIDE.md)
- [部署指南](./DEPLOYMENT_GUIDE.md)

