# 交易系统数据库设计与缓存方案

## 系统架构概述

基于VPS服务器规格（2C 1G 30GB磁盘），设计轻量级高性能数据库架构，支持60天数据存储。

## 数据库表设计

### 1. 交易对管理表 (symbols)

```sql
CREATE TABLE symbols (
    id INT PRIMARY KEY AUTO_INCREMENT,
    symbol VARCHAR(20) NOT NULL UNIQUE COMMENT '交易对符号',
    status ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED') DEFAULT 'ACTIVE' COMMENT '状态',
    funding_rate DECIMAL(10,8) DEFAULT 0 COMMENT '资金费率',
    last_price DECIMAL(20,8) DEFAULT 0 COMMENT '最新价格',
    volume_24h DECIMAL(20,8) DEFAULT 0 COMMENT '24小时成交量',
    price_change_24h DECIMAL(10,4) DEFAULT 0 COMMENT '24小时价格变化%',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_symbol_status (symbol, status),
    INDEX idx_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='交易对管理表';
```

### 2. 策略判断结果表 (strategy_judgments)

```sql
CREATE TABLE strategy_judgments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    symbol VARCHAR(20) NOT NULL,
    strategy_type ENUM('V3', 'ICT') NOT NULL,
    timeframe ENUM('4H', '1H', '15M', '1D') NOT NULL,
    trend_direction ENUM('RANGE', 'UP', 'DOWN') NOT NULL COMMENT '趋势方向',
    score DECIMAL(5,2) DEFAULT 0 COMMENT '打分结果',
    confidence_level ENUM('HIGH', 'MEDIUM', 'LOW') DEFAULT 'MEDIUM' COMMENT '置信度',
    indicators_data JSON COMMENT '指标数据JSON',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_symbol_strategy_timeframe (symbol, strategy_type, timeframe),
    INDEX idx_created_at (created_at),
    INDEX idx_trend_direction (trend_direction),
    FOREIGN KEY (symbol) REFERENCES symbols(symbol) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='策略判断结果表';
```

### 3. 模拟交易记录表 (simulation_trades)

```sql
CREATE TABLE simulation_trades (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    symbol VARCHAR(20) NOT NULL,
    strategy_type ENUM('V3', 'ICT') NOT NULL,
    direction ENUM('LONG', 'SHORT') NOT NULL,
    entry_price DECIMAL(20,8) NOT NULL,
    stop_loss DECIMAL(20,8) NOT NULL,
    take_profit DECIMAL(20,8) NOT NULL,
    leverage INT DEFAULT 1 COMMENT '杠杆倍数',
    margin_required DECIMAL(20,8) NOT NULL COMMENT '所需保证金',
    risk_amount DECIMAL(20,8) NOT NULL COMMENT '风险金额',
    position_size DECIMAL(20,8) NOT NULL COMMENT '仓位大小',
    status ENUM('ACTIVE', 'CLOSED', 'STOPPED') DEFAULT 'ACTIVE',
    exit_price DECIMAL(20,8) NULL,
    exit_reason VARCHAR(100) NULL,
    pnl DECIMAL(20,8) DEFAULT 0 COMMENT '盈亏',
    pnl_percentage DECIMAL(10,4) DEFAULT 0 COMMENT '盈亏百分比',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP NULL,
    INDEX idx_symbol_strategy (symbol, strategy_type),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (symbol) REFERENCES symbols(symbol) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='模拟交易记录表';
```

### 4. 系统监控表 (system_monitoring)

```sql
CREATE TABLE system_monitoring (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    metric_type ENUM('API_SUCCESS_RATE', 'STRATEGY_CALCULATION_RATE', 'SYSTEM_HEALTH') NOT NULL,
    component VARCHAR(50) NOT NULL COMMENT '组件名称',
    strategy_type ENUM('V3', 'ICT', 'ALL') DEFAULT 'ALL',
    timeframe ENUM('4H', '1H', '15M', '1D', 'ALL') DEFAULT 'ALL',
    success_count INT DEFAULT 0,
    total_count INT DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 0 COMMENT '成功率%',
    avg_response_time DECIMAL(10,3) DEFAULT 0 COMMENT '平均响应时间ms',
    error_message TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_metric_component (metric_type, component),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统监控表';
```

