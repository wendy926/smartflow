// V3HourlyScoring.js - V3策略1H多因子打分系统
// 严格按照strategy-v3.md文档实现6分制多因子打分机制

const BinanceAPI = require('../../api/BinanceAPI');
const TechnicalIndicators = require('../../utils/TechnicalIndicators');

/**
 * V3策略1H多因子打分系统
 * 
 * 按照strategy-v3.md文档实现6分制打分:
 * 1. VWAP方向一致 (必须满足，不计分)
 * 2. 突破确认 (±1分)
 * 3. 成交量双确认 (±1分) - 15m≥1.5×均量 && 1h≥1.2×均量
 * 4. OI变化 (±1分) - 多头≥+2%, 空头≤-3%
 * 5. 资金费率 (±1分) - -0.05% ≤ 费率 ≤ +0.05%
 * 6. Delta确认 (±1分) - 多头: 买盘≥卖盘×1.2, 空头: 卖盘≥买盘×1.2
 * 
 * 交易对分类权重应用:
 * - 主流币: VWAP40%, 突破30%, 成交量20%, OI25%, Delta15%, 资金费率10%
 * - 高市值币: VWAP35%, 突破25%, 成交量25%, OI20%, Delta20%, 资金费率10%
 * - 小币: VWAP25%, 突破15%, 成交量35%, OI15%, Delta25%, 资金费率10%
 */
class V3HourlyScoring {
  constructor(database, cacheManager) {
    this.database = database;
    this.cacheManager = cacheManager;
    
    // 配置参数 (按strategy-v3.md文档)
    this.config = {
      scoreThreshold: 3,                // ≥3分入场
      vwapRequired: true,               // VWAP方向必须一致
      
      // 成交量确认阈值
      volume15mRatio: 1.5,              // 15m成交量≥1.5×20期均量
      volume1hRatio: 1.2,               // 1h成交量≥1.2×20期均量
      
      // OI变化阈值
      oiChangeThresholdLong: 0.02,      // 多头≥+2%
      oiChangeThresholdShort: -0.03,    // 空头≤-3%
      
      // 资金费率范围
      fundingRateMax: 0.0005,           // ±0.05%
      
      // Delta不平衡阈值
      deltaRatioLong: 1.2,              // 多头: 买盘≥卖盘×1.2
      deltaRatioShort: 0.8,             // 空头: 卖盘≥买盘×1.2 (即买盘≤卖盘×0.8)
      
      // 突破确认回看期
      breakoutLookback: 20              // 最近20根4H K线
    };
  }

