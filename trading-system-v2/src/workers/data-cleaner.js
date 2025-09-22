/**
 * 数据清理工作进程
 * 负责清理过期数据和优化存储
 */

const logger = require('../utils/logger');
const config = require('../config');

class DataCleaner {
  constructor() {
    this.isRunning = false;
    this.cleanupInterval = 24 * 60 * 60 * 1000; // 24小时清理一次
  }

  async start() {
    if (this.isRunning) {
      logger.warn('数据清理进程已在运行');
      return;
    }

    this.isRunning = true;
    logger.info('数据清理进程启动');

    // 每天凌晨2点执行清理
    setInterval(async () => {
      try {
        await this.cleanupData();
      } catch (error) {
        logger.error(`数据清理失败: ${error.message}`);
      }
    }, this.cleanupInterval);

    // 立即执行一次清理
    await this.cleanupData();
  }

  async cleanupData() {
    logger.info('开始数据清理');
    
    try {
      // 这里可以添加具体的数据清理逻辑
      // 例如：删除超过60天的历史数据
      logger.info('数据清理完成');
    } catch (error) {
      logger.error(`数据清理失败: ${error.message}`);
    }
  }

  stop() {
    this.isRunning = false;
    logger.info('数据清理进程停止');
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const cleaner = new DataCleaner();
  cleaner.start();

  // 优雅关闭
  process.on('SIGINT', () => {
    logger.info('收到SIGINT信号，正在关闭数据清理进程...');
    cleaner.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('收到SIGTERM信号，正在关闭数据清理进程...');
    cleaner.stop();
    process.exit(0);
  });
}

module.exports = DataCleaner;
