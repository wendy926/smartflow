// PriceFieldsAPI.js - 价格字段API接口

class PriceFieldsAPI {
  constructor(database, priceManager) {
    this.db = database;
    this.priceManager = priceManager;
  }

  /**
   * 设置API路由
   */
  setupRoutes(app) {
    // ICT策略价格区间接口
    app.get('/api/ict/price-ranges/:symbol', this.getICTPriceRanges.bind(this));
    app.post('/api/ict/price-ranges/:symbol', this.updateICTPriceRanges.bind(this));
    app.get('/api/ict/price-summary', this.getICTPriceSummary.bind(this));

    // V3策略价格边界接口
    app.get('/api/v3/price-boundaries/:symbol', this.getV3PriceBoundaries.bind(this));
    app.post('/api/v3/price-boundaries/:symbol', this.updateV3PriceBoundaries.bind(this));
    app.get('/api/v3/price-summary', this.getV3PriceSummary.bind(this));

    // 统一价格数据接口
    app.get('/api/price-fields/unified/:symbol', this.getUnifiedPriceData.bind(this));
    app.get('/api/price-fields/performance', this.getPerformanceStats.bind(this));
    app.get('/api/price-fields/health', this.getHealthStatus.bind(this));

    // 批量操作接口
    app.post('/api/price-fields/batch-update', this.batchUpdatePriceFields.bind(this));
    app.get('/api/price-fields/active-symbols', this.getActiveSymbols.bind(this));

    console.log('✅ 价格字段API路由设置完成');
  }