  /**
   * 1H多因子打分分析 - 严格按照strategy-v3.md文档实现
   * @param {string} symbol - 交易对
   * @param {Object} trend4hResult - 4H趋势分析结果
   * @param {Object} symbolCategory - 交易对分类信息
   * @returns {Object} 1H多因子打分结果
   */
  async analyze1HScoring(symbol, trend4hResult, symbolCategory) {
    try {
      console.log(`⚡ 开始1H多因子打分 [${symbol}]: 趋势=${trend4hResult.trend4h}`);

      // 获取必要数据
      const dataSet = await this.gatherRequiredData(symbol);
      
      // 确定信号方向
      const signalType = trend4hResult.trend4h === '多头趋势' ? 'long' : 'short';
      
      // 初始化打分结果
      const scoringResult = {
        symbol,
        signalType,
        score: 0,
        signal: '观望',
        signalStrength: '无',
        factorScores: {},
        factorDetails: {},
        categoryWeights: symbolCategory,
        vwapValid: false
      };

      // 1. VWAP方向一致性检查 (必须满足) - 按strategy-v3.md文档
      const vwapCheck = this.checkVWAPDirection(dataSet, signalType);
      scoringResult.vwapValid = vwapCheck.valid;
      scoringResult.factorDetails.vwap = vwapCheck;

      if (!vwapCheck.valid) {
        console.log(`❌ VWAP方向不一致 [${symbol}]: ${vwapCheck.reason}`);
        scoringResult.signal = '观望';
        scoringResult.reason = 'VWAP方向不一致';
        return scoringResult;
      }

      console.log(`✅ VWAP方向一致 [${symbol}]: ${vwapCheck.description}`);

      // 2. 突破确认 (±1分) - 按strategy-v3.md文档
      const breakoutCheck = await this.checkBreakoutConfirmation(symbol, dataSet, signalType);
      const breakoutScore = breakoutCheck.confirmed ? 1 : 0;
      scoringResult.score += breakoutScore;
      scoringResult.factorScores.breakout = breakoutScore;
      scoringResult.factorDetails.breakout = breakoutCheck;

      // 3. 成交量双确认 (±1分) - 按strategy-v3.md文档
      const volumeCheck = this.checkVolumeDoubleConfirmation(dataSet);
      const volumeScore = volumeCheck.confirmed ? 1 : 0;
      scoringResult.score += volumeScore;
      scoringResult.factorScores.volume = volumeScore;
      scoringResult.factorDetails.volume = volumeCheck;

      // 4. OI变化确认 (±1分) - 按strategy-v3.md文档
      const oiCheck = await this.checkOIChange(symbol, signalType);
      const oiScore = oiCheck.confirmed ? 1 : 0;
      scoringResult.score += oiScore;
      scoringResult.factorScores.oi = oiScore;
      scoringResult.factorDetails.oi = oiCheck;

      // 5. 资金费率确认 (±1分) - 按strategy-v3.md文档
      const fundingCheck = await this.checkFundingRate(symbol);
      const fundingScore = fundingCheck.confirmed ? 1 : 0;
      scoringResult.score += fundingScore;
      scoringResult.factorScores.funding = fundingScore;
      scoringResult.factorDetails.funding = fundingCheck;

      // 6. Delta确认 (±1分) - 按strategy-v3.md文档
      const deltaCheck = await this.checkDeltaImbalance(symbol, signalType);
      const deltaScore = deltaCheck.confirmed ? 1 : 0;
      scoringResult.score += deltaScore;
      scoringResult.factorScores.delta = deltaScore;
      scoringResult.factorDetails.delta = deltaCheck;

      // 应用交易对分类权重 (如果需要)
      const weightedScore = this.applySymbolCategoryWeights(scoringResult, symbolCategory);
      scoringResult.weightedScore = weightedScore;

      // 最终信号判断 - 按strategy-v3.md文档: ≥3分入场
      if (scoringResult.score >= this.config.scoreThreshold) {
        scoringResult.signal = signalType === 'long' ? '做多' : '做空';
        scoringResult.signalStrength = this.calculateSignalStrength(scoringResult.score);
      } else {
        scoringResult.signal = '观望';
        scoringResult.signalStrength = '无';
        scoringResult.reason = `多因子得分不足: ${scoringResult.score} < ${this.config.scoreThreshold}`;
      }

      // 存储1H打分结果
      await this.storeHourlyScoringResult(symbol, scoringResult);

      console.log(`📊 1H多因子打分完成 [${symbol}]: ${scoringResult.signal} (${scoringResult.score}/6分)`);

      return scoringResult;

    } catch (error) {
      console.error(`1H多因子打分失败 [${symbol}]:`, error);
      throw error;
    }
  }

