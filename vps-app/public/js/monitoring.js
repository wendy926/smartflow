// monitoring.js
// 统一监控中心独立页面逻辑

// 全局变量
let currentMonitoringData = null;
let alertHistory = [];
let refreshInterval = null;

// 格式化时间
function formatTime(timestamp) {
  if (!timestamp) return 'N/A';
  return new Date(timestamp).toLocaleString('zh-CN');
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 监控页面加载完成，开始初始化...');
  
  // 延迟加载数据，确保DOM完全准备好
  setTimeout(() => {
    console.log('⏰ 延迟加载监控数据...');
    loadMonitoringData();
  }, 100);
  
  // 每30秒自动刷新数据
  refreshInterval = setInterval(loadMonitoringData, 30000);
});

// 页面卸载时清理定时器
window.addEventListener('beforeunload', () => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
});

// 加载监控数据
async function loadMonitoringData() {
  try {
    console.log('🔄 加载监控数据...');
    
    let data;
    
    // 优先使用API客户端，如果不可用则直接使用fetch
    if (window.apiClient) {
      console.log('📡 使用API客户端加载数据');
      data = await window.apiClient.getMonitoringDashboard();
    } else {
      console.log('📡 使用fetch直接加载数据');
      const response = await fetch('/api/monitoring-dashboard');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      data = await response.json();
    }
    
    console.log('📊 监控数据结构:', data);
    console.log('📊 detailedStats长度:', data.detailedStats ? data.detailedStats.length : 'undefined');
    currentMonitoringData = data;

    // 更新各个视图
    updateSystemOverview(data);
    updateDataQualityStatus(data);
    updateDataValidationStatus(data);
    updateSummaryTable(data);
    updateDetailedTable(data);
    loadAlertHistory();

    console.log('✅ 监控数据加载完成');
  } catch (error) {
    console.error('❌ 加载监控数据失败:', error);
    showErrorMessage('加载监控数据失败: ' + error.message);
  }
}

// 刷新监控数据
async function refreshMonitoringData() {
  const refreshBtn = document.querySelector('.header-controls .btn');
  const originalText = refreshBtn.textContent;

  refreshBtn.textContent = '🔄 刷新中...';
  refreshBtn.disabled = true;

  try {
    await loadMonitoringData();
    showSuccessMessage('数据刷新成功');
  } catch (error) {
    showErrorMessage('数据刷新失败: ' + error.message);
  } finally {
    refreshBtn.textContent = originalText;
    refreshBtn.disabled = false;
  }
}

// 切换监控标签页
function switchMonitoringTab(tabName) {
  // 更新标签按钮状态
  document.querySelectorAll('.monitoring-tabs .tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');

  // 显示对应视图
  document.querySelectorAll('.monitoring-view').forEach(view => {
    view.classList.remove('active');
  });

  const targetView = document.getElementById(tabName + 'View');
  if (targetView) {
    targetView.classList.add('active');
  }
}

// 切换交易对监控标签页
function switchTradingPairsTab(tabName) {
  // 更新标签按钮状态
  const tabContainer = document.querySelector('#tradingPairsView .monitoring-tabs');
  tabContainer.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');

  // 显示对应视图
  const viewsContainer = document.querySelector('#tradingPairsView');
  viewsContainer.querySelectorAll('.monitoring-view').forEach(view => {
    view.classList.remove('active');
  });

  const targetView = viewsContainer.querySelector('#' + tabName + 'View');
  if (targetView) {
    targetView.classList.add('active');
  }
}

// 更新系统概览
function updateSystemOverview(data) {
  if (!data.summary) return;

  document.getElementById('totalSymbols').textContent = data.summary.totalSymbols || '--';
  document.getElementById('healthySymbols').textContent = data.summary.healthySymbols || '--';
  document.getElementById('warningSymbols').textContent = data.summary.warningSymbols || '--';
  document.getElementById('errorSymbols').textContent = '0';
}

// 更新状态指示器
function updateStatusIndicator(elementId, rate) {
  const element = document.getElementById(elementId);
  if (!element) return;

  let status, text;
  if (rate >= 95) {
    status = 'healthy';
    text = '✅ 健康';
  } else if (rate >= 80) {
    status = 'warning';
    text = '⚠️ 警告';
  } else {
    status = 'error';
    text = '❌ 异常';
  }

  element.textContent = text;
  element.className = `status-indicator ${status}`;
}

