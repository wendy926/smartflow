# SmartFlow 详细产品设计文档 (DETAILPRD)

## 项目概述

SmartFlow 是一个基于多周期共振的高胜率高盈亏比加密货币交易策略系统，集成斐波拉契滚仓计算器。系统通过4H趋势过滤、1H确认、15分钟执行的三层共振机制，结合实时数据监控和告警系统，为交易者提供完整的策略分析和风险管理工具。

## 核心架构

### 1. 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    SmartFlow 系统架构                        │
├─────────────────────────────────────────────────────────────┤
│  前端层 (Frontend)                                          │
│  ├── 主界面 (index.html)                                    │
│  ├── 斐波拉契滚仓计算器 (rollup-calculator.html)            │
│  ├── 样式文件 (main.css)                                    │
│  └── JavaScript 模块                                        │
│      ├── main.js (主逻辑)                                   │
│      ├── api.js (API客户端)                                 │
│      ├── DataManager.js (数据管理)                          │
│      └── Modal.js (组件)                                    │
├─────────────────────────────────────────────────────────────┤
│  后端层 (Backend)                                           │
│  ├── 服务器 (server.js)                                     │
│  ├── 策略模块 (SmartFlowStrategy.js)                        │
│  ├── 数据监控 (DataMonitor.js)                              │
│  ├── 数据库管理 (DatabaseManager.js)                        │
│  ├── API接口 (BinanceAPI.js)                               │
│  ├── 限流器 (RateLimiter.js)                               │
│  ├── 通知系统 (TelegramNotifier.js)                        │
│  ├── 内存优化 (MemoryOptimizedManager.js)                  │
│  ├── 内存监控 (MemoryMonitor.js)                           │
│  └── 工具模块 (TechnicalIndicators.js, DataCache.js)       │
├─────────────────────────────────────────────────────────────┤
│  数据层 (Data Layer)                                        │
│  ├── SQLite 数据库 (smartflow.db)                          │
│  │   ├── 策略分析表 (strategy_analysis)                     │
│  │   ├── 模拟交易表 (simulations)                           │
│  │   ├── K线数据表 (kline_data)                             │
│  │   ├── 技术指标表 (technical_indicators)                  │
│  │   └── 聚合指标表 (aggregated_metrics)                    │
│  ├── Binance Futures API                                   │
│  └── 内存缓存系统 (15分钟数据保留)                          │
└─────────────────────────────────────────────────────────────┘
```

### 2. 模块依赖关系

```
server.js
├── SmartFlowStrategy.js
│   ├── BinanceAPI.js
│   ├── TechnicalIndicators.js
│   └── DataMonitor.js
├── DatabaseManager.js
├── SimulationManager.js
├── TelegramNotifier.js
├── MemoryOptimizedManager.js
│   ├── DatabaseManager.js
│   └── DataCache.js
├── MemoryMonitor.js
└── MemoryMiddleware.js
```

## 核心功能详细设计

### 1. 交易策略分析系统

#### 1.1 多周期共振机制

**4H级趋势过滤 (4H)**
- **价格位置**：价格在 MA20 上方 (多头) / 价格在 MA20 下方 (空头)
- **MA排列判断**：MA20 > MA50 > MA200 (多头) / MA20 < MA50 < MA200 (空头)
- **连续确认机制**：至少2根4H K线满足上述条件，确保趋势稳定性
- **趋势强度确认**：ADX(14) > 20 且 DI方向正确 AND 布林带带宽扩张
- **波动率扩张**：布林带开口扩张 - 最近10根K线中，后半段平均带宽比前半段大5%以上，代表波动率增加，趋势在走强

**1H级多因子打分 (1H)**
- **VWAP方向一致（必须满足）**：收盘价在VWAP上方（做多）/下方（做空），否则得分=0
- **1. 突破结构（1分）**：收盘价突破最近20根K线的最高点/最低点
- **2. 成交量确认（1分）**：当前K线成交量 ≥ 1.5 × 20期平均成交量
- **3. OI确认（1分）**：未平仓合约OI在6h内上涨≥+2%（做多）/下降≥-2%（做空）
- **4. 资金费率（1分）**：资金费率 ≤ 0.15%/8h
- **5. Delta确认（1分）**：买卖盘不平衡（突破时15m Delta > 过去20根平均Delta的2倍）

**根据打分体系1H级信号大小判断的执行规则：**
- **得分 ≥ 5分** → 强信号（STRONG）
- **得分 3-4分** → 中等信号（MODERATE）
- **得分 < 3分** → 无信号（NONE）

**15分钟执行 (15m) → 入场与风控**

**趋势市执行模式：**
- **多头模式：多头回踩突破（胜率高）**
  - 等价格回踩到EMA20/50支撑位
  - 回踩时成交量缩小，价格不有效跌破支撑
  - 下一根K线突破setup candle的高点→ 入场
- **空头模式：空头反抽破位（机会多）**
  - 等价格反抽到EMA20/50阻力位
  - 反抽时成交量缩小，价格不有效突破阻力
  - 下一根K线跌破setup candle的低点→ 入场

**震荡市执行模式：**
- **1H区间确认**：检查1H布林带边界有效性
  - 连续触碰次数 ≥ 2次
  - 成交量因子 ≤ 1.7倍
  - Delta因子 ≤ 0.02
  - OI变化因子 ≤ 0.02
  - 无最近突破
- **15分钟假突破入场**：
  - 布林带宽收窄：bbWidth < 0.05
  - 假突破验证：突破后快速回撤
  - 多头假突破：突破下沿后快速回撤
  - 空头假突破：突破上沿后快速回撤
- **多因子打分系统**：
  - VWAP因子：当前价 > VWAP → +1，否则 -1
  - Delta因子：正值 → +1，负值 → -1
  - OI因子：上涨 → +1，下降 → -1
  - Volume因子：增量 → +1，减量 → -1
  - 得分 ≤ -2 触发多因子止损

**止损止盈计算逻辑：**
- **趋势市**：setup candle另一端 或 1.2 × ATR(14)，取更远位置
- **震荡市**：
  - 结构性止损：区间边界失效（跌破下轨-ATR 或 突破上轨+ATR）
  - 多因子止损：得分 ≤ -2
  - 时间止盈：持仓超过3小时
  - 固定RR目标：1:2 风险回报比

#### 1.2 技术指标计算

**移动平均线 (MA)**
```javascript
// 计算简单移动平均线
function calculateSMA(values, period) {
  return values.slice(-period).reduce((sum, val) => sum + val, 0) / period;
}
```

**VWAP (成交量加权平均价格)**
```javascript
// 计算VWAP
function calculateVWAP(candles) {
  let cumulativePV = 0, cumulativeVol = 0;
  return candles.map(c => {
    const typical = (c.high + c.low + c.close) / 3;
    cumulativePV += typical * c.volume;
    cumulativeVol += c.volume;
    return cumulativePV / cumulativeVol;
  });
}
```

**ADX (平均方向指数)**
```javascript
// 计算ADX
function calculateADX(klines, period = 14) {
  // 计算True Range, +DM, -DM
  const trueRanges = [];
  const plusDMs = [];
  const minusDMs = [];
  
  for (let i = 1; i < klines.length; i++) {
    const high = parseFloat(klines[i].high);
    const low = parseFloat(klines[i].low);
    const prevHigh = parseFloat(klines[i - 1].high);
    const prevLow = parseFloat(klines[i - 1].low);

    const tr = Math.max(high - low, Math.abs(high - prevHigh), Math.abs(low - prevLow));
    trueRanges.push(tr);

    const plusDM = high - prevHigh > prevLow - low && high - prevHigh > 0 ? high - prevHigh : 0;
    const minusDM = prevLow - low > high - prevHigh && prevLow - low > 0 ? prevLow - low : 0;

    plusDMs.push(plusDM);
    minusDMs.push(minusDM);
  }

  // 计算平滑的TR, +DM, -DM，然后计算+DI, -DI, DX, ADX
  // ... (详细实现)
}
```

**布林带开口扩张检测**
```javascript
// 计算布林带开口扩张 - 严格按照strategy-v3.md文档
function isBBWExpanding(candles, period = 20, k = 2) {
  if (candles.length < period + 10) return false;

  const bb = calculateBollingerBands(candles, period, k);
  
  // 检查最近10根K线的带宽变化趋势
  const recentBB = bb.slice(-10);
  if (recentBB.length < 10) return false;

  // 计算带宽变化率
  const bandwidths = recentBB.map(b => b.bandwidth);
  const firstHalf = bandwidths.slice(0, 5);
  const secondHalf = bandwidths.slice(5);
  
  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  
  // 如果后半段平均带宽比前半段大5%以上，认为带宽扩张
  return avgSecond > avgFirst * 1.05;
}
```

**Delta (净主动买卖量)**
```javascript
// 计算Delta
function calculateDelta(klines) {
  return klines.map(k => {
    const high = parseFloat(k.high);
    const low = parseFloat(k.low);
    const close = parseFloat(k.close);
    const volume = parseFloat(k.volume);

    const priceRange = high - low;
    const pricePosition = priceRange > 0 ? (close - low) / priceRange : 0.5;
    
    // 如果收盘价在K线上半部分，认为是买入主导
    return pricePosition > 0.5 ? volume : -volume;
  });
}
```

**CVD (累计成交量差)**
```javascript
// 计算CVD
function calculateCVD(klines) {
  const deltas = calculateDelta(klines);
  const cvd = [];
  let cumulativeDelta = 0;

  for (const delta of deltas) {
    cumulativeDelta += delta;
    cvd.push(cumulativeDelta);
  }

  return cvd;
}
```

#### 1.3 信号判断逻辑

**4H趋势过滤**
```javascript
// 多头趋势：价格在MA20上方 + MA20 > MA50 > MA200 + 连续确认 + ADX > 20 + 布林带开口扩张
if (latestClose > latestMA20 && 
    latestMA20 > latestMA50 && 
    latestMA50 > latestMA200 &&
    trendConfirmed &&
    latestADX > 20 && 
    DIplus > DIminus &&
    bbwExpanding) {
  trend = 'UPTREND';
}

