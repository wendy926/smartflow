/**
 * StrategyEngine单元测试
 * 测试策略引擎核心功能
 */

const StrategyEngine = require('../../src/core/strategy-engine');
const logger = require('../../src/utils/logger');

describe('StrategyEngine', () => {
  let strategyEngine;
  let mockDatabase;
  let mockParameterManager;
  let mockSignalProcessor;

  beforeEach(() => {
    // 创建Mock对象
    mockDatabase = {
      query: jest.fn(),
      connect: jest.fn()
    };

    mockParameterManager = {
      loadParameters: jest.fn(),
      getParameters: jest.fn(),
      updateParameters: jest.fn()
    };

    mockSignalProcessor = {
      processSignal: jest.fn(),
      validateSignal: jest.fn()
    };

    // 创建StrategyEngine实例
    strategyEngine = new StrategyEngine(
      mockDatabase,
      mockParameterManager,
      mockSignalProcessor,
      logger
    );
  });

  test('应正确注册策略', () => {
    const mockStrategy = {
      name: 'TestStrategy',
      execute: jest.fn()
    };

    strategyEngine.registerStrategy('TEST', mockStrategy);

    expect(strategyEngine.strategies.has('TEST')).toBe(true);
    expect(strategyEngine.strategies.get('TEST')).toBe(mockStrategy);
  });

  test('应正确执行策略', async () => {
    const mockStrategy = {
      name: 'TestStrategy',
      execute: jest.fn().mockResolvedValue({ signal: 'BUY', confidence: 0.8 })
    };

    strategyEngine.registerStrategy('TEST', mockStrategy);

    const result = await strategyEngine.executeStrategy('TEST', 'BTCUSDT');

    expect(mockStrategy.execute).toHaveBeenCalledWith('BTCUSDT');
    expect(result.signal).toBe('BUY');
    expect(result.confidence).toBe(0.8);
  });

  test('应正确处理参数管理', async () => {
    const mockParams = {
      stopLoss: 100,
      takeProfit: 200
    };

    mockParameterManager.getParameters.mockResolvedValue(mockParams);

    const result = await strategyEngine.loadParameters('TEST', 'BALANCED');

    expect(mockParameterManager.loadParameters).toHaveBeenCalledWith('TEST', 'BALANCED');
    expect(result).toEqual(mockParams);
  });

  test('应正确处理信号生成', async () => {
    const mockStrategy = {
      name: 'TestStrategy',
      execute: jest.fn().mockResolvedValue({ signal: 'SELL' })
    };

    mockSignalProcessor.processSignal.mockImplementation((signal) => ({
      ...signal,
      processed: true
    }));

    strategyEngine.registerStrategy('TEST', mockStrategy);
    const rawResult = await strategyEngine.executeStrategy('TEST', 'BTCUSDT');
    const processedResult = mockSignalProcessor.processSignal(rawResult);

    expect(processedResult.processed).toBe(true);
    expect(mockSignalProcessor.processSignal).toHaveBeenCalled();
  });

  test('未注册策略应抛出错误', async () => {
    await expect(
      strategyEngine.executeStrategy('UNKNOWN', 'BTCUSDT')
    ).rejects.toThrow();
  });

  test('应正确处理数据库适配器', () => {
    expect(strategyEngine.databaseAdapter).toBe(mockDatabase);
  });
});

