# SmartFlow 交易策略系统

**版本**: v1.3.0  
**更新时间**: 2025-10-10

一个基于技术指标和AI辅助的加密货币交易策略系统，支持V3多因子趋势策略和ICT订单块策略。

---

## 🚀 快速访问

### 在线系统
```
https://smart.aimaventop.com/dashboard
```

### 功能页面
- 📊 [仪表板](https://smart.aimaventop.com/dashboard) - 策略实时状态和AI分析
- 📈 [策略执行](https://smart.aimaventop.com/strategies) - 交易记录查看
- 📉 [胜率统计](https://smart.aimaventop.com/statistics) - 策略表现统计
- 🔧 [交易工具](https://smart.aimaventop.com/tools) - 杠杆和保证金计算器
- 🖥️ [系统监控](https://smart.aimaventop.com/monitoring) - 资源和API监控
- 📖 [在线文档](https://smart.aimaventop.com/docs) - 完整系统文档

---

## ✨ 核心功能

### 双策略系统
- **V3多因子趋势策略** - 4H/1H/15M三时间框架综合分析
- **ICT订单块策略** - 订单块+流动性扫荡+谐波形态

### AI辅助分析
- **AI市场风险分析** - BTC/ETH宏观风险评估（每小时）
- **AI符号趋势分析** - 11个交易对6档评分体系
- **6档信号分级** - 强烈看多/看多/持有偏多/观望/偏空/强烈看跌
- **双向交易支持** - 同时支持做多和做空

### 实时监控
- **系统资源监控** - CPU/内存使用率（VPS真实数据）
- **API健康监控** - Binance REST/WebSocket成功率
- **Telegram自动告警** - 资源超限和API异常通知

### 风险管理
- 动态杠杆计算
- 基于ATR的止损
- 最大损失金额限制
- 交易去重检查

---

## 📚 文档导航

### 核心文档

- **[系统架构](./docs/ARCHITECTURE.md)** - 完整技术架构和模块说明
- **[用户指南](./docs/USER_GUIDE.md)** - 功能使用和操作说明
- **[API参考](./docs/API_REFERENCE.md)** - API端点和接口文档

### 功能文档

- **[AI评分说明](./docs/AI_SCORING_RANGES.md)** - AI评分区间和操作建议
- **[监控功能](./docs/MONITORING_FEATURES_SUMMARY.md)** - 系统监控和告警
- **[更新频率](./docs/STRATEGY_STATUS_TABLE_UPDATE_FREQUENCY.md)** - 数据更新机制
- **[计算频率](./docs/BACKEND_CALCULATION_FREQUENCY.md)** - 后端计算说明
- **[实时价格](./docs/REALTIME_PRICE_UPDATE_SUMMARY.md)** - 价格显示优化

### 配置文档

- **[AI提示词](./docs/prompt-analyst.md)** - AI分析提示词模板

---

## 🛠️ 技术栈

```
后端: Node.js + Express.js + PM2
数据库: MySQL 8.0 + Redis 6.0
前端: 原生JavaScript + HTML5 + CSS3
数据源: Binance Futures API
AI模型: OpenAI GPT-4o-mini
部署: VPS 2C1G + Nginx
```

---

## 📦 安装部署

### 环境要求

- Node.js 18+
- MySQL 8.0
- Redis 6.0
- PM2进程管理器

### 快速部署

```bash
# 1. 克隆代码
git clone https://github.com/wendy926/smartflow.git
cd smartflow/trading-system-v2

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp env.example .env
# 编辑.env文件，配置数据库和API密钥

# 4. 初始化数据库
mysql -u root -p trading_system < database/init.sql

# 5. 启动服务
pm2 start ecosystem.config.js

# 6. 查看状态
pm2 status
pm2 logs
```

详见: [部署指南](./docs/ARCHITECTURE.md#部署架构)

---

## 🔄 系统更新

### 最新优化 (2025-10-10)

1. **前后端数据同步**
   - 统一5分钟刷新频率
   - 策略判断不存储数据库
   - 减少90%的API调用

2. **实时价格显示**
   - AI分析双重价格（实时+历史）
   - LIVE徽章和价格变化
   - 友好的时间标注

3. **API监控系统**
   - REST/WebSocket成功率监控
   - 详细统计和自动告警
   - Telegram通知集成

4. **表格样式优化**
   - 价格列统一居中对齐
   - 视觉一致性提升

### AI分析系统 (2025-10-09)

- 6档评分体系（78/68/58/48/38/0分段）
- 双向交易支持（做多+做空）
- 智能置信度调整
- 价格区间预测

### ICT策略优化 (2025-10-09)

- 15M入场有效性检查（吞没≥60% OR 谐波≥60%）
- 扫荡检测参数优化
- 谐波形态集成

---

## 📊 项目结构

```
trading-system-v2/
├─ README.md                # 本文档
├─ docs/                    # 📚 完整文档
│  ├─ ARCHITECTURE.md       # 系统架构
│  ├─ USER_GUIDE.md         # 用户指南
│  ├─ API_REFERENCE.md      # API参考
│  └─ ...                   # 其他文档
│
├─ src/                     # 源代码
│  ├─ api/                  # API客户端和路由
│  ├─ strategies/           # 交易策略
│  ├─ services/             # 服务模块
│  ├─ workers/              # 后台进程
│  ├─ database/             # 数据库操作
│  ├─ utils/                # 工具函数
│  └─ web/                  # 前端文件
│
├─ config/                  # 配置文件
├─ database/                # 数据库脚本
├─ tests/                   # 测试文件
└─ ecosystem.config.js      # PM2配置
```

---

## 🎯 核心特性

### V3策略
- 4H趋势判断（10分制）
- 1H六因子分析
- 15M入场确认
- 动态权重分配
- MACD动能确认

### ICT策略
- 日线趋势判断
- 4H订单块检测
- 流动性扫荡识别
- 吞没形态检测
- 谐波形态共振

### AI分析
- GPT-4o-mini智能分析
- 短期和中期趋势预测
- 价格区间建议
- 置信度评估
- 每小时自动更新

### 监控告警
- 系统资源实时监控
- API健康状态监控
- Telegram自动通知
- 多级告警阈值

---

## 📱 Telegram通知

### 通知类型

- 🎯 **交易触发** - 策略触发BUY/SELL时通知
- 🤖 **AI分析** - strongBuy/strongSell信号通知
- 📢 **系统告警** - 资源超限和API异常通知

### 配置

在`.env`文件中配置：
```bash
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

---

## 📖 使用指南

### 查看策略状态
1. 访问仪表板
2. 查看策略当前状态表格
3. 参考AI分析评分
4. 关注BUY/SELL信号

### 理解AI评分
- **78+ 强烈看多**: 积极做多（100%仓位）
- **68-77 中等看多**: 可以做多（70-100%仓位）
- **58-67 持有偏多**: 轻仓试探（30-50%仓位）
- **48-57 持有观望**: 观望不动
- **38-47 持有偏空**: 轻仓做空（-30%仓位）
- **0-37 强烈看跌**: 积极做空（-70%仓位）

详见: [AI评分说明](./docs/AI_SCORING_RANGES.md)

### 监控系统健康
1. 访问系统监控页面
2. 查看CPU和内存使用率
3. 查看API成功率
4. 关注Telegram告警

---

## ⚙️ 配置说明

### 环境变量

```bash
# 数据库配置
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=trading_system

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379

# Binance API (可选)
BINANCE_API_KEY=your_key
BINANCE_API_SECRET=your_secret

# AI API配置
OPENAI_API_KEY=your_key
OPENAI_BASE_URL=https://api.openai.com/v1

# Telegram配置
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_chat_id

# 服务器配置
PORT=8080
NODE_ENV=production
```

### PM2配置

见 `ecosystem.config.js`:
- main-app: 主应用服务
- strategy-worker: 策略执行（每5分钟）
- monitor: 系统监控（每30秒）
- data-cleaner: 数据清理（每24小时）

---

## 🔍 监控指标

### 系统资源
- CPU使用率 (阈值: >60%)
- 内存使用率 (阈值: >60%)
- 磁盘使用率

### API健康
- REST API成功率 (阈值: <80%)
- WebSocket成功率 (阈值: <80%)
- 请求统计和失败次数

---

## 🤝 贡献指南

### 开发流程
1. Fork项目
2. 创建功能分支
3. 提交代码和文档
4. 发起Pull Request

### 代码规范
- 使用JSDoc注释
- 函数式编程优先
- 详细的错误处理
- 完整的日志记录

---

## 📄 许可证

Private Project

---

## 📞 联系方式

- **项目地址**: https://github.com/wendy926/smartflow
- **在线系统**: https://smart.aimaventop.com
- **问题反馈**: 通过Telegram联系

---

## 🎉 致谢

感谢以下服务提供支持：
- Binance API
- OpenAI
- Alternative.me
- FRED经济数据
