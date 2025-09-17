# 高性能价格字段数据库设计方案

## 🎯 性能设计原则

### 1. 数据库访问性能优化
- **读写分离**: 价格计算与查询分离
- **索引策略**: 复合索引优化查询性能
- **分区存储**: 按时间和交易对分区
- **缓存机制**: 多层缓存策略

### 2. 系统架构性能考虑
- **异步处理**: 价格计算异步执行
- **批量操作**: 减少数据库连接开销
- **内存优化**: 合理的内存使用策略
- **连接池**: 数据库连接池管理

## 🏗️ 高性能数据库表设计

### 核心设计思路
1. **分表策略**: 将价格数据从主表分离，避免主表过大
2. **时间分区**: 按月份分区存储历史数据
3. **热点数据**: 当前活跃数据单独存储
4. **冗余计算**: 预计算常用指标

### 1. 价格数据专用表

```sql
-- ICT策略价格表 (独立表，高频更新)
CREATE TABLE IF NOT EXISTS ict_price_ranges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL, -- '4H'
  
  -- OB价格区间 (Order Block)
  ob_upper_price REAL,
  ob_lower_price REAL,
  ob_mid_price REAL, -- 预计算中间价
  ob_range_width REAL, -- 预计算区间宽度
  ob_volume REAL, -- OB成交量
  ob_strength REAL, -- OB强度评分 (0-100)
  ob_age_hours INTEGER, -- OB年龄(小时)
  ob_tested_count INTEGER DEFAULT 0, -- 测试次数
  ob_last_test_time DATETIME,
  
  -- FVG价格区间 (Fair Value Gap)  
  fvg_upper_price REAL,
  fvg_lower_price REAL,
  fvg_mid_price REAL, -- 预计算中间价
  fvg_range_width REAL, -- 预计算区间宽度
  fvg_type TEXT, -- 'bullish'/'bearish'
  fvg_strength REAL, -- FVG强度评分 (0-100)
  fvg_age_hours INTEGER, -- FVG年龄(小时)
  fvg_filled_percentage REAL DEFAULT 0, -- 填充百分比
  
  -- 当前价格相关 (预计算距离)
  current_price REAL,
  distance_to_ob_upper REAL, -- 到OB上沿距离
  distance_to_ob_lower REAL, -- 到OB下沿距离  
  distance_to_fvg_upper REAL, -- 到FVG上沿距离
  distance_to_fvg_lower REAL, -- 到FVG下沿距离
  
  -- 区间关系 (预计算)
  ob_fvg_overlap BOOLEAN DEFAULT FALSE, -- 是否重叠
  ob_fvg_gap_size REAL, -- 间隙大小
  price_in_ob BOOLEAN DEFAULT FALSE, -- 价格是否在OB内
  price_in_fvg BOOLEAN DEFAULT FALSE, -- 价格是否在FVG内
  
  -- 性能优化字段
  is_active BOOLEAN DEFAULT TRUE, -- 是否活跃
  priority_score REAL, -- 优先级评分 (用于缓存策略)
  last_calculated DATETIME DEFAULT CURRENT_TIMESTAMP,
  calculation_version INTEGER DEFAULT 1, -- 计算版本号
  
  -- 时间戳
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- 复合唯一索引
  UNIQUE(symbol, timeframe, created_at)
);

-- V3策略价格表 (独立表，高频更新)
CREATE TABLE IF NOT EXISTS v3_price_ranges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL, -- '1H'
  
  -- 震荡市区间价格
  range_upper_boundary REAL,
  range_lower_boundary REAL,  
  range_mid_price REAL, -- 预计算中间价
  range_width REAL, -- 预计算区间宽度
  range_width_percentage REAL, -- 区间宽度百分比
  range_volume_profile TEXT, -- JSON: 成交量分布
  range_test_count_upper INTEGER DEFAULT 0, -- 上边界测试次数
  range_test_count_lower INTEGER DEFAULT 0, -- 下边界测试次数
  range_breakout_probability REAL, -- 突破概率
  
  -- 趋势市入场价格
  trend_entry_price REAL,
  trend_confirmation_price REAL,
  trend_breakout_price REAL,
  trend_invalidation_price REAL, -- 趋势失效价格
  trend_momentum_score REAL, -- 趋势动量评分
  trend_volume_confirmation REAL, -- 成交量确认度
  
  -- 当前价格相关 (预计算)
  current_price REAL,
  price_position_in_range REAL, -- 价格在区间中的位置 (0-1)
  distance_to_upper_boundary REAL,
  distance_to_lower_boundary REAL,
  distance_to_trend_entry REAL,
  
  -- 市场状态判断 (预计算)
  market_type TEXT, -- 'trending'/'ranging'
  market_phase TEXT, -- 'accumulation'/'markup'/'distribution'/'markdown'
  volatility_regime TEXT, -- 'low'/'medium'/'high'
  
  -- 风险管理 (预计算)
  optimal_stop_loss REAL,
  risk_reward_ratio REAL,
  position_size_suggestion REAL,
  
  -- 性能优化字段
  is_active BOOLEAN DEFAULT TRUE,
  priority_score REAL,
  last_calculated DATETIME DEFAULT CURRENT_TIMESTAMP,
  calculation_version INTEGER DEFAULT 1,
  
  -- 时间戳
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- 复合唯一索引
  UNIQUE(symbol, timeframe, created_at)
);
```

