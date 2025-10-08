/**
 * 宏观风险分析器
 * 使用Claude AI分析BTC和ETH的市场风险
 */

const fs = require('fs').promises;
const path = require('path');
const ClaudeClient = require('./claude-client');
const logger = require('../../utils/logger');

/**
 * 宏观风险分析器类
 */
class MacroRiskAnalyzer {
  constructor(claudeClient, aiOperations) {
    this.claudeClient = claudeClient;
    this.aiOps = aiOperations;
    this.promptTemplate = null;
  }

  /**
   * 加载Prompt模板
   * @returns {Promise<string>}
   */
  async loadPromptTemplate() {
    if (this.promptTemplate) {
      return this.promptTemplate;
    }

    try {
      const promptPath = path.join(__dirname, '../../../prompt-monitor.md');
      this.promptTemplate = await fs.readFile(promptPath, 'utf-8');
      logger.info('宏观风险分析Prompt模板加载成功');
      return this.promptTemplate;
    } catch (error) {
      logger.error('加载Prompt模板失败:', error);
      // 使用默认模板
      this.promptTemplate = this.getDefaultPrompt();
      return this.promptTemplate;
    }
  }

  /**
   * 获取默认Prompt模板
   * @returns {string}
   */
  getDefaultPrompt() {
    return `你是一位专业的加密市场结构与风险监控分析AI Agent。
请分析给定交易对的市场风险，包括：
1. 核心发现（简洁概述市场状态）
2. 数据支持（价格、持仓量、资金费率、ETF流入等）
3. 风险等级评估（SAFE/WATCH/DANGER/EXTREME）
4. 操作建议
5. 短期和中期趋势预测

请以JSON格式返回分析结果。`;
  }

