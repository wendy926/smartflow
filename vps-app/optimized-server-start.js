#!/usr/bin/env node

/**
 * 优化的服务器启动脚本
 * 分阶段启动，避免资源峰值
 */

const { spawn } = require('child_process');
const path = require('path');

async function startOptimizedServer() {
  console.log('🚀 启动优化版 SmartFlow 服务器...');

  // 设置优化的环境变量
  const env = {
    ...process.env,
    // 内存限制
    NODE_OPTIONS: '--max-old-space-size=512 --max-semi-space-size=64',
    // 端口
    PORT: '8080',
    // 启动优化参数
    WARMUP_SYMBOL_LIMIT: '0',           // 禁用启动时缓存预热
    CONSISTENCY_INTERVAL_MS: '600000',   // 一致性检查改为10分钟
    AUTOSAVE_INTERVAL_MS: '120000',      // 自动保存改为2分钟
    CONSISTENCY_ENABLE: '0',             // 启动阶段禁用一致性检查
    // Delta功能保留
    DELTA_ENABLE: '1',
    // 其他优化
    CACHE_WARMUP_DELAY: '30000',         // 延迟30秒后才开始缓存预热
    HEAVY_MODULES_DELAY: '60000'         // 延迟60秒后才加载重型模块
  };

  const serverPath = path.join(__dirname, 'src/core/server.js');

  const server = spawn('node', [serverPath], {
    stdio: 'inherit',
    env
  });

  server.on('error', (err) => {
    console.error('❌ 服务器启动失败:', err);
    process.exit(1);
  });

  server.on('exit', (code, signal) => {
    if (signal) {
      console.log(`📊 服务器被信号终止: ${signal}`);
    } else {
      console.log(`📊 服务器退出，代码: ${code}`);
    }
    process.exit(code);
  });

  // 优雅关闭处理
  const gracefulShutdown = (signal) => {
    console.log(`\n🛑 收到${signal}信号，正在优雅关闭服务器...`);
    if (!server.killed) {
      server.kill(signal);
    }
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2'));
}

startOptimizedServer();
