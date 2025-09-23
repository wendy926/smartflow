/**
 * SmartFlow 交易策略系统前端应用
 * 提供交互功能和数据管理
 */

class SmartFlowApp {
  constructor() {
    this.apiBaseUrl = '/api/v1';
    this.currentTab = 'dashboard';
    this.currentStrategy = 'v3';
    this.refreshInterval = null;
    this.init();
  }

  /**
   * 初始化应用
   */
  init() {
    this.setupEventListeners();
    this.loadInitialData();
    this.startAutoRefresh();
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // 导航标签页切换
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = link.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    // 策略标签页切换
    document.querySelectorAll('.strategy-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const strategy = tab.getAttribute('data-strategy');
        this.switchStrategy(strategy);
      });
    });

    // 统计筛选器
    const strategySelect = document.getElementById('strategySelect');
    const timeframeSelect = document.getElementById('timeframeSelect');

    if (strategySelect) {
      strategySelect.addEventListener('change', () => {
        this.loadStatistics();
      });
    }

    if (timeframeSelect) {
      timeframeSelect.addEventListener('change', () => {
        this.loadStatistics();
      });
    }
  }

  /**
   * 切换标签页
   * @param {string} tabName - 标签页名称
   */
  switchTab(tabName) {
    // 更新导航状态
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // 更新内容显示
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');

    this.currentTab = tabName;

    // 根据标签页加载相应数据
    switch (tabName) {
      case 'dashboard':
        this.loadDashboardData();
        break;
      case 'strategies':
        this.loadStrategyData();
        break;
      case 'monitoring':
        this.loadMonitoringData();
        break;
      case 'statistics':
        this.loadStatistics();
        break;
      case 'tools':
        this.loadToolsData();
        break;
    }
  }

  /**
   * 切换策略
   * @param {string} strategyName - 策略名称
   */
  switchStrategy(strategyName) {
    // 更新策略标签状态
    document.querySelectorAll('.strategy-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelector(`[data-strategy="${strategyName}"]`).classList.add('active');

    // 更新策略面板显示
    document.querySelectorAll('.strategy-panel').forEach(panel => {
      panel.classList.remove('active');
    });
    document.getElementById(`${strategyName}-content`).classList.add('active');

    this.currentStrategy = strategyName;
    this.loadStrategyData();
  }

  /**
   * 加载初始数据
   */
  async loadInitialData() {
    await this.loadDashboardData();
    this.updateLastUpdateTime();
  }

  /**
   * 加载仪表板数据
   */
  async loadDashboardData() {
    try {
      // 加载交易对数据
      const symbols = await this.fetchData('/symbols');
      await this.renderSymbolsTable(symbols.data || []);

      // 加载策略数据
      await this.loadStrategySignals();
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.showError('加载仪表板数据失败');
    }
  }

  /**
   * 加载策略信号
   */
  async loadStrategySignals() {
    try {
      // 模拟策略信号数据
      const strategies = ['v3', 'ict'];
      const signals = {};

      for (const strategy of strategies) {
        try {
          const response = await this.fetchData(`/strategies/${strategy}/judgments?limit=1`);
          signals[strategy] = response.data?.[0] || this.getMockSignal(strategy);
        } catch (error) {
          console.warn(`Failed to load ${strategy} signals:`, error);
          signals[strategy] = this.getMockSignal(strategy);
        }
      }

      this.updateStrategyCards(signals);
    } catch (error) {
      console.error('Error loading strategy signals:', error);
    }
  }

  /**
   * 获取模拟信号数据
   * @param {string} strategy - 策略名称
   * @returns {Object} 模拟信号数据
   */
  getMockSignal(strategy) {
    const mockSignals = {
      v3: {
        signal: 'BUY',
        trend: 'UP',
        score: 85,
        confidence: 0.8
      },
      ict: {
        signal: 'SELL',
        trend: 'DOWN',
        score: 72,
        confidence: 0.7
      }
    };
    return mockSignals[strategy] || { signal: 'HOLD', trend: 'RANGE', score: 50, confidence: 0.5 };
  }

  /**
   * 更新策略卡片
   * @param {Object} signals - 策略信号数据
   */
  updateStrategyCards(signals) {
    const strategyCards = document.querySelectorAll('.strategy-card');

    strategyCards.forEach((card, index) => {
      const strategyNames = ['v3', 'ict'];
      const strategy = strategyNames[index];
      const signal = signals[strategy];

      if (signal) {
        // 更新趋势显示
        const trendElement = card.querySelector('.trend-up, .trend-down, .trend-range');
        if (trendElement) {
          trendElement.className = `signal-value trend-${signal.trend.toLowerCase()}`;
          trendElement.textContent = this.getTrendText(signal.trend);
        }

        // 更新信号显示
        const signalElement = card.querySelector('.signal-buy, .signal-sell, .signal-hold');
        if (signalElement) {
          signalElement.className = `signal-value signal-${signal.signal.toLowerCase()}`;
          signalElement.textContent = this.getSignalText(signal.signal);
        }

        // 更新评分显示
        const scoreElement = card.querySelector('.score-high, .score-medium, .score-low');
        if (scoreElement) {
          const scoreClass = signal.score >= 80 ? 'score-high' : signal.score >= 60 ? 'score-medium' : 'score-low';
          scoreElement.className = `signal-value ${scoreClass}`;
          scoreElement.textContent = signal.score;
        }
      }
    });
  }

  /**
   * 获取趋势文本
   * @param {string} trend - 趋势值
   * @returns {string} 趋势文本
   */
  getTrendText(trend) {
    const trendMap = {
      'UP': '上涨',
      'DOWN': '下跌',
      'RANGE': '震荡'
    };
    return trendMap[trend] || '未知';
  }

  /**
   * 获取信号文本
   * @param {string} signal - 信号值
   * @returns {string} 信号文本
   */
  getSignalText(signal) {
    const signalMap = {
      'BUY': '买入',
      'SELL': '卖出',
      'HOLD': '持有'
    };
    return signalMap[signal] || '未知';
  }

  /**
   * 渲染交易对表格
   * @param {Array} symbols - 交易对数据
   */
  async renderSymbolsTable(symbols) {
    const tbody = document.getElementById('symbolsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    for (const symbol of symbols) {
      const row = document.createElement('tr');

      // 获取策略判断数据
      const v3Judgment = await this.getStrategyJudgment(symbol.symbol, 'v3');
      const ictJudgment = await this.getStrategyJudgment(symbol.symbol, 'ict');

      row.innerHTML = `
        <td>${symbol.symbol}</td>
        <td>${symbol.last_price ? parseFloat(symbol.last_price).toFixed(4) : '--'}</td>
        <td class="${symbol.price_change_24h >= 0 ? 'stat-positive' : 'stat-negative'}">
          ${symbol.price_change_24h ? (symbol.price_change_24h * 100).toFixed(2) + '%' : '--'}
        </td>
        <td class="strategy-cell">
          <div class="strategy-info">
            <div class="timeframe-signals">
              <span class="timeframe-badge timeframe-4h">4H: ${v3Judgment?.timeframes?.trend4H || '--'}</span>
              <span class="timeframe-badge timeframe-1h">1H: ${v3Judgment?.timeframes?.factors1H || '--'}</span>
              <span class="timeframe-badge timeframe-15m">15m: ${v3Judgment?.timeframes?.entry15m || '--'}</span>
            </div>
            <div class="signal-display">
              <span class="signal-value signal-${v3Judgment?.signal?.toLowerCase() || 'hold'}">${this.getSignalText(v3Judgment?.signal)}</span>
              <span class="score-badge score-${v3Judgment?.score >= 80 ? 'high' : v3Judgment?.score >= 60 ? 'medium' : 'low'}">${v3Judgment?.score || '--'}</span>
            </div>
          </div>
        </td>
        <td class="strategy-cell">
          <div class="strategy-info">
            <div class="timeframe-signals">
              <span class="timeframe-badge timeframe-1d">1D: ${ictJudgment?.timeframes?.trend1D || '--'}</span>
              <span class="timeframe-badge timeframe-4h">4H: ${ictJudgment?.timeframes?.orderBlocks4H || '--'}</span>
              <span class="timeframe-badge timeframe-15m">15m: ${ictJudgment?.timeframes?.entry15m || '--'}</span>
            </div>
            <div class="signal-display">
              <span class="signal-value signal-${ictJudgment?.signal?.toLowerCase() || 'hold'}">${this.getSignalText(ictJudgment?.signal)}</span>
              <span class="score-badge score-${ictJudgment?.score >= 80 ? 'high' : ictJudgment?.score >= 60 ? 'medium' : 'low'}">${ictJudgment?.score || '--'}</span>
            </div>
          </div>
        </td>
        <td><span class="status-value status-${symbol.status === 'active' ? 'online' : 'offline'}">${symbol.status === 'active' ? '活跃' : '停用'}</span></td>
      `;
      tbody.appendChild(row);
    }
  }

  /**
   * 获取策略判断数据
   * @param {string} symbol - 交易对
   * @param {string} strategy - 策略名称
   * @returns {Object} 策略判断数据
   */
  async getStrategyJudgment(symbol, strategy) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/strategies/${strategy}/judgments?symbol=${symbol}&limit=1`);
      if (response.ok) {
        const data = await response.json();
        return data.data && data.data.length > 0 ? data.data[0] : null;
      }
    } catch (error) {
      console.error(`获取${strategy}策略判断失败:`, error);
    }
    return null;
  }

  /**
   * 加载策略数据
   */
  async loadStrategyData() {
    // 策略数据已在HTML中静态展示
    // 这里可以添加动态数据加载逻辑
    console.log(`Loading strategy data for ${this.currentStrategy}`);
  }

  /**
   * 加载监控数据
   */
  async loadMonitoringData() {
    try {
      // 模拟监控数据
      const monitoringData = {
        cpu: Math.random() * 40 + 20, // 20-60%
        memory: Math.random() * 30 + 50, // 50-80%
        disk: Math.random() * 20 + 30, // 30-50%
        apis: {
          binanceRest: 'online',
          binanceWs: 'online',
          database: 'online',
          redis: 'online'
        },
        strategies: {
          v3: 'running',
          ict: 'running',
          rolling: 'running'
        }
      };

      this.updateMonitoringDisplay(monitoringData);
    } catch (error) {
      console.error('Error loading monitoring data:', error);
    }
  }

  /**
   * 更新监控显示
   * @param {Object} data - 监控数据
   */
  updateMonitoringDisplay(data) {
    // 更新资源使用率
    const cpuBar = document.querySelector('.resource-item:nth-child(1) .progress-fill');
    const memoryBar = document.querySelector('.resource-item:nth-child(2) .progress-fill');
    const diskBar = document.querySelector('.resource-item:nth-child(3) .progress-fill');

    if (cpuBar) {
      cpuBar.style.width = `${data.cpu}%`;
      cpuBar.parentElement.nextElementSibling.textContent = `${data.cpu.toFixed(1)}%`;
    }

    if (memoryBar) {
      memoryBar.style.width = `${data.memory}%`;
      memoryBar.parentElement.nextElementSibling.textContent = `${data.memory.toFixed(1)}%`;
    }

    if (diskBar) {
      diskBar.style.width = `${data.disk}%`;
      diskBar.parentElement.nextElementSibling.textContent = `${data.disk.toFixed(1)}%`;
    }
  }

  /**
   * 加载统计数据
   */
  async loadStatistics() {
    try {
      // 模拟统计数据
      const statisticsData = {
        total: 1247,
        winRate: 68.5,
        totalPnl: 12450,
        maxDrawdown: 8.2,
        strategies: {
          v3: 72,
          ict: 65,
          rolling: 68
        }
      };

      this.updateStatisticsDisplay(statisticsData);
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  }

  /**
   * 更新统计显示
   * @param {Object} data - 统计数据
   */
  updateStatisticsDisplay(data) {
    // 更新总体统计
    const statItems = document.querySelectorAll('.stat-item');
    if (statItems.length >= 4) {
      statItems[0].querySelector('.stat-value').textContent = data.total.toLocaleString();
      statItems[1].querySelector('.stat-value').textContent = `${data.winRate}%`;
      statItems[2].querySelector('.stat-value').textContent = `+$${data.totalPnl.toLocaleString()}`;
      statItems[3].querySelector('.stat-value').textContent = `-${data.maxDrawdown}%`;
    }

    // 更新策略对比
    const comparisonItems = document.querySelectorAll('.comparison-item');
    const strategies = ['v3', 'ict', 'rolling'];
    strategies.forEach((strategy, index) => {
      if (comparisonItems[index]) {
        const fill = comparisonItems[index].querySelector('.comparison-fill');
        const value = comparisonItems[index].querySelector('.comparison-value');
        if (fill && value) {
          fill.style.width = `${data.strategies[strategy]}%`;
          value.textContent = `${data.strategies[strategy]}%`;
        }
      }
    });
  }

  /**
   * 加载工具数据
   */
  loadToolsData() {
    // 工具页面数据加载
    console.log('Loading tools data');
  }

  /**
   * 开始自动刷新
   */
  startAutoRefresh() {
    this.refreshInterval = setInterval(() => {
      this.updateLastUpdateTime();
      if (this.currentTab === 'dashboard') {
        this.loadDashboardData();
      } else if (this.currentTab === 'monitoring') {
        this.loadMonitoringData();
      }
    }, 30000); // 30秒刷新一次
  }

  /**
   * 更新最后更新时间
   */
  updateLastUpdateTime() {
    const lastUpdateElement = document.getElementById('lastUpdate');
    if (lastUpdateElement) {
      lastUpdateElement.textContent = new Date().toLocaleTimeString();
    }
  }

  /**
   * 获取API数据
   * @param {string} endpoint - API端点
   * @returns {Promise} API响应
   */
  async fetchData(endpoint) {
    const response = await fetch(`${this.apiBaseUrl}${endpoint}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  }

  /**
   * 显示错误信息
   * @param {string} message - 错误信息
   */
  showError(message) {
    console.error(message);
    // 这里可以添加用户友好的错误提示
  }
}