// 空头趋势：价格在MA20下方 + MA20 < MA50 < MA200 + 连续确认 + ADX > 20 + 布林带开口扩张
else if (latestClose < latestMA20 && 
         latestMA20 < latestMA50 && 
         latestMA50 < latestMA200 &&
         trendConfirmed &&
         latestADX > 20 && 
         DIminus > DIplus &&
         bbwExpanding) {
  trend = 'DOWNTREND';
}
```

**小时级多因子打分体系**
```javascript
// 6个条件，每个满足得1分
let score = 0;

// 1. VWAP方向一致
if (priceVsVwap > 0 || priceVsVwap < 0) score += 1;

// 2. 突破结构
if (breakoutUp || breakoutDown) score += 1;

// 3. 成交量确认
if (volumeRatio >= 1.5) score += 1;

// 4. OI确认
if (oiChange >= 2 || oiChange <= -2) score += 1;

// 5. 资金费率
if (Math.abs(fundingRate) <= 0.0015) score += 1;

// 6. Delta确认
if (deltaConfirmed) score += 1;

// 信号强度判断
if (score >= 4) signalStrength = 'STRONG';
else if (score >= 2) signalStrength = 'MODERATE';
```

**最终信号判断**
```javascript
// 只有当4H趋势明确且1H VWAP方向一致且1H得分≥3分时才产生信号
if (dailyTrend.trend === 'UPTREND' && hourlyConfirmation.signalStrength !== 'NONE') {
  signal = 'LONG';
} else if (dailyTrend.trend === 'DOWNTREND' && hourlyConfirmation.signalStrength !== 'NONE') {
  signal = 'SHORT';
}
```

**15分钟执行判断**
```javascript
// 模式A：回踩确认模式
if (pullbackToSupport && volumeContraction && (breakSetupHigh || breakSetupLow)) {
  executionMode = 'PULLBACK_CONFIRMATION';
  executionSignal = breakSetupHigh ? 'LONG_EXECUTE' : 'SHORT_EXECUTE';
}

