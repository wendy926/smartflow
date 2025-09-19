# SmartFlow 交易策略系统架构总结

**更新时间**: 2025-09-19  
**系统版本**: v4.2-fixed-maticusdt  
**文档版本**: v2.0

## 📋 项目概述

SmartFlow 是一个基于多周期共振的高胜率高盈亏比加密货币交易策略系统，集成两种核心策略（V3和ICT），支持实时数据监控、模拟交易、风险管理和智能告警。系统采用模块化架构，支持高可用部署和横向扩展。

### 🎯 核心功能模块

1. **V3策略系统** - 基于多周期共振的趋势交易策略（4H趋势过滤 + 1H确认 + 15分钟执行）
2. **ICT策略系统** - 基于Order Block和Fair Value Gap的价格行为策略（1D趋势 + 4H结构 + 15m入场）
3. **统一监控中心** - 实时监控两种策略的数据采集率、验证状态和模拟交易完成率
4. **模拟交易系统** - 支持两种策略的自动触发模拟交易、风险管理和统计分析
5. **实时数据系统** - Binance API数据采集、Delta实时计算和数据质量监控
6. **智能告警系统** - 多级告警机制，支持Telegram通知和系统监控

## ✅ 项目结构重组完成

## 🏗️ 系统架构

### 1. 整体架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                    SmartFlow 系统架构                           │
├─────────────────────────────────────────────────────────────────┤
│  前端层 (Frontend Layer)                                        │
│  ├── Web Dashboard (React/HTML5)                               │
│  ├── 策略监控界面 (V3/ICT Strategy Monitor)                     │
│  ├── 模拟交易管理界面 (Simulation Management)                   │
│  └── 系统监控界面 (System Monitoring)                          │
├─────────────────────────────────────────────────────────────────┤
│  API层 (API Layer)                                             │
│  ├── RESTful API Gateway (Express.js)                          │
│  ├── 策略分析API (Strategy Analysis API)                        │
│  ├── 监控数据API (Monitoring Data API)                         │
│  ├── 模拟交易API (Simulation Trading API)                      │
│  └── 系统管理API (System Management API)                       │
├─────────────────────────────────────────────────────────────────┤
│  业务逻辑层 (Business Logic Layer)                              │
│  ├── V3策略引擎 (V3 Strategy Engine)                           │
│  ├── ICT策略引擎 (ICT Strategy Engine)                         │
│  ├── 统一监控管理器 (Unified Monitoring Manager)               │
│  ├── 模拟交易引擎 (Simulation Trading Engine)                  │
│  └── 风险管理系统 (Risk Management System)                     │
├─────────────────────────────────────────────────────────────────┤
│  数据层 (Data Layer)                                           │
│  ├── 实时数据管理器 (Real-time Data Manager)                   │
│  ├── 数据验证系统 (Data Validation System)                     │
│  ├── 缓存管理器 (Cache Manager)                                │
│  └── 数据持久化层 (Data Persistence Layer)                     │
├─────────────────────────────────────────────────────────────────┤
│  基础设施层 (Infrastructure Layer)                              │
│  ├── 数据库系统 (SQLite3 Database)                             │
│  ├── 外部API集成 (Binance API Integration)                     │
│  ├── 消息通知系统 (Telegram Notification)                      │
│  └── 系统监控 (System Monitoring & Alerting)                   │
└─────────────────────────────────────────────────────────────────┘
```

### 2. 目录结构重组

```
vps-app/
├── src/                          # 业务源代码
│   ├── core/                     # 核心业务逻辑
│   │   ├── server.js            # 主服务器文件 (Express.js + 路由)
│   │   └── modules/             # 业务模块
│   │       ├── api/             # API相关 (RESTful接口)
│   │       │   ├── BinanceAPI.js         # Binance API集成
│   │       │   ├── UnifiedStrategyAPI.js # 统一策略API
│   │       │   └── RateLimiter.js        # API限流器
│   │       ├── cache/           # 缓存管理
│   │       │   ├── CacheManager.js       # 缓存管理器
│   │       │   └── RedisCache.js         # Redis缓存实现
│   │       ├── data/            # 数据管理
│   │       │   ├── DataAccessLayer.js    # 数据访问层
│   │       │   ├── DeltaManager.js       # Delta数据管理
│   │       │   └── DeltaRealTimeManager.js # 实时Delta管理
│   │       ├── database/        # 数据库操作
│   │       │   ├── DatabaseManager.js          # 数据库管理器
│   │       │   ├── UnifiedStrategyMigration.js  # 统一策略迁移
│   │       │   ├── ICTDatabaseManager.js        # ICT数据库管理
│   │       │   └── PriceFieldsMigration.js      # 价格字段迁移
│   │       ├── middleware/      # 中间件
│   │       │   ├── CacheMiddleware.js    # 缓存中间件
│   │       │   └── MemoryMiddleware.js   # 内存管理中间件
│   │       ├── monitoring/      # 监控系统
│   │       │   ├── DataMonitor.js              # 数据监控
│   │       │   ├── PerformanceMonitor.js       # 性能监控
│   │       │   ├── UnifiedStrategyMonitor.js   # 统一策略监控
│   │       │   └── EnhancedIndicatorMonitor.js # 增强指标监控
│   │       ├── notifications/   # 通知系统
│   │       │   └── TelegramNotifier.js   # Telegram通知
│   │       ├── strategy/        # 交易策略
│   │       │   ├── trend-trading/        # V3策略模块
│   │       │   │   ├── SmartFlowStrategyV3.js  # V3策略主引擎
│   │       │   │   ├── StrategyV3Core.js       # V3核心分析
│   │       │   │   └── StrategyV3Execution.js  # V3执行逻辑
│   │       │   └── ict-trading/          # ICT策略模块
│   │       │       ├── ICTStrategy.js          # ICT策略主引擎
│   │       │       ├── ICTCore.js              # ICT核心分析
│   │       │       └── ICTExecution.js         # ICT执行逻辑
│   │       └── utils/           # 工具函数
│   │           ├── TechnicalIndicators.js # 技术指标计算
│   │           └── DataCache.js          # 数据缓存工具
│   └── web/                     # 前端资源
│       ├── public/              # 静态文件
│       │   ├── index.html                # 主仪表板
│       │   ├── monitoring.html           # 监控中心
│       │   ├── simulation-data.html      # 模拟交易数据
│       │   ├── symbol-management.html    # 交易对管理
│       │   └── js/                       # JavaScript文件
│       │       ├── api.js                # API客户端
│       │       ├── core.js               # 核心业务逻辑
│       │       ├── monitoring.js         # 监控页面逻辑
│       │       └── simulation-data.js    # 模拟交易页面逻辑
│       └── templates/           # 模板文件
├── tools/                       # 工具脚本
│   ├── database/                # 数据库工具
│   │   ├── init-database.js             # 数据库初始化
│   │   └── database-schema-optimization.sql # 数据库优化脚本
│   ├── deployment/              # 部署脚本
│   │   ├── deploy-unified-monitoring.sh # 统一监控部署
│   │   ├── deploy-ict.sh                # ICT策略部署
│   │   └── vps-deploy.sh                # VPS部署脚本
│   ├── maintenance/             # 维护脚本
│   │   ├── memory-cleanup.js            # 内存清理
│   │   ├── memory-optimization.js       # 内存优化
│   │   └── refresh-all-data.js          # 数据刷新
│   └── analysis/                # 分析工具
│       ├── analyze-ethusdt-trend.js     # 趋势分析工具
│       └── check-data-collection-health.js # 数据健康检查
├── tests/                       # 测试文件
│   ├── unit/                    # 单元测试
│   │   ├── api-format-consistency.test.js    # API格式一致性测试
│   │   ├── price-accuracy.test.js            # 价格准确性测试
│   │   ├── trading-pairs-validation.test.js  # 交易对验证测试
│   │   └── dashboard-display-fix.test.js     # 仪表板显示测试
│   ├── integration/             # 集成测试
│   │   ├── database-integration.test.js      # 数据库集成测试
│   │   └── strategy-integration.test.js      # 策略集成测试
│   ├── e2e/                     # 端到端测试
│   │   ├── api-endpoints.test.js             # API端点测试
│   │   └── frontend-workflow.test.js         # 前端工作流测试
│   └── fixtures/                # 测试数据
├── docs/                        # 文档
│   ├── api/                     # API文档
│   │   ├── API_DOCUMENTATION.md          # V3策略API文档
│   │   └── ICT_Strategy_API.md           # ICT策略API文档
│   ├── deployment/              # 部署文档
│   │   ├── DEPLOYMENT_SUMMARY.md         # 部署总结
│   │   └── FINAL_DEPLOYMENT_REPORT.md    # 最终部署报告
│   ├── development/             # 开发文档
│   │   └── ICT_Strategy_Implementation.md # ICT策略实现文档
│   └── archived/                # 历史文档
├── config/                      # 配置文件
│   ├── nginx/                   # Nginx配置
│   │   ├── nginx-config.conf            # Nginx主配置
│   │   └── nginx-simple.conf            # Nginx简化配置
│   ├── pm2/                     # PM2配置
│   │   └── ecosystem.config.js          # PM2生态配置
│   └── database/                # 数据库配置
├── data/                        # 数据文件
│   ├── database/                # 数据库文件
│   │   └── smartflow.db                 # SQLite数据库
│   └── logs/                    # 日志文件
└── scripts/                     # 构建和部署脚本
    ├── cleanup-signal-none.js           # 信号清理脚本
    └── run-tests.js                     # 测试运行脚本