// 全局函数，供HTML调用
function refreshData() {
  if (window.smartFlowApp) {
    window.smartFlowApp.loadDashboardData();
  }
}

function refreshMonitoring() {
  if (window.smartFlowApp) {
    window.smartFlowApp.loadMonitoringData();
  }
}

function calculateRolling() {
  const accountBalance = parseFloat(document.getElementById('accountBalance').value) || 10000;
  const currentLeverage = parseFloat(document.getElementById('currentLeverage').value) || 3;
  const holdingTime = parseFloat(document.getElementById('holdingTime').value) || 12;
  const currentDrawdown = parseFloat(document.getElementById('currentDrawdown').value) || 5;

  // 简单的滚仓计算逻辑
  const leverageDecay = Math.max(1, currentLeverage * (1 - 0.1 * holdingTime / 24));
  const riskAdjustedLeverage = leverageDecay * (1 - currentDrawdown / 100);
  const newPositionSize = (accountBalance * 0.02) / (accountBalance * 0.01) * riskAdjustedLeverage;

  const result = document.getElementById('rollingResult');
  result.innerHTML = `
        <h4>滚仓计算结果</h4>
        <p><strong>衰减后杠杆:</strong> ${leverageDecay.toFixed(2)}x</p>
        <p><strong>风险调整杠杆:</strong> ${riskAdjustedLeverage.toFixed(2)}x</p>
        <p><strong>建议仓位大小:</strong> ${newPositionSize.toFixed(2)}</p>
        <p><strong>风险评分:</strong> ${Math.min(100, currentDrawdown * 10 + holdingTime * 2)}</p>
    `;
}

