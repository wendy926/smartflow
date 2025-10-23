module.exports = {
  // 测试环境
  testEnvironment: 'node',

  // 测试文件匹配模式
  testMatch: [
    '**/tests/api/**/*.test.js'
  ],

  // 覆盖率配置 - 关闭以节省内存
  collectCoverage: false,

  // 测试超时 - 短超时避免死循环
  testTimeout: 2000,

  // 模块路径映射
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // 设置文件
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // 清理模拟
  clearMocks: true,
  restoreMocks: true,

  // 详细输出 - 关闭
  verbose: false,

  // 单进程运行 - 避免并发问题
  maxWorkers: 1,

  // 检测未关闭的句柄 - 关闭以节省资源
  detectOpenHandles: false,
  forceExit: true,

  // 内存优化
  testEnvironmentOptions: {
    NODE_OPTIONS: '--max-old-space-size=128'
  },

  // 全局设置
  globals: {
    'ts-jest': {
      useESM: true
    }
  }
};
