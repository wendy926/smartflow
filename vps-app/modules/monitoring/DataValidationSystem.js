// modules/monitoring/DataValidationSystem.js
// V3策略数据验证系统 - 专注于监控数据计算成功率

class DataValidationSystem {
  constructor(database = null) {
    this.database = database;
    this.validationResults = new Map(); // 存储每个交易对的验证结果
  }

  // 验证单个交易对的V3策略数据
  async validateSymbol(symbol, analysisLog) {
    const validationResult = {
      symbol,
      timestamp: new Date().toISOString(),
      overallStatus: 'PASS',
      errors: [],
      warnings: [],
      details: {}
    };

    try {
      // 1. 验证V3策略核心字段
      const coreFieldsValidation = this.validateV3CoreFields(symbol, analysisLog);
      validationResult.details.coreFields = coreFieldsValidation;
      if (!coreFieldsValidation.valid) {
        validationResult.errors.push(...coreFieldsValidation.errors);
        validationResult.overallStatus = 'FAIL';
      }

      // 2. 验证数据计算成功率
      const calculationSuccessValidation = this.validateCalculationSuccess(symbol, analysisLog);
      validationResult.details.calculationSuccess = calculationSuccessValidation;
      if (!calculationSuccessValidation.valid) {
        validationResult.errors.push(...calculationSuccessValidation.errors);
        validationResult.overallStatus = 'FAIL';
      }

      // 3. 验证策略分析结果
      const strategyValidation = this.validateV3StrategyAnalysis(symbol, analysisLog);
      validationResult.details.strategy = strategyValidation;
      if (!strategyValidation.valid) {
        validationResult.errors.push(...strategyValidation.errors);
        validationResult.overallStatus = 'FAIL';
      }

    } catch (error) {
      validationResult.errors.push(`验证过程异常: ${error.message}`);
      validationResult.overallStatus = 'ERROR';
    }

    this.validationResults.set(symbol, validationResult);
    return validationResult;
  }

  // 验证V3策略核心字段
  validateV3CoreFields(symbol, analysisLog) {
    const result = {
      valid: true,
      errors: [],
      fields: {}
    };

    // V3策略必需的核心字段
    const requiredFields = [
      'trend4h', 'marketType', 'score1h', 'vwapDirectionConsistent'
    ];

    for (const field of requiredFields) {
      const fieldResult = {
        available: analysisLog[field] !== undefined,
        value: analysisLog[field],
        valid: false,
        error: null
      };

      if (fieldResult.available) {
        // 验证字段值的有效性
        if (this.isValidV3FieldValue(field, fieldResult.value)) {
          fieldResult.valid = true;
        } else {
          fieldResult.error = `字段值无效: ${fieldResult.value}`;
          result.errors.push(`${field}: ${fieldResult.error}`);
          result.valid = false;
        }
      } else {
        fieldResult.error = '字段不存在';
        result.errors.push(`${field}: ${fieldResult.error}`);
        result.valid = false;
      }

      result.fields[field] = fieldResult;
    }

    return result;
  }

  // 验证字段值的有效性
  isValidV3FieldValue(field, value) {
    switch (field) {
      case 'trend4h':
        return ['多头趋势', '空头趋势', '震荡市'].includes(value);
      case 'marketType':
        return ['趋势市', '震荡市'].includes(value);
      case 'score1h':
        return typeof value === 'number' && value >= 0 && value <= 6;
      case 'vwapDirectionConsistent':
        return typeof value === 'boolean';
      default:
        return value !== undefined && value !== null;
    }
  }

  // 验证数据计算成功率
  validateCalculationSuccess(symbol, analysisLog) {
    const result = {
      valid: true,
      errors: [],
      phases: {}
    };

    // 检查各个阶段的计算成功率
    const phases = ['dataCollection', 'signalAnalysis', 'simulationTrading'];

    for (const phase of phases) {
      const phaseResult = {
        success: false,
        error: null,
        details: {}
      };

      const phaseData = analysisLog?.phases?.[phase];
      if (phaseData) {
        phaseResult.success = phaseData.success || false;
        phaseResult.details = phaseData;

        if (!phaseResult.success) {
          phaseResult.error = phaseData.error || '计算失败';
          result.errors.push(`${phase}: ${phaseResult.error}`);
          result.valid = false;
        }
      } else {
        phaseResult.error = '阶段数据不存在';
        result.errors.push(`${phase}: ${phaseResult.error}`);
        result.valid = false;
      }

      result.phases[phase] = phaseResult;
    }

    return result;
  }

  // 验证V3策略分析结果
  validateV3StrategyAnalysis(symbol, analysisLog) {
    const result = {
      valid: true,
      errors: [],
      analysis: {}
    };

    // 检查策略分析结果的一致性
    const trend4h = analysisLog.trend4h;
    const marketType = analysisLog.marketType;
    const score1h = analysisLog.score1h;
    const vwapDirectionConsistent = analysisLog.vwapDirectionConsistent;

    // 验证趋势市和震荡市的逻辑一致性
    if (trend4h && marketType) {
      const isTrendMarket = ['多头趋势', '空头趋势'].includes(trend4h);
      const expectedMarketType = isTrendMarket ? '趋势市' : '震荡市';
      
      if (marketType !== expectedMarketType) {
        result.errors.push(`市场类型不一致: trend4h=${trend4h}, marketType=${marketType}, 期望=${expectedMarketType}`);
        result.valid = false;
      }
    }

    // 验证震荡市不需要多因子得分
    if (marketType === '震荡市' && score1h !== 0) {
      result.warnings.push(`震荡市不应该有多因子得分: score1h=${score1h}`);
    }

    // 验证趋势市需要VWAP方向一致性
    if (marketType === '趋势市' && vwapDirectionConsistent === false) {
      result.warnings.push(`趋势市VWAP方向不一致: vwapDirectionConsistent=${vwapDirectionConsistent}`);
    }

    result.analysis = {
      trend4h,
      marketType,
      score1h,
      vwapDirectionConsistent,
      consistency: result.valid
    };

    return result;
  }

  // 记录验证结果到数据库
  async recordValidationResult(symbol, validationResult) {
    if (!this.database) return;

    try {
      await this.database.run(`
        INSERT OR REPLACE INTO validation_results (
          symbol, timestamp, overall_status, errors, warnings, details
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [
        symbol,
        validationResult.timestamp,
        validationResult.overallStatus,
        JSON.stringify(validationResult.errors),
        JSON.stringify(validationResult.warnings),
        JSON.stringify(validationResult.details)
      ]);
    } catch (error) {
      console.error(`记录验证结果失败 [${symbol}]:`, error);
    }
  }

  // 获取验证结果统计
  getValidationStats() {
    const stats = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: 0,
      warnings: 0
    };

    for (const [symbol, result] of this.validationResults) {
      stats.total++;
      if (result.overallStatus === 'PASS') {
        stats.passed++;
      } else {
        stats.failed++;
      }
      stats.errors += result.errors.length;
      stats.warnings += result.warnings.length;
    }

    return stats;
  }

  // 清空验证结果
  clearValidationResults() {
    this.validationResults.clear();
    console.log('✅ 验证结果已清空');
  }
}

module.exports = DataValidationSystem;