# 策略当前状态表格 - 数据更新频率说明

**文档时间**: 2025-10-10  
**表格位置**: Dashboard > 策略当前状态

---

## 📊 表格列详细说明

### 表格结构（14列）

| 列序号 | 列名 | 数据来源 | 更新频率 | 说明 |
|--------|------|---------|---------|------|
| 1 | **交易对** | symbols表 | 固定 | 交易对符号（如BTCUSDT） |
| 2 | **当前价格** | Binance API实时 | **每5分钟** | `getTicker24hr()` |
| 3 | **策略** | 固定 | 固定 | V3或ICT标识 |
| 4 | **趋势** | 策略实时计算 | **每5分钟** | `v3Strategy.execute()` |
| 5 | **信号** | 策略实时计算 | **每5分钟** | BUY/SELL/WATCH/HOLD |
| 6 | **高时间框架** | 策略实时计算 | **每5分钟** | 4H趋势判断 |
| 7 | **中时间框架** | 策略实时计算 | **每5分钟** | 1H因子分析 |
| 8 | **低时间框架** | 策略实时计算 | **每5分钟** | 15M入场判断 |
| 9 | **AI分析** ⭐ | ai_market_analysis表 | **1小时** | AI趋势分析 |
| 10 | **入场价格** | simulation_trades表 | 交易触发时 | 只有触发交易后才有值 |
| 11 | **止损价格** | simulation_trades表 | 交易触发时 | 只有触发交易后才有值 |
| 12 | **止盈价格** | simulation_trades表 | 交易触发时 | 只有触发交易后才有值 |
| 13 | **杠杆** | simulation_trades表 | 交易触发时 | 只有触发交易后才有值 |
| 14 | **保证金** | simulation_trades表 | 交易触发时 | 只有触发交易后才有值 |

---

## 🔄 更新机制详解

### 1. Dashboard整体刷新（5分钟）

**触发方式**:
```javascript
setInterval(() => {
  if (this.currentTab === 'dashboard') {
    this.loadDashboardData();  // 加载仪表板数据
  }
}, 300000);  // 5分钟（与后端strategy-worker保持一致）
```

**包含的数据**:
- ✅ 宏观监控数据（资金流、市场情绪等）
- ✅ 策略当前状态表格
  - 当前价格（Binance实时）
  - 策略判断（**实时计算，非缓存，不存储**）
  - 交易记录（数据库查询）

**⚠️ 重要**: 
- 策略判断数据（趋势、信号、时间框架）每次都是完整重新计算的，**不保存到数据库**
- 只有交易触发后，才会将交易数据保存到 `simulation_trades` 表
- 前端刷新频率与后端 strategy-worker 完全一致，保证数据同步

---

### 2. 策略状态列（1-8列）- 每5分钟实时计算

#### 数据流程
```
每5分钟 → loadDashboardData()
        → loadStrategyCurrentStatus()
        → /api/v1/strategies/current-status
        → 为每个交易对执行:
          - Binance API: getTicker24hr() [实时价格]
          - v3Strategy.execute() [🔥 V3策略完整实时计算]
            ↓
            1. 从Binance获取K线（4H/1H/15M）
            2. 计算技术指标（MA/EMA/ADX/BBW/ATR/VWAP等）
            3. analyze4HTrend() - 高时间框架
            4. analyze1HFactors() - 中时间框架
            5. analyze15mExecution() - 低时间框架
            6. combineSignals() - 信号融合
          
          - ictStrategy.execute() [🔥 ICT策略完整实时计算]
            ↓
            1. 从Binance获取K线（1D/4H/15M）
            2. analyzeDailyTrend() - 高时间框架
            3. detectOrderBlocks() - 中时间框架
            4. detect15MSweep() + 形态检测 - 低时间框架
            5. combineSignals() - 信号融合
       
       → 返回最新策略判断
```

#### 更新的列
- **列2 - 当前价格**: Binance API实时获取
- **列4 - 趋势**: 4H/1D K线实时计算（EMA、ADX等）
- **列5 - 信号**: 综合评分实时判断（BUY/SELL/WATCH/HOLD）
- **列6 - 高时间框架**: 4H趋势（V3）或日线趋势（ICT）
- **列7 - 中时间框架**: 1H因子（V3）或订单块/扫荡（ICT）
- **列8 - 低时间框架**: 15M入场信号、形态检测

**特点**: 
- ✅ 完全实时，每次都重新计算
- ✅ 反映最新市场状态
- ✅ 每个交易对独立计算
- ✅ 不依赖数据库缓存

**耗时**: 每个交易对约500-1000ms（11个交易对总计约5-10秒）

---

#### 🔍 为什么策略判断不保存到数据库？

