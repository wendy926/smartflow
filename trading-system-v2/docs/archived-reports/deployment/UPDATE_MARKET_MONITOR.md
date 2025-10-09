# 🔄 如何更新市场监控数据

## 快速指南

### 步骤1: 获取artifact最新内容

1. 访问: https://claude.ai/public/artifacts/8712090a-7b76-476e-bbc8-6920f6b5f4b8
2. 找到**BTC市场分析**部分，复制以下信息：
   - 风险等级（如：中度关注、高度警戒等）
   - 操作建议（具体的交易建议）
   - 当前风险评估（主要风险提示）

3. 找到**ETH市场分析**部分，复制相同信息

### 步骤2: 编辑配置文件

**VPS直接编辑（推荐）**:
```bash
ssh -i ~/.ssh/smartflow_vps_new root@47.237.163.85
cd /home/admin/trading-system-v2/trading-system-v2
vim config/market-monitor.json
```

**或本地编辑**:
```bash
cd trading-system-v2
vim config/market-monitor.json
```

### 步骤3: 更新配置

编辑JSON文件，按照artifact内容更新：

```json
{
  "lastUpdate": "2025-10-09T[当前时间]+08:00",
  "artifactUrl": "https://claude.ai/public/artifacts/8712090a-7b76-476e-bbc8-6920f6b5f4b8",
  "BTC": {
    "alertLevel": "[从artifact复制: 如'中度关注']",
    "alertColor": "[根据风险选择: safe/warning/danger/extreme]",
    "tradingSuggestion": "[从artifact复制: 操作建议部分]",
    "riskWarning": "[从artifact复制: 当前风险评估部分]"
  },
  "ETH": {
    "alertLevel": "[从artifact复制]",
    "alertColor": "[根据风险选择]",
    "tradingSuggestion": "[从artifact复制]",
    "riskWarning": "[从artifact复制]"
  }
}
```

### alertColor选择标准

根据artifact中的风险等级判断，选择对应的颜色：

| 风险描述 | alertColor | 图标 | 效果 |
|---------|-----------|------|------|
| 正常、健康、稳定 | `safe` | 🟢 | 绿色 |
| 观察、关注、谨慎 | `warning` | 🟡 | 黄色 |
| 危险、高风险 | `danger` | 🔴 | 红色+脉冲 |
| 极度危险、紧急 | `extreme` | ⚫ | 黑色+强脉冲 |

### 步骤4: 验证和保存

**验证JSON格式**:
```bash
cat config/market-monitor.json | jq .
```

如果没有报错，说明格式正确。

**保存**:
- VPS: `:wq`保存退出vim
- 本地: 保存后推送到GitHub，然后VPS `git pull`

### 步骤5: 刷新浏览器

无需重启服务，直接刷新浏览器（Cmd+Shift+R）即可看到更新。

---

## 完整示例

### Artifact内容示例

假设artifact页面显示：

**🟠 BTC 市场分析**
- **当前风险评估**: 🔴 危险（顶部特征明显）
- **操作建议**: 
  - 若持多单 → 止损在$120k
  - 若考虑入场 → 等待$115k-$118k回调或突破$125k站稳

**🟣 ETH 市场分析**
- **当前风险评估**: 🟡 观察（相对弱势，不宜追涨）
- **操作建议**:
  - 等待ETH/BTC比率回升至0.029以上
  - 可在$3,500-$3,600轻仓布局

### 对应的配置文件

```json
{
  "lastUpdate": "2025-10-09T14:30:00+08:00",
  "artifactUrl": "https://claude.ai/public/artifacts/8712090a-7b76-476e-bbc8-6920f6b5f4b8",
  "BTC": {
    "alertLevel": "高度警戒",
    "alertColor": "danger",
    "tradingSuggestion": "若持多单建议止损在$120k，若考虑入场等待$115k-$118k回调或突破$125k站稳",
    "riskWarning": "顶部特征明显，资金费率高位，持仓量创新高，短期回调风险极大"
  },
  "ETH": {
    "alertLevel": "中度关注",
    "alertColor": "warning",
    "tradingSuggestion": "等待ETH/BTC比率回升至0.029以上，可在$3,500-$3,600轻仓布局",
    "riskWarning": "相对BTC走势偏弱，独立性不足，不宜追涨，建议观望"
  }
}
```

---

## 自动化脚本（可选）

