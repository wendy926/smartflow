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
   * 带认证的fetch请求
   */
  async fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('authToken');
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers
    };

    const response = await fetch(url, config);

    if (response.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userInfo');
      window.location.href = '/';
      throw new Error('Unauthorized');
    }

    return response;
  }

  /**
   * 加载聪明钱数据
   */
  async loadSmartMoneyData() {
    try {
      console.log('[聪明钱] 开始加载数据...');

      const response = await this.fetchWithAuth('/api/v1/smart-money/detect');
      const data = await response.json();

      if (data.success) {
        console.log(`[聪明钱] 加载成功: ${data.data ? data.data.length : 0}个交易对`);
        this.updateTable(data.data || []);
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

    // 获取筛选选项
    const showOnlySignals = document.getElementById('smartMoneySignalFilter')?.value === 'signals';

    // 过滤结果（如果选择了只显示有信号的）
    let filteredResults = results;
    if (showOnlySignals) {
      filteredResults = results.filter(result => {
        const action = result.action || '';
        return action !== 'UNKNOWN' &&
          action !== '无动作' &&
          action !== '无信号' &&
          result.stage !== 'neutral';
      });
    }

    if (filteredResults.length === 0) {
      tbody.innerHTML = '<tr><td colspan="11" class="no-data">暂无有信号的交易对</td></tr>';
      return;
    }

    tbody.innerHTML = filteredResults.map(result => {
      // 中英文动作映射（smartmoney.md文档一致）
      const actionMapping = {
        'ACCUMULATE': '吸筹',
        'MARKUP': '拉升',
        'DISTRIBUTION': '派发',
        'MARKDOWN': '砸盘',
        'UNKNOWN': '无信号',
        'ERROR': '错误',
        '吸筹': '吸筹',
        '拉升': '拉升',
        '派发': '派发',
        '砸盘': '砸盘',
        '无动作': '无信号',
        '无信号': '无信号'
      };

      const actionCN = actionMapping[result.action] || result.action;
      const actionClass = this.getActionClass(actionCN);
      const confidenceClass = this.getConfidenceClass(result.confidence);
      const trendIcon = this.getTrendIcon(result.trend);
      const price = result.indicators?.currentPrice || 0;
      const priceChange = result.indicators?.priceDropPct || 0;
      const priceChangeClass = priceChange <= 0 ? 'positive' : 'negative'; // 价格跌幅为负表示上涨

      // 格式化指标显示
      const obi = result.indicators?.obi || 0;
      const cvd = result.indicators?.cvdZ || 0;
      const oiChange = result.indicators?.oiChange || 0;
      const volume = result.indicators?.volRatio || 0;
      const fundingRate = result.indicators?.fundingRate || 0;

      // Trap和Swan标记
      // 聪明钱建仓标识（smartmoney.md行820-826）
      const smartMoneyIndicator = result.isSmartMoney
        ? `<span class="smart-money-badge">
             💰 聪明钱建仓
           </span>`
        : '';

      const trapIndicator = result.trap && result.trap.detected
        ? `<span class="trap-${result.trap.type === 'BULL_TRAP' ? 'bull' : 'bear'}">
             ⚠️ ${result.trap.type === 'BULL_TRAP' ? '诱多' : '诱空'}
             (${result.trap.confidence.toFixed(0)}%)
           </span>`
        : '';

      const swanIndicator = result.swan && result.swan.level !== 'NONE'
        ? `<span style="color:#ef4444; font-weight:bold; margin-left:5px;">
             🦢 ${result.swan.level}
           </span>`
        : '';

      return `
        <tr class="action-${actionClass}">
          <td><strong>${result.symbol}</strong></td>
          <td>
            <div>$${price.toFixed(2)}</div>
            <div class="price-change ${priceChangeClass}">
              ${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(4)}
            </div>
          </td>
          <td>
            <span class="badge badge-${actionClass}">${actionCN}</span>
            ${smartMoneyIndicator}
            ${trapIndicator}
            ${swanIndicator}
          </td>
          <td><span class="badge badge-${confidenceClass}">${(result.confidence * 100).toFixed(0)}%</span></td>
          <td title="Order Book Imbalance - 订单簿失衡">
            <div>${obi.toFixed(2)}</div>
            <small style="color: #999;">(${result.indicators?.obiZ?.toFixed(2) || '0.00'}σ)</small>
          </td>
          <td title="Cumulative Volume Delta - 累计成交量差">
            <div>${cvd.toFixed(2)}σ</div>
            <small style="color: #999;">Z-Score</small>
          </td>
          <td title="Open Interest Change - 持仓量变化">
            <div class="${oiChange >= 0 ? 'positive' : 'negative'}">${oiChange.toFixed(2)}%</div>
            <small style="color: #999;">24h变化</small>
          </td>
          <td title="Volume - 成交量异常">
            <div>${volume.toFixed(2)}x</div>
          </td>
          <td>${trendIcon}</td>
          <td class="reason-cell" title="${result.reasons?.join(', ') || ''}">${this.truncateReason(result.reasons?.join(', ') || '')}</td>
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
      // 英文映射
      'ACCUMULATE': 'accumulate',
      'MARKUP': 'markup',
      'DISTRIBUTION': 'distribution',
      'MARKDOWN': 'markdown',
      'UNKNOWN': 'unknown',
      'ERROR': 'error',
      // 中文映射（smartmoney.md文档一致）
      '吸筹': 'accumulate',
      '拉升': 'markup',
      '派发': 'distribution',
      '砸盘': 'markdown',
      '诱多': 'trap',
      '诱空': 'trap',
      '无信号': 'none',
      '无动作': 'none',
      '观望': 'unknown',
      '错误': 'error'
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

  // 绑定筛选下拉框
  const filterSelect = document.getElementById('smartMoneySignalFilter');
  if (filterSelect) {
    filterSelect.addEventListener('change', () => {
      console.log('[聪明钱] 筛选选项改变，重新加载数据');
      smartMoneyTracker.loadSmartMoneyData();
    });
  }
}

// DOM加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSmartMoneyTracker);
} else {
  initSmartMoneyTracker();
}

