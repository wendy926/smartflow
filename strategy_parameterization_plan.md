# ICT 策略和 V3 策略参数化调优方案

## 📋 方案概述

本方案旨在提取 ICT 策略和 V3 策略的关键参数，并支持通过前端页面进行参数化调整，以便通过参数调优 + 每周技术面/消息面复盘交易结果的方式来优化策略胜率。

---

## 🎯 ICT 策略可调优参数

### 1. 趋势判断参数

| 参数名称 | 当前值 | 调优范围 | 说明 | 预期影响 |
|---------|--------|---------|------|---------|
| `dailyTrendThreshold` | ±2% | ±1% ~ ±3% | 日线趋势判断阈值 | 调整趋势敏感度 |
| `dailyTrendLookback` | 20天 | 10天 ~ 30天 | 日线趋势回看期 | 调整趋势稳定性 |

**调优建议**：
- **激进**：±1.5%, 15天（更敏感，更多交易机会）
- **保守**：±2.5%, 25天（更稳定，减少假信号）
- **平衡**：±2%, 20天（当前配置）

---

### 2. 订单块检测参数

| 参数名称 | 当前值 | 调优范围 | 说明 | 预期影响 |
|---------|--------|---------|------|---------|
| `orderBlockWindowSize` | 5根K线 | 3根 ~ 7根 | 订单块检测窗口 | 调整订单块精度 |
| `orderBlockMaxAge` | 30天 | 15天 ~ 60天 | 订单块最大年龄 | 调整订单块有效性 |
| `orderBlockVolumeThreshold` | 1.5倍 | 1.2倍 ~ 2.0倍 | 订单块成交量阈值 | 调整订单块质量 |

**调优建议**：
- **激进**：3根, 45天, 1.3倍（更多订单块）
- **保守**：7根, 20天, 1.8倍（更严格订单块）
- **平衡**：5根, 30天, 1.5倍（当前配置）

---

### 3. 扫荡检测参数

| 参数名称 | 当前值 | 调优范围 | 说明 | 预期影响 |
|---------|--------|---------|------|---------|
| `sweepSpeedThreshold` | 0.02 × ATR | 0.01 × ATR ~ 0.05 × ATR | 扫荡速率阈值 | 调整扫荡敏感度 |
| `sweepBarsToReturn` | 3根 | 2根 ~ 5根 | 扫荡收回K线数 | 调整扫荡确认度 |
| `sweepConfidenceBonus` | 15% | 10% ~ 20% | 扫荡置信度加成 | 调整扫荡权重 |

**调优建议**：
- **激进**：0.015 × ATR, 2根, 12%（更多扫荡信号）
- **保守**：0.03 × ATR, 4根, 18%（更严格扫荡）
- **平衡**：0.02 × ATR, 3根, 15%（当前配置）

---

### 4. 吞没形态参数

| 参数名称 | 当前值 | 调优范围 | 说明 | 预期影响 |
|---------|--------|---------|------|---------|
| `engulfingBodyRatio` | 1.5倍 | 1.2倍 ~ 2.0倍 | 吞没实体比例 | 调整吞没形态质量 |
| `engulfingVolumeRatio` | 1.5倍 | 1.2倍 ~ 2.0倍 | 吞没成交量比例 | 调整吞没形态确认 |
| `engulfingConfidenceWeight` | 15分 | 10分 ~ 20分 | 吞没形态权重 | 调整吞没形态影响 |

**调优建议**：
- **激进**：1.3倍, 1.3倍, 12分（更多吞没信号）
- **保守**：1.8倍, 1.8倍, 18分（更严格吞没）
- **平衡**：1.5倍, 1.5倍, 15分（当前配置）

---

### 5. 成交量参数

| 参数名称 | 当前值 | 调优范围 | 说明 | 预期影响 |
|---------|--------|---------|------|---------|
| `volumeExpansionRatio` | 1.5倍 | 1.2倍 ~ 2.0倍 | 成交量放大比例 | 调整成交量确认度 |
| `volumeConfidenceWeight` | 5分 | 3分 ~ 10分 | 成交量权重 | 调整成交量影响 |

