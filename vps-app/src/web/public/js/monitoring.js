// monitoring.js - 监控面板相关功能

// 加载统一监控面板
async function loadUnifiedMonitoring() {
  try {
    // 检查是否已有监控面板打开
    const existingPanel = document.querySelector('.unified-monitoring-panel');
    if (existingPanel) {
      // 如果已存在，直接刷新数据
      await refreshMonitoringData();
      return;
    }

    // 创建监控面板
    const panel = document.createElement('div');
    panel.className = 'unified-monitoring-panel';
    panel.innerHTML = `
      <div class="monitoring-header">
        <h3>📊 统一监控面板</h3>
        <div class="monitoring-actions">
          <button class="btn primary" onclick="refreshMonitoringData()">🔄 刷新</button>
          <button class="btn secondary" onclick="clearCacheAndRefresh()">🗑️ 清除缓存</button>
          <button class="btn secondary" onclick="closeMonitoringPanel()">❌ 关闭</button>
        </div>
      </div>
      <div class="monitoring-content">
        <div class="monitoring-tabs">
          <button class="tab-btn active" onclick="switchMonitoringTab('summary')">📈 概览</button>
          <button class="tab-btn" onclick="switchMonitoringTab('detailed')">📊 详细</button>
          <button class="tab-btn" onclick="switchMonitoringTab('alerts')">🚨 告警</button>
        </div>
        <div class="monitoring-body">
          <div id="summary-tab" class="tab-content active">
            <div class="loading-dots">加载中<span>.</span><span>.</span><span>.</span></div>
          </div>
          <div id="detailed-tab" class="tab-content">
            <div class="loading-dots">加载中<span>.</span><span>.</span><span>.</span></div>
          </div>
          <div id="alerts-tab" class="tab-content">
            <div class="loading-dots">加载中<span>.</span><span>.</span><span>.</span></div>
          </div>
        </div>
      </div>
    `;

    // 添加到页面
    document.body.appendChild(panel);

    // 异步加载数据并更新界面
    try {
      const [monitoringData, realtimeData] = await Promise.all([
        fetch('/api/monitoring-dashboard').then(res => res.json()),
        fetch('/api/realtime-data-stats').then(res => res.json())
      ]);
      await updateMonitoringPanel(monitoringData, realtimeData);
    } catch (error) {
      console.error('❌ 加载监控数据失败:', error);
      updateMonitoringPanelWithError('加载监控数据失败: ' + error.message);
    }

    // 添加关闭按钮事件监听
    panel.addEventListener('click', (e) => {
      if (e.target.classList.contains('unified-monitoring-panel')) {
        closeMonitoringPanel();
      }
    });
  } catch (error) {
    console.error('❌ 加载统一监控面板失败:', error);
    alert('加载统一监控面板失败: ' + error.message);
  }
}

// 更新监控面板
async function updateMonitoringPanel(monitoringData, realtimeData) {
  try {
    console.log('📊 更新监控面板数据:', { monitoringData, realtimeData });

    // 更新概览标签页
    updateSummaryTable(monitoringData, realtimeData);

    // 更新详细标签页
    updateDetailedTable(monitoringData, realtimeData);

    // 更新告警标签页
    await loadAlertsData();

    console.log('✅ 监控面板数据更新完成');
  } catch (error) {
    console.error('❌ 更新监控面板失败:', error);
    updateMonitoringPanelWithError('更新监控面板失败: ' + error.message);
  }
}

// 更新监控面板错误状态
function updateMonitoringPanelWithError(errorMessage) {
  const summaryTab = document.getElementById('summary-tab');
  const detailedTab = document.getElementById('detailed-tab');
  const alertsTab = document.getElementById('alerts-tab');

  if (summaryTab) {
    summaryTab.innerHTML = `<div class="error-message">❌ ${errorMessage}</div>`;
  }
  if (detailedTab) {
    detailedTab.innerHTML = `<div class="error-message">❌ ${errorMessage}</div>`;
  }
  if (alertsTab) {
    alertsTab.innerHTML = `<div class="error-message">❌ ${errorMessage}</div>`;
  }
}

