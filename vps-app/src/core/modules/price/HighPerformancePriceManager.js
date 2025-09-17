// HighPerformancePriceManager.js - 高性能价格数据管理器

class HighPerformancePriceManager {
  constructor(database) {
    this.db = database;
    this.cache = new Map(); // L1缓存
    this.l2Cache = new Map(); // L2缓存
    this.batchQueue = new Map(); // 批处理队列
    this.batchSize = 50;
    this.batchTimeout = 1000; // 1秒
    this.cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
    
    // 启动批处理定时器
    this.startBatchProcessor();
    
    // 启动缓存清理定时器
    this.startCacheCleanup();
  }

  /**
   * 获取ICT策略价格数据
   */
  async getICTPriceRanges(symbol, options = {}) {
    const cacheKey = `ict_${symbol}_${JSON.stringify(options)}`;
    
    // 尝试从缓存获取
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.cacheStats.hits++;
      return cached;
    }

    this.cacheStats.misses++;

    // 构建查询
    const query = this.buildICTQuery(symbol, options);
    const startTime = Date.now();

    try {
      const results = await new Promise((resolve, reject) => {
        this.db.all(query.sql, query.params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      const endTime = Date.now();
      this.logPerformance('ict_query', endTime - startTime);

      // 处理结果并缓存
      const processedResults = this.processICTResults(results);
      this.setCache(cacheKey, processedResults, 30000); // 30秒TTL

      return processedResults;

    } catch (error) {
      console.error('ICT价格查询失败:', error);
      throw error;
    }
  }

  /**
   * 获取V3策略价格数据
   */
  async getV3PriceRanges(symbol, options = {}) {
    const cacheKey = `v3_${symbol}_${JSON.stringify(options)}`;
    
    // 尝试从缓存获取
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.cacheStats.hits++;
      return cached;
    }

    this.cacheStats.misses++;

    // 构建查询
    const query = this.buildV3Query(symbol, options);
    const startTime = Date.now();

    try {
      const results = await new Promise((resolve, reject) => {
        this.db.all(query.sql, query.params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      const endTime = Date.now();
      this.logPerformance('v3_query', endTime - startTime);

      // 处理结果并缓存
      const processedResults = this.processV3Results(results);
      this.setCache(cacheKey, processedResults, 30000); // 30秒TTL

      return processedResults;

    } catch (error) {
      console.error('V3价格查询失败:', error);
      throw error;
    }
  }

  /**
   * 批量更新ICT价格数据
   */
  async updateICTPriceRanges(symbol, priceData) {
    const updateKey = `ict_${symbol}`;
    
    // 添加到批处理队列
    if (!this.batchQueue.has(updateKey)) {
      this.batchQueue.set(updateKey, []);
    }
    
    this.batchQueue.get(updateKey).push({
      symbol,
      data: priceData,
      timestamp: Date.now(),
      type: 'ict'
    });

    // 如果队列达到批处理大小，立即处理
    if (this.batchQueue.get(updateKey).length >= this.batchSize) {
      await this.processBatch(updateKey);
    }

    // 清除相关缓存
    this.invalidateCache(`ict_${symbol}`);
  }

  /**
   * 批量更新V3价格数据
   */
  async updateV3PriceRanges(symbol, priceData) {
    const updateKey = `v3_${symbol}`;
    
    // 添加到批处理队列
    if (!this.batchQueue.has(updateKey)) {
      this.batchQueue.set(updateKey, []);
    }
    
    this.batchQueue.get(updateKey).push({
      symbol,
      data: priceData,
      timestamp: Date.now(),
      type: 'v3'
    });

    // 如果队列达到批处理大小，立即处理
    if (this.batchQueue.get(updateKey).length >= this.batchSize) {
      await this.processBatch(updateKey);
    }

    // 清除相关缓存
    this.invalidateCache(`v3_${symbol}`);
  }

  /**
   * 构建ICT查询
   */
  buildICTQuery(symbol, options) {
    let sql = `
      SELECT * FROM ict_price_ranges 
      WHERE symbol = ? AND is_active = TRUE
    `;
    const params = [symbol];

    // 添加时间过滤
    if (options.since) {
      sql += ' AND updated_at > ?';
      params.push(options.since);
    }

    // 添加强度过滤
    if (options.minStrength) {
      sql += ' AND (ob_strength >= ? OR fvg_strength >= ?)';
      params.push(options.minStrength, options.minStrength);
    }

    // 添加价格范围过滤
    if (options.priceInRange) {
      sql += ' AND (price_in_ob = TRUE OR price_in_fvg = TRUE)';
    }

    // 排序和限制
    sql += ' ORDER BY priority_score DESC, updated_at DESC';
    
    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    return { sql, params };
  }

  /**
   * 构建V3查询
   */
  buildV3Query(symbol, options) {
    let sql = `
      SELECT * FROM v3_price_ranges 
      WHERE symbol = ? AND is_active = TRUE
    `;
    const params = [symbol];

    // 添加时间过滤
    if (options.since) {
      sql += ' AND updated_at > ?';
      params.push(options.since);
    }

    // 添加市场类型过滤
    if (options.marketType) {
      sql += ' AND market_type = ?';
      params.push(options.marketType);
    }

    // 添加趋势强度过滤
    if (options.minMomentum) {
      sql += ' AND trend_momentum_score >= ?';
      params.push(options.minMomentum);
    }

    // 排序和限制
    sql += ' ORDER BY priority_score DESC, updated_at DESC';
    
    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    return { sql, params };
  }

  /**
   * 处理ICT查询结果
   */
  processICTResults(results) {
    return results.map(row => ({
      ...row,
      // 计算实时指标
      ob_health_score: this.calculateOBHealth(row),
      fvg_health_score: this.calculateFVGHealth(row),
      overall_strength: this.calculateOverallStrength(row),
      // 格式化价格
      formatted_prices: {
        ob_range: `${row.ob_lower_price?.toFixed(4)} - ${row.ob_upper_price?.toFixed(4)}`,
        fvg_range: `${row.fvg_lower_price?.toFixed(4)} - ${row.fvg_upper_price?.toFixed(4)}`,
        current: row.current_price?.toFixed(4)
      }
    }));
  }

  /**
   * 处理V3查询结果
   */
  processV3Results(results) {
    return results.map(row => ({
      ...row,
      // 计算实时指标
      range_health_score: this.calculateRangeHealth(row),
      trend_health_score: this.calculateTrendHealth(row),
      breakout_probability: this.calculateBreakoutProbability(row),
      // 格式化价格
      formatted_prices: {
        range_boundary: `${row.range_lower_boundary?.toFixed(4)} - ${row.range_upper_boundary?.toFixed(4)}`,
        trend_entry: row.trend_entry_price?.toFixed(4),
        current: row.current_price?.toFixed(4)
      }
    }));
  }

  /**
   * 计算OB健康度
   */
  calculateOBHealth(data) {
    if (!data.ob_upper_price || !data.ob_lower_price) return 0;

    let score = 0;
    
    // 强度评分 (40%)
    score += (data.ob_strength || 0) * 0.4;
    
    // 年龄评分 (30%) - 年龄越小越好
    const ageScore = Math.max(0, 100 - (data.ob_age_hours || 0) / 24 * 10);
    score += ageScore * 0.3;
    
    // 测试次数评分 (20%) - 测试次数适中最好
    const testScore = data.ob_tested_count <= 3 ? 100 : Math.max(0, 100 - (data.ob_tested_count - 3) * 20);
    score += testScore * 0.2;
    
    // 区间宽度评分 (10%)
    const widthScore = data.ob_range_width > 0 ? Math.min(100, data.ob_range_width * 10) : 0;
    score += widthScore * 0.1;

    return Math.round(score);
  }

  /**
   * 计算FVG健康度
   */
  calculateFVGHealth(data) {
    if (!data.fvg_upper_price || !data.fvg_lower_price) return 0;

    let score = 0;
    
    // 强度评分 (50%)
    score += (data.fvg_strength || 0) * 0.5;
    
    // 填充程度评分 (30%) - 填充越少越好
    const fillScore = Math.max(0, 100 - (data.fvg_filled_percentage || 0));
    score += fillScore * 0.3;
    
    // 年龄评分 (20%)
    const ageScore = Math.max(0, 100 - (data.fvg_age_hours || 0) / 12 * 10);
    score += ageScore * 0.2;

    return Math.round(score);
  }

  /**
   * 计算整体强度
   */
  calculateOverallStrength(data) {
    const obHealth = this.calculateOBHealth(data);
    const fvgHealth = this.calculateFVGHealth(data);
    
    // 如果有重叠，给予额外加分
    const overlapBonus = data.ob_fvg_overlap ? 20 : 0;
    
    return Math.min(100, Math.max(obHealth, fvgHealth) + overlapBonus);
  }

  /**
   * 计算区间健康度
   */
  calculateRangeHealth(data) {
    if (!data.range_upper_boundary || !data.range_lower_boundary) return 0;

    let score = 0;
    
    // 区间宽度评分 (40%)
    const widthScore = data.range_width_percentage > 0 ? 
      Math.min(100, data.range_width_percentage * 5) : 0;
    score += widthScore * 0.4;
    
    // 测试次数评分 (30%)
    const totalTests = (data.range_test_count_upper || 0) + (data.range_test_count_lower || 0);
    const testScore = totalTests > 0 && totalTests <= 5 ? 100 : Math.max(0, 100 - totalTests * 10);
    score += testScore * 0.3;
    
    // 价格位置评分 (30%)
    const positionScore = data.price_position_in_range !== null ? 
      (0.5 - Math.abs(data.price_position_in_range - 0.5)) * 200 : 0;
    score += positionScore * 0.3;

    return Math.round(score);
  }

  /**
   * 计算趋势健康度
   */
  calculateTrendHealth(data) {
    let score = 0;
    
    // 动量评分 (50%)
    score += (data.trend_momentum_score || 0) * 0.5;
    
    // 成交量确认评分 (30%)
    score += (data.trend_volume_confirmation || 0) * 0.3;
    
    // 风险回报比评分 (20%)
    const rrScore = data.risk_reward_ratio > 0 ? 
      Math.min(100, data.risk_reward_ratio * 20) : 0;
    score += rrScore * 0.2;

    return Math.round(score);
  }

  /**
   * 计算突破概率
   */
  calculateBreakoutProbability(data) {
    if (data.range_breakout_probability !== null) {
      return data.range_breakout_probability;
    }

    // 基于多个因素计算突破概率
    let probability = 0;
    
    // 趋势动量
    probability += (data.trend_momentum_score || 0) * 0.4;
    
    // 区间测试次数
    const totalTests = (data.range_test_count_upper || 0) + (data.range_test_count_lower || 0);
    if (totalTests > 3) probability += 30;
    
    // 成交量确认
    probability += (data.trend_volume_confirmation || 0) * 0.3;

    return Math.min(100, probability);
  }

  /**
   * 缓存操作
   */
  getFromCache(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      this.cacheStats.evictions++;
      return null;
    }

    entry.accessCount++;
    entry.lastAccess = Date.now();
    return entry.data;
  }

  setCache(key, data, ttl = 30000) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl,
      accessCount: 0,
      lastAccess: Date.now()
    });

    // 缓存大小控制
    if (this.cache.size > 1000) {
      this.evictLRU();
    }
  }