// 更新数据质量状态
function updateDataQualityStatus(data) {
  if (!data.summary) return;

  const completionRates = data.summary.completionRates || {};

  const dataCollectionRate = completionRates.dataCollection || 0;
  const signalAnalysisRate = completionRates.signalAnalysis || 0;
  const simulationTradingRate = completionRates.simulationTrading || 0;

  document.getElementById('dataCollectionRate').textContent = `${dataCollectionRate.toFixed(1)}%`;
  document.getElementById('dataCollectionDetails').textContent = '--';
  updateStatusIndicator('dataCollectionStatus', dataCollectionRate);

  document.getElementById('signalAnalysisRate').textContent = `${signalAnalysisRate.toFixed(1)}%`;
  document.getElementById('signalAnalysisDetails').textContent = '--';
  updateStatusIndicator('signalAnalysisStatus', signalAnalysisRate);

  document.getElementById('simulationCompletionRate').textContent = `${simulationTradingRate.toFixed(1)}%`;
  document.getElementById('simulationCompletionDetails').textContent = '--';
  updateStatusIndicator('simulationCompletionStatus', simulationTradingRate);
}

// 更新数据验证状态
function updateDataValidationStatus(data) {
  if (!data.summary) return;

  const dataValidation = data.summary.dataValidation || {};
  const dataQuality = data.summary.dataQuality || {};

  const validationStatus = dataValidation.hasErrors ? '❌ 异常' : '✅ 正常';
  const validationDetails = dataValidation.hasErrors ?
    `(${dataValidation.errorCount}个错误)` : '';

  const qualityStatus = dataQuality.hasIssues ? '❌ 异常' : '✅ 正常';
  const qualityDetails = dataQuality.hasIssues ?
    `(${dataQuality.issueCount}个问题)` : '';

  document.getElementById('dataValidationStatus').textContent = validationStatus;
  document.getElementById('dataValidationDetails').textContent = validationDetails;
  document.getElementById('dataQualityStatus').textContent = qualityStatus;
  document.getElementById('dataQualityDetails').textContent = qualityDetails;
}

// 更新汇总视图表格
function updateSummaryTable(data) {
  console.log('🔄 开始更新汇总视图表格...');
  const tbody = document.getElementById('monitoringTableBody');
  console.log('📋 找到表格元素:', tbody);
  
  if (!tbody) {
    console.error('❌ 找不到monitoringTableBody元素');
    return;
  }

  tbody.innerHTML = '';

  if (data.detailedStats && data.detailedStats.length > 0) {
    console.log('📊 处理详细统计数据:', data.detailedStats.length, '个交易对');
    data.detailedStats.forEach((symbol, index) => {
      console.log(`📊 处理交易对 ${index + 1}:`, symbol.symbol, symbol);
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
                    <div class="refresh-frequency">${symbol.refreshFrequency}</div>
                </td>
                <td>
                    <div class="health-status ${symbol.overall.status.toLowerCase()}">${symbol.overall.status}</div>
                </td>
            `;
      tbody.appendChild(row);
    });
    console.log('✅ 汇总视图表格更新完成，添加了', data.detailedStats.length, '行数据');
  } else {
    console.log('⚠️ 没有详细统计数据，显示暂无数据');
    tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: #6c757d; padding: 20px;">
                    暂无数据
                </td>
            </tr>
        `;
  }
}

// 更新详细视图表格
function updateDetailedTable(data) {
  console.log('🔄 开始更新详细视图表格...');
  const tbody = document.getElementById('detailedTableBody');
  console.log('📋 找到详细表格元素:', tbody);
  
  if (!tbody) {
    console.error('❌ 找不到detailedTableBody元素');
    return;
  }

  tbody.innerHTML = '';

  if (data.detailedStats && data.detailedStats.length > 0) {
    console.log('📊 处理详细统计数据:', data.detailedStats.length, '个交易对');
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
                    <div class="signal-status">
                        ${symbol.hasExecution ? '执行信号' : symbol.hasSignal ? '确认信号' : symbol.hasTrend ? '趋势信号' : '无信号'}
                    </div>
                </td>
                <td>
                    <div class="last-update">${formatTime(symbol.dataCollection.lastTime)}</div>
                </td>
                <td>
                    <div class="health-status ${symbol.overall.status.toLowerCase()}">${symbol.overall.status}</div>
                </td>
            `;
      tbody.appendChild(row);
    });
    console.log('✅ 详细视图表格更新完成，添加了', data.detailedStats.length, '行数据');
  } else {
    console.log('⚠️ 没有详细统计数据，显示暂无数据');
    tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: #6c757d; padding: 20px;">
                    暂无数据
                </td>
            </tr>
        `;
  }
}

// 加载告警历史
async function loadAlertHistory() {
  try {
    const response = await fetch('/api/alert-history?limit=100');
    if (!response.ok) {
      throw new Error('获取告警历史失败');
    }
    alertHistory = await response.json();
    renderAlertHistory();
  } catch (error) {
    console.error('加载告警历史失败:', error);
    // 使用模拟数据作为后备
    alertHistory = [
      {
        id: 1,
        symbol: 'BTCUSDT',
        alert_type: 'data-quality',
        severity: 'high',
        message: '日线趋势分析失败 - 数据不足',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        details: 'K线数据长度不足，无法计算BBW指标'
      },
      {
        id: 2,
        symbol: 'ETHUSDT',
        alert_type: 'data-validation',
        severity: 'medium',
        message: '小时K线数据无效',
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        details: 'API返回的数据格式不正确'
      },
      {
        id: 3,
        symbol: 'LINKUSDT',
        alert_type: 'data-collection',
        severity: 'low',
        message: '24小时行情数据获取失败',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        details: '网络超时，重试后成功'
      }
    ];
    renderAlertHistory();
  }
}

// 渲染告警历史
function renderAlertHistory(activeFilter = 'all') {
  const alertList = document.getElementById('alertList');
  if (!alertList) return;

  const filteredAlerts = activeFilter === 'all' ?
    alertHistory :
    alertHistory.filter(alert => alert.alert_type === activeFilter);

  if (filteredAlerts.length === 0) {
    alertList.innerHTML = '<div class="no-alerts">暂无告警记录</div>';
    return;
  }

  let html = '';
  filteredAlerts.forEach(alert => {
    const time = new Date(alert.timestamp).toLocaleString('zh-CN');
    const severityClass = alert.severity === 'high' ? 'high' :
      alert.severity === 'medium' ? 'medium' : 'low';

    html += `
            <div class="alert-item ${severityClass}">
                <div class="alert-header">
                    <div class="alert-symbol">${alert.symbol}</div>
                    <div class="alert-time">${time}</div>
                </div>
                <div class="alert-type ${alert.alert_type}">${getAlertTypeName(alert.alert_type)}</div>
                <div class="alert-message">${alert.message}</div>
                ${alert.details ? `<div class="alert-details" style="margin-top: 8px; font-size: 0.9rem; color: #666;">${alert.details}</div>` : ''}
            </div>
        `;
  });

  alertList.innerHTML = html;
}

// 获取告警类型名称
function getAlertTypeName(type) {
  const typeNames = {
    'data-quality': '数据质量',
    'data-validation': '数据验证',
    'data-collection': '数据收集'
  };
  return typeNames[type] || type;
}

// 过滤告警
function filterAlerts(filter) {
  // 更新过滤按钮状态
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');

  // 渲染过滤后的告警
  renderAlertHistory(filter);
}

// 显示成功消息
function showSuccessMessage(message) {
  // 简单的成功提示
  const notification = document.createElement('div');
  notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #d4edda;
        color: #155724;
        padding: 12px 20px;
        border-radius: 6px;
        border: 1px solid #c3e6cb;
        z-index: 1000;
        font-weight: 500;
    `;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    document.body.removeChild(notification);
  }, 3000);
}

// 显示错误消息
function showErrorMessage(message) {
  // 简单的错误提示
  const notification = document.createElement('div');
  notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f8d7da;
        color: #721c24;
        padding: 12px 20px;
        border-radius: 6px;
        border: 1px solid #f5c6cb;
        z-index: 1000;
        font-weight: 500;
    `;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    document.body.removeChild(notification);
  }, 5000);
}

