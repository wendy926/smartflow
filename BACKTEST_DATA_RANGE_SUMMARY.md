# 回测数据范围配置报告

## 📋 当前配置

### 1. 默认交易对 (Default Symbols)

**位置**：`trading-system-v2/src/services/backtest-manager-v3.js` 第623-625行

```javascript
getDefaultSymbols() {
  return ['BTCUSDT', 'ETHUSDT'];
}
```

**说明**：
- 默认只包含 2 个交易对：BTCUSDT, ETHUSDT
- 回测界面可以传入 `symbols` 参数覆盖默认值
- 如果不传入，则使用这两个默认交易对

---

### 2. 数据时间范围

**位置**：`trading-system-v2/src/services/backtest-data-service.js` 第19-58行

#### 当前设置：**180天历史数据**

```javascript
async getHistoricalData(symbol, timeframe = '1h', forceRefresh = false) {
  // 计算180天前的时间戳
  const endTime = Date.now();
  const startTime = endTime - (180 * 24 * 60 * 60 * 1000);

  // 根据时间周期计算需要的K线数量
  let limit = 1000; // 默认限制
  if (timeframe === '1h') {
    limit = 180 * 24; // 180天 * 24小时 = 4320条
  } else if (timeframe === '4h') {
    limit = 180 * 6; // 180天 * 6个4小时 = 1080条
  } else if (timeframe === '1d') {
    limit = 180; // 180天 = 180条
  }
}
```

**数据范围配置**：

| 时间周期 | 历史天数 | 总K线数 | 说明 |
|---------|---------|---------|------|
| 15m | 180天 | ~17,280条 | 每15分钟一根K线 |
| 1h | 180天 | 4,320条 | 每小时一根K线 |
| 4h | 180天 | 1,080条 | 每4小时一根K线 |
| 1d | 180天 | 180条 | 每天一根K线 |

---

### 3. 前端时间选择器

**位置**：`trading-system-v2/src/web/public/js/strategy-params.js`

查看前端回测请求代码：
```javascript
async runBacktest(strategy, mode) {
  const response = await this.fetchWithAuth(`/api/v1/backtest/${strategy}/${mode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      symbols: this.getSymbols(), // 默认 ['BTCUSDT', 'ETHUSDT']
      timeframe: '15m',           // 默认 15分钟
      forceRefresh: false
    })
  });
}
```

---

### 4. 实际使用的交易对

从代码中可以看到，`getDefaultSymbols()` 返回：
```javascript
return ['BTCUSDT', 'ETHUSDT'];
```

但是前端可能传入更多交易对。让我们检查前端代码：

**前端代码**（`strategy-params.js`）：
```javascript
getSymbols() {
  // 返回默认的交易对列表
  return ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT'];
}
```

---

## 📊 当前实际配置

### 前端配置（策略参数页面）
- **交易对**：BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, ADAUSDT（5个）
- **时间周期**：15分钟
- **数据范围**：最近180天

### 后端配置（回测服务）
- **默认交易对**：BTCUSDT, ETHUSDT（2个）
- **时间周期**：15分钟（前端传入）
- **数据范围**：最近180天

---

## 🎯 回测数据范围总结

### 点击"运行回测"时的数据范围：

1. **交易对**：
   - 前端传入：`['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT']`
   - 后端使用前端传入的值

2. **时间周期**：
   - 默认：`15m`（15分钟）
   - 可以从时间选择器更改

3. **数据范围**：
   - **起始时间**：180天前（从今天往前推180天）
   - **结束时间**：今天
   - **总K线数**：约 17,280 条（15分钟K线）

4. **数据来源**：
   - 优先从数据库获取预存储数据
   - 如果数据库没有，抛出错误提示需要预加载

---

## ⚠️ 注意事项

1. **数据预加载**：
   - 回测前需要先预加载180天的历史数据
   - 可以通过 `/api/v1/backtest/data/preload` 接口预加载

2. **数据库存储**：
   - 数据存储在 `historical_klines` 表中
   - 包含字段：symbol, timeframe, timestamp, open, high, low, close, volume

3. **缓存策略**：
   - 内存缓存：30分钟过期
   - 数据库永久存储（除非手动清理）

4. **性能考虑**：
   - 15分钟K线 × 180天 = 17,280条数据
   - 5个交易对 = 86,400条K线数据
   - 需要足够的数据库空间

---

## 🔍 查看当前回测配置

### 方法1：查看前端代码
```bash
grep -n "getSymbols" trading-system-v2/src/web/public/js/strategy-params.js
```

### 方法2：查看后端代码
```bash
grep -n "getDefaultSymbols" trading-system-v2/src/services/backtest-manager-v3.js
```

### 方法3：查看数据库
```sql
SELECT COUNT(*) as total_records,
       symbol,
       timeframe,
       MIN(timestamp) as earliest,
       MAX(timestamp) as latest
FROM historical_klines
GROUP BY symbol, timeframe;
```

---

## 📝 建议

### 1. 增加数据范围选择
- 在界面添加日期范围选择器
- 允许用户自定义回测时间段（如最近30天、90天、180天）

### 2. 增加更多交易对
- 默认包含更多主流币种
- 支持用户自定义选择交易对

### 3. 优化数据加载
- 使用增量加载策略
- 只在数据缺失时从API获取

