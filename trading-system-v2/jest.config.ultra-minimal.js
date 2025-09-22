module.exports = {
  // 测试环境
  testEnvironment: 'node',

  // 测试文件匹配模式 - 只测试一个文件
  testMatch: [
    '**/tests/api/api-routes.test.js'
  ],

  // 覆盖率配置 - 完全关闭
  collectCoverage: false,

  // 测试超时 - 极短
  testTimeout: 1000,

  // 模块路径映射 - 简化
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // 设置文件 - 简化
  setupFilesAfterEnv: ['<rootDir>/tests/setup-minimal.js'],

  // 清理模拟
  clearMocks: true,
  restoreMocks: true,

  // 详细输出 - 关闭
  verbose: false,

  // 单进程运行
  maxWorkers: 1,
  
  // 检测未关闭的句柄
  detectOpenHandles: false,
  forceExit: true,
  
  // 内存优化
  testEnvironmentOptions: {
    NODE_OPTIONS: '--max-old-space-size=30'
  }
};