## 📈 高性能索引策略

```sql
-- ICT价格表索引 (优化查询性能)
CREATE INDEX IF NOT EXISTS idx_ict_symbol_active ON ict_price_ranges(symbol, is_active, priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_ict_timeframe_updated ON ict_price_ranges(timeframe, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ict_price_in_ranges ON ict_price_ranges(symbol, price_in_ob, price_in_fvg);
CREATE INDEX IF NOT EXISTS idx_ict_strength_scores ON ict_price_ranges(symbol, ob_strength DESC, fvg_strength DESC);

-- V3价格表索引 (优化查询性能)  
CREATE INDEX IF NOT EXISTS idx_v3_symbol_active ON v3_price_ranges(symbol, is_active, priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_v3_market_type ON v3_price_ranges(symbol, market_type, market_phase);
CREATE INDEX IF NOT EXISTS idx_v3_price_position ON v3_price_ranges(symbol, price_position_in_range);
CREATE INDEX IF NOT EXISTS idx_v3_updated_priority ON v3_price_ranges(updated_at DESC, priority_score DESC);

-- 复合索引 (优化多条件查询)
CREATE INDEX IF NOT EXISTS idx_ict_active_updated ON ict_price_ranges(symbol, is_active, updated_at DESC, priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_v3_active_updated ON v3_price_ranges(symbol, is_active, updated_at DESC, priority_score DESC);
```

## 🚀 缓存策略设计

### 1. 多层缓存架构

```javascript
class PriceDataCacheManager {
  constructor() {
    this.l1Cache = new Map(); // 内存缓存 (最热数据)
    this.l2Cache = new Map(); // 内存缓存 (次热数据)  
    this.cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
  }
  
  // L1缓存: 当前活跃交易对价格数据 (TTL: 30秒)
  setL1Cache(key, data) {
    const cacheEntry = {
      data,
      timestamp: Date.now(),
      ttl: 30 * 1000, // 30秒
      accessCount: 0
    };
    this.l1Cache.set(key, cacheEntry);
  }
  
  // L2缓存: 历史价格数据 (TTL: 5分钟)
  setL2Cache(key, data) {
    const cacheEntry = {
      data,
      timestamp: Date.now(), 
      ttl: 5 * 60 * 1000, // 5分钟
      accessCount: 0
    };
    this.l2Cache.set(key, cacheEntry);
  }
}
```

### 2. 智能缓存策略

```javascript
class SmartCacheStrategy {
  // 基于访问频率和优先级的缓存策略
  shouldCache(symbol, priceData) {
    const factors = {
      priorityScore: priceData.priority_score || 0,
      accessFrequency: this.getAccessFrequency(symbol),
      dataFreshness: this.getDataAge(priceData.updated_at),
      volatility: this.getVolatility(symbol)
    };
    
    // 加权评分决定是否缓存
    const cacheScore = (
      factors.priorityScore * 0.4 +
      factors.accessFrequency * 0.3 +
      factors.dataFreshness * 0.2 +
      factors.volatility * 0.1
    );
    
    return cacheScore > 0.6; // 阈值
  }
}
```

## ⚡ 数据库连接池优化