**调优建议**：
- **激进**：1.3倍, 4分（更多成交量信号）
- **保守**：1.8倍, 7分（更严格成交量）
- **平衡**：1.5倍, 5分（当前配置）

---

### 6. 谐波形态参数

| 参数名称 | 当前值 | 调优范围 | 说明 | 预期影响 |
|---------|--------|---------|------|---------|
| `harmonicPatternEnabled` | true | true/false | 是否启用谐波形态 | 启用/禁用谐波形态 |
| `harmonicConfidenceBonus` | 10分 | 5分 ~ 15分 | 谐波形态加成 | 调整谐波形态影响 |

**调优建议**：
- **激进**：true, 8分（更多谐波信号）
- **保守**：false, 0分（禁用谐波形态）
- **平衡**：true, 10分（当前配置）

---

### 7. 信号评分参数

| 参数名称 | 当前值 | 调优范围 | 说明 | 预期影响 |
|---------|--------|---------|------|---------|
| `signalScoreThreshold` | 60分 | 50分 ~ 70分 | 信号触发阈值 | 调整信号质量 |
| `trendScoreWeight` | 25分 | 20分 ~ 30分 | 趋势评分权重 | 调整趋势影响 |
| `orderBlockScoreWeight` | 20分 | 15分 ~ 25分 | 订单块评分权重 | 调整订单块影响 |
| `engulfingScoreWeight` | 15分 | 10分 ~ 20分 | 吞没形态评分权重 | 调整吞没形态影响 |
| `sweepScoreWeight` | 15分 | 10分 ~ 20分 | 扫荡评分权重 | 调整扫荡影响 |
| `volumeScoreWeight` | 5分 | 3分 ~ 10分 | 成交量评分权重 | 调整成交量影响 |
| `harmonicScoreWeight` | 20分 | 15分 ~ 25分 | 谐波形态评分权重 | 调整谐波形态影响 |

**调优建议**：
- **激进**：55分, 22分, 18分, 13分, 13分, 4分, 18分（更多交易机会）
- **保守**：65分, 28分, 22分, 17分, 17分, 7分, 22分（更严格信号）
- **平衡**：60分, 25分, 20分, 15分, 15分, 5分, 20分（当前配置）

---

### 8. 仓位管理参数

| 参数名称 | 当前值 | 调优范围 | 说明 | 预期影响 |
|---------|--------|---------|------|---------|
| `riskPercent` | 1% | 0.5% ~ 2% | 单笔风险百分比 | 调整仓位大小 |
| `maxLeverage` | 24倍 | 10倍 ~ 24倍 | 最大杠杆倍数 | 调整杠杆限制 |
| `tp1Multiplier` | 2R | 1.5R ~ 3R | TP1止盈倍数 | 调整第一止盈位 |
| `tp2Multiplier` | 3R | 2R ~ 4R | TP2止盈倍数 | 调整第二止盈位 |
| `tp1ClosePercent` | 50% | 30% ~ 70% | TP1平仓比例 | 调整部分平仓比例 |
| `breakevenMove` | 0.25 × stopDistance | 0.2 × stopDistance ~ 0.3 × stopDistance | 保本点移动距离 | 调整保本点位置 |
| `trailingStopStep` | 0.5 × ATR | 0.3 × ATR ~ 0.8 × ATR | 移动止损步长 | 调整移动止损敏感度 |
| `timeStopMinutes` | 60分钟 | 30分钟 ~ 120分钟 | 时间止损分钟数 | 调整时间止损 |
| `timeStopExitPercent` | 50% | 30% ~ 70% | 时间止损平仓比例 | 调整时间止损平仓比例 |

**调优建议**：
- **激进**：1.5%, 20倍, 1.8R, 2.5R, 40%, 0.22 × stopDistance, 0.4 × ATR, 45分钟, 40%（更多交易机会）
- **保守**：0.75%, 15倍, 2.5R, 3.5R, 60%, 0.28 × stopDistance, 0.6 × ATR, 90分钟, 60%（更严格风控）
- **平衡**：1%, 24倍, 2R, 3R, 50%, 0.25 × stopDistance, 0.5 × ATR, 60分钟, 50%（当前配置）

---

## 🎯 V3 策略可调优参数

