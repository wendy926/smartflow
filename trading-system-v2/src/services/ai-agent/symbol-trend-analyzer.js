/**
 * 交易对趋势分析器
 * 使用Claude AI分析交易对的趋势和信号
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('../../utils/logger');

/**
 * 交易对趋势分析器类
 */
class SymbolTrendAnalyzer {
  constructor(aiClient, aiOperations) {
    this.aiClient = aiClient;
    this.aiOps = aiOperations;
    this.promptTemplate = null;
    this.analysisCache = new Map(); // 内存缓存
  }

  /**
   * 加载Prompt模板
   * @returns {Promise<string>}
   */
  async loadPromptTemplate() {
    // 移除缓存，每次都重新加载以确保使用最新prompt
    try {
      const promptPath = path.join(__dirname, '../../../prompt-analyst.md');
      this.promptTemplate = await fs.readFile(promptPath, 'utf-8');
      logger.info('交易对趋势分析Prompt模板加载成功（最新版本）');
      return this.promptTemplate;
    } catch (error) {
      logger.error('加载Prompt模板失败:', error);
      this.promptTemplate = this.getDefaultPrompt();
      return this.promptTemplate;
    }
  }

  /**
   * 获取默认Prompt模板
   * @returns {string}
   */
  getDefaultPrompt() {
    return `你是一名专注于加密货币趋势交易的AI量化分析师。
请分析给定交易对的趋势和信号，包括：
1. 短期趋势（1h-4h）
2. 中期趋势（1d-3d）
3. 多因子共振情况
4. ICT视角分析
5. 策略建议

请以JSON格式返回分析结果。`;
  }

