// simulation.js - 模拟交易相关功能

// 启动模拟交易
async function startSimulation(symbol) {
  try {
    const signals = await dataManager.getAllSignals();
    const signalData = signals.find(s => s.symbol === symbol);

    if (!signalData || !signalData.execution || (!signalData.execution.includes('做多_') && !signalData.execution.includes('做空_'))) {
      alert('该交易对当前没有有效的交易信号');
      return;
    }

    const signalType = signalData.execution.includes('做多_') ? 'LONG' : 'SHORT';
    const tradeData = {
      symbol: signalData.symbol,
      entryPrice: signalData.entrySignal,
      stopLoss: signalData.stopLoss,
      takeProfit: signalData.takeProfit,
      signalType: signalType,
      executionMode: signalData.execution
    };

    console.log('🚀 启动模拟交易:', tradeData);
    await app.createSimulation(tradeData);
  } catch (error) {
    console.error('❌ 启动模拟交易失败:', error);
    alert('启动模拟交易失败: ' + error.message);
  }
}

// 查看交易历史
async function viewTradeHistory(symbol) {
  try {
    console.log(`📊 查看交易历史: ${symbol} - 不会更新表格数据`);

    const response = await fetch(`/api/simulation/history/${symbol}`);
    const history = await response.json();

    if (!history || history.length === 0) {
      alert('该交易对暂无交易历史');
      return;
    }

    // 创建历史记录模态框
    const modal = new Modal();
    let historyHtml = `
      <div class="trade-history">
        <h3>📈 ${symbol} 交易历史</h3>
        <div class="history-table-container">
          <table class="history-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>类型</th>
                <th>入场价</th>
                <th>止损价</th>
                <th>止盈价</th>
                <th>状态</th>
                <th>盈亏</th>
              </tr>
            </thead>
            <tbody>
    `;

    history.forEach(record => {
      const createdTime = new Date(record.created_at).toLocaleString('zh-CN');
      const pnl = record.pnl ? (record.pnl > 0 ? `+${record.pnl.toFixed(2)}` : record.pnl.toFixed(2)) : '--';
      const pnlClass = record.pnl > 0 ? 'profit' : record.pnl < 0 ? 'loss' : '';

      historyHtml += `
        <tr class="${pnlClass}">
          <td>${createdTime}</td>
          <td>${record.signal_type}</td>
          <td>${record.entry_price ? record.entry_price.toFixed(4) : '--'}</td>
          <td>${record.stop_loss ? record.stop_loss.toFixed(4) : '--'}</td>
          <td>${record.take_profit ? record.take_profit.toFixed(4) : '--'}</td>
          <td>${record.status}</td>
          <td class="${pnlClass}">${pnl}</td>
        </tr>
      `;
    });

    historyHtml += `
            </tbody>
          </table>
        </div>
        <div class="history-actions">
          <button class="btn secondary" onclick="modal.close()">关闭</button>
        </div>
      </div>
    `;

    modal.show('交易历史', historyHtml);
  } catch (error) {
    console.error('❌ 查看交易历史失败:', error);
    alert('查看交易历史失败: ' + error.message);
  }
}

// 切换历史记录显示
function toggleHistory(symbol) {
  const contentDiv = document.getElementById(`history-content-${symbol}`);
  if (!contentDiv) return;

  if (contentDiv.style.display === 'none' || contentDiv.style.display === '') {
    contentDiv.style.display = 'block';
    loadHistory(symbol);
  } else {
    contentDiv.style.display = 'none';
  }
}

// 加载历史记录
async function loadHistory(symbol) {
  const contentDiv = document.getElementById(`history-content-${symbol}`);
  contentDiv.innerHTML = '<div class="loading-dots">加载中<span>.</span><span>.</span><span>.</span></div>';

  try {
    // 获取信号数据
    const signals = await dataManager.getAllSignals();
    const signalData = signals.find(s => s.symbol === symbol);

    if (!signalData) {
      contentDiv.innerHTML = '<div class="no-data">暂无数据</div>';
      return;
    }

    // 检查是否有入场执行信号
    if (signalData.execution && (signalData.execution.includes('做多_') || signalData.execution.includes('做空_'))) {
      // 有入场执行信号，显示执行详情和模拟交易历史
      await loadExecutionDetails(contentDiv, symbol, signalData);
    } else {
      // 没有入场执行信号，只显示模拟交易历史
      await loadSimulationHistoryOnly(contentDiv, symbol);
    }
  } catch (error) {
    console.error('❌ 加载历史记录失败:', error);
    contentDiv.innerHTML = '<div class="error">加载失败: ' + error.message + '</div>';
  }
}

