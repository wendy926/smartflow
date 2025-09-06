// rollup-calculator.js
// 斐波拉契滚仓计算器核心逻辑

class RollupCalculator {
  constructor() {
    this.fibonacciLevels = [0.236, 0.382, 0.5, 0.618, 0.786];
    this.fixedLeverageSequence = [30, 25, 20, 15, 10, 5];
  }

  // 格式化数字显示
  formatNumber(num, decimals = 2) {
    if (typeof num !== 'number' || isNaN(num)) return '0';
    return num.toFixed(decimals);
  }

  // 计算初始杠杆
  calculateInitialLeverage(params) {
    const { maxLossAmount, orderZoneHigh, orderZoneLow, atr4h } = params;

    // 计算止损价格（取订单区下沿和ATR止损的较小值）
    const atrStopLoss = orderZoneHigh - atr4h * 1.2;
    const stopLossPrice = Math.max(orderZoneLow, atrStopLoss);

    // 计算止损距离
    const stopLossDistance = ((orderZoneHigh - stopLossPrice) / orderZoneHigh) * 100;

    // 计算最大杠杆（基于止损距离）
    const maxLeverage = Math.floor(1 / (stopLossDistance / 100 + 0.005));

    // 计算建议保证金
    const suggestedMargin = maxLossAmount / (stopLossDistance / 100);

    return {
      entryPrice: orderZoneHigh,
      stopLossPrice: stopLossPrice,
      stopLossDistance: stopLossDistance,
      maxLeverage: maxLeverage,
      suggestedMargin: suggestedMargin
    };
  }

  // 模拟滚仓策略
  simulateRollup(params) {
    const { principal, initLeverage, entryPrice, targetPrice, leverageStrategy, maxDrawdownRatio } = params;

    const positions = [];
    const addSteps = [];
    let currentAccount = principal;
    let currentPrice = entryPrice;
    let step = 1;

    // 添加初始仓位
    const initialMargin = principal;
    const initialPositionValue = initialMargin * initLeverage;
    const initialQty = initialPositionValue / entryPrice;

    positions.push({
      entry: entryPrice,
      margin: initialMargin,
      leverage: initLeverage,
      position_value: initialPositionValue,
      qty: initialQty,
      stop_loss_price: this.calculateStopLoss(entryPrice, entryPrice, initLeverage),
      profit: 0,
      source: 'principal'
    });

    // 模拟价格波动和加仓
    while (currentPrice < targetPrice && step <= 10) {
      // 计算下一个斐波拉契回调位
      const fibLevel = this.fibonacciLevels[(step - 1) % this.fibonacciLevels.length];
      const peakPrice = currentPrice * (1 + 0.1 * step); // 模拟价格上涨
      const retracePrice = peakPrice * (1 - fibLevel);

      // 计算加仓参数
      const leverage = this.getLeverage(leverageStrategy, step, currentAccount);
      const marginUsed = this.calculateMarginUsed(currentAccount, retracePrice, leverage);

      if (marginUsed > currentAccount * 0.1) { // 确保有足够资金
        const newPositionValue = marginUsed * leverage;
        const newQty = newPositionValue / retracePrice;

        // 添加加仓步骤
        addSteps.push({
          step: step,
          peak_H: peakPrice,
          retrace_R: retracePrice,
          new_entry_price: retracePrice,
          margin_used: marginUsed,
          leverage: leverage,
          position_value: newPositionValue,
          qty: newQty,
          stop_loss_price: this.calculateStopLoss(retracePrice, entryPrice, leverage)
        });

        // 添加新仓位
        positions.push({
          entry: retracePrice,
          margin: marginUsed,
          leverage: leverage,
          position_value: newPositionValue,
          qty: newQty,
          stop_loss_price: this.calculateStopLoss(retracePrice, entryPrice, leverage),
          profit: 0,
          source: 'profit'
        });

        currentAccount -= marginUsed;
        currentPrice = retracePrice;
        step++;
      } else {
        break;
      }
    }

    // 计算最终结果
    const totalProfit = this.calculateTotalProfit(positions, targetPrice);
    const finalAccount = principal + totalProfit;
    const returnRate = (totalProfit / principal) * 100;
    const maxDrawdown = this.calculateMaxDrawdown(positions);
    const principalProtected = maxDrawdown < 50;

    return {
      inputs: {
        principal: principal,
        initLeverage: initLeverage,
        entryPrice: entryPrice,
        targetPrice: targetPrice,
        leverageStrategy: leverageStrategy
      },
      positions: positions,
      addSteps: addSteps,
      summary: {
        totalProfit: totalProfit,
        finalAccount: finalAccount,
        returnRate: returnRate,
        rollupCount: addSteps.length,
        maxDrawdown: maxDrawdown,
        principalProtected: principalProtected
      }
    };
  }

