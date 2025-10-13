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
    logger.info('开始数据清理（优化版：轻量级清理）');
    
    try {
      const Database = require('../database');
      const database = new Database();
      await database.connect();
      
      // 1. 清理large_order_detection_results（保留7天）
      const deleteOldLargeOrders = await database.query(`
        DELETE FROM large_order_detection_results
        WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
      `);
      logger.info(`清理large_order_detection_results: ${deleteOldLargeOrders.affectedRows || 0}条`);
      
      // 2. 清理ai_market_analysis（每个symbol只保留最近30条）
      await database.query(`
        DELETE FROM ai_market_analysis
        WHERE id NOT IN (
          SELECT id FROM (
            SELECT id FROM ai_market_analysis
            ORDER BY created_at DESC
            LIMIT 300
          ) tmp
        )
      `);
      logger.info(`清理ai_market_analysis: 保留最近300条`);
      
      // 3. 清理超过60天的已平仓交易记录
      const deleteOldTrades = await database.query(`
        DELETE FROM simulation_trades
        WHERE status = 'CLOSED'
        AND updated_at < DATE_SUB(NOW(), INTERVAL 60 DAY)
      `);
      logger.info(`清理60天前已平仓交易: ${deleteOldTrades.affectedRows || 0}条`);
      
      await database.disconnect();
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
