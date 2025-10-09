# VPS部署验证清单

## ✅ 代码已推送到GitHub

提交信息: `feat: 集成Claude AI Agent - 宏观风险分析和交易对趋势分析`
提交哈希: `5d64d91`
推送状态: ✅ 成功

## 🚀 VPS部署步骤

### 1. SSH到VPS

```bash
ssh -i ~/.ssh/smartflow_vps_new root@47.237.163.85
cd /home/admin/trading-system-v2/trading-system-v2
```

### 2. 拉取最新代码

```bash
git pull origin main
```

应该看到:
```
Updating da5541d..5d64d91
Fast-forward
 20 files changed, 4560 insertions(+)
 ...
```

### 3. 安装新依赖

```bash
npm install
```

验证node-cron已安装：
```bash
npm list node-cron
```

### 4. 执行数据库迁移

```bash
mysql -u trading_user -p trading_system < database/ai-integration-schema.sql
```

输入密码后，应该看到创建成功的消息。

验证表是否创建：
```bash
mysql -u trading_user -p -e "USE trading_system; SHOW TABLES LIKE 'ai_%';"
```

应该看到4张表：
- ai_alert_history
- ai_api_logs
- ai_config
- ai_market_analysis

### 5. 配置环境变量

```bash
# 编辑.env文件
vi .env

# 添加以下配置（实际值需要替换）
CLAUDE_API_KEY=你的Claude_API_Key
CLAUDE_API_PROXY=https://api.anthropic.com
ENCRYPTION_KEY=生成的32字节加密密钥
AI_ANALYSIS_ENABLED=true
MACRO_UPDATE_INTERVAL=7200
SYMBOL_UPDATE_INTERVAL=300
```

生成加密密钥（在本地或VPS上执行）：
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 6. 加密并保存Claude API Key到数据库

创建临时脚本：
```bash
cat > /tmp/encrypt-api-key.js << 'EOF'
const encryption = require('./src/utils/encryption');
const apiKey = '你的Claude_API_Key';
const encrypted = encryption.encrypt(apiKey);
console.log('加密后的API Key:', encrypted);
EOF

node /tmp/encrypt-api-key.js
```

复制输出的加密Key，然后：
```bash
mysql -u trading_user -p trading_system << EOF
UPDATE ai_config 
SET config_value = '加密后的API_Key' 
WHERE config_key = 'claude_api_key';
EOF
```

**重要**: 执行完后删除临时脚本
```bash
rm /tmp/encrypt-api-key.js
```

### 7. 验证配置

```bash
mysql -u trading_user -p trading_system << EOF
SELECT config_key, 
       CASE 
         WHEN config_key = 'claude_api_key' THEN CONCAT(LEFT(config_value, 10), '...')
         ELSE config_value 
       END as config_value,
       config_type,
       is_active
FROM ai_config 
WHERE is_active = TRUE
ORDER BY config_key;
EOF
```

确认所有配置已正确设置。

### 8. 重启应用

```bash
pm2 restart ecosystem.config.js
```

### 9. 查看日志

```bash
pm2 logs --lines 100
```

关键日志检查：
- ✅ `Trading System V2.0 started on port 8080`
- ✅ `Database connected successfully`
- ✅ `Redis connected successfully`
- ✅ `Claude客户端初始化成功`
- ✅ `AI Analysis Scheduler started successfully`

如果看到 "AI Analysis Scheduler not started"，检查配置。

### 10. 健康检查

```bash
# AI健康检查
curl http://localhost:8080/api/v1/ai/health

# 预期响应
{
  "success": true,
  "data": {
    "ai_enabled": true,
    "scheduler_running": true,
    "claude_available": true
  }
}
```

```bash
# AI配置状态
curl http://localhost:8080/api/v1/ai/config/status

# 预期响应
{
  "success": true,
  "data": {
    "enabled": true,
    "macroUpdateInterval": 7200,
    "symbolUpdateInterval": 300,
    ...
  }
}
```

### 11. 手动触发测试

```bash
# 触发宏观风险分析
curl -X POST http://localhost:8080/api/v1/ai/analyze \
  -H "Content-Type: application/json" \
  -d '{"type": "macro_risk"}'

# 预期响应
{
  "success": true,
  "data": {
    "success": true,
    "message": "BTC和ETH宏观分析已触发"
  }
}
```

等待10-15秒后查看结果：
```bash
curl http://localhost:8080/api/v1/ai/macro-risk?symbols=BTCUSDT,ETHUSDT
```

应该看到分析数据。

### 12. 前端验证

在浏览器访问: https://smart.aimaventop.com/dashboard

#### 检查清单：

