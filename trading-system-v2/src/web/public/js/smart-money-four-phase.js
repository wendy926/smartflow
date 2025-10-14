/**
 * 四阶段聪明钱检测前端模块
 * 基于smartmoney.md文档的四阶段状态机展示
 * 
 * 设计原则：
 * 1. 单一职责：专注于四阶段状态展示
 * 2. 响应式设计：适配不同屏幕尺寸
 * 3. 实时更新：支持数据自动刷新
 * 4. 用户友好：直观的视觉反馈
 */

class SmartMoneyFourPhaseModule {
  constructor() {
    this.apiBase = '/api/v1/smart-money-four-phase';
    this.refreshInterval = 30000; // 30秒刷新
    this.refreshTimer = null;
    this.currentData = {};
    this.stageColors = {
      neutral: '#6c757d',
      accumulation: '#28a745',
      markup: '#007bff', 
      distribution: '#ffc107',
      markdown: '#dc3545'
    };
    this.stageNames = {
      neutral: '中性',
      accumulation: '吸筹',
      markup: '拉升',
      distribution: '派发',
      markdown: '砸盘'
    };
  }

  /**
   * 初始化模块
   */
  async init() {
    try {
      console.log('[四阶段聪明钱] 模块初始化开始');
      await this.loadInitialData();
      this.setupEventListeners();
      this.startAutoRefresh();
      console.log('[四阶段聪明钱] 模块初始化完成');
    } catch (error) {
      console.error('[四阶段聪明钱] 初始化失败:', error);
    }
  }

  /**
   * 加载初始数据
   */
  async loadInitialData() {
    try {
      const response = await fetch(`${this.apiBase}/states`);
      const result = await response.json();
      
      if (result.success) {
        this.currentData = result.data;
        this.renderStates();
        this.renderStatistics();
      } else {
        console.error('[四阶段聪明钱] 加载数据失败:', result.error);
      }
    } catch (error) {
      console.error('[四阶段聪明钱] 加载初始数据异常:', error);
    }
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // 刷新按钮
    const refreshBtn = document.getElementById('fourPhaseRefreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshData());
    }

    // 参数配置按钮
    const configBtn = document.getElementById('fourPhaseConfigBtn');
    if (configBtn) {
      configBtn.addEventListener('click', () => this.showParameterConfig());
    }

    // 重置按钮
    const resetBtn = document.getElementById('fourPhaseResetBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetAllStates());
    }
  }

