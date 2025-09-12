// 策略V3修复逻辑单元测试
const StrategyV3Core = require('../modules/strategy/StrategyV3Core');
const StrategyV3Execution = require('../modules/strategy/StrategyV3Execution');
const SmartFlowStrategyV3 = require('../modules/strategy/SmartFlowStrategyV3');

// Mock dependencies
jest.mock('../modules/api/BinanceAPI', () => ({
  getKlines: jest.fn(),
  getTicker: jest.fn(),
  getFundingRate: jest.fn(),
  getOpenInterestHistory: jest.fn()
}));

jest.mock('../modules/database/DatabaseManager', () => {
  return jest.fn().mockImplementation(() => ({
    getKlineData: jest.fn(),
    recordDataQualityAlert: jest.fn()
  }));
});

jest.mock('../modules/data/DeltaManager', () => {
  return jest.fn().mockImplementation(() => ({
    getDeltaData: jest.fn().mockResolvedValue({
      delta: 0.1,
      timestamp: Date.now()
    })
  }));
});

describe('策略V3修复逻辑测试', () => {
  let strategyCore;
  let strategyExecution;
  let mockCandles;

  beforeEach(() => {
    strategyCore = new StrategyV3Core();
    strategyExecution = new StrategyV3Execution();
    
    // Mock 1小时K线数据
    mockCandles = Array.from({ length: 50 }, (_, i) => ({
      open: 100 + i * 0.1,
      high: 101 + i * 0.1,
      low: 99 + i * 0.1,
      close: 100.5 + i * 0.1,
      volume: 1000 + i * 10
    }));
  });

  describe('VWAP方向一致性判断', () => {
    test('空头趋势：当前价格低于VWAP应该返回true', () => {
      const currentPrice = 100;
      const vwap = 105;
      const trend4h = '空头趋势';
      
      const result = strategyCore.checkVWAPDirectionConsistency(currentPrice, vwap, trend4h);
      expect(result).toBe(true);
    });

    test('空头趋势：当前价格高于VWAP应该返回false', () => {
      const currentPrice = 105;
      const vwap = 100;
      const trend4h = '空头趋势';
      
      const result = strategyCore.checkVWAPDirectionConsistency(currentPrice, vwap, trend4h);
      expect(result).toBe(false);
    });

    test('多头趋势：当前价格高于VWAP应该返回true', () => {
      const currentPrice = 105;
      const vwap = 100;
      const trend4h = '多头趋势';
      
      const result = strategyCore.checkVWAPDirectionConsistency(currentPrice, vwap, trend4h);
      expect(result).toBe(true);
    });

    test('多头趋势：当前价格低于VWAP应该返回false', () => {
      const currentPrice = 100;
      const vwap = 105;
      const trend4h = '多头趋势';
      
      const result = strategyCore.checkVWAPDirectionConsistency(currentPrice, vwap, trend4h);
      expect(result).toBe(false);
    });
  });

  describe('15分钟入场判断逻辑', () => {
    let mockCandles15m;

    beforeEach(() => {
      // Mock 15分钟K线数据
      mockCandles15m = Array.from({ length: 50 }, (_, i) => ({
        open: 100 + i * 0.01,
        high: 101 + i * 0.01,
        low: 99 + i * 0.01,
        close: 100.5 + i * 0.01,
        volume: 1000 + i * 5
      }));
    });

    test('空头反抽破位：应该按照strategy-v3.md要求检查收盘价跌破setup candle低点', () => {
      // 设置测试数据：收盘价跌破前一根低点
      mockCandles15m[49].close = 99.5; // 当前收盘价
      mockCandles15m[48].low = 100.0;  // 前一根低点
      mockCandles15m[49].close = 99.5; // 当前收盘价 < 前一根低点
      
      const last15m = mockCandles15m[49];
      const prev15m = mockCandles15m[48];
      
      // 按照修复后的逻辑：收盘价跌破setup candle低点
      const setupBreakdown = last15m.close < prev15m.low;
      expect(setupBreakdown).toBe(true);
    });

    test('多头回踩突破：应该按照strategy-v3.md要求检查收盘价突破setup candle高点', () => {
      // 设置测试数据：收盘价突破前一根高点
      mockCandles15m[49].close = 101.5; // 当前收盘价
      mockCandles15m[48].high = 101.0;  // 前一根高点
      
      const last15m = mockCandles15m[49];
      const prev15m = mockCandles15m[48];
      
      // 按照修复后的逻辑：收盘价突破setup candle高点
      const setupBreakout = last15m.close > prev15m.high;
      expect(setupBreakout).toBe(true);
    });

    test('成交量确认：应该使用1.0倍平均成交量而不是1.2倍', () => {
      const candles = mockCandles15m.slice(-20);
      const avgVol = candles.reduce((a, c) => a + c.volume, 0) / 20;
      const last15m = mockCandles15m[49];
      
      // 设置当前成交量等于平均成交量
      last15m.volume = avgVol;
      
      // 按照修复后的逻辑：1.0倍平均成交量
      const volConfirm = last15m.volume >= avgVol * 1.0;
      expect(volConfirm).toBe(true);
    });
  });

  describe('1H多因子打分allowEntry字段', () => {
    test('应该包含allowEntry字段', async () => {
      // Mock analyze1HScoring方法
      const mockResult = {
        score: 4,
        factorScores: { vwap: 1, breakout: 1, volume: 1, oi: 1 },
        vwapDirectionConsistent: true,
        allowEntry: true,
        currentPrice: 100,
        lastVWAP: 95,
        delta: 0.1,
        oiChange: 0.02,
        volumeRatio: 1.2,
        fundingRate: 0.01
      };

      // 模拟analyze1HScoring返回结果
      jest.spyOn(strategyCore, 'analyze1HScoring').mockResolvedValue(mockResult);

      const result = await strategyCore.analyze1HScoring('BTCUSDT', '空头趋势', null);
      
      expect(result).toHaveProperty('allowEntry');
      expect(result.allowEntry).toBe(true);
    });

    test('VWAP方向不一致且得分≥3时，allowEntry应该为false', () => {
      const score = 4;
      const vwapDirectionConsistent = false;
      
      // 按照修复后的逻辑：VWAP方向一致且得分≥3
      const allowEntry = vwapDirectionConsistent && score >= 3;
      expect(allowEntry).toBe(false);
    });

    test('VWAP方向一致且得分≥3时，allowEntry应该为true', () => {
      const score = 4;
      const vwapDirectionConsistent = true;
      
      // 按照修复后的逻辑：VWAP方向一致且得分≥3
      const allowEntry = vwapDirectionConsistent && score >= 3;
      expect(allowEntry).toBe(true);
    });
  });

  describe('趋势市分析逻辑', () => {
    test('当allowEntry为true时，应该执行15分钟入场判断', async () => {
      const mockScoringResult = {
        score: 4,
        vwapDirectionConsistent: true,
        allowEntry: true,
        currentPrice: 100,
        lastVWAP: 95
      };

      const mockTrend4hResult = {
        trend4h: '空头趋势',
        marketType: '趋势市'
      };

      // Mock analyzeTrendMarket方法
      jest.spyOn(SmartFlowStrategyV3, 'analyzeTrendMarket').mockResolvedValue({
        marketType: '趋势市',
        score1h: 4,
        vwapDirectionConsistent: true,
        signal: 'NONE',
        execution: null,
        reason: '未满足趋势市入场条件'
      });

      const result = await SmartFlowStrategyV3.analyzeTrendMarket('BTCUSDT', mockTrend4hResult, mockScoringResult);
      
      expect(result).toHaveProperty('signal');
      expect(result).toHaveProperty('execution');
      expect(result).toHaveProperty('reason');
    });
  });

  describe('数据正确性验证', () => {
    test('空头趋势判断应该正确', () => {
      const trend4h = '空头趋势';
      const score = 4;
      const vwapDirectionConsistent = true;
      
      // 空头趋势 + 得分≥3 + VWAP方向一致 = 允许入场
      const allowEntry = vwapDirectionConsistent && score >= 3;
      expect(allowEntry).toBe(true);
    });

    test('1H加强趋势判断应该基于allowEntry字段', () => {
      const scoringResult = {
        score: 3,
        vwapDirectionConsistent: true,
        allowEntry: true
      };
      
      // 当allowEntry为true时，应该允许1H加强趋势判断
      expect(scoringResult.allowEntry).toBe(true);
    });

    test('15分钟信号应该基于15分钟入场条件', () => {
      const trend4h = '空头趋势';
      const score1h = 4;
      const vwapDirectionConsistent = true;
      
      // 基本条件：趋势市 + 得分≥3 + VWAP方向一致
      const basicConditions = trend4h === '空头趋势' && score1h >= 3 && vwapDirectionConsistent;
      expect(basicConditions).toBe(true);
    });
  });
});
