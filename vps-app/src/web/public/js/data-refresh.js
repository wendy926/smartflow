// data-refresh.js - 数据刷新状态管理
class DataRefreshManager {
  constructor() {
    this.refreshStats = null;
    this.staleData = [];
    this.updateInterval = null;
  }

  // 初始化数据刷新状态
  async init() {
    await this.loadRefreshStatus();
    this.startAutoUpdate();
  }

  // 加载数据刷新状态
  async loadRefreshStatus() {
    try {
      const response = await fetch('/api/data-refresh-status');
      const data = await response.json();

      if (data.success) {
        this.refreshStats = data.refreshStats;
        this.staleData = data.staleData;
        this.updateUI();
      }
    } catch (error) {
      console.error('加载数据刷新状态失败:', error);
    }
  }

  // 更新UI显示
  updateUI() {
    this.updateRefreshStatsTable();
    this.updateStaleDataTable();
    this.updateFreshnessAlertStatus();
  }

  // 更新刷新统计表格
  updateRefreshStatsTable() {
    const tbody = document.getElementById('refresh-stats-tbody');
    if (!tbody || !this.refreshStats) return;

    tbody.innerHTML = '';

    this.refreshStats.forEach(stat => {
      const row = document.createElement('tr');

      const dataTypeNames = {
        'trend_analysis': '4H趋势判断',
        'trend_scoring': '1H多因子打分',
        'trend_strength': '1H加强趋势判断',
        'trend_entry': '趋势市15分钟入场判断',
        'range_boundary': '震荡市1H边界判断',
        'range_entry': '震荡市15分钟入场判断',
        'trend_score': '4H趋势打分'
      };

      const refreshIntervals = {
        'trend_analysis': '60分钟',
        'trend_scoring': '5分钟',
        'trend_strength': '5分钟',
        'trend_entry': '2分钟',
        'range_boundary': '5分钟',
        'range_entry': '2分钟'
      };

      // 计算告警级别
      const avgAlertLevel = this.getFreshnessAlertLevel(stat.avg_freshness || 0, stat.data_type);
      const minAlertLevel = this.getFreshnessAlertLevel(stat.min_freshness || 0, stat.data_type);
      const maxAlertLevel = this.getFreshnessAlertLevel(stat.max_freshness || 0, stat.data_type);

      row.innerHTML = `
        <td>${dataTypeNames[stat.data_type] || stat.data_type}</td>
        <td>${stat.total_symbols}</td>
        <td>${refreshIntervals[stat.data_type] || '未知'}</td>
        <td class="freshness-score ${this.getFreshnessClass(stat.avg_freshness)} ${this.getAlertLevelClass(avgAlertLevel)}">
          ${this.getAlertLevelIcon(avgAlertLevel)} ${stat.avg_freshness ? stat.avg_freshness.toFixed(1) : '0.0'}%
        </td>
        <td class="freshness-score ${this.getFreshnessClass(stat.min_freshness)} ${this.getAlertLevelClass(minAlertLevel)}">
          ${this.getAlertLevelIcon(minAlertLevel)} ${stat.min_freshness ? stat.min_freshness.toFixed(1) : '0.0'}%
        </td>
        <td class="freshness-score ${this.getFreshnessClass(stat.max_freshness)} ${this.getAlertLevelClass(maxAlertLevel)}">
          ${this.getAlertLevelIcon(maxAlertLevel)} ${stat.max_freshness ? stat.max_freshness.toFixed(1) : '0.0'}%
        </td>
      `;

      tbody.appendChild(row);
    });
  }

  // 更新过期数据表格
  updateStaleDataTable() {
    const tbody = document.getElementById('stale-data-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (this.staleData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="text-center">暂无过期数据</td></tr>';
      return;
    }

    this.staleData.forEach(item => {
      const row = document.createElement('tr');

      const dataTypeNames = {
        'trend_analysis': '4H趋势判断',
        'trend_scoring': '1H多因子打分',
        'trend_strength': '1H加强趋势判断',
        'trend_entry': '趋势市15分钟入场判断',
        'range_boundary': '震荡市1H边界判断',
        'range_entry': '震荡市15分钟入场判断',
        'trend_score': '4H趋势打分'
      };

      // 修复字段名问题：使用 data_type 而不是 dataType
      const dataType = item.data_type || item.dataType;

      row.innerHTML = `
        <td>${item.symbol}</td>
        <td>${dataTypeNames[dataType] || dataType}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="dataRefreshManager.forceRefresh('${item.symbol}', '${dataType}')">
            强制刷新
          </button>
        </td>
      `;

      tbody.appendChild(row);
    });
  }

