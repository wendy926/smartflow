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
      const [stats, directionStats, symbolStats] = await Promise.all([
        this.apiClient.getWinRateStats(),
        this.apiClient.getDirectionStats(),
        this.apiClient.getSymbolStats()
      ]);
      this.updateStatsDisplay(stats);
      this.updateDirectionStats(directionStats);
      this.updateSymbolStats(symbolStats);
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
    
    // 总交易数（所有交易）
    document.getElementById('totalTrades').textContent = 
      stats.total_trades || '0';
    
    // 已完成交易数（已平仓的交易）
    document.getElementById('completedTrades').textContent = 
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
  }

  updateDirectionStats(directionStats) {
    // 使用真实的方向统计数据
    const longStats = directionStats.long;
    const shortStats = directionStats.short;

    document.getElementById('longWinRate').textContent = 
      longStats.total_trades > 0 ? `${longStats.win_rate.toFixed(2)}%` : '--';
    
    document.getElementById('shortWinRate').textContent = 
      shortStats.total_trades > 0 ? `${shortStats.win_rate.toFixed(2)}%` : '--';
    
    document.getElementById('longProfitLoss').textContent = 
      `${longStats.net_profit.toFixed(4)} USDT`;
    
    document.getElementById('shortProfitLoss').textContent = 
      `${shortStats.net_profit.toFixed(4)} USDT`;

    // 设置盈亏颜色
    const longProfitElement = document.getElementById('longProfitLoss');
    if (longStats.net_profit > 0) {
      longProfitElement.className = 'stat-value positive';
    } else if (longStats.net_profit < 0) {
      longProfitElement.className = 'stat-value negative';
    } else {
      longProfitElement.className = 'stat-value neutral';
    }

    const shortProfitElement = document.getElementById('shortProfitLoss');
    if (shortStats.net_profit > 0) {
      shortProfitElement.className = 'stat-value positive';
    } else if (shortStats.net_profit < 0) {
      shortProfitElement.className = 'stat-value negative';
    } else {
      shortProfitElement.className = 'stat-value neutral';
    }
  }

  updateSymbolStats(symbolStats) {
    const tbody = document.getElementById('symbolStatsBody');
    
    if (!symbolStats || symbolStats.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading">暂无数据</td></tr>';
      return;
    }

    tbody.innerHTML = symbolStats.map(stat => {
      const winRateClass = stat.win_rate >= 50 ? 'win-rate high' : 
                          stat.win_rate >= 30 ? 'win-rate medium' : 'win-rate low';
      const profitClass = stat.net_profit > 0 ? 'profit-loss positive' : 
                         stat.net_profit < 0 ? 'profit-loss negative' : 'profit-loss neutral';

      return `
        <tr>
          <td>${stat.symbol}</td>
          <td>${stat.total_trades}</td>
          <td>${stat.winning_trades}</td>
          <td class="${winRateClass}">${stat.win_rate.toFixed(2)}%</td>
          <td class="${profitClass}">${this.formatNumber(stat.net_profit)}</td>
          <td class="${profitClass}">${this.formatNumber(stat.avg_profit)}</td>
        </tr>
      `;
    }).join('');
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
          <td>${sim.max_leverage || '--'}</td>
          <td>${this.formatNumber(sim.min_margin)} USDT</td>
          <td>${sim.stop_loss_distance ? sim.stop_loss_distance.toFixed(2) + '%' : '--'}</td>
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