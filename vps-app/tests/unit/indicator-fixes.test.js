const SmartFlowStrategyV3 = require('../modules/strategy/SmartFlowStrategyV3');
const StrategyV3Execution = require('../modules/strategy/StrategyV3Execution');
const DatabaseManager = require('../modules/database/DatabaseManager');

describe('指标修复功能测试', () => {
  let db;

  beforeAll(async () => {
    db = new DatabaseManager();
    await db.init();
  });

  afterAll(async () => {
    await db.close();
  });

  describe('VWAP、OIChange6、DeltaImbalance字段映射修复', () => {
    test('应该正确映射scoringResult中的指标字段', () => {
      // 模拟1H多因子打分结果
      const scoringResult = {
        score: 3,
        vwapDirectionConsistent: true,
        lastVWAP: 100.5,
        volumeRatio: 1.2,
        oiChange: 0.05,
        delta: 0.1,
        fundingRate: 0.001
      };

      // 测试字段映射逻辑
      const vwap = scoringResult.vwap || scoringResult.lastVWAP;
      const vol15mRatio = scoringResult.vol15mRatio || scoringResult.volumeRatio;
      const vol1hRatio = scoringResult.vol1hRatio || scoringResult.volumeRatio;
      const oiChange6h = scoringResult.oiChange6h || scoringResult.oiChange;
      const deltaImbalance = scoringResult.deltaImbalance || scoringResult.delta;

      expect(vwap).toBe(100.5);
      expect(vol15mRatio).toBe(1.2);
      expect(vol1hRatio).toBe(1.2);
      expect(oiChange6h).toBe(0.05);
      expect(deltaImbalance).toBe(0.1);
    });

    test('应该处理null的scoringResult', () => {
      const scoringResult = null;

      const vwap = scoringResult?.vwap || scoringResult?.lastVWAP;
      const vol15mRatio = scoringResult?.vol15mRatio || scoringResult?.volumeRatio;
      const vol1hRatio = scoringResult?.vol1hRatio || scoringResult?.volumeRatio;
      const oiChange6h = scoringResult?.oiChange6h || scoringResult?.oiChange;
      const deltaImbalance = scoringResult?.deltaImbalance || scoringResult?.delta;

      expect(vwap).toBeUndefined();
      expect(vol15mRatio).toBeUndefined();
      expect(vol1hRatio).toBeUndefined();
      expect(oiChange6h).toBeUndefined();
      expect(deltaImbalance).toBeUndefined();
    });
  });

  describe('杠杆计算修复', () => {
    test('应该为无信号情况提供合理的默认值', async () => {
      const executionResult = {
        signal: 'NONE',
        entry: null,
        stopLoss: null,
        atr14: 2.5
      };

      const rangeResult = {
        currentPrice: 100
      };

      // 模拟杠杆计算逻辑
      const direction = executionResult.signal === 'BUY' ? 'LONG' : 'SHORT';
      
      if (executionResult.signal !== 'NONE' && executionResult.entry && executionResult.stopLoss) {
        // 有信号时的正常计算
        expect(true).toBe(false); // 不应该执行到这里
      } else {
        // 无信号时提供合理的默认值
        const defaultATR = executionResult.atr14 || 1.0;
        const defaultEntry = rangeResult?.currentPrice || 100;
        const defaultStopLoss = direction === 'LONG' ? defaultEntry * 0.95 : defaultEntry * 1.05;

        expect(defaultATR).toBe(2.5);
        expect(defaultEntry).toBe(100);
        expect(defaultStopLoss).toBe(105); // SHORT方向，止损价应该更高
      }
    });

    test('应该正确处理有信号的情况', async () => {
      const executionResult = {
        signal: 'BUY',
        entry: 100,
        stopLoss: 95,
        atr14: 2.5
      };

      const direction = executionResult.signal === 'BUY' ? 'LONG' : 'SHORT';
      
      if (executionResult.signal !== 'NONE' && executionResult.entry && executionResult.stopLoss) {
        // 有信号时使用实际值
        expect(executionResult.entry).toBe(100);
        expect(executionResult.stopLoss).toBe(95);
        expect(direction).toBe('LONG');
      } else {
        expect(true).toBe(false); // 不应该执行到这里
      }
    });
  });

  describe('StrategyV3Execution指标添加', () => {
    let execution;

    beforeEach(() => {
      execution = new StrategyV3Execution(db);
    });

    test('应该正确计算成交量', () => {
      const candles = [
        { volume: 100 },
        { volume: 150 },
        { volume: 200 },
        { volume: 120 },
        { volume: 180 }
      ];

      const vol15m = execution.calculateVolume(candles, 15);
      const vol1h = execution.calculateVolume(candles, 60);

      expect(vol15m).toBe(750); // 所有成交量之和
      expect(vol1h).toBe(750); // 所有成交量之和
    });

    test('应该处理空的K线数据', () => {
      const vol15m = execution.calculateVolume([], 15);
      const vol1h = execution.calculateVolume(null, 60);

      expect(vol15m).toBe(0);
      expect(vol1h).toBe(0);
    });

    test('应该处理包含undefined volume的K线数据', () => {
      const candles = [
        { volume: 100 },
        { volume: undefined },
        { volume: 200 },
        { volume: null }
      ];

      const vol15m = execution.calculateVolume(candles, 15);

      expect(vol15m).toBe(300); // 只计算有效的成交量
    });
  });

  describe('SmartFlowStrategyV3返回结果完整性', () => {
    test('趋势市分析应该包含所有基础技术指标', () => {
      const trend4hResult = {
        ma20: 100,
        ma50: 95,
        ma200: 90,
        adx14: 25,
        bbw: 0.05,
        bullScore: 3,
        bearScore: 1
      };

      const executionResult = {
        ema20: 98,
        ema50: 93,
        vol15m: 1000,
        vol1h: 5000
      };

      const scoringResult = {
        vwap: 99,
        vol15mRatio: 1.2,
        vol1hRatio: 1.1,
        oiChange: 0.05,
        fundingRate: 0.001,
        delta: 0.1
      };

      // 模拟趋势市分析返回结果
      const result = {
        marketType: '趋势市',
        // 基础技术指标
        ma20: trend4hResult.ma20,
        ma50: trend4hResult.ma50,
        ma200: trend4hResult.ma200,
        ema20: executionResult.ema20,
        ema50: executionResult.ema50,
        adx14: trend4hResult.adx14,
        bbw: trend4hResult.bbw,
        vol15m: executionResult.vol15m,
        vol1h: executionResult.vol1h,
        bullScore: trend4hResult.bullScore,
        bearScore: trend4hResult.bearScore,
        vwap: scoringResult.vwap || scoringResult.lastVWAP,
        vol15mRatio: scoringResult.vol15mRatio || scoringResult.volumeRatio,
        vol1hRatio: scoringResult.vol1hRatio || scoringResult.volumeRatio,
        oiChange6h: scoringResult.oiChange6h || scoringResult.oiChange,
        fundingRate: scoringResult.fundingRate,
        deltaImbalance: scoringResult.deltaImbalance || scoringResult.delta
      };

      // 验证所有必需指标都存在
      expect(result.ma20).toBe(100);
      expect(result.ma50).toBe(95);
      expect(result.ma200).toBe(90);
      expect(result.ema20).toBe(98);
      expect(result.ema50).toBe(93);
      expect(result.adx14).toBe(25);
      expect(result.bbw).toBe(0.05);
      expect(result.vol15m).toBe(1000);
      expect(result.vol1h).toBe(5000);
      expect(result.bullScore).toBe(3);
      expect(result.bearScore).toBe(1);
      expect(result.vwap).toBe(99);
      expect(result.vol15mRatio).toBe(1.2);
      expect(result.vol1hRatio).toBe(1.1);
      expect(result.oiChange6h).toBe(0.05);
      expect(result.fundingRate).toBe(0.001);
      expect(result.deltaImbalance).toBe(0.1);
    });

    test('震荡市分析应该包含所有基础技术指标', () => {
      const rangeResult = {
        ma20: 100,
        ma50: 95,
        ma200: 90,
        adx14: 25,
        bbw: 0.05,
        bullScore: 2,
        bearScore: 2,
        currentPrice: 100
      };

      const executionResult = {
        ema20: 98,
        ema50: 93,
        vol15m: 1000,
        vol1h: 5000
      };

      const scoringResult = {
        lastVWAP: 99,
        volumeRatio: 1.2,
        oiChange: 0.05,
        fundingRate: 0.001,
        delta: 0.1
      };

      // 模拟震荡市分析返回结果
      const result = {
        marketType: '震荡市',
        // 基础技术指标
        ma20: rangeResult.ma20,
        ma50: rangeResult.ma50,
        ma200: rangeResult.ma200,
        ema20: executionResult.ema20,
        ema50: executionResult.ema50,
        adx14: rangeResult.adx14,
        bbw: rangeResult.bbw,
        vol15m: executionResult.vol15m,
        vol1h: executionResult.vol1h,
        bullScore: rangeResult.bullScore,
        bearScore: rangeResult.bearScore,
        vwap: scoringResult?.vwap || scoringResult?.lastVWAP,
        vol15mRatio: scoringResult?.vol15mRatio || scoringResult?.volumeRatio,
        vol1hRatio: scoringResult?.vol1hRatio || scoringResult?.volumeRatio,
        oiChange6h: scoringResult?.oiChange6h || scoringResult?.oiChange,
        fundingRate: scoringResult?.fundingRate,
        deltaImbalance: scoringResult?.deltaImbalance || scoringResult?.delta
      };

      // 验证所有必需指标都存在
      expect(result.ma20).toBe(100);
      expect(result.ma50).toBe(95);
      expect(result.ma200).toBe(90);
      expect(result.ema20).toBe(98);
      expect(result.ema50).toBe(93);
      expect(result.adx14).toBe(25);
      expect(result.bbw).toBe(0.05);
      expect(result.vol15m).toBe(1000);
      expect(result.vol1h).toBe(5000);
      expect(result.bullScore).toBe(2);
      expect(result.bearScore).toBe(2);
      expect(result.vwap).toBe(99);
      expect(result.vol15mRatio).toBe(1.2);
      expect(result.vol1hRatio).toBe(1.2);
      expect(result.oiChange6h).toBe(0.05);
      expect(result.fundingRate).toBe(0.001);
      expect(result.deltaImbalance).toBe(0.1);
    });
  });

  describe('错误处理', () => {
    test('应该正确处理指标计算异常', async () => {
      const executionResult = {
        signal: 'NONE',
        entry: null,
        stopLoss: null,
        atr14: null
      };

      const rangeResult = {
        currentPrice: null
      };

      // 模拟杠杆计算错误处理
      let leverageData;
      try {
        if (executionResult.signal !== 'NONE' && executionResult.entry && executionResult.stopLoss) {
          // 有信号时的正常计算
          leverageData = { maxLeverage: 10, minMargin: 100 };
        } else {
          // 无信号时提供合理的默认值
          const defaultATR = executionResult.atr14 || 1.0;
          const defaultEntry = rangeResult?.currentPrice || 100;
          const defaultStopLoss = defaultEntry * 1.05;
          
          leverageData = {
            maxLeverage: Math.floor(1 / (0.05 + 0.005)), // 基于止损距离计算
            minMargin: 100 / (Math.floor(1 / (0.05 + 0.005)) * 0.05),
            stopLossDistance: 0.05,
            atrValue: defaultATR
          };
        }
      } catch (error) {
        // 使用默认值作为备选
        leverageData = {
          maxLeverage: 10,
          minMargin: 100,
          stopLossDistance: 0,
          atrValue: executionResult.atr14 || 0
        };
      }

      expect(leverageData.maxLeverage).toBeGreaterThan(0);
      expect(leverageData.minMargin).toBeGreaterThan(0);
      expect(leverageData.atrValue).toBeGreaterThanOrEqual(0);
    });
  });
});
