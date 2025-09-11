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
  detectOpenHandles: true,
  // 检测内存泄漏
  detectLeaks: true
};