// 模式B：动能突破模式
else if (momentumBreakout) {
  executionMode = 'MOMENTUM_BREAKOUT';
  executionSignal = breakSetupHigh ? 'LONG_EXECUTE' : 'SHORT_EXECUTE';
}
```

### 2. 斐波拉契滚仓计算器

#### 2.1 初始本金计算

**计算公式**
```
建议保证金 = 最大损失金额 ÷ (最大杠杆 × 止损距离)
```

**参数说明**
- 最大损失金额：用户设定的愿意承担的最大损失
- 最大杠杆：基于止损距离计算，确保风险可控
- 止损距离：((订单区上沿 - 止损价格) ÷ 订单区上沿) × 100%
- 止损价格：订单区下沿价格 - 4H级别ATR

#### 2.2 杠杆策略设计

**固定序列策略 [30, 25, 20, 15, 10, 5]**
- 使用预设的杠杆序列，从高到低递减
- 保证金计算：所需保证金 = (可用利润 × 0.1) ÷ 杠杆倍数
- 特点：高杠杆起步，风险较高但收益潜力大

**动态计算策略**
- 杠杆计算：baseLeverage × decayFactor
- 衰减因子：max(0.6, 1 - 步骤 × 0.08)
- 保证金计算：标准保证金 = 可用利润 ÷ 10
- 特点：保守策略，风险较低但收益相对稳定

#### 2.3 斐波拉契回调位

**回调位设置**
```
[0.236, 0.382, 0.5, 0.618, 0.786]
```

**计算方式**
```
峰值价格 = 起始价格 + 回调位 × (目标价格 - 起始价格)
回调价格 = 峰值价格 - 0.618 × (峰值价格 - 起始价格)
```

#### 2.4 风险控制机制

**本金保护判断**
```
判断条件：最坏情况损失 < 本金 × 0.8
最坏情况损失 = |目标价格 - 加权平均入场价| × 总数量
保护比例 = max(0, (本金 - 最坏情况损失) ÷ 本金)
```

**最大回撤计算**
```
最大回撤 = 最坏情况损失 ÷ 本金 × 100%
风险等级：
- 绿色（安全）：回撤 < 20%
- 黄色（中等）：20% ≤ 回撤 < 50%
- 红色（高风险）：回撤 ≥ 50%
```

### 3. 数据监控与告警系统

#### 3.1 数据质量监控

**监控指标**
- 数据收集成功率：各API接口调用成功率
- 数据验证状态：数据格式和内容验证结果
- 数据质量状态：分析过程中的错误和异常

**告警触发条件**
- 数据收集率 < 100%
- 数据验证出现错误
- 数据质量出现问题
- 告警冷却期：30分钟防止重复告警

#### 3.2 告警系统设计

**Telegram通知**
```javascript
// 告警消息格式
const alertMessage = `
🚨 SmartFlow 系统告警
时间: ${new Date().toLocaleString()}
数据收集率: ${dataCollectionRate}%
信号分析率: ${signalAnalysisRate}%
数据验证: ${dataValidation.hasErrors ? '❌ 异常' : '✅ 正常'}
数据质量: ${dataQuality.hasIssues ? '❌ 异常' : '✅ 正常'}
`;
```

### 4. 数据库设计

#### 4.1 核心表结构

**signals表**
```sql
CREATE TABLE signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  trend TEXT NOT NULL,
  signal TEXT NOT NULL,
  execution TEXT NOT NULL,
  -- 详细数据字段
  daily_trend_data TEXT,
  hourly_confirmation_data TEXT,
  execution_data TEXT,
  raw_data TEXT
);
```

**user_settings表**
```sql
CREATE TABLE user_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 4.2 数据关系

