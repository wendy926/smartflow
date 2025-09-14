# SmartFlow 交易策略系统

基于多周期共振的高胜率高盈亏比加密货币交易策略系统，集成动态杠杆滚仓计算器。

## 📁 项目结构

```
vps-app/
├── src/                          # 业务源代码
│   ├── core/                     # 核心业务逻辑
│   │   ├── server.js            # 主服务器文件
│   │   └── modules/             # 业务模块
│   │       ├── api/             # API相关
│   │       ├── cache/           # 缓存管理
│   │       ├── data/            # 数据管理
│   │       ├── database/        # 数据库操作
│   │       ├── middleware/      # 中间件
│   │       ├── monitoring/      # 监控系统
│   │       ├── notification/    # 通知系统
│   │       ├── strategy/        # 交易策略
│   │       └── utils/           # 工具函数
│   └── web/                     # 前端资源
│       ├── public/              # 静态文件
│       └── templates/           # 模板文件
├── tools/                       # 工具脚本
│   ├── database/                # 数据库工具
│   ├── deployment/              # 部署脚本
│   ├── maintenance/             # 维护脚本
│   └── analysis/                # 分析工具
├── tests/                       # 测试文件
│   ├── unit/                    # 单元测试
│   ├── integration/             # 集成测试
│   ├── e2e/                     # 端到端测试
│   └── fixtures/                # 测试数据
├── docs/                        # 文档
│   ├── api/                     # API文档
│   ├── deployment/              # 部署文档
│   ├── development/             # 开发文档
│   └── archived/                # 历史文档
├── config/                      # 配置文件
│   ├── nginx/                   # Nginx配置
│   ├── pm2/                     # PM2配置
│   └── database/                # 数据库配置
├── data/                        # 数据文件
│   ├── database/                # 数据库文件
│   └── logs/                    # 日志文件
├── scripts/                     # 构建和部署脚本
├── coverage/                    # 测试覆盖率报告
├── start.js                     # 应用启动脚本
├── package.json                 # 项目配置
└── jest.config.js              # 测试配置
```

## 🚀 快速开始

### 环境要求
- Node.js >= 14.0.0
- SQLite3
- Redis (可选)

### 安装依赖
```bash
npm install
```

### 初始化数据库
```bash
npm run setup
```

### 启动应用
```bash
# 生产环境
npm start

# 开发环境
npm run dev

# 直接启动服务器
npm run server
```

### 运行测试
```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration

# 运行端到端测试
npm run test:e2e

# 生成覆盖率报告
npm run test:coverage

# 调试模式（检测内存泄漏）
npm run test:debug
```

## 📚 开发指南

### 代码结构说明

#### 核心业务逻辑 (`src/core/`)
- `server.js`: 主服务器文件，处理HTTP请求和路由
- `modules/`: 业务模块目录
  - `api/`: API接口相关模块
  - `cache/`: 缓存管理模块
  - `data/`: 数据管理模块
  - `database/`: 数据库操作模块
  - `middleware/`: 中间件模块
  - `monitoring/`: 监控系统模块
  - `notification/`: 通知系统模块
  - `strategy/`: 交易策略模块
  - `utils/`: 工具函数模块

#### 前端资源 (`src/web/`)
- `public/`: 静态文件（HTML、CSS、JS）
- `templates/`: 模板文件

#### 工具脚本 (`tools/`)
- `database/`: 数据库相关工具
- `deployment/`: 部署相关脚本
- `maintenance/`: 维护相关脚本
- `analysis/`: 分析相关工具

#### 测试文件 (`tests/`)
- `unit/`: 单元测试
- `integration/`: 集成测试
- `e2e/`: 端到端测试
- `fixtures/`: 测试数据

### 开发规范

#### 文件命名
- 业务模块文件使用小写字母和连字符
- 测试文件以 `.test.js` 结尾
- 配置文件以 `.config.js` 结尾

#### 目录结构
- 每个模块都有独立的目录
- 相关文件放在同一目录下
- 避免深层嵌套（最多3层）

#### 代码组织
- 一个文件一个主要功能
- 相关功能放在同一模块下
- 工具函数放在 `utils/` 目录

## 🔧 配置说明

### 环境变量
```bash
NODE_ENV=production          # 运行环境
PORT=8080                   # 服务端口
DB_PATH=data/database/smartflow.db  # 数据库路径
REDIS_URL=redis://localhost:6379    # Redis连接
```

### PM2配置
PM2配置文件位于 `config/pm2/ecosystem.config.js`

### Nginx配置
Nginx配置文件位于 `config/nginx/`

## 📊 监控和日志

### 日志文件
- 应用日志: `data/logs/app.log`
- 错误日志: `data/logs/error.log`
- 访问日志: `data/logs/access.log`

### 监控指标
- 系统性能监控
- 数据库性能监控
- API响应时间监控
- 内存使用监控

## 🚀 部署指南

### 生产环境部署
```bash
# 1. 克隆代码
git clone <repository-url>
cd vps-app

# 2. 安装依赖
npm install --production

# 3. 初始化数据库
npm run setup

# 4. 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 5. 启动服务
npm start
```

### 使用PM2部署
```bash
# 安装PM2
npm install -g pm2

# 启动应用
pm2 start config/pm2/ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs
```

## 🧪 测试说明

### 测试分类
- **单元测试**: 测试单个函数或模块
- **集成测试**: 测试模块间的交互
- **端到端测试**: 测试完整的用户流程

### 测试命令
```bash
npm run test:unit        # 单元测试
npm run test:integration # 集成测试
npm run test:e2e         # 端到端测试
npm run test:coverage    # 覆盖率报告
```

### 测试覆盖率
- 目标覆盖率: 80%+
- 当前覆盖率: 查看 `coverage/` 目录

## 📖 文档

- [API文档](docs/api/)
- [部署文档](docs/deployment/)
- [开发文档](docs/development/)
- [历史文档](docs/archived/)

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 📄 许可证

MIT License

## 📞 联系方式

- 项目地址: https://github.com/username/smartflow
- 技术支持: support@smartflow.com
- 文档更新: 2025-01-14
