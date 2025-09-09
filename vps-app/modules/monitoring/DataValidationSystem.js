// modules/monitoring/DataValidationSystem.js
// 统一数据验证系统

class DataValidationSystem {
  constructor(database = null) {
    this.database = database;
    this.validationResults = new Map(); // 存储每个交易对的验证结果
  }

  // 验证单个交易对的所有指标
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
      // 1. 验证原始数据完整性
      const rawDataValidation = this.validateRawData(symbol, analysisLog);
      validationResult.details.rawData = rawDataValidation;
      if (!rawDataValidation.valid) {
        validationResult.errors.push(...rawDataValidation.errors);
        validationResult.overallStatus = 'FAIL';
      }

      // 2. 验证技术指标计算
      const indicatorsValidation = this.validateIndicators(symbol, analysisLog);
      validationResult.details.indicators = indicatorsValidation;
      if (!indicatorsValidation.valid) {
        validationResult.errors.push(...indicatorsValidation.errors);
        validationResult.overallStatus = 'FAIL';
      }

      // 3. 验证策略分析结果
      const strategyValidation = this.validateStrategyAnalysis(symbol, analysisLog);
      validationResult.details.strategy = strategyValidation;
      if (!strategyValidation.valid) {
        validationResult.errors.push(...strategyValidation.errors);
        validationResult.overallStatus = 'FAIL';
      }

