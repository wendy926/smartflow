# SmartFlow 多周期共振交易策略系统

基于日线趋势过滤 + 小时确认 + 15分钟执行的高胜率高盈亏比加密货币交易策略系统。

## 🎯 策略概述

### 三层共振系统
- **大周期过滤**（4H/日线）：MA趋势、资金费率、OI变动
- **中周期确认**（1H）：VWAP、突破、放量、CVD
- **小周期执行**（15m）：回踩、触发单、止损止盈

### 核心指标
- **趋势过滤**：MA(50/200)、VWAP、资金费率≤0.1%、OI 6h变动±2%
- **入场确认**：1H突破20根高/低、成交量≥1.5×20SMA、CVD同向
- **执行时机**：15m EMA(20/50)回踩、突破触发单、ATR止损

## 🚀 快速开始

### 1. 环境准备

```bash
# 安装依赖
npm install

# 安装Wrangler CLI
npm install -g wrangler
```

### 2. 配置设置

复制配置示例文件：
```bash
cp wrangler.toml.example wrangler.toml
```

编辑 `wrangler.toml` 文件：

```toml
name = "smartflow-trader"
main = "src/index.js"
compatibility_date = "2025-01-07"

[vars]
TG_BOT_TOKEN = "your_telegram_bot_token"
TG_CHAT_ID = "your_telegram_chat_id"

[[triggers]]
cron = "0 * * * *"   # 每小时执行一次

[kv_namespaces]
{ binding = "TRADE_LOG", id = "your_kv_namespace_id" }
```

### 3. 本地测试

```bash
# 模拟测试（推荐，不依赖网络）
npm run test

# 真实API测试（需要网络连接）
npm run test:api

# 本地开发
npm run dev
```

### 4. 部署到Cloudflare

```bash
# 登录Cloudflare
wrangler login

# 部署
npm run deploy
```

## 📊 功能特性

### 核心功能
- ✅ **多品种监控**：BTC、ETH、LINK、LDO永续合约
- ✅ **实时数据获取**：K线、资金费率、持仓量、24h数据
- ✅ **策略分析**：日线趋势 + 小时确认 + 15m执行
- ✅ **WebSocket CVD**：实时计算累计净主动买量
- ✅ **Telegram推送**：信号触发即时通知
- ✅ **前端仪表板**：实时查看所有品种信号状态

### API接口
- `GET /` - 前端仪表板
- `GET /api/analyze?symbol=BTCUSDT` - 分析单个交易对
- `GET /api/analyze-all` - 分析所有交易对
- `GET /api/test` - 测试API连接

## 🔧 配置说明

### 策略参数
所有策略参数已硬编码在 `src/index.js` 中，可根据需要调整：

```javascript
// 趋势过滤参数
const trendParams = {
  maFast: 50,
  maSlow: 200,
  fundingRateMax: 0.001,  // 0.1%
  oiChangeThreshold: 0.02  // 2%
};

// 小时确认参数
const confirmParams = {
  breakoutBars: 20,
  volumeMultiple: 1.5,
  vwapRequired: true
};

// 15m执行参数
const executionParams = {
  atrPeriod: 14,
  atrMultiple: 1.2,
  riskRewardRatio: 2.0
};
```

### 监控品种
默认监控品种可在 `src/index.js` 中修改：

```javascript
this.symbols = ['BTCUSDT', 'ETHUSDT', 'LINKUSDT', 'LDOUSDT'];
```

## 📈 使用指南

### 1. 信号解读

**多头信号条件**：
- 日线：MA20 > MA50 > MA200 且价格 > MA20
- 小时：价格 > VWAP + 突破20根高点 + 放量1.5x + OI增加2% + 资金费率温和
- 15m：等待回踩EMA20/50，突破setup candle高点触发

**空头信号条件**：
- 日线：MA20 < MA50 < MA200 且价格 < MA20
- 小时：价格 < VWAP + 突破20根低点 + 放量1.5x + OI减少2% + 资金费率温和
- 15m：等待回踩EMA20/50，突破setup candle低点触发

### 2. 风险管理

**仓位管理**：
- 单笔风险：1%账户权益
- 最大持仓：3笔同时
- 日损限制：-3R停止交易

**止损止盈**：
- 止损：setup candle另一端 或 1.2×ATR(14)
- 止盈：2R目标
- 追踪：+2R后启动ATR×1.5追踪止盈

### 3. 监控建议

1. **每日检查**：早上10分钟检查日线趋势
2. **整点巡检**：每小时检查1H确认条件
3. **信号执行**：符合条件时切15m等待回踩
4. **记录复盘**：每笔交易记录到CSV，周末统计

## 🛠️ 开发调试

### 本地测试
```bash
# 运行API测试
node test/test-api.js

# 本地开发服务器
wrangler dev
```

### Cloudflare调试
```bash
# 查看日志
wrangler tail

# 查看KV存储
wrangler kv:key list --binding TRADE_LOG
```

### 常见问题

**Q: API调用失败怎么办？**
A: 检查网络连接，Binance API有IP限制，建议在Cloudflare环境中运行。

**Q: WebSocket连接不稳定？**
A: 系统会自动重连，如持续失败可检查网络环境。

**Q: 信号不准确？**
A: 建议先用模拟盘验证，调整参数后再实盘。

## 📝 更新日志

### v1.0.0 (2025-01-07)
- ✅ 初始版本发布
- ✅ 多周期共振策略实现
- ✅ Cloudflare Worker部署
- ✅ 前端仪表板
- ✅ Telegram推送
- ✅ WebSocket CVD计算

## ⚠️ 免责声明

本系统仅供学习和研究使用，不构成投资建议。加密货币交易存在高风险，可能导致本金损失。请在使用前充分了解风险，并建议先进行模拟交易验证。

## 📄 许可证

MIT License - 详见 LICENSE 文件
