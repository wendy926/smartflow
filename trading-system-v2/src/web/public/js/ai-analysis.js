/**
 * AI分析前端模块
 * 处理AI市场分析的展示和交互
 */

class AIAnalysisModule {
  constructor() {
    this.apiBase = '/api/v1/ai';
    this.updateInterval = null;
    this.macroUpdateInterval = 60 * 60 * 1000; // 1小时
  }

  /**
   * 初始化模块
   */
  async init() {
    console.log('初始化AI分析模块...');

    // 加载宏观风险分析
    await this.loadMacroRiskAnalysis();

    // 设置定时更新
    this.startAutoUpdate();

    // 绑定事件
    this.bindEvents();

    console.log('AI分析模块初始化完成');
  }

  /**
   * 加载宏观风险分析（BTC和ETH）
   */
  async loadMacroRiskAnalysis() {
    try {
      const response = await fetch(`${this.apiBase}/macro-risk?symbols=BTCUSDT,ETHUSDT`);
      const result = await response.json();

      if (result.success) {
        this.renderMacroRiskAnalysis(result.data);
        this.updateLastUpdateTime(result.lastUpdate);
      } else {
        console.error('加载宏观风险分析失败:', result.error);
        this.showError('宏观风险分析暂时不可用');
      }
    } catch (error) {
      console.error('加载宏观风险分析异常:', error);
      this.showError('AI分析服务异常');
    }
  }

  /**
   * 渲染宏观风险分析
   * @param {Object} data - 分析数据
   */
  renderMacroRiskAnalysis(data) {
    const container = document.getElementById('aiMacroAnalysis');
    if (!container) return;

    let html = '';

    // 渲染BTC分析（使用AI Agent分析数据）
    if (data.BTCUSDT && data.BTCUSDT.analysisData) {
      html += this.renderRiskCard('BTC', data.BTCUSDT);
    }

    // 渲染ETH分析（使用AI Agent分析数据）
    if (data.ETHUSDT && data.ETHUSDT.analysisData) {
      html += this.renderRiskCard('ETH', data.ETHUSDT);
    }

    if (html === '') {
      html = '<p class="no-data">暂无AI分析数据，请等待分析完成...</p>';
    }

    container.innerHTML = html;
  }

