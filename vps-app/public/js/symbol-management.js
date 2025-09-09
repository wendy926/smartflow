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
      
      // 并行加载交易次数统计和各类交易对数据
      await Promise.all([
        this.loadTradeCounts(),
        this.loadAllCategories()
      ]);
    } catch (error) {
      console.error('初始化失败:', error);
      this.showError('初始化失败: ' + error.message);
    }
  }

  async loadCurrentSymbols() {
    try {
      const symbols = await this.apiClient.getSymbols();
      this.currentSymbols = new Set(symbols.map(s => s.symbol));
      this.updateCurrentSymbolsDisplay();
    } catch (error) {
      console.error('加载当前交易对失败:', error);
      this.showError('加载当前交易对失败: ' + error.message);
    }
  }

  async loadTradeCounts() {
    try {
      const counts = await this.apiClient.getSymbolTradeCounts();
      this.tradeCounts.clear();
      counts.forEach(count => {
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

      let symbols = [];
      switch (category) {
        case 'mainstream':
          symbols = await this.apiClient.getMainstreamSymbols();
          break;
        case 'highcap':
          symbols = await this.apiClient.getHighCapSymbols();
          break;
        case 'trending':
          symbols = await this.apiClient.getTrendingSymbols();
          break;
        case 'smallcap':
          symbols = await this.apiClient.getSmallCapSymbols();
          break;
      }

      this.symbolData[category] = symbols;
      this.renderCategory(category, symbols);
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
    if (typeof marketCap === 'string') return marketCap;
    if (marketCap >= 1e9) return `$${(marketCap / 1e9).toFixed(1)}B`;
    if (marketCap >= 1e6) return `$${(marketCap / 1e6).toFixed(1)}M`;
    if (marketCap >= 1e3) return `$${(marketCap / 1e3).toFixed(1)}K`;
    return `$${marketCap.toFixed(0)}`;
  }

  formatPrice(price) {
    if (typeof price === 'string') return price;
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
