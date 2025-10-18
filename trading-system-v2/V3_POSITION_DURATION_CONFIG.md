# V3 策略持仓上限配置说明

## 📋 配置概述

V3 策略使用 `PositionDurationManager`（持仓时长管理器）来动态设置持仓上限，根据交易对类别和市场类型自动调整。

## 🔍 配置详情

### 持仓时长配置表

| 交易对类别 | 市场类型 | 最大持仓时长 | 最小持仓时长 | 时间止损 | 止盈目标 | 止损倍数 |
|-----------|---------|------------|------------|---------|---------|---------|
| **主流币** | 趋势市 | **168小时（7天）** | 24小时（1天） | 60分钟 | 4.5×ATR | 1.5×ATR |
| 主流币 | 震荡市 | **12小时** | 1小时 | 30分钟 | 4.5×ATR | 1.5×ATR |
| **高市值强趋势币** | 趋势市 | **72小时（3天）** | 12小时（0.5天） | 120分钟（2小时） | 6.0×ATR | 2.0×ATR |
| 高市值强趋势币 | 震荡市 | **6小时** | 1小时 | 45分钟 | 6.0×ATR | 2.0×ATR |
| **热点币** | 趋势市 | **24小时** | 6小时 | 180分钟（3小时） | 7.5×ATR | 2.5×ATR |
| 热点币 | 震荡市 | **3小时** | 1小时 | 60分钟（1小时） | 7.5×ATR | 2.5×ATR |
| **小币** | 趋势市 | **12小时** | 0.5小时 | 30分钟 | 4.5×ATR | 1.5×ATR |
| 小币 | 震荡市 | **2小时** | 0.5小时 | 30分钟 | 4.5×ATR | 1.5×ATR |

### 典型交易对分类

| 交易对类别 | 典型代币 | 说明 |
|-----------|---------|------|
| **主流币（MAINSTREAM）** | BTC, ETH | 高流动性，市值 > $50B |
| **高市值强趋势币（HIGH_CAP_TREND）** | BNB, SOL, XRP, ADA | 市值 $10B - $50B |
| **热点币（HOT）** | 实时变化 | 当前热门交易对 |
| **小币（SMALL_CAP）** | 市值 < $50M | 低流动性，风险较高 |

## 💻 代码实现

### 配置定义

**文件**：`src/utils/position-duration-manager.js`

```javascript
const POSITION_DURATION_CONFIG = {
  // 主流币（高流动性）
  MAINSTREAM: {
    name: '主流币',
    trendMarket: {
      maxDurationHours: 168, // 7天
      minDurationHours: 24,  // 1天
      timeStopMinutes: 60,   // 1小时时间止损
      profitTarget: 4.5,     // 4.5倍ATR止盈（3:1盈亏比）
      stopLoss: 1.5          // 1.5倍ATR止损
    },
    rangeMarket: {
      maxDurationHours: 12,  // 12小时
      minDurationHours: 1,   // 1小时
      timeStopMinutes: 30,   // 30分钟时间止损
      profitTarget: 4.5,     // 4.5倍ATR止盈（3:1盈亏比）
      stopLoss: 1.5          // 1.5倍ATR止损
    }
  },

  // 高市值强趋势币
  HIGH_CAP_TREND: {
    name: '高市值强趋势币',
    trendMarket: {
      maxDurationHours: 72,  // 3天
      minDurationHours: 12,  // 0.5天
      timeStopMinutes: 120,  // 2小时时间止损
      profitTarget: 6.0,     // 6倍ATR止盈（3:1盈亏比）
      stopLoss: 2.0          // 2倍ATR止损
    },
    rangeMarket: {
      maxDurationHours: 6,   // 6小时
      minDurationHours: 1,   // 1小时
      timeStopMinutes: 45,   // 45分钟时间止损
      profitTarget: 6.0,     // 6倍ATR止盈（3:1盈亏比）
      stopLoss: 2.0          // 2倍ATR止损
    }
  },

  // 热点币（Trending）
  HOT: {
    name: '热点币',
    trendMarket: {
      maxDurationHours: 24,  // 24小时
      minDurationHours: 6,   // 6小时
      timeStopMinutes: 180,  // 3小时时间止损
      profitTarget: 7.5,     // 7.5倍ATR止盈（3:1盈亏比）
      stopLoss: 2.5          // 2.5倍ATR止损
    },
    rangeMarket: {
      maxDurationHours: 3,   // 3小时
      minDurationHours: 1,   // 1小时
      timeStopMinutes: 60,   // 1小时时间止损
      profitTarget: 7.5,     // 7.5倍ATR止盈（3:1盈亏比）
      stopLoss: 2.5          // 2.5倍ATR止损
    }
  },

  // 小币（低流动性）
  SMALL_CAP: {
    name: '小币',
    trendMarket: {
      maxDurationHours: 12,  // 12小时（仅震荡市，不做趋势）
      minDurationHours: 0.5, // 0.5小时
      timeStopMinutes: 30,   // 30分钟时间止损
      profitTarget: 4.5,     // 4.5倍ATR止盈（3:1盈亏比）
      stopLoss: 1.5          // 1.5倍ATR止损
    },
    rangeMarket: {
      maxDurationHours: 2,   // 2小时
      minDurationHours: 0.5, // 0.5小时
      timeStopMinutes: 30,   // 30分钟时间止损
      profitTarget: 4.5,     // 4.5倍ATR止盈（3:1盈亏比）
      stopLoss: 1.5          // 1.5倍ATR止损
    }
  }
};
```

