#!/usr/bin/env node

/**
 * 内存监控脚本
 * 用于监控Node.js进程的内存使用情况
 */

const { exec } = require('child_process');
const fs = require('fs');

class MemoryMonitor {
  constructor() {
    this.startTime = Date.now();
    this.monitoring = false;
    this.interval = null;
  }

  start(intervalMs = 5000) {
    console.log('🔍 开始内存监控...');
    this.monitoring = true;
    this.interval = setInterval(() => {
      this.checkMemory();
    }, intervalMs);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.monitoring = false;
    console.log('⏹️ 停止内存监控');
  }

  checkMemory() {
    const usage = process.memoryUsage();
    const uptime = Date.now() - this.startTime;
    
    console.log(`\n📊 内存使用情况 (运行时间: ${Math.round(uptime / 1000)}s)`);
    console.log(`  RSS: ${Math.round(usage.rss / 1024 / 1024)}MB`);
    console.log(`  Heap Used: ${Math.round(usage.heapUsed / 1024 / 1024)}MB`);
    console.log(`  Heap Total: ${Math.round(usage.heapTotal / 1024 / 1024)}MB`);
    console.log(`  External: ${Math.round(usage.external / 1024 / 1024)}MB`);
    
    // 检查内存泄漏
    if (usage.heapUsed > 200 * 1024 * 1024) { // 200MB
      console.log('⚠️ 警告: 堆内存使用超过200MB');
    }
    
    if (usage.rss > 500 * 1024 * 1024) { // 500MB
      console.log('⚠️ 警告: RSS内存使用超过500MB');
    }
  }

  // 强制垃圾回收
  forceGC() {
    if (global.gc) {
      global.gc();
      console.log('🗑️ 执行垃圾回收');
    } else {
      console.log('⚠️ 垃圾回收不可用，请使用 --expose-gc 启动');
    }
  }

  // 获取系统内存信息
  getSystemMemory() {
    return new Promise((resolve, reject) => {
      exec('free -m', (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        console.log('\n💻 系统内存信息:');
        console.log(stdout);
        resolve(stdout);
      });
    });
  }

  // 获取进程信息
  getProcessInfo() {
    return new Promise((resolve, reject) => {
      exec('ps aux | grep node | grep -v grep', (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        console.log('\n🔄 Node.js进程信息:');
        console.log(stdout);
        resolve(stdout);
      });
    });
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const monitor = new MemoryMonitor();
  
  // 启动监控
  monitor.start(3000); // 每3秒检查一次
  
  // 处理退出信号
  process.on('SIGINT', () => {
    console.log('\n🛑 收到退出信号');
    monitor.stop();
    process.exit(0);
  });
  
  // 定期显示系统信息
  setInterval(() => {
    monitor.getSystemMemory().catch(console.error);
    monitor.getProcessInfo().catch(console.error);
  }, 30000); // 每30秒显示一次系统信息
}

module.exports = MemoryMonitor;
