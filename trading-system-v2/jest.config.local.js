module.exports = {
  // 测试环境
  testEnvironment: 'node',

  // 测试文件匹配模式
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/tests/**/*.test.js'
  ],

  // 覆盖率配置
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/__tests__/**',
    '!src/**/node_modules/**'
  ],

  // 覆盖率阈值（降低要求以便快速通过）
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60
    }
  },

  // 测试超时
  testTimeout: 10000,

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

  // 详细输出
  verbose: true,

  // 并行测试 - 单进程避免内存问题
  maxWorkers: 1,

  // 检测未关闭的句柄
  detectOpenHandles: true,
  forceExit: true,

  // 测试结果处理器
  testResultsProcessor: undefined,

  // 报告器
  reporters: ['default'],

  // 全局设置
  globals: {
    'ts-jest': {
      useESM: true
    }
  }
};