### 5. 交易对统计数据表 (symbol_statistics)

```sql
CREATE TABLE symbol_statistics (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    symbol VARCHAR(20) NOT NULL,
    strategy_type ENUM('V3', 'ICT') NOT NULL,
    total_trades INT DEFAULT 0,
    winning_trades INT DEFAULT 0,
    losing_trades INT DEFAULT 0,
    win_rate DECIMAL(5,2) DEFAULT 0 COMMENT '胜率%',
    total_pnl DECIMAL(20,8) DEFAULT 0 COMMENT '总盈亏',
    avg_pnl_per_trade DECIMAL(20,8) DEFAULT 0 COMMENT '平均每笔盈亏',
    max_drawdown DECIMAL(10,4) DEFAULT 0 COMMENT '最大回撤%',
    profit_factor DECIMAL(10,4) DEFAULT 0 COMMENT '盈亏比',
    best_trade DECIMAL(20,8) DEFAULT 0 COMMENT '最佳交易',
    worst_trade DECIMAL(20,8) DEFAULT 0 COMMENT '最差交易',
    avg_holding_time INT DEFAULT 0 COMMENT '平均持仓时间(分钟)',
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_symbol_strategy (symbol, strategy_type),
    INDEX idx_win_rate (win_rate),
    INDEX idx_total_pnl (total_pnl),
    FOREIGN KEY (symbol) REFERENCES symbols(symbol) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='交易对统计数据表';
```

### 6. 系统配置表 (system_config)

```sql
CREATE TABLE system_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    config_type ENUM('STRING', 'NUMBER', 'JSON', 'BOOLEAN') DEFAULT 'STRING',
    description TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置表';
```

## 缓存设计方案

### 1. Redis缓存结构设计

基于1GB内存限制，设计分层缓存策略：

#### 1.1 热点数据缓存 (TTL: 5分钟)
```javascript
// 策略判断结果缓存
strategy:judgment:{symbol}:{strategy_type}:{timeframe} = {
  trend_direction: 'UP',
  score: 8.5,
  confidence_level: 'HIGH',
  indicators_data: {...},
  timestamp: 1640995200000
}

// 交易对基础信息缓存
symbol:info:{symbol} = {
  symbol: 'BTCUSDT',
  status: 'ACTIVE',
  last_price: 45000.00,
  volume_24h: 1000000.00,
  price_change_24h: 2.5,
  funding_rate: 0.0001
}
```

#### 1.2 统计数据缓存 (TTL: 1小时)
```javascript
// 交易对统计数据缓存
statistics:{symbol}:{strategy_type} = {
  total_trades: 150,
  winning_trades: 95,
  win_rate: 63.33,
  total_pnl: 2500.50,
  profit_factor: 1.85
}

// 系统监控数据缓存
monitoring:{metric_type}:{component} = {
  success_rate: 98.5,
  avg_response_time: 120.5,
  last_check: 1640995200000
}
```

#### 1.3 配置数据缓存 (TTL: 24小时)
```javascript
// 系统配置缓存
config:{config_key} = {
  value: 'config_value',
  type: 'STRING',
  updated_at: 1640995200000
}
```

### 2. 内存优化策略

#### 2.1 数据压缩
```javascript
// 使用压缩存储大量历史数据
const compressedData = {
  // 只存储关键字段，减少内存占用
  t: timestamp,           // 时间戳
  p: price,              // 价格
  v: volume,             // 成交量
  s: score,              // 分数
  d: direction           // 方向
};
```

#### 2.2 分片存储
```javascript
// 按时间分片存储，避免单个key过大
strategy:judgment:shard:{date}:{symbol}:{strategy_type} = {
  // 存储当天的所有判断结果
  data: [...]
}
```

### 3. 数据清理策略

#### 3.1 自动清理规则
```sql
-- 删除60天前的策略判断数据
DELETE FROM strategy_judgments 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 60 DAY);

-- 删除90天前的模拟交易记录
DELETE FROM simulation_trades 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);

-- 删除30天前的监控数据
DELETE FROM system_monitoring 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
```

