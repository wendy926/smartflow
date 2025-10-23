/**
 * 策略参数调优前端逻辑
 * 支持 ICT 和 V3 策略的激进/保守/平衡三种参数模式
 */

class StrategyParamsManager {
  constructor() {
    this.paramsCache = {};
    this.init();
  }

  init() {
    console.log('[策略参数] 初始化参数管理器');

    // 绑定模式切换事件
    document.querySelectorAll('.mode-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const strategy = e.currentTarget.dataset.strategy;
        const mode = e.currentTarget.dataset.mode;
        this.switchMode(strategy, mode);
      });
    });

    // 加载所有数据
    this.loadAllData();
  }

  async loadAllData() {
    try {
      console.log('[策略参数] 开始加载所有数据...');

      // 并行加载ICT和V3的数据
      await Promise.all([
        this.loadStrategyData('ICT'),
        this.loadStrategyData('V3')
      ]);

      console.log('[策略参数] 所有数据加载完成');
    } catch (error) {
      console.error('[策略参数] 加载数据失败:', error);
      this.showError('加载数据失败: ' + error.message);
    }
  }

  async loadStrategyData(strategy) {
    console.log(`[策略参数] 加载${strategy}策略数据...`);

    try {
      // 并行加载三种模式的参数
      const modes = ['AGGRESSIVE', 'BALANCED', 'CONSERVATIVE'];
      await Promise.all(
        modes.map(mode => this.loadParamsForMode(strategy, mode))
      );

      // 加载回测结果
      await this.loadBacktestResults(strategy);

      // 加载参数历史
      await this.loadParamHistory(strategy);

      console.log(`[策略参数] ${strategy}策略数据加载完成`);
    } catch (error) {
      console.error(`[策略参数] 加载${strategy}策略数据失败:`, error);
    }
  }

  async loadParamsForMode(strategy, mode) {
    const containerId = `${strategy.toLowerCase()}-${mode.toLowerCase()}-params`;
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> 加载参数中...</div>';

    try {
      const response = await fetch(`/api/v1/strategy-params/${strategy}/${mode}`);
      const result = await response.json();

      if (result.success && result.data && result.data.params) {
        // 将嵌套对象转换为扁平数组
        const paramsArray = this.flattenParams(result.data.params, strategy, mode);
        this.renderParams(container, paramsArray);
      } else {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>加载参数失败</p></div>';
      }
    } catch (error) {
      console.error(`[策略参数] 加载${strategy}-${mode}参数失败:`, error);
      container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>加载参数失败</p></div>';
    }
  }

  // 将嵌套的对象转换为扁平数组
  flattenParams(paramsObj, strategy, mode) {
    const paramsArray = [];

    for (const [groupName, groupParams] of Object.entries(paramsObj)) {
      for (const [paramName, paramData] of Object.entries(groupParams)) {
        paramsArray.push({
          strategy_name: strategy,
          strategy_mode: mode,
          param_group: groupName,
          param_name: paramName,
          param_value: paramData.value,
          value: paramData.value,
          value_type: paramData.type,
          value_range: paramData.min !== null && paramData.max !== null ? `${paramData.min} - ${paramData.max}` : '',
          min: paramData.min,
          max: paramData.max,
          unit: paramData.unit,
          description: paramData.description,
          param_description: paramData.description,
          category: paramData.category
        });
      }
    }

    return paramsArray;
  }

  renderParams(container, params) {
    if (!params || params.length === 0) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>暂无参数</p></div>';
      return;
    }

    // 按参数组分组
    const groupedParams = this.groupParams(params);

    let html = '';
    for (const [groupName, groupParams] of Object.entries(groupedParams)) {
      html += `<div class="param-group-section">`;
      html += `<h4 class="param-group-title">${this.getGroupDisplayName(groupName)}</h4>`;

      groupParams.forEach(param => {
        html += this.renderParamCard(param);
      });

      html += `</div>`;
    }

    container.innerHTML = html;

    // 绑定编辑按钮事件
    container.querySelectorAll('.btn-edit-param').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const param = JSON.parse(e.currentTarget.dataset.param);
        this.openEditModal(param);
      });
    });
  }

  renderParamCard(param) {
    // 正确处理值为0或false的情况
    let value = param.param_value !== undefined ? param.param_value : (param.value !== undefined ? param.value : 'N/A');

    const description = param.description || param.param_description || '';
    const unit = param.unit || '';

    // 格式化显示值
    let displayValue;
    if (typeof value === 'boolean') {
      displayValue = value ? '是' : '否';
    } else if (value === 0 || value === '0') {
      displayValue = '0' + (unit ? ` ${unit}` : '');
    } else if (value === null || value === undefined) {
      displayValue = 'N/A';
    } else {
      displayValue = value + (unit ? ` ${unit}` : '');
    }

    return `
      <div class="param-card">
        <div class="param-card-header">
          <div class="param-card-name">${param.param_name}</div>
          <button class="btn-edit-param" data-param='${JSON.stringify(param)}' title="编辑参数">
            <i class="fas fa-edit"></i>
          </button>
        </div>
        <div class="param-card-value">${displayValue}</div>
        ${description ? `<div class="param-card-description">${description}</div>` : ''}
      </div>
    `;
  }

  groupParams(params) {
    const groups = {};

    params.forEach(param => {
      const group = param.param_group || 'other';
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(param);
    });

    return groups;
  }

  getGroupDisplayName(groupName) {
    const groupNames = {
      'trend': '趋势判断',
      'factor': '因子分析',
      'entry': '入场信号',
      'risk': '风险控制',
      'position': '仓位管理',
      'signal': '信号评分',
      'orderblock': '订单块',
      'sweep': '流动性扫荡',
      'engulfing': '吞没形态',
      'harmonic': '谐波形态',
      'volume': '成交量',
      'other': '其他参数'
    };
    return groupNames[groupName] || groupName;
  }

  async loadBacktestResults(strategy) {
    const containerId = `${strategy.toLowerCase()}-backtest-results`;
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
      // 使用新的回测API获取所有模式的结果
      const response = await fetch(`/api/v1/backtest/${strategy}`);
      const result = await response.json();

      if (result.success && result.data) {
        this.renderBacktestResults(container, result.data);
      } else {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>暂无回测数据</p></div>';
      }
    } catch (error) {
      console.error(`[策略参数] 加载${strategy}回测结果失败:`, error);
      container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>加载回测结果失败</p></div>';
    }
  }

  renderBacktestResults(container, results) {
    let html = '';

    // 按模式分组显示结果
    const modes = ['AGGRESSIVE', 'BALANCED', 'CONSERVATIVE'];

    modes.forEach(mode => {
      const result = results.find(r => r.mode === mode);
      const modeClass = mode.toLowerCase();

      if (!result || result.status === 'NO_DATA') {
        html += `
          <div class="backtest-card ${modeClass}">
            <div class="backtest-label">${this.getModeDisplayName(mode)}</div>
            <div class="backtest-value">暂无数据</div>
            <div class="backtest-status">未回测</div>
          </div>
        `;
        return;
      }

      const winRate = result.winRate ? (parseFloat(result.winRate) * 100).toFixed(1) : '0.0';
      const profitLoss = parseFloat(result.profitLoss) || 0;
      const maxDrawdown = result.maxDrawdown ? (parseFloat(result.maxDrawdown) * 100).toFixed(1) : '0.0';
      const totalTrades = parseInt(result.totalTrades) || 0;
      const netProfit = result.netProfit ? parseFloat(result.netProfit) : 0;

      html += `
        <div class="backtest-card ${modeClass}">
          <div class="backtest-label">${this.getModeDisplayName(mode)}</div>
          <div class="backtest-value">${winRate}%</div>
          <div class="backtest-change">胜率</div>
          <div class="backtest-details">
            <div class="detail-row">
              <span class="detail-label">总交易:</span>
              <span class="detail-value">${totalTrades}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">净利润:</span>
              <span class="detail-value ${netProfit >= 0 ? 'positive' : 'negative'}">${netProfit >= 0 ? '+' : ''}${netProfit.toFixed(2)} USDT</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">最大回撤:</span>
              <span class="detail-value">${maxDrawdown}%</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">状态:</span>
              <span class="detail-value status-${result.status.toLowerCase()}">${this.getStatusDisplayName(result.status)}</span>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  /**
   * 获取状态显示名称
   * @param {string} status - 状态
   * @returns {string} 显示名称
   */
  getStatusDisplayName(status) {
    const statusNames = {
      'COMPLETED': '已完成',
      'RUNNING': '运行中',
      'FAILED': '失败',
      'NO_DATA': '无数据'
    };
    return statusNames[status] || status;
  }

  getModeDisplayName(mode) {
    const modeNames = {
      'AGGRESSIVE': '激进模式',
      'BALANCED': '平衡模式',
      'CONSERVATIVE': '保守模式'
    };
    return modeNames[mode] || mode;
  }

  async loadParamHistory(strategy) {
    const containerId = `${strategy.toLowerCase()}-history`;
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
      // 加载三种模式的历史记录
      const modes = ['AGGRESSIVE', 'BALANCED', 'CONSERVATIVE'];
      const histories = await Promise.all(
        modes.map(mode => this.fetchParamHistory(strategy, mode))
      );

      this.renderParamHistory(container, histories);
    } catch (error) {
      console.error(`[策略参数] 加载${strategy}参数历史失败:`, error);
      container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>加载历史记录失败</p></div>';
    }
  }

  async fetchParamHistory(strategy, mode) {
    try {
      const response = await fetch(`/api/v1/strategy-params/${strategy}/${mode}/history`);
      const result = await response.json();
      return {
        mode: mode,
        data: result.success ? result.data : []
      };
    } catch (error) {
      console.error(`[策略参数] 获取${strategy}-${mode}历史记录失败:`, error);
      return { mode: mode, data: [] };
    }
  }

  renderParamHistory(container, histories) {
    // 合并所有模式的历史记录
    const allHistory = [];
    histories.forEach(result => {
      if (result.data && result.data.length > 0) {
        result.data.forEach(item => {
          allHistory.push({
            ...item,
            mode: result.mode
          });
        });
      }
    });

    if (allHistory.length === 0) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>暂无修改历史</p></div>';
      return;
    }

    // 按时间排序（最新的在前）
    allHistory.sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at));

    let html = '<table class="history-table"><thead><tr><th>时间</th><th>模式</th><th>参数名</th><th>修改人</th><th>旧值</th><th>新值</th><th>修改原因</th></tr></thead><tbody>';

    allHistory.forEach(item => {
      const time = new Date(item.changed_at).toLocaleString('zh-CN');
      const mode = this.getModeDisplayName(item.mode);

      html += `
        <tr>
          <td>${time}</td>
          <td><span class="badge badge-${item.mode.toLowerCase()}">${mode}</span></td>
          <td>${item.param_name}</td>
          <td>${item.changed_by || '系统'}</td>
          <td>${item.old_value}</td>
          <td><strong>${item.new_value}</strong></td>
          <td>${item.reason || '-'}</td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  }

  switchMode(strategy, mode) {
    console.log(`[策略参数] 切换到${strategy}策略的${mode}模式`);

    // 更新标签页状态
    document.querySelectorAll(`.mode-tab[data-strategy="${strategy}"]`).forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelector(`.mode-tab[data-strategy="${strategy}"][data-mode="${mode}"]`).classList.add('active');

    // 更新内容显示
    document.querySelectorAll(`.mode-content[data-strategy="${strategy}"]`).forEach(content => {
      content.classList.remove('active');
    });
    document.querySelector(`.mode-content[data-strategy="${strategy}"][data-mode="${mode}"]`).classList.add('active');
  }

  openEditModal(param) {
    console.log('[策略参数] 打开编辑模态框:', param);

    document.getElementById('editStrategyName').value = param.strategy_name;
    document.getElementById('editStrategyMode').value = param.strategy_mode;
    document.getElementById('editParamGroup').value = param.param_group;
    document.getElementById('editParamName').value = param.param_name;
    document.getElementById('editParamDisplayName').value = param.param_name;
    document.getElementById('editCurrentValue').value = param.param_value !== undefined ? param.param_value : (param.value !== undefined ? param.value : 'N/A');
    document.getElementById('editNewValue').value = '';
    document.getElementById('editReason').value = '';
    document.getElementById('editValueRange').textContent = param.value_range || '';

    document.getElementById('editParamModal').style.display = 'block';
  }

  closeEditModal() {
    document.getElementById('editParamModal').style.display = 'none';
  }

  async saveParam() {
    const strategyName = document.getElementById('editStrategyName').value;
    const strategyMode = document.getElementById('editStrategyMode').value;
    const paramGroup = document.getElementById('editParamGroup').value;
    const paramName = document.getElementById('editParamName').value;
    const newValue = document.getElementById('editNewValue').value;
    const reason = document.getElementById('editReason').value;

    if (!newValue || !reason) {
      alert('请填写新值和修改原因');
      return;
    }

    try {
      const response = await fetch(`/api/v1/strategy-params/${strategyName}/${strategyMode}/${paramGroup}/${paramName}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          value: newValue,
          changedBy: 'user',
          reason: reason
        })
      });

      const result = await response.json();

      if (result.success) {
        alert('参数修改成功');
        this.closeEditModal();

        // 重新加载数据
        await this.loadStrategyData(strategyName);
      } else {
        alert('参数修改失败: ' + result.error);
      }
    } catch (error) {
      console.error('[策略参数] 保存参数失败:', error);
      alert('保存参数失败: ' + error.message);
    }
  }

  async runBacktest(strategy) {
    console.log(`[策略参数] 运行${strategy}策略回测`);

    // 从时间框架选择器获取选择的时间框架
    const timeframeSelect = document.getElementById(`${strategy.toLowerCase()}-timeframe`);
    const timeframe = timeframeSelect ? timeframeSelect.value : '1h';

    console.log(`[策略参数] 使用时间框架: ${timeframe}`);

    try {
      // 显示加载状态
      this.showBacktestLoading(strategy);

      // 并行启动三种模式的回测
      const modes = ['AGGRESSIVE', 'BALANCED', 'CONSERVATIVE'];
      const backtestPromises = modes.map(mode =>
        this.startSingleModeBacktest(strategy, mode, timeframe)
      );

      const results = await Promise.allSettled(backtestPromises);

      // 检查结果
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failedCount = results.filter(r => r.status === 'rejected').length;

      if (successCount > 0) {
        alert(`回测任务已启动 (${timeframe}): ${successCount}个模式成功, ${failedCount}个模式失败`);

        // 等待一段时间后重新加载回测结果
        setTimeout(() => {
          this.loadBacktestResults(strategy);
        }, 3000);
      } else {
        alert('所有回测任务启动失败');
      }

    } catch (error) {
      console.error('[策略参数] 运行回测失败:', error);
      alert('运行回测失败: ' + error.message);
    } finally {
      this.hideBacktestLoading(strategy);
    }
  }

  /**
   * 启动单个模式的回测
   * @param {string} strategy - 策略名称
   * @param {string} mode - 策略模式
   * @param {string} timeframe - 时间框架
   * @returns {Promise} 回测结果
   */

  async startSingleModeBacktest(strategy, mode, timeframe = '1h') {
    try {
      const response = await fetch(`/api/v1/backtest/${strategy}/${mode}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          symbols: this.getDefaultSymbols(),
          timeframe: timeframe,
          forceRefresh: false
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log(`[策略参数] ${strategy}-${mode}回测任务已启动 (${timeframe})`);
        return result;
      } else {
        throw new Error(result.error || '回测启动失败');
      }
    } catch (error) {
      console.error(`[策略参数] ${strategy}-${mode}回测启动失败:`, error);
      throw error;
    }
  }

  /**
   * 显示回测加载状态
   * @param {string} strategy - 策略名称
   */
  showBacktestLoading(strategy) {
    const containerId = `${strategy.toLowerCase()}-backtest-results`;
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = `
        <div class="backtest-loading">
          <i class="fas fa-spinner fa-spin"></i>
          <p>正在启动回测任务...</p>
          <div class="loading-progress">
            <div class="progress-bar"></div>
          </div>
        </div>
      `;
    }
  }

  /**
   * 隐藏回测加载状态
   * @param {string} strategy - 策略名称
   */
  hideBacktestLoading(strategy) {
    // 加载状态会在loadBacktestResults中被替换
  }

  /**
   * 获取默认交易对列表
   * @returns {Array<string>} 交易对列表
   */
  getDefaultSymbols() {
    return [
      'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT',
      'SOLUSDT', 'DOTUSDT', 'DOGEUSDT', 'AVAXUSDT', 'SHIBUSDT',
      'MATICUSDT', 'LTCUSDT', 'UNIUSDT'
    ];
  }

  showError(message) {
    console.error('[策略参数] 错误:', message);
    alert(message);
  }
}

// 全局函数
function closeEditModal() {
  window.strategyParamsManager.closeEditModal();
}

function saveParam() {
  window.strategyParamsManager.saveParam();
}

function runBacktest(strategy) {
  window.strategyParamsManager.runBacktest(strategy);
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  console.log('[策略参数] DOM加载完成，初始化管理器');
  window.strategyParamsManager = new StrategyParamsManager();

  // 绑定运行回测按钮事件
  document.querySelectorAll('.btn-run-backtest').forEach(btn => {
    btn.addEventListener('click', () => {
      const strategy = btn.getAttribute('data-strategy');
      if (strategy) {
        window.strategyParamsManager.runBacktest(strategy);
      }
    });
  });
});