### V3 策略使用

**文件**：`src/strategies/v3-strategy.js`

```javascript
async calculateTradeParameters(symbol, signal, currentPrice, atr, marketType = 'RANGE', confidence = 'med') {
  // 使用持仓时长管理器计算止损止盈
  const PositionDurationManager = require('../utils/position-duration-manager');
  const stopLossConfig = PositionDurationManager.calculateDurationBasedStopLoss(
    symbol, signal, entryPrice, atr, marketType, confidence
  );

  const stopLoss = stopLossConfig.stopLoss;
  const takeProfit = stopLossConfig.takeProfit;

  logger.info(`${symbol} 交易参数计算: 市场类型=${marketType}, 置信度=${confidence}, 最大持仓=${stopLossConfig.maxDurationHours}小时, 时间止损=${stopLossConfig.timeStopMinutes}分钟`);

  return {
    entryPrice: parseFloat(entryPrice.toFixed(4)),
    stopLoss: parseFloat(stopLoss.toFixed(4)),
    takeProfit: parseFloat(takeProfit.toFixed(4)),
    leverage: leverage,
    margin: margin,
    timeStopMinutes: stopLossConfig.timeStopMinutes,      // 时间止损（分钟）
    maxDurationHours: stopLossConfig.maxDurationHours,    // 最大持仓时长（小时）
    marketType: marketType,
    confidence: confidence
  };
}
```

## 📊 配置说明

### 1. 最大持仓时长（maxDurationHours）

**含义**：交易对的最大持仓时长限制

**作用**：
- 超过最大持仓时长会强制平仓
- 避免极端长期持仓
- 提高资金周转率

**示例**：
- BTCUSDT（主流币，趋势市）：168 小时（7天）
- SOLUSDT（高市值强趋势币，趋势市）：72 小时（3天）
- 热点币（趋势市）：24 小时

### 2. 最小持仓时长（minDurationHours）

**含义**：交易对的最小持仓时长建议

**作用**：
- 避免过早平仓
- 给交易足够的时间发展
- 减少频繁交易

**示例**：
- BTCUSDT（主流币，趋势市）：24 小时（1天）
- SOLUSDT（高市值强趋势币，趋势市）：12 小时（0.5天）

### 3. 时间止损（timeStopMinutes）

**含义**：持仓超过指定时间未盈利时触发

**作用**：
- 持仓时间 ≥ timeStopMinutes AND 未盈利 → 触发时间止损
- 避免长时间占用资金
- 释放资金用于其他交易机会

**示例**：
- BTCUSDT（主流币，趋势市）：60 分钟
- SOLUSDT（高市值强趋势币，趋势市）：120 分钟（2小时）

### 4. 止盈目标（profitTarget）

**含义**：止盈价格 = 入场价格 + profitTarget × ATR

**作用**：
- 设置合理的止盈目标
- 目标风险回报比 3:1

**示例**：
- 主流币：4.5×ATR
- 高市值强趋势币：6.0×ATR
- 热点币：7.5×ATR

### 5. 止损倍数（stopLoss）

**含义**：止损价格 = 入场价格 - stopLoss × ATR

**作用**：
- 设置合理的止损距离
- 根据市场波动率动态调整

**示例**：
- 主流币：1.5×ATR
- 高市值强趋势币：2.0×ATR
- 热点币：2.5×ATR

## 🔧 置信度调整

根据入场信号的置信度，动态调整止损止盈倍数：

| 置信度 | 调整倍数 | 说明 |
|--------|---------|------|
| **高（high）** | 1.0× | 置信度 ≥ 60 分 |
| **中（med）** | 1.2× | 置信度 40-60 分 |
| **低（low）** | 1.5× | 置信度 < 40 分 |

**调整逻辑**：
```javascript
const confidence = signals.score >= 60 ? 'high' : signals.score >= 40 ? 'med' : 'low';

// 止损止盈倍数根据置信度调整
const stopLossMultiplier = config.stopLoss * (confidence === 'high' ? 1.0 : confidence === 'med' ? 1.2 : 1.5);
const takeProfitMultiplier = config.profitTarget * (confidence === 'high' ? 1.0 : confidence === 'med' ? 1.2 : 1.5);
```

## 📈 实际案例

### 案例1：BTCUSDT（主流币，趋势市）

