/**
 * 统一AI客户端
 * 支持多个AI提供商：OpenAI、Grok、DeepSeek
 */

const logger = require('../../utils/logger');
const encryption = require('../../utils/encryption');

/**
 * 统一AI客户端类
 */
class UnifiedAIClient {
  constructor(config = {}) {
    this.provider = config.provider || 'openai'; // openai, grok, deepseek
    this.apiKey = config.apiKey || '';
    this.baseURL = config.baseURL || this.getDefaultBaseURL();
    this.model = config.model || this.getDefaultModel();
    this.maxTokens = config.maxTokens || 4000;
    this.temperature = config.temperature || 0.3;
    this.timeout = config.timeout || 60000;
    
    // 备用提供商列表
    this.fallbackProviders = [];
    
    // 统计信息
    this.stats = {
      totalRequests: 0,
      successRequests: 0,
      errorRequests: 0,
      totalTokens: 0,
      totalResponseTime: 0,
      providerStats: {}
    };
  }

  /**
   * 获取默认Base URL
   */
  getDefaultBaseURL() {
    const urls = {
      'openai': 'https://api.openai.com/v1',
      'grok': 'https://api.x.ai/v1',
      'deepseek': 'https://api.deepseek.com/v1'
    };
    return urls[this.provider] || urls.openai;
  }

  /**
   * 获取默认模型
   */
  getDefaultModel() {
    const models = {
      'openai': 'gpt-4o-mini',
      'grok': 'grok-beta',
      'deepseek': 'deepseek-chat'
    };
    return models[this.provider] || models.openai;
  }

  /**
   * 初始化客户端（从数据库加载配置）
   * @param {Object} dbConfig - 数据库配置对象
   */
  async initialize(dbConfig) {
    try {
      // 确定使用的提供商
      this.provider = dbConfig.ai_provider || 'openai';
      
      // 加载主提供商配置
      await this.loadProviderConfig(this.provider, dbConfig);
      
      // 加载备用提供商
      await this.loadFallbackProviders(dbConfig);

      logger.info(`AI客户端初始化成功 - 提供商: ${this.provider}, 模型: ${this.model}, BaseURL: ${this.baseURL}`);
      return true;
    } catch (error) {
      logger.error('AI客户端初始化失败:', error);
      return false;
    }
  }

  /**
   * 加载提供商配置
   */
  async loadProviderConfig(provider, dbConfig) {
    const configKey = `${provider}_api_key`;
    const baseURLKey = `${provider}_base_url`;
    const modelKey = `${provider}_model`;
    
    // 解密API Key
    if (dbConfig[configKey]) {
      try {
        this.apiKey = encryption.decrypt(dbConfig[configKey]);
      } catch (error) {
        logger.error(`解密${provider} API Key失败:`, error);
        this.apiKey = dbConfig[configKey];
      }
    }

    this.baseURL = dbConfig[baseURLKey] || this.getDefaultBaseURL();
    this.model = dbConfig[modelKey] || this.getDefaultModel();
    this.maxTokens = parseInt(dbConfig.ai_max_tokens || dbConfig.openai_max_tokens) || this.maxTokens;
    this.temperature = parseFloat(dbConfig.ai_temperature || dbConfig.openai_temperature) || this.temperature;
  }

  /**
   * 加载备用提供商
   */
  async loadFallbackProviders(dbConfig) {
    const providers = ['openai', 'grok', 'deepseek'];
    
    for (const provider of providers) {
      if (provider === this.provider) continue;
      
      const configKey = `${provider}_api_key`;
      if (dbConfig[configKey]) {
        try {
          const apiKey = encryption.decrypt(dbConfig[configKey]);
          this.fallbackProviders.push({
            provider,
            apiKey,
            baseURL: dbConfig[`${provider}_base_url`] || this.getDefaultBaseURL.call({ provider }),
            model: dbConfig[`${provider}_model`] || this.getDefaultModel.call({ provider })
          });
          logger.info(`备用AI提供商已配置: ${provider}`);
        } catch (error) {
          logger.warn(`加载备用提供商${provider}失败:`, error.message);
        }
      }
    }
  }

  /**
   * 发送分析请求
   * @param {string} userPrompt - 用户提示词
   * @param {string} systemPrompt - 系统提示词
   * @param {Object} options - 可选参数
   * @returns {Promise<Object>}
   */
  async analyze(userPrompt, systemPrompt = '', options = {}) {
    // 尝试主提供商
    let result = await this.callProvider(
      this.provider,
      this.apiKey,
      this.baseURL,
      this.model,
      userPrompt,
      systemPrompt,
      options
    );

    // 如果主提供商失败，尝试备用
    if (!result.success && this.fallbackProviders.length > 0) {
      logger.warn(`主提供商${this.provider}失败，尝试备用提供商...`);
      
      for (const fallback of this.fallbackProviders) {
        logger.info(`尝试备用提供商: ${fallback.provider}`);
        result = await this.callProvider(
          fallback.provider,
          fallback.apiKey,
          fallback.baseURL,
          fallback.model,
          userPrompt,
          systemPrompt,
          options
        );
        
        if (result.success) {
          logger.info(`备用提供商${fallback.provider}成功响应`);
          break;
        }
      }
    }

    return result;
  }