```javascript
class OptimizedDatabasePool {
  constructor() {
    this.readPool = new DatabasePool({
      max: 10, // 读连接池
      min: 2,
      acquireTimeoutMillis: 3000,
      idleTimeoutMillis: 30000
    });
    
    this.writePool = new DatabasePool({
      max: 5, // 写连接池  
      min: 1,
      acquireTimeoutMillis: 5000,
      idleTimeoutMillis: 60000
    });
  }
  
  // 读操作使用读连接池
  async executeRead(query, params) {
    const connection = await this.readPool.acquire();
    try {
      return await connection.query(query, params);
    } finally {
      this.readPool.release(connection);
    }
  }
  
  // 写操作使用写连接池
  async executeWrite(query, params) {
    const connection = await this.writePool.acquire();
    try {
      return await connection.query(query, params);
    } finally {
      this.writePool.release(connection);
    }
  }
}
```

## 🔄 异步批量处理

```javascript
class BatchPriceProcessor {
  constructor() {
    this.batchSize = 50; // 批处理大小
    this.batchTimeout = 1000; // 1秒超时
    this.pendingBatches = new Map();
  }
  
  // 批量更新价格数据
  async batchUpdatePrices(updates) {
    const batches = this.chunkArray(updates, this.batchSize);
    
    const promises = batches.map(batch => 
      this.processBatch(batch)
    );
    
    return Promise.allSettled(promises);
  }
  
  // 异步处理单个批次
  async processBatch(batch) {
    const transaction = await this.db.beginTransaction();
    
    try {
      for (const update of batch) {
        await this.updatePriceRecord(update, transaction);
      }
      
      await transaction.commit();
      return { success: true, count: batch.length };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
```

## 📊 性能监控指标

```javascript
class PriceDataPerformanceMonitor {
  constructor() {
    this.metrics = {
      queryLatency: [], // 查询延迟
      cacheHitRate: 0,  // 缓存命中率
      batchProcessingTime: [], // 批处理时间
      databaseConnections: 0, // 数据库连接数
      memoryUsage: 0 // 内存使用量
    };
  }
  
  // 记录查询性能
  recordQueryLatency(startTime, endTime) {
    const latency = endTime - startTime;
    this.metrics.queryLatency.push(latency);
    
    // 保持最近1000条记录
    if (this.metrics.queryLatency.length > 1000) {
      this.metrics.queryLatency.shift();
    }
  }
  
  // 获取性能报告
  getPerformanceReport() {
    return {
      avgQueryLatency: this.calculateAverage(this.metrics.queryLatency),
      p95QueryLatency: this.calculatePercentile(this.metrics.queryLatency, 95),
      cacheHitRate: this.metrics.cacheHitRate,
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }
}
```

## 🎯 查询优化策略

### 1. 预计算常用指标
```sql
-- 创建物化视图 (定期刷新)
CREATE VIEW IF NOT EXISTS active_price_summary AS
SELECT 
  symbol,
  AVG(priority_score) as avg_priority,
  COUNT(*) as record_count,
  MAX(updated_at) as last_update,
  AVG(ob_strength) as avg_ob_strength,
  AVG(fvg_strength) as avg_fvg_strength
FROM ict_price_ranges 
WHERE is_active = TRUE 
GROUP BY symbol;
```

### 2. 分页查询优化
```javascript
class OptimizedPriceQuery {
  // 使用游标分页，避免OFFSET性能问题
  async getPriceDataPaginated(symbol, lastId = 0, limit = 20) {
    const query = `
      SELECT * FROM ict_price_ranges 
      WHERE symbol = ? AND id > ? AND is_active = TRUE
      ORDER BY priority_score DESC, id ASC 
      LIMIT ?
    `;
    
    return await this.db.query(query, [symbol, lastId, limit]);
  }
}
```

## 📈 内存优化策略

```javascript
class MemoryOptimizedPriceManager {
  constructor() {
    this.dataPool = new ObjectPool(() => ({})); // 对象池
    this.stringPool = new Map(); // 字符串池
  }
  
  // 使用对象池减少GC压力
  createPriceObject(data) {
    const obj = this.dataPool.acquire();
    Object.assign(obj, data);
    return obj;
  }
  
  // 释放对象回池
  releasePriceObject(obj) {
    Object.keys(obj).forEach(key => delete obj[key]);
    this.dataPool.release(obj);
  }
  
  // 字符串去重
  internString(str) {
    if (!this.stringPool.has(str)) {
      this.stringPool.set(str, str);
    }
    return this.stringPool.get(str);
  }
}
```

---

**设计版本**: v2.0 - 高性能版  
**性能目标**: 
- 查询延迟 < 50ms (P95)
- 缓存命中率 > 85%
- 批处理吞吐量 > 1000 ops/s
- 内存使用 < 512MB
