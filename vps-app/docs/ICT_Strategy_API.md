# ICT策略API文档

## 概述

ICT策略API提供了完整的加密货币交易策略分析服务，包括信号分析、风险管理、数据存储和模拟交易等功能。

**基础URL**: `https://smart.aimaventop.com`

**API版本**: v1.0

**认证方式**: 无需认证（公开API）

## 通用响应格式

### 成功响应
```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

### 错误响应
```json
{
  "success": false,
  "error": "错误信息",
  "code": "ERROR_CODE",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

## API端点

### 1. 获取ICT信号列表

**端点**: `GET /api/ict/signals`

**描述**: 获取所有交易对的ICT策略分析结果

**请求参数**:
- 无

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "symbol": "BTCUSDT",
      "category": "mainstream",
      "dailyTrend": "up",
      "dailyTrendScore": 3,
      "signalType": "LONG",
      "signalStrength": "STRONG",
      "executionMode": "IMMEDIATE",
      "obDetected": true,
      "fvgDetected": false,
      "engulfingDetected": true,
      "sweepLTF": true,
      "volumeConfirm": true,
      "entryPrice": 45000.50,
      "stopLoss": 44000.00,
      "takeProfit": 47000.00,
      "riskRewardRatio": 3.0,
      "dataCollectionRate": 100.0,
      "timestamp": "2025-01-15T10:30:00.000Z",
      "strategyVersion": "ICT",
      "dataValid": true,
      "errorMessage": null
    }
  ],
  "message": "ICT信号获取成功",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

**字段说明**:
- `symbol`: 交易对名称
- `category`: 币种分类 (mainstream/trending/smallcap/high-cap-trending)
- `dailyTrend`: 1D趋势 (up/down/sideways)
- `dailyTrendScore`: 1D趋势得分 (0-3)
- `signalType`: 信号类型 (LONG/SHORT/NONE)
- `signalStrength`: 信号强度 (STRONG/MODERATE/WEAK)
- `executionMode`: 执行模式 (IMMEDIATE/DELAYED/NONE)
- `obDetected`: 4H订单块检测结果
- `fvgDetected`: 4H失衡区检测结果
- `engulfingDetected`: 15m吞没形态检测
- `sweepLTF`: 15m Sweep检测
- `volumeConfirm`: 成交量确认
- `entryPrice`: 入场价格
- `stopLoss`: 止损价格
- `takeProfit`: 止盈价格
- `riskRewardRatio`: 风险回报比
- `dataCollectionRate`: 数据采集率 (%)
- `strategyVersion`: 策略版本
- `dataValid`: 数据有效性
- `errorMessage`: 错误信息

### 2. 获取单个交易对ICT分析

**端点**: `GET /api/ict/signals/:symbol`

**描述**: 获取指定交易对的ICT策略分析结果

**路径参数**:
- `symbol` (string, 必需): 交易对名称，如 "BTCUSDT"