### 1. 4H 趋势判断参数

| 参数名称 | 当前值 | 调优范围 | 说明 | 预期影响 |
|---------|--------|---------|------|---------|
| `trend4HStrongThreshold` | 6分 | 5分 ~ 8分 | 4H强趋势阈值 | 调整强趋势判断 |
| `trend4HModerateThreshold` | 5分 | 4分 ~ 7分 | 4H中等趋势阈值 | 调整中等趋势判断 |
| `trend4HWeakThreshold` | 4分 | 3分 ~ 6分 | 4H弱趋势阈值 | 调整弱趋势判断 |
| `trend4HADXThreshold` | 30 | 25 ~ 35 | 4H ADX阈值 | 调整趋势强度判断 |

**调优建议**：
- **激进**：5分, 4分, 3分, 25（更多趋势信号）
- **保守**：7分, 6分, 5分, 35（更严格趋势）
- **平衡**：6分, 5分, 4分, 30（当前配置）

---

### 2. 1H 因子参数

| 参数名称 | 当前值 | 调优范围 | 说明 | 预期影响 |
|---------|--------|---------|------|---------|
| `factorTrendWeight` | 40分 | 30分 ~ 50分 | 趋势因子权重 | 调整趋势因子影响 |
| `factorMomentumWeight` | 20分 | 15分 ~ 25分 | 动量因子权重 | 调整动量因子影响 |
| `factorVolatilityWeight` | 15分 | 10分 ~ 20分 | 波动率因子权重 | 调整波动率因子影响 |
| `factorVolumeWeight` | 10分 | 5分 ~ 15分 | 成交量因子权重 | 调整成交量因子影响 |
| `factorFundingWeight` | 10分 | 5分 ~ 15分 | 资金费率因子权重 | 调整资金费率因子影响 |
| `factorOIWeight` | 5分 | 3分 ~ 10分 | 持仓量因子权重 | 调整持仓量因子影响 |
| `factorADXStrongThreshold` | 25 | 20 ~ 30 | ADX强动量阈值 | 调整强动量判断 |
| `factorADXModerateThreshold` | 15 | 12 ~ 18 | ADX中等动量阈值 | 调整中等动量判断 |
| `factorBBWHighThreshold` | 0.05 | 0.03 ~ 0.07 | BBW高波动率阈值 | 调整高波动率判断 |
| `factorBBWModerateThreshold` | 0.02 | 0.015 ~ 0.03 | BBW中等波动率阈值 | 调整中等波动率判断 |

**调优建议**：
- **激进**：35分, 18分, 13分, 8分, 8分, 4分, 22, 14, 0.04, 0.018（更多因子信号）
- **保守**：45分, 22分, 17分, 12分, 12分, 7分, 28, 16, 0.06, 0.025（更严格因子）
- **平衡**：40分, 20分, 15分, 10分, 10分, 5分, 25, 15, 0.05, 0.02（当前配置）

---

### 3. 15M 入场信号参数

| 参数名称 | 当前值 | 调优范围 | 说明 | 预期影响 |
|---------|--------|---------|------|---------|
| `entry15MStrongThreshold` | 4分 | 3分 ~ 5分 | 15M强信号阈值 | 调整强信号判断 |
| `entry15MModerateThreshold` | 3分 | 2分 ~ 4分 | 15M中等信号阈值 | 调整中等信号判断 |
| `entry15MWeakThreshold` | 2分 | 1分 ~ 3分 | 15M弱信号阈值 | 调整弱信号判断 |
| `entry15MStructureWeight` | 2分 | 1分 ~ 3分 | 15M结构评分权重 | 调整结构影响 |

**调优建议**：
- **激进**：3分, 2分, 1分, 1分（更多入场信号）
- **保守**：5分, 4分, 3分, 3分（更严格入场）
- **平衡**：4分, 3分, 2分, 2分（当前配置）

---

### 4. 信号融合参数