// 清除缓存并刷新监控数据
async function clearCacheAndRefresh() {
  try {
    // 清除DataManager缓存
    if (window.dataManager) {
      window.dataManager.clearCache();
    }

    // 清除Service Worker缓存
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
    }

    // 清除localStorage
    try {
      localStorage.clear();
      console.log('🗑️ 已清除localStorage缓存');
    } catch (error) {
      console.warn('清除localStorage失败:', error);
    }

    // 刷新监控数据
    await refreshMonitoringData();
    console.log('✅ 缓存清除并刷新完成');
  } catch (error) {
    console.error('❌ 清除缓存并刷新失败:', error);
    alert('清除缓存并刷新失败: ' + error.message);
  }
}

// 刷新监控数据
async function refreshMonitoringData() {
  try {
    const [monitoringData, realtimeData] = await Promise.all([
      fetch('/api/monitoring-dashboard').then(res => res.json()),
      fetch('/api/realtime-data-stats').then(res => res.json())
    ]);

    await updateMonitoringPanel(monitoringData, realtimeData);
    console.log('✅ 监控数据刷新完成');
  } catch (error) {
    console.error('❌ 刷新监控数据失败:', error);
    updateMonitoringPanelWithError('刷新监控数据失败: ' + error.message);
  }
}

// 更新概览表格
function updateSummaryTable(monitoringData, realtimeData) {
  const summaryTab = document.getElementById('summary-tab');
  if (!summaryTab) return;

  const data = monitoringData.data || {};
  const realtime = realtimeData.data || {};

  let summaryHtml = `
    <div class="summary-section">
      <h4>📊 数据概览</h4>
      <div class="summary-grid">
        <div class="summary-card">
          <div class="card-title">总交易对</div>
          <div class="card-value">${data.totalSymbols || 0}</div>
        </div>
        <div class="summary-card">
          <div class="card-title">活跃信号</div>
          <div class="card-value">${data.activeSignals || 0}</div>
        </div>
        <div class="summary-card">
          <div class="card-title">执行信号</div>
          <div class="card-value">${data.executionSignals || 0}</div>
        </div>
        <div class="summary-card">
          <div class="card-title">数据质量</div>
          <div class="card-value ${getQualityClass(data.dataQuality)}">${data.dataQuality || 0}%</div>
        </div>
      </div>
    </div>

    <div class="summary-section">
      <h4>🔄 实时状态</h4>
      <div class="status-grid">
        <div class="status-item">
          <span class="status-label">数据更新:</span>
          <span class="status-value ${realtime.dataUpdate ? 'success' : 'error'}">
            ${realtime.dataUpdate ? '✅ 正常' : '❌ 异常'}
          </span>
        </div>
        <div class="status-item">
          <span class="status-label">API状态:</span>
          <span class="status-value ${realtime.apiStatus ? 'success' : 'error'}">
            ${realtime.apiStatus ? '✅ 正常' : '❌ 异常'}
          </span>
        </div>
        <div class="status-item">
          <span class="status-label">数据库:</span>
          <span class="status-value ${realtime.databaseStatus ? 'success' : 'error'}">
            ${realtime.databaseStatus ? '✅ 正常' : '❌ 异常'}
          </span>
        </div>
        <div class="status-item">
          <span class="status-label">最后更新:</span>
          <span class="status-value">${realtime.lastUpdate || '--'}</span>
        </div>
      </div>
    </div>

    <div class="summary-section">
      <h4>📈 信号分布</h4>
      <div class="distribution-grid">
        <div class="distribution-item">
          <span class="dist-label">多头信号:</span>
          <span class="dist-value long">${data.longSignals || 0}</span>
        </div>
        <div class="distribution-item">
          <span class="dist-label">空头信号:</span>
          <span class="dist-value short">${data.shortSignals || 0}</span>
        </div>
        <div class="distribution-item">
          <span class="dist-label">震荡信号:</span>
          <span class="dist-value neutral">${data.neutralSignals || 0}</span>
        </div>
      </div>
    </div>
  `;

  summaryTab.innerHTML = summaryHtml;
}

