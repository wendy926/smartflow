// popup.js
// 斐波拉契滚仓计算器界面逻辑

document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('rollupForm');
  const loading = document.getElementById('loading');
  const results = document.getElementById('results');
  const error = document.getElementById('error');
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
    error.classList.add('hidden');
    results.classList.add('hidden');
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
      error.classList.add('hidden');
      results.classList.add('hidden');
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
    results.classList.remove('hidden');
    error.classList.add('hidden');
    document.getElementById('initialCalculation').classList.add('hidden');
    document.getElementById('strategyComparison').classList.add('hidden');
  }

  // 显示错误信息
  function displayError(message) {
    document.getElementById('errorMessage').textContent = message;
    error.classList.remove('hidden');
    results.classList.add('hidden');
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
