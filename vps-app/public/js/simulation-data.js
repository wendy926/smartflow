// simulation-data.js - 模拟交易数据页面逻辑

class SimulationDataManager {
  constructor() {
    this.dataManager = new DataManager();
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.loadData();
  }

  setupEventListeners() {
    const refreshBtn = document.getElementById('refreshBtn');
    refreshBtn.addEventListener('click', () => this.loadData());
  }

  async loadData() {
    try {
      this.showLoading(true);
      
      // 获取模拟交易历史数据
      const history = await this.dataManager.getSimulationHistory();
      
      // 只处理已完成的交易
      const completedTrades = history.filter(trade => trade.status === 'CLOSED');
      
      // 计算统计数据
      const stats = this.calculateStats(completedTrades);
      
      // 更新显示
      this.updateOverallStats(stats.overall);
      this.updateDirectionStats(stats.direction);
      this.updateSymbolStats(stats.symbols);
      this.updateSimulationHistory(history);
      
    } catch (error) {
      console.error('加载模拟交易数据失败:', error);
      this.showError('加载数据失败: ' + error.message);
    } finally {
      this.showLoading(false);
    }
  }

  calculateStats(completedTrades) {
    const stats = {
      overall: {
        totalTrades: completedTrades.length,
        winningTrades: 0,
        winRate: 0,
        totalProfitLoss: 0
      },
      direction: {
        long: { total: 0, winning: 0, profitLoss: 0 },
        short: { total: 0, winning: 0, profitLoss: 0 }
      },
      symbols: {}
    };

    // 计算整体统计
    completedTrades.forEach(trade => {
      const profitLoss = parseFloat(trade.profit_loss || 0);
      const isWin = trade.is_win;
      
      stats.overall.totalProfitLoss += profitLoss;
      if (isWin) {
        stats.overall.winningTrades++;
      }

      // 按方向统计
      const direction = trade.direction;
      if (direction === 'LONG') {
        stats.direction.long.total++;
        stats.direction.long.profitLoss += profitLoss;
        if (isWin) stats.direction.long.winning++;
      } else if (direction === 'SHORT') {
        stats.direction.short.total++;
        stats.direction.short.profitLoss += profitLoss;
        if (isWin) stats.direction.short.winning++;
      }

      // 按交易对统计
      const symbol = trade.symbol;
      if (!stats.symbols[symbol]) {
        stats.symbols[symbol] = {
          total: 0,
          winning: 0,
          profitLoss: 0
        };
      }
      stats.symbols[symbol].total++;
      stats.symbols[symbol].profitLoss += profitLoss;
      if (isWin) stats.symbols[symbol].winning++;
    });

    // 计算胜率
    stats.overall.winRate = stats.overall.totalTrades > 0 
      ? (stats.overall.winningTrades / stats.overall.totalTrades * 100) 
      : 0;

    stats.direction.long.winRate = stats.direction.long.total > 0 
      ? (stats.direction.long.winning / stats.direction.long.total * 100) 
      : 0;

    stats.direction.short.winRate = stats.direction.short.total > 0 
      ? (stats.direction.short.winning / stats.direction.short.total * 100) 
      : 0;

    // 计算交易对胜率
    Object.keys(stats.symbols).forEach(symbol => {
      const symbolStats = stats.symbols[symbol];
      symbolStats.winRate = symbolStats.total > 0 
        ? (symbolStats.winning / symbolStats.total * 100) 
        : 0;
      symbolStats.avgProfitLoss = symbolStats.total > 0 
        ? (symbolStats.profitLoss / symbolStats.total) 
        : 0;
    });

    return stats;
  }

  updateOverallStats(overall) {
    document.getElementById('overallWinRate').textContent = overall.winRate.toFixed(1) + '%';
    document.getElementById('overallWinRate').className = `stat-value ${this.getWinRateClass(overall.winRate)}`;
    
    document.getElementById('overallProfitLoss').textContent = this.dataManager.formatNumber(overall.totalProfitLoss);
    document.getElementById('overallProfitLoss').className = `stat-value ${overall.totalProfitLoss >= 0 ? 'positive' : 'negative'}`;
    
    document.getElementById('totalTrades').textContent = overall.totalTrades;
    document.getElementById('winningTrades').textContent = overall.winningTrades;
  }

