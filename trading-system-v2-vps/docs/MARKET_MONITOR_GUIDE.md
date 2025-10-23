# 📊 市场监控配置指南

## 概述

AI市场风险分析模块已重构为**配置文件驱动模式**，不再使用AI Agent和prompt-monitor.md。通过简单编辑JSON配置文件即可更新前端展示。

---

## ✅ 优势

| 对比项 | 旧方案（AI Agent） | 新方案（配置文件） |
|-------|------------------|------------------|
| 成本 | 每次调用消耗token | 完全免费 |
| 速度 | 15-20秒 | <100ms |
| 准确性 | AI可能误判 | 人工控制，100%准确 |
| 稳定性 | 依赖API可用性 | 本地文件，极稳定 |
| 维护 | 需要监控AI服务 | 简单编辑JSON |
| 灵活性 | 受prompt限制 | 完全自定义 |

---

## 📁 配置文件位置

```bash
trading-system-v2/config/market-monitor.json
```

---

## 📝 配置文件格式

```json
{
  "lastUpdate": "2025-10-09T08:50:00+08:00",
  "artifactUrl": "https://claude.ai/public/artifacts/8712090a-7b76-476e-bbc8-6920f6b5f4b8",
  "BTC": {
    "alertLevel": "中度关注",
    "alertColor": "warning",
    "tradingSuggestion": "价格在$123k附近震荡，建议等待明确突破或回调至$120k支撑位再考虑入场",
    "riskWarning": "资金费率偏低显示多头谨慎，高持仓量增加市场脆弱性，注意$120k支撑"
  },
  "ETH": {
    "alertLevel": "低度关注",
    "alertColor": "safe",
    "tradingSuggestion": "相对BTC表现稳健，可关注$3,500-$3,600区间震荡机会",
    "riskWarning": "跟随BTC走势，独立性较弱，建议观望为主"
  }
}
```

---

## 🎨 字段说明

### 全局字段

| 字段 | 类型 | 说明 | 示例 |
|-----|------|-----|------|
| `lastUpdate` | string | 更新时间（ISO 8601格式） | `2025-10-09T08:50:00+08:00` |
| `artifactUrl` | string | Claude Artifact详细分析链接 | `https://claude.ai/public/...` |

### BTC/ETH字段

| 字段 | 类型 | 可选值 | 说明 |
|-----|------|-------|------|
| `alertLevel` | string | 任意文本 | 告警级别文本，如"中度关注"、"高度警戒" |
| `alertColor` | string | `safe`, `warning`, `danger`, `extreme` | 颜色主题 |
| `tradingSuggestion` | string | 任意文本 | 交易建议 |
| `riskWarning` | string | 任意文本 | 风险提示 |

### alertColor颜色映射

| 值 | 图标 | 背景色 | 边框色 | 文字颜色 | 适用场景 |
|----|------|--------|--------|---------|---------|
| `safe` | 🟢 | 淡绿色 | 绿色 | 深绿 | 市场健康 |
| `warning` | 🟡 | 淡黄色 | 黄色 | 深黄 | 需要关注 |
| `danger` | 🔴 | 淡红色 | 红色 | 深红 | 高风险 |
| `extreme` | ⚫ | 淡灰色 | 黑色 | 深灰 | 极度危险 |

**注意**: `danger`和`extreme`会触发脉冲动画效果。

---

## 🔄 更新流程

### 本地更新（推荐）

```bash
# 1. 编辑配置文件
vim trading-system-v2/config/market-monitor.json

# 2. 提交到GitHub
cd trading-system-v2
git add config/market-monitor.json
git commit -m "update: 更新市场监控数据 - [简要说明]"
git push origin main

# 3. VPS拉取更新（无需重启服务）
ssh -i ~/.ssh/smartflow_vps_new root@47.237.163.85
cd /home/admin/trading-system-v2/trading-system-v2
git pull origin main
```

### VPS直接更新（快速）

```bash
# SSH到VPS
ssh -i ~/.ssh/smartflow_vps_new root@47.237.163.85

# 编辑配置
cd /home/admin/trading-system-v2/trading-system-v2
vim config/market-monitor.json

# 无需重启服务，刷新浏览器即可看到更新
```

---

## 🌐 前端展示效果

### 卡片布局

```
┌─────────────────────────────────────────┐
│ 🟡 BTC 市场监控      [ 中度关注 ]       │
├─────────────────────────────────────────┤
│ 📊 交易建议:                            │
│ 价格在$123k附近震荡，建议等待明确突破    │
│ 或回调至$120k支撑位再考虑入场            │
│                                          │
│ ⚠️ 风险提示:                            │
│ 资金费率偏低显示多头谨慎，高持仓量增加   │
│ 市场脆弱性，注意$120k支撑                │
├─────────────────────────────────────────┤
│ 更新: 2小时前    [ 查看详细分析 → ]     │
└─────────────────────────────────────────┘
```

