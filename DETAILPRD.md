# SmartFlow 详细产品设计文档 (DETAILPRD)

## 项目概述

SmartFlow 是一个基于多周期共振的高胜率高盈亏比加密货币交易策略系统，集成动态杠杆滚仓计算器。系统通过4H趋势过滤、1H确认、15分钟执行的三层共振机制，结合实时数据监控和告警系统，为交易者提供完整的策略分析和风险管理工具。

### 核心功能模块

1. **V3策略系统** - 多周期共振交易策略
2. **动态杠杆滚仓计算器** - 基于rolling-v1.md文档的智能滚仓策略
3. **实时数据监控** - Binance API数据采集和验证
4. **模拟交易系统** - 策略回测和风险管理
5. **Telegram通知** - 实时信号和交易通知

## 核心架构

### 1. V3策略实现架构

SmartFlow V3策略采用三层共振机制，严格按照strategy-v3.md文档实现：

```
┌─────────────────────────────────────────────────────────────┐
│                    V3策略三层共振架构                        │
├─────────────────────────────────────────────────────────────┤
│  第一层：4H趋势过滤 (StrategyV3Core.js)                     │
│  ├── MA排列判断 (MA20 > MA50 > MA100)                       │
│  ├── ADX条件 (ADX > 25)                                     │
│  ├── 布林带带宽扩张 (BB宽度 > 0.05)                         │
│  └── 连续确认机制 (连续2根4H K线确认)                        │
├─────────────────────────────────────────────────────────────┤
│  第二层：1H多因子打分 (StrategyV3Core.js)                   │
│  ├── VWAP方向一致性 (必须满足)                               │
│  ├── Delta因子 (资金流向指标)                                │
│  ├── OI因子 (持仓量变化)                                     │
│  └── 成交量因子 (成交量放大)                                 │
├─────────────────────────────────────────────────────────────┤
│  第三层：15分钟入场执行 (StrategyV3Execution.js)            │
│  ├── 布林带收窄 (BB宽度 < 0.05)                             │
│  ├── 假突破识别 (突破后快速回撤)                             │
│  ├── 成交量确认 (成交量放大1.2倍以上)                        │
│  └── 止损止盈 (基于ATR计算)                                 │
├─────────────────────────────────────────────────────────────┤
│  数据刷新频率管理 (DataRefreshManager.js)                   │
│  ├── 4H趋势：每4小时更新一次                                 │
│  ├── 1H打分：每1小时更新一次                                 │
│  └── 15分钟入场：每15分钟更新一次                            │
└─────────────────────────────────────────────────────────────┘
```

### 2. 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    SmartFlow 系统架构                        │
├─────────────────────────────────────────────────────────────┤
│  前端层 (Frontend)                                          │
│  ├── 主界面 (index.html)                                    │
│  ├── 动态杠杆滚仓计算器 (rollup-calculator.html)            │
│  ├── 样式文件 (main.css)                                    │
│  └── JavaScript 模块                                        │
│      ├── main.js (主逻辑)                                   │
│      ├── api.js (API客户端)                                 │
│      ├── DataManager.js (数据管理)                          │
│      └── Modal.js (组件)                                    │
├─────────────────────────────────────────────────────────────┤
│  后端层 (Backend)                                           │
│  ├── 服务器 (server.js)                                     │
│  ├── 策略模块 (SmartFlowStrategyV3.js)                      │
│  ├── 数据监控 (DataMonitor.js)                              │
│  ├── 数据库管理 (DatabaseManager.js)                        │
│  ├── 多因子权重管理 (FactorWeightManager.js)                │
│  ├── API接口 (BinanceAPI.js)                               │
│  ├── 限流器 (RateLimiter.js)                               │
│  ├── 通知系统 (TelegramNotifier.js)                        │
│  ├── 内存优化 (MemoryOptimizedManager.js)                  │
│  ├── 内存监控 (MemoryMonitor.js)                           │
│  ├── Delta实时计算 (DeltaRealTimeManager.js)               │
│  └── 工具模块 (TechnicalIndicators.js, DataCache.js)       │
├─────────────────────────────────────────────────────────────┤
│  数据层 (Data Layer)                                        │
│  ├── SQLite 数据库 (smartflow.db)                          │
│  │   ├── 策略分析表 (strategy_analysis)                     │
│  │   ├── 模拟交易表 (simulations)                           │
│  │   ├── K线数据表 (kline_data)                             │
│  │   ├── 技术指标表 (technical_indicators)                  │
│  │   ├── 聚合指标表 (aggregated_metrics)                    │
│  │   ├── V3策略分析表 (strategy_v3_analysis)                │
│  │   ├── 数据刷新状态表 (data_refresh_status)               │
│  │   ├── 趋势反转记录表 (trend_reversal_records)             │
│  │   ├── 交易对分类表 (symbol_categories)                   │
│  │   └── 多因子权重表 (factor_weights)                      │
│  ├── Binance Futures API                                   │
│  ├── Binance WebSocket (aggTrade)                          │
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

### 3. 数据库表结构关系图

