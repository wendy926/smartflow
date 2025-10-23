# 硬编码和Mock数据全面审计报告

**审计日期**: 2025-10-09  
**审计范围**: `trading-system-v2/src/`  
**目标**: 找出所有硬编码数据和mock数据，确保使用真实API

---

## 🔍 发现的问题

### 1. ❌ 前端Mock信号数据（未使用）

**文件**: `src/web/app.js` 第611-627行

**问题代码**:
```javascript
getMockSignal(strategy) {
  const mockSignals = {
    v3: {
      signal: 'BUY',
      trend: 'UP',
      score: 85,
      confidence: 0.8
    },
    ict: {
      signal: 'SELL',
      trend: 'DOWN',
      score: 72,
      confidence: 0.7
    }
  };
  return mockSignals[strategy] || { signal: 'HOLD', trend: 'RANGE', score: 50, confidence: 0.5 };
}
```

**状态**: ⚠️ **未被调用**，但代码仍存在

**建议**: 删除此函数（17行）

---

### 2. ❌ 前端Mock交易记录（未使用）

**文件**: `src/web/app.js` 第3129-3191行

**问题代码**:
```javascript
getMockTradingRecords(strategy) {
  const mockTrades = {
    v3: [
      {
        symbol: 'BTCUSDT',
        entry_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        entry_price: 63500.00,
        exit_price: 64200.00,
        // ... 更多硬编码数据
      },
      // ... 更多mock交易
    ],
    ict: [
      // ... 类似的mock数据
    ]
  };
  return mockTrades[strategy] || [];
}
```

**状态**: ⚠️ **未被调用**，但代码仍存在（63行）

**建议**: 删除此函数

---

### 3. ❌ 前端胜率趋势使用Math.random()

**文件**: `src/web/app.js`

**问题位置**:
- 第2707-2708行：`generateWinRateTable()` - 胜率数据
- 第2729-2730行：`generateWinRateTable()` - 交易数量
- 第2784-2785行：`generateWinRateData()` - 图表数据

**问题代码**（第2707-2730行）:
```javascript
generateWinRateTable(v3Stats, ictStats, timeframe, period) {
  // 使用当前统计数据的胜率作为基础，添加一些随机变化
  const v3BaseRate = v3Stats.winRate || 0;
  const ictBaseRate = ictStats.winRate || 0;
  
  // ❌ 使用Math.random()生成模拟历史数据
  v3WinRates.push(Math.max(0, Math.min(100, v3BaseRate + (Math.random() - 0.5) * 20)));
  ictWinRates.push(Math.max(0, Math.min(100, ictBaseRate + (Math.random() - 0.5) * 20)));
  
  // ❌ 使用Math.random()生成模拟交易数量
  const v3Trades = Math.max(1, Math.floor(v3Stats.totalTrades / period) + Math.floor(Math.random() * 3));
  const ictTrades = Math.max(1, Math.floor(ictStats.totalTrades / period) + Math.floor(Math.random() * 3));
}
```

**影响**: 
- ❌ 每次刷新数据都不同
- ❌ 无法反映真实的历史胜率趋势
- ❌ 用户无法依赖此数据做决策

**状态**: ✅ **正在被使用**

**建议**: 
- 方案1: 后端提供历史胜率API
- 方案2: 如果暂无历史数据，隐藏趋势图表
- 方案3: 使用真实交易记录计算历史胜率

---

### 4. ❌ 前端系统监控使用Math.random()

**文件**: `src/web/app.js` 第3272-3287行

**问题代码**:
```javascript
async loadMonitoringData() {
  // ❌ 模拟监控数据
  const monitoringData = {
    cpu: Math.random() * 40 + 20,      // 20-60%
    memory: Math.random() * 30 + 50,   // 50-80%
    disk: Math.random() * 20 + 30,     // 30-50%
    apis: {
      binanceRest: 'online',           // 硬编码
      binanceWs: 'online',             // 硬编码
      database: 'online',              // 硬编码
      redis: 'online'                  // 硬编码
    },
    strategies: {
      v3: 'running',                   // 硬编码
      ict: 'running',                  // 硬编码
      rolling: 'running'               // 硬编码
    }
  };
}
```

