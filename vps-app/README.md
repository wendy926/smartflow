# SmartFlow 交易策略仪表板 v2.0

基于多周期共振的高胜率高盈亏比加密货币交易策略仪表板，采用模块化架构设计。

## 🚀 快速开始

### 环境要求
- Node.js 14+ 
- PM2 (进程管理器)
- 至少 1GB 内存
- 至少 2GB 磁盘空间

### 部署步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd smartflow/vps-app
```

2. **一键部署**
```bash
./deploy.sh
```

3. **访问应用**
```
http://your-server-ip:8080
```

## 📁 项目结构

```
vps-app/
├── server.js                 # 主服务器文件
├── package.json              # 项目配置
├── ecosystem.config.js       # PM2 配置
├── modules/                  # 后端模块
│   ├── database/            # 数据库模块
│   │   ├── DatabaseManager.js
│   │   └── SimulationManager.js
│   ├── strategy/            # 策略模块
│   │   └── SmartFlowStrategy.js
│   ├── monitoring/          # 监控模块
│   │   └── DataMonitor.js
│   ├── api/                 # API模块
│   │   ├── BinanceAPI.js
│   │   └── RateLimiter.js
│   ├── notifications/       # 通知模块
│   │   └── TelegramNotifier.js
│   └── utils/               # 工具模块
│       ├── DataCache.js
│       └── TechnicalIndicators.js
├── public/                  # 前端文件
│   ├── index.html           # 主页面
│   ├── css/
│   │   └── main.css         # 主样式文件
│   ├── js/
│   │   ├── main.js          # 主JS文件
│   │   ├── api.js           # API客户端
│   │   ├── components/
│   │   │   └── Modal.js     # 模态框组件
│   │   └── data/
│   │       └── DataManager.js # 数据管理
│   ├── rollup-calculator.html # 斐波拉契计算器
│   ├── rollup-calculator.js
│   └── popup.js
└── scripts/                 # 部署脚本
    ├── deploy.sh            # 部署脚本
    ├── update.sh            # 更新脚本
    ├── restart.sh           # 重启脚本
    ├── cleanup.sh           # 清理脚本
    └── status.sh            # 状态检查
```

## 🛠️ 管理脚本

### 部署脚本
```bash
./deploy.sh          # 完整部署
./update.sh           # 更新应用
./restart.sh          # 重启应用
./cleanup.sh          # 清理项目
./status.sh           # 检查状态
```

### PM2 命令
```bash
pm2 status            # 查看应用状态
pm2 logs smartflow-app # 查看日志
pm2 restart smartflow-app # 重启应用
pm2 stop smartflow-app    # 停止应用
pm2 delete smartflow-app  # 删除应用
```

## 🔧 配置说明

### 环境变量
在 `ecosystem.config.js` 中配置：
- `PORT`: 服务端口 (默认: 8080)
- `TELEGRAM_BOT_TOKEN`: Telegram 机器人令牌
- `TELEGRAM_CHAT_ID`: Telegram 聊天ID

### 数据库
- 使用 SQLite 数据库 (`smartflow.db`)
- 自动创建表结构
- 支持数据备份和恢复

## 📊 功能特性

### 核心功能
- **多周期分析**: 日线趋势 + 小时确认 + 15分钟执行
- **智能信号**: 基于技术指标的信号判断
- **模拟交易**: 完整的模拟交易系统
- **实时监控**: 统一的监控中心
- **风险控制**: 止损和风险管理

### 监控功能
- **数据收集监控**: 实时数据收集状态
- **信号分析监控**: 信号判断完成率
- **模拟交易监控**: 交易执行状态
- **系统健康检查**: 整体系统状态
- **告警通知**: Telegram 集成

### 工具功能
- **斐波拉契滚仓计算器**: 基于0.618黄金回调法
- **杠杆策略对比**: 动态vs固定策略
- **风险计算**: 自动计算止损和杠杆
- **移动端适配**: 响应式设计

## 🔄 更新和维护

### 日常维护
```bash
# 检查应用状态
./status.sh

# 查看日志
pm2 logs smartflow-app

# 重启应用
./restart.sh
```

### 版本更新
```bash
# 更新应用
./update.sh

# 清理项目
./cleanup.sh
```

### 故障排除
1. **应用无法启动**: 检查端口占用和依赖安装
2. **数据库错误**: 检查数据库文件权限
3. **API 错误**: 检查网络连接和API密钥
4. **内存不足**: 增加服务器内存或优化配置

## 📈 性能优化

### 模块化架构优势
- **代码分离**: 功能模块独立，易于维护
- **性能提升**: 按需加载，减少内存占用
- **扩展性**: 易于添加新功能
- **稳定性**: 模块独立，减少相互影响

### 监控优化
- **5分钟自动刷新**: 减少服务器负载
- **静默更新**: 避免用户干扰
- **智能缓存**: 减少重复请求

## 🛡️ 安全说明

- 所有敏感配置通过环境变量管理
- 数据库文件权限控制
- API 请求频率限制
- 输入验证和错误处理

## 📞 技术支持

如遇问题，请：
1. 运行 `./status.sh` 检查状态
2. 查看 `pm2 logs smartflow-app` 获取日志
3. 检查配置文件是否正确
4. 确认服务器资源充足

---

**版本**: v2.0  
**更新日期**: 2025-01-07  
**架构**: 模块化微服务架构
