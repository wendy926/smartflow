// StrategyResultValidator.js - 策略结果验证器
// 确保策略分析结果的完整性和正确性

/**
 * 策略结果验证器
 * 
 * 职责:
 * 1. 验证V3策略分析结果的完整性和正确性
 * 2. 验证ICT策略分析结果的完整性和正确性
 * 3. 验证风险管理参数的合理性
 * 4. 验证价格数据的有效性
 */
class StrategyResultValidator {
  constructor() {
    this.validationRules = {
      // V3策略验证规则
      v3: {
        requiredFields: [
          'symbol', 'trend4h', 'signal', 'execution', 'currentPrice',
          'dataCollectionRate', 'strategyType', 'timestamp'
        ],
        optionalFields: [
          'entrySignal', 'stopLoss', 'takeProfit', 'score', 'score1h',
          'hourlyJudgment', 'fifteenMinJudgment', 'category'
        ],
        priceFields: ['currentPrice', 'entrySignal', 'stopLoss', 'takeProfit'],
        scoreRanges: {
          score: [0, 10],          // 4H趋势得分 0-10分
          score1h: [0, 6],         // 1H多因子得分 0-6分
          dataCollectionRate: [0, 100] // 数据收集率 0-100%
        }
      },
      
      // ICT策略验证规则
      ict: {
        requiredFields: [
          'symbol', 'dailyTrend', 'signalType', 'entryPrice',
          'dataCollectionRate', 'strategyType', 'timestamp'
        ],
        optionalFields: [
          'stopLoss', 'takeProfit', 'dailyTrendScore', 'signalStrength',
          'obDetected', 'fvgDetected', 'sweepHTF', 'engulfingDetected',
          'sweepLTF', 'volumeConfirm', 'riskRewardRatio', 'leverage'
        ],
        priceFields: ['entryPrice', 'stopLoss', 'takeProfit'],
        scoreRanges: {
          dailyTrendScore: [0, 3],     // 1D趋势得分 0-3分
          riskRewardRatio: [1, 5],     // 风险回报比 1-5
          leverage: [1, 125],          // 杠杆 1-125倍
          dataCollectionRate: [0, 100] // 数据收集率 0-100%
        }
      },
      
      // 通用验证规则
      common: {
        priceRange: [0.001, 1000000], // 价格范围
        timestampMaxAge: 300000,       // 时间戳最大年龄5分钟
        symbolPattern: /^[A-Z]{3,10}USDT$/ // 交易对格式
      }
    };
  }

  /**
   * 验证V3策略结果
   * @param {Object} result - V3策略分析结果
   * @returns {Object} 验证结果
   */
  validateV3Result(result) {
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
      score: 100
    };

    try {
      // 1. 基础字段验证
      this.validateRequiredFields(result, this.validationRules.v3.requiredFields, validation);

      // 2. 数据类型验证
      this.validateDataTypes(result, validation);

      // 3. 价格字段验证
      this.validatePriceFields(result, this.validationRules.v3.priceFields, validation);

      // 4. 得分范围验证
      this.validateScoreRanges(result, this.validationRules.v3.scoreRanges, validation);

      // 5. V3特定业务逻辑验证
      this.validateV3BusinessLogic(result, validation);

      // 6. 时间戳验证
      this.validateTimestamp(result, validation);

      // 7. 交易对格式验证
      this.validateSymbolFormat(result, validation);

    } catch (error) {
      validation.valid = false;
      validation.errors.push(`验证过程异常: ${error.message}`);
      validation.score = 0;
    }

    // 计算最终验证得分
    validation.score = Math.max(0, validation.score - validation.errors.length * 20 - validation.warnings.length * 5);
    validation.valid = validation.valid && validation.errors.length === 0 && validation.score >= 60;

