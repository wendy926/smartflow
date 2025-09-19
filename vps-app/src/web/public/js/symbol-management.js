// public/js/symbol-management.js - 交易对管理页面逻辑

class SymbolManagement {
  constructor() {
    this.apiClient = new APIClient();
    this.currentSymbols = new Set();
    this.symbolData = {
      mainstream: [],
      highcap: [],
      trending: [],
      smallcap: []
    };
    this.tradeCounts = new Map(); // 存储交易次数统计
  }

  async init() {
    try {
      // 加载当前已添加的交易对
      await this.loadCurrentSymbols();

      // 并行加载交易次数统计、策略统计和各类交易对数据
      await Promise.all([
        this.loadTradeCounts(),
        this.loadStrategyStats(),
        this.loadAllCategories()
      ]);
    } catch (error) {
      console.error('初始化失败:', error);
      this.showError('初始化失败: ' + error.message);
    }
  }

  async loadCurrentSymbols() {
    try {
      const response = await this.apiClient.getSymbols();
      // 处理API响应结构，提取data字段
      const symbols = response && response.data ? response.data : response;
      // 确保symbols是数组
      const symbolArray = Array.isArray(symbols) ? symbols : [];
      this.currentSymbols = new Set(symbolArray.map(s => typeof s === 'string' ? s : s.symbol));
      this.updateCurrentSymbolsDisplay();
    } catch (error) {
      console.error('加载当前交易对失败:', error);
      this.showError('加载当前交易对失败: ' + error.message);
    }
  }

  async loadTradeCounts() {
    try {
      const response = await this.apiClient.getSymbolTradeCounts();
      // 处理API响应结构，提取data字段
      const counts = response && response.data ? response.data : response;
      // 确保counts是数组
      const countsArray = Array.isArray(counts) ? counts : [];
      this.tradeCounts.clear();
      countsArray.forEach(count => {
        this.tradeCounts.set(count.symbol, {
          daily: count.daily_count || 0,
          weekly: count.weekly_count || 0
        });
      });
    } catch (error) {
      console.error('加载交易次数统计失败:', error);
      // 不显示错误，因为这是可选功能
    }
  }

  async loadStrategyStats() {
    try {
      console.log('📊 开始加载统一策略统计...');

      // 获取统一监控数据
      const response = await fetch('/api/unified-monitoring/dashboard');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('📊 统一策略统计获取成功:', data);

      // 更新V3策略统计
      this.updateV3StatsFromUnified(data.data);

      // 更新ICT策略统计
      this.updateICTStatsFromUnified(data.data);

      // 更新综合统计
      this.updateCombinedStats();

      console.log('✅ 统一策略统计加载完成');
    } catch (error) {
      console.error('❌ 加载统一策略统计失败:', error);
      this.showError('加载策略统计失败: ' + error.message);
    }
  }

  updateV3Stats(stats) {
    document.getElementById('v3TotalTrades').textContent = stats.total_trades || '0';
    document.getElementById('v3WinRate').textContent = stats.win_rate ? `${stats.win_rate.toFixed(2)}%` : '--';
  }

  // 从统一监控数据更新V3策略统计
  updateV3StatsFromUnified(data) {
    const v3Stats = data.summary?.v3Strategy || {};
    const v3CompletionRates = data.completionRates?.v3Strategy || {};

    // 更新V3策略卡片
    const v3Card = document.querySelector('.strategy-card.v3');
    if (v3Card) {
      const totalTradesEl = v3Card.querySelector('.stat-value');
      const winRateEl = v3Card.querySelector('.stat-value:nth-child(2)');
      const dataCollectionEl = v3Card.querySelector('.stat-value:nth-child(3)');

      if (totalTradesEl) totalTradesEl.textContent = v3Stats.totalSymbols || '0';
      if (winRateEl) winRateEl.textContent = `${v3CompletionRates.dataCollection || 0}%`;
      if (dataCollectionEl) dataCollectionEl.textContent = `${v3CompletionRates.simulationTrading || 0}%`;
    }
  }

  // 从统一监控数据更新ICT策略统计
  updateICTStatsFromUnified(data) {
    const ictStats = data.summary?.ictStrategy || {};
    const ictCompletionRates = data.completionRates?.ictStrategy || {};

    // 更新ICT策略卡片
    const ictCard = document.querySelector('.strategy-card.ict');
    if (ictCard) {
      const totalTradesEl = ictCard.querySelector('.stat-value');
      const winRateEl = ictCard.querySelector('.stat-value:nth-child(2)');
      const dataCollectionEl = ictCard.querySelector('.stat-value:nth-child(3)');

      if (totalTradesEl) totalTradesEl.textContent = ictStats.totalSymbols || '0';
      if (winRateEl) winRateEl.textContent = `${ictCompletionRates.dataCollection || 0}%`;
      if (dataCollectionEl) dataCollectionEl.textContent = `${ictCompletionRates.simulationTrading || 0}%`;
    }
  }