  /**
   * 分析单个交易对的宏观风险
   * @param {string} symbol - 交易对符号（如BTCUSDT）
   * @param {Object} marketData - 市场数据
   * @returns {Promise<Object>}
   */
  async analyzeSymbolRisk(symbol, marketData = {}) {
    const startTime = Date.now();
    logger.info(`开始分析 ${symbol} 的宏观风险`);

    try {
      // 加载Prompt模板
      const promptTemplate = await this.loadPromptTemplate();

      // 构建用户Prompt
      const userPrompt = this.buildUserPrompt(symbol, marketData);

      // 调用Claude API
      const result = await this.claudeClient.analyze(
        userPrompt,
        promptTemplate,
        { maxTokens: 4000 }
      );

      if (!result.success) {
        throw new Error(result.error || 'Claude API调用失败');
      }

      // 解析AI响应
      const analysisData = this.parseResponse(result.content, symbol);

      // 保存分析记录
      const analysisId = await this.aiOps.saveAnalysis({
        symbol,
        analysisType: 'MACRO_RISK',
        analysisData,
        riskLevel: analysisData.riskLevel,
        confidenceScore: analysisData.confidence || null,
        alertTriggered: false,
        rawResponse: result.content
      });

      // 记录API调用日志
      await this.aiOps.saveAPILog({
        requestType: 'MACRO_MONITOR',
        requestData: { symbol, marketData },
        responseStatus: 'SUCCESS',
        responseTimeMs: result.responseTime,
        tokensUsed: result.tokensUsed
      });

      const totalTime = Date.now() - startTime;
      logger.info(`${symbol} 宏观风险分析完成 - 耗时: ${totalTime}ms, 风险等级: ${analysisData.riskLevel}`);

      return {
        success: true,
        analysisId,
        symbol,
        ...analysisData,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      logger.error(`${symbol} 宏观风险分析失败:`, error);

      // 记录失败日志
      await this.aiOps.saveAPILog({
        requestType: 'MACRO_MONITOR',
        requestData: { symbol, marketData },
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
   * 构建用户Prompt
   * @param {string} symbol - 交易对符号
   * @param {Object} marketData - 市场数据
   * @returns {string}
   */
  buildUserPrompt(symbol, marketData) {
    const coinName = symbol.replace('USDT', '');
    const currentPrice = marketData.currentPrice || 'N/A';
    const priceChange24h = marketData.priceChange24h || 'N/A';
    const volume24h = marketData.volume24h || 'N/A';
    const fundingRate = marketData.fundingRate || 'N/A';

    return `请分析 ${coinName} 的市场风险。

当前市场数据：
- 交易对: ${symbol}
- 当前价格: $${currentPrice}
- 24H价格变化: ${priceChange24h}%
- 24H成交量: $${volume24h}
- 资金费率: ${fundingRate}

请基于以上数据，结合你通过联网获取的最新市场信息（包括但不限于：
- Coinglass的持仓量、多空比、爆仓数据
- ETF资金流入流出数据
- 链上活跃地址和鲸鱼持仓变动
- 市场情绪指标
），进行全面的风险分析。

请以如下JSON格式返回分析结果：
{
  "coreFinding": "核心发现的简洁描述",
  "riskLevel": "SAFE|WATCH|DANGER|EXTREME",
  "confidence": 85,
  "currentPrice": ${currentPrice},
  "dataSupport": {
    "openInterest": "持仓量数据及趋势",
    "fundingRate": "资金费率及含义",
    "etfFlow": "ETF资金流向",
    "onChainData": "链上数据要点",
    "marketStructure": "市场结构状态"
  },
  "suggestions": ["操作建议1", "操作建议2"],
  "shortTermPrediction": {
    "scenarios": [
      {"type": "pullback", "probability": 60, "priceRange": [min, max]},
      {"type": "breakout", "probability": 25, "priceRange": [min, max]},
      {"type": "sideways", "probability": 15, "priceRange": [min, max]}
    ]
  },
  "midTermPrediction": {
    "trend": "up|down|sideways",
    "reasoning": "中期趋势判断理由"
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
        
        // 验证必要字段
        if (!parsed.riskLevel) {
          parsed.riskLevel = this.inferRiskLevel(content);
        }

        // 标准化风险等级
        parsed.riskLevel = this.normalizeRiskLevel(parsed.riskLevel);

        return parsed;
      }

      // 如果没有找到JSON，尝试从文本推断
      return this.parseTextResponse(content, symbol);

    } catch (error) {
      logger.error('解析AI响应失败:', error);
      return this.getDefaultAnalysis(symbol, content);
    }
  }

  /**
   * 从文本推断风险等级
   * @param {string} content - 文本内容
   * @returns {string}
   */
  inferRiskLevel(content) {
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('极度危险') || lowerContent.includes('extreme')) {
      return 'EXTREME';
    } else if (lowerContent.includes('危险') || lowerContent.includes('danger')) {
      return 'DANGER';
    } else if (lowerContent.includes('观察') || lowerContent.includes('watch') || lowerContent.includes('警告')) {
      return 'WATCH';
    } else {
      return 'SAFE';
    }
  }

  /**
   * 标准化风险等级
   * @param {string} level - 原始风险等级
   * @returns {string}
   */
  normalizeRiskLevel(level) {
    const normalized = level.toUpperCase().trim();
    const validLevels = ['SAFE', 'WATCH', 'DANGER', 'EXTREME'];
    
    if (validLevels.includes(normalized)) {
      return normalized;
    }

    // 映射常见变体
    const mapping = {
      '安全': 'SAFE',
      '观察': 'WATCH',
      '危险': 'DANGER',
      '极度危险': 'EXTREME',
      'WARNING': 'WATCH',
      'CRITICAL': 'DANGER'
    };

    return mapping[level] || 'WATCH';
  }

  /**
   * 解析文本响应（无JSON格式时）
   * @param {string} content - 文本内容
   * @param {string} symbol - 交易对符号
   * @returns {Object}
   */
  parseTextResponse(content, symbol) {
    return {
      coreFinding: content.substring(0, 200) + '...',
      riskLevel: this.inferRiskLevel(content),
      confidence: 50,
      currentPrice: 0,
      dataSupport: {
        summary: content
      },
      suggestions: ['请查看完整分析'],
      shortTermPrediction: {
        scenarios: []
      },
      midTermPrediction: {
        trend: 'sideways',
        reasoning: '数据解析异常'
      },
      rawText: content
    };
  }

  /**
   * 获取默认分析结果（错误时使用）
   * @param {string} symbol - 交易对符号
   * @param {string} errorContent - 错误内容
   * @returns {Object}
   */
  getDefaultAnalysis(symbol, errorContent = '') {
    return {
      coreFinding: 'AI分析暂时不可用，请稍后重试',
      riskLevel: 'WATCH',
      confidence: 0,
      currentPrice: 0,
      dataSupport: {},
      suggestions: ['等待AI服务恢复'],
      shortTermPrediction: { scenarios: [] },
      midTermPrediction: { trend: 'sideways', reasoning: 'AI服务异常' },
      error: true,
      errorContent
    };
  }

  /**
   * 判断是否应该触发告警
   * @param {string} riskLevel - 风险等级
   * @returns {boolean}
   */
  shouldTriggerAlert(riskLevel) {
    return riskLevel === 'DANGER' || riskLevel === 'EXTREME';
  }

  /**
   * 获取告警类型
   * @param {string} riskLevel - 风险等级
   * @returns {string}
   */
  getAlertType(riskLevel) {
    return riskLevel === 'EXTREME' ? 'RISK_CRITICAL' : 'RISK_WARNING';
  }
}

module.exports = MacroRiskAnalyzer;

