// 模拟交易数据页面逻辑
class SimulationDataManager {
  constructor() {
    this.apiClient = new APIClient();
    this.currentPage = 1;
    this.pageSize = 20;
    this.pagination = null;
    this.allSimulations = []; // 存储所有模拟交易数据
    this.filteredSimulations = []; // 存储筛选后的数据
    this.currentFilters = {
      strategy: '',
      direction: '',
      exitReason: '',
      result: ''
    };
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

      // 加载所有模拟交易数据
      await this.loadAllSimulations();

      // 等待DOM元素完全加载后再应用筛选
      setTimeout(() => {
        this.applyFilters();
      }, 100);

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

  async loadAllSimulations() {
    try {
      // 加载所有模拟交易数据（不分页）
      const result = await this.apiClient.getSimulationHistory();
      // API直接返回数组，不是对象
      this.allSimulations = Array.isArray(result) ? result : (result.simulations || []);
      this.filteredSimulations = [...this.allSimulations];

      // 初始化筛选选项
      this.initializeFilterOptions();
    } catch (error) {
      console.error('加载模拟交易历史失败:', error);
      this.showError('加载模拟交易历史失败: ' + error.message);
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

    // 按胜率从高到低排序
    const sortedStats = [...symbolStats].sort((a, b) => {
      return b.win_rate - a.win_rate;
    });

    tbody.innerHTML = sortedStats.map(stat => {
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

  // 应用筛选条件
  applyFilters() {
    // 获取筛选条件
    const strategyFilter = document.getElementById('strategyFilter');
    const directionFilter = document.getElementById('directionFilter');
    const exitReasonFilter = document.getElementById('exitReasonFilter');
    const resultFilter = document.getElementById('resultFilter');

    this.currentFilters.strategy = strategyFilter ? strategyFilter.value : '';
    this.currentFilters.direction = directionFilter ? directionFilter.value : '';
    this.currentFilters.exitReason = exitReasonFilter ? exitReasonFilter.value : '';
    this.currentFilters.result = resultFilter ? resultFilter.value : '';

    console.log('应用筛选条件:', this.currentFilters);

    // 筛选数据
    this.filteredSimulations = this.allSimulations.filter(sim => {
      // 策略筛选
      if (this.currentFilters.strategy && sim.strategy !== this.currentFilters.strategy) {
        return false;
      }

      // 方向筛选
      if (this.currentFilters.direction && sim.direction !== this.currentFilters.direction) {
        return false;
      }

      // 出场原因筛选
      if (this.currentFilters.exitReason) {
        const exitReason = sim.exit_reason || 'UNKNOWN';
        if (exitReason !== this.currentFilters.exitReason) {
          return false;
        }
      }

      // 结果筛选
      if (this.currentFilters.result) {
        const isWin = sim.is_win;
        if (this.currentFilters.result === 'win' && isWin !== true) {
          return false;
        }
        if (this.currentFilters.result === 'loss' && isWin !== false) {
          return false;
        }
      }

      return true;
    });

    console.log(`筛选结果: ${this.filteredSimulations.length} / ${this.allSimulations.length}`);
    console.log('筛选后的数据:', this.filteredSimulations.slice(0, 3));

    // 更新分页信息
    this.updatePaginationForFilteredData();

    // 显示第一页
    this.currentPage = 1;
    this.displayCurrentPage();

    // 更新筛选状态显示
    this.updateFilterStatus();
  }

  // 更新筛选后的分页信息
  updatePaginationForFilteredData() {
    const total = this.filteredSimulations.length;
    const totalPages = Math.ceil(total / this.pageSize);

    this.pagination = {
      currentPage: this.currentPage,
      pageSize: this.pageSize,
      total: total,
      totalPages: totalPages,
      hasPrev: this.currentPage > 1,
      hasNext: this.currentPage < totalPages
    };
  }

  // 显示当前页的数据
  displayCurrentPage() {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    const pageData = this.filteredSimulations.slice(start, end);

    this.updateSimulationHistoryTable(pageData);

    // 确保分页信息是最新的
    this.updatePaginationForFilteredData();
    this.updatePaginationControls();
  }

  // 更新筛选状态显示
  updateFilterStatus() {
    const total = this.allSimulations.length;
    const filtered = this.filteredSimulations.length;

    let statusText = `显示 ${filtered} 条记录`;
    if (filtered < total) {
      statusText += `（从 ${total} 条中筛选）`;
    }

    // 更新状态显示
    const statusDiv = document.getElementById('filterStatus');
    if (statusDiv) {
      statusDiv.textContent = statusText;
      statusDiv.style.display = filtered < total ? 'block' : 'none';
    }
  }

  updateSimulationHistoryTable(simulations) {
    const tbody = document.getElementById('simulationHistoryBody');

    if (!simulations || simulations.length === 0) {
      tbody.innerHTML = '<tr><td colspan="17" class="loading">暂无数据</td></tr>';
      return;
    }

    tbody.innerHTML = simulations.map(sim => {
      const entryTime = new Date(sim.created_at).toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      const exitTime = sim.closed_at ? new Date(sim.closed_at).toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }) : '--';
      // 使用提取的方法处理盈亏金额和结果显示
      const { profitLoss, profitLossClass, resultClass, resultText } = this.calculateSimulationResult(sim);

      return `
        <tr>
          <td>${sim.symbol}</td>
          <td>${sim.strategy || 'V3'}</td>
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
          <td class="profit-loss ${profitLossClass}">${profitLoss === null ? '--' : this.formatNumber(profitLoss)}</td>
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

    // 如果没有数据，不显示页码
    if (totalPages === 0) {
      return;
    }

    // 显示页码逻辑：当前页前后各2页
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
      const pageBtn = document.createElement('button');
      pageBtn.className = `page-number ${i === currentPage ? 'active' : ''}`;
      pageBtn.textContent = i;
      pageBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.goToPage(i);
      });
      container.appendChild(pageBtn);
    }
  }

  // 跳转到指定页面
  goToPage(page) {
    console.log(`跳转到第 ${page} 页`);
    this.currentPage = page;

    // 更新分页信息
    this.updatePaginationForFilteredData();

    // 显示当前页数据
    this.displayCurrentPage();

    console.log(`当前页: ${this.currentPage}, 总页数: ${this.pagination.totalPages}`);
  }

  setupEventListeners() {
    // 刷新按钮
    document.getElementById('refreshBtn').addEventListener('click', () => {
      this.loadData();
    });

    // 筛选按钮
    document.getElementById('applyFilters').addEventListener('click', () => {
      this.applyFilters();
    });

    // 清除筛选按钮
    document.getElementById('clearFilters').addEventListener('click', () => {
      this.clearFilters();
    });

    // 分页按钮
    document.getElementById('prevPageBtn').addEventListener('click', () => {
      if (this.pagination && this.pagination.hasPrev) {
        this.goToPage(this.currentPage - 1);
      }
    });

    document.getElementById('nextPageBtn').addEventListener('click', () => {
      if (this.pagination && this.pagination.hasNext) {
        this.goToPage(this.currentPage + 1);
      }
    });
  }

  // 初始化筛选选项
  initializeFilterOptions() {
    // 统计各类型的数量
    const directionCounts = {};
    const exitReasonCounts = {};
    const resultCounts = { win: 0, loss: 0 };

    this.allSimulations.forEach(sim => {
      // 方向统计
      directionCounts[sim.direction] = (directionCounts[sim.direction] || 0) + 1;

      // 出场原因统计
      const exitReason = sim.exit_reason || 'UNKNOWN';
      exitReasonCounts[exitReason] = (exitReasonCounts[exitReason] || 0) + 1;

      // 结果统计
      if (sim.is_win === true) {
        resultCounts.win++;
      } else if (sim.is_win === false) {
        resultCounts.loss++;
      }
      // 忽略 is_win 为 null 的记录
    });

    // 更新方向筛选选项
    this.updateSelectOptions('directionFilter', directionCounts, {
      'LONG': '做多',
      'SHORT': '做空'
    });

    // 更新出场原因筛选选项
    this.updateSelectOptions('exitReasonFilter', exitReasonCounts, {
      'STOP_LOSS': '止损',
      'TAKE_PROFIT': '止盈',
      'TREND_REVERSAL': '趋势反转',
      'MANUAL': '手动',
      'UNKNOWN': '未知'
    });

    // 更新结果筛选选项
    this.updateSelectOptions('resultFilter', resultCounts, {
      'win': '盈利',
      'loss': '亏损'
    });
  }

  // 更新下拉选项
  updateSelectOptions(selectId, counts, labels) {
    const select = document.getElementById(selectId);
    if (!select) return;

    // 清空现有选项（保留"全部"选项）
    const allOption = select.querySelector('option[value=""]');
    select.innerHTML = '';
    if (allOption) {
      select.appendChild(allOption);
    }

    // 按数量排序并添加选项
    const sortedEntries = Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([value, count]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = `${labels[value] || value} (${count})`;
        select.appendChild(option);
      });
  }

  // 清除筛选条件
  clearFilters() {
    document.getElementById('strategyFilter').value = '';
    document.getElementById('directionFilter').value = '';
    document.getElementById('exitReasonFilter').value = '';
    document.getElementById('resultFilter').value = '';

    this.currentFilters = {
      strategy: '',
      direction: '',
      exitReason: '',
      result: ''
    };

    this.applyFilters();
  }

  formatNumber(value) {
    if (value === null || value === undefined || value === '') return '--';
    return parseFloat(value).toFixed(4);
  }

  /**
   * 计算模拟交易结果显示逻辑
   * @param {Object} sim - 模拟交易记录
   * @returns {Object} { profitLoss, profitLossClass, resultClass, resultText }
   */
  calculateSimulationResult(sim) {
    // 如果交易没有结束，不显示盈亏金额
    const profitLoss = sim.status === 'ACTIVE' ? null : (sim.profit_loss || 0);
    const profitLossClass = profitLoss === null ? 'neutral' : (profitLoss > 0 ? 'positive' : profitLoss < 0 ? 'negative' : 'neutral');

    // 根据状态和is_win字段判断结果
    let resultClass, resultText;
    if (sim.status === 'ACTIVE') {
      // 如果交易没有结束，显示进行中，不展示盈亏金额
      resultClass = 'neutral';
      resultText = '进行中';
    } else if (sim.is_win === 1 || sim.is_win === true) {
      resultClass = 'positive';
      resultText = '盈利';
    } else if (sim.is_win === 0 || sim.is_win === false) {
      resultClass = 'negative';
      resultText = '亏损';
    } else {
      resultClass = 'neutral';
      resultText = '进行中';
    }

    return { profitLoss, profitLossClass, resultClass, resultText };
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