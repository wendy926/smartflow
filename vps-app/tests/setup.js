// Jest setup file
const path = require('path');

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// 设置模块路径
process.env.NODE_PATH = path.join(__dirname, '..', 'src');

// 全局测试超时
jest.setTimeout(30000);

// 清理定时器
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

// 全局错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});