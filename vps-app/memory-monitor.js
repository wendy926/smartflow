#!/usr/bin/env node
// memory-monitor.js - 内存监控脚本

const os = require('os');
const fs = require('fs');

class MemoryMonitor {
  constructor() {
    this.logFile = '/tmp/memory-monitor.log';
    this.threshold = 0.8; // 80%内存使用率阈值
    this.checkInterval = 30000; // 30秒检查一次
    this.timer = null;
  }

  start() {
    console.log('🔍 启动内存监控...');
    this.timer = setInterval(() => {
      this.checkMemoryUsage();
    }, this.checkInterval);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log('🛑 内存监控已停止');
  }

  checkMemoryUsage() {
    const memInfo = this.getMemoryInfo();
    const usagePercent = memInfo.used / memInfo.total;

    const logEntry = {
      timestamp: new Date().toISOString(),
      total: memInfo.total,
      used: memInfo.used,
      free: memInfo.free,
      usagePercent: Math.round(usagePercent * 100),
      processMemory: process.memoryUsage()
    };

    // 记录到日志文件
    this.logToFile(logEntry);

    // 检查是否超过阈值
    if (usagePercent > this.threshold) {
      console.warn(`⚠️ 内存使用率过高: ${Math.round(usagePercent * 100)}%`);
      this.handleHighMemoryUsage(logEntry);
    } else {
      console.log(`💾 内存使用率: ${Math.round(usagePercent * 100)}%`);
    }
  }

  getMemoryInfo() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;

    return {
      total: Math.round(total / 1024 / 1024), // MB
      used: Math.round(used / 1024 / 1024),   // MB
      free: Math.round(free / 1024 / 1024)    // MB
    };
  }

  logToFile(entry) {
    const logLine = JSON.stringify(entry) + '\n';
    fs.appendFileSync(this.logFile, logLine);
  }

  handleHighMemoryUsage(entry) {
    console.error('🚨 内存使用率过高，建议重启服务');

    // 可以在这里添加自动重启逻辑
    // 例如：发送信号给PM2重启服务
    // require('child_process').exec('pm2 restart smartflow-app');
  }

  getMemoryStats() {
    const memInfo = this.getMemoryInfo();
    const processMem = process.memoryUsage();

    return {
      system: memInfo,
      process: {
        rss: Math.round(processMem.rss / 1024 / 1024), // MB
        heapTotal: Math.round(processMem.heapTotal / 1024 / 1024), // MB
        heapUsed: Math.round(processMem.heapUsed / 1024 / 1024), // MB
        external: Math.round(processMem.external / 1024 / 1024) // MB
      }
    };
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const monitor = new MemoryMonitor();

  // 处理退出信号
  process.on('SIGINT', () => {
    console.log('\n🛑 收到退出信号，停止内存监控...');
    monitor.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 收到终止信号，停止内存监控...');
    monitor.stop();
    process.exit(0);
  });

  // 启动监控
  monitor.start();

  // 显示当前内存状态
  console.log('📊 当前内存状态:', monitor.getMemoryStats());
}

module.exports = MemoryMonitor;