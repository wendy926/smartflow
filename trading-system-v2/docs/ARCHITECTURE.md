# SmartFlow 交易系统架构文档

**版本**: v1.3.0  
**更新时间**: 2025-10-10

---

## 📋 目录

1. [系统概述](#系统概述)
2. [技术架构](#技术架构)
3. [核心模块](#核心模块)
4. [数据流程](#数据流程)
5. [部署架构](#部署架构)
6. [性能优化](#性能优化)

---

## 系统概述

SmartFlow是一个基于技术指标和AI辅助的加密货币交易策略系统，支持V3多因子趋势策略和ICT订单块策略。

### 核心特性

- 🤖 **AI辅助分析** - 集成AI市场风险分析和趋势评估
- 📊 **双策略系统** - V3多因子 + ICT订单块
- 🎯 **多时间框架** - 4H/1H/15M综合分析
- 📱 **Telegram集成** - 交易和监控告警
- 🖥️ **实时监控** - 系统资源和API健康监控
- 💰 **风险管理** - 动态杠杆和止损计算

---

## 技术架构

### 技术栈

```
后端框架
├─ Node.js 18+
├─ Express.js 4.x
├─ PM2进程管理
└─ Axios HTTP客户端

数据存储
├─ MySQL 8.0（持久化）
└─ Redis 6.0（缓存）

前端技术
├─ 原生JavaScript (ES6+)
├─ HTML5 + CSS3
└─ Chart.js可视化

外部API
├─ Binance Futures API
├─ OpenAI GPT-4o-mini
├─ Alternative.me（恐惧贪婪指数）
└─ FRED（宏观经济数据）

部署环境
├─ VPS 2Core 1GB RAM
├─ Nginx反向代理
└─ Ubuntu Linux
```

---

## 核心模块

### 1. 策略引擎 (`src/strategies/`)

#### V3多因子趋势策略
```
策略流程:
├─ 4H趋势判断 (10分评分)
│  ├─ MA20/50/200趋势
│  ├─ ADX趋势强度
│  ├─ BBW波动率
│  └─ MACD动能
│
├─ 1H因子分析 (6分评分)
│  ├─ EMA20/50位置
│  ├─ VWAP支撑压力
│  ├─ 资金费率
│  ├─ 持仓量变化
│  ├─ Delta买卖压力
│  └─ 成交量确认
│
├─ 15M入场确认 (5分评分)
│  ├─ EMA20/50交叉
│  ├─ ADX趋势确认
│  ├─ 成交量放大
│  ├─ Delta方向一致
│  └─ 结构评分(2分)
│
└─ 信号融合
   ├─ 动态权重分配
   ├─ 趋势补偿机制
   └─ 门槛式判断
```

**评分规则**:
- 强信号: 总分≥70% 且 趋势≥5 且 因子≥4.5 且 15M≥1
- 中信号: 总分≥45% 且 趋势≥4 且 因子≥4 且 15M≥1
- 弱信号: 总分≥35% 且 趋势≥4 且 因子≥3.5 且 15M≥1

#### ICT订单块策略
```
策略流程:
├─ 1D趋势判断
│  ├─ EMA50/150/200
│  └─ 趋势方向(BULLISH/BEARISH/NEUTRAL)
│
├─ 4H结构分析
│  ├─ 订单块检测
│  │  ├─ 看涨OB（下影线≥0.15×ATR）
│  │  ├─ 看跌OB（上影线≥0.15×ATR）
│  │  └─ 年龄≤5天
│  │
│  └─ HTF流动性扫荡
│     ├─ 高点/低点突破
│     ├─ 回调速度≥0.2×ATR
│     └─ 扫荡类型判断
│
├─ 15M入场确认
│  ├─ LTF扫荡（速度≥0.02×ATR）
│  ├─ 吞没形态（强度≥60%）
│  └─ 谐波形态（分数≥60%）
│
└─ 信号生成
   └─ 15M容忍逻辑: 吞没≥60% OR 谐波≥60%
```

**关键参数**:
- 订单块高度: ≥0.15×ATR
- 订单块年龄: ≤5天
- HTF Sweep速度: ≥0.2×ATR
- LTF Sweep速度: ≥0.02×ATR
- 吞没强度阈值: ≥60%
- 谐波分数阈值: ≥60%

---

### 2. AI分析系统 (`src/services/ai-agent/`)

#### 符号趋势分析
```
分析流程:
├─ 数据收集
│  ├─ K线数据（4H/1H/15M）
│  ├─ 资金费率
│  ├─ 持仓量变化
│  ├─ ETF资金流
│  └─ 链上数据
│
├─ AI分析（OpenAI GPT-4o-mini）
│  ├─ 短期趋势（24-72h）
│  ├─ 中期趋势（7-30d）
│  ├─ 价格区间预测
│  └─ 置信度评估
│
└─ 评分计算
   ├─ 基础分数 = (短期置信度 + 中期置信度) / 2
   ├─ 趋势倾向判断（bullish/bearish/neutral）
   ├─ 看跌趋势反转分数 = 100 - 基础分数
   └─ 6档信号分级
```

**6档评分体系**:
| 分数 | 信号 | 含义 |
|------|------|------|
| 78-100 | 强烈看多 | strongBuy |
| 68-77 | 中等看多 | mediumBuy |
| 58-67 | 持有偏多 | holdBullish |
| 48-57 | 持有观望 | hold |
| 38-47 | 持有偏空 | holdBearish |
| 0-37 | 强烈看跌 | strongSell |

**更新频率**: 每小时整点（Cron: `0 * * * *`）

---

### 3. 监控系统 (`src/workers/`)

#### 系统资源监控
```
monitor.js (每30秒):
├─ CPU使用率监控
│  ├─ 数据源: os.cpus()
│  ├─ 告警阈值: >60%
│  └─ Telegram通知
│
├─ 内存使用率监控
│  ├─ 数据源: os.totalmem() / freemem()
│  ├─ 告警阈值: >60%
│  └─ Telegram通知
│
└─ API健康监控
   ├─ REST API成功率
   │  ├─ 统计: 总请求、成功、失败
   │  ├─ 告警阈值: <80%（最小10次请求）
   │  └─ Telegram通知
   │
   └─ WebSocket成功率
      ├─ 统计: 总连接、活跃、失败
      ├─ 告警阈值: <80%（最小5次连接）
      └─ Telegram通知
```

**冷却机制**: 每种告警5分钟冷却期

---

### 4. 策略执行器 (`src/workers/strategy-worker.js`)

```
执行周期: 每5分钟

执行流程:
for each symbol:
  ├─ 1. 检查现有交易止盈止损
  │
  ├─ 2. 执行V3策略分析
  │  ├─ 获取K线数据（4H/1H/15M）
  │  ├─ 计算技术指标
  │  ├─ 三时间框架分析
  │  └─ 信号融合
  │
  ├─ 3. 执行ICT策略分析
  │  ├─ 获取K线数据（1D/4H/15M）
  │  ├─ 订单块检测
  │  ├─ 扫荡和形态识别
  │  └─ 信号融合
  │
  └─ 4. 处理交易信号
     ├─ BUY/SELL → 创建交易
     │  ├─ 计算仓位
     │  ├─ 设置止损止盈
     │  ├─ 保存到数据库
     │  └─ Telegram通知
     │
     └─ HOLD → 不执行操作
```

**风险控制**:
- 交易去重检查
- 最大杠杆20倍
- 动态保证金计算
- 基于ATR的止损

---

### 5. 数据库设计

#### 核心表结构

**symbols** - 交易对配置
```sql
- id, symbol, base_currency, quote_currency
- last_price, price_change_24h
- status (active/inactive)
```

**simulation_trades** - 交易记录
```sql
- id, symbol, strategy_type, trade_type
- entry_price, stop_loss, take_profit
- quantity, leverage, margin_used
- status (OPEN/CLOSED)
- pnl, pnl_percentage
- entry_time, exit_time
```

**ai_market_analysis** - AI分析结果
```sql
- id, symbol, analysis_type
- analysis_data (JSON)
- confidence_score
- risk_level
- created_at
```

**macro_monitoring_alerts** - 监控告警
```sql
- id, alert_type, severity
- message, alert_data (JSON)
- created_at
```

---

## 数据流程

### 策略判断流程（每5分钟）

```
strategy-worker启动
  ↓
定时执行 (5分钟)
  ↓
for each symbol:
  ├─ Binance API
  │  ├─ getKlines(4H/1H/15M)
  │  ├─ getTicker24hr()
  │  ├─ getFundingRate()
  │  └─ getOpenInterestHist()
  │
  ├─ V3Strategy.execute()
  │  ├─ analyze4HTrend() → 趋势评分(0-10)
  │  ├─ analyze1HFactors() → 因子评分(0-6)
  │  ├─ analyze15mExecution() → 入场评分(0-5)
  │  └─ combineSignals() → BUY/SELL/HOLD
  │
  ├─ ICTStrategy.execute()
  │  ├─ analyzeDailyTrend() → 趋势方向
  │  ├─ detectOrderBlocks() → 订单块
  │  ├─ detect15MSweep() → 扫荡检测
  │  └─ combineSignals() → BUY/SELL/HOLD
  │
  └─ 如果信号为BUY/SELL
     ├─ calculateTradeParameters()
     ├─ TradeManager.createTrade()
     ├─ 保存到simulation_trades表
     └─ Telegram通知
```

**数据特点**:
- ❌ 策略判断**不存储**到数据库（实时计算）
- ✅ 交易记录**存储**到数据库（仅BUY/SELL触发时）

---

### AI分析流程（每小时）

```
AI调度器启动 (Cron: 0 * * * *)
  ↓
顺序分析11个交易对（间隔3秒）
  ↓
for each symbol:
  ├─ 收集市场数据
  │  ├─ K线数据
  │  ├─ 资金费率
  │  ├─ 持仓量
  │  └─ 成交量
  │
  ├─ 调用AI API (OpenAI/Grok/DeepSeek)
  │  ├─ 使用prompt-analyst.md提示词
  │  ├─ 分析短期和中期趋势
  │  ├─ 评估置信度
  │  └─ 生成价格区间预测
  │
  ├─ 智能调整置信度
  │  ├─ 检测固定值(58/62/65/67/70/71/72/75/76/78)
  │  ├─ 应用符号哈希偏移(-8到+8)
  │  └─ 增加多样性
  │
  ├─ 计算评分
  │  ├─ 基础分数 = (短期+中期) / 2
  │  ├─ 看跌反转 = 100 - 基础分数
  │  └─ 6档信号判定
  │
  ├─ 保存到ai_market_analysis表
  │
  └─ 如果信号为strongBuy/strongSell
     └─ Telegram通知
```

**AI提供商优先级**: OpenAI → Grok → DeepSeek

**电路熔断**: 连续3次全部失败 → 暂停30分钟

---

### 前端数据流程（每5分钟）

```
前端自动刷新 (5分钟)
  ↓
loadDashboardData()
  ├─ loadMacroMonitoringData()
  │  └─ GET /api/v1/macro-monitor/overview
  │
  ├─ loadStrategyCurrentStatus()
  │  ├─ GET /api/v1/strategies/current-status
  │  │  ↓
  │  │  for each symbol:
  │  │    ├─ getTicker24hr() - 实时价格
  │  │    ├─ v3Strategy.execute() - 实时计算
  │  │    ├─ ictStrategy.execute() - 实时计算
  │  │    └─ 查询simulation_trades表
  │  │
  │  └─ GET /api/v1/trades?limit=100
  │
  └─ AI分析模块
     └─ GET /api/v1/ai/macro-risk
        ├─ 查询ai_market_analysis表
        ├─ 获取实时价格（Binance API）
        └─ 返回双重价格显示
```

**前端特点**:
- ✅ 前后端统一5分钟刷新
- ❌ 前端不做计算，统一使用后端数据
- ✅ 支持手动刷新

---

## 部署架构

### VPS部署结构

```
VPS (2Core 1GB RAM)
├─ Nginx (80/443)
│  ├─ 反向代理 → localhost:8080
│  ├─ SSL证书（smart.aimaventop.com）
│  └─ 静态文件服务
│
├─ PM2进程管理
│  ├─ main-app (端口8080)
│  │  ├─ Express服务器
│  │  ├─ REST API路由
│  │  ├─ 静态文件服务
│  │  └─ AI调度器
│  │
│  ├─ strategy-worker (后台)
│  │  ├─ 策略执行（每5分钟）
│  │  ├─ 交易检查
│  │  └─ 止盈止损监控
│  │
│  ├─ monitor (后台)
│  │  ├─ 系统资源监控（每30秒）
│  │  ├─ API健康监控
│  │  └─ Telegram告警
│  │
│  └─ data-cleaner (后台)
│     └─ 数据清理（每24小时）
│
├─ MySQL 8.0 (localhost:3306)
│  ├─ trading_system数据库
│  └─ 连接池（最大10连接）
│
└─ Redis 6.0 (localhost:6379)
   └─ 缓存热点数据
```

### 目录结构

```
trading-system-v2/
├─ src/
│  ├─ api/
│  │  ├─ binance-api.js           # Binance API客户端
│  │  ├─ binance-api-singleton.js # 单例管理器
│  │  └─ routes/                  # API路由
│  │     ├─ strategies.js         # 策略API
│  │     ├─ ai-analysis.js        # AI分析API
│  │     ├─ monitoring.js         # 监控API
│  │     └─ ...
│  │
│  ├─ strategies/
│  │  ├─ v3-strategy.js           # V3多因子策略
│  │  ├─ ict-strategy.js          # ICT订单块策略
│  │  └─ ...
│  │
│  ├─ services/
│  │  ├─ ai-agent/
│  │  │  ├─ symbol-trend-analyzer.js  # AI符号分析
│  │  │  ├─ unified-ai-client.js      # AI客户端
│  │  │  └─ scheduler.js              # AI调度器
│  │  │
│  │  └─ macro-monitoring.js      # 宏观监控服务
│  │
│  ├─ workers/
│  │  ├─ strategy-worker.js       # 策略执行进程
│  │  ├─ monitor.js               # 系统监控进程
│  │  └─ data-cleaner.js          # 数据清理进程
│  │
│  ├─ database/
│  │  ├─ operations.js            # 数据库操作
│  │  └─ ai-operations.js         # AI数据操作
│  │
│  ├─ utils/
│  │  ├─ technical-indicators.js  # 技术指标计算
│  │  └─ logger.js                # 日志工具
│  │
│  ├─ web/
│  │  ├─ index.html               # 主页面
│  │  ├─ app.js                   # 前端应用
│  │  ├─ styles.css               # 全局样式
│  │  └─ public/
│  │     ├─ js/
│  │     │  └─ ai-analysis.js     # AI分析模块
│  │     └─ css/
│  │        └─ ai-analysis.css    # AI分析样式
│  │
│  └─ server.js                   # Express服务器
│
├─ docs/
│  ├─ ARCHITECTURE.md             # 本文档
│  ├─ API_REFERENCE.md            # API参考
│  ├─ USER_GUIDE.md               # 用户指南
│  ├─ DEPLOYMENT_GUIDE.md         # 部署指南
│  ├─ AI_SCORING_RANGES.md        # AI评分说明
│  ├─ prompt-analyst.md           # AI提示词
│  └─ archived-process-docs/      # 历史文档归档
│
├─ config/                         # 配置文件
├─ database/                       # 数据库脚本
├─ tests/                          # 测试文件
├─ ecosystem.config.js             # PM2配置
└─ README.md                       # 项目说明
```

---

## 性能优化

### 内存优化（VPS 1GB限制）

**策略**:
1. **单例模式** - BinanceAPI共享实例
2. **连接池** - MySQL最大10连接
3. **Redis缓存** - 减少数据库查询
4. **及时释放** - K线数据用后即释放
5. **避免全量查询** - 限制查询条数

### API调用优化

**并行处理**:
```javascript
// 并行获取多个数据源
const [klines4H, klines1H, klines15M, ticker, funding, oi] = 
  await Promise.all([
    binanceAPI.getKlines(symbol, '4h', 250),
    binanceAPI.getKlines(symbol, '1h', 50),
    binanceAPI.getKlines(symbol, '15m', 50),
    binanceAPI.getTicker24hr(symbol),
    binanceAPI.getFundingRate(symbol),
    binanceAPI.getOpenInterestHist(symbol, '1h', 7)
  ]);
```

**速率限制**:
- Binance API: 1200次/分钟
- 请求计数器自动重置
- 超限抛出错误

### AI调用优化

**顺序执行**:
- 避免并发调用导致速率限制
- 每个符号间隔3秒
- 电路熔断机制

**成本控制**:
- 使用GPT-4o-mini（低成本）
- 备用DeepSeek（更低成本）
- 缓存1小时避免重复分析

---

## 监控告警体系

### 告警类型

| 告警类型 | 触发条件 | 通知渠道 | 冷却期 |
|---------|---------|---------|--------|
| CPU_HIGH | >60% | Telegram | 5分钟 |
| MEMORY_HIGH | >60% | Telegram | 5分钟 |
| API_REST_LOW | <80% | Telegram | 5分钟 |
| API_WS_LOW | <80% | Telegram | 5分钟 |
| AI_STRONG_BUY | AI信号 | Telegram | 1小时 |
| AI_STRONG_SELL | AI信号 | Telegram | 1小时 |
| TRADE_OPENED | 交易触发 | Telegram | - |

### Telegram配置

**环境变量**:
```bash
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

**消息格式**:
```
📢 系统监控告警
━━━━━━━━━━━━━
类型: MEMORY_HIGH
消息: 内存使用率过高: 81.6%
时间: 2025-10-10 15:30:00

详情:
- 内存使用: 81.6%
- 阈值: 60%
```

---

## 更新频率总览

| 数据类型 | 前端展示 | 后端计算 | 数据存储 |
|---------|---------|---------|---------|
| 策略判断 | 5分钟 | 5分钟 | ❌ 不存储 |
| AI分析 | 1小时 | 1小时 | ✅ 存储 |
| 交易记录 | 5分钟查询 | 触发时 | ✅ 存储 |
| 系统资源 | 按需 | 30秒 | ❌ 不存储 |
| API统计 | 按需 | 实时 | ❌ 不存储 |

---

## API端点总览

### 策略相关
- `GET /api/v1/strategies/current-status` - 策略当前状态
- `GET /api/v1/strategies/statistics` - 策略统计
- `POST /api/v1/strategies/v3/execute` - 执行V3策略
- `POST /api/v1/strategies/ict/execute` - 执行ICT策略

### AI分析
- `GET /api/v1/ai/macro-risk?symbols=BTC,ETH` - 宏观风险分析
- `GET /api/v1/ai/symbol-analysis?symbol=BTCUSDT` - 符号趋势分析

### 监控
- `GET /api/v1/monitoring/system` - 系统监控数据
- `GET /api/v1/macro-monitor/overview` - 宏观监控概览

### 交易
- `GET /api/v1/trades?limit=100` - 交易记录
- `GET /api/v1/trades/statistics` - 交易统计

---

## 安全性

### API安全
- 速率限制保护
- 错误重试机制
- 超时控制
- 异常捕获和日志

### 数据安全
- SQL参数化查询
- 输入验证
- 错误信息脱敏
- 定期数据备份

---

## 日志系统

### 日志级别
- `error` - 错误和异常
- `warn` - 警告信息
- `info` - 一般信息
- `debug` - 调试信息

### 日志文件
```
logs/
├─ main-app-out-0.log     # 主应用输出
├─ main-app-error-0.log   # 主应用错误
├─ strategy-worker-*.log  # 策略worker日志
└─ monitor-*.log          # 监控日志
```

---

## 🎯 系统特点总结

### 优势

1. **高性能**
   - 并行API调用
   - Redis缓存优化
   - 单例模式减少开销

2. **高可靠性**
   - PM2自动重启
   - 错误恢复机制
   - 监控告警

3. **可扩展性**
   - 模块化设计
   - 策略插件化
   - AI模型可切换

4. **用户友好**
   - 实时数据展示
   - 清晰的信号分级
   - Telegram即时通知

### 限制

1. **VPS资源** - 1GB内存限制
2. **API速率** - Binance限流
3. **AI成本** - Token消耗
4. **模拟交易** - 非实盘交易

---

## 相关文档

- [API参考文档](./API_REFERENCE.md)
- [用户使用指南](./USER_GUIDE.md)
- [部署指南](./DEPLOYMENT_GUIDE.md)
- [AI评分说明](./AI_SCORING_RANGES.md)
- [监控功能说明](./MONITORING_FEATURES_SUMMARY.md)

