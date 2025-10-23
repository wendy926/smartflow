# 策略修复部署指南 (2025-10-08)

## 📋 需要部署的文件

### 1. 后端策略文件

```bash
# ICT策略修复
src/strategies/ict-strategy.js

# V3策略修复  
src/strategies/v3-strategy.js
```

### 2. 前端文件

```bash
# 前端逻辑修复
src/web/app.js

# 在线文档更新
src/web/index.html
```

## 🚀 部署步骤

### 方式1：使用SCP批量上传

```bash
cd /Users/kaylame/KaylaProject/smartflow

# 上传ICT策略
scp ./src/strategies/ict-strategy.js root@smart.aimaventop.com:/root/trading-system-v2/src/strategies/

# 上传V3策略
scp ./src/strategies/v3-strategy.js root@smart.aimaventop.com:/root/trading-system-v2/src/strategies/

# 上传前端文件
scp ./src/web/app.js root@smart.aimaventop.com:/root/trading-system-v2/src/web/

# 上传文档
scp ./src/web/index.html root@smart.aimaventop.com:/root/trading-system-v2/src/web/
```

### 方式2：使用部署脚本

```bash
chmod +x deploy-fixes-20251008.sh
./deploy-fixes-20251008.sh
```

### 方式3：登录VPS手动更新

```bash
# 1. 登录VPS
ssh root@smart.aimaventop.com

# 2. 备份当前文件
cd /root/trading-system-v2
cp src/strategies/ict-strategy.js src/strategies/ict-strategy.js.backup-20251008
cp src/strategies/v3-strategy.js src/strategies/v3-strategy.js.backup-20251008
cp src/web/app.js src/web/app.js.backup-20251008
cp src/web/index.html src/web/index.html.backup-20251008

# 3. 使用文本编辑器更新文件，或者使用git pull
# 如果代码在git仓库中：
git pull origin main

# 4. 重启服务
pm2 restart main-app
pm2 restart strategy-worker
nginx -s reload

# 5. 检查状态
pm2 status
pm2 logs main-app --lines 50
```

## 🔧 修复内容总结

### ICT策略修复

1. **15分钟入场判断逻辑**
   - ✅ 增加总分强信号要求（≥60分）
   - ✅ 门槛式5个条件全部满足才触发
   - ✅ 前后端逻辑完全一致

2. **硬编码分数修复**
   - ✅ 移除30分、40分等硬编码
   - ✅ 统一使用动态分数计算
   - ✅ 所有路径评分一致

3. **置信度计算统一化**
   - ✅ 所有路径使用数值置信度
   - ✅ 移除字符串置信度
   - ✅ 公式：harmonicScore × 0.6 + engulfingStrength × 0.4

### V3策略修复

1. **震荡市交易逻辑**
   - ✅ combineSignals检查震荡市假突破信号
   - ✅ 假突破信号能够正确触发交易
   - ✅ RANGE模式完整实现

### 前端修复

1. **15M入场判断**
   - ✅ 增加总分≥60分检查
   - ✅ 检查5个门槛条件
   - ✅ 与后端逻辑一致

2. **在线文档更新**
   - ✅ 添加"策略优化更新"章节
   - ✅ 修复导航链接锚点
   - ✅ 详细的修复说明和对比表格

## ✅ 部署后验证

### 1. 检查服务状态

```bash
ssh root@smart.aimaventop.com "pm2 status"
```

### 2. 检查日志

```bash
ssh root@smart.aimaventop.com "pm2 logs main-app --lines 20"
```

### 3. 测试API

```bash
# 测试ICT策略
curl -s "https://smart.aimaventop.com/api/v1/strategies/ict/analyze" \
  -H "Content-Type: application/json" \
  -d '{"symbol": "BTCUSDT"}' | jq '.data | {signal, score, confidence, trend}'

# 测试V3策略
curl -s "https://smart.aimaventop.com/api/v1/strategies/v3/analyze" \
  -H "Content-Type: application/json" \
  -d '{"symbol": "BTCUSDT"}' | jq '.data | {signal, trend, timeframes}'
```

### 4. 验证前端

- 访问仪表板: https://smart.aimaventop.com/dashboard
- 访问文档: https://smart.aimaventop.com/docs
- 检查"策略优化更新"章节是否可以正常跳转

### 5. 验证ICT策略15M入场逻辑

```bash
# 获取当前状态
curl -s "https://smart.aimaventop.com/api/v1/strategies/current-status?limit=5" | \
  jq '.data[] | {symbol, ict: {signal, score, confidence, trend, fifteenM: .ict.timeframes."15M"}}'
```

**检查要点：**
- 总分 < 60分的交易对应该显示"15m入场: 无效"
- 总分 >= 60分且满足门槛式条件的应该显示"15m入场: 有效"
- 置信度应该是数值类型（0-1之间）

## 🔍 故障排查

### 如果服务启动失败

```bash
# 检查语法错误
ssh root@smart.aimaventop.com "cd /root/trading-system-v2 && node -c src/strategies/ict-strategy.js"
ssh root@smart.aimaventop.com "cd /root/trading-system-v2 && node -c src/strategies/v3-strategy.js"

# 查看详细错误日志
ssh root@smart.aimaventop.com "pm2 logs main-app --err --lines 50"
```

### 如果前端没有更新

```bash
# 清除浏览器缓存
# 或在浏览器中按 Ctrl+Shift+R 强制刷新

# 检查Nginx配置
ssh root@smart.aimaventop.com "nginx -t"
```

## 📝 回滚方案

如果部署出现问题，可以快速回滚：

```bash
ssh root@smart.aimaventop.com << 'EOF'
cd /root/trading-system-v2
mv src/strategies/ict-strategy.js.backup-20251008 src/strategies/ict-strategy.js
mv src/strategies/v3-strategy.js.backup-20251008 src/strategies/v3-strategy.js
mv src/web/app.js.backup-20251008 src/web/app.js
mv src/web/index.html.backup-20251008 src/web/index.html
pm2 restart all
EOF
```

## 📊 预期效果

### ICT策略

- 15M入场"有效"的交易对显著减少（只有强信号）
- 总分显示更加准确（不再有硬编码30/40分）
- 置信度显示为数值（如0.453而不是"中"）

### V3策略

- 震荡市（RANGE）下如果检测到假突破会触发交易
- BTCUSDT等震荡市交易对可能出现BUY/SELL信号

### 前端

- 文档"策略优化更新"章节可以正常访问
- 15M入场判断显示更加准确
- 总分和置信度显示一致

## 🎯 注意事项

1. **SSH连接问题**：如果遇到"Connection closed"，可能需要检查SSH配置或使用备用方式
2. **服务重启**：重启后需要等待30秒让服务完全启动
3. **缓存清除**：前端更新后需要强制刷新浏览器缓存
4. **监控日志**：部署后密切关注错误日志，确保没有运行时错误