// 更新详细表格
function updateDetailedTable(monitoringData, realtimeData) {
  const detailedTab = document.getElementById('detailed-tab');
  if (!detailedTab) return;

  const data = monitoringData.data || {};
  const symbols = data.symbols || [];

  let detailedHtml = `
    <div class="detailed-section">
      <h4>📊 详细数据</h4>
      <div class="table-container">
        <table class="monitoring-table">
          <thead>
            <tr>
              <th>交易对</th>
              <th>分类</th>
              <th>信号类型</th>
              <th>信号强度</th>
              <th>数据质量</th>
              <th>最后更新</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
  `;

  symbols.forEach(symbol => {
    const qualityClass = getQualityClass(symbol.dataQuality);
    const statusClass = symbol.isActive ? 'active' : 'inactive';

    detailedHtml += `
      <tr class="${statusClass}">
        <td class="symbol-cell">${symbol.symbol}</td>
        <td class="category-cell">${app.getCategoryDisplay(symbol.category)}</td>
        <td class="signal-cell ${symbol.signalType?.toLowerCase()}">${symbol.signalType || '--'}</td>
        <td class="strength-cell ${symbol.signalStrength?.toLowerCase()}">${symbol.signalStrength || '--'}</td>
        <td class="quality-cell ${qualityClass}">${symbol.dataQuality || 0}%</td>
        <td class="time-cell">${symbol.lastUpdate || '--'}</td>
        <td class="status-cell ${statusClass}">${symbol.isActive ? '✅ 活跃' : '❌ 非活跃'}</td>
      </tr>
    `;
  });

  detailedHtml += `
          </tbody>
        </table>
      </div>
    </div>
  `;

  detailedTab.innerHTML = detailedHtml;
}

