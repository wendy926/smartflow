# V3策略方案3：三个模式结果相同的原因分析

## 分析时间：2025-01-24

### 方案3回测结果

| 模式 | 交易数 | 胜率 | 盈亏比 | 平均盈利 | 平均亏损 | 总盈亏 |
|------|--------|------|--------|----------|----------|--------|
| **AGGRESSIVE** | **38笔** | **79%** | **0.69** | **124,843** | **-181,666** | **2,291,958** |
| **BALANCED** | **38笔** | **79%** | **0.69** | **90,164** | **-131,203** | **1,655,303** |
| **CONSERVATIVE** | **38笔** | **79%** | **0.69** | **62,421** | **-90,833** | **1,145,979** |

### 问题发现

**三个模式的结果完全相同**：
- ✅ **交易数量相同**：38笔
- ✅ **胜率相同**：79%（30胜8负）
- ✅ **盈亏比相同**：0.69
- ⚠️ **盈亏金额不同**：AGGRESSIVE > BALANCED > CONSERVATIVE

### 根本原因分析

#### 数据库参数差异

| 参数 | AGGRESSIVE | BALANCED | CONSERVATIVE |
|------|-----------|----------|-------------|
| **riskPercent** | **1.8%** | **1.3%** | **0.9%** |
| **stopLossATRMultiplier** | **0.3** | **0.3** | **0.3**（相同） |
| **takeProfitRatio** | **3.0** | **3.0** | **3.0**（相同） |
| **highConfidencePositionRatio** | **100%** | **100%** | **100%**（相同） |

#### 为什么结果相同？

1. **相同的信号过滤标准**：
   - 所有模式都要求`normalizedScore >= 70`才能触发High信号
   - 所有模式只允许High信号建仓（Med/Low不建仓）
   - 因此**三个模式产生的交易信号完全相同**（38个High信号）

2. **相同的止损止盈参数**：
   - `stopLossATRMultiplier = 0.3`（所有模式相同）
   - `takeProfitRatio = 3.0`（所有模式相同）
   - 因此**每个交易的止损止盈距离完全相同**，导致**胜率和盈亏比相同**

3. **相同的仓位比例**：
   - `highConfidencePositionRatio = 100%`（所有模式相同）
   - 所有High信号都使用100%仓位
   - 因此**仓位比例相同**

4. **riskPercent只影响绝对盈亏金额**：
   - `riskPercent`不同（1.8% vs 1.3% vs 0.9%）
   - 只影响**仓位大小**（张数）
   - **不影响**交易信号、胜率、盈亏比
   - 因此**盈亏金额不同**，但**胜率和盈亏比相同**

### 代码实现问题

**关键代码**（`backtest-strategy-engine-v3.js`）：

```javascript
// 所有模式使用相同的信号过滤标准（High≥70）
if (normalizedScore >= 70) {
  return { confidence: 'High', ... };
}

// 所有模式使用相同的止损止盈参数
const atrMultiplier = params?.risk_management?.stopLossATRMultiplier || 0.3; // 所有模式=0.3
const takeProfitRatio = params?.risk_management?.takeProfitRatio || 3.0; // 所有模式=3.0

// 所有模式使用相同的仓位比例
const highConfidenceRatio = (params?.position_management?.highConfidencePositionRatio || 100) / 100; // 所有模式=100%

// 只有riskPercent不同
const riskPct = (params?.risk_management?.riskPercent ?? params?.position?.riskPercent) || 0.01;
const riskAmount = equity * riskPct; // AGGRESSIVE=180, BALANCED=130, CONSERVATIVE=90
const units = stopDistance > 0 ? (riskAmount / stopDistance) : 0;
const totalQuantity = units * positionRatio; // 只影响仓位大小，不影响交易信号
```

### 结论

**方案3的三个模式结果相同的原因是**：

1. ✅ **正确的**：`riskPercent`不同导致盈亏金额不同（符合预期）
2. ❌ **问题**：所有模式使用**相同的信号过滤标准**和**相同的止损止盈参数**，导致：
   - 交易数量相同（相同的信号过滤）
   - 胜率相同（相同的止损止盈）
   - 盈亏比相同（相同的止损止盈比例）

**关键问题**：
- **止损止盈参数应该根据模式调整**（AGGRESSIVE应该使用更紧的止损、更高的止盈）
- **信号阈值也可以根据模式调整**（AGGRESSIVE可以放宽，CONSERVATIVE可以收紧）
- **当前实现中，只有`riskPercent`根据模式调整，其他关键参数都是相同的**

### 建议

**如果希望三个模式有差异**，需要调整：

1. **止损止盈参数**：
   - AGGRESSIVE: 更紧的止损（0.25-0.3），更高的止盈（3.5-4.0）
   - BALANCED: 标准止损（0.3-0.35），标准止盈（3.0-3.5）
   - CONSERVATIVE: 更宽的止损（0.35-0.4），更低的止盈（2.5-3.0）

2. **信号阈值**：
   - AGGRESSIVE: 可以放宽至≥65
   - BALANCED: 保持≥70
   - CONSERVATIVE: 可以收紧至≥75

3. **或者接受当前结果**：
   - 如果设计意图就是"三个模式只在仓位大小上有差异"，那么当前结果是正确的
   - `riskPercent`的不同已经实现了不同的风险敞口
   - 盈亏金额的不同（AGGRESSIVE > BALANCED > CONSERVATIVE）符合预期