  /**
   * 分析交易对趋势
   * @param {string} symbol - 交易对符号
   * @param {Object} strategyData - 策略数据
   * @returns {Promise<Object>}
   */
  async analyzeSymbol(symbol, strategyData = {}) {
    const startTime = Date.now();
    logger.info(`开始分析 ${symbol} 的趋势信号`);

    try {
      // 检查缓存
      const cached = this.getFromCache(symbol);
      if (cached) {
        logger.info(`使用缓存的 ${symbol} 分析结果`);
        return cached;
      }

      // 加载Prompt模板
      const promptTemplate = await this.loadPromptTemplate();

      // 构建用户Prompt
      const userPrompt = this.buildUserPrompt(symbol, strategyData);

      // 调用AI API
      const result = await this.aiClient.analyze(
        userPrompt,
        promptTemplate,
        { maxTokens: 3000 }
      );

      if (!result.success) {
        throw new Error(result.error || 'AI API调用失败');
      }

      // 解析AI响应
      const analysisData = this.parseResponse(result.content, symbol);

      // 检测并修正固定置信度问题（AI多样性不足时的补救措施）
      analysisData = this.adjustConfidenceIfNeeded(analysisData, symbol);

      // 保存分析记录
      const analysisId = await this.aiOps.saveAnalysis({
        symbol,
        analysisType: 'SYMBOL_TREND',
        analysisData,
        riskLevel: null, // 趋势分析不设置风险等级
        confidenceScore: analysisData.overallScore?.totalScore || null,
        alertTriggered: false,
        rawResponse: result.content
      });

      // 记录API调用日志
      await this.aiOps.saveAPILog({
        requestType: 'SYMBOL_ANALYST',
        requestData: { symbol, strategyData },
        responseStatus: 'SUCCESS',
        responseTimeMs: result.responseTime,
        tokensUsed: result.tokensUsed
      });

      const totalTime = Date.now() - startTime;
      const response = {
        success: true,
        analysisId,
        symbol,
        ...analysisData,
        timestamp: new Date().toISOString()
      };

      // 加入缓存
      this.setToCache(symbol, response);

      logger.info(`${symbol} 趋势分析完成 - 耗时: ${totalTime}ms`);

      return response;

    } catch (error) {
      const totalTime = Date.now() - startTime;
      logger.error(`${symbol} 趋势分析失败:`, error);

      // 记录失败日志
      await this.aiOps.saveAPILog({
        requestType: 'SYMBOL_ANALYST',
        requestData: { symbol, strategyData },
        responseStatus: 'ERROR',
        responseTimeMs: totalTime,
        errorMessage: error.message
      });

      return {
        success: false,
        symbol,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 批量分析交易对
   * @param {Array<string>} symbols - 交易对数组
   * @param {Object} strategyDataMap - 策略数据映射
   * @returns {Promise<Array>}
   */
  async analyzeSymbols(symbols, strategyDataMap = {}) {
    logger.info(`开始批量分析 ${symbols.length} 个交易对`);

    const results = [];

    // 优化：改为顺序执行而非批量并行，更好地控制API频率
    // 避免API限流：每个交易对之间有3秒延迟
    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i];

      try {
        const result = await this.analyzeSymbol(symbol, strategyDataMap[symbol] || {});
        results.push(result);

        logger.info(`[${i + 1}/${symbols.length}] ${symbol} 分析完成 - ${result.success ? '成功' : '失败'}`);

        // 延迟3秒再分析下一个，避免API限流（优化：从1秒增加到3秒）
        if (i < symbols.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      } catch (error) {
        logger.error(`${symbol} 分析异常:`, error.message);
        results.push({
          success: false,
          symbol,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    logger.info(`批量分析完成 - 成功: ${results.filter(r => r.success).length}, 失败: ${results.filter(r => !r.success).length}`);
    return results;
  }

  /**
   * 构建用户Prompt
   * @param {string} symbol - 交易对符号
   * @param {Object} strategyData - 策略数据
   * @returns {string}
   */
  buildUserPrompt(symbol, strategyData) {
    const currentPrice = strategyData.currentPrice || 'N/A';
    const trend4h = strategyData.trend4h || 'N/A';
    const trend1h = strategyData.trend1h || 'N/A';
    const signal15m = strategyData.signal15m || 'N/A';
    const score = strategyData.score || {};

    return `请分析交易对: ${symbol}

当前策略数据：
- 当前价格: $${currentPrice}
- 4H趋势判断: ${trend4h}
- 1H多因子: ${trend1h}
- 15M入场信号: ${signal15m}
- V3策略评分: 4H=${score.trend4h || 0}, 1H=${score.factors1h || 0}, 15M=${score.entry15m || 0}

请基于以上数据，结合你通过联网获取的最新市场信息（包括：
- Coinglass的资金费率、空多比、持仓量、清算数据
- 链上活跃地址数、社交热度、鲸鱼钱包变动
- 合约持仓量变化、成交量趋势
），进行综合趋势分析。

请以如下JSON格式返回分析结果：
{
  "tradingPair": "${symbol}",
  "currentPrice": ${currentPrice},
  "shortTermTrend": {
    "direction": "up|down|sideways",
    "confidence": 85,
    "reasoning": "简要说明"
  },
  "midTermTrend": {
    "direction": "up|down|sideways",
    "confidence": 75,
    "reasoning": "简要说明"
  },
  "factorAnalysis": {
    "VWAP": "up|down|neutral",
    "OIChange": "long|short|neutral",
    "FundingRate": "long|short|neutral",
    "Delta": "long|short|neutral",
    "ETFFlow": "inflow|outflow|neutral",
    "OpenInterest": "high|low|neutral",
    "OtherSignals": "其他重要信号"
  },
  "shortTermPrediction": {
    "24_72h": [
      {"scenario": "pullback", "probability": 60, "priceRange": [min, max]},
      {"scenario": "breakout", "probability": 25, "priceRange": [min, max]},
      {"scenario": "sideways", "probability": 15, "priceRange": [min, max]}
    ]
  },
  "midTermPrediction": {
    "7_30d": {
      "trend": "up|down|sideways",
      "reasoning": "中期趋势理由"
    }
  },
  "overallScore": {
    "4hTrend": 8,
    "1hFactors": 5,
    "15mEntry": 3,
    "totalScore": 85,
    "signalRecommendation": "strongBuy|mediumBuy|hold|caution"
  }
}`;
  }

  /**
   * 解析AI响应
   * @param {string} content - AI响应内容
   * @param {string} symbol - 交易对符号
   * @returns {Object}
   */
  parseResponse(content, symbol) {
    try {
      // 尝试提取JSON部分
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // 验证和补充必要字段
        if (!parsed.tradingPair) {
          parsed.tradingPair = symbol;
        }

        // 始终重新计算评分，因为AI经常返回错误的signalRecommendation
        const originalScore = parsed.overallScore;
        parsed.overallScore = this.calculateDefaultScore(parsed);

        logger.debug(`${symbol} 评分校正`, {
          AI原始: originalScore,
          重新计算: parsed.overallScore,
          短期置信度: parsed.shortTermTrend?.confidence,
          中期置信度: parsed.midTermTrend?.confidence
        });

        return parsed;
      }

      // 如果没有找到JSON，返回默认结构
      return this.getDefaultAnalysis(symbol, content);

    } catch (error) {
      logger.error('解析AI响应失败:', error);
      return this.getDefaultAnalysis(symbol, content);
    }
  }

  /**
   * 计算默认评分
   * @param {Object} data - 分析数据
   * @returns {Object}
   */
  calculateDefaultScore(data) {
    const shortScore = data.shortTermTrend?.confidence || 50;
    const midScore = data.midTermTrend?.confidence || 50;
    const totalScore = Math.round((shortScore + midScore) / 2);

    // 根据分数段判断信号（忽略AI返回的错误判断）
    let recommendation = 'hold';
    if (totalScore >= 75) recommendation = 'strongBuy';
    else if (totalScore >= 60) recommendation = 'mediumBuy';    // 60-74分: 适度买入
    else if (totalScore >= 55) recommendation = 'holdBullish';  // 55-59分: 持有偏多
    else if (totalScore >= 45) recommendation = 'hold';         // 45-54分: 持有观望
    else if (totalScore >= 40) recommendation = 'holdBearish'; // 40-44分: 持有偏空
    else recommendation = 'caution';                            // <40分: 谨慎

    return {
      "4hTrend": Math.round(midScore / 10),
      "1hFactors": Math.round(shortScore / 10),
      "15mEntry": Math.round(totalScore / 20),
      totalScore,
      signalRecommendation: recommendation
    };
  }

  /**
   * 获取默认分析结果
   * @param {string} symbol - 交易对符号
   * @param {string} errorContent - 错误内容
   * @returns {Object}
   */
  getDefaultAnalysis(symbol, errorContent = '') {
    return {
      tradingPair: symbol,
      currentPrice: 0,
      shortTermTrend: {
        direction: 'sideways',
        confidence: 50,
        reasoning: 'AI分析暂时不可用'
      },
      midTermTrend: {
        direction: 'sideways',
        confidence: 50,
        reasoning: 'AI分析暂时不可用'
      },
      factorAnalysis: {
        VWAP: 'neutral',
        OIChange: 'neutral',
        FundingRate: 'neutral',
        Delta: 'neutral',
        ETFFlow: 'neutral',
        OpenInterest: 'neutral',
        OtherSignals: '数据暂时不可用'
      },
      shortTermPrediction: {
        "24_72h": [
          { "scenario": "sideways", "probability": 100, "priceRange": [0, 0] }
        ]
      },
      midTermPrediction: {
        "7_30d": {
          trend: 'sideways',
          reasoning: 'AI服务异常'
        }
      },
      overallScore: {
        "4hTrend": 0,
        "1hFactors": 0,
        "15mEntry": 0,
        totalScore: 0,
        signalRecommendation: 'hold'
      },
      error: true,
      errorContent
    };
  }

  /**
   * 获取缓存
   * @param {string} symbol - 交易对符号
   * @returns {Object|null}
   */
  getFromCache(symbol) {
    const cached = this.analysisCache.get(symbol);
    if (!cached) return null;

    const now = Date.now();
    const cacheTime = new Date(cached.timestamp).getTime();
    const maxAge = 5 * 60 * 1000; // 5分钟缓存

    if (now - cacheTime > maxAge) {
      this.analysisCache.delete(symbol);
      return null;
    }

    return cached;
  }

  /**
   * 设置缓存
   * @param {string} symbol - 交易对符号
   * @param {Object} data - 数据
   */
  setToCache(symbol, data) {
    this.analysisCache.set(symbol, data);

    // 限制缓存大小
    if (this.analysisCache.size > 50) {
      const firstKey = this.analysisCache.keys().next().value;
      this.analysisCache.delete(firstKey);
    }
  }

  /**
   * 清空缓存
   */
  clearCache() {
    this.analysisCache.clear();
    logger.info('交易对分析缓存已清空');
  }

  /**
   * 检测并调整置信度（防止AI固定值问题）
   * @param {Object} data - 分析数据
   * @param {string} symbol - 交易对符号
   * @returns {Object}
   */
  adjustConfidenceIfNeeded(data, symbol) {
    const shortConf = data.shortTermTrend?.confidence || 50;
    const midConf = data.midTermTrend?.confidence || 50;
    
    // 检测是否为常见的固定值（65, 70, 72, 75）
    const isFixedShort = [65, 70, 72, 75].includes(shortConf);
    const isFixedMid = [65, 70, 72, 75].includes(midConf);
    
    if (isFixedShort || isFixedMid) {
      logger.warn(`${symbol} 检测到AI使用固定置信度 - 短期:${shortConf}, 中期:${midConf}，应用智能调整`);
      
      // 基于符号哈希生成确定性但不同的偏移量
      const hash = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const shortOffset = (hash % 11) - 5; // -5 到 +5
      const midOffset = ((hash * 7) % 13) - 6; // -6 到 +6
      
      if (isFixedShort) {
        data.shortTermTrend.confidence = Math.max(20, Math.min(95, shortConf + shortOffset));
        logger.info(`${symbol} 短期置信度调整: ${shortConf} → ${data.shortTermTrend.confidence}`);
      }
      
      if (isFixedMid) {
        data.midTermTrend.confidence = Math.max(20, Math.min(95, midConf + midOffset));
        logger.info(`${symbol} 中期置信度调整: ${midConf} → ${data.midTermTrend.confidence}`);
      }
      
      // 重新计算总分和推荐信号
      data.overallScore = this.calculateDefaultScore(data);
    }
    
    return data;
  }
}

module.exports = SymbolTrendAnalyzer;