```
signals (1) ──→ (N) signal_history
user_settings (1) ──→ (N) user_preferences
```

### 5. API接口设计

#### 5.1 RESTful API

**主要接口**
- `GET /api/signals` - 获取所有交易对信号数据
- `GET /api/monitoring-dashboard` - 获取监控中心数据
- `GET /api/history/:symbol?` - 获取历史记录
- `POST /api/mark-result` - 标记结果

**用户设置接口**
- `GET /api/user-settings` - 获取用户设置
- `POST /api/user-settings` - 保存用户设置

**告警接口**
- `POST /api/trigger-alert-check` - 手动触发告警检查
- `POST /api/test-data-quality-alert` - 测试数据质量告警

**内存监控接口**
- `GET /api/memory` - 获取内存使用状态
- `POST /api/memory/gc` - 强制垃圾回收
- `POST /api/memory/clear` - 清理内存缓存

#### 5.2 数据格式

**信号数据格式**
```json
{
  "symbol": "BTCUSDT",
  "trend": "UPTREND",
  "signal": "LONG",
  "execution": "EXECUTION",
  "vwap": 110109.99,
  "volumeRatio": 1.44,
  "oiChange": -0.056,
  "fundingRate": 0.0000511,
  "cvd": "BEARISH",
  "cvdValue": -1361.73,
  "priceVsVwap": 221.00,
  "dataCollectionRate": 100
}
```

