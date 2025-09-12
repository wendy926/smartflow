// FactorWeightManager.js - 多因子权重管理器
// 根据交易对分类应用不同的因子权重

const DatabaseManager = require('../database/DatabaseManager');

class FactorWeightManager {
  constructor(database = null) {
    this.database = database || new DatabaseManager();
    this.defaultWeights = this.getDefaultWeights();
  }

  /**
   * 获取默认权重配置
   * 基于strategy-v3.md文档的权重设计
   */
  getDefaultWeights() {
    return {
      // 趋势市1H多因子打分权重
      '1h_scoring': {
        'mainstream': {
          vwap: 0, // 必须满足，不计分
          breakout: 0.30,
          volume: 0.20,
          oi: 0.25,
          delta: 0.15,
          funding: 0.10
        },
        'high-cap-trending': {
          vwap: 0, // 必须满足，不计分
          breakout: 0.25,
          volume: 0.25,
          oi: 0.20,
          delta: 0.20,
          funding: 0.10
        },
        'trending': {
          vwap: 0, // 必须满足，不计分
          breakout: 0.15,
          volume: 0.30,
          oi: 0.15,
          delta: 0.30,
          funding: 0.10
        },
        'smallcap': {
          vwap: 0, // 必须满足，不计分
          breakout: 0.15,
          volume: 0.30,
          oi: 0.15,
          delta: 0.30,
          funding: 0.10
        }
      },
      // 震荡市1H边界确认权重
      '1h_boundary': {
        'mainstream': {
          vwap: 0.20, // 20%
          touch: 0.30,
          volume: 0.20,
          delta: 0.15,
          oi: 0.10,
          no_breakout: 0.05
        },
        'high-cap-trending': {
          vwap: 0.20, // 20%
          touch: 0.30,
          volume: 0.25,
          delta: 0.15,
          oi: 0.10,
          no_breakout: 0
        },
        'trending': {
          vwap: 0.10, // 10%
          touch: 0.25,
          volume: 0.30,
          delta: 0.25,
          oi: 0.10,
          no_breakout: 0
        },
        'smallcap': {
          vwap: 0.10, // 10%
          touch: 0.25,
          volume: 0.30,
          delta: 0.25,
          oi: 0.10,
          no_breakout: 0
        }
      },
      // 震荡市15分钟入场执行权重
      '15m_execution': {
        'mainstream': {
          vwap: 0.30,
          delta: 0.30,
          oi: 0.20,
          volume: 0.20
        },
        'high-cap-trending': {
          vwap: 0.20,
          delta: 0.30,
          oi: 0.30,
          volume: 0.20
        },
        'trending': {
          vwap: 0.20,
          delta: 0.20,
          oi: 0.20,
          volume: 0.40
        },
        'smallcap': {
          vwap: 0.10,
          delta: 0.20,
          oi: 0.20,
          volume: 0.50
        }
      }
    };
  }

  /**
   * 获取交易对分类
   */
  async getSymbolCategory(symbol) {
    try {
      if (this.database) {
        const categoryData = await this.database.getSymbolCategory(symbol);
        if (categoryData) {
          return categoryData.category;
        }
      }

      // 如果数据库中没有，使用默认分类逻辑
      return this.getDefaultCategory(symbol);
    } catch (error) {
      console.error(`获取交易对分类失败 [${symbol}]:`, error);
      // 返回默认分类而不是抛出错误
      return this.getDefaultCategory(symbol);
    }
  }

  /**
   * 默认分类逻辑
   */
  getDefaultCategory(symbol) {
    const symbolUpper = symbol.toUpperCase();

    // 主流币
    if (['BTCUSDT', 'ETHUSDT'].includes(symbolUpper)) {
      return 'mainstream';
    }

    // 高市值强趋势币
    const highCapSymbols = ['BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT',
      'DOTUSDT', 'LTCUSDT', 'TRXUSDT', 'BCHUSDT', 'ETCUSDT'];
    if (highCapSymbols.includes(symbolUpper)) {
      return 'high-cap-trending';
    }

    // 热点币（通常包含MEME、PEPE等）
    if (symbolUpper.includes('MEME') || symbolUpper.includes('PEPE') ||
      symbolUpper.includes('DOGE') || symbolUpper.includes('SHIB')) {
      return 'trending';
    }

    // 其他默认为小币
    return 'smallcap';
  }

  /**
   * 获取多因子权重配置
   */
  async getFactorWeights(category, analysisType) {
    try {
      if (this.database) {
        // 将1h_scoring映射到1h
        const dbAnalysisType = analysisType === '1h_scoring' ? '1h' : analysisType;
        const weights = await this.database.getFactorWeights(category, dbAnalysisType);
        if (weights) {
          return {
            vwap: weights.vwap_weight,
            delta: weights.delta_weight,
            oi: weights.oi_weight,
            volume: weights.volume_weight,
            breakout: weights.breakout_weight,
            funding: weights.funding_weight
          };
        }
      }

      // 使用默认权重
      return this.defaultWeights[analysisType]?.[category] ||
        this.defaultWeights[analysisType]?.['mainstream'] ||
        this.defaultWeights['1h_scoring']?.['mainstream'];
    } catch (error) {
      console.error(`获取因子权重失败 [${category}, ${analysisType}]:`, error);
      // 返回默认权重而不是抛出错误
      return this.defaultWeights[analysisType]?.[category] ||
        this.defaultWeights[analysisType]?.['mainstream'] ||
        this.defaultWeights['1h_scoring']?.['mainstream'];
    }
  }

