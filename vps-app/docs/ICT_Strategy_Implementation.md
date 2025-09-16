# ICT策略实现逻辑文档

## 概述

ICT策略是基于多时间框架分析的加密货币交易策略，采用三层时间框架分析方法：
- **高时间框架(HTF)**: 1D 判断市场整体趋势
- **中时间框架(MTF)**: 4H 识别订单块(OB)和失衡区(FVG)
- **低时间框架(LTF)**: 15m 找精确入场点

## 核心架构

### 1. 主要模块

```
ICTStrategy (主入口)
├── ICTCore (核心分析逻辑)
│   ├── analyzeDailyTrend() - 1D趋势分析
│   ├── analyzeMTF() - 4H OB/FVG分析
│   └── analyzeLTF() - 15m入场确认
├── ICTExecution (执行逻辑)
│   ├── calculateRiskManagement() - 风险管理
│   ├── calculateStopLoss() - 止损计算
│   └── calculateTakeProfit() - 止盈计算
└── ICTDatabaseManager (数据管理)
    ├── recordICTAnalysis() - 记录分析结果
    └── getICTAnalysis() - 获取历史数据
```

### 2. 数据流

```
BinanceAPI → ICTCore → ICTExecution → ICTDatabaseManager
     ↓           ↓           ↓              ↓
   K线数据 → 技术分析 → 风险管理 → 数据存储
```

## 详细实现逻辑

### 1. 高时间框架分析 (1D)

**目标**: 确定市场主要趋势方向

**实现方法**:
```javascript
async analyzeDailyTrend(symbol) {
  // 获取1D K线数据
  const data1D = await BinanceAPI.getKlines(symbol, '1d', 20);
  
  // 趋势检测逻辑
  const trend = this.detectTrend(data1D, 20);
  
  // 趋势强度评分
  const score = this.calculateTrendScore(data1D, trend);
  
  return {
    trend: trend,        // 'up'/'down'/'sideways'
    score: score,        // 0-3分
    confidence: confidence
  };
}
```

**趋势判断条件**:
- 比较最近20根日线收盘价
- 末值 > 首值 → 上升趋势
- 末值 < 首值 → 下降趋势
- 否则 → 震荡（忽略信号）

### 2. 中时间框架分析 (4H)

**目标**: 找到潜在订单块(OB)和失衡区(FVG)

**实现方法**:
```javascript
async analyzeMTF(symbol, dailyTrend) {
  // 获取4H K线数据
  const data4H = await BinanceAPI.getKlines(symbol, '4h', 50);
  const atr4h = this.calculateATR(data4H, 14);
  
  // OB检测
  const obResult = this.detectOB(data4H, atr4h);
  
  // FVG检测
  const fvgResult = this.detectFVG(data4H, atr4h);
  
  // Sweep宏观速率确认
  const sweepHTF = this.detectSweepHTF(data4H, atr4h);
  
  return {
    obDetected: obResult.detected,
    ob: obResult.ob,
    fvgDetected: fvgResult.detected,
    fvg: fvgResult.fvg,
    sweepHTF: sweepHTF.detected,
    atr4h: atr4h
  };
}
```

**过滤条件**:
- OB高度 ≥ 0.25 × ATR(4H)
- OB年龄 ≤ 30天
- FVG高度 ≥ 0.15 × ATR(4H)
- FVG年龄 ≤ 7天

**Sweep确认**:
- 检测关键swing高/低是否在≤2根4H内被刺破并收回
- 刺破幅度 ÷ bar数 ≥ 0.4 × ATR(4H) → 有效sweep

### 3. 低时间框架分析 (15m)

**目标**: 在OB/FVG内找到精确入场点

**实现方法**:
```javascript
async analyzeLTF(symbol, mtfResult) {
  // 获取15m K线数据
  const data15M = await BinanceAPI.getKlines(symbol, '15m', 50);
  const atr15 = this.calculateATR(data15M, 14);
  
  // OB/FVG年龄检查 (≤2天)
  const ageCheck = this.checkOBAge(mtfResult.ob, mtfResult.fvg);
  
  // 吞没形态检测
  const engulfing = this.detectEngulfing(data15M, atr15);
  
  // Sweep微观速率确认
  const sweepLTF = this.detectSweepLTF(data15M, atr15);
  
  // 成交量确认
  const volumeConfirm = this.checkVolumeConfirmation(data15M);
  
  // 综合判断
  if (engulfing.detected && sweepLTF.detected && volumeConfirm) {
    return {
      entrySignal: true,
      entryPrice: data15M[data15M.length - 1].close,
      // ... 其他字段
    };
  }
  
  return { entrySignal: false, reason: '15m入场条件不满足' };
}
```