  /**
   * 开始自动刷新
   */
  startAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    
    this.refreshTimer = setInterval(() => {
      this.refreshData();
    }, this.refreshInterval);
  }

  /**
   * 停止自动刷新
   */
  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * 刷新数据
   */
  async refreshData() {
    try {
      const refreshBtn = document.getElementById('fourPhaseRefreshBtn');
      if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.textContent = '刷新中...';
      }

      await this.loadInitialData();
      
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.textContent = '刷新';
      }
    } catch (error) {
      console.error('[四阶段聪明钱] 刷新数据失败:', error);
      const refreshBtn = document.getElementById('fourPhaseRefreshBtn');
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.textContent = '刷新';
      }
    }
  }

  /**
   * 渲染状态表格
   */
  renderStates() {
    const container = document.getElementById('fourPhaseStatesContainer');
    if (!container) return;

    const symbols = Object.keys(this.currentData);
    if (symbols.length === 0) {
      container.innerHTML = '<div class="alert alert-info">暂无数据</div>';
      return;
    }

    const table = `
      <div class="table-responsive">
        <table class="table table-striped table-hover">
          <thead class="table-dark">
            <tr>
              <th>交易对</th>
              <th>当前阶段</th>
              <th>置信度</th>
              <th>持续时间</th>
              <th>触发原因</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${symbols.map(symbol => this.renderStateRow(symbol, this.currentData[symbol]))}
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = table;
  }

  /**
   * 渲染单个状态行
   */
  renderStateRow(symbol, state) {
    const duration = this.formatDuration(state.duration);
    const confidence = (state.confidence * 100).toFixed(1);
    const stageColor = this.stageColors[state.stage] || '#6c757d';
    const stageName = this.stageNames[state.stage] || '未知';

    const reasons = state.reasons && state.reasons.length > 0 
      ? state.reasons.join(', ') 
      : '无';

    return `
      <tr>
        <td>
          <strong>${symbol}</strong>
        </td>
        <td>
          <span class="badge" style="background-color: ${stageColor}; color: white;">
            ${stageName}
          </span>
        </td>
        <td>
          <div class="progress" style="height: 20px;">
            <div class="progress-bar" role="progressbar" 
                 style="width: ${confidence}%; background-color: ${stageColor};"
                 aria-valuenow="${confidence}" aria-valuemin="0" aria-valuemax="100">
              ${confidence}%
            </div>
          </div>
        </td>
        <td>
          <small class="text-muted">${duration}</small>
        </td>
        <td>
          <small class="text-muted" title="${reasons}">${reasons}</small>
        </td>
        <td>
          <button class="btn btn-sm btn-outline-primary" 
                  onclick="smartMoneyFourPhase.showSymbolDetails('${symbol}')">
            详情
          </button>
          <button class="btn btn-sm btn-outline-warning" 
                  onclick="smartMoneyFourPhase.resetSymbolState('${symbol}')">
            重置
          </button>
        </td>
      </tr>
    `;
  }

  /**
   * 渲染统计信息
   */
  async renderStatistics() {
    try {
      const response = await fetch(`${this.apiBase}/statistics`);
      const result = await response.json();
      
      if (!result.success) return;

      const stats = result.data;
      const container = document.getElementById('fourPhaseStatsContainer');
      if (!container) return;

      const statsHtml = `
        <div class="row">
          <div class="col-md-3">
            <div class="card text-center">
              <div class="card-body">
                <h5 class="card-title">${stats.totalSymbols}</h5>
                <p class="card-text">监控交易对</p>
              </div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="card text-center">
              <div class="card-body">
                <h5 class="card-title" style="color: ${this.stageColors.accumulation}">
                  ${stats.stageCounts.accumulation || 0}
                </h5>
                <p class="card-text">吸筹阶段</p>
              </div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="card text-center">
              <div class="card-body">
                <h5 class="card-title" style="color: ${this.stageColors.markup}">
                  ${stats.stageCounts.markup || 0}
                </h5>
                <p class="card-text">拉升阶段</p>
              </div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="card text-center">
              <div class="card-body">
                <h5 class="card-title" style="color: ${this.stageColors.distribution}">
                  ${stats.stageCounts.distribution || 0}
                </h5>
                <p class="card-text">派发阶段</p>
              </div>
            </div>
          </div>
        </div>
        <div class="row mt-3">
          <div class="col-md-6">
            <div class="card text-center">
              <div class="card-body">
                <h5 class="card-title" style="color: ${this.stageColors.markdown}">
                  ${stats.stageCounts.markdown || 0}
                </h5>
                <p class="card-text">砸盘阶段</p>
              </div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="card text-center">
              <div class="card-body">
                <h5 class="card-title">
                  ${(stats.averageConfidence * 100).toFixed(1)}%
                </h5>
                <p class="card-text">平均置信度</p>
              </div>
            </div>
          </div>
        </div>
      `;

      container.innerHTML = statsHtml;
    } catch (error) {
      console.error('[四阶段聪明钱] 渲染统计信息失败:', error);
    }
  }

  /**
   * 显示交易对详情
   */
  async showSymbolDetails(symbol) {
    try {
      const response = await fetch(`${this.apiBase}/${symbol}`);
      const result = await response.json();
      
      if (!result.success) {
        alert(`获取${symbol}详情失败: ${result.error}`);
        return;
      }

      const data = result.data;
      const modal = this.createDetailsModal(symbol, data);
      
      // 显示模态框
      document.body.appendChild(modal);
      const bsModal = new bootstrap.Modal(modal);
      bsModal.show();
      
      // 模态框关闭时移除DOM元素
      modal.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modal);
      });
    } catch (error) {
      console.error(`[四阶段聪明钱] 获取${symbol}详情失败:`, error);
      alert(`获取${symbol}详情失败: ${error.message}`);
    }
  }

  /**
   * 创建详情模态框
   */
  createDetailsModal(symbol, data) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${symbol} 四阶段详情</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="row">
              <div class="col-md-6">
                <h6>当前状态</h6>
                <p><strong>阶段:</strong> 
                  <span class="badge" style="background-color: ${this.stageColors[data.stage]}">
                    ${data.action}
                  </span>
                </p>
                <p><strong>置信度:</strong> ${(data.confidence * 100).toFixed(1)}%</p>
                <p><strong>触发原因:</strong> ${data.reasons ? data.reasons.join(', ') : '无'}</p>
              </div>
              <div class="col-md-6">
                <h6>各阶段得分</h6>
                <p><strong>吸筹:</strong> ${data.scores.accScore || 0}</p>
                <p><strong>拉升:</strong> ${data.scores.markupScore || 0}</p>
                <p><strong>派发:</strong> ${data.scores.distScore || 0}</p>
                <p><strong>砸盘:</strong> ${data.scores.markdnScore || 0}</p>
              </div>
            </div>
            <hr>
            <div class="row">
              <div class="col-md-6">
                <h6>技术指标</h6>
                <p><strong>OBI:</strong> ${data.indicators.obi?.toFixed(2) || 'N/A'}</p>
                <p><strong>OBI Z-Score:</strong> ${data.indicators.obiZ?.toFixed(2) || 'N/A'}</p>
                <p><strong>CVD Z-Score:</strong> ${data.indicators.cvdZ?.toFixed(2) || 'N/A'}</p>
                <p><strong>成交量比率:</strong> ${data.indicators.volRatio?.toFixed(2) || 'N/A'}</p>
              </div>
              <div class="col-md-6">
                <h6>市场数据</h6>
                <p><strong>15分钟Delta:</strong> ${data.indicators.delta15?.toFixed(4) || 'N/A'}</p>
                <p><strong>价格跌幅:</strong> ${data.indicators.priceDropPct?.toFixed(2) || 'N/A'}%</p>
                <p><strong>大额挂单:</strong> ${data.largeOrdersCount || 0}个</p>
                <p><strong>更新时间:</strong> ${new Date(data.timestamp).toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
            <button type="button" class="btn btn-warning" onclick="smartMoneyFourPhase.resetSymbolState('${symbol}')">重置状态</button>
          </div>
        </div>
      </div>
    `;
    
    return modal;
  }

  /**
   * 重置交易对状态
   */
  async resetSymbolState(symbol) {
    if (!confirm(`确定要重置 ${symbol} 的状态吗？`)) {
      return;
    }

    try {
      const response = await fetch(`${this.apiBase}/${symbol}/reset`, {
        method: 'POST'
      });
      const result = await response.json();
      
      if (result.success) {
        alert(`${symbol} 状态已重置`);
        this.refreshData();
      } else {
        alert(`重置失败: ${result.error}`);
      }
    } catch (error) {
      console.error(`[四阶段聪明钱] 重置${symbol}状态失败:`, error);
      alert(`重置失败: ${error.message}`);
    }
  }

  /**
   * 重置所有状态
   */
  async resetAllStates() {
    if (!confirm('确定要重置所有交易对的状态吗？')) {
      return;
    }

    try {
      const symbols = Object.keys(this.currentData);
      let successCount = 0;
      
      for (const symbol of symbols) {
        try {
          const response = await fetch(`${this.apiBase}/${symbol}/reset`, {
            method: 'POST'
          });
          const result = await response.json();
          
          if (result.success) {
            successCount++;
          }
        } catch (error) {
          console.error(`[四阶段聪明钱] 重置${symbol}失败:`, error);
        }
      }
      
      alert(`已重置 ${successCount}/${symbols.length} 个交易对的状态`);
      this.refreshData();
    } catch (error) {
      console.error('[四阶段聪明钱] 批量重置失败:', error);
      alert(`批量重置失败: ${error.message}`);
    }
  }

  /**
   * 显示参数配置
   */
  async showParameterConfig() {
    // 这里可以实现参数配置界面
    alert('参数配置功能开发中...');
  }

  /**
   * 格式化持续时间
   */
  formatDuration(ms) {
    if (!ms) return '0秒';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}天${hours % 24}小时`;
    if (hours > 0) return `${hours}小时${minutes % 60}分钟`;
    if (minutes > 0) return `${minutes}分钟${seconds % 60}秒`;
    return `${seconds}秒`;
  }

  /**
   * 销毁模块
   */
  destroy() {
    this.stopAutoRefresh();
  }
}

// 创建全局实例
window.smartMoneyFourPhase = new SmartMoneyFourPhaseModule();
