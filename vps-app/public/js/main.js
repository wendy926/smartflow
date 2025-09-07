// public/js/main.js - 主应用逻辑

class SmartFlowApp {
  constructor() {
    this.allSymbols = ['BTCUSDT', 'ETHUSDT', 'LINKUSDT', 'LDOUSDT'];
    this.isLoading = false;
    this.userSettings = {
      maxLossAmount: '100' // 默认100 USDT
    };
    this.updateTimes = {
      trend: null,
      signal: null,
      execution: null
    };
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.loadUserSettings();
    this.loadInitialData();
    this.startMonitoringRefresh(); // 启动监控数据自动刷新
    this.updateStatusDisplay(); // 更新状态显示
  }

  // 加载用户设置
  async loadUserSettings() {
    try {
      const settings = await window.apiClient.getUserSettings();
      if (settings) {
        this.userSettings = { ...this.userSettings, ...settings };

        // 应用设置到UI
        const maxLossSelect = document.getElementById('maxLossAmount');

        if (maxLossSelect && this.userSettings.maxLossAmount) {
          maxLossSelect.value = this.userSettings.maxLossAmount;
        }

        console.log('✅ 用户设置加载完成:', this.userSettings);
      }
    } catch (error) {
      console.error('❌ 加载用户设置失败:', error);
    }
  }

  // 保存用户设置
  async saveUserSetting(key, value) {
    try {
      this.userSettings[key] = value;
      await window.apiClient.setUserSetting(key, value);
      console.log(`✅ 设置保存成功: ${key} = ${value}`);
    } catch (error) {
      console.error(`❌ 保存设置失败: ${key} = ${value}`, error);
    }
  }

  setupEventListeners() {
    // 最大损失金额变化
    document.getElementById('maxLossAmount').addEventListener('change', async (e) => {
      const value = e.target.value;
      await this.saveUserSetting('maxLossAmount', value);
      console.log('💰 最大损失金额已更新为:', value, 'USDT');
    });

  }