  // 获取新鲜度样式类
  getFreshnessClass(score) {
    if (score >= 90) return 'text-success';
    if (score >= 70) return 'text-warning';
    return 'text-danger';
  }

  // 获取新鲜度告警级别
  getFreshnessAlertLevel(freshness, dataType) {
    const thresholds = {
      'trend_analysis': { critical: 30, warning: 50, info: 70 },
      'trend_scoring': { critical: 30, warning: 50, info: 70 },
      'trend_strength': { critical: 30, warning: 50, info: 70 },
      'trend_entry': { critical: 20, warning: 40, info: 60 },
      'range_boundary': { critical: 30, warning: 50, info: 70 },
      'range_entry': { critical: 20, warning: 40, info: 60 }
    };

    const threshold = thresholds[dataType] || { critical: 30, warning: 50, info: 70 };
    
    if (freshness <= threshold.critical) return 'critical';
    if (freshness <= threshold.warning) return 'warning';
    if (freshness <= threshold.info) return 'info';
    return 'normal';
  }

  // 获取告警级别样式
  getAlertLevelClass(level) {
    switch (level) {
      case 'critical': return 'alert-critical';
      case 'warning': return 'alert-warning';
      case 'info': return 'alert-info';
      default: return '';
    }
  }

  // 获取告警级别图标
  getAlertLevelIcon(level) {
    switch (level) {
      case 'critical': return '🔴';
      case 'warning': return '🟡';
      case 'info': return '🔵';
      default: return '';
    }
  }

  // 更新新鲜度告警状态
  async updateFreshnessAlertStatus() {
    try {
      const response = await fetch('/api/freshness-alert-status');
      const data = await response.json();

      if (data.success) {
        this.displayFreshnessAlertStatus(data.status);
        // 同时获取详细的告警日志
        await this.updateFreshnessAlertLogs();
      }
    } catch (error) {
      console.error('获取新鲜度告警状态失败:', error);
    }
  }

  /**
   * 更新新鲜度告警日志
   */
  async updateFreshnessAlertLogs() {
    try {
      const response = await fetch('/api/freshness-alert-logs?severity=critical&limit=20');
      const data = await response.json();
      
      if (data.success) {
        this.displayFreshnessAlertLogs(data.logs);
      }
    } catch (error) {
      console.error('获取新鲜度告警日志失败:', error);
    }
  }

  // 显示新鲜度告警日志
  displayFreshnessAlertLogs(logs) {
    let alertLogsContainer = document.getElementById('freshness-alert-logs');
    
    if (!alertLogsContainer) {
      // 创建告警日志容器
      alertLogsContainer = document.createElement('div');
      alertLogsContainer.id = 'freshness-alert-logs';
      alertLogsContainer.style.display = 'none';
      alertLogsContainer.innerHTML = `
        <div class="alert-logs-header">
          <h3>🔴 严重告警详情</h3>
          <button onclick="this.parentElement.parentElement.style.display='none'" class="close-btn">×</button>
        </div>
        <div class="alert-logs-content"></div>
      `;
      
      // 添加到页面
      const alertStatusCard = document.getElementById('freshness-alert-status');
      if (alertStatusCard) {
        alertStatusCard.appendChild(alertLogsContainer);
      }
    }
    
    if (logs.length === 0) {
      alertLogsContainer.style.display = 'none';
      return;
    }
    
    const logsContent = alertLogsContainer.querySelector('.alert-logs-content');
    logsContent.innerHTML = `
      <div class="alert-logs-list">
        ${logs.map(log => `
          <div class="alert-log-item ${log.severity}">
            <div class="log-symbol">${log.symbol}</div>
            <div class="log-type">${this.getDataTypeDisplayName(log.data_type)}</div>
            <div class="log-freshness">${log.data_freshness_score.toFixed(1)}%</div>
            <div class="log-time">${new Date(log.last_update).toLocaleString()}</div>
            <div class="log-interval">${log.refresh_interval}分钟</div>
          </div>
        `).join('')}
      </div>
    `;
    
    alertLogsContainer.style.display = 'block';
  }