  updateDirectionStats(direction) {
    // 做多统计
    document.getElementById('longWinRate').textContent = direction.long.winRate.toFixed(1) + '%';
    document.getElementById('longWinRate').className = `stat-value ${this.getWinRateClass(direction.long.winRate)}`;
    
    document.getElementById('longProfitLoss').textContent = this.dataManager.formatNumber(direction.long.profitLoss);
    document.getElementById('longProfitLoss').className = `stat-value ${direction.long.profitLoss >= 0 ? 'positive' : 'negative'}`;

    // 做空统计
    document.getElementById('shortWinRate').textContent = direction.short.winRate.toFixed(1) + '%';
    document.getElementById('shortWinRate').className = `stat-value ${this.getWinRateClass(direction.short.winRate)}`;
    
    document.getElementById('shortProfitLoss').textContent = this.dataManager.formatNumber(direction.short.profitLoss);
    document.getElementById('shortProfitLoss').className = `stat-value ${direction.short.profitLoss >= 0 ? 'positive' : 'negative'}`;
  }

  updateSymbolStats(symbols) {
    const tbody = document.getElementById('symbolStatsBody');
    tbody.innerHTML = '';

    if (Object.keys(symbols).length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #6c757d;">暂无数据</td></tr>';
      return;
    }

    // 按盈亏金额排序
    const sortedSymbols = Object.entries(symbols).sort((a, b) => b[1].profitLoss - a[1].profitLoss);

    sortedSymbols.forEach(([symbol, stats]) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${symbol}</strong></td>
        <td>${stats.total}</td>
        <td>${stats.winning}</td>
        <td class="win-rate ${this.getWinRateClass(stats.winRate)}">${stats.winRate.toFixed(1)}%</td>
        <td class="profit-loss ${stats.profitLoss >= 0 ? 'positive' : 'negative'}">${this.dataManager.formatNumber(stats.profitLoss)}</td>
        <td class="profit-loss ${stats.avgProfitLoss >= 0 ? 'positive' : 'negative'}">${this.dataManager.formatNumber(stats.avgProfitLoss)}</td>
      `;
      tbody.appendChild(row);
    });
  }

  updateSimulationHistory(history) {
    const tbody = document.getElementById('simulationHistoryBody');
    tbody.innerHTML = '';

    if (history.length === 0) {
      tbody.innerHTML = '<tr><td colspan="16" style="text-align: center; color: #6c757d;">暂无模拟交易记录</td></tr>';
      return;
    }

    // 按创建时间倒序排列
    const sortedHistory = history.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    sortedHistory.forEach(trade => {
      const row = document.createElement('tr');
      
      // 计算盈亏和结果
      let profitLoss = '--';
      let resultClass = '';
      let resultText = '--';

      if (trade.status === 'CLOSED') {
        profitLoss = trade.profit_loss || 0;
        const isWin = trade.is_win;
        resultClass = isWin ? 'win' : 'loss';
        resultText = isWin ? '盈利' : '亏损';
      } else if (trade.status === 'ACTIVE') {
        resultText = '进行中';
      }

      row.innerHTML = `
        <td>${trade.symbol}</td>
        <td>${trade.direction === 'LONG' ? '做多' : trade.direction === 'SHORT' ? '做空' : '--'}</td>
        <td>${this.dataManager.formatPrice(trade.entry_price)}</td>
        <td>${this.dataManager.formatPrice(trade.stop_loss_price)}</td>
        <td>${this.dataManager.formatPrice(trade.take_profit_price)}</td>
        <td>${trade.max_leverage}x</td>
        <td>${this.dataManager.formatNumber(trade.min_margin)}</td>
        <td>${trade.stop_loss_distance ? (trade.stop_loss_distance * 100).toFixed(2) + '%' : '--'}</td>
        <td>${trade.atr_value ? this.dataManager.formatPrice(trade.atr_value) : '--'}</td>
        <td>${this.dataManager.formatTime(trade.created_at)}</td>
        <td>${this.dataManager.formatTime(trade.closed_at)}</td>
        <td>${trade.exit_price ? this.dataManager.formatPrice(trade.exit_price) : '--'}</td>
        <td>${trade.exit_reason || '--'}</td>
        <td>${trade.trigger_reason || '--'}</td>
        <td class="profit-loss ${profitLoss === '--' ? '' : (profitLoss >= 0 ? 'positive' : 'negative')}">${profitLoss === '--' ? '--' : this.dataManager.formatNumber(profitLoss)}</td>
        <td class="${resultClass}">${resultText}</td>
      `;
      tbody.appendChild(row);
    });
  }

  getWinRateClass(winRate) {
    if (winRate >= 60) return 'high';
    if (winRate >= 40) return 'medium';
    return 'low';
  }

  showLoading(show) {
    const refreshBtn = document.getElementById('refreshBtn');
    refreshBtn.disabled = show;
    refreshBtn.textContent = show ? '🔄 加载中...' : '🔄 刷新数据';
  }

  showError(message) {
    const content = document.querySelector('.simulation-data-content');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    content.insertBefore(errorDiv, content.firstChild);
    
    // 5秒后自动移除错误信息
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 5000);
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
  new SimulationDataManager();
});
