# 项目结构重组计划

## 📋 当前问题分析

### 1. 根目录混乱
- 大量脚本文件散落在根目录
- 业务代码、工具脚本、配置文件混合
- 缺乏清晰的目录分层

### 2. 文件分类不明确
- 业务逻辑文件与工具脚本混合
- 测试文件分散
- 文档文件位置不统一

### 3. 维护困难
- 难以快速定位相关文件
- 新开发者理解成本高
- 部署和开发流程不清晰

## 🎯 目标结构

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
├── scripts/                     # 构建和部署脚本
├── data/                        # 数据文件
│   ├── database/                # 数据库文件
│   └── logs/                    # 日志文件
└── coverage/                    # 测试覆盖率报告
```

## 📝 重组步骤

### 第一阶段：创建新目录结构
1. 创建 `src/` 目录
2. 创建 `tools/` 目录
3. 创建 `config/` 目录
4. 创建 `data/` 目录

### 第二阶段：移动业务代码
1. 移动 `server.js` 到 `src/core/`
2. 移动 `modules/` 到 `src/core/modules/`
3. 移动 `public/` 到 `src/web/public/`

### 第三阶段：整理工具脚本
1. 移动数据库相关脚本到 `tools/database/`
2. 移动部署脚本到 `tools/deployment/`
3. 移动维护脚本到 `tools/maintenance/`
4. 移动分析脚本到 `tools/analysis/`

### 第四阶段：整理测试文件
1. 按测试类型分类测试文件
2. 创建测试数据目录

### 第五阶段：整理文档和配置
1. 移动配置文件到 `config/`
2. 整理文档结构
3. 移动历史文档到 `docs/archived/`

## 🔧 实施计划

### 立即执行
- 创建新的目录结构
- 移动核心业务文件
- 更新相关路径引用

### 后续优化
- 更新部署脚本
- 完善文档结构
- 优化开发流程
