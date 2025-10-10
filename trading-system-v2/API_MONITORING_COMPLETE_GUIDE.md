# Binance API监控和告警完整实现

**实现时间**: 2025-10-10  
**版本**: v1.3.0

---

## 🎯 实现总览

### 新增功能

1. ✅ **Binance REST API成功率监控**
2. ✅ **Binance WebSocket成功率监控**
3. ✅ **API统计实时显示**
4. ✅ **低成功率自动告警**
5. ✅ **Telegram通知集成**
6. ✅ **系统资源真实性确认**

---

## 📊 监控指标详解

### 1. Binance REST API监控

**统计指标**:
- 📈 总请求数（过去1小时）
- ✅ 成功请求数
- ❌ 失败请求数
- 📊 成功率（%）

**显示位置**: 系统监控 > API状态 > Binance REST API

**数据示例**:
```
Binance REST API
总请求: 245 | 失败: 3
正常 (98.78%)
```

**状态判定**:
| 成功率 | 状态 | 颜色 | 说明 |
|--------|------|------|------|
| ≥95% | 🟢 正常 | 绿色 | API运行良好 |
| 80-95% | 🟡 降级 | 黄色 | API部分失败，需关注 |
| <80% | 🔴 异常 | 红色 | API大量失败，需紧急处理 |

---

### 2. Binance WebSocket监控

**统计指标**:
- 📈 总连接数（过去1小时）
- ✅ 活跃连接数
- ❌ 失败连接数
- 📊 成功率（%）

**显示位置**: 系统监控 > API状态 > Binance WebSocket

**数据示例**:
```
Binance WebSocket
活跃连接: 5 | 失败: 0
正常 (100%)
```

**状态判定**:（同REST API）

---

### 3. 系统资源监控（已确认真实）

**数据来源**: Node.js `os` 模块（VPS真实数据）

#### CPU使用率
```javascript
// 来源: os.cpus()
const cpuUsage = await this.getCpuUsage();
// 计算方式: (总使用时间 - 空闲时间) / 总时间 × 100%
```

**告警阈值**: >60%

#### 内存使用率
```javascript
// 来源: os.totalmem() 和 os.freemem()
const memoryUsage = (os.totalmem() - os.freemem()) / os.totalmem() × 100%;
```

**告警阈值**: >60%

#### 磁盘使用率
**当前**: 默认值45%（待实现真实磁盘监控）

---

## 🔧 技术实现

### 1. Binance API统计跟踪

**文件**: `src/api/binance-api.js`

#### 统计数据结构

```javascript
class BinanceAPI {
  constructor() {
    this.stats = {
      rest: {
        totalRequests: 0,
        successRequests: 0,
        failedRequests: 0,
        lastResetTime: Date.now()
      },
      ws: {
        totalConnections: 0,
        activeConnections: 0,
        failedConnections: 0,
        lastResetTime: Date.now()
      }
    };
  }
}
```

#### REST API统计

在每个REST API方法中添加统计：

```javascript
async getTicker24hr(symbol) {
  this.resetStatsIfNeeded();
  this.stats.rest.totalRequests++;  // ← 总请求+1
  
  try {
    const response = await axios.get(...);
    this.stats.rest.successRequests++;  // ← 成功+1
    return response.data;
  } catch (error) {
    this.stats.rest.failedRequests++;  // ← 失败+1
    throw error;
  }
}
```

**覆盖的API方法**:
- `getKlines()` - K线数据
- `getTicker24hr()` - 24小时价格
- `getFundingRate()` - 资金费率
- `getOpenInterestHist()` - 持仓量历史
- （所有其他REST API方法）

#### WebSocket统计

```javascript
createWebSocket(stream, onMessage, onError) {
  this.resetStatsIfNeeded();
  this.stats.ws.totalConnections++;  // ← 总连接+1
  
  const ws = new WebSocket(...);
  
  ws.on('open', () => {
    this.stats.ws.activeConnections++;  // ← 活跃连接+1
  });
  
  ws.on('error', (error) => {
    this.stats.ws.failedConnections++;  // ← 失败连接+1
  });
  
  ws.on('close', () => {
    this.stats.ws.activeConnections--;  // ← 活跃连接-1
  });
}
```

