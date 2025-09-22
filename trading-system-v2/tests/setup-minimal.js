// 极简Jest设置文件
// 最小化内存使用

// 模拟console避免输出
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// 清理函数
const cleanup = () => {
  jest.clearAllTimers();
  jest.clearAllMocks();
  if (global.gc) {
    global.gc();
  }
};

// 在每个测试后清理
afterEach(() => {
  cleanup();
});

// 在所有测试后清理
afterAll(() => {
  cleanup();
});