| 参数名称 | 当前值 | 调优范围 | 说明 | 预期影响 |
|---------|--------|---------|------|---------|
| `signalFusionStrongThreshold` | 70% | 60% ~ 80% | 强信号阈值 | 调整强信号判断 |
| `signalFusionModerateThreshold` | 45% | 40% ~ 55% | 中等信号阈值 | 调整中等信号判断 |
| `signalFusionWeakThreshold` | 35% | 30% ~ 45% | 弱信号阈值 | 调整弱信号判断 |
| `signalFusionTrendWeight` | 50% | 40% ~ 60% | 趋势权重 | 调整趋势影响 |
| `signalFusionFactorWeight` | 35% | 25% ~ 45% | 因子权重 | 调整因子影响 |
| `signalFusionEntryWeight` | 15% | 10% ~ 20% | 入场权重 | 调整入场影响 |
| `signalFusionCompensationEnabled` | true | true/false | 是否启用补偿机制 | 启用/禁用补偿 |
| `signalFusionCompensationThreshold` | 80% | 70% ~ 90% | 补偿阈值 | 调整补偿触发 |

**调优建议**：
- **激进**：65%, 40%, 30%, 45%, 30%, 15%, true, 75%（更多交易机会）
- **保守**：75%, 50%, 40%, 55%, 40%, 18%, false, 85%（更严格信号）
- **平衡**：70%, 45%, 35%, 50%, 35%, 15%, true, 80%（当前配置）

---

### 5. 持仓时长参数

| 参数名称 | 当前值 | 调优范围 | 说明 | 预期影响 |
|---------|--------|---------|------|---------|
| `mainstreamTrendMaxHours` | 168小时（7天） | 120小时 ~ 216小时 | 主流币趋势市最大持仓 | 调整主流币持仓时长 |
| `mainstreamRangeMaxHours` | 12小时 | 8小时 ~ 18小时 | 主流币震荡市最大持仓 | 调整主流币持仓时长 |
| `highCapTrendMaxHours` | 72小时（3天） | 48小时 ~ 96小时 | 高市值强趋势币趋势市最大持仓 | 调整高市值币持仓时长 |
| `highCapRangeMaxHours` | 4小时 | 3小时 ~ 6小时 | 高市值强趋势币震荡市最大持仓 | 调整高市值币持仓时长 |
| `hotTrendMaxHours` | 24小时 | 18小时 ~ 36小时 | 热点币趋势市最大持仓 | 调整热点币持仓时长 |
| `hotRangeMaxHours` | 3小时 | 2小时 ~ 5小时 | 热点币震荡市最大持仓 | 调整热点币持仓时长 |
| `smallCapTrendMaxHours` | 12小时 | 8小时 ~ 18小时 | 小币趋势市最大持仓 | 调整小币持仓时长 |
| `smallCapRangeMaxHours` | 2小时 | 1.5小时 ~ 3小时 | 小币震荡市最大持仓 | 调整小币持仓时长 |

**调优建议**：
- **激进**：192小时, 15小时, 84小时, 5小时, 30小时, 4小时, 15小时, 2.5小时（更长持仓）
- **保守**：144小时, 10小时, 60小时, 3.5小时, 20小时, 2.5小时, 10小时, 1.5小时（更短持仓）
- **平衡**：168小时, 12小时, 72小时, 4小时, 24小时, 3小时, 12小时, 2小时（当前配置）

---

### 6. 时间止损参数

| 参数名称 | 当前值 | 调优范围 | 说明 | 预期影响 |
|---------|--------|---------|------|---------|
| `mainstreamTrendTimeStop` | 60分钟 | 45分钟 ~ 90分钟 | 主流币趋势市时间止损 | 调整主流币时间止损 |
| `mainstreamRangeTimeStop` | 30分钟 | 20分钟 ~ 45分钟 | 主流币震荡市时间止损 | 调整主流币时间止损 |
| `highCapTrendTimeStop` | 120分钟 | 90分钟 ~ 150分钟 | 高市值强趋势币趋势市时间止损 | 调整高市值币时间止损 |
| `highCapRangeTimeStop` | 45分钟 | 30分钟 ~ 60分钟 | 高市值强趋势币震荡市时间止损 | 调整高市值币时间止损 |
| `hotTrendTimeStop` | 180分钟 | 120分钟 ~ 240分钟 | 热点币趋势市时间止损 | 调整热点币时间止损 |
| `hotRangeTimeStop` | 60分钟 | 45分钟 ~ 90分钟 | 热点币震荡市时间止损 | 调整热点币时间止损 |
| `smallCapTrendTimeStop` | 30分钟 | 20分钟 ~ 45分钟 | 小币趋势市时间止损 | 调整小币时间止损 |
| `smallCapRangeTimeStop` | 30分钟 | 20分钟 ~ 45分钟 | 小币震荡市时间止损 | 调整小币时间止损 |

