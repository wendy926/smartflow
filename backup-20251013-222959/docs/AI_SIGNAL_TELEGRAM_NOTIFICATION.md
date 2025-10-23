# AI信号Telegram通知功能完整说明

**更新时间**: 2025-10-10  
**功能状态**: ✅ 已实现并部署

---

## 📋 功能概述

当AI分析出现特定信号时，自动通过Telegram bot发送通知，帮助用户及时捕捉市场机会和规避风险。

### 触发条件

AI分析评分出现以下信号时自动发送通知：
1. **strongBuy** (强烈看多) - 评分 78-100分
2. **strongSell** (强烈看跌) - 评分 0-37分
3. **caution** (兼容旧数据) - 等同于strongSell

---

## 🤖 Telegram Bot配置

### Bot信息

**Bot名称**: smartflow-excute（与交易触发通知共用）

**配置来源**:
- 环境变量: `TELEGRAM_TRADING_BOT_TOKEN` 和 `TELEGRAM_TRADING_CHAT_ID`
- 或从数据库telegram_configs表读取

**配置文件**: 
```bash
# 交易触发和AI信号通知共用配置
TELEGRAM_TRADING_BOT_TOKEN=your_bot_token
TELEGRAM_TRADING_CHAT_ID=your_chat_id
```

---

## 📬 通知消息格式

### strongBuy（强烈看多）示例

```
🟢 AI市场分析提醒
━━━━━━━━━━━━━
📊 交易对: BTCUSDT
🎯 信号: 强烈看多
📈 评分: 85分
💰 价格: $121,420.5

📊 短期: 上涨 (78%)
   区间: $120,000.00 - $123,000.00
📊 中期: 上涨 (82%)
   区间: $119,000.00 - $128,000.00

⏰ 时间: 2025-10-10 15:00:00

💡 建议: 多因子共振，可考虑做多入场（仓位20-30%）
```

### strongSell（强烈看跌）示例

```
🔴 AI市场分析提醒
━━━━━━━━━━━━━
📊 交易对: ETHUSDT
🎯 信号: 强烈看跌
📈 评分: 32分
💰 价格: $4,280.5

📊 短期: 下跌 (68%)
   区间: $4,150.00 - $4,250.00
📊 中期: 下跌 (72%)
   区间: $4,000.00 - $4,300.00

⏰ 时间: 2025-10-10 15:00:00

⚠️ 警告: 强烈看跌信号，可考虑做空入场或避免做多
```

---

## ⚙️ 技术实现

### 1. 调度器逻辑

**文件**: `src/services/ai-agent/scheduler.js`

**核心代码**:
```javascript
async checkAndSendSignalAlerts(analysisResults) {
  const targetSignals = ['strongBuy', 'strongSell', 'caution'];
  
  for (const result of analysisResults) {
    const signal = result.analysisData.overallScore.signalRecommendation;
    
    // 检查是否需要通知的信号
    if (!targetSignals.includes(signal)) {
      continue;
    }
    
    // 检查冷却期（1小时）
    const cooldownKey = `${symbol}_${signal}`;
    const lastAlertTime = this.signalAlertCooldowns.get(cooldownKey);
    
    if (lastAlertTime && (now - lastAlertTime) < 3600000) {
      continue;  // 跳过，在冷却期内
    }
    
    // 发送Telegram通知
    await this.telegram.sendAISignalAlert({
      symbol,
      signalRecommendation: signal,
      overallScore,
      currentPrice,
      shortTermTrend,
      midTermTrend,
      timestamp
    });
    
    // 更新冷却期
    this.signalAlertCooldowns.set(cooldownKey, now);
  }
}
```

### 2. Telegram服务

**文件**: `src/services/telegram-monitoring.js`

**方法**: `sendAISignalAlert(aiSignalData)`

**使用Bot**: 交易触发bot（tradingBotToken和tradingChatId）

**消息格式**: HTML格式，支持粗体和emoji

---

## 🔄 工作流程