**原因**:
1. **策略判断是瞬时的** - 每5分钟就会重新计算，历史判断没有意义
2. **只有交易才重要** - 关键是实际触发的交易，而不是策略信号
3. **避免数据冗余** - 每5分钟×11个交易对×2个策略 = 每天约6300条记录（无用）
4. **性能优化** - 减少数据库写入压力

**实际保存的数据**:
- ❌ **策略判断**: 不保存（实时计算，用完即弃）
- ✅ **交易记录**: 保存到 `simulation_trades` 表（只在BUY/SELL信号触发时）
- ✅ **AI分析**: 保存到 `ai_market_analysis` 表（每小时一次）

**数据流**:
```
策略实时计算 → 生成信号 → 如果是BUY/SELL → 创建交易 → 保存到数据库
                        ↓
                    如果是HOLD → 不保存任何数据
```

---

### 3. AI分析列（第9列）- 每1小时更新

#### 数据流程
```
每小时整点 → AI调度器
            → AI分析所有交易对
            → 保存到ai_market_analysis表
            → 前端读取最新记录
```

#### Cron配置
```
Cron: 0 * * * *
含义: 每小时的第0分钟执行（如21:00, 22:00, 23:00...）
```

#### 前端缓存机制
```javascript
// 前端缓存1小时
if (距离上次加载 >= 1小时) {
  重新加载AI数据
} else {
  使用缓存数据
}
```

**特点**:
- ⏰ 1小时更新一次（后端定时任务）
- 💾 前端使用缓存（减少API调用）
- 🎯 AI分析较慢（调用OpenAI/Grok），不适合高频更新

**包含数据**:
- 评分和信号徽章
- 短期趋势（方向、置信度、价格区间）
- 中期趋势（方向、置信度、价格区间）

---

### 4. 交易参数列（10-14列）- 交易触发时更新

#### 数据流程
```
策略判断信号为BUY/SELL
→ strategy-worker触发交易
→ 保存到simulation_trades表（status=OPEN）
→ 前端查询交易记录
→ 显示交易参数
```

#### 查询逻辑
```javascript
// 查询OPEN状态的交易记录
const tradesMap = {};
tradesData.forEach(trade => {
  const key = `${trade.symbol}_${trade.strategy_name}`;
  if (trade.status === 'OPEN') {
    tradesMap[key] = trade;
  }
});

// 显示逻辑
if (tradesMap[`${symbol}_V3`]) {
  显示交易参数
} else {
  显示"--"
}
```

**特点**:
- 🎯 只有真实触发交易后才有值
- 📊 显示的是已保存到数据库的交易
- ⏱️ 更新频率取决于交易触发频率（不定期）

**包含字段**:
- 入场价格（entry_price）
- 止损价格（stop_loss）
- 止盈价格（take_profit）
- 杠杆（leverage）
- 保证金（margin_used）

---

## 📈 更新频率对比

| 数据类型 | 前端更新频率 | 后端计算频率 | 数据来源 | 是否存储 |
|---------|-------------|-------------|---------|---------|
| **当前价格** | **5分钟** | **5分钟** | Binance API | ❌ 不存储 |
| **策略判断** | **5分钟** | **5分钟** | 实时计算 | ❌ 不存储 |
| **AI分析** | **1小时** | **1小时** | AI定时任务 | ✅ 存储 |
| **交易参数** | **5分钟** | **触发时** | 数据库记录 | ✅ 存储（仅交易）|

---

## 🎯 为什么统一为5分钟刷新？

### 前后端统一5分钟刷新的原因

**设计原则**:
- ✅ **前后端一致性** - 前端展示与后端决策完全同步
- ✅ **避免误导** - 用户看到的信号就是实际交易决策的信号
- ✅ **性能优化** - 减少不必要的API调用和计算
- ✅ **符合策略特点** - 15M级别策略不需要秒级更新

**为什么不需要更高频？**
1. **策略基于15M K线** - 15分钟级别的策略，5分钟刷新已经足够
2. **避免过度交易** - 更高频率可能导致频繁信号变化，增加交易成本
3. **API稳定性** - 减少对Binance API的调用压力
4. **用户体验** - 5分钟刷新既保证实时性，又不会过于频繁

**优势**:
- ✅ 前端数据与后端决策完全一致
- ✅ 减少服务器负载（API调用、计算资源）
- ✅ 避免数据不一致的混淆
- ✅ 更稳定的交易信号

### 1小时刷新（AI分析）
**原因**:
- AI分析慢（20-30秒/交易对）
- AI API有速率限制
- AI分析成本高（Token消耗）
- 趋势判断不需要高频更新

**优势**:
- ✅ 减少API调用成本
- ✅ 避免速率限制
- ✅ 符合AI分析的长周期特性

### 触发时更新（交易参数）
**原因**:
- 只有真正触发交易才有参数
- 数据来自数据库历史记录
- 不是实时计算，而是已保存的交易

**优势**:
- ✅ 只显示真实交易
- ✅ 避免误导（策略信号≠实际交易）
- ✅ 数据准确可靠