```

## 📊 关键数据源与字段

### 1. 外部数据源

#### Binance API数据源
- **K线数据**: 4H/1H/15m多时间框架价格数据
- **24小时行情**: 当前价格、涨跌幅、成交量
- **资金费率**: 8小时资金费率数据
- **持仓量历史**: 6小时持仓量变化数据
- **实时交易流**: WebSocket实时交易数据用于Delta计算

#### 数据采集频率
- **4H趋势数据**: 每1小时刷新一次
- **1H打分数据**: 每5分钟刷新一次  
- **15m执行数据**: 每2分钟刷新一次
- **实时Delta数据**: 实时WebSocket流

### 2. 核心数据库表结构

#### 策略分析主表 (strategy_analysis)
```sql
CREATE TABLE strategy_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,                    -- 交易对
  category TEXT,                           -- 分类 (largecap/midcap/smallcap)
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- V3策略4H趋势数据
  trend TEXT,                              -- 趋势方向 (多头趋势/空头趋势/震荡市)
  trend_strength TEXT,                     -- 趋势强度 (强/中/弱)
  ma20 REAL, ma50 REAL, ma200 REAL,       -- 移动平均线
  bbw_expanding BOOLEAN,                   -- 布林带扩张
  
  -- V3策略1H确认数据
  signal TEXT,                             -- 信号类型 (做多/做空/观望)
  signal_strength TEXT,                    -- 信号强度
  hourly_score INTEGER,                    -- 1H多因子得分 (0-6分)
  vwap REAL,                              -- 成交量加权平均价
  oi_change REAL,                         -- 持仓量变化
  funding_rate REAL,                      -- 资金费率
  
  -- V3策略15m执行数据
  execution TEXT,                         -- 执行信号 (做多_突破确认/做空_反抽破位)
  execution_mode TEXT,                    -- 执行模式 (模式A/模式B)
  entry_signal REAL,                      -- 入场价格
  stop_loss REAL,                         -- 止损价格
  take_profit REAL,                       -- 止盈价格
  
  -- 基础信息
  current_price REAL,                     -- 当前价格
  data_collection_rate REAL,             -- 数据采集率
  full_analysis_data TEXT,                -- 完整分析数据JSON
  data_valid BOOLEAN DEFAULT TRUE,        -- 数据有效性
  error_message TEXT                      -- 错误信息
);
```

#### ICT策略分析表 (ict_strategy_analysis)
```sql
CREATE TABLE ict_strategy_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- 高时间框架 (1D)
  daily_trend TEXT,                       -- 日线趋势 (上升/下降/震荡)
  daily_trend_score INTEGER,              -- 1D趋势得分 (0-3)
  
  -- 中时间框架 (4H)
  mtf_ob_detected BOOLEAN DEFAULT FALSE,  -- 4H Order Block检测
  mtf_fvg_detected BOOLEAN DEFAULT FALSE, -- 4H Fair Value Gap检测
  ob_height REAL,                         -- OB高度
  ob_age_days REAL,                       -- OB年龄(天)
  ob_high REAL, ob_low REAL,              -- OB价格区间
  fvg_high REAL, fvg_low REAL,            -- FVG价格区间
  sweep_htf_detected BOOLEAN,             -- 4H Sweep检测
  
  -- 低时间框架 (15m)
  ltf_ob_age_hours REAL,                  -- 15m OB年龄(小时)
  engulfing_detected BOOLEAN,             -- 吞没形态检测
  sweep_ltf_detected BOOLEAN,             -- 15m Sweep检测
  volume_confirmation BOOLEAN,            -- 成交量确认
  
  -- 风险管理
  entry_price REAL,                       -- 入场价格
  stop_loss REAL,                         -- 止损价格
  take_profit REAL,                       -- 止盈价格
  risk_reward_ratio REAL,                 -- 风险回报比
  max_leverage INTEGER,                   -- 最大杠杆
  min_margin REAL,                        -- 最小保证金
  
  -- 信号状态
  signal_type TEXT,                       -- 信号类型 (BOS_LONG/BOS_SHORT/CHoCH_LONG/CHoCH_SHORT/MIT_LONG/MIT_SHORT/WAIT)
  signal_strength TEXT,                   -- 信号强度 (强/中/弱)
  execution_mode TEXT,                    -- 执行模式
  
  full_analysis_data TEXT,                -- JSON格式完整数据
  strategy_version TEXT DEFAULT 'ICT'     -- 策略版本
);
```

#### 统一模拟交易表 (unified_simulations)
```sql
CREATE TABLE unified_simulations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,                   -- 交易对
  strategy_type TEXT NOT NULL,            -- 策略类型 (V3/ICT)
  entry_price REAL NOT NULL,              -- 入场价格
  stop_loss_price REAL NOT NULL,          -- 止损价格
  take_profit_price REAL NOT NULL,        -- 止盈价格
  max_leverage INTEGER NOT NULL,          -- 最大杠杆
  min_margin REAL NOT NULL,               -- 最小保证金
  direction TEXT NOT NULL,                -- 方向 (LONG/SHORT)
  status TEXT DEFAULT 'ACTIVE',           -- 状态 (ACTIVE/CLOSED)
  trigger_reason TEXT NOT NULL,           -- 触发原因
  execution_mode TEXT,                    -- 执行模式
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME,                     -- 平仓时间
  exit_price REAL,                        -- 出场价格
  exit_reason TEXT,                       -- 出场原因
  is_win BOOLEAN,                         -- 是否盈利
  profit_loss REAL                        -- 盈亏金额
);
```

#### 统一监控统计表 (strategy_monitoring_stats)
```sql
CREATE TABLE strategy_monitoring_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,                   -- 交易对
  strategy_type TEXT NOT NULL,            -- 策略类型 (V3/ICT)
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- 数据收集指标
  data_collection_rate REAL DEFAULT 0,    -- 数据收集率
  data_collection_attempts INTEGER DEFAULT 0,
  data_collection_successes INTEGER DEFAULT 0,
  
  -- 数据验证指标
  data_validation_status TEXT DEFAULT 'UNKNOWN', -- 数据验证状态
  data_validation_errors INTEGER DEFAULT 0,
  data_validation_warnings INTEGER DEFAULT 0,
  
  -- 模拟交易指标
  simulation_completion_rate REAL DEFAULT 0,     -- 模拟交易完成率
  simulation_triggers INTEGER DEFAULT 0,
  simulation_completions INTEGER DEFAULT 0,
  
  -- 健康状态
  overall_health TEXT DEFAULT 'UNKNOWN',  -- 整体健康状态
  last_error_message TEXT,               -- 最后错误信息
  
  UNIQUE(symbol, strategy_type, timestamp)
);
```

---

**文档状态**: ✅ 架构和数据源部分更新完成  
**覆盖范围**: 系统架构、目录结构、关键数据源与字段设计  
**维护建议**: 建议每月更新一次，确保与实际系统保持同步
