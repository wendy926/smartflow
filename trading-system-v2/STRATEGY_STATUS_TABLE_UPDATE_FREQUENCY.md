# 策略当前状态表格 - 数据更新频率说明

**文档时间**: 2025-10-10  
**表格位置**: Dashboard > 策略当前状态

---

## 📊 表格列详细说明

### 表格结构（14列）

| 列序号 | 列名 | 数据来源 | 更新频率 | 说明 |
|--------|------|---------|---------|------|
| 1 | **交易对** | symbols表 | 固定 | 交易对符号（如BTCUSDT） |
| 2 | **当前价格** | Binance API实时 | **每30秒** | `getTicker24hr()` |
| 3 | **策略** | 固定 | 固定 | V3或ICT标识 |
| 4 | **趋势** | 策略实时计算 | **每30秒** | `v3Strategy.execute()` |
| 5 | **信号** | 策略实时计算 | **每30秒** | BUY/SELL/WATCH/HOLD |
| 6 | **高时间框架** | 策略实时计算 | **每30秒** | 4H趋势判断 |
| 7 | **中时间框架** | 策略实时计算 | **每30秒** | 1H因子分析 |
| 8 | **低时间框架** | 策略实时计算 | **每30秒** | 15M入场判断 |
| 9 | **AI分析** ⭐ | ai_market_analysis表 | **1小时** | AI趋势分析 |
| 10 | **入场价格** | simulation_trades表 | 交易触发时 | 只有触发交易后才有值 |
| 11 | **止损价格** | simulation_trades表 | 交易触发时 | 只有触发交易后才有值 |
| 12 | **止盈价格** | simulation_trades表 | 交易触发时 | 只有触发交易后才有值 |
| 13 | **杠杆** | simulation_trades表 | 交易触发时 | 只有触发交易后才有值 |
| 14 | **保证金** | simulation_trades表 | 交易触发时 | 只有触发交易后才有值 |

---

## 🔄 更新机制详解

### 1. Dashboard整体刷新（30秒）

**触发方式**:
```javascript
setInterval(() => {
  if (this.currentTab === 'dashboard') {
    this.loadDashboardData();  // 加载仪表板数据
  }
}, 30000);  // 30秒
```

**包含的数据**:
- ✅ 宏观监控数据（资金流、市场情绪等）
- ✅ 策略当前状态表格
  - 当前价格（Binance实时）
  - 策略判断（**实时计算，非缓存**）
  - 交易记录（数据库查询）

**⚠️ 重要**: 策略判断数据（趋势、信号、时间框架）每次都是完整重新计算的，不是从数据库读取的历史数据！

---

### 2. 策略状态列（1-8列）- 每30秒实时计算

#### 数据流程
```
每30秒 → loadDashboardData()
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

#### 🔍 为什么不使用数据库缓存？

**原因**:
1. 市场实时变化，缓存数据会过时
2. K线数据每分钟都在更新
3. 技术指标计算速度快（毫秒级）
4. 策略判断需要最新数据才准确

**对比**:
- ❌ **策略判断**: 不缓存，实时计算
- ✅ **AI分析**: 缓存1小时（AI调用慢且贵）
- ✅ **交易参数**: 缓存5分钟（避免重复计算）

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

| 数据类型 | 更新频率 | 数据来源 | 实时性 |
|---------|---------|---------|--------|
| **当前价格** | **30秒** | Binance API | 🟢 高 |
| **策略判断** | **30秒** | 实时计算 | 🟢 高 |
| **AI分析** | **1小时** | 定时任务 | 🟡 中 |
| **交易参数** | **触发时** | 数据库记录 | 🔴 低（不定期）|

---

## 🎯 为什么不同频率？

### 30秒刷新（策略判断）
**原因**:
- 市场变化快，需要及时反映
- 技术指标计算快（毫秒级）
- Binance API稳定，支持高频请求
- **每次都是完整实时计算，确保数据准确**

**优势**:
- ✅ 策略信号及时更新
- ✅ 不错过入场机会
- ✅ 用户体验好
- ✅ 数据永远是最新的

**注意**: 
- 前端展示是30秒刷新
- **后台交易决策是5分钟刷新**（strategy-worker）
- 两者完全独立，但计算逻辑相同

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
00:00 → Dashboard刷新（策略判断 + 价格）+ AI定时分析
00:30 → Dashboard刷新（策略判断 + 价格）
01:00 → Dashboard刷新（策略判断 + 价格）+ AI定时分析
01:30 → Dashboard刷新（策略判断 + 价格）
...
23:00 → Dashboard刷新（策略判断 + 价格）+ AI定时分析
23:30 → Dashboard刷新（策略判断 + 价格）

交易参数: 当strategy-worker检测到BUY/SELL信号并保存交易时更新（不定期）
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

| 数据类型 | 前端展示 | 交易决策 | 数据来源 | 说明 |
|---------|---------|---------|---------|------|
| 交易对-信号 | **30秒** | **5分钟** | 实时计算 | 每次完整重新计算 |
| **AI分析** | **1小时** | **1小时** | 数据库缓存 | AI定时任务保存 |
| 入场价格-保证金 | **触发时** | **触发时** | 数据库记录 | 交易发生后才有值 |

### 设计原则

1. **高频更新**: 市场数据和策略判断（前端30秒 / 后台5分钟）
2. **中频更新**: AI趋势分析（1小时）
3. **事件驱动**: 交易参数（触发时）
4. **实时计算**: 策略判断不依赖缓存，确保数据准确

**关键发现**: 前端看到的所有策略数据（趋势、信号、时间框架）都是实时计算的，不是从数据库读取的历史记录！

**这种设计平衡了实时性、性能和成本！** 🎯

---

## 📚 相关文档

- 详细后端计算逻辑: `BACKEND_CALCULATION_FREQUENCY.md`
- 策略实现文档: `docs/strategy-comparison.md`
- ICT策略文档: `docs/ict.md` / `docs/ict-plus.md`