**入场确认条件**:
1. **吞没形态**: 后一根15m K线实体 ≥ 前一根1.5倍，且方向与趋势一致
2. **Sweep微观速率**: sweep发生在≤3根15m内收回，sweep幅度÷bar数 ≥ 0.2×ATR(15m)
3. **成交量放大**: 当前成交量 ≥ 平均成交量的1.2倍

### 4. 风险管理

**止损计算**:
```javascript
calculateStopLoss(ltfResult) {
  const { ob, fvg, trend } = ltfResult;
  
  if (trend === 'up') {
    // 上升趋势：OB下沿 - 1.5×ATR(4H)，或最近3根4H的最低点
    return Math.min(ob.low - 1.5 * atr4h, recentLows.min());
  } else {
    // 下降趋势：OB上沿 + 1.5×ATR(4H)，或最近3根4H的最高点
    return Math.max(ob.high + 1.5 * atr4h, recentHighs.max());
  }
}
```

**止盈计算**:
```javascript
calculateTakeProfit(entry, stopLoss, RR = 3) {
  const stopDistance = Math.abs(entry - stopLoss);
  return trend === 'up' 
    ? entry + RR * stopDistance 
    : entry - RR * stopDistance;
}
```

**仓位计算**:
```javascript
calculatePositionSize(entry, stopLoss, equity, riskPct, maxLossAmount) {
  const stopDistance = Math.abs(entry - stopLoss);
  const riskAmount = Math.min(equity * riskPct, maxLossAmount);
  const units = riskAmount / stopDistance;
  const notional = entry * units;
  const leverage = 5; // 默认杠杆
  const margin = notional / leverage;
  
  return { units, notional, margin, leverage, riskAmount };
}
```

## 技术指标实现

### 1. ATR (Average True Range)

```javascript
calculateATR(data, period = 14) {
  let trs = [];
  for (let i = 1; i < data.length; i++) {
    const h = data[i].high;
    const l = data[i].low;
    const cPrev = data[i - 1].close;
    const tr = Math.max(h - l, Math.abs(h - cPrev), Math.abs(l - cPrev));
    trs.push(tr);
  }
  
  // 计算ATR
  let atrs = [];
  for (let i = 0; i < trs.length; i++) {
    if (i < period) {
      atrs.push(null);
    } else {
      const slice = trs.slice(i - period, i);
      atrs.push(slice.reduce((a, b) => a + b, 0) / period);
    }
  }
  
  return atrs[atrs.length - 1];
}
```

### 2. 吞没形态检测

```javascript
detectEngulfing(data, atr, trend) {
  if (data.length < 2) return { detected: false };
  
  const prev = data[data.length - 2];
  const curr = data[data.length - 1];
  
  const prevBody = Math.abs(prev.close - prev.open);
  const currBody = Math.abs(curr.close - curr.open);
  
  // 实体大小检查
  if (currBody < 0.6 * atr) return { detected: false };
  if (currBody < 1.5 * prevBody) return { detected: false };
  
  // 方向检查
  if (trend === 'up') {
    return {
      detected: curr.close > prev.open && curr.open < prev.close,
      type: 'bullish'
    };
  } else {
    return {
      detected: curr.close < prev.open && curr.open > prev.close,
      type: 'bearish'
    };
  }
}
```

### 3. Sweep检测

```javascript
detectSweepHTF(extreme, bars, atr4h) {
  const exceed = bars[0].high - extreme;
  let barsToReturn = 0;
  
  for (let i = 1; i < bars.length; i++) {
    barsToReturn++;
    if (bars[i].close < extreme) break;
  }
  
  const sweepSpeed = exceed / barsToReturn;
  return {
    detected: sweepSpeed >= 0.4 * atr4h && barsToReturn <= 2,
    speed: sweepSpeed
  };
}
```

## 数据存储结构

### ICT策略分析表

```sql
CREATE TABLE ict_strategy_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- 高时间框架 (1D)
  daily_trend TEXT,                    -- 上升/下降/震荡
  daily_trend_score INTEGER,           -- 1D趋势得分 (0-3)
  
  -- 中时间框架 (4H)
  mtf_ob_detected BOOLEAN DEFAULT FALSE, -- 4H OB检测
  mtf_fvg_detected BOOLEAN DEFAULT FALSE, -- 4H FVG检测
  ob_height REAL,                      -- OB高度
  ob_age_days REAL,                    -- OB年龄(天)
  sweep_htf_detected BOOLEAN DEFAULT FALSE, -- 4H Sweep检测
  
  -- 低时间框架 (15m)
  engulfing_detected BOOLEAN DEFAULT FALSE, -- 吞没形态
  sweep_ltf_detected BOOLEAN DEFAULT FALSE, -- 15m Sweep检测
  volume_confirmation BOOLEAN DEFAULT FALSE, -- 成交量确认
  
  -- 风险管理
  entry_price REAL,                    -- 入场价格
  stop_loss REAL,                      -- 止损价格
  take_profit REAL,                    -- 止盈价格
  risk_reward_ratio REAL,              -- 风险回报比
  
  -- 信号状态
  signal_type TEXT,                    -- 信号类型 (LONG/SHORT/NONE)
  signal_strength TEXT,                -- 信号强度
  execution_mode TEXT,                 -- 执行模式
  
  -- 数据质量
  data_collection_rate REAL,           -- 数据采集率
  data_valid BOOLEAN DEFAULT TRUE,     -- 数据有效性
  error_message TEXT,                  -- 错误信息
  
  UNIQUE(symbol, timestamp)
);
```

