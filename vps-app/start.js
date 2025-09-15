#!/usr/bin/env node

/**
 * SmartFlow 应用启动脚本
 * 适配新的项目结构，包含资源优化和错误处理
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// 设置工作目录为项目根目录
process.chdir(__dirname);

// 启动主服务器
const serverPath = path.join(__dirname, 'src', 'core', 'server.js');

console.log('🚀 启动 SmartFlow 应用...');
console.log(`📁 工作目录: ${__dirname}`);
console.log(`📄 服务器文件: ${serverPath}`);

// 检查服务器文件是否存在
if (!fs.existsSync(serverPath)) {
  console.error('❌ 服务器文件不存在:', serverPath);
  process.exit(1);
}

// 检查静态文件目录
const staticPath = path.join(__dirname, 'src', 'web', 'public');
if (!fs.existsSync(staticPath)) {
  console.error('❌ 静态文件目录不存在:', staticPath);
  process.exit(1);
}

// 检查数据库文件
const dbPath = path.join(__dirname, 'smartflow.db');
if (!fs.existsSync(dbPath)) {
  console.warn('⚠️ 数据库文件不存在，将在启动时创建:', dbPath);
}

console.log('✅ 文件检查完成');

// 设置资源限制
process.setMaxListeners(20); // 增加最大监听器数量

// 启动主服务器
const server = spawn('node', [serverPath], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'production',
    // 设置Node.js内存限制
    NODE_OPTIONS: '--max-old-space-size=512 --max-semi-space-size=64',
    // 设置端口
    PORT: process.env.PORT || 8080
  }
});

// 服务器进程事件处理
server.on('error', (err) => {
  console.error('❌ 服务器启动失败:', err);
  console.error('错误详情:', err.message);
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

server.on('close', (code, signal) => {
  console.log(`📊 服务器进程关闭，代码: ${code}, 信号: ${signal}`);
});

// 健康检查
let healthCheckInterval;
const startHealthCheck = () => {
  healthCheckInterval = setInterval(() => {
    // 简单的健康检查：检查服务器进程是否还在运行
    if (server.killed) {
      console.log('❌ 服务器进程已终止');
      clearInterval(healthCheckInterval);
      process.exit(1);
    }
  }, 30000); // 每30秒检查一次
};

// 延迟启动健康检查
setTimeout(startHealthCheck, 10000);

// 优雅关闭处理
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 收到${signal}信号，正在优雅关闭服务器...`);

  // 停止健康检查
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }

  // 发送关闭信号给子进程
  if (!server.killed) {
    server.kill(signal);

    // 等待子进程退出，最多等待10秒
    const timeout = setTimeout(() => {
      console.log('⏰ 强制终止服务器进程');
      server.kill('SIGKILL');
      process.exit(1);
    }, 10000);

    server.on('exit', () => {
      clearTimeout(timeout);
      console.log('✅ 服务器已优雅关闭');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

// 监听退出信号
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // PM2重启信号

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的Promise拒绝:', reason);
  console.error('Promise:', promise);
});

console.log('✅ 启动脚本初始化完成');