  /**
   * 调用具体提供商
   */
  async callProvider(provider, apiKey, baseURL, model, userPrompt, systemPrompt, options) {
    const startTime = Date.now();
    this.stats.totalRequests++;

    // 初始化提供商统计
    if (!this.stats.providerStats[provider]) {
      this.stats.providerStats[provider] = { success: 0, error: 0 };
    }

    try {
      if (!apiKey) {
        throw new Error(`${provider} API Key未配置`);
      }

      // 动态导入OpenAI SDK（支持OpenAI兼容的API）
      const OpenAI = require('openai');
      const client = new OpenAI({
        apiKey: apiKey,
        baseURL: baseURL,
        timeout: options.timeout || this.timeout
      });

      // 构建消息
      const messages = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: userPrompt });

      const actualModel = options.model || model;
      const maxTokens = options.maxTokens || this.maxTokens;
      const temperature = options.temperature || this.temperature;

      logger.info(`发送${provider} API请求 - 模型: ${actualModel}`);
      logger.debug(`提示词长度: ${userPrompt.length}字符`);

      // 调用Chat Completion API
      const response = await client.chat.completions.create({
        model: actualModel,
        messages: messages,
        max_tokens: maxTokens,
        temperature: temperature
      });

      // 计算响应时间
      const responseTime = Date.now() - startTime;
      this.stats.successRequests++;
      this.stats.totalResponseTime += responseTime;
      this.stats.providerStats[provider].success++;

      // 提取响应内容
      const content = response.choices?.[0]?.message?.content || '';
      const tokensUsed = response.usage?.total_tokens || 0;
      this.stats.totalTokens += tokensUsed;

      logger.info(`${provider} API响应成功 - 耗时: ${responseTime}ms, Token: ${tokensUsed}`);

      return {
        success: true,
        content,
        tokensUsed,
        responseTime,
        model: response.model,
        provider: provider,
        finishReason: response.choices?.[0]?.finish_reason,
        rawResponse: response
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.stats.errorRequests++;
      this.stats.providerStats[provider].error++;

      // 处理错误
      let errorMessage = error.message;
      let errorType = 'ERROR';

      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        errorType = 'TIMEOUT';
        errorMessage = `请求超时 (${this.timeout}ms)`;
      } else if (error.status) {
        const status = error.status;
        if (status === 401) errorMessage = 'API Key无效或已过期';
        else if (status === 429) errorMessage = 'API请求频率超限';
        else if (status === 500) errorMessage = `${provider} API服务器错误`;
        else errorMessage = error.message || `API错误 (${status})`;
      }

      logger.error(`${provider} API请求失败 - ${errorType}: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
        errorType,
        provider: provider,
        responseTime,
        rawError: error
      };
    }
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      const result = await this.analyze(
        '请回复"OK"',
        '你是一个测试助手',
        { maxTokens: 10 }
      );
      return result.success;
    } catch (error) {
      logger.error('AI健康检查失败:', error);
      return false;
    }
  }

  /**
   * 获取使用统计
   */
  getUsageStats() {
    const avgResponseTime = this.stats.totalRequests > 0
      ? Math.round(this.stats.totalResponseTime / this.stats.totalRequests)
      : 0;

    const successRate = this.stats.totalRequests > 0
      ? Math.round((this.stats.successRequests / this.stats.totalRequests) * 100)
      : 0;

    return {
      provider: this.provider,
      fallbackCount: this.fallbackProviders.length,
      totalRequests: this.stats.totalRequests,
      successRequests: this.stats.successRequests,
      errorRequests: this.stats.errorRequests,
      successRate: `${successRate}%`,
      totalTokensUsed: this.stats.totalTokens,
      avgResponseTime: `${avgResponseTime}ms`,
      avgTokensPerRequest: this.stats.totalRequests > 0
        ? Math.round(this.stats.totalTokens / this.stats.totalRequests)
        : 0,
      providerStats: this.stats.providerStats
    };
  }

  /**
   * 重置统计
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      successRequests: 0,
      errorRequests: 0,
      totalTokens: 0,
      totalResponseTime: 0,
      providerStats: {}
    };
    logger.info('AI客户端统计已重置');
  }

  /**
   * 脱敏显示API Key
   */
  getMaskedApiKey() {
    return encryption.Encryption.mask(this.apiKey, 8, 8);
  }
}

module.exports = UnifiedAIClient;