**调优建议**：
- **激进**：75分钟, 35分钟, 135分钟, 50分钟, 210分钟, 70分钟, 35分钟, 35分钟（更长时间止损）
- **保守**：50分钟, 25分钟, 105分钟, 40分钟, 150分钟, 50分钟, 25分钟, 25分钟（更短时间止损）
- **平衡**：60分钟, 30分钟, 120分钟, 45分钟, 180分钟, 60分钟, 30分钟, 30分钟（当前配置）

---

### 7. 止损止盈参数

| 参数名称 | 当前值 | 调优范围 | 说明 | 预期影响 |
|---------|--------|---------|------|---------|
| `mainstreamTrendStopLoss` | 1.5 × ATR | 1.2 × ATR ~ 2.0 × ATR | 主流币趋势市止损倍数 | 调整主流币止损 |
| `mainstreamTrendProfitTarget` | 4.5 × ATR | 3.5 × ATR ~ 6.0 × ATR | 主流币趋势市止盈倍数 | 调整主流币止盈 |
| `mainstreamRangeStopLoss` | 1.5 × ATR | 1.2 × ATR ~ 2.0 × ATR | 主流币震荡市止损倍数 | 调整主流币止损 |
| `mainstreamRangeProfitTarget` | 4.5 × ATR | 3.5 × ATR ~ 6.0 × ATR | 主流币震荡市止盈倍数 | 调整主流币止盈 |
| `highCapTrendStopLoss` | 2.0 × ATR | 1.5 × ATR ~ 2.5 × ATR | 高市值强趋势币趋势市止损倍数 | 调整高市值币止损 |
| `highCapTrendProfitTarget` | 6.0 × ATR | 5.0 × ATR ~ 8.0 × ATR | 高市值强趋势币趋势市止盈倍数 | 调整高市值币止盈 |
| `highCapRangeStopLoss` | 2.0 × ATR | 1.5 × ATR ~ 2.5 × ATR | 高市值强趋势币震荡市止损倍数 | 调整高市值币止损 |
| `highCapRangeProfitTarget` | 6.0 × ATR | 5.0 × ATR ~ 8.0 × ATR | 高市值强趋势币震荡市止盈倍数 | 调整高市值币止盈 |
| `hotTrendStopLoss` | 2.5 × ATR | 2.0 × ATR ~ 3.0 × ATR | 热点币趋势市止损倍数 | 调整热点币止损 |
| `hotTrendProfitTarget` | 7.5 × ATR | 6.0 × ATR ~ 10.0 × ATR | 热点币趋势市止盈倍数 | 调整热点币止盈 |
| `hotRangeStopLoss` | 2.5 × ATR | 2.0 × ATR ~ 3.0 × ATR | 热点币震荡市止损倍数 | 调整热点币止损 |
| `hotRangeProfitTarget` | 7.5 × ATR | 6.0 × ATR ~ 10.0 × ATR | 热点币震荡市止盈倍数 | 调整热点币止盈 |
| `smallCapTrendStopLoss` | 1.5 × ATR | 1.2 × ATR ~ 2.0 × ATR | 小币趋势市止损倍数 | 调整小币止损 |
| `smallCapTrendProfitTarget` | 4.5 × ATR | 3.5 × ATR ~ 6.0 × ATR | 小币趋势市止盈倍数 | 调整小币止盈 |
| `smallCapRangeStopLoss` | 1.5 × ATR | 1.2 × ATR ~ 2.0 × ATR | 小币震荡市止损倍数 | 调整小币止损 |
| `smallCapRangeProfitTarget` | 4.5 × ATR | 3.5 × ATR ~ 6.0 × ATR | 小币震荡市止盈倍数 | 调整小币止盈 |

