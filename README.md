# SmartFlow 交易策略系统

基于多周期共振的高胜率高盈亏比加密货币交易策略系统。

## 项目结构

```
smartflow/
├── vps-app/                    # VPS应用核心目录
│   ├── server.js              # 主服务器文件
│   ├── package.json           # 依赖管理
│   ├── public/
│   │   └── index.html         # 前端界面
│   ├── deploy-with-database.sh # 部署脚本
│   └── ecosystem.config.js    # PM2配置
├── strategy.md                # 策略文档
├── auto-script.md             # 自动化脚本文档
└── package.json               # 根目录依赖
```

## 核心功能

### 1. 交易策略分析
- **多周期共振**：日线趋势 + 小时确认 + 15分钟执行
- **技术指标**：MA、VWAP、ATR、EMA、成交量分析
- **市场数据**：资金费率、持仓量变化、CVD数据
- **风险控制**：止损价、目标价、杠杆计算、保证金管理

### 2. 历史数据记录
- **信号记录**：自动记录所有信号出现时的完整数据
- **执行记录**：记录入场执行时的所有分析指标
- **结果标记**：支持标记信号/执行结果为正确/错误/未标记
- **复盘分析**：完整的历史数据支持策略优化

### 3. 前端界面
- **实时监控**：当前市场状态和信号展示
- **折叠表格**：第一层显示核心数据，第二层显示历史记录
- **数据监控**：原始数据获取成功率和错误追踪
- **规则说明**：完整的策略规则和指标说明

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

- `GET /` - 前端界面
- `GET /api/analyze-all` - 分析所有交易对
- `POST /api/analyze-custom` - 分析自定义交易对
- `GET /api/history/:symbol?` - 获取历史记录
- `POST /api/mark-result` - 标记结果
- `GET /api/data-monitor` - 数据监控状态
- `GET /api/websocket-status` - WebSocket状态

## 配置说明

### 默认交易对
- BTCUSDT
- ETHUSDT
- LINKUSDT
- LDOUSDT
- SOLUSDT

### 数据刷新
- 自动刷新间隔：30秒
- 数据缓存时间：30秒
- 缓存清理间隔：5分钟

## 部署要求

- Node.js >= 18.0.0
- 2GB+ 内存
- 30GB+ 存储空间
- 稳定的网络连接

## 注意事项

1. 确保VPS可以访问Binance API
2. 建议使用新加坡等亚洲地区的VPS
3. 定期备份数据库文件
4. 监控系统资源使用情况

## 许可证

MIT License