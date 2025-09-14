// modules/monitoring/DataFreshnessMonitor.js - 数据新鲜度监控器

class DataFreshnessMonitor {
  constructor(database = null) {
    this.database = database;
    this.freshnessThresholds = {
      '4h': 8 * 60 * 60 * 1000,    // 4H数据：8小时过期
      '1h': 2 * 60 * 60 * 1000,    // 1H数据：2小时过期
      '15m': 30 * 60 * 1000,       // 15m数据：30分钟过期
      'realtime': 5 * 60 * 1000    // 实时数据：5分钟过期
    };
    this.alerts = new Map();
  }

  /**
   * 检查所有交易对的数据新鲜度
   */
  async checkAllSymbolsFreshness() {
    try {
      if (!this.database) {
        console.warn('数据库未初始化，跳过数据新鲜度检查');
        return;
      }

      const symbols = await this.database.getCustomSymbols();
      const results = {
        total: symbols.length,
        stale: 0,
        fresh: 0,
        errors: 0,
        details: []
      };

      console.log(`🔍 检查 ${symbols.length} 个交易对的数据新鲜度...`);

      for (const symbol of symbols) {
        try {
          const freshness = await this.checkSymbolFreshness(symbol);
          results.details.push({
            symbol,
            ...freshness
          });

          if (freshness.hasStaleData) {
            results.stale++;
            console.log(`⚠️ ${symbol}: 数据过期 - 4H:${freshness.freshness4h?.ageHours?.toFixed(1)}h, 1H:${freshness.freshness1h?.ageHours?.toFixed(1)}h, 15m:${freshness.freshness15m?.ageHours?.toFixed(1)}h`);
          } else {
            results.fresh++;
            console.log(`✅ ${symbol}: 数据新鲜`);
          }
        } catch (error) {
          results.errors++;
          console.error(`❌ ${symbol}: 检查失败 - ${error.message}`);
        }
      }

      console.log(`\n📊 数据新鲜度检查结果:`);
      console.log(`总计: ${results.total} 个交易对`);
      console.log(`新鲜: ${results.fresh} 个`);
      console.log(`过期: ${results.stale} 个`);
      console.log(`错误: ${results.errors} 个`);

      return results;

    } catch (error) {
      console.error('数据新鲜度检查失败:', error);
      return null;
    }
  }

  /**
   * 检查单个交易对的数据新鲜度
   */
  async checkSymbolFreshness(symbol) {
    const result = {
      symbol,
      hasStaleData: false,
      freshness4h: null,
      freshness1h: null,
      freshness15m: null,
      recommendations: []
    };

    try {
      // 检查4H数据新鲜度
      result.freshness4h = await this.checkIntervalFreshness(symbol, '4h');
      if (result.freshness4h.isStale) {
        result.hasStaleData = true;
        result.recommendations.push('需要更新4H K线数据');
      }

      // 检查1H数据新鲜度
      result.freshness1h = await this.checkIntervalFreshness(symbol, '1h');
      if (result.freshness1h.isStale) {
        result.hasStaleData = true;
        result.recommendations.push('需要更新1H K线数据');
      }

      // 检查15m数据新鲜度
      result.freshness15m = await this.checkIntervalFreshness(symbol, '15m');
      if (result.freshness15m.isStale) {
        result.hasStaleData = true;
        result.recommendations.push('需要更新15m K线数据');
      }

      return result;

    } catch (error) {
      console.error(`检查 ${symbol} 数据新鲜度失败:`, error);
      return {
        symbol,
        hasStaleData: true,
        error: error.message,
        recommendations: ['数据检查失败，需要手动验证']
      };
    }
  }

  /**
   * 检查特定时间间隔的数据新鲜度
   */
  async checkIntervalFreshness(symbol, interval) {
    try {
      const sql = `
        SELECT MAX(close_time) as latest_close_time, COUNT(*) as count
        FROM kline_data 
        WHERE symbol = ? AND interval = ?
      `;

      const result = await this.database.runQuery(sql, [symbol, interval]);

      if (!result || result.length === 0 || !result[0].latest_close_time) {
        return {
          interval,
          isStale: true,
          ageHours: 999,
          count: 0,
          issue: 'NO_DATA',
          message: `无${interval}数据`
        };
      }

      const latestTime = result[0].latest_close_time;
      const count = result[0].count;
      const ageMs = Date.now() - latestTime;
      const ageHours = ageMs / (1000 * 60 * 60);
      const threshold = this.freshnessThresholds[interval];

      const isStale = ageMs > threshold;

      return {
        interval,
        isStale,
        ageHours,
        count,
        latestTime: new Date(latestTime).toISOString(),
        thresholdHours: threshold / (1000 * 60 * 60),
        issue: isStale ? 'DATA_STALE' : null,
        message: isStale ? 
          `${interval}数据过期 ${ageHours.toFixed(1)}小时` : 
          `${interval}数据新鲜 (${ageHours.toFixed(1)}小时前)`
      };

    } catch (error) {
      console.error(`检查 ${symbol} ${interval} 数据新鲜度失败:`, error);
      return {
        interval,
        isStale: true,
        ageHours: 999,
        count: 0,
        issue: 'CHECK_ERROR',
        message: `检查失败: ${error.message}`
      };
    }
  }

