# Telegram通知修复指南

## 🐛 问题根因

### 1. 数据库操作错误
**错误**: `dbOps.executeQuery is not a function`

**原因**: `telegram-config-ops.js`中使用了不存在的`dbOps.executeQuery()`方法

**影响**: 
- Telegram配置无法从数据库加载
- 交易触发时无法发送通知
- 系统监控告警无法发送

### 2. 配置缺失
**问题**: `telegram_config`表为空，没有配置Bot Token和Chat ID

**影响**: `tradingEnabled = false`，导致通知被跳过

---

## ✅ 修复方案

### 1. 修复数据库操作 (已完成)

**修改文件**: `src/database/telegram-config-ops.js`

**修复内容**:
```javascript
// ❌ 错误写法
const result = await dbOps.executeQuery(sql, [params]);

// ✅ 正确写法
const connection = await dbOps.getConnection();
try {
  const [result] = await connection.execute(sql, [params]);
  // ... 业务逻辑
} finally {
  if (connection) connection.release();
}
```

**修复的方法**:
- `saveConfig()` - 保存配置
- `getConfig()` - 获取单个配置
- `getAllConfigs()` - 获取所有配置
- `disableConfig()` - 禁用配置
- `deleteConfig()` - 删除配置

---

### 2. 配置Telegram Bot (用户操作)

#### 步骤1: 创建Telegram Bot

1. 在Telegram中搜索 `@BotFather`
2. 发送命令: `/newbot`
3. 按提示设置机器人名称
4. 获得Bot Token，例如: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`

#### 步骤2: 获取Chat ID

1. 在Telegram中搜索 `@userinfobot`
2. 发送任意消息
3. Bot会返回你的Chat ID，例如: `123456789`

#### 步骤3: 在系统中配置

**方式1: 通过Web界面 (推荐)**

1. 访问: https://smart.aimaventop.com/tools
2. 找到"Telegram监控设置"
3. 配置两个机器人:
   - **交易触发告警**: 配置Bot Token和Chat ID
   - **系统监控告警**: 配置Bot Token和Chat ID (可使用同一个Bot)
4. 点击"测试连接"验证
5. 点击"保存配置"

**方式2: 通过数据库 (备选)**

```sql
-- 插入交易触发配置
INSERT INTO telegram_config (config_type, bot_token, chat_id, enabled)
VALUES ('trading', 'YOUR_BOT_TOKEN', 'YOUR_CHAT_ID', TRUE);

-- 插入系统监控配置
INSERT INTO telegram_config (config_type, bot_token, chat_id, enabled)
VALUES ('monitoring', 'YOUR_BOT_TOKEN', 'YOUR_CHAT_ID', TRUE);
```

---

## 🧪 测试验证

### 1. 测试配置加载

```bash
cd /home/admin/trading-system-v2/trading-system-v2
node test-telegram-config.js
```

**预期输出**:
```
=== 测试Telegram配置功能 ===

1. 查看当前配置:
  - trading: 已启用
    Bot Token: 123456:ABC-DEF1234...
    Chat ID: 123456789
  - monitoring: 已启用
    Bot Token: 123456:ABC-DEF1234...
    Chat ID: 123456789
```

### 2. 测试交易通知

**触发条件**: 当策略检测到BUY/SELL信号时

**预期消息格式**:
```
🚨 交易触发通知

交易对: BTCUSDT
策略: V3
信号: BUY
价格: 63500.00 USDT
杠杆: 10x
保证金: 100 USDT
止损: 62850.00 (-1.0%)
止盈: 64150.00 (+1.0%)
潜在收益: 10.0 USDT

时间: 2025-10-08 15:30:00
```

### 3. 测试系统告警

**触发条件**: CPU或内存超过阈值

**预期消息格式**:
```
⚠️ 系统监控告警

类型: cpu_high
消息: CPU使用率过高: 85.3%

详细信息:
- 当前值: 85.3%
- 阈值: 60%

时间: 2025-10-08 15:30:00
```

---

## 📊 完整工作流程

### 交易通知流程

```
策略检测信号 (V3/ICT)
    ↓
TradeManager.createTrade()
    ↓
telegramService.sendTradingAlert(trade)
    ↓
TelegramConfigOps.getAllConfigs() - 从DB加载配置
    ↓
axios.post(telegram API) - 发送消息
    ↓
✅ 用户收到Telegram通知
```

### 系统告警流程

```
SystemMonitor.checkSystemResources()
    ↓