### 交互功能

1. **刷新按钮**: 重新读取配置文件（约100ms）
2. **详细分析链接**: 点击跳转到`artifactUrl`（新窗口打开）
3. **自动更新**: 每2小时自动刷新（与页面同步）
4. **响应式设计**: 自适应桌面/移动端

---

## 📋 使用示例

### 示例1: BTC突破新高

```json
{
  "lastUpdate": "2025-10-09T10:00:00+08:00",
  "artifactUrl": "https://claude.ai/public/artifacts/...",
  "BTC": {
    "alertLevel": "高度警戒",
    "alertColor": "danger",
    "tradingSuggestion": "BTC突破$125k创历史新高，短期追多风险极大，建议等待回踩$122k-$123k再入场",
    "riskWarning": "资金费率飙升至0.05%，多头杠杆过高，随时可能出现瀑布式回调，严控仓位"
  }
}
```

**效果**: 红色卡片 + 脉冲动画 + 🔴图标

### 示例2: ETH相对强势

```json
{
  "ETH": {
    "alertLevel": "积极观察",
    "alertColor": "safe",
    "tradingSuggestion": "ETH/BTC比率回升，显示资金回流，可在$3,600-$3,650轻仓布局，目标$3,800",
    "riskWarning": "需关注BTC走势，若BTC深度回调ETH难以独立走强"
  }
}
```

**效果**: 绿色卡片 + 🟢图标

### 示例3: 市场极度危险

```json
{
  "BTC": {
    "alertLevel": "极度危险",
    "alertColor": "extreme",
    "tradingSuggestion": "立即清仓或严格止损，市场出现恐慌性抛售，不建议任何操作",
    "riskWarning": "大量爆仓、资金费率负值、链上鲸鱼抛售，市场进入极端恐慌状态"
  }
}
```

**效果**: 黑色卡片 + 强脉冲动画 + ⚫图标

---

## 🔧 技术细节

### API端点

```
GET /api/v1/ai/macro-risk
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "BTCUSDT": {
      "symbol": "BTCUSDT",
      "alertLevel": "中度关注",
      "alertColor": "warning",
      "tradingSuggestion": "...",
      "riskWarning": "...",
      "updatedAt": "2025-10-09T08:50:00+08:00"
    },
    "ETHUSDT": { ... }
  },
  "lastUpdate": "2025-10-09T08:50:00+08:00",
  "artifactUrl": "https://claude.ai/public/artifacts/..."
}
```

### 文件读取流程

```
浏览器 → API请求 → Express路由 → 读取JSON文件 → 解析返回 → 前端渲染
```

**性能**: <100ms（本地文件读取）

### 缓存策略

- **无缓存**: 每次请求都读取最新文件
- **原因**: 文件读取速度极快（<10ms），无需缓存
- **优势**: 配置更新后立即生效，无需等待缓存过期

---

## 🎯 最佳实践

### 1. 更新频率

建议根据市场波动调整：
- **平静期**: 每日1-2次
- **波动期**: 每4-6小时
- **剧烈波动**: 每1-2小时
- **极端行情**: 随时更新

### 2. 文本编写

**交易建议**:
- ✅ 具体价格区间: "$123k-$125k"
- ✅ 明确操作方向: "建议等待回调"、"可轻仓布局"
- ✅ 目标和止损: "目标$130k，止损$120k"
- ❌ 模糊表述: "可能会涨"、"不太确定"

**风险提示**:
- ✅ 数据支撑: "资金费率0.05%"、"持仓量$40B"
- ✅ 具体风险: "高持仓量增加回调风险"
- ✅ 关键位置: "关注$120k支撑"
- ❌ 空洞警告: "有风险"、"需谨慎"

### 3. 告警级别

建议使用统一的级别体系：
- **安全区域**: "正常"、"健康"、"稳定"
- **关注区域**: "低度关注"、"中度关注"
- **警戒区域**: "高度警戒"、"危险"
- **极端区域**: "极度危险"、"紧急避险"

### 4. 链接管理

- 定期检查`artifactUrl`是否可访问
- 考虑使用短链接服务（bit.ly等）
- 可以指向不同的分析页面（如每日/每周报告）

---

## 🛠️ 故障排查

### 问题1: 前端显示"暂无监控数据"

**原因**: JSON文件格式错误或字段缺失

