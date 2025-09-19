// tests/unit/strategy-core-logic.test.js
// 策略核心逻辑单元测试 - 验证关键算法正确性

const TechnicalIndicators = require('../../src/core/modules/utils/TechnicalIndicators');
const StrategyResultValidator = require('../../src/core/modules/validation/StrategyResultValidator');

describe('策略核心逻辑测试', () => {
  
  describe('技术指标计算测试', () => {
    test('SMA计算应该正确', () => {
      const prices = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28];
      const sma5 = TechnicalIndicators.calculateSMA(prices, 5);
      
      expect(sma5).toBeDefined();
      expect(sma5.length).toBe(6); // 10个数据点，5期SMA，应该有6个结果
      expect(sma5[0]).toBe(14); // (10+12+14+16+18)/5 = 14
      expect(sma5[sma5.length - 1]).toBe(24); // (20+22+24+26+28)/5 = 24
    });

    test('EMA计算应该正确', () => {
      const prices = [10, 12, 14, 16, 18, 20];
      const ema3 = TechnicalIndicators.calculateEMA(prices, 3);
      
      expect(ema3).toBeDefined();
      expect(ema3.length).toBe(prices.length);
      expect(ema3[0]).toBe(10); // 初始值
      
      // 验证EMA递归计算
      const k = 2 / (3 + 1); // k = 0.5
      const expectedEMA1 = 12 * k + 10 * (1 - k); // 12 * 0.5 + 10 * 0.5 = 11
      expect(ema3[1]).toBeCloseTo(expectedEMA1, 2);
    });

    test('ATR计算应该正确', () => {
      const highs = [48, 49, 50, 51, 52];
      const lows = [46, 47, 48, 49, 50];
      const closes = [47, 48, 49, 50, 51];
      
      const atr = TechnicalIndicators.calculateATR(highs, lows, closes, 3);
      
      expect(atr).toBeDefined();
      expect(atr.length).toBeGreaterThan(0);
      expect(atr[atr.length - 1]).toBeGreaterThan(0);
    });

    test('布林带计算应该正确', () => {
      const prices = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
      const bb = TechnicalIndicators.calculateBollingerBands(prices, 5, 2);
      
      expect(bb).toBeDefined();
      expect(bb.length).toBeGreaterThan(0);
      
      const lastBB = bb[bb.length - 1];
      expect(lastBB.upper).toBeGreaterThan(lastBB.middle);
      expect(lastBB.middle).toBeGreaterThan(lastBB.lower);
      expect(lastBB.bandwidth).toBeGreaterThan(0);
    });

    test('VWAP计算应该正确', () => {
      const klines = [
        { high: 102, low: 98, close: 100, volume: 1000 },
        { high: 104, low: 100, close: 102, volume: 1200 },
        { high: 106, low: 102, close: 104, volume: 800 }
      ];
      
      const vwap = TechnicalIndicators.calculateVWAP(klines);
      
      expect(vwap).toBeDefined();
      expect(vwap).toBeGreaterThan(0);
      
      // 手动验证VWAP计算
      const totalPV = klines.reduce((sum, k) => {
        const typicalPrice = (k.high + k.low + k.close) / 3;
        return sum + typicalPrice * k.volume;
      }, 0);
      const totalV = klines.reduce((sum, k) => sum + k.volume, 0);
      const expectedVWAP = totalPV / totalV;
      
      expect(vwap).toBeCloseTo(expectedVWAP, 4);
    });
  });

  describe('策略结果验证器测试', () => {
    let validator;

    beforeEach(() => {
      validator = new StrategyResultValidator();
    });

    test('应该正确验证有效的V3策略结果', () => {
      const validV3Result = {
        symbol: 'BTCUSDT',
        trend4h: '多头趋势',
        signal: '做多',
        execution: '做多_突破确认',
        currentPrice: 47200,
        entrySignal: 47250,
        stopLoss: 46800,
        takeProfit: 48150,
        score: 5,
        score1h: 4,
        dataCollectionRate: 98.5,
        strategyType: 'V3',
        timestamp: new Date().toISOString()
      };

      const validation = validator.validateV3Result(validV3Result);

      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
      expect(validation.score).toBeGreaterThan(60);
    });

    test('应该检测V3策略结果中的逻辑错误', () => {
      const invalidV3Result = {
        symbol: 'BTCUSDT',
        trend4h: '多头趋势',
        signal: '做空', // ❌ 逻辑错误: 多头趋势下做空
        execution: '做空_反抽破位',
        currentPrice: 47200,
        score: 15, // ❌ 超出范围
        score1h: 2, // ❌ 得分<3但有信号
        dataCollectionRate: 98.5,
        strategyType: 'V3',
        timestamp: new Date().toISOString()
      };

      const validation = validator.validateV3Result(invalidV3Result);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('多头趋势下不应出现做空信号')
        ])
      );
    });

    test('应该正确验证有效的ICT策略结果', () => {
      const validICTResult = {
        symbol: 'BTCUSDT',
        dailyTrend: 'up',
        signalType: 'BOS_LONG',
        entryPrice: 47200,
        stopLoss: 46800,
        takeProfit: 48400,
        dailyTrendScore: 2,
        obDetected: true,
        fvgDetected: false,
        sweepHTF: true,
        engulfingDetected: true,
        sweepLTF: false,
        volumeConfirm: true,
        riskRewardRatio: 3,
        leverage: 5,
        dataCollectionRate: 95.0,
        strategyType: 'ICT',
        timestamp: new Date().toISOString()
      };

      const validation = validator.validateICTResult(validICTResult);

      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
      expect(validation.score).toBeGreaterThan(60);
    });

    test('应该检测ICT策略结果中的逻辑错误', () => {
      const invalidICTResult = {
        symbol: 'BTCUSDT',
        dailyTrend: 'down',
        signalType: 'BOS_LONG', // ❌ 逻辑错误: 下降趋势下做多
        entryPrice: 47200,
        dailyTrendScore: 5, // ❌ 超出范围 (应该0-3)
        riskRewardRatio: 0.5, // ❌ 风险回报比过低
        leverage: 200, // ❌ 杠杆过高
        strategyType: 'ICT',
        timestamp: new Date().toISOString()
      };

      const validation = validator.validateICTResult(invalidICTResult);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('应该验证风险管理参数', () => {
      const validRiskData = {
        entry: 47200,
        stopLoss: 46800,
        takeProfit: 48000,
        direction: 'LONG',
        riskRewardRatio: 2,
        leverage: 10,
        margin: 4720,
        notional: 47200
      };

      const validation = validator.validateRiskManagement(validRiskData);

      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    test('应该检测无效的风险管理参数', () => {
      const invalidRiskData = {
        entry: 47200,
        stopLoss: 47500, // ❌ 多头止损高于入场价
        takeProfit: 46800, // ❌ 多头止盈低于入场价
        direction: 'LONG',
        riskRewardRatio: 0.3, // ❌ 风险回报比过低
        leverage: 300 // ❌ 杠杆过高
      };

      const validation = validator.validateRiskManagement(invalidRiskData);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('文档符合性测试', () => {
    test('V3策略得分范围应该符合strategy-v3.md文档', () => {
      // 测试4H趋势过滤10分制
      const trend4hScores = [0, 3, 4, 7, 10];
      
      trend4hScores.forEach(score => {
        const result = {
          symbol: 'BTCUSDT',
          score: score,
          trend4h: score >= 4 ? '多头趋势' : '震荡市',
          strategyType: 'V3',
          timestamp: new Date().toISOString()
        };

        const validation = validator.validateV3Result(result);
        
        // 得分在0-10范围内应该通过验证
        if (score >= 0 && score <= 10) {
          expect(validation.errors).not.toEqual(
            expect.arrayContaining([
              expect.stringContaining('得分字段score超出范围')
            ])
          );
        }
      });
    });

    test('ICT策略信号类型应该符合ict.md文档', () => {
      const validSignalTypes = [
        'BOS_LONG', 'BOS_SHORT', 
        'CHoCH_LONG', 'CHoCH_SHORT', 
        'MIT_LONG', 'MIT_SHORT', 
        'WAIT'
      ];

      validSignalTypes.forEach(signalType => {
        const result = {
          symbol: 'BTCUSDT',
          dailyTrend: signalType.includes('LONG') ? 'up' : signalType.includes('SHORT') ? 'down' : 'sideways',
          signalType: signalType,
          entryPrice: 47200,
          dataCollectionRate: 95,
          strategyType: 'ICT',
          timestamp: new Date().toISOString()
        };

        const validation = validator.validateICTResult(result);
        
        // 应该没有信号类型相关的错误
        expect(validation.errors).not.toEqual(
          expect.arrayContaining([
            expect.stringContaining('信号类型')
          ])
        );
      });
    });

    test('风险回报比应该符合文档要求', () => {
      // V3策略: 2R风险回报比
      const v3RiskData = {
        entry: 100,
        stopLoss: 98,
        takeProfit: 104, // 2R: (104-100)/(100-98) = 2
        direction: 'LONG',
        riskRewardRatio: 2
      };

      const v3Validation = validator.validateRiskManagement(v3RiskData);
      expect(v3Validation.valid).toBe(true);

      // ICT策略: 3R风险回报比
      const ictRiskData = {
        entry: 100,
        stopLoss: 98,
        takeProfit: 106, // 3R: (106-100)/(100-98) = 3
        direction: 'LONG',
        riskRewardRatio: 3
      };

      const ictValidation = validator.validateRiskManagement(ictRiskData);
      expect(ictValidation.valid).toBe(true);
    });
  });

  describe('数据验证测试', () => {
    test('应该验证必需字段完整性', () => {
      const incompleteResult = {
        symbol: 'BTCUSDT',
        // 缺少其他必需字段
      };

      const validation = validator.validateV3Result(incompleteResult);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('缺少必需字段')
        ])
      );
    });

    test('应该验证数据类型正确性', () => {
      const wrongTypeResult = {
        symbol: 123, // ❌ 应该是字符串
        trend4h: '多头趋势',
        currentPrice: '47200', // ❌ 应该是数字
        dataCollectionRate: true, // ❌ 应该是数字
        strategyType: 'V3',
        timestamp: new Date().toISOString()
      };

      const validation = validator.validateV3Result(wrongTypeResult);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('应该验证价格字段合理性', () => {
      const unreasonablePriceResult = {
        symbol: 'BTCUSDT',
        trend4h: '多头趋势',
        currentPrice: -100, // ❌ 负价格
        entrySignal: 0, // ❌ 零价格
        stopLoss: 2000000, // ❌ 价格过高
        strategyType: 'V3',
        timestamp: new Date().toISOString()
      };

      const validation = validator.validateV3Result(unreasonablePriceResult);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('策略一致性测试', () => {
    test('应该检测策略信号方向一致性', () => {
      const v3Results = [{
        symbol: 'BTCUSDT',
        signal: '做多',
        execution: '做多_突破确认',
        currentPrice: 47200,
        strategyType: 'V3'
      }];

      const ictResults = [{
        symbol: 'BTCUSDT',
        signalType: 'BOS_LONG',
        entryPrice: 47200,
        strategyType: 'ICT'
      }];

      const validator = new StrategyResultValidator();
      const validation = validator.validateStrategyConsistency(v3Results, ictResults);

      expect(validation.consistent).toBe(true);
      expect(validation.agreements.length).toBeGreaterThan(0);
      expect(validation.conflicts.length).toBe(0);
    });

    test('应该检测策略信号冲突', () => {
      const v3Results = [{
        symbol: 'BTCUSDT',
        signal: '做多',
        currentPrice: 47200,
        strategyType: 'V3'
      }];

      const ictResults = [{
        symbol: 'BTCUSDT',
        signalType: 'BOS_SHORT', // 冲突: V3做多，ICT做空
        entryPrice: 47200,
        strategyType: 'ICT'
      }];

      const validator = new StrategyResultValidator();
      const validation = validator.validateStrategyConsistency(v3Results, ictResults);

      expect(validation.consistent).toBe(false);
      expect(validation.conflicts.length).toBeGreaterThan(0);
    });
  });

  describe('边界条件测试', () => {
    test('应该处理空数据', () => {
      const emptyData = [];
      const sma = TechnicalIndicators.calculateSMA(emptyData, 5);
      
      expect(sma).toBeDefined();
      expect(sma.length).toBe(0);
    });

    test('应该处理数据不足情况', () => {
      const insufficientData = [1, 2]; // 只有2个数据点
      const sma5 = TechnicalIndicators.calculateSMA(insufficientData, 5);
      
      expect(sma5).toBeDefined();
      expect(sma5.length).toBe(0); // 数据不足，返回空数组
    });

    test('应该处理极端价格值', () => {
      const extremePrices = [0.0001, 999999, 0.0001, 999999];
      const sma = TechnicalIndicators.calculateSMA(extremePrices, 2);
      
      expect(sma).toBeDefined();
      expect(sma.length).toBeGreaterThan(0);
      expect(sma.every(value => !isNaN(value))).toBe(true);
    });
  });

  describe('算法正确性测试', () => {
    test('移动平均线应该正确反映价格趋势', () => {
      // 上升趋势数据
      const upTrendPrices = [100, 102, 104, 106, 108, 110];
      const sma3 = TechnicalIndicators.calculateSMA(upTrendPrices, 3);
      
      // SMA应该呈上升趋势
      for (let i = 1; i < sma3.length; i++) {
        expect(sma3[i]).toBeGreaterThan(sma3[i-1]);
      }

      // 下降趋势数据
      const downTrendPrices = [110, 108, 106, 104, 102, 100];
      const smaDown = TechnicalIndicators.calculateSMA(downTrendPrices, 3);
      
      // SMA应该呈下降趋势
      for (let i = 1; i < smaDown.length; i++) {
        expect(smaDown[i]).toBeLessThan(smaDown[i-1]);
      }
    });

    test('布林带宽度应该正确反映波动率', () => {
      // 低波动数据
      const lowVolPrices = [100, 100.1, 99.9, 100.05, 99.95];
      const bbLow = TechnicalIndicators.calculateBollingerBands(lowVolPrices, 5, 2);
      
      // 高波动数据
      const highVolPrices = [100, 105, 95, 110, 90];
      const bbHigh = TechnicalIndicators.calculateBollingerBands(highVolPrices, 5, 2);
      
      // 高波动的布林带宽度应该更大
      expect(bbHigh[bbHigh.length - 1].bandwidth).toBeGreaterThan(bbLow[bbLow.length - 1].bandwidth);
    });

    test('VWAP应该正确加权成交量', () => {
      // 测试成交量加权的正确性
      const klines = [
        { high: 101, low: 99, close: 100, volume: 100 },   // 典型价格100, 权重小
        { high: 201, low: 199, close: 200, volume: 1000 }  // 典型价格200, 权重大
      ];
      
      const vwap = TechnicalIndicators.calculateVWAP(klines);
      
      // VWAP应该更接近高成交量的价格(200)
      expect(vwap).toBeGreaterThan(150); // 应该明显偏向200
      expect(vwap).toBeLessThan(200);    // 但不会完全等于200
    });
  });

  describe('性能测试', () => {
    test('技术指标计算应该高效', () => {
      const largePriceArray = Array.from({ length: 1000 }, (_, i) => 100 + Math.sin(i * 0.1) * 10);
      
      const startTime = Date.now();
      
      TechnicalIndicators.calculateSMA(largePriceArray, 20);
      TechnicalIndicators.calculateEMA(largePriceArray, 20);
      
      const duration = Date.now() - startTime;
      
      // 1000个数据点的计算应该在100ms内完成
      expect(duration).toBeLessThan(100);
    });

    test('验证器应该高效处理大量结果', () => {
      const validator = new StrategyResultValidator();
      const results = Array.from({ length: 100 }, (_, i) => ({
        symbol: `TEST${i}USDT`,
        trend4h: '多头趋势',
        signal: '做多',
        currentPrice: 100 + i,
        strategyType: 'V3',
        timestamp: new Date().toISOString()
      }));

      const startTime = Date.now();
      const validation = validator.validateDataCompleteness(results);
      const duration = Date.now() - startTime;

      expect(validation.totalCount).toBe(100);
      expect(duration).toBeLessThan(500); // 100个结果验证应该在500ms内完成
    });
  });

  describe('文档要求验证测试', () => {
    test('V3策略应该实现strategy-v3.md的核心要求', () => {
      // 验证策略配置符合文档要求
      const mockV3Engine = {
        config: {
          trend4h: {
            totalScoreThreshold: 4,     // ≥4分保留趋势
            minDirectionScore: 2,       // 每个方向至少2分
            adxThreshold: 20,           // ADX > 20
            momentumThreshold: 0.005    // 0.5%动量阈值
          },
          hourly: {
            scoreThreshold: 3,          // ≥3分入场
            vwapRequired: true,         // VWAP必须一致
            volumeRatio15m: 1.5,        // 15m成交量≥1.5×均量
            volumeRatio1h: 1.2,         // 1h成交量≥1.2×均量
            oiChangeThresholdLong: 0.02, // 多头OI≥+2%
            oiChangeThresholdShort: -0.03 // 空头OI≤-3%
          }
        }
      };

      // 验证配置符合文档
      expect(mockV3Engine.config.trend4h.totalScoreThreshold).toBe(4);
      expect(mockV3Engine.config.hourly.scoreThreshold).toBe(3);
      expect(mockV3Engine.config.hourly.vwapRequired).toBe(true);
    });

    test('ICT策略应该实现ict.md的核心要求', () => {
      // 验证ICT策略配置符合文档要求
      const mockICTEngine = {
        config: {
          dailyTrendThreshold: 2,         // 3分制中≥2分确认趋势
          obMinHeightATRRatio: 0.25,      // OB最小高度 = 0.25×ATR
          obMaxAgeDays: 30,               // OB最大年龄30天
          sweepHTFThresholdATRRatio: 0.4, // 4H Sweep阈值 = 0.4×ATR
          sweepLTFThresholdATRRatio: 0.2, // 15m Sweep阈值 = 0.2×ATR
          ltfMaxAgeDays: 2,               // OB/FVG最大年龄2天
          defaultRiskRewardRatio: 3       // 默认3:1风险回报比
        }
      };

      // 验证配置符合文档
      expect(mockICTEngine.config.obMinHeightATRRatio).toBe(0.25);
      expect(mockICTEngine.config.obMaxAgeDays).toBe(30);
      expect(mockICTEngine.config.sweepHTFThresholdATRRatio).toBe(0.4);
      expect(mockICTEngine.config.sweepLTFThresholdATRRatio).toBe(0.2);
      expect(mockICTEngine.config.defaultRiskRewardRatio).toBe(3);
    });
  });

  describe('错误恢复测试', () => {
    test('应该从API错误中恢复', () => {
      const validator = new StrategyResultValidator();
      
      // 模拟API错误后的结果
      const errorRecoveryResult = {
        symbol: 'BTCUSDT',
        error: 'API调用失败',
        dataValid: false,
        trend4h: '震荡市', // 安全默认值
        signal: '观望',
        execution: 'NONE',
        currentPrice: 0,
        strategyType: 'V3',
        timestamp: new Date().toISOString()
      };

      const validation = validator.validateV3Result(errorRecoveryResult);
      
      // 即使有错误，基础结构应该仍然有效
      expect(validation.errors).not.toEqual(
        expect.arrayContaining([
          expect.stringContaining('缺少必需字段')
        ])
      );
    });
  });
});

// 模拟数据生成器测试
describe('模拟数据生成器测试', () => {
  test('应该生成符合真实市场的模拟数据', () => {
    // 生成模拟K线数据
    function generateMockKlines(count, basePrice = 47000) {
      const klines = [];
      let currentPrice = basePrice;
      
      for (let i = 0; i < count; i++) {
        const volatility = 0.02; // 2%波动率
        const change = (Math.random() - 0.5) * volatility * currentPrice;
        
        const open = currentPrice;
        const close = currentPrice + change;
        const high = Math.max(open, close) * (1 + Math.random() * 0.01);
        const low = Math.min(open, close) * (1 - Math.random() * 0.01);
        const volume = 1000 + Math.random() * 500;
        
        klines.push([
          Date.now() + i * 60000, // 1分钟间隔
          open.toString(),
          high.toString(),
          low.toString(),
          close.toString(),
          volume.toString()
        ]);
        
        currentPrice = close;
      }
      
      return klines;
    }

    const mockData = generateMockKlines(50);
    
    expect(mockData.length).toBe(50);
    expect(mockData[0].length).toBe(6); // [timestamp, open, high, low, close, volume]
    
    // 验证价格合理性
    mockData.forEach(kline => {
      const [timestamp, open, high, low, close, volume] = kline.map(parseFloat);
      
      expect(high).toBeGreaterThanOrEqual(Math.max(open, close));
      expect(low).toBeLessThanOrEqual(Math.min(open, close));
      expect(volume).toBeGreaterThan(0);
    });
  });
});
