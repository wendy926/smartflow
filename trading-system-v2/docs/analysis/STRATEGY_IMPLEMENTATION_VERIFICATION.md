# 策略实现与文档一致性验证报告

**日期：** 2025-10-08  
**目的：** 验证V3策略和ICT策略的代码实现是否严格按照在线文档描述实现

---

## 📊 V3策略实现验证

### 1. combineSignals 权重分配

#### 文档描述（https://smart.aimaventop.com/docs）
```
权重分配：4H趋势(50%) + 1H因子(35%) + 15M入场(15%)
总分计算：加权总分 = (趋势分/10×0.5) + (因子分/6×0.35) + (入场分/5×0.15)
```

#### 实际代码实现（v3-strategy.js 第1023-1050行）
```javascript
calculateDynamicWeights(trendScore, factorScore, entryScore) {
  const baseWeights = { trend: 0.5, factor: 0.35, entry: 0.15 };  // 基础权重

  // 动态调整权重
  if (trendScore >= 8) {
    baseWeights.trend = 0.6;
    baseWeights.factor = 0.3;
    baseWeights.entry = 0.1;
  }
  // ... 其他动态调整逻辑
}

// 计算总分（使用动态权重）
const totalScore = (
  (trendScore / 10) * weights.trend +      // 4H: 0-10分
  (factorScore / 6) * weights.factor +     // 1H: 0-6分
  (entryScore / 5) * weights.entry         // 15M: 0-5分
);
```

#### ⚠️ 不一致问题1：动态权重调整

**文档说明：** 固定权重 50%、35%、15%

**实际实现：** 使用动态权重调整
- 趋势很强(≥8分)时：60%、30%、10%
- 因子很强(≥5分)时：45%、40%、15%
- 入场很强(≥4分)时：50%、30%、20%

**问题严重程度：** 🟡 中等
**影响：** 实际策略比文档描述更复杂，但这是优化而非错误
**建议：** 更新文档说明动态权重调整逻辑

---

### 2. 信号触发条件

#### 文档描述
```
强信号(BUY/SELL)：总分≥70% 且 趋势分≥6 且 因子分≥5 且 入场分≥1 且 结构分≥1
中等信号(BUY/SELL)：总分45-69% 且 趋势分≥5 且 因子分≥4 且 入场分≥1
```

#### 实际代码实现（v3-strategy.js 第1192-1209行）
```javascript
// 强信号
if (normalizedScore >= 70 &&
  trendScore >= 6 &&
  factorScore >= adjustedThreshold.strong &&  // 使用调整后门槛
  entryScore >= 1) {
  return trendDirection === 'UP' ? 'BUY' : 'SELL';
}

// 中等信号
if (normalizedScore >= 45 &&
  normalizedScore < 70 &&
  trendScore >= 5 &&
  factorScore >= adjustedThreshold.moderate &&  // 使用调整后门槛
  entryScore >= 1) {
  return trendDirection === 'UP' ? 'BUY' : 'SELL';
}
```

#### ⚠️ 不一致问题2：因子门槛使用调整后的值

**文档说明：** 固定门槛（强信号因子≥5，中等信号因子≥4）

**实际实现：** 使用补偿机制动态调整门槛
- `adjustedThreshold.strong` 可能 < 5
- `adjustedThreshold.moderate` 可能 < 4

**问题严重程度：** 🟡 中等
**影响：** 实际实现更灵活，避免信号死区
**建议：** 文档补充说明补偿机制和动态门槛调整

---

### 3. 震荡市交易逻辑

#### 文档描述
```
（文档中未明确说明震荡市如何处理）
```

#### 实际代码实现（v3-strategy.js 第1177-1189行）
```javascript
if (trendDirection === 'RANGE') {
  logger.info(`震荡市模式: 检查15M假突破信号`);
  if (execution15M.signal && (execution15M.signal === 'BUY' || execution15M.signal === 'SELL')) {
    const reason = execution15M.reason || '';
    if (reason.includes('Range fake breakout') || reason.includes('震荡市')) {
      logger.info(`✅ 震荡市假突破信号: ${execution15M.signal}, 理由: ${reason}`);
      return execution15M.signal;
    }
  }
  logger.info(`震荡市无有效假突破信号，HOLD`);
  return 'HOLD';
}
```

#### ⚠️ 不一致问题3：震荡市逻辑缺失

**文档说明：** 文档中没有描述震荡市的处理逻辑

**实际实现：** 已实现震荡市假突破交易逻辑

**问题严重程度：** 🟢 低
**影响：** 代码比文档更完善
**建议：** 文档补充震荡市交易逻辑说明

---

### 4. 杠杆限制

#### 文档描述
```
杠杆限制：最大20倍，最小1倍
```

#### 实际代码实现（v3-strategy.js calculateTradeParameters）
```javascript
// 需要检查实际代码
```

让我检查这部分代码：

<function_calls>
<invoke name="grep">
<parameter name="pattern">leverage.*=.*min.*24|maxLeverage.*24
