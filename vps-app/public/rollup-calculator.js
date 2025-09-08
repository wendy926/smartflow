// rollup-calculator.js
// 斐波拉契滚仓计算器核心逻辑

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

  // 模拟滚仓策略
  simulateRollup({ principal, initLeverage, entryPrice, targetPrice, leverageStrategy, maxDrawdownRatio = 0.8 }) {
    try {
      let positions = [];
      const initialPositionValue = principal * initLeverage;
      const initialQty = initialPositionValue / entryPrice;

      positions.push({
        id: 1,
        entry: entryPrice,
        margin: principal,
        leverage: initLeverage,
        positionValue: initialPositionValue,
        qty: initialQty,
        source: 'principal'
      });

      const start = entryPrice;
      const end = targetPrice;
      const range = end - start;
      let trough = start;

      const peaks = this.fibonacciLevels.map(r => {
        const H = start + r * range;
        const R = H - 0.618 * (H - trough);
        return { ratio: r, H: H, R: R, troughBefore: trough };
      });

      let allocSequence = [];
      let cumulativeRealizedProfit = 0;

      for (let i = 0; i < peaks.length; i++) {
        const p = peaks[i];
        const priceAt = p.R;

        let unrealizedProfit = positions.reduce((acc, pos) => {
          return acc + (priceAt - pos.entry) * pos.qty;
        }, 0);

        let availableProfit = Math.max(0, unrealizedProfit - cumulativeRealizedProfit);

        if (availableProfit <= 0) continue;

        const maxSafeMargin = availableProfit * 0.95;
        const desiredMargin = availableProfit / 10;

        let chosenLeverage, marginToUse;

        if (leverageStrategy === 'fixed' && i < this.fixedLeverageSequence.length) {
          chosenLeverage = this.fixedLeverageSequence[i];
          // 固定序列策略：基于杠杆计算保证金
          const requiredMargin = (availableProfit * 0.1) / chosenLeverage;
          marginToUse = Math.min(requiredMargin, maxSafeMargin);
        } else {
          chosenLeverage = this.calculateDynamicLeverage({ availableProfit, stepIndex: i });
          // 动态计算策略：基于可用利润的10%计算保证金
          marginToUse = Math.min(desiredMargin, maxSafeMargin);
        }

        if (chosenLeverage <= 0 || marginToUse <= 0) continue;

        // 确保杠杆不超过可用利润的限制
        const maxLeverageByProfit = Math.floor(availableProfit / marginToUse);
        const actualLeverage = Math.min(chosenLeverage, maxLeverageByProfit);
        if (actualLeverage <= 0) continue;

        const newPositionValue = marginToUse * actualLeverage;
        const newQty = newPositionValue / priceAt;

        positions.push({
          id: positions.length + 1,
          entry: priceAt,
          margin: marginToUse,
          leverage: actualLeverage,
          positionValue: newPositionValue,
          qty: newQty,
          source: 'profit'
        });

        cumulativeRealizedProfit += marginToUse;

        const stopLossPrice = this.calculateStopLossPrice({
          principal,
          currentPrice: priceAt,
          totalQty: this.calculateTotalQty(positions),
          maxDrawdownRatio
        });

        allocSequence.push({
          step: i + 1,
          peak_H: this.round2(p.H),
          retrace_R: this.round2(p.R),
          new_entry_price: this.round2(priceAt),
          margin_used: this.round2(marginToUse),
          leverage: actualLeverage,
          position_value: this.round2(newPositionValue),
          qty: this.round2(newQty),
          stop_loss_price: this.round2(stopLossPrice)
        });
      }

      const finalDetails = positions.map((pos, index) => {
        const profit = (targetPrice - pos.entry) * pos.qty;
        const stopLossPrice = this.calculateStopLossPrice({
          principal,
          currentPrice: pos.entry,
          totalQty: pos.qty,
          maxDrawdownRatio
        });

        return {
          id: pos.id,
          entry: this.round2(pos.entry),
          margin: this.round2(pos.margin),
          leverage: pos.leverage,
          qty: this.round2(pos.qty),
          position_value: this.round2(pos.positionValue),
          stop_loss_price: this.round2(stopLossPrice),
          profit: this.round2(profit),
          source: pos.source
        };
      });

      const totalProfit = finalDetails.reduce((sum, pos) => sum + pos.profit, 0);
      const finalAccount = principal + totalProfit;
      const returnRate = (totalProfit / principal) * 100;

      const principalProtection = this.calculatePrincipalProtection(principal, finalDetails, targetPrice);

      return {
        inputs: { principal, initLeverage, entryPrice, targetPrice, leverageStrategy, maxDrawdownRatio },
        positions: finalDetails,
        addSteps: allocSequence,
        principalProtection,
        summary: {
          totalProfit: this.round2(totalProfit),
          finalAccount: this.round2(finalAccount),
          returnRate: this.round2(returnRate),
          positionsCount: finalDetails.length,
          rollupCount: allocSequence.length,
          principalProtected: principalProtection.isProtected,
          maxDrawdown: principalProtection.maxDrawdown
        }
      };
    } catch (error) {
      throw new Error(`计算错误: ${error.message}`);
    }
  }


  // 计算动态杠杆
  calculateDynamicLeverage({ availableProfit, stepIndex, baseLeverage = 20 }) {
    if (availableProfit <= 0) return 0;

    const decayFactor = Math.max(0.6, 1 - (stepIndex * 0.08));
    const leverage = Math.floor(baseLeverage * decayFactor);
    return Math.max(1, Math.min(leverage, Math.floor(availableProfit / 10)));
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

  // 计算止损价格
  calculateStopLossPrice({ principal, currentPrice, totalQty, maxDrawdownRatio }) {
    const maxLoss = principal * maxDrawdownRatio;
    const stopLossDistance = maxLoss / (totalQty * currentPrice);
    return this.round2(currentPrice * (1 - stopLossDistance));
  }

  // 获取操作类型
  getOperationType(index, source) {
    if (index === 0) return '初始开仓';
    return `第${index}次加仓`;
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
      const currentPrice = parseFloat(document.getElementById('currentPrice').value);
      const stopLossPrice = parseFloat(document.getElementById('stopLossPrice').value);

      if (isNaN(maxLossAmount) || isNaN(currentPrice) || isNaN(stopLossPrice)) {
        throw new Error('请输入有效的数值');
      }

      if (maxLossAmount <= 0 || currentPrice <= 0 || stopLossPrice <= 0) {
        throw new Error('所有数值必须大于0');
      }

      if (currentPrice <= stopLossPrice) {
        throw new Error('当前价格必须大于止损价格');
      }

      const result = calculator.calculateInitialLeverage({
        maxLossAmount,
        currentPrice,
        stopLossPrice
      });

      // 存储计算结果
      window.calculatedPrincipal = result.suggestedMargin;
      window.calculatedLeverage = result.maxLeverage;
      window.calculatedStopLoss = result.stopLossPrice;
      window.calculatedStopLossDistance = result.stopLossDistance;
      window.calculatedCurrentPrice = result.entryPrice;

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

      if (targetPrice <= window.calculatedCurrentPrice) {
        throw new Error('目标价格必须大于当前价格');
      }

      compareStrategies(calculator, {
        suggestedMargin: window.calculatedPrincipal,
        maxLeverage: window.calculatedLeverage,
        stopLossPrice: window.calculatedStopLoss,
        stopLossDistance: window.calculatedStopLossDistance,
        entryPrice: window.calculatedCurrentPrice
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

      if (targetPrice <= window.calculatedCurrentPrice) {
        throw new Error('目标价格必须大于当前价格');
      }

      const result = calculator.simulateRollup({
        principal: window.calculatedPrincipal,
        initLeverage: window.calculatedLeverage,
        entryPrice: window.calculatedCurrentPrice,
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
