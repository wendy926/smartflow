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
      console.log('[LargeOrders] 开始加载数据...');
      const response = await fetch('/api/v1/large-orders/detect');
      const result = await response.json();
      console.log('[LargeOrders] API响应:', result);

      if (result.success && result.data && result.data.length > 0) {
        // V2.1.2：支持多交易对显示
        this.renderMultipleSymbols(result.data);
        this.updateLastUpdate();
      } else {
        console.warn('[LargeOrders] 无数据返回');
        this.showError('暂无数据');
      }
    } catch (error) {
      console.error('[LargeOrders] 加载失败', error);
      this.showError('加载失败: ' + error.message);
    }
  }

  /**
   * 渲染多个交易对（新增）
   */
  renderMultipleSymbols(dataArray) {
    const container = document.getElementById('large-order-summary-content');
    if (!container) return;

    // 生成多个交易对的Summary卡片
    container.innerHTML = dataArray.map(data => this.generateSymbolCard(data)).join('');
    
    // 渲染第一个有数据的交易对的详细表格
    const dataWithEntries = dataArray.find(d => d.trackedEntriesCount > 0);
    if (dataWithEntries) {
      this.renderTable(dataWithEntries);
    } else {
      // 都没有数据，显示第一个
      this.renderTable(dataArray[0]);
    }
  }

  /**
   * 生成单个交易对卡片（新增）
   */
  generateSymbolCard(data) {
    const actionColor = this.getActionColor(data.finalAction);
    const buyScore = (data.buyScore || 0).toFixed(2);
    const sellScore = (data.sellScore || 0).toFixed(2);
    
    // 买卖力量百分比
    const totalScore = parseFloat(buyScore) + parseFloat(sellScore);
    const buyPct = totalScore > 0 ? (parseFloat(buyScore) / totalScore * 100).toFixed(0) : 50;
    const sellPct = totalScore > 0 ? (parseFloat(sellScore) / totalScore * 100).toFixed(0) : 50;
    
    // Trap标记
    const trapIndicator = data.trap && data.trap.detected
      ? `<span class="trap-${data.trap.type === 'BULL_TRAP' ? 'bull' : 'bear'}">
           ⚠️ ${data.trap.type === 'BULL_TRAP' ? '诱多' : '诱空'} (${data.trap.confidence.toFixed(0)}%)
         </span>`
      : '';

    return `
      <div class="symbol-card" style="margin-bottom: 20px; padding: 20px; background: white; border-radius: 8px; border-left: 4px solid ${actionColor};">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <div>
            <h3 style="margin: 0; font-size: 20px;">${data.symbol}</h3>
            <div style="margin-top: 5px;">
              <span class="badge" style="background: ${actionColor}; color: white; padding: 4px 12px; border-radius: 12px;">
                ${this.getActionText(data.finalAction)}
              </span>
              ${trapIndicator}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 24px; font-weight: bold;">${data.trackedEntriesCount}个</div>
            <div style="font-size: 12px; color: #666;">追踪挂单 (>1M USD)</div>
          </div>
        </div>
        
        <!-- 买卖力量对比 -->
        <div style="margin: 15px 0;">
          <div style="font-size: 13px; color: #666; margin-bottom: 5px;">买卖力量对比</div>
          <div style="display: flex; height: 30px; border-radius: 15px; overflow: hidden; background: #e9ecef;">
            <div style="width: ${buyPct}%; background: linear-gradient(90deg, #28a745, #20c997); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">
              ${buyPct > 20 ? `买 ${buyScore}` : ''}
            </div>
            <div style="width: ${sellPct}%; background: linear-gradient(90deg, #ffc107, #fd7e14); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">
              ${sellPct > 20 ? `卖 ${sellScore}` : ''}
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 5px; font-size: 12px; color: #666;">
            <span>买方 ${buyPct}%</span>
            <span>卖方 ${sellPct}%</span>
          </div>
        </div>
        
        <!-- 关键指标 -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 15px;">
          <div style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 6px;">
            <div style="font-size: 11px; color: #666;">CVD累积</div>
            <div style="font-size: 16px; font-weight: bold; color: ${data.cvdCum >= 0 ? '#28a745' : '#dc3545'};">
              ${data.cvdCum >= 0 ? '+' : ''}${this.formatNumber(data.cvdCum || 0)}
            </div>
          </div>
          <div style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 6px;">
            <div style="font-size: 11px; color: #666;">OI变化</div>
            <div style="font-size: 16px; font-weight: bold; color: ${data.oiChangePct >= 0 ? '#28a745' : '#dc3545'};">
              ${data.oiChangePct >= 0 ? '+' : ''}${(data.oiChangePct || 0).toFixed(2)}%
            </div>
          </div>
          <div style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 6px;">
            <div style="font-size: 11px; color: #666;">Spoof</div>
            <div style="font-size: 16px; font-weight: bold; color: ${data.spoofCount > 0 ? '#fd7e14' : '#6c757d'};">
              ${data.spoofCount > 0 ? '⚠️ ' : ''}${data.spoofCount || 0}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 获取动作文本（新增）
   */
  getActionText(action) {
    const textMap = {
      'ACCUMULATE': '吸筹',
      'MARKUP': '拉升',
      'DISTRIBUTION': '派发',
      'MARKDOWN': '砸盘',
      'MANIPULATION': '操纵',
      'UNKNOWN': '观察'
    };
    return textMap[action] || action;
  }

  render(data) {
    this.renderSummary(data);
    this.renderTable(data);
  }

  renderSummary(data) {
    const container = document.getElementById('large-order-summary-content');
    if (!container) {
      console.error('[LargeOrders] Summary容器未找到');
      return;
    }

    const actionColor = this.getActionColor(data.finalAction);
    const buyScore = (data.buyScore !== undefined && data.buyScore !== null) ? data.buyScore.toFixed(2) : '0.00';
    const sellScore = (data.sellScore !== undefined && data.sellScore !== null) ? data.sellScore.toFixed(2) : '0.00';
    const oiChangePct = (data.oiChangePct !== undefined && data.oiChangePct !== null) ? data.oiChangePct.toFixed(2) : '0.00';

    // Trap信息
    const trapIndicator = data.trap && data.trap.detected
      ? `<span class="trap-${data.trap.type === 'BULL_TRAP' ? 'bull' : 'bear'}">
           ⚠️ ${data.trap.type === 'BULL_TRAP' ? '诱多' : '诱空'} (${data.trap.confidence.toFixed(0)}%)
         </span>`
      : '';

    container.innerHTML = `
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-label">交易对</div>
          <div class="summary-value">${data.symbol || 'N/A'}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">最终动作</div>
          <div class="summary-value action-${(data.finalAction || 'UNKNOWN').toLowerCase()}">
            ${data.finalAction || 'UNKNOWN'}
            ${trapIndicator}
          </div>
        </div>
        <div class="summary-item">
          <div class="summary-label">买入得分</div>
          <div class="summary-value">${buyScore}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">卖出得分</div>
          <div class="summary-value">${sellScore}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">CVD累积</div>
          <div class="summary-value">${this.formatNumber(data.cvdCum || 0)}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">OI变化</div>
          <div class="summary-value">${oiChangePct}%</div>
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
      <div style="margin-top: 15px; padding: 10px; background: #fff3cd; border-radius: 4px; font-size: 13px;">
        💡 说明：大额挂单监控采用按需检测模式，点击"刷新数据"按钮可获取最新数据。当前没有追踪挂单表示市场上暂无>100M USD的大额挂单（正常现象）。
      </div>
    `;
    
    console.log('[LargeOrders] Summary渲染完成');
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