// 切换监控标签页
function switchMonitoringTab(tabName) {
  // 更新标签按钮状态
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[onclick="switchMonitoringTab('${tabName}')"]`).classList.add('active');

  // 更新标签内容显示
  document.querySelectorAll('.monitoring-view').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`${tabName}View`).classList.add('active');

  // 根据标签页加载相应数据
  if (tabName === 'data-refresh') {
    loadDataRefreshStatus();
  } else if (tabName === 'trading-pairs') {
    loadTradingPairsData();
  } else if (tabName === 'alerts') {
    loadAlertsData();
  }
}

// 获取数据质量样式类
function getQualityClass(quality) {
  if (quality >= 90) return 'excellent';
  if (quality >= 70) return 'good';
  if (quality >= 50) return 'fair';
  return 'poor';
}

// 切换策略选择
function switchStrategy(strategy, event) {
  event.preventDefault();
  
  // 更新策略标签按钮状态
  document.querySelectorAll('.strategy-tab').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  
  // 重新加载交易对数据
  loadTradingPairsData(strategy);
}

// 切换数据刷新策略选择
function switchRefreshStrategy(strategy, event) {
  event.preventDefault();
  
  // 更新策略标签按钮状态
  document.querySelectorAll('.strategy-tab').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  
  // 重新加载数据刷新状态
  loadDataRefreshStatus(strategy);
}

// 加载数据刷新状态
async function loadDataRefreshStatus(strategy = 'all') {
  try {
    const response = await fetch('/api/data-refresh/status');
    const data = await response.json();
    
    if (data.success) {
      updateDataRefreshUI(data.data, strategy);
    } else {
      console.error('获取数据刷新状态失败:', data.error);
    }
  } catch (error) {
    console.error('加载数据刷新状态失败:', error);
  }
}

// 更新数据刷新状态UI
function updateDataRefreshUI(refreshData, strategy = 'all') {
  const v3Count = document.getElementById('v3RefreshCount');
  const ictCount = document.getElementById('ictRefreshCount');
  const totalRate = document.getElementById('totalRefreshRate');
  const tableBody = document.getElementById('refreshTableBody');
  
  if (!v3Count || !ictCount || !totalRate || !tableBody) return;
  
  // 计算统计数据
  let v3RefreshCount = 0;
  let ictRefreshCount = 0;
  let totalRefreshCount = 0;
  let totalSuccessCount = 0;
  
  // 构建表格数据
  let tableRows = '';
  
  // 处理V3策略数据
  if (strategy === 'all' || strategy === 'V3') {
    for (const [symbol, dataTypes] of Object.entries(refreshData.v3Strategy || {})) {
      for (const [dataType, status] of Object.entries(dataTypes)) {
        if (status.shouldRefresh) v3RefreshCount++;
        totalRefreshCount++;
        if (status.lastRefresh) totalSuccessCount++;
        
        tableRows += `
          <tr>
            <td>${symbol}</td>
            <td>V3</td>
            <td>${dataType}</td>
            <td>${status.lastRefresh ? new Date(status.lastRefresh).toLocaleString() : '从未刷新'}</td>
            <td>${status.nextRefresh ? new Date(status.nextRefresh).toLocaleString() : '未知'}</td>
            <td><span class="refresh-status ${status.shouldRefresh ? 'pending' : 'ready'}">${status.shouldRefresh ? '待刷新' : '已就绪'}</span></td>
            <td><button class="refresh-btn" onclick="forceRefreshData('${symbol}', 'V3', '${dataType}')">强制刷新</button></td>
          </tr>
        `;
      }
    }
  }
  
  // 处理ICT策略数据
  if (strategy === 'all' || strategy === 'ICT') {
    for (const [symbol, dataTypes] of Object.entries(refreshData.ictStrategy || {})) {
      for (const [dataType, status] of Object.entries(dataTypes)) {
        if (status.shouldRefresh) ictRefreshCount++;
        totalRefreshCount++;
        if (status.lastRefresh) totalSuccessCount++;
        
        tableRows += `
          <tr>
            <td>${symbol}</td>
            <td>ICT</td>
            <td>${dataType}</td>
            <td>${status.lastRefresh ? new Date(status.lastRefresh).toLocaleString() : '从未刷新'}</td>
            <td>${status.nextRefresh ? new Date(status.nextRefresh).toLocaleString() : '未知'}</td>
            <td><span class="refresh-status ${status.shouldRefresh ? 'pending' : 'ready'}">${status.shouldRefresh ? '待刷新' : '已就绪'}</span></td>
            <td><button class="refresh-btn" onclick="forceRefreshData('${symbol}', 'ICT', '${dataType}')">强制刷新</button></td>
          </tr>
        `;
      }
    }
  }
  
  // 更新统计信息
  v3Count.textContent = v3RefreshCount;
  ictCount.textContent = ictRefreshCount;
  totalRate.textContent = totalRefreshCount > 0 ? `${Math.round((totalSuccessCount / totalRefreshCount) * 100)}%` : '0%';
  
  // 更新表格
  tableBody.innerHTML = tableRows;
}

// 强制刷新数据
async function forceRefreshData(symbol, strategyType, dataType) {
  try {
    const response = await fetch(`/api/data-refresh/force-refresh/${symbol}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        strategyType: strategyType,
        dataType: dataType
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      alert('数据刷新已触发');
      // 重新加载数据刷新状态
      loadDataRefreshStatus();
    } else {
      alert('数据刷新失败: ' + data.error);
    }
  } catch (error) {
    console.error('强制刷新数据失败:', error);
    alert('强制刷新数据失败: ' + error.message);
  }
}

// 加载交易对数据
async function loadTradingPairsData(strategy = 'all') {
  try {
    const response = await fetch('/api/unified-monitoring/dashboard');
    const data = await response.json();
    
    if (data.success) {
      updateTradingPairsUI(data.data, strategy);
    } else {
      console.error('获取交易对数据失败:', data.error);
    }
  } catch (error) {
    console.error('加载交易对数据失败:', error);
  }
}

