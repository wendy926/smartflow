/**
 * 宏观监控模块单元测试
 */

const FundFlowMonitor = require('../../src/services/macro-monitor/fund-flow-monitor');
const MarketSentimentMonitor = require('../../src/services/macro-monitor/market-sentiment-monitor');
const FuturesMarketMonitor = require('../../src/services/macro-monitor/futures-market-monitor');
const MacroEconomicMonitor = require('../../src/services/macro-monitor/macro-economic-monitor');
const MacroMonitorController = require('../../src/services/macro-monitor/macro-monitor-controller');

// Mock数据库和缓存
const mockDatabase = {
  execute: jest.fn()
};

const mockCache = {
  get: jest.fn(),
  setex: jest.fn()
};

describe('宏观监控模块测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('FundFlowMonitor', () => {
    let fundFlowMonitor;

    beforeEach(() => {
      fundFlowMonitor = new FundFlowMonitor(mockDatabase, {
        etherscanApiKey: 'test-key',
        exchangeWallet: '0x123',
        btcThreshold: 10000000,
        ethThreshold: 1000
      });
    });

    test('应该正确初始化', () => {
      expect(fundFlowMonitor.database).toBe(mockDatabase);
      expect(fundFlowMonitor.etherscanApiKey).toBe('test-key');
      expect(fundFlowMonitor.exchangeWallet).toBe('0x123');
    });

    test('应该保存资金流数据', async () => {
      mockDatabase.execute.mockResolvedValue([[], {}]);

      await fundFlowMonitor.saveFundFlowData(
        'FUND_FLOW',
        'Blockchair',
        'BTC大额交易',
        1000000,
        'USD',
        'NORMAL',
        { test: 'data' }
      );

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO macro_monitoring_data'),
        expect.arrayContaining([
          'FUND_FLOW',
          'Blockchair',
          'BTC大额交易',
          1000000,
          'USD',
          'NORMAL',
          '{"test":"data"}'
        ])
      );
    });

    test('应该获取资金流数据', async () => {
      const mockData = [
        { id: 1, metric_name: 'BTC大额交易', metric_value: 1000000 }
      ];
      mockDatabase.execute.mockResolvedValue([mockData, {}]);

      const result = await fundFlowMonitor.getFundFlowData(10);

      expect(result).toEqual(mockData);
      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM macro_monitoring_data'),
        [10]
      );
    });
  });

  describe('MarketSentimentMonitor', () => {
    let sentimentMonitor;

    beforeEach(() => {
      sentimentMonitor = new MarketSentimentMonitor(mockDatabase, {
        lowThreshold: 20,
        highThreshold: 80
      });
    });

    test('应该正确初始化', () => {
      expect(sentimentMonitor.database).toBe(mockDatabase);
      expect(sentimentMonitor.lowThreshold).toBe(20);
      expect(sentimentMonitor.highThreshold).toBe(80);
    });

    test('应该保存市场情绪数据', async () => {
      mockDatabase.execute.mockResolvedValue([[], {}]);

      await sentimentMonitor.saveSentimentData(
        'MARKET_SENTIMENT',
        'Alternative.me',
        '恐惧贪婪指数',
        50,
        '指数',
        'NORMAL',
        { value: 50, classification: 'Neutral' }
      );

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO macro_monitoring_data'),
        expect.arrayContaining([
          'MARKET_SENTIMENT',
          'Alternative.me',
          '恐惧贪婪指数',
          50,
          '指数',
          'NORMAL',
          '{"value":50,"classification":"Neutral"}'
        ])
      );
    });

    test('应该获取当前恐惧贪婪指数', async () => {
      const mockData = [{
        metric_value: 50,
        raw_data: '{"value":50,"classification":"Neutral"}',
        created_at: '2024-01-01 12:00:00'
      }];
      mockDatabase.execute.mockResolvedValue([mockData, {}]);

      const result = await sentimentMonitor.getCurrentFearGreedIndex();

      expect(result).toEqual({
        value: 50,
        classification: 'Neutral',
        timestamp: '2024-01-01 12:00:00'
      });
    });
  });

  describe('FuturesMarketMonitor', () => {
    let futuresMonitor;

    beforeEach(() => {
      futuresMonitor = new FuturesMarketMonitor(mockDatabase, {
        longShortRatioHigh: 2.0,
        longShortRatioLow: 0.5
      });
    });

    test('应该正确初始化', () => {
      expect(futuresMonitor.database).toBe(mockDatabase);
      expect(futuresMonitor.longShortRatioHigh).toBe(2.0);
      expect(futuresMonitor.longShortRatioLow).toBe(0.5);
    });

    test('应该保存合约市场数据', async () => {
      mockDatabase.execute.mockResolvedValue([[], {}]);

      await futuresMonitor.saveFuturesData(
        'FUTURES_MARKET',
        'Binance',
        '多空比',
        1.5,
        '比率',
        'NORMAL',
        { longShortRatio: 1.5 }
      );

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO macro_monitoring_data'),
        expect.arrayContaining([
          'FUTURES_MARKET',
          'Binance',
          '多空比',
          1.5,
          '比率',
          'NORMAL',
          '{"longShortRatio":1.5}'
        ])
      );
    });
  });

  describe('MacroEconomicMonitor', () => {
    let macroMonitor;

    beforeEach(() => {
      macroMonitor = new MacroEconomicMonitor(mockDatabase, {
        fredApiKey: 'test-fred-key',
        fedFundsHigh: 5.0,
        fedFundsLow: 2.0,
        cpiHigh: 4.0,
        cpiLow: 1.0
      });
    });

    test('应该正确初始化', () => {
      expect(macroMonitor.database).toBe(mockDatabase);
      expect(macroMonitor.fredApiKey).toBe('test-fred-key');
      expect(macroMonitor.fedFundsHigh).toBe(5.0);
      expect(macroMonitor.cpiHigh).toBe(4.0);
    });

    test('应该保存宏观指标数据', async () => {
      mockDatabase.execute.mockResolvedValue([[], {}]);

      await macroMonitor.saveMacroData(
        'MACRO_ECONOMIC',
        'FRED',
        '美联储利率',
        3.5,
        '%',
        'NORMAL',
        { value: 3.5, date: '2024-01-01' }
      );

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO macro_monitoring_data'),
        expect.arrayContaining([
          'MACRO_ECONOMIC',
          'FRED',
          '美联储利率',
          3.5,
          '%',
          'NORMAL',
          '{"value":3.5,"date":"2024-01-01"}'
        ])
      );
    });

    test('应该获取当前美联储利率', async () => {
      const mockData = [{
        metric_value: 3.5,
        raw_data: '{"value":3.5,"date":"2024-01-01"}',
        created_at: '2024-01-01 12:00:00'
      }];
      mockDatabase.execute.mockResolvedValue([mockData, {}]);

      const result = await macroMonitor.getCurrentFedFundsRate();

      expect(result).toEqual({
        value: 3.5,
        date: '2024-01-01',
        timestamp: '2024-01-01 12:00:00'
      });
    });
  });

  describe('MacroMonitorController', () => {
    let controller;

    beforeEach(() => {
      controller = new MacroMonitorController(mockDatabase, mockCache);
    });

    test('应该正确初始化', () => {
      expect(controller.database).toBe(mockDatabase);
      expect(controller.cache).toBe(mockCache);
      expect(controller.isRunning).toBe(false);
      expect(controller.monitoringInterval).toBeNull();
    });

    test('应该加载配置', async () => {
      const mockConfig = [
        { config_key: 'fund_flow_enabled', config_value: 'true' },
        { config_key: 'btc_threshold', config_value: '10000000' }
      ];
      mockDatabase.execute.mockResolvedValue([mockConfig, {}]);

      await controller.loadConfig();

      expect(controller.config.fund_flow_enabled).toBe(true);
      expect(controller.config.btc_threshold).toBe(10000000);
    });

    test('应该获取监控状态', async () => {
      mockCache.get.mockResolvedValue(null);

      const status = await controller.getStatus();

      expect(status.isRunning).toBe(false);
      expect(status.data).toEqual({
        fundFlow: [],
        sentiment: [],
        futures: [],
        macro: []
      });
    });

    test('应该检查告警冷却时间', async () => {
      mockCache.get.mockResolvedValue(null);

      const canSend = await controller.checkAlertCooldown({
        type: 'FUND_FLOW',
        metric_name: 'BTC大额交易'
      });

      expect(canSend).toBe(true);
    });

    test('应该更新告警冷却时间', async () => {
      mockCache.setex.mockResolvedValue('OK');

      await controller.updateAlertCooldown({
        type: 'FUND_FLOW',
        metric_name: 'BTC大额交易'
      });

      expect(mockCache.setex).toHaveBeenCalledWith(
        'macro_alert_cooldown:FUND_FLOW:BTC大额交易',
        1800, // 30分钟
        expect.any(String)
      );
    });
  });
});
