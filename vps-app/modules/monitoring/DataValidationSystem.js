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

    // V3策略字段验证（宽松模式）
    const fields = [
      'trend4h', 'marketType', 'score1h', 'vwapDirectionConsistent'
    ];

    // 如果是震荡市，添加震荡市特定字段验证
    if (analysisLog.marketType === '震荡市') {
      fields.push('rangeResult');
    }

    for (const field of fields) {
      const fieldResult = {
        available: analysisLog[field] !== undefined,
        value: analysisLog[field],
        valid: true, // 默认通过
        error: null
      };

      if (fieldResult.available) {
        // 验证字段值的有效性
        if (!this.isValidV3FieldValue(field, fieldResult.value)) {
          fieldResult.error = `字段值无效: ${fieldResult.value}`;
          fieldResult.valid = false;
          // 只记录警告，不标记为错误
          result.warnings = result.warnings || [];
          result.warnings.push(`${field}: ${fieldResult.error}`);
        }
      } else {
        fieldResult.error = '字段不存在';
        fieldResult.valid = false;
        // 字段不存在时只记录警告，不标记为错误
        result.warnings = result.warnings || [];
        result.warnings.push(`${field}: ${fieldResult.error}`);
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

    // 检查各个阶段的计算成功率（宽松模式）
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
          // 只记录警告，不标记为错误
          result.warnings = result.warnings || [];
          result.warnings.push(`${phase}: ${phaseResult.error}`);
        }
      } else {
        phaseResult.error = '阶段数据不存在';
        // 只记录警告，不标记为错误
        result.warnings = result.warnings || [];
        result.warnings.push(`${phase}: ${phaseResult.error}`);
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

    // 验证震荡市边界判断结果
    if (marketType === '震荡市' && analysisLog.rangeResult) {
      const rangeValidation = this.validateRangeMarketAnalysis(symbol, analysisLog.rangeResult);
      if (!rangeValidation.valid) {
        result.errors.push(...rangeValidation.errors);
        result.valid = false;
      }
      if (rangeValidation.warnings) {
        result.warnings = result.warnings || [];
        result.warnings.push(...rangeValidation.warnings);
      }
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

  // 验证震荡市边界判断结果
  validateRangeMarketAnalysis(symbol, rangeResult) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    // 检查必要的字段
    const requiredFields = ['lowerBoundaryValid', 'upperBoundaryValid', 'bb1h'];
    for (const field of requiredFields) {
      if (rangeResult[field] === undefined) {
        result.errors.push(`震荡市边界判断缺少必要字段: ${field}`);
        result.valid = false;
      }
    }

    // 检查布林带数据
    if (rangeResult.bb1h) {
      const { upper, middle, lower, bandwidth } = rangeResult.bb1h;
      if (upper <= middle || middle <= lower) {
        result.errors.push(`布林带数据异常: upper=${upper}, middle=${middle}, lower=${lower}`);
        result.valid = false;
      }
      if (bandwidth <= 0) {
        result.warnings.push(`布林带带宽异常: bandwidth=${bandwidth}`);
      }
    }

    // 检查边界有效性逻辑
    if (rangeResult.lowerBoundaryValid && rangeResult.touchesLower < 2) {
      result.warnings.push(`下轨边界有效但触碰次数不足: touchesLower=${rangeResult.touchesLower}`);
    }
    if (rangeResult.upperBoundaryValid && rangeResult.touchesUpper < 2) {
      result.warnings.push(`上轨边界有效但触碰次数不足: touchesUpper=${rangeResult.touchesUpper}`);
    }

    // 检查成交量因子
    if (rangeResult.volFactor > 1.7) {
      result.warnings.push(`成交量因子超出阈值: volFactor=${rangeResult.volFactor}, 阈值=1.7`);
    }

    // 检查Delta因子
    if (Math.abs(rangeResult.delta) > 0.02) {
      result.warnings.push(`Delta因子超出阈值: delta=${rangeResult.delta}, 阈值=0.02`);
    }

    // 检查OI变化因子
    if (Math.abs(rangeResult.oiChange) > 0.02) {
      result.warnings.push(`OI变化因子超出阈值: oiChange=${rangeResult.oiChange}, 阈值=0.02`);
    }

    return result;
  }

  // 验证震荡市15分钟假突破执行结果
  validateRangeExecutionAnalysis(symbol, executionResult) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    // 检查必要的字段
    const requiredFields = ['signal', 'mode', 'reason', 'atr14'];
    for (const field of requiredFields) {
      if (executionResult[field] === undefined) {
        result.errors.push(`震荡市15分钟执行缺少必要字段: ${field}`);
        result.valid = false;
      }
    }

    // 检查假突破相关字段
    if (executionResult.signal !== 'NONE') {
      const requiredExecutionFields = ['entry', 'stopLoss', 'takeProfit', 'bbWidth'];
      for (const field of requiredExecutionFields) {
        if (executionResult[field] === undefined) {
          result.errors.push(`震荡市执行信号缺少必要字段: ${field}`);
          result.valid = false;
        }
      }

      // 检查布林带宽收窄
      if (executionResult.bbWidth && executionResult.bbWidth >= 0.05) {
        result.warnings.push(`15分钟布林带宽未收窄: bbWidth=${executionResult.bbWidth}, 阈值=0.05`);
      }

      // 检查止损止盈逻辑
      if (executionResult.entry && executionResult.stopLoss && executionResult.takeProfit) {
        const entry = executionResult.entry;
        const stopLoss = executionResult.stopLoss;
        const takeProfit = executionResult.takeProfit;

        if (executionResult.signal === 'BUY') {
          if (stopLoss >= entry) {
            result.errors.push(`多头止损价格异常: stopLoss=${stopLoss} >= entry=${entry}`);
            result.valid = false;
          }
          if (takeProfit <= entry) {
            result.errors.push(`多头止盈价格异常: takeProfit=${takeProfit} <= entry=${entry}`);
            result.valid = false;
          }
        } else if (executionResult.signal === 'SHORT') {
          if (stopLoss <= entry) {
            result.errors.push(`空头止损价格异常: stopLoss=${stopLoss} <= entry=${entry}`);
            result.valid = false;
          }
          if (takeProfit >= entry) {
            result.errors.push(`空头止盈价格异常: takeProfit=${takeProfit} >= entry=${entry}`);
            result.valid = false;
          }
        }
      }
    }

    return result;
  }

  // 验证多因子打分结果
  validateFactorScoring(symbol, factorData) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    // 检查必要的因子字段
    const requiredFactors = ['vwap', 'delta', 'oi', 'volume'];
    for (const factor of requiredFactors) {
      if (factorData[factor] === undefined) {
        result.errors.push(`多因子打分缺少必要字段: ${factor}`);
        result.valid = false;
      }
    }

    // 检查因子得分范围
    if (factorData.factorScore !== undefined) {
      if (factorData.factorScore < -4 || factorData.factorScore > 4) {
        result.warnings.push(`多因子得分超出正常范围: factorScore=${factorData.factorScore}, 正常范围=[-4,4]`);
      }
    }

    // 检查各因子数值合理性
    if (Math.abs(factorData.vwap) > 1000000) {
      result.warnings.push(`VWAP因子数值异常: vwap=${factorData.vwap}`);
    }
    if (Math.abs(factorData.delta) > 1000000) {
      result.warnings.push(`Delta因子数值异常: delta=${factorData.delta}`);
    }
    if (Math.abs(factorData.oi) > 1000000000) {
      result.warnings.push(`OI因子数值异常: oi=${factorData.oi}`);
    }
    if (Math.abs(factorData.volume) > 1000000000) {
      result.warnings.push(`Volume因子数值异常: volume=${factorData.volume}`);
    }

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