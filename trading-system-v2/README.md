# 交易系统 V2.0

基于策略V3和ICT策略的高性能交易系统，支持多时间框架分析和模拟交易。

## 系统架构

- **策略执行**: V3趋势交易策略 + ICT订单块策略
- **数据存储**: MySQL + Redis 缓存
- **监控告警**: 系统资源监控 + Telegram通知
- **前端界面**: 策略结果展示 + 交易对管理

## 技术栈

- **后端**: Node.js + Express
- **数据库**: MySQL 8.0 + Redis 6.0
- **进程管理**: PM2
- **前端**: HTML5 + JavaScript + Chart.js
- **API**: Binance Futures API

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env

# 启动服务
npm start

# 使用PM2管理进程
pm2 start ecosystem.config.js
```

## 目录结构

```
trading-system-v2/
├── src/                    # 源代码目录
│   ├── main.js            # 主应用入口
│   ├── config/            # 配置文件
│   ├── core/              # 核心业务逻辑
│   ├── strategies/        # 交易策略实现
│   ├── workers/           # 后台工作进程
│   ├── api/               # API接口
│   ├── database/          # 数据库相关
│   ├── cache/             # 缓存管理
│   ├── monitoring/        # 监控系统
│   ├── utils/             # 工具函数
│   └── web/               # 前端界面
├── docs/                  # 文档目录
├── tests/                 # 测试文件
├── scripts/               # 部署脚本
├── logs/                  # 日志文件
├── data/                  # 数据文件
├── config/                # 配置文件
├── package.json
├── ecosystem.config.js    # PM2配置
└── README.md
```

## 功能模块

### 1. 交易策略执行
- V3趋势交易策略（4H→1H→15m）
- ICT订单块策略（1D→4H→15m）
- 多因子打分机制
- 实时指标计算

### 2. 系统监控
- 资源使用率监控
- API调用成功率
- 策略计算性能
- 自动告警通知

### 3. 交易对管理
- 交易对状态管理
- 胜率统计分析
- 模拟交易记录
- 数据可视化

### 4. 工具模块
- 动态杠杆计算器
- Telegram监控告警
- 系统测试API
- 数据清理工具

## 性能指标

- **内存使用**: < 680MB (66%)
- **CPU使用**: < 70% (平均)
- **数据保留**: 60天
- **更新频率**: 每5分钟
- **响应时间**: < 200ms

## 部署要求

- **服务器**: 2C 1G 30GB
- **操作系统**: Ubuntu 20.04+
- **Node.js**: 16.0+
- **MySQL**: 8.0+
- **Redis**: 6.0+

## 许可证

MIT License
