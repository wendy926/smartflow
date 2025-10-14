/**
 * 四阶段聪明钱检测单元测试
 * 基于smartmoney.md文档的测试用例
 * 
 * 测试覆盖：
 * 1. 四阶段状态机逻辑
 * 2. 技术指标计算
 * 3. 阶段转换规则
 * 4. 参数配置
 * 5. API接口
 */

const { FourPhaseSmartMoneyDetector, SmartMoneyStage } = require('../src/services/smart-money/four-phase-detector');
const { SmartMoneyAdapter } = require('../src/services/smart-money/smart-money-adapter');

// Mock数据库
const mockDatabase = {
  pool: {
    query: jest.fn()
  }
};

// Mock Binance API
const mockBinanceAPI = {
  getKlines: jest.fn(),
  getTicker: jest.fn(),
  getDepth: jest.fn(),
  getOpenInterest: jest.fn()
};

// Mock大额挂单检测器
const mockLargeOrderDetector = {
  getDetectionResults: jest.fn()
};

describe('FourPhaseSmartMoneyDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new FourPhaseSmartMoneyDetector(mockDatabase, mockBinanceAPI, mockLargeOrderDetector);
    
    // 重置所有mock
    jest.clearAllMocks();
    
    // 设置默认mock返回值
    mockDatabase.pool.query.mockResolvedValue([[]]);
    mockBinanceAPI.getKlines.mockResolvedValue(generateMockKlines());
    mockBinanceAPI.getTicker.mockResolvedValue(generateMockTicker());
    mockBinanceAPI.getDepth.mockResolvedValue(generateMockDepth());
    mockBinanceAPI.getOpenInterest.mockResolvedValue(1000000);
  });

  describe('初始化测试', () => {
    test('应该正确初始化检测器', () => {
      expect(detector).toBeDefined();
      expect(detector.params).toBeDefined();
      expect(detector.stateMap).toBeInstanceOf(Map);
      expect(detector.dataCache).toBeInstanceOf(Map);
    });

    test('应该加载默认参数配置', () => {
      expect(detector.params.cvdWindowMs).toBe(4 * 60 * 60 * 1000);
      expect(detector.params.obiZPos).toBe(0.8);
      expect(detector.params.minStageLockMins).toBe(180);
    });

    test('应该正确初始化状态映射', () => {
      expect(detector.actionMapping[SmartMoneyStage.ACCUMULATION]).toBe('吸筹');
      expect(detector.actionMapping[SmartMoneyStage.MARKUP]).toBe('拉升');
      expect(detector.actionMapping[SmartMoneyStage.DISTRIBUTION]).toBe('派发');
      expect(detector.actionMapping[SmartMoneyStage.MARKDOWN]).toBe('砸盘');
    });
  });

  describe('技术指标计算测试', () => {
    test('应该正确计算ATR', () => {
      const klines = [
        [0, 100, 105, 95, 100, 1000],
        [0, 100, 110, 98, 105, 1200],
        [0, 105, 108, 102, 107, 1100]
      ];
      
      const atr = detector.calculateATR(klines, 2);
      expect(atr).toBeGreaterThan(0);
      expect(typeof atr).toBe('number');
    });

    test('应该正确计算OBI', () => {
      const orderBook = {
        bids: [['100', '1000'], ['99.9', '800']],
        asks: [['100.1', '600'], ['100.2', '400']]
      };
      
      const obi = detector.computeOBI(2);
      expect(typeof obi).toBe('number');
    });
  });

  describe('阶段评估测试', () => {
    test('吸筹阶段评估', () => {
      const indicators = {
        obiZ: 1.0, // 高于阈值0.8
        cvdZ: 0.6, // 高于阈值0.5
        volRatio: 1.3, // 高于阈值1.2
        priceDropPct: 0.01
      };
      
      const largeOrders = [
        { side: 'bid', impactRatio: 0.25 }
      ];
      
      const scores = detector.evaluateStageScores(indicators, largeOrders);
      
      expect(scores.accScore).toBeGreaterThanOrEqual(3); // 应该满足吸筹条件
      expect(scores.reasons).toContain('OBI正偏');
      expect(scores.reasons).toContain('CVD上升');
      expect(scores.reasons).toContain('成交量放大');
      expect(scores.reasons).toContain('大额买单支撑');
    });

    test('拉升阶段评估', () => {
      const indicators = {
        volRatio: 1.5, // 高于突破阈值1.4
        cvdZ: 0.3, // 高于阈值0.2
        delta15: 0.05 // 高于阈值0.04
      };
      
      const largeOrders = [];
      const scores = detector.evaluateStageScores(indicators, largeOrders);
      
      expect(scores.markupScore).toBeGreaterThanOrEqual(3);
      expect(scores.reasons).toContain('放量突破');
      expect(scores.reasons).toContain('CVD持续正向');
      expect(scores.reasons).toContain('主动买盘');
    });

    test('派发阶段评估', () => {
      const indicators = {
        volRatio: 0.9, // 低于阈值
        cvdZ: -0.2, // 负值
        obiZ: -0.5 // 负值
      };
      
      const largeOrders = [
        { side: 'ask', impactRatio: 0.25 }
      ];
      
      const scores = detector.evaluateStageScores(indicators, largeOrders);
      
      expect(scores.distScore).toBeGreaterThanOrEqual(2);
      expect(scores.reasons).toContain('成交量萎缩');
      expect(scores.reasons).toContain('CVD与OBI背离');
      expect(scores.reasons).toContain('大额卖单压力');
    });

    test('砸盘阶段评估', () => {
      const indicators = {
        priceDropPct: 0.04, // 高于阈值0.03
        cvdZ: -1.2, // 低于阈值-1.0
        obiZ: -0.9 // 低于阈值-0.8
      };
      
      const largeOrders = [];
      const scores = detector.evaluateStageScores(indicators, largeOrders);
      
      expect(scores.markdnScore).toBeGreaterThanOrEqual(3);
      expect(scores.reasons).toContain('价格快速下跌');
      expect(scores.reasons).toContain('CVD急降');
      expect(scores.reasons).toContain('OBI负偏');
    });
  });

  describe('阶段转换测试', () => {
    test('应该正确确定阶段', () => {
      const symbol = 'BTCUSDT';
      
      // 设置初始状态
      detector.stateMap.set(symbol, {
        stage: SmartMoneyStage.NEUTRAL,
        since: Date.now() - 200 * 60 * 1000, // 200分钟前
        confidence: 0
      });
      
      const scores = {
        accScore: 4,
        markupScore: 0,
        distScore: 0,
        markdnScore: 0,
        reasons: ['OBI正偏', 'CVD上升', '成交量放大', '大额买单支撑']
      };
      
      const result = detector.determineStage(symbol, scores);
      
      expect(result.stage).toBe(SmartMoneyStage.ACCUMULATION);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.reasons).toEqual(scores.reasons);
    });

    test('应该遵守阶段锁定规则', () => {
      const symbol = 'ETHUSDT';
      
      // 设置刚进入拉升阶段的状态（锁定期内）
      detector.stateMap.set(symbol, {
        stage: SmartMoneyStage.MARKUP,
        since: Date.now() - 10 * 60 * 1000, // 10分钟前（锁定期180分钟）
        confidence: 0.8
      });
      
      const scores = {
        accScore: 4,
        markupScore: 0,
        distScore: 0,
        markdnScore: 0,
        reasons: []
      };
      
      const result = detector.determineStage(symbol, scores);
      
      // 应该保持当前阶段，因为还在锁定期内
      expect(result.stage).toBe(SmartMoneyStage.MARKUP);
    });

    test('砸盘阶段应该能够中断其他阶段', () => {
      const symbol = 'SOLUSDT';
      
      // 设置拉升阶段状态
      detector.stateMap.set(symbol, {
        stage: SmartMoneyStage.MARKUP,
        since: Date.now() - 10 * 60 * 1000,
        confidence: 0.8
      });
      
      const scores = {
        accScore: 0,
        markupScore: 0,
        distScore: 0,
        markdnScore: 4, // 强砸盘信号
        reasons: ['价格快速下跌', 'CVD急降', 'OBI负偏']
      };
      
      const result = detector.determineStage(symbol, scores);
      
      // 砸盘应该能够中断拉升
      expect(result.stage).toBe(SmartMoneyStage.MARKDOWN);
    });
  });

  describe('大额挂单检测测试', () => {
    test('应该正确检测大额挂单', async () => {
      const orderBook = {
        bids: [
          ['50000', '1000'], // 50M USD
          ['49999', '500']
        ],
        asks: [
          ['50001', '2000'], // 100M USD
          ['50002', '300']
        ]
      };
      
      const largeOrders = await detector.detectLargeOrders('BTCUSDT', orderBook);
      
      expect(largeOrders.length).toBeGreaterThan(0);
      expect(largeOrders.some(order => order.side === 'bid')).toBe(true);
      expect(largeOrders.some(order => order.side === 'ask')).toBe(true);
      
      // 验证订单属性
      const bidOrder = largeOrders.find(order => order.side === 'bid');
      expect(bidOrder.value).toBeGreaterThan(detector.params.largeOrderAbs);
    });
  });

  describe('完整检测流程测试', () => {
    test('应该完成完整的检测流程', async () => {
      const symbol = 'BTCUSDT';
      
      const result = await detector.detect(symbol);
      
      expect(result).toBeDefined();
      expect(result.symbol).toBe(symbol);
      expect(result.stage).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.action).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    test('批量检测应该返回所有结果', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
      
      const results = await detector.detectBatch(symbols);
      
      expect(results).toHaveLength(symbols.length);
      results.forEach((result, index) => {
        expect(result.symbol).toBe(symbols[index]);
        expect(result.stage).toBeDefined();
      });
    });
  });

  describe('参数配置测试', () => {
    test('应该正确更新参数', async () => {
      const newParams = {
        obiZPos: 1.0,
        cvdZUp: 0.6,
        volFactorAcc: 1.3
      };
      
      await detector.updateParameters(newParams);
      
      expect(detector.params.obiZPos).toBe(1.0);
      expect(detector.params.cvdZUp).toBe(0.6);
      expect(detector.params.volFactorAcc).toBe(1.3);
    });
  });
});

