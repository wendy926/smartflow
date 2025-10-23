# V3策略阈值差异化失效根本原因分析

## 🎯 根本原因已找到

### 问题链条

1. **V3策略架构改变**（Line 30, v3-strategy.js）
   - ✅ 移除了所有硬编码：`this.trend4HStrongThreshold = 8`
   - ✅ 改用动态读取：`getThreshold('trend', 'trend4HStrongThreshold', 3)`
   - ✅ 从`this.params.trend_thresholds.trend4HStrongThreshold`读取

2. **StrategyParameterLoader正确加载**（strategy-param-loader.js）
   - ✅ 修复后使用category字段
   - ✅ 组织成嵌套结构：`params.trend_thresholds.xxx`
   - ✅ 策略execute()内部能正确读取

3. **BacktestManager查询错误**（Line 593, backtest-manager-v3.js）
   - ❌ 只查询`param_name, param_value`
   - ❌ **未查询category字段**
   - ❌ 返回平面对象而非嵌套结构

4. **回测引擎赋值错误**（Line 376, backtest-strategy-engine-v3.js）
   - ❌ `Object.assign(this.v3Strategy, params)`
   - ❌ 尝试设置`this.v3Strategy.trend4HStrongThreshold`
   - ❌ 但该属性已不存在！应该设置`this.v3Strategy.params.trend_thresholds.xxx`

### 为什么回测仍然产生了交易？

因为V3策略的execute()方法内部：
1. 使用`this.paramLoader.loadParameters()`从数据库加载
2. 成功获取到嵌套的`params.trend_thresholds`结构  
3. `getThreshold()`能正确读取值

**但是**：由于三种模式都使用同一个策略实例，且`paramLoader`有缓存（5分钟），所以：
- AGGRESSIVE模式首次加载参数，缓存了AGGRESSIVE的参数
- BALANCED模式使用同一实例，读到的是缓存的AGGRESSIVE参数
- CONSERVATIVE模式也是如此

导致三种模式使用相同的参数！

## ✅ 完整修复方案

### 修复1: BacktestManager查询category字段

```javascript
// Line 593, backtest-manager-v3.js
let query = `
  SELECT param_name, param_value, category, param_group
  FROM strategy_params 
  WHERE strategy_name = ? AND strategy_mode = ? AND is_active = 1
`;
```

### 修复2: 组织成嵌套结构

```javascript
const params = {};
for (const row of rows) {
  const group = row.category || row.param_group || 'general';
  if (!params[group]) {
    params[group] = {};
  }
  params[group][row.param_name] = parseFloat(row.param_value) || row.param_value;
}
```

### 修复3: 赋值到正确位置

```javascript
// Line 376, backtest-strategy-engine-v3.js
// ❌ 错误: Object.assign(this.v3Strategy, params);
// ✅ 正确: Object.assign(this.v3Strategy.params, params);
this.v3Strategy.params = {
  ...this.v3Strategy.params,
  ...params
};
```

### 修复4: 清除缓存

```javascript
// 每次回测前清除paramLoader缓存
if (this.v3Strategy.paramLoader) {
  this.v3Strategy.paramLoader.clearCache();
}
```

## 🚀 预期效果

修复后：
- AGGRESSIVE: 阈值2/1/1，应产生更多交易
- BALANCED: 阈值3/2/1，中等数量交易
- CONSERVATIVE: 阈值4/3/2，最少交易

三种模式的交易数量、胜率、盈亏比应该有明显差异。

