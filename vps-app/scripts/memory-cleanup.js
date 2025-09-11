#!/usr/bin/env node

/**
 * 内存清理脚本
 * 清理不必要的缓存和临时数据
 */

const fs = require('fs');
const path = require('path');

console.log('🧹 开始内存清理...');

// 清理Node.js缓存
if (global.gc) {
  global.gc();
  console.log('✅ Node.js垃圾回收完成');
} else {
  console.log('⚠️ 垃圾回收不可用，请使用 --expose-gc 启动Node.js');
}

// 清理临时文件
const tempDirs = [
  '/tmp',
  '/var/tmp',
  '/home/admin/smartflow-vps-app/vps-app/temp'
];

tempDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    try {
      const files = fs.readdirSync(dir);
      let cleaned = 0;
      files.forEach(file => {
        const filePath = path.join(dir, file);
        try {
          const stats = fs.statSync(filePath);
          // 删除超过1小时的文件
          if (Date.now() - stats.mtime.getTime() > 3600000) {
            fs.unlinkSync(filePath);
            cleaned++;
          }
        } catch (err) {
          // 忽略删除失败的文件
        }
      });
      console.log(`✅ 清理 ${dir}: 删除了 ${cleaned} 个文件`);
    } catch (err) {
      console.log(`⚠️ 无法清理 ${dir}: ${err.message}`);
    }
  }
});

// 显示内存使用情况
const memUsage = process.memoryUsage();
console.log('📊 当前内存使用:');
console.log(`  RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB`);
console.log(`  Heap Used: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
console.log(`  Heap Total: ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`);
console.log(`  External: ${Math.round(memUsage.external / 1024 / 1024)}MB`);

console.log('✅ 内存清理完成');
