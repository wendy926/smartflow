// Jest测试环境设置
const path = require('path');

// 设置测试超时时间
jest.setTimeout(30000);

// 全局测试工具函数
global.createMockDatabase = () => {
  return {
    runQuery: jest.fn(),
    run: jest.fn(),
    close: jest.fn()
  };
};

global.createMockKlineData = (count = 250, basePrice = 100) => {
  const data = [];
  for (let i = 0; i < count; i++) {
    const price = basePrice + i * 0.1;
    data.push([
      Date.now() - (count - i) * 4 * 60 * 60 * 1000, // open_time
      price, // open
      price + 1, // high
      price - 1, // low
      price + 0.5, // close
      1000, // volume
      Date.now() - (count - i) * 4 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000, // close_time
      1000 * price, // quote_volume
      100, // trades_count
      500, // taker_buy_volume
      500 * price, // taker_buy_quote_volume
      0 // ignore
    ]);
  }
  return data;
};

// 控制台输出控制
global.originalConsole = console;
beforeAll(() => {
  // 在测试期间减少控制台输出
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  // 恢复原始控制台
  console.log = global.originalConsole.log;
  console.warn = global.originalConsole.warn;
  console.error = global.originalConsole.error;
});