**后端API存在**: ✅ `/api/v1/monitoring/system`

**问题**: 前端没有调用真实API，而是使用随机数

**状态**: ✅ **正在被使用**

**建议**: 修改为调用后端API

---

### 5. ⚠️ 已废弃的策略文件（包含mock数据）

**文件列表**:
- `v3-strategy-old.js` - 包含`Math.random()`生成OI、资金费率等
- `v3-strategy-optimized.js` - 优化版本，可能已废弃
- `v3-strategy-enhanced.js` - 增强版本（部分API在使用）
- `v3-strategy-weighted.js` - 加权版本，可能已废弃
- `ict-strategy-optimized.js` - 优化版本，可能已废弃
- `v3-dynamic-weights.js` - 动态权重模块

**问题**: 
- 这些文件是否还在使用？
- 如果不使用，应该删除或归档

**建议**: 检查API路由，确认使用的是哪个版本

---

## 📊 已检查并确认为真实数据的部分 ✅

### 后端策略引擎 ✅

**V3策略**（`v3-strategy.js`）:
- ✅ 所有数据来自BinanceAPI
- ✅ 所有计算基于真实K线数据
- ✅ 无硬编码或mock数据

**ICT策略**（`ict-strategy.js`）:
- ✅ 所有数据来自BinanceAPI
- ✅ 订单块、扫荡、吞没都基于真实K线
- ✅ 无硬编码或mock数据
- ⚠️ 第1006、1090行注释提到"替代硬编码"，说明已修复

### 前端策略当前状态 ✅

**数据来源**: `/api/v1/strategies/current-status`
- ✅ 完全依赖后端API
- ✅ 无mock数据
- ✅ 已修复的计算逻辑改为直接使用API数据

### 前端交易记录 ✅

**数据来源**: `/api/v1/trades`
- ✅ 完全依赖后端API
- ✅ 无mock数据
- ✅ 字段映射已修复

---

## 🔧 需要修复的问题清单