```
┌─────────────────────────────────────────────────────────────┐
│                    SmartFlow 数据库表结构关系图                │
├─────────────────────────────────────────────────────────────┤
│  核心业务表                                                  │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │  strategy_analysis │    │  simulations    │                │
│  │  (策略分析表)     │    │  (模拟交易表)   │                │
│  │  - id (PK)       │    │  - id (PK)      │                │
│  │  - symbol        │    │  - symbol       │                │
│  │  - trend4h       │    │  - entry_price  │                │
│  │  - signal        │    │  - stop_loss    │                │
│  │  - execution     │    │  - take_profit  │                │
│  │  - timestamp     │    │  - status       │                │
│  └─────────────────┘    └─────────────────┘                │
│           │                       │                        │
│           └───────────┬───────────┘                        │
│                       │                                    │
│  ┌─────────────────┐  │  ┌─────────────────┐                │
│  │  kline_data     │  │  │  technical_indicators │          │
│  │  (K线数据表)     │  │  │  (技术指标表)   │                │
│  │  - id (PK)      │  │  │  - id (PK)      │                │
│  │  - symbol       │  │  │  - symbol       │                │
│  │  - interval     │  │  │  - interval     │                │
│  │  - open_time    │  │  │  - timestamp    │                │
│  │  - open_price   │  │  │  - atr14        │                │
│  │  - high_price   │  │  │  - vwap         │                │
│  │  - low_price    │  │  │  - delta        │                │
│  │  - close_price  │  │  │  - oi           │                │
│  │  - volume       │  │  │  - trend_4h     │                │
│  └─────────────────┘  │  └─────────────────┘                │
│           │           │           │                        │
│           └───────────┼───────────┘                        │
│                       │                                    │
├─────────────────────────────────────────────────────────────┤
│  监控和日志表                                                │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │  analysis_logs  │    │  data_quality_issues │            │
│  │  (分析日志表)    │    │  (数据质量表)   │                │
│  │  - id (PK)      │    │  - id (PK)      │                │
│  │  - symbol       │    │  - symbol       │                │
│  │  - analysis_type│    │  - issue_type   │                │
│  │  - success      │    │  - description  │                │
│  │  - error_msg    │    │  - severity     │                │
│  │  - timestamp    │    │  - timestamp    │                │
│  └─────────────────┘    └─────────────────┘                │
│           │                       │                        │
│           └───────────┬───────────┘                        │
│                       │                                    │
│  ┌─────────────────┐  │  ┌─────────────────┐                │
│  │  validation_results │  │  win_rate_stats │                │
│  │  (验证结果表)    │  │  │  (胜率统计表)   │                │
│  │  - id (PK)      │  │  │  - id (PK)      │                │
│  │  - symbol       │  │  │  - total_trades │                │
│  │  - validation_type│  │  │  - winning_trades │            │
│  │  - result       │  │  │  - win_rate     │                │
│  │  - details      │  │  │  - total_profit │                │
│  │  - timestamp    │  │  │  - last_updated │                │
│  └─────────────────┘  │  └─────────────────┘                │
│                       │                                    │
├─────────────────────────────────────────────────────────────┤
│  配置和状态表                                                │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │  data_refresh_status │  │  user_settings │                │
│  │  (数据刷新状态) │    │  │  (用户设置表)   │                │
│  │  - id (PK)      │    │  │  - id (PK)      │                │
│  │  - symbol       │    │  │  - setting_key  │                │
│  │  - data_type    │    │  │  - setting_value│                │
│  │  - last_refresh │    │  │  - updated_at   │                │
│  │  - next_refresh │    │  └─────────────────┘                │
│  │  - should_refresh│   │                                    │
│  └─────────────────┘    │                                    │
│           │             │                                    │
│           └─────────────┼────────────────────────────────────┘
│                         │
│  ┌─────────────────┐    │
│  │  trend_reversal_records │
│  │  (趋势反转记录) │    │
│  │  - id (PK)      │    │
│  │  - symbol       │    │
│  │  - old_trend    │    │
│  │  - new_trend    │    │
│  │  - timestamp    │    │
│  └─────────────────┘    │
│                         │
│  ┌─────────────────┐    │
│  │  aggregated_metrics │
│  │  (聚合指标表)    │    │
│  │  - id (PK)      │    │
│  │  - symbol       │    │
│  │  - time_window  │    │
│  │  - timestamp    │    │
│  │  - avg_atr      │    │
│  │  - avg_vwap     │    │
│  │  - avg_delta    │    │
│  └─────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

#### 表关系说明

**主要关系**：
- `strategy_analysis` ←→ `simulations`：策略分析结果触发模拟交易
- `kline_data` ←→ `technical_indicators`：K线数据计算技术指标
- `strategy_analysis` ←→ `analysis_logs`：策略分析记录日志
- `simulations` ←→ `win_rate_stats`：模拟交易结果统计胜率

**数据流向**：
1. **数据采集**：`kline_data` ← Binance API
2. **指标计算**：`kline_data` → `technical_indicators`
3. **策略分析**：`technical_indicators` → `strategy_analysis`
4. **模拟交易**：`strategy_analysis` → `simulations`
5. **监控记录**：所有表 → `analysis_logs`, `data_quality_issues`
6. **统计汇总**：`simulations` → `win_rate_stats`

**索引优化**：
- 所有表都有 `(symbol, timestamp)` 复合索引
- 外键关系通过 `symbol` 字段关联
- 时间范围查询优化：`timestamp` 字段索引

## 核心功能详细设计

### 1. 交易策略分析系统

#### 1.1 多周期共振机制

**4H级趋势过滤 (4H) - 10分打分机制**
- **趋势方向（必选）**：每个方向至少需要2分
  - 多头方向：收盘价 > MA20（1分）+ MA20 > MA50（1分）+ MA50 > MA200（1分）
  - 空头方向：收盘价 < MA20（1分）+ MA20 < MA50（1分）+ MA50 < MA200（1分）
- **趋势稳定性（1分）**：连续≥2根4H K线满足趋势方向，确保趋势稳定性
- **趋势强度（1分）**：ADX(14) > 20 且 DI方向正确
- **布林带扩张（1分）**：最近10根K线，后5根BBW均值 > 前5根均值 × 1.05
- **动量确认（1分）**：当前K线收盘价离MA20距离 ≥ 0.5%
- **最终判断**：得分≥4分才保留趋势，否则为震荡市

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

**Delta实时计算系统**
```javascript
// Delta实时计算管理器 - 按照strategy-v3.md实现
class DeltaRealTimeManager {
  constructor() {
    this.deltaData = new Map(); // 存储各交易对的Delta数据
    this.connections = new Map(); // 存储WebSocket连接
    this.trades = new Map(); // 存储原始交易数据
    
    // 15分钟Delta平滑配置
    this.delta15m = new Map(); // 15分钟Delta数据
    this.ema15mPeriod = 3; // EMA(3)平滑
    
    // 1小时Delta平滑配置
    this.delta1h = new Map(); // 1小时Delta数据
    this.ema1hPeriod = 6; // EMA(6)平滑
  }

  // 计算聚合Delta
  calcDelta(tradeList) {
    let buy = 0, sell = 0;
    for (let t of tradeList) {
      if (t.maker) {
        // maker = true 表示买方被动成交 → 主动卖单
        sell += parseFloat(t.q);
      } else {
        // maker = false 表示卖方被动成交 → 主动买单
        buy += parseFloat(t.q);
      }
    }
    let total = buy + sell;
    if (total === 0) return 0;
    return (buy - sell) / total; // -1~+1 之间
  }

  // 计算EMA平滑
  calculateEMA(values, period) {
    if (values.length === 0) return null;
    let k = 2 / (period + 1);
    return values.reduce((prev, curr, i) => {
      if (i === 0) return curr;
      return curr * k + prev * (1 - k);
    });
  }

  // 15分钟Delta聚合处理
  process15mDelta(symbol) {
    const trades = this.trades.get(symbol) || [];
    const now = Date.now();
    const cutoff = now - 15 * 60 * 1000; // 15分钟前

    // 筛选15分钟窗口内的交易
    const windowTrades = trades.filter(t => t.T >= cutoff);
    const rawDelta = this.calcDelta(windowTrades);

    // 添加到15分钟Delta数组
    const delta15mArray = this.delta15m.get(symbol) || [];
    delta15mArray.push(rawDelta);
    if (delta15mArray.length > 20) delta15mArray.shift(); // 保留最近20个周期
    this.delta15m.set(symbol, delta15mArray);

    // EMA(3)平滑处理
    const smoothedDelta = this.calculateEMA(delta15mArray, this.ema15mPeriod);

    // 更新Delta数据
    const deltaData = this.deltaData.get(symbol);
    if (deltaData && smoothedDelta !== null) {
      deltaData.delta15m = smoothedDelta;
    }
  }