**配置**：
- 最大持仓时长：168 小时（7天）
- 最小持仓时长：24 小时（1天）
- 时间止损：60 分钟
- 止盈目标：4.5×ATR
- 止损倍数：1.5×ATR

**场景**：
- 入场后 30 分钟达到止盈 → ✅ 正常平仓
- 入场后 60 分钟未盈利 → ⚠️ 触发时间止损
- 入场后 168 小时仍未平仓 → ❌ 强制平仓

### 案例2：SOLUSDT（高市值强趋势币，趋势市）

**配置**：
- 最大持仓时长：72 小时（3天）
- 最小持仓时长：12 小时（0.5天）
- 时间止损：120 分钟（2小时）
- 止盈目标：6.0×ATR
- 止损倍数：2.0×ATR

**场景**：
- 入场后 1 小时达到止盈 → ✅ 正常平仓
- 入场后 2 小时未盈利 → ⚠️ 触发时间止损
- 入场后 72 小时仍未平仓 → ❌ 强制平仓

### 案例3：热点币（趋势市）

**配置**：
- 最大持仓时长：24 小时
- 最小持仓时长：6 小时
- 时间止损：180 分钟（3小时）
- 止盈目标：7.5×ATR
- 止损倍数：2.5×ATR

**场景**：
- 入场后 2 小时达到止盈 → ✅ 正常平仓
- 入场后 3 小时未盈利 → ⚠️ 触发时间止损
- 入场后 24 小时仍未平仓 → ❌ 强制平仓

## 🔄 自动监控

### PositionMonitor 服务

**文件**：`src/services/position-monitor.js`

**功能**：
- 每 5 分钟自动检查所有 OPEN 状态的交易
- 检查持仓时长是否超过限制
- 检查时间止损是否触发
- 自动执行平仓操作

**检查逻辑**：
```javascript
async checkSinglePosition(trade) {
  // 1. 检查最大持仓时长
  const durationCheck = PositionDurationManager.checkMaxDurationExceeded(trade);
  if (durationCheck.exceeded) {
    // 强制平仓
    await this.closePosition(trade.id, '持仓时长超过限制');
  }

  // 2. 检查时间止损
  const timeStopCheck = PositionDurationManager.checkTimeStopLoss(trade, currentPrice);
  if (timeStopCheck.shouldExit) {
    // 触发时间止损
    await this.closePosition(trade.id, '时间止损');
  }
}
```

## 📚 与 ICT 策略的对比

### V3 策略

| 配置项 | 值 | 来源 |
|--------|---|------|
| 最大持仓时长 | 根据交易对类别动态设置 | PositionDurationManager |
| 时间止损 | 根据交易对类别动态设置 | PositionDurationManager |
| 配置方式 | 使用持仓时长管理器 | 统一配置 |

**典型配置**：
- BTCUSDT（主流币，趋势市）：最大持仓 168 小时，时间止损 60 分钟
- SOLUSDT（高市值强趋势币，趋势市）：最大持仓 72 小时，时间止损 120 分钟

### ICT 策略

| 配置项 | 值 | 来源 |
|--------|---|------|
| 最大持仓时长 | 48 小时 | ICT优化V2.0 独立配置 |
| 时间止损 | 60 分钟 | ICT优化V2.0 独立配置 |
| 配置方式 | 独立配置 | 不依赖持仓时长管理器 |

**配置**：
```javascript
const ictConfig = {
  maxHoldingHours: 48,        // 最大持仓48小时
  timeStopMinutes: 60,        // 时间止损60分钟
  timeExitPct: 0.5,           // 时间止损平仓50%
  riskPercent: 0.01           // 1%风险
};
```

## ✅ 总结

### V3 策略持仓上限

1. **动态配置**：根据交易对类别和市场类型自动调整
2. **分层管理**：主流币、高市值强趋势币、热点币、小币
3. **市场类型**：趋势市和震荡市有不同的配置
4. **置信度调整**：根据入场信号置信度动态调整止损止盈倍数

### 典型配置

| 交易对 | 类别 | 市场类型 | 最大持仓时长 | 时间止损 |
|--------|------|---------|------------|---------|
| BTCUSDT | 主流币 | 趋势市 | 168 小时（7天） | 60 分钟 |
| ETHUSDT | 主流币 | 趋势市 | 168 小时（7天） | 60 分钟 |
| SOLUSDT | 高市值强趋势币 | 趋势市 | 72 小时（3天） | 120 分钟 |
| BNBUSDT | 高市值强趋势币 | 趋势市 | 72 小时（3天） | 120 分钟 |
| 热点币 | 热点币 | 趋势市 | 24 小时 | 180 分钟 |

### 监控机制

- ✅ 每 5 分钟自动检查所有 OPEN 状态的交易
- ✅ 检查持仓时长是否超过限制
- ✅ 检查时间止损是否触发
- ✅ 自动执行平仓操作

---

**更新时间**：2025-10-18  
**配置版本**：position-duration-manager v1.0  
**策略版本**：V3 Strategy v3.1