// 只加载模拟交易历史记录（当没有入场执行信号时）
async function loadSimulationHistoryOnly(contentDiv, symbol) {
  try {
    // 获取该交易对的模拟交易历史
    const response = await fetch(`/api/simulation/history/${symbol}`);
    const history = await response.json();

    if (history.length === 0) {
      contentDiv.innerHTML = `
        <div class="no-data">
          <p>📊 暂无模拟交易记录</p>
          <p class="hint">当出现入场执行信号时，系统会自动创建模拟交易</p>
        </div>
      `;
      return;
    }

    // 构建历史记录HTML
    let historyHtml = `
      <div class="simulation-history">
        <h4>📈 模拟交易历史</h4>
        <div class="history-table-container">
          <table class="history-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>类型</th>
                <th>入场价</th>
                <th>止损价</th>
                <th>止盈价</th>
                <th>状态</th>
                <th>盈亏</th>
              </tr>
            </thead>
            <tbody>
    `;

    history.forEach(record => {
      const createdTime = new Date(record.created_at).toLocaleString('zh-CN');
      const pnl = record.pnl ? (record.pnl > 0 ? `+${record.pnl.toFixed(2)}` : record.pnl.toFixed(2)) : '--';
      const pnlClass = record.pnl > 0 ? 'profit' : record.pnl < 0 ? 'loss' : '';

      historyHtml += `
        <tr class="${pnlClass}">
          <td>${createdTime}</td>
          <td>${record.signal_type}</td>
          <td>${record.entry_price ? record.entry_price.toFixed(4) : '--'}</td>
          <td>${record.stop_loss ? record.stop_loss.toFixed(4) : '--'}</td>
          <td>${record.take_profit ? record.take_profit.toFixed(4) : '--'}</td>
          <td>${record.status}</td>
          <td class="${pnlClass}">${pnl}</td>
        </tr>
      `;
    });

    historyHtml += `
            </tbody>
          </table>
        </div>
      </div>
    `;

    contentDiv.innerHTML = historyHtml;
  } catch (error) {
    console.error('❌ 加载模拟交易历史失败:', error);
    contentDiv.innerHTML = '<div class="error">加载模拟交易历史失败: ' + error.message + '</div>';
  }
}