    return validation;
  }

  /**
   * 验证ICT策略结果
   * @param {Object} result - ICT策略分析结果
   * @returns {Object} 验证结果
   */
  validateICTResult(result) {
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
      score: 100
    };

    try {
      // 1. 基础字段验证
      this.validateRequiredFields(result, this.validationRules.ict.requiredFields, validation);

      // 2. 数据类型验证
      this.validateDataTypes(result, validation);

      // 3. 价格字段验证
      this.validatePriceFields(result, this.validationRules.ict.priceFields, validation);

      // 4. 得分范围验证
      this.validateScoreRanges(result, this.validationRules.ict.scoreRanges, validation);

      // 5. ICT特定业务逻辑验证
      this.validateICTBusinessLogic(result, validation);

      // 6. 时间戳验证
      this.validateTimestamp(result, validation);

      // 7. 交易对格式验证
      this.validateSymbolFormat(result, validation);

    } catch (error) {
      validation.valid = false;
      validation.errors.push(`验证过程异常: ${error.message}`);
      validation.score = 0;
    }

    // 计算最终验证得分
    validation.score = Math.max(0, validation.score - validation.errors.length * 20 - validation.warnings.length * 5);
    validation.valid = validation.valid && validation.errors.length === 0 && validation.score >= 60;

    return validation;
  }

  /**
   * 验证必需字段
   */
  validateRequiredFields(result, requiredFields, validation) {
    for (const field of requiredFields) {
      if (!(field in result) || result[field] === undefined || result[field] === null) {
        validation.errors.push(`缺少必需字段: ${field}`);
      }
    }
  }

  /**
   * 验证数据类型
   */
  validateDataTypes(result, validation) {
    // 字符串字段
    const stringFields = ['symbol', 'trend4h', 'signal', 'execution', 'strategyType', 'timestamp'];
    for (const field of stringFields) {
      if (field in result && typeof result[field] !== 'string') {
        validation.errors.push(`字段${field}应为字符串类型，实际为${typeof result[field]}`);
      }
    }

    // 数字字段
    const numberFields = ['currentPrice', 'entrySignal', 'stopLoss', 'takeProfit', 'score', 'dataCollectionRate'];
    for (const field of numberFields) {
      if (field in result && result[field] !== null && typeof result[field] !== 'number') {
        validation.errors.push(`字段${field}应为数字类型，实际为${typeof result[field]}`);
      }
    }

    // 布尔字段
    const booleanFields = ['dataValid', 'obDetected', 'fvgDetected', 'sweepHTF'];
    for (const field of booleanFields) {
      if (field in result && result[field] !== null && typeof result[field] !== 'boolean') {
        validation.errors.push(`字段${field}应为布尔类型，实际为${typeof result[field]}`);
      }
    }
  }

  /**
   * 验证价格字段
   */
  validatePriceFields(result, priceFields, validation) {
    const [minPrice, maxPrice] = this.validationRules.common.priceRange;

    for (const field of priceFields) {
      if (field in result && result[field] !== null && result[field] !== 0) {
        const price = result[field];
        
        if (typeof price !== 'number' || isNaN(price)) {
          validation.errors.push(`价格字段${field}无效: ${price}`);
          continue;
        }

        if (price < minPrice || price > maxPrice) {
          validation.errors.push(`价格字段${field}超出合理范围: ${price} (范围: ${minPrice}-${maxPrice})`);
        }

        if (price <= 0) {
          validation.errors.push(`价格字段${field}必须为正数: ${price}`);
        }
      }
    }
  }

  /**
   * 验证得分范围
   */
  validateScoreRanges(result, scoreRanges, validation) {
    for (const [field, [min, max]] of Object.entries(scoreRanges)) {
      if (field in result && result[field] !== null) {
        const value = result[field];
        
        if (typeof value !== 'number' || isNaN(value)) {
          validation.errors.push(`得分字段${field}无效: ${value}`);
          continue;
        }

        if (value < min || value > max) {
          validation.errors.push(`得分字段${field}超出范围: ${value} (范围: ${min}-${max})`);
        }
      }
    }
  }

  /**
   * 验证V3特定业务逻辑
   */
  validateV3BusinessLogic(result, validation) {
    // 1. 趋势与信号一致性验证
    if (result.trend4h === '多头趋势' && result.signal === '做空') {
      validation.errors.push('多头趋势下不应出现做空信号');
    }
    if (result.trend4h === '空头趋势' && result.signal === '做多') {
      validation.errors.push('空头趋势下不应出现做多信号');
    }

    // 2. 得分与信号一致性验证
    if (result.score1h >= 3 && result.signal === '观望') {
      validation.warnings.push('1H得分≥3但信号为观望，可能存在逻辑问题');
    }
    if (result.score1h < 3 && result.signal !== '观望') {
      validation.errors.push('1H得分<3但信号不为观望，违反策略规则');
    }

    // 3. 执行信号与价格验证
    if (result.execution && result.execution !== 'NONE') {
      if (!result.entrySignal || result.entrySignal <= 0) {
        validation.errors.push('有执行信号但入场价格无效');
      }
      if (!result.stopLoss || result.stopLoss <= 0) {
        validation.warnings.push('有执行信号但止损价格无效');
      }
      if (!result.takeProfit || result.takeProfit <= 0) {
        validation.warnings.push('有执行信号但止盈价格无效');
      }
    }

    // 4. 风险管理合理性验证
    if (result.entrySignal && result.stopLoss && result.takeProfit) {
      const stopDistance = Math.abs(result.entrySignal - result.stopLoss);
      const profitDistance = Math.abs(result.takeProfit - result.entrySignal);
      const riskRewardRatio = profitDistance / stopDistance;

      if (riskRewardRatio < 1.5 || riskRewardRatio > 5) {
        validation.warnings.push(`风险回报比异常: ${riskRewardRatio.toFixed(2)} (建议范围: 1.5-5)`);
      }

      const stopDistancePct = (stopDistance / result.entrySignal) * 100;
      if (stopDistancePct > 10) {
        validation.warnings.push(`止损距离过大: ${stopDistancePct.toFixed(2)}% > 10%`);
      }
    }
  }

  /**
   * 验证ICT特定业务逻辑
   */
  validateICTBusinessLogic(result, validation) {
    // 1. 1D趋势与信号一致性验证
    if (result.dailyTrend === 'up' && result.signalType && result.signalType.includes('SHORT')) {
      validation.errors.push('上升趋势下不应出现SHORT信号');
    }
    if (result.dailyTrend === 'down' && result.signalType && result.signalType.includes('LONG')) {
      validation.errors.push('下降趋势下不应出现LONG信号');
    }
    if (result.dailyTrend === 'sideways' && result.signalType !== 'WAIT') {
      validation.errors.push('震荡趋势下应为WAIT信号');
    }

    // 2. 结构检测逻辑验证
    if (result.signalType && result.signalType !== 'WAIT') {
      if (!result.obDetected && !result.fvgDetected) {
        validation.warnings.push('有信号但未检测到OB或FVG结构');
      }
      if (!result.sweepHTF) {
        validation.warnings.push('有信号但未检测到4H Sweep');
      }
    }

    // 3. 入场确认逻辑验证
    if (result.signalType && result.signalType.startsWith('BOS_')) {
      if (!result.obDetected) {
        validation.errors.push('BOS信号但未检测到OB');
      }
    }
    if (result.signalType && result.signalType.startsWith('CHoCH_')) {
      if (!result.engulfingDetected) {
        validation.warnings.push('CHoCH信号但未检测到吞没形态');
      }
    }
    if (result.signalType && result.signalType.startsWith('MIT_')) {
      if (!result.sweepLTF) {
        validation.warnings.push('MIT信号但未检测到15m Sweep');
      }
    }

    // 4. 风险回报比验证
    if (result.riskRewardRatio && (result.riskRewardRatio < 2 || result.riskRewardRatio > 5)) {
      validation.warnings.push(`ICT风险回报比异常: ${result.riskRewardRatio} (建议范围: 2-5)`);
    }
  }

  /**
   * 验证时间戳
   */
  validateTimestamp(result, validation) {
    if (!result.timestamp) {
      validation.errors.push('缺少时间戳');
      return;
    }

    try {
      const timestamp = new Date(result.timestamp);
      const now = new Date();
      const age = now.getTime() - timestamp.getTime();

      if (age > this.validationRules.common.timestampMaxAge) {
        validation.warnings.push(`时间戳过旧: ${Math.round(age / 1000)}秒前`);
      }

      if (timestamp > now) {
        validation.errors.push('时间戳不能是未来时间');
      }

    } catch (error) {
      validation.errors.push(`时间戳格式无效: ${result.timestamp}`);
    }
  }

  /**
   * 验证交易对格式
   */
  validateSymbolFormat(result, validation) {
    if (!result.symbol) {
      validation.errors.push('缺少交易对symbol');
      return;
    }

    if (!this.validationRules.common.symbolPattern.test(result.symbol)) {
      validation.errors.push(`交易对格式无效: ${result.symbol}`);
    }
  }

  /**
   * 验证风险管理参数
   * @param {Object} riskData - 风险管理数据
   * @returns {Object} 验证结果
   */
  validateRiskManagement(riskData) {
    const validation = {
      valid: true,
      errors: [],
      warnings: []
    };

    // 1. 基础价格验证
    if (!riskData.entry || riskData.entry <= 0) {
      validation.errors.push('入场价格无效');
    }
    if (!riskData.stopLoss || riskData.stopLoss <= 0) {
      validation.errors.push('止损价格无效');
    }
    if (!riskData.takeProfit || riskData.takeProfit <= 0) {
      validation.errors.push('止盈价格无效');
    }

    // 2. 价格逻辑验证
    if (riskData.entry && riskData.stopLoss && riskData.takeProfit) {
      // 检查止损和止盈的方向逻辑
      if (riskData.direction === 'LONG') {
        if (riskData.stopLoss >= riskData.entry) {
          validation.errors.push('多头止损应低于入场价');
        }
        if (riskData.takeProfit <= riskData.entry) {
          validation.errors.push('多头止盈应高于入场价');
        }
      } else if (riskData.direction === 'SHORT') {
        if (riskData.stopLoss <= riskData.entry) {
          validation.errors.push('空头止损应高于入场价');
        }
        if (riskData.takeProfit >= riskData.entry) {
          validation.errors.push('空头止盈应低于入场价');
        }
      }
    }

    // 3. 风险回报比验证
    if (riskData.riskRewardRatio) {
      if (riskData.riskRewardRatio < 1 || riskData.riskRewardRatio > 10) {
        validation.warnings.push(`风险回报比异常: ${riskData.riskRewardRatio}`);
      }
    }

    // 4. 杠杆验证
    if (riskData.leverage) {
      if (riskData.leverage < 1 || riskData.leverage > 125) {
        validation.errors.push(`杠杆超出范围: ${riskData.leverage} (范围: 1-125)`);
      }
    }

    // 5. 保证金验证
    if (riskData.margin && riskData.notional && riskData.leverage) {
      const expectedMargin = riskData.notional / riskData.leverage;
      const marginDiff = Math.abs(riskData.margin - expectedMargin) / expectedMargin;
      
      if (marginDiff > 0.01) { // 1%误差容忍
        validation.warnings.push(`保证金计算可能有误: ${riskData.margin} vs ${expectedMargin.toFixed(2)}`);
      }
    }

    validation.valid = validation.errors.length === 0;
    return validation;
  }

  /**
   * 验证数据完整性
   * @param {Array} results - 策略结果数组
   * @returns {Object} 完整性验证结果
   */
  validateDataCompleteness(results) {
    const validation = {
      valid: true,
      totalCount: results.length,
      validCount: 0,
      invalidCount: 0,
      missingDataCount: 0,
      errors: [],
      warnings: []
    };

    for (const result of results) {
      // 根据策略类型选择验证规则
      let individualValidation;
      if (result.strategyType === 'V3') {
        individualValidation = this.validateV3Result(result);
      } else if (result.strategyType === 'ICT') {
        individualValidation = this.validateICTResult(result);
      } else {
        validation.errors.push(`未知策略类型: ${result.strategyType}`);
        validation.invalidCount++;
        continue;
      }

      if (individualValidation.valid) {
        validation.validCount++;
      } else {
        validation.invalidCount++;
        validation.errors.push(`${result.symbol}(${result.strategyType}): ${individualValidation.errors.join(', ')}`);
      }

      // 检查数据缺失
      if (result.dataCollectionRate < 90) {
        validation.missingDataCount++;
        validation.warnings.push(`${result.symbol}数据收集率偏低: ${result.dataCollectionRate}%`);
      }
    }

    // 计算整体完整性
    const completenessRate = validation.validCount / Math.max(validation.totalCount, 1);
    validation.completenessRate = completenessRate * 100;
    validation.valid = completenessRate >= 0.8; // 80%以上认为有效

    return validation;
  }

  /**
   * 验证策略一致性 (V3和ICT结果对比)
   */
  validateStrategyConsistency(v3Results, ictResults) {
    const validation = {
      consistent: true,
      conflicts: [],
      agreements: [],
      divergences: []
    };

    // 按交易对分组对比
    const v3Map = new Map();
    const ictMap = new Map();

    v3Results.forEach(result => v3Map.set(result.symbol, result));
    ictResults.forEach(result => ictMap.set(result.symbol, result));

    // 找出共同的交易对
    const commonSymbols = [...v3Map.keys()].filter(symbol => ictMap.has(symbol));

    for (const symbol of commonSymbols) {
      const v3 = v3Map.get(symbol);
      const ict = ictMap.get(symbol);

      // 比较信号方向
      const v3Direction = this.extractDirection(v3.signal || v3.execution);
      const ictDirection = this.extractDirection(ict.signalType);

      if (v3Direction && ictDirection) {
        if (v3Direction === ictDirection) {
          validation.agreements.push(`${symbol}: 两策略方向一致(${v3Direction})`);
        } else {
          validation.conflicts.push(`${symbol}: 策略方向冲突(V3:${v3Direction}, ICT:${ictDirection})`);
          validation.consistent = false;
        }
      } else if (v3Direction && !ictDirection) {
        validation.divergences.push(`${symbol}: V3有信号(${v3Direction})，ICT无信号`);
      } else if (!v3Direction && ictDirection) {
        validation.divergences.push(`${symbol}: ICT有信号(${ictDirection})，V3无信号`);
      }

      // 比较价格合理性
      if (v3.currentPrice && ict.entryPrice) {
        const priceDiff = Math.abs(v3.currentPrice - ict.entryPrice) / v3.currentPrice;
        if (priceDiff > 0.01) { // 1%差异
          validation.warnings.push(`${symbol}: 价格差异较大(${(priceDiff * 100).toFixed(2)}%)`);
        }
      }
    }

    return validation;
  }

  /**
   * 提取信号方向
   */
  extractDirection(signal) {
    if (!signal || signal === 'NONE' || signal === 'WAIT' || signal === '观望') {
      return null;
    }

    if (signal.includes('LONG') || signal.includes('做多')) {
      return 'LONG';
    }
    if (signal.includes('SHORT') || signal.includes('做空')) {
      return 'SHORT';
    }

    return null;
  }

  /**
   * 生成验证报告
   */
  generateValidationReport(v3Validation, ictValidation, consistencyValidation = null) {
    const report = {
      timestamp: new Date().toISOString(),
      overall: {
        valid: v3Validation.valid && ictValidation.valid,
        v3Valid: v3Validation.valid,
        ictValid: ictValidation.valid,
        consistencyValid: consistencyValidation?.consistent ?? true
      },
      details: {
        v3: {
          score: v3Validation.score,
          errors: v3Validation.errors,
          warnings: v3Validation.warnings
        },
        ict: {
          score: ictValidation.score,
          errors: ictValidation.errors,
          warnings: ictValidation.warnings
        }
      },
      summary: {
        totalErrors: v3Validation.errors.length + ictValidation.errors.length,
        totalWarnings: v3Validation.warnings.length + ictValidation.warnings.length,
        avgScore: (v3Validation.score + ictValidation.score) / 2
      }
    };

    if (consistencyValidation) {
      report.details.consistency = {
        conflicts: consistencyValidation.conflicts,
        agreements: consistencyValidation.agreements,
        divergences: consistencyValidation.divergences
      };
    }

    return report;
  }

  /**
   * 快速验证 (仅检查关键字段)
   */
  quickValidate(result) {
    const critical = [
      'symbol', 'strategyType', 'timestamp'
    ];

    for (const field of critical) {
      if (!(field in result) || result[field] === undefined || result[field] === null) {
        return { valid: false, error: `缺少关键字段: ${field}` };
      }
    }

    return { valid: true };
  }
}

module.exports = StrategyResultValidator;