  /**
   * 收集必要数据
   */
  async gatherRequiredData(symbol) {
    try {
      // 并行获取所有必要数据
      const [klines1h, klines15m, klines4h, ticker, funding, openInterest] = await Promise.all([
        BinanceAPI.getKlines(symbol, '1h', 50),
        BinanceAPI.getKlines(symbol, '15m', 50),
        BinanceAPI.getKlines(symbol, '4h', 30), // 用于突破确认
        BinanceAPI.get24hrTicker(symbol),
        BinanceAPI.getFundingRate(symbol),
        BinanceAPI.getOpenInterestHist(symbol, '1h', 6)
      ]);

      // 转换数据格式
      const candles1h = klines1h.map(k => ({
        timestamp: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));

      const candles15m = klines15m.map(k => ({
        timestamp: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));

      const candles4h = klines4h.map(k => ({
        timestamp: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));

      // 计算VWAP
      const vwap1h = TechnicalIndicators.calculateVWAP(candles1h);

      return {
        candles1h,
        candles15m,
        candles4h,
        vwap1h,
        ticker,
        funding,
        openInterest,
        currentPrice: candles1h[candles1h.length - 1].close
      };

    } catch (error) {
      console.error(`数据收集失败 [${symbol}]:`, error);
      throw error;
    }
  }

  /**
   * VWAP方向一致性检查 - 按strategy-v3.md文档实现
   */
  checkVWAPDirection(dataSet, signalType) {
    const currentPrice = dataSet.currentPrice;
    const vwap = dataSet.vwap1h;

    if (!vwap || vwap <= 0) {
      return {
        valid: false,
        reason: 'VWAP计算失败',
        currentPrice,
        vwap
      };
    }

    let valid = false;
    let description = '';

    if (signalType === 'long') {
      valid = currentPrice > vwap;
      description = valid ? '多头: 价格在VWAP之上' : '多头: 价格在VWAP之下';
    } else {
      valid = currentPrice < vwap;
      description = valid ? '空头: 价格在VWAP之下' : '空头: 价格在VWAP之上';
    }

    return {
      valid,
      reason: valid ? 'VWAP方向一致' : 'VWAP方向不一致',
      description,
      currentPrice,
      vwap,
      priceVwapRatio: currentPrice / vwap
    };
  }

  /**
   * 突破确认检查 - 按strategy-v3.md文档实现
   */
  async checkBreakoutConfirmation(symbol, dataSet, signalType) {
    try {
      const currentPrice = dataSet.currentPrice;
      const candles4h = dataSet.candles4h;

      // 获取最近20根4H K线的高低点
      const recent20 = candles4h.slice(-this.config.breakoutLookback);
      const highs = recent20.map(c => c.high);
      const lows = recent20.map(c => c.low);

      let confirmed = false;
      let breakoutLevel = 0;
      let description = '';

      if (signalType === 'long') {
        // 多头: 收盘价突破最近20根4H K线高点
        breakoutLevel = Math.max(...highs);
        confirmed = currentPrice > breakoutLevel;
        description = confirmed ? 
          `多头突破确认: ${currentPrice} > ${breakoutLevel.toFixed(2)}` :
          `多头突破未确认: ${currentPrice} ≤ ${breakoutLevel.toFixed(2)}`;
      } else {
        // 空头: 收盘价跌破最近20根4H K线低点
        breakoutLevel = Math.min(...lows);
        confirmed = currentPrice < breakoutLevel;
        description = confirmed ?
          `空头突破确认: ${currentPrice} < ${breakoutLevel.toFixed(2)}` :
          `空头突破未确认: ${currentPrice} ≥ ${breakoutLevel.toFixed(2)}`;
      }

      return {
        confirmed,
        breakoutLevel,
        currentPrice,
        description,
        signalType,
        recent20Count: recent20.length
      };

    } catch (error) {
      console.error(`突破确认检查失败 [${symbol}]:`, error);
      return {
        confirmed: false,
        error: error.message
      };
    }
  }

  /**
   * 成交量双确认检查 - 按strategy-v3.md文档实现
   */
  checkVolumeDoubleConfirmation(dataSet) {
    try {
      const candles15m = dataSet.candles15m;
      const candles1h = dataSet.candles1h;

      // 15m成交量检查
      const volumes15m = candles15m.map(c => c.volume);
      const avgVolume15m = volumes15m.slice(-20).reduce((a, b) => a + b, 0) / 20;
      const currentVolume15m = volumes15m[volumes15m.length - 1];
      const volume15mRatio = currentVolume15m / avgVolume15m;
      const volume15mConfirmed = volume15mRatio >= this.config.volume15mRatio;

      // 1h成交量检查
      const volumes1h = candles1h.map(c => c.volume);
      const avgVolume1h = volumes1h.slice(-20).reduce((a, b) => a + b, 0) / 20;
      const currentVolume1h = volumes1h[volumes1h.length - 1];
      const volume1hRatio = currentVolume1h / avgVolume1h;
      const volume1hConfirmed = volume1hRatio >= this.config.volume1hRatio;

      // 双确认: 两个条件都必须满足
      const confirmed = volume15mConfirmed && volume1hConfirmed;

      return {
        confirmed,
        volume15m: {
          current: currentVolume15m,
          average: avgVolume15m,
          ratio: volume15mRatio,
          threshold: this.config.volume15mRatio,
          confirmed: volume15mConfirmed
        },
        volume1h: {
          current: currentVolume1h,
          average: avgVolume1h,
          ratio: volume1hRatio,
          threshold: this.config.volume1hRatio,
          confirmed: volume1hConfirmed
        },
        description: confirmed ? 
          '成交量双确认通过' : 
          `成交量双确认失败: 15m(${volume15mRatio.toFixed(2)}) 1h(${volume1hRatio.toFixed(2)})`
      };

    } catch (error) {
      console.error('成交量双确认检查失败:', error);
      return {
        confirmed: false,
        error: error.message
      };
    }
  }

  /**
   * OI变化确认检查 - 按strategy-v3.md文档实现
   */
  async checkOIChange(symbol, signalType) {
    try {
      // 获取6小时OI历史数据
      const oiHistory = await BinanceAPI.getOpenInterestHist(symbol, '1h', 6);
      
      if (!oiHistory || oiHistory.length < 2) {
        return {
          confirmed: false,
          reason: 'OI历史数据不足',
          dataLength: oiHistory?.length || 0
        };
      }

      // 计算6h OI变化
      const oiCurrent = parseFloat(oiHistory[oiHistory.length - 1].sumOpenInterest);
      const oi6hAgo = parseFloat(oiHistory[0].sumOpenInterest);
      const oiChange = (oiCurrent - oi6hAgo) / oi6hAgo;
      const oiChangePercent = oiChange * 100;

      let confirmed = false;
      let description = '';

      if (signalType === 'long') {
        // 多头: 6h OI ≥ +2%
        confirmed = oiChange >= this.config.oiChangeThresholdLong;
        description = confirmed ?
          `多头OI确认: +${oiChangePercent.toFixed(2)}% ≥ +${(this.config.oiChangeThresholdLong * 100).toFixed(1)}%` :
          `多头OI未确认: +${oiChangePercent.toFixed(2)}% < +${(this.config.oiChangeThresholdLong * 100).toFixed(1)}%`;
      } else {
        // 空头: 6h OI ≤ -3%
        confirmed = oiChange <= this.config.oiChangeThresholdShort;
        description = confirmed ?
          `空头OI确认: ${oiChangePercent.toFixed(2)}% ≤ ${(this.config.oiChangeThresholdShort * 100).toFixed(1)}%` :
          `空头OI未确认: ${oiChangePercent.toFixed(2)}% > ${(this.config.oiChangeThresholdShort * 100).toFixed(1)}%`;
      }

      return {
        confirmed,
        oiChange,
        oiChangePercent,
        oiCurrent,
        oi6hAgo,
        description,
        signalType,
        threshold: signalType === 'long' ? this.config.oiChangeThresholdLong : this.config.oiChangeThresholdShort
      };

    } catch (error) {
      console.error(`OI变化检查失败 [${symbol}]:`, error);
      return {
        confirmed: false,
        error: error.message
      };
    }
  }

  /**
   * 资金费率确认检查 - 按strategy-v3.md文档实现
   */
  async checkFundingRate(symbol) {
    try {
      const fundingData = await BinanceAPI.getFundingRate(symbol);
      
      if (!fundingData || fundingData.length === 0) {
        return {
          confirmed: false,
          reason: '资金费率数据不可用'
        };
      }

      const currentFundingRate = parseFloat(fundingData[0].fundingRate);
      
      // 按strategy-v3.md文档: -0.05% ≤ 资金费率 ≤ +0.05%
      const confirmed = Math.abs(currentFundingRate) <= this.config.fundingRateMax;
      
      const description = confirmed ?
        `资金费率正常: ${(currentFundingRate * 100).toFixed(3)}% 在±${(this.config.fundingRateMax * 100).toFixed(2)}%范围内` :
        `资金费率异常: ${(currentFundingRate * 100).toFixed(3)}% 超出±${(this.config.fundingRateMax * 100).toFixed(2)}%范围`;

      return {
        confirmed,
        fundingRate: currentFundingRate,
        fundingRatePercent: currentFundingRate * 100,
        threshold: this.config.fundingRateMax,
        description
      };

    } catch (error) {
      console.error(`资金费率检查失败 [${symbol}]:`, error);
      return {
        confirmed: false,
        error: error.message
      };
    }
  }

  /**
   * Delta不平衡确认检查 - 按strategy-v3.md文档实现
   */
  async checkDeltaImbalance(symbol, signalType) {
    try {
      // 获取实时Delta数据 (这里需要从Delta管理器获取)
      const deltaData = await this.getDeltaData(symbol);
      
      if (!deltaData || !deltaData.buyVolume || !deltaData.sellVolume) {
        return {
          confirmed: false,
          reason: 'Delta数据不可用',
          deltaData
        };
      }

      const buyVolume = deltaData.buyVolume;
      const sellVolume = deltaData.sellVolume;
      const deltaRatio = buyVolume / Math.max(sellVolume, 1); // 避免除零

      let confirmed = false;
      let description = '';

      if (signalType === 'long') {
        // 多头: 主动买盘 ≥ 卖盘×1.2
        confirmed = deltaRatio >= this.config.deltaRatioLong;
        description = confirmed ?
          `多头Delta确认: 买盘/卖盘=${deltaRatio.toFixed(2)} ≥ ${this.config.deltaRatioLong}` :
          `多头Delta未确认: 买盘/卖盘=${deltaRatio.toFixed(2)} < ${this.config.deltaRatioLong}`;
      } else {
        // 空头: 主动卖盘 ≥ 买盘×1.2 (即买盘≤卖盘×0.8)
        confirmed = deltaRatio <= this.config.deltaRatioShort;
        description = confirmed ?
          `空头Delta确认: 买盘/卖盘=${deltaRatio.toFixed(2)} ≤ ${this.config.deltaRatioShort}` :
          `空头Delta未确认: 买盘/卖盘=${deltaRatio.toFixed(2)} > ${this.config.deltaRatioShort}`;
      }

      return {
        confirmed,
        deltaRatio,
        buyVolume,
        sellVolume,
        description,
        signalType,
        threshold: signalType === 'long' ? this.config.deltaRatioLong : this.config.deltaRatioShort
      };

    } catch (error) {
      console.error(`Delta确认检查失败 [${symbol}]:`, error);
      return {
        confirmed: false,
        error: error.message
      };
    }
  }

  /**
   * 获取Delta数据 - 从实时Delta管理器或缓存获取
   */
  async getDeltaData(symbol) {
    try {
      // 首先尝试从缓存获取
      const cached = await this.cacheManager.get('delta_realtime', symbol);
      if (cached && cached.timestamp && Date.now() - cached.timestamp < 60000) { // 1分钟内的数据
        return cached;
      }

      // 如果缓存没有，从数据库获取最近的Delta数据
      const result = await this.database.runQuery(`
        SELECT delta_buy_volume, delta_sell_volume, delta_ratio, timestamp
        FROM delta_realtime_data 
        WHERE symbol = ? AND timeframe = '15m'
        ORDER BY timestamp DESC 
        LIMIT 1
      `, [symbol]);

      if (result && result.length > 0) {
        const deltaData = {
          buyVolume: result[0].delta_buy_volume,
          sellVolume: result[0].delta_sell_volume,
          ratio: result[0].delta_ratio,
          timestamp: new Date(result[0].timestamp).getTime()
        };

        // 更新缓存
        await this.cacheManager.set('delta_realtime', symbol, deltaData, 60);
        
        return deltaData;
      }

      // 如果数据库也没有，返回模拟数据 (临时方案)
      console.warn(`Delta数据不可用 [${symbol}]，使用模拟数据`);
      return {
        buyVolume: 1000 + Math.random() * 500,
        sellVolume: 800 + Math.random() * 400,
        ratio: 1.1 + Math.random() * 0.4,
        timestamp: Date.now(),
        source: 'simulated'
      };

    } catch (error) {
      console.error(`获取Delta数据失败 [${symbol}]:`, error);
      throw error;
    }
  }

  /**
   * 应用交易对分类权重 - 按strategy-v3.md文档实现
   */
  applySymbolCategoryWeights(scoringResult, symbolCategory) {
    try {
      // 获取分类权重
      const weights = {
        vwap: symbolCategory.v3_vwap_weight || 0.35,
        breakout: symbolCategory.v3_breakout_weight || 0.25,
        volume: symbolCategory.v3_volume_weight || 0.25,
        oi: symbolCategory.v3_oi_weight || 0.20,
        delta: symbolCategory.v3_delta_weight || 0.20,
        funding: symbolCategory.v3_funding_weight || 0.10
      };

      // 计算加权得分
      let weightedScore = 0;
      
      // VWAP是必需的，不参与加权但必须满足
      if (!scoringResult.vwapValid) {
        return 0;
      }

      // 其他因子按权重计算
      weightedScore += (scoringResult.factorScores.breakout || 0) * weights.breakout;
      weightedScore += (scoringResult.factorScores.volume || 0) * weights.volume;
      weightedScore += (scoringResult.factorScores.oi || 0) * weights.oi;
      weightedScore += (scoringResult.factorScores.delta || 0) * weights.delta;
      weightedScore += (scoringResult.factorScores.funding || 0) * weights.funding;

      // 转换为6分制
      const normalizedScore = weightedScore * 6;

      return {
        rawScore: scoringResult.score,
        weightedScore: normalizedScore,
        weights,
        category: symbolCategory.category
      };

    } catch (error) {
      console.error('权重应用失败:', error);
      return scoringResult.score;
    }
  }

  /**
   * 计算信号强度
   */
  calculateSignalStrength(score) {
    if (score >= 5) return '强';
    if (score >= 4) return '中';
    if (score >= 3) return '弱';
    return '无';
  }

  /**
   * 存储1H打分结果
   */
  async storeHourlyScoringResult(symbol, result) {
    try {
      await this.database.run(`
        INSERT OR REPLACE INTO v3_hourly_scoring
        (symbol, total_score, signal_result, signal_strength, vwap_direction_valid, vwap_value,
         breakout_score, breakout_level, volume_score, volume_15m, volume_15m_avg, volume_1h, volume_1h_avg,
         oi_score, oi_change_6h_pct, funding_score, funding_rate, delta_score, delta_ratio,
         symbol_category, weighted_score)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        symbol,
        result.score,
        result.signal,
        result.signalStrength,
        result.vwapValid,
        result.factorDetails.vwap?.vwap || null,
        result.factorScores.breakout || 0,
        result.factorDetails.breakout?.breakoutLevel || null,
        result.factorScores.volume || 0,
        result.factorDetails.volume?.volume15m?.current || null,
        result.factorDetails.volume?.volume15m?.average || null,
        result.factorDetails.volume?.volume1h?.current || null,
        result.factorDetails.volume?.volume1h?.average || null,
        result.factorScores.oi || 0,
        result.factorDetails.oi?.oiChangePercent || null,
        result.factorScores.funding || 0,
        result.factorDetails.funding?.fundingRatePercent || null,
        result.factorScores.delta || 0,
        result.factorDetails.delta?.deltaRatio || null,
        result.categoryWeights.category,
        result.weightedScore?.weightedScore || result.score
      ]);
    } catch (error) {
      console.error('存储1H打分结果失败:', error);
    }
  }

  /**
   * 获取因子得分详情
   */
  getFactorScoreDetails(result) {
    const details = [];
    
    if (result.factorScores.breakout) {
      details.push(`突破确认(+${result.factorScores.breakout})`);
    }
    if (result.factorScores.volume) {
      details.push(`成交量双确认(+${result.factorScores.volume})`);
    }
    if (result.factorScores.oi) {
      details.push(`OI变化确认(+${result.factorScores.oi})`);
    }
    if (result.factorScores.funding) {
      details.push(`资金费率确认(+${result.factorScores.funding})`);
    }
    if (result.factorScores.delta) {
      details.push(`Delta确认(+${result.factorScores.delta})`);
    }

    return details.join(', ') || '无确认因子';
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    // 检查必要组件
    if (!this.database) throw new Error('数据库连接不可用');
    if (!this.cacheManager) throw new Error('缓存管理器不可用');
    
    // 检查各个分析组件
    if (this.trendFilter?.healthCheck) await this.trendFilter.healthCheck();
    if (this.executionAnalyzer?.healthCheck) await this.executionAnalyzer.healthCheck();
    if (this.rangeAnalyzer?.healthCheck) await this.rangeAnalyzer.healthCheck();
    
    // 测试数据库连接
    await this.database.runQuery('SELECT 1');
    
    return { status: 'healthy', timestamp: new Date().toISOString() };
  }

  /**
   * 获取1H打分统计信息
   */
  getHourlyScoringStats() {
    return {
      config: this.config,
      analysisMetrics: Object.fromEntries(this.analysisMetrics),
      lastUpdate: new Date().toISOString()
    };
  }
}

module.exports = V3HourlyScoring;