  invalidateCache(pattern) {
    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    this.cacheStats.evictions += keysToDelete.length;
  }

  evictLRU() {
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.cacheStats.evictions++;
    }
  }

  /**
   * 批处理操作
   */
  startBatchProcessor() {
    setInterval(() => {
      this.processPendingBatches();
    }, this.batchTimeout);
  }

  async processPendingBatches() {
    const batchKeys = Array.from(this.batchQueue.keys());
    
    for (const key of batchKeys) {
      const batch = this.batchQueue.get(key);
      if (batch && batch.length > 0) {
        await this.processBatch(key);
      }
    }
  }

  async processBatch(batchKey) {
    const batch = this.batchQueue.get(batchKey);
    if (!batch || batch.length === 0) return;

    const startTime = Date.now();

    try {
      // 按类型分组处理
      const ictUpdates = batch.filter(item => item.type === 'ict');
      const v3Updates = batch.filter(item => item.type === 'v3');

      if (ictUpdates.length > 0) {
        await this.batchUpdateICT(ictUpdates);
      }

      if (v3Updates.length > 0) {
        await this.batchUpdateV3(v3Updates);
      }

      // 清空已处理的批次
      this.batchQueue.set(batchKey, []);

      const endTime = Date.now();
      this.logPerformance('batch_process', endTime - startTime, batch.length);

    } catch (error) {
      console.error('批处理失败:', error);
      // 重试逻辑或错误处理
    }
  }

  async batchUpdateICT(updates) {
    const placeholders = updates.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const values = updates.flatMap(update => [
      update.symbol,
      update.data.ob_upper_price,
      update.data.ob_lower_price,
      update.data.fvg_upper_price,
      update.data.fvg_lower_price,
      update.data.current_price,
      update.data.ob_strength || 0,
      update.data.fvg_strength || 0,
      update.data.priority_score || 50,
      update.data.is_active ? 1 : 0,
      update.data.calculation_version || 1,
      new Date().toISOString(),
      new Date().toISOString()
    ]);

    const sql = `
      INSERT OR REPLACE INTO ict_price_ranges 
      (symbol, ob_upper_price, ob_lower_price, fvg_upper_price, fvg_lower_price, 
       current_price, ob_strength, fvg_strength, priority_score, is_active, 
       calculation_version, created_at, updated_at) 
      VALUES ${placeholders}
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, values, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async batchUpdateV3(updates) {
    const placeholders = updates.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const values = updates.flatMap(update => [
      update.symbol,
      update.data.range_upper_boundary,
      update.data.range_lower_boundary,
      update.data.trend_entry_price,
      update.data.trend_confirmation_price,
      update.data.current_price,
      update.data.market_type,
      update.data.trend_momentum_score || 0,
      update.data.range_breakout_probability || 0,
      update.data.priority_score || 50,
      update.data.is_active ? 1 : 0,
      update.data.calculation_version || 1,
      new Date().toISOString()
    ]);

    const sql = `
      INSERT OR REPLACE INTO v3_price_ranges 
      (symbol, range_upper_boundary, range_lower_boundary, trend_entry_price, 
       trend_confirmation_price, current_price, market_type, trend_momentum_score, 
       range_breakout_probability, priority_score, is_active, calculation_version, updated_at) 
      VALUES ${placeholders}
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, values, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * 缓存清理
   */
  startCacheCleanup() {
    setInterval(() => {
      this.cleanupExpiredCache();
    }, 60000); // 每分钟清理一次
  }

  cleanupExpiredCache() {
    const now = Date.now();
    const keysToDelete = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    this.cacheStats.evictions += keysToDelete.length;
  }

  /**
   * 性能日志
   */
  logPerformance(operation, duration, count = 1) {
    if (duration > 100) { // 只记录超过100ms的操作
      console.log(`⚡ 性能日志: ${operation} - ${duration}ms (${count} 项)`);
    }
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats() {
    return {
      cache: {
        size: this.cache.size,
        hits: this.cacheStats.hits,
        misses: this.cacheStats.misses,
        hitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) * 100,
        evictions: this.cacheStats.evictions
      },
      batch: {
        queueSize: Array.from(this.batchQueue.values()).reduce((sum, batch) => sum + batch.length, 0),
        activeQueues: this.batchQueue.size
      },
      memory: process.memoryUsage()
    };
  }
}

module.exports = HighPerformancePriceManager;
