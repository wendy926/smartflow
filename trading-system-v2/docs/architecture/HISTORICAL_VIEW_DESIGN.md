# 大额挂单7天历史视图设计

**需求**: 
1. 分别展示BTCUSDT和ETHUSDT
2. 显示近7天累计存在的大额挂单
3. 敏锐发现新增的大额挂单

**当前问题**: 
- 只显示实时数据（1小时清理）
- 无法查看历史累计
- 新增挂单无高亮

---

## 🎯 设计方案

### 方案：数据库历史查询 + 新增标记

#### 数据源切换

**Before（实时模式）**:
```javascript
// 从内存Map获取
detector.getTrackedEntries(symbol)  // 仅当前+1小时
```

**After（历史模式）**:
```javascript
// 从数据库查询近7天
SELECT DISTINCT 
  JSON_EXTRACT(detection_data, '$.trackedEntries') 
FROM large_order_detection_results
WHERE symbol = 'BTCUSDT' 
  AND created_at >= NOW() - INTERVAL 7 DAY
  AND tracked_entries_count > 0
```

---

## 🏗️ 实施方案

### 1. 新增API端点

**路由**: `/api/v1/large-orders/history-aggregated`

**参数**:
```
symbol: BTCUSDT,ETHUSDT
days: 7（默认）
```

**返回**:
```json
{
  "BTCUSDT": {
    "uniqueOrders": 45,      // 7天内出现过的唯一挂单数
    "currentOrders": 9,       // 当前仍存在
    "newOrders": 2,           // 最近1小时新增
    "entries": [
      {
        "price": 109000,
        "maxValueUSD": 13000000,
        "firstSeen": "2025-10-06 15:23",
        "lastSeen": "2025-10-13 08:10",
        "totalAppearances": 156,  // 出现次数
        "avgDuration": 45,         // 平均持续时间(分钟)
        "isNew": false,            // 是否新增(<1小时)
        "isActive": true,          // 是否当前存在
        "side": "bid"
      }
    ]
  },
  "ETHUSDT": { ... }
}
```

### 2. 前端布局改造

**双列布局**:
```html
<div class="large-orders-container">
  <!-- BTCUSDT -->
  <div class="symbol-panel">
    <h3>BTCUSDT <span class="badge-live">● 实时</span></h3>
    <div class="stats">
      7天累计: 45个 | 当前: 9个 | 🆕新增: 2个
    </div>
    <table class="orders-table">
      <tr class="new-order"><!-- 新增高亮 --></tr>
      <tr class="active-order"><!-- 当前存在 --></tr>
      <tr class="historical-order"><!-- 历史记录 --></tr>
    </table>
  </div>

  <!-- ETHUSDT -->
  <div class="symbol-panel">
    <h3>ETHUSDT <span class="badge-live">● 实时</span></h3>
    <div class="stats">
      7天累计: 32个 | 当前: 0个 | 🆕新增: 0个
    </div>
    <table class="orders-table">...</table>
  </div>
</div>
```

### 3. 新增挂单标记

**判断逻辑**:
```javascript
const isNew = (firstSeenTime - now) < 3600000;  // <1小时
```

**展示效果**:
```html
<tr class="new-order">
  <td>
    <span class="badge-new">🆕 NEW</span>
    bid@109000
  </td>
  <td>13M USD</td>
  <td>⏱️ 15分钟前</td>
</tr>
```

---

## 📊 数据聚合逻辑

### 历史数据聚合

**输入**: 7天的detection_data（每15秒一条）

**处理**:
```javascript
1. 提取所有trackedEntries
2. 按price分组
3. 聚合统计：
   - firstSeen = MIN(createdAt)
   - lastSeen = MAX(lastSeenAt)
   - totalAppearances = COUNT(*)
   - avgDuration = AVG(duration)
   - maxValueUSD = MAX(valueUSD)
4. 判断isNew（<1小时）
5. 判断isActive（最近15秒有记录）
6. 按价值排序
```

### 实时与历史结合

**核心思路**:
```
历史数据（数据库）提供：
  - 7天累计出现过的所有大额挂单
  - 每个价位的统计信息

实时数据（内存Map）提供：
  - 当前仍存在的挂单
  - 新增标记（<1小时）
  - 实时状态

前端展示：
  - 默认显示历史累计（7天）
  - 高亮当前存在（绿色边框）
  - 闪烁新增挂单（黄色背景）
```

---

## 🎨 前端视觉设计

### 挂单状态颜色

```css
/* 新增挂单（<1小时）*/
.new-order {
  background: linear-gradient(90deg, #fff3cd 0%, transparent 100%);
  border-left: 4px solid #ffc107;
  animation: pulse 2s infinite;
}

/* 当前存在 */
.active-order {
  background: #f8f9fa;
  border-left: 2px solid #28a745;
}

/* 历史记录（已撤销）*/
.historical-order {
  opacity: 0.6;
  background: #ffffff;
}

/* Spoof（诱导单）*/
.spoof-order {
  background: #ffe5e5;
  border-left: 3px solid #dc3545;
}
```

### 动画效果

```css
@keyframes pulse {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.badge-new {
  animation: blink 1.5s ease-in-out infinite;
}
```

---

## 💻 实施步骤

### Step 1: API扩展（20分钟）

**文件**: `src/api/routes/large-orders.js`

