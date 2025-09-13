const DatabaseManager = require('../database/DatabaseManager');

/**
 * 增强的数据质量监控系统
 * 检测MA数据过时、数据时效性等问题
 */
class EnhancedDataQualityMonitor {
  constructor(database = null) {
    this.database = database;
    this.lastCheckTime = new Map(); // 记录上次检查时间
    this.checkInterval = 5 * 60 * 1000; // 5分钟检查一次
    this.dataFreshnessThreshold = 4 * 60 * 60 * 1000; // 4小时数据新鲜度阈值
  }

  /**
   * 检查K线数据时效性
   */
  async checkKlineDataFreshness(symbol, interval = '4h') {
    try {
      if (!this.database) return null;

      const sql = `
        SELECT open_time, close_time, close_price 
        FROM kline_data 
        WHERE symbol = ? AND interval = ? 
        ORDER BY open_time DESC 
        LIMIT 1
      `;

      const result = await this.database.runQuery(sql, [symbol, interval]);

      if (!result || result.length === 0) {
        return {
          isFresh: false,
          issue: 'NO_DATA',
          message: `${symbol} ${interval} 无K线数据`,
          lastUpdateTime: null,
          ageHours: null
        };
      }

      const latestKline = result[0];
      const lastUpdateTime = latestKline.close_time;
      const ageHours = (Date.now() - lastUpdateTime) / (1000 * 60 * 60);

      // 检查数据是否过时
      if (ageHours > 24) { // 超过24小时
        return {
          isFresh: false,
          issue: 'DATA_STALE',
          message: `${symbol} ${interval} 数据过时 ${ageHours.toFixed(1)}小时`,
          lastUpdateTime,
          ageHours
        };
      } else if (ageHours > 8) { // 超过8小时
        return {
          isFresh: false,
          issue: 'DATA_AGING',
          message: `${symbol} ${interval} 数据老化 ${ageHours.toFixed(1)}小时`,
          lastUpdateTime,
          ageHours
        };
      }

      return {
        isFresh: true,
        issue: null,
        message: `${symbol} ${interval} 数据新鲜`,
        lastUpdateTime,
        ageHours
      };

    } catch (error) {
      console.error(`检查K线数据时效性失败 [${symbol}]:`, error);
      return {
        isFresh: false,
        issue: 'CHECK_ERROR',
        message: `检查失败: ${error.message}`,
        lastUpdateTime: null,
        ageHours: null
      };
    }
  }

  /**
   * 检查MA计算结果的合理性
   */
  async checkMAValidity(symbol, ma20, ma50, ma200, currentPrice) {
    const issues = [];

    // 检查MA值是否为正数
    if (ma20 <= 0) issues.push('MA20 <= 0');
    if (ma50 <= 0) issues.push('MA50 <= 0');
    if (ma200 <= 0) issues.push('MA200 <= 0');

    // 检查MA值是否在合理范围内
    if (ma20 > currentPrice * 2) issues.push('MA20过高');
    if (ma20 < currentPrice / 2) issues.push('MA20过低');

    // 检查MA排列的合理性
    const maSpread = Math.abs(ma20 - ma50) / Math.min(ma20, ma50);
    if (maSpread > 1.5) { // MA差异超过150%
      issues.push(`MA差异过大: ${(maSpread * 100).toFixed(1)}%`);
    }

    // 检查MA与当前价格的差异
    const priceMA20Diff = Math.abs(currentPrice - ma20) / ma20;
    if (priceMA20Diff > 0.3) { // 价格与MA20差异超过30%
      issues.push(`价格与MA20差异过大: ${(priceMA20Diff * 100).toFixed(1)}%`);
    }

    return {
      isValid: issues.length === 0,
      issues,
      maSpread: maSpread,
      priceMA20Diff: priceMA20Diff
    };
  }