  // 1小时Delta聚合处理
  process1hDelta(symbol) {
    const trades = this.trades.get(symbol) || [];
    const now = Date.now();
    const cutoff = now - 60 * 60 * 1000; // 1小时前

    // 筛选1小时窗口内的交易
    const windowTrades = trades.filter(t => t.T >= cutoff);
    const rawDelta = this.calcDelta(windowTrades);

    // 添加到1小时Delta数组
    const delta1hArray = this.delta1h.get(symbol) || [];
    delta1hArray.push(rawDelta);
    if (delta1hArray.length > 20) delta1hArray.shift(); // 保留最近20个周期
    this.delta1h.set(symbol, delta1hArray);

    // EMA(6)平滑处理
    const smoothedDelta = this.calculateEMA(delta1hArray, this.ema1hPeriod);

    // 更新Delta数据
    const deltaData = this.deltaData.get(symbol);
    if (deltaData && smoothedDelta !== null) {
      deltaData.delta1h = smoothedDelta;
    }
  }
}
```

**Delta时间级别应用**
- **15分钟Delta (EMA3平滑)**: 用于震荡市15分钟假突破确认
- **1小时Delta (EMA6平滑)**: 用于趋势市1H多因子打分和震荡市1H边界确认
- **实时Delta**: 用于实时买卖盘不平衡监控

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

#### 1.3 交易对分类和权重管理

#### 1.3.1 交易对分类体系

**分类标准**
- **主流币 (mainstream)**: BTCUSDT, ETHUSDT, BNBUSDT, ADAUSDT, XRPUSDT, SOLUSDT, DOGEUSDT, TRXUSDT
- **高市值趋势币 (highcap)**: LINKUSDT, AVAXUSDT, SUIUSDT, TAOUSDT, ONDOUSDT, AAVEUSDT, ENAUSDT
- **热点币 (trending)**: PEPEUSDT, WLDUSDT, MYXUSDT, IPUSDT, HYPEUSDT, FETUSDT, MUSDT
- **小币 (smallcap)**: 其他未明确分类的交易对

**分类逻辑**
```javascript
// 交易对分类判断逻辑
function categorizeSymbol(symbol) {
  const mainstream = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT', 'SOLUSDT', 'DOGEUSDT', 'TRXUSDT'];
  const highcap = ['LINKUSDT', 'AVAXUSDT', 'SUIUSDT', 'TAOUSDT', 'ONDOUSDT', 'AAVEUSDT', 'ENAUSDT'];
  const trending = ['PEPEUSDT', 'WLDUSDT', 'MYXUSDT', 'IPUSDT', 'HYPEUSDT', 'FETUSDT', 'MUSDT'];
  
  if (mainstream.includes(symbol)) return 'mainstream';
  if (highcap.includes(symbol)) return 'highcap';
  if (trending.includes(symbol)) return 'trending';
  return 'smallcap';
}
```

#### 1.3.2 多因子权重配置

**权重配置表**
| 分类 | VWAP权重 | Delta权重 | OI权重 | Volume权重 | 说明 |
|------|----------|-----------|--------|------------|------|
| 主流币 | 30% | 30% | 20% | 20% | 均衡配置，各因子重要性相当 |
| 高市值趋势币 | 25% | 35% | 25% | 15% | Delta和OI更重要，适合趋势判断 |
| 热点币 | 20% | 20% | 20% | 40% | Volume最重要，热点币靠成交量驱动 |
| 小币 | 10% | 20% | 20% | 50% | Volume和OI核心，VWAP参考作用低 |

**权重计算逻辑**
```javascript
// 多因子权重计算
function calculateWeightedScore(symbol, analysisType, factorValues) {
  const category = getSymbolCategory(symbol);
  const weights = getFactorWeights(category, analysisType);
  
  let weightedScore = 0;
  weightedScore += factorValues.vwap ? weights.vwap_weight : 0;
  weightedScore += factorValues.delta ? weights.delta_weight : 0;
  weightedScore += factorValues.oi ? weights.oi_weight : 0;
  weightedScore += factorValues.volume ? weights.volume_weight : 0;
  
  return {
    category,
    score: weightedScore,
    factorScores: {
      vwap: factorValues.vwap ? weights.vwap_weight : 0,
      delta: factorValues.delta ? weights.delta_weight : 0,
      oi: factorValues.oi ? weights.oi_weight : 0,
      volume: factorValues.volume ? weights.volume_weight : 0
    },
    weights
  };
}
```

#### 1.3.3 分类权重应用场景

**1H多因子打分应用**
- 趋势市：使用分类权重进行1H多因子打分
- 震荡市：使用分类权重进行1H边界确认

**15分钟执行应用**
- 震荡市假突破：使用分类权重进行多因子确认
- 趋势市回踩：使用分类权重进行入场确认

### 1.4 信号判断逻辑

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

### 2. 动态杠杆滚仓计算器

#### 2.1 功能概述

动态杠杆滚仓计算器是基于rolling-v1.md文档实现的智能滚仓策略工具，完全重构了原有的斐波拉契滚仓计算器。该工具专注于动态杠杆递减的滚仓策略，通过参数化配置和实时计算，为用户提供专业的滚仓策略分析和风险管理。

#### 2.2 核心算法设计

**动态杠杆滚仓策略 (simulateDynamicPyramid)**

基于文档中的Step 1-4实现完整的动态杠杆滚仓流程：

```javascript
// 核心算法实现
simulateDynamicPyramid({
  principal,           // 本金 (来自初单计算)
  initialLeverage,    // 初始杠杆 (来自初单计算)
  priceStart,         // 开仓价 (用户输入)
  priceTarget,        // 目标价 (用户输入)
  triggerRatio,       // 滚仓触发浮盈比例 (0.5-2.0)
  leverageDecay,      // 杠杆递减系数 (0.3-0.7)
  profitLockRatio,    // 每次落袋比例 (0.3-0.7)
  minLeverage         // 最低杠杆 (3-15)
})
```

#### 2.3 策略步骤实现

**Step 1：初始开仓**
- 使用初单计算模块计算的本金和初始杠杆
- 建立初始仓位：`position = principal × initialLeverage`
- 设置止损保护：基于最大损失金额计算

**Step 2：第一阶段盈利触发**
- 监控浮盈：`floatingProfit = position × (price - priceStart) / priceStart`
- 触发条件：`floatingProfit >= principal × triggerRatio`
- 执行操作：
  - 抽回本金：`equity += principal`
  - 落袋部分利润：`lockedProfit += floatingProfit × profitLockRatio`
  - 剩余浮盈滚仓：`position = remainingFloatingProfit × newLeverage`

**Step 3：后续滚仓阶段**
- 杠杆递减：`leverage = max(minLeverage, leverage × leverageDecay)`
- 重复Step 2的触发和操作逻辑
- 持续监控价格变化，执行滚仓操作

**Step 4：趋势结束**
- 全部盈利落袋：`totalProfit = lockedProfit + floatingProfit`
- 确保本金安全：`finalAccount = equity + totalProfit`
- 计算收益率：`returnRate = (totalProfit / principal) × 100`

#### 2.4 初单计算模块（保留）

**计算公式**
```
建议保证金 = 最大损失金额 ÷ (最大杠杆 × 止损距离)
```

**参数说明**
- 最大损失金额：用户设定的愿意承担的最大损失
- 最大杠杆：基于止损距离计算，确保风险可控
- 止损距离：((当前价格 - 止损价格) ÷ 当前价格) × 100%
- 止损价格：用户直接输入的止损价格

#### 2.5 参数化配置

**滚仓触发浮盈比例**：0.5-2.0（默认1.0）
- 0.5：浮盈达到本金50%时触发滚仓
- 1.0：浮盈达到本金100%时触发滚仓（推荐）
- 1.5：浮盈达到本金150%时触发滚仓
- 2.0：浮盈达到本金200%时触发滚仓

**杠杆递减系数**：0.3-0.7（默认0.5）
- 0.3：激进递减，杠杆快速降低
- 0.5：标准递减，平衡风险和收益（推荐）
- 0.7：温和递减，保持较高杠杆

**每次落袋比例**：30%-70%（默认50%）
- 30%：保守落袋，更多资金用于滚仓
- 50%：平衡落袋，风险收益平衡（推荐）
- 70%：积极落袋，更多利润锁定

**最低杠杆**：3x-15x（默认5x）
- 3x：极保守，风险最低
- 5x：保守，适合稳健投资者（推荐）
- 8x：平衡，风险收益适中
- 15x：激进，追求更高收益

#### 2.6 风险控制机制

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
- **V3.9优化**：内存使用率从90%降至48.8%，缓存大小从1000增加到5000

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
- **V3.9优化**：监控数据TTL从30秒减少到10秒，内存缓存大小增加到5000

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
- 策略分析数据：保留最近7天（V3.9优化：保留最近1000条记录）
- 模拟交易数据：保留最近30天
- 告警历史：保留最近14天
- 验证结果：保留最近3天
- **V3.9新增**：自动清理50,000+条历史记录，数据库压缩和索引重建

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

## 数据库表结构优化实施

### 已实施的优化措施

基于database-optimization-analysis.md报告，已成功实施以下数据库优化措施：

#### 1. 复合索引优化

**已创建的复合索引**：
```sql
-- 主要查询模式索引
CREATE INDEX idx_strategy_analysis_symbol_time_trend 
ON strategy_analysis(symbol, timestamp, trend4h);