      // 4. 验证数据一致性
      const consistencyValidation = this.validateDataConsistency(symbol, analysisLog);
      validationResult.details.consistency = consistencyValidation;
      if (!consistencyValidation.valid) {
        validationResult.warnings.push(...consistencyValidation.warnings);
      }

    } catch (error) {
      validationResult.errors.push(`验证过程异常: ${error.message}`);
      validationResult.overallStatus = 'ERROR';
    }

    this.validationResults.set(symbol, validationResult);
    return validationResult;
  }

  // 验证原始数据完整性
  validateRawData(symbol, analysisLog) {
    const result = {
      valid: true,
      errors: [],
      dataTypes: {}
    };

    const requiredDataTypes = [
      '4H K线', '小时K线', '24小时行情', '资金费率', '持仓量历史'
    ];

    for (const dataType of requiredDataTypes) {
      const dataInfo = analysisLog?.rawData?.[dataType];
      const dataTypeResult = {
        available: false,
        success: false,
        dataLength: 0,
        error: null
      };

      if (dataInfo) {
        dataTypeResult.available = true;
        dataTypeResult.success = dataInfo.success || false;
        dataTypeResult.dataLength = dataInfo.data ? dataInfo.data.length : 0;
        
        if (!dataInfo.success) {
          dataTypeResult.error = dataInfo.error || '数据获取失败';
          result.errors.push(`${dataType}: ${dataTypeResult.error}`);
          result.valid = false;
        } else if (!dataInfo.data || dataInfo.data.length === 0) {
          dataTypeResult.error = '数据为空';
          result.errors.push(`${dataType}: 数据为空`);
          result.valid = false;
        }
      } else {
        dataTypeResult.error = '数据不存在';
        result.errors.push(`${dataType}: 数据不存在`);
        result.valid = false;
      }

      result.dataTypes[dataType] = dataTypeResult;
    }

    return result;
  }

  // 验证技术指标计算
  validateIndicators(symbol, analysisLog) {
    const result = {
      valid: true,
      errors: [],
      indicators: {}
    };

    const requiredIndicators = [
      'MA20', 'MA50', 'MA200', 'EMA20', 'EMA50', 'VWAP', 'ATR14', 'BBW', 'ADX'
    ];

    for (const indicator of requiredIndicators) {
      const indicatorResult = {
        available: false,
        valid: false,
        value: null,
        error: null
      };

      const indicatorData = analysisLog?.indicators?.[indicator];
      if (indicatorData) {
        indicatorResult.available = true;
        indicatorResult.value = indicatorData.value;
        
        // 验证指标值的合理性
        if (typeof indicatorData.value === 'number' && !isNaN(indicatorData.value)) {
          indicatorResult.valid = true;
        } else {
          indicatorResult.error = '指标值无效';
          result.errors.push(`${indicator}: 指标值无效 (${indicatorData.value})`);
          result.valid = false;
        }
      } else {
        indicatorResult.error = '指标不存在';
        result.errors.push(`${indicator}: 指标不存在`);
        result.valid = false;
      }

      result.indicators[indicator] = indicatorResult;
    }

    return result;
  }

  // 验证策略分析结果
  validateStrategyAnalysis(symbol, analysisLog) {
    const result = {
      valid: true,
      errors: [],
      phases: {}
    };

    const phases = ['trend4h', 'hourlyConfirmation', 'execution15m'];
    
    for (const phase of phases) {
      const phaseResult = {
        available: false,
        valid: false,
        success: false,
        error: null
      };

      const phaseData = analysisLog?.phases?.[phase];
      if (phaseData) {
        phaseResult.available = true;
        phaseResult.success = phaseData.success || false;
        
        if (phaseData.success) {
          // 验证必要字段
          const requiredFields = this.getRequiredFieldsForPhase(phase);
          const missingFields = requiredFields.filter(field => 
            phaseData[field] === undefined || phaseData[field] === null
          );
          
          if (missingFields.length > 0) {
            phaseResult.error = `缺少必要字段: ${missingFields.join(', ')}`;
            result.errors.push(`${phase}: ${phaseResult.error}`);
            result.valid = false;
          } else {
            phaseResult.valid = true;
          }
        } else {
          phaseResult.error = phaseData.error || '分析失败';
          result.errors.push(`${phase}: ${phaseResult.error}`);
          result.valid = false;
        }
      } else {
        phaseResult.error = '阶段数据不存在';
        result.errors.push(`${phase}: 阶段数据不存在`);
        result.valid = false;
      }

      result.phases[phase] = phaseResult;
    }

    return result;
  }

  // 获取每个阶段需要的必要字段
  getRequiredFieldsForPhase(phase) {
    const fieldMap = {
      'trend4h': ['trend', 'strength', 'adxValue', 'bbwExpanding'],
      'hourlyConfirmation': ['score', 'signalStrength', 'action'],
      'execution15m': ['mode', 'entrySignal', 'stopLoss', 'takeProfit']
    };
    return fieldMap[phase] || [];
  }

  // 验证数据一致性
  validateDataConsistency(symbol, analysisLog) {
    const result = {
      valid: true,
      warnings: [],
      checks: {}
    };

    // 检查价格数据一致性
    const priceConsistency = this.checkPriceConsistency(analysisLog);
    result.checks.priceConsistency = priceConsistency;
    if (!priceConsistency.valid) {
      result.warnings.push(...priceConsistency.warnings);
    }

    // 检查时间序列一致性
    const timeConsistency = this.checkTimeConsistency(analysisLog);
    result.checks.timeConsistency = timeConsistency;
    if (!timeConsistency.valid) {
      result.warnings.push(...timeConsistency.warnings);
    }

    return result;
  }

  // 检查价格数据一致性
  checkPriceConsistency(analysisLog) {
    const result = {
      valid: true,
      warnings: []
    };

    try {
      const klines4h = analysisLog?.rawData?.['4H K线']?.data;
      const klines1h = analysisLog?.rawData?.['小时K线']?.data;
      
      if (klines4h && klines1h && klines4h.length > 0 && klines1h.length > 0) {
        const latest4h = klines4h[klines4h.length - 1];
        const latest1h = klines1h[klines1h.length - 1];
        
        const price4h = parseFloat(latest4h.close);
        const price1h = parseFloat(latest1h.close);
        
        const priceDiff = Math.abs(price4h - price1h) / price1h;
        if (priceDiff > 0.01) { // 价格差异超过1%
          result.warnings.push(`4H和1H价格差异过大: ${(priceDiff * 100).toFixed(2)}%`);
          result.valid = false;
        }
      }
    } catch (error) {
      result.warnings.push(`价格一致性检查失败: ${error.message}`);
      result.valid = false;
    }

    return result;
  }

  // 检查时间序列一致性
  checkTimeConsistency(analysisLog) {
    const result = {
      valid: true,
      warnings: []
    };

    try {
      const klines4h = analysisLog?.rawData?.['4H K线']?.data;
      const klines1h = analysisLog?.rawData?.['小时K线']?.data;
      
      if (klines4h && klines1h && klines4h.length > 0 && klines1h.length > 0) {
        const latest4hTime = parseInt(klines4h[klines4h.length - 1].openTime);
        const latest1hTime = parseInt(klines1h[klines1h.length - 1].openTime);
        
        const timeDiff = Math.abs(latest4hTime - latest1hTime);
        const maxAllowedDiff = 4 * 60 * 60 * 1000; // 4小时
        
        if (timeDiff > maxAllowedDiff) {
          result.warnings.push(`4H和1H时间差异过大: ${Math.round(timeDiff / (60 * 60 * 1000))}小时`);
          result.valid = false;
        }
      }
    } catch (error) {
      result.warnings.push(`时间一致性检查失败: ${error.message}`);
      result.valid = false;
    }

    return result;
  }

  // 获取所有验证结果
  getAllValidationResults() {
    const results = Array.from(this.validationResults.values());
    const summary = {
      totalSymbols: results.length,
      passedSymbols: results.filter(r => r.overallStatus === 'PASS').length,
      failedSymbols: results.filter(r => r.overallStatus === 'FAIL').length,
      errorSymbols: results.filter(r => r.overallStatus === 'ERROR').length,
      totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
      totalWarnings: results.reduce((sum, r) => sum + r.warnings.length, 0)
    };

    return {
      summary,
      details: results
    };
  }

  // 记录验证结果到数据库
  async recordValidationResult(symbol, validationResult) {
    if (!this.database) return;

    try {
      await this.database.recordAlert(
        symbol,
        'data-validation',
        validationResult.overallStatus === 'PASS' ? 'low' : 'high',
        `数据验证${validationResult.overallStatus === 'PASS' ? '通过' : '失败'}`,
        JSON.stringify(validationResult)
      );
    } catch (error) {
      console.error('记录验证结果失败:', error);
    }
  }
}

module.exports = { DataValidationSystem };
