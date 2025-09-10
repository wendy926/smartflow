#!/usr/bin/env node

// 轻量级内存优化脚本 - 直接优化现有服务

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'smartflow.db');

async function optimizeExistingService() {
  const db = new sqlite3.Database(dbPath);

  try {
    console.log('🔧 开始轻量级内存优化...');

    // 1. 清理过期的策略分析数据（保留最近7天）
    console.log('📊 清理过期的策略分析数据...');
    await new Promise((resolve, reject) => {
      db.run(`
        DELETE FROM strategy_analysis 
        WHERE timestamp < datetime('now', '-7 days')
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 2. 清理过期的模拟交易数据（保留最近30天）
    console.log('📊 清理过期的模拟交易数据...');
    await new Promise((resolve, reject) => {
      db.run(`
        DELETE FROM simulations 
        WHERE created_at < datetime('now', '-30 days')
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 3. 清理过期的告警历史（保留最近14天）
    console.log('📊 清理过期的告警历史...');
    await new Promise((resolve, reject) => {
      db.run(`
        DELETE FROM alert_history 
        WHERE timestamp < datetime('now', '-14 days')
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 4. 清理过期的验证结果（保留最近3天）
    console.log('📊 清理过期的验证结果...');
    await new Promise((resolve, reject) => {
      db.run(`
        DELETE FROM validation_results 
        WHERE timestamp < datetime('now', '-3 days')
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 5. 优化数据库（VACUUM）
    console.log('🗜️ 优化数据库...');
    await new Promise((resolve, reject) => {
      db.run('VACUUM', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 6. 获取优化后的数据库大小
    const dbSize = await new Promise((resolve, reject) => {
      require('fs').stat(dbPath, (err, stats) => {
        if (err) reject(err);
        else resolve(stats.size);
      });
    });

    console.log(`✅ 轻量级内存优化完成`);
    console.log(`📊 数据库大小: ${(dbSize / 1024 / 1024).toFixed(2)}MB`);

    // 7. 显示清理统计
    const stats = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          (SELECT COUNT(*) FROM strategy_analysis) as strategy_count,
          (SELECT COUNT(*) FROM simulations) as simulation_count,
          (SELECT COUNT(*) FROM alert_history) as alert_count,
          (SELECT COUNT(*) FROM validation_results) as validation_count
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows[0]);
      });
    });

    console.log('📊 清理后数据统计:');
    console.log(`  策略分析记录: ${stats.strategy_count}`);
    console.log(`  模拟交易记录: ${stats.simulation_count}`);
    console.log(`  告警历史记录: ${stats.alert_count}`);
    console.log(`  验证结果记录: ${stats.validation_count}`);

  } catch (error) {
    console.error('❌ 优化失败:', error);
  } finally {
    db.close();
  }
}

optimizeExistingService();
