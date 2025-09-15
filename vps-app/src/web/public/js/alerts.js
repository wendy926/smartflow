// alerts.js - 告警相关功能

// 加载告警数据
async function loadAlertsData() {
  try {
    const data = await dataManager.getMonitoringDashboard();
    renderAlertsList(data);
  } catch (error) {
    console.error('加载告警数据失败:', error);
    const alertList = document.getElementById('alertList');
    if (alertList) {
      alertList.innerHTML = '<div class="error">加载告警数据失败: ' + error.message + '</div>';
    }
  }
}

// 渲染告警列表
function renderAlertsList(data) {
  const alertList = document.getElementById('alertList');
  if (!alertList) return;

  const alerts = data.alerts || [];

  if (alerts.length === 0) {
    alertList.innerHTML = '<div class="no-alerts">🎉 暂无告警信息</div>';
    return;
  }

  let alertsHtml = '';

  alerts.forEach(alert => {
    const alertClass = getAlertClass(alert.level);
    const timeStr = new Date(alert.timestamp).toLocaleString('zh-CN');

    alertsHtml += `
      <div class="alert-item ${alertClass}" data-type="${alert.type}">
        <div class="alert-header">
          <span class="alert-icon">${getAlertIcon(alert.level)}</span>
          <span class="alert-title">${alert.title}</span>
          <span class="alert-time">${timeStr}</span>
        </div>
        <div class="alert-content">
          <p class="alert-message">${alert.message}</p>
          ${alert.details ? `<div class="alert-details">${alert.details}</div>` : ''}
        </div>
        <div class="alert-actions">
          ${alert.actions ? alert.actions.map(action =>
      `<button class="btn btn-sm ${action.class || 'secondary'}" onclick="${action.onclick}">${action.text}</button>`
    ).join('') : ''}
        </div>
      </div>
    `;
  });

  alertList.innerHTML = alertsHtml;
}

// 获取告警样式类
function getAlertClass(level) {
  switch (level) {
    case 'critical': return 'alert-critical';
    case 'warning': return 'alert-warning';
    case 'info': return 'alert-info';
    default: return 'alert-default';
  }
}

// 获取告警图标
function getAlertIcon(level) {
  switch (level) {
    case 'critical': return '🚨';
    case 'warning': return '⚠️';
    case 'info': return 'ℹ️';
    default: return '📢';
  }
}

// 过滤告警
function filterAlerts(type) {
  const alertItems = document.querySelectorAll('.alert-item');

  alertItems.forEach(item => {
    if (type === 'all' || item.dataset.type === type) {
      item.style.display = 'block';
    } else {
      item.style.display = 'none';
    }
  });

  // 更新过滤按钮状态
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[onclick="filterAlerts('${type}')"]`).classList.add('active');
}

// 清除所有错误
function clearAllErrors() {
  if (confirm('确定要清除所有错误告警吗？')) {
    // 这里可以调用API清除错误
    console.log('清除所有错误告警');
    // 重新加载告警数据
    loadAlertsData();
  }
}

// 查看Telegram配置
async function viewTelegramConfig() {
  try {
    const config = await window.apiClient.getTelegramConfig();
    const content = `
            <div style="padding: 20px;">
                <h4>Telegram 配置状态</h4>
                <p>配置状态: ${config.configured ? '已配置' : '未配置'}</p>
                ${config.configured ? `
                    <p>Bot Token: ${config.botToken ? '已设置' : '未设置'}</p>
                    <p>Chat ID: ${config.chatId ? '已设置' : '未设置'}</p>
                ` : ''}
            </div>
        `;
    modal.showMessage(content, 'info');
  } catch (error) {
    console.error('获取Telegram配置失败:', error);
    modal.showMessage('获取配置失败: ' + error.message, 'error');
  }
}

// 测试Telegram通知
async function testTelegramNotification() {
  try {
    await window.apiClient.testTelegramNotification();
    modal.showMessage('Telegram通知测试已发送', 'success');
  } catch (error) {
    console.error('测试Telegram通知失败:', error);
    modal.showMessage('测试失败: ' + error.message, 'error');
  }
}

// 测试数据质量告警
async function testDataQualityAlert() {
  try {
    await dataManager.testDataQualityAlert();
    modal.showMessage('数据质量告警测试已发送', 'success');
  } catch (error) {
    console.error('测试数据质量告警失败:', error);
    modal.showMessage('测试失败: ' + error.message, 'error');
  }
}