  /**
   * 检查趋势判断的合理性
   */
  checkTrendValidity(trendResult) {
    const issues = [];

    // 检查趋势判断逻辑一致性
    if (trendResult.trend4h === '多头趋势') {
      if (trendResult.bullScore < 2) {
        issues.push('多头趋势但多头得分不足');
      }
      if (trendResult.score < 4) {
        issues.push('多头趋势但总得分不足');
      }
    } else if (trendResult.trend4h === '空头趋势') {
      if (trendResult.bearScore < 2) {
        issues.push('空头趋势但空头得分不足');
      }
      if (trendResult.score < 4) {
        issues.push('空头趋势但总得分不足');
      }
    }

    // 检查市场类型一致性
    if (trendResult.trend4h !== '震荡市' && trendResult.marketType !== '趋势市') {
      issues.push('趋势判断与市场类型不一致');
    }
    if (trendResult.trend4h === '震荡市' && trendResult.marketType !== '震荡市') {
      issues.push('震荡判断与市场类型不一致');
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * 记录数据质量问题
   */
  async recordDataQualityIssue(symbol, issueType, message, details = null) {
    if (!this.database) return;

    try {
      const sql = `
        INSERT INTO data_quality_issues (symbol, issue_type, severity, message, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      await this.database.runQuery(sql, [
        symbol,
        issueType,
        'WARNING',
        message,
        details ? JSON.stringify(details) : null,
        Date.now()
      ]);

      console.log(`⚠️ 数据质量问题记录 [${symbol}]: ${message}`);
    } catch (error) {
      console.error('记录数据质量问题失败:', error);
    }
  }

  /**
   * 综合数据质量检查
   */
  async performComprehensiveCheck(symbol) {
    const checkKey = `${symbol}_${Date.now()}`;
    const lastCheck = this.lastCheckTime.get(symbol) || 0;

    // 避免频繁检查
    if (Date.now() - lastCheck < this.checkInterval) {
      return null;
    }

    this.lastCheckTime.set(symbol, Date.now());

    console.log(`🔍 执行综合数据质量检查 [${symbol}]...`);

    const results = {
      symbol,
      timestamp: Date.now(),
      klineFreshness: {},
      maValidity: {},
      trendValidity: {},
      overallStatus: 'HEALTHY'
    };

    try {
      // 1. 检查K线数据时效性
      results.klineFreshness['4h'] = await this.checkKlineDataFreshness(symbol, '4h');
      results.klineFreshness['1h'] = await this.checkKlineDataFreshness(symbol, '1h');
      results.klineFreshness['15m'] = await this.checkKlineDataFreshness(symbol, '15m');

      // 2. 检查是否有数据质量问题
      const staleData = Object.values(results.klineFreshness).filter(r => !r.isFresh);
      if (staleData.length > 0) {
        results.overallStatus = 'WARNING';

        for (const stale of staleData) {
          await this.recordDataQualityIssue(
            symbol,
            stale.issue,
            stale.message,
            {
              interval: stale.message.split(' ')[1],
              ageHours: stale.ageHours,
              lastUpdateTime: stale.lastUpdateTime
            }
          );
        }
      }

      // 3. 记录检查结果
      console.log(`📊 数据质量检查完成 [${symbol}]: ${results.overallStatus}`);
      if (staleData.length > 0) {
        console.log(`⚠️ 发现 ${staleData.length} 个数据时效性问题`);
      }

      return results;

    } catch (error) {
      console.error(`综合数据质量检查失败 [${symbol}]:`, error);
      return {
        symbol,
        timestamp: Date.now(),
        overallStatus: 'ERROR',
        error: error.message
      };
    }
  }

  /**
   * 检查MA计算结果的数据质量
   */
  async checkMACalculationQuality(symbol, ma20, ma50, ma200, currentPrice) {
    const maCheck = await this.checkMAValidity(symbol, ma20, ma50, ma200, currentPrice);

    if (!maCheck.isValid) {
      await this.recordDataQualityIssue(
        symbol,
        'MA_CALCULATION_INVALID',
        `MA计算结果异常: ${maCheck.issues.join(', ')}`,
        {
          ma20,
          ma50,
          ma200,
          currentPrice,
          issues: maCheck.issues,
          maSpread: maCheck.maSpread,
          priceMA20Diff: maCheck.priceMA20Diff
        }
      );
    }

    return maCheck;
  }

  /**
   * 检查趋势判断结果的数据质量
   */
  async checkTrendCalculationQuality(symbol, trendResult) {
    const trendCheck = this.checkTrendValidity(trendResult);

    if (!trendCheck.isValid) {
      await this.recordDataQualityIssue(
        symbol,
        'TREND_CALCULATION_INVALID',
        `趋势判断结果异常: ${trendCheck.issues.join(', ')}`,
        {
          trend4h: trendResult.trend4h,
          marketType: trendResult.marketType,
          bullScore: trendResult.bullScore,
          bearScore: trendResult.bearScore,
          score: trendResult.score,
          issues: trendCheck.issues
        }
      );
    }

    return trendCheck;
  }

  /**
   * 获取数据质量报告
   */
  async getDataQualityReport(symbol = null) {
    try {
      let sql = `
        SELECT symbol, issue_type, message, created_at, details
        FROM data_quality_issues
        WHERE created_at > datetime('now', '-24 hours')
      `;

      const params = [];
      if (symbol) {
        sql += ' AND symbol = ?';
        params.push(symbol);
      }

      sql += ' ORDER BY created_at DESC LIMIT 100';

      const issues = await this.database.runQuery(sql, params);

      // 按问题类型分组
      const groupedIssues = {};
      issues.forEach(issue => {
        if (!groupedIssues[issue.issue_type]) {
          groupedIssues[issue.issue_type] = [];
        }
        groupedIssues[issue.issue_type].push(issue);
      });

      return {
        totalIssues: issues.length,
        groupedIssues,
        timeRange: '24小时',
        symbol: symbol || '所有交易对'
      };

    } catch (error) {
      console.error('获取数据质量报告失败:', error);
      return null;
    }
  }
}

module.exports = EnhancedDataQualityMonitor;
