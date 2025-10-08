/**
 * OpenAI API客户端
 * 负责与OpenAI API的通信（ChatGPT）
 */

const logger = require('../../utils/logger');
const encryption = require('../../utils/encryption');

/**
 * OpenAI客户端类
 */
class OpenAIClient {
  constructor(config = {}) {
    this.apiKey = config.apiKey || '';
    this.baseURL = config.baseURL || 'https://api.openai.com/v1';
    this.model = config.model || 'gpt-4o-mini';
    this.maxTokens = config.maxTokens || 4000;
    this.temperature = config.temperature || 0.3;
    this.timeout = config.timeout || 60000; // 60秒超时
    
    // 统计信息
    this.stats = {
      totalRequests: 0,
      successRequests: 0,
      errorRequests: 0,
      totalTokens: 0,
      totalResponseTime: 0
    };
  }

  /**
   * 初始化客户端（从数据库加载配置）
   * @param {Object} dbConfig - 数据库配置对象
   */
  async initialize(dbConfig) {
    try {
      // 从配置中提取和解密API Key
      if (dbConfig.openai_api_key) {
        try {
          this.apiKey = encryption.decrypt(dbConfig.openai_api_key);
        } catch (error) {
          logger.error('解密OpenAI API Key失败:', error);
          this.apiKey = dbConfig.openai_api_key; // 如果解密失败，尝试直接使用
        }
      }

      // 设置其他配置
      this.baseURL = dbConfig.openai_base_url || this.baseURL;
      this.model = dbConfig.openai_model || this.model;
      this.maxTokens = parseInt(dbConfig.openai_max_tokens) || this.maxTokens;
      this.temperature = parseFloat(dbConfig.openai_temperature) || this.temperature;

      logger.info(`OpenAI客户端初始化成功 - 模型: ${this.model}, BaseURL: ${this.baseURL}`);
      return true;
    } catch (error) {
      logger.error('OpenAI客户端初始化失败:', error);
      return false;
    }
  }

  /**
   * 发送分析请求到OpenAI API
   * @param {string} userPrompt - 用户提示词
   * @param {string} systemPrompt - 系统提示词
   * @param {Object} options - 可选参数
   * @returns {Promise<Object>} - API响应结果
   */
  async analyze(userPrompt, systemPrompt = '', options = {}) {
    const startTime = Date.now();
    this.stats.totalRequests++;

    try {
      // 验证API Key
      if (!this.apiKey) {
        throw new Error('OpenAI API Key未配置');
      }

      // 动态导入OpenAI SDK
      const OpenAI = require('openai');
      const openai = new OpenAI({
        apiKey: this.apiKey,
        baseURL: this.baseURL,
        timeout: options.timeout || this.timeout
      });

      // 构建消息数组
      const messages = [];
      
      // 添加系统提示词
      if (systemPrompt) {
        messages.push({
          role: 'system',
          content: systemPrompt
        });
      }

      // 添加用户提示词
      messages.push({
        role: 'user',
        content: userPrompt
      });

      const model = options.model || this.model;
      const maxTokens = options.maxTokens || this.maxTokens;
      const temperature = options.temperature || this.temperature;

      logger.info(`发送OpenAI API请求 - 模型: ${model}`);
      logger.debug(`用户提示词长度: ${userPrompt.length}字符`);

      // 调用OpenAI Chat Completion API
      const response = await openai.chat.completions.create({
        model: model,
        messages: messages,
        max_tokens: maxTokens,
        temperature: temperature
      });

      // 计算响应时间
      const responseTime = Date.now() - startTime;
      this.stats.successRequests++;
      this.stats.totalResponseTime += responseTime;

      // 提取响应内容
      const content = response.choices?.[0]?.message?.content || '';
      const tokensUsed = response.usage?.total_tokens || 0;
      this.stats.totalTokens += tokensUsed;

      logger.info(`OpenAI API响应成功 - 耗时: ${responseTime}ms, Token: ${tokensUsed}`);

      return {
        success: true,
        content,
        tokensUsed,
        responseTime,
        model: response.model,
        finishReason: response.choices?.[0]?.finish_reason,
        rawResponse: response
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.stats.errorRequests++;

      // 处理不同类型的错误
      let errorMessage = error.message;
      let errorType = 'ERROR';

      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        errorType = 'TIMEOUT';
        errorMessage = `请求超时 (${this.timeout}ms)`;
      } else if (error.status) {
        // OpenAI SDK错误
        const status = error.status;
        
        if (status === 401) {
          errorMessage = 'API Key无效或已过期';
        } else if (status === 429) {
          errorMessage = 'API请求频率超限';
        } else if (status === 500) {
          errorMessage = 'OpenAI API服务器错误';
        } else {
          errorMessage = error.message || `API错误 (${status})`;
        }
      }

      logger.error(`OpenAI API请求失败 - ${errorType}: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
        errorType,
        responseTime,
        rawError: error
      };
    }
  }

  /**
   * 健康检查
   * @returns {Promise<boolean>}
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
      logger.error('OpenAI健康检查失败:', error);
      return false;
    }
  }

  /**
   * 获取使用统计
   * @returns {Object}
   */
  getUsageStats() {
    const avgResponseTime = this.stats.totalRequests > 0
      ? Math.round(this.stats.totalResponseTime / this.stats.totalRequests)
      : 0;

    const successRate = this.stats.totalRequests > 0
      ? Math.round((this.stats.successRequests / this.stats.totalRequests) * 100)
      : 0;

    return {
      totalRequests: this.stats.totalRequests,
      successRequests: this.stats.successRequests,
      errorRequests: this.stats.errorRequests,
      successRate: `${successRate}%`,
      totalTokensUsed: this.stats.totalTokens,
      avgResponseTime: `${avgResponseTime}ms`,
      avgTokensPerRequest: this.stats.totalRequests > 0
        ? Math.round(this.stats.totalTokens / this.stats.totalRequests)
        : 0
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
      totalResponseTime: 0
    };
    logger.info('OpenAI客户端统计已重置');
  }

  /**
   * 脱敏显示API Key（用于日志）
   * @returns {string}
   */
  getMaskedApiKey() {
    return encryption.Encryption.mask(this.apiKey, 8, 8);
  }
}

module.exports = OpenAIClient;

