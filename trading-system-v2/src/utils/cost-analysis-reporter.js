/**
 * 成本分析报告生成器
 * 生成详细的成本分析报告
 */

const logger = require('./logger');

class CostAnalysisReporter {
  constructor() {
    this.reportTemplates = {
      summary: this.generateSummaryReport,
      detailed: this.generateDetailedReport,
      comparison: this.generateComparisonReport
    };
  }

  /**
   * 生成成本分析报告
   * @param {Object} costAnalysis - 成本分析数据
   * @param {Array} trades - 交易记录
   * @param {string} format - 报告格式 ('summary', 'detailed', 'comparison')
   * @returns {Object} 格式化的报告
   */
  generateReport(costAnalysis, trades = [], format = 'summary') {
    try {
      const template = this.reportTemplates[format];
      if (!template) {
        throw new Error(`不支持的报告格式: ${format}`);
      }

      return template.call(this, costAnalysis, trades);

    } catch (error) {
      logger.error('[成本分析报告] 生成报告失败', error);
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 生成摘要报告
   * @param {Object} costAnalysis - 成本分析数据
   * @param {Array} trades - 交易记录
   * @returns {Object} 摘要报告
   */
  generateSummaryReport(costAnalysis, trades) {
    const { totalRawPnL, totalNetPnL, totalCosts, costBreakdown, costImpact } = costAnalysis;

    return {
      reportType: 'summary',
      timestamp: new Date().toISOString(),
      overview: {
        totalRawPnL: totalRawPnL,
        totalNetPnL: totalNetPnL,
        totalCosts: totalCosts,
        costImpact: `${costImpact}%`,
        netProfitLoss: totalNetPnL - totalCosts
      },
      costBreakdown: {
        feeCost: {
          amount: costBreakdown.totalFeeCost,
          percentage: ((costBreakdown.totalFeeCost / totalCosts) * 100).toFixed(2) + '%'
        },
        fundingCost: {
          amount: costBreakdown.totalFundingCost,
          percentage: ((costBreakdown.totalFundingCost / totalCosts) * 100).toFixed(2) + '%'
        },
        interestCost: {
          amount: costBreakdown.totalInterestCost,
          percentage: ((costBreakdown.totalInterestCost / totalCosts) * 100).toFixed(2) + '%'
        }
      },
      summary: this.generateSummaryText(costAnalysis)
    };
  }

  /**
   * 生成详细报告
   * @param {Object} costAnalysis - 成本分析数据
   * @param {Array} trades - 交易记录
   * @returns {Object} 详细报告
   */
  generateDetailedReport(costAnalysis, trades) {
    const summaryReport = this.generateSummaryReport(costAnalysis, trades);

    // 添加详细分析
    const detailedAnalysis = {
      ...summaryReport,
      reportType: 'detailed',
      tradeAnalysis: this.analyzeTradesByCost(trades),
      costTrends: this.analyzeCostTrends(trades),
      recommendations: this.generateRecommendations(costAnalysis, trades)
    };

    return detailedAnalysis;
  }

  /**
   * 生成对比报告
   * @param {Object} costAnalysis - 成本分析数据
   * @param {Array} trades - 交易记录
   * @returns {Object} 对比报告
   */
  generateComparisonReport(costAnalysis, trades) {
    const detailedReport = this.generateDetailedReport(costAnalysis, trades);

    return {
      ...detailedReport,
      reportType: 'comparison',
      benchmarks: this.generateBenchmarks(costAnalysis),
      optimization: this.generateOptimizationSuggestions(costAnalysis, trades)
    };
  }

  /**
   * 生成摘要文本
   * @param {Object} costAnalysis - 成本分析数据
   * @returns {string} 摘要文本
   */
  generateSummaryText(costAnalysis) {
    const { totalRawPnL, totalNetPnL, totalCosts, costImpact } = costAnalysis;

    let summary = `成本分析摘要：\n`;
    summary += `原始盈亏: ${totalRawPnL.toFixed(4)} USDT\n`;
    summary += `净盈亏: ${totalNetPnL.toFixed(4)} USDT\n`;
    summary += `总成本: ${totalCosts.toFixed(4)} USDT\n`;
    summary += `成本影响: ${costImpact}%\n`;

    if (costImpact > 20) {
      summary += `⚠️ 成本影响较高，建议优化交易频率或持仓时长`;
    } else if (costImpact > 10) {
      summary += `⚠️ 成本影响中等，可考虑优化交易策略`;
    } else {
      summary += `✅ 成本控制良好`;
    }

    return summary;
  }

  /**
   * 按成本分析交易
   * @param {Array} trades - 交易记录
   * @returns {Object} 交易分析
   */
  analyzeTradesByCost(trades) {
    if (trades.length === 0) {
      return { message: '无交易数据' };
    }

    const highCostTrades = trades.filter(t => t.totalCost > 0.1);
    const lowCostTrades = trades.filter(t => t.totalCost <= 0.05);

    const avgCostPerTrade = trades.reduce((sum, t) => sum + (t.totalCost || 0), 0) / trades.length;
    const maxCostTrade = trades.reduce((max, t) => (t.totalCost || 0) > (max.totalCost || 0) ? t : max, trades[0]);

    return {
      totalTrades: trades.length,
      highCostTrades: highCostTrades.length,
      lowCostTrades: lowCostTrades.length,
      avgCostPerTrade: parseFloat(avgCostPerTrade.toFixed(4)),
      maxCostTrade: {
        symbol: maxCostTrade.symbol,
        cost: maxCostTrade.totalCost,
        holdHours: maxCostTrade.holdHours
      },
      costDistribution: this.calculateCostDistribution(trades)
    };
  }

  /**
   * 分析成本趋势
   * @param {Array} trades - 交易记录
   * @returns {Object} 成本趋势
   */
  analyzeCostTrends(trades) {
    if (trades.length < 5) {
      return { message: '交易数据不足，无法分析趋势' };
    }

    // 按时间排序
    const sortedTrades = trades.sort((a, b) => new Date(a.exitTime) - new Date(b.exitTime));

    // 计算移动平均成本
    const windowSize = Math.min(10, Math.floor(trades.length / 3));
    const movingAverages = [];

    for (let i = windowSize - 1; i < sortedTrades.length; i++) {
      const window = sortedTrades.slice(i - windowSize + 1, i + 1);
      const avgCost = window.reduce((sum, t) => sum + (t.totalCost || 0), 0) / window.length;
      movingAverages.push({
        period: i + 1,
        avgCost: parseFloat(avgCost.toFixed(4)),
        trades: window.length
      });
    }

    return {
      movingAverages,
      trend: this.calculateTrend(movingAverages.map(ma => ma.avgCost)),
      windowSize
    };
  }

  /**
   * 生成建议
   * @param {Object} costAnalysis - 成本分析数据
   * @param {Array} trades - 交易记录
   * @returns {Array} 建议列表
   */
  generateRecommendations(costAnalysis, trades) {
    const recommendations = [];
    const { costImpact, costBreakdown } = costAnalysis;

    // 成本影响建议
    if (costImpact > 20) {
      recommendations.push({
        type: 'high_cost_impact',
        priority: 'high',
        title: '成本影响过高',
        description: '总成本占原始盈亏的20%以上，建议减少交易频率或优化持仓时长',
        action: '考虑提高入场门槛，减少频繁交易'
      });
    }

    // 资金费率建议
    const fundingRatio = costBreakdown.totalFundingCost / costAnalysis.totalCosts;
    if (fundingRatio > 0.5) {
      recommendations.push({
        type: 'high_funding_cost',
        priority: 'medium',
        title: '资金费率成本较高',
        description: '资金费率成本占总成本的50%以上',
        action: '考虑在资金费率较低时开仓，或缩短持仓时间'
      });
    }

    // 手续费建议
    const feeRatio = costBreakdown.totalFeeCost / costAnalysis.totalCosts;
    if (feeRatio > 0.6) {
      recommendations.push({
        type: 'high_fee_cost',
        priority: 'medium',
        title: '手续费成本较高',
        description: '手续费成本占总成本的60%以上',
        action: '考虑提高单笔交易金额，降低手续费占比'
      });
    }

    // 持仓时长建议
    const avgHoldHours = trades.reduce((sum, t) => sum + (t.holdHours || 0), 0) / trades.length;
    if (avgHoldHours > 48) {
      recommendations.push({
        type: 'long_hold_time',
        priority: 'low',
        title: '持仓时间较长',
        description: `平均持仓时间${avgHoldHours.toFixed(1)}小时`,
        action: '考虑优化止盈止损策略，减少持仓时间'
      });
    }

    return recommendations;
  }

  /**
   * 生成基准对比
   * @param {Object} costAnalysis - 成本分析数据
   * @returns {Object} 基准对比
   */
  generateBenchmarks(costAnalysis) {
    const industryBenchmarks = {
      feeCostPercent: 0.08, // 0.08%
      fundingCostPercent: 0.05, // 0.05%
      interestCostPercent: 0.02, // 0.02%
      totalCostPercent: 0.15 // 0.15%
    };

    const currentMetrics = costAnalysis.costPercentages;

    return {
      industryBenchmarks,
      currentMetrics,
      comparison: {
        feeCost: this.compareMetric(currentMetrics.feeCostPercent, industryBenchmarks.feeCostPercent),
        fundingCost: this.compareMetric(currentMetrics.fundingCostPercent, industryBenchmarks.fundingCostPercent),
        interestCost: this.compareMetric(currentMetrics.interestCostPercent, industryBenchmarks.interestCostPercent),
        totalCost: this.compareMetric(
          currentMetrics.feeCostPercent + currentMetrics.fundingCostPercent + currentMetrics.interestCostPercent,
          industryBenchmarks.totalCostPercent
        )
      }
    };
  }

  /**
   * 生成优化建议
   * @param {Object} costAnalysis - 成本分析数据
   * @param {Array} trades - 交易记录
   * @returns {Array} 优化建议
   */
  generateOptimizationSuggestions(costAnalysis, trades) {
    const suggestions = [];

    // 基于成本占比的优化建议
    const { costBreakdown, totalCosts } = costAnalysis;

    if (costBreakdown.totalFundingCost / totalCosts > 0.4) {
      suggestions.push({
        category: 'funding_cost',
        suggestion: '优化资金费率成本',
        details: [
          '选择资金费率较低的时段开仓',
          '避免在资金费率结算前1小时内开仓',
          '考虑使用现货交易替代合约交易'
        ],
        expectedImpact: '可降低20-40%的资金费率成本'
      });
    }

    if (costBreakdown.totalFeeCost / totalCosts > 0.5) {
      suggestions.push({
        category: 'fee_cost',
        suggestion: '优化手续费成本',
        details: [
          '提高单笔交易金额，降低手续费占比',
          '使用Maker订单获得手续费折扣',
          '考虑使用VIP等级降低手续费率'
        ],
        expectedImpact: '可降低10-30%的手续费成本'
      });
    }

    return suggestions;
  }

  /**
   * 计算成本分布
   * @param {Array} trades - 交易记录
   * @returns {Object} 成本分布
   */
  calculateCostDistribution(trades) {
    const ranges = [
      { min: 0, max: 0.01, label: '0-0.01 USDT' },
      { min: 0.01, max: 0.05, label: '0.01-0.05 USDT' },
      { min: 0.05, max: 0.1, label: '0.05-0.1 USDT' },
      { min: 0.1, max: 0.5, label: '0.1-0.5 USDT' },
      { min: 0.5, max: Infinity, label: '>0.5 USDT' }
    ];

    const distribution = ranges.map(range => ({
      range: range.label,
      count: trades.filter(t => {
        const cost = t.totalCost || 0;
        return cost >= range.min && cost < range.max;
      }).length
    }));

    return distribution;
  }

  /**
   * 计算趋势
   * @param {Array} values - 数值数组
   * @returns {string} 趋势描述
   */
  calculateTrend(values) {
    if (values.length < 2) return 'insufficient_data';

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;

    const change = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (change > 5) return 'increasing';
    if (change < -5) return 'decreasing';
    return 'stable';
  }

  /**
   * 比较指标
   * @param {number} current - 当前值
   * @param {number} benchmark - 基准值
   * @returns {Object} 比较结果
   */
  compareMetric(current, benchmark) {
    const ratio = current / benchmark;
    let status = 'good';

    if (ratio > 1.5) status = 'poor';
    else if (ratio > 1.2) status = 'fair';

    return {
      current: parseFloat(current.toFixed(4)),
      benchmark: parseFloat(benchmark.toFixed(4)),
      ratio: parseFloat(ratio.toFixed(2)),
      status
    };
  }
}

module.exports = CostAnalysisReporter;