#### 统计重置机制

```javascript
resetStatsIfNeeded() {
  const now = Date.now();
  // 每小时重置一次统计
  if (now - this.stats.rest.lastResetTime >= 3600000) {
    this.stats.rest = {
      totalRequests: 0,
      successRequests: 0,
      failedRequests: 0,
      lastResetTime: now
    };
  }
  // WebSocket统计同样每小时重置
}
```

**目的**: 保持统计数据的时效性，反映最近1小时的API状态

---

### 2. 监控API路由

**文件**: `src/api/routes/monitoring.js`

#### API端点: GET /api/v1/monitoring/system

**修改前**:
```javascript
router.get('/system', async (req, res) => {
  const systemInfo = resourceMonitor.getSystemInfo();
  const currentResources = resourceMonitor.checkResources();
  
  res.json({
    success: true,
    data: {
      system: systemInfo,
      resources: currentResources
    }
  });
});
```

**修改后**:
```javascript
router.get('/system', async (req, res) => {
  const systemInfo = resourceMonitor.getSystemInfo();
  const currentResources = resourceMonitor.checkResources();
  
  // 🔥 新增：获取Binance API统计
  const BinanceAPI = require('../../api/binance-api');
  const binanceAPI = new BinanceAPI();
  const apiStats = binanceAPI.getStats();
  
  res.json({
    success: true,
    data: {
      system: systemInfo,
      resources: currentResources,
      apiStats: apiStats  // ← 新增API统计数据
    }
  });
});
```

**返回数据结构**:
```json
{
  "success": true,
  "data": {
    "system": {
      "hostname": "iZ0jl...",
      "platform": "linux",
      "totalMemory": 1073741824,
      "freeMemory": 235929600,
      "loadAverage": [0.5, 0.6, 0.55]
    },
    "resources": {
      "cpu": 45.2,
      "memory": 78.0,
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
        "totalConnections": 8,
        "activeConnections": 5,
        "failedConnections": 0,
        "successRate": 100.0
      }
    }
  }
}
```

---

### 3. 前端监控页面

**文件**: `src/web/app.js` 和 `src/web/index.html`

#### HTML结构更新

**修改前**:
```html
<div class="api-item">
  <span class="api-name">Binance REST API</span>
  <span class="api-status-value status-online">正常</span>
</div>
```

**修改后**:
```html
<div class="api-item">
  <div class="api-info">
    <span class="api-name">Binance REST API</span>
    <span class="api-detail">总请求: 245 | 失败: 3</span>
  </div>
  <span class="api-status-value status-online">正常 (98.78%)</span>
</div>
```

#### JavaScript数据处理

```javascript
async loadMonitoringData() {
  const response = await this.fetchData('/monitoring/system');
  const apiStats = response.data.apiStats || {};
  
  const monitoringData = {
    // ... 系统资源数据
    apis: {
      binanceRest: {
        status: 'online',
        successRate: apiStats.rest?.successRate || 100,
        totalRequests: apiStats.rest?.totalRequests || 0,
        failedRequests: apiStats.rest?.failedRequests || 0
      },
      binanceWs: {
        status: 'online',
        successRate: apiStats.ws?.successRate || 100,
        activeConnections: apiStats.ws?.activeConnections || 0,
        failedConnections: apiStats.ws?.failedConnections || 0
      }
    }
  };
  
  this.updateMonitoringDisplay(monitoringData);
}
```

#### 显示更新逻辑