CREATE INDEX idx_strategy_analysis_symbol_time_market 
ON strategy_analysis(symbol, timestamp, market_type);

CREATE INDEX idx_strategy_analysis_symbol_time_signal 
ON strategy_analysis(symbol, timestamp, signal);

CREATE INDEX idx_simulations_symbol_status_time 
ON simulations(symbol, status, created_at);
```

#### 2. 冗余索引清理

**已删除的冗余索引**：
```sql
-- 删除单字段索引，保留复合索引
DROP INDEX idx_strategy_analysis_trend;
DROP INDEX idx_strategy_analysis_signal;
DROP INDEX idx_strategy_analysis_execution;
DROP INDEX idx_strategy_analysis_trend4h;
DROP INDEX idx_strategy_analysis_market_type;
```

#### 3. 数据类型统一

**布尔值类型统一**：
- 所有BOOLEAN字段统一为INTEGER类型（0/1）
- 时间戳格式统一为INTEGER类型
- 数值类型统一为REAL类型

#### 4. 枚举值表创建

**已创建的枚举值表**：
```sql
-- 信号类型枚举表
CREATE TABLE signal_types (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT
);
INSERT INTO signal_types VALUES 
(1, 'LONG', '做多信号'),
(2, 'SHORT', '做空信号'),
(3, 'NONE', '无信号');

-- 市场类型枚举表
CREATE TABLE market_types (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT
);
INSERT INTO market_types VALUES 
(1, '趋势市', '趋势市场'),
(2, '震荡市', '震荡市场');

-- 执行模式枚举表
CREATE TABLE execution_modes (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT
);
INSERT INTO execution_modes VALUES 
(1, '多头回踩突破', '趋势市多头模式'),
(2, '空头反抽破位', '趋势市空头模式'),
(3, '区间多头', '震荡市多头模式'),
(4, '区间空头', '震荡市空头模式'),
(5, '假突破反手', '假突破反手模式'),
(6, 'NONE', '无信号');
```

#### 5. 历史数据清理

**已清理的数据**：
- 清理30天前的strategy_analysis记录
- 清理3天前的validation_results记录
- 保留最近1000条策略分析记录

#### 6. 数据库性能优化

**已执行的优化操作**：
```sql
-- 数据库压缩和优化
VACUUM;
REINDEX;
ANALYZE;

