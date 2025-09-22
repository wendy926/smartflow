module.exports = {
  // 测试环境
  testEnvironment: 'node',

  // 测试文件匹配模式
  testMatch: [
    '**/tests/api/**/*.test.js'  // 只运行API测试
  ],

  // 覆盖率配置 - 关闭以节省内存
  collectCoverage: false,

  // 测试超时 - 更短
  testTimeout: 3000,

  // 模块路径映射
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },

  // 设置文件
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // 清理模拟
  clearMocks: true,
  restoreMocks: true,

  // 详细输出 - 关闭
  verbose: false,

  // 单进程运行避免内存问题
  maxWorkers: 1,
  
  // 检测未关闭的句柄
  detectOpenHandles: true,
  forceExit: true,
  
  // 内存优化
  testEnvironmentOptions: {
    NODE_OPTIONS: '--max-old-space-size=256 --expose-gc'
  }
};
