# OpenAI配置指南

## ✅ OpenAI迁移已完成

系统已从Claude AI成功迁移到OpenAI (ChatGPT)。

## 📋 当前状态

- ✅ 代码已迁移（claude-client → openai-client）
- ✅ 数据库配置已更新
- ✅ OpenAI SDK已安装（v4.67.3）
- ✅ 应用稳定运行
- ⏸️ AI分析已禁用（等待有效API Key）

## 🔑 配置OpenAI API Key

### 方式1: 使用官方OpenAI API

#### 步骤1: 获取API Key
访问: https://platform.openai.com/api-keys
创建新的API Key

#### 步骤2: SSH到VPS
```bash
ssh -i ~/.ssh/smartflow_vps_new root@47.237.163.85
cd /home/admin/trading-system-v2/trading-system-v2
```

#### 步骤3: 加密API Key
```bash
node -e "
process.env.ENCRYPTION_KEY = '9a3e45d366975b2001cdd285141c8c931c01bc7f05a47fa507bc52e31aa049a0';
const encryption = require('./src/utils/encryption');
const apiKey = 'sk-your-openai-api-key-here';
const encrypted = encryption.encrypt(apiKey);
console.log(encrypted);
"
```

#### 步骤4: 保存到数据库
```bash
mysql -u root trading_system << EOF
UPDATE ai_config 
SET config_value = '加密后的API_Key' 
WHERE config_key = 'openai_api_key';

UPDATE ai_config 
SET config_value = 'https://api.openai.com/v1' 
WHERE config_key = 'openai_base_url';

UPDATE ai_config 
SET config_value = 'true' 
WHERE config_key = 'ai_analysis_enabled';

SELECT 'OpenAI配置已更新' as status;
EOF
```

#### 步骤5: 更新.env
```bash
vi .env

# 修改为
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_BASE_URL=https://api.openai.com/v1
AI_ANALYSIS_ENABLED=true
```

#### 步骤6: 重启应用
```bash
pm2 restart main-app
```

#### 步骤7: 验证
```bash
curl http://localhost:8080/api/v1/ai/health
```

预期响应：
```json
{
  "success": true,
  "data": {
    "ai_enabled": true,
    "scheduler_running": true,
    "claude_available": true
  }
}
```

### 方式2: 使用第三方代理

如果你有支持OpenAI格式的代理服务，配置如下：

```bash
# .env
OPENAI_API_KEY=你的代理Token
OPENAI_BASE_URL=你的代理URL
AI_ANALYSIS_ENABLED=true
```

然后加密保存到数据库（步骤3-6）。

---

## 🧪 测试OpenAI集成

### 测试1: 健康检查
```bash
curl http://localhost:8080/api/v1/ai/health
```

### 测试2: 手动触发宏观分析
```bash
curl -X POST http://localhost:8080/api/v1/ai/analyze \
  -H "Content-Type: application/json" \
  -d '{"type": "macro_risk"}'
```

等待10-15秒后查看结果：
```bash
curl http://localhost:8080/api/v1/ai/macro-risk?symbols=BTCUSDT,ETHUSDT
```

### 测试3: 手动触发交易对分析
```bash
curl -X POST http://localhost:8080/api/v1/ai/analyze \
  -H "Content-Type: application/json" \
  -d '{"type": "symbol_trend", "symbols": ["BTCUSDT"]}'
```

查看结果：
```bash
curl http://localhost:8080/api/v1/ai/symbol-analysis?symbol=BTCUSDT
```

---

## 📊 OpenAI模型配置

### 当前配置
- **模型**: `gpt-4o-mini` (默认)
- **最大Tokens**: 4000
- **温度**: 0.3

### 可选模型
- `gpt-4o-mini` - 性价比高，推荐
- `gpt-4o` - 最新最强，费用较高
- `gpt-4-turbo` - 快速响应
- `gpt-3.5-turbo` - 成本最低

### 修改模型
```sql
UPDATE ai_config 
SET config_value = 'gpt-4o' 
WHERE config_key = 'openai_model';
```

然后重启应用。

---

## 💰 费用估算

### Token使用预估
- 宏观风险分析: 3000-4000 tokens/次
- 交易对分析: 2000-3000 tokens/次

### 每日费用（启用时）
使用gpt-4o-mini:
- 输入: $0.15 / 1M tokens
- 输出: $0.60 / 1M tokens

预估每日：
- 宏观分析: 12次 × 3500 tokens ≈ 42K tokens
- 交易对分析: 288次 × 2500 tokens ≈ 720K tokens
- 每日总计: 约762K tokens
- **每日费用**: 约 $0.11 - $0.46 USD

### 月度费用预估
- **月度**: 约 $3 - $14 USD

---

## 🔄 从Claude到OpenAI的变化

### API调用方式
```javascript
// Claude (旧)
POST /v1/messages
Headers: x-api-key, anthropic-version
Body: { model, max_tokens, messages, system }

// OpenAI (新)
POST /v1/chat/completions
Headers: Authorization: Bearer <key>
Body: { model, max_tokens, messages, temperature }
```

### 消息格式
```javascript
// Claude
{
  system: "系统提示词",
  messages: [{ role: "user", content: "用户输入" }]
}

// OpenAI
{
  messages: [
    { role: "system", content: "系统提示词" },
    { role: "user", content: "用户输入" }
  ]
}
```

### 响应格式
```javascript
// Claude
response.content[0].text

// OpenAI
response.choices[0].message.content
```

---

## ⚠️ 注意事项

1. **API Key安全**: 
   - 使用AES-256加密存储
   - 不要直接存储明文
   - 定期更换

2. **费用控制**:
   - 监控每日Token使用量
   - 设置使用上限
   - 定期查看账单

3. **性能优化**:
   - 使用缓存减少调用
   - 批量处理降低频率
   - 调整分析间隔

4. **错误处理**:
   - API失败自动降级
   - 使用历史数据
   - 告警冷却机制

---

## 🆘 故障排查

### 问题1: API Key无效
**检查**:
```bash
# 验证解密
node -e "
process.env.ENCRYPTION_KEY = '9a3e45d366975b2001cdd285141c8c931c01bc7f05a47fa507bc52e31aa049a0';
const encryption = require('./src/utils/encryption');
const encryptedKey = '数据库中的加密值';
const decrypted = encryption.decrypt(encryptedKey);
console.log('解密后长度:', decrypted.length);
console.log('前缀:', decrypted.substring(0, 3));
"
```

### 问题2: 网络连接失败
**检查**:
```bash
curl -v https://api.openai.com/v1/models
```

### 问题3: Token超限
**检查**:
```bash
curl http://localhost:8080/api/v1/ai/stats
```

---

## ✅ 配置完成检查表

启用AI功能前请确认：

- [ ] 已获取有效的OpenAI API Key
- [ ] API Key已加密并保存到数据库
- [ ] openai_base_url配置正确
- [ ] openai_model配置正确
- [ ] ai_analysis_enabled设置为true
- [ ] .env文件已更新
- [ ] 应用已重启
- [ ] 健康检查API返回正常
- [ ] 手动触发分析测试成功
- [ ] 前端显示正常

---

**配置完成后，AI分析功能将自动运行！**

- 宏观分析: 每2小时自动分析BTC/ETH
- 交易对分析: 每5分钟更新活跃交易对
- 风险告警: 危险/极度危险时Telegram通知
- 前端展示: 实时更新AI分析结果

---

**文档时间**: 2025-10-08
**当前状态**: 等待配置OpenAI API Key

