module.exports = {
  // 测试环境
  testEnvironment: 'node',

  // 测试文件匹配模式
  testMatch: [
    '**/tests/**/*.test.js'
  ],

  // 覆盖率收集配置
  collectCoverage: true,
  collectCoverageFrom: [
    'modules/**/*.js',
    'server.js',
    '!modules/**/*.test.js',
    '!**/node_modules/**',
    '!**/coverage/**'
  ],

  // 覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 40,
      functions: 40,
      lines: 40,
      statements: 40
    }
  },

  // 覆盖率报告器
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],

  // 测试超时时间
  testTimeout: 60000,

  // 设置文件
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // 模块路径映射
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },

  // 忽略模式
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/'
  ],

  // 详细输出
  verbose: true,

  // 清理模拟
  clearMocks: true,
  restoreMocks: true,

  // 错误处理
  errorOnDeprecated: true,

  // 并行执行
  maxWorkers: '50%'
};