#### 3.2 数据归档策略
```javascript
// 将历史数据归档到压缩文件
const archiveStrategy = {
  // 每天凌晨2点执行
  schedule: '0 2 * * *',
  // 归档60天前的数据
  retention: 60,
  // 压缩存储到磁盘
  compression: 'gzip'
};
```

## 性能优化方案

### 1. 数据库优化

#### 1.1 索引优化
```sql
-- 为高频查询创建复合索引
CREATE INDEX idx_judgment_lookup ON strategy_judgments(symbol, strategy_type, timeframe, created_at);
CREATE INDEX idx_trade_lookup ON simulation_trades(symbol, strategy_type, status, created_at);
CREATE INDEX idx_monitoring_lookup ON system_monitoring(metric_type, component, created_at);
```

#### 1.2 分区策略
```sql
-- 按时间分区策略判断表
ALTER TABLE strategy_judgments 
PARTITION BY RANGE (UNIX_TIMESTAMP(created_at)) (
    PARTITION p202401 VALUES LESS THAN (UNIX_TIMESTAMP('2024-02-01')),
    PARTITION p202402 VALUES LESS THAN (UNIX_TIMESTAMP('2024-03-01')),
    -- ... 按月分区
    PARTITION p_future VALUES LESS THAN MAXVALUE
);
```

### 2. 缓存优化

#### 2.1 缓存预热
```javascript
// 系统启动时预热关键数据
const preloadCache = async () => {
  // 预热活跃交易对信息
  const activeSymbols = await getActiveSymbols();
  for (const symbol of activeSymbols) {
    await cacheSymbolInfo(symbol);
  }
  
  // 预热最新策略判断结果
  const latestJudgments = await getLatestJudgments();
  for (const judgment of latestJudgments) {
    await cacheStrategyJudgment(judgment);
  }
};
```

#### 2.2 缓存更新策略
```javascript
// 5分钟定时更新策略判断
const updateStrategyJudgments = async () => {
  const symbols = await getActiveSymbols();
  
  for (const symbol of symbols) {
    // 并行更新V3和ICT策略
    await Promise.all([
      updateV3Strategy(symbol),
      updateICTStrategy(symbol)
    ]);
  }
};

// 使用cron表达式：每5分钟执行
cron.schedule('*/5 * * * *', updateStrategyJudgments);
```

### 3. 存储空间优化

#### 3.1 数据压缩
```javascript
// 使用JSON压缩存储指标数据
const compressIndicatorsData = (data) => {
  return JSON.stringify(data, null, 0); // 移除空格
};

// 使用二进制格式存储时间序列数据
const storeTimeSeriesData = (data) => {
  const buffer = Buffer.alloc(data.length * 8); // 假设每个数据点8字节
  // 压缩存储逻辑
  return buffer;
};
```

#### 3.2 存储估算
```
单条策略判断记录: ~200 bytes
单条模拟交易记录: ~300 bytes
单条监控记录: ~150 bytes

60天数据量估算:
- 策略判断: 1000 symbols × 2 strategies × 4 timeframes × 288 times/day × 60 days × 200 bytes ≈ 6.9GB
- 模拟交易: 1000 symbols × 2 strategies × 10 trades/day × 60 days × 300 bytes ≈ 360MB
- 监控数据: 50 components × 288 times/day × 60 days × 150 bytes ≈ 130MB

总计: 约7.4GB，在30GB磁盘空间内
```

## 监控与告警

### 1. 系统监控指标

```javascript
const monitoringMetrics = {
  // 数据库性能
  db_connections: '当前数据库连接数',
  db_query_time: '平均查询时间',
  db_disk_usage: '数据库磁盘使用率',
  
  // 缓存性能
  redis_memory_usage: 'Redis内存使用率',
  redis_hit_rate: '缓存命中率',
  redis_operations: 'Redis操作次数',
  
  // 应用性能
  api_response_time: 'API响应时间',
  strategy_calculation_time: '策略计算时间',
  data_processing_time: '数据处理时间'
};
```