// 加载交易执行详情和模拟交易历史
async function loadExecutionDetails(contentDiv, symbol, signalData) {
  try {
    // 获取该交易对的模拟交易历史
    const response = await fetch(`/api/simulation/history/${symbol}`);
    const history = await response.json();

    // 构建交易执行详情HTML
    const signalType = signalData.execution.includes('做多_') ? 'LONG' : 'SHORT';
    const signalTypeText = signalType === 'LONG' ? '做多' : '做空';

    let content = `
      <div class="execution-details">
        <h4>🎯 当前交易执行信号</h4>
        <div class="execution-info">
          <div class="info-row">
            <span class="label">交易对:</span>
            <span class="value">${symbol}</span>
          </div>
          <div class="info-row">
            <span class="label">信号类型:</span>
            <span class="value signal-${signalType.toLowerCase()}">${signalTypeText}</span>
          </div>
          <div class="info-row">
            <span class="label">入场价:</span>
            <span class="value">${signalData.entrySignal ? signalData.entrySignal.toFixed(4) : '--'}</span>
          </div>
          <div class="info-row">
            <span class="label">止损价:</span>
            <span class="value">${signalData.stopLoss ? signalData.stopLoss.toFixed(4) : '--'}</span>
          </div>
          <div class="info-row">
            <span class="label">止盈价:</span>
            <span class="value">${signalData.takeProfit ? signalData.takeProfit.toFixed(4) : '--'}</span>
          </div>
          <div class="info-row">
            <span class="label">风险回报比:</span>
            <span class="value">${signalData.riskRewardRatio ? signalData.riskRewardRatio.toFixed(2) : '--'}</span>
          </div>
          <div class="info-row">
            <span class="label">执行模式:</span>
            <span class="value">${signalData.execution}</span>
          </div>
        </div>
        
        <div class="execution-actions">
          <button class="btn primary" onclick="startSimulation('${symbol}')">
            📈 启动模拟交易
          </button>
          <button class="btn secondary" onclick="showSignalDetails('${symbol}')">
            📊 查看信号详情
          </button>
        </div>
    `;

    // 添加模拟交易历史
    if (history.length > 0) {
      content += `
        <div class="simulation-history">
          <h4>📈 模拟交易历史</h4>
          <div class="history-table-container">
            <table class="history-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>类型</th>
                  <th>入场价</th>
                  <th>止损价</th>
                  <th>止盈价</th>
                  <th>状态</th>
                  <th>盈亏</th>
                </tr>
              </thead>
              <tbody>
      `;

      history.forEach(record => {
        const createdTime = new Date(record.created_at).toLocaleString('zh-CN');
        const pnl = record.pnl ? (record.pnl > 0 ? `+${record.pnl.toFixed(2)}` : record.pnl.toFixed(2)) : '--';
        const pnlClass = record.pnl > 0 ? 'profit' : record.pnl < 0 ? 'loss' : '';

        content += `
          <tr class="${pnlClass}">
            <td>${createdTime}</td>
            <td>${record.signal_type}</td>
            <td>${record.entry_price ? record.entry_price.toFixed(4) : '--'}</td>
            <td>${record.stop_loss ? record.stop_loss.toFixed(4) : '--'}</td>
            <td>${record.take_profit ? record.take_profit.toFixed(4) : '--'}</td>
            <td>${record.status}</td>
            <td class="${pnlClass}">${pnl}</td>
          </tr>
        `;
      });

      content += `
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else {
      content += `
        <div class="simulation-history">
          <h4>📈 模拟交易历史</h4>
          <div class="no-data">
            <p>暂无模拟交易记录</p>
            <p class="hint">点击"启动模拟交易"按钮开始模拟交易</p>
          </div>
        </div>
      `;
    }

    content += `</div>`;
    contentDiv.innerHTML = content;
  } catch (error) {
    console.error('❌ 加载执行详情失败:', error);
    contentDiv.innerHTML = '<div class="error">加载执行详情失败: ' + error.message + '</div>';
  }
}

// 加载完整信号详情
async function loadFullSignalDetails(contentDiv, symbol, signalData) {
  try {
    // 获取更详细的信号数据
    const response = await fetch(`/api/signal-details/${symbol}`);
    const details = await response.json();

    let content = `
      <div class="signal-details">
        <h4>📊 ${symbol} 信号详情</h4>
        <div class="details-grid">
          <div class="detail-section">
            <h5>基本信息</h5>
            <div class="info-row">
              <span class="label">交易对:</span>
              <span class="value">${symbol}</span>
            </div>
            <div class="info-row">
              <span class="label">分类:</span>
              <span class="value">${app.getCategoryDisplay(signalData.category)}</span>
            </div>
            <div class="info-row">
              <span class="label">趋势:</span>
              <span class="value trend-${signalData.trend}">${signalData.trend || '--'}</span>
            </div>
            <div class="info-row">
              <span class="label">信号类型:</span>
              <span class="value signal-${signalData.signalType?.toLowerCase()}">${signalData.signalType || '--'}</span>
            </div>
            <div class="info-row">
              <span class="label">信号强度:</span>
              <span class="value strength-${signalData.signalStrength?.toLowerCase()}">${signalData.signalStrength || '--'}</span>
            </div>
          </div>

          <div class="detail-section">
            <h5>技术指标</h5>
            <div class="info-row">
              <span class="label">SMA趋势:</span>
              <span class="value indicator-${signalData.smaTrend ? 'yes' : 'no'}">${signalData.smaTrend ? '✅' : '❌'}</span>
            </div>
            <div class="info-row">
              <span class="label">MA趋势:</span>
              <span class="value indicator-${signalData.maTrend ? 'yes' : 'no'}">${signalData.maTrend ? '✅' : '❌'}</span>
            </div>
            <div class="info-row">
              <span class="label">VWAP趋势:</span>
              <span class="value indicator-${signalData.vwapTrend ? 'yes' : 'no'}">${signalData.vwapTrend ? '✅' : '❌'}</span>
            </div>
            <div class="info-row">
              <span class="label">ADX趋势:</span>
              <span class="value indicator-${signalData.adxTrend ? 'yes' : 'no'}">${signalData.adxTrend ? '✅' : '❌'}</span>
            </div>
            <div class="info-row">
              <span class="label">BBW趋势:</span>
              <span class="value indicator-${signalData.bbwTrend ? 'yes' : 'no'}">${signalData.bbwTrend ? '✅' : '❌'}</span>
            </div>
            <div class="info-row">
              <span class="label">ATR趋势:</span>
              <span class="value indicator-${signalData.atrTrend ? 'yes' : 'no'}">${signalData.atrTrend ? '✅' : '❌'}</span>
            </div>
            <div class="info-row">
              <span class="label">Delta趋势:</span>
              <span class="value indicator-${signalData.deltaTrend ? 'yes' : 'no'}">${signalData.deltaTrend ? '✅' : '❌'}</span>
            </div>
            <div class="info-row">
              <span class="label">OI趋势:</span>
              <span class="value indicator-${signalData.oiTrend ? 'yes' : 'no'}">${signalData.oiTrend ? '✅' : '❌'}</span>
            </div>
            <div class="info-row">
              <span class="label">Funding趋势:</span>
              <span class="value indicator-${signalData.fundingTrend ? 'yes' : 'no'}">${signalData.fundingTrend ? '✅' : '❌'}</span>
            </div>
          </div>

          <div class="detail-section">
            <h5>交易参数</h5>
            <div class="info-row">
              <span class="label">入场价:</span>
              <span class="value">${signalData.entrySignal ? signalData.entrySignal.toFixed(4) : '--'}</span>
            </div>
            <div class="info-row">
              <span class="label">止损价:</span>
              <span class="value">${signalData.stopLoss ? signalData.stopLoss.toFixed(4) : '--'}</span>
            </div>
            <div class="info-row">
              <span class="label">止盈价:</span>
              <span class="value">${signalData.takeProfit ? signalData.takeProfit.toFixed(4) : '--'}</span>
            </div>
            <div class="info-row">
              <span class="label">风险回报比:</span>
              <span class="value">${signalData.riskRewardRatio ? signalData.riskRewardRatio.toFixed(2) : '--'}</span>
            </div>
            <div class="info-row">
              <span class="label">执行模式:</span>
              <span class="value">${signalData.execution || '--'}</span>
            </div>
            <div class="info-row">
              <span class="label">数据收集率:</span>
              <span class="value rate-${app.getDataRateClass(signalData.dataCollectionRate)}">${signalData.dataCollectionRate?.toFixed(1) || 0}%</span>
            </div>
          </div>
        </div>
      </div>
    `;

    contentDiv.innerHTML = content;
  } catch (error) {
    console.error('❌ 加载完整信号详情失败:', error);
    contentDiv.innerHTML = '<div class="error">加载完整信号详情失败: ' + error.message + '</div>';
  }
}

// 显示信号详情
async function showSignalDetails(symbol) {
  try {
    // 获取信号数据
    const signals = await dataManager.getAllSignals();
    const signalData = signals.find(s => s.symbol === symbol);

    if (!signalData) {
      alert('未找到该交易对的信号数据');
      return;
    }

    // 创建信号详情模态框
    const modal = new Modal();
    const contentDiv = document.createElement('div');
    contentDiv.innerHTML = '<div class="loading-dots">加载中<span>.</span><span>.</span><span>.</span></div>';

    modal.show('信号详情', contentDiv.outerHTML);

    // 异步加载完整信号详情
    await loadFullSignalDetails(contentDiv, symbol, signalData);

    // 更新模态框内容
    modal.updateContent(contentDiv.innerHTML);
  } catch (error) {
    console.error('❌ 显示信号详情失败:', error);
    alert('显示信号详情失败: ' + error.message);
  }
}