**调优建议**：
- **激进**：1.3 × ATR, 3.8 × ATR, 1.3 × ATR, 3.8 × ATR, 1.7 × ATR, 5.3 × ATR, 1.7 × ATR, 5.3 × ATR, 2.2 × ATR, 6.5 × ATR, 2.2 × ATR, 6.5 × ATR, 1.3 × ATR, 3.8 × ATR, 1.3 × ATR, 3.8 × ATR（更紧止损，更近止盈）
- **保守**：1.8 × ATR, 5.5 × ATR, 1.8 × ATR, 5.5 × ATR, 2.3 × ATR, 7.0 × ATR, 2.3 × ATR, 7.0 × ATR, 2.8 × ATR, 8.5 × ATR, 2.8 × ATR, 8.5 × ATR, 1.8 × ATR, 5.5 × ATR, 1.8 × ATR, 5.5 × ATR（更宽止损，更远止盈）
- **平衡**：1.5 × ATR, 4.5 × ATR, 1.5 × ATR, 4.5 × ATR, 2.0 × ATR, 6.0 × ATR, 2.0 × ATR, 6.0 × ATR, 2.5 × ATR, 7.5 × ATR, 2.5 × ATR, 7.5 × ATR, 1.5 × ATR, 4.5 × ATR, 1.5 × ATR, 4.5 × ATR（当前配置）

---

### 8. 置信度调整参数

| 参数名称 | 当前值 | 调优范围 | 说明 | 预期影响 |
|---------|--------|---------|------|---------|
| `confidenceHighMultiplier` | 1.0 | 0.9 ~ 1.1 | 高置信度倍数 | 调整高置信度止损止盈 |
| `confidenceMedMultiplier` | 1.2 | 1.0 ~ 1.4 | 中等置信度倍数 | 调整中等置信度止损止盈 |
| `confidenceLowMultiplier` | 1.5 | 1.3 ~ 1.7 | 低置信度倍数 | 调整低置信度止损止盈 |

**调优建议**：
- **激进**：0.95, 1.15, 1.45（更紧止损止盈）
- **保守**：1.05, 1.25, 1.55（更宽止损止盈）
- **平衡**：1.0, 1.2, 1.5（当前配置）

---

### 9. 杠杆参数

| 参数名称 | 当前值 | 调优范围 | 说明 | 预期影响 |
|---------|--------|---------|------|---------|
| `maxLeverage` | 24倍 | 10倍 ~ 24倍 | 最大杠杆倍数 | 调整杠杆限制 |
| `leverageBuffer` | 0.5% | 0.3% ~ 0.7% | 杠杆计算缓冲 | 调整杠杆计算 |

**调优建议**：
- **激进**：20倍, 0.4%（更高杠杆）
- **保守**：15倍, 0.6%（更低杠杆）
- **平衡**：24倍, 0.5%（当前配置）

---

## 📊 参数化调优实施方案

### 阶段 1：数据库设计 ✅

**目标**：创建参数配置表，支持策略参数的可视化调整。

