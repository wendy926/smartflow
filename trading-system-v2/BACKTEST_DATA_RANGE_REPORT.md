# 回测数据预加载范围报告

## 📊 数据范围概览

根据代码实现和测试日志，回测数据预加载的范围如下：

### 1. 时间范围

**设计范围：最近180天**

从 `market-data-preloader.js` 的代码实现：

```javascript
async fetch180DaysData(symbol, timeframe) {
  const endTime = Date.now();
  const startTime = endTime - (180 * 24 * 60 * 60 * 1000); // 180天前
  
  // 根据时间周期计算需要的K线数量
  let limit = 1000;
  if (timeframe === '1h') {
    limit = 180 * 24; // 180天 * 24小时 = 4320条
  } else if (timeframe === '4h') {
    limit = 180 * 6; // 180天 * 6个4小时 = 1080条
  } else if (timeframe === '1d') {
    limit = 180; // 180天 = 180条
  }
}
```

### 2. 实际数据范围

从测试日志中可以看到：

**BTCUSDT-1h 数据：**
- 开始时间：`2025-04-23 18:00:00` (最早的一条K线)
- 结束时间：`2025-05-10 01:00:00` (最新的一条K线)
- 数据条数：`4320条` (1000+1000+1000+1000+320)
- 实际天数：约 **17天** (4月23日 至 5月10日)

**ETHUSDT-1h 数据：**
- 开始时间：`2025-04-23 18:00:00`
- 结束时间：`2025-05-10 01:00:00`
- 数据条数：`4320条`
- 实际天数：约 **17天**

## ⚠️ 重要发现

### 问题：实际数据范围与设计不符

**设计预期：**
- 时间范围：最近180天
- 数据量：4320条 (1h) / 1080条 (4h) / 180条 (1d)

**实际情况：**
- 时间范围：仅17天
- 数据量：4320条 (1h)

### 原因分析

从日志中可以看到，数据获取过程是：

```
info: 获取K线数据成功: BTCUSDT 1h 1000条
info: 获取K线数据成功: BTCUSDT 1h 1000条
info: 获取K线数据成功: BTCUSDT 1h 1000条
info: 获取K线数据成功: BTCUSDT 1h 1000条
info: 获取K线数据成功: BTCUSDT 1h 320条
```

**问题根源：**

Binance API的K线数据接口限制：
- 单次请求最多返回 **1000条** K线数据
- 即使设置了 `limit = 4320`，API也只返回最多1000条

因此，实际获取的数据量是：
- **1h数据**：约 17天 (1000条/天 * 4次 + 320条)
- **4h数据**：约 67天 (1000条/天 * 4次)
- **1d数据**：约 1000天 (1000条)

## 🔧 解决方案

### 方案1：分批次获取（当前实现）

当前代码已经实现了分批次获取逻辑：

```javascript
const allKlines = [];
let currentStartTime = startTime;

while (currentStartTime < endTime) {
  const klines = await this.binanceAPI.getKlines({
    symbol,
    interval: timeframe,
    startTime: currentStartTime,
    endTime: endTime,
    limit: 1000
  });
  
  if (!klines || klines.length === 0) break;
  
  allKlines.push(...klines);
  
  // 更新起始时间，获取下一批数据
  currentStartTime = klines[klines.length - 1][0] + 1;
  
  // 避免API限流
  await this.delay(100);
}
```

**问题：** 当前实现只获取了4批次（4*1000+320），未完全覆盖180天。

### 方案2：正确实现180天数据获取

需要修改代码，确保获取完整的180天数据：

```javascript
async fetch180DaysData(symbol, timeframe) {
  const endTime = Date.now();
  const startTime = endTime - (180 * 24 * 60 * 60 * 1000);
  
  const allKlines = [];
  let currentStartTime = startTime;
  let batchCount = 0;
  const maxBatches = 20; // 最多20批次，确保覆盖180天
  
  while (currentStartTime < endTime && batchCount < maxBatches) {
    const klines = await this.binanceAPI.getKlines({
      symbol,
      interval: timeframe,
      startTime: currentStartTime,
      endTime: endTime,
      limit: 1000
    });
    
    if (!klines || klines.length === 0) break;
    
    allKlines.push(...klines);
    
    // 更新起始时间为最后一条K线的结束时间
    const lastKlineTime = klines[klines.length - 1][0];
    const intervalMs = this.getIntervalMs(timeframe);
    currentStartTime = lastKlineTime + intervalMs;
    
    batchCount++;
    
    // 避免API限流
    await this.delay(100);
  }
  
  logger.info(`[数据预加载] ${symbol}-${timeframe} 获取完成: ${allKlines.length}条, ${batchCount}批次`);
  
  return allKlines;
}

getIntervalMs(timeframe) {
  const intervals = {
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000
  };
  return intervals[timeframe] || 60 * 60 * 1000;
}
```

## 📈 各时间周期的预期数据量

### 1h周期
- **预期天数**：180天
- **预期数据量**：180 * 24 = 4320条
- **实际数据量**：4320条 (但只覆盖17天)
- **问题**：数据密度过高，实际只覆盖了17天

### 4h周期
- **预期天数**：180天
- **预期数据量**：180 * 6 = 1080条
- **实际数据量**：约4000条 (1000*4)
- **问题**：数据量超过预期，可能覆盖了667天

### 1d周期
- **预期天数**：180天
- **预期数据量**：180条
- **实际数据量**：约4000条 (1000*4)
- **问题**：数据量远超预期，可能覆盖了4000天

## ✅ 建议

### 立即修复

1. **修改 `fetch180DaysData` 方法**
   - 添加正确的批次循环逻辑
   - 确保获取完整的180天数据
   - 添加数据量验证

2. **添加数据完整性检查**
   ```javascript
   async checkDataCompleteness(symbol, timeframe, expectedDays = 180) {
     const [rows] = await this.database.pool.query(
       'SELECT COUNT(*) as count, MIN(open_time) as start, MAX(open_time) as end FROM backtest_market_data WHERE symbol = ? AND timeframe = ?',
       [symbol, timeframe]
     );
     
     const actualDays = Math.floor((rows[0].end - rows[0].start) / (1000 * 60 * 60 * 24));
     
     if (actualDays < expectedDays - 5) { // 允许5天误差
       logger.warn(`[数据完整性] ${symbol}-${timeframe} 数据不完整: 实际${actualDays}天, 预期${expectedDays}天`);
       return false;
     }
     
     return true;
   }
   ```

3. **重新预加载数据**
   - 删除现有数据
   - 使用修复后的代码重新预加载
   - 验证数据完整性

### 长期优化

1. **增量更新**
   - 每天只更新最近1-2天的数据
   - 避免重复获取历史数据

2. **数据压缩**
   - 使用JSON或MessagePack压缩存储
   - 减少数据库存储空间

3. **多数据源支持**
   - 支持从其他交易所获取数据
   - 支持从本地CSV文件导入

## 📅 当前状态

- **设计范围**：最近180天
- **实际范围**：约17天 (1h数据)
- **数据量**：4320条 (1h数据)
- **状态**：⚠️ 需要修复

---

**总结：** 当前预加载的数据范围是**约17天**，而非设计的180天。需要修复代码以正确获取完整的180天历史数据。