```
AI分析调度器（每小时整点）
  ↓
分析11个交易对
  ↓
for each 交易对:
  ├─ 获取AI分析结果
  ├─ 检查信号类型
  ├─ 如果是 strongBuy/strongSell/caution
  │  ├─ 检查冷却期（1小时）
  │  ├─ 格式化消息
  │  ├─ 调用Telegram API
  │  └─ 记录冷却时间
  └─ 继续下一个交易对
  ↓
日志记录统计（已发送、已跳过）
```

---

## 🎯 通知策略

### 触发信号

| 信号类型 | 评分范围 | 触发通知 | 含义 |
|---------|---------|---------|------|
| strongBuy | 78-100 | ✅ 是 | 强烈看多，可积极做多 |
| mediumBuy | 68-77 | ❌ 否 | 中等看多 |
| holdBullish | 58-67 | ❌ 否 | 持有偏多 |
| hold | 48-57 | ❌ 否 | 持有观望 |
| holdBearish | 38-47 | ❌ 否 | 持有偏空 |
| strongSell | 0-37 | ✅ 是 | 强烈看跌，可考虑做空 |

**设计理由**: 只通知极端信号，避免信息过载

### 冷却期机制

**冷却时间**: 1小时（3600000ms）

**冷却Key**: `${symbol}_${signal}`

**示例**:
- BTCUSDT_strongBuy 发送通知后
- 1小时内再次出现 BTCUSDT_strongBuy
- → 跳过发送，避免重复打扰

**独立冷却**:
- BTCUSDT_strongBuy 和 BTCUSDT_strongSell 冷却期独立
- BTCUSDT_strongBuy 和 ETHUSDT_strongBuy 冷却期独立

---

## 📊 信号评分逻辑

### strongBuy（强烈看多）

**触发条件**:
- 总分 ≥ 78分
- 计算公式: `总分 = (短期置信度 + 中期置信度) / 2`
- 趋势倾向: 看多（up次数 > down次数）

**典型特征**:
- 短期趋势: up (70%+)
- 中期趋势: up (75%+)
- 总分: 78+

**操作建议**: 可考虑做多入场，仓位20-30%

### strongSell（强烈看跌）

**触发条件**:
- 总分 ≤ 37分
- 计算公式: 当趋势倾向为看跌时，`总分 = 100 - 基础分数`
- 趋势倾向: 看跌（down次数 > up次数）

**典型特征**:
- 短期趋势: down (65%+)
- 中期趋势: down (70%+)
- 反转后总分: 0-37

**操作建议**: 强烈看跌信号，可考虑做空入场或避免做多

---

## 🔍 验证方法

### 方法1: 查看VPS日志

```bash
# SSH登录VPS
ssh -i ~/.ssh/smartflow_vps_new root@47.237.163.85

# 查看AI分析日志
pm2 logs main-app | grep "AI信号通知"

# 预期输出示例:
# [AI信号通知] 触发通知 - BTCUSDT strongBuy
# [AI信号通知] ✅ BTCUSDT strongBuy 通知已发送
# [AI信号通知] ETHUSDT strongSell 在冷却期内，剩余45分钟
```

### 方法2: 查看数据库

```sql
-- 查看最新AI分析信号
SELECT 
  symbol,
  JSON_EXTRACT(analysis_data, '$.overallScore.signalRecommendation') as signal,
  JSON_EXTRACT(analysis_data, '$.overallScore.totalScore') as score,
  created_at
FROM ai_market_analysis
WHERE analysis_type = 'SYMBOL_TREND'
ORDER BY created_at DESC
LIMIT 20;
```

### 方法3: Telegram测试

**触发strongBuy通知**:
1. 等待AI分析（每小时整点）
2. 查看Dashboard AI分析列
3. 找到评分≥78的交易对
4. 检查Telegram是否收到通知

**触发strongSell通知**:
1. 等待AI分析（每小时整点）
2. 查看Dashboard AI分析列
3. 找到评分≤37的交易对
4. 检查Telegram是否收到通知

---

## 🛠️ 故障排查

### 问题1: 没有收到通知