  // 显示新鲜度告警状态
  displayFreshnessAlertStatus(status) {
    const alertStatusCard = document.getElementById('freshness-alert-status');
    const alertStatusContent = document.getElementById('alert-status-content');

    if (!alertStatusCard || !alertStatusContent) return;

    // 检查是否有告警
    const hasAlerts = status.critical > 0 || status.warning > 0 || status.info > 0;

    if (!hasAlerts) {
      alertStatusCard.style.display = 'none';
      return;
    }

    alertStatusCard.style.display = 'block';

    const alertStatusHtml = `
      <div class="alert-summary">
        <div class="alert-item critical">
          <span class="alert-icon">🔴</span>
          <span class="alert-count">${status.critical}</span>
          <span class="alert-label">严重告警</span>
        </div>
        <div class="alert-item warning">
          <span class="alert-icon">🟡</span>
          <span class="alert-count">${status.warning}</span>
          <span class="alert-label">警告告警</span>
        </div>
        <div class="alert-item info">
          <span class="alert-icon">🔵</span>
          <span class="alert-count">${status.info}</span>
          <span class="alert-label">提示告警</span>
        </div>
        <div class="alert-item normal">
          <span class="alert-icon">✅</span>
          <span class="alert-count">${status.normal}</span>
          <span class="alert-label">正常</span>
        </div>
      </div>
      <div class="alert-details">
        <h4>按数据类型统计:</h4>
        <div class="data-type-alerts">
          ${Object.entries(status.byDataType).map(([dataType, stats]) => `
            <div class="data-type-item">
              <span class="data-type-name">${this.getDataTypeDisplayName(dataType)}</span>
              <div class="data-type-stats">
                <span class="stat critical">🔴 ${stats.critical}</span>
                <span class="stat warning">🟡 ${stats.warning}</span>
                <span class="stat info">🔵 ${stats.info}</span>
                <span class="stat normal">✅ ${stats.normal}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="alert-actions">
        <button onclick="dataRefreshUI.toggleAlertLogs()" class="btn btn-primary">
          ${status.critical > 0 ? `查看 ${status.critical} 个严重告警详情` : '查看告警详情'}
        </button>
      </div>
    `;

    alertStatusContent.innerHTML = alertStatusHtml;
  }

  // 切换告警日志显示
  toggleAlertLogs() {
    const alertLogsContainer = document.getElementById('freshness-alert-logs');
    if (alertLogsContainer) {
      if (alertLogsContainer.style.display === 'none' || alertLogsContainer.style.display === '') {
        alertLogsContainer.style.display = 'block';
        // 如果还没有加载日志，则加载
        if (!alertLogsContainer.querySelector('.alert-logs-list')) {
          this.updateFreshnessAlertLogs();
        }
      } else {
        alertLogsContainer.style.display = 'none';
      }
    }
  }

  // 获取数据类型显示名称
  getDataTypeDisplayName(dataType) {
    const dataTypeNames = {
      'trend_analysis': '4H趋势判断',
      'trend_scoring': '1H多因子打分',
      'trend_strength': '1H加强趋势判断',
      'trend_entry': '趋势市15分钟入场判断',
      'range_boundary': '震荡市1H边界判断',
      'range_entry': '震荡市15分钟入场判断',
      'trend_score': '4H趋势打分'
    };
    return dataTypeNames[dataType] || dataType;
  }

  // 强制刷新数据
  async forceRefresh(symbol, dataType) {
    try {
      const response = await fetch('/api/force-refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ symbol, dataType })
      });

      const data = await response.json();

      if (data.success) {
        alert(data.message);
        await this.loadRefreshStatus();
      } else {
        alert('刷新失败: ' + data.error);
      }
    } catch (error) {
      console.error('强制刷新失败:', error);
      alert('强制刷新失败');
    }
  }

  // 批量刷新所有过期数据
  async refreshAllStale() {
    if (!confirm('确定要刷新所有过期数据吗？这可能需要一些时间。')) {
      return;
    }

    try {
      // 显示加载状态
      const refreshAllBtn = document.getElementById('refresh-all-btn');
      if (refreshAllBtn) {
        refreshAllBtn.disabled = true;
        refreshAllBtn.textContent = '刷新中...';
      }

      const response = await fetch('/api/refresh-all-stale', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        alert(`批量刷新完成！\n总计: ${data.total} 个\n成功: ${data.successCount} 个\n失败: ${data.failCount} 个`);
        await this.loadRefreshStatus();
      } else {
        alert('批量刷新失败: ' + data.error);
      }
    } catch (error) {
      console.error('批量刷新失败:', error);
      alert('批量刷新失败');
    } finally {
      // 恢复按钮状态
      const refreshAllBtn = document.getElementById('refresh-all-btn');
      if (refreshAllBtn) {
        refreshAllBtn.disabled = false;
        refreshAllBtn.textContent = '一键刷新所有过期数据';
      }
    }
  }

  // 开始自动更新
  startAutoUpdate() {
    this.updateInterval = setInterval(() => {
      this.loadRefreshStatus();
    }, 30000); // 每30秒更新一次
  }

  // 停止自动更新
  stopAutoUpdate() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}

// 创建全局实例
const dataRefreshManager = new DataRefreshManager();

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  dataRefreshManager.init();
});