  /**
   * 渲染简化的风险监控卡片
   * @param {string} coin - 币种
   * @param {Object} data - 监控数据
   * @param {string} artifactUrl - Artifact链接
   * @returns {string} HTML
   */
  renderSimplifiedRiskCard(coin, data, artifactUrl) {
    const { alertLevel, alertColor, tradingSuggestion, riskWarning, updatedAt } = data;

    // 告警级别颜色映射
    const colorMap = {
      'safe': {
        bg: 'linear-gradient(135deg, #d4edda 0%, #e8f5e9 100%)',
        border: '#28a745',
        text: '#155724',
        icon: '🟢',
        shadow: '0 4px 12px rgba(40, 167, 69, 0.2)'
      },
      'warning': {
        bg: 'linear-gradient(135deg, #fff3cd 0%, #fffbea 100%)',
        border: '#ffc107',
        text: '#856404',
        icon: '🟡',
        shadow: '0 4px 12px rgba(255, 193, 7, 0.2)'
      },
      'danger': {
        bg: 'linear-gradient(135deg, #f8d7da 0%, #fde8ea 100%)',
        border: '#dc3545',
        text: '#721c24',
        icon: '🔴',
        shadow: '0 4px 12px rgba(220, 53, 69, 0.3)'
      },
      'extreme': {
        bg: 'linear-gradient(135deg, #d6d6d6 0%, #e8e8e8 100%)',
        border: '#343a40',
        text: '#1b1e21',
        icon: '⚫',
        shadow: '0 4px 12px rgba(52, 58, 64, 0.3)'
      }
    };

    const colors = colorMap[alertColor] || colorMap['warning'];
    const pulseClass = alertColor === 'danger' || alertColor === 'extreme' ? 'pulse-animation' : '';

    return `
      <div class="monitor-card ${pulseClass}" style="
        background: ${colors.bg};
        border: 2px solid ${colors.border};
        border-radius: 12px;
        padding: 1.5rem;
        box-shadow: ${colors.shadow};
        transition: all 0.3s ease;
      ">
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 2px solid ${colors.border};
        ">
          <h3 style="
            margin: 0;
            font-size: 1.25rem;
            font-weight: 600;
            color: ${colors.text};
            display: flex;
            align-items: center;
            gap: 0.5rem;
          ">
            <span style="font-size: 1.5rem;">${colors.icon}</span>
            ${coin} 市场监控
          </h3>
          <span style="
            background: ${colors.border};
            color: white;
            padding: 0.35rem 1rem;
            border-radius: 20px;
            font-size: 0.9rem;
            font-weight: 600;
            box-shadow: 0 2px 4px rgba(0,0,0,0.15);
          ">
            ${alertLevel}
          </span>
        </div>
        
        <div style="margin: 1rem 0;">
          <div style="margin-bottom: 1rem;">
            <div style="
              display: flex;
              align-items: center;
              gap: 0.5rem;
              margin-bottom: 0.5rem;
            ">
              <strong style="
                font-size: 1rem;
                color: ${colors.text};
                display: flex;
                align-items: center;
                gap: 0.25rem;
              ">
                <span style="font-size: 1.2rem;">📊</span> 交易建议
              </strong>
            </div>
            <p style="
              margin: 0;
              color: #555;
              font-size: 0.95rem;
              line-height: 1.6;
              padding-left: 1.75rem;
            ">${tradingSuggestion}</p>
          </div>
          
          <div>
            <div style="
              display: flex;
              align-items: center;
              gap: 0.5rem;
              margin-bottom: 0.5rem;
            ">
              <strong style="
                font-size: 1rem;
                color: ${colors.text};
                display: flex;
                align-items: center;
                gap: 0.25rem;
              ">
                <span style="font-size: 1.2rem;">⚠️</span> 风险提示
              </strong>
            </div>
            <p style="
              margin: 0;
              color: #555;
              font-size: 0.95rem;
              line-height: 1.6;
              padding-left: 1.75rem;
            ">${riskWarning}</p>
          </div>
        </div>
        
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 1.25rem;
          padding-top: 0.75rem;
          border-top: 1px solid rgba(0,0,0,0.1);
        ">
          <span style="
            font-size: 0.85rem;
            color: #666;
          ">
            更新: ${this.formatTime(updatedAt)}
          </span>
        </div>
      </div>
    `;
  }