  /**
   * 计算加权多因子得分
   */
  async calculateWeightedScore(symbol, analysisType, factorValues) {
    try {
      const category = await this.getSymbolCategory(symbol);
      const weights = await this.getFactorWeights(category, analysisType);

      if (!weights) {
        console.warn(`未找到权重配置 [${category}, ${analysisType}]`);
        return { score: 0, category, weights: null };
      }

      let totalScore = 0; // 原始因子得分总和
      let weightedScore = 0; // 加权得分
      const factorScores = {};

      // 计算各因子得分
      for (const [factor, value] of Object.entries(factorValues)) {
        const factorScore = this.calculateFactorScore(factor, value, analysisType);
        totalScore += factorScore; // 累加原始得分

        if (weights[factor] && weights[factor] > 0) {
          weightedScore += factorScore * weights[factor];
        }

        factorScores[factor] = {
          value,
          weight: weights[factor] || 0,
          score: factorScore,
          weightedScore: factorScore * (weights[factor] || 0)
        };
      }

      return {
        score: Math.round(totalScore * 100) / 100, // 返回原始得分总和（满分6分）
        weightedScore: Math.round(weightedScore * 100) / 100, // 加权得分
        category,
        weights,
        factorScores,
        analysisType
      };
    } catch (error) {
      console.error(`计算加权得分失败 [${symbol}, ${analysisType}]:`, error);
      return { score: 0, category: 'mainstream', weights: null, error: error.message };
    }
  }

  /**
   * 计算单个因子得分
   */
  calculateFactorScore(factor, value, analysisType) {
    switch (factor) {
      case 'vwap':
        // VWAP方向一致性（必须满足，不计分）
        return value ? 1 : 0;

      case 'breakout':
        // 突破确认
        return value ? 1 : 0;

      case 'volume':
        // 成交量确认 - 根据分析类型使用不同逻辑
        if (analysisType === '1h_boundary') {
          // 震荡市1H边界判断：成交量低 → 震荡区间有效
          return value <= 1.0 ? 1 : (value <= 1.2 ? 0.5 : 0);
        } else {
          // 趋势市1H多因子打分：成交量高 → 趋势确认
          return value >= 1.5 ? 1 : (value >= 1.2 ? 0.5 : 0);
        }

      case 'oi':
        // OI变化确认
        return Math.abs(value) >= 0.02 ? 1 : 0;

      case 'delta':
        // Delta不平衡
        return Math.abs(value) >= 0.1 ? 1 : (Math.abs(value) >= 0.05 ? 0.5 : 0);

      case 'funding':
        // 资金费率 - 严格按照strategy-v3.md: 0.05% ≤ Funding Rate ≤ +0.05%
        return Math.abs(value) <= 0.0005 ? 1 : (Math.abs(value) <= 0.001 ? 0.5 : 0);

      case 'touch':
        // 触碰因子
        return value >= 3 ? 1 : (value >= 2 ? 0.5 : 0);

      case 'no_breakout':
        // 无突破因子
        return value ? 1 : 0;

      default:
        return 0;
    }
  }

  /**
   * 初始化默认权重配置到数据库
   */
  async initializeDefaultWeights() {
    try {
      if (!this.database) {
        console.warn('数据库未初始化，跳过权重配置初始化');
        return;
      }

      for (const [analysisType, categories] of Object.entries(this.defaultWeights)) {
        for (const [category, weights] of Object.entries(categories)) {
          await this.database.recordFactorWeights({
            category,
            analysisType,
            vwapWeight: weights.vwap || 0,
            deltaWeight: weights.delta || 0,
            oiWeight: weights.oi || 0,
            volumeWeight: weights.volume || 0,
            breakoutWeight: weights.breakout || 0,
            fundingWeight: weights.funding || 0
          });
        }
      }

      console.log('✅ 默认权重配置初始化完成');
    } catch (error) {
      console.error('初始化默认权重配置失败:', error);
    }
  }

  /**
   * 获取所有权重配置
   */
  async getAllWeights() {
    try {
      if (this.database) {
        return await this.database.getAllFactorWeights();
      }
      return [];
    } catch (error) {
      console.error('获取所有权重配置失败:', error);
      return [];
    }
  }

  /**
   * 更新权重配置
   */
  async updateWeights(category, analysisType, newWeights) {
    try {
      if (!this.database) {
        console.warn('数据库未初始化，无法更新权重配置');
        return false;
      }

      await this.database.recordFactorWeights({
        category,
        analysisType,
        vwapWeight: newWeights.vwap || 0,
        deltaWeight: newWeights.delta || 0,
        oiWeight: newWeights.oi || 0,
        volumeWeight: newWeights.volume || 0,
        breakoutWeight: newWeights.breakout || 0,
        fundingWeight: newWeights.funding || 0
      });

      console.log(`✅ 权重配置更新成功 [${category}, ${analysisType}]`);
      return true;
    } catch (error) {
      console.error('更新权重配置失败:', error);
      return false;
    }
  }
}

module.exports = FactorWeightManager;
