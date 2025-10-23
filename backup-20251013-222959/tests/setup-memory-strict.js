/**
 * 严格内存管理的Jest设置
 * 专门用于避免内存泄漏
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

// 模拟外部依赖 - 简化版本
jest.mock('mysql2/promise', () => ({
  createConnection: jest.fn(() => ({
    execute: jest.fn().mockResolvedValue([[], {}]),
    ping: jest.fn().mockResolvedValue(),
    release: jest.fn()
  })),
  createPool: jest.fn(() => ({
    getConnection: jest.fn().mockResolvedValue({
      execute: jest.fn().mockResolvedValue([[], {}]),
      ping: jest.fn().mockResolvedValue(),
      release: jest.fn()
    }),
    end: jest.fn().mockResolvedValue()
  }))
}));

jest.mock('ioredis', () => {
  const MockRedis = jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(),
    disconnect: jest.fn().mockResolvedValue(),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    on: jest.fn(),
    quit: jest.fn().mockResolvedValue('OK'),
    status: 'ready'
  }));
  return MockRedis;
});

// 简化的axios mock
const mockAxios = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  create: jest.fn(() => mockAxios)
};

jest.mock('axios', () => mockAxios);

jest.mock('ws', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
    readyState: 1
  }));
});

// 简化的测试工具函数
global.testUtils = {
  // 创建模拟K线数据 - 简化版本
  createMockKlines: (count = 10, basePrice = 50000) => {
    const klines = [];
    let price = basePrice;

    for (let i = 0; i < count; i++) {
      const change = (Math.random() - 0.5) * 0.01; // 减少变化幅度
      price = price * (1 + change);

      const high = price * 1.005;
      const low = price * 0.995;
      const open = price * 1.002;
      const close = price;
      const volume = 1000000;

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

  // 创建模拟交易对数据 - 简化版本
  createMockSymbol: (symbol = 'ETHUSDT') => ({
    id: 1,
    symbol,
    status: 'ACTIVE',
    funding_rate: 0.0001,
    last_price: 50000.00,
    volume_24h: 1000000.00,
    price_change_24h: 2.5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }),

  // 创建模拟策略判断数据 - 简化版本
  createMockJudgment: (symbol = 'ETHUSDT', strategy = 'V3', timeframe = '4H') => ({
    id: 1,
    symbol,
    strategy,
    timeframe,
    signal: 'BUY',
    score: 85,
    trend: 'UP',
    confidence: 0.8,
    reasons: 'Test reason',
    indicators_data: {},
    created_at: new Date().toISOString()
  }),

  // 创建模拟交易数据 - 简化版本
  createMockTrade: (symbol = 'ETHUSDT', strategy = 'V3') => ({
    id: 1,
    symbol,
    strategy,
    side: 'LONG',
    entry_price: 50000.00,
    exit_price: null,
    quantity: 0.1,
    leverage: 10,
    stop_loss: 49000.00,
    take_profit: 52000.00,
    pnl: 0,
    pnl_percentage: 0,
    status: 'OPEN',
    entry_time: new Date().toISOString(),
    exit_time: null,
    created_at: new Date().toISOString()
  })
};

// 控制台输出配置 - 完全静默
global.console = {
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// 严格的内存清理函数
const strictCleanup = () => {
  // 清理所有定时器
  jest.clearAllTimers();

  // 清理所有模拟
  jest.clearAllMocks();
  jest.resetAllMocks();

  // 清理全局对象
  if (global.testUtils) {
    // 清理可能的大对象
    Object.keys(global.testUtils).forEach(key => {
      if (typeof global.testUtils[key] === 'function') {
        // 保持函数，但清理可能的缓存
      }
    });
  }

  // 强制垃圾回收
  if (global.gc) {
    global.gc();
  }

  // 等待一小段时间让GC完成
  return new Promise(resolve => setTimeout(resolve, 10));
};

// 在每个测试前清理
beforeEach(async () => {
  await strictCleanup();
});

// 在每个测试后清理
afterEach(async () => {
  await strictCleanup();
});

// 在所有测试后清理
afterAll(async () => {
  await strictCleanup();
});

// 设置axios的默认返回值 - 延迟设置避免模块加载时创建数据
setTimeout(() => {
  const axios = require('axios');
  axios.get.mockResolvedValue({
    data: global.testUtils.createMockKlines(10, 50000), // 减少数据量
    status: 200,
    statusText: 'OK'
  });
}, 100);