describe('SmartMoneyAdapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = new SmartMoneyAdapter(mockDatabase, mockBinanceAPI, mockLargeOrderDetector);
  });

  describe('兼容性测试', () => {
    test('应该提供兼容的检测接口', async () => {
      const result = await adapter.detectSmartMoney('BTCUSDT');
      
      expect(result).toBeDefined();
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.action).toBeDefined();
      expect(result.actionChinese).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.isSmartMoney).toBeDefined();
      expect(result.isTrap).toBeDefined();
    });

    test('应该提供兼容的批量检测接口', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT'];
      
      const results = await adapter.detectBatch(symbols);
      
      expect(results).toHaveLength(symbols.length);
      results.forEach(result => {
        expect(result.action).toBeDefined();
        expect(result.actionChinese).toBeDefined();
        expect(result.confidence).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('新功能测试', () => {
    test('应该提供四阶段详细信息', async () => {
      const result = await adapter.getFourPhaseDetails('BTCUSDT');
      
      expect(result).toBeDefined();
      expect(result.stage).toBeDefined();
      expect(result.confidence).toBeDefined();
      expect(result.reasons).toBeDefined();
      expect(result.scores).toBeDefined();
      expect(result.indicators).toBeDefined();
    });

    test('应该提供所有交易对状态', () => {
      const states = adapter.getAllFourPhaseStates();
      
      expect(typeof states).toBe('object');
    });

    test('应该提供统计信息', () => {
      const stats = adapter.getStatistics();
      
      expect(stats).toBeDefined();
      expect(stats.totalSymbols).toBeGreaterThanOrEqual(0);
      expect(stats.stageCounts).toBeDefined();
      expect(stats.averageConfidence).toBeGreaterThanOrEqual(0);
    });
  });
});

// 辅助函数：生成模拟数据
function generateMockKlines() {
  const klines = [];
  for (let i = 0; i < 50; i++) {
    const price = 50000 + Math.random() * 1000;
    klines.push([
      Date.now() - (50 - i) * 15 * 60 * 1000, // 时间戳
      price, // 开盘价
      price + Math.random() * 100, // 最高价
      price - Math.random() * 100, // 最低价
      price + Math.random() * 50, // 收盘价
      1000 + Math.random() * 500 // 成交量
    ]);
  }
  return klines;
}

function generateMockTicker() {
  return {
    symbol: 'BTCUSDT',
    price: '50000.00',
    volume: '1000.00',
    count: 1000
  };
}

function generateMockDepth() {
  const bids = [];
  const asks = [];
  
  for (let i = 0; i < 10; i++) {
    const bidPrice = 50000 - i * 10;
    const askPrice = 50000 + i * 10;
    bids.push([bidPrice.toString(), (1000 + i * 100).toString()]);
    asks.push([askPrice.toString(), (1000 + i * 100).toString()]);
  }
  
  return {
    bids,
    asks,
    lastUpdateId: Date.now()
  };
}

// 运行测试
if (require.main === module) {
  jest.run();
}
