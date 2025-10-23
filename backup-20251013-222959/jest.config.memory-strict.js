module.exports = {
  // 测试环境
  testEnvironment: 'node',

  // 测试文件匹配模式 - 测试所有文件
  testMatch: [
    '**/tests/**/*.test.js'
  ],

  // 覆盖率配置 - 完全关闭
  collectCoverage: false,

  // 测试超时 - 极短
  testTimeout: 1000,

  // 模块路径映射
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // 设置文件
  setupFilesAfterEnv: ['<rootDir>/tests/setup-memory-strict.js'],

  // 清理模拟 - 更严格
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,

  // 详细输出 - 关闭
  verbose: false,

  // 单进程运行
  maxWorkers: 1,

  // 检测未关闭的句柄 - 关闭
  detectOpenHandles: false,
  forceExit: true,

  // 内存优化 - 极严格
  testEnvironmentOptions: {
    NODE_OPTIONS: '--max-old-space-size=64 --expose-gc'
  },

  // 全局设置
  globals: {
    'ts-jest': {
      useESM: true
    }
  }
};