  // 获取杠杆
  getLeverage(strategy, step, currentAccount) {
    if (strategy === 'fixed') {
      return this.fixedLeverageSequence[(step - 1) % this.fixedLeverageSequence.length];
    } else {
      // 动态计算杠杆
      const baseLeverage = 20;
      const decayFactor = 0.8;
      return Math.max(5, Math.floor(baseLeverage * Math.pow(decayFactor, step - 1)));
    }
  }

  // 计算使用的保证金
  calculateMarginUsed(currentAccount, price, leverage) {
    const maxMargin = currentAccount * 0.2; // 最多使用20%的资金
    const requiredMargin = (currentAccount * 0.1) / leverage; // 基于10%风险计算
    return Math.min(maxMargin, requiredMargin);
  }

  // 计算止损价格
  calculateStopLoss(entryPrice, originalEntryPrice, leverage) {
    const atrStop = entryPrice * 0.95; // 5%止损
    const leverageStop = originalEntryPrice * 0.9; // 基于原始入场价的10%止损
    return Math.max(atrStop, leverageStop);
  }

  // 计算总利润
  calculateTotalProfit(positions, targetPrice) {
    let totalProfit = 0;
    positions.forEach(pos => {
      const profit = (targetPrice - pos.entry) * pos.qty;
      totalProfit += profit;
    });
    return totalProfit;
  }

  // 计算最大回撤
  calculateMaxDrawdown(positions) {
    let maxDrawdown = 0;
    let peakValue = 0;

    positions.forEach(pos => {
      const currentValue = pos.position_value;
      if (currentValue > peakValue) {
        peakValue = currentValue;
      }
      const drawdown = ((peakValue - currentValue) / peakValue) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });

    return maxDrawdown;
  }

