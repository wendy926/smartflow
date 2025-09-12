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
        'trend_analysis': '4H趋势判断',
        'trend_scoring': '1H多因子打分',
        'trend_strength': '1H加强趋势判断',
        'trend_entry': '趋势市15分钟入场判断',
        'range_boundary': '震荡市1H边界判断',
        'range_entry': '震荡市15分钟入场判断'
      };
      
      const refreshIntervals = {
        'trend_analysis': '60分钟',
        'trend_scoring': '5分钟',
        'trend_strength': '5分钟',
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
        'trend_analysis': '4H趋势判断',
        'trend_scoring': '1H多因子打分',
        'trend_strength': '1H加强趋势判断',
        'trend_entry': '趋势市15分钟入场判断',
        'range_boundary': '震荡市1H边界判断',
        'range_entry': '震荡市15分钟入场判断'
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