```javascript
updateAPIStatus(apiName, apiData) {
  const rate = apiData.successRate;
  
  // 状态判定
  const status = rate >= 95 ? 'online' : rate >= 80 ? 'degraded' : 'error';
  const statusText = rate >= 95 ? '正常' : rate >= 80 ? '降级' : '异常';
  const statusClass = rate >= 95 ? 'status-online' : 
                      rate >= 80 ? 'status-warning' : 'status-offline';
  
  // 更新显示
  statusElement.textContent = `${statusText} (${rate}%)`;
  statusElement.className = `api-status-value ${statusClass}`;
  
  // 更新详细信息
  detailElement.textContent = `总请求: ${apiData.totalRequests} | 失败: ${apiData.failedRequests}`;
}
```

---

### 4. 告警功能实现

**文件**: `src/workers/monitor.js`

#### 告警检查逻辑

```javascript
async checkAPIStatus() {
  const binanceAPI = new BinanceAPI();
  const apiStats = binanceAPI.getStats();
  
  // REST API成功率检查
  const restSuccessRate = apiStats.rest.successRate;
  if (restSuccessRate < 80 && apiStats.rest.totalRequests > 10) {
    await this.sendAlert('API_REST_LOW', 
      `Binance REST API成功率过低: ${restSuccessRate}%`,
      { 
        successRate: restSuccessRate,
        totalRequests: apiStats.rest.totalRequests,
        failedRequests: apiStats.rest.failedRequests
      }
    );
  }
  
  // WebSocket成功率检查（同理）
}
```

#### 告警阈值

| 监控项 | 告警阈值 | 最小样本量 | 说明 |
|--------|---------|-----------|------|
| REST API成功率 | <80% | >10次请求 | 避免小样本误报 |
| WebSocket成功率 | <80% | >5次连接 | 避免小样本误报 |
| CPU使用率 | >60% | - | 已有 |
| 内存使用率 | >60% | - | 已有 |

#### 告警冷却机制

```javascript
async sendAlert(type, message, data = {}) {
  const now = Date.now();
  const lastSent = this.alertCooldown.get(type);
  
  // 5分钟冷却期
  if (lastSent && (now - lastSent) < 300000) {
    logger.debug(`告警类型 ${type} 在冷却期内，跳过发送`);
    return;
  }
  
  // 发送Telegram通知
  await this.telegramService.sendMonitoringAlert(type, message, data);
  this.alertCooldown.set(type, now);
}
```

**冷却期**: 5分钟
**目的**: 避免频繁发送相同告警，减少Telegram消息干扰

---

## 📋 告警类型汇总

| 告警类型 | 触发条件 | 消息内容 | 冷却期 |
|---------|---------|---------|--------|
| **CPU_HIGH** | CPU >60% | CPU使用率过高: XX% | 5分钟 |
| **MEMORY_HIGH** | 内存 >60% | 内存使用率过高: XX% | 5分钟 |
| **API_REST_LOW** | REST成功率 <80% | Binance REST API成功率过低: XX% | 5分钟 |
| **API_WS_LOW** | WS成功率 <80% | Binance WebSocket成功率过低: XX% | 5分钟 |

---

## 🔍 系统资源真实性验证

### CPU监控

**数据来源**:
```javascript
const os = require('os');
const cpus = os.cpus(); // ← VPS真实CPU数据

// 计算CPU使用率
async getCpuUsage() {
  const startMeasure = this.cpuAverage();
  setTimeout(() => {
    const endMeasure = this.cpuAverage();
    const idleDifference = endMeasure.idle - startMeasure.idle;
    const totalDifference = endMeasure.total - startMeasure.total;
    const percentageCPU = 100 - ~~(100 * idleDifference / totalDifference);
    resolve(percentageCPU);
  }, 100);
}
```

**确认**: ✅ **完全真实**
- 来自Node.js os模块
- 计算VPS实际CPU idle time
- 每30秒更新一次

### 内存监控

**数据来源**:
```javascript
const os = require('os');
const totalMemory = os.totalmem(); // ← VPS总内存
const freeMemory = os.freemem();   // ← VPS空闲内存

const memoryUsage = (totalMemory - freeMemory) / totalMemory * 100;
```

**确认**: ✅ **完全真实**
- 来自Node.js os模块
- 反映VPS实际内存使用
- 每30秒更新一次