-- 性能参数优化
PRAGMA synchronous = NORMAL;
PRAGMA journal_mode = WAL;
PRAGMA cache_size = 10000;
```

### 优化效果

1. **查询性能提升** - 复合索引显著提高常用查询性能
2. **存储空间优化** - 删除冗余索引，减少存储空间占用
3. **数据一致性** - 统一数据类型，提高数据一致性
4. **维护性提升** - 枚举值表提高数据维护性
5. **数据库性能** - VACUUM和REINDEX操作优化数据库性能

## 版本历史

- **v1.0.0** (2025-01-07): 初始版本，包含基础交易策略分析和动态杠杆滚仓计算器
- **v1.1.0** (2025-01-07): 动态杠杆滚仓计算器优化，完全重构基于rolling-v1.md文档的智能滚仓策略
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
- **v3.6.0** (2025-01-09): 修复监控页面显示问题，重构监控数据存储架构，新增数据库表结构自动更新机制
- **v3.7.0** (2025-01-09): 修复4个核心问题（4H趋势为空、止损止盈价格错误、SIGNAL_NONE触发交易、盈亏状态不一致），优化震荡市策略，实现数据刷新频率管理
- **v3.8.0** (2025-01-09): 修复15min信号显示问题，增强代码健壮性，完善单元测试框架
- **v3.9.0** (2025-01-09): VPS内存优化，缓存系统优化，性能监控增强，数据库历史数据清理
- **v3.10.0** (2025-01-09): 模拟交易数据一致性修复，数据库表结构优化，实时监控增强，前端规则更新
- **v3.11.0** (2025-01-12): 数据库实例传递修复，服务启动语法错误修复，单元测试完善，代码健壮性提升
- **v3.12.0** (2025-01-12): 4H趋势判断逻辑优化，按照strategy-v3.md文档实现10分打分机制，拆开多头空头记分，API响应字段扩展，单元测试完善，文档更新

### v3.11.0 详细更新内容

#### 数据库实例传递修复
- **问题识别** - 发现SmartFlowStrategyV3静态组件初始化时数据库实例传递失败的问题
- **根本原因** - SmartFlowStrategyV3.core和SmartFlowStrategyV3.execution静态属性在类定义时直接实例化，无法接收数据库参数
- **修复方案** - 修改为延迟初始化模式，通过静态init方法正确传递数据库实例到所有子模块
- **影响范围** - 修复FactorWeightManager数据库方法调用错误，确保交易对分类和权重管理功能正常

#### 服务启动语法错误修复
- **问题识别** - 发现server.js第1084行存在多余字符'n'导致SyntaxError: Unexpected identifier
- **根本原因** - 代码编辑过程中的意外字符插入
- **修复方案** - 删除多余的字符'n'，确保代码语法正确
- **部署验证** - 本地和VPS环境都成功修复并验证服务正常启动

#### 单元测试完善
- **新增测试文件** - 创建smartflow-strategy-v3-init.test.js专门测试SmartFlowStrategyV3初始化逻辑
- **集成测试** - 创建database-instance-propagation.test.js验证数据库实例正确传递到所有子模块
- **测试覆盖** - 覆盖数据库连接失败、查询错误、重复初始化等边界情况
- **测试验证** - 所有16个测试用例通过，确保代码健壮性

#### 代码健壮性提升
- **错误处理增强** - FactorWeightManager在数据库连接失败时返回默认权重而非抛出错误
- **模块初始化优化** - 确保所有策略模块正确接收数据库实例并初始化内部组件
- **静态方法重构** - 将静态属性从直接实例化改为延迟初始化，提高灵活性
- **服务稳定性** - 修复后服务能够稳定启动和运行，无语法错误

### v3.12.0 详细更新内容

#### 4H趋势判断逻辑优化
- **问题识别** - 发现原有5分打分机制与strategy-v3.md文档要求不符，需要实现10分打分机制
- **根本原因** - 原实现没有拆开多头和空头方向的记分，且总分阈值设置不正确
- **修复方案** - 按照文档重新实现10分打分机制，拆开多头空头记分，每个方向至少需要2分
- **技术实现** - 修改StrategyV3Core.js中的analyze4HTrend方法，实现完整的10分打分逻辑

#### 趋势方向得分分离
- **多头方向得分** - 收盘价 > MA20（1分）+ MA20 > MA50（1分）+ MA50 > MA200（1分）
- **空头方向得分** - 收盘价 < MA20（1分）+ MA20 < MA50（1分）+ MA50 < MA200（1分）
- **方向判断逻辑** - 只有当一个方向得分≥2分时才保留该方向，否则判断为震荡市
- **总分计算** - 基础方向得分 + 趋势稳定性（1分）+ 趋势强度（1分）+ 布林带扩张（1分）+ 动量确认（1分）

#### API响应字段扩展
- **新增字段** - 在server.js中添加bullScore和bearScore字段到API响应映射
- **字段说明** - bullScore表示多头方向得分（0-3分），bearScore表示空头方向得分（0-3分）
- **向后兼容** - 保持原有API结构不变，仅新增字段，确保前端兼容性
- **测试验证** - 通过VPS部署测试验证新字段正确显示

#### 单元测试完善
- **新增测试文件** - 创建strategy-4h-trend.test.js专门测试4H趋势判断逻辑
- **测试覆盖** - 覆盖多头趋势、空头趋势、震荡市、边界条件等各种场景
- **测试用例** - 包含趋势方向得分计算、总分计算、最终判断等核心逻辑测试
- **测试验证** - 所有测试用例通过，确保新逻辑的正确性

#### 文档更新
- **API文档更新** - 更新API_DOCUMENTATION.md，添加新字段说明和10分打分机制描述
- **产品文档更新** - 更新DETAILPRD.md，详细描述新的4H趋势判断逻辑
- **版本历史更新** - 添加v3.12.0版本的详细更新内容记录
- **技术规范** - 确保文档与代码实现完全一致

### v3.6.0 详细更新内容

#### 监控页面显示修复
- **模拟交易完成率格式** - 修复显示格式，保留小数点后一位（如：60.7%）
- **模拟交易状态显示** - 修复进行中记录显示为"进行中"而不是"亏损"
- **数据收集率显示** - 确认主页和监控页面使用不同API导致显示不一致的问题

#### 模拟交易逻辑修复
- **SIGNAL_NONE触发问题** - 添加NONE检查，防止SIGNAL_NONE触发模拟交易
- **执行信号验证** - 在autoStartSimulation和updateExecutionData方法中添加execution === 'NONE'检查
- **触发条件优化** - 确保只有有效的执行信号才能触发模拟交易

#### 监控数据存储架构重构
- **内存优化** - 将日志数据从内存迁移到数据库，减少内存占用
- **数据持久化** - 分析日志、数据质量问题、验证结果存储到数据库
- **自动清理机制** - 定期清理过期的监控数据，保持数据库性能

#### 数据库表结构更新
- **新增表结构**：
  - `analysis_logs` - 存储分析日志数据
  - `data_quality_issues` - 存储数据质量问题
  - `validation_results` - 存储验证结果数据
- **自动更新机制** - 服务器启动时自动更新数据库表结构
- **索引优化** - 为新增表添加适当的索引以提高查询性能

#### 技术架构改进
- **模块化设计** - 将监控数据存储逻辑模块化
- **错误处理** - 改进错误处理和日志记录机制
- **性能优化** - 优化数据库查询和内存使用

### v3.7.0 详细更新内容

#### 核心问题修复
- **4H趋势显示问题** - 修复AVNTUSDT等交易对4H趋势显示为空的问题，确保数据不足时默认返回"震荡市"
- **止损止盈价格逻辑** - 修复ENAUSDT等做空交易止损价格低于止盈价格的错误，确保价格逻辑正确
- **SIGNAL_NONE触发问题** - 完善无效信号过滤，防止SIGNAL_NONE、NONE、null等信号触发模拟交易
- **盈亏状态一致性** - 修复有盈亏金额但状态为"进行中"的记录，确保状态与盈亏金额一致

#### 震荡市策略优化
- **1H边界多因子打分** - 实现基于6个因子的边界有效性判断（连续触碰、成交量、Delta、OI、无突破、VWAP）
- **15分钟假突破入场** - 结合布林带宽收窄、假突破验证和多因子确认的入场判断
- **多因子打分系统** - 实现VWAP、Delta、OI、Volume四个因子的量化打分（-4到+4分）

#### 数据刷新频率管理
- **分层刷新策略** - 4H趋势每1小时，1H打分每5分钟，15m入场每1-3分钟，Delta数据实时
- **数据新鲜度监控** - 实现数据刷新状态监控和过期数据检测
- **强制刷新功能** - 支持手动强制刷新指定交易对的数据

#### 数据库优化
- **数据清理功能** - 添加cleanupInconsistentSimulations方法修复历史不一致记录
- **表结构更新** - 新增factor_score_15m、boundary_score_1h等震荡市策略字段
- **数据验证增强** - 新增多因子打分验证和边界得分验证

### v3.8.0 详细更新内容

#### 15min信号显示修复
- **undefined模式问题** - 修复前端显示"做空_undefined NONE"的问题，完善formatExecution方法处理undefined mode
- **executionMode字段赋值** - 确保analyzeRangeExecution中mode字段正确设置为"假突破反手"或"NONE"
- **日志显示优化** - 解决日志中显示"模式=undefined"的问题，所有executionMode字段都有默认值'NONE'

#### 代码健壮性增强
- **单元测试框架** - 添加Jest测试框架，创建StrategyV3Execution和SmartFlowStrategyV3的单元测试
- **错误处理完善** - 确保所有信号格式化都有适当的默认值处理，防止undefined值导致的显示问题
- **代码质量保障** - 通过单元测试验证formatExecution、calculateFactorScore等核心方法的正确性

#### 技术架构改进
- **测试配置** - 配置Jest测试环境和覆盖率报告
- **Mock依赖** - 为测试创建BinanceAPI等外部依赖的Mock
- **测试覆盖** - 覆盖核心策略逻辑的边界情况和异常处理

### v3.9.0 详细更新内容

#### VPS内存优化
- **内存使用率优化** - 从90%降至48.8%，节省约382MB内存
- **缓存配置优化** - 内存缓存大小从1000增加到5000，监控数据TTL从30秒减少到10秒
- **定期清理机制** - 每5分钟清理内存缓存，每30分钟清理Redis缓存
- **数据库历史数据清理** - 清理50,000+条历史记录，保留最近1000条策略分析记录

#### 内存优化脚本
- **自动清理脚本** - 新增scripts/memory-optimization.js，支持自动数据清理和数据库优化
- **数据库压缩** - 自动执行VACUUM和REINDEX操作，优化数据库性能
- **历史数据管理** - 按时间策略清理过期数据，保留关键历史记录

#### 性能监控增强
- **系统性能API** - 新增/api/performance端点，监控CPU、内存、磁盘使用情况
- **缓存统计API** - 新增/api/cache/stats端点，监控缓存命中率和配置
- **数据库统计API** - 新增/api/database/stats端点，监控数据库性能
- **实时监控** - 提供实时性能指标和告警功能

#### 缓存系统优化
- **双重缓存策略** - 内存缓存+Redis缓存双重保障
- **智能TTL配置** - 根据数据类型配置不同的缓存时间
- **缓存预热** - 启动时预热关键数据缓存
- **缓存清理** - 自动清理过期和无效缓存

### v3.10.0 详细更新内容

#### 模拟交易数据一致性修复
- **问题识别** - 发现监控页面显示312/312模拟交易完成率，但数据库simulations表为空的不一致问题
- **根本原因** - recordAnalysisLog方法中错误地基于analysisResult.phases?.simulationTrading的存在来增加simulationCompletions统计
- **修复方案** - 移除recordAnalysisLog中错误的模拟交易统计逻辑，模拟交易统计只通过recordSimulation方法正确记录
- **数据重置** - 调用监控数据重置API，清除错误的统计数据，确保与数据库数据一致

#### 数据验证和监控增强
- **数据验证脚本** - 新增validate-simulation-data.js脚本，支持检查监控数据与数据库数据的一致性
- **单元测试** - 创建simulation-data-consistency.test.js和simulation-data-simple.test.js测试，保障代码健壮性
- **实时监控** - 新增RealTimeDataMonitor类，实现Binance API成功率实时监控
- **API扩展** - 新增/api/realtime-data-stats、/api/monitoring-dashboard/reset等API端点

#### 数据库表结构优化
- **复合索引创建** - 创建(symbol, timestamp, trend4h)等复合索引，提高查询性能
- **冗余索引删除** - 删除单字段索引，减少存储空间和写入性能影响
- **数据类型统一** - 布尔值统一为INTEGER类型，时间戳格式统一
- **枚举值表** - 创建signal_types、market_types、execution_modes枚举值表
- **历史数据清理** - 清理30天前的策略分析数据，优化数据库性能
- **数据库优化** - 执行VACUUM、REINDEX、ANALYZE操作，优化数据库性能

#### 前端规则说明更新
- **V3优化版说明** - 更新1H边界判断、15m入场模式、数据采集率等规则说明
- **数据刷新频率** - 明确各层数据的刷新频率：4H趋势每1小时，1H打分每5分钟，15m入场每2分钟
- **失败分析** - 添加API调用失败原因分析说明
- **实时监控** - 更新数据采集率显示为Binance API实时成功率

### v3.9.0 详细更新内容

#### 数据库优化
- **新增表结构** - 创建data_refresh_status和strategy_v3_analysis表，优化数据存储结构
- **索引优化** - 为常用查询创建复合索引，提高数据库查询性能
- **数据清理策略** - 实现自动数据清理机制，保留最近30天详细数据
- **表结构自动更新** - 服务器启动时自动更新数据库表结构

#### Redis缓存系统
- **Redis集成** - 实现Redis缓存系统，支持内存缓存和Redis缓存双重保障
- **缓存策略** - 为不同数据类型配置不同的TTL，优化缓存命中率
- **缓存管理** - 提供缓存统计、清理、预热等管理功能
- **性能监控** - 实时监控缓存命中率和性能指标

#### 性能监控增强
- **系统监控** - 监控CPU、内存、磁盘等系统资源使用情况
- **应用监控** - 监控请求响应时间、错误率、数据库查询性能
- **告警系统** - 基于阈值自动生成性能告警，支持多级别告警
- **优化建议** - 根据性能指标自动生成优化建议

#### 单元测试完善
- **测试覆盖率** - 新增代码逻辑测试覆盖率达到90%以上
- **测试框架** - 完善Jest测试配置，支持Mock和异步测试
- **测试自动化** - 集成到CI/CD流程，确保代码质量
- **性能测试** - 添加缓存和数据库性能测试

#### API扩展
- **性能监控API** - 新增/api/performance端点获取系统性能指标
- **缓存管理API** - 新增/api/cache/stats和/api/cache/clear端点
- **数据库统计API** - 新增/api/database/stats端点获取数据库性能统计
- **缓存中间件** - 为API请求添加缓存中间件，提高响应速度

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
- 文档更新: 2025-01-13
- 版本: V3.17

---

## v3.17.0 详细更新内容

### 15min信号实时更新问题彻底解决

#### 功能概述
彻底解决15min信号需要清除缓存才能更新的问题，实现数据变化时自动实时显示，无需手动刷新或清除缓存。

#### 问题分析
**根本原因**：前端刷新频率与后端数据更新频率不匹配
- **服务端15min信号更新频率**：每2分钟更新一次（`2 * 60 * 1000`毫秒）
- **前端自动刷新频率**：每5分钟刷新一次（`300000`毫秒）
- **结果**：15min信号更新后需要等待最多3分钟才能显示

#### 技术实现
- **刷新频率优化** - 将前端自动刷新频率从5分钟改为2分钟，匹配服务端更新频率
- **智能变化检测** - 每30秒检查数据变化状态，检测到3分钟内的新15min信号时立即刷新
- **数据变化检测API** - 新增`/api/data-change-status`端点，检查各交易对的15min信号变化状态
- **智能刷新机制** - 主刷新（2分钟）+ 变化检测（30秒）+ 智能刷新（检测到变化时立即刷新）

#### 核心代码实现
```javascript
// 优化后的刷新机制
startMonitoringRefresh() {
  // 主刷新：每2分钟
  this.monitoringInterval = setInterval(async () => {
    // 刷新数据...
  }, 120000); // 2分钟

  // 变化检测：每30秒
  this.signalChangeInterval = setInterval(async () => {
    await this.checkSignalChanges();
  }, 30000); // 30秒
}

