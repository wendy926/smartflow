# 宏观数据监控模块

## 概述

宏观数据监控模块是一个独立的监控系统，用于实时监控链上大额资金流、市场情绪、合约市场风险和宏观金融风险指标。该模块严格按照 `smonitor.md` 文档实现，并针对VPS 2C1G限制进行了性能优化。

## 功能特性

### 1. 资金流监控
- **BTC大额交易监控**：通过Blockchair API监控BTC大额转账（>10M USD）
- **ETH大额转账监控**：通过Etherscan API监控交易所钱包大额ETH转账（>1000 ETH）
- **实时告警**：超过阈值时自动发送告警通知

### 2. 市场情绪监控
- **恐惧贪婪指数**：通过Alternative.me API获取市场情绪指数
- **智能告警**：指数<20（极度恐惧）或>80（极度贪婪）时告警
- **实时更新**：每分钟更新一次数据

### 3. 合约市场监控
- **多空比监控**：监控Binance、Bybit、OKX的多空比数据
- **资金费率监控**：实时获取各交易所的资金费率
- **未平仓合约**：监控合约市场的未平仓合约数据
- **风险告警**：多空比异常时自动告警

### 4. 宏观指标监控
- **美联储利率**：通过FRED API获取最新利率数据
- **CPI通胀率**：计算同比通胀率并监控异常
- **阈值告警**：利率>5%或<2%，通胀率>4%或<1%时告警

## 技术架构

### 模块结构
```
src/services/macro-monitor/
├── fund-flow-monitor.js          # 资金流监控
├── market-sentiment-monitor.js   # 市场情绪监控
├── futures-market-monitor.js     # 合约市场监控
├── macro-economic-monitor.js     # 宏观指标监控
├── macro-monitor-controller.js   # 主控制器
├── performance-optimizer.js      # 性能优化器
└── README.md                     # 说明文档
```

### 数据库表
- `macro_monitoring_data`：存储监控数据
- `macro_monitoring_config`：存储配置信息
- `macro_monitoring_alerts`：存储告警记录

## API接口

### 监控状态
```http
GET /api/v1/macro-monitor/status
```

### 手动触发监控
```http
POST /api/v1/macro-monitor/trigger
```

### 获取各类数据
```http
GET /api/v1/macro-monitor/fund-flow?limit=50
GET /api/v1/macro-monitor/sentiment?limit=50
GET /api/v1/macro-monitor/futures?limit=50
GET /api/v1/macro-monitor/macro?limit=50
```

### 获取当前指标
```http
GET /api/v1/macro-monitor/sentiment/current
GET /api/v1/macro-monitor/macro/fed-funds
GET /api/v1/macro-monitor/macro/cpi
```

### 获取告警记录
```http
GET /api/v1/macro-monitor/alerts?type=FUND_FLOW&level=CRITICAL&limit=100
```

### 获取监控概览
```http
GET /api/v1/macro-monitor/overview
```

## 配置说明

### 环境变量
```bash
# Etherscan API密钥
ETHERSCAN_API_KEY=your_etherscan_key

# FRED API密钥
FRED_API_KEY=your_fred_key

# 交易所钱包地址
EXCHANGE_WALLET=0x28C6c06298d514Db089934071355E5743bf21d60
```

### 数据库配置
```sql
-- 创建宏观监控表
source database/macro-monitoring-schema.sql
```

### 监控配置
- **监控间隔**：60秒（可配置）
- **告警冷却时间**：30分钟
- **数据保留时间**：30天
- **内存阈值**：80%
- **CPU阈值**：70%

## 性能优化

### VPS 2C1G优化
1. **内存管理**：定期清理内存，防止内存泄漏
2. **CPU优化**：智能暂停监控，避免CPU过载
3. **数据库优化**：使用分区表，优化查询性能
4. **缓存策略**：Redis缓存减少数据库查询
5. **垃圾回收**：定期执行垃圾回收

### 监控指标
- 内存使用率
- CPU使用率
- 活跃句柄数
- 活跃请求数
- 垃圾回收频率

## 前端展示

### 数据卡片
- **资金流监控卡片**：显示BTC和ETH大额交易数据
- **市场情绪卡片**：显示恐惧贪婪指数和情绪状态
- **合约市场卡片**：显示多空比和资金费率
- **宏观指标卡片**：显示美联储利率和CPI通胀率

### 实时更新
- 自动刷新：30秒更新一次
- 手动刷新：点击刷新按钮
- 状态指示：正常/警告/严重

## Telegram集成

### 配置设置
在工具页面可以配置：
- Bot Token
- Chat ID
- 告警阈值设置

### 告警类型
- 资金流告警：BTC/ETH大额转账
- 市场情绪告警：极度恐惧/贪婪
- 合约市场告警：多空比异常
- 宏观指标告警：利率/通胀率异常

## 测试

### 单元测试
```bash
npm test tests/services/macro-monitor.test.js
npm test tests/api/macro-monitor.test.js
```

### 性能测试
```bash
npm run test:memory
```

## 部署说明

### 1. 数据库初始化
```bash
mysql -u root -p < database/macro-monitoring-schema.sql
```

### 2. 环境配置
```bash
cp env.example .env
# 编辑.env文件，配置API密钥
```

### 3. 启动服务
```bash
npm start
```

### 4. 验证部署
访问 `https://smart.aimaventop.com/dashboard` 查看宏观监控卡片

## 故障排除

### 常见问题
1. **API密钥错误**：检查环境变量配置
2. **数据库连接失败**：检查数据库配置和权限
3. **内存使用过高**：检查性能优化器状态
4. **监控数据不更新**：检查网络连接和API限制

### 日志查看
```bash
tail -f logs/app.log
tail -f logs/error.log
```

### 性能监控
```bash
# 查看内存使用
curl http://localhost:3000/api/v1/macro-monitor/status

# 查看性能统计
curl http://localhost:3000/api/v1/macro-monitor/status | jq '.performance'
```

## 更新日志

### v1.0.0 (2024-01-07)
- 初始版本发布
- 实现四大监控模块
- 添加性能优化器
- 集成Telegram通知
- 完成前端展示组件

## 贡献指南

1. Fork项目
2. 创建功能分支
3. 提交更改
4. 创建Pull Request

## 许可证

MIT License
