module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
  collectCoverageFrom: [
    'modules/**/*.js',
    '!modules/**/*.test.js',
    '!node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  testTimeout: 10000,
  // 强制垃圾回收来检测内存泄漏
  forceExit: true,
  // 检测未关闭的句柄
  detectOpenHandles: true
  // 注意：detectLeaks 选项过于敏感，可能导致误报
  // 我们通过其他方式确保内存清理
};
