#!/usr/bin/env node

/**
 * SmartFlow 应用启动脚本
 * 适配新的项目结构
 */

const path = require('path');
const { spawn } = require('child_process');

// 设置工作目录为项目根目录
process.chdir(__dirname);

// 启动主服务器
const serverPath = path.join(__dirname, 'src', 'core', 'server.js');

console.log('🚀 启动 SmartFlow 应用...');
console.log(`📁 工作目录: ${__dirname}`);
console.log(`📄 服务器文件: ${serverPath}`);

const server = spawn('node', [serverPath], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'production'
  }
});

server.on('error', (err) => {
  console.error('❌ 服务器启动失败:', err);
  process.exit(1);
});

server.on('exit', (code) => {
  console.log(`📊 服务器退出，代码: ${code}`);
  process.exit(code);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n🛑 收到关闭信号，正在优雅关闭服务器...');
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 收到终止信号，正在优雅关闭服务器...');
  server.kill('SIGTERM');
});
