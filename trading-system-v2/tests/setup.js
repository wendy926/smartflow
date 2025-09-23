/**
 * Jest测试环境设置
 */

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.PORT = '8081';
process.env.DB_NAME = 'trading_system_test';
process.env.REDIS_DB = 1;

// 模拟外部依赖
jest.mock('mysql2/promise', () => ({
  createConnection: jest.fn(),
  createPool: jest.fn()
}));

jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    on: jest.fn()
  }))
}));

// 创建模拟的axios实例
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

// 全局测试工具函数
global.testUtils = {
  // 创建模拟K线数据
  createMockKlines: (count = 50, basePrice = 50000) => {
    const klines = [];
    let price = basePrice;

    for (let i = 0; i < count; i++) {
      const change = (Math.random() - 0.5) * 0.02; // ±1%变化
      price = price * (1 + change);

      const high = price * (1 + Math.random() * 0.01);
      const low = price * (1 - Math.random() * 0.01);
      const open = price * (1 + (Math.random() - 0.5) * 0.005);
      const close = price;
      const volume = Math.random() * 1000000;

      klines.push([
        Date.now() - (count - i) * 15 * 60 * 1000, // 时间戳
        open.toFixed(8),
        high.toFixed(8),
        low.toFixed(8),
        close.toFixed(8),
        volume.toFixed(8),
        Date.now() - (count - i) * 15 * 60 * 1000 + 900000, // 收盘时间
        volume.toFixed(8),
        10, // 交易次数
        volume.toFixed(8),
        volume.toFixed(8),
        '0' // 忽略
      ]);
    }

    return klines;
  },

  // 默认交易对列表
  defaultSymbols: ['BTCUSDT', 'ETHUSDT', 'ONDOUSDT', 'MKRUSDT', 'PENDLEUSDT', 'MPLUSDT', 'LINKUSDT', 'LDOUSDT'],

  // 创建模拟交易对数据
  createMockSymbol: (symbol = 'ETHUSDT') => ({
    id: 1,
    symbol,
    status: 'ACTIVE',
    funding_rate: 0.0001,
    last_price: symbol === 'BTCUSDT' ? 50000.00 :
      symbol === 'ETHUSDT' ? 3500.00 :
        symbol === 'ONDOUSDT' ? 0.25 :
          symbol === 'MKRUSDT' ? 2500.00 :
            symbol === 'PENDLEUSDT' ? 2.50 :
              symbol === 'MPLUSDT' ? 0.15 :
                symbol === 'LINKUSDT' ? 15.00 :
                  symbol === 'LDOUSDT' ? 3.50 : 100.00,
    volume_24h: 1000000.00,
    price_change_24h: 2.5,
    created_at: new Date(),
    updated_at: new Date()
  }),

  // 创建模拟策略判断数据
  createMockJudgment: (symbol = 'ETHUSDT', strategy = 'V3', timeframe = '4H') => ({
    id: 1,
    symbol_id: 1,
    strategy_name: strategy,
    timeframe,
    trend_direction: 'UP',
    entry_signal: 'BUY',
    confidence_score: 85.5,
    indicators_data: {
      ma20: 49500,
      ma50: 49000,
      ma200: 48000,
      adx: 25.5,
      bbw: 0.05,
      vwap: 49800,
      oi_change: 0.02,
      delta: 0.15
    },
    created_at: new Date()
  }),

  // 创建模拟模拟交易数据
  createMockTrade: (symbol = 'ETHUSDT', strategy = 'V3') => ({
    id: 1,
    symbol_id: 1,
    strategy_name: strategy,
    trade_type: 'LONG',
    entry_price: 50000.00,
    exit_price: null,
    quantity: 0.1,
    leverage: 10,
    margin_used: 500.00,
    stop_loss: 49000.00,
    take_profit: 52000.00,
    pnl: 0,
    pnl_percentage: 0,
    status: 'OPEN',
    entry_time: new Date(),
    exit_time: null,
    created_at: new Date()
  }),

  // 等待指定时间
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // 创建模拟WebSocket连接
  createMockWebSocket: () => ({
    on: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
    readyState: 1
  }),

  // 创建模拟HTTP响应
  createMockResponse: (data, status = 200) => ({
    data,
    status,
    statusText: 'OK',
    headers: {},
    config: {}
  })
};

// 导出函数供测试使用
module.exports = {
  createMockSymbol: global.testUtils.createMockSymbol,
  createMockJudgment: global.testUtils.createMockJudgment,
  createMockTrade: global.testUtils.createMockTrade,
  createMockKlines: global.testUtils.createMockKlines,
  createMockWebSocket: global.testUtils.createMockWebSocket,
  createMockResponse: global.testUtils.createMockResponse,
  sleep: global.testUtils.sleep,
  defaultSymbols: global.testUtils.defaultSymbols
};

// 控制台输出配置
global.console = {
  ...console,
  // 在测试中静默console.log
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// 清理函数
const cleanup = () => {
  // 清理所有定时器
  jest.clearAllTimers();

  // 清理所有模拟
  jest.clearAllMocks();

  // 强制垃圾回收
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

// 设置axios的默认返回值
const axios = require('axios');
axios.get.mockResolvedValue({
  data: global.testUtils.createMockKlines(50, 50000),
  status: 200,
  statusText: 'OK'
});