  /**
   * 获取数据新鲜度报告
   */
  async getFreshnessReport() {
    try {
      const results = await this.checkAllSymbolsFreshness();
      
      if (!results) {
        return null;
      }

      // 按严重程度分类
      const criticalSymbols = results.details.filter(d => 
        d.freshness4h?.isStale && d.freshness4h?.ageHours > 24
      );
      
      const warningSymbols = results.details.filter(d => 
        d.hasStaleData && !criticalSymbols.includes(d)
      );

      const report = {
        summary: {
          total: results.total,
          fresh: results.fresh,
          stale: results.stale,
          errors: results.errors,
          freshnessRate: ((results.fresh / results.total) * 100).toFixed(2)
        },
        critical: {
          count: criticalSymbols.length,
          symbols: criticalSymbols.map(d => ({
            symbol: d.symbol,
            ageHours: d.freshness4h?.ageHours,
            recommendations: d.recommendations
          }))
        },
        warnings: {
          count: warningSymbols.length,
          symbols: warningSymbols.map(d => ({
            symbol: d.symbol,
            issues: this.getIssueSummary(d),
            recommendations: d.recommendations
          }))
        },
        recommendations: this.generateRecommendations(results)
      };

      return report;

    } catch (error) {
      console.error('生成数据新鲜度报告失败:', error);
      return null;
    }
  }

  /**
   * 获取问题摘要
   */
  getIssueSummary(detail) {
    const issues = [];
    
    if (detail.freshness4h?.isStale) {
      issues.push(`4H数据过期${detail.freshness4h.ageHours.toFixed(1)}小时`);
    }
    if (detail.freshness1h?.isStale) {
      issues.push(`1H数据过期${detail.freshness1h.ageHours.toFixed(1)}小时`);
    }
    if (detail.freshness15m?.isStale) {
      issues.push(`15m数据过期${detail.freshness15m.ageHours.toFixed(1)}小时`);
    }
    
    return issues;
  }

  /**
   * 生成修复建议
   */
  generateRecommendations(results) {
    const recommendations = [];

    if (results.stale > results.total * 0.5) {
      recommendations.push('超过50%的交易对数据过期，建议立即运行批量数据更新');
    }

    if (results.stale > 0) {
      recommendations.push('建议启动自动数据更新服务');
    }

    if (results.errors > 0) {
      recommendations.push('存在数据检查错误，建议检查数据库连接和数据完整性');
    }

    if (results.fresh === results.total) {
      recommendations.push('所有数据都保持新鲜，系统运行正常');
    }

    return recommendations;
  }

  /**
   * 设置告警
   */
  setAlert(symbol, interval, message) {
    const key = `${symbol}_${interval}`;
    this.alerts.set(key, {
      symbol,
      interval,
      message,
      timestamp: Date.now()
    });
  }

  /**
   * 清除告警
   */
  clearAlert(symbol, interval) {
    const key = `${symbol}_${interval}`;
    this.alerts.delete(key);
  }

  /**
   * 获取所有告警
   */
  getAlerts() {
    return Array.from(this.alerts.values());
  }

  /**
   * 检查并更新告警状态
   */
  async updateAlerts() {
    try {
      const results = await this.checkAllSymbolsFreshness();
      
      if (!results) return;

      // 清除所有现有告警
      this.alerts.clear();

      // 检查每个交易对并设置告警
      for (const detail of results.details) {
        if (detail.hasStaleData) {
          if (detail.freshness4h?.isStale) {
            this.setAlert(detail.symbol, '4h', detail.freshness4h.message);
          }
          if (detail.freshness1h?.isStale) {
            this.setAlert(detail.symbol, '1h', detail.freshness1h.message);
          }
          if (detail.freshness15m?.isStale) {
            this.setAlert(detail.symbol, '15m', detail.freshness15m.message);
          }
        }
      }

      console.log(`📢 更新告警状态: ${this.alerts.size} 个活跃告警`);

    } catch (error) {
      console.error('更新告警状态失败:', error);
    }
  }
}

module.exports = DataFreshnessMonitor;
