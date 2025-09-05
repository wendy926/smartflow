# SmartFlow 部署指南

## 🚀 快速部署

### 1. 一键设置
```bash
# 运行快速设置脚本
./setup.sh
```

### 2. 手动设置
```bash
# 安装依赖
npm install

# 安装Wrangler CLI
npm install -g wrangler

# 登录Cloudflare
wrangler login

# 创建KV命名空间
wrangler kv:namespace create "TRADE_LOG"

# 更新配置文件
cp wrangler.toml.example wrangler.toml
# 编辑 wrangler.toml 填入你的配置
```

### 3. 配置Telegram（可选）
1. 创建Telegram Bot：
   - 联系 @BotFather
   - 发送 `/newbot`
   - 按提示创建bot并获取token

2. 获取Chat ID：
   - 将bot添加到群组或私聊
   - 发送消息给bot
   - 访问 `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - 找到chat_id

3. 更新配置：
   ```toml
   [vars]
   TG_BOT_TOKEN = "your_actual_bot_token"
   TG_CHAT_ID = "your_actual_chat_id"
   ```

## 📦 部署步骤

### 本地开发
```bash
# 启动本地开发服务器
npm run dev

# 访问 http://localhost:8787
```

### 生产部署
```bash
# 部署到Cloudflare
npm run deploy:prod

# 或手动部署
wrangler deploy
```

## 🔧 管理命令

### 查看日志
```bash
# 实时查看Worker日志
npm run logs

# 或
wrangler tail
```

### KV存储管理
```bash
# 列出所有KV键
npm run kv:list

# 获取特定键的值
wrangler kv:key get "BTCUSDT:1234567890" --binding TRADE_LOG

# 删除键
wrangler kv:key delete "BTCUSDT:1234567890" --binding TRADE_LOG
```

### 测试API
```bash
# 本地模拟测试
npm run test:mock

# 真实API测试（需要网络）
npm run test:api
```

## 📊 监控和调试

### 1. 查看仪表板
访问你的Worker URL：
- 主页面：`https://your-worker.your-subdomain.workers.dev/`
- API测试：`https://your-worker.your-subdomain.workers.dev/api/test`
- 分析API：`https://your-worker.your-subdomain.workers.dev/api/analyze?symbol=BTCUSDT`

### 2. 监控信号
- 仪表板会显示所有监控品种的实时状态
- 绿色表示多头信号，红色表示空头信号
- 灰色表示无信号或错误

### 3. 调试问题
```bash
# 查看详细日志
wrangler tail --format=pretty

# 检查Worker状态
wrangler whoami

# 查看部署历史
wrangler deployments list
```

## ⚙️ 配置优化

### 1. 调整策略参数
编辑 `src/config.js` 文件：
```javascript
export const STRATEGY_CONFIG = {
  // 修改监控品种
  symbols: ["BTCUSDT", "ETHUSDT", "LINKUSDT", "LDOUSDT"],
  
  // 调整风险参数
  riskManagement: {
    riskPerTrade: 0.01,  // 单笔风险1%
    maxConcurrentPositions: 3,  // 最大持仓3笔
    maxDailyLoss: -3  // 日损限制-3R
  },
  
  // 调整确认条件
  hourlyConfirmation: {
    volumeMultiple: 1.5,  // 成交量倍数
    breakoutBars: 20  // 突破回看K线数
  }
};
```

### 2. 调整定时任务
编辑 `wrangler.toml`：
```toml
[[triggers]]
# 每小时执行
cron = "0 * * * *"

# 每30分钟执行
cron = "*/30 * * * *"

# 每天特定时间执行
cron = "0 9 * * *"  # 每天9点
```

### 3. 添加更多监控品种
```javascript
// 在 src/config.js 中
symbols: [
  "BTCUSDT", "ETHUSDT", "LINKUSDT", "LDOUSDT",
  "ADAUSDT", "DOTUSDT", "UNIUSDT", "AAVEUSDT"
]
```

## 🚨 故障排除

### 常见问题

**Q: 部署失败**
```bash
# 检查登录状态
wrangler whoami

# 重新登录
wrangler logout
wrangler login
```

**Q: API调用失败**
- 检查网络连接
- 确认Binance API可访问
- 查看Worker日志：`wrangler tail`

**Q: Telegram通知不工作**
- 检查Bot Token和Chat ID
- 确认Bot已添加到群组
- 测试Bot：发送消息给bot

**Q: 信号不准确**
- 先用模拟测试验证逻辑
- 检查参数设置
- 查看详细日志分析原因

### 调试步骤
1. 运行模拟测试：`npm run test:mock`
2. 检查本地开发：`npm run dev`
3. 查看部署日志：`wrangler tail`
4. 测试API接口：访问 `/api/test`

## 📈 性能优化

### 1. 减少API调用
- 调整定时任务频率
- 使用缓存机制
- 批量处理多个品种

### 2. 优化内存使用
- 限制历史数据长度
- 定期清理KV存储
- 使用流式处理

### 3. 提高响应速度
- 并行处理多个品种
- 使用WebSocket实时数据
- 优化算法复杂度

## 🔒 安全建议

### 1. 保护敏感信息
- 不要在代码中硬编码API密钥
- 使用环境变量存储敏感配置
- 定期轮换密钥

### 2. 限制访问
- 设置适当的CORS策略
- 使用API密钥验证
- 限制请求频率

### 3. 监控异常
- 设置错误告警
- 监控API调用频率
- 记录异常行为

## 📞 支持

如果遇到问题：
1. 查看日志：`wrangler tail`
2. 运行测试：`npm run test:mock`
3. 检查配置：`wrangler.toml`
4. 查看文档：`README.md`

## 🎯 下一步

部署成功后：
1. 配置Telegram通知
2. 调整策略参数
3. 监控信号质量
4. 优化性能
5. 扩展功能