  /**
   * 渲染风险分析卡片（旧版，保留以防需要）
   * @param {string} symbol - 币种符号
   * @param {Object} analysis - 分析数据
   * @returns {string} HTML字符串
   */
  renderRiskCard(symbol, analysis) {
    const { riskLevel, analysisData, confidence, updatedAt } = analysis;
    const riskClass = this.getRiskClass(riskLevel);
    const riskBadge = this.getRiskBadge(riskLevel);
    const emoji = symbol === 'BTC' ? '🟠' : '🟣';

    const data = analysisData || {};
    const coreFinding = data.coreFinding || '数据解析中...';
    const currentPrice = data.currentPrice || 0;
    const suggestions = data.suggestions || [];
    const shortTerm = data.shortTermPrediction?.scenarios || [];

    return `
      <div class="ai-risk-card ${riskClass}" data-symbol="${symbol}">
        <div class="ai-card-header">
          <h5>${emoji} ${symbol}风险分析</h5>
          ${riskBadge}
        </div>
        <div class="ai-card-body">
          <div class="risk-summary">
            <p class="core-finding">${coreFinding}</p>
            <div class="confidence-score">置信度: <strong>${confidence || 0}%</strong></div>
          </div>
          <div class="risk-details">
            <div class="detail-row">
              <span class="label">当前价格:</span>
              <span class="value">$${this.formatNumber(currentPrice)}</span>
            </div>
            ${shortTerm.length > 0 ? `
              <div class="detail-row">
                <span class="label">短期预测:</span>
                <div class="value" style="display: flex; flex-direction: column; gap: 0.25rem;">
                  ${shortTerm.map(s => `
                    <span style="font-size: 0.9rem;">
                      ${this.formatScenarioType(s.type)} (${s.probability}%)
                      ${s.priceRange ? `: $${this.formatNumber(s.priceRange[0])} - $${this.formatNumber(s.priceRange[1])}` : ''}
                    </span>
                  `).join('')}
                </div>
              </div>
            ` : ''}
            ${suggestions.length > 0 ? `
              <div class="detail-row">
                <span class="label">操作建议:</span>
                <span class="value">${suggestions[0]}</span>
              </div>
            ` : ''}
          </div>
          <div class="ai-card-footer">
            <span class="update-time">更新于: ${this.formatTime(updatedAt)}</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 获取风险等级CSS类
   * @param {string} level - 风险等级
   * @returns {string}
   */
  getRiskClass(level) {
    const mapping = {
      'SAFE': 'risk-safe',
      'WATCH': 'risk-watch',
      'DANGER': 'risk-danger',
      'EXTREME': 'risk-extreme'
    };
    return mapping[level] || 'risk-watch';
  }

  /**
   * 获取风险等级徽章
   * @param {string} level - 风险等级
   * @returns {string}
   */
  getRiskBadge(level) {
    const badges = {
      'SAFE': '<span class="risk-badge safe">🟢 安全</span>',
      'WATCH': '<span class="risk-badge watch">🟡 观察</span>',
      'DANGER': '<span class="risk-badge danger">🔴 危险</span>',
      'EXTREME': '<span class="risk-badge extreme">⚫ 极度危险</span>'
    };
    return badges[level] || badges.WATCH;
  }

  /**
   * 格式化短期预测
   * @param {Array} scenarios - 预测场景
   * @returns {string}
   */
  formatShortTermPrediction(scenarios) {
    if (!scenarios || scenarios.length === 0) return '--';

    // 找到概率最高的场景
    const topScenario = scenarios.reduce((max, s) =>
      s.probability > max.probability ? s : max, scenarios[0]
    );

    const typeMap = {
      'pullback': '📉 回调',
      'breakout': '📈 突破',
      'sideways': '↔️ 震荡'
    };

    const typeText = typeMap[topScenario.type] || topScenario.type;
    return `${typeText} (${topScenario.probability}%)`;
  }

  /**
   * 显示详细分析弹窗
   * @param {string} symbol - 币种符号
   */
  async showDetailModal(symbol) {
    try {
      const symbolPair = `${symbol}USDT`;
      const response = await fetch(`${this.apiBase}/macro-risk?symbols=${symbolPair}`);
      const result = await response.json();

      if (!result.success || !result.data[symbolPair]) {
        alert('获取详细分析失败');
        return;
      }

      const analysis = result.data[symbolPair];
      const data = analysis.analysisData || {};

      // 构建详细分析HTML
      const modalHTML = `
        <div class="modal-overlay" id="aiDetailModal" onclick="this.remove()">
          <div class="modal-content ai-detail-modal" onclick="event.stopPropagation()">
            <div class="modal-header">
              <h3>${symbol}USDT AI详细分析</h3>
              <button class="modal-close" onclick="document.getElementById('aiDetailModal').remove()">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <div class="modal-body">
              ${this.buildDetailContent(data)}
            </div>
            <div class="modal-footer">
              <button class="btn btn-primary" onclick="document.getElementById('aiDetailModal').remove()">
                关闭
              </button>
            </div>
          </div>
        </div>
      `;

      // 添加到页面
      document.body.insertAdjacentHTML('beforeend', modalHTML);

    } catch (error) {
      console.error('显示详细分析失败:', error);
      alert('获取详细分析失败');
    }
  }

  /**
   * 构建详细分析内容
   * @param {Object} data - 分析数据
   * @returns {string} HTML字符串
   */
  buildDetailContent(data) {
    let html = `
      <div class="ai-detail-content">
        <section class="detail-section">
          <h4>🧩 核心发现</h4>
          <p>${data.coreFinding || '--'}</p>
        </section>
    `;

    // 数据支持
    if (data.dataSupport) {
      html += `
        <section class="detail-section">
          <h4>📊 数据支持</h4>
          <ul class="data-support-list">
            ${data.dataSupport.openInterest ? `<li><strong>持仓量:</strong> ${data.dataSupport.openInterest}</li>` : ''}
            ${data.dataSupport.fundingRate ? `<li><strong>资金费率:</strong> ${data.dataSupport.fundingRate}</li>` : ''}
            ${data.dataSupport.etfFlow ? `<li><strong>ETF流向:</strong> ${data.dataSupport.etfFlow}</li>` : ''}
            ${data.dataSupport.onChainData ? `<li><strong>链上数据:</strong> ${data.dataSupport.onChainData}</li>` : ''}
            ${data.dataSupport.marketStructure ? `<li><strong>市场结构:</strong> ${data.dataSupport.marketStructure}</li>` : ''}
          </ul>
        </section>
      `;
    }

    // 操作建议
    if (data.suggestions && data.suggestions.length > 0) {
      html += `
        <section class="detail-section">
          <h4>💡 操作建议</h4>
          <ol class="suggestions-list">
            ${data.suggestions.map(s => `<li>${s}</li>`).join('')}
          </ol>
        </section>
      `;
    }

    // 短期预测
    if (data.shortTermPrediction && data.shortTermPrediction.scenarios) {
      html += `
        <section class="detail-section">
          <h4>🔮 短期预测 (24-72小时)</h4>
          <div class="prediction-scenarios">
            ${data.shortTermPrediction.scenarios.map(s => `
              <div class="scenario">
                <span class="scenario-type">${this.formatScenarioType(s.type)}</span>
                <span class="scenario-probability">${s.probability}%</span>
                <span class="scenario-range">
                  ${s.priceRange ? `$${this.formatNumber(s.priceRange[0])} - $${this.formatNumber(s.priceRange[1])}` : '--'}
                </span>
              </div>
            `).join('')}
          </div>
        </section>
      `;
    }

    // 中期预测
    if (data.midTermPrediction) {
      html += `
        <section class="detail-section">
          <h4>📅 中期趋势 (7-30天)</h4>
          <p><strong>趋势方向:</strong> ${this.formatTrendDirection(data.midTermPrediction.trend)}</p>
          <p>${data.midTermPrediction.reasoning || '--'}</p>
        </section>
      `;
    }

    html += '</div>';
    return html;
  }

  /**
   * 格式化场景类型
   */
  formatScenarioType(type) {
    const map = {
      'pullback': '📉 回调',
      'breakout': '📈 突破',
      'sideways': '↔️ 震荡'
    };
    return map[type] || type;
  }

  /**
   * 格式化趋势方向
   */
  formatTrendDirection(trend) {
    const map = {
      'up': '📈 上涨',
      'down': '📉 下跌',
      'sideways': '↔️ 横盘'
    };
    return map[trend] || trend;
  }

  /**
   * 加载交易对AI分析
   * @param {string} symbol - 交易对符号
   * @returns {Promise<Object>}
   */
  async loadSymbolAnalysis(symbol) {
    try {
      const response = await fetch(`${this.apiBase}/symbol-analysis?symbol=${symbol}`);
      const result = await response.json();

      if (result.success && result.data) {
        return result.data;
      }
      return null;
    } catch (error) {
      console.error(`加载${symbol}分析失败:`, error);
      return null;
    }
  }

  /**
   * 渲染交易对AI分析单元格
   * @param {Object} analysis - 分析数据
   * @returns {string} HTML字符串
   */
  renderSymbolAnalysisCell(analysis) {
    if (!analysis || !analysis.analysisData) {
      return '<td class="ai-analysis-cell"><span class="no-data">暂无数据</span></td>';
    }

    const data = analysis.analysisData;
    const score = data.overallScore || {};
    const shortTrend = data.shortTermTrend || {};
    const midTrend = data.midTermTrend || {};
    const currentPrice = data.currentPrice || 0;

    const scoreClass = this.getScoreClass(score.totalScore);
    const signalClass = this.getSignalClass(score.signalRecommendation);

    return `
      <td class="ai-analysis-cell">
        <div class="ai-mini-card">
          <div class="price-display" style="
            font-size: 0.85rem;
            color: #007bff;
            font-weight: 600;
            margin-bottom: 0.35rem;
            text-align: center;
          ">
            $${this.formatNumber(currentPrice)}
          </div>
          <div class="trend-score ${scoreClass}">
            <span class="score-label">评分:</span>
            <span class="score-value">${score.totalScore || 0}/100</span>
          </div>
          <div class="strength-signal ${signalClass}">
            ${this.getSignalBadge(score.signalRecommendation)}
          </div>
          <div class="predictions-compact">
            <small>短期: ${this.formatTrendIcon(shortTrend.direction)} (${shortTrend.confidence || 0}%)
              ${shortTrend.priceRange ? `<br>区间: $${this.formatNumber(shortTrend.priceRange[0])}-$${this.formatNumber(shortTrend.priceRange[1])}` : ''}
            </small>
            <small>中期: ${this.formatTrendIcon(midTrend.direction)} (${midTrend.confidence || 0}%)
              ${midTrend.priceRange ? `<br>区间: $${this.formatNumber(midTrend.priceRange[0])}-$${this.formatNumber(midTrend.priceRange[1])}` : ''}
            </small>
          </div>
        </div>
      </td>
    `;
  }

  /**
   * 获取评分CSS类
   */
  getScoreClass(score) {
    if (score >= 75) return 'score-high';
    if (score >= 60) return 'score-medium';
    if (score >= 40) return 'score-low';
    return 'score-very-low';
  }

  /**
   * 获取信号CSS类
   */
  getSignalClass(signal) {
    const mapping = {
      'strongBuy': 'signal-strong-buy',
      'mediumBuy': 'signal-medium-buy',
      'holdBullish': 'signal-hold-bullish',
      'hold': 'signal-hold',
      'holdBearish': 'signal-hold-bearish',
      'caution': 'signal-caution'
    };
    return mapping[signal] || 'signal-hold';
  }

  /**
   * 获取信号徽章
   */
  getSignalBadge(signal) {
    const badges = {
      'strongBuy': '<span class="signal-badge strong-buy">强烈看多</span>',
      'mediumBuy': '<span class="signal-badge medium-buy">看多</span>',
      'holdBullish': '<span class="signal-badge hold-bullish">持有偏多</span>',
      'hold': '<span class="signal-badge hold">持有观望</span>',
      'holdBearish': '<span class="signal-badge hold-bearish">持有偏空</span>',
      'caution': '<span class="signal-badge caution">谨慎</span>'
    };
    return badges[signal] || badges.hold;
  }

  /**
   * 格式化趋势图标
   */
  formatTrendIcon(direction) {
    const icons = {
      'up': '↗️',
      'down': '↘️',
      'sideways': '↔️'
    };
    return icons[direction] || '–';
  }

  /**
   * 格式化数字
   */
  formatNumber(num) {
    if (!num) return '0';
    return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  /**
   * 格式化时间
   */
  formatTime(timestamp) {
    if (!timestamp) return '--';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000 / 60); // 分钟

    if (diff < 1) return '刚刚';
    if (diff < 60) return `${diff}分钟前`;
    if (diff < 60 * 24) return `${Math.floor(diff / 60)}小时前`;
    return date.toLocaleDateString('zh-CN');
  }

  /**
   * 更新最后更新时间
   */
  updateLastUpdateTime(timestamp) {
    const el = document.getElementById('aiLastUpdate');
    if (el) {
      el.textContent = this.formatTime(timestamp);
    }
  }

  /**
   * 显示错误
   */
  showError(message) {
    const container = document.getElementById('aiMacroAnalysis');
    if (container) {
      container.innerHTML = `<p class="error-message">${message}</p>`;
    }
  }

  /**
   * 开始自动更新
   */
  startAutoUpdate() {
    // 每1小时更新一次宏观风险分析
    this.updateInterval = setInterval(() => {
      this.loadMacroRiskAnalysis();
    }, this.macroUpdateInterval);
  }

  /**
   * 停止自动更新
   */
  stopAutoUpdate() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    // 手动刷新按钮
    const refreshBtn = document.getElementById('refreshAIAnalysis');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadMacroRiskAnalysis();
      });
    }

    // 手动触发分析按钮
    const triggerBtn = document.getElementById('triggerAIAnalysis');
    if (triggerBtn) {
      triggerBtn.addEventListener('click', () => {
        this.triggerManualAnalysis();
      });
    }
  }

  /**
   * 手动触发分析
   */
  async triggerManualAnalysis() {
    try {
      const response = await fetch(`${this.apiBase}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'macro_risk' })
      });

      const result = await response.json();

      if (result.success) {
        alert('AI分析已触发，请稍候刷新查看结果');
        // 10秒后自动刷新
        setTimeout(() => {
          this.loadMacroRiskAnalysis();
        }, 10000);
      } else {
        alert(`触发分析失败: ${result.error}`);
      }
    } catch (error) {
      console.error('触发分析失败:', error);
      alert('触发分析失败');
    }
  }

  /**
   * 销毁模块
   */
  destroy() {
    this.stopAutoUpdate();
  }
}

// 创建全局实例（立即创建，不等待DOMContentLoaded）
window.aiAnalysis = new AIAnalysisModule();

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.aiAnalysis.init();
  });
} else {
  // 如果DOM已加载，立即初始化
  window.aiAnalysis.init();
}

// 导出供其他脚本使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.aiAnalysis;
}