// 更新交易对UI
function updateTradingPairsUI(dashboardData, strategy = 'all') {
  const tableBody = document.querySelector('#trading-pairsView .symbols-table tbody');
  if (!tableBody) return;
  
  let tableRows = '';
  
  for (const symbolData of dashboardData.detailedStats || []) {
    const { symbol, v3Strategy, ictStrategy } = symbolData;
    
    // 根据策略过滤显示
    if (strategy === 'all' || strategy === 'V3') {
      tableRows += `
        <tr>
          <td>${symbol}</td>
          <td>V3</td>
          <td>${v3Strategy.dataCollection.rate.toFixed(1)}%</td>
          <td>${v3Strategy.dataValidation.status === 'VALID' ? '100%' : '0%'}</td>
          <td>${v3Strategy.simulationCompletion.rate.toFixed(1)}%</td>
          <td>${v3Strategy.simulationCompletion.activeCount}</td>
          <td>15分钟</td>
          <td><span class="status-badge ${getHealthClass(v3Strategy)}">${getHealthStatus(v3Strategy)}</span></td>
        </tr>
      `;
    }
    
    if (strategy === 'all' || strategy === 'ICT') {
      tableRows += `
        <tr>
          <td>${symbol}</td>
          <td>ICT</td>
          <td>${ictStrategy.dataCollection.rate.toFixed(1)}%</td>
          <td>${ictStrategy.dataValidation.status === 'VALID' ? '100%' : '0%'}</td>
          <td>${ictStrategy.simulationCompletion.rate.toFixed(1)}%</td>
          <td>${ictStrategy.simulationCompletion.activeCount}</td>
          <td>15分钟</td>
          <td><span class="status-badge ${getHealthClass(ictStrategy)}">${getHealthStatus(ictStrategy)}</span></td>
        </tr>
      `;
    }
  }
  
  tableBody.innerHTML = tableRows;
}

// 获取健康状态类
function getHealthClass(strategyData) {
  if (strategyData.dataCollection.rate < 80 || strategyData.dataValidation.errors > 5) {
    return 'error';
  } else if (strategyData.dataCollection.rate < 90 || strategyData.dataValidation.warnings > 3) {
    return 'warning';
  } else {
    return 'healthy';
  }
}

// 获取健康状态文本
function getHealthStatus(strategyData) {
  if (strategyData.dataCollection.rate < 80 || strategyData.dataValidation.errors > 5) {
    return '错误';
  } else if (strategyData.dataCollection.rate < 90 || strategyData.dataValidation.warnings > 3) {
    return '警告';
  } else {
    return '健康';
  }
}

// 加载告警数据
async function loadAlertsData() {
  try {
    const response = await fetch('/api/monitoring/alerts');
    const data = await response.json();
    
    if (data.success) {
      updateAlertsUI(data.data);
    } else {
      console.error('获取告警数据失败:', data.error);
    }
  } catch (error) {
    console.error('加载告警数据失败:', error);
  }
}

// 更新告警UI
function updateAlertsUI(alertsData) {
  const alertContainer = document.querySelector('#alertsView .alert-history');
  if (!alertContainer) return;
  
  let alertHtml = '<h3>🚨 数据监控告警明细</h3>';
  
  if (alertsData.alerts && alertsData.alerts.length > 0) {
    for (const alert of alertsData.alerts) {
      alertHtml += `
        <div class="alert-item ${alert.severity.toLowerCase()}">
          <div class="alert-header">
            <span class="alert-symbol">${alert.symbol}</span>
            <span class="alert-strategy">${alert.strategyType}</span>
            <span class="alert-time">${new Date(alert.createdAt).toLocaleString()}</span>
          </div>
          <div class="alert-message">${alert.message}</div>
          <div class="alert-actions">
            <button class="btn small" onclick="resolveAlert(${alert.id})">解决</button>
          </div>
        </div>
      `;
    }
  } else {
    alertHtml += '<div class="no-alerts">暂无告警</div>';
  }
  
  alertContainer.innerHTML = alertHtml;
}

// 解决告警
async function resolveAlert(alertId) {
  try {
    const response = await fetch(`/api/monitoring/alerts/${alertId}/resolve`, {
      method: 'POST'
    });
    
    const data = await response.json();
    
    if (data.success) {
      alert('告警已解决');
      // 重新加载告警数据
      loadAlertsData();
    } else {
      alert('解决告警失败: ' + data.error);
    }
  } catch (error) {
    console.error('解决告警失败:', error);
    alert('解决告警失败: ' + error.message);
  }
}

// 关闭监控面板
function closeMonitoringPanel() {
  const panel = document.querySelector('.unified-monitoring-panel');
  if (panel) {
    panel.remove();
  }
}