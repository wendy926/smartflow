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
  }

  // 更新刷新统计表格
  updateRefreshStatsTable() {
    const tbody = document.getElementById('refresh-stats-tbody');
    if (!tbody || !this.refreshStats) return;

    tbody.innerHTML = '';
    
    this.refreshStats.forEach(stat => {
      const row = document.createElement('tr');
      
      const dataTypeNames = {
        'trend_analysis': '4H和1H趋势判断',
        'trend_scoring': '趋势市1H多因子打分',
        'trend_entry': '趋势市15分钟入场判断',
        'range_boundary': '震荡市1H边界判断',
        'range_entry': '震荡市15分钟入场判断'
      };
      
      const refreshIntervals = {
        'trend_analysis': '60分钟',
        'trend_scoring': '5分钟',
        'trend_entry': '2分钟',
        'range_boundary': '5分钟',
        'range_entry': '2分钟'
      };
      
      row.innerHTML = `
        <td>${dataTypeNames[stat.data_type] || stat.data_type}</td>
        <td>${stat.total_symbols}</td>
        <td>${refreshIntervals[stat.data_type] || '未知'}</td>
        <td class="freshness-score ${this.getFreshnessClass(stat.avg_freshness)}">
          ${stat.avg_freshness ? stat.avg_freshness.toFixed(1) : '0.0'}%
        </td>
        <td>${stat.min_freshness ? stat.min_freshness.toFixed(1) : '0.0'}%</td>
        <td>${stat.max_freshness ? stat.max_freshness.toFixed(1) : '0.0'}%</td>
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
        'trend_analysis': '4H和1H趋势判断',
        'trend_scoring': '趋势市1H多因子打分',
        'trend_entry': '趋势市15分钟入场判断',
        'range_boundary': '震荡市1H边界判断',
        'range_entry': '震荡市15分钟入场判断'
      };
      
      row.innerHTML = `
        <td>${item.symbol}</td>
        <td>${dataTypeNames[item.data_type] || item.data_type}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="dataRefreshManager.forceRefresh('${item.symbol}', '${item.data_type}')">
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
