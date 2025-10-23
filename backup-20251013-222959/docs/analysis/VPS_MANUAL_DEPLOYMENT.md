# VPS手动部署指南 (2025-10-08)

## ✅ Git已推送成功

**提交信息：** `fix: 策略逻辑优化和文档更新 (2025-10-08)`  
**提交哈希：** `b714f94`  
**GitHub仓库：** https://github.com/wendy926/smartflow.git

---

## 🚀 VPS部署步骤

### 方式1：使用VPS Web终端

1. **登录VPS Web控制台**
   - 访问VPS提供商的管理面板
   - 打开Web终端

2. **拉取最新代码**
   ```bash
   cd /root/trading-system-v2
   git pull origin main
   ```

3. **检查更新的文件**
   ```bash
   git log --oneline -1
   git show --name-only
   ```

4. **重启服务**
   ```bash
   pm2 restart main-app
   pm2 restart strategy-worker
   nginx -s reload
   ```

5. **验证部署**
   ```bash
   pm2 status
   pm2 logs main-app --lines 20
   ```

---

### 方式2：修复SSH连接后部署

如果SSH连接恢复，执行以下命令：

```bash
# 单条命令完成所有操作
ssh root@smart.aimaventop.com "cd /root/trading-system-v2 && git pull origin main && pm2 restart all && nginx -s reload && pm2 status"
```

---

### 方式3：使用VPS文件管理器

如果无法使用终端：

1. 登录VPS文件管理器
2. 下载GitHub上的最新文件
3. 上传到对应目录：
   - `src/strategies/ict-strategy.js`
   - `src/strategies/v3-strategy.js`
   - `src/web/app.js`
   - `src/web/index.html`
4. 使用Web终端重启服务

---

## 📋 部署清单

### 更新的文件（4个核心文件）

✅ **src/strategies/ict-strategy.js**
- 15分钟入场增加强信号要求（≥60分）
- 消除硬编码分数（30/40分）
- 统一置信度计算为数值
- 添加engulfingType字段

✅ **src/strategies/v3-strategy.js**
- 修复震荡市假突破信号处理
- combineSignals检查RANGE模式

✅ **src/web/app.js**
- 15M入场判断增加总分≥60分检查
- 前端逻辑与后端完全一致

✅ **src/web/index.html**
- V3策略：动态权重、补偿机制、震荡市逻辑、杠杆24倍
- ICT策略：5个门槛、60分阈值、订单块5天、杠杆24倍

---

## 🔍 部署后验证

### 1. 检查服务状态

```bash
ssh root@smart.aimaventop.com "pm2 status"
```

**预期输出：**
```
┌────┬────────────────┬─────────┬─────────┬─────────┬──────────┐
│ id │ name           │ status  │ restart │ uptime  │ cpu      │
├────┼────────────────┼─────────┼─────────┼─────────┼──────────┤
│ 0  │ main-app       │ online  │ 0       │ 10s     │ 5%       │
│ 1  │ strategy-worker│ online  │ 0       │ 10s     │ 3%       │
└────┴────────────────┴─────────┴─────────┴─────────┴──────────┘
```

---

### 2. 测试ICT策略API

```bash
curl -s "https://smart.aimaventop.com/api/v1/strategies/current-status?limit=2" | \
  jq '.data[] | {
    symbol, 
    ict: {
      signal, 
      score, 
      confidence: (.ict.confidence | type),
      trend,
      engulfingType: .ict.timeframes."15M".engulfingType
    }
  }'
```

**验证要点：**
- ✅ `confidence` 类型应为"number"
- ✅ `engulfingType` 字段存在
- ✅ `score` 不应出现30或40的硬编码值
- ✅ 只有总分≥60的交易对才可能触发BUY/SELL

---

### 3. 测试V3策略震荡市逻辑

```bash
curl -s "https://smart.aimaventop.com/api/v1/strategies/v3/analyze" \
  -H "Content-Type: application/json" \
  -d '{"symbol": "BTCUSDT"}' | \
  jq '{signal: .data.signal, trend: .data.timeframes."4H".trend}'
```

**验证要点：**
- ✅ 如果trend为"RANGE"且有假突破，signal应为BUY/SELL
- ✅ 如果trend为"RANGE"但无假突破，signal应为HOLD

---

### 4. 验证在线文档

**访问：** https://smart.aimaventop.com/docs

**验证清单：**

#### V3策略部分
- [ ] 点击左侧"V3多因子趋势策略"能正常跳转
- [ ] 看到"动态权重调整"表格（4种调整规则）
- [ ] 看到"补偿机制"说明和公式
- [ ] 看到"震荡市特殊处理"章节
- [ ] 杠杆限制显示为24倍（绿色高亮）

