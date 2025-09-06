# SmartFlow 告警系统配置

## 告警规则

### 触发条件
- **数据收集率 < 99%** 时触发告警
- **信号分析率 < 99%** 时触发告警
- **模拟交易不参与告警检查**（按用户要求）

### 告警阈值
```javascript
alertThresholds: {
  dataCollection: 99,    // 数据收集率阈值
  signalAnalysis: 99,    // 信号分析率阈值
  simulationTrading: 99  // 模拟交易阈值（不参与告警）
}
```

## 告警类型

### 1. 系统级告警
当整体数据收集率或信号分析率低于99%时触发：

```
🚨 SmartFlow 系统告警

📊 系统概览：
• 总交易对: 11
• 健康状态: 0
• 警告状态: 11

⚠️ 告警详情：
• 数据收集率: 100.0% ✅
• 信号分析率: 100.0% ✅

🌐 网页链接：https://smart.aimaventop.com
⏰ 告警时间：2025-09-06 14:30:00
```

### 2. 交易对级告警
当单个交易对的数据收集率或信号分析率低于99%时触发：

```
⚠️ BTCUSDT 交易对告警

📊 告警详情：
• 数据收集率: 95.0% (成功: 19/20)
• 信号分析率: 90.0% (成功: 9/10)

🔄 刷新频率：30秒
⏰ 最后更新：2025-09-06 14:30:00

🌐 网页链接：https://smart.aimaventop.com
```

## 告警检查频率

- **自动检查**: 每10分钟检查一次
- **手动触发**: 通过API `/api/trigger-alert-check` 手动触发
- **测试告警**: 通过API `/api/test-monitoring-alert` 测试告警功能

## 健康状态计算

### 整体健康率
```javascript
// 只考虑数据收集率和信号分析率，各占50%
const overallRate = (dataCollectionRate + signalAnalysisRate) / 2;
const isHealthy = overallRate >= 99;
```

### 交易对健康率
```javascript
// 每个交易对的健康率也只考虑数据收集和信号分析
const symbolOverallRate = (dataCollectionRate + signalAnalysisRate) / 2;
```

## 配置说明

### 告警阈值设置
```javascript
// 在 DataMonitor 构造函数中设置
this.alertThresholds = {
  dataCollection: 99,    // 数据收集率阈值
  signalAnalysis: 99,    // 信号分析率阈值
  simulationTrading: 99  // 模拟交易阈值（不参与告警）
};
```

### Telegram机器人配置
- **复用现有机器人**: 使用环境变量中的 `TELEGRAM_BOT_TOKEN` 和 `TELEGRAM_CHAT_ID`
- **消息格式**: 支持HTML格式，包含表情符号和链接
- **告警频率**: 避免重复告警，每次检查只发送一次

## API端点

### 1. 手动触发告警检查
```http
POST /api/trigger-alert-check
```

### 2. 测试监控告警
```http
POST /api/test-monitoring-alert
```

### 3. 获取监控数据
```http
GET /api/monitoring-dashboard
```

## 部署和测试

### 1. 部署更新
```bash
# 在VPS上执行
cd /home/admin/smartflow-vps-app/vps-app
git pull origin main
pm2 restart smartflow-app
```

### 2. 测试告警功能
```bash
# 测试告警检查
curl -X POST http://localhost:8080/api/trigger-alert-check

# 测试监控告警
curl -X POST http://localhost:8080/api/test-monitoring-alert
```

### 3. 查看告警日志
```bash
# 查看PM2日志
pm2 logs smartflow-app --lines 50
```

## 监控面板增强

### 新增功能
1. **三视图切换**: 汇总视图、详细视图、原始数据视图
2. **详细指标**: 显示成功/尝试次数、最后更新时间
3. **信号状态**: 直观显示入场执行、信号确认、趋势信号状态
4. **原始数据**: 完整的JSON格式原始数据展示

### 视图说明
- **汇总视图**: 传统的监控表格，显示关键指标
- **详细视图**: 详细的监控信息，包含时间戳和具体数据
- **原始数据**: 完整的JSON数据，用于调试和分析

## 注意事项

1. **告警频率**: 每10分钟检查一次，避免过于频繁的告警
2. **数据准确性**: 告警基于实际的数据收集和信号分析成功率
3. **Telegram限制**: 注意Telegram API的速率限制
4. **错误处理**: 告警检查失败时会记录错误日志，不影响主程序运行

## 故障排除

### 常见问题
1. **告警不发送**: 检查Telegram配置和网络连接
2. **告警过于频繁**: 调整检查频率或阈值
3. **数据不准确**: 检查数据收集和信号分析的记录逻辑

### 调试方法
1. 查看PM2日志: `pm2 logs smartflow-app`
2. 手动触发告警: `curl -X POST http://localhost:8080/api/trigger-alert-check`
3. 查看监控数据: `curl http://localhost:8080/api/monitoring-dashboard`
