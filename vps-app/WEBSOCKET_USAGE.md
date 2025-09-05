# WebSocket 使用说明

## 概述

本应用集成了 Binance WebSocket API 用于实时计算 CVD (Cumulative Volume Delta) 数据，这是多周期共振交易策略的重要组成部分。

## WebSocket 连接

### 连接端点
- **生产环境**: `wss://fstream.binance.com/ws/{symbol}@aggTrade`
- **测试环境**: `wss://testnet.binancefuture.com/ws-fapi/v1`

### 支持的交易对
- BTCUSDT
- ETHUSDT  
- LINKUSDT
- LDOUSDT
- SOLUSDT

## API 端点

### 1. WebSocket 状态监控
```bash
GET /api/websocket-status
```

**响应示例**:
```json
{
  "timestamp": "2025-01-07T12:00:00.000Z",
  "websocketStatus": {
    "BTCUSDT": {
      "connected": true,
      "cvd": {
        "cvd": 1234.56,
        "direction": "CVD(+)",
        "isActive": true,
        "tradeCount": 1500,
        "lastUpdate": 1704628800000
      },
      "readyState": 1
    }
  },
  "summary": {
    "total": 5,
    "connected": 5,
    "disconnected": 0
  }
}
```

### 2. 综合测试 (包含 WebSocket 状态)
```bash
GET /api/test
```

**响应示例**:
```json
{
  "timestamp": "2025-01-07T12:00:00.000Z",
  "tests": [
    {
      "test": "K线数据",
      "status": "PASS",
      "data": "5 条记录"
    },
    {
      "test": "WebSocket BTCUSDT",
      "status": "PASS", 
      "data": "CVD: CVD(+), 交易数: 1500"
    }
  ],
  "summary": {
    "total": 8,
    "passed": 8,
    "failed": 0
  },
  "websocketStatus": { ... }
}
```

## CVD 数据说明

### 计算逻辑
- **买方主动成交**: CVD += 成交量
- **卖方主动成交**: CVD -= 成交量
- **判断依据**: `trade.m` 字段 (true = 卖方主动)

### 数据更新频率
- 实时更新，每笔交易都会更新 CVD 值
- 30秒内无更新视为连接失效
- 每1000笔交易输出一次状态日志

### 连接管理
- 自动重连机制 (断开后5秒重连)
- Ping/Pong 心跳保持连接
- 优雅关闭处理

## 测试工具

### 1. WebSocket 连接测试
```bash
node test-websocket.js
```

### 2. 部署更新
```bash
bash deploy-updated.sh
```

## 故障排除

### 常见问题

1. **WebSocket 连接失败**
   - 检查网络连接
   - 确认 Binance API 可访问
   - 查看防火墙设置

2. **CVD 数据不更新**
   - 检查 WebSocket 连接状态
   - 确认交易对是否活跃
   - 查看应用日志

3. **连接频繁断开**
   - 检查网络稳定性
   - 确认服务器资源充足
   - 查看 Binance API 限制

### 监控命令

```bash
# 查看 PM2 状态
pm2 status

# 查看应用日志
pm2 logs smartflow-app

# 测试健康检查
curl http://localhost:8080/health

# 测试 WebSocket 状态
curl http://localhost:8080/api/websocket-status
```

## 性能优化

### 建议配置
- 服务器内存: 至少 1GB
- CPU: 2核心以上
- 网络: 稳定的互联网连接
- 监控: 定期检查连接状态

### 资源使用
- WebSocket 连接数: 5个 (每个交易对1个)
- 内存使用: 约 50-100MB
- CPU 使用: 低 (仅在数据更新时)

## 安全注意事项

1. **API 限制**: 遵守 Binance API 使用限制
2. **连接管理**: 避免创建过多连接
3. **错误处理**: 实现适当的重连机制
4. **监控**: 定期检查连接状态

## 更新日志

- **v1.0.0**: 初始 WebSocket 集成
- **v1.1.0**: 添加连接状态监控
- **v1.2.0**: 优化重连机制和错误处理