  async loadInitialData() {
    try {
      this.showLoading(true);
      await this.loadAllData();
    } catch (error) {
      console.error('加载初始数据失败:', error);
      modal.showMessage('数据加载失败: ' + error.message, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async loadAllData() {
    try {
      console.log('🔍 开始loadAllData，检查API客户端状态...');
      console.log('window.apiClient:', window.apiClient);
      console.log('typeof window.apiClient:', typeof window.apiClient);

      // 确保API客户端已初始化
      if (!window.apiClient) {
        console.warn('API客户端未初始化，等待初始化...');
        await new Promise(resolve => setTimeout(resolve, 100));
        if (!window.apiClient) {
          throw new Error('API客户端初始化失败');
        }
      }

      console.log('API客户端已初始化，检查方法...');
      console.log('window.apiClient.getUpdateTimes:', window.apiClient.getUpdateTimes);
      console.log('typeof window.apiClient.getUpdateTimes:', typeof window.apiClient.getUpdateTimes);

      // 检查getUpdateTimes方法是否存在
      if (typeof window.apiClient.getUpdateTimes !== 'function') {
        console.error('getUpdateTimes方法不存在:', window.apiClient);
        console.error('API客户端所有方法:', Object.getOwnPropertyNames(window.apiClient));
        console.warn('⚠️ 将跳过getUpdateTimes调用，使用默认值');
      }

      console.log('✅ 开始加载数据...');

      // 尝试调用getUpdateTimes，如果失败则使用默认值
      let updateTimes = {
        trend: null,
        signal: null,
        execution: null
      };

      if (typeof window.apiClient.getUpdateTimes === 'function') {
        try {
          updateTimes = await window.apiClient.getUpdateTimes();
          console.log('✅ 成功获取更新时间:', updateTimes);
        } catch (error) {
          console.warn('⚠️ 获取更新时间失败，使用默认值:', error);
        }
      } else {
        console.warn('⚠️ getUpdateTimes方法不存在，使用默认值');
      }

      const [signals, history, stats] = await Promise.all([
        dataManager.getAllSignals(),
        dataManager.getSimulationHistory(),
        dataManager.getWinRateStats()
      ]);

      this.updateStatsDisplay(signals, stats);
      this.updateSignalsTable(signals);
      this.updateSimulationTable(history);

      // 使用服务器返回的更新时间
      if (updateTimes) {
        this.updateTimes.trend = updateTimes.trend;
        this.updateTimes.signal = updateTimes.signal;
        this.updateTimes.execution = updateTimes.execution;
      }
      this.updateStatusDisplay();
    } catch (error) {
      console.error('加载数据失败:', error);
      // 如果API调用失败，使用默认值继续
      if (error.message.includes('API客户端')) {
        console.warn('使用默认更新时间');
        this.updateTimes = {
          trend: null,
          signal: null,
          execution: null
        };
        this.updateStatusDisplay();
      } else {
        throw error;
      }
    }
  }

  updateStatsDisplay(signals, stats) {
    // 更新信号统计
    const totalSignals = signals.length;
    const longSignals = signals.filter(s => s.signal === 'LONG' || s.signal === '做多' || (s.execution && s.execution.includes('做多_'))).length;
    const shortSignals = signals.filter(s => s.signal === 'SHORT' || s.signal === '做空' || (s.execution && s.execution.includes('做空_'))).length;

    document.getElementById('totalSignals').textContent = totalSignals;
    document.getElementById('longSignals').textContent = longSignals;
    document.getElementById('shortSignals').textContent = shortSignals;
    document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString('zh-CN');

    // 更新胜率统计
    if (stats) {
      const winRate = dataManager.formatPercentage(stats.win_rate || 0);
      const winDetails = `${stats.winning_trades || 0}/${stats.total_trades || 0}`;

      document.getElementById('winRate').textContent = winRate;
      document.getElementById('winRateDetails').textContent = winDetails;
    }
  }

  // 设置单元格背景颜色
  setCellBackgroundColors(row, signal) {
    // 获取所有单元格
    const cells = row.querySelectorAll('td');

    // 清除所有相关单元格的样式
    [2, 4, 5].forEach(index => {
      if (cells[index]) {
        cells[index].style.backgroundColor = '';
        cells[index].style.border = '';
        cells[index].style.fontWeight = '';
      }
    });

    // 趋势列（第3列，索引2）
    if (cells[2]) {
      if (signal.trend === '多头趋势') {
        cells[2].style.backgroundColor = '#d4edda'; // 绿色
        cells[2].style.border = '2px solid #28a745';
        cells[2].style.fontWeight = 'bold';
      } else if (signal.trend === '空头趋势') {
        cells[2].style.backgroundColor = '#f8d7da'; // 红色
        cells[2].style.border = '2px solid #dc3545';
        cells[2].style.fontWeight = 'bold';
      }
    }

    // 信号列（第5列，索引4）
    if (cells[4]) {
      // 检查信号字段，包括做多/做空信号
      if (signal.signal === '做多' || signal.signal === 'LONG' ||
        (signal.signal && signal.signal.includes('做多'))) {
        cells[4].style.backgroundColor = '#d4edda'; // 绿色
        cells[4].style.border = '2px solid #28a745';
        cells[4].style.fontWeight = 'bold';
      } else if (signal.signal === '做空' || signal.signal === 'SHORT' ||
        (signal.signal && signal.signal.includes('做空'))) {
        cells[4].style.backgroundColor = '#f8d7da'; // 红色
        cells[4].style.border = '2px solid #dc3545';
        cells[4].style.fontWeight = 'bold';
      }
    }

    // 入场执行列（第6列，索引5）
    if (cells[5]) {
      // 检查执行字段，包括做多_和做空_模式
      if (signal.execution && (signal.execution.includes('做多_') || signal.execution.includes('LONG_'))) {
        cells[5].style.backgroundColor = '#d4edda'; // 绿色
        cells[5].style.border = '2px solid #28a745';
        cells[5].style.fontWeight = 'bold';
      } else if (signal.execution && (signal.execution.includes('做空_') || signal.execution.includes('SHORT_'))) {
        cells[5].style.backgroundColor = '#f8d7da'; // 红色
        cells[5].style.border = '2px solid #dc3545';
        cells[5].style.fontWeight = 'bold';
      }
    }
  }

  updateSignalsTable(signals) {
    const tbody = document.getElementById('signalsTableBody');
    tbody.innerHTML = '';

    if (signals.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #6c757d;">暂无信号数据</td></tr>';
      return;
    }

    // 检查是否有新的入场执行信号，自动触发模拟交易
    this.checkAndAutoTriggerSimulation(signals);

    signals.forEach(signal => {
      // 计算数据采集成功率
      const dataCollectionRate = signal.dataCollectionRate || 0;
      const dataCollectionClass = dataCollectionRate >= 95 ? 'data-healthy' :
        dataCollectionRate >= 80 ? 'data-warning' : 'data-error';

      // 创建主行
      const row = document.createElement('tr');
      // 获取小时得分和执行模式
      const hourlyScore = signal.hourlyScore || 0;
      const executionMode = signal.executionMode || 'NONE';
      const signalStrength = signal.signalStrength || 'NONE';

      // 获取模式A和模式B的判断结果
      const modeA = signal.modeA || false;
      const modeB = signal.modeB || false;

      // 设置单元格背景颜色
      console.log(`🎨 设置 ${signal.symbol} 单元格背景颜色:`, {
        trend: signal.trend,
        signal: signal.signal,
        execution: signal.execution
      });
      this.setCellBackgroundColors(row, signal);

      // 构建入场执行列内容
      let executionDisplay = signal.execution || '--';
      if (signal.execution && signal.execution.includes('EXECUTE')) {
        if (modeA) {
          executionDisplay = `${signal.execution} (模式A)`;
        } else if (modeB) {
          executionDisplay = `${signal.execution} (模式B)`;
        }
      }

      // 构建当前价格列内容（包含入场价格）
      let priceDisplay = dataManager.formatNumber(signal.currentPrice || 0);
      if (signal.entrySignal) {
        priceDisplay += `<br><small style="color: #666;">入场: ${dataManager.formatNumber(signal.entrySignal)}</small>`;
      }

      row.innerHTML = `
                <td>
                    <button class="expand-btn" onclick="toggleHistory('${signal.symbol}')" title="查看详细信息">+</button>
                </td>
                <td>${signal.symbol}</td>
                <td class="${dataManager.getTrendClass(signal.trend)}">${signal.trend || '--'}</td>
                <td class="${hourlyScore >= 4 ? 'score-strong' : hourlyScore >= 2 ? 'score-moderate' : 'score-weak'}" title="小时级多因子得分: ${hourlyScore}/6">
                    ${hourlyScore}
                </td>
                <td class="${dataManager.getSignalClass(signal.signal)}">${signal.signal || '--'}</td>
                <td class="${dataManager.getExecutionClass(signal.execution)}">${executionDisplay}</td>
                <td>${priceDisplay}</td>
                <td class="${dataCollectionClass}" title="数据采集成功率: ${dataCollectionRate.toFixed(1)}%">
                    ${dataCollectionRate.toFixed(1)}%
                </td>
            `;

      // 创建折叠行
      const historyRow = document.createElement('tr');
      historyRow.id = `history-${signal.symbol}`;
      historyRow.className = 'history-row';
      historyRow.style.display = 'none';
      historyRow.innerHTML = `
                <td colspan="8">
                    <div class="history-container">
                        <div class="history-header">
                            <h4>📊 ${signal.symbol} 详细信息</h4>
                            <button class="load-history-btn" onclick="loadHistory('${signal.symbol}')">加载详细信息</button>
                        </div>
                        <div id="history-content-${signal.symbol}">
                            <div class="loading">点击"加载详细信息"查看交易执行详情</div>
                        </div>
                    </div>
                </td>
            `;

      // 将行添加到表格
      tbody.appendChild(row);
      tbody.appendChild(historyRow);
    });
  }

  updateSimulationTable(history) {
    const tbody = document.getElementById('simulationTableBody');
    tbody.innerHTML = '';

    if (history.length === 0) {
      tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; color: #6c757d;">暂无模拟交易记录</td></tr>';
      return;
    }

    history.forEach(sim => {
      const row = document.createElement('tr');

      // 只有在交易结束时才显示盈亏和结果
      let profitLoss = '--';
      let resultClass = '';
      let resultText = '--';

      if (sim.status === 'CLOSED') {
        profitLoss = sim.profit_loss || 0;
        const isWin = sim.is_win;
        resultClass = isWin ? 'signal-long' : 'signal-short';
        resultText = isWin ? '盈利' : '亏损';
      } else if (sim.status === 'ACTIVE') {
        resultText = '进行中';
      }

      row.innerHTML = `
                <td>${sim.symbol}</td>
                <td>${dataManager.formatNumber(sim.entry_price)}</td>
                <td>${dataManager.formatNumber(sim.stop_loss_price)}</td>
                <td>${dataManager.formatNumber(sim.take_profit_price)}</td>
                <td>${sim.max_leverage}x</td>
                <td>${dataManager.formatNumber(sim.min_margin)}</td>
                <td>${sim.stop_loss_distance ? (sim.stop_loss_distance * 100).toFixed(2) + '%' : '--'}</td>
                <td>${sim.atr_value ? dataManager.formatNumber(sim.atr_value) : '--'}</td>
                <td>${dataManager.formatTime(sim.created_at)}</td>
                <td>${dataManager.formatTime(sim.closed_at)}</td>
                <td>${sim.exit_price ? dataManager.formatNumber(sim.exit_price) : '--'}</td>
                <td>${sim.exit_reason || '--'}</td>
                <td>${sim.trigger_reason || '--'}</td>
                <td class="${resultClass}">${profitLoss === '--' ? '--' : dataManager.formatNumber(profitLoss)}</td>
                <td class="${resultClass}">${resultText}</td>
            `;
      tbody.appendChild(row);
    });
  }

  showLoading(show) {
    this.isLoading = show;
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(btn => {
      btn.disabled = show;
    });

    if (show) {
      document.body.style.cursor = 'wait';
    } else {
      document.body.style.cursor = 'default';
    }
  }

  // 更新状态显示
  updateStatusDisplay() {
    const formatTime = (time) => {
      if (!time) return '--';
      const date = new Date(time);
      return date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    };

    document.getElementById('trendUpdateTime').textContent = formatTime(this.updateTimes.trend);
    document.getElementById('signalUpdateTime').textContent = formatTime(this.updateTimes.signal);
    document.getElementById('executionUpdateTime').textContent = formatTime(this.updateTimes.execution);
  }

  // 更新特定层级的时间
  updateLayerTime(layer, time) {
    this.updateTimes[layer] = time;
    this.updateStatusDisplay();
  }

  // 启动监控数据自动刷新（5分钟一次，不产生弹框）
  startMonitoringRefresh() {
    this.monitoringInterval = setInterval(async () => {
      try {
        // 静默刷新监控数据，不显示加载状态和消息
        const [signals, history, stats] = await Promise.all([
          dataManager.getAllSignals(),
          dataManager.getSimulationHistory(),
          dataManager.getWinRateStats()
        ]);

        this.updateStatsDisplay(signals, stats);
        this.updateSignalsTable(signals);
        this.updateSimulationTable(history);

        console.log('监控数据静默刷新完成');
      } catch (error) {
        console.error('监控数据刷新失败:', error);
      }
    }, 300000); // 5分钟 = 300000毫秒
  }

  stopMonitoringRefresh() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * 检查并自动触发模拟交易
   * 当检测到新的入场执行信号时，自动启动模拟交易
   */
  async checkAndAutoTriggerSimulation(signals) {
    try {
      // 获取当前已触发的模拟交易记录
      const currentHistory = await dataManager.getSimulationHistory();
      const triggeredSymbols = new Set(currentHistory.map(trade => trade.symbol));

      // 检查每个信号
      for (const signal of signals) {
        // 检查是否有入场执行信号
        if (signal.execution && (signal.execution.includes('做多_') || signal.execution.includes('做空_'))) {
          // 如果这个交易对还没有触发过模拟交易，则自动触发
          if (!triggeredSymbols.has(signal.symbol)) {
            console.log(`🚀 检测到新的入场执行信号，自动启动模拟交易: ${signal.symbol} - ${signal.execution}`);

            // 自动启动模拟交易
            await this.autoStartSimulation(signal);

            // 添加到已触发列表，避免重复触发
            triggeredSymbols.add(signal.symbol);
          }
        }
      }
    } catch (error) {
      console.error('自动触发模拟交易检查失败:', error);
    }
  }

  /**
   * 自动启动模拟交易
   */
  async autoStartSimulation(signalData) {
    try {
      const tradeData = {
        symbol: signalData.symbol,
        entryPrice: signalData.entrySignal,
        stopLoss: signalData.stopLoss,
        takeProfit: signalData.takeProfit,
        maxLeverage: signalData.maxLeverage,
        minMargin: signalData.minMargin,
        stopLossDistance: signalData.stopLossDistance,
        atrValue: signalData.atrValue,
        executionMode: signalData.executionMode,
        direction: signalData.execution.includes('做多_') ? 'LONG' : 'SHORT',
        timestamp: new Date().toISOString()
      };

      // 发送模拟交易请求
      const response = await fetch('/api/simulation/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(tradeData)
      });

      if (response.ok) {
        console.log(`✅ 自动启动模拟交易成功: ${signalData.symbol}`);
        // 显示通知
        this.showNotification(`🚀 自动启动模拟交易: ${signalData.symbol} - ${signalData.execution}`, 'success');
      } else {
        const error = await response.text();
        console.error(`❌ 自动启动模拟交易失败: ${signalData.symbol}`, error);
        this.showNotification(`❌ 自动启动模拟交易失败: ${signalData.symbol}`, 'error');
      }
    } catch (error) {
      console.error('自动启动模拟交易失败:', error);
      this.showNotification(`❌ 自动启动模拟交易失败: ${signalData.symbol}`, 'error');
    }
  }

  /**
   * 显示通知消息
   */
  showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 6px;
      color: white;
      font-weight: 500;
      z-index: 10000;
      max-width: 400px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: slideIn 0.3s ease-out;
    `;

    // 设置背景颜色
    if (type === 'success') {
      notification.style.backgroundColor = '#28a745';
    } else if (type === 'error') {
      notification.style.backgroundColor = '#dc3545';
    } else {
      notification.style.backgroundColor = '#17a2b8';
    }

    notification.textContent = message;
    document.body.appendChild(notification);

    // 3秒后自动移除
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

}

// 启动模拟交易
async function startSimulation(symbol) {
  try {
    const signals = await dataManager.getAllSignals();
    const signalData = signals.find(s => s.symbol === symbol);

    if (!signalData || !signalData.execution || (!signalData.execution.includes('做多_') && !signalData.execution.includes('做空_'))) {
      alert('该交易对当前没有有效的交易信号');
      return;
    }

    const tradeData = {
      symbol: symbol,
      entryPrice: signalData.entrySignal,
      stopLoss: signalData.stopLoss,
      takeProfit: signalData.takeProfit,
      maxLeverage: signalData.maxLeverage,
      minMargin: signalData.minMargin,
      executionMode: signalData.executionMode,
      direction: signalData.execution.includes('做多_') ? 'LONG' : 'SHORT',
      timestamp: new Date().toISOString()
    };

    // 发送模拟交易请求
    const response = await fetch('/api/simulation/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tradeData)
    });

    if (response.ok) {
      alert(`✅ 模拟交易已启动: ${symbol}`);
      // 刷新页面数据
      await app.loadInitialData();
    } else {
      const error = await response.text();
      alert(`❌ 启动模拟交易失败: ${error}`);
    }
  } catch (error) {
    console.error('启动模拟交易失败:', error);
    alert('启动模拟交易失败: ' + error.message);
  }
}

// 查看交易历史
async function viewTradeHistory(symbol) {
  try {
    console.log(`📊 查看交易历史: ${symbol} - 不会更新表格数据`);

    const response = await fetch(`/api/simulation/history/${symbol}`);
    const history = await response.json();

    if (history.length === 0) {
      alert('暂无交易历史记录');
      return;
    }

    // 创建历史记录弹窗
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>📊 ${symbol} 交易历史</h3>
          <p style="font-size: 12px; color: #666; margin: 5px 0 0 0;">仅查看历史记录，不影响当前表格数据</p>
          <span class="close" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</span>
        </div>
        <div class="modal-body">
          <table class="history-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>方向</th>
                <th>入场价格</th>
                <th>止损价格</th>
                <th>止盈价格</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              ${history.map(trade => `
                <tr>
                  <td>${new Date(trade.timestamp).toLocaleString()}</td>
                  <td>${trade.direction}</td>
                  <td>${dataManager.formatNumber(trade.entryPrice)}</td>
                  <td>${dataManager.formatNumber(trade.stopLoss)}</td>
                  <td>${dataManager.formatNumber(trade.takeProfit)}</td>
                  <td>${trade.status || '进行中'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  } catch (error) {
    console.error('查看交易历史失败:', error);
    alert('查看交易历史失败: ' + error.message);
  }
}

// 全局函数
async function refreshAllSignals() {
  try {
    app.showLoading(true);
    await window.apiClient.refreshAllSignals();
    await app.loadAllData();
    modal.showMessage('所有信号已刷新', 'success');
  } catch (error) {
    console.error('刷新信号失败:', error);
    modal.showMessage('刷新失败: ' + error.message, 'error');
  } finally {
    app.showLoading(false);
  }
}

async function refreshSymbol(symbol) {
  try {
    app.showLoading(true);
    // 这里可以添加单个交易对的刷新逻辑
    await app.loadAllData();
    modal.showMessage(`${symbol} 已刷新`, 'success');
  } catch (error) {
    console.error(`刷新 ${symbol} 失败:`, error);
    modal.showMessage(`刷新 ${symbol} 失败: ` + error.message, 'error');
  } finally {
    app.showLoading(false);
  }
}

// 切换历史记录显示
function toggleHistory(symbol) {
  const historyRow = document.getElementById(`history-${symbol}`);
  const expandBtn = event.target;

  if (historyRow.style.display === 'none') {
    historyRow.style.display = 'table-row';
    expandBtn.textContent = '-';
    expandBtn.title = '收起详细信息';
    loadHistory(symbol);
  } else {
    historyRow.style.display = 'none';
    expandBtn.textContent = '+';
    expandBtn.title = '查看详细信息';
  }
}

// 加载历史记录
async function loadHistory(symbol) {
  const contentDiv = document.getElementById(`history-content-${symbol}`);
  contentDiv.innerHTML = '<div class="loading-dots">加载中<span>.</span><span>.</span><span>.</span></div>';

  try {
    // 获取信号数据
    const signals = await dataManager.getAllSignals();
    const signalData = signals.find(s => s.symbol === symbol);

    if (!signalData) {
      contentDiv.innerHTML = '<div class="error">数据不可用</div>';
      return;
    }

    // 检查是否有入场执行信号
    const hasExecutionSignal = signalData.execution && (signalData.execution.includes('做多_') || signalData.execution.includes('做空_'));

    if (hasExecutionSignal) {
      // 有入场执行信号时：只显示交易执行详情和模拟交易历史
      await loadExecutionDetails(contentDiv, symbol, signalData);
    } else {
      // 没有入场执行信号时：只显示模拟交易历史记录
      await loadSimulationHistoryOnly(contentDiv, symbol);
    }
  } catch (error) {
    console.error('加载详细信息失败:', error);
    contentDiv.innerHTML = '<div class="error">加载失败: ' + error.message + '</div>';
  }
}

// 只加载模拟交易历史记录（当没有入场执行信号时）
async function loadSimulationHistoryOnly(contentDiv, symbol) {
  try {
    // 获取该交易对的模拟交易历史
    const response = await fetch(`/api/simulation/history/${symbol}`);
    const history = await response.json();

    if (history.length === 0) {
      contentDiv.innerHTML = `
        <div class="no-data">
          <h5>📊 模拟交易历史</h5>
          <p>该交易对暂无模拟交易记录</p>
        </div>
      `;
      return;
    }

    // 构建模拟交易历史表格
    const historyTable = `
      <div class="simulation-history">
        <h5>📊 模拟交易历史</h5>
        <div class="table-wrapper">
          <table class="history-table">
            <thead>
              <tr>
                <th>交易对</th>
                <th>入场价格</th>
                <th>止损价格</th>
                <th>止盈价格</th>
                <th>杠杆倍数</th>
                <th>最小保证金</th>
                <th>止损距离</th>
                <th>ATR值</th>
                <th>入场时间</th>
                <th>出场时间</th>
                <th>出场价格</th>
                <th>出场原因</th>
                <th>触发原因</th>
                <th>盈亏</th>
                <th>结果</th>
              </tr>
            </thead>
            <tbody>
              ${history.map(sim => {
      const profitLoss = sim.profit_loss !== null ? sim.profit_loss : '--';
      const isWin = sim.is_win;
      let resultClass = '';
      let resultText = '--';

      if (sim.status === 'CLOSED') {
        resultClass = isWin ? 'win' : 'loss';
        resultText = isWin ? '盈利' : '亏损';
      } else if (sim.status === 'ACTIVE') {
        resultText = '进行中';
      }

      return `
                  <tr>
                    <td>${sim.symbol}</td>
                    <td>${dataManager.formatNumber(sim.entry_price)}</td>
                    <td>${dataManager.formatNumber(sim.stop_loss_price)}</td>
                    <td>${dataManager.formatNumber(sim.take_profit_price)}</td>
                    <td>${sim.max_leverage}x</td>
                    <td>${dataManager.formatNumber(sim.min_margin)}</td>
                    <td>${sim.stop_loss_distance ? (sim.stop_loss_distance * 100).toFixed(2) + '%' : '--'}</td>
                    <td>${sim.atr_value ? dataManager.formatNumber(sim.atr_value) : '--'}</td>
                    <td>${dataManager.formatTime(sim.created_at)}</td>
                    <td>${dataManager.formatTime(sim.closed_at)}</td>
                    <td>${sim.exit_price ? dataManager.formatNumber(sim.exit_price) : '--'}</td>
                    <td>${sim.exit_reason || '--'}</td>
                    <td>${sim.trigger_reason || '--'}</td>
                    <td class="${resultClass}">${profitLoss === '--' ? '--' : dataManager.formatNumber(profitLoss)}</td>
                    <td class="${resultClass}">${resultText}</td>
                  </tr>
                `;
    }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    contentDiv.innerHTML = historyTable;
  } catch (error) {
    console.error('加载模拟交易历史失败:', error);
    contentDiv.innerHTML = '<div class="error">加载模拟交易历史失败: ' + error.message + '</div>';
  }
}

// 加载交易执行详情和模拟交易历史
async function loadExecutionDetails(contentDiv, symbol, signalData) {
  try {
    // 获取该交易对的模拟交易历史
    const response = await fetch(`/api/simulation/history/${symbol}`);
    const history = await response.json();

    // 构建交易执行详情HTML
    const executionDetailsHtml = `
      <div class="execution-details">
        <h5>🎯 交易执行详情</h5>
        <div class="execution-grid">
          <div class="execution-item">
            <span class="label">入场价格:</span>
            <span class="value">${signalData.entrySignal ? dataManager.formatNumber(signalData.entrySignal) : '--'}</span>
          </div>
          <div class="execution-item">
            <span class="label">止损价格:</span>
            <span class="value">${signalData.stopLoss ? dataManager.formatNumber(signalData.stopLoss) : '--'}</span>
          </div>
          <div class="execution-item">
            <span class="label">止盈价格:</span>
            <span class="value">${signalData.takeProfit ? dataManager.formatNumber(signalData.takeProfit) : '--'}</span>
          </div>
          <div class="execution-item">
            <span class="label">最大杠杆数:</span>
            <span class="value">${signalData.maxLeverage ? signalData.maxLeverage + 'x' : '--'}</span>
          </div>
          <div class="execution-item">
            <span class="label">最小保证金:</span>
            <span class="value">${signalData.minMargin ? dataManager.formatNumber(signalData.minMargin) + ' USDT' : '--'}</span>
          </div>
          <div class="execution-item">
            <span class="label">ATR数值:</span>
            <span class="value">${signalData.atrValue ? dataManager.formatNumber(signalData.atrValue) : '--'}</span>
          </div>
          <div class="execution-item">
            <span class="label">止损距离:</span>
            <span class="value">${signalData.stopLossDistance ? (signalData.stopLossDistance * 100).toFixed(2) + '%' : '--'}</span>
          </div>
          <div class="execution-item">
            <span class="label">执行模式:</span>
            <span class="value">${signalData.executionMode || '--'}</span>
          </div>
        </div>
      </div>
    `;

    // 构建模拟交易历史HTML
    let historyHtml = '';
    if (history.length > 0) {
      historyHtml = `
        <div class="simulation-history">
          <h5>📊 ${symbol} 模拟交易历史</h5>
          <table class="history-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>方向</th>
                <th>入场价格</th>
                <th>止损价格</th>
                <th>止盈价格</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              ${history.map(trade => `
                <tr>
                  <td>${new Date(trade.created_at).toLocaleString()}</td>
                  <td>${trade.trigger_reason.includes('LONG') ? '做多' : '做空'}</td>
                  <td>${dataManager.formatNumber(trade.entry_price)}</td>
                  <td>${dataManager.formatNumber(trade.stop_loss_price)}</td>
                  <td>${dataManager.formatNumber(trade.take_profit_price)}</td>
                  <td>${trade.status === 'ACTIVE' ? '进行中' : trade.status}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else {
      historyHtml = `
        <div class="simulation-history">
          <h5>📊 ${symbol} 模拟交易历史</h5>
          <p style="text-align: center; color: #666; padding: 20px;">暂无模拟交易记录</p>
        </div>
      `;
    }

    const content = `
      <div style="padding: 20px;">
        <h4>${symbol} 交易执行详情</h4>
        ${executionDetailsHtml}
        ${historyHtml}
      </div>
    `;

    contentDiv.innerHTML = content;
  } catch (error) {
    console.error('加载执行详情失败:', error);
    contentDiv.innerHTML = '<div class="error">加载执行详情失败: ' + error.message + '</div>';
  }
}

// 加载完整信号详情（没有入场执行信号时）
async function loadFullSignalDetails(contentDiv, symbol, signalData) {
  // 构建数据采集详情HTML
  let dataCollectionHtml = '';
  if (signalData.dataCollectionRate !== undefined) {
    const statusClass = signalData.dataCollectionRate >= 95 ? 'data-healthy' :
      signalData.dataCollectionRate >= 80 ? 'data-warning' : 'data-error';
    dataCollectionHtml = `
      <div class="data-collection-details">
        <h5>📊 数据采集状态</h5>
        <div class="data-collection-item">
          <span class="label">数据采集率:</span>
          <span class="value ${statusClass}">${signalData.dataCollectionRate.toFixed(1)}%</span>
        </div>
      </div>
    `;
  }

  const content = `
    <div style="padding: 20px;">
      <h4>${symbol} 信号详情</h4>
      <div style="margin: 15px 0;">
        <h5>📈 信号分析</h5>
        <p><strong>趋势:</strong> <span class="${dataManager.getSignalClass(signalData.trend)}">${signalData.trend || '--'}</span></p>
        <p><strong>信号:</strong> <span class="${dataManager.getSignalClass(signalData.signal)}">${signalData.signal || '--'}</span></p>
        <p><strong>执行:</strong> <span class="${dataManager.getExecutionClass(signalData.execution)}">${signalData.execution || '--'}</span></p>
      </div>
      ${dataCollectionHtml}
    </div>
  `;

  contentDiv.innerHTML = content;
}

async function showSignalDetails(symbol) {
  try {
    // 获取信号数据
    const signals = await dataManager.getAllSignals();
    const signalData = signals.find(s => s.symbol === symbol);

    if (!signalData) {
      modal.showMessage(`${symbol} 数据不可用`, 'error');
      return;
    }

    // 构建交易执行详情HTML
    let executionDetailsHtml = '';
    if (signalData.execution && signalData.execution.includes('EXECUTE')) {
      executionDetailsHtml = `
        <div class="execution-details">
          <h5>🎯 交易执行详情</h5>
          <div class="execution-grid">
            <div class="execution-item">
              <span class="label">当前价格:</span>
              <span class="value">${dataManager.formatNumber(signalData.currentPrice)}</span>
            </div>
            <div class="execution-item">
              <span class="label">止损价格:</span>
              <span class="value">${signalData.stopLoss ? dataManager.formatNumber(signalData.stopLoss) : '--'}</span>
            </div>
            <div class="execution-item">
              <span class="label">止盈价格:</span>
              <span class="value">${signalData.targetPrice ? dataManager.formatNumber(signalData.targetPrice) : '--'}</span>
            </div>
            <div class="execution-item">
              <span class="label">风险回报比:</span>
              <span class="value">${signalData.riskRewardRatio ? signalData.riskRewardRatio.toFixed(2) + 'R' : '--'}</span>
            </div>
            <div class="execution-item">
              <span class="label">最大杠杆:</span>
              <span class="value">${signalData.maxLeverage ? signalData.maxLeverage + 'x' : '--'}</span>
            </div>
            <div class="execution-item">
              <span class="label">最小保证金:</span>
              <span class="value">${signalData.minMargin ? dataManager.formatNumber(signalData.minMargin) : '--'}</span>
            </div>
            <div class="execution-item">
              <span class="label">人工确认:</span>
              <span class="value ${signalData.manualConfirmation ? 'confirmation-yes' : 'confirmation-no'}">
                ${signalData.manualConfirmation ? '✅ 有效' : '❌ 无效'}
              </span>
            </div>
            <div class="execution-item">
              <span class="label">Setup High:</span>
              <span class="value">${signalData.setupHigh ? dataManager.formatNumber(signalData.setupHigh) : '--'}</span>
            </div>
            <div class="execution-item">
              <span class="label">Setup Low:</span>
              <span class="value">${signalData.setupLow ? dataManager.formatNumber(signalData.setupLow) : '--'}</span>
            </div>
            <div class="execution-item">
              <span class="label">ATR(14):</span>
              <span class="value">${signalData.atr ? dataManager.formatNumber(signalData.atr) : '--'}</span>
            </div>
          </div>
        </div>
      `;
    }

    // 构建数据采集详情HTML
    let dataCollectionHtml = '';
    if (signalData.dataCollectionRate !== undefined) {
      const statusClass = signalData.dataCollectionRate >= 95 ? 'data-healthy' :
        signalData.dataCollectionRate >= 80 ? 'data-warning' : 'data-error';
      dataCollectionHtml = `
        <div class="data-collection-details">
          <h5>📊 数据采集状态</h5>
          <div class="data-collection-item">
            <span class="label">数据采集率:</span>
            <span class="value ${statusClass}">${signalData.dataCollectionRate.toFixed(1)}%</span>
          </div>
        </div>
      `;
    }

    const content = `
        <div style="padding: 20px;">
            <h4>${symbol} 信号详情</h4>
            <div style="margin: 15px 0;">
              <h5>📈 信号分析</h5>
              <p><strong>趋势:</strong> <span class="${dataManager.getSignalClass(signalData.trend)}">${signalData.trend || '--'}</span></p>
              <p><strong>信号:</strong> <span class="${dataManager.getSignalClass(signalData.signal)}">${signalData.signal || '--'}</span></p>
              <p><strong>执行:</strong> <span class="${dataManager.getExecutionClass(signalData.execution)}">${signalData.execution || '--'}</span></p>
            </div>
            ${executionDetailsHtml}
            ${dataCollectionHtml}
        </div>
    `;
    modal.show(`${symbol} 信号详情`, content);
  } catch (error) {
    console.error('获取信号详情失败:', error);
    modal.showMessage('获取信号详情失败: ' + error.message, 'error');
  }
}

// 显示数据验证详情
function showDataValidationDetails(errors) {
  const errorGroups = {};

  // 按错误类型分组
  errors.forEach(error => {
    const parts = error.split(': ');
    if (parts.length === 2) {
      const symbol = parts[0];
      const errorType = parts[1];
      if (!errorGroups[errorType]) {
        errorGroups[errorType] = [];
      }
      errorGroups[errorType].push(symbol);
    }
  });

  let content = '<div style="padding: 20px;"><h4>📊 数据验证错误详情</h4>';

  Object.entries(errorGroups).forEach(([errorType, symbols]) => {
    content += `
      <div style="margin: 15px 0; padding: 10px; background: #f8f9fa; border-radius: 5px;">
        <h5 style="color: #dc3545; margin: 0 0 10px 0;">${errorType}</h5>
        <div style="display: flex; flex-wrap: wrap; gap: 5px;">
          ${symbols.map(symbol => `<span style="background: #dc3545; color: white; padding: 2px 8px; border-radius: 3px; font-size: 0.8rem;">${symbol}</span>`).join('')}
        </div>
      </div>
    `;
  });

  content += '</div>';

  modal.show('数据验证错误详情', content);
}

// 显示数据质量问题详情
function showDataQualityDetails(issues) {
  const issueGroups = {};

  // 按问题类型分组
  issues.forEach(issue => {
    const parts = issue.split(': ');
    if (parts.length === 2) {
      const symbol = parts[0];
      const issueDetail = parts[1];
      if (!issueGroups[issueDetail]) {
        issueGroups[issueDetail] = [];
      }
      issueGroups[issueDetail].push(symbol);
    }
  });

  let content = '<div style="padding: 20px;"><h4>⚠️ 数据质量问题详情</h4>';

  Object.entries(issueGroups).forEach(([issueType, symbols]) => {
    content += `
      <div style="margin: 15px 0; padding: 10px; background: #fff3cd; border-radius: 5px; border-left: 4px solid #ff6b35;">
        <h5 style="color: #ff6b35; margin: 0 0 10px 0;">${issueType}</h5>
        <div style="display: flex; flex-wrap: wrap; gap: 5px;">
          ${symbols.map(symbol => `<span style="background: #ff6b35; color: white; padding: 2px 8px; border-radius: 3px; font-size: 0.8rem;">${symbol}</span>`).join('')}
        </div>
      </div>
    `;
  });

  content += '</div>';

  modal.show('数据质量问题详情', content);
}

async function testAPIConnection() {
  try {
    app.showLoading(true);
    await window.apiClient.getAllSignals();
    modal.showMessage('API连接正常', 'success');
  } catch (error) {
    console.error('API连接测试失败:', error);
    modal.showMessage('API连接失败: ' + error.message, 'error');
  } finally {
    app.showLoading(false);
  }
}

async function loadUnifiedMonitoring() {
  try {
    // 检查是否已有监控面板打开
    const existingPanel = document.querySelector('.unified-monitoring-panel');
    if (existingPanel) {
      // 如果已存在，直接刷新数据
      await refreshMonitoringData();
      return;
    }

    // 显示加载状态
    const loadingHtml = `
      <div class="unified-monitoring-panel">
        <div class="monitoring-content">
          <div class="monitoring-header">
            <h3>📊 SmartFlow 统一监控中心</h3>
            <div class="monitoring-controls">
              <button class="btn secondary" onclick="closeMonitoringPanel()">×</button>
            </div>
          </div>
          <div class="monitoring-body">
            <div class="loading-container">
              <div class="loading-spinner"></div>
              <p>正在加载监控数据...</p>
            </div>
          </div>
        </div>
      </div>
    `;

    // 先显示加载界面
    document.body.insertAdjacentHTML('beforeend', loadingHtml);

    // 添加事件监听器
    const panel = document.querySelector('.unified-monitoring-panel');
    panel.addEventListener('click', (e) => {
      if (e.target === panel) {
        closeMonitoringPanel();
      }
    });

    // 添加ESC键关闭
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.querySelector('.unified-monitoring-panel')) {
        closeMonitoringPanel();
      }
    });

    // 异步加载数据并更新界面
    try {
      const data = await dataManager.getMonitoringData();
      await updateMonitoringPanel(data);
    } catch (error) {
      console.error('加载监控数据失败:', error);
      updateMonitoringPanelWithError(error.message);
    }

  } catch (error) {
    console.error('创建监控面板失败:', error);
    modal.showMessage('监控面板创建失败: ' + error.message, 'error');
  }
}

// 更新监控面板内容
async function updateMonitoringPanel(data) {
  const panel = document.querySelector('.unified-monitoring-panel');
  if (!panel) return;

  // 创建完整的监控面板HTML
  const monitoringHtml = `
    <div class="monitoring-content">
      <div class="monitoring-header">
        <h3>📊 SmartFlow 统一监控中心</h3>
        <div class="monitoring-controls">
          <button class="btn primary" onclick="refreshMonitoringData()">🔄 刷新</button>
          <button class="btn secondary" onclick="closeMonitoringPanel()">×</button>
        </div>
      </div>
      <div class="monitoring-body">
        <div class="system-overview">
          <h4>📈 系统概览</h4>
          <div class="overview-cards">
            <div class="overview-card">
              <span class="card-icon">📊</span>
              <div class="card-content">
                <div class="card-title">总交易对</div>
                <div class="card-value" id="totalSymbols">${data.summary.totalSymbols}</div>
              </div>
            </div>
            <div class="overview-card">
              <span class="card-icon">✅</span>
              <div class="card-content">
                <div class="card-title">健康状态</div>
                <div class="card-value" id="healthySymbols">${data.summary.healthySymbols}</div>
              </div>
            </div>
            <div class="overview-card">
              <span class="card-icon">⚠️</span>
              <div class="card-content">
                <div class="card-title">警告状态</div>
                <div class="card-value" id="warningSymbols">${data.summary.warningSymbols}</div>
              </div>
            </div>
            <div class="overview-card">
              <span class="card-icon">📈</span>
              <div class="card-content">
                <div class="card-title">数据收集率</div>
                <div class="card-value" id="dataCollectionRate">${data.summary.completionRates.dataCollection.toFixed(1)}%</div>
              </div>
            </div>
            <div class="overview-card">
              <span class="card-icon">🔍</span>
              <div class="card-content">
                <div class="card-title">数据验证</div>
                <div class="card-value" id="dataValidationStatus">${data.summary.dataValidation?.hasErrors ? '⚠️ ' + data.summary.dataValidation.errorCount + ' 错误' : '✅ 正常'}</div>
                ${data.summary.dataValidation?.hasErrors ? '<div class="card-details" id="dataValidationDetails" style="font-size: 0.8rem; color: #dc3545; margin-top: 5px; cursor: pointer;">点击查看详情</div>' : ''}
              </div>
            </div>
            <div class="overview-card">
              <span class="card-icon">⚠️</span>
              <div class="card-content">
                <div class="card-title">数据质量</div>
                <div class="card-value" id="dataQualityStatus">${data.summary.dataQuality?.hasIssues ? '⚠️ ' + data.summary.dataQuality.issueCount + ' 问题' : '✅ 正常'}</div>
                ${data.summary.dataQuality?.hasIssues ? '<div class="card-details" id="dataQualityDetails" style="font-size: 0.8rem; color: #ff6b35; margin-top: 5px; cursor: pointer;">点击查看详情</div>' : ''}
              </div>
            </div>
          </div>
        </div>
        
        <div class="symbols-monitoring">
          <h4>🔍 交易对详细监控</h4>
          <div class="monitoring-tabs">
            <button class="tab-btn active" onclick="switchMonitoringTab('summary')">📊 汇总视图</button>
            <button class="tab-btn" onclick="switchMonitoringTab('detailed')">🔍 详细视图</button>
          </div>
          
          <!-- 汇总视图 -->
          <div id="summaryView" class="monitoring-view active">
            <div class="symbols-table-container">
              <table class="symbols-table">
                <thead>
                  <tr>
                    <th>交易对</th>
                    <th>数据收集率</th>
                    <th>信号分析率</th>
                    <th>模拟交易完成率</th>
                    <th>模拟交易进行率</th>
                    <th>刷新频率</th>
                    <th>整体状态</th>
                  </tr>
                </thead>
                <tbody id="monitoringTableBody">
                  <!-- 动态填充 -->
                </tbody>
              </table>
            </div>
          </div>
          
          <!-- 详细视图 -->
          <div id="detailedView" class="monitoring-view">
            <div class="symbols-table-container">
              <table class="symbols-table">
                <thead>
                  <tr>
                    <th>交易对</th>
                    <th>数据收集</th>
                    <th>信号分析</th>
                    <th>模拟交易</th>
                    <th>信号状态</th>
                    <th>最后更新</th>
                    <th>健康状态</th>
                  </tr>
                </thead>
                <tbody id="detailedTableBody">
                  <!-- 动态填充 -->
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // 更新面板内容
  panel.innerHTML = monitoringHtml;

  // 更新表格数据
  updateSummaryTable(data);
  updateDetailedTable(data);

  // 添加点击事件
  const dataValidationDetails = document.getElementById('dataValidationDetails');
  if (dataValidationDetails && data.summary.dataValidation?.hasErrors) {
    dataValidationDetails.onclick = () => showDataValidationDetails(data.summary.dataValidation.errors);
  }

  const dataQualityDetails = document.getElementById('dataQualityDetails');
  if (dataQualityDetails && data.summary.dataQuality?.hasIssues) {
    dataQualityDetails.onclick = () => showDataQualityDetails(data.summary.dataQuality.issues);
  }
}

// 显示错误信息
function updateMonitoringPanelWithError(errorMessage) {
  const panel = document.querySelector('.unified-monitoring-panel');
  if (!panel) return;

  panel.innerHTML = `
    <div class="monitoring-content">
      <div class="monitoring-header">
        <h3>📊 SmartFlow 统一监控中心</h3>
        <div class="monitoring-controls">
          <button class="btn secondary" onclick="closeMonitoringPanel()">×</button>
        </div>
      </div>
      <div class="monitoring-body">
        <div class="error-container">
          <div class="error-icon">❌</div>
          <h4>加载失败</h4>
          <p>${errorMessage}</p>
          <button class="btn primary" onclick="loadUnifiedMonitoring()">重试</button>
        </div>
      </div>
    </div>
  `;
}

// 刷新监控数据
async function refreshMonitoringData() {
  try {
    const data = await dataManager.getMonitoringData();

    // 更新概览数据
    const totalSymbolsEl = document.getElementById('totalSymbols');
    const healthySymbolsEl = document.getElementById('healthySymbols');
    const warningSymbolsEl = document.getElementById('warningSymbols');
    const dataCollectionRateEl = document.getElementById('dataCollectionRate');
    const dataValidationStatusEl = document.getElementById('dataValidationStatus');

    if (totalSymbolsEl) totalSymbolsEl.textContent = data.summary.totalSymbols;
    if (healthySymbolsEl) healthySymbolsEl.textContent = data.summary.healthySymbols;
    if (warningSymbolsEl) warningSymbolsEl.textContent = data.summary.warningSymbols;
    if (dataCollectionRateEl) dataCollectionRateEl.textContent = data.summary.completionRates.dataCollection.toFixed(1) + '%';
    if (dataValidationStatusEl) {
      const validationStatus = data.summary.dataValidation?.hasErrors ?
        '⚠️ ' + data.summary.dataValidation.errorCount + ' 错误' : '✅ 正常';
      dataValidationStatusEl.textContent = validationStatus;

      // 添加点击事件显示详细错误
      const detailsEl = document.getElementById('dataValidationDetails');
      if (detailsEl && data.summary.dataValidation?.hasErrors) {
        detailsEl.style.cursor = 'pointer';
        detailsEl.onclick = () => showDataValidationDetails(data.summary.dataValidation.errors);
      }
    }

    // 更新数据质量状态
    const dataQualityStatusEl = document.getElementById('dataQualityStatus');
    if (dataQualityStatusEl) {
      const qualityStatus = data.summary.dataQuality?.hasIssues ?
        '⚠️ ' + data.summary.dataQuality.issueCount + ' 问题' : '✅ 正常';
      dataQualityStatusEl.textContent = qualityStatus;

      // 添加点击事件显示详细问题
      const qualityDetailsEl = document.getElementById('dataQualityDetails');
      if (qualityDetailsEl && data.summary.dataQuality?.hasIssues) {
        qualityDetailsEl.style.cursor = 'pointer';
        qualityDetailsEl.onclick = () => showDataQualityDetails(data.summary.dataQuality.issues);
      }
    }

    // 更新汇总视图表格
    updateSummaryTable(data);

    // 更新详细视图表格
    updateDetailedTable(data);

  } catch (error) {
    console.error('刷新监控数据失败:', error);
    const tbody = document.getElementById('monitoringTableBody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: #dc3545; padding: 20px;">
            数据加载失败: ${error.message}
          </td>
        </tr>
      `;
    }
  }
}

// 更新汇总视图表格
function updateSummaryTable(data) {
  const tbody = document.getElementById('monitoringTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (data.detailedStats && data.detailedStats.length > 0) {
    data.detailedStats.forEach(symbol => {
      const row = document.createElement('tr');
      row.className = `symbol-row ${symbol.hasExecution ? 'has-execution' : symbol.hasSignal ? 'has-signal' : symbol.hasTrend ? 'has-trend' : 'no-signals'}`;

      row.innerHTML = `
        <td class="symbol-name">
          ${symbol.symbol}
          ${symbol.hasExecution ? '<span class="signal-indicator execution">🚀</span>' : ''}
          ${symbol.hasSignal ? '<span class="signal-indicator signal">🎯</span>' : ''}
          ${symbol.hasTrend ? '<span class="signal-indicator trend">📈</span>' : ''}
          ${!symbol.hasExecution && !symbol.hasSignal && !symbol.hasTrend ? '<span class="signal-indicator none">⚪</span>' : ''}
        </td>
        <td>
          <div class="metric-rate">${symbol.dataCollection.rate.toFixed(1)}%</div>
          <div class="metric-details">${symbol.dataCollection.successes}/${symbol.dataCollection.attempts}</div>
        </td>
        <td>
          <div class="metric-rate">${symbol.signalAnalysis.rate.toFixed(1)}%</div>
          <div class="metric-details">${symbol.signalAnalysis.successes}/${symbol.signalAnalysis.attempts}</div>
        </td>
        <td>
          <div class="metric-rate">${symbol.simulationCompletion.rate.toFixed(1)}%</div>
          <div class="metric-details">${symbol.simulationCompletion.completions}/${symbol.simulationCompletion.triggers}</div>
        </td>
        <td>
          <div class="metric-rate">${symbol.simulationProgress.rate.toFixed(1)}%</div>
          <div class="metric-details">${symbol.simulationProgress.inProgress}/${symbol.simulationProgress.triggers}</div>
        </td>
        <td>
          <div class="metric-time">${symbol.refreshFrequency}秒</div>
        </td>
        <td>
          <span class="status-indicator ${symbol.overall.status.toLowerCase()}">
            ${symbol.overall.status === 'HEALTHY' ? '✅' : '⚠️'} ${symbol.overall.rate.toFixed(1)}%
          </span>
        </td>
      `;
      tbody.appendChild(row);
    });
  } else {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: #6c757d; padding: 20px;">
          暂无监控数据，请等待数据收集完成
        </td>
      </tr>
    `;
  }
}

// 更新详细视图表格
function updateDetailedTable(data) {
  const tbody = document.getElementById('detailedTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (data.detailedStats && data.detailedStats.length > 0) {
    data.detailedStats.forEach(symbol => {
      const row = document.createElement('tr');
      row.className = `symbol-row ${symbol.hasExecution ? 'has-execution' : symbol.hasSignal ? 'has-signal' : symbol.hasTrend ? 'has-trend' : 'no-signals'}`;

      // 格式化时间
      const formatTime = (timestamp) => {
        if (!timestamp) return 'N/A';
        return new Date(timestamp).toLocaleString('zh-CN');
      };

      row.innerHTML = `
        <td class="symbol-name">
          ${symbol.symbol}
          ${symbol.hasExecution ? '<span class="signal-indicator execution">🚀</span>' : ''}
          ${symbol.hasSignal ? '<span class="signal-indicator signal">🎯</span>' : ''}
          ${symbol.hasTrend ? '<span class="signal-indicator trend">📈</span>' : ''}
          ${!symbol.hasExecution && !symbol.hasSignal && !symbol.hasTrend ? '<span class="signal-indicator none">⚪</span>' : ''}
        </td>
        <td>
          <div class="metric-detail">
            <div class="metric-rate">${symbol.dataCollection.rate.toFixed(1)}%</div>
            <div class="metric-info">成功: ${symbol.dataCollection.successes} | 尝试: ${symbol.dataCollection.attempts}</div>
            <div class="metric-time">最后: ${formatTime(symbol.dataCollection.lastTime)}</div>
          </div>
        </td>
        <td>
          <div class="metric-detail">
            <div class="metric-rate">${symbol.signalAnalysis.rate.toFixed(1)}%</div>
            <div class="metric-info">成功: ${symbol.signalAnalysis.successes} | 尝试: ${symbol.signalAnalysis.attempts}</div>
            <div class="metric-time">最后: ${formatTime(symbol.signalAnalysis.lastTime)}</div>
          </div>
        </td>
        <td>
          <div class="metric-detail">
            <div class="metric-rate">${symbol.simulationCompletion.rate.toFixed(1)}%</div>
            <div class="metric-info">完成: ${symbol.simulationCompletion.completions} | 触发: ${symbol.simulationCompletion.triggers}</div>
            <div class="metric-rate">进行: ${symbol.simulationProgress.rate.toFixed(1)}%</div>
            <div class="metric-info">进行中: ${symbol.simulationProgress.inProgress} | 触发: ${symbol.simulationProgress.triggers}</div>
          </div>
        </td>
        <td>
          <div class="signal-status">
            <div class="signal-item ${symbol.hasExecution ? 'active' : ''}">
              🚀 入场执行: ${symbol.hasExecution ? '是' : '否'}
              ${symbol.executionMode ? ` (${symbol.executionMode === 'PULLBACK_CONFIRMATION' ? '回踩确认' : symbol.executionMode === 'MOMENTUM_BREAKOUT' ? '动能突破' : '未知'})` : ''}
            </div>
            <div class="signal-item ${symbol.hasSignal ? 'active' : ''}">
              🎯 信号确认: ${symbol.hasSignal ? '是' : '否'}
              ${symbol.hourlyScore !== undefined ? ` (得分: ${symbol.hourlyScore}/6)` : ''}
            </div>
            <div class="signal-item ${symbol.hasTrend ? 'active' : ''}">
              📈 趋势信号: ${symbol.hasTrend ? '是' : '否'}
            </div>
            <div class="signal-item">
              🔄 模式A: ${symbol.modeA ? '✅ 回踩确认' : '❌ 未满足'}
            </div>
            <div class="signal-item">
              ⚡ 模式B: ${symbol.modeB ? '✅ 动能突破' : '❌ 未满足'}
            </div>
          </div>
        </td>
        <td>
          <div class="last-update">
            <div>数据收集: ${formatTime(symbol.dataCollection.lastTime)}</div>
            <div>信号分析: ${formatTime(symbol.signalAnalysis.lastTime)}</div>
            <div>刷新频率: ${symbol.refreshFrequency}秒</div>
          </div>
        </td>
        <td>
          <div class="health-status">
            <span class="status-indicator ${symbol.overall.status.toLowerCase()}">
              ${symbol.overall.status === 'HEALTHY' ? '✅' : '⚠️'} ${symbol.overall.rate.toFixed(1)}%
            </span>
            <div class="health-details">
              <div>优先级: ${symbol.priorityScore}</div>
              <div>活跃度: ${symbol.signalActivityScore}</div>
            </div>
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });
  } else {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: #6c757d; padding: 20px;">
          暂无监控数据，请等待数据收集完成
        </td>
      </tr>
    `;
  }
}


// 切换监控标签页
function switchMonitoringTab(tabName) {
  // 隐藏所有视图
  document.querySelectorAll('.monitoring-view').forEach(view => {
    view.classList.remove('active');
  });

  // 移除所有标签按钮的激活状态
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // 显示选中的视图
  const targetView = document.getElementById(tabName + 'View');
  const targetBtn = document.querySelector(`[onclick="switchMonitoringTab('${tabName}')"]`);

  if (targetView) targetView.classList.add('active');
  if (targetBtn) targetBtn.classList.add('active');
}

// 关闭监控面板
function closeMonitoringPanel() {
  const panel = document.querySelector('.unified-monitoring-panel');
  if (panel) {
    // 添加关闭动画
    panel.style.opacity = '0';
    panel.style.transform = 'scale(0.9)';

    setTimeout(() => {
      panel.remove();
    }, 200);
  }
}

async function viewTelegramConfig() {
  try {
    const config = await window.apiClient.getTelegramConfig();
    const content = `
            <div style="padding: 20px;">
                <h4>Telegram 配置状态</h4>
                <p>配置状态: ${config.configured ? '已配置' : '未配置'}</p>
                <div style="margin-top: 20px;">
                    <button class="btn primary" onclick="testTelegramNotification()">测试通知</button>
                    <button class="btn secondary" onclick="modal.close()">关闭</button>
                </div>
            </div>
        `;
    modal.show('Telegram 配置', content);
  } catch (error) {
    console.error('获取Telegram配置失败:', error);
    modal.showMessage('获取配置失败: ' + error.message, 'error');
  }
}

async function testTelegramNotification() {
  try {
    const result = await window.apiClient.testTelegramNotification();
    if (result.success) {
      modal.showMessage('测试通知已发送', 'success');
    } else {
      modal.showMessage('测试通知失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('测试Telegram通知失败:', error);
    modal.showMessage('测试通知失败: ' + error.message, 'error');
  }
}

async function testDataQualityAlert() {
  try {
    const result = await window.apiClient.testDataQualityAlert();
    if (result.success) {
      modal.showMessage('数据质量告警测试已发送', 'success');
    } else {
      modal.showMessage('数据质量告警测试失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('测试数据质量告警失败:', error);
    modal.showMessage('数据质量告警测试失败: ' + error.message, 'error');
  }
}

function openRollupCalculator() {
  const currentMaxLoss = app.userSettings.maxLossAmount || document.getElementById('maxLossAmount').value;
  const calculatorWindow = window.open(
    'rollup-calculator.html',
    'rollupCalculator',
    'width=1200,height=800,scrollbars=yes,resizable=yes,status=yes,toolbar=no,menubar=no,location=no'
  );

  if (calculatorWindow) {
    calculatorWindow.addEventListener('load', function () {
      try {
        const maxLossInput = calculatorWindow.document.getElementById('maxLossAmount');
        if (maxLossInput) {
          maxLossInput.value = currentMaxLoss;
        }
      } catch (error) {
        console.log('无法设置默认值:', error);
      }
    });
  }
}

async function showSymbolsList() {
  try {
    const symbols = await window.apiClient.getAllSignals();
    const symbolList = symbols.map(s => s.symbol);

    const content = `
            <div style="padding: 20px;">
                <h4>当前监控的交易对</h4>
                <div style="margin-bottom: 20px;">
                    ${symbolList.length > 0 ?
        symbolList.map(symbol => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border: 1px solid #ddd; margin: 5px 0; border-radius: 4px;">
                          <span>${symbol}</span>
                          <button class="btn small warning" onclick="removeCustomSymbol('${symbol}')" title="删除交易对">🗑️</button>
                        </div>
                      `).join('') :
        '<p style="color: #6c757d;">暂无交易对</p>'
      }
                </div>
                <div style="margin-top: 20px;">
                    <input type="text" id="newSymbol" placeholder="输入新的交易对 (如: BTCUSDT)" class="symbol-input" style="width: 200px; padding: 8px; margin-right: 10px;">
                    <button class="btn primary" onclick="addSymbol()">添加</button>
                </div>
            </div>
        `;
    modal.show('交易对管理', content);
  } catch (error) {
    console.error('获取交易对列表失败:', error);
    modal.showMessage('获取交易对列表失败: ' + error.message, 'error');
  }
}

async function addSymbol() {
  const symbol = document.getElementById('newSymbol').value.trim().toUpperCase();
  if (!symbol) {
    modal.showMessage('请输入有效的交易对', 'warning');
    return;
  }

  try {
    const result = await window.apiClient.addSymbol(symbol);
    if (result.success) {
      modal.showMessage(result.message, 'success');
      modal.close();
      await app.loadAllData();
    } else {
      modal.showMessage(result.message, 'error');
    }
  } catch (error) {
    console.error('添加交易对失败:', error);
    modal.showMessage('添加交易对失败: ' + error.message, 'error');
  }
}

async function removeCustomSymbol(symbol) {
  if (!confirm(`确定要删除交易对 ${symbol} 吗？`)) {
    return;
  }

  try {
    const result = await window.apiClient.removeSymbol(symbol);
    if (result.success) {
      modal.showMessage(result.message, 'success');
      await app.loadAllData();
    } else {
      modal.showMessage(result.message, 'error');
    }
  } catch (error) {
    console.error('删除交易对失败:', error);
    modal.showMessage('删除交易对失败: ' + error.message, 'error');
  }
}

function toggleSimulationHistory() {
  const table = document.getElementById('simulationTable').closest('.table-container');
  if (table.style.display === 'none') {
    table.style.display = 'block';
    app.loadAllData();
  } else {
    table.style.display = 'none';
  }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 DOM加载完成，开始初始化应用...');
  console.log('window.apiClient状态:', window.apiClient);
  console.log('window.apiClient类型:', typeof window.apiClient);

  if (window.apiClient) {
    console.log('API客户端方法列表:', Object.getOwnPropertyNames(window.apiClient));
    console.log('getUpdateTimes方法:', typeof window.apiClient.getUpdateTimes);
  }

  window.app = new SmartFlowApp();
});
