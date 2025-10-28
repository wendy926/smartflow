# 实盘策略模式配置检查报告

## 🔍 检查时间
2025-01-XX

---

## 📊 当前配置状态

### 数据库配置

#### ICT策略 - BALANCED模式
```sql
SELECT param_name, param_value, category
FROM strategy_params
WHERE strategy_name='ICT' AND strategy_mode='BALANCED'
AND category IN ('risk_management', 'position');
```

结果：
```
| param_name          | param_value | category        |
|---------------------|-------------|-----------------|
| maxLeverage         | 24          | position        |
| riskPercent         | 0.01        | position        |
| stopLossATRMultiplier | 1.8     | position        |
| takeProfitRatio     | 4.0         | position        |
```

#### V3策略 - AGGRESSIVE模式
```sql
SELECT param_name, param_value, category
FROM strategy_params
WHERE strategy_name='V3' AND strategy_mode='AGGRESSIVE'
AND category IN ('risk_management', 'position');
```

结果：
```
| param_name          | param_value | category          |
|---------------------|-------------|-------------------|
| maxLeverage         | 20          | risk_management   |
| riskPercent         | 0.015       | risk_management   |
| stopLossATRMultiplier | 1.3     | risk_management   |
| takeProfitRatio     | 3.8         | risk_management   |
```

---

## ⚠️ 问题发现

### 1. 实盘加载的参数为 undefined

从日志中可以看到：
```json
{
  "ict": {
    "paramGroups": 1,
    "stopLossATR": undefined,    // ❌ 未加载成功
    "takeProfit": undefined,     // ❌ 未加载成功
    "riskPercent": 0.01          // ✅ 加载成功
  },
  "v3": {
    "paramGroups": 1,
    "stopLossATR": undefined,    // ❌ 未加载成功
    "takeProfit": 4.5,           // ✅ 部分加载成功
    "riskPercent": 0.01          // ✅ 加载成功
  }
}
```

**问题**：
- ICT策略的 `stopLossATR` 和 `takeProfit` 为 undefined
- V3策略的 `stopLossATR` 为 undefined
- 参数加载不完整

### 2. 参数访问路径不匹配

#### ICT策略期望的参数结构
```javascript
this.params.position?.riskPercent
this.params.risk_management?.stopLossATRMultiplier
this.params.risk_management?.takeProfitRatio
```

#### 数据库中的参数结构
ICT BALANCED模式：
- `category = 'position'`: riskPercent=0.01, maxLeverage=24
- `category = 'position'`: stopLossATRMultiplier=1.8, takeProfitRatio=4.0

**问题**：`stopLossATRMultiplier` 和 `takeProfitRatio` 被存储在 `position` 类别下，而不是 `risk_management` 类别！

#### 实际访问路径
```javascript
// 代码期望
this.params.risk_management?.stopLossATRMultiplier  // undefined ❌

// 实际存储
this.params.position?.stopLossATRMultiplier  // 1.8 ✅
```

---

## 🔍 根本原因分析

### 问题1：category 分类错误

ICT BALANCED 模式的参数分类：
- ✅ `position` 类别：正确（包含 riskPercent, maxLeverage）
- ❌ `position` 类别：错误（包含 stopLossATRMultiplier, takeProfitRatio）
  - 应该是 `risk_management` 类别

V3 AGGRESSIVE 模式的参数分类：
- ✅ `risk_management` 类别：正确（包含 stopLossATRMultiplier, takeProfitRatio）

### 问题2：策略访问路径不一致

ICT策略的访问路径：
```javascript
// 期望从 risk_management 获取
this.params.risk_management?.stopLossATRMultiplier  // undefined
this.params.risk_management?.takeProfitRatio         // undefined

// 实际从 position 获取
this.params.position?.stopLossATRMultiplier  // 1.8 ✅
this.params.position?.takeProfitRatio        // 4.0 ✅
```

---

## 🎯 检查结论

### ✅ ICT策略（BALANCED模式）

**配置状态**：
- ✅ 数据库有 BALANCED 模式参数
- ❌ 参数分类错误（stopLossATRMultiplier 应在 risk_management 类别）
- ❌ 代码访问路径错误（期望从 risk_management 获取，但实际在 position）

**实际使用的参数**：
- riskPercent: 0.01 ✅
- stopLossATRMultiplier: 1.8（从 position 获取）⚠️
- takeProfitRatio: 4.0（从 position 获取）⚠️

### ✅ V3策略（AGGRESSIVE模式）

**配置状态**：
- ✅ 数据库有 AGGRESSIVE 模式参数
- ✅ 参数分类正确
- ❌ 代码访问路径可能错误

**实际使用的参数**：
- riskPercent: 0.015 ✅
- stopLossATRMultiplier: 1.3（从 risk_management 获取）✅
- takeProfitRatio: 3.8（从 risk_management 获取）✅

---

## 📝 建议修复

### 修复1：统一参数分类

#### ICT BALANCED模式
```sql
UPDATE strategy_params
SET category = 'risk_management'
WHERE strategy_name = 'ICT'
  AND strategy_mode = 'BALANCED'
  AND param_name IN ('stopLossATRMultiplier', 'takeProfitRatio')
  AND category = 'position';
```

#### V3 AGGRESSIVE模式
保持 `risk_management` 类别不变 ✅

### 修复2：统一代码访问路径

修改 ICT 策略访问路径：
```javascript
// 当前（错误）
this.params.risk_management?.stopLossATRMultiplier  // undefined

// 修复后（正确）
// 方案1：修改数据库类别为 risk_management ✅
this.params.risk_management?.stopLossATRMultiplier  // 1.8

// 方案2：修改代码为从 position 获取
this.params.position?.stopLossATRMultiplier  // 1.8
```

推荐：**方案1**（修改数据库分类，统一为 risk_management）

---

## 🔄 验证步骤

### 1. 修复数据库分类

```sql
-- 修复 ICT BALANCED 模式
UPDATE strategy_params
SET category = 'risk_management'
WHERE strategy_name = 'ICT'
  AND strategy_mode = 'BALANCED'
  AND param_name IN ('stopLossATRMultiplier', 'takeProfitRatio');

-- 验证
SELECT param_name, param_value, category
FROM strategy_params
WHERE strategy_name = 'ICT' AND strategy_mode = 'BALANCED';
```

### 2. 重启策略worker

```bash
pm2 restart strategy-worker
```

### 3. 检查日志

```bash
pm2 logs strategy-worker --lines 100 | grep "当前使用参数"
```

**期望输出**：
```json
{
  "ict": {
    "paramGroups": 2,
    "stopLossATR": 1.8,    // ✅ 现在有值
    "takeProfit": 4.0,     // ✅ 现在有值
    "riskPercent": 0.01
  },
  "v3": {
    "paramGroups": 2,
    "stopLossATR": 1.3,    // ✅ 现在有值
    "takeProfit": 3.8,
    "riskPercent": 0.015
  }
}
```

