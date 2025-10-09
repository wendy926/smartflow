# 🔔 AI信号Telegram自动通知功能

**功能上线**: 2025-10-09 16:15  
**状态**: ✅ **已部署**  

---

## 📋 功能说明

当AI分析检测到**强烈看多**或**谨慎**信号时，自动发送Telegram通知到交易触发通知机器人。

### 触发条件

| 信号类型 | 评分 | 触发条件 | 图标 |
|---------|------|---------|------|
| **强烈看多** | 75-100分 | strongBuy | 🟢 |
| **谨慎** | 0-39分 | caution | 🔴 |

**不通知的信号**:
- 看多 (mediumBuy, 60-74分)
- 持有偏多 (holdBullish, 55-59分)
- 持有观望 (hold, 45-54分)
- 持有偏空 (holdBearish, 40-44分)

---

## 💬 通知消息格式

### 示例1: 强烈看多通知

```
🟢 AI信号通知

📊 交易对: BTCUSDT
🎯 信号: 强烈看多
📈 评分: 78/100
💰 当前价格: $62,450.00

📊 短期趋势: ↗️ 置信度 80%
   区间: $62,000.00 - $64,000.00
📊 中期趋势: ↗️ 置信度 76%
   区间: $60,000.00 - $66,000.00

⏰ 时间: 2025-10-09 16:15:30

💡 建议: 多因子共振，可考虑积极入场（仓位20-30%）
```

### 示例2: 谨慎通知

```
🔴 AI信号通知

📊 交易对: ETHUSDT
🎯 信号: 谨慎
📈 评分: 35/100
💰 当前价格: $3,250.00

📊 短期趋势: ↘️ 置信度 70%
   区间: $3,100.00 - $3,300.00
📊 中期趋势: ↘️ 置信度 65%
   区间: $2,900.00 - $3,400.00

⏰ 时间: 2025-10-09 16:15:30

⚠️ 警告: 趋势转弱，建议避免入场或减仓
```

---

## 🔧 技术实现

### 1. Telegram通知服务

**文件**: `src/services/telegram-monitoring.js`

**新增方法**:

#### sendAISignalAlert(aiSignalData)
```javascript
/**
 * 发送AI信号通知
 * @param {Object} aiSignalData - AI信号数据
 * @param {string} aiSignalData.symbol - 交易对
 * @param {string} aiSignalData.signalRecommendation - 信号类型
 * @param {Object} aiSignalData.overallScore - 评分信息
 * @param {number} aiSignalData.currentPrice - 当前价格
 * @param {Object} aiSignalData.shortTermTrend - 短期趋势
 * @param {Object} aiSignalData.midTermTrend - 中期趋势
 * @param {string} aiSignalData.timestamp - 时间戳
 * @returns {Promise<boolean>}
 */
```

#### formatAISignalMessage(aiSignalData)
```javascript
/**
 * 格式化AI信号消息
 * - 根据信号类型显示不同的emoji和文本
 * - 包含短期和中期趋势及价格区间
 * - 添加操作建议
 */
```

**特点**:
- 使用HTML格式（parse_mode: 'HTML'）
- 支持价格区间显示
- 趋势方向使用emoji（↗️↘️↔️）
- 时间转为北京时间（Asia/Shanghai）

---

### 2. AI调度器增强

**文件**: `src/services/ai-agent/scheduler.js`

**新增属性**:
```javascript
// AI信号通知冷却期
this.signalAlertCooldowns = new Map();
this.signalAlertCooldownMs = 60 * 60 * 1000; // 1小时
```

**新增方法**:

#### checkAndSendSignalAlerts(analysisResults)
```javascript
/**
 * 检查并发送AI信号通知
 * @param {Array} analysisResults - 分析结果数组
 * 
 * 功能:
 * 1. 遍历所有分析结果
 * 2. 检查signalRecommendation是否为strongBuy或caution
 * 3. 检查冷却期（每个交易对+信号类型1小时）
 * 4. 发送Telegram通知
 * 5. 更新冷却期
 * 6. 记录统计信息
 */
```

**集成点**:
```javascript
async runSymbolAnalysis() {
  // ... 执行分析 ...
  const results = await this.symbolAnalyzer.analyzeSymbols(...);
  
  // 检查是否有需要通知的信号
  await this.checkAndSendSignalAlerts(results);
}
```

---

### 3. 防重复机制

**冷却期设计**:
- **Key**: `${symbol}_${signal}` (例如: `BTCUSDT_strongBuy`)
- **时长**: 1小时
- **作用**: 避免同一交易对的同一信号在1小时内重复通知

**示例**:
```
BTCUSDT strongBuy → 通知 ✅
（30分钟后）BTCUSDT strongBuy → 跳过（冷却期）
（1.5小时后）BTCUSDT strongBuy → 通知 ✅

BTCUSDT strongBuy → 通知 ✅
（30分钟后）BTCUSDT caution → 通知 ✅（不同信号）
```

**日志输出**:
```
[AI信号通知] BTCUSDT strongBuy 在冷却期内，剩余30分钟
[AI信号通知] 通知统计 - 已发送: 2, 跳过(冷却期): 3
```

---

## 📊 触发流程

