# Telegram 通知配置指南

## 📱 功能说明

当任意交易对出现信号变化或入场执行变化时，系统会自动通过Telegram发送通知消息。

## 🔧 配置步骤

### 1. 创建Telegram机器人

1. 在Telegram中搜索 `@BotFather`
2. 发送 `/newbot` 命令
3. 按提示输入机器人名称和用户名
4. 获取Bot Token（格式：`123456789:ABCdefGHIjklMNOpqrsTUVwxyz`）

### 2. 获取Chat ID

#### 方法1：通过API获取
1. 给您的机器人发送任意消息
2. 访问：`https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. 在返回的JSON中找到 `chat.id` 字段

#### 方法2：使用专用机器人
1. 搜索 `@userinfobot`
2. 发送任意消息获取您的Chat ID

### 3. 设置环境变量

在VPS服务器上设置环境变量：

```bash
# 编辑环境变量文件
nano ~/.bashrc

# 添加以下内容
export TELEGRAM_BOT_TOKEN="your_bot_token_here"
export TELEGRAM_CHAT_ID="your_chat_id_here"

# 重新加载环境变量
source ~/.bashrc

# 重启应用
pm2 restart smartflow-app
```

### 4. 验证配置

1. 访问网页：`https://smartflow-trader.wendy-wang926.workers.dev`
2. 点击 "📱 Telegram通知" 按钮
3. 查看配置状态
4. 点击 "🧪 测试通知" 按钮
5. 检查Telegram是否收到测试消息

## 📨 消息格式

当交易信号发生变化时，您会收到如下格式的消息：

```
🚨 SmartFlow 交易信号提醒

📊 交易对：BTCUSDT

📈 信号变化：从 "NO_SIGNAL" 变为 "LONG"

⚡ 入场执行变化：新入场执行: LONG_EXECUTE

🔍 关键判断依据：
1. 日线趋势: UPTREND
2. 小时确认: LONG
3. VWAP位置: 价格高于VWAP
4. 成交量分析: 成交量放大
5. 15分钟执行: 突破setup高点

🌐 网页链接：https://smartflow-trader.wendy-wang926.workers.dev
```

## 🛠️ 故障排除

### 问题1：配置状态显示"未配置"
- 检查环境变量是否正确设置
- 确认已重启应用：`pm2 restart smartflow-app`
- 检查环境变量是否生效：`echo $TELEGRAM_BOT_TOKEN`

### 问题2：测试消息发送失败
- 检查Bot Token格式是否正确
- 确认Chat ID是否为数字
- 检查网络连接是否正常

### 问题3：收不到通知消息
- 确认机器人已启动（给机器人发送 `/start`）
- 检查是否屏蔽了机器人消息
- 查看服务器日志：`pm2 logs smartflow-app`

## 🔒 安全建议

1. **保护Bot Token**：不要将Token分享给他人
2. **定期更新**：建议定期更换Bot Token
3. **限制访问**：只将Chat ID设置为您自己的ID
4. **监控使用**：定期检查机器人的使用情况

## 📞 技术支持

如果遇到问题，请检查：
1. 服务器日志：`pm2 logs smartflow-app`
2. 网络连接：`curl -I https://api.telegram.org`
3. 环境变量：`env | grep TELEGRAM`