// 智能变化检测
async checkSignalChanges() {
  const response = await fetch('/api/data-change-status');
  const result = await response.json();
  
  // 检查3分钟内的新信号
  for (const [symbol, status] of Object.entries(result.data)) {
    if (status.hasExecution && status.timeDiffMinutes <= 3) {
      // 立即刷新数据
      this.refreshData();
    }
  }
}
```

#### 数据变化检测API
```javascript
// 新增API端点
this.app.get('/api/data-change-status', async (req, res) => {
  const changeStatus = {};
  for (const symbol of symbols) {
    const analysis = await this.db.getLatestStrategyAnalysis(symbol);
    if (analysis) {
      const hasExecution = analysis.execution && 
        analysis.execution !== 'null' && 
        analysis.execution.includes('EXECUTE');
      
      changeStatus[symbol] = {
        hasExecution,
        lastUpdate: lastUpdate.toISOString(),
        timeDiffMinutes: Math.round(timeDiff),
        execution: analysis.execution,
        signal: analysis.signal
      };
    }
  }
  res.json({ success: true, data: changeStatus });
});
```

#### 预期效果
- **之前**：15min信号更新后最多需要等待3分钟才能显示
- **现在**：15min信号更新后最多30秒内就能显示
- **用户体验**：无需手动清除缓存或刷新页面
- **系统性能**：保持合理的刷新频率，避免过度频繁的API调用

#### 技术亮点
- **匹配服务端频率** - 前端刷新频率与服务端2分钟更新频率完全匹配
- **智能检测机制** - 基于时间戳检测3分钟内的新信号，避免误触发
- **性能优化** - 避免不必要的频繁刷新，保持系统稳定性
- **错误处理** - 完善的错误处理机制，确保系统稳定运行

#### 部署验证
- ✅ 代码已推送到GitHub
- ✅ VPS已拉取最新代码并重启服务
- ✅ API端点正常工作
- ✅ 前端已加载新版本JavaScript文件
- ✅ 15min信号实时更新功能验证通过

## v3.16.0 详细更新内容

### 15min信号实时更新优化

#### 功能概述
解决15min信号需要清除缓存才能更新的问题，实现数据变化时自动实时显示，无需手动刷新或清除缓存。

#### 问题分析
**根本原因**：前端刷新频率与后端数据更新频率不匹配
- **服务端15min信号更新频率**：每2分钟更新一次
- **前端自动刷新频率**：每5分钟刷新一次
- **结果**：15min信号更新后需要等待最多3分钟才能显示

#### 技术实现
- **刷新频率优化** - 将前端自动刷新频率从5分钟改为2分钟，匹配服务端更新频率
- **智能变化检测** - 每30秒检查数据变化状态，检测到3分钟内的新15min信号时立即刷新
- **数据变化检测API** - 新增`/api/data-change-status`端点，检查各交易对的15min信号变化状态
- **智能刷新机制** - 主刷新（2分钟）+ 变化检测（30秒）+ 智能刷新（检测到变化时立即刷新）

#### 核心代码实现
```javascript
// 优化后的刷新机制
startMonitoringRefresh() {
  // 主刷新：每2分钟
  this.monitoringInterval = setInterval(async () => {
    // 刷新数据...
  }, 120000); // 2分钟

  // 变化检测：每30秒
  this.signalChangeInterval = setInterval(async () => {
    await this.checkSignalChanges();
  }, 30000); // 30秒
}