  updateICTStats(stats) {
    document.getElementById('ictTotalTrades').textContent = stats.total_trades || '0';
    document.getElementById('ictWinRate').textContent = stats.win_rate ? `${stats.win_rate.toFixed(2)}%` : '--';
  }

  updateCombinedStats() {
    // 更新监控交易对数量
    document.getElementById('totalSymbols').textContent = this.currentSymbols.size;

    // 计算活跃策略数量
    const activeStrategies = this.currentSymbols.size > 0 ? 2 : 0; // V3和ICT策略
    document.getElementById('activeStrategies').textContent = activeStrategies;
  }

  updateCurrentSymbolsDisplay() {
    const container = document.getElementById('currentSymbolsList');
    const countElement = document.getElementById('currentCount');

    countElement.textContent = this.currentSymbols.size;

    if (this.currentSymbols.size === 0) {
      container.innerHTML = '<div style="color: #6c757d; text-align: center; padding: 20px;">暂无交易对</div>';
      return;
    }

    container.innerHTML = Array.from(this.currentSymbols).map(symbol => `
      <div class="current-symbol-tag">
        <span>${symbol}</span>
        <button class="remove-btn" onclick="symbolManager.removeSymbol('${symbol}')" title="删除交易对">×</button>
      </div>
    `).join('');
  }

  async loadAllCategories() {
    const categories = ['mainstream', 'highcap', 'trending', 'smallcap'];

    for (const category of categories) {
      await this.loadCategory(category);
    }

    // 确保所有分类加载完成后，重新渲染所有分类以显示交易统计
    this.updateAllCategoryDisplays();
  }

  async loadCategory(category) {
    try {
      const container = document.getElementById(`${category}Symbols`);
      container.innerHTML = '<div class="loading-spinner"></div>';

      let response;
      switch (category) {
        case 'mainstream':
          response = await this.apiClient.getMainstreamSymbols();
          break;
        case 'highcap':
          response = await this.apiClient.getHighCapSymbols();
          break;
        case 'trending':
          response = await this.apiClient.getTrendingSymbols();
          break;
        case 'smallcap':
          response = await this.apiClient.getSmallCapSymbols();
          break;
      }

      // 处理API响应结构，提取data字段
      const symbols = response && response.data ? response.data : response;
      // 确保symbols是数组
      const symbolArray = Array.isArray(symbols) ? symbols : [];
      
      this.symbolData[category] = symbolArray;
      this.renderCategory(category, symbolArray);
    } catch (error) {
      console.error(`加载${category}交易对失败:`, error);
      const container = document.getElementById(`${category}Symbols`);
      container.innerHTML = `<div style="color: #dc3545; text-align: center; padding: 20px;">加载失败: ${error.message}</div>`;
    }
  }

  renderCategory(category, symbols) {
    const container = document.getElementById(`${category}Symbols`);

    if (symbols.length === 0) {
      container.innerHTML = '<div style="color: #6c757d; text-align: center; padding: 20px;">暂无数据</div>';
      return;
    }

    container.innerHTML = symbols.map(symbol => {
      const isAdded = this.currentSymbols.has(symbol.symbol);
      const marketCapText = this.formatMarketCap(symbol.marketCap);
      const priceText = this.formatPrice(symbol.price);
      const tradeStats = this.tradeCounts.get(symbol.symbol) || { daily: 0, weekly: 0 };

      return `
        <div class="symbol-card ${isAdded ? 'added' : ''}">
          <div class="symbol-info">
            <div>
              <div class="symbol-name">${symbol.symbol}</div>
              <div class="symbol-price">${priceText}</div>
            </div>
            <div class="symbol-market-cap">${marketCapText}</div>
          </div>
          
          <div class="symbol-frequency">${symbol.suggestedFrequency}</div>
          <div class="symbol-holding-period">⏱️ ${symbol.suggestedHoldingPeriod}</div>
          
          <div class="symbol-stats">
            <h4>📊 模拟交易统计</h4>
            <div class="stats-row">
              <span class="stats-label">今日交易:</span>
              <span class="stats-value daily">${tradeStats.daily} 次</span>
            </div>
            <div class="stats-row">
              <span class="stats-label">本周交易:</span>
              <span class="stats-value weekly">${tradeStats.weekly} 次</span>
            </div>
          </div>
          
          <div class="symbol-actions">
            ${isAdded ?
          `<button class="btn-small btn-added" disabled>已添加</button>
               <button class="btn-small btn-remove" onclick="symbolManager.removeSymbol('${symbol.symbol}')">删除</button>` :
          `<button class="btn-small btn-add" onclick="symbolManager.addSymbol('${symbol.symbol}')">添加</button>`
        }
          </div>
        </div>
      `;
    }).join('');
  }

