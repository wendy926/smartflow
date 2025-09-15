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
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`${tabName}-tab`).classList.add('active');
}

// 获取数据质量样式类
function getQualityClass(quality) {
  if (quality >= 90) return 'excellent';
  if (quality >= 70) return 'good';
  if (quality >= 50) return 'fair';
  return 'poor';
}

// 关闭监控面板
function closeMonitoringPanel() {
  const panel = document.querySelector('.unified-monitoring-panel');
  if (panel) {
    panel.remove();
  }
}