## 错误处理

### 1. 数据获取错误
```javascript
try {
  const data = await BinanceAPI.getKlines(symbol, timeframe, limit);
} catch (error) {
  console.error(`数据获取失败 [${symbol}]:`, error);
  return { error: error.message, data: null };
}
```

### 2. 分析过程错误
```javascript
try {
  const result = await this.analyzeSymbol(symbol, options);
} catch (error) {
  console.error(`ICT分析失败 [${symbol}]:`, error);
  return ICTStrategy.createNoSignalResult(symbol, error.message);
}
```

### 3. 数据库操作错误
```javascript
try {
  await this.ictDatabaseManager.recordICTAnalysis(analysis);
} catch (error) {
  console.error(`数据存储失败 [${symbol}]:`, error);
  // 继续执行，不中断流程
}
```

## 性能优化

### 1. 数据缓存
- 使用Redis缓存K线数据
- 缓存计算结果避免重复计算
- 设置合理的缓存过期时间

### 2. 并发控制
- 限制同时分析的交易对数量
- 使用队列管理分析任务
- 避免API请求过于频繁

### 3. 内存管理
- 及时释放不需要的数据
- 使用流式处理大数据集
- 监控内存使用情况

## 监控和日志

### 1. 性能监控
```javascript
const startTime = Date.now();
const result = await this.analyzeSymbol(symbol, options);
const duration = Date.now() - startTime;

console.log(`ICT分析完成 [${symbol}]: ${duration}ms`);
```

### 2. 数据质量监控
```javascript
const dataQuality = {
  symbol,
  dataCollectionRate: (validDataCount / totalDataCount) * 100,
  lastUpdate: new Date(),
  errors: errorCount
};
```

### 3. 信号统计
```javascript
const signalStats = {
  totalSignals: totalCount,
  longSignals: longCount,
  shortSignals: shortCount,
  successRate: successCount / totalCount
};
```

## 配置参数

### 1. 时间框架参数
```javascript
const TIMEFRAME_CONFIG = {
  DAILY: { period: 20, lookback: 20 },
  FOUR_HOUR: { period: 50, lookback: 30 },
  FIFTEEN_MIN: { period: 50, lookback: 2 }
};
```

### 2. 技术指标参数
```javascript
const INDICATOR_CONFIG = {
  ATR_PERIOD: 14,
  OB_MIN_HEIGHT_RATIO: 0.25,
  FVG_MIN_HEIGHT_RATIO: 0.15,
  SWEEP_HTF_RATIO: 0.4,
  SWEEP_LTF_RATIO: 0.2
};
```

### 3. 风险管理参数
```javascript
const RISK_CONFIG = {
  DEFAULT_RR: 3,
  DEFAULT_LEVERAGE: 5,
  MAX_RISK_PCT: 0.01,
  MAX_LOSS_AMOUNT: 100
};
```

## 测试策略

### 1. 单元测试
- 测试每个分析模块的独立功能
- 验证技术指标计算的准确性
- 测试边界条件和异常情况

### 2. 集成测试
- 测试完整的数据流
- 验证API接口的正确性
- 测试数据库操作的完整性

### 3. 回测验证
- 使用历史数据验证策略效果
- 计算胜率、盈亏比等关键指标
- 优化参数设置

## 部署和维护

### 1. 环境要求
- Node.js 16+
- SQLite3 数据库
- Redis (可选，用于缓存)
- 稳定的网络连接

### 2. 部署步骤
1. 安装依赖包
2. 初始化数据库表
3. 配置API密钥
4. 启动服务
5. 验证功能正常

### 3. 监控指标
- 服务运行状态
- 数据采集率
- 分析成功率
- 系统资源使用

### 4. 维护任务
- 定期清理历史数据
- 监控API使用量
- 更新技术指标参数
- 优化性能瓶颈

---

*本文档基于ICT策略v1.0实现，最后更新：2025-01-15*
