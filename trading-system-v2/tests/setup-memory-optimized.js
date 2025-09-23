/**
 * 内存优化的Jest测试环境设置
 */

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.PORT = '8081';
process.env.DB_NAME = 'trading_system_test';
process.env.REDIS_DB = 1;

// 启用垃圾回收
if (global.gc) {
  global.gc();
}

// 模拟外部依赖 - 轻量级版本
jest.mock('mysql2/promise', () => ({
  createConnection: jest.fn(() => ({
    query: jest.fn().mockResolvedValue([]),
    end: jest.fn()
  })),
  createPool: jest.fn(() => ({
    query: jest.fn().mockResolvedValue([]),
    end: jest.fn()
  }))
}));

jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    on: jest.fn()
  }))
}));

// 轻量级axios模拟
const mockAxios = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  create: jest.fn(() => mockAxios)
};

jest.mock('axios', () => mockAxios);

// 导入axios用于测试
const axios = require('axios');

jest.mock('ws', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
    readyState: 1
  }));
});

// 轻量级测试工具函数
const testUtils = {
  // 创建小型模拟K线数据
  createMockKlines: (count = 20, basePrice = 50000) => {
    const klines = [];
    let price = basePrice;

    for (let i = 0; i < count; i++) {
      const change = (Math.random() - 0.5) * 0.01; // ±0.5%变化
      price = price * (1 + change);

      const high = price * 1.001;
      const low = price * 0.999;
      const open = price;
      const close = price;
      const volume = 1000;

      klines.push([
        Date.now() - (count - i) * 15 * 60 * 1000,
        open.toFixed(8),
        high.toFixed(8),
        low.toFixed(8),
        close.toFixed(8),
        volume.toFixed(8),
        Date.now() - (count - i) * 15 * 60 * 1000 + 900000,
        volume.toFixed(8),
        10,
        volume.toFixed(8),
        volume.toFixed(8),
        '0'
      ]);
    }

    return klines;
  },

  // 默认交易对列表
  defaultSymbols: ['BTCUSDT', 'ETHUSDT', 'ONDOUSDT', 'MKRUSDT', 'PENDLEUSDT', 'MPLUSDT', 'LINKUSDT', 'LDOUSDT'],

  // 创建轻量级模拟交易对数据
  createMockSymbol: (symbol = 'ETHUSDT') => ({
    id: 1,
    symbol,
    status: 'ACTIVE',
    funding_rate: 0.0001,
    last_price: 50000.00,
    volume_24h: 1000000.00,
    price_change_24h: 2.5,
    created_at: new Date(),
    updated_at: new Date()
  }),

  // 等待指定时间
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};

// 设置全局测试工具
global.testUtils = testUtils;

// 静默控制台输出
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// 内存清理函数
const cleanup = () => {
  // 清理所有定时器
  jest.clearAllTimers();

  // 清理所有模拟
  jest.clearAllMocks();

  // 清理全局变量
  if (global.testUtils) {
    delete global.testUtils;
  }

  // 强制垃圾回收
  if (global.gc) {
    global.gc();
  }

  // 清理模块缓存中的大对象
  const modulesToClean = [
    'mysql2/promise',
    'redis',
    'axios',
    'ws'
  ];

  modulesToClean.forEach(moduleName => {
    const modulePath = require.resolve(moduleName);
    if (require.cache[modulePath]) {
      delete require.cache[modulePath];
    }
  });
};

// 在每个测试前清理
beforeEach(() => {
  cleanup();
});

// 在每个测试后清理
afterEach(() => {
  cleanup();
});

// 在所有测试后清理
afterAll(() => {
  cleanup();
});

// 设置axios的默认返回值
jest.mocked(axios.get).mockResolvedValue({
  data: testUtils.createMockKlines(20, 50000),
  status: 200,
  statusText: 'OK'
});

// 导出函数供测试使用
module.exports = {
  createMockSymbol: testUtils.createMockSymbol,
  createMockKlines: testUtils.createMockKlines,
  sleep: testUtils.sleep,
  defaultSymbols: testUtils.defaultSymbols
};
