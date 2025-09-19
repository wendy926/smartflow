// tests/unit/strategy-engine-basic.test.js
// 策略引擎基础单元测试 - 验证核心组件可用性

const StrategyResultValidator = require('../../src/core/modules/validation/StrategyResultValidator');

describe('策略引擎基础测试', () => {
  
  describe('策略结果验证器测试', () => {
    let validator;

    beforeEach(() => {
      validator = new StrategyResultValidator();
    });

    test('应该正确验证完整的V3策略结果', () => {
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

      expect(validation).toBeDefined();
      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
      expect(validation.score).toBeGreaterThan(60);
    });

    test('应该检测V3策略结果中的业务逻辑错误', () => {
      const invalidV3Result = {
        symbol: 'BTCUSDT',
        trend4h: '多头趋势',
        signal: '做空', // ❌ 逻辑错误: 多头趋势下做空
        execution: '做空_反抽破位',
        currentPrice: 47200,
        entrySignal: 47250,
        stopLoss: 46800,
        takeProfit: 48150,
        score: 5,
        score1h: 2, // ❌ 得分<3但有信号
        dataCollectionRate: 98.5,
        strategyType: 'V3',
        timestamp: new Date().toISOString()
      };

      const validation = validator.validateV3Result(invalidV3Result);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      
      // 检查具体的错误类型
      const errorMessages = validation.errors.join(' ');
      expect(errorMessages).toContain('多头趋势下不应出现做空信号');
      expect(errorMessages).toContain('1H得分<3但信号不为观望');
    });

    test('应该正确验证完整的ICT策略结果', () => {
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

    test('应该检测ICT策略结果中的业务逻辑错误', () => {
      const invalidICTResult = {
        symbol: 'BTCUSDT',
        dailyTrend: 'down',
        signalType: 'BOS_LONG', // ❌ 逻辑错误: 下降趋势下做多
        entryPrice: 47200,
        stopLoss: 46800,
        takeProfit: 48400,
        dailyTrendScore: 2,
        dataCollectionRate: 95.0,
        strategyType: 'ICT',
        timestamp: new Date().toISOString()
      };

      const validation = validator.validateICTResult(invalidICTResult);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors.join(' ')).toContain('下降趋势下不应出现LONG信号');
    });

    test('应该验证必需字段完整性', () => {
      const incompleteV3Result = {
        symbol: 'BTCUSDT',
        trend4h: '多头趋势'
        // 缺少其他必需字段: signal, execution, currentPrice, dataCollectionRate, strategyType, timestamp
      };

      const validation = validator.validateV3Result(incompleteV3Result);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      
      // 检查缺少的必需字段
      const errorMessages = validation.errors.join(' ');
      expect(errorMessages).toContain('缺少必需字段');
    });

    test('应该验证数据类型正确性', () => {
      const wrongTypeResult = {
        symbol: 123, // ❌ 应该是字符串
        trend4h: '多头趋势',
        signal: '做多',
        execution: '做多_突破确认',
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
        signal: '做多',
        execution: '做多_突破确认',
        currentPrice: -100, // ❌ 负价格
        entrySignal: 0, // ❌ 零价格
        stopLoss: 2000000, // ❌ 价格过高
        dataCollectionRate: 98.5,
        strategyType: 'V3',
        timestamp: new Date().toISOString()
      };

      const validation = validator.validateV3Result(unreasonablePriceResult);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('应该正确验证风险管理参数', () => {
      const validRiskData = {
        entry: 47200,
        stopLoss: 46800,
        takeProfit: 48000,
        direction: 'LONG',
        riskRewardRatio: 2,
        leverage: 10
      };

      const validation = validator.validateRiskManagement(validRiskData);

      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    test('应该检测风险管理逻辑错误', () => {
      const invalidRiskData = {
        entry: 47200,
        stopLoss: 47500, // ❌ 多头止损高于入场价
        takeProfit: 46800, // ❌ 多头止盈低于入场价
        direction: 'LONG'
      };

      const validation = validator.validateRiskManagement(invalidRiskData);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors.join(' ')).toContain('多头止损应低于入场价');
      expect(validation.errors.join(' ')).toContain('多头止盈应高于入场价');
    });
  });

  describe('策略一致性测试', () => {
    let validator;

    beforeEach(() => {
      validator = new StrategyResultValidator();
    });

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

      const validation = validator.validateStrategyConsistency(v3Results, ictResults);

      expect(validation.consistent).toBe(true);
      expect(validation.agreements.length).toBeGreaterThan(0);
      expect(validation.conflicts.length).toBe(0);
      expect(validation.agreements[0]).toContain('两策略方向一致(LONG)');
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

      const validation = validator.validateStrategyConsistency(v3Results, ictResults);

      expect(validation.consistent).toBe(false);
      expect(validation.conflicts.length).toBeGreaterThan(0);
      expect(validation.conflicts[0]).toContain('策略方向冲突');
    });

    test('应该处理策略信号分歧', () => {
      const v3Results = [{
        symbol: 'BTCUSDT',
        signal: '做多',
        currentPrice: 47200,
        strategyType: 'V3'
      }];

      const ictResults = [{
        symbol: 'BTCUSDT',
        signalType: 'WAIT', // V3有信号，ICT无信号
        entryPrice: 0,
        strategyType: 'ICT'
      }];

      const validation = validator.validateStrategyConsistency(v3Results, ictResults);

      expect(validation.divergences.length).toBeGreaterThan(0);
      expect(validation.divergences[0]).toContain('V3有信号');
    });
  });

  describe('数据完整性测试', () => {
    let validator;

    beforeEach(() => {
      validator = new StrategyResultValidator();
    });

    test('应该验证策略结果数据完整性', () => {
      const results = [
        {
          symbol: 'BTCUSDT',
          strategyType: 'V3',
          trend4h: '多头趋势',
          signal: '做多',
          execution: '做多_突破确认',
          currentPrice: 47200,
          dataCollectionRate: 98.5,
          timestamp: new Date().toISOString()
        },
        {
          symbol: 'ETHUSDT',
          strategyType: 'ICT',
          dailyTrend: 'up',
          signalType: 'BOS_LONG',
          entryPrice: 3200,
          dataCollectionRate: 95.0,
          timestamp: new Date().toISOString()
        }
      ];

      const validation = validator.validateDataCompleteness(results);

      expect(validation.totalCount).toBe(2);
      expect(validation.validCount).toBeGreaterThanOrEqual(0);
      expect(validation.completenessRate).toBeGreaterThanOrEqual(0);
    });

    test('应该检测数据收集率问题', () => {
      const results = [
        {
          symbol: 'BTCUSDT',
          strategyType: 'V3',
          trend4h: '多头趋势',
          signal: '做多',
          execution: '做多_突破确认',
          currentPrice: 47200,
          dataCollectionRate: 85, // ❌ 低于90%
          timestamp: new Date().toISOString()
        }
      ];

      const validation = validator.validateDataCompleteness(results);

      expect(validation.missingDataCount).toBe(1);
      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings[0]).toContain('数据收集率偏低');
    });
  });

  describe('文档符合性验证测试', () => {
    let validator;

    beforeEach(() => {
      validator = new StrategyResultValidator();
    });

    test('V3策略得分范围应该符合strategy-v3.md文档', () => {
      const testCases = [
        { score: 0, score1h: 0, valid: true },
        { score: 5, score1h: 3, valid: true },
        { score: 10, score1h: 6, valid: true },
        { score: 15, score1h: 8, valid: false }, // 超出范围
        { score: -1, score1h: -1, valid: false } // 超出范围
      ];

      testCases.forEach(({ score, score1h, valid }) => {
        const result = {
          symbol: 'BTCUSDT',
          trend4h: score >= 4 ? '多头趋势' : '震荡市',
          signal: score1h >= 3 ? '做多' : '观望',
          execution: score1h >= 3 ? '做多_突破确认' : 'NONE',
          currentPrice: 47200,
          score: score,
          score1h: score1h,
          dataCollectionRate: 98.5,
          strategyType: 'V3',
          timestamp: new Date().toISOString()
        };

        const validation = validator.validateV3Result(result);
        
        if (valid) {
          expect(validation.errors).not.toEqual(
            expect.arrayContaining([
              expect.stringContaining('得分字段score超出范围')
            ])
          );
        } else {
          expect(validation.errors).toEqual(
            expect.arrayContaining([
              expect.stringContaining('超出范围')
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
          dailyTrend: signalType.includes('LONG') ? 'up' : 
                     signalType.includes('SHORT') ? 'down' : 'sideways',
          signalType: signalType,
          entryPrice: signalType === 'WAIT' ? 0 : 47200,
          dataCollectionRate: 95,
          strategyType: 'ICT',
          timestamp: new Date().toISOString()
        };

        const validation = validator.validateICTResult(result);
        
        // 信号类型本身应该是有效的
        expect(validation.errors).not.toEqual(
          expect.arrayContaining([
            expect.stringContaining('无效信号类型')
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

  describe('错误处理测试', () => {
    let validator;

    beforeEach(() => {
      validator = new StrategyResultValidator();
    });

    test('应该处理缺少时间戳的情况', () => {
      const noTimestampResult = {
        symbol: 'BTCUSDT',
        trend4h: '多头趋势',
        signal: '做多',
        execution: '做多_突破确认',
        currentPrice: 47200,
        dataCollectionRate: 98.5,
        strategyType: 'V3'
        // 缺少timestamp
      };

      const validation = validator.validateV3Result(noTimestampResult);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('缺少必需字段: timestamp')
        ])
      );
    });

    test('应该处理无效的交易对格式', () => {
      const invalidSymbolResult = {
        symbol: 'INVALID_SYMBOL', // ❌ 不符合格式
        trend4h: '多头趋势',
        signal: '做多',
        execution: '做多_突破确认',
        currentPrice: 47200,
        dataCollectionRate: 98.5,
        strategyType: 'V3',
        timestamp: new Date().toISOString()
      };

      const validation = validator.validateV3Result(invalidSymbolResult);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('交易对格式无效')
        ])
      );
    });

    test('应该处理过期的时间戳', () => {
      const oldTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10分钟前

      const staleResult = {
        symbol: 'BTCUSDT',
        trend4h: '多头趋势',
        signal: '做多',
        execution: '做多_突破确认',
        currentPrice: 47200,
        dataCollectionRate: 98.5,
        strategyType: 'V3',
        timestamp: oldTimestamp
      };

      const validation = validator.validateV3Result(staleResult);

      // 过期时间戳应该产生警告，但不一定是错误
      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings.join(' ')).toContain('时间戳过旧');
    });
  });

  describe('快速验证测试', () => {
    let validator;

    beforeEach(() => {
      validator = new StrategyResultValidator();
    });

    test('快速验证应该检查关键字段', () => {
      const validResult = {
        symbol: 'BTCUSDT',
        strategyType: 'V3',
        timestamp: new Date().toISOString()
      };

      const validation = validator.quickValidate(validResult);

      expect(validation.valid).toBe(true);
      expect(validation.error).toBeUndefined();
    });

    test('快速验证应该检测缺少关键字段', () => {
      const invalidResult = {
        symbol: 'BTCUSDT'
        // 缺少strategyType和timestamp
      };

      const validation = validator.quickValidate(invalidResult);

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('缺少关键字段');
    });
  });

  describe('验证报告生成测试', () => {
    let validator;

    beforeEach(() => {
      validator = new StrategyResultValidator();
    });

    test('应该生成完整的验证报告', () => {
      const v3Validation = {
        valid: true,
        errors: [],
        warnings: ['轻微警告'],
        score: 85
      };

      const ictValidation = {
        valid: true,
        errors: [],
        warnings: [],
        score: 90
      };

      const consistencyValidation = {
        consistent: true,
        conflicts: [],
        agreements: ['BTCUSDT: 两策略方向一致(LONG)'],
        divergences: []
      };

      const report = validator.generateValidationReport(v3Validation, ictValidation, consistencyValidation);

      expect(report).toBeDefined();
      expect(report.overall.valid).toBe(true);
      expect(report.overall.v3Valid).toBe(true);
      expect(report.overall.ictValid).toBe(true);
      expect(report.overall.consistencyValid).toBe(true);
      expect(report.summary.avgScore).toBe(87.5);
      expect(report.details.consistency.agreements.length).toBeGreaterThan(0);
    });

    test('应该在验证失败时生成错误报告', () => {
      const v3Validation = {
        valid: false,
        errors: ['V3策略错误1', 'V3策略错误2'],
        warnings: [],
        score: 40
      };

      const ictValidation = {
        valid: false,
        errors: ['ICT策略错误1'],
        warnings: ['ICT策略警告1'],
        score: 30
      };

      const report = validator.generateValidationReport(v3Validation, ictValidation);

      expect(report.overall.valid).toBe(false);
      expect(report.summary.totalErrors).toBe(3);
      expect(report.summary.totalWarnings).toBe(1);
      expect(report.summary.avgScore).toBe(35);
    });
  });

  describe('性能基准测试', () => {
    test('验证器应该高效处理大量结果', () => {
      const validator = new StrategyResultValidator();
      
      // 生成100个模拟结果
      const results = Array.from({ length: 100 }, (_, i) => ({
        symbol: `TEST${i}USDT`,
        trend4h: '多头趋势',
        signal: '做多',
        execution: '做多_突破确认',
        currentPrice: 100 + i,
        dataCollectionRate: 95 + Math.random() * 5,
        strategyType: 'V3',
        timestamp: new Date().toISOString()
      }));

      const startTime = Date.now();
      const validation = validator.validateDataCompleteness(results);
      const duration = Date.now() - startTime;

      expect(validation.totalCount).toBe(100);
      expect(duration).toBeLessThan(1000); // 1秒内完成100个结果验证
    });
  });
});

// 模拟组件测试
describe('模拟组件测试', () => {
  
  describe('模拟策略引擎测试', () => {
    test('模拟V3策略引擎应该返回正确格式', () => {
      // 模拟V3策略引擎的基本功能
      class MockV3Engine {
        analyzeSymbol(symbol) {
          return {
            symbol,
            strategyType: 'V3',
            trend4h: '多头趋势',
            signal: '做多',
            execution: '做多_突破确认',
            currentPrice: 47200,
            score: 5,
            score1h: 4,
            dataCollectionRate: 98.5,
            timestamp: new Date().toISOString(),
            engineSource: 'mock'
          };
        }
      }

      const mockEngine = new MockV3Engine();
      const result = mockEngine.analyzeSymbol('BTCUSDT');

      expect(result.symbol).toBe('BTCUSDT');
      expect(result.strategyType).toBe('V3');
      expect(result.engineSource).toBe('mock');
    });

    test('模拟ICT策略引擎应该返回正确格式', () => {
      // 模拟ICT策略引擎的基本功能
      class MockICTEngine {
        analyzeSymbol(symbol) {
          return {
            symbol,
            strategyType: 'ICT',
            dailyTrend: 'up',
            signalType: 'BOS_LONG',
            entryPrice: 47200,
            stopLoss: 46800,
            takeProfit: 48400,
            dailyTrendScore: 2,
            obDetected: true,
            riskRewardRatio: 3,
            dataCollectionRate: 95.0,
            timestamp: new Date().toISOString(),
            engineSource: 'mock'
          };
        }
      }

      const mockEngine = new MockICTEngine();
      const result = mockEngine.analyzeSymbol('BTCUSDT');

      expect(result.symbol).toBe('BTCUSDT');
      expect(result.strategyType).toBe('ICT');
      expect(result.engineSource).toBe('mock');
    });
  });
});