| 序号 | 问题 | 位置 | 状态 | 优先级 |
|------|------|------|------|--------|
| 1 | Mock信号函数 | app.js:611-627 | 未使用 | 低 - 建议删除 |
| 2 | Mock交易记录函数 | app.js:3129-3191 | 未使用 | 低 - 建议删除 |
| 3 | 胜率趋势Math.random | app.js:2707-2730 | **正在使用** | **高 - 需修复** |
| 4 | 系统监控Math.random | app.js:3272-3287 | **正在使用** | **高 - 需修复** |
| 5 | 废弃策略文件 | strategies/*.js | 部分使用 | 中 - 需清理 |
| 6 | formatLeverage函数 | app.js:1918-1956 | 未使用 | 低 - 建议删除 |
| 7 | formatMargin函数 | app.js:1963-2006 | 未使用 | 低 - 建议删除 |

---

## 🎯 修复方案

### 高优先级修复

#### 1. 系统监控改用真实API

**修复前**（app.js 第3269-3293行）:
```javascript
async loadMonitoringData() {
  // ❌ 模拟监控数据
  const monitoringData = {
    cpu: Math.random() * 40 + 20,
    memory: Math.random() * 30 + 50,
    disk: Math.random() * 20 + 30,
    // ...
  };
}
```

**修复后**:
```javascript
async loadMonitoringData() {
  try {
    // ✅ 调用真实API
    const response = await this.fetchData('/monitoring/system');
    const monitoringData = {
      cpu: response.data.resources.cpuUsage,
      memory: response.data.resources.memoryUsage,
      disk: response.data.resources.diskUsage,
      apis: response.data.resources.apiStatus || {},
      strategies: response.data.resources.strategyStatus || {}
    };
    this.updateMonitoringDisplay(monitoringData);
  } catch (error) {
    console.error('Error loading monitoring data:', error);
  }
}
```

#### 2. 胜率趋势改用真实数据或隐藏

**方案A**: 后端提供历史胜率API（推荐）
```javascript
// 新增API: GET /api/v1/strategies/winrate-history
// 返回: { dates: [...], v3Rates: [...], ictRates: [...] }
```

**方案B**: 使用交易记录计算历史胜率
```javascript
async generateWinRateTable(v3Stats, ictStats, timeframe, period) {
  // ✅ 从交易记录计算真实的历史胜率
  const response = await this.fetchData(`/trades/statistics?period=${period}`);
  const historicalData = response.data.historical;
  // 使用真实数据而非Math.random()
}
```

**方案C**: 暂时隐藏趋势图表
```javascript
// 如果没有足够的历史数据，显示提示
if (v3Stats.totalTrades < 10) {
  return '<div>数据不足，至少需要10笔交易才能显示趋势</div>';
}
```

---

### 中优先级清理

#### 3. 删除废弃策略文件

**需要确认使用情况**:
```bash
# 检查哪些策略文件被引用
grep -r "require.*v3-strategy" trading-system-v2/src/
grep -r "require.*ict-strategy" trading-system-v2/src/
```

**确认后删除或归档**:
- 如果未使用 → 移动到 `archive/` 目录
- 如果使用 → 保留并确认无mock数据

---

### 低优先级清理

#### 4. 删除未使用的mock函数

**文件**: `src/web/app.js`

**删除**:
- `getMockSignal()` - 第611-627行（17行）
- `getMockTradingRecords()` - 第3129-3191行（63行）
- `formatLeverage()` - 第1918-1956行（39行）
- `formatMargin()` - 第1963-2006行（44行）

**总计**: 163行冗余代码

---

## 📋 完整审计结果

### 前端（src/web/app.js）

| 类型 | 位置 | 描述 | 使用情况 | 优先级 | 建议 |
|------|------|------|----------|--------|------|
| Mock信号 | 611-627 | getMockSignal | 未使用 | 低 | 删除 |
| Mock交易 | 3129-3191 | getMockTradingRecords | 未使用 | 低 | 删除 |
| 随机胜率 | 2707-2730 | generateWinRateTable | **使用中** | **高** | **修复** |
| 随机监控 | 3272-3287 | loadMonitoringData | **使用中** | **高** | **修复** |
| 废弃杠杆 | 1918-1956 | formatLeverage | 未使用 | 低 | 删除 |
| 废弃保证金 | 1963-2006 | formatMargin | 未使用 | 低 | 删除 |

### 后端策略（src/strategies/）

| 文件 | 使用情况 | Mock数据 | 建议 |
|------|----------|----------|------|
| v3-strategy.js | ✅ 主要使用 | ✅ 无 | 保留 |
| ict-strategy.js | ✅ 主要使用 | ✅ 无 | 保留 |
| v3-strategy-enhanced.js | ✅ 部分API使用 | ✅ 无 | 保留或合并 |
| v3-strategy-old.js | ❓ 需确认 | ❌ 有random | 检查后删除 |
| v3-strategy-optimized.js | ❓ 需确认 | ❓ 未知 | 检查后删除 |
| ict-strategy-optimized.js | ❓ 需确认 | ❓ 未知 | 检查后删除 |
| rolling-strategy.js | ✅ 使用 | ✅ 无 | 保留 |
| harmonic-patterns.js | ✅ 使用 | ✅ 无 | 保留 |

---

## ✅ 修复计划

### 阶段1: 立即修复（高优先级）

#### 修复1: 系统监控改用真实API

**文件**: `src/web/app.js`

**修改**: `loadMonitoringData()` 第3269-3293行

**修复代码**:
```javascript
async loadMonitoringData() {
  try {
    // ✅ 调用真实监控API
    const response = await this.fetchData('/monitoring/system');
    
    if (response.success && response.data) {
      const monitoringData = {
        cpu: response.data.resources?.cpuUsage || 0,
        memory: response.data.resources?.memoryUsage || 0,
        disk: response.data.resources?.diskUsage || 0,
        apis: {
          binanceRest: response.data.resources?.apiStatus?.binance || 'unknown',
          binanceWs: response.data.resources?.wsStatus || 'unknown',
          database: response.data.resources?.dbStatus || 'unknown',
          redis: response.data.resources?.redisStatus || 'unknown'
        },
        strategies: {
          v3: response.data.resources?.strategies?.v3 || 'unknown',
          ict: response.data.resources?.strategies?.ict || 'unknown'
        }
      };
      
      this.updateMonitoringDisplay(monitoringData);
    }
  } catch (error) {
    console.error('Error loading monitoring data:', error);
  }
}
```

#### 修复2: 胜率趋势改用真实数据或隐藏

**选项A**: 暂时隐藏趋势表格（快速方案）
```javascript
generateWinRateTable(v3Stats, ictStats, timeframe, period) {
  // ✅ 检查是否有足够的历史数据
  if (v3Stats.totalTrades < 10 && ictStats.totalTrades < 10) {
    return `
      <div style="padding: 40px; text-align: center; color: #666;">
        <p>📊 历史胜率趋势</p>
        <p>至少需要10笔交易才能显示趋势图表</p>
        <p>当前: V3 ${v3Stats.totalTrades}笔, ICT ${ictStats.totalTrades}笔</p>
      </div>
    `;
  }
  
  // 使用真实数据（从交易记录聚合）
  // TODO: 实现基于真实交易记录的胜率计算
}
```

**选项B**: 后端提供历史胜率API（完整方案）
```javascript
// 后端新增: src/api/routes/strategies.js
router.get('/winrate-history', async (req, res) => {
  const { strategy, period = 7 } = req.query;
  
  // 从simulation_trades聚合每日胜率
  const historicalRates = await dbOps.getHistoricalWinRates(strategy, period);
  
  res.json({
    success: true,
    data: historicalRates
  });
});
```

---

### 阶段2: 代码清理（低优先级）

#### 删除未使用的函数

**文件**: `src/web/app.js`

**删除**:
1. `getMockSignal()` - 第611-627行（17行）
2. `getMockTradingRecords()` - 第3129-3191行（63行）
3. `formatLeverage()` - 第1918-1956行（39行）
4. `formatMargin()` - 第1963-2006行（44行）

**总计**: 163行

#### 清理废弃策略文件

**移动到archive目录**:
```bash
mkdir -p trading-system-v2/archive/strategies
mv trading-system-v2/src/strategies/v3-strategy-old.js trading-system-v2/archive/strategies/
# ... 其他废弃文件
```

---

## 🚨 发现的数据不一致问题

### XRPUSDT ICT交易案例

**Telegram通知** (✅ 正确 - 直接使用数据库):
```
杠杆: 24x
保证金: 122.45 USDT
```

**数据库记录** (✅ 基准):
```json
{
  "leverage": "24.00",
  "margin_used": "122.45"
}
```

**前端显示** (❌ 修复前 - 重新计算):
```
杠杆: 25x
保证金: $118
```

**前端显示** (✅ 修复后 - 直接使用):
```
杠杆: 24x
保证金: $122.45
```

**Git提交**: ead85b6 - 已修复

---

## 📊 统计

### 发现的问题

- **Mock/随机数据**: 4处
- **未使用函数**: 4个（163行代码）
- **废弃文件**: 6个策略文件
- **数据不一致**: 1处（已修复）

### 优先级分布

- **高优先级**: 2个（胜率趋势、系统监控）
- **中优先级**: 1个（废弃文件清理）
- **低优先级**: 4个（未使用函数删除）

---

**审计完成时间**: 2025-10-09  
**下一步**: 执行高优先级修复  
**目标**: 确保所有前端显示数据来自后端真实API