```
AI分析调度器（每1小时）
  ↓
执行10个交易对分析
  ↓
获取分析结果数组
  ↓
checkAndSendSignalAlerts()
  ↓
遍历每个结果
  ↓
检查signalRecommendation
  ├─ strongBuy? → 检查冷却期 → 发送通知 ✅
  ├─ caution? → 检查冷却期 → 发送通知 ✅
  └─ 其他 → 跳过
  ↓
更新冷却期Map
  ↓
记录统计日志
```

---

## ⚙️ 配置说明

### Telegram机器人配置

**复用交易触发通知的配置**:
- Bot Token: 与交易触发通知相同
- Chat ID: 与交易触发通知相同
- 启用状态: 与交易触发通知相同

**配置位置**:
- 数据库: `telegram_config` 表，`config_type='trading'`
- 前端: `https://smart.aimaventop.com/tools` → Telegram监控设置

**如何启用**:
1. 访问 `/tools` 页面
2. 找到"交易触发通知"配置
3. 确保"启用"状态为✅
4. Bot Token和Chat ID已正确配置

---

## 📈 通知频率

### 理论最大频率

**每小时**:
- 10个交易对分析
- 每个交易对最多2种信号（strongBuy + caution）
- 理论最大：10 × 2 = 20条通知/小时

**实际频率**（预估）:
- 通常情况：0-3条通知/小时
- 市场剧烈波动：3-8条通知/小时
- 极端情况：10+条通知/小时

**冷却机制保护**:
- 每个交易对+信号类型：1小时内最多1条
- 避免频繁通知干扰

---

## 🔍 日志示例

### 正常通知日志

```
[AI信号通知] 触发通知 - BTCUSDT strongBuy
[Telegram AI信号] 收到发送请求 { tradingEnabled: true, symbol: 'BTCUSDT', signal: 'strongBuy' }
[Telegram AI信号] ✅ 消息发送成功 { symbol: 'BTCUSDT', signal: 'strongBuy' }
[AI信号通知] ✅ BTCUSDT strongBuy 通知已发送
[AI信号通知] 通知统计 - 已发送: 1, 跳过(冷却期): 0
```

### 冷却期跳过日志

```
[AI信号通知] BTCUSDT strongBuy 在冷却期内，剩余45分钟
[AI信号通知] 通知统计 - 已发送: 0, 跳过(冷却期): 1
```

### Telegram未启用日志

```
[Telegram AI信号] 交易触发Telegram未启用，跳过发送
```

---

## 🎯 使用场景

### 场景1: 强烈看多信号

**条件**:
- AI评分 ≥ 75分
- 短期和中期置信度都较高
- 多因子共振

**通知内容**:
- 🟢 强烈看多
- 评分和价格
- 短期/中期趋势
- 💡 建议: 可考虑积极入场（仓位20-30%）

**用户操作**:
1. 收到Telegram通知
2. 查看Dashboard确认
3. 结合V3/ICT策略信号
4. 决定是否入场

---

### 场景2: 谨慎信号

**条件**:
- AI评分 < 40分
- 趋势转弱或下跌
- 多个负面因子

**通知内容**:
- 🔴 谨慎
- 评分和价格
- 短期/中期趋势
- ⚠️ 警告: 建议避免入场或减仓

**用户操作**:
1. 收到Telegram通知
2. 查看Dashboard确认
3. 如有持仓考虑减仓
4. 避免新开仓位

---

## 🚀 部署验证

### 1. 代码已部署
```bash
$ git log --oneline -1
feat: AI信号Telegram自动通知功能
```

### 2. VPS已重启
```bash
$ pm2 restart main-app
[PM2] Applying action restartProcessId on app [main-app]
[PM2] [main-app] ✓
```

### 3. 功能已激活
```bash
$ pm2 logs main-app | grep "AI信号"
[AI信号通知] 系统已启动，等待下次分析
```

---

## 📋 测试建议

### 手动触发测试

**方法1: 等待下一次自动分析**
- AI分析每1小时执行一次
- 等待分析完成后查看是否有通知

**方法2: 手动触发分析**（如果有API）
```bash
curl -X POST http://localhost:8080/api/v1/ai/analyze \
  -H "Content-Type: application/json" \
  -d '{"type": "symbol_trend", "symbols": ["BTCUSDT"]}'
```

### 验证步骤

1. **查看日志**:
```bash
pm2 logs main-app | grep "AI信号"
```

2. **检查Telegram群组**:
- 等待通知到达
- 验证消息格式
- 确认内容准确

3. **测试冷却期**:
- 手动触发2次分析（间隔<1小时）
- 第2次应该跳过通知

---

## 🎊 功能上线总结

**新功能**: ✅ AI信号Telegram自动通知  
**触发信号**: strongBuy（强烈看多）、caution（谨慎）  
**通知频率**: 每个交易对+信号类型1小时内最多1次  
**配置方式**: 复用交易触发通知的机器人配置  
**部署状态**: ✅ 已上线VPS  

**用户体验**:
- 重要信号及时通知
- 不会被频繁通知打扰
- 消息格式清晰易读
- 包含操作建议

**监控方式**:
- 日志: `pm2 logs main-app`
- Dashboard: 查看AI分析列
- Telegram: 接收实时通知

