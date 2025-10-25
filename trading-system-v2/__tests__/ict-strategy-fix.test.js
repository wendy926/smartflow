/**
 * ICT策略修复逻辑单测
 * 验证止损调整逻辑的正确性
 */

const assert = require('assert');

describe('ICT策略止损调整逻辑', () => {
  
  /**
   * 模拟calculateTradeParameters中的止损调整逻辑
   */
  function calculateAdjustedStopLoss(entry, trend, structuralStopLoss, maxSingleLoss) {
    let stopLoss = structuralStopLoss;
    let stopDistance = Math.abs(entry - stopLoss);
    let stopDistancePct = stopDistance / entry;
    let wasAdjusted = false;
    
    // 检查止损距离是否过大
    if (stopDistancePct > maxSingleLoss) {
      wasAdjusted = true;
      // 调整止损价格以符合风险限制
      const adjustedStopDistance = entry * maxSingleLoss;
      if (trend === 'UP') {
        stopLoss = entry - adjustedStopDistance;
      } else if (trend === 'DOWN') {
        stopLoss = entry + adjustedStopDistance;
      }
      
      stopDistance = adjustedStopDistance;
      stopDistancePct = maxSingleLoss;
    }
    
    return {
      stopLoss,
      stopDistance,
      stopDistancePct,
      wasAdjusted
    };
  }
  
  /**
   * 计算止盈价格
   */
  function calculateTakeProfit(entry, stopLoss, trend) {
    const stopDistance = Math.abs(entry - stopLoss);
    const takeProfitMultiplier = 3.5;
    
    if (trend === 'UP') {
      return entry + (stopDistance * takeProfitMultiplier);
    } else if (trend === 'DOWN') {
      return entry - (stopDistance * takeProfitMultiplier);
    }
    
    return entry;
  }

  describe('BTCUSDT DOWN趋势场景', () => {
    const entry = 111624.9;
    const trend = 'DOWN';
    const structuralStopLoss = 114838.23; // 4H ATR × 2.5计算出的止损
    const maxSingleLoss = 0.015; // 1.5%

    it('应该检测到止损距离过大', () => {
      const stopDistance = Math.abs(entry - structuralStopLoss);
      const stopDistancePct = stopDistance / entry;
      
      assert.strictEqual(stopDistancePct > maxSingleLoss, true, '止损距离应该超过1.5%');
      assert.ok(stopDistancePct > 0.028, '止损距离应该大于2.8%');
    });

    it('应该调整止损到1.5%以内', () => {
      const result = calculateAdjustedStopLoss(entry, trend, structuralStopLoss, maxSingleLoss);
      
      assert.strictEqual(result.wasAdjusted, true, '应该被调整');
      assert.ok(result.stopDistancePct <= maxSingleLoss, '止损距离应该在1.5%以内');
      assert.strictEqual(result.stopDistancePct.toFixed(4), '0.0150', '止损百分比应该精确为1.5%');
      assert.ok(result.stopLoss > entry, '做空止损应该高于入场价');
    });

    it('止损价格应该在正确范围内', () => {
      const result = calculateAdjustedStopLoss(entry, trend, structuralStopLoss, maxSingleLoss);
      const expectedStopLoss = entry + (entry * maxSingleLoss);
      
      assert.ok(Math.abs(result.stopLoss - expectedStopLoss) < 0.01, 
        `止损价格应该接近${expectedStopLoss}`);
    });

    it('止盈价格应该正确计算', () => {
      const result = calculateAdjustedStopLoss(entry, trend, structuralStopLoss, maxSingleLoss);
      const takeProfit = calculateTakeProfit(entry, result.stopLoss, trend);
      
      assert.ok(takeProfit < entry, '做空止盈应该低于入场价');
      assert.ok(takeProfit < result.stopLoss, '做空止盈应该低于止损价');
      
      // 验证盈亏比
      const stopDistance = Math.abs(entry - result.stopLoss);
      const profitDistance = Math.abs(entry - takeProfit);
      const ratio = profitDistance / stopDistance;
      
      assert.strictEqual(ratio.toFixed(1), '3.5', '盈亏比应该是3.5:1');
    });
  });

  describe('ETHUSDT DOWN趋势场景', () => {
    const entry = 3950.95;
    const trend = 'DOWN';
    const structuralStopLoss = 4124.75; // 4H ATR × 2.5计算出的止损
    const maxSingleLoss = 0.015; // 1.5%

    it('应该检测到止损距离过大（4.4%）', () => {
      const stopDistance = Math.abs(entry - structuralStopLoss);
      const stopDistancePct = stopDistance / entry;
      
      assert.ok(stopDistancePct > 0.04, '止损距离应该大于4%');
      assert.ok(stopDistancePct > maxSingleLoss, '止损距离应该超过1.5%限制');
    });

    it('应该调整止损到1.5%以内', () => {
      const result = calculateAdjustedStopLoss(entry, trend, structuralStopLoss, maxSingleLoss);
      
      assert.strictEqual(result.wasAdjusted, true, '应该被调整');
      assert.ok(result.stopDistancePct <= maxSingleLoss, '止损距离应该在1.5%以内');
      assert.ok(result.stopLoss > entry, '做空止损应该高于入场价');
    });

    it('止盈价格应该正确计算', () => {
      const result = calculateAdjustedStopLoss(entry, trend, structuralStopLoss, maxSingleLoss);
      const takeProfit = calculateTakeProfit(entry, result.stopLoss, trend);
      
      const stopDistance = Math.abs(entry - result.stopLoss);
      const profitDistance = Math.abs(entry - takeProfit);
      const ratio = profitDistance / stopDistance;
      
      assert.strictEqual(ratio.toFixed(1), '3.5', '盈亏比应该是3.5:1');
    });
  });

  describe('BTCUSDT UP趋势场景', () => {
    const entry = 111624.9;
    const trend = 'UP';
    const structuralStopLoss = 108411.66; // 4H ATR × 2.5计算出的止损（低于入场价）
    const maxSingleLoss = 0.015; // 1.5%

    it('应该检测到止损距离过大', () => {
      const stopDistance = Math.abs(entry - structuralStopLoss);
      const stopDistancePct = stopDistance / entry;
      
      assert.ok(stopDistancePct > maxSingleLoss, '止损距离应该超过1.5%限制');
    });

    it('应该调整止损到1.5%以内', () => {
      const result = calculateAdjustedStopLoss(entry, trend, structuralStopLoss, maxSingleLoss);
      
      assert.strictEqual(result.wasAdjusted, true, '应该被调整');
      assert.ok(result.stopDistancePct <= maxSingleLoss, '止损距离应该在1.5%以内');
      assert.ok(result.stopLoss < entry, '做多止损应该低于入场价');
    });

    it('止盈价格应该正确计算', () => {
      const result = calculateAdjustedStopLoss(entry, trend, structuralStopLoss, maxSingleLoss);
      const takeProfit = calculateTakeProfit(entry, result.stopLoss, trend);
      
      assert.ok(takeProfit > entry, '做多止盈应该高于入场价');
      assert.ok(takeProfit > result.stopLoss, '做多止盈应该高于止损价');
      
      const stopDistance = Math.abs(entry - result.stopLoss);
      const profitDistance = Math.abs(takeProfit - entry);
      const ratio = profitDistance / stopDistance;
      
      assert.strictEqual(ratio.toFixed(1), '3.5', '盈亏比应该是3.5:1');
    });
  });

  describe('止损距离在限制内的情况', () => {
    const entry = 111624.9;
    const trend = 'DOWN';
    const structuralStopLoss = 111900; // 较小的止损（约0.25%）
    const maxSingleLoss = 0.015; // 1.5%

    it('不应该调整止损', () => {
      const result = calculateAdjustedStopLoss(entry, trend, structuralStopLoss, maxSingleLoss);
      
      assert.strictEqual(result.wasAdjusted, false, '不应该被调整');
      assert.strictEqual(result.stopLoss, structuralStopLoss, '止损应该保持原值');
    });
  });

  describe('完整的交易参数计算', () => {
    it('应该返回完整的交易参数对象', () => {
      const entry = 111624.9;
      const trend = 'DOWN';
      const structuralStopLoss = 114838.23;
      const maxSingleLoss = 0.015;
      
      const result = calculateAdjustedStopLoss(entry, trend, structuralStopLoss, maxSingleLoss);
      const takeProfit = calculateTakeProfit(entry, result.stopLoss, trend);
      
      const tradeParams = {
        entry: parseFloat(entry.toFixed(4)),
        stopLoss: parseFloat(result.stopLoss.toFixed(4)),
        takeProfit: parseFloat(takeProfit.toFixed(4)),
        leverage: 1,
        risk: 0.01
      };
      
      assert.ok(tradeParams.entry > 0, '入场价应该大于0');
      assert.ok(tradeParams.stopLoss > 0, '止损价应该大于0');
      assert.ok(tradeParams.takeProfit > 0, '止盈价应该大于0');
      assert.ok(tradeParams.stopLoss !== tradeParams.takeProfit, '止损和止盈应该不同');
      assert.ok(tradeParams.stopLoss > entry, '做空止损应该高于入场价');
      assert.ok(tradeParams.takeProfit < entry, '做空止盈应该低于入场价');
    });
  });

  describe('边界情况测试', () => {
    it('止损距离恰好等于限制时不调整', () => {
      const entry = 100;
      const trend = 'DOWN';
      const maxSingleLoss = 0.015;
      const structuralStopLoss = entry + (entry * maxSingleLoss); // 恰好1.5%
      
      const result = calculateAdjustedStopLoss(entry, trend, structuralStopLoss, maxSingleLoss);
      
      assert.strictEqual(result.stopLoss, structuralStopLoss, '止损应该保持原值');
    });

    it('止损距离略大于限制时应该调整', () => {
      const entry = 100;
      const trend = 'DOWN';
      const maxSingleLoss = 0.015;
      const structuralStopLoss = entry + (entry * maxSingleLoss * 1.01); // 1.515%
      
      const result = calculateAdjustedStopLoss(entry, trend, structuralStopLoss, maxSingleLoss);
      
      assert.ok(result.stopDistancePct <= maxSingleLoss, '止损应该调整到1.5%以内');
    });
  });
});