**内存监控数据格式**
```json
{
  "status": "NORMAL|WARNING|CRITICAL",
  "systemUsage": 85.2,
  "processUsage": {
    "rss": 125.4,
    "heapUsed": 89.2,
    "heapTotal": 120.5,
    "external": 15.3
  },
  "thresholds": {
    "warning": 90,
    "max": 95
  },
  "lastCleanup": "2025-01-10T10:30:00.000Z"
}
```

### 6. 前端界面设计

#### 6.1 主界面布局

**顶部导航**
- 系统标题和状态
- 刷新控制按钮
- 用户设置入口

**核心数据表格**
- 交易对列表
- 实时信号状态
- 数据采集率显示
- 折叠详情功能

**监控中心**
- 数据质量状态
- 告警信息
- 系统健康状态

#### 6.2 斐波拉契滚仓计算器

**输入区域**
- 最大损失金额
- 订单区价格范围
- 4H级别ATR
- 目标价格
- 杠杆策略选择

**计算结果显示**
- 初单计算结果
- 策略对比分析
- 滚仓路径详情
- 风险控制指标

**计算逻辑说明**
- 详细的计算公式
- 参数说明
- 风险等级说明

### 7. 数据更新机制

#### 7.1 分层更新策略

**趋势数据更新（4小时周期）**
- **更新频率**：每4小时更新一次
- **更新时间**：北京时间 00:00、04:00、08:00、12:00、16:00、20:00
- **更新内容**：4H趋势分析（MA20/50/200排列、价格位置）
- **技术实现**：`updateTrendData()` 方法调用 `analyzeDailyTrend()`

**信号数据更新（1小时周期）**
- **更新频率**：每1小时更新一次
- **更新内容**：小时确认分析（VWAP、成交量、OI、资金费率、CVD）
- **技术实现**：`updateSignalData()` 方法调用 `analyzeHourlyConfirmation()`

**入场执行更新（15分钟周期）**
- **更新频率**：每15分钟更新一次
- **更新内容**：15分钟执行分析（EMA回踩、突破确认、止损目标）
- **技术实现**：`updateExecutionData()` 方法调用 `analyze15mExecution()`

#### 7.2 更新状态监控

**前端状态显示**
```javascript
// 更新状态显示
updateStatusDisplay() {
  const formatTime = (time) => {
    if (!time) return '--';
    return new Date(time).toLocaleTimeString('zh-CN', { 
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };
  
  document.getElementById('trendUpdateTime').textContent = formatTime(this.updateTimes.trend);
  document.getElementById('signalUpdateTime').textContent = formatTime(this.updateTimes.signal);
  document.getElementById('executionUpdateTime').textContent = formatTime(this.updateTimes.execution);
}
```

