# SmartFlow 交易策略系统

基于多周期共振的高胜率高盈亏比加密货币交易策略系统，集成斐波拉契滚仓计算器。

## 项目结构

```
smartflow/
├── vps-app/                           # VPS应用核心目录
│   ├── server.js                     # 主服务器文件
│   ├── package.json                  # 依赖管理
│   ├── ecosystem.config.js           # PM2配置
│   ├── modules/                      # 核心模块
│   │   ├── api/                      # API模块
│   │   │   ├── BinanceAPI.js         # Binance API接口
│   │   │   └── RateLimiter.js        # 智能限流器
│   │   ├── database/                 # 数据库模块
│   │   │   ├── DatabaseManager.js    # 数据库管理
│   │   │   └── SimulationManager.js  # 模拟交易管理
│   │   ├── monitoring/               # 监控模块
│   │   │   └── DataMonitor.js        # 数据监控
│   │   ├── notifications/            # 通知模块
│   │   │   └── TelegramNotifier.js   # Telegram通知
│   │   ├── strategy/                 # 策略模块
│   │   │   └── SmartFlowStrategy.js  # 核心策略逻辑
│   │   └── utils/                    # 工具模块
│   │       ├── DataCache.js          # 数据缓存
│   │       └── TechnicalIndicators.js # 技术指标
│   ├── public/                       # 前端资源
│   │   ├── index.html                # 主界面
│   │   ├── rollup-calculator.html    # 斐波拉契滚仓计算器
│   │   ├── css/main.css              # 样式文件
│   │   └── js/                       # JavaScript文件
│   │       ├── main.js               # 主逻辑
│   │       ├── api.js                # API客户端
│   │       ├── data/DataManager.js   # 数据管理
│   │       └── components/Modal.js   # 组件
│   ├── deploy.sh                     # 部署脚本
│   └── smartflow.db                  # SQLite数据库
├── strategy.md                       # 策略文档
├── auto-script.md                    # 自动化脚本文档
├── MONITORING_GUIDE.md               # 监控指南
└── README.md                         # 项目说明
```

## 核心功能

### 1. 交易策略分析
- **多周期共振**：日线趋势过滤 + 小时级多因子打分 + 15分钟双模式执行
- **日线趋势过滤**：价格vs MA200 + MA20/50排列 + ADX趋势强度 + 布林带开口扩张
- **小时级打分体系**：6个条件各1分，≥2分进入15m观察，≥4分强信号
- **15分钟执行**：回踩确认模式（胜率高）+ 动能突破模式（机会多）
- **技术指标**：MA、ADX、布林带、VWAP、ATR、EMA、Delta、CVD
- **市场数据**：资金费率、持仓量变化、成交量分析、买卖盘不平衡
- **风险控制**：1.5R分批止盈、追踪止损、杠杆计算、保证金管理

### 2. 斐波拉契滚仓计算器
- **初单计算**：基于最大损失金额和订单区计算建议保证金
- **止损价格**：确保止损价格低于订单区下沿价格
- **杠杆策略**：动态计算策略和固定序列策略
- **滚仓路径**：基于0.618黄金回调法的加仓策略
- **风险控制**：本金保护、最大回撤计算

### 3. 数据监控与告警
- **数据质量监控**：实时监控数据收集成功率和质量
- **告警系统**：Telegram机器人通知数据异常
- **错误追踪**：详细记录数据收集和分析错误
- **健康状态**：系统整体健康状态评估

### 4. 历史数据记录
- **信号记录**：自动记录所有信号出现时的完整数据
- **执行记录**：记录入场执行时的所有分析指标
- **结果标记**：支持标记信号/执行结果为正确/错误/未标记
- **复盘分析**：完整的历史数据支持策略优化

### 5. 前端界面
- **实时监控**：当前市场状态和信号展示
- **多因子显示**：小时级得分、执行模式、信号强度
- **折叠表格**：第一层显示核心数据，第二层显示历史记录
- **数据监控**：原始数据获取成功率和错误追踪
- **规则说明**：完整的策略规则和指标说明
- **用户设置**：可自定义刷新频率和最大损失金额

## 快速开始

### 1. 安装依赖
```bash
npm run install-deps
```