**新增路由**:
```javascript
router.get('/history-aggregated', async (req, res) => {
  const { symbols, days = 7 } = req.query;
  const symbolList = symbols ? symbols.split(',') : ['BTCUSDT', 'ETHUSDT'];
  
  const result = {};
  
  for (const symbol of symbolList) {
    const sql = `
      SELECT 
        symbol,
        detection_data,
        created_at,
        tracked_entries_count
      FROM large_order_detection_results
      WHERE symbol = ?
        AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND tracked_entries_count > 0
      ORDER BY created_at DESC
    `;
    
    const rows = await database.query(sql, [symbol, days]);
    result[symbol] = aggregateHistoricalOrders(rows, symbol);
  }
  
  res.json({ success: true, data: result });
});
```

### Step 2: 数据聚合函数（30分钟）

**文件**: `src/services/large-order/history-aggregator.js`

**功能**:
```javascript
class HistoryAggregator {
  aggregateOrders(detectionRecords, symbol) {
    const orderMap = new Map();  // price -> aggregated data
    
    for (const record of detectionRecords) {
      const entries = JSON.parse(record.detection_data).trackedEntries;
      
      for (const entry of entries) {
        const key = `${entry.side}@${entry.price}`;
        
        if (!orderMap.has(key)) {
          orderMap.set(key, {
            price: entry.price,
            side: entry.side,
            maxValueUSD: entry.valueUSD,
            firstSeen: record.created_at,
            lastSeen: record.created_at,
            appearances: 1,
            totalDuration: 0
          });
        } else {
          const agg = orderMap.get(key);
          agg.maxValueUSD = Math.max(agg.maxValueUSD, entry.valueUSD);
          agg.lastSeen = record.created_at;
          agg.appearances++;
        }
      }
    }
    
    // 标记新增和活跃
    const now = Date.now();
    const result = Array.from(orderMap.values()).map(order => ({
      ...order,
      isNew: (now - new Date(order.firstSeen).getTime()) < 3600000,
      isActive: (now - new Date(order.lastSeen).getTime()) < 900000  // 15分钟内有记录
    }));
    
    return result.sort((a, b) => b.maxValueUSD - a.maxValueUSD);
  }
}
```

### Step 3: 前端改造（40分钟）

**文件**: `src/web/public/js/large-orders.js`

**改动**:
```javascript
class LargeOrdersTracker {
  constructor() {
    this.viewMode = 'historical';  // 'realtime' or 'historical'
    this.currentSymbol = 'BTCUSDT';
  }
  
  async loadHistoricalData() {
    const response = await fetch('/api/v1/large-orders/history-aggregated?days=7');
    const result = await response.json();
    
    if (result.success) {
      this.renderHistoricalView(result.data);
    }
  }
  
  renderHistoricalView(data) {
    const container = document.getElementById('large-order-summary-content');
    
    // 生成BTCUSDT和ETHUSDT的并排卡片
    container.innerHTML = `
      <div class="dual-panel">
        ${this.generateHistoricalPanel('BTCUSDT', data.BTCUSDT)}
        ${this.generateHistoricalPanel('ETHUSDT', data.ETHUSDT)}
      </div>
    `;
  }
  
  generateHistoricalPanel(symbol, orders) {
    const newCount = orders.filter(o => o.isNew).length;
    const activeCount = orders.filter(o => o.isActive).length;
    
    return `
      <div class="symbol-panel">
        <div class="panel-header">
          <h3>${symbol}</h3>
          <div class="stats">
            <span>7天累计: ${orders.length}个</span>
            <span>当前: ${activeCount}个</span>
            <span class="new-badge">🆕新增: ${newCount}个</span>
          </div>
        </div>
        
        <table class="historical-table">
          ${orders.map(order => `
            <tr class="${order.isNew ? 'new-order' : ''} ${order.isActive ? 'active-order' : 'historical-order'}">
              <td>
                ${order.isNew ? '<span class="badge-new">🆕</span>' : ''}
                ${order.isActive ? '●' : '○'}
                ${order.side === 'bid' ? 'BUY' : 'SELL'}
              </td>
              <td>${order.price.toLocaleString()}</td>
              <td>${(order.maxValueUSD / 1000000).toFixed(1)}M</td>
              <td>${this.formatTime(order.firstSeen)} - ${this.formatTime(order.lastSeen)}</td>
              <td>${order.appearances}次</td>
            </tr>
          `).join('')}
        </table>
      </div>
    `;
  }
}
```

---

## 🎨 前端布局设计

### 双列布局
```
┌─────────────────────────────┬─────────────────────────────┐
│ BTCUSDT                     │ ETHUSDT                     │
│ 7天累计:45 当前:9 🆕新增:2  │ 7天累计:32 当前:0 🆕新增:0  │
├─────────────────────────────┼─────────────────────────────┤
│ 🆕● BUY 109K 13M (2小时前)  │ ○ BUY 3500 8M (1天前)       │
│ ● BUY 98K 10M (持续中)      │ ○ SELL 4500 6M (2天前)      │
│ ● SELL 116K 12M (持续中)    │ ○ BUY 3400 5M (3天前)       │
│ ○ BUY 110K 8M (6小时前)     │ ...                         │
│ ○ SELL 115K 7M (1天前)      │                             │
│ ...                         │                             │
└─────────────────────────────┴─────────────────────────────┘

图例：
🆕 = 新增（<1小时）
● = 当前存在（绿色）
○ = 已撤销（灰色）
```

---

## 实施！

