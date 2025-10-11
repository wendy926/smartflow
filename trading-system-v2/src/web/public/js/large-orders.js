/**
 * 大额挂单监控前端交互
 * V2.1.0
 */

class LargeOrdersTracker {
  constructor() {
    this.refreshInterval = null;
    this.currentSymbol = 'BTCUSDT';
    this.init();
  }

  init() {
    // 绑定刷新按钮
    const refreshBtn = document.getElementById('refresh-large-orders-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadData());
    }

    // 初次加载
    this.loadData();
  }

  async loadData() {
    try {
      const response = await fetch('/api/v1/large-orders/detect');
      const result = await response.json();

      if (result.success && result.data && result.data.length > 0) {
        this.render(result.data[0]); // 默认显示第一个交易对
        this.updateLastUpdate();
      } else {
        this.showError('暂无数据');
      }
    } catch (error) {
      console.error('[LargeOrders] 加载失败', error);
      this.showError(error.message);
    }
  }

  render(data) {
    this.renderSummary(data);
    this.renderTable(data);
  }

  renderSummary(data) {
    const container = document.getElementById('large-order-summary-content');
    if (!container) return;

    const actionClass = this.getActionClass(data.finalAction);
    const actionColor = this.getActionColor(data.finalAction);

    container.innerHTML = `
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-label">交易对</div>
          <div class="summary-value">${data.symbol}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">最终动作</div>
          <div class="summary-value" style="color: ${actionColor}; font-weight: bold;">
            ${data.finalAction || 'UNKNOWN'}
          </div>
        </div>
        <div class="summary-item">
          <div class="summary-label">买入得分</div>
          <div class="summary-value">${data.buyScore?.toFixed(2) || 0}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">卖出得分</div>
          <div class="summary-value">${data.sellScore?.toFixed(2) || 0}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">CVD累积</div>
          <div class="summary-value">${this.formatNumber(data.cvdCum || 0)}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">OI变化</div>
          <div class="summary-value">${data.oiChangePct?.toFixed(2) || 0}%</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Spoof数量</div>
          <div class="summary-value">${data.spoofCount || 0}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">追踪挂单</div>
          <div class="summary-value">${data.trackedEntriesCount || 0}</div>
        </div>
      </div>
    `;
  }

  renderTable(data) {
    const tbody = document.getElementById('large-order-table-body');
    if (!tbody) return;

    const entries = data.trackedEntries || [];

    if (entries.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center">暂无追踪挂单</td></tr>';
      return;
    }

    tbody.innerHTML = entries.map((entry, index) => {
      const sideClass = entry.side === 'bid' ? 'buy' : 'sell';
      const classificationClass = this.getClassificationClass(entry.classification);
      const impactWarning = entry.impactRatio >= 0.25 ? '<span style="color: red;">⚠️</span>' : '';

      return `
        <tr class="${classificationClass}">
          <td>${index + 1}</td>
          <td><span class="badge badge-${sideClass}">${entry.side === 'bid' ? '买' : '卖'}</span></td>
          <td>${entry.price.toFixed(2)}</td>
          <td>${this.formatNumber(entry.qty)}</td>
          <td>${this.formatUSD(entry.valueUSD)}</td>
          <td>${(entry.impactRatio * 100).toFixed(1)}% ${impactWarning}</td>
          <td><span class="classification-badge ${entry.classification.toLowerCase()}">${this.translateClassification(entry.classification)}</span></td>
          <td>${entry.isPersistent ? '🟢' : '⚪'}</td>
          <td>${entry.wasConsumed ? '✅ 已吃' : (entry.isSpoof ? '⚠️ 诱导' : '—')}</td>
        </tr>
      `;
    }).join('');
  }

  getActionClass(action) {
    const map = {
      'ACCUMULATE/MARKUP': 'accumulate',
      'DISTRIBUTION/MARKDOWN': 'distribution',
      'MANIPULATION': 'manipulation',
      'NEUTRAL': 'neutral'
    };
    return map[action] || 'unknown';
  }

  getActionColor(action) {
    const map = {
      'ACCUMULATE/MARKUP': '#28a745',
      'DISTRIBUTION/MARKDOWN': '#dc3545',
      'MANIPULATION': '#ffc107',
      'NEUTRAL': '#6c757d',
      'UNKNOWN': '#6c757d'
    };
    return map[action] || '#6c757d';
  }

  getClassificationClass(classification) {
    const map = {
      'DEFENSIVE_BUY': 'defensive-buy',
      'DEFENSIVE_SELL': 'defensive-sell',
      'SWEEP_BUY': 'sweep-buy',
      'SWEEP_SELL': 'sweep-sell',
      'SPOOF': 'spoof',
      'MANIPULATION': 'manipulation'
    };
    return map[classification] || '';
  }

  translateClassification(classification) {
    const map = {
      'DEFENSIVE_BUY': '防守买',
      'DEFENSIVE_SELL': '防守卖',
      'SWEEP_BUY': '扫单买',
      'SWEEP_SELL': '扫单卖',
      'SPOOF': '诱导',
      'MANIPULATION': '操纵',
      'UNKNOWN': '未知'
    };
    return map[classification] || classification;
  }

  formatNumber(num) {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
    return num.toFixed(2);
  }

  formatUSD(num) {
    if (!num) return '$0';
    if (num >= 1000000) return '$' + (num / 1000000).toFixed(1) + 'M';
    return '$' + this.formatNumber(num);
  }

  updateLastUpdate() {
    const updateSpan = document.getElementById('lo-last-update');
    if (updateSpan) {
      const now = new Date();
      updateSpan.textContent = `更新于 ${now.toLocaleTimeString()}`;
    }
  }

  showError(message) {
    const container = document.getElementById('large-order-summary-content');
    if (container) {
      container.innerHTML = `<div class="error-message">${message}</div>`;
    }
  }

  startAutoRefresh() {
    this.stopAutoRefresh();
    this.loadData();
    this.refreshInterval = setInterval(() => this.loadData(), 30000); // 30秒刷新
  }

  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
}

// 全局实例
let largeOrdersTracker;

// DOM加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    largeOrdersTracker = new LargeOrdersTracker();
  });
} else {
  largeOrdersTracker = new LargeOrdersTracker();
}

