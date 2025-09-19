// V3TrendFilter.js - V3策略4H趋势过滤器
// 严格按照strategy-v3.md文档实现10分打分机制

const BinanceAPI = require('../../api/BinanceAPI');
const TechnicalIndicators = require('../../utils/TechnicalIndicators');

/**
 * V3策略4H趋势过滤器
 * 
 * 按照strategy-v3.md文档实现10分打分机制:
 * 1. 趋势方向 (3分) - 每个方向至少需要2分
 *    - 收盘价 vs MA20 (1分)
 *    - MA20 vs MA50 (1分)  
 *    - MA50 vs MA200 (1分)
 * 2. 趋势稳定性 (1分) - 连续≥2根4H K线满足趋势方向
 * 3. 趋势强度 (1分) - ADX(14) > 20 且 DI方向正确
 * 4. 布林带扩张 (1分) - 后5根BBW均值 > 前5根均值 × 1.05
 * 5. 动量确认 (1分) - 收盘价离MA20距离 ≥ 0.5%
 * 
 * 最终判断: ≥4分保留趋势，<4分震荡市
 */
class V3TrendFilter {
  constructor(database, cacheManager) {
    this.database = database;
    this.cacheManager = cacheManager;
    
    // 配置参数 (按strategy-v3.md文档)
    this.config = {
      // 趋势方向配置
      minDirectionScore: 2,           // 每个方向至少2分
      
      // 趋势稳定性配置
      stabilityMinCandles: 2,         // 连续≥2根K线
      
      // 趋势强度配置
      adxThreshold: 20,               // ADX > 20
      
      // 布林带扩张配置
      bbwLookback: 10,                // 回看10根K线
      bbwPeriod: 20,                  // 布林带周期
      bbwStdDev: 2,                   // 标准差倍数
      bbwExpansionRatio: 1.05,        // 扩张比例
      
      // 动量确认配置
      momentumThreshold: 0.005,       // 0.5%距离阈值
      
      // 总分阈值
      totalScoreThreshold: 4,         // ≥4分保留趋势
      
      // 数据要求
      minKlineCount: 250,             // 最少K线数量
      recommendedKlineCount: 300      // 推荐K线数量
    };
  }