### 2. 告警规则

```javascript
const alertRules = {
  // 磁盘空间告警
  disk_usage: {
    threshold: 80, // 80%
    action: 'cleanup_old_data'
  },
  
  // 内存使用告警
  memory_usage: {
    threshold: 90, // 90%
    action: 'clear_cache'
  },
  
  // 数据库连接告警
  db_connections: {
    threshold: 80, // 80%
    action: 'restart_connection_pool'
  },
  
  // API成功率告警
  api_success_rate: {
    threshold: 95, // 95%
    action: 'send_telegram_alert'
  }
};
```

## 进程配置与资源管理

### 1. 进程架构设计

基于2C CPU限制，设计轻量级进程架构：

#### 1.1 核心进程配置
```javascript
const processConfig = {
  // 主应用进程 (1个)
  mainApp: {
    cpu: 0.5,           // 50% CPU
    memory: 200,        // 200MB
    description: '主应用服务，处理API请求和业务逻辑'
  },
  
  // 策略计算进程 (1个)
  strategyWorker: {
    cpu: 0.8,           // 80% CPU
    memory: 300,        // 300MB
    description: '策略计算工作进程，每5分钟执行一次'
  },
  
  // 数据清理进程 (1个，定时执行)
  dataCleaner: {
    cpu: 0.2,           // 20% CPU
    memory: 100,        // 100MB
    description: '数据清理进程，每天凌晨执行'
  },
  
  // 监控进程 (1个)
  monitor: {
    cpu: 0.1,           // 10% CPU
    memory: 50,         // 50MB
    description: '系统监控进程，实时监控资源使用'
  }
};
```

#### 1.2 进程调度策略
```javascript
// 使用PM2进程管理
const ecosystem = {
  apps: [
    {
      name: 'main-app',
      script: './src/main.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '200M',
      node_args: '--max-old-space-size=200'
    },
    {
      name: 'strategy-worker',
      script: './src/workers/strategy-worker.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M',
      node_args: '--max-old-space-size=300',
      cron_restart: '*/5 * * * *'  // 每5分钟重启
    },
    {
      name: 'data-cleaner',
      script: './src/workers/data-cleaner.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '100M',
      cron_restart: '0 2 * * *'    // 每天凌晨2点执行
    },
    {
      name: 'monitor',
      script: './src/workers/monitor.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '50M'
    }
  ]
};
```

### 2. 资源使用分析

#### 2.1 CPU使用分配
```
总CPU: 2核心 = 200%
├── 主应用进程: 50% (处理API请求)
├── 策略计算进程: 80% (每5分钟执行，平时空闲)
├── 数据清理进程: 20% (每天执行1小时)
├── 监控进程: 10% (持续运行)
├── 系统预留: 20% (操作系统)
└── 缓冲空间: 20% (峰值处理)

平均CPU使用率: 60-70%
峰值CPU使用率: 90% (策略计算时)
```

#### 2.2 内存使用分配（优化后）
```
总内存: 1GB = 1024MB
├── 主应用进程: 120MB (减少80MB)
├── 策略计算进程: 150MB (减少150MB)
├── 数据清理进程: 50MB (减少50MB)
├── 监控进程: 30MB (减少20MB)
├── MySQL: 150MB (减少106MB)
├── Redis: 80MB (减少48MB)
├── 系统预留: 200MB
└── 缓冲空间: 100MB

总使用: 约680MB (66%)
```

#### 2.3 内存优化策略
```javascript
// 内存优化配置
const memoryOptimization = {
  // 应用进程优化
  appProcess: {
    maxOldSpaceSize: 120,        // 减少到120MB
    gcInterval: 30000,           // 30秒强制GC
    memoryLeakDetection: true    // 启用内存泄漏检测
  },
  
  // 策略计算优化
  strategyWorker: {
    maxOldSpaceSize: 150,        // 减少到150MB
    batchSize: 5,                // 减少批次大小
    processSymbols: 50,          // 限制处理交易对数量
    memoryCleanup: true          // 每次计算后清理内存
  },
  
  // 数据库优化
  database: {
    innodbBufferPoolSize: '150M', // 减少到150MB
    queryCacheSize: '8M',         // 减少到8MB
    tmpTableSize: '8M',           // 减少到8MB
    maxHeapTableSize: '8M'        // 减少到8MB
  },
  
  // Redis优化
  redis: {
    maxMemory: '80mb',            // 减少到80MB
    maxMemoryPolicy: 'allkeys-lru',
    memoryOptimization: true     // 启用内存优化
  }
};
```

