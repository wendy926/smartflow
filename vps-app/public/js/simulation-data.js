// 模拟交易数据页面逻辑
class SimulationDataManager {
  constructor() {
    this.apiClient = new APIClient();
    this.currentPage = 1;
    this.pageSize = 20;
    this.pagination = null;
    this.init();
  }

  async init() {
    await this.loadData();
    this.setupEventListeners();
  }

  async loadData() {
    try {
      // 加载统计数据
      await this.loadStats();
      
      // 加载分页数据
      await this.loadSimulationHistory();
      
    } catch (error) {
      console.error('加载数据失败:', error);
      this.showError('加载数据失败: ' + error.message);
    }
  }

  async loadStats() {
    try {
      const stats = await this.apiClient.getWinRateStats();
      this.updateStatsDisplay(stats);
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  }

  async loadSimulationHistory(page = 1) {
    try {
      this.currentPage = page;
      const result = await this.apiClient.getSimulationHistoryPaginated(page, this.pageSize);
      this.pagination = result.pagination;
      this.updateSimulationHistoryTable(result.simulations);
      this.updatePaginationControls();
    } catch (error) {
      console.error('加载模拟交易历史失败:', error);
      this.showError('加载模拟交易历史失败: ' + error.message);
    }
  }

  updateStatsDisplay(stats) {
    // 整体统计
    document.getElementById('overallWinRate').textContent = 
      stats.win_rate ? `${stats.win_rate.toFixed(2)}%` : '--';
    
    document.getElementById('overallProfitLoss').textContent = 
      stats.net_profit ? `${stats.net_profit.toFixed(4)} USDT` : '--';
    
    document.getElementById('totalTrades').textContent = 
      stats.total_trades || '0';
    
    document.getElementById('winningTrades').textContent = 
      stats.winning_trades || '0';
    
    document.getElementById('losingTrades').textContent = 
      stats.losing_trades || '0';

    // 设置盈亏颜色
    const profitLossElement = document.getElementById('overallProfitLoss');
    if (stats.net_profit > 0) {
      profitLossElement.className = 'stat-value positive';
    } else if (stats.net_profit < 0) {
      profitLossElement.className = 'stat-value negative';
    } else {
      profitLossElement.className = 'stat-value neutral';
    }

    // 计算方向统计（这里简化处理，实际应该从后端获取）
    this.updateDirectionStats(stats);
  }

  updateDirectionStats(stats) {
    // 这里简化处理，实际应该从后端获取详细的方向统计
    // 暂时使用整体数据的一半作为示例
    const longTrades = Math.floor(stats.total_trades / 2);
    const shortTrades = stats.total_trades - longTrades;
    const longWins = Math.floor(stats.winning_trades / 2);
    const shortWins = stats.winning_trades - longWins;

    document.getElementById('longWinRate').textContent = 
      longTrades > 0 ? `${((longWins / longTrades) * 100).toFixed(2)}%` : '--';
    
    document.getElementById('shortWinRate').textContent = 
      shortTrades > 0 ? `${((shortWins / shortTrades) * 100).toFixed(2)}%` : '--';
    
    document.getElementById('longProfitLoss').textContent = 
      `${(stats.net_profit / 2).toFixed(4)} USDT`;
    
    document.getElementById('shortProfitLoss').textContent = 
      `${(stats.net_profit / 2).toFixed(4)} USDT`;
  }

  updateSimulationHistoryTable(simulations) {
    const tbody = document.getElementById('simulationHistoryBody');
    
    if (!simulations || simulations.length === 0) {
      tbody.innerHTML = '<tr><td colspan="16" class="loading">暂无数据</td></tr>';
      return;
    }

    tbody.innerHTML = simulations.map(sim => {
      const entryTime = new Date(sim.created_at).toLocaleString('zh-CN');
      const exitTime = sim.closed_at ? new Date(sim.closed_at).toLocaleString('zh-CN') : '--';
      const profitLoss = sim.profit_loss || 0;
      const profitLossClass = profitLoss > 0 ? 'positive' : profitLoss < 0 ? 'negative' : 'neutral';
      const resultClass = sim.is_win ? 'positive' : 'negative';
      const resultText = sim.is_win ? '盈利' : '亏损';

      return `
        <tr>
          <td>${sim.symbol}</td>
          <td>${sim.direction === 'LONG' ? '做多' : '做空'}</td>
          <td>${this.formatNumber(sim.entry_price)}</td>
          <td>${this.formatNumber(sim.stop_loss_price)}</td>
          <td>${this.formatNumber(sim.take_profit_price)}</td>
          <td>${sim.leverage || '--'}</td>
          <td>${this.formatNumber(sim.min_margin)}</td>
          <td>${this.formatNumber(sim.stop_loss_distance)}</td>
          <td>${this.formatNumber(sim.atr_value)}</td>
          <td>${entryTime}</td>
          <td>${exitTime}</td>
          <td>${this.formatNumber(sim.exit_price)}</td>
          <td>${sim.exit_reason || '--'}</td>
          <td>${sim.trigger_reason || '--'}</td>
          <td class="profit-loss ${profitLossClass}">${this.formatNumber(profitLoss)}</td>
          <td class="profit-loss ${resultClass}">${resultText}</td>
        </tr>
      `;
    }).join('');
  }

  updatePaginationControls() {
    if (!this.pagination) return;

    const container = document.getElementById('paginationContainer');
    const info = document.getElementById('paginationInfo');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const pageNumbers = document.getElementById('pageNumbers');

    // 显示分页控件
    container.style.display = 'flex';

    // 更新分页信息
    const start = (this.pagination.currentPage - 1) * this.pagination.pageSize + 1;
    const end = Math.min(start + this.pagination.pageSize - 1, this.pagination.total);
    info.textContent = `显示第 ${start}-${end} 条，共 ${this.pagination.total} 条记录`;

    // 更新按钮状态
    prevBtn.disabled = !this.pagination.hasPrev;
    nextBtn.disabled = !this.pagination.hasNext;

    // 生成页码
    this.generatePageNumbers(pageNumbers);
  }

  generatePageNumbers(container) {
    container.innerHTML = '';
    
    const currentPage = this.pagination.currentPage;
    const totalPages = this.pagination.totalPages;
    
    // 显示页码逻辑：当前页前后各2页
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
      const pageBtn = document.createElement('button');
      pageBtn.className = `page-number ${i === currentPage ? 'active' : ''}`;
      pageBtn.textContent = i;
      pageBtn.addEventListener('click', () => this.loadSimulationHistory(i));
      container.appendChild(pageBtn);
    }
  }

  setupEventListeners() {
    // 刷新按钮
    document.getElementById('refreshBtn').addEventListener('click', () => {
      this.loadData();
    });

    // 分页按钮
    document.getElementById('prevPageBtn').addEventListener('click', () => {
      if (this.pagination && this.pagination.hasPrev) {
        this.loadSimulationHistory(this.currentPage - 1);
      }
    });

    document.getElementById('nextPageBtn').addEventListener('click', () => {
      if (this.pagination && this.pagination.hasNext) {
        this.loadSimulationHistory(this.currentPage + 1);
      }
    });
  }

  formatNumber(value) {
    if (value === null || value === undefined || value === '') return '--';
    return parseFloat(value).toFixed(4);
  }

  showError(message) {
    console.error(message);
    // 可以添加错误提示UI
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  new SimulationDataManager();
});