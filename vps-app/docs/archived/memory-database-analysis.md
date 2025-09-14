# 内存与数据库存储分析报告

## 📊 当前数据存储架构分析

### 🧠 **内存存储数据**

#### 1. **DataMonitor 类** (`modules/monitoring/DataMonitor.js`)
```javascript
// 内存中的数据结构
this.analysisLogs = new Map();           // 分析日志
this.symbolStats = new Map();            // 交易对统计
this.dataQualityIssues = new Map();      // 数据质量问题
this.lastRefreshTime = new Map();        // 最后刷新时间
this.lastAlertTime = new Map();          // 最后告警时间
this.dataTypeStats = new Map();          // 数据类型统计
```

**问题分析：**
- ❌ **无限增长**：Map对象会持续增长，没有定期清理
- ❌ **内存泄漏风险**：数据只增不减
- ❌ **重启丢失**：服务重启后所有数据丢失

#### 2. **SimulationManager 类** (`modules/database/SimulationManager.js`)
```javascript
this.activeSimulations = new Map();      // 活跃模拟交易
```

**问题分析：**
- ❌ **重复存储**：数据库中已有simulations表
- ❌ **数据不一致**：内存和数据库可能不同步

#### 3. **DataManager 类** (`public/js/data/DataManager.js`)
```javascript
this.cache = new Map();                  // 前端缓存
this.cacheTimeout = 30000;              // 30秒缓存
```

**问题分析：**
- ✅ **合理**：前端缓存，有超时机制
- ✅ **自动清理**：有清理过期缓存的逻辑

#### 4. **RateLimiter 类** (`modules/api/RateLimiter.js`)
```javascript
this.usage = new Map();                  // API使用统计
this.symbolPriorities = new Map();       // 交易对优先级
this.cache = new DataCache();           // API缓存
```

**问题分析：**
- ✅ **合理**：API限流需要实时统计
- ✅ **有清理机制**：cleanExpiredCache方法

#### 5. **TelegramNotifier 类** (`modules/notifications/TelegramNotifier.js`)
```javascript
this.lastExecutions = new Map();         // 上次执行状态
```

**问题分析：**
- ❌ **可能重复**：与数据库数据重复
- ❌ **重启丢失**：服务重启后状态丢失

### 🗄️ **数据库存储数据**

#### 1. **核心业务数据表**
```sql
-- 策略分析记录表
CREATE TABLE strategy_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  trend TEXT, trend_strength TEXT,
  ma20 REAL, ma50 REAL, ma200 REAL, bbw_expanding BOOLEAN,
  signal TEXT, signal_strength TEXT, hourly_score INTEGER,
  vwap REAL, oi_change REAL, funding_rate REAL,
  execution TEXT, execution_mode TEXT, mode_a BOOLEAN, mode_b BOOLEAN,
  entry_signal REAL, stop_loss REAL, take_profit REAL,
  current_price REAL, data_collection_rate REAL,
  full_analysis_data TEXT,
  data_valid BOOLEAN DEFAULT TRUE, error_message TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 模拟交易表
CREATE TABLE simulations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL, entry_price REAL NOT NULL,
  stop_loss_price REAL NOT NULL, take_profit_price REAL NOT NULL,
  max_leverage INTEGER NOT NULL, min_margin REAL NOT NULL,
  trigger_reason TEXT NOT NULL, status TEXT DEFAULT 'ACTIVE',
  stop_loss_distance REAL, atr_value REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME, exit_price REAL, exit_reason TEXT,
  is_win BOOLEAN, profit_loss REAL
);

-- 告警历史记录表
CREATE TABLE alert_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL, alert_type TEXT NOT NULL,
  severity TEXT NOT NULL, message TEXT NOT NULL,
  details TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved BOOLEAN DEFAULT FALSE, resolved_at DATETIME
);
```

#### 2. **配置和统计表**
```sql
-- 自定义交易对表
CREATE TABLE custom_symbols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT UNIQUE NOT NULL,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 用户设置表
CREATE TABLE user_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 胜率统计表
CREATE TABLE win_rate_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0, losing_trades INTEGER DEFAULT 0,
  win_rate REAL DEFAULT 0, total_profit REAL DEFAULT 0,
  total_loss REAL DEFAULT 0, net_profit REAL DEFAULT 0,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🚨 **设计问题分析**

### 1. **内存泄漏风险**
- **DataMonitor** 中的多个Map对象会无限增长
- **SimulationManager** 中的activeSimulations与数据库重复
- **TelegramNotifier** 中的lastExecutions状态会丢失

### 2. **数据一致性问题**
- 内存和数据库存储相同数据，可能不同步
- 服务重启后内存数据丢失，但数据库数据保留

### 3. **性能问题**
- 大量数据存储在内存中，占用过多内存
- 没有有效的内存清理机制

### 4. **可扩展性问题**
- 内存存储无法跨服务实例共享
- 无法进行数据持久化和备份

## ✅ **设计合理性评估**

### **合理的部分：**
1. **前端缓存**：DataManager的缓存机制合理
2. **API限流**：RateLimiter的内存统计合理
3. **核心业务数据**：策略分析、模拟交易等存储在数据库
4. **配置数据**：用户设置、交易对列表存储在数据库

### **不合理的部分：**
1. **监控数据重复存储**：DataMonitor中的数据应该主要存储在数据库
2. **状态数据丢失**：TelegramNotifier的状态应该持久化
3. **内存无限增长**：缺少有效的清理机制

## 🔧 **优化建议**

### 1. **减少内存存储**
- 将DataMonitor中的历史数据迁移到数据库
- 只保留必要的实时统计数据在内存中

### 2. **添加数据清理机制**
- 定期清理过期的内存数据
- 实现数据归档和压缩

### 3. **优化数据结构**
- 使用更高效的数据结构
- 实现数据分页和限制

### 4. **增强数据一致性**
- 减少内存和数据库的重复存储
- 实现数据同步机制

## 📈 **内存使用估算**

### 当前内存使用：
- **DataMonitor**: ~50-100MB (取决于交易对数量)
- **SimulationManager**: ~10-20MB
- **RateLimiter**: ~5-10MB
- **其他**: ~10-20MB
- **总计**: ~75-150MB

### 优化后预期：
- **核心业务逻辑**: ~20-30MB
- **缓存和临时数据**: ~10-20MB
- **总计**: ~30-50MB (减少60-70%)