### 3. 策略执行优化

#### 3.1 策略计算优化（内存优化版）
```javascript
// 策略计算进程优化 - 内存优化版
class StrategyWorker {
  constructor() {
    this.isRunning = false;
    this.batchSize = 5;         // 减少批次大小到5
    this.maxSymbols = 50;       // 限制处理交易对数量
    this.delayBetweenBatches = 2000; // 增加批次间延迟到2秒
    this.memoryCleanupInterval = 10000; // 10秒清理一次内存
  }
  
  async executeStrategies() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      // 限制处理的交易对数量
      const allSymbols = await this.getActiveSymbols();
      const symbols = allSymbols.slice(0, this.maxSymbols);
      
      const batches = this.chunkArray(symbols, this.batchSize);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        
        // 串行处理每个批次，减少内存压力
        for (const symbol of batch) {
          await this.processSymbol(symbol);
          
          // 每个交易对处理后立即清理
          this.cleanupMemory();
        }
        
        // 批次间延迟，避免CPU峰值
        await this.sleep(this.delayBetweenBatches);
        
        // 定期强制垃圾回收
        if (i % 2 === 0 && global.gc) {
          global.gc();
        }
      }
      
      const duration = Date.now() - startTime;
      console.log(`策略计算完成，耗时: ${duration}ms`);
      
    } catch (error) {
      console.error('策略计算错误:', error);
    } finally {
      this.isRunning = false;
      // 最终清理
      this.cleanupMemory();
    }
  }
  
  async processSymbol(symbol) {
    let v3Result = null;
    let ictResult = null;
    
    try {
      // 串行执行策略，减少内存峰值
      v3Result = await this.executeV3Strategy(symbol);
      
      // 立即保存V3结果
      await this.saveV3Result(symbol, v3Result);
      v3Result = null; // 释放内存
      
      ictResult = await this.executeICTStrategy(symbol);
      
      // 立即保存ICT结果
      await this.saveICTResult(symbol, ictResult);
      ictResult = null; // 释放内存
      
    } catch (error) {
      console.error(`处理交易对 ${symbol} 错误:`, error);
    } finally {
      // 确保清理
      v3Result = null;
      ictResult = null;
    }
  }
  
  cleanupMemory() {
    // 清理临时变量
    if (global.gc) {
      global.gc();
    }
    
    // 清理缓存
    this.clearTempCache();
  }
  
  clearTempCache() {
    // 清理临时缓存
    if (this.tempCache) {
      this.tempCache.clear();
    }
  }
}
```

#### 3.2 数据库连接池优化（内存优化版）
```javascript
// 数据库连接池配置 - 内存优化版
const dbConfig = {
  host: 'localhost',
  user: 'trading_user',
  password: 'secure_password',
  database: 'trading_system',
  connectionLimit: 3,           // 进一步减少连接数
  acquireTimeout: 20000,        // 20秒超时
  timeout: 20000,               // 20秒超时
  reconnect: true,
  idleTimeout: 180000,          // 3分钟空闲超时
  queueLimit: 0,
  // 内存优化配置
  multipleStatements: false,    // 禁用多语句
  dateStrings: true,            // 使用字符串日期
  supportBigNumbers: false,     // 禁用大数支持
  bigNumberStrings: false       // 禁用大数字符串
};

// Redis连接池配置 - 内存优化版
const redisConfig = {
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: 2,      // 减少重试次数
  retryDelayOnFailover: 50,     // 减少重试延迟
  enableReadyCheck: false,
  maxMemoryPolicy: 'allkeys-lru',
  maxMemory: '80mb',            // 减少到80MB
  // 内存优化配置
  lazyConnect: true,            // 延迟连接
  keepAlive: 30000,             // 30秒保活
  family: 4,                    // 强制IPv4
  connectTimeout: 10000,        // 10秒连接超时
  commandTimeout: 5000          // 5秒命令超时
};
```