#### ICT策略部分
- [ ] 点击左侧"ICT订单块策略"能正常跳转
- [ ] 看到"15M入场条件"表格（5个门槛）
- [ ] 第5个门槛"总分≥60分"有黄色背景高亮
- [ ] 信号生成逻辑更新为60分阈值
- [ ] 订单块年龄显示为5天（绿色高亮）
- [ ] 杠杆限制显示为24倍（绿色高亮）

#### 策略优化更新章节
- [ ] 点击左侧"策略优化更新 (2025-10-08)"能正常跳转
- [ ] 看到完整的修复说明
- [ ] 看到修复效果对比表格

**注意：** 如果看到的还是旧内容，请按 **Ctrl+Shift+R**（Windows）或 **Cmd+Shift+R**（Mac）强制刷新浏览器缓存

---

### 5. 验证前端仪表板

**访问：** https://smart.aimaventop.com/dashboard

**验证清单：**
- [ ] ICT策略15M入场显示"有效"的交易对，总分应该≥60分
- [ ] ICT策略置信度显示为中文（高/中/低），不是英文字符串
- [ ] ICT策略总分不应出现30/40等硬编码值
- [ ] V3策略RANGE趋势的交易对，如果有假突破应显示BUY/SELL

---

## 🛠️ 故障排查

### 问题1：Git拉取失败

```bash
# 检查Git状态
cd /root/trading-system-v2
git status
git remote -v

# 如果有冲突
git stash
git pull origin main
git stash pop

# 如果需要强制更新
git fetch origin
git reset --hard origin/main
```

### 问题2：服务重启失败

```bash
# 查看错误日志
pm2 logs main-app --err --lines 50

# 检查语法错误
cd /root/trading-system-v2
node -c src/strategies/ict-strategy.js
node -c src/strategies/v3-strategy.js

# 如果有语法错误，回滚
git reset --hard HEAD~1
pm2 restart all
```

### 问题3：前端没有更新

```bash
# 1. 强制刷新浏览器缓存
# Ctrl+Shift+R (Windows) 或 Cmd+Shift+R (Mac)

# 2. 检查Nginx配置
nginx -t

# 3. 重载Nginx
nginx -s reload

# 4. 清除浏览器所有缓存
# 浏览器 → 设置 → 清除浏览数据
```

### 问题4：SSH连接问题

**错误：** `Connection closed by 127.0.0.1 port 10808`

**可能原因：**
1. SSH端口转发配置问题
2. 本地~/.ssh/config配置错误
3. VPS防火墙设置
4. SSH密钥过期

**解决方案：**
1. 使用VPS Web控制台代替SSH
2. 检查本地SSH配置文件
3. 联系VPS提供商支持
4. 尝试使用不同的SSH客户端

---

## 📊 预期效果

### ICT策略变化

**信号触发数量：**
- 预期减少50-70%
- 只有高质量强信号（总分≥60分）才触发
- 胜率预期提升

**前端显示：**
- 大多数交易对15M入场显示"无效"
- 总分分布更合理（不再有30/40分）
- 置信度显示为"高/中/低"

### V3策略变化

**震荡市交易：**
- RANGE趋势的交易对可能出现BUY/SELL信号
- 假突破检测更加准确

**权重调整：**
- 日志中会显示动态权重信息
- 信号判断更加灵活

### 文档体验

**用户收益：**
- 策略逻辑说明与代码100%一致
- 清晰的表格展示复杂逻辑
- 重要变更有明显提示
- 便于理解和调试

---

## ✅ 部署成功标志

完成以下检查即表示部署成功：

1. ✅ VPS上代码已更新到最新提交（b714f94）
2. ✅ PM2进程状态为online
3. ✅ API返回数据符合新逻辑
4. ✅ 前端文档显示新内容
5. ✅ 仪表板数据正常显示

---

## 📞 紧急回滚

如果部署后出现严重问题，立即执行：

```bash
ssh root@smart.aimaventop.com << 'EOF'
cd /root/trading-system-v2
git reset --hard HEAD~1
pm2 restart all
nginx -s reload
EOF
```

这将回滚到上一个稳定版本。

---

## 📝 提交记录

**Git Commit：** `b714f94`  
**提交时间：** 2025-10-08  
**修改文件：** 4个  
**插入行数：** 3860行  
**删除行数：** 979行

**修改的文件：**
1. src/strategies/ict-strategy.js
2. src/strategies/v3-strategy.js
3. src/web/app.js
4. src/web/index.html

---

## 🎯 下一步操作

请通过以下任一方式在VPS上执行：

**推荐方式（VPS Web终端）：**
```bash
cd /root/trading-system-v2
git pull origin main
pm2 restart all
nginx -s reload
pm2 status
```

然后访问：
- 📊 仪表板：https://smart.aimaventop.com/dashboard
- 📖 文档：https://smart.aimaventop.com/docs （强制刷新）

代码已成功推送到GitHub，等待在VPS上拉取并重启服务！