检测到 CPU > 60% 或 Memory > 60%
    ↓
monitor.sendAlert(type, message, data)
    ↓
检查冷却期 (5分钟)
    ↓
telegramService.sendMonitoringAlert()
    ↓
TelegramConfigOps.getAllConfigs() - 从DB加载配置
    ↓
axios.post(telegram API) - 发送消息
    ↓
✅ 用户收到Telegram通知
```

---

## 🔍 故障排查

### 问题1: 日志显示"交易触发Telegram未配置"

**原因**: 数据库中没有配置或`enabled=FALSE`

**解决**:
```sql
SELECT * FROM telegram_config WHERE config_type = 'trading';
```

如果为空或`enabled=0`，重新配置。

### 问题2: 日志显示"Telegram消息发送失败"

**可能原因**:
1. Bot Token错误
2. Chat ID错误
3. Bot未被用户添加
4. 网络问题

**解决**:
1. 检查Bot Token和Chat ID是否正确
2. 确保已在Telegram中与Bot对话过
3. 测试网络连接: `curl https://api.telegram.org/botYOUR_TOKEN/getMe`

### 问题3: 重启后配置丢失

**原因**: 之前的配置只存在内存中

**现状**: ✅ 已修复，配置已持久化到数据库

### 问题4: 还是报错 "dbOps.executeQuery is not a function"

**原因**: 代码未更新或未重启

**解决**:
```bash
cd /home/admin/trading-system-v2/trading-system-v2
git pull origin main
pm2 restart all
```

---

## 📝 代码变更总结

### 修改的文件

1. **src/database/telegram-config-ops.js** (关键修复)
   - 所有方法改用`connection.execute()`
   - 添加`connection.release()`确保连接释放
   - 修复5个方法: saveConfig, getConfig, getAllConfigs, disableConfig, deleteConfig

2. **src/services/telegram-monitoring.js** (已有，无需修改)
   - 已实现从数据库加载配置的逻辑
   - `loadConfigFromDatabase()`在构造函数中调用
   - 支持分别配置trading和monitoring

3. **src/core/trade-manager.js** (已有，无需修改)
   - 已在`createTrade()`中调用`telegramService.sendTradingAlert()`
   - 异常处理正确，不影响交易创建

4. **src/workers/monitor.js** (已有，无需修改)
   - 已在`checkSystemResources()`中调用`telegramService.sendMonitoringAlert()`
   - 实现了冷却机制(5分钟)

---

## ✅ 部署状态

- ✅ 代码已修复并推送到GitHub
- ✅ VPS已部署更新
- ✅ PM2服务已重启
- ✅ `dbOps.executeQuery is not a function`错误已消失
- ⏳ 用户需要配置Bot Token和Chat ID

---

## 📱 下一步操作

### 用户操作清单

- [ ] 创建Telegram Bot (通过@BotFather)
- [ ] 获取Chat ID (通过@userinfobot)
- [ ] 访问 https://smart.aimaventop.com/tools
- [ ] 配置"交易触发告警"Bot
- [ ] 配置"系统监控告警"Bot
- [ ] 测试配置连接
- [ ] 保存配置
- [ ] 等待下一次交易信号验证

### 验证方法

**方式1**: 等待真实交易信号

**方式2**: 手动触发测试 (开发环境)
```bash
# 在VPS上执行
cd /home/admin/trading-system-v2/trading-system-v2
node test-telegram-notification.js BTCUSDT V3 BUY
```

---

## 🎉 预期效果

配置完成后：

1. **交易信号触发时**: 
   - 立即收到Telegram消息
   - 包含完整交易信息
   - 格式清晰易读

2. **系统资源告警时**:
   - CPU > 60%时收到告警
   - Memory > 60%时收到告警
   - 5分钟冷却期，避免刷屏

3. **配置持久化**:
   - VPS重启后配置不丢失
   - 服务重启后自动加载配置

---

## 📞 技术支持

如遇问题，请检查日志：

```bash
# 查看主应用日志
pm2 logs main-app --lines 100

# 查看错误日志
tail -100 /home/admin/trading-system-v2/trading-system-v2/logs/error.log

# 搜索Telegram相关日志
pm2 logs main-app --lines 500 --nostream | grep -i telegram
```

**Git提交**: `96059be`
**部署时间**: 2025-10-08
**状态**: ✅ 核心功能已修复，等待用户配置