  // 获取操作类型
  getOperationType(index, source) {
    if (index === 0) return '初始开仓';
    return source === 'principal' ? '本金加仓' : '利润加仓';
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('rollupForm');
  const calculateInitialBtn = document.getElementById('calculateInitial');
  const compareStrategiesBtn = document.getElementById('compareStrategies');
  const calculateRollupBtn = document.getElementById('calculateRollup');

  const calculator = new RollupCalculator();

  // 初单计算
  calculateInitialBtn.addEventListener('click', function () {
    try {
      const maxLossAmount = parseFloat(document.getElementById('maxLossAmount').value);
      const orderZoneHigh = parseFloat(document.getElementById('orderZoneHigh').value);
      const orderZoneLow = parseFloat(document.getElementById('orderZoneLow').value);
      const atr4h = parseFloat(document.getElementById('atr4h').value);

      if (isNaN(maxLossAmount) || isNaN(orderZoneHigh) || isNaN(orderZoneLow) || isNaN(atr4h)) {
        throw new Error('请输入有效的数值');
      }

      if (maxLossAmount <= 0 || orderZoneHigh <= 0 || orderZoneLow <= 0 || atr4h <= 0) {
        throw new Error('所有数值必须大于0');
      }

      if (orderZoneHigh <= orderZoneLow) {
        throw new Error('订单区上沿价格必须大于下沿价格');
      }

      const result = calculator.calculateInitialLeverage({
        maxLossAmount,
        orderZoneHigh,
        orderZoneLow,
        atr4h
      });

      // 存储计算结果
      window.calculatedPrincipal = result.suggestedMargin;
      window.calculatedLeverage = result.maxLeverage;
      window.calculatedStopLoss = result.stopLossPrice;
      window.calculatedStopLossDistance = result.stopLossDistance;
      window.calculatedEntryPrice = result.entryPrice;

      displayInitialCalculation(result);

    } catch (err) {
      displayError(err.message);
    }
  });

  // 对比策略
  compareStrategiesBtn.addEventListener('click', function () {
    try {
      if (!window.calculatedPrincipal || !window.calculatedLeverage) {
        throw new Error('请先点击"初单计算"按钮');
      }

      const targetPrice = parseFloat(document.getElementById('targetPrice').value);
      if (isNaN(targetPrice) || targetPrice <= 0) {
        throw new Error('请输入有效的目标价格');
      }

      if (targetPrice <= window.calculatedEntryPrice) {
        throw new Error('目标价格必须大于初始开仓价');
      }

      compareStrategies(calculator, {
        suggestedMargin: window.calculatedPrincipal,
        maxLeverage: window.calculatedLeverage,
        stopLossPrice: window.calculatedStopLoss,
        stopLossDistance: window.calculatedStopLossDistance,
        entryPrice: window.calculatedEntryPrice
      }, targetPrice);

    } catch (err) {
      displayError(err.message);
    }
  });

  // 计算滚仓路径
  calculateRollupBtn.addEventListener('click', function () {
    try {
      if (!window.calculatedPrincipal || !window.calculatedLeverage) {
        throw new Error('请先点击"初单计算"按钮');
      }

      const targetPrice = parseFloat(document.getElementById('targetPrice').value);
      const leverageStrategy = document.getElementById('leverageStrategy').value;

      if (isNaN(targetPrice) || targetPrice <= 0) {
        throw new Error('请输入有效的目标价格');
      }

      if (targetPrice <= window.calculatedEntryPrice) {
        throw new Error('目标价格必须大于初始开仓价');
      }

      const result = calculator.simulateRollup({
        principal: window.calculatedPrincipal,
        initLeverage: window.calculatedLeverage,
        entryPrice: window.calculatedEntryPrice,
        targetPrice: targetPrice,
        leverageStrategy: leverageStrategy,
        maxDrawdownRatio: 0.8
      });

      displayResults(result);

    } catch (err) {
      displayError(err.message);
    }
  });

  // 显示初单计算结果
  function displayInitialCalculation(data) {
    document.getElementById('calculatedPrincipal').textContent = calculator.formatNumber(data.suggestedMargin) + ' U';
    document.getElementById('calculatedLeverage').textContent = data.maxLeverage;
    document.getElementById('calculatedStopLoss').textContent = calculator.formatNumber(data.stopLossPrice) + ' U';
    document.getElementById('calculatedStopLossDistance').textContent = calculator.formatNumber(data.stopLossDistance) + '%';

    document.getElementById('initialCalculation').classList.remove('hidden');
    document.getElementById('error').classList.add('hidden');
    document.getElementById('results').classList.add('hidden');
    document.getElementById('strategyComparison').classList.add('hidden');
  }

  // 对比策略
  function compareStrategies(calculator, leverageData, targetPrice) {
    try {
      const dynamicResult = calculator.simulateRollup({
        principal: leverageData.suggestedMargin,
        initLeverage: leverageData.maxLeverage,
        entryPrice: leverageData.entryPrice,
        targetPrice: targetPrice,
        leverageStrategy: 'dynamic',
        maxDrawdownRatio: 0.8
      });

      const fixedResult = calculator.simulateRollup({
        principal: leverageData.suggestedMargin,
        initLeverage: leverageData.maxLeverage,
        entryPrice: leverageData.entryPrice,
        targetPrice: targetPrice,
        leverageStrategy: 'fixed',
        maxDrawdownRatio: 0.8
      });

      // 显示策略对比结果
      document.getElementById('dynamicProfit').textContent = calculator.formatNumber(dynamicResult.summary?.totalProfit || 0) + ' U';
      document.getElementById('dynamicReturnRate').textContent = calculator.formatNumber(dynamicResult.summary?.returnRate || 0) + '%';
      document.getElementById('dynamicRollupCount').textContent = dynamicResult.summary?.rollupCount || 0;
      document.getElementById('dynamicRiskLevel').textContent = (dynamicResult.summary?.maxDrawdown || 0) > 50 ? '较高' : (dynamicResult.summary?.maxDrawdown || 0) > 20 ? '中等' : '较低';

      document.getElementById('fixedProfit').textContent = calculator.formatNumber(fixedResult.summary?.totalProfit || 0) + ' U';
      document.getElementById('fixedReturnRate').textContent = calculator.formatNumber(fixedResult.summary?.returnRate || 0) + '%';
      document.getElementById('fixedRollupCount').textContent = fixedResult.summary?.rollupCount || 0;
      document.getElementById('fixedRiskLevel').textContent = (fixedResult.summary?.maxDrawdown || 0) > 50 ? '较高' : (fixedResult.summary?.maxDrawdown || 0) > 20 ? '中等' : '较低';

      // 生成推荐
      const dynamicProfit = dynamicResult.summary?.totalProfit || 0;
      const fixedProfit = fixedResult.summary?.totalProfit || 0;
      const dynamicRisk = dynamicResult.summary?.maxDrawdown || 0;
      const fixedRisk = fixedResult.summary?.maxDrawdown || 0;

      let recommendation = '';
      if (dynamicProfit > fixedProfit && dynamicRisk <= fixedRisk) {
        recommendation = '🔄 推荐使用动态计算策略：收益更高且风险更低';
      } else if (fixedProfit > dynamicProfit && fixedRisk <= dynamicRisk) {
        recommendation = '📋 推荐使用固定序列策略：收益更高且风险更低';
      } else if (dynamicProfit > fixedProfit) {
        recommendation = '🔄 推荐使用动态计算策略：收益更高（但风险也较高）';
      } else if (fixedProfit > dynamicProfit) {
        recommendation = '📋 推荐使用固定序列策略：收益更高（但风险也较高）';
      } else {
        recommendation = '⚖️ 两种策略收益相近，可根据风险偏好选择';
      }

      document.getElementById('recommendation').textContent = recommendation;

      document.getElementById('strategyComparison').classList.remove('hidden');
      document.getElementById('error').classList.add('hidden');
      document.getElementById('results').classList.add('hidden');
      document.getElementById('initialCalculation').classList.add('hidden');

    } catch (error) {
      displayError('策略对比时出错: ' + error.message);
    }
  }

  // 显示计算结果
  function displayResults(result) {
    // 更新汇总卡片
    document.getElementById('totalProfit').textContent = calculator.formatNumber(result.summary?.totalProfit || 0) + ' U';
    document.getElementById('finalAccount').textContent = calculator.formatNumber(result.summary?.finalAccount || 0) + ' U';
    document.getElementById('returnRate').textContent = calculator.formatNumber(result.summary?.returnRate || 0) + '%';
    document.getElementById('rollupCount').textContent = result.summary?.rollupCount || 0;

    // 更新本金保护信息
    const principalProtected = document.getElementById('principalProtected');
    const maxDrawdown = document.getElementById('maxDrawdown');

    if (result.summary?.principalProtected) {
      principalProtected.textContent = '✅ 安全';
      principalProtected.style.color = '#28a745';
    } else {
      principalProtected.textContent = '⚠️ 风险';
      principalProtected.style.color = '#dc3545';
    }

    const maxDrawdownValue = result.summary?.maxDrawdown || 0;
    maxDrawdown.textContent = calculator.formatNumber(maxDrawdownValue) + '%';
    if (maxDrawdownValue > 50) {
      maxDrawdown.style.color = '#dc3545';
    } else if (maxDrawdownValue > 20) {
      maxDrawdown.style.color = '#fd7e14';
    } else {
      maxDrawdown.style.color = '#28a745';
    }

    // 填充仓位表格
    const positionsTableBody = document.getElementById('positionsTableBody');
    positionsTableBody.innerHTML = '';

    let cumulativeAccount = result.inputs.principal;

    result.positions.forEach((pos, index) => {
      const row = document.createElement('tr');
      cumulativeAccount += pos.profit;

      row.innerHTML = `
                <td>${String.fromCharCode(9311 + index)}</td>
                <td>${calculator.getOperationType(index, pos.source)}</td>
                <td>${calculator.formatNumber(pos.entry)}</td>
                <td>${calculator.formatNumber(pos.margin)}${pos.source === 'principal' ? '（本金）' : '（利润）'}</td>
                <td>${pos.leverage}x</td>
                <td>${calculator.formatNumber(pos.position_value)}</td>
                <td>≈ ${calculator.formatNumber(pos.qty)}</td>
                <td>${calculator.formatNumber(pos.stop_loss_price || 0)}</td>
                <td>${calculator.formatNumber(pos.profit)}</td>
                <td>${calculator.formatNumber(cumulativeAccount)}</td>
            `;
      positionsTableBody.appendChild(row);
    });

    // 填充加仓步骤表格
    const addStepsTableBody = document.getElementById('addStepsTableBody');
    addStepsTableBody.innerHTML = '';

    if (result.addSteps.length > 0) {
      result.addSteps.forEach((step, index) => {
        const row = document.createElement('tr');
        row.id = `addStepRow_${step.step}`;
        row.innerHTML = `
                    <td>
                        <input type="checkbox" class="step-checkbox" data-step="${step.step}" onchange="toggleStepCompletion(this)">
                    </td>
                    <td>${step.step}</td>
                    <td>${calculator.formatNumber(step.peak_H)}</td>
                    <td>${calculator.formatNumber(step.retrace_R)}</td>
                    <td>${calculator.formatNumber(step.new_entry_price)}</td>
                    <td>${calculator.formatNumber(step.margin_used)}</td>
                    <td>${step.leverage}x</td>
                    <td>${calculator.formatNumber(step.position_value)}</td>
                    <td>≈ ${calculator.formatNumber(step.qty)}</td>
                    <td>${calculator.formatNumber(step.stop_loss_price || 0)}</td>
                `;
        addStepsTableBody.appendChild(row);
      });
    } else {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="10" style="text-align: center; color: #6c757d;">无加仓操作</td>';
      addStepsTableBody.appendChild(row);
    }

    // 显示结果
    document.getElementById('results').classList.remove('hidden');
    document.getElementById('error').classList.add('hidden');
    document.getElementById('initialCalculation').classList.add('hidden');
    document.getElementById('strategyComparison').classList.add('hidden');
  }

  // 显示错误信息
  function displayError(message) {
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('error').classList.remove('hidden');
    document.getElementById('results').classList.add('hidden');
    document.getElementById('initialCalculation').classList.add('hidden');
    document.getElementById('strategyComparison').classList.add('hidden');
  }
});

// 切换步骤完成状态
function toggleStepCompletion(checkbox) {
  const row = checkbox.closest('tr');
  const stepNumber = checkbox.getAttribute('data-step');

  if (checkbox.checked) {
    row.classList.add('completed-step');
    const stepCell = row.querySelector('td:nth-child(2)');
    stepCell.innerHTML = `✅ ${stepNumber}`;
    row.style.transition = 'all 0.3s ease';
  } else {
    row.classList.remove('completed-step');
    const stepCell = row.querySelector('td:nth-child(2)');
    stepCell.innerHTML = stepNumber;
    row.style.transition = 'none';
  }
}