**检查清单**:
- [ ] Telegram bot配置是否正确（token和chatId）
- [ ] 是否在1小时冷却期内
- [ ] AI分析是否正常执行（查看日志）
- [ ] 信号是否达到通知阈值（strongBuy或strongSell）
- [ ] Telegram服务是否启用（tradingEnabled=true）

**日志检查**:
```bash
pm2 logs main-app --lines 100 | grep -i "AI信号通知\|sendAISignalAlert"
```

### 问题2: 收到重复通知

**原因**: 冷却期机制失效

**检查**:
- 查看signalAlertCooldowns是否正常工作
- 检查是否重启了服务（重启会清空内存冷却记录）

**解决**: 系统正常运行时，冷却期会自动生效

### 问题3: 通知内容不正确

**检查**:
- AI分析数据是否完整
- shortTermTrend和midTermTrend是否存在
- priceRange是否正确

**修复**: 查看AI提示词（docs/prompt-analyst.md）确保输出格式正确

---

## 📊 统计信息

### 预期通知频率

**假设场景**: 11个交易对，每小时分析一次

**极端情况**:
- 所有交易对都触发strongBuy/strongSell
- 理论最大: 22次/小时（11个交易对 × 2种信号）

**正常情况**:
- 通常1-3个交易对会触发
- 实际频率: 1-6次/小时

**冷却后**:
- 同一交易对的同一信号，1小时内只通知1次
- 实际频率会更低

---

## 🎯 使用场景

### 场景1: 做多机会提醒

**触发**: AI分析strongBuy信号

**用户收到通知**:
```
🟢 AI市场分析提醒
━━━━━━━━━━━━━
📊 交易对: BTCUSDT
🎯 信号: 强烈看多
📈 评分: 85分
...
💡 建议: 多因子共振，可考虑做多入场（仓位20-30%）
```

**用户行动**:
1. 打开Dashboard确认
2. 查看策略信号是否也是BUY
3. 查看三个时间框架判断
4. 使用计算器计算杠杆和保证金
5. 决定是否入场

---

### 场景2: 做空机会或风险提醒

**触发**: AI分析strongSell信号

**用户收到通知**:
```
🔴 AI市场分析提醒
━━━━━━━━━━━━━
📊 交易对: ETHUSDT
🎯 信号: 强烈看跌
📈 评分: 32分
...
⚠️ 警告: 强烈看跌信号，可考虑做空入场或避免做多
```

**用户行动**:
1. 检查是否有该交易对的多头仓位
2. 考虑止盈或减仓
3. 评估做空机会
4. 查看Dashboard确认

---

## 🔄 完整工作流程

### 1. AI分析执行（每小时整点）

```
15:00:00 - AI分析调度器触发
  ↓
15:00:05 - 开始分析第1个交易对 BTCUSDT
15:00:12 - BTCUSDT分析完成，信号: strongBuy，评分: 85
  ↓
15:00:12 - 检查通知条件
  ├─ ✅ 信号在目标列表中（strongBuy）
  ├─ ✅ 不在冷却期内
  └─ ✅ Telegram已启用
  ↓
15:00:13 - 发送Telegram通知
  ├─ 格式化消息
  ├─ 调用Telegram API
  └─ 记录冷却时间
  ↓
15:00:14 - 用户收到通知
```

### 2. 冷却期管理

```
15:00:13 - BTCUSDT_strongBuy通知发送
  ↓
15:30:00 - 下次分析
  ├─ BTCUSDT仍然是strongBuy（评分84）
  ├─ 检查冷却期: 距上次13分钟 < 60分钟
  └─ ⏭️ 跳过发送（避免重复）
  ↓
16:00:00 - 再下次分析
  ├─ BTCUSDT信号变为mediumBuy（评分72）
  └─ ⏭️ 不发送（不在通知列表中）
  ↓
16:30:00 - 再下次分析
  ├─ BTCUSDT信号又变回strongBuy（评分80）
  ├─ 检查冷却期: 距上次90分钟 > 60分钟
  └─ ✅ 发送通知（冷却期已过）
```

---

## 📋 代码实现细节

### 文件结构

