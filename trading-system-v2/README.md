# SmartFlow Trading System V2.0

加密货币量化交易系统，集成V3多因子趋势策略、ICT订单块策略和AI辅助分析。

---

## 🚀 核心功能

### 📊 交易策略
- **V3多因子趋势策略**: 基于4H趋势、1H多因子、15M入场的三层分析
- **ICT订单块策略**: 订单块+流动性扫荡+吞没形态+谐波共振
- **动态仓位管理**: 基于最大损失金额的动态杠杆计算

### 🤖 AI辅助分析 (NEW)
- **AI市场风险分析**: BTC/ETH宏观风险评估（每1小时更新）
- **AI符号趋势分析**: 10个活跃交易对的6档评分体系
- **数据来源**: Coinglass、Santiment、ETF Flow、链上数据
- **AI模型**: DeepSeek（成本优化~$1/月）

### 📈 宏观数据监控
- 链上资金流监控
- 恐惧贪婪指数
- 合约市场数据（多空比、资金费率、爆仓）
- 宏观指标（美联储利率、CPI通胀率）

### 🔔 Telegram通知
- 交易触发通知
- 系统监控告警
- AI风险预警（危险/极度危险）

---

## 📖 快速开始

### 环境要求
- Node.js >= 16.x
- MySQL >= 8.0
- Redis >= 6.0
- PM2（生产环境）

### 本地开发

```bash
# 安装依赖
npm install

# 配置环境变量
cp env.example .env
# 编辑.env文件配置数据库、API密钥等

# 初始化数据库
mysql -u root < database/schema.sql
mysql -u root < database/ai-integration-schema.sql

# 启动开发服务
npm run dev
```

### 生产部署

```bash
# 使用PM2启动
pm2 start ecosystem.config.js

# 查看日志
pm2 logs main-app

# 监控状态
pm2 monit
```

---

## 📂 项目结构

```
trading-system-v2/
├── src/
│   ├── api/              # API路由和Binance接口
│   ├── services/         # 业务服务
│   │   ├── ai-agent/    # AI分析模块
│   │   ├── macro-monitor/
│   │   └── telegram-monitoring.js
│   ├── strategies/       # 交易策略
│   │   ├── v3-strategy.js
│   │   └── ict-strategy.js
│   ├── core/            # 核心模块（交易管理）
│   ├── database/        # 数据库操作
│   ├── workers/         # 后台任务
│   ├── web/            # 前端文件
│   └── main.js         # 应用入口
├── database/           # SQL迁移脚本
├── docs/
│   ├── archived-reports/  # 归档的开发报告（59个）
│   └── analysis/          # 分析文档
├── tests/              # 单元测试
├── scripts/            # 部署和工具脚本
├── prompt-analyst.md   # AI符号趋势分析Prompt
├── prompt-monitor.md   # AI宏观风险分析Prompt
├── AI_INTEGRATION_FINAL_SUMMARY.md  # AI集成总结
├── AI_SIGNAL_SCORING_GUIDE.md       # AI评分说明
└── README.md           # 本文件
```

---

## 🎯 AI评分系统

### 6档信号分级

| 分数段 | 信号 | 含义 | 操作 |
|--------|------|------|------|
| **75-100** | 强烈看多 🟢 | 多因子共振 | 积极入场20-30% |
| **60-74** | 看多 🟡 | 趋势较好 | 谨慎入场10-15% |
| **55-59** | 持有偏多 🔵 | 略偏多 | 小仓位5-10% |
| **45-54** | 持有观望 ⚪ | 方向不明 | 观望不入场 |
| **40-44** | 持有偏空 🟠 | 略偏空 | 注意风险 |
| **0-39** | 谨慎 🔴 | 趋势转弱 | 避免入场/减仓 |

**评分公式**: `总分 = (短期置信度 + 中期置信度) ÷ 2`

详细说明见: [AI_SIGNAL_SCORING_GUIDE.md](./AI_SIGNAL_SCORING_GUIDE.md)

---

## 📡 数据源

### 市场数据
- **Binance API**: 实时价格、K线、持仓量、资金费率
- **Coinglass**: 多空比、清算数据、持仓量热图
- **Alternative.me**: 恐惧贪婪指数

### AI数据源
- **Coinglass**: 资金费率、空多比、持仓量、清算数据
- **Santiment**: 链上活跃地址、社交热度、鲸鱼持仓
- **ETF Flow**: BTC/ETH ETF资金流
- **Binance**: 实时价格、成交量、持仓量历史

---

## ⏱️ 系统更新频率

| 模块 | 更新频率 |
|------|---------|
| V3/ICT策略执行 | 实时（每1-5分钟）|
| AI符号趋势分析 | 1小时 |
| AI市场风险分析 | 1小时 |
| Dashboard刷新 | 30秒 |
| 宏观数据监控 | 4小时 |

---

## 🔧 技术栈

- **后端**: Node.js + Express.js
- **数据库**: MySQL 8.0 + Redis 6.0
- **前端**: HTML5 + JavaScript + CSS3 + Chart.js
- **AI**: DeepSeek API + OpenAI (备用)
- **进程管理**: PM2
- **部署**: VPS + Nginx

---

## 📚 文档

### 在线文档
访问 https://smart.aimaventop.com/docs 查看完整文档

**章节**:
- 🤖 AI辅助分析（NEW）
- 🎯 交易策略
- 💰 风险管理
- ⚙️ 系统架构

### 本地文档
- `AI_INTEGRATION_FINAL_SUMMARY.md` - AI集成详细总结
- `AI_SIGNAL_SCORING_GUIDE.md` - AI评分逻辑完整说明
- `docs/archived-reports/` - 开发过程报告归档（59个文件）

---

## 🎊 最新更新 (2025-10-09)

### AI辅助分析系统上线
- ✅ AI市场风险分析（BTC/ETH）
- ✅ AI符号趋势分析（10个交易对）
- ✅ 6档信号分级体系
- ✅ 价格区间预测
- ✅ 下跌趋势识别
- ✅ DeepSeek模型集成

### 项目结构优化
- ✅ 归档59个开发报告
- ✅ 删除5个测试脚本
- ✅ 根目录文件从61个减少到5个（减少92%）
- ✅ 项目结构清晰整洁

---

## 📞 联系方式

- **项目**: SmartFlow Trading System
- **版本**: V2.0
- **更新**: 2025-10-09

---

**MIT License** - 仅供学习和研究使用
