/**
 * Claude API客户端
 * 负责与Claude API的通信
 */

const axios = require('axios');
const logger = require('../../utils/logger');
const encryption = require('../../utils/encryption');

/**
 * Claude客户端类
 */
class ClaudeClient {
  constructor(config = {}) {
    this.apiKey = config.apiKey || '';
    this.proxyUrl = config.proxyUrl || 'https://api.anthropic.com';
    this.model = config.model || 'claude-3-5-sonnet-20241022';
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
      if (dbConfig.claude_api_key) {
        try {
          this.apiKey = encryption.decrypt(dbConfig.claude_api_key);
        } catch (error) {
          logger.error('解密Claude API Key失败:', error);
          this.apiKey = dbConfig.claude_api_key; // 如果解密失败，尝试直接使用
        }
      }

      // 设置其他配置
      this.proxyUrl = dbConfig.claude_api_proxy || this.proxyUrl;
      this.model = dbConfig.claude_model || this.model;
      this.maxTokens = parseInt(dbConfig.claude_max_tokens) || this.maxTokens;
      this.temperature = parseFloat(dbConfig.claude_temperature) || this.temperature;

      logger.info(`Claude客户端初始化成功 - 模型: ${this.model}, Proxy: ${this.proxyUrl}`);
      return true;
    } catch (error) {
      logger.error('Claude客户端初始化失败:', error);
      return false;
    }
  }

  /**
   * 发送分析请求到Claude API
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
        throw new Error('Claude API Key未配置');
      }

      // 构建请求体
      const requestBody = {
        model: options.model || this.model,
        max_tokens: options.maxTokens || this.maxTokens,
        temperature: options.temperature || this.temperature,
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ]
      };

      // 如果有系统提示词，添加到消息开头
      if (systemPrompt) {
        requestBody.system = systemPrompt;
      }

      logger.info(`发送Claude API请求 - 模型: ${requestBody.model}`);
      logger.debug(`用户提示词长度: ${userPrompt.length}字符`);

      // 发送HTTP请求
      const response = await axios.post(
        `${this.proxyUrl}/v1/messages`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          },
          timeout: options.timeout || this.timeout
        }
      );

      // 计算响应时间
      const responseTime = Date.now() - startTime;
      this.stats.successRequests++;
      this.stats.totalResponseTime += responseTime;

      // 提取响应内容
      const content = response.data.content?.[0]?.text || '';
      const tokensUsed = response.data.usage?.input_tokens + response.data.usage?.output_tokens || 0;
      this.stats.totalTokens += tokensUsed;

      logger.info(`Claude API响应成功 - 耗时: ${responseTime}ms, Token: ${tokensUsed}`);

      return {
        success: true,
        content,
        tokensUsed,
        responseTime,
        model: response.data.model,
        stopReason: response.data.stop_reason,
        rawResponse: response.data
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
      } else if (error.response) {
        // API返回错误
        const status = error.response.status;
        const data = error.response.data;
        
        if (status === 401) {
          errorMessage = 'API Key无效或已过期';
        } else if (status === 429) {
          errorMessage = 'API请求频率超限';
        } else if (status === 500) {
          errorMessage = 'Claude API服务器错误';
        } else {
          errorMessage = data?.error?.message || `API错误 (${status})`;
        }
      }

      logger.error(`Claude API请求失败 - ${errorType}: ${errorMessage}`);

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
      logger.error('Claude健康检查失败:', error);
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
    logger.info('Claude客户端统计已重置');
  }

  /**
   * 脱敏显示API Key（用于日志）
   * @returns {string}
   */
  getMaskedApiKey() {
    return encryption.Encryption.mask(this.apiKey, 8, 8);
  }
}

module.exports = ClaudeClient;