---

## 🔍 各列数据来源详解

### 实时计算列（1-8列）

**API调用**:
```javascript
GET /api/v1/strategies/current-status
  → 对每个交易对:
    - Binance.getTicker24hr(symbol)  // 当前价格
    - v3Strategy.execute(symbol)     // V3策略判断
    - ictStrategy.execute(symbol)    // ICT策略判断
```

**计算内容**:
- 获取多个时间框架K线（4H, 1H, 15M）
- 计算技术指标（EMA, ADX, BBW, ATR, VWAP等）
- 评分和信号判断
- 生成入场参数（但不保存）

**耗时**: 每个交易对约500-1000ms

---

### 数据库查询列（9-14列）

**AI分析列（第9列）**:
```sql
SELECT ai.analysis_data
FROM symbols s
LEFT JOIN (
  SELECT symbol, analysis_data
  FROM ai_market_analysis
  WHERE analysis_type = 'SYMBOL_TREND'
  ORDER BY created_at DESC
  LIMIT 1 PER symbol
) ai ON s.symbol = ai.symbol
```

**交易参数列（10-14列）**:
```sql
SELECT *
FROM simulation_trades
WHERE symbol = ? 
  AND strategy_name = ?
  AND status = 'OPEN'
ORDER BY created_at DESC
LIMIT 1
```

---

## ⏰ 完整刷新时间线

```
00:00 → 前端刷新 + 后端决策 + AI分析（三者同时）
00:05 → 前端刷新 + 后端决策
00:10 → 前端刷新 + 后端决策
00:15 → 前端刷新 + 后端决策
...
01:00 → 前端刷新 + 后端决策 + AI分析（三者同时）
01:05 → 前端刷新 + 后端决策
...

交易参数: 当strategy-worker检测到BUY/SELL信号并保存交易时更新（不定期）

说明：
- 前端刷新（5分钟）：用户看到的数据更新
- 后端决策（5分钟）：strategy-worker执行策略并检查交易信号
- AI分析（1小时）：AI定时分析并保存结果
- 前后端完全同步，用户看到的就是系统决策的依据
```

---

## 🔄 后台交易决策 vs 前端展示

### strategy-worker（5分钟）

除了前端30秒刷新外，还有一个**独立的后台交易决策进程**：

```javascript
// src/workers/strategy-worker.js
setInterval(async () => {
  for (const symbol of symbols) {
    // 1. 检查现有交易的止盈止损
    await this.checkExistingTrades(symbol);
    
    // 2. 🔥 实时执行V3策略分析
    const v3Result = await this.v3Strategy.execute(symbol);
    
    // 3. 🔥 实时执行ICT策略分析
    const ictResult = await this.ictStrategy.execute(symbol);
    
    // 4. 根据信号创建交易
    await this.handleStrategySignals(symbol, v3Result, ictResult);
  }
}, 5 * 60 * 1000);  // 5分钟
```

**特点**:
- ⏰ 每5分钟执行一次
- 🎯 用于实际交易决策（开仓/平仓）
- 🔄 与前端展示完全独立
- 📊 使用相同的计算逻辑（execute方法）

**为什么是5分钟**:
- 避免过度交易
- 降低服务器负载
- 交易信号更稳定
- 符合15M级别策略特点

---

## 📋 总结

### 更新频率总览

| 数据类型 | 前端展示 | 交易决策 | 数据来源 | 是否存储 |
|---------|---------|---------|---------|---------|
| 交易对-信号 | **5分钟** | **5分钟** | 实时计算 | ❌ 不存储 |
| **AI分析** | **1小时** | **1小时** | 数据库缓存 | ✅ 存储 |
| 入场价格-保证金 | **5分钟查询** | **触发时保存** | 数据库记录 | ✅ 存储（仅交易）|

### 设计原则

1. **前后端统一**: 市场数据和策略判断（前端5分钟 = 后台5分钟）
2. **中频更新**: AI趋势分析（1小时）
3. **事件驱动**: 交易参数（触发时保存）
4. **实时计算**: 策略判断不依赖缓存，不存储数据库

### 关键特点

✅ **前后端完全同步** - 用户看到的就是系统决策的依据  
✅ **策略判断不存储** - 实时计算，用完即弃，减少数据冗余  
✅ **只存储重要数据** - 仅保存交易记录和AI分析结果  
✅ **性能与准确的平衡** - 5分钟刷新既保证实时性又减少资源消耗

**这种设计确保了数据一致性、系统性能和用户体验的最佳平衡！** 🎯

---

## 📚 相关文档

- 详细后端计算逻辑: `BACKEND_CALCULATION_FREQUENCY.md`
- 策略实现文档: `docs/strategy-comparison.md`
- ICT策略文档: `docs/ict.md` / `docs/ict-plus.md`