**数据库表设计**：
```sql
-- 策略参数配置表
CREATE TABLE strategy_parameters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    strategy_name VARCHAR(50) NOT NULL COMMENT '策略名称',
    parameter_group VARCHAR(50) NOT NULL COMMENT '参数组',
    parameter_name VARCHAR(100) NOT NULL COMMENT '参数名称',
    parameter_value TEXT NOT NULL COMMENT '参数值（JSON格式）',
    description TEXT COMMENT '参数说明',
    default_value TEXT COMMENT '默认值',
    min_value TEXT COMMENT '最小值',
    max_value TEXT COMMENT '最大值',
    unit VARCHAR(20) COMMENT '单位',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_strategy_parameter (strategy_name, parameter_group, parameter_name),
    INDEX idx_strategy (strategy_name),
    INDEX idx_group (parameter_group)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 策略参数历史表
CREATE TABLE strategy_parameter_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    strategy_name VARCHAR(50) NOT NULL COMMENT '策略名称',
    parameter_group VARCHAR(50) NOT NULL COMMENT '参数组',
    parameter_name VARCHAR(100) NOT NULL COMMENT '参数名称',
    old_value TEXT COMMENT '旧值',
    new_value TEXT COMMENT '新值',
    changed_by VARCHAR(50) COMMENT '修改人',
    reason TEXT COMMENT '修改原因',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_strategy (strategy_name),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 策略参数回测结果表
CREATE TABLE strategy_parameter_backtest_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    strategy_name VARCHAR(50) NOT NULL COMMENT '策略名称',
    parameter_group VARCHAR(50) NOT NULL COMMENT '参数组',
    parameter_name VARCHAR(100) NOT NULL COMMENT '参数名称',
    parameter_value TEXT NOT NULL COMMENT '参数值',
    backtest_period VARCHAR(20) NOT NULL COMMENT '回测周期',
    total_trades INT DEFAULT 0 COMMENT '总交易数',
    winning_trades INT DEFAULT 0 COMMENT '盈利交易数',
    losing_trades INT DEFAULT 0 COMMENT '亏损交易数',
    win_rate DECIMAL(5, 4) DEFAULT 0.0000 COMMENT '胜率',
    total_pnl DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '总盈亏',
    avg_win DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '平均盈利',
    avg_loss DECIMAL(20, 8) DEFAULT 0.00000000 COMMENT '平均亏损',
    max_drawdown DECIMAL(10, 4) DEFAULT 0.0000 COMMENT '最大回撤',
    sharpe_ratio DECIMAL(10, 4) DEFAULT 0.0000 COMMENT '夏普比率',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_strategy (strategy_name),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

### 阶段 2：后端服务实现

**目标**：创建参数管理服务，支持参数的读取、更新和回测。

**服务设计**：
```javascript
// src/services/strategy-parameter-manager.js
class StrategyParameterManager {
  constructor(database) {
    this.database = database;
    this.cache = new Map(); // 参数缓存
  }

  /**
   * 获取策略参数
   * @param {string} strategyName - 策略名称
   * @param {string} parameterGroup - 参数组
   * @returns {Object} 参数配置
   */
  async getParameters(strategyName, parameterGroup = null) {
    // 实现参数获取逻辑
  }

  /**
   * 更新策略参数
   * @param {string} strategyName - 策略名称
   * @param {string} parameterGroup - 参数组
   * @param {string} parameterName - 参数名称
   * @param {*} parameterValue - 参数值
   * @param {string} reason - 修改原因
   * @returns {Object} 更新结果
   */
  async updateParameter(strategyName, parameterGroup, parameterName, parameterValue, reason) {
    // 实现参数更新逻辑
  }

  /**
   * 回测策略参数
   * @param {string} strategyName - 策略名称
   * @param {string} parameterGroup - 参数组
   * @param {string} parameterName - 参数名称
   * @param {*} parameterValue - 参数值
   * @param {string} backtestPeriod - 回测周期
   * @returns {Object} 回测结果
   */
  async backtestParameter(strategyName, parameterGroup, parameterName, parameterValue, backtestPeriod) {
    // 实现参数回测逻辑
  }

  /**
   * 获取参数历史记录
   * @param {string} strategyName - 策略名称
   * @param {string} parameterGroup - 参数组
   * @param {string} parameterName - 参数名称
   * @returns {Array} 历史记录
   */
  async getParameterHistory(strategyName, parameterGroup, parameterName) {
    // 实现参数历史查询逻辑
  }
}
```

---

### 阶段 3：前端界面实现

**目标**：创建参数调整界面，支持可视化参数调整和回测。

**前端页面设计**：
```
/strategy-parameters
├── ICT 策略参数
│   ├── 趋势判断参数
│   ├── 订单块检测参数
│   ├── 扫荡检测参数
│   ├── 吞没形态参数
│   ├── 成交量参数
│   ├── 谐波形态参数
│   ├── 信号评分参数
│   └── 仓位管理参数
└── V3 策略参数
    ├── 4H 趋势判断参数
    ├── 1H 因子参数
    ├── 15M 入场信号参数
    ├── 信号融合参数
    ├── 持仓时长参数
    ├── 时间止损参数
    ├── 止损止盈参数
    ├── 置信度调整参数
    └── 杠杆参数
