#!/usr/bin/env node

/**
 * 简化的测试启动脚本
 * 用于验证配置和基本功能
 */

const SimpleConfigManager = require('./src/config/SimpleConfigManager');
const logger = require('./src/utils/logger');

async function testConfig() {
  try {
    logger.info('🧪 Testing configuration...');
    
    const configManager = new SimpleConfigManager();
    const config = configManager.getConfig();
    
    logger.info('✅ Configuration loaded successfully');
    logger.info(`Environment: ${config.environment}`);
    logger.info(`Region: ${config.region}`);
    logger.info(`Port: ${config.port}`);
    
    // 测试数据库配置
    const dbConfig = configManager.getDatabaseConfig();
    logger.info(`Database: ${dbConfig.mysql.host}:${dbConfig.mysql.port}/${dbConfig.mysql.database}`);
    
    // 测试AI配置
    const aiConfig = configManager.getAIConfig();
    logger.info(`AI Default Provider: ${aiConfig.defaultProvider}`);
    logger.info(`DeepSeek enabled: ${aiConfig.providers.deepseek.enabled}`);
    
    // 测试消息配置
    const messagingConfig = configManager.getMessagingConfig();
    logger.info(`Messaging Redis: ${messagingConfig.redis.host}:${messagingConfig.redis.port}`);
    
    logger.info('🎉 All configuration tests passed!');
    
  } catch (error) {
    logger.error('❌ Configuration test failed:', error);
    process.exit(1);
  }
}

// 运行测试
testConfig();