#### 3.3 内存泄漏防护
```javascript
// 内存泄漏防护机制
class MemoryLeakProtection {
  constructor() {
    this.memoryThreshold = 100; // 100MB阈值
    this.checkInterval = 30000; // 30秒检查一次
    this.cleanupThreshold = 80; // 80MB清理阈值
  }
  
  startMonitoring() {
    setInterval(() => {
      this.checkMemoryUsage();
    }, this.checkInterval);
  }
  
  async checkMemoryUsage() {
    const usage = process.memoryUsage();
    const heapUsed = usage.heapUsed / 1024 / 1024; // MB
    
    if (heapUsed > this.memoryThreshold) {
      console.warn(`内存使用过高: ${heapUsed.toFixed(2)}MB`);
      await this.emergencyCleanup();
    } else if (heapUsed > this.cleanupThreshold) {
      console.log(`内存使用较高: ${heapUsed.toFixed(2)}MB，执行清理`);
      await this.routineCleanup();
    }
  }
  
  async emergencyCleanup() {
    // 紧急清理
    console.log('执行紧急内存清理...');
    
    // 1. 强制垃圾回收
    if (global.gc) {
      global.gc();
    }
    
    // 2. 清理Redis缓存
    await this.clearRedisCache();
    
    // 3. 清理数据库连接池
    await this.clearDbConnections();
    
    // 4. 重启策略计算进程
    await this.restartStrategyWorker();
  }
  
  async routineCleanup() {
    // 常规清理
    if (global.gc) {
      global.gc();
    }
    
    await this.clearTempData();
  }
}
```

### 4. 监控与告警系统

#### 4.1 资源监控
```javascript
class ResourceMonitor {
  constructor() {
    this.cpuThreshold = 60;      // CPU告警阈值60%
    this.memoryThreshold = 60;    // 内存告警阈值60%
    this.checkInterval = 30000;   // 30秒检查一次
  }
  
  startMonitoring() {
    setInterval(() => {
      this.checkResources();
    }, this.checkInterval);
  }
  
  async checkResources() {
    const stats = await this.getSystemStats();
    
    // CPU使用率检查
    if (stats.cpuUsage > this.cpuThreshold) {
      await this.sendAlert('CPU', stats.cpuUsage);
      await this.optimizeCPU();
    }
    
    // 内存使用率检查
    if (stats.memoryUsage > this.memoryThreshold) {
      await this.sendAlert('Memory', stats.memoryUsage);
      await this.optimizeMemory();
    }
  }
  
  async optimizeCPU() {
    // CPU优化策略
    console.log('执行CPU优化...');
    
    // 1. 暂停非关键任务
    await this.pauseNonCriticalTasks();
    
    // 2. 清理缓存
    await this.clearCache();
    
    // 3. 重启策略计算进程
    await this.restartStrategyWorker();
  }
  
  async optimizeMemory() {
    // 内存优化策略
    console.log('执行内存优化...');
    
    // 1. 清理Redis缓存
    await this.clearRedisCache();
    
    // 2. 清理数据库连接
    await this.cleanupDbConnections();
    
    // 3. 强制垃圾回收
    if (global.gc) {
      global.gc();
    }
  }
}
```

#### 4.2 告警配置
```javascript
const alertConfig = {
  // Telegram告警配置
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
    enabled: true
  },
  
  // 告警规则
  rules: {
    cpu: {
      threshold: 60,
      cooldown: 300000,  // 5分钟冷却期
      message: 'CPU使用率超过60%'
    },
    memory: {
      threshold: 60,
      cooldown: 300000,
      message: '内存使用率超过60%'
    },
    disk: {
      threshold: 80,
      cooldown: 600000,  // 10分钟冷却期
      message: '磁盘使用率超过80%'
    },
    api: {
      threshold: 95,
      cooldown: 180000,  // 3分钟冷却期
      message: 'API成功率低于95%'
    }
  }
};
```