```

**前端功能**：
- ✅ 参数可视化调整（滑块、输入框、下拉框）
- ✅ 参数实时预览
- ✅ 参数回测功能
- ✅ 参数历史记录
- ✅ 参数对比功能
- ✅ 参数导入/导出功能

---

### 阶段 4：策略集成

**目标**：将参数管理服务集成到 ICT 和 V3 策略中。

**集成方案**：
```javascript
// ICT 策略集成
class ICTStrategy {
  constructor() {
    this.name = 'ICT';
    this.parameterManager = null; // 参数管理器
  }

  async initialize() {
    // 初始化参数管理器
    this.parameterManager = new StrategyParameterManager(this.database);
    await this.parameterManager.loadParameters('ICT');
  }

  async analyzeDailyTrend(klines) {
    // 从参数管理器获取参数
    const params = await this.parameterManager.getParameters('ICT', 'trend');
    const threshold = params.dailyTrendThreshold || 0.02;
    const lookback = params.dailyTrendLookback || 20;
    
    // 使用参数进行分析
    // ...
  }
}

// V3 策略集成
class V3Strategy {
  constructor() {
    this.name = 'V3';
    this.parameterManager = null; // 参数管理器
  }

  async initialize() {
    // 初始化参数管理器
    this.parameterManager = new StrategyParameterManager(this.database);
    await this.parameterManager.loadParameters('V3');
  }

  async combineSignals(trend4H, factors1H, execution15M) {
    // 从参数管理器获取参数
    const params = await this.parameterManager.getParameters('V3', 'signal-fusion');
    const strongThreshold = params.signalFusionStrongThreshold || 0.7;
    const moderateThreshold = params.signalFusionModerateThreshold || 0.45;
    
    // 使用参数进行信号融合
    // ...
  }
}
```

---

### 阶段 5：回测系统实现

**目标**：创建参数回测系统，支持参数调优。

**回测系统设计**：
```javascript
// src/services/strategy-backtest-engine.js
class StrategyBacktestEngine {
  constructor(database, binanceAPI) {
    this.database = database;
    this.binanceAPI = binanceAPI;
  }

  /**
   * 回测策略参数
   * @param {string} strategyName - 策略名称
   * @param {Object} parameters - 参数配置
   * @param {string} period - 回测周期
   * @returns {Object} 回测结果
   */
  async backtestParameters(strategyName, parameters, period = '7d') {
    // 实现参数回测逻辑
    // 1. 获取历史数据
    // 2. 使用新参数运行策略
    // 3. 计算回测指标
    // 4. 返回回测结果
  }

  /**
   * 对比参数回测结果
   * @param {string} strategyName - 策略名称
   * @param {Array} parameterSets - 参数集合
   * @param {string} period - 回测周期
   * @returns {Array} 对比结果
   */
  async compareParameters(strategyName, parameterSets, period = '7d') {
    // 实现参数对比逻辑
  }
}
```

---

## 📈 参数调优工作流程

### 1. 参数调整流程

```
1. 分析当前策略表现
   ├── 查看交易记录
   ├── 分析胜率、盈亏比
   └── 识别问题

2. 调整参数
   ├── 在前端页面调整参数
   ├── 实时预览参数影响
   └── 保存参数配置

3. 回测验证
   ├── 选择回测周期
   ├── 运行回测
   └── 查看回测结果

4. 部署新参数
   ├── 确认回测结果
   ├── 部署到生产环境
   └── 监控策略表现

5. 持续优化
   ├── 每周复盘
   ├── 调整参数
   └── 重复步骤 2-4
```

---

### 2. 每周复盘流程

```
1. 数据收集
   ├── 收集本周交易记录
   ├── 分析胜率、盈亏比
   ├── 分析持仓时长
   └── 分析止损止盈触发情况

2. 技术面分析
   ├── 分析市场趋势
   ├── 分析波动率
   ├── 分析成交量
   └── 分析资金费率

3. 消息面分析
   ├── 分析重大事件
   ├── 分析市场情绪
   ├── 分析资金流向
   └── 分析政策变化

4. 参数调整
   ├── 根据复盘结果调整参数
   ├── 回测验证
   └── 部署新参数

5. 记录总结
   ├── 记录调整原因
   ├── 记录预期效果
   └── 记录下周监控