**请求示例**:
```
GET /api/ict/signals/BTCUSDT
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "symbol": "BTCUSDT",
    "category": "mainstream",
    "dailyTrend": "up",
    "dailyTrendScore": 3,
    "signalType": "LONG",
    "signalStrength": "STRONG",
    "executionMode": "IMMEDIATE",
    "obDetected": true,
    "fvgDetected": false,
    "engulfingDetected": true,
    "sweepLTF": true,
    "volumeConfirm": true,
    "entryPrice": 45000.50,
    "stopLoss": 44000.00,
    "takeProfit": 47000.00,
    "riskRewardRatio": 3.0,
    "dataCollectionRate": 100.0,
    "timestamp": "2025-01-15T10:30:00.000Z",
    "strategyVersion": "ICT",
    "dataValid": true,
    "errorMessage": null
  },
  "message": "BTCUSDT ICT分析获取成功",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

### 3. 创建ICT模拟交易

**端点**: `POST /api/ict/simulation/create`

**描述**: 基于ICT信号创建模拟交易

**请求体**:
```json
{
  "symbol": "BTCUSDT",
  "entryPrice": 45000.50,
  "stopLoss": 44000.00,
  "takeProfit": 47000.00,
  "signalType": "LONG",
  "executionMode": "IMMEDIATE",
  "strategy": "ICT"
}
```

**字段说明**:
- `symbol` (string, 必需): 交易对名称
- `entryPrice` (number, 必需): 入场价格
- `stopLoss` (number, 必需): 止损价格
- `takeProfit` (number, 必需): 止盈价格
- `signalType` (string, 必需): 信号类型 (LONG/SHORT)
- `executionMode` (string, 可选): 执行模式
- `strategy` (string, 可选): 策略类型，默认为 "ICT"

**响应示例**:
```json
{
  "success": true,
  "data": {
    "simulationId": "ict_sim_12345",
    "symbol": "BTCUSDT",
    "strategy": "ICT",
    "signalType": "LONG",
    "entryPrice": 45000.50,
    "stopLoss": 44000.00,
    "takeProfit": 47000.00,
    "status": "ACTIVE",
    "createdAt": "2025-01-15T10:30:00.000Z"
  },
  "message": "ICT模拟交易创建成功",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

### 4. 获取ICT模拟交易历史

**端点**: `GET /api/ict/simulation/history`

**描述**: 获取ICT策略的模拟交易历史记录

**查询参数**:
- `symbol` (string, 可选): 过滤指定交易对
- `status` (string, 可选): 过滤交易状态 (ACTIVE/CLOSED/CANCELLED)
- `page` (number, 可选): 页码，默认为1
- `limit` (number, 可选): 每页数量，默认为20

**请求示例**:
```
GET /api/ict/simulation/history?symbol=BTCUSDT&status=ACTIVE&page=1&limit=10
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "simulations": [
      {
        "id": "ict_sim_12345",
        "symbol": "BTCUSDT",
        "strategy": "ICT",
        "signalType": "LONG",
        "entryPrice": 45000.50,
        "stopLoss": 44000.00,
        "takeProfit": 47000.00,
        "status": "ACTIVE",
        "createdAt": "2025-01-15T10:30:00.000Z",
        "closedAt": null,
        "exitPrice": null,
        "profitLoss": null,
        "exitReason": null
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalCount": 50,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "message": "ICT模拟交易历史获取成功",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

### 5. 获取ICT统计数据

**端点**: `GET /api/ict/stats`

**描述**: 获取ICT策略的统计信息

**响应示例**:
```json
{
  "success": true,
  "data": {
    "totalAnalysis": 150,
    "latestAnalysis": 22,
    "longSignals": 8,
    "shortSignals": 3,
    "noSignals": 11,
    "averageWinRate": 0.75,
    "averageRR": 2.8,
    "dataCollectionRate": 98.5,
    "lastUpdate": "2025-01-15T10:30:00.000Z"
  },
  "message": "ICT统计数据获取成功",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

### 6. 获取ICT分析详情

**端点**: `GET /api/ict/analysis/:symbol`

**描述**: 获取指定交易对的详细ICT分析过程

**路径参数**:
- `symbol` (string, 必需): 交易对名称

**响应示例**:
```json
{
  "success": true,
  "data": {
    "symbol": "BTCUSDT",
    "analysisSteps": {
      "dailyTrend": {
        "trend": "up",
        "score": 3,
        "confidence": 0.85,
        "priceChange": 0.025,
        "movingAverage": 44500.00
      },
      "mtfAnalysis": {
        "obDetected": true,
        "obHeight": 500.00,
        "obAge": 2.5,
        "fvgDetected": false,
        "sweepHTF": true,
        "sweepSpeed": 0.45
      },
      "ltfAnalysis": {
        "engulfingDetected": true,
        "engulfingRatio": 1.8,
        "sweepLTF": true,
        "sweepSpeed": 0.25,
        "volumeConfirm": true,
        "volumeRatio": 1.3
      }
    },
    "riskManagement": {
      "entryPrice": 45000.50,
      "stopLoss": 44000.00,
      "takeProfit": 47000.00,
      "stopDistance": 1000.50,
      "stopDistancePercent": 2.22,
      "riskRewardRatio": 3.0,
      "positionSize": 0.1,
      "margin": 900.01
    },
    "technicalIndicators": {
      "atr4h": 800.00,
      "atr15m": 200.00,
      "currentPrice": 45000.50,
      "volume": 1500000
    },
    "timestamp": "2025-01-15T10:30:00.000Z"
  },
  "message": "BTCUSDT ICT分析详情获取成功",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

## 错误代码

| 错误代码 | HTTP状态码 | 描述 |
|---------|-----------|------|
| `INVALID_SYMBOL` | 400 | 无效的交易对名称 |
| `SYMBOL_NOT_FOUND` | 404 | 交易对不存在 |
| `ANALYSIS_FAILED` | 500 | ICT分析失败 |
| `DATA_UNAVAILABLE` | 503 | 数据不可用 |
| `RATE_LIMIT_EXCEEDED` | 429 | 请求频率超限 |
| `INTERNAL_ERROR` | 500 | 内部服务器错误 |

## 请求限制

### 频率限制
- 每个IP每分钟最多100次请求
- 每个IP每小时最多1000次请求

### 数据限制
- 单次请求最多返回1000条记录
- 历史数据查询最多返回30天的数据

## 使用示例

### JavaScript (Fetch API)

```javascript
// 获取所有ICT信号
async function getICTSignals() {
  try {
    const response = await fetch('/api/ict/signals');
    const data = await response.json();
    
    if (data.success) {
      console.log('ICT信号:', data.data);
      return data.data;
    } else {
      console.error('获取失败:', data.error);
    }
  } catch (error) {
    console.error('请求错误:', error);
  }
}

// 创建ICT模拟交易
async function createICTSimulation(symbol, entryPrice, stopLoss, takeProfit, signalType) {
  try {
    const response = await fetch('/api/ict/simulation/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        symbol,
        entryPrice,
        stopLoss,
        takeProfit,
        signalType,
        strategy: 'ICT'
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('模拟交易创建成功:', data.data);
      return data.data;
    } else {
      console.error('创建失败:', data.error);
    }
  } catch (error) {
    console.error('请求错误:', error);
  }
}
```

### Python (requests)

```python
import requests
import json

# 获取所有ICT信号
def get_ict_signals():
    try:
        response = requests.get('https://smart.aimaventop.com/api/ict/signals')
        data = response.json()
        
        if data['success']:
            print('ICT信号:', data['data'])
            return data['data']
        else:
            print('获取失败:', data['error'])
    except Exception as e:
        print('请求错误:', e)

# 创建ICT模拟交易
def create_ict_simulation(symbol, entry_price, stop_loss, take_profit, signal_type):
    try:
        payload = {
            'symbol': symbol,
            'entryPrice': entry_price,
            'stopLoss': stop_loss,
            'takeProfit': take_profit,
            'signalType': signal_type,
            'strategy': 'ICT'
        }
        
        response = requests.post(
            'https://smart.aimaventop.com/api/ict/simulation/create',
            headers={'Content-Type': 'application/json'},
            data=json.dumps(payload)
        )
        
        data = response.json()
        
        if data['success']:
            print('模拟交易创建成功:', data['data'])
            return data['data']
        else:
            print('创建失败:', data['error'])
    except Exception as e:
        print('请求错误:', e)
```

### cURL

```bash
# 获取所有ICT信号
curl -X GET "https://smart.aimaventop.com/api/ict/signals"

# 获取指定交易对ICT分析
curl -X GET "https://smart.aimaventop.com/api/ict/signals/BTCUSDT"

# 创建ICT模拟交易
curl -X POST "https://smart.aimaventop.com/api/ict/simulation/create" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTCUSDT",
    "entryPrice": 45000.50,
    "stopLoss": 44000.00,
    "takeProfit": 47000.00,
    "signalType": "LONG",
    "strategy": "ICT"
  }'

# 获取ICT模拟交易历史
curl -X GET "https://smart.aimaventop.com/api/ict/simulation/history?symbol=BTCUSDT&page=1&limit=10"

# 获取ICT统计数据
curl -X GET "https://smart.aimaventop.com/api/ict/stats"
```

## 数据更新频率

- **ICT信号分析**: 每15分钟更新一次
- **统计数据**: 每5分钟更新一次
- **模拟交易状态**: 实时更新

## 注意事项

1. **数据延迟**: 由于网络延迟和数据处理时间，API返回的数据可能有1-2分钟的延迟
2. **数据准确性**: 所有价格数据基于Binance现货市场，仅供参考
3. **风险提示**: 本API仅提供分析结果，不构成投资建议
4. **服务可用性**: 服务可能因维护或技术问题暂时不可用

## 技术支持

如有问题或建议，请联系：
- 邮箱: support@smartflow.com
- 文档更新: 2025-01-15

---

*本文档基于ICT策略API v1.0，最后更新：2025-01-15*