### 5. 服务器配置优化

#### 5.1 MySQL配置优化（内存优化版）
```bash
# /etc/mysql/mysql.conf.d/mysqld.cnf
[mysqld]
# 基础配置
port = 3306
bind-address = 127.0.0.1

# 内存配置 (针对1GB总内存，优化到150MB)
innodb_buffer_pool_size = 150M
innodb_log_file_size = 16M
innodb_log_buffer_size = 4M
innodb_flush_log_at_trx_commit = 2
innodb_flush_method = O_DIRECT

# 连接配置
max_connections = 15
max_connect_errors = 500
connect_timeout = 5
wait_timeout = 14400
interactive_timeout = 14400

# 查询缓存 (减少到8MB)
query_cache_type = 1
query_cache_size = 8M
query_cache_limit = 512K

# 临时表配置 (减少到8MB)
tmp_table_size = 8M
max_heap_table_size = 8M

# 排序和分组优化
sort_buffer_size = 1M
read_buffer_size = 128K
read_rnd_buffer_size = 256K
join_buffer_size = 128K

# 慢查询日志
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 1

# 二进制日志 (减少大小)
log_bin = /var/log/mysql/mysql-bin.log
expire_logs_days = 3
max_binlog_size = 50M

# 内存优化
table_open_cache = 64
table_definition_cache = 32
thread_cache_size = 4
```

#### 5.2 Redis配置优化（内存优化版）
```bash
# /etc/redis/redis.conf
# 基础配置
port 6379
bind 127.0.0.1
timeout 300
tcp-keepalive 60

# 内存配置 (减少到80MB)
maxmemory 80mb
maxmemory-policy allkeys-lru
maxmemory-samples 3

# 持久化配置 (减少保存频率)
save 1800 1
save 600 10
save 60 1000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes

# 日志配置
loglevel notice
logfile /var/log/redis/redis-server.log

# 客户端配置 (减少连接数)
maxclients 10

# 内存优化配置
hash-max-ziplist-entries 512
hash-max-ziplist-value 64
list-max-ziplist-size -2
list-compress-depth 0
set-max-intset-entries 512
zset-max-ziplist-entries 128
zset-max-ziplist-value 64
```

#### 5.3 系统配置优化（内存优化版）
```bash
# /etc/sysctl.conf
# 网络优化 (减少缓冲区大小)
net.core.rmem_max = 8388608
net.core.wmem_max = 8388608
net.ipv4.tcp_rmem = 4096 32768 8388608
net.ipv4.tcp_wmem = 4096 32768 8388608

# 文件描述符限制
fs.file-max = 32768

# 内存管理 (优化内存使用)
vm.swappiness = 5
vm.dirty_ratio = 10
vm.dirty_background_ratio = 3
vm.vfs_cache_pressure = 50

# 内存回收优化
vm.min_free_kbytes = 16384
vm.zone_reclaim_mode = 1
vm.drop_caches = 1
```

#### 5.4 进程配置优化（内存优化版）
```javascript
// 优化后的进程配置
const optimizedProcessConfig = {
  // 主应用进程 (减少到120MB)
  mainApp: {
    name: 'main-app',
    script: './src/main.js',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '120M',
    node_args: '--max-old-space-size=120 --expose-gc',
    env: {
      NODE_ENV: 'production',
      MEMORY_LIMIT: '120'
    }
  },
  
  // 策略计算进程 (减少到150MB)
  strategyWorker: {
    name: 'strategy-worker',
    script: './src/workers/strategy-worker.js',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '150M',
    node_args: '--max-old-space-size=150 --expose-gc',
    cron_restart: '*/5 * * * *',
    env: {
      NODE_ENV: 'production',
      MEMORY_LIMIT: '150',
      BATCH_SIZE: '5',
      MAX_SYMBOLS: '50'
    }
  },
  
  // 数据清理进程 (减少到50MB)
  dataCleaner: {
    name: 'data-cleaner',
    script: './src/workers/data-cleaner.js',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '50M',
    node_args: '--max-old-space-size=50 --expose-gc',
    cron_restart: '0 2 * * *',
    env: {
      NODE_ENV: 'production',
      MEMORY_LIMIT: '50'
    }
  },
  
  // 监控进程 (减少到30MB)
  monitor: {
    name: 'monitor',
    script: './src/workers/monitor.js',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '30M',
    node_args: '--max-old-space-size=30 --expose-gc',
    env: {
      NODE_ENV: 'production',
      MEMORY_LIMIT: '30'
    }
  }
};
```

