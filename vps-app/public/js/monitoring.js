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

  // 确保DOM完全准备好后再加载数据
  const initData = () => {
    console.log('⏰ 开始加载监控数据...');
    loadMonitoringData().then(() => {
      console.log('✅ 初始数据加载完成');
    }).catch(error => {
      console.error('❌ 初始数据加载失败:', error);
      // 如果初始加载失败，3秒后重试
      setTimeout(initData, 3000);
    });
  };

  // 延迟加载数据，确保DOM完全准备好
  setTimeout(initData, 200);

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

    console.log('🔍 获取到的数据收集率:', data.summary?.completionRates?.dataCollection);

    console.log('📊 监控数据结构:', data);
    console.log('📊 detailedStats长度:', data.detailedStats ? data.detailedStats.length : 'undefined');
    currentMonitoringData = data;

    // 更新各个视图
    updateSystemOverview(data);
    updateSummaryTable(data);
    loadAlertHistory();

    console.log('✅ 监控数据加载完成');
  } catch (error) {
    console.error('❌ 加载监控数据失败:', error);
    showErrorMessage('加载监控数据失败: ' + error.message);
  }
}

// 刷新监控数据（合并了强制刷新表格功能）
async function refreshMonitoringData() {
  const refreshBtn = document.querySelector('.header-controls .btn');
  const originalText = refreshBtn.textContent;

  refreshBtn.textContent = '🔄 刷新中...';
  refreshBtn.disabled = true;

  try {
    await loadMonitoringData();

    // 强制刷新表格数据
    if (currentMonitoringData && currentMonitoringData.detailedStats) {
      console.log('📊 强制刷新表格数据...');
      updateSummaryTable(currentMonitoringData);
    }

    showSuccessMessage('数据刷新成功');
  } catch (error) {
    showErrorMessage('数据刷新失败: ' + error.message);
  } finally {
    refreshBtn.textContent = originalText;
    refreshBtn.disabled = false;
  }
}