  async addSymbol(symbol) {
    try {
      const result = await this.apiClient.addSymbol(symbol);
      if (result.success) {
        this.currentSymbols.add(symbol);
        this.updateCurrentSymbolsDisplay();
        this.updateCategoryDisplays();
        this.showSuccess(`成功添加交易对: ${symbol}`);
      } else {
        this.showError(result.message);
      }
    } catch (error) {
      console.error('添加交易对失败:', error);
      this.showError('添加交易对失败: ' + error.message);
    }
  }

  async removeSymbol(symbol) {
    if (!confirm(`确定要删除交易对 ${symbol} 吗？`)) {
      return;
    }

    try {
      const result = await this.apiClient.removeSymbol(symbol);
      if (result.success) {
        this.currentSymbols.delete(symbol);
        this.updateCurrentSymbolsDisplay();
        this.updateCategoryDisplays();
        this.showSuccess(`成功删除交易对: ${symbol}`);
      } else {
        this.showError(result.message);
      }
    } catch (error) {
      console.error('删除交易对失败:', error);
      this.showError('删除交易对失败: ' + error.message);
    }
  }

  updateCategoryDisplays() {
    const categories = ['mainstream', 'highcap', 'trending', 'smallcap'];
    categories.forEach(category => {
      if (this.symbolData[category].length > 0) {
        this.renderCategory(category, this.symbolData[category]);
      }
    });
  }

  updateAllCategoryDisplays() {
    const categories = ['mainstream', 'highcap', 'trending', 'smallcap'];
    categories.forEach(category => {
      if (this.symbolData[category].length > 0) {
        this.renderCategory(category, this.symbolData[category]);
      }
    });
  }

  async refreshCategory(category) {
    const button = document.getElementById(`refresh${category.charAt(0).toUpperCase() + category.slice(1)}`);
    button.disabled = true;
    button.textContent = '刷新中...';

    try {
      await this.loadCategory(category);
      this.showSuccess(`${category} 数据刷新成功`);
    } catch (error) {
      this.showError(`${category} 数据刷新失败: ${error.message}`);
    } finally {
      button.disabled = false;
      button.textContent = '🔄 刷新';
    }
  }

  async refreshAllData() {
    const button = document.getElementById('refreshBtn');
    button.disabled = true;
    button.textContent = '刷新中...';

    try {
      await this.loadCurrentSymbols();
      await this.loadTradeCounts();
      await this.loadStrategyStats();
      await this.loadAllCategories();
      this.showSuccess('所有数据刷新成功');
    } catch (error) {
      this.showError('数据刷新失败: ' + error.message);
    } finally {
      button.disabled = false;
      button.textContent = '🔄 刷新数据';
    }
  }

  formatMarketCap(marketCap) {
    // 处理undefined、null或无效值
    if (marketCap === undefined || marketCap === null || marketCap === '') return '--';
    if (typeof marketCap === 'string') return marketCap;
    if (isNaN(marketCap)) return '--';
    if (marketCap >= 1e9) return `$${(marketCap / 1e9).toFixed(1)}B`;
    if (marketCap >= 1e6) return `$${(marketCap / 1e6).toFixed(1)}M`;
    if (marketCap >= 1e3) return `$${(marketCap / 1e3).toFixed(1)}K`;
    return `$${marketCap.toFixed(0)}`;
  }

  formatPrice(price) {
    // 处理undefined、null或无效值
    if (price === undefined || price === null || price === '') return '--';
    if (typeof price === 'string') return price;
    if (isNaN(price)) return '--';
    if (price >= 1000) return `$${price.toFixed(0)}`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    if (price >= 0.01) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(6)}`;
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 6px;
      color: white;
      font-weight: 500;
      z-index: 1000;
      max-width: 400px;
      word-wrap: break-word;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transform: translateX(100%);
      transition: transform 0.3s ease;
    `;

    // 根据类型设置样式
    switch (type) {
      case 'success':
        notification.style.background = '#28a745';
        break;
      case 'error':
        notification.style.background = '#dc3545';
        break;
      case 'warning':
        notification.style.background = '#ffc107';
        notification.style.color = '#212529';
        break;
      default:
        notification.style.background = '#17a2b8';
    }

    notification.textContent = message;
    document.body.appendChild(notification);

    // 显示动画
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);

    // 自动隐藏
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }
}

// 全局实例
let symbolManager;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  symbolManager = new SymbolManagement();
  symbolManager.init();
});

// 全局函数，供HTML调用
function refreshCategory(category) {
  symbolManager.refreshCategory(category);
}

function refreshAllData() {
  symbolManager.refreshAllData();
}
