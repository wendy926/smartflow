# Binance API接口使用报告

## 📡 使用的API接口

### 1. K线数据接口

**接口地址：**
```
GET https://fapi.binance.com/fapi/v1/klines
```

**接口类型：** Binance Futures API (合约交易)

**参数说明：**
- `symbol`: 交易对，如 BTCUSDT
- `interval`: 时间间隔，支持 1h, 4h, 1d 等
- `limit`: 返回数据条数，最大1000条
- `startTime`: 开始时间（可选，毫秒时间戳）
- `endTime`: 结束时间（可选，毫秒时间戳）

**代码实现：**
```javascript
async getKlines(symbol, interval, limit = 100, startTime = null, endTime = null) {
  const params = {
    symbol: symbol.toUpperCase(),
    interval,
    limit
  };

  if (startTime) params.startTime = startTime;
  if (endTime) params.endTime = endTime;

  const response = await axios.get(`${this.baseURL}/fapi/v1/klines`, { params });
  return response.data;
}
```

**调用示例：**
```javascript
// 获取BTCUSDT的1h K线数据，最多1000条
const klines = await binanceAPI.getKlines('BTCUSDT', '1h', 1000);

// 获取指定时间范围的K线数据
const klines = await binanceAPI.getKlines(
  'BTCUSDT', 
  '1h', 
  1000, 
  1698768000000, // startTime
  1701359999999  // endTime
);
```

## 📊 数据格式

### K线数据返回格式

Binance API返回的K线数据是一个二维数组，每个元素包含12个字段：

```javascript
[
  [
    1499040000000,      // 0: 开盘时间 (open_time)
    "0.01634790",       // 1: 开盘价 (open_price)
    "0.80000000",       // 2: 最高价 (high_price)
    "0.01575800",       // 3: 最低价 (low_price)
    "0.01577100",       // 4: 收盘价 (close_price)
    "148976.11427815",  // 5: 成交量 (volume)
    1499644799999,      // 6: 收盘时间 (close_time)
    "2434.19055334",    // 7: 成交额 (quote_volume)
    308,                // 8: 成交笔数 (trades_count)
    "1756.87402397",    // 9: 主动买入成交量 (taker_buy_volume)
    "28.46694368",      // 10: 主动买入成交额 (taker_buy_quote_volume)
    "0"                 // 11: 忽略
  ],
  // ... 更多K线数据
]
```

### 数据映射到数据库

```javascript
const values = [
  symbol,                                    // symbol
  timeframe,                                 // timeframe
  new Date(kline[0]),                        // open_time
  new Date(kline[6]),                        // close_time
  parseFloat(kline[1]),                      // open_price
  parseFloat(kline[2]),                      // high_price
  parseFloat(kline[3]),                      // low_price
  parseFloat(kline[4]),                      // close_price
  parseFloat(kline[5]),                      // volume
  parseFloat(kline[7]),                      // quote_volume
  parseInt(kline[8]),                        // trades_count
  parseFloat(kline[9]),                      // taker_buy_volume
  parseFloat(kline[10])                      // taker_buy_quote_volume
];
```

## 🔧 技术细节

### 1. API基础配置

```javascript
class BinanceAPI {
  constructor() {
    this.baseURL = 'https://fapi.binance.com';        // 合约交易API
    this.wsBaseURL = 'wss://fstream.binance.com';     // WebSocket地址
    this.rateLimit = 1200;                             // 每分钟请求限制
  }
}
```

### 2. 限流控制

```javascript
checkRateLimit() {
  const now = Date.now();
  const elapsed = now - this.lastResetTime;
  
  // 每分钟重置计数器
  if (elapsed >= 60000) {
    this.requestCount = 0;
    this.lastResetTime = now;
  }
  
  // 检查是否超过限制
  if (this.requestCount >= this.rateLimit) {
    const waitTime = 60000 - elapsed;
    throw new Error(`API请求频率限制，请等待${Math.ceil(waitTime / 1000)}秒`);
  }
  
  this.requestCount++;
}
```

### 3. 批次获取逻辑

```javascript
async fetch180DaysData(symbol, timeframe) {
  const endTime = Date.now();
  const startTime = endTime - (180 * 24 * 60 * 60 * 1000);
  
  const allKlines = [];
  let currentStartTime = startTime;
  let batchCount = 0;
  const maxBatches = 20;

  while (currentStartTime < endTime && batchCount < maxBatches) {
    // 单次最多获取1000条
    const klines = await this.binanceAPI.getKlines(
      symbol, 
      timeframe, 
      1000, 
      currentStartTime
    );

    if (!klines || klines.length === 0) break;

    allKlines.push(...klines);
    batchCount++;

    // 更新下次请求的起始时间
    const lastKlineTime = klines[klines.length - 1][0];
    const intervalMs = this.getIntervalMs(timeframe);
    currentStartTime = lastKlineTime + intervalMs;

    // 避免API限流，延迟100ms
    await this.delay(100);
  }

  return allKlines;
}
```

## 📈 API限制

### 1. 请求频率限制
- **REST API**: 每分钟1200次请求
- **权重限制**: 每个请求有不同的权重
- **IP限制**: 每个IP地址的限制

### 2. 数据限制
- **单次请求**: 最多返回1000条K线数据
- **时间范围**: 无限制
- **历史数据**: 支持获取历史数据

### 3. 时间间隔支持
- **1m**: 1分钟
- **3m**: 3分钟
- **5m**: 5分钟
- **15m**: 15分钟
- **30m**: 30分钟
- **1h**: 1小时
- **2h**: 2小时
- **4h**: 4小时
- **6h**: 6小时
- **8h**: 8小时
- **12h**: 12小时
- **1d**: 1天
- **3d**: 3天
- **1w**: 1周
- **1M**: 1月

## 🎯 优化建议

### 1. 缓存策略
- 使用Redis缓存常用数据
- 减少重复API调用
- 提高响应速度

### 2. 并发控制
- 限制并发请求数
- 使用队列管理请求
- 避免触发限流

### 3. 错误处理
- 实现重试机制
- 记录失败请求
- 提供降级方案

### 4. 数据压缩
- 压缩存储历史数据
- 减少数据库空间占用
- 提高查询效率

## 📝 使用示例

### 获取180天1h数据

```javascript
const MarketDataPreloader = require('./src/services/market-data-preloader');
const database = require('./src/database/connection');

async function preloadData() {
  await database.connect();
  
  const preloader = new MarketDataPreloader(database);
  
  // 预加载BTCUSDT和ETHUSDT的1h数据
  const result = await preloader.preloadAllData(
    ['BTCUSDT', 'ETHUSDT'],
    ['1h']
  );
  
  console.log('预加载结果:', result);
}

preloadData();
```

### API调用统计

```javascript
const stats = binanceAPI.getStats();

console.log('API统计:', {
  totalRequests: stats.rest.totalRequests,
  successRequests: stats.rest.successRequests,
  failedRequests: stats.rest.failedRequests,
  successRate: `${stats.rest.successRate}%`
});
```

## ✅ 总结

**使用的Binance API接口：**
- **接口**: `GET /fapi/v1/klines`
- **类型**: Binance Futures API (合约交易)
- **用途**: 获取K线历史数据
- **限制**: 单次最多1000条
- **频率**: 每分钟1200次请求

**数据获取策略：**
- 批次获取，每次1000条
- 自动处理时间范围
- 避免API限流
- 支持180天历史数据

**优化点：**
- ✅ 已实现批次获取
- ✅ 已实现限流控制
- ✅ 已实现错误处理
- ⏳ 待实现数据缓存
- ⏳ 待实现增量更新