  /**
   * 获取ICT策略价格区间
   */
  async getICTPriceRanges(req, res) {
    try {
      const { symbol } = req.params;
      const options = {
        since: req.query.since,
        minStrength: parseFloat(req.query.minStrength) || 0,
        priceInRange: req.query.priceInRange === 'true',
        limit: parseInt(req.query.limit) || 50
      };

      const startTime = Date.now();
      const priceRanges = await this.priceManager.getICTPriceRanges(symbol, options);
      const duration = Date.now() - startTime;

      res.json({
        success: true,
        data: {
          symbol,
          timeframe: '4H',
          ranges: priceRanges,
          metadata: {
            count: priceRanges.length,
            queryTime: duration,
            lastUpdate: priceRanges[0]?.updated_at || null
          }
        }
      });

    } catch (error) {
      console.error('获取ICT价格区间失败:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * 更新ICT策略价格区间
   */
  async updateICTPriceRanges(req, res) {
    try {
      const { symbol } = req.params;
      const priceData = req.body;

      // 验证输入数据
      const validation = this.validateICTPriceData(priceData);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.errors
        });
      }

      // 计算辅助字段
      const enrichedData = this.enrichICTPriceData(priceData);

      // 更新价格数据
      await this.priceManager.updateICTPriceRanges(symbol, enrichedData);

      res.json({
        success: true,
        data: {
          symbol,
          updated: true,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('更新ICT价格区间失败:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * 获取ICT价格摘要
   */
  async getICTPriceSummary(req, res) {
    try {
      const symbols = req.query.symbols ? req.query.symbols.split(',') : [];
      const limit = parseInt(req.query.limit) || 20;

      let query = `
        SELECT 
          symbol,
          COUNT(*) as total_ranges,
          AVG(ob_strength) as avg_ob_strength,
          AVG(fvg_strength) as avg_fvg_strength,
          AVG(priority_score) as avg_priority,
          MAX(updated_at) as last_update,
          SUM(CASE WHEN price_in_ob OR price_in_fvg THEN 1 ELSE 0 END) as active_ranges,
          AVG(ob_fvg_gap_size) as avg_gap_size
        FROM ict_price_ranges 
        WHERE is_active = TRUE
      `;

      const params = [];

      if (symbols.length > 0) {
        const placeholders = symbols.map(() => '?').join(',');
        query += ` AND symbol IN (${placeholders})`;
        params.push(...symbols);
      }

      query += ` GROUP BY symbol ORDER BY avg_priority DESC LIMIT ?`;
      params.push(limit);

      const results = await new Promise((resolve, reject) => {
        this.db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      res.json({
        success: true,
        data: {
          summary: results,
          metadata: {
            count: results.length,
            timestamp: new Date().toISOString()
          }
        }
      });

    } catch (error) {
      console.error('获取ICT价格摘要失败:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * 获取V3策略价格边界
   */
  async getV3PriceBoundaries(req, res) {
    try {
      const { symbol } = req.params;
      const options = {
        since: req.query.since,
        marketType: req.query.marketType,
        minMomentum: parseFloat(req.query.minMomentum) || 0,
        limit: parseInt(req.query.limit) || 50
      };

      const startTime = Date.now();
      const priceBoundaries = await this.priceManager.getV3PriceRanges(symbol, options);
      const duration = Date.now() - startTime;

      res.json({
        success: true,
        data: {
          symbol,
          timeframe: '1H',
          boundaries: priceBoundaries,
          metadata: {
            count: priceBoundaries.length,
            queryTime: duration,
            lastUpdate: priceBoundaries[0]?.updated_at || null
          }
        }
      });

    } catch (error) {
      console.error('获取V3价格边界失败:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * 更新V3策略价格边界
   */
  async updateV3PriceBoundaries(req, res) {
    try {
      const { symbol } = req.params;
      const priceData = req.body;

      // 验证输入数据
      const validation = this.validateV3PriceData(priceData);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.errors
        });
      }

      // 计算辅助字段
      const enrichedData = this.enrichV3PriceData(priceData);

      // 更新价格数据
      await this.priceManager.updateV3PriceRanges(symbol, enrichedData);

      res.json({
        success: true,
        data: {
          symbol,
          updated: true,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('更新V3价格边界失败:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * 获取V3价格摘要
   */
  async getV3PriceSummary(req, res) {
    try {
      const symbols = req.query.symbols ? req.query.symbols.split(',') : [];
      const limit = parseInt(req.query.limit) || 20;

      let query = `
        SELECT 
          symbol,
          COUNT(*) as total_ranges,
          AVG(trend_momentum_score) as avg_momentum,
          AVG(range_breakout_probability) as avg_breakout_prob,
          AVG(priority_score) as avg_priority,
          MAX(updated_at) as last_update,
          COUNT(CASE WHEN market_type = 'trending' THEN 1 END) as trending_count,
          COUNT(CASE WHEN market_type = 'ranging' THEN 1 END) as ranging_count,
          AVG(risk_reward_ratio) as avg_risk_reward
        FROM v3_price_ranges 
        WHERE is_active = TRUE
      `;

      const params = [];

      if (symbols.length > 0) {
        const placeholders = symbols.map(() => '?').join(',');
        query += ` AND symbol IN (${placeholders})`;
        params.push(...symbols);
      }

      query += ` GROUP BY symbol ORDER BY avg_priority DESC LIMIT ?`;
      params.push(limit);

      const results = await new Promise((resolve, reject) => {
        this.db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      res.json({
        success: true,
        data: {
          summary: results,
          metadata: {
            count: results.length,
            timestamp: new Date().toISOString()
          }
        }
      });

    } catch (error) {
      console.error('获取V3价格摘要失败:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * 获取统一价格数据
   */
  async getUnifiedPriceData(req, res) {
    try {
      const { symbol } = req.params;

      // 并行获取ICT和V3数据
      const [ictData, v3Data] = await Promise.all([
        this.priceManager.getICTPriceRanges(symbol, { limit: 10 }),
        this.priceManager.getV3PriceRanges(symbol, { limit: 10 })
      ]);

      res.json({
        success: true,
        data: {
          symbol,
          strategies: {
            ict: {
              timeframe: '4H',
              ranges: ictData,
              count: ictData.length
            },
            v3: {
              timeframe: '1H',
              boundaries: v3Data,
              count: v3Data.length
            }
          },
          metadata: {
            timestamp: new Date().toISOString(),
            lastUpdate: {
              ict: ictData[0]?.updated_at || null,
              v3: v3Data[0]?.updated_at || null
            }
          }
        }
      });

    } catch (error) {
      console.error('获取统一价格数据失败:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * 获取性能统计
   */
  async getPerformanceStats(req, res) {
    try {
      const stats = this.priceManager.getPerformanceStats();
      
      // 添加数据库统计
      const dbStats = await this.getDatabaseStats();

      res.json({
        success: true,
        data: {
          performance: stats,
          database: dbStats,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('获取性能统计失败:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * 获取健康状态
   */
  async getHealthStatus(req, res) {
    try {
      const health = {
        status: 'healthy',
        checks: {
          database: await this.checkDatabaseHealth(),
          cache: this.checkCacheHealth(),
          performance: this.checkPerformanceHealth()
        },
        timestamp: new Date().toISOString()
      };

      // 确定整体状态
      const hasUnhealthy = Object.values(health.checks).some(check => check.status !== 'healthy');
      if (hasUnhealthy) {
        health.status = 'degraded';
      }

      res.json({
        success: true,
        data: health
      });

    } catch (error) {
      console.error('获取健康状态失败:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
        health: {
          status: 'unhealthy',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * 批量更新价格字段
   */
  async batchUpdatePriceFields(req, res) {
    try {
      const { updates } = req.body;

      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid updates array'
        });
      }

      const results = {
        successful: 0,
        failed: 0,
        errors: []
      };

      for (const update of updates) {
        try {
          const { symbol, strategy, data } = update;

          if (strategy === 'ict') {
            await this.priceManager.updateICTPriceRanges(symbol, data);
          } else if (strategy === 'v3') {
            await this.priceManager.updateV3PriceRanges(symbol, data);
          } else {
            throw new Error(`Unknown strategy: ${strategy}`);
          }

          results.successful++;

        } catch (error) {
          results.failed++;
          results.errors.push({
            symbol: update.symbol,
            strategy: update.strategy,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        data: results
      });

    } catch (error) {
      console.error('批量更新失败:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * 获取活跃交易对
   */
  async getActiveSymbols(req, res) {
    try {
      const query = `
        SELECT DISTINCT symbol, 
               MAX(updated_at) as last_update,
               COUNT(*) as record_count
        FROM (
          SELECT symbol, updated_at FROM ict_price_ranges WHERE is_active = TRUE
          UNION ALL
          SELECT symbol, updated_at FROM v3_price_ranges WHERE is_active = TRUE
        ) 
        GROUP BY symbol 
        ORDER BY last_update DESC
        LIMIT 100
      `;

      const symbols = await new Promise((resolve, reject) => {
        this.db.all(query, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      res.json({
        success: true,
        data: {
          symbols,
          count: symbols.length,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('获取活跃交易对失败:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  // 辅助方法

  validateICTPriceData(data) {
    const errors = [];

    if (data.ob_upper_price !== undefined && data.ob_lower_price !== undefined) {
      if (data.ob_upper_price <= data.ob_lower_price) {
        errors.push('OB上沿价格必须大于下沿价格');
      }
    }

    if (data.fvg_upper_price !== undefined && data.fvg_lower_price !== undefined) {
      if (data.fvg_upper_price <= data.fvg_lower_price) {
        errors.push('FVG上沿价格必须大于下沿价格');
      }
    }

    if (data.ob_strength !== undefined && (data.ob_strength < 0 || data.ob_strength > 100)) {
      errors.push('OB强度必须在0-100之间');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  validateV3PriceData(data) {
    const errors = [];

    if (data.range_upper_boundary !== undefined && data.range_lower_boundary !== undefined) {
      if (data.range_upper_boundary <= data.range_lower_boundary) {
        errors.push('区间上边界必须大于下边界');
      }
    }

    if (data.trend_momentum_score !== undefined && (data.trend_momentum_score < 0 || data.trend_momentum_score > 100)) {
      errors.push('趋势动量评分必须在0-100之间');
    }

    if (data.risk_reward_ratio !== undefined && data.risk_reward_ratio < 0) {
      errors.push('风险回报比不能为负数');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  enrichICTPriceData(data) {
    const enriched = { ...data };

    // 计算中间价格
    if (data.ob_upper_price && data.ob_lower_price) {
      enriched.ob_mid_price = (data.ob_upper_price + data.ob_lower_price) / 2;
      enriched.ob_range_width = data.ob_upper_price - data.ob_lower_price;
    }

    if (data.fvg_upper_price && data.fvg_lower_price) {
      enriched.fvg_mid_price = (data.fvg_upper_price + data.fvg_lower_price) / 2;
      enriched.fvg_range_width = data.fvg_upper_price - data.fvg_lower_price;
    }

    // 计算价格距离
    if (data.current_price) {
      if (enriched.ob_upper_price) enriched.distance_to_ob_upper = Math.abs(data.current_price - enriched.ob_upper_price);
      if (enriched.ob_lower_price) enriched.distance_to_ob_lower = Math.abs(data.current_price - enriched.ob_lower_price);
      if (enriched.fvg_upper_price) enriched.distance_to_fvg_upper = Math.abs(data.current_price - enriched.fvg_upper_price);
      if (enriched.fvg_lower_price) enriched.distance_to_fvg_lower = Math.abs(data.current_price - enriched.fvg_lower_price);

      // 判断价格是否在区间内
      if (enriched.ob_upper_price && enriched.ob_lower_price) {
        enriched.price_in_ob = data.current_price >= enriched.ob_lower_price && data.current_price <= enriched.ob_upper_price;
      }
      if (enriched.fvg_upper_price && enriched.fvg_lower_price) {
        enriched.price_in_fvg = data.current_price >= enriched.fvg_lower_price && data.current_price <= enriched.fvg_upper_price;
      }
    }

    return enriched;
  }

  enrichV3PriceData(data) {
    const enriched = { ...data };

    // 计算区间中间价格和宽度
    if (data.range_upper_boundary && data.range_lower_boundary) {
      enriched.range_mid_price = (data.range_upper_boundary + data.range_lower_boundary) / 2;
      enriched.range_width = data.range_upper_boundary - data.range_lower_boundary;
      
      if (data.current_price) {
        enriched.range_width_percentage = (enriched.range_width / data.current_price) * 100;
        enriched.price_position_in_range = (data.current_price - data.range_lower_boundary) / enriched.range_width;
        enriched.distance_to_upper_boundary = Math.abs(data.current_price - data.range_upper_boundary);
        enriched.distance_to_lower_boundary = Math.abs(data.current_price - data.range_lower_boundary);
      }
    }

    // 计算趋势相关距离
    if (data.current_price && data.trend_entry_price) {
      enriched.distance_to_trend_entry = Math.abs(data.current_price - data.trend_entry_price);
    }

    return enriched;
  }

  async getDatabaseStats() {
    const stats = {};

    try {
      // ICT表统计
      const ictStats = await new Promise((resolve, reject) => {
        this.db.get('SELECT COUNT(*) as count, MAX(updated_at) as last_update FROM ict_price_ranges', (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      // V3表统计
      const v3Stats = await new Promise((resolve, reject) => {
        this.db.get('SELECT COUNT(*) as count, MAX(updated_at) as last_update FROM v3_price_ranges', (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      stats.ict_price_ranges = ictStats;
      stats.v3_price_ranges = v3Stats;

    } catch (error) {
      stats.error = error.message;
    }

    return stats;
  }

  async checkDatabaseHealth() {
    try {
      await new Promise((resolve, reject) => {
        this.db.get('SELECT 1', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      return { status: 'healthy', message: 'Database connection OK' };
    } catch (error) {
      return { status: 'unhealthy', message: error.message };
    }
  }

  checkCacheHealth() {
    const stats = this.priceManager.getPerformanceStats();
    const hitRate = stats.cache.hitRate;

    if (hitRate > 80) {
      return { status: 'healthy', message: `Cache hit rate: ${hitRate.toFixed(1)}%` };
    } else if (hitRate > 60) {
      return { status: 'degraded', message: `Cache hit rate low: ${hitRate.toFixed(1)}%` };
    } else {
      return { status: 'unhealthy', message: `Cache hit rate critical: ${hitRate.toFixed(1)}%` };
    }
  }

  checkPerformanceHealth() {
    const memory = process.memoryUsage();
    const memoryUsageMB = memory.heapUsed / 1024 / 1024;

    if (memoryUsageMB < 256) {
      return { status: 'healthy', message: `Memory usage: ${memoryUsageMB.toFixed(1)}MB` };
    } else if (memoryUsageMB < 512) {
      return { status: 'degraded', message: `Memory usage high: ${memoryUsageMB.toFixed(1)}MB` };
    } else {
      return { status: 'unhealthy', message: `Memory usage critical: ${memoryUsageMB.toFixed(1)}MB` };
    }
  }
}

module.exports = PriceFieldsAPI;