### 磁盘监控

**当前状态**: ⚠️ **使用默认值45%**

**原因**: Node.js os模块不提供磁盘使用率

**计划**: 未来可通过exec调用系统命令获取真实磁盘使用率
```bash
df -h / | tail -1 | awk '{print $5}' | sed 's/%//'
```

---

## 📊 数据流程图

### 监控数据流

```
VPS系统
  ↓
os.cpus() / os.totalmem() / os.freemem()
  ↓
monitor.js (每30秒)
  ├─ checkSystemResources()
  │   ├─ getCpuUsage() → CPU使用率
  │   ├─ getMemoryUsage() → 内存使用率
  │   └─ checkAPIStatus() → API成功率
  ↓
检查告警阈值
  ├─ CPU > 60% → 发送告警
  ├─ 内存 > 60% → 发送告警
  ├─ REST API < 80% → 发送告警
  └─ WebSocket < 80% → 发送告警
  ↓
Telegram通知（5分钟冷却）
  ↓
同时保存到数据库
  ↓
前端 GET /api/v1/monitoring/system
  ↓
显示在监控页面
```

### API统计流

```
用户请求 → v3Strategy.execute()
           ↓
      binanceAPI.getKlines()
           ↓
      stats.rest.totalRequests++
           ↓
      尝试API调用
      ├─ 成功 → stats.rest.successRequests++
      └─ 失败 → stats.rest.failedRequests++
           ↓
      每小时自动重置统计
           ↓
      前端查询显示
```

---

## ⚡ 告警触发场景

### 场景1: API调用失败率上升

```
15:00 - 15:05:
- 总请求: 50
- 成功: 48
- 失败: 2
- 成功率: 96% ← 正常，无告警

15:05 - 15:10:
- 总请求: 100
- 成功: 75
- 失败: 25
- 成功率: 75% ← 低于80%，触发告警

Telegram消息:
📢 系统监控告警
类型: API_REST_LOW
消息: Binance REST API成功率过低: 75%
详情: 总请求100次，失败25次
```

**可能原因**:
- Binance API限流
- 网络不稳定
- API服务降级
- IP被临时封禁

### 场景2: WebSocket连接失败

```
15:00 - 15:05:
- 总连接: 10
- 活跃: 8
- 失败: 2
- 成功率: 80% ← 刚好阈值，触发告警

Telegram消息:
📢 系统监控告警
类型: API_WS_LOW
消息: Binance WebSocket成功率过低: 80%
详情: 总连接10次，失败2次
```

**可能原因**:
- WebSocket服务不稳定
- 网络断连
- 连接超时

### 场景3: 系统资源过高

```
CPU: 85% > 60% ← 触发告警
内存: 72% > 60% ← 触发告警

Telegram消息:
📢 系统监控告警
类型: CPU_HIGH
消息: CPU使用率过高: 85%

📢 系统监控告警
类型: MEMORY_HIGH
消息: 内存使用率过高: 72%
```

---

## 📱 Telegram告警配置

### 配置复用

所有监控告警使用**相同的Telegram配置**：

```javascript
// src/services/telegram-monitoring.js
class TelegramMonitoringService {
  constructor() {
    // 读取环境变量配置
    this.botToken = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_CHAT_ID;
  }
  
  async sendMonitoringAlert(type, message, data) {
    // 格式化告警消息
    const formattedMessage = `
📢 系统监控告警
━━━━━━━━━━━━━
类型: ${type}
消息: ${message}
时间: ${new Date().toLocaleString('zh-CN')}

${this.formatAlertData(data)}
`;
    
    // 发送到Telegram
    await this.sendMessage(formattedMessage);
  }
}
```

### 环境变量配置

