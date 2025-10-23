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

      if (result.success && result.data) {
        this.renderParams(container, result.data);
      } else {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>加载参数失败</p></div>';
      }
    } catch (error) {
      console.error(`[策略参数] 加载${strategy}-${mode}参数失败:`, error);
      container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>加载参数失败</p></div>';
    }
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
    const value = param.param_value || param.value || 'N/A';
    const description = param.description || param.param_description || '';

    return `
      <div class="param-card">
        <div class="param-card-header">
          <div class="param-card-name">${param.param_name}</div>
          <button class="btn-edit-param" data-param='${JSON.stringify(param)}' title="编辑参数">
            <i class="fas fa-edit"></i>
          </button>
        </div>
        <div class="param-card-value">${value}</div>
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
      'other': '其他参数'
    };
    return groupNames[groupName] || groupName;
  }

  async loadBacktestResults(strategy) {
    const containerId = `${strategy.toLowerCase()}-backtest-results`;
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
      // 加载三种模式的回测结果
      const modes = ['AGGRESSIVE', 'BALANCED', 'CONSERVATIVE'];
      const results = await Promise.all(
        modes.map(mode => this.fetchBacktestResult(strategy, mode))
      );

      this.renderBacktestResults(container, results);
    } catch (error) {
      console.error(`[策略参数] 加载${strategy}回测结果失败:`, error);
      container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>加载回测结果失败</p></div>';
    }
  }

  async fetchBacktestResult(strategy, mode) {
    try {
      const response = await fetch(`/api/v1/strategy-params/${strategy}/${mode}/backtest`);
      const result = await response.json();
      return {
        mode: mode,
        data: result.success ? result.data : null
      };
    } catch (error) {
      console.error(`[策略参数] 获取${strategy}-${mode}回测结果失败:`, error);
      return { mode: mode, data: null };
    }
  }

  renderBacktestResults(container, results) {
    let html = '';

    results.forEach(result => {
      const data = result.data;
      const modeClass = result.mode.toLowerCase();

      if (!data) {
        html += `
          <div class="backtest-card ${modeClass}">
            <div class="backtest-label">${this.getModeDisplayName(result.mode)}</div>
            <div class="backtest-value">暂无数据</div>
          </div>
        `;
        return;
      }

      const winRate = (data.winRate * 100).toFixed(1);
      const profitLoss = data.profitLoss || 0;
      const maxDrawdown = (data.maxDrawdown * 100).toFixed(1);

      html += `
        <div class="backtest-card ${modeClass}">
          <div class="backtest-label">${this.getModeDisplayName(result.mode)}</div>
          <div class="backtest-value">${winRate}%</div>
          <div class="backtest-change">胜率</div>
          <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.2);">
            <div style="font-size: 14px; margin-bottom: 5px;">盈亏: ${profitLoss > 0 ? '+' : ''}${profitLoss.toFixed(2)} USDT</div>
            <div style="font-size: 14px;">最大回撤: ${maxDrawdown}%</div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
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
    document.getElementById('editCurrentValue').value = param.param_value || param.value;
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

    try {
      const response = await fetch(`/api/v1/strategy-params/${strategy}/backtest`, {
        method: 'POST'
      });

      const result = await response.json();

      if (result.success) {
        alert('回测任务已启动');

        // 等待一段时间后重新加载回测结果
        setTimeout(() => {
          this.loadBacktestResults(strategy);
        }, 2000);
      } else {
        alert('启动回测失败: ' + result.error);
      }
    } catch (error) {
      console.error('[策略参数] 运行回测失败:', error);
      alert('运行回测失败: ' + error.message);
    }
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
});