```
src/
├─ services/
│  ├─ ai-agent/
│  │  └─ scheduler.js           # AI调度器，包含通知逻辑
│  │
│  └─ telegram-monitoring.js    # Telegram服务
│
└─ database/
   └─ telegram-config-ops.js    # Telegram配置管理
```

### 关键方法

**调度器方法**:
- `checkAndSendSignalAlerts(analysisResults)` - 检查并发送通知
- 冷却期管理: `signalAlertCooldowns Map`
- 冷却时间: `signalAlertCooldownMs = 3600000` (1小时)

**Telegram方法**:
- `sendAISignalAlert(aiSignalData)` - 发送AI信号通知
- `formatAISignalMessage(aiSignalData)` - 格式化消息
- `sendMessage(message, 'trading')` - 使用交易bot发送

---

## ✅ 验证清单

### 后端验证

- [x] AI分析调度器正常运行
- [x] checkAndSendSignalAlerts方法正确调用
- [x] targetSignals包含strongBuy、strongSell、caution
- [x] 冷却期机制正常工作
- [x] Telegram服务正确初始化

### Telegram服务验证

- [x] tradingBotToken配置正确
- [x] tradingChatId配置正确
- [x] sendAISignalAlert方法正常
- [x] formatAISignalMessage支持strongSell
- [x] 消息格式优化（分隔线、中文趋势）

### 功能验证

- [x] strongBuy通知正确发送
- [x] strongSell通知正确发送
- [x] caution兼容strongSell
- [x] 冷却期正确工作
- [x] 消息内容准确
- [x] emoji和格式美观

---

## 📖 相关配置

### 环境变量

```bash
# .env文件
TELEGRAM_TRADING_BOT_TOKEN=your_bot_token_here
TELEGRAM_TRADING_CHAT_ID=your_chat_id_here
```

### 数据库配置

```sql
-- telegram_configs表
INSERT INTO telegram_configs (config_key, config_value, config_type) VALUES
('trading_bot_token', 'your_bot_token', 'telegram'),
('trading_chat_id', 'your_chat_id', 'telegram');
```

### AI配置

```sql
-- ai_config表
INSERT INTO ai_config (config_key, config_value) VALUES
('ai_analysis_enabled', 'true'),
('symbol_update_interval', '3600');  -- 每小时
```

---

## 🎯 最佳实践

### 1. 合理设置通知

**建议**:
- 保持1小时冷却期（避免信息过载）
- 只通知极端信号（strongBuy/strongSell）
- 中等信号通过Dashboard主动查看

### 2. 结合策略判断

**流程**:
1. 收到AI信号通知
2. 打开Dashboard查看策略信号
3. 如果AI+策略双重确认 → 高置信度
4. 如果AI和策略不一致 → 谨慎对待

### 3. 监控通知质量

**定期检查**:
- 通知是否及时
- 信号是否准确
- 是否有重复通知

**优化方向**:
- 调整评分阈值
- 优化AI提示词
- 调整冷却期时长

---

## 🎉 功能总结

### 实现状态

✅ **已完整实现**:
- AI分析调度器集成通知逻辑
- 支持strongBuy和strongSell两种信号
- 使用交易触发bot发送（smartflow-excute）
- 1小时冷却期避免重复
- 美化的消息格式
- 详细的趋势和价格区间信息
- 中文本地化显示

### 核心价值

1. **及时性** - 每小时检查，重要信号立即通知
2. **准确性** - AI评分+趋势分析双重确认
3. **可操作性** - 提供明确的操作建议和价格区间
4. **用户友好** - 清晰的消息格式，emoji视觉标识
5. **智能冷却** - 避免信息过载和重复打扰

### 技术亮点

1. **内存冷却期** - Map数据结构高效管理
2. **信号兼容** - 同时支持strongSell和caution（旧版）
3. **Bot复用** - 与交易触发通知共用bot配置
4. **错误处理** - 完善的异常捕获和日志记录
5. **HTML格式** - 支持粗体、emoji、分隔线美化

**功能已完整实现并部署上线！** 🎯✨

