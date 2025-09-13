#!/usr/bin/env node
// optimize-memory.js - 内存优化脚本

const { exec } = require('child_process');
const fs = require('fs');

class MemoryOptimizer {
  constructor() {
    this.logFile = '/tmp/memory-optimizer.log';
  }

  async optimize() {
    console.log('🚀 开始内存优化...');

    try {
      // 1. 清理系统缓存
      await this.clearSystemCache();

      // 2. 清理临时文件
      await this.clearTempFiles();

      // 3. 重启服务
      await this.restartServices();

      // 4. 监控内存使用
      await this.monitorMemory();

      console.log('✅ 内存优化完成');
    } catch (error) {
      console.error('❌ 内存优化失败:', error);
    }
  }

  async clearSystemCache() {
    console.log('🧹 清理系统缓存...');

    return new Promise((resolve, reject) => {
      exec('sync && echo 3 > /proc/sys/vm/drop_caches', (error, stdout, stderr) => {
        if (error) {
          console.warn('⚠️ 清理系统缓存失败:', error.message);
        } else {
          console.log('✅ 系统缓存已清理');
        }
        resolve();
      });
    });
  }

  async clearTempFiles() {
    console.log('🗑️ 清理临时文件...');

    const tempDirs = [
      '/tmp',
      '/var/tmp',
      '/home/admin/smartflow-vps-app/vps-app/temp'
    ];

    for (const dir of tempDirs) {
      try {
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir);
          let cleaned = 0;

          for (const file of files) {
            const filePath = `${dir}/${file}`;
            const stats = fs.statSync(filePath);

            // 删除超过1小时的文件
            if (Date.now() - stats.mtime.getTime() > 3600000) {
              fs.unlinkSync(filePath);
              cleaned++;
            }
          }

          console.log(`✅ 清理 ${dir}: 删除 ${cleaned} 个文件`);
        }
      } catch (error) {
        console.warn(`⚠️ 清理 ${dir} 失败:`, error.message);
      }
    }
  }

  async restartServices() {
    console.log('🔄 重启服务...');

    return new Promise((resolve, reject) => {
      exec('pm2 restart smartflow-app', (error, stdout, stderr) => {
        if (error) {
          console.error('❌ 重启服务失败:', error.message);
          reject(error);
        } else {
          console.log('✅ 服务已重启');
          console.log(stdout);
          resolve();
        }
      });
    });
  }

  async monitorMemory() {
    console.log('📊 监控内存使用...');

    return new Promise((resolve) => {
      setTimeout(() => {
        exec('free -h', (error, stdout, stderr) => {
          if (!error) {
            console.log('📈 当前内存状态:');
            console.log(stdout);
          }
          resolve();
        });
      }, 5000); // 等待5秒后检查
    });
  }

  async getMemoryStats() {
    return new Promise((resolve) => {
      exec('free -h && echo "---" && pm2 status', (error, stdout, stderr) => {
        if (error) {
          console.error('获取内存状态失败:', error.message);
          resolve(null);
        } else {
          console.log('📊 系统状态:');
          console.log(stdout);
          resolve(stdout);
        }
      });
    });
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const optimizer = new MemoryOptimizer();

  // 显示当前状态
  optimizer.getMemoryStats().then(() => {
    // 执行优化
    return optimizer.optimize();
  }).then(() => {
    console.log('🎉 内存优化完成');
    process.exit(0);
  }).catch((error) => {
    console.error('💥 内存优化失败:', error);
    process.exit(1);
  });
}

module.exports = MemoryOptimizer;
