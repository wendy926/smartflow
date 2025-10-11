/**
 * 聪明钱跟踪前端逻辑
 * 实时显示庄家动作信号
 */

class SmartMoneyTracker {
  constructor() {
    this.refreshInterval = null;
    this.updateIntervalMs = 15 * 60 * 1000; // 15分钟
  }

  /**
   * 加载聪明钱数据
   */
  async loadSmartMoneyData() {
    try {
      console.log('[聪明钱] 开始加载数据...');

      const response = await fetch('/api/v1/smart-money/detect');
      const data = await response.json();

      if (data.success) {
        console.log(`[聪明钱] 加载成功: ${data.data.length}个交易对`);
        this.updateTable(data.data);
        this.updateLastUpdateTime(data.timestamp);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('[聪明钱] 加载失败:', error);
      this.showError('加载失败: ' + error.message);
    }
  }

  /**
   * 更新表格数据
   */
  updateTable(results) {
    const tbody = document.getElementById('smart-money-tbody');
    if (!tbody) return;

    if (!results || results.length === 0) {
      tbody.innerHTML = '<tr><td colspan="11" class="no-data">暂无数据</td></tr>';
      return;
    }

    tbody.innerHTML = results.map(result => {
      const actionClass = this.getActionClass(result.action);
      const confidenceClass = this.getConfidenceClass(result.confidence);
      const trendIcon = this.getTrendIcon(result.trend);
      const price = result.indicators?.price || 0;
      const priceChange = result.indicators?.priceChange || 0;
      const priceChangeClass = priceChange >= 0 ? 'positive' : 'negative';

      // 格式化指标显示
      const obi = result.indicators?.obi || 0;
      const cvd = result.indicators?.cvd || 0;
      const oiChange = result.indicators?.oiChange || 0;
      const volume = result.indicators?.volZ || 0;
      const fundingRate = result.indicators?.fundingRate || 0;

      return `
        <tr class="action-${actionClass}">
          <td><strong>${result.symbol}</strong></td>
          <td>
            <div>$${price.toFixed(2)}</div>
            <div class="price-change ${priceChangeClass}">
              ${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(4)}
            </div>
          </td>
          <td><span class="badge badge-${actionClass}">${result.action}</span></td>
          <td><span class="badge badge-${confidenceClass}">${(result.confidence * 100).toFixed(0)}%</span></td>
          <td title="Order Book Imbalance - 订单簿失衡">
            <div>${obi.toFixed(2)}</div>
            <small style="color: #999;">(${result.indicators?.obiZ?.toFixed(2) || '0.00'}σ)</small>
          </td>
          <td title="Cumulative Volume Delta - 累计成交量差">
            <div>${this.formatNumber(cvd)}</div>
            <small style="color: #999;">(${result.indicators?.cvdZ?.toFixed(2) || '0.00'}σ)</small>
          </td>
          <td title="Open Interest Change - 持仓量变化">
            <div class="${oiChange >= 0 ? 'positive' : 'negative'}">${this.formatNumber(oiChange)}</div>
            <small style="color: #999;">(${result.indicators?.oiZ?.toFixed(2) || '0.00'}σ)</small>
          </td>
          <td title="Volume - 成交量异常">
            <div>${volume.toFixed(2)}σ</div>
          </td>
          <td>${trendIcon}</td>
          <td class="reason-cell" title="${result.reason}">${this.truncateReason(result.reason)}</td>
          <td>
            <button class="btn-sm btn-danger" onclick="smartMoneyTracker.removeSymbol('${result.symbol}')">
              移除
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  /**
   * 获取动作对应的CSS类名
   */
  getActionClass(action) {
    const classMap = {
      '吸筹': 'accumulate',
      '拉升': 'markup',
      '派发': 'distribution',
      '砸盘': 'markdown',
      '无动作': 'none',
      '观望': 'unknown',
      'ERROR': 'error'
    };
    return classMap[action] || 'unknown';
  }

  /**
   * 获取置信度对应的CSS类名
   */
  getConfidenceClass(confidence) {
    if (confidence >= 0.7) return 'high';
    if (confidence >= 0.5) return 'medium';
    return 'low';
  }

  /**
   * 获取趋势图标
   */
  getTrendIcon(trend) {
    if (!trend) return '-';

    if (trend.aligned) {
      return trend.short === 1 ? '📈↑↑' : '📉↓↓';
    } else {
      return '↔️';
    }
  }

  /**
   * 截断原因文本
   */
  truncateReason(reason) {
    if (!reason) return '-';
    return reason.length > 50 ? reason.substring(0, 50) + '...' : reason;
  }

  /**
   * 添加监控交易对
   */
  async addSymbol() {
    const input = document.getElementById('new-symbol-input');
    const symbol = input.value.trim().toUpperCase();

    if (!symbol) {
      alert('请输入交易对符号');
      return;
    }

    // 验证格式
    if (!symbol.endsWith('USDT')) {
      if (!confirm(`${symbol}不是USDT交易对，确定添加？`)) {
        return;
      }
    }

    try {
      const response = await fetch('/api/v1/smart-money/watch-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol })
      });

      const data = await response.json();

      if (data.success) {
        alert(`✅ 已添加${symbol}到监控列表`);
        input.value = '';
        await this.loadSmartMoneyData(); // 重新加载
      } else {
        alert('添加失败: ' + data.error);
      }
    } catch (error) {
      console.error('[聪明钱] 添加失败:', error);
      alert('添加失败: ' + error.message);
    }
  }

  /**
   * 移除监控交易对
   */
  async removeSymbol(symbol) {
    if (!confirm(`确定移除 ${symbol} 的监控？`)) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/smart-money/watch-list/${symbol}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        console.log(`[聪明钱] 已移除${symbol}`);
        await this.loadSmartMoneyData(); // 重新加载
      } else {
        alert('移除失败: ' + data.error);
      }
    } catch (error) {
      console.error('[聪明钱] 移除失败:', error);
      alert('移除失败: ' + error.message);
    }
  }

  /**
   * 更新最后更新时间
   */
  updateLastUpdateTime(timestamp) {
    const elem = document.getElementById('sm-last-update');
    if (elem) {
      const date = new Date(timestamp);
      const formatted = date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      elem.textContent = `(最后更新: ${formatted})`;
    }
  }

  /**
   * 格式化数字显示（带千分位）
   */
  formatNumber(num) {
    const absNum = Math.abs(num);
    if (absNum >= 1000000) {
      return (num / 1000000).toFixed(2) + 'M';
    } else if (absNum >= 1000) {
      return (num / 1000).toFixed(2) + 'K';
    } else {
      return num.toFixed(2);
    }
  }

  /**
   * 显示错误信息
   */
  showError(message) {
    const tbody = document.getElementById('smart-money-tbody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="11" class="error">
            <i class="icon">⚠️</i> ${message}
          </td>
        </tr>
      `;
    }
  }

  /**
   * 开始自动刷新
   */
  startAutoRefresh() {
    console.log('[聪明钱] 启动自动刷新 (15分钟间隔)');

    // 立即加载一次
    this.loadSmartMoneyData();

    // 停止之前的定时器
    this.stopAutoRefresh();

    // 每15分钟自动刷新
    this.refreshInterval = setInterval(() => {
      console.log('[聪明钱] 自动刷新...');
      this.loadSmartMoneyData();
    }, this.updateIntervalMs);
  }

  /**
   * 停止自动刷新
   */
  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      console.log('[聪明钱] 停止自动刷新');
    }
  }
}

// 全局实例
let smartMoneyTracker;

// 初始化
function initSmartMoneyTracker() {
  smartMoneyTracker = new SmartMoneyTracker();

  // 绑定刷新按钮
  const refreshBtn = document.getElementById('refresh-smart-money-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      smartMoneyTracker.loadSmartMoneyData();
    });
  }

  // 绑定添加按钮
  const addBtn = document.getElementById('add-symbol-btn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      smartMoneyTracker.addSymbol();
    });
  }

  // 回车键添加
  const input = document.getElementById('new-symbol-input');
  if (input) {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        smartMoneyTracker.addSymbol();
      }
    });
  }
}

// DOM加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSmartMoneyTracker);
} else {
  initSmartMoneyTracker();
}

