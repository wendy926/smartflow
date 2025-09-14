// 动态杠杆滚仓计算器单元测试

// 直接定义RollupCalculator类用于测试
class RollupCalculator {
  constructor() {
    this.fibonacciLevels = [0.236, 0.382, 0.5, 0.618, 0.786];
    this.fixedLeverageSequence = [30, 25, 20, 15, 10, 5];
  }

  // 四舍五入到2位小数
  round2(v) {
    return Math.round(v * 100) / 100;
  }

  // 格式化数字显示
  formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) {
      return '0.00';
    }
    return num.toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  // 格式化价格显示（保留4位小数）
  formatPrice(price) {
    if (price === null || price === undefined || isNaN(price)) {
      return '0.0000';
    }
    return price.toFixed(4);
  }

  // 计算止损距离
  calculateStopLossDistance({ currentPrice, stopLossPrice }) {
    const stopLossDistance = (Math.abs(currentPrice - stopLossPrice) / currentPrice) * 100;
    return {
      stopLossPrice: this.round2(stopLossPrice),
      stopLossDistance: this.round2(stopLossDistance)
    };
  }

  // 计算初始杠杆
  calculateInitialLeverage(params) {
    const { maxLossAmount, currentPrice, stopLossPrice } = params;

    try {
      if (maxLossAmount <= 0 || currentPrice <= 0 || stopLossPrice <= 0) {
        throw new Error('所有参数必须大于0');
      }
      if (currentPrice <= stopLossPrice) {
        throw new Error('当前价格必须大于止损价格');
      }

      const stopLossData = this.calculateStopLossDistance({ currentPrice, stopLossPrice });
      const { stopLossDistance } = stopLossData;

      const maxLeverage = Math.floor(1 / (stopLossDistance / 100 + 0.005));
      const suggestedMargin = maxLossAmount / (maxLeverage * stopLossDistance / 100);
      const riskRatio = (suggestedMargin / currentPrice) * 100;
      const positionValue = suggestedMargin * maxLeverage;
      const tokenQuantity = positionValue / currentPrice;

      return {
        maxLeverage,
        suggestedMargin: this.round2(suggestedMargin),
        riskRatio: this.round2(riskRatio),
        stopLossPrice: this.round2(stopLossPrice),
        stopLossDistance: this.round2(stopLossDistance),
        entryPrice: currentPrice,
        positionValue: this.round2(positionValue),
        tokenQuantity: this.round2(tokenQuantity),
        maxLossAmount
      };
    } catch (error) {
      console.error('计算初始杠杆时出错:', error);
      throw error;
    }
  }

  // 动态杠杆滚仓策略模拟器
  simulateDynamicPyramid({
    principal,
    initialLeverage,
    priceStart,
    priceTarget,
    triggerRatio = 1.0,
    leverageDecay = 0.5,
    profitLockRatio = 0.5,
    minLeverage = 5
  }) {
    try {
      // 参数验证
      if (principal <= 0) {
        throw new Error('本金必须大于0');
      }
      if (initialLeverage <= 0) {
        throw new Error('初始杠杆必须大于0');
      }
      if (priceStart <= 0) {
        throw new Error('开仓价格必须大于0');
      }
      if (priceTarget <= 0) {
        throw new Error('目标价格必须大于0');
      }
      let equity = principal; // 当前总净值
      let lockedProfit = 0;   // 已落袋利润
      let floatingProfit = 0; // 当前浮盈
      let leverage = initialLeverage;
      let position = principal * leverage; // 仓位价值
      let price = priceStart;
      const totalPriceIncrease = priceTarget - priceStart;
      const priceStep = totalPriceIncrease / 100; // 模拟100步上涨
      const history = [];
      const rollupSteps = [];

      // 初始仓位记录
      history.push({
        step: 0,
        price: this.round2(price),
        position: this.round2(position),
        floatingProfit: 0,
        lockedProfit: 0,
        equity: this.round2(equity),
        leverage: leverage,
        operation: '初始开仓',
        margin: this.round2(principal),
        qty: this.round2(position / price)
      });

      for (let i = 1; i <= 100; i++) {
        price += priceStep;
        floatingProfit = position * (price - priceStart) / priceStart;

        // 判断是否触发滚仓
        if (floatingProfit >= principal * triggerRatio) {
          // 抽回本金
          equity += principal; 
          floatingProfit -= principal;

          // 落袋部分利润
          const locked = floatingProfit * profitLockRatio;
          lockedProfit += locked;
          floatingProfit -= locked;

          // 滚仓
          leverage = Math.max(minLeverage, leverage * leverageDecay);
          position = floatingProfit * leverage;

          // 记录滚仓步骤
          rollupSteps.push({
            step: rollupSteps.length + 1,
            triggerPrice: this.round2(price),
            floatingProfit: this.round2(floatingProfit + locked),
            entryPrice: this.round2(price),
            marginUsed: this.round2(floatingProfit),
            leverage: leverage,
            positionValue: this.round2(position),
            qty: this.round2(position / price),
            lockedProfit: this.round2(locked)
          });

          // 重置开仓价
          priceStart = price;
        }

        // 保存历史记录
        history.push({
          step: i,
          price: this.round2(price),
          position: this.round2(position),
          floatingProfit: this.round2(floatingProfit),
          lockedProfit: this.round2(lockedProfit),
          equity: this.round2(equity + floatingProfit + lockedProfit),
          leverage: this.round2(leverage),
          operation: i === 1 ? '初始开仓' : `第${rollupSteps.length}次滚仓`,
          margin: i === 1 ? this.round2(principal) : this.round2(floatingProfit),
          qty: this.round2(position / price)
        });
      }

      // 计算最终结果
      const totalProfit = lockedProfit + floatingProfit;
      const finalAccount = equity + totalProfit;
      const returnRate = (totalProfit / principal) * 100;

      // 计算本金保护
      const principalProtection = this.calculatePrincipalProtection(principal, history, priceTarget);

      return {
        inputs: { principal, initialLeverage, priceStart, priceTarget, triggerRatio, leverageDecay, profitLockRatio, minLeverage },
        positions: history,
        rollupSteps: rollupSteps,
        principalProtection,
        summary: {
          totalProfit: this.round2(totalProfit),
          finalAccount: this.round2(finalAccount),
          returnRate: this.round2(returnRate),
          positionsCount: history.length,
          rollupCount: rollupSteps.length,
          principalProtected: principalProtection.isProtected,
          maxDrawdown: principalProtection.maxDrawdown
        }
      };
    } catch (error) {
      throw new Error(`动态杠杆滚仓计算错误: ${error.message}`);
    }
  }

  // 计算总数量
  calculateTotalQty(positions) {
    return positions.reduce((total, pos) => total + pos.qty, 0);
  }

  // 计算加权平均入场价
  calculateWeightedAvgEntry(positions) {
    if (positions.length === 0) return 0;
    const totalValue = positions.reduce((total, pos) => total + pos.positionValue, 0);
    const weightedSum = positions.reduce((total, pos) => total + pos.entry * pos.positionValue, 0);
    return totalValue > 0 ? weightedSum / totalValue : 0;
  }

  // 计算本金保护
  calculatePrincipalProtection(principal, positions, targetPrice) {
    const totalQty = this.calculateTotalQty(positions);
    const weightedAvgEntry = this.calculateWeightedAvgEntry(positions);

    if (weightedAvgEntry === 0) {
      return { isProtected: true, maxDrawdown: 0, worstCaseLoss: 0, protectionRatio: 1.0 };
    }

    const worstCaseLoss = Math.abs(targetPrice - weightedAvgEntry) * totalQty;
    const maxDrawdown = worstCaseLoss / principal;
    const isProtected = worstCaseLoss < principal * 0.8;
    const protectionRatio = Math.max(0, (principal - worstCaseLoss) / principal);

    return {
      isProtected,
      maxDrawdown: this.round2(maxDrawdown),
      worstCaseLoss: this.round2(worstCaseLoss),
      protectionRatio: this.round2(protectionRatio)
    };
  }
}

