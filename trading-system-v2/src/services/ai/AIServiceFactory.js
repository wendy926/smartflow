/**
 * AI服务工厂类
 * 负责创建不同AI服务的实例
 */

const logger = require('../../utils/logger');
const ClaudeAIService = require('./ClaudeAIService');
const DeepSeekAIService = require('./DeepSeekAIService');

// AI提供商枚举
const AIProvider = {
  CLAUDE: 'claude',
  DEEPSEEK: 'deepseek',
  OPENAI: 'openai',
  GEMINI: 'gemini'
};

class AIServiceFactory {
  /**
   * 创建AI服务实例
   * @param {string} provider - AI提供商
   * @param {Object} config - 配置对象
   * @returns {IAIService} AI服务实例
   */
  static create(provider, config) {
    logger.info(`[AIServiceFactory] 创建 ${provider} AI服务`);

    switch (provider) {
      case AIProvider.CLAUDE:
        return new ClaudeAIService(config);
      case AIProvider.DEEPSEEK:
        return new DeepSeekAIService(config);
      case AIProvider.OPENAI:
        logger.warn(`[AIServiceFactory] OpenAI service not implemented yet, skipping...`);
        return null;
      case AIProvider.GEMINI:
        logger.warn(`[AIServiceFactory] Gemini service not implemented yet, skipping...`);
        return null;
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }

  /**
   * 获取支持的AI提供商
   * @returns {Array} 支持的AI提供商列表
   */
  static getSupportedProviders() {
    return Object.values(AIProvider);
  }
}

module.exports = {
  AIServiceFactory,
  AIProvider
};