**AI市场风险分析区域**
- [ ] "AI市场风险分析"标题显示
- [ ] "最后更新"时间显示
- [ ] "刷新"和"立即分析"按钮显示
- [ ] BTC风险分析卡片显示
- [ ] ETH风险分析卡片显示
- [ ] 风险等级徽章正确显示（🟢🟡🔴⚫）
- [ ] 核心发现文本显示
- [ ] 置信度百分比显示
- [ ] 当前价格显示
- [ ] 短期预测显示
- [ ] 操作建议显示
- [ ] "查看详细分析"按钮工作正常
- [ ] 点击后弹出详细分析模态框
- [ ] 模态框显示完整分析内容

**策略当前状态表格**
- [ ] 表格最后一列显示"AI分析"
- [ ] AI分析列有数据显示
- [ ] 趋势评分显示（X/100）
- [ ] 强弱信号徽章显示
- [ ] 短期和中期预测显示
- [ ] 同一交易对的V3和ICT行显示相同的AI分析

**交互功能**
- [ ] 手动刷新按钮工作正常
- [ ] "立即分析"按钮工作正常
- [ ] 数据自动更新（等待2小时观察）
- [ ] 页面刷新后数据保持

**样式检查**
- [ ] AI卡片样式正确（边框颜色、背景色）
- [ ] 危险等级卡片有脉冲动画
- [ ] 响应式布局正常（缩小浏览器窗口测试）
- [ ] 模态框居中显示，背景半透明

### 13. 告警测试（可选）

如果有交易对风险等级达到DANGER或EXTREME：

```bash
# 检查告警历史
curl http://localhost:8080/api/v1/ai/alerts/stats

# 检查数据库
mysql -u trading_user -p trading_system << EOF
SELECT * FROM ai_alert_history ORDER BY created_at DESC LIMIT 5;
EOF
```

验证Telegram是否收到通知。

### 14. 性能监控

```bash
# API统计
curl http://localhost:8080/api/v1/ai/stats

# PM2监控
pm2 monit
```

检查：
- CPU使用率是否正常（< 60%）
- 内存使用率是否正常（< 60%）
- API响应时间是否合理（< 15秒）

### 15. 日志持续监控

```bash
# 实时日志
pm2 logs --lines 200

# 查找错误
pm2 logs | grep -i error

# 查找AI相关日志
pm2 logs | grep -i "ai\|claude"
```

## 🐛 常见问题排查

### 问题1: AI调度器未启动

**检查配置**:
```bash
mysql -u trading_user -p trading_system -e \
  "SELECT * FROM ai_config WHERE config_key = 'ai_analysis_enabled';"
```

确保值为 'true'。

### 问题2: Claude API调用失败

**检查网络**:
```bash
curl -I https://api.anthropic.com
```

**检查API Key**:
```bash
# 测试解密
node -e "
const encryption = require('./src/utils/encryption');
const encrypted = '数据库中的加密值';
try {
  const decrypted = encryption.decrypt(encrypted);
  console.log('解密成功，长度:', decrypted.length);
} catch (e) {
  console.error('解密失败:', e.message);
}
"
```

### 问题3: 前端显示空白

**检查浏览器控制台**:
- 打开开发者工具 (F12)
- 查看Console面板是否有JavaScript错误
- 查看Network面板确认API请求状态

**检查文件加载**:
```bash
curl -I https://smart.aimaventop.com/public/css/ai-analysis.css
curl -I https://smart.aimaventop.com/public/js/ai-analysis.js
```

确保返回200状态码。

### 问题4: 数据库连接错误

**检查连接池**:
```bash
mysql -u trading_user -p trading_system -e "SHOW PROCESSLIST;"
```

如果连接数过多，调整配置：
```javascript
// src/config/index.js
database: {
  connectionLimit: 10, // 增加到10
  ...
}
```

## 📊 验证完成检查表

- [ ] 代码已成功拉取到VPS
- [ ] 依赖已安装
- [ ] 数据库表已创建
- [ ] 环境变量已配置
- [ ] API Key已加密并保存
- [ ] 应用已重启
- [ ] 日志显示AI调度器启动成功
- [ ] 健康检查API返回正常
- [ ] 手动触发分析成功
- [ ] 前端AI分析区域显示正常
- [ ] 策略表格AI列显示正常
- [ ] 所有交互功能正常
- [ ] 无JavaScript错误
- [ ] 性能指标正常
- [ ] 告警功能正常（如适用）

## ✅ 部署完成

如果所有检查项都通过，则部署成功！

**下一步**：
1. 持续监控日志和性能
2. 观察AI分析的准确性
3. 根据实际情况调整配置
4. 定期检查API费用

**支持文档**：
- `AI_INTEGRATION_GUIDE.md` - 集成指南
- `DEPLOYMENT_SUMMARY.md` - 部署总结
- `docs/analysis/claude-ai-integration-design.md` - 设计文档

---

**部署时间**: 2025-10-08
**部署人**: AI Assistant
**版本**: v1.0.0