// 智能变化检测
async checkSignalChanges() {
  const response = await fetch('/api/data-change-status');
  const result = await response.json();
  
  // 检查3分钟内的新信号
  for (const [symbol, status] of Object.entries(result.data)) {
    if (status.hasExecution && status.timeDiffMinutes <= 3) {
      // 立即刷新数据
      this.refreshData();
    }
  }
}
```

#### 数据变化检测API
```javascript
// 新增API端点
this.app.get('/api/data-change-status', async (req, res) => {
  const changeStatus = {};
  for (const symbol of symbols) {
    const analysis = await this.db.getLatestStrategyAnalysis(symbol);
    if (analysis) {
      const hasExecution = analysis.execution && 
        analysis.execution !== 'null' && 
        analysis.execution.includes('EXECUTE');
      
      changeStatus[symbol] = {
        hasExecution,
        lastUpdate: lastUpdate.toISOString(),
        timeDiffMinutes: Math.round(timeDiff),
        execution: analysis.execution,
        signal: analysis.signal
      };
    }
  }
  res.json({ success: true, data: changeStatus });
});
```

#### 预期效果
- **之前**：15min信号更新后最多需要等待3分钟才能显示
- **现在**：15min信号更新后最多30秒内就能显示
- **用户体验**：无需手动清除缓存或刷新页面
- **系统性能**：保持合理的刷新频率，避免过度频繁的API调用

### 价格显示格式优化

#### 功能概述
将所有价格相关字段的显示精度从2位小数提升到4位小数，确保价格信息的精确显示。

#### 技术实现
- **统一价格格式化** - 使用`DataManager.formatPrice()`方法统一处理所有价格显示
- **主页面优化** - 交易信号表格中的当前价格和入场价格使用4位小数显示
- **信号详情优化** - 当前价格、止损价格、止盈价格、最小保证金使用4位小数显示
- **交易历史优化** - 入场价格、止损价格、止盈价格使用4位小数显示
- **滚仓计算器优化** - 添加`formatPrice()`方法支持4位小数价格显示

#### 影响范围
- 主页面交易信号表格
- 信号详情页面
- 交易历史表格
- 滚仓计算器
- 模拟交易数据页面

### 双机器人Telegram通知功能

#### 功能概述
实现15min信号通知和模拟交易通知的分离管理，使用不同的机器人配置。

#### 技术实现
- **双机器人配置** - 支持15min信号机器人和模拟交易机器人的独立配置
- **15min信号通知** - 使用当前机器人配置发送信号检测通知
- **模拟交易通知** - 使用新机器人配置（bot token: 1111111）发送交易执行通知
- **配置管理API** - 新增`/api/telegram-simulation-config`和`/api/telegram-simulation-test`接口
- **状态查询优化** - `getStatus()`方法返回两个机器人的独立配置状态

#### 配置结构
```javascript
{
  signal: {
    enabled: true,
    initialized: true,
    hasBotToken: true,
    hasChatId: true,
    configured: true
  },
  simulation: {
    enabled: true,
    initialized: true,
    hasBotToken: true,
    hasChatId: true,
    configured: true
  }
}
```

#### 错误隔离
- 一个机器人故障不影响另一个机器人的正常使用
- 独立的错误处理机制
- 详细的日志记录

### 测试覆盖完善

#### 测试修复
- **Telegram通知测试** - 修复所有测试以适配双机器人配置
- **价格格式化测试** - 确保所有价格显示测试正确
- **集成测试** - 验证双机器人配置的集成功能

#### 测试结果
- 36个测试用例全部通过
- 覆盖价格格式化、Telegram通知、15min信号显示等功能
- 确保代码质量和功能稳定性

### 用户体验改进

#### 价格精度提升
- 所有价格字段现在精确显示到小数点后4位
- 提供更精确的价格信息用于交易决策
- 避免因精度不足导致的价格信息丢失

#### 通知管理优化
- 15min信号和模拟交易通知使用不同机器人
- 便于独立管理和配置
- 支持不同的通知策略

#### 显示一致性
- 所有价格相关字段使用统一的格式化方法
- 确保整个网站的价格显示格式一致

## v3.13.0 详细更新内容

### 监控页面JavaScript错误修复
- **TypeError修复** - 解决`Cannot read properties of undefined (reading 'rate')`错误
- **前端数据结构适配** - 修复main.js中监控数据嵌套对象访问问题，适配扁平化API响应结构
- **浏览器缓存修复** - 更新monitoring.js缓存版本号，强制浏览器重新加载修复后的JavaScript文件
- **监控API优化** - 修复监控API超时问题，提升响应速度

### 静态方法调用错误修复
- **方法调用修复** - 修复SmartFlowStrategyV3中静态方法调用问题：
  - `calculateLeverageData` - 从实例方法调用改为静态方法调用
  - `formatExecution` - 从实例方法调用改为静态方法调用  
  - `createNoSignalResult` - 从实例方法调用改为静态方法调用
- **代码健壮性** - 确保所有方法调用正确，避免运行时错误

### 服务启动语法错误修复
- **server.js修复** - 移除第784行多余的字符`（只保留最近3天数据）`
- **SyntaxError解决** - 修复服务启动时的语法错误
- **服务稳定性** - 确保服务正常启动和运行

### 单元测试覆盖增强
- **静态方法测试** - 新增`static-methods.test.js`测试文件
- **测试覆盖范围** - 覆盖所有静态方法的调用和返回值验证
- **测试用例** - 包含杠杆计算、执行格式化、无信号结果创建等核心功能测试
- **集成测试** - 验证实例方法调用静态方法的正确性

### 最大损失金额集成修复
- **问题识别** - 发现主页配置的单次交易最大损失在模拟交易中不生效
- **根本原因** - `server.js`中`autoStartSimulation`方法硬编码最大损失金额为100 USDT
- **修复方案** - 修改为从数据库获取用户设置的最大损失金额
- **影响范围** - 确保所有杠杆计算都使用用户设置的最大损失金额：
  - `SmartFlowStrategyV3.calculateLeverageData` - 静态方法
  - `StrategyV3Execution.calculateLeverageData` - 实例方法
  - `server.js autoStartSimulation` - 模拟交易启动逻辑
- **测试验证** - 新增`max-loss-integration.test.js`完整集成测试
- **测试覆盖** - 验证不同最大损失金额下的杠杆计算正确性

### 性能优化
- **监控API性能** - 优化监控数据查询，减少响应时间
- **内存管理** - 继续优化内存使用，确保系统稳定运行
- **错误处理** - 增强错误处理机制，提高系统容错能力

## v3.14.0 详细更新内容

### 模拟交易默认杠杆和保证金问题彻底修复
- **问题根源分析** - 发现API端点`/api/simulation/start`直接使用默认值10和100的问题
- **智能默认值检测** - 实现当检测到默认值(10杠杆,100保证金)时自动重新计算杠杆和保证金
- **API端点修复** - 在`/api/simulation/start`端点中添加智能检测和重新计算逻辑
- **数据一致性保障** - 确保所有代码路径都使用用户设置的最大损失金额

### 技术架构优化
- **智能检测机制** - 检测条件：`!maxLeverage || !minMargin || maxLeverage === 10 || minMargin === 100`
- **自动重新计算** - 当检测到默认值时，使用用户设置的最大损失金额重新计算杠杆和保证金
- **错误处理完善** - 添加详细的日志记录和错误处理机制，提高系统健壮性
- **性能优化** - 智能检测避免不必要的计算，只在需要时重新计算

### 单元测试全面覆盖
- **leverage-default-value-fix.test.js** - 新增14个测试用例覆盖所有逻辑
- **测试内容** - SmartFlowStrategyV3.calculateLeverageData、analyzeTrendMarket、analyzeRangeMarket、SimulationManager.createSimulation、API端点测试、错误处理测试、边界条件测试、数据一致性测试
- **测试结果** - 13个测试通过，1个测试修复，覆盖所有核心功能和边界条件

### 数据变更检测集成
- **DataChangeDetector集成** - 确保数据变化时正确更新缓存
- **缓存同步机制** - 数据变更时自动清除相关缓存，保障数据一致性
- **智能哈希比较** - 使用哈希算法检测数据变化，避免不必要的数据库写入

### 验证结果
- **修复前** - 模拟交易记录使用默认的10倍杠杆和100保证金
- **修复后** - 所有新记录使用正确的杠杆和保证金（如129x杠杆, 144保证金）
- **数据一致性** - 确保所有模拟交易记录都符合用户设置的最大损失金额
- **系统稳定性** - 完善的错误处理确保系统稳定运行

### 业务价值
- **用户体验提升** - 模拟交易使用正确的杠杆和保证金，符合用户预期
- **数据准确性** - 确保所有记录都符合用户设置，避免数据不一致
- **系统可靠性** - 智能检测和错误处理机制提高系统可靠性

## v3.15.0 详细更新内容

### Telegram通知功能完整实现
- **通知模块创建** - 创建TelegramNotifier类，支持HTML格式的消息发送
- **开启通知实现** - 模拟交易开启时发送详细交易信息通知
- **结束通知实现** - 模拟交易结束时发送完整结果信息通知
- **配置管理** - 支持Bot Token和Chat ID的动态配置和持久化存储

### 通知内容详细设计
- **开启通知内容** - 交易对、方向、入场价格、止损价格、止盈价格、杠杆倍数、最小保证金、触发原因、执行模式、市场类型、开启时间
- **结束通知内容** - 交易对、方向、出场价格、出场原因、盈亏金额、收益率、结果、交易详情、持仓时间、结束时间
- **消息格式** - 使用HTML格式，包含emoji图标，信息层次清晰，易于阅读

### 技术架构优化
- **模块化设计** - TelegramNotifier独立模块，便于维护和扩展
- **集成方式** - 在server.js和SimulationManager中无缝集成通知功能
- **错误处理** - 通知发送失败不影响模拟交易正常执行
- **配置持久化** - 配置保存到数据库，服务重启后自动加载

### API接口扩展
- **GET /api/telegram-config** - 获取Telegram配置状态
- **POST /api/telegram-config** - 设置Telegram配置（Bot Token和Chat ID）
- **POST /api/telegram-test** - 测试Telegram通知功能
- **前端API支持** - 在APIClient中添加Telegram配置管理方法

### 单元测试覆盖
- **telegram-notification.test.js** - TelegramNotifier核心功能测试
- **telegram-integration.test.js** - 模拟交易集成测试
- **测试内容** - 初始化、消息发送、配置管理、错误处理、消息格式验证
- **测试覆盖** - 14个测试用例，覆盖所有核心功能和边界条件

### 用户体验提升
- **实时通知** - 模拟交易开启和结束立即收到通知
- **信息完整** - 通知包含所有关键交易信息
- **格式美观** - HTML格式，emoji图标，信息层次清晰
- **配置简单** - 通过API轻松配置Bot Token和Chat ID

### 系统稳定性保障
- **非阻塞设计** - 通知发送失败不影响交易执行
- **错误处理** - 完善的错误处理和日志记录
- **配置验证** - 配置参数验证，确保通知功能正常
- **性能优化** - 异步发送通知，不影响系统性能