function saveTelegramSettings() {
  const botToken = document.getElementById('botToken').value;
  const chatId = document.getElementById('chatId').value;
  const alertThreshold = document.getElementById('alertThreshold').value;

  if (!botToken || !chatId) {
    alert('请填写完整的Telegram设置');
    return;
  }

  // 这里应该调用API保存设置
  console.log('Saving Telegram settings:', { botToken, chatId, alertThreshold });
  alert('Telegram设置已保存');
}

async function testAPI(type) {
  const result = document.getElementById('apiTestResult');
  result.innerHTML = '<p>测试中...</p>';

  try {
    let endpoint = '';
    switch (type) {
      case 'health':
        endpoint = '/health';
        break;
      case 'symbols':
        endpoint = '/symbols';
        break;
      case 'strategies':
        endpoint = '/strategies/v3/judgments';
        break;
      case 'trades':
        endpoint = '/trades';
        break;
    }

    const response = await fetch(`http://localhost:8080/api/v1${endpoint}`);
    const data = await response.json();

    result.innerHTML = `
            <h4>API测试结果 - ${type}</h4>
            <p><strong>状态码:</strong> ${response.status}</p>
            <p><strong>响应:</strong></p>
            <pre>${JSON.stringify(data, null, 2)}</pre>
        `;
  } catch (error) {
    result.innerHTML = `
            <h4>API测试结果 - ${type}</h4>
            <p><strong>错误:</strong> ${error.message}</p>
        `;
  }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
  window.smartFlowApp = new SmartFlowApp();
});