**后端定时器管理**
```javascript
// 趋势数据定时器
this.trendInterval = setInterval(async () => {
  // 更新趋势数据
}, 4 * 60 * 60 * 1000); // 4小时

// 信号数据定时器
this.signalInterval = setInterval(async () => {
  // 更新信号数据
}, 60 * 60 * 1000); // 1小时

// 执行数据定时器
this.executionInterval = setInterval(async () => {
  // 更新执行数据
}, 15 * 60 * 1000); // 15分钟
```

#### 7.3 手动刷新机制

**保留功能**
- 手动刷新按钮：立即触发完整数据更新
- 单个交易对刷新：针对特定交易对进行数据更新
- 实时状态显示：显示各层数据的最后更新时间

**移除功能**
- 自动刷新间隔选择：不再提供用户自定义刷新频率
- 页面可见性自动暂停：简化刷新逻辑

### 8. 部署架构

#### 8.1 系统要求

**硬件要求**
- CPU: 2核心以上
- 内存: 1GB+ 最小，2GB+ 推荐（内存优化版本支持1GB环境）
- 存储: 30GB+ 可用空间
- 网络: 10Mbps以上带宽

**软件要求**
- Node.js: >= 18.0.0
- 操作系统: Ubuntu 20.04+ 或 CentOS 8+
- 数据库: SQLite3
- 进程管理: PM2

#### 7.2 部署流程

**1. 环境准备**
```bash
# 安装Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装PM2
npm install -g pm2
```

**2. 应用部署**
```bash
# 克隆代码
git clone https://github.com/username/smartflow.git
cd smartflow/vps-app

# 安装依赖
npm install

# 启动服务
pm2 start ecosystem.config.js
```

**3. 服务配置**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'smartflow-app',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 8080
    }
  }]
};
```

### 8. 监控与维护

#### 8.1 系统监控

**性能监控**
- CPU使用率
- 内存使用率
- 磁盘空间
- 网络连接状态

**应用监控**
- PM2进程状态
- 应用日志
- 数据库状态
- API响应时间

#### 8.2 维护策略

**定期维护**
- 数据库备份
- 日志清理
- 依赖更新
- 安全补丁

**故障处理**
- 自动重启机制
- 告警通知
- 日志分析
- 问题诊断

### 9. 安全设计

#### 9.1 数据安全

**API安全**
- 请求频率限制
- 数据验证
- 错误处理
- 日志记录

**数据库安全**
- 数据备份
- 访问控制
- 数据加密
- 定期清理

#### 9.2 系统安全

**网络安全**
- 防火墙配置
- SSL/TLS加密
- 访问控制
- 监控告警

**应用安全**
- 输入验证
- 错误处理
- 日志安全
- 依赖管理

### 10. 性能优化

#### 10.1 内存优化策略

**内存使用限制**
- 最大内存使用率：95%（1GB服务器环境）
- 警告阈值：90%
- 内存保留时间：15分钟内的聚合数据
- 自动清理机制：每5分钟清理过期数据

**数据存储分层**
- **数据库存储**：原始K线数据、技术指标、历史记录
- **内存存储**：15分钟内的聚合指标、全局统计、活跃交易
- **缓存策略**：API响应缓存、计算结果缓存、静态资源缓存

**内存监控系统**
```javascript
// 内存监控中间件
class MemoryMiddleware {
  constructor(options = {}) {
    this.maxMemoryUsage = options.maxMemoryUsage || 0.95;
    this.warningThreshold = options.warningThreshold || 0.90;
    this.lastCleanup = 0;
    this.cleanupInterval = 5 * 60 * 1000; // 5分钟清理一次
  }
}
```

**数据库表结构优化**
```sql
-- 原始K线数据表
CREATE TABLE kline_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  interval TEXT NOT NULL,
  open_time INTEGER NOT NULL,
  open_price REAL NOT NULL,
  high_price REAL NOT NULL,
  low_price REAL NOT NULL,
  close_price REAL NOT NULL,
  volume REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(symbol, interval, open_time)
);