**解决**:
```bash
# 验证JSON格式
cat config/market-monitor.json | jq .

# 如果报错，检查:
# - 逗号是否缺失或多余
# - 引号是否配对
# - 括号是否匹配
```

### 问题2: 更新后前端未显示

**原因**: 浏览器缓存

**解决**:
```
1. 硬刷新: Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows)
2. 清除缓存并刷新
3. 无痕模式测试
```

### 问题3: API返回500错误

**原因**: 文件读取权限或路径问题

**解决**:
```bash
# 检查文件存在
ls -l config/market-monitor.json

# 检查文件权限
chmod 644 config/market-monitor.json

# 查看服务日志
pm2 logs main-app | grep market-monitor
```

### 问题4: 链接无法跳转

**原因**: `artifactUrl`格式错误

**解决**:
```json
// 确保URL是完整的
"artifactUrl": "https://claude.ai/public/artifacts/..."

// 不要使用相对路径或省略协议
❌ "artifactUrl": "claude.ai/..."
❌ "artifactUrl": "//claude.ai/..."
```

---

## 📊 监控指标建议

在编写配置时，可以参考以下指标：

### BTC关键指标
- **价格**: 当前价格、ATH距离、支撑/阻力位
- **持仓量**: Open Interest、30日平均值
- **资金费率**: Funding Rate、历史百分位
- **ETF流向**: 净流入/流出、连续天数
- **链上数据**: 鲸鱼持仓、活跃地址
- **市场结构**: 扫荡、假突破、真突破

### ETH关键指标
- **ETH/BTC比率**: 相对强弱
- **L2活动**: Arbitrum、Optimism TVL
- **质押率**: Staking ratio变化
- **Gas费**: 网络拥堵程度
- **DeFi TVL**: 资金流入/流出

---

## 📅 版本历史

| 版本 | 日期 | 变更 |
|-----|------|------|
| v2.0 | 2025-10-09 | 重构为配置文件模式 |
| v1.0 | 2025-10-08 | 初始AI Agent版本 |

---

## 🎁 附录

### 完整示例配置

```json
{
  "lastUpdate": "2025-10-09T12:00:00+08:00",
  "artifactUrl": "https://claude.ai/public/artifacts/8712090a-7b76-476e-bbc8-6920f6b5f4b8",
  "BTC": {
    "alertLevel": "中度关注",
    "alertColor": "warning",
    "tradingSuggestion": "BTC在$123k-$125k区间震荡，短期方向不明。建议多单在$120k设置止损，空单等待突破$125k站稳再入场。当前波动率较高，不建议高杠杆操作",
    "riskWarning": "资金费率0.008%处于低位，显示多头杠杆热情降温。持仓量$39.5B创新高，市场脆弱性增加。ETF连续3日净流出共$1.2B，机构谨慎。关键支撑$120k，阻力$125k"
  },
  "ETH": {
    "alertLevel": "低度关注", 
    "alertColor": "safe",
    "tradingSuggestion": "ETH/BTC比率0.0288回升，资金有回流迹象。可在$3,550-$3,600轻仓布局，目标$3,750-$3,800，止损$3,500。仓位控制在总资金10%以内",
    "riskWarning": "跟随BTC走势为主，独立性较弱。若BTC出现深度回调，ETH难以独立走强。L2活动平稳，质押率持续上升，长期基本面健康"
  }
}
```

### 快捷更新脚本

创建`update-monitor.sh`：
```bash
#!/bin/bash
# 快速更新市场监控配置

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S+08:00")
CONFIG_FILE="config/market-monitor.json"

# 备份
cp $CONFIG_FILE $CONFIG_FILE.bak

# 使用jq更新时间戳
jq ".lastUpdate = \"$TIMESTAMP\"" $CONFIG_FILE > $CONFIG_FILE.tmp
mv $CONFIG_FILE.tmp $CONFIG_FILE

echo "✅ 已更新时间戳: $TIMESTAMP"
```

使用:
```bash
chmod +x update-monitor.sh
./update-monitor.sh
```

---

## 💡 提示

1. **备份**: 每次修改前备份配置文件
2. **验证**: 修改后使用`jq`验证JSON格式
3. **测试**: 先在本地测试，确认无误再部署
4. **日志**: 记录每次更新的原因和时间
5. **权限**: 确保文件权限正确（644）

---

## 📞 技术支持

如有问题，请检查：
1. 配置文件格式是否正确
2. API端点是否可访问
3. PM2日志是否有错误
4. 浏览器Console是否有报错

---

**最后更新**: 2025-10-09  
**文档版本**: 1.0  
**维护者**: Trading System Team