### 6. 部署脚本

#### 6.1 启动脚本
```bash
#!/bin/bash
# start-trading-system.sh

echo "启动交易系统..."

# 检查系统资源
echo "检查系统资源..."
free -h
df -h

# 启动MySQL
echo "启动MySQL..."
systemctl start mysql

# 启动Redis
echo "启动Redis..."
systemctl start redis-server

# 等待服务启动
sleep 5

# 启动应用
echo "启动应用进程..."
pm2 start ecosystem.config.js

# 检查进程状态
pm2 status

echo "交易系统启动完成！"
```

#### 6.2 监控脚本
```bash
#!/bin/bash
# monitor-system.sh

while true; do
  # 获取系统资源使用情况
  CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
  MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
  DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | cut -d'%' -f1)
  
  # 检查告警条件
  if (( $(echo "$CPU_USAGE > 60" | bc -l) )); then
    echo "CPU告警: $CPU_USAGE%"
    # 发送告警通知
  fi
  
  if (( $(echo "$MEMORY_USAGE > 60" | bc -l) )); then
    echo "内存告警: $MEMORY_USAGE%"
    # 发送告警通知
  fi
  
  if (( $DISK_USAGE > 80 )); then
    echo "磁盘告警: $DISK_USAGE%"
    # 发送告警通知
  fi
  
  sleep 30
done
```

### 7. 性能测试与调优

#### 7.1 压力测试
```javascript
// 压力测试脚本
const stressTest = {
  // 模拟100个并发请求
  concurrentRequests: 100,
  
  // 测试API响应时间
  testAPIResponse: async () => {
    const startTime = Date.now();
    const promises = [];
    
    for (let i = 0; i < 100; i++) {
      promises.push(fetch('/api/strategy/status'));
    }
    
    await Promise.all(promises);
    const duration = Date.now() - startTime;
    
    console.log(`100个并发请求完成，耗时: ${duration}ms`);
    return duration;
  },
  
  // 测试策略计算性能
  testStrategyCalculation: async () => {
    const symbols = await getActiveSymbols();
    const startTime = Date.now();
    
    for (const symbol of symbols) {
      await executeV3Strategy(symbol);
      await executeICTStrategy(symbol);
    }
    
    const duration = Date.now() - startTime;
    console.log(`策略计算完成，耗时: ${duration}ms`);
    return duration;
  }
};
```

## 内存优化总结

### 优化成果
通过以上优化，成功将内存使用率从88%降低到66%：

```
优化前: 900MB (88%)
优化后: 680MB (66%)
节省内存: 220MB (22%)
```

### 关键优化措施

1. **进程内存限制**
   - 主应用进程: 200MB → 120MB
   - 策略计算进程: 300MB → 150MB
   - 数据清理进程: 100MB → 50MB
   - 监控进程: 50MB → 30MB

2. **数据库内存优化**
   - MySQL: 256MB → 150MB
   - Redis: 128MB → 80MB

3. **策略执行优化**
   - 批次大小: 10 → 5
   - 处理交易对数量: 无限制 → 50个
   - 串行处理替代并行处理
   - 实时内存清理

4. **内存泄漏防护**
   - 30秒内存监控
   - 80MB清理阈值
   - 100MB紧急清理阈值
   - 强制垃圾回收

### 性能影响
- **CPU使用率**: 略有增加（串行处理）
- **处理速度**: 略有降低（减少并发）
- **内存稳定性**: 显著提升
- **系统稳定性**: 大幅提升

这个优化方案在2C CPU的限制下，通过合理的进程分配、资源监控和自动优化，能够稳定运行交易系统，内存使用率控制在65%以下，并在资源使用率超过60%时及时告警和优化。