describe('动态杠杆滚仓计算器测试', () => {
  let calculator;

  beforeEach(() => {
    calculator = new RollupCalculator();
  });

  describe('基础功能测试', () => {
    test('应该正确创建RollupCalculator实例', () => {
      expect(calculator).toBeDefined();
      expect(calculator.round2).toBeDefined();
      expect(calculator.formatNumber).toBeDefined();
      expect(calculator.formatPrice).toBeDefined();
    });

    test('round2方法应该正确四舍五入到2位小数', () => {
      expect(calculator.round2(3.14159)).toBe(3.14);
      expect(calculator.round2(2.999)).toBe(3.00);
      expect(calculator.round2(0.1 + 0.2)).toBe(0.3);
    });

    test('formatNumber方法应该正确格式化数字', () => {
      expect(calculator.formatNumber(1234.5678)).toBe('1,234.57');
      expect(calculator.formatNumber(null)).toBe('0.00');
      expect(calculator.formatNumber(undefined)).toBe('0.00');
      expect(calculator.formatNumber(NaN)).toBe('0.00');
    });

    test('formatPrice方法应该正确格式化价格到4位小数', () => {
      expect(calculator.formatPrice(1234.56789)).toBe('1234.5679');
      expect(calculator.formatPrice(null)).toBe('0.0000');
      expect(calculator.formatPrice(undefined)).toBe('0.0000');
      expect(calculator.formatPrice(NaN)).toBe('0.0000');
    });
  });

  describe('初单计算测试', () => {
    test('应该正确计算初始杠杆和本金', () => {
      const result = calculator.calculateInitialLeverage({
        maxLossAmount: 100,
        currentPrice: 4500,
        stopLossPrice: 4300
      });

      expect(result).toBeDefined();
      expect(result.maxLeverage).toBeGreaterThan(0);
      expect(result.suggestedMargin).toBeGreaterThan(0);
      expect(result.stopLossDistance).toBeGreaterThan(0);
      expect(result.entryPrice).toBe(4500);
    });

    test('应该正确处理边界情况', () => {
      expect(() => {
        calculator.calculateInitialLeverage({
          maxLossAmount: 0,
          currentPrice: 4500,
          stopLossPrice: 4300
        });
      }).toThrow();

      expect(() => {
        calculator.calculateInitialLeverage({
          maxLossAmount: 100,
          currentPrice: 4300,
          stopLossPrice: 4500
        });
      }).toThrow();
    });
  });

  describe('动态杠杆滚仓测试', () => {
    test('应该正确执行动态杠杆滚仓策略', () => {
      const result = calculator.simulateDynamicPyramid({
        principal: 200,
        initialLeverage: 50,
        priceStart: 4700,
        priceTarget: 5200,
        triggerRatio: 1.0,
        leverageDecay: 0.5,
        profitLockRatio: 0.5,
        minLeverage: 5
      });

      expect(result).toBeDefined();
      expect(result.inputs).toBeDefined();
      expect(result.positions).toBeDefined();
      expect(result.rollupSteps).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.summary.totalProfit).toBeGreaterThanOrEqual(0);
      expect(result.summary.finalAccount).toBeGreaterThan(0);
      expect(result.summary.returnRate).toBeGreaterThanOrEqual(0);
      expect(result.summary.rollupCount).toBeGreaterThanOrEqual(0);
    });

    test('应该正确处理不同的触发比例', () => {
      const result1 = calculator.simulateDynamicPyramid({
        principal: 200,
        initialLeverage: 50,
        priceStart: 4700,
        priceTarget: 5200,
        triggerRatio: 0.5,
        leverageDecay: 0.5,
        profitLockRatio: 0.5,
        minLeverage: 5
      });

      const result2 = calculator.simulateDynamicPyramid({
        principal: 200,
        initialLeverage: 50,
        priceStart: 4700,
        priceTarget: 5200,
        triggerRatio: 2.0,
        leverageDecay: 0.5,
        profitLockRatio: 0.5,
        minLeverage: 5
      });

      expect(result1.summary.rollupCount).toBeGreaterThanOrEqual(result2.summary.rollupCount);
    });

    test('应该正确处理不同的杠杆递减系数', () => {
      const result1 = calculator.simulateDynamicPyramid({
        principal: 200,
        initialLeverage: 50,
        priceStart: 4700,
        priceTarget: 5200,
        triggerRatio: 1.0,
        leverageDecay: 0.3,
        profitLockRatio: 0.5,
        minLeverage: 5
      });

      const result2 = calculator.simulateDynamicPyramid({
        principal: 200,
        initialLeverage: 50,
        priceStart: 4700,
        priceTarget: 5200,
        triggerRatio: 1.0,
        leverageDecay: 0.7,
        profitLockRatio: 0.5,
        minLeverage: 5
      });

      expect(result1.summary.rollupCount).toBeGreaterThanOrEqual(result2.summary.rollupCount);
    });

    test('应该正确处理不同的落袋比例', () => {
      const result1 = calculator.simulateDynamicPyramid({
        principal: 200,
        initialLeverage: 50,
        priceStart: 4700,
        priceTarget: 5200,
        triggerRatio: 1.0,
        leverageDecay: 0.5,
        profitLockRatio: 0.3,
        minLeverage: 5
      });

      const result2 = calculator.simulateDynamicPyramid({
        principal: 200,
        initialLeverage: 50,
        priceStart: 4700,
        priceTarget: 5200,
        triggerRatio: 1.0,
        leverageDecay: 0.5,
        profitLockRatio: 0.7,
        minLeverage: 5
      });

      expect(result1.summary.totalProfit).toBeGreaterThanOrEqual(0);
      expect(result2.summary.totalProfit).toBeGreaterThanOrEqual(0);
    });

    test('应该正确处理最低杠杆限制', () => {
      const result = calculator.simulateDynamicPyramid({
        principal: 200,
        initialLeverage: 50,
        priceStart: 4700,
        priceTarget: 5200,
        triggerRatio: 1.0,
        leverageDecay: 0.5,
        profitLockRatio: 0.5,
        minLeverage: 10
      });

      // 检查所有滚仓步骤的杠杆都不低于最低杠杆
      result.rollupSteps.forEach(step => {
        expect(step.leverage).toBeGreaterThanOrEqual(10);
      });
    });

    test('应该正确处理价格不变的情况', () => {
      const result = calculator.simulateDynamicPyramid({
        principal: 200,
        initialLeverage: 50,
        priceStart: 4700,
        priceTarget: 4700,
        triggerRatio: 1.0,
        leverageDecay: 0.5,
        profitLockRatio: 0.5,
        minLeverage: 5
      });

      expect(result.summary.rollupCount).toBe(0);
      expect(result.summary.totalProfit).toBe(0);
    });

    test('应该正确处理价格下跌的情况', () => {
      const result = calculator.simulateDynamicPyramid({
        principal: 200,
        initialLeverage: 50,
        priceStart: 4700,
        priceTarget: 4500,
        triggerRatio: 1.0,
        leverageDecay: 0.5,
        profitLockRatio: 0.5,
        minLeverage: 5
      });

      expect(result.summary.rollupCount).toBe(0);
      expect(result.summary.totalProfit).toBeLessThan(0);
    });
  });

  describe('本金保护测试', () => {
    test('应该正确计算本金保护', () => {
      const positions = [
        { entry: 4700, positionValue: 10000, qty: 2.13 },
        { entry: 4800, positionValue: 5000, qty: 1.04 }
      ];

      const protection = calculator.calculatePrincipalProtection(200, positions, 5200);
      
      expect(protection).toBeDefined();
      expect(protection.isProtected).toBeDefined();
      expect(protection.maxDrawdown).toBeGreaterThanOrEqual(0);
      expect(protection.worstCaseLoss).toBeGreaterThanOrEqual(0);
      expect(protection.protectionRatio).toBeGreaterThanOrEqual(0);
    });

    test('应该正确处理空仓位情况', () => {
      const protection = calculator.calculatePrincipalProtection(200, [], 5200);
      
      expect(protection.isProtected).toBe(true);
      expect(protection.maxDrawdown).toBe(0);
      expect(protection.worstCaseLoss).toBe(0);
      expect(protection.protectionRatio).toBe(1.0);
    });
  });

  describe('错误处理测试', () => {
    test('应该正确处理无效参数', () => {
      expect(() => {
        calculator.simulateDynamicPyramid({
          principal: -100,
          initialLeverage: 50,
          priceStart: 4700,
          priceTarget: 5200
        });
      }).toThrow();

      expect(() => {
        calculator.simulateDynamicPyramid({
          principal: 200,
          initialLeverage: 0,
          priceStart: 4700,
          priceTarget: 5200
        });
      }).toThrow();
    });

    test('应该正确处理价格参数错误', () => {
      expect(() => {
        calculator.simulateDynamicPyramid({
          principal: 200,
          initialLeverage: 50,
          priceStart: 0,
          priceTarget: 5200
        });
      }).toThrow();

      expect(() => {
        calculator.simulateDynamicPyramid({
          principal: 200,
          initialLeverage: 50,
          priceStart: 4700,
          priceTarget: 0
        });
      }).toThrow();
    });
  });

  describe('性能测试', () => {
    test('应该在大数据量下正常执行', () => {
      const startTime = Date.now();
      
      const result = calculator.simulateDynamicPyramid({
        principal: 1000,
        initialLeverage: 100,
        priceStart: 1000,
        priceTarget: 2000,
        triggerRatio: 0.1,
        leverageDecay: 0.1,
        profitLockRatio: 0.1,
        minLeverage: 1
      });

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(result).toBeDefined();
      expect(executionTime).toBeLessThan(5000); // 应该在5秒内完成
    });
  });

  describe('边界值测试', () => {
    test('应该正确处理极小的价格变化', () => {
      const result = calculator.simulateDynamicPyramid({
        principal: 200,
        initialLeverage: 50,
        priceStart: 4700,
        priceTarget: 4701,
        triggerRatio: 1.0,
        leverageDecay: 0.5,
        profitLockRatio: 0.5,
        minLeverage: 5
      });

      expect(result.summary.rollupCount).toBe(0);
    });

    test('应该正确处理极大的价格变化', () => {
      const result = calculator.simulateDynamicPyramid({
        principal: 200,
        initialLeverage: 50,
        priceStart: 4700,
        priceTarget: 10000,
        triggerRatio: 1.0,
        leverageDecay: 0.5,
        profitLockRatio: 0.5,
        minLeverage: 5
      });

      expect(result.summary.rollupCount).toBeGreaterThan(0);
      expect(result.summary.totalProfit).toBeGreaterThan(0);
    });
  });
});