-- 技术指标数据表
CREATE TABLE technical_indicators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  interval TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  atr REAL, atr14 REAL, vwap REAL,
  delta REAL, oi REAL, trend_4h TEXT,
  market_type TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(symbol, interval, timestamp)
);

-- 聚合指标表（15分钟数据）
CREATE TABLE aggregated_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  time_window TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  avg_atr REAL, avg_vwap REAL, avg_delta REAL,
  trend_consistency REAL, signal_strength REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(symbol, time_window, timestamp)
);

-- 策略分析表（V3策略完整字段）
CREATE TABLE strategy_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- 4H趋势过滤字段
  trend4h TEXT,                  -- 多头趋势/空头趋势/震荡市
  market_type TEXT,              -- 趋势市/震荡市
  adx14 REAL,                    -- ADX(14)指标
  bbw REAL,                      -- 布林带带宽
  trend_confirmed BOOLEAN DEFAULT FALSE, -- 趋势确认
  
  -- 1H多因子打分字段
  vwap_direction_consistent BOOLEAN DEFAULT FALSE, -- VWAP方向一致性
  breakout_confirmed BOOLEAN DEFAULT FALSE, -- 突破确认
  volume_15m_ratio REAL,         -- 15分钟成交量比率
  volume_1h_ratio REAL,          -- 1小时成交量比率
  oi_change_6h REAL,             -- 6小时持仓量变化
  delta_buy REAL,                -- 主动买盘
  delta_sell REAL,               -- 主动卖盘
  delta_imbalance REAL,          -- Delta不平衡
  factors TEXT,                  -- 多因子打分详情（JSON）
  strategy_version TEXT DEFAULT 'V3', -- 策略版本
  
  -- 震荡市相关字段
  range_lower_boundary_valid BOOLEAN DEFAULT FALSE, -- 下轨边界有效性
  range_upper_boundary_valid BOOLEAN DEFAULT FALSE, -- 上轨边界有效性
  bb_upper REAL,                 -- 布林带上轨
  bb_middle REAL,                -- 布林带中轨
  bb_lower REAL,                 -- 布林带下轨
  range_touches_lower INTEGER DEFAULT 0, -- 下轨触碰次数
  range_touches_upper INTEGER DEFAULT 0, -- 上轨触碰次数
  last_breakout BOOLEAN DEFAULT FALSE, -- 最近突破
  
  -- 新增：震荡市假突破和多因子打分字段
  bb_width_15m REAL,             -- 15分钟布林带宽
  fake_breakout_detected BOOLEAN DEFAULT FALSE, -- 假突破检测
  factor_score INTEGER DEFAULT 0, -- 多因子得分
  vwap_factor REAL,              -- VWAP因子
  delta_factor REAL,             -- Delta因子
  oi_factor REAL,                -- OI因子
  volume_factor REAL,            -- Volume因子
  
  -- 15分钟执行相关字段
  execution_mode_v3 TEXT,        -- V3执行模式
  setup_candle_high REAL,        -- Setup蜡烛高点
  setup_candle_low REAL,         -- Setup蜡烛低点
  atr14 REAL,                    -- ATR(14)指标
  time_in_position INTEGER DEFAULT 0, -- 持仓时间
  max_time_in_position INTEGER DEFAULT 48, -- 最大持仓时间
  
  -- 数据质量字段
  data_quality_score REAL DEFAULT 0, -- 数据质量得分
  cache_version INTEGER DEFAULT 1    -- 缓存版本
);
```

**内存清理机制**
- 定期清理过期数据（每5分钟）
- 强制垃圾回收（内存使用率>90%时）
- 数据库VACUUM优化（定期执行）
- 历史数据归档（保留最近7-30天）

#### 10.2 缓存策略

**数据缓存**
- API响应缓存：30秒-10分钟（根据数据类型）
- 计算结果缓存：5分钟
- 静态资源缓存：1年
- 缓存清理机制：自动清理过期缓存

**内存缓存管理**
```javascript
// 内存优化数据管理器
class MemoryOptimizedManager {
  constructor(database) {
    this.memoryRetentionMs = 15 * 60 * 1000; // 15分钟
    this.aggregatedMetrics = new Map(); // 聚合指标缓存
    this.globalStats = new Map(); // 全局统计
    this.activeSimulations = new Map(); // 活跃模拟交易
  }
}
```

#### 10.3 数据库优化

**查询优化**
- 索引设计：按symbol和时间戳建立复合索引
- 查询优化：使用LIMIT限制返回数据量
- 连接池管理：复用数据库连接
- 数据分页：大数据集分页查询

**数据清理策略**
- 策略分析数据：保留最近7天
- 模拟交易数据：保留最近30天
- 告警历史：保留最近14天
- 验证结果：保留最近3天

### 11. 扩展性设计

#### 11.1 模块化架构

**核心模块**
- 策略分析模块
- 数据监控模块
- 告警通知模块
- 用户管理模块

**扩展接口**
- 插件系统
- API扩展
- 数据源扩展
- 通知渠道扩展

#### 11.2 配置管理

**环境配置**
- 开发环境
- 测试环境
- 生产环境
- 配置热更新

### 12. 测试策略

#### 12.1 单元测试

**核心模块测试**
- 策略计算测试
- 数据验证测试
- API接口测试
- 数据库操作测试

#### 12.2 集成测试

**系统集成测试**
- 端到端测试
- 性能测试
- 压力测试
- 兼容性测试

### 13. 文档维护

#### 13.1 技术文档

**API文档**
- 接口说明
- 参数定义
- 响应格式
- 错误码说明

**开发文档**
- 代码规范
- 架构说明
- 部署指南
- 故障排除

#### 13.2 用户文档

**使用指南**
- 功能介绍
- 操作说明
- 常见问题
- 最佳实践

---

## 版本历史

- **v1.0.0** (2025-01-07): 初始版本，包含基础交易策略分析和斐波拉契滚仓计算器
- **v1.1.0** (2025-01-07): 增加数据监控和告警系统
- **v1.2.0** (2025-01-07): 完善用户设置和界面优化
- **v1.3.0** (2025-01-07): 修复杠杆策略差异问题，增加计算逻辑说明
- **v1.4.0** (2025-01-07): 实现分层更新机制，优化数据更新策略
- **v1.5.0** (2025-01-07): 配置域名和SSL证书，支持HTTPS访问
- **v3.0.0** (2025-01-09): V3策略版本，实现多周期共振机制
- **v3.1.0** (2025-01-09): 完善震荡市和趋势市判断逻辑
- **v3.2.0** (2025-01-09): 修复震荡市止损止盈逻辑，严格按照strategy-v3.md文档实现
- **v3.3.0** (2025-01-09): 修复4H趋势过滤逻辑，添加布林带带宽扩张检查，完善趋势强度确认
- **v3.4.0** (2025-01-09): 修复XLMUSDT TREND_REVERSAL问题，完善marketType获取逻辑，增强调试功能
- **v3.5.0** (2025-01-09): 重新实现震荡市策略逻辑，严格按照strategy-v3.md文档实现1H区间确认、15分钟假突破入场判断、多因子打分系统和止盈止损策略

## 域名配置

### 域名信息
- **域名**: smart.aimaventop.com
- **SSL证书**: Let's Encrypt (自动续期)
- **SSL模式**: Cloudflare Full (Strict)
- **HTTPS重定向**: 自动从HTTP重定向到HTTPS

### 服务器配置
- **操作系统**: Ubuntu 24.04 LTS
- **Web服务器**: Nginx 1.24.0
- **SSL管理**: Certbot
- **防火墙**: UFW (开放80、443、8080端口)

### 访问地址
- **主页**: https://smart.aimaventop.com/
- **API端点**: https://smart.aimaventop.com/api/signals
- **监控面板**: https://smart.aimaventop.com/api/monitoring-dashboard
- **斐波拉契计算器**: https://smart.aimaventop.com/rollup-calculator.html

---

## 联系方式

- 项目地址: https://github.com/username/smartflow
- 技术支持: support@smartflow.com
- 文档更新: 2025-01-07