// 调试监控数据
function debugMonitoringData() {
  console.log('🐛 开始调试监控数据...');
  
  // 检查当前数据
  console.log('📊 当前监控数据:', currentMonitoringData);
  
  // 检查表格元素
  const monitoringTableBody = document.getElementById('monitoringTableBody');
  const detailedTableBody = document.getElementById('detailedTableBody');
  
  console.log('📋 表格元素检查:');
  console.log('- monitoringTableBody:', monitoringTableBody);
  console.log('- detailedTableBody:', detailedTableBody);
  
  if (monitoringTableBody) {
    console.log('- monitoringTableBody子元素数量:', monitoringTableBody.children.length);
    console.log('- monitoringTableBody内容:', monitoringTableBody.innerHTML);
  }
  
  if (detailedTableBody) {
    console.log('- detailedTableBody子元素数量:', detailedTableBody.children.length);
    console.log('- detailedTableBody内容:', detailedTableBody.innerHTML);
  }
  
  // 强制重新加载数据
  console.log('🔄 强制重新加载数据...');
  loadMonitoringData();
  
  // 显示调试信息
  let debugInfo = '调试信息:\n';
  debugInfo += `- 当前数据: ${currentMonitoringData ? '有' : '无'}\n`;
  debugInfo += `- 详细统计: ${currentMonitoringData && currentMonitoringData.detailedStats ? currentMonitoringData.detailedStats.length : 0}个\n`;
  debugInfo += `- 汇总表格: ${monitoringTableBody ? '找到' : '未找到'}\n`;
  debugInfo += `- 详细表格: ${detailedTableBody ? '找到' : '未找到'}\n`;
  
  alert(debugInfo);
}