创建快速更新脚本：

```bash
#!/bin/bash
# update-monitor.sh

echo "市场监控配置更新工具"
echo "========================"

# 更新时间戳
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S+08:00")

# 备份
cp config/market-monitor.json config/market-monitor.json.bak
echo "✅ 已备份配置文件"

# 打开编辑器
vim config/market-monitor.json

# 验证格式
if cat config/market-monitor.json | jq . > /dev/null 2>&1; then
  echo "✅ JSON格式正确"
  
  # 更新时间戳
  jq ".lastUpdate = \"$TIMESTAMP\"" config/market-monitor.json > config/market-monitor.json.tmp
  mv config/market-monitor.json.tmp config/market-monitor.json
  
  echo "✅ 已更新时间戳: $TIMESTAMP"
  echo "✅ 配置更新完成！"
  echo ""
  echo "现在刷新浏览器即可看到更新"
else
  echo "❌ JSON格式错误，已恢复备份"
  mv config/market-monitor.json.bak config/market-monitor.json
fi
```

使用方法：
```bash
chmod +x update-monitor.sh
./update-monitor.sh
```

---

## 常见问题

### Q1: 如何判断alertColor？

**参考标准**:
- artifact中提到"正常"、"健康" → `safe`
- artifact中提到"观察"、"关注" → `warning`
- artifact中提到"危险"、"高风险" → `danger`
- artifact中提到"极度危险"、"紧急" → `extreme`

### Q2: tradingSuggestion应该写什么？

**要点**:
- 具体价格区间（$120k-$125k）
- 明确操作方向（多单/空单/观望）
- 入场条件（突破/回调/站稳）
- 止损位置（如果有）

**示例**:
```
"多单建议在$120k设置止损，等待回调至$115k-$118k或突破$125k站稳后再考虑加仓"
```

### Q3: riskWarning应该写什么？

**要点**:
- 数据支撑（资金费率、持仓量、ETF流向）
- 具体风险点（顶部特征、恐慌抛售、杠杆过高）
- 关键价格位（支撑位、阻力位）

**示例**:
```
"资金费率0.05%处于高位，持仓量$40B创新高，ETF连续流出，短期深度回调风险大，关注$120k支撑"
```

### Q4: 更新后前端不显示？

**解决方法**:
1. 硬刷新: Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows)
2. 清除缓存
3. 检查JSON格式: `cat config/market-monitor.json | jq .`
4. 检查API: `curl http://localhost:8080/api/v1/ai/macro-risk`

### Q5: 链接跳转错误？

**检查**:
- artifactUrl必须是完整URL
- 包含`https://`协议
- 路径正确

**正确格式**:
```json
"artifactUrl": "https://claude.ai/public/artifacts/8712090a-7b76-476e-bbc8-6920f6b5f4b8"
```

---

## 更新频率建议

### 市场平静期
- 频率: 每日1-2次
- 时间: 早上9点、晚上9点

### 市场波动期
- 频率: 每4-6小时
- 时间: 根据市场变化

### 剧烈行情
- 频率: 每1-2小时
- 重点: 及时更新风险等级

---

## 快速命令参考

```bash
# VPS SSH登录
ssh -i ~/.ssh/smartflow_vps_new root@47.237.163.85

# 进入项目目录
cd /home/admin/trading-system-v2/trading-system-v2

# 编辑配置
vim config/market-monitor.json

# 验证JSON格式
cat config/market-monitor.json | jq .

# 测试API
curl http://localhost:8080/api/v1/ai/macro-risk | jq .

# 查看当前配置
cat config/market-monitor.json | jq .BTC
cat config/market-monitor.json | jq .ETH
```

---

## 配置文件位置

- **VPS**: `/home/admin/trading-system-v2/trading-system-v2/config/market-monitor.json`
- **本地**: `trading-system-v2/config/market-monitor.json`

---

## 重要提醒

⚠️ **从artifact复制内容时请注意**:
1. 保持文本简洁，不要超过200字
2. 移除格式标记（如**粗体**、- 列表符号）
3. 确保引号正确配对
4. 价格使用$符号（如$120k）
5. 百分比使用%（如0.05%）

✅ **更新后立即生效**:
- 无需重启服务
- 刷新浏览器即可看到
- 响应时间<100ms

---

**最后更新**: 2025-10-09  
**文档版本**: 1.0

