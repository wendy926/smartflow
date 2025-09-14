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
  const calculateRollupBtn = document.getElementById('calculateRollup');

  const calculator = new RollupCalculator();

  // 加载全局设置
  async function loadGlobalSettings() {
    try {
      if (window.apiClient && typeof window.apiClient.getUserSettings === 'function') {
        const settings = await window.apiClient.getUserSettings();
        if (settings && settings.maxLossAmount) {
          const maxLossElement = document.getElementById('maxLossAmount');
          if (maxLossElement) {
            maxLossElement.value = settings.maxLossAmount;
            console.log('✅ 已加载全局最大损失设置:', settings.maxLossAmount, 'USDT');
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ 加载全局设置失败，使用默认值:', error);
    }
  }

  // 初始化时加载全局设置
  loadGlobalSettings();

  // 监听最大损失金额变化，同步到全局设置
  const maxLossElement = document.getElementById('maxLossAmount');
  if (maxLossElement) {
    maxLossElement.addEventListener('change', async function () {
      try {
        if (window.apiClient && typeof window.apiClient.setUserSetting === 'function') {
          await window.apiClient.setUserSetting('maxLossAmount', this.value);
          console.log('✅ 最大损失金额已同步到全局设置:', this.value, 'USDT');
        }
      } catch (error) {
        console.warn('⚠️ 同步全局设置失败:', error);
      }
    });
  }

  // 监听全局设置变化事件，实时同步
  window.addEventListener('globalSettingsChanged', function (event) {
    if (event.detail && event.detail.maxLossAmount) {
      const maxLossElement = document.getElementById('maxLossAmount');
      if (maxLossElement && maxLossElement.value !== event.detail.maxLossAmount) {
        maxLossElement.value = event.detail.maxLossAmount;
        console.log('🔄 已同步全局最大损失设置:', event.detail.maxLossAmount, 'USDT');
      }
    }
  });

  // 初单计算
  calculateInitialBtn.addEventListener('click', function () {
    try {
      // 调试：检查DOM元素是否存在
      const maxLossElement = document.getElementById('maxLossAmount');
      const currentPriceElement = document.getElementById('currentPrice');
      const stopLossElement = document.getElementById('stopLossPrice');

      console.log('🔍 DOM元素检查:', {
        maxLossElement: maxLossElement,
        currentPriceElement: currentPriceElement,
        stopLossElement: stopLossElement
      });

      if (!maxLossElement || !currentPriceElement || !stopLossElement) {
        throw new Error('无法找到必要的输入元素，请刷新页面重试');
      }

      const maxLossAmount = parseFloat(maxLossElement.value);
      const currentPrice = parseFloat(currentPriceElement.value);
      const stopLossPrice = parseFloat(stopLossElement.value);

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


  // 计算动态杠杆滚仓
  calculateRollupBtn.addEventListener('click', function () {
    try {
      if (!window.calculatedPrincipal || !window.calculatedLeverage) {
        throw new Error('请先点击"初单计算"按钮');
      }

      const targetPrice = parseFloat(document.getElementById('targetPrice').value);
      const triggerRatio = parseFloat(document.getElementById('triggerRatio').value);
      const leverageDecay = parseFloat(document.getElementById('leverageDecay').value);
      const profitLockRatio = parseFloat(document.getElementById('profitLockRatio').value);
      const minLeverage = parseInt(document.getElementById('minLeverage').value);

      if (isNaN(targetPrice) || targetPrice <= 0) {
        throw new Error('请输入有效的目标价格');
      }

      if (targetPrice <= window.calculatedCurrentPrice) {
        throw new Error('目标价格必须大于当前价格');
      }

      const result = calculator.simulateDynamicPyramid({
        principal: window.calculatedPrincipal,
        initialLeverage: window.calculatedLeverage,
        priceStart: window.calculatedCurrentPrice,
        priceTarget: targetPrice,
        triggerRatio: triggerRatio,
        leverageDecay: leverageDecay,
        profitLockRatio: profitLockRatio,
        minLeverage: minLeverage
      });

      displayResults(result);

    } catch (err) {
      displayError(err.message);
    }
  });

  // 显示初单计算结果
  function displayInitialCalculation(data) {
    // 调试：检查DOM元素是否存在
    const principalElement = document.getElementById('calculatedPrincipal');
    const leverageElement = document.getElementById('calculatedLeverage');
    const stopLossElement = document.getElementById('calculatedStopLoss');
    const distanceElement = document.getElementById('calculatedStopLossDistance');

    console.log('🔍 显示结果DOM元素检查:', {
      principalElement,
      leverageElement,
      stopLossElement,
      distanceElement
    });

    if (!principalElement || !leverageElement || !stopLossElement || !distanceElement) {
      throw new Error('无法找到结果显示元素，请刷新页面重试');
    }

    principalElement.textContent = calculator.formatNumber(data.suggestedMargin) + ' U';
    leverageElement.textContent = data.maxLeverage;
    stopLossElement.textContent = calculator.formatPrice(data.stopLossPrice) + ' U';
    distanceElement.textContent = calculator.formatNumber(data.stopLossDistance) + '%';

    document.getElementById('initialCalculation').classList.remove('hidden');
    document.getElementById('error').classList.add('hidden');
    document.getElementById('results').classList.add('hidden');
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

    // 只显示关键步骤的仓位信息
    const keyPositions = result.positions.filter((pos, index) =>
      index === 0 || pos.operation.includes('滚仓') || index === result.positions.length - 1
    );

    keyPositions.forEach((pos, index) => {
      const row = document.createElement('tr');
      const floatingProfit = pos.floatingProfit || 0;
      const lockedProfit = pos.lockedProfit || 0;

      row.innerHTML = `
                <td>${index + 1}</td>
                <td>${pos.operation}</td>
                <td>${calculator.formatNumber(pos.price)}</td>
                <td>${calculator.formatNumber(pos.margin)}</td>
                <td>${pos.leverage}x</td>
                <td>${calculator.formatNumber(pos.position)}</td>
                <td>≈ ${calculator.formatNumber(pos.qty)}</td>
                <td>${calculator.formatNumber(floatingProfit)}</td>
                <td>${calculator.formatNumber(lockedProfit)}</td>
                <td>${calculator.formatNumber(pos.equity)}</td>
            `;
      positionsTableBody.appendChild(row);
    });

    // 填充滚仓步骤表格
    const addStepsTableBody = document.getElementById('addStepsTableBody');
    addStepsTableBody.innerHTML = '';

    if (result.rollupSteps && result.rollupSteps.length > 0) {
      result.rollupSteps.forEach((step, index) => {
        const row = document.createElement('tr');
        row.id = `rollupStepRow_${step.step}`;
        row.innerHTML = `
                    <td>
                        <input type="checkbox" class="step-checkbox" data-step="${step.step}" onchange="toggleStepCompletion(this)">
                    </td>
                    <td>第${step.step}次滚仓</td>
                    <td>${calculator.formatNumber(step.triggerPrice)}</td>
                    <td>${calculator.formatNumber(step.floatingProfit)}</td>
                    <td>${calculator.formatNumber(step.entryPrice)}</td>
                    <td>${calculator.formatNumber(step.marginUsed)}</td>
                    <td>${step.leverage}x</td>
                    <td>${calculator.formatNumber(step.positionValue)}</td>
                    <td>≈ ${calculator.formatNumber(step.qty)}</td>
                    <td>${calculator.formatNumber(step.lockedProfit)}</td>
                `;
        addStepsTableBody.appendChild(row);
      });
    } else {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="10" style="text-align: center; color: #6c757d;">无滚仓操作</td>';
      addStepsTableBody.appendChild(row);
    }

    // 显示结果
    document.getElementById('results').classList.remove('hidden');
    document.getElementById('error').classList.add('hidden');
    document.getElementById('initialCalculation').classList.add('hidden');
  }

  // 显示错误信息
  function displayError(message) {
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('error').classList.remove('hidden');
    document.getElementById('results').classList.add('hidden');
    document.getElementById('initialCalculation').classList.add('hidden');
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