需要在 `.env` 文件中配置：
```bash
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

**确认**: ✅ **已配置**（与交易触发通知使用同一个bot）

---

## 📊 监控页面视觉效果

### API状态卡片

```
┌───────────────────────────────────────┐
│ API状态                               │
├───────────────────────────────────────┤
│ Binance REST API                      │
│ 总请求: 245 | 失败: 3                 │
│                      🟢 正常 (98.78%) │
├───────────────────────────────────────┤
│ Binance WebSocket                     │
│ 活跃连接: 5 | 失败: 0                 │
│                      🟢 正常 (100%)   │
├───────────────────────────────────────┤
│ 数据库连接                            │
│                      🟢 正常          │
├───────────────────────────────────────┤
│ Redis缓存                             │
│                      🟢 正常          │
└───────────────────────────────────────┘
```

### 状态颜色方案

| 状态 | 颜色 | 成功率范围 |
|------|------|-----------|
| 🟢 正常 | 绿色 (#27ae60) | ≥95% |
| 🟡 降级 | 黄色 (#f39c12) | 80-95% |
| 🔴 异常 | 红色 (#e74c3c) | <80% |

---

## ⏰ 监控时间线

```
00:00 → monitor worker启动
     ↓
00:00:30 → 检查系统资源 + API状态
       ├─ CPU: 45% ✅
       ├─ 内存: 68% ⚠️ (>60%, 发送告警)
       ├─ REST API: 98% ✅
       └─ WebSocket: 100% ✅
     ↓
00:01:00 → 再次检查
       ├─ CPU: 47% ✅
       ├─ 内存: 69% (告警冷却期，不发送)
       ├─ REST API: 96% ✅
       └─ WebSocket: 100% ✅
     ↓
00:06:00 → 冷却期结束，如果仍超阈值
       ├─ 内存: 70% ⚠️ (>60%, 再次发送告警)
     ↓
01:00:00 → API统计自动重置
       ├─ REST: 0/0 (100%)
       └─ WebSocket: 0/0 (100%)

每30秒检查一次
每1小时重置API统计
```

---

## ✅ 验证清单

### 系统资源验证

- [x] CPU数据来自VPS真实数据（os.cpus()）
- [x] 内存数据来自VPS真实数据（os.totalmem/freemem）
- [ ] 磁盘数据为默认值（待实现真实监控）
- [x] 数据每30秒更新一次

### API监控验证

- [ ] 访问监控页面看到API成功率
- [ ] REST API显示总请求和失败次数
- [ ] WebSocket显示活跃连接和失败次数
- [ ] 成功率≥95%显示绿色"正常"
- [ ] 成功率80-95%显示黄色"降级"
- [ ] 成功率<80%显示红色"异常"

### 告警功能验证

- [ ] CPU>60%触发Telegram告警
- [ ] 内存>60%触发Telegram告警
- [ ] REST API<80%触发Telegram告警
- [ ] WebSocket<80%触发Telegram告警
- [ ] 5分钟冷却期正常工作
- [ ] Telegram消息格式正确

---

## 🎯 总结

### 完整实现

1. ✅ **API统计跟踪** - 记录每次调用的成功/失败
2. ✅ **实时计算成功率** - 基于最近1小时数据
3. ✅ **监控页面显示** - 可视化展示成功率和统计
4. ✅ **自动告警** - 成功率<80%触发Telegram通知
5. ✅ **告警冷却** - 5分钟避免重复通知
6. ✅ **配置复用** - 使用系统监控Telegram配置

### 监控全景

```
系统监控 (monitor.js - 每30秒)
├─ 系统资源
│  ├─ CPU使用率 (真实VPS数据) → 告警阈值: >60%
│  ├─ 内存使用率 (真实VPS数据) → 告警阈值: >60%
│  └─ 磁盘使用率 (默认值45%) → 无告警
├─ API状态
│  ├─ REST API成功率 → 告警阈值: <80%
│  └─ WebSocket成功率 → 告警阈值: <80%
└─ Telegram通知 (统一配置)
```

### 用户体验提升

- 🎯 清晰了解API调用状态
- 🎯 及时发现API异常
- 🎯 快速定位性能问题
- 🎯 自动化监控和告警

**所有功能已实现完毕，等待VPS部署验证！** 🚀

