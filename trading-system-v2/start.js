#!/usr/bin/env node

/**
 * 通用交易系统启动脚本
 * 支持多环境、多区域部署
 */

const Application = require('./src/Application');
const logger = require('./src/utils/logger');

// 设置环境变量
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.REGION = process.env.REGION || 'SG';

async function main() {
  try {
    logger.info('🚀 Starting Universal Trading System...');
    logger.info(`Environment: ${process.env.NODE_ENV}`);
    logger.info(`Region: ${process.env.REGION}`);
    
    const app = new Application();
    await app.start();
    
    logger.info('✅ Universal Trading System is running!');
    
    // 保持进程运行
    process.stdin.resume();
    
  } catch (error) {
    logger.error('❌ Failed to start Universal Trading System:', error);
    process.exit(1);
  }
}

// 启动应用程序
main();