  /**
   * 4H趋势过滤分析 - 严格按照strategy-v3.md文档10分打分机制
   * @param {string} symbol - 交易对
   * @returns {Object} 4H趋势过滤结果
   */
  async analyze4HTrend(symbol) {
    try {
      console.log(`📈 开始4H趋势过滤 [${symbol}]`);

      // 获取4H K线数据
      const klines4h = await BinanceAPI.getKlines(symbol, '4h', this.config.recommendedKlineCount);
      
      if (!klines4h || klines4h.length < this.config.minKlineCount) {
        throw new Error(`4H K线数据不足: ${klines4h?.length || 0} < ${this.config.minKlineCount}`);
      }

      const candles = klines4h.map(k => ({
        timestamp: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));

      // 计算技术指标
      const technicalData = await this.calculateTechnicalIndicators(candles);

      // 执行10分打分机制
      const scoringResult = this.execute10PointScoring(candles, technicalData);

      // 最终趋势判断
      const finalResult = this.makeFinalTrendDecision(scoringResult);

      // 存储4H趋势分析结果
      await this.storeTrendFilterResult(symbol, finalResult);

      console.log(`📊 4H趋势过滤完成 [${symbol}]: ${finalResult.trend4h} (${finalResult.totalScore}/10分)`);

      return finalResult;

    } catch (error) {
      console.error(`4H趋势过滤失败 [${symbol}]:`, error);
      throw error;
    }
  }

  /**
   * 计算技术指标
   */
  async calculateTechnicalIndicators(candles) {
    try {
      const closes = candles.map(c => c.close);
      const highs = candles.map(c => c.high);
      const lows = candles.map(c => c.low);

      // 计算移动平均线
      const ma20 = TechnicalIndicators.calculateSMA(closes, 20);
      const ma50 = TechnicalIndicators.calculateSMA(closes, 50);
      const ma200 = TechnicalIndicators.calculateSMA(closes, 200);

      // 计算ADX和DI
      const adxResult = TechnicalIndicators.calculateADX(highs, lows, closes, 14);

      // 计算布林带和带宽
      const bollinger = TechnicalIndicators.calculateBollingerBands(closes, this.config.bbwPeriod, this.config.bbwStdDev);
      const bbw = bollinger.map(bb => bb.bandwidth);

      return {
        ma20,
        ma50,
        ma200,
        adx: adxResult.ADX,
        diPlus: adxResult.DIplus,
        diMinus: adxResult.DIminus,
        bollinger,
        bbw,
        closes,
        highs,
        lows,
        currentPrice: closes[closes.length - 1],
        currentMA20: ma20[ma20.length - 1],
        currentMA50: ma50[ma50.length - 1],
        currentMA200: ma200[ma200.length - 1],
        currentADX: adxResult.ADX[adxResult.ADX.length - 1],
        currentDIPlus: adxResult.DIplus[adxResult.DIplus.length - 1],
        currentDIMinus: adxResult.DIminus[adxResult.DIminus.length - 1]
      };

    } catch (error) {
      console.error('技术指标计算失败:', error);
      throw error;
    }
  }

  /**
   * 执行10分打分机制 - 严格按照strategy-v3.md文档
   */
  execute10PointScoring(candles, tech) {
    const scoring = {
      totalScore: 0,
      factorScores: {},
      factorDetails: {},
      direction: null
    };

    // 1. 趋势方向得分 (3分) - 按strategy-v3.md文档
    const directionScoring = this.scoreTrendDirection(tech);
    scoring.factorScores.direction = directionScoring.score;
    scoring.factorDetails.direction = directionScoring;
    scoring.direction = directionScoring.direction;

    // 检查方向得分是否至少2分
    if (directionScoring.score < this.config.minDirectionScore) {
      console.log(`❌ 趋势方向得分不足: ${directionScoring.score} < ${this.config.minDirectionScore}`);
      scoring.totalScore = directionScoring.score;
      scoring.reason = '趋势方向不明确';
      return scoring;
    }

    scoring.totalScore += directionScoring.score;

    // 2. 趋势稳定性得分 (1分) - 按strategy-v3.md文档
    const stabilityScoring = this.scoreTrendStability(candles, scoring.direction);
    scoring.factorScores.stability = stabilityScoring.score;
    scoring.factorDetails.stability = stabilityScoring;
    scoring.totalScore += stabilityScoring.score;

    // 3. 趋势强度得分 (1分) - 按strategy-v3.md文档
    const strengthScoring = this.scoreTrendStrength(tech, scoring.direction);
    scoring.factorScores.strength = strengthScoring.score;
    scoring.factorDetails.strength = strengthScoring;
    scoring.totalScore += strengthScoring.score;

    // 4. 布林带扩张得分 (1分) - 按strategy-v3.md文档
    const expansionScoring = this.scoreBBExpansion(tech.bbw);
    scoring.factorScores.expansion = expansionScoring.score;
    scoring.factorDetails.expansion = expansionScoring;
    scoring.totalScore += expansionScoring.score;

    // 5. 动量确认得分 (1分) - 按strategy-v3.md文档
    const momentumScoring = this.scoreMomentum(tech);
    scoring.factorScores.momentum = momentumScoring.score;
    scoring.factorDetails.momentum = momentumScoring;
    scoring.totalScore += momentumScoring.score;

    return scoring;
  }

  /**
   * 趋势方向得分 - 按strategy-v3.md文档实现
   */
  scoreTrendDirection(tech) {
    let bullScore = 0;
    let bearScore = 0;
    const details = {};

    // 多头方向得分
    if (tech.currentPrice > tech.currentMA20) {
      bullScore++;
      details.closeVsMA20 = { bull: true, bear: false };
    } else {
      bearScore++;
      details.closeVsMA20 = { bull: false, bear: true };
    }

    if (tech.currentMA20 > tech.currentMA50) {
      bullScore++;
      details.ma20VsMA50 = { bull: true, bear: false };
    } else {
      bearScore++;
      details.ma20VsMA50 = { bull: false, bear: true };
    }

    if (tech.currentMA50 > tech.currentMA200) {
      bullScore++;
      details.ma50VsMA200 = { bull: true, bear: false };
    } else {
      bearScore++;
      details.ma50VsMA200 = { bull: false, bear: true };
    }

    // 确定主导方向
    let direction = null;
    let score = 0;

    if (bullScore >= this.config.minDirectionScore) {
      direction = 'BULL';
      score = bullScore;
    } else if (bearScore >= this.config.minDirectionScore) {
      direction = 'BEAR';
      score = bearScore;
    }

    return {
      score,
      direction,
      bullScore,
      bearScore,
      details,
      description: direction ? 
        `${direction === 'BULL' ? '多头' : '空头'}方向确认 (${score}/3分)` :
        `方向不明确 (多头${bullScore}, 空头${bearScore})`
    };
  }

  /**
   * 趋势稳定性得分 - 按strategy-v3.md文档实现
   */
  scoreTrendStability(candles, direction) {
    if (!direction) {
      return { score: 0, reason: '无明确方向' };
    }

    // 检查最近2根4H K线是否都满足趋势方向
    const recentCandles = candles.slice(-this.config.stabilityMinCandles);
    
    if (recentCandles.length < this.config.stabilityMinCandles) {
      return { score: 0, reason: '数据不足' };
    }

    let consecutiveCount = 0;
    
    for (const candle of recentCandles) {
      let satisfiesTrend = false;
      
      if (direction === 'BULL') {
        // 多头: 检查收盘价是否持续在上升通道
        satisfiesTrend = candle.close > candle.open; // 简化检查: 阳线
      } else if (direction === 'BEAR') {
        // 空头: 检查收盘价是否持续在下降通道
        satisfiesTrend = candle.close < candle.open; // 简化检查: 阴线
      }
      
      if (satisfiesTrend) {
        consecutiveCount++;
      }
    }

    const score = consecutiveCount >= this.config.stabilityMinCandles ? 1 : 0;

    return {
      score,
      consecutiveCount,
      required: this.config.stabilityMinCandles,
      recentCandles: recentCandles.length,
      description: score > 0 ? 
        `趋势稳定性确认 (连续${consecutiveCount}根)` :
        `趋势稳定性不足 (连续${consecutiveCount}根 < ${this.config.stabilityMinCandles}根)`
    };
  }

  /**
   * 趋势强度得分 - 按strategy-v3.md文档实现
   */
  scoreTrendStrength(tech, direction) {
    if (!direction) {
      return { score: 0, reason: '无明确方向' };
    }

    // 检查ADX > 20
    const adxValid = tech.currentADX > this.config.adxThreshold;
    
    if (!adxValid) {
      return {
        score: 0,
        adx: tech.currentADX,
        threshold: this.config.adxThreshold,
        diPlus: tech.currentDIPlus,
        diMinus: tech.currentDIMinus,
        description: `ADX不足: ${tech.currentADX.toFixed(2)} ≤ ${this.config.adxThreshold}`
      };
    }

    // 检查DI方向是否正确
    let diDirectionCorrect = false;
    
    if (direction === 'BULL') {
      diDirectionCorrect = tech.currentDIPlus > tech.currentDIMinus;
    } else if (direction === 'BEAR') {
      diDirectionCorrect = tech.currentDIMinus > tech.currentDIPlus;
    }

    const score = adxValid && diDirectionCorrect ? 1 : 0;

    return {
      score,
      adx: tech.currentADX,
      threshold: this.config.adxThreshold,
      diPlus: tech.currentDIPlus,
      diMinus: tech.currentDIMinus,
      diDirectionCorrect,
      description: score > 0 ?
        `趋势强度确认 (ADX=${tech.currentADX.toFixed(2)}, DI方向正确)` :
        `趋势强度不足 (ADX=${tech.currentADX.toFixed(2)}, DI方向=${diDirectionCorrect ? '正确' : '错误'})`
    };
  }

  /**
   * 布林带扩张得分 - 按strategy-v3.md文档实现
   */
  scoreBBExpansion(bbw) {
    if (bbw.length < this.config.bbwLookback) {
      return { score: 0, reason: 'BBW数据不足' };
    }

    // 取最近10根K线的BBW
    const recentBBW = bbw.slice(-this.config.bbwLookback);
    
    // 计算前5根和后5根的均值
    const firstHalf = recentBBW.slice(0, 5);
    const secondHalf = recentBBW.slice(5);
    
    const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    // 按strategy-v3.md文档: 后5根BBW均值 > 前5根均值 × 1.05
    const expanding = secondHalfAvg > firstHalfAvg * this.config.bbwExpansionRatio;
    const expansionRatio = secondHalfAvg / firstHalfAvg;

    const score = expanding ? 1 : 0;

    return {
      score,
      expanding,
      firstHalfAvg,
      secondHalfAvg,
      expansionRatio,
      threshold: this.config.bbwExpansionRatio,
      currentBBW: bbw[bbw.length - 1],
      description: score > 0 ?
        `布林带扩张确认 (${expansionRatio.toFixed(3)} > ${this.config.bbwExpansionRatio})` :
        `布林带未扩张 (${expansionRatio.toFixed(3)} ≤ ${this.config.bbwExpansionRatio})`
    };
  }

  /**
   * 动量确认得分 - 按strategy-v3.md文档实现
   */
  scoreMomentum(tech) {
    // 计算收盘价离MA20的距离百分比
    const priceMA20Distance = Math.abs(tech.currentPrice - tech.currentMA20);
    const priceMA20DistancePct = (priceMA20Distance / tech.currentMA20) * 100;

    // 按strategy-v3.md文档: 距离 ≥ 0.5%
    const momentumSufficient = priceMA20DistancePct >= (this.config.momentumThreshold * 100);
    const score = momentumSufficient ? 1 : 0;

    return {
      score,
      priceMA20Distance,
      priceMA20DistancePct,
      threshold: this.config.momentumThreshold * 100,
      momentumSufficient,
      description: score > 0 ?
        `动量确认 (距离MA20 ${priceMA20DistancePct.toFixed(2)}% ≥ ${(this.config.momentumThreshold * 100).toFixed(1)}%)` :
        `动量不足 (距离MA20 ${priceMA20DistancePct.toFixed(2)}% < ${(this.config.momentumThreshold * 100).toFixed(1)}%)`
    };
  }

  /**
   * 最终趋势判断
   */
  makeFinalTrendDecision(scoringResult) {
    let trend4h = '震荡市';
    let marketType = '震荡市';

    // 按strategy-v3.md文档: ≥4分保留趋势
    if (scoringResult.totalScore >= this.config.totalScoreThreshold) {
      if (scoringResult.direction === 'BULL') {
        trend4h = '多头趋势';
        marketType = '趋势市';
      } else if (scoringResult.direction === 'BEAR') {
        trend4h = '空头趋势';
        marketType = '趋势市';
      }
    }

    return {
      trend4h,
      marketType,
      totalScore: scoringResult.totalScore,
      direction: scoringResult.direction,
      
      // 详细得分
      factorScores: scoringResult.factorScores,
      factorDetails: scoringResult.factorDetails,
      
      // 判断依据
      scoreThreshold: this.config.totalScoreThreshold,
      scoringBreakdown: this.getScoringBreakdown(scoringResult),
      
      // 技术指标
      ma20: scoringResult.factorDetails.direction?.currentMA20,
      ma50: scoringResult.factorDetails.direction?.currentMA50,
      ma200: scoringResult.factorDetails.direction?.currentMA200,
      adx: scoringResult.factorDetails.strength?.adx,
      bbw: scoringResult.factorDetails.expansion?.currentBBW,
      
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 获取得分明细
   */
  getScoringBreakdown(scoringResult) {
    const breakdown = [];
    
    Object.entries(scoringResult.factorScores).forEach(([factor, score]) => {
      if (score > 0) {
        const detail = scoringResult.factorDetails[factor];
        breakdown.push(`${factor}(+${score}): ${detail.description || ''}`);
      }
    });

    return breakdown;
  }

  /**
   * 存储趋势过滤结果
   */
  async storeTrendFilterResult(symbol, result) {
    try {
      await this.database.run(`
        INSERT OR REPLACE INTO v3_trend_4h_analysis
        (symbol, trend_direction, total_score, bull_direction_score, bear_direction_score,
         stability_score, strength_score, expansion_score, momentum_score,
         ma20, ma50, ma200, adx_value, bbw_current, price_ma20_distance_pct,
         data_quality_score, calculation_time_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        symbol,
        result.trend4h,
        result.totalScore,
        result.factorDetails.direction?.bullScore || 0,
        result.factorDetails.direction?.bearScore || 0,
        result.factorScores.stability || 0,
        result.factorScores.strength || 0,
        result.factorScores.expansion || 0,
        result.factorScores.momentum || 0,
        result.ma20,
        result.ma50,
        result.ma200,
        result.adx,
        result.bbw,
        result.factorDetails.momentum?.priceMA20DistancePct || 0,
        100, // 数据质量评分
        0    // 计算耗时
      ]);
    } catch (error) {
      console.error('存储趋势过滤结果失败:', error);
    }
  }

  /**
   * 获取趋势过滤统计
   */
  getTrendFilterStats() {
    return {
      config: this.config,
      lastUpdate: new Date().toISOString()
    };
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    if (!this.database) throw new Error('数据库连接不可用');
    if (!this.cacheManager) throw new Error('缓存管理器不可用');
    
    // 测试数据库连接
    await this.database.runQuery('SELECT 1');
    
    return { status: 'healthy', timestamp: new Date().toISOString() };
  }
}

module.exports = V3TrendFilter;