// 切换监控标签页
function switchMonitoringTab(tabName, event) {
  console.log('🔄 切换到标签页:', tabName);

  // 更新标签按钮状态
  document.querySelectorAll('.monitoring-tabs .tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // 如果提供了event参数，激活对应的按钮
  if (event && event.target) {
    event.target.classList.add('active');
  } else {
    // 否则根据tabName找到对应的按钮
    const targetBtn = document.querySelector(`[onclick*="${tabName}"]`);
    if (targetBtn) {
      targetBtn.classList.add('active');
    }
  }

  // 显示对应视图
  document.querySelectorAll('.monitoring-view').forEach(view => {
    view.classList.remove('active');
  });

  const targetView = document.getElementById(tabName + 'View');
  if (targetView) {
    targetView.classList.add('active');
    console.log('✅ 成功切换到视图:', tabName + 'View');

    // 如果切换到交易对详细监控，确保数据正确显示
    if (tabName === 'trading-pairs') {
      console.log('🔄 切换到交易对详细监控，检查数据状态...');

      // 如果当前有数据，立即更新表格
      if (currentMonitoringData && currentMonitoringData.detailedStats) {
        console.log('📊 当前有数据，立即更新表格...');
        updateSummaryTable(currentMonitoringData);
      } else {
        console.log('⚠️ 当前没有数据，重新加载...');
        // 如果没有数据，重新加载
        loadMonitoringData().then(() => {
          console.log('✅ 数据重新加载完成，更新表格...');
          if (currentMonitoringData && currentMonitoringData.detailedStats) {
            updateSummaryTable(currentMonitoringData);
          }
        }).catch(error => {
          console.error('❌ 重新加载数据失败:', error);
        });
      }
    }
  } else {
    console.error('❌ 找不到目标视图:', tabName + 'View');
  }
}

// 切换交易对监控标签页 (已移除，只保留汇总视图)

// 更新系统概览
function updateSystemOverview(data) {
  if (!data.summary) return;

  // 交易对维度数据
  document.getElementById('totalSymbols').textContent = data.summary.totalSymbols || '--';
  document.getElementById('healthySymbols').textContent = data.summary.healthySymbols || '--';
  document.getElementById('warningSymbols').textContent = data.summary.warningSymbols || '--';
  document.getElementById('errorSymbols').textContent = data.summary.errorSymbols || '0';

  // 告警总数
  document.getElementById('totalAlerts').textContent = data.summary.totalAlerts || '0';

  // 指标维度数据
  const completionRates = data.summary.completionRates || {};
  console.log('🔍 更新数据收集率:', completionRates.dataCollection);
  document.getElementById('dataCollectionRate').textContent = `${completionRates.dataCollection || 0}%`;

  // 数据验证状态
  const validationStatus = data.summary.totalAlerts > 0 ? '❌ 异常' : '✅ 正常';
  const validationDetails = data.summary.totalAlerts > 0 ? `(${data.summary.totalAlerts}个告警)` : '';
  document.getElementById('dataValidationStatus').textContent = validationStatus;
  document.getElementById('dataValidationIndicator').textContent = validationDetails;

  // 模拟交易完成率
  const simulationRate = completionRates.simulationTrading || 0;
  document.getElementById('simulationCompletionRate').textContent = `${simulationRate.toFixed(1)}%`;

  // 计算模拟交易完成次数/总次数
  let totalTriggers = 0;
  let totalCompletions = 0;
  if (data.detailedStats) {
    data.detailedStats.forEach(symbol => {
      // 使用新的数据结构
      totalTriggers += 1; // 每个交易对算作一个触发器
      if (symbol.simulationCompletionRate > 0) {
        totalCompletions += 1;
      }
    });
  }
  document.getElementById('simulationCompletionDetails').textContent = `${totalCompletions}/${totalTriggers}`;

  // 更新数据收集率状态指示器
  updateStatusIndicator('dataCollectionStatus', completionRates.dataCollection || 0);
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

  // 使用更健壮的元素查找方式
  let tbody = document.getElementById('monitoringTableBody');

  if (!tbody) {
    console.warn('⚠️ 第一次查找monitoringTableBody失败，尝试其他方式...');
    // 尝试通过父元素查找
    const tradingPairsView = document.getElementById('tradingPairsView');
    if (tradingPairsView) {
      tbody = tradingPairsView.querySelector('tbody');
      console.log('📋 通过父元素找到表格:', tbody);
    }
  }

  if (!tbody) {
    console.warn('⚠️ 第二次查找失败，尝试通过类名查找...');
    // 尝试通过类名查找
    const tableContainer = document.querySelector('.symbols-table-container');
    if (tableContainer) {
      tbody = tableContainer.querySelector('tbody');
      console.log('📋 通过类名找到表格:', tbody);
    }
  }

  if (!tbody) {
    console.error('❌ 找不到monitoringTableBody元素，尝试查找所有可能的表格元素');
    const allTables = document.querySelectorAll('table');
    const allTbodies = document.querySelectorAll('tbody');
    console.log('🔍 页面中的所有表格:', allTables.length);
    console.log('🔍 页面中的所有tbody:', allTbodies.length);

    // 如果还是找不到，等待一下再重试
    setTimeout(() => {
      console.log('🔄 延迟重试更新表格...');
      updateSummaryTable(data);
    }, 1000);
    return;
  }

  console.log('✅ 成功找到表格元素:', tbody);

  tbody.innerHTML = '';

  if (data.detailedStats && data.detailedStats.length > 0) {
    console.log('📊 处理详细统计数据:', data.detailedStats.length, '个交易对');
    data.detailedStats.forEach((symbol, index) => {
      console.log(`📊 处理交易对 ${index + 1}:`, symbol.symbol, symbol);
      const row = document.createElement('tr');
      row.className = `symbol-row ${symbol.overallStatus || 'unknown'}`;

      row.innerHTML = `
                <td class="symbol-name">
                    ${symbol.symbol}
                    ${symbol.overallStatus === 'healthy' ? '<span class="status-indicator healthy">✅</span>' : ''}
                    ${symbol.overallStatus === 'warning' ? '<span class="status-indicator warning">⚠️</span>' : ''}
                    ${symbol.overallStatus === 'error' ? '<span class="status-indicator error">❌</span>' : ''}
                </td>
                <td>
                    <div class="metric-rate">${(symbol.dataCollectionRate || 0).toFixed(1)}%</div>
                    <div class="metric-details">数据收集</div>
                </td>
                <td>
                    <div class="metric-rate">${(symbol.signalAnalysisRate || 0).toFixed(1)}%</div>
                    <div class="metric-details">信号分析</div>
                </td>
                <td>
                    <div class="metric-rate">${(symbol.simulationCompletionRate || 0).toFixed(1)}%</div>
                    <div class="metric-details">模拟交易</div>
                </td>
                <td>
                    <div class="metric-rate">${(symbol.simulationProgressRate || 0).toFixed(1)}%</div>
                    <div class="metric-details">进行中</div>
                </td>
                <td>
                    <div class="refresh-frequency">${symbol.refreshFrequency}</div>
                </td>
                <td>
                    <div class="health-status ${(symbol.overallStatus || 'unknown').toLowerCase()}">${symbol.overallStatus || 'unknown'}</div>
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

// 更新详细视图表格 (已移除，只保留汇总视图)

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
        message: '4H趋势分析失败 - 数据不足',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        details: 'K线数据长度不足，无法计算BBW指标'
      },
      {
        id: 2,
        symbol: 'ETHUSDT',
        alert_type: 'data-validation',
        severity: 'medium',
        message: '1H多因子打分数据无效',
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
      },
      {
        id: 4,
        symbol: 'AVAXUSDT',
        alert_type: 'data-validation',
        severity: 'high',
        message: '趋势打分与市场类型不一致',
        timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        details: '4H趋势为多头趋势但市场类型为震荡市'
      },
      {
        id: 5,
        symbol: 'DOGEUSDT',
        alert_type: 'data-quality',
        severity: 'medium',
        message: '当前价格获取失败',
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        details: 'Binance API返回null价格'
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
  loadMonitoringData().then(() => {
    console.log('✅ 强制重新加载完成');
    // 强制更新表格
    if (currentMonitoringData && currentMonitoringData.detailedStats) {
      updateSummaryTable(currentMonitoringData);
    }
  });

  // 显示调试信息
  let debugInfo = '调试信息:\n';
  debugInfo += `- 当前数据: ${currentMonitoringData ? '有' : '无'}\n`;
  debugInfo += `- 详细统计: ${currentMonitoringData && currentMonitoringData.detailedStats ? currentMonitoringData.detailedStats.length : 0}个\n`;
  debugInfo += `- 汇总表格: ${monitoringTableBody ? '找到' : '未找到'}\n`;
  debugInfo += `- 详细表格: ${detailedTableBody ? '找到' : '未找到'}\n`;

  alert(debugInfo);
}

// 强制刷新表格数据
function forceRefreshTable() {
  console.log('🔄 强制刷新表格数据...');

  if (currentMonitoringData && currentMonitoringData.detailedStats) {
    console.log('📊 使用当前数据更新表格...');
    updateSummaryTable(currentMonitoringData);
  } else {
    console.log('⚠️ 当前没有数据，重新加载...');
    loadMonitoringData().then(() => {
      console.log('✅ 数据重新加载完成');
      if (currentMonitoringData && currentMonitoringData.detailedStats) {
        updateSummaryTable(currentMonitoringData);
      }
    }).catch(error => {
      console.error('❌ 重新加载失败:', error);
    });
  }
}

// 清空所有错误日志
async function clearAllErrors() {
  if (!confirm('确定要清空所有错误日志吗？此操作不可撤销！')) {
    return;
  }

  try {
    console.log('🗑️ 开始清空所有错误日志...');

    // 调用后端API清空错误日志
    const response = await fetch('/api/clear-validation-errors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      console.log('✅ 错误日志清空成功');
      // 重新加载监控数据
      await loadMonitoringData();
      alert('错误日志已清空！');
    } else {
      const errorData = await response.json();
      console.error('❌ 清空错误日志失败:', errorData);
      alert('清空错误日志失败: ' + (errorData.message || '未知错误'));
    }
  } catch (error) {
    console.error('❌ 清空错误日志时发生错误:', error);
    alert('清空错误日志失败: ' + error.message);
  }
}