### 2. 启动服务
```bash
npm start
```

### 3. 部署到VPS
```bash
npm run deploy
```

## 技术栈

- **后端**：Node.js + Express + SQLite3
- **前端**：HTML5 + CSS3 + JavaScript
- **数据源**：Binance Futures API
- **实时数据**：WebSocket连接
- **数据库**：SQLite轻量级数据库
- **进程管理**：PM2

## API接口

### 主要接口
- `GET /` - 主界面
- `GET /rollup-calculator.html` - 斐波拉契滚仓计算器
- `GET /api/signals` - 获取所有交易对信号数据
- `GET /api/monitoring-dashboard` - 获取监控中心数据
- `GET /api/history/:symbol?` - 获取历史记录
- `POST /api/mark-result` - 标记结果

### 用户设置接口
- `GET /api/user-settings` - 获取用户设置
- `POST /api/user-settings` - 保存用户设置

### 告警接口
- `POST /api/trigger-alert-check` - 手动触发告警检查
- `POST /api/test-data-quality-alert` - 测试数据质量告警

### 系统接口
- `GET /api/websocket-status` - WebSocket状态
- `GET /api/health` - 系统健康检查

## 配置说明

### 默认交易对
- BTCUSDT, ETHUSDT, LINKUSDT, LDOUSDT, SOLUSDT

### 数据刷新设置
- **自动刷新间隔**：用户可自定义（5分钟、15分钟、30分钟、1小时、4小时、1天）
- **数据缓存时间**：30秒
- **缓存清理间隔**：5分钟
- **倒计时显示**：实时显示下次刷新时间

### 告警配置
- **数据收集率阈值**：低于100%触发告警
- **数据验证错误**：任何验证错误触发告警
- **数据质量问题**：分析失败触发告警
- **告警冷却期**：30分钟防止重复告警

### 用户设置
- **刷新频率**：持久化存储用户选择的刷新间隔
- **最大损失金额**：用于斐波拉契滚仓计算器
- **设置同步**：页面刷新后自动恢复用户设置

## 部署要求

### 系统要求
- **Node.js**：>= 18.0.0
- **内存**：2GB+ 推荐
- **存储**：30GB+ 可用空间
- **网络**：稳定的网络连接，可访问Binance API

### 推荐配置
- **VPS地区**：新加坡、香港等亚洲地区
- **CPU**：2核心以上
- **带宽**：10Mbps以上
- **操作系统**：Ubuntu 20.04+ 或 CentOS 8+

## 监控与维护

### 数据质量监控
- 实时监控数据收集成功率
- 自动检测数据验证错误
- 记录数据质量问题详情
- Telegram告警通知

### 系统维护
1. **定期备份**：数据库文件 `smartflow.db`
2. **日志监控**：PM2日志和系统日志
3. **资源监控**：CPU、内存、磁盘使用率
4. **网络监控**：API连接状态和响应时间

### 故障排除
- 检查PM2进程状态：`pm2 status`
- 查看应用日志：`pm2 logs smartflow-app`
- 重启应用：`pm2 restart smartflow-app`
- 检查数据库：`sqlite3 smartflow.db .tables`

## 访问地址

- **主页**: https://smart.aimaventop.com/
- **API端点**: https://smart.aimaventop.com/api/signals
- **监控面板**: https://smart.aimaventop.com/api/monitoring-dashboard
- **斐波拉契计算器**: https://smart.aimaventop.com/rollup-calculator.html

### 备用访问地址 (IP直连)
- **主页**: http://47.237.163.85:8080/
- **API端点**: http://47.237.163.85:8080/api/signals
- **监控面板**: http://47.237.163.85:8080/api/monitoring-dashboard
- **斐波拉契计算器**: http://47.237.163.85:8080/rollup-calculator.html

## 域名配置

### SSL证书
- **证书类型**: Let's Encrypt (自动续期)
- **SSL模式**: Cloudflare Full (Strict)
- **HTTPS重定向**: 自动从HTTP重定向到HTTPS

### 服务器配置
- **操作系统**: Ubuntu 24.04 LTS
- **Web服务器**: Nginx 1.24.0
- **SSL管理**: Certbot
- **防火墙**: UFW (开放80、443、8080端口)

## 许可证

MIT License