/**
 * SmartFlow 交易策略系统前端应用
 * 提供交互功能和数据管理
 */

class SmartFlowApp {
  constructor() {
    this.apiBaseUrl = '/api/v1';
    this.currentTab = 'dashboard';
    this.currentStrategy = 'v3';
    this.refreshInterval = null;
    this.maxLossAmount = 100; // 默认最大损失金额100 USDT
    this.init();
    this.initRouting();
  }

  /**
   * 初始化路由
   */
  initRouting() {
    // 监听URL变化
    window.addEventListener('popstate', (event) => {
      this.handleRouteChange();
    });

    // 监听导航链接点击
    document.addEventListener('click', (event) => {
      if (event.target.closest('.nav-link')) {
        event.preventDefault();
        const href = event.target.closest('.nav-link').getAttribute('href');
        if (href && href.startsWith('/')) {
          this.navigateTo(href);
        }
      }
    });

    // 初始化当前路由
    this.handleRouteChange();
  }

  /**
   * 处理路由变化
   */
  handleRouteChange() {
    const path = window.location.pathname;
    const tabMap = {
      '/dashboard': 'dashboard',
      '/strategies': 'strategies',
      '/monitoring': 'monitoring',
      '/statistics': 'statistics',
      '/tools': 'tools'
    };

    const tab = tabMap[path] || 'dashboard';
    this.switchTab(tab);
  }

  /**
   * 导航到指定路径
   * @param {string} path - 目标路径
   */
  navigateTo(path) {
    window.history.pushState({}, '', path);
    this.handleRouteChange();
  }

  /**
   * 初始化应用
   */
  async init() {
    this.setupEventListeners();
    await this.loadMaxLossAmount(); // 加载最大损失金额设置
    this.loadInitialData();
    this.startAutoRefresh();
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // 导航标签页切换已在initRouting中处理

    // 策略标签页切换
    document.querySelectorAll('.strategy-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const strategy = tab.getAttribute('data-strategy');
        this.switchStrategy(strategy);
      });
    });

    // 统计筛选器
    const strategySelect = document.getElementById('strategySelect');
    const timeframeSelect = document.getElementById('timeframeSelect');

    if (strategySelect) {
      strategySelect.addEventListener('change', () => {
        this.loadStatistics();
      });
    }

    if (timeframeSelect) {
      timeframeSelect.addEventListener('change', () => {
        this.loadStatistics();
      });
    }

    // 策略状态刷新按钮
    const refreshStrategyStatusBtn = document.getElementById('refreshStrategyStatus');
    if (refreshStrategyStatusBtn) {
      refreshStrategyStatusBtn.addEventListener('click', () => {
        this.loadStrategyCurrentStatus();
      });
    }

    // 最大损失金额选择器
    const maxLossAmountSelect = document.getElementById('maxLossAmount');
    if (maxLossAmountSelect) {
      maxLossAmountSelect.addEventListener('change', (e) => {
        this.maxLossAmount = parseInt(e.target.value);
        this.saveMaxLossAmount();
        this.refreshStrategyStatusTable();
      });
    }
  }

  /**
   * 切换标签页
   * @param {string} tabName - 标签页名称
   */
  switchTab(tabName) {
    // 更新导航状态
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // 更新内容显示
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');

    this.currentTab = tabName;

    // 更新URL（如果当前URL不匹配）
    const pathMap = {
      'dashboard': '/dashboard',
      'strategies': '/strategies',
      'monitoring': '/monitoring',
      'statistics': '/statistics',
      'tools': '/tools'
    };
    const expectedPath = pathMap[tabName];
    if (expectedPath && window.location.pathname !== expectedPath) {
      window.history.pushState({}, '', expectedPath);
    }

    // 根据标签页加载相应数据
    switch (tabName) {
      case 'dashboard':
        this.loadDashboardData();
        break;
      case 'strategies':
        this.loadStrategyData();
        break;
      case 'monitoring':
        this.loadMonitoringData();
        break;
      case 'statistics':
        this.loadStatistics();
        break;
      case 'tools':
        this.loadToolsData();
        break;
    }
  }

  /**
   * 切换策略
   * @param {string} strategyName - 策略名称
   */
  switchStrategy(strategyName) {
    // 更新策略标签状态
    document.querySelectorAll('.strategy-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelector(`[data-strategy="${strategyName}"]`).classList.add('active');

    // 更新策略面板显示
    document.querySelectorAll('.strategy-panel').forEach(panel => {
      panel.classList.remove('active');
    });
    document.getElementById(`${strategyName}-content`).classList.add('active');

    this.currentStrategy = strategyName;
    this.loadStrategyData();
  }

  /**
   * 加载初始数据
   */
  async loadInitialData() {
    await this.loadDashboardData();
    this.updateLastUpdateTime();
  }

  /**
   * 加载仪表板数据
   */
  async loadDashboardData() {
    try {
      // 加载交易对数据
      const symbols = await this.fetchData('/symbols');
      await this.renderSymbolsTable(symbols.data || []);

      // 加载策略数据
      await this.loadStrategySignals();

      // 加载策略统计
      await this.loadStrategyStatistics();

      // 加载策略当前状态
      await this.loadStrategyCurrentStatus();
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.showError('加载仪表板数据失败');
    }
  }

  /**
   * 加载策略信号 - 已移除策略卡片，此方法不再需要
   */
  async loadStrategySignals() {
    // 策略卡片已移除，此方法保留为空以避免错误
    console.log('Strategy cards removed, skipping signal loading');
  }

  /**
   * 获取模拟信号数据
   * @param {string} strategy - 策略名称
   * @returns {Object} 模拟信号数据
   */
  getMockSignal(strategy) {
    const mockSignals = {
      v3: {
        signal: 'BUY',
        trend: 'UP',
        score: 85,
        confidence: 0.8
      },
      ict: {
        signal: 'SELL',
        trend: 'DOWN',
        score: 72,
        confidence: 0.7
      }
    };
    return mockSignals[strategy] || { signal: 'HOLD', trend: 'RANGE', score: 50, confidence: 0.5 };
  }

  /**
   * 更新策略卡片 - 已移除策略卡片，此方法不再需要
   * @param {Object} signals - 策略信号数据
   */
  updateStrategyCards(signals) {
    // 策略卡片已移除，此方法保留为空以避免错误
    console.log('Strategy cards removed, skipping card updates');
  }

  /**
   * 加载策略统计信息
   */
  async loadStrategyStatistics() {
    try {
      const response = await this.fetchData('/strategies/statistics');
      const stats = response.data;

      // 更新V3策略统计
      this.updateStrategyStats('v3', stats.v3);

      // 更新ICT策略统计
      this.updateStrategyStats('ict', stats.ict);

      // 更新总体统计
      this.updateOverallStats(stats.overall);
    } catch (error) {
      console.error('Error loading strategy statistics:', error);
      // 使用模拟数据作为后备
      this.updateStrategyStats('v3', { totalTrades: 0, profitableTrades: 0, losingTrades: 0, winRate: 0, totalPnl: 0, maxDrawdown: 0 });
      this.updateStrategyStats('ict', { totalTrades: 0, profitableTrades: 0, losingTrades: 0, winRate: 0, totalPnl: 0, maxDrawdown: 0 });
      this.updateOverallStats({ totalTrades: 0, winRate: 0, totalPnl: 0, maxDrawdown: 0 });
    }
  }

  /**
   * 更新策略统计显示
   * @param {string} strategy - 策略名称
   * @param {Object} stats - 统计数据
   */
  updateStrategyStats(strategy, stats) {
    const strategyElement = document.getElementById(`${strategy}-stats`);
    if (!strategyElement) return;

    // 更新交易次数
    const totalTradesElement = strategyElement.querySelector('.total-trades');
    if (totalTradesElement) {
      totalTradesElement.textContent = stats.totalTrades || 0;
    }

    // 更新盈利交易数
    const profitableTradesElement = strategyElement.querySelector('.profitable-trades');
    if (profitableTradesElement) {
      profitableTradesElement.textContent = stats.profitableTrades || 0;
    }

    // 更新亏损交易数
    const losingTradesElement = strategyElement.querySelector('.losing-trades');
    if (losingTradesElement) {
      losingTradesElement.textContent = stats.losingTrades || 0;
    }

    // 更新胜率
    const winRateElement = strategyElement.querySelector('.win-rate');
    if (winRateElement) {
      winRateElement.textContent = `${stats.winRate || 0}%`;
    }

    // 更新总盈亏
    const totalPnlElement = strategyElement.querySelector('.total-pnl');
    if (totalPnlElement) {
      const pnl = stats.totalPnl || 0;
      totalPnlElement.textContent = pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;
      totalPnlElement.className = `total-pnl ${pnl >= 0 ? 'positive' : 'negative'}`;
    }

    // 更新最大回撤
    const maxDrawdownElement = strategyElement.querySelector('.max-drawdown');
    if (maxDrawdownElement) {
      maxDrawdownElement.textContent = `-${stats.maxDrawdown || 0}%`;
    }
  }

  /**
   * 更新总体统计显示
   * @param {Object} stats - 总体统计数据
   */
  updateOverallStats(stats) {
    // 更新总交易数
    const totalTradesElement = document.getElementById('overall-total-trades');
    if (totalTradesElement) {
      totalTradesElement.textContent = stats.totalTrades || 0;
    }

    // 更新总胜率
    const winRateElement = document.getElementById('overall-win-rate');
    if (winRateElement) {
      const winRate = stats.winRate || 0;
      winRateElement.textContent = `${winRate}%`;
      winRateElement.className = `stat-value ${winRate >= 50 ? 'stat-positive' : 'stat-negative'}`;
    }

    // 更新总盈亏
    const totalPnlElement = document.getElementById('overall-total-pnl');
    if (totalPnlElement) {
      const pnl = stats.totalPnl || 0;
      totalPnlElement.textContent = pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;
      totalPnlElement.className = `stat-value ${pnl >= 0 ? 'stat-positive' : 'stat-negative'}`;
    }

    // 更新最大回撤
    const maxDrawdownElement = document.getElementById('overall-max-drawdown');
    if (maxDrawdownElement) {
      maxDrawdownElement.textContent = `-${stats.maxDrawdown || 0}%`;
      maxDrawdownElement.className = 'stat-value stat-negative';
    }
  }

  /**
   * 加载策略当前状态
   */
  async loadStrategyCurrentStatus() {
    try {
      const response = await this.fetchData('/strategies/current-status?limit=10');
      const statusData = response.data;

      // 加载交易记录数据
      const tradesResponse = await this.fetchData('/trades?limit=100');
      const tradesData = tradesResponse.data || [];

      // 更新策略状态表格
      this.updateStrategyStatusTable(statusData, tradesData);
    } catch (error) {
      console.error('Error loading strategy current status:', error);
      // 使用空数据作为后备
      this.updateStrategyStatusTable([], []);
    }
  }

  /**
   * 更新策略状态表格
   * @param {Array} statusData - 状态数据
   * @param {Array} tradesData - 交易记录数据
   */
  updateStrategyStatusTable(statusData, tradesData = []) {
    const tbody = document.getElementById('strategyStatusTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (statusData.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="12" style="text-align: center; color: #6c757d; padding: 2rem;">
            暂无策略状态数据
          </td>
        </tr>
      `;
      return;
    }

    // 创建交易记录映射，按symbol和strategy_name分组
    const tradesMap = {};
    tradesData.forEach(trade => {
      const key = `${trade.symbol}_${trade.strategy_name}`;
      if (!tradesMap[key] || trade.status === 'OPEN') {
        tradesMap[key] = trade;
      }
    });

    statusData.forEach(item => {
      // V3策略行
      const v3Info = item.v3 || {};
      const v3Trend = v3Info.timeframes?.['4H']?.trend || 'RANGE';
      const v3Signal = v3Info.signal || 'HOLD';

      // 检查是否有V3策略的交易记录
      const v3Trade = tradesMap[`${item.symbol}_V3`];
      const v3SignalText = v3Trade ? '入场' : '观望';

      // 优先使用交易记录数据，否则使用实时计算数据
      const v3EntryPrice = v3Trade ? parseFloat(v3Trade.entry_price) : (v3Info.entryPrice || 0);
      const v3StopLoss = v3Trade ? parseFloat(v3Trade.stop_loss) : (v3Info.stopLoss || 0);
      const v3TakeProfit = v3Trade ? parseFloat(v3Trade.take_profit) : (v3Info.takeProfit || 0);
      const v3Leverage = v3Trade ? parseFloat(v3Trade.leverage) : (v3Info.leverage || 0);
      const v3Margin = v3Trade ? parseFloat(v3Trade.margin_used) : (v3Info.margin || 0);

      const v3Row = document.createElement('tr');
      v3Row.innerHTML = `
        <td>${item.symbol}</td>
        <td>${item.lastPrice ? parseFloat(item.lastPrice).toFixed(4) : '--'}</td>
        <td><span class="strategy-badge v3">V3</span></td>
        <td><span class="trend-value trend-${v3Trend.toLowerCase()}">${this.getTrendText(v3Trend)}</span></td>
        <td><span class="signal-value signal-${v3SignalText === '入场' ? 'entry' : 'watch'}">${v3SignalText}</span></td>
        <td class="timeframe-cell">${this.formatHighTimeframe(v3Info, 'V3')}</td>
        <td class="timeframe-cell">${this.formatMidTimeframe(v3Info, 'V3')}</td>
        <td class="timeframe-cell">${this.formatLowTimeframe(v3Info, 'V3')}</td>
        <td class="price-cell">${this.formatPrice(v3EntryPrice)}</td>
        <td class="price-cell">${this.formatPrice(v3StopLoss)}</td>
        <td class="price-cell">${this.formatPrice(v3TakeProfit)}</td>
        <td class="leverage-cell">${this.formatLeverage({ entryPrice: v3EntryPrice, stopLoss: v3StopLoss })}</td>
        <td class="margin-cell">${this.formatMargin({ entryPrice: v3EntryPrice, stopLoss: v3StopLoss, positionSize: v3Margin })}</td>
      `;
      tbody.appendChild(v3Row);

      // ICT策略行
      const ictInfo = item.ict || {};
      const ictTrend = ictInfo.timeframes?.['1D']?.trend || 'RANGE';
      const ictSignal = ictInfo.signal || 'HOLD';

      // 检查是否有ICT策略的交易记录
      const ictTrade = tradesMap[`${item.symbol}_ICT`];
      const ictSignalText = ictTrade ? '入场' : (ictSignal === 'BUY' || ictSignal === 'SELL' ? '入场' : '观望');

      // 优先使用交易记录数据，否则使用实时计算数据
      const ictEntryPrice = ictTrade ? parseFloat(ictTrade.entry_price) : (ictInfo.entryPrice || 0);
      const ictStopLoss = ictTrade ? parseFloat(ictTrade.stop_loss) : (ictInfo.stopLoss || 0);
      const ictTakeProfit = ictTrade ? parseFloat(ictTrade.take_profit) : (ictInfo.takeProfit || 0);
      const ictLeverage = ictTrade ? parseFloat(ictTrade.leverage) : (ictInfo.leverage || 0);
      const ictMargin = ictTrade ? parseFloat(ictTrade.margin_used) : (ictInfo.margin || 0);

      // ICT策略在震荡市不显示交易参数
      const showTradeParams = ictTrend !== 'RANGE' && ictSignal !== 'HOLD' && ictTrade;

      const ictRow = document.createElement('tr');
      ictRow.innerHTML = `
        <td>${item.symbol}</td>
        <td>${item.lastPrice ? parseFloat(item.lastPrice).toFixed(4) : '--'}</td>
        <td><span class="strategy-badge ict">ICT</span></td>
        <td><span class="trend-value trend-${ictTrend.toLowerCase()}">${this.getTrendText(ictTrend)}</span></td>
        <td><span class="signal-value signal-${ictSignalText === '入场' ? 'entry' : 'watch'}">${ictSignalText}</span></td>
        <td class="timeframe-cell">${this.formatHighTimeframe(ictInfo, 'ICT')}</td>
        <td class="timeframe-cell">${this.formatMidTimeframe(ictInfo, 'ICT')}</td>
        <td class="timeframe-cell">${this.formatLowTimeframe(ictInfo, 'ICT')}</td>
        <td class="price-cell">${showTradeParams ? this.formatPrice(ictEntryPrice) : '--'}</td>
        <td class="price-cell">${showTradeParams ? this.formatPrice(ictStopLoss) : '--'}</td>
        <td class="price-cell">${showTradeParams ? this.formatPrice(ictTakeProfit) : '--'}</td>
        <td class="leverage-cell">${showTradeParams ? this.formatLeverage({ entryPrice: ictEntryPrice, stopLoss: ictStopLoss }) : '--'}</td>
        <td class="margin-cell">${showTradeParams ? this.formatMargin({ entryPrice: ictEntryPrice, stopLoss: ictStopLoss, positionSize: ictMargin }) : '--'}</td>
      `;
      tbody.appendChild(ictRow);
    });
  }

  /**
   * 格式化高时间框架判断（趋势判断）
   * @param {Object} strategyInfo - 策略信息
   * @param {string} strategyType - 策略类型 ('V3' 或 'ICT')
   * @returns {string} 格式化后的高时间框架信息
   */
  formatHighTimeframe(strategyInfo, strategyType) {
    if (strategyType === 'V3') {
      // V3策略：4H趋势判断（满分10分制）
      const trend4H = strategyInfo.timeframes?.["4H"] || {};
      const trend = trend4H.trend || 'RANGE';
      const score = trend4H.score || 0;
      const adx = trend4H.adx || 0;
      const bbw = trend4H.bbw || 0;
      const ma20 = trend4H.ma20 || 0;
      const ma50 = trend4H.ma50 || 0;
      const ma200 = trend4H.ma200 || 0;

      return `
        <div class="indicator-group">
          <div class="indicator-item">
            <span class="indicator-label">4H趋势:</span>
            <span class="trend-value trend-${trend.toLowerCase()}">${this.getTrendText(trend)}</span>
          </div>
          <div class="indicator-item">
            <span class="indicator-label">评分:</span>
            <span class="score-badge score-${score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low'}">${score}/10</span>
          </div>
          <div class="indicator-item">
            <span class="indicator-label">MA20:</span>
            <span class="indicator-value">${ma20.toFixed(2)}</span>
          </div>
          <div class="indicator-item">
            <span class="indicator-label">MA50:</span>
            <span class="indicator-value">${ma50.toFixed(2)}</span>
          </div>
          <div class="indicator-item">
            <span class="indicator-label">ADX:</span>
            <span class="indicator-value">${adx.toFixed(1)}</span>
          </div>
          <div class="indicator-item">
            <span class="indicator-label">BBW:</span>
            <span class="indicator-value">${(bbw * 100).toFixed(2)}%</span>
          </div>
        </div>
      `;
    } else if (strategyType === 'ICT') {
      // ICT策略：1D趋势判断（20日收盘价比较）
      const trend1D = strategyInfo.timeframes?.["1D"] || {};
      const trend = trend1D.trend || 'SIDEWAYS';
      const closeChange = trend1D.closeChange || 0;
      const lookback = trend1D.lookback || 20;

      return `
        <div class="indicator-group">
          <div class="indicator-item">
            <span class="indicator-label">1D趋势:</span>
            <span class="trend-value trend-${trend.toLowerCase()}">${this.getTrendText(trend)}</span>
          </div>
          <div class="indicator-item">
            <span class="indicator-label">${lookback}日变化:</span>
            <span class="indicator-value ${closeChange >= 0 ? 'positive' : 'negative'}">${(closeChange * 100).toFixed(2)}%</span>
          </div>
          <div class="indicator-item">
            <span class="indicator-label">判断:</span>
            <span class="indicator-value ${trend !== 'SIDEWAYS' ? 'positive' : 'negative'}">${trend !== 'SIDEWAYS' ? '有效' : '忽略'}</span>
          </div>
        </div>
      `;
    }
    return '--';
  }

  /**
   * 格式化中时间框架判断（多因子得分/趋势加强判断）
   * @param {Object} strategyInfo - 策略信息
   * @param {string} strategyType - 策略类型 ('V3' 或 'ICT')
   * @returns {string} 格式化后的中时间框架信息
   */
  formatMidTimeframe(strategyInfo, strategyType) {
    if (strategyType === 'V3') {
      // V3策略：1H多因子确认（6项因子，score≥3才有效）
      const factors1H = strategyInfo.timeframes?.["1H"] || {};
      const vwap = factors1H.vwap || 0;
      const oiChange = factors1H.oiChange || 0;
      const funding = factors1H.funding || 0;
      const delta = factors1H.delta || 0;
      const score = factors1H.score || 0;
      const valid = score >= 3;

      return `
        <div class="indicator-group">
          <div class="indicator-item">
            <span class="indicator-label">1H多因子:</span>
            <span class="indicator-value ${valid ? 'positive' : 'negative'}">${valid ? '有效' : '无效'}</span>
          </div>
          <div class="indicator-item">
            <span class="indicator-label">得分:</span>
            <span class="score-badge score-${score >= 3 ? 'high' : score >= 2 ? 'medium' : 'low'}">${score}/6</span>
          </div>
          <div class="indicator-item">
            <span class="indicator-label">VWAP:</span>
            <span class="indicator-value">${vwap.toFixed(2)}</span>
          </div>
          <div class="indicator-item">
            <span class="indicator-label">OI变化:</span>
            <span class="indicator-value ${oiChange >= 0 ? 'positive' : 'negative'}">${(oiChange * 100).toFixed(2)}%</span>
          </div>
          <div class="indicator-item">
            <span class="indicator-label">资金费率:</span>
            <span class="indicator-value">${(funding * 100).toFixed(3)}%</span>
          </div>
          <div class="indicator-item">
            <span class="indicator-label">Delta:</span>
            <span class="indicator-value ${delta >= 0 ? 'positive' : 'negative'}">${delta.toFixed(2)}</span>
          </div>
        </div>
      `;
    } else if (strategyType === 'ICT') {
      // ICT策略：4H订单块检测（OB高度、年龄、Sweep速率）
      const ob4H = strategyInfo.timeframes?.["4H"] || {};
      const orderBlocks = ob4H.orderBlocks || [];
      const atr = ob4H.atr || 0;
      const sweepDetected = ob4H.sweepDetected || false;
      const sweepRate = ob4H.sweepRate || 0;
      const valid = orderBlocks.length > 0 && sweepDetected;

      return `
        <div class="indicator-group">
          <div class="indicator-item">
            <span class="indicator-label">4H订单块:</span>
            <span class="indicator-value ${valid ? 'positive' : 'negative'}">${valid ? '有效' : '无效'}</span>
          </div>
          <div class="indicator-item">
            <span class="indicator-label">订单块:</span>
            <span class="indicator-value">${orderBlocks.length}个</span>
          </div>
          <div class="indicator-item">
            <span class="indicator-label">ATR:</span>
            <span class="indicator-value">${atr.toFixed(2)}</span>
          </div>
          <div class="indicator-item">
            <span class="indicator-label">扫荡:</span>
            <span class="indicator-value ${sweepDetected ? 'positive' : 'negative'}">${sweepDetected ? '是' : '否'}</span>
          </div>
          <div class="indicator-item">
            <span class="indicator-label">扫荡速率:</span>
            <span class="indicator-value">${sweepRate.toFixed(2)}</span>
          </div>
        </div>
      `;
    }
    return '--';
  }

  /**
   * 格式化低时间框架判断（入场判断）
   * @param {Object} strategyInfo - 策略信息
   * @param {string} strategyType - 策略类型 ('V3' 或 'ICT')
   * @returns {string} 格式化后的低时间框架信息
   */
  formatLowTimeframe(strategyInfo, strategyType) {
    if (strategyType === 'V3') {
      // V3策略：15m入场执行（多因子得分≥2）
      const entry15m = strategyInfo.timeframes?.["15M"] || {};
      const signal = entry15m.signal || 'HOLD';
      const ema20 = entry15m.ema20 || 0;
      const ema50 = entry15m.ema50 || 0;
      const atr = entry15m.atr || 0;
      const bbw = entry15m.bbw || 0;
      const score = entry15m.score || 0;
      const valid = score >= 2;

      return `
        <div class="indicator-group">
          <div class="indicator-item">
            <span class="indicator-label">15m入场:</span>
            <span class="indicator-value ${valid ? 'positive' : 'negative'}">${valid ? '有效' : '无效'}</span>
          </div>
          <div class="indicator-item">
            <span class="indicator-label">信号:</span>
            <span class="signal-value signal-${signal.toLowerCase()}">${this.getSignalText(signal, "ICT")}</span>
          </div>
          <div class="indicator-item">
            <span class="indicator-label">得分:</span>
            <span class="score-badge score-${score >= 2 ? 'high' : score >= 1 ? 'medium' : 'low'}">${score}/2+</span>
          </div>
          <div class="indicator-item">
            <span class="indicator-label">EMA20:</span>
            <span class="indicator-value">${ema20.toFixed(2)}</span>
          </div>
          <div class="indicator-item">
            <span class="indicator-label">EMA50:</span>
            <span class="indicator-value">${ema50.toFixed(2)}</span>
          </div>
          <div class="indicator-item">
            <span class="indicator-label">ATR:</span>
            <span class="indicator-value">${atr.toFixed(2)}</span>
          </div>
        </div>
      `;
    } else if (strategyType === 'ICT') {
      // ICT策略：15m入场确认（吞没形态、Sweep微观速率）
      const entry15m = strategyInfo.timeframes?.["15M"] || {};
      const signal = entry15m.signal || 'HOLD';
      const engulfing = entry15m.engulfing || false;
      const atr = entry15m.atr || 0;
      const sweepRate = entry15m.sweepRate || 0;
      const volume = entry15m.volume || 0;
      const valid = engulfing && sweepRate >= 0.2 * atr;

      return `
        <div class="indicator-group">
          <div class="indicator-item">
            <span class="indicator-label">15m入场:</span>
            <span class="indicator-value ${valid ? 'positive' : 'negative'}">${valid ? '有效' : '无效'}</span>
          </div>
          <div class="indicator-item">
            <span class="indicator-label">信号:</span>
            <span class="signal-value signal-${signal.toLowerCase()}">${this.getSignalText(signal, "ICT")}</span>
          </div>
          <div class="indicator-item">
            <span class="indicator-label">吞没:</span>
            <span class="indicator-value ${engulfing ? 'positive' : 'negative'}">${engulfing ? '是' : '否'}</span>
          </div>
          <div class="indicator-item">
            <span class="indicator-label">ATR:</span>
            <span class="indicator-value">${atr.toFixed(2)}</span>
          </div>
          <div class="indicator-item">
            <span class="indicator-label">扫荡速率:</span>
            <span class="indicator-value">${sweepRate.toFixed(2)}</span>
          </div>
          <div class="indicator-item">
            <span class="indicator-label">成交量:</span>
            <span class="indicator-value">${this.formatVolume(volume)}</span>
          </div>
        </div>
      `;
    }
    return '--';
  }

  /**
   * 格式化ICT策略1D趋势指标
   * @param {Object} trend1D - 1D趋势数据
   * @returns {string} 格式化后的1D趋势信息
   */
  formatICTTrend1D(trend1D) {
    if (!trend1D) return '--';

    const trend = trend1D.trend || 'SIDEWAYS';
    const closeChange = trend1D.closeChange || 0;
    const lookback = trend1D.lookback || 20;

    return `
      <div class="indicator-group">
        <div class="indicator-item">
          <span class="indicator-label">趋势:</span>
          <span class="trend-value trend-${trend.toLowerCase()}">${this.getTrendText(trend)}</span>
        </div>
        <div class="indicator-item">
          <span class="indicator-label">${lookback}日变化:</span>
          <span class="indicator-value ${closeChange >= 0 ? 'positive' : 'negative'}">${(closeChange * 100).toFixed(2)}%</span>
        </div>
      </div>
    `;
  }

  /**
   * 格式化ICT策略4H订单块指标
   * @param {Object} ob4H - 4H订单块数据
   * @returns {string} 格式化后的4H订单块信息
   */
  formatICTOB4H(ob4H) {
    if (!ob4H) return '--';

    const orderBlocks = ob4H.orderBlocks || [];
    const atr = ob4H.atr || 0;
    const sweepDetected = ob4H.sweepDetected || false;
    const sweepRate = ob4H.sweepRate || 0;

    return `
      <div class="indicator-group">
        <div class="indicator-item">
          <span class="indicator-label">订单块:</span>
          <span class="indicator-value">${orderBlocks.length}个</span>
        </div>
        <div class="indicator-item">
          <span class="indicator-label">ATR:</span>
          <span class="indicator-value">${atr.toFixed(2)}</span>
        </div>
        <div class="indicator-item">
          <span class="indicator-label">扫荡:</span>
          <span class="indicator-value ${sweepDetected ? 'positive' : 'negative'}">${sweepDetected ? '是' : '否'}</span>
        </div>
        <div class="indicator-item">
          <span class="indicator-label">扫荡速率:</span>
          <span class="indicator-value">${sweepRate.toFixed(2)}</span>
        </div>
      </div>
    `;
  }

  /**
   * 格式化ICT策略15m入场指标
   * @param {Object} entry15m - 15m入场数据
   * @returns {string} 格式化后的15m入场信息
   */
  formatICTEntry15m(entry15m) {
    if (!entry15m) return '--';

    const signal = entry15m.signal || 'HOLD';
    const engulfing = entry15m.engulfing || false;
    const atr = entry15m.atr || 0;
    const sweepRate = entry15m.sweepRate || 0;
    const volume = entry15m.volume || 0;

    return `
      <div class="indicator-group">
        <div class="indicator-item">
          <span class="indicator-label">信号:</span>
          <span class="signal-value signal-${signal.toLowerCase()}">${this.getSignalText(signal, "ICT")}</span>
        </div>
        <div class="indicator-item">
          <span class="indicator-label">吞没:</span>
          <span class="indicator-value ${engulfing ? 'positive' : 'negative'}">${engulfing ? '是' : '否'}</span>
        </div>
        <div class="indicator-item">
          <span class="indicator-label">ATR:</span>
          <span class="indicator-value">${atr.toFixed(2)}</span>
        </div>
        <div class="indicator-item">
          <span class="indicator-label">扫荡速率:</span>
          <span class="indicator-value">${sweepRate.toFixed(2)}</span>
        </div>
        <div class="indicator-item">
          <span class="indicator-label">成交量:</span>
          <span class="indicator-value">${this.formatVolume(volume)}</span>
        </div>
      </div>
    `;
  }

  /**
   * 格式化价格显示
   * @param {number|string} price - 价格
   * @returns {string} 格式化后的价格
   */
  formatPrice(price) {
    if (!price || price === 0) return '--';
    return parseFloat(price).toFixed(4);
  }

  /**
   * 格式化杠杆显示
   * @param {Object} strategyInfo - 策略信息
   * @returns {string} 格式化后的杠杆信息
   */
  formatLeverage(strategyInfo) {
    if (!strategyInfo) return '--';

    const entryPrice = parseFloat(strategyInfo.entryPrice) || 0;
    const stopLoss = parseFloat(strategyInfo.stopLoss) || 0;
    const maxLossAmount = this.maxLossAmount; // 使用用户选择的最大损失金额

    if (entryPrice === 0 || stopLoss === 0) return '--';

    // 计算止损距离X%
    const stopLossDistance = Math.abs(entryPrice - stopLoss) / entryPrice;

    // 计算最大杠杆数Y：1/(X%+0.5%) 数值向下取整
    const maxLeverage = Math.floor(1 / (stopLossDistance + 0.005));

    // 计算保证金Z：M/(Y*X%) 数值向上取整
    const margin = Math.ceil(maxLossAmount / (maxLeverage * stopLossDistance));

    return `
      <div class="leverage-info">
        <div class="leverage-item">
          <span class="leverage-label">最大杠杆:</span>
          <span class="leverage-value">${maxLeverage}x</span>
        </div>
        <div class="leverage-item">
          <span class="leverage-label">止损距离:</span>
          <span class="leverage-value">${(stopLossDistance * 100).toFixed(2)}%</span>
        </div>
        <div class="leverage-item">
          <span class="leverage-label">建议杠杆:</span>
          <span class="leverage-value">${Math.min(maxLeverage, 20)}x</span>
        </div>
      </div>
    `;
  }

  /**
   * 格式化保证金显示
   * @param {Object} strategyInfo - 策略信息
   * @returns {string} 格式化后的保证金信息
   */
  formatMargin(strategyInfo) {
    if (!strategyInfo) return '--';

    const entryPrice = parseFloat(strategyInfo.entryPrice) || 0;
    const stopLoss = parseFloat(strategyInfo.stopLoss) || 0;
    const maxLossAmount = this.maxLossAmount; // 使用用户选择的最大损失金额
    const positionSize = parseFloat(strategyInfo.positionSize) || 0;

    if (entryPrice === 0 || stopLoss === 0) return '--';

    // 计算止损距离X%
    const stopLossDistance = Math.abs(entryPrice - stopLoss) / entryPrice;

    // 计算最大杠杆数Y：1/(X%+0.5%) 数值向下取整
    const maxLeverage = Math.floor(1 / (stopLossDistance + 0.005));

    // 计算最小保证金Z：M/(Y*X%) 数值向上取整
    const minMargin = Math.ceil(maxLossAmount / (maxLeverage * stopLossDistance));
    
    // 计算实际保证金：基于建议杠杆（最大杠杆和20的较小值）
    const suggestedLeverage = Math.min(maxLeverage, 20);
    const actualMargin = Math.ceil(maxLossAmount / (suggestedLeverage * stopLossDistance));

    return `
      <div class="margin-info">
        <div class="margin-item">
          <span class="margin-label">最小保证金:</span>
          <span class="margin-value">$${minMargin.toFixed(2)}</span>
        </div>
        <div class="margin-item">
          <span class="margin-label">建议保证金:</span>
          <span class="margin-value">$${actualMargin.toFixed(2)}</span>
        </div>
        <div class="margin-item">
          <span class="margin-label">最大损失:</span>
          <span class="margin-value">$${maxLossAmount.toFixed(2)}</span>
        </div>
      </div>
    `;
  }

  /**
   * 保存最大损失金额到数据库
   */
  async saveMaxLossAmount() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/settings/maxLossAmount`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          value: this.maxLossAmount
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log(`最大损失金额已保存: ${this.maxLossAmount} USDT`);
    } catch (error) {
      console.error('保存最大损失金额失败:', error);
    }
  }

  /**
   * 从数据库加载最大损失金额
   */
  async loadMaxLossAmount() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/settings/maxLossAmount`);

      if (response.ok) {
        const data = await response.json();
        this.maxLossAmount = data.value || 100;

        // 更新选择器显示
        const maxLossAmountSelect = document.getElementById('maxLossAmount');
        if (maxLossAmountSelect) {
          maxLossAmountSelect.value = this.maxLossAmount.toString();
        }

        console.log(`最大损失金额已加载: ${this.maxLossAmount} USDT`);
      } else {
        console.log('使用默认最大损失金额: 100 USDT');
      }
    } catch (error) {
      console.error('加载最大损失金额失败:', error);
    }
  }

  /**
   * 刷新策略状态表格（重新计算杠杆和保证金）
   */
  refreshStrategyStatusTable() {
    // 重新加载策略状态数据，这会触发表格重新渲染
    this.loadStrategyCurrentStatus();
  }

  /**
   * 格式化因子信息
   * @param {Object} factors - 因子对象
   * @returns {string} 格式化后的因子信息
   */
  formatFactors(factors) {
    if (!factors || typeof factors !== 'object') return '--';
    const factorKeys = Object.keys(factors);
    if (factorKeys.length === 0) return '--';
    return factorKeys.slice(0, 2).map(key => `${key}: ${factors[key]}`).join(', ');
  }

  /**
   * 格式化订单块信息
   * @param {Array} orderBlocks - 订单块数组
   * @returns {string} 格式化后的订单块信息
   */
  formatOrderBlocks(orderBlocks) {
    if (!Array.isArray(orderBlocks) || orderBlocks.length === 0) return '--';
    return `${orderBlocks.length}个`;
  }

  /**
   * 格式化扫荡信息
   * @param {Object} sweep - 扫荡对象
   * @returns {string} 格式化后的扫荡信息
   */
  formatSweep(sweep) {
    if (!sweep || !sweep.detected) return '--';
    return sweep.type || 'Sweep';
  }

  /**
   * 获取趋势文本
   * @param {string} trend - 趋势值
   * @returns {string} 趋势文本
   */
  getTrendText(trend) {
    const trendMap = {
      'UP': '上涨',
      'DOWN': '下跌',
      'RANGE': '震荡'
    };
    return trendMap[trend] || '未知';
  }

  /**
   * 获取信号文本
   * @param {string} signal - 信号值
   * @returns {string} 信号文本
   */
  getSignalText(signal, strategy = 'V3') {
    const signalMap = {
      'BUY': '买入',
      'SELL': '卖出',
      'HOLD': strategy === 'ICT' ? '观望' : '持有',
      'WATCH': '关注'
    };
    return signalMap[signal] || '未知';
  }

  /**
   * 渲染交易对表格
   * @param {Array} symbols - 交易对数据
   */
  async renderSymbolsTable(symbols) {
    const tbody = document.getElementById('symbolsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (symbols.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: #6c757d; padding: 2rem;">
            暂无交易对数据
          </td>
        </tr>
      `;
      return;
    }

    for (const symbol of symbols) {
      const row = document.createElement('tr');

      // 获取策略判断数据
      const v3Judgment = await this.getStrategyJudgment(symbol.symbol, 'v3');
      const ictJudgment = await this.getStrategyJudgment(symbol.symbol, 'ict');

      row.innerHTML = `
        <td>${symbol.symbol}</td>
        <td>${symbol.last_price ? parseFloat(symbol.last_price).toFixed(4) : '--'}</td>
        <td class="${symbol.price_change_24h >= 0 ? 'stat-positive' : 'stat-negative'}">
          ${symbol.price_change_24h ? (symbol.price_change_24h * 100).toFixed(2) + '%' : '--'}
        </td>
        <td class="strategy-cell">
          <div class="strategy-info">
            <div class="timeframe-signals">
              <span class="timeframe-badge timeframe-4h">4H: ${v3Judgment?.timeframes?.trend4H || '--'}</span>
              <span class="timeframe-badge timeframe-1h">1H: ${v3Judgment?.timeframes?.factors1H || '--'}</span>
              <span class="timeframe-badge timeframe-15m">15m: ${v3Judgment?.timeframes?.entry15m || '--'}</span>
            </div>
            <div class="signal-display">
              <span class="signal-value signal-${v3Judgment?.signal?.toLowerCase() || 'hold'}">${this.getSignalText(v3Judgment?.signal)}</span>
              <span class="score-badge score-${v3Judgment?.score >= 80 ? 'high' : v3Judgment?.score >= 60 ? 'medium' : 'low'}">${v3Judgment?.score || '--'}</span>
            </div>
          </div>
        </td>
        <td class="strategy-cell">
          <div class="strategy-info">
            <div class="timeframe-signals">
              <span class="timeframe-badge timeframe-1d">1D: ${ictJudgment?.timeframes?.trend1D || '--'}</span>
              <span class="timeframe-badge timeframe-4h">4H: ${ictJudgment?.timeframes?.orderBlocks4H || '--'}</span>
              <span class="timeframe-badge timeframe-15m">15m: ${ictJudgment?.timeframes?.entry15m || '--'}</span>
            </div>
            <div class="signal-display">
              <span class="signal-value signal-${ictJudgment?.signal?.toLowerCase() || 'hold'}">${this.getSignalText(ictJudgment?.signal)}</span>
              <span class="score-badge score-${ictJudgment?.score >= 80 ? 'high' : ictJudgment?.score >= 60 ? 'medium' : 'low'}">${ictJudgment?.score || '--'}</span>
            </div>
          </div>
        </td>
        <td><span class="status-value status-${symbol.status === 'ACTIVE' ? 'online' : 'offline'}">${symbol.status === 'ACTIVE' ? '活跃' : '停用'}</span></td>
      `;
      tbody.appendChild(row);
    }
  }

  /**
   * 获取策略判断数据
   * @param {string} symbol - 交易对
   * @param {string} strategy - 策略名称
   * @returns {Object} 策略判断数据
   */
  async getStrategyJudgment(symbol, strategy) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/strategies/${strategy}/judgments?symbol=${symbol}&limit=1`);
      if (response.ok) {
        const data = await response.json();
        return data.data && data.data.length > 0 ? data.data[0] : null;
      }
    } catch (error) {
      console.error(`获取${strategy}策略判断失败:`, error);
    }
    return null;
  }

  /**
   * 加载策略数据
   */
  async loadStrategyData() {
    console.log(`Loading strategy data for ${this.currentStrategy}`);

    // 加载统计数据
    await this.loadStrategyStatistics();

    // 加载交易记录数据
    await this.loadTradingRecords(this.currentStrategy);
  }

  /**
   * 加载交易记录数据
   * @param {string} strategy - 策略名称
   */
  async loadTradingRecords(strategy) {
    try {
      const response = await this.fetchData(`/trades?strategy=${strategy}&limit=50`);
      const trades = response.data || [];

      // 渲染交易记录表格
      this.renderTradingRecords(strategy, trades);
    } catch (error) {
      console.error(`加载${strategy}策略交易记录失败:`, error);
      // 显示空数据而不是模拟数据
      this.renderTradingRecords(strategy, []);
    }
  }

  /**
   * 加载所有交易记录数据
   */
  async loadAllTradingRecords() {
    try {
      const response = await this.fetchData(`/trades?limit=100`);
      const trades = response.data || [];

      // 渲染所有交易记录表格
      this.renderAllTradingRecords(trades);
    } catch (error) {
      console.error('加载所有交易记录失败:', error);
      this.renderAllTradingRecords([]);
    }
  }

  /**
   * 渲染交易记录表格
   * @param {string} strategy - 策略名称
   * @param {Array} trades - 交易记录数据
   */
  renderTradingRecords(strategy, trades) {
    const tbody = document.getElementById(`${strategy}-trades-body`);
    if (!tbody) return;

    tbody.innerHTML = '';

    if (trades.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="16" style="text-align: center; color: #6c757d; padding: 2rem;">
            暂无交易记录
          </td>
        </tr>
      `;
      return;
    }

    trades.forEach(trade => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${trade.symbol || '--'}</td>
        <td>${trade.strategy_name || '--'}</td>
        <td>${getDirectionText(trade.trade_type)}</td>
        <td class="judgment-basis">${trade.entry_reason || '--'}</td>
        <td>${formatDate(trade.entry_time)}</td>
        <td>${trade.entry_price ? parseFloat(trade.entry_price).toFixed(4) : '--'}</td>
        <td>${trade.take_profit ? parseFloat(trade.take_profit).toFixed(4) : '--'}</td>
        <td>${trade.stop_loss ? parseFloat(trade.stop_loss).toFixed(4) : '--'}</td>
        <td>${this.formatLeverageForTrade(trade)}</td>
        <td>${this.formatMarginForTrade(trade)}</td>
        <td><span class="status-tag status-${(trade.status || 'open').toLowerCase()}">${getStatusText(trade.status)}</span></td>
        <td>${trade.exit_price ? parseFloat(trade.exit_price).toFixed(4) : '--'}</td>
        <td class="judgment-basis">${trade.exit_reason || '--'}</td>
        <td class="${getProfitClass(trade.pnl)}">${formatProfit(trade.pnl)}</td>
        <td class="${getProfitClass(trade.pnl)}">${formatProfitAmount(trade.pnl)}</td>
        <td>${calculateMaxDrawdown(trade)}</td>
      `;
      tbody.appendChild(row);
    });
  }

  /**
   * 渲染所有交易记录表格
   * @param {Array} trades - 所有交易记录数据
   */
  renderAllTradingRecords(trades) {
    const tbody = document.getElementById('tradingRecordsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (trades.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="16" style="text-align: center; color: #6c757d; padding: 2rem;">
            暂无交易记录
          </td>
        </tr>
      `;
      return;
    }

    trades.forEach(trade => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${trade.symbol || '--'}</td>
        <td>${trade.strategy_name || '--'}</td>
        <td>${getDirectionText(trade.trade_type)}</td>
        <td class="judgment-basis">${trade.entry_reason || '--'}</td>
        <td>${formatDate(trade.entry_time)}</td>
        <td>${trade.entry_price ? parseFloat(trade.entry_price).toFixed(4) : '--'}</td>
        <td>${trade.take_profit ? parseFloat(trade.take_profit).toFixed(4) : '--'}</td>
        <td>${trade.stop_loss ? parseFloat(trade.stop_loss).toFixed(4) : '--'}</td>
        <td>${this.formatLeverageForTrade(trade)}</td>
        <td>${this.formatMarginForTrade(trade)}</td>
        <td><span class="status-tag status-${(trade.status || 'open').toLowerCase()}">${getStatusText(trade.status)}</span></td>
        <td>${trade.exit_price ? parseFloat(trade.exit_price).toFixed(4) : '--'}</td>
        <td class="judgment-basis">${trade.exit_reason || '--'}</td>
        <td class="${getProfitClass(trade.pnl)}">${formatProfit(trade.pnl)}</td>
        <td class="${getProfitClass(trade.pnl)}">${formatProfitAmount(trade.pnl)}</td>
        <td>${calculateMaxDrawdown(trade)}</td>
      `;
      tbody.appendChild(row);
    });
  }

  /**
   * 获取方向文本
   * @param {string} tradeType - 交易类型
   * @returns {string} 方向文本
   */
  getDirectionText(tradeType) {
    const directionMap = {
      'LONG': '做多',
      'SHORT': '做空'
    };
    return directionMap[tradeType] || '--';
  }

  /**
   * 格式化盈亏金额
   * @param {number} pnl - 盈亏金额
   * @returns {string} 格式化的盈亏金额
   */
  formatProfitAmount(pnl) {
    if (pnl === null || pnl === undefined) return '--';
    const amount = parseFloat(pnl);
    if (amount === 0) return '0.00';
    return `${amount >= 0 ? '+' : ''}${amount.toFixed(2)}`;
  }

  /**
   * 计算最大回撤
   * @param {Object} trade - 交易记录
   * @returns {string} 最大回撤
   */
  calculateMaxDrawdown(trade) {
    // 这里简化处理，实际应该根据历史数据计算
    if (trade.status === 'CLOSED' && trade.pnl < 0) {
      return `${Math.abs(parseFloat(trade.pnl)).toFixed(2)}`;
    }
    return '--';
  }

  /**
   * 获取模拟交易记录数据
   * @param {string} strategy - 策略名称
   * @returns {Array} 模拟交易记录
   */
  getMockTradingRecords(strategy) {
    const mockTrades = {
      v3: [
        {
          symbol: 'BTCUSDT',
          entry_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          entry_price: 112500.00,
          entry_reason: '4H趋势向上，1H因子评分85，15m突破信号',
          take_profit: 115000.00,
          stop_loss: 110000.00,
          leverage: 10,
          margin: 1000.00,
          status: 'open',
          pnl: 250.00
        },
        {
          symbol: 'ETHUSDT',
          entry_time: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          entry_price: 4200.00,
          entry_reason: '4H趋势向上，1H因子评分78，15m回调入场',
          take_profit: 4400.00,
          stop_loss: 4000.00,
          leverage: 8,
          margin: 800.00,
          status: 'closed',
          exit_time: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
          exit_price: 4350.00,
          exit_reason: '达到止盈目标',
          pnl: 150.00
        }
      ],
      ict: [
        {
          symbol: 'ONDOUSDT',
          entry_time: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          entry_price: 0.9450,
          entry_reason: '检测到看涨订单块，HTF扫荡确认，吞没形态',
          take_profit: 0.9800,
          stop_loss: 0.9200,
          leverage: 15,
          margin: 500.00,
          status: 'open',
          pnl: 25.00
        },
        {
          symbol: 'LINKUSDT',
          entry_time: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          entry_price: 21.50,
          entry_reason: '订单块支撑，流动性扫荡确认',
          take_profit: 22.50,
          stop_loss: 20.80,
          leverage: 12,
          margin: 600.00,
          status: 'stopped',
          exit_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          exit_price: 20.90,
          exit_reason: '触发止损',
          pnl: -60.00
        }
      ]
    };

    return mockTrades[strategy] || [];
  }

  /**
   * 格式化成交量
   * @param {number} volume - 成交量
   * @returns {string} 格式化后的成交量
   */
  formatVolume(volume) {
    if (!volume || volume === 0) return '0';

    const vol = parseFloat(volume);
    if (vol >= 1000000) {
      return (vol / 1000000).toFixed(3) + 'M';
    } else if (vol >= 1000) {
      return (vol / 1000).toFixed(1) + 'K';
    } else {
      return vol.toFixed(3);
    }
  }

  /**
   * 格式化日期时间
   * @param {string} dateTime - ISO日期时间字符串
   * @returns {string} 格式化后的日期时间
   */
  formatDateTime(dateTime) {
    if (!dateTime) return '--';
    const date = new Date(dateTime);
    return date.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * 获取状态文本
   * @param {string} status - 状态值
   * @returns {string} 状态文本
   */
  getStatusText(status) {
    const statusMap = {
      'open': '持仓中',
      'closed': '已平仓',
      'stopped': '已止损'
    };
    return statusMap[status] || '未知';
  }

  /**
   * 获取盈亏样式类
   * @param {number} pnl - 盈亏金额
   * @returns {string} CSS类名
   */
  getProfitClass(pnl) {
    if (pnl > 0) return 'profit-positive';
    if (pnl < 0) return 'profit-negative';
    return 'profit-neutral';
  }

  /**
   * 格式化盈亏显示
   * @param {number} pnl - 盈亏金额
   * @returns {string} 格式化后的盈亏
   */
  formatProfit(pnl) {
    if (pnl === null || pnl === undefined) return '--';
    const sign = pnl >= 0 ? '+' : '';
    return `${sign}${parseFloat(pnl).toFixed(2)}`;
  }

  /**
   * 加载监控数据
   */
  async loadMonitoringData() {
    try {
      // 模拟监控数据
      const monitoringData = {
        cpu: Math.random() * 40 + 20, // 20-60%
        memory: Math.random() * 30 + 50, // 50-80%
        disk: Math.random() * 20 + 30, // 30-50%
        apis: {
          binanceRest: 'online',
          binanceWs: 'online',
          database: 'online',
          redis: 'online'
        },
        strategies: {
          v3: 'running',
          ict: 'running',
          rolling: 'running'
        }
      };

      this.updateMonitoringDisplay(monitoringData);
    } catch (error) {
      console.error('Error loading monitoring data:', error);
    }
  }

  /**
   * 更新监控显示
   * @param {Object} data - 监控数据
   */
  updateMonitoringDisplay(data) {
    // 更新资源使用率
    const cpuBar = document.querySelector('.resource-item:nth-child(1) .progress-fill');
    const memoryBar = document.querySelector('.resource-item:nth-child(2) .progress-fill');
    const diskBar = document.querySelector('.resource-item:nth-child(3) .progress-fill');

    if (cpuBar) {
      cpuBar.style.width = `${data.cpu}%`;
      cpuBar.parentElement.nextElementSibling.textContent = `${data.cpu.toFixed(1)}%`;
    }

    if (memoryBar) {
      memoryBar.style.width = `${data.memory}%`;
      memoryBar.parentElement.nextElementSibling.textContent = `${data.memory.toFixed(1)}%`;
    }

    if (diskBar) {
      diskBar.style.width = `${data.disk}%`;
      diskBar.parentElement.nextElementSibling.textContent = `${data.disk.toFixed(1)}%`;
    }
  }

  /**
   * 加载统计数据
   */
  async loadStatistics() {
    try {
      // 获取真实的统计数据
      const response = await this.fetchData('/strategies/statistics');
      const stats = response.data;

      // 转换为统计页面需要的格式
      const statisticsData = {
        total: stats.overall.totalTrades,
        winRate: stats.overall.winRate,
        totalPnl: stats.overall.totalPnl,
        maxDrawdown: stats.overall.maxDrawdown,
        strategies: {
          v3: stats.v3.winRate,
          ict: stats.ict.winRate,
          rolling: stats.overall.winRate
        }
      };

      this.updateStatisticsDisplay(statisticsData);

      // 加载交易对详细统计
      await this.loadTradingPairStatistics();
    } catch (error) {
      console.error('Error loading statistics:', error);
      // 使用空数据作为后备
      this.updateStatisticsDisplay({
        total: 0,
        winRate: 0,
        totalPnl: 0,
        maxDrawdown: 0,
        strategies: {
          v3: 0,
          ict: 0,
          rolling: 0
        }
      });
    }
  }

  /**
   * 加载交易对详细统计
   */
  async loadTradingPairStatistics() {
    try {
      // 获取所有交易记录
      const response = await this.fetchData('/trades?limit=100');
      const trades = response.data;

      // 按交易对和策略分组统计
      const pairStats = {};
      trades.forEach(trade => {
        const key = `${trade.symbol}_${trade.strategy_name}`;
        if (!pairStats[key]) {
          pairStats[key] = {
            symbol: trade.symbol,
            strategy: trade.strategy_name,
            timeframe: '15m', // 默认时间周期
            totalTrades: 0,
            profitableTrades: 0,
            losingTrades: 0,
            totalPnl: 0,
            winRate: 0,
            sharpeRatio: 0
          };
        }

        pairStats[key].totalTrades++;
        const pnl = parseFloat(trade.pnl) || 0;
        pairStats[key].totalPnl += pnl;

        if (pnl > 0) {
          pairStats[key].profitableTrades++;
        } else if (pnl < 0) {
          pairStats[key].losingTrades++;
        }
      });

      // 计算胜率和夏普比率
      Object.values(pairStats).forEach(stat => {
        stat.winRate = stat.totalTrades > 0 ? (stat.profitableTrades / stat.totalTrades) * 100 : 0;
        // 简化的夏普比率计算（实际应该基于收益率标准差）
        stat.sharpeRatio = stat.totalTrades > 0 ? (stat.totalPnl / stat.totalTrades) / Math.max(1, Math.abs(stat.totalPnl)) : 0;
      });

      this.updateTradingPairStatisticsTable(Object.values(pairStats));
    } catch (error) {
      console.error('Error loading trading pair statistics:', error);
      this.updateTradingPairStatisticsTable([]);
    }
  }

  /**
   * 更新交易对详细统计表格
   * @param {Array} pairStats - 交易对统计数据
   */
  updateTradingPairStatisticsTable(pairStats) {
    const tbody = document.getElementById('statisticsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (pairStats.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">暂无数据</td></tr>';
      return;
    }

    pairStats.forEach(stat => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${stat.symbol}</td>
        <td><span class="strategy-badge ${stat.strategy.toLowerCase()}">${stat.strategy}</span></td>
        <td>${stat.timeframe}</td>
        <td>${stat.totalTrades}</td>
        <td><span class="${stat.winRate >= 50 ? 'stat-positive' : 'stat-negative'}">${stat.winRate.toFixed(1)}%</span></td>
        <td><span class="${stat.totalPnl >= 0 ? 'stat-positive' : 'stat-negative'}">${stat.totalPnl >= 0 ? '+' : ''}${stat.totalPnl.toFixed(2)}</span></td>
        <td>${stat.sharpeRatio.toFixed(2)}</td>
      `;
      tbody.appendChild(row);
    });
  }

  /**
   * 格式化交易记录中的杠杆显示
   * @param {Object} trade - 交易记录
   * @returns {string} 格式化后的杠杆信息
   */
  formatLeverageForTrade(trade) {
    if (!trade || !trade.entry_price || !trade.stop_loss) return '--';
    
    const entryPrice = parseFloat(trade.entry_price) || 0;
    const stopLoss = parseFloat(trade.stop_loss) || 0;
    const maxLossAmount = this.maxLossAmount || 100;

    if (entryPrice === 0 || stopLoss === 0) return '--';

    // 计算止损距离X%
    const stopLossDistance = Math.abs(entryPrice - stopLoss) / entryPrice;

    // 计算最大杠杆数Y：1/(X%+0.5%) 数值向下取整
    const maxLeverage = Math.floor(1 / (stopLossDistance + 0.005));
    
    // 建议杠杆（最大杠杆和20的较小值）
    const suggestedLeverage = Math.min(maxLeverage, 20);

    return `${suggestedLeverage}x`;
  }

  /**
   * 格式化交易记录中的保证金显示
   * @param {Object} trade - 交易记录
   * @returns {string} 格式化后的保证金信息
   */
  formatMarginForTrade(trade) {
    if (!trade || !trade.entry_price || !trade.stop_loss) return '--';
    
    const entryPrice = parseFloat(trade.entry_price) || 0;
    const stopLoss = parseFloat(trade.stop_loss) || 0;
    const maxLossAmount = this.maxLossAmount || 100;

    if (entryPrice === 0 || stopLoss === 0) return '--';

    // 计算止损距离X%
    const stopLossDistance = Math.abs(entryPrice - stopLoss) / entryPrice;

    // 计算最大杠杆数Y：1/(X%+0.5%) 数值向下取整
    const maxLeverage = Math.floor(1 / (stopLossDistance + 0.005));
    
    // 建议杠杆（最大杠杆和20的较小值）
    const suggestedLeverage = Math.min(maxLeverage, 20);
    
    // 计算建议保证金：M/(Y*X%) 数值向上取整
    const suggestedMargin = Math.ceil(maxLossAmount / (suggestedLeverage * stopLossDistance));

    return `$${suggestedMargin.toFixed(2)}`;
  }

  /**
   * 更新统计显示
   * @param {Object} data - 统计数据
   */
  updateStatisticsDisplay(data) {
    // 更新总体统计
    const statItems = document.querySelectorAll('.stat-item');
    if (statItems.length >= 4) {
      statItems[0].querySelector('.stat-value').textContent = data.total.toLocaleString();
      statItems[1].querySelector('.stat-value').textContent = `${data.winRate}%`;
      statItems[2].querySelector('.stat-value').textContent = `+$${data.totalPnl.toLocaleString()}`;
      statItems[3].querySelector('.stat-value').textContent = `-${data.maxDrawdown}%`;
    }

    // 更新策略对比
    const comparisonItems = document.querySelectorAll('.comparison-item');
    const strategies = ['v3', 'ict', 'rolling'];
    strategies.forEach((strategy, index) => {
      if (comparisonItems[index]) {
        const fill = comparisonItems[index].querySelector('.comparison-fill');
        const value = comparisonItems[index].querySelector('.comparison-value');
        if (fill && value) {
          fill.style.width = `${data.strategies[strategy]}%`;
          value.textContent = `${data.strategies[strategy]}%`;
        }
      }
    });
  }

  /**
   * 加载工具数据
   */
  loadToolsData() {
    // 工具页面数据加载
    console.log('Loading tools data');
  }

  /**
   * 开始自动刷新
   */
  startAutoRefresh() {
    this.refreshInterval = setInterval(() => {
      this.updateLastUpdateTime();
      if (this.currentTab === 'dashboard') {
        this.loadDashboardData();
      } else if (this.currentTab === 'monitoring') {
        this.loadMonitoringData();
      }
    }, 30000); // 30秒刷新一次
  }

  /**
   * 更新最后更新时间
   */
  updateLastUpdateTime() {
    const lastUpdateElement = document.getElementById('lastUpdate');
    if (lastUpdateElement) {
      lastUpdateElement.textContent = new Date().toLocaleTimeString();
    }
  }

  /**
   * 获取API数据
   * @param {string} endpoint - API端点
   * @returns {Promise} API响应
   */
  async fetchData(endpoint) {
    const response = await fetch(`${this.apiBaseUrl}${endpoint}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  }

  /**
   * 显示错误信息
   * @param {string} message - 错误信息
   */
  showError(message) {
    console.error(message);
    // 这里可以添加用户友好的错误提示
  }
}

// 全局函数，供HTML调用
function refreshData() {
  if (window.smartFlowApp) {
    window.smartFlowApp.loadDashboardData();
  }
}

function refreshMonitoring() {
  if (window.smartFlowApp) {
    window.smartFlowApp.loadMonitoringData();
  }
}

async function calculateRolling() {
  const principal = parseFloat(document.getElementById('principal').value) || 200;
  const initialLeverage = parseFloat(document.getElementById('initialLeverage').value) || 50;
  const priceStart = parseFloat(document.getElementById('priceStart').value) || 4700;
  const priceTarget = parseFloat(document.getElementById('priceTarget').value) || 5200;
  const triggerRatio = parseFloat(document.getElementById('triggerRatio').value) || 1.0;
  const leverageDecay = parseFloat(document.getElementById('leverageDecay').value) || 0.5;
  const profitLockRatio = parseFloat(document.getElementById('profitLockRatio').value) || 0.5;
  const minLeverage = parseFloat(document.getElementById('minLeverage').value) || 5;

  const result = document.getElementById('rollingResult');
  result.innerHTML = '<p>计算中...</p>';

  try {
    const response = await fetch('/api/v1/tools/dynamic-rolling-calculator', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        principal,
        initialLeverage,
        priceStart,
        priceTarget,
        triggerRatio,
        leverageDecay,
        profitLockRatio,
        minLeverage
      })
    });

    const data = await response.json();

    if (data.success) {
      const calc = data.data;
  result.innerHTML = `
        <h4>动态杠杆滚仓计算结果</h4>
        <div class="result-grid">
          <div class="result-item">
            <span class="result-label">初始本金:</span>
            <span class="result-value">$${calc.summary.principal}</span>
          </div>
          <div class="result-item">
            <span class="result-label">最终净值:</span>
            <span class="result-value">$${calc.finalEquity.toFixed(2)}</span>
          </div>
          <div class="result-item">
            <span class="result-label">总收益率:</span>
            <span class="result-value ${calc.totalReturn >= 0 ? 'positive' : 'negative'}">${calc.totalReturn.toFixed(2)}%</span>
          </div>
          <div class="result-item">
            <span class="result-label">已锁定利润:</span>
            <span class="result-value">$${calc.totalLockedProfit.toFixed(2)}</span>
          </div>
          <div class="result-item">
            <span class="result-label">当前浮盈:</span>
            <span class="result-value">$${calc.finalFloatingProfit.toFixed(2)}</span>
          </div>
          <div class="result-item">
            <span class="result-label">最终杠杆:</span>
            <span class="result-value">${calc.finalLeverage.toFixed(2)}x</span>
          </div>
          <div class="result-item">
            <span class="result-label">滚仓次数:</span>
            <span class="result-value">${calc.summary.rollingCount}</span>
          </div>
        </div>
        <div class="history-section">
          <h5>滚仓历史（最近10步）</h5>
          <div class="history-table">
            <table>
              <thead>
                <tr>
                  <th>步骤</th>
                  <th>价格</th>
                  <th>仓位</th>
                  <th>浮盈</th>
                  <th>锁定利润</th>
                  <th>净值</th>
                  <th>杠杆</th>
                </tr>
              </thead>
              <tbody>
                ${calc.history.slice(-10).map(h => `
                  <tr>
                    <td>${h.step}</td>
                    <td>$${h.price}</td>
                    <td>$${h.position}</td>
                    <td class="${h.floatingProfit >= 0 ? 'positive' : 'negative'}">$${h.floatingProfit}</td>
                    <td>$${h.lockedProfit}</td>
                    <td>$${h.equity}</td>
                    <td>${h.leverage}x</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else {
      result.innerHTML = `<p class="error">计算失败: ${data.error}</p>`;
    }
  } catch (error) {
    result.innerHTML = `<p class="error">计算失败: ${error.message}</p>`;
  }
}

function saveTelegramSettings() {
  const botToken = document.getElementById('botToken').value;
  const chatId = document.getElementById('chatId').value;
  const alertThreshold = document.getElementById('alertThreshold').value;

  if (!botToken || !chatId) {
    alert('请填写完整的Telegram设置');
    return;
  }

  // 这里应该调用API保存设置
  console.log('Saving Telegram settings:', { botToken, chatId, alertThreshold });
  alert('Telegram设置已保存');
}

async function testAPI(type) {
  const result = document.getElementById('apiTestResult');
  result.innerHTML = '<p>测试中...</p>';

  try {
    let endpoint = '';
    let method = 'GET';
    let body = null;

    switch (type) {
      case 'health':
        endpoint = '/health';
        break;
      case 'symbols':
        endpoint = '/api/v1/symbols';
        break;
      case 'strategies':
        endpoint = '/api/v1/strategies/status';
        break;
      case 'trades':
        endpoint = '/api/v1/trades';
        break;
      case 'monitoring':
        endpoint = '/api/v1/monitoring/health';
        break;
      case 'tools':
        endpoint = '/api/v1/tools/rolling-parameters';
        break;
      case 'telegram':
        endpoint = '/api/v1/telegram/status';
        break;
      case 'v3-analyze':
        endpoint = '/api/v1/strategies/v3/analyze';
        method = 'POST';
        body = JSON.stringify({ symbol: 'BTCUSDT' });
        break;
      case 'ict-analyze':
        endpoint = '/api/v1/strategies/ict/analyze';
        method = 'POST';
        body = JSON.stringify({ symbol: 'BTCUSDT' });
        break;
      case 'create-trade':
        endpoint = '/api/v1/trades';
        method = 'POST';
        body = JSON.stringify({
          symbol: 'BTCUSDT',
          strategy_type: 'V3',
          direction: 'LONG',
          entry_price: 50000,
          stop_loss: 49000,
          take_profit: 52000,
          leverage: 10,
          position_size: 0.01,
          entry_reason: 'API测试'
        });
        break;
    }

    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.body = body;
    }

    const response = await fetch(endpoint, options);
    const data = await response.json();

    const statusClass = response.ok ? 'success' : 'error';
    const statusText = response.ok ? '成功' : '失败';

    result.innerHTML = `
      <div class="api-test-result">
        <h4>API测试结果 - ${getAPITestName(type)}</h4>
        <div class="test-info">
          <div class="test-item">
            <span class="test-label">端点:</span>
            <span class="test-value">${endpoint}</span>
          </div>
          <div class="test-item">
            <span class="test-label">方法:</span>
            <span class="test-value">${method}</span>
          </div>
          <div class="test-item">
            <span class="test-label">状态码:</span>
            <span class="test-value status-${statusClass}">${response.status}</span>
          </div>
          <div class="test-item">
            <span class="test-label">状态:</span>
            <span class="test-value status-${statusClass}">${statusText}</span>
          </div>
          <div class="test-item">
            <span class="test-label">响应时间:</span>
            <span class="test-value">${Date.now() - window.testStartTime}ms</span>
          </div>
        </div>
        <div class="test-response">
          <h5>响应数据:</h5>
            <pre>${JSON.stringify(data, null, 2)}</pre>
        </div>
      </div>
        `;
  } catch (error) {
    result.innerHTML = `
      <div class="api-test-result">
        <h4>API测试结果 - ${getAPITestName(type)}</h4>
        <div class="test-error">
            <p><strong>错误:</strong> ${error.message}</p>
          <p><strong>类型:</strong> ${error.name}</p>
        </div>
      </div>
    `;
  }
}

// 获取API测试名称
function getAPITestName(type) {
  const names = {
    'health': '健康检查',
    'symbols': '交易对API',
    'strategies': '策略状态API',
    'trades': '交易记录API',
    'monitoring': '系统监控API',
    'tools': '工具API',
    'telegram': 'Telegram API',
    'v3-analyze': 'V3策略分析',
    'ict-analyze': 'ICT策略分析',
    'create-trade': '创建交易'
  };
  return names[type] || type;
}

// 运行所有API测试
async function runAllAPITests() {
  const result = document.getElementById('apiTestResult');
  result.innerHTML = '<p>运行所有API测试中...</p>';

  const tests = [
    'health',
    'symbols',
    'strategies',
    'trades',
    'monitoring',
    'tools',
    'telegram',
    'v3-analyze',
    'ict-analyze'
  ];

  const results = [];

  for (const test of tests) {
    try {
      window.testStartTime = Date.now();
      const testResult = await runSingleAPITest(test);
      results.push({ test, ...testResult });
    } catch (error) {
      results.push({
        test,
        success: false,
        error: error.message,
        status: 0
      });
    }
  }

  // 显示汇总结果
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;

  result.innerHTML = `
    <div class="api-test-summary">
      <h4>API测试汇总</h4>
      <div class="summary-stats">
        <div class="stat-item">
          <span class="stat-label">总测试数:</span>
          <span class="stat-value">${totalCount}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">成功数:</span>
          <span class="stat-value success">${successCount}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">失败数:</span>
          <span class="stat-value error">${totalCount - successCount}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">成功率:</span>
          <span class="stat-value">${((successCount / totalCount) * 100).toFixed(1)}%</span>
        </div>
      </div>
      <div class="test-results">
        ${results.map(r => `
          <div class="test-result-item ${r.success ? 'success' : 'error'}">
            <span class="test-name">${getAPITestName(r.test)}</span>
            <span class="test-status">${r.success ? '✓' : '✗'}</span>
            <span class="test-code">${r.status || 0}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// 运行单个API测试
async function runSingleAPITest(type) {
  let endpoint = '';
  let method = 'GET';
  let body = null;

  switch (type) {
    case 'health':
      endpoint = '/health';
      break;
    case 'symbols':
      endpoint = '/api/v1/symbols';
      break;
    case 'strategies':
      endpoint = '/api/v1/strategies/status';
      break;
    case 'trades':
      endpoint = '/api/v1/trades';
      break;
    case 'monitoring':
      endpoint = '/api/v1/monitoring/health';
      break;
    case 'tools':
      endpoint = '/api/v1/tools/rolling-parameters';
      break;
    case 'telegram':
      endpoint = '/api/v1/telegram/status';
      break;
    case 'v3-analyze':
      endpoint = '/api/v1/strategies/v3/analyze';
      method = 'POST';
      body = JSON.stringify({ symbol: 'BTCUSDT' });
      break;
    case 'ict-analyze':
      endpoint = '/api/v1/strategies/ict/analyze';
      method = 'POST';
      body = JSON.stringify({ symbol: 'BTCUSDT' });
      break;
  }

  const options = {
    method: method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = body;
  }

  const response = await fetch(endpoint, options);
  const data = await response.json();

  return {
    success: response.ok,
    status: response.status,
    data: data
  };
}

// 加载交易记录
async function loadTradingRecords() {
  try {
    const response = await fetch('/api/v1/trades');
    const result = await response.json();

    if (result.success) {
      updateTradingRecordsTable(result.data);
    } else {
      console.error('加载交易记录失败:', result.error);
      // 使用空数据作为后备
      updateTradingRecordsTable([]);
    }
  } catch (error) {
    console.error('加载交易记录失败:', error);
    // 使用空数据作为后备
    updateTradingRecordsTable([]);
  }
}

// 更新交易记录表格
function updateTradingRecordsTable(trades) {
  const tbody = document.getElementById('tradingRecordsTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!trades || trades.length === 0) {
    tbody.innerHTML = '<tr><td colspan="16" class="text-center">暂无交易记录</td></tr>';
    return;
  }

  trades.forEach(trade => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${trade.symbol || '--'}</td>
      <td><span class="strategy-badge ${(trade.strategy_name || '').toLowerCase()}">${trade.strategy_name || '--'}</span></td>
      <td><span class="direction-badge ${(trade.trade_type || '').toLowerCase()}">${getDirectionText(trade.trade_type)}</span></td>
      <td class="judgment-basis">${trade.entry_reason || '--'}</td>
      <td>${formatDate(trade.entry_time)}</td>
      <td>${trade.entry_price ? parseFloat(trade.entry_price).toFixed(4) : '--'}</td>
      <td>${trade.take_profit ? parseFloat(trade.take_profit).toFixed(4) : '--'}</td>
      <td>${trade.stop_loss ? parseFloat(trade.stop_loss).toFixed(4) : '--'}</td>
      <td>${trade.leverage ? parseFloat(trade.leverage).toFixed(2) : '--'}</td>
      <td>${trade.margin_used ? parseFloat(trade.margin_used).toFixed(2) : '--'}</td>
      <td><span class="status-badge ${(trade.status || '').toLowerCase()}">${getStatusText(trade.status)}</span></td>
      <td>${trade.exit_price ? parseFloat(trade.exit_price).toFixed(4) : '--'}</td>
      <td class="judgment-basis">${trade.exit_reason || '--'}</td>
      <td class="${getProfitClass(trade.pnl)}">${formatProfit(trade.pnl)}</td>
      <td class="${getProfitClass(trade.pnl)}">${formatProfitAmount(trade.pnl)}</td>
      <td>${calculateMaxDrawdown(trade)}</td>
    `;
    tbody.appendChild(row);
  });
}

// 获取状态文本
function getStatusText(status) {
  const statusMap = {
    'ACTIVE': '进行中',
    'CLOSED': '已关闭',
    'CANCELLED': '已取消'
  };
  return statusMap[status] || status;
}

// 关闭交易
async function closeTrade(tradeId) {
  if (!confirm('确定要关闭这个交易吗？')) {
    return;
  }

  try {
    const response = await fetch(`/api/v1/trades/${tradeId}/close`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        exit_price: await getCurrentPrice(),
        exit_reason: 'MANUAL'
      })
    });

    const result = await response.json();

    if (result.success) {
      alert('交易关闭成功');
      loadTradingRecords();
    } else {
      alert('关闭交易失败: ' + result.error);
    }
  } catch (error) {
    console.error('关闭交易失败:', error);
    alert('关闭交易失败: ' + error.message);
  }
}

// 获取当前价格
async function getCurrentPrice() {
  try {
    const response = await fetch('/api/v1/binance/ticker/price?symbol=BTCUSDT');
    const result = await response.json();
    return result.success ? parseFloat(result.data.price) : 0;
  } catch (error) {
    console.error('获取当前价格失败:', error);
    return 0;
  }
}

// 格式化日期
function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN');
}

// 保存交易触发Telegram设置
async function saveTradingTelegramSettings() {
  const botToken = document.getElementById('tradingTelegramBotToken').value;
  const chatId = document.getElementById('tradingTelegramChatId').value;

  if (!botToken || !chatId) {
    alert('请填写完整的交易触发Telegram配置信息');
    return;
  }

  try {
    const response = await fetch('/api/v1/telegram/trading-config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ botToken, chatId })
    });

    const result = await response.json();

    if (result.success) {
      alert('交易触发Telegram设置保存成功');
      loadTelegramStatus();
    } else {
      alert('保存失败: ' + result.error);
    }
  } catch (error) {
    console.error('保存交易触发Telegram设置失败:', error);
    alert('保存失败: ' + error.message);
  }
}

// 保存系统监控Telegram设置
async function saveMonitoringTelegramSettings() {
  const botToken = document.getElementById('monitoringTelegramBotToken').value;
  const chatId = document.getElementById('monitoringTelegramChatId').value;

  if (!botToken || !chatId) {
    alert('请填写完整的系统监控Telegram配置信息');
    return;
  }

  try {
    const response = await fetch('/api/v1/telegram/monitoring-config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ botToken, chatId })
    });

    const result = await response.json();

    if (result.success) {
      alert('系统监控Telegram设置保存成功');
      loadTelegramStatus();
    } else {
      alert('保存失败: ' + result.error);
    }
  } catch (error) {
    console.error('保存系统监控Telegram设置失败:', error);
    alert('保存失败: ' + error.message);
  }
}

// 加载Telegram状态
async function loadTelegramStatus() {
  try {
    const response = await fetch('/api/v1/telegram/status');
    const result = await response.json();

    if (result.success) {
      updateTelegramStatus(result.data);
    } else {
      console.error('加载Telegram状态失败:', result.error);
      // 使用默认状态作为后备
      updateTelegramStatus({
        trading: { enabled: false, botToken: '未配置', chatId: '未配置' },
        monitoring: { enabled: false, botToken: '未配置', chatId: '未配置' }
      });
    }
  } catch (error) {
    console.error('加载Telegram状态失败:', error);
    // 使用默认状态作为后备
    updateTelegramStatus({
      trading: { enabled: false, botToken: '未配置', chatId: '未配置' },
      monitoring: { enabled: false, botToken: '未配置', chatId: '未配置' }
    });
  }
}

// 更新Telegram状态显示
function updateTelegramStatus(status) {
  // 更新交易触发状态
  const tradingStatus = document.getElementById('tradingTelegramStatus');
  if (tradingStatus) {
    tradingStatus.innerHTML = `
      <div class="status-item">
        <span class="status-label">状态:</span>
        <span class="status-value ${status.trading.enabled ? 'enabled' : 'disabled'}">
          ${status.trading.enabled ? '已启用' : '未启用'}
        </span>
      </div>
      <div class="status-item">
        <span class="status-label">Bot Token:</span>
        <span class="status-value">${status.trading.botToken}</span>
      </div>
      <div class="status-item">
        <span class="status-label">Chat ID:</span>
        <span class="status-value">${status.trading.chatId}</span>
      </div>
    `;
  }

  // 更新系统监控状态
  const monitoringStatus = document.getElementById('monitoringTelegramStatus');
  if (monitoringStatus) {
    monitoringStatus.innerHTML = `
      <div class="status-item">
        <span class="status-label">状态:</span>
        <span class="status-value ${status.monitoring.enabled ? 'enabled' : 'disabled'}">
          ${status.monitoring.enabled ? '已启用' : '未启用'}
        </span>
      </div>
      <div class="status-item">
        <span class="status-label">Bot Token:</span>
        <span class="status-value">${status.monitoring.botToken}</span>
      </div>
      <div class="status-item">
        <span class="status-label">Chat ID:</span>
        <span class="status-value">${status.monitoring.chatId}</span>
      </div>
    `;
  }
}

// 测试交易触发Telegram
async function testTradingTelegram() {
  try {
    const response = await fetch('/api/v1/telegram/test-trading', {
      method: 'POST'
    });

    const result = await response.json();

    if (result.success) {
      alert('交易触发Telegram测试成功！请检查Telegram消息。');
    } else {
      alert('测试失败: ' + result.error);
    }
  } catch (error) {
    console.error('测试交易触发Telegram失败:', error);
    alert('测试失败: ' + error.message);
  }
}

// 测试系统监控Telegram
async function testMonitoringTelegram() {
  try {
    const response = await fetch('/api/v1/telegram/test-monitoring', {
      method: 'POST'
    });

    const result = await response.json();

    if (result.success) {
      alert('系统监控Telegram测试成功！请检查Telegram消息。');
    } else {
      alert('测试失败: ' + result.error);
    }
  } catch (error) {
    console.error('测试系统监控Telegram失败:', error);
    alert('测试失败: ' + error.message);
  }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
  window.smartFlowApp = new SmartFlowApp();

  // 加载交易记录
  loadTradingRecords();

  // 加载Telegram状态
  loadTelegramStatus();
});

// 获取方向文本
function getDirectionText(tradeType) {
  const directionMap = {
    'LONG': '做多',
    'SHORT': '做空'
  };
  return directionMap[tradeType] || '--';
}

// 格式化盈亏金额
function formatProfitAmount(pnl) {
  if (pnl === null || pnl === undefined) return '--';
  const amount = parseFloat(pnl);
  if (amount === 0) return '0.00';
  return `${amount >= 0 ? '+' : ''}${amount.toFixed(2)}`;
}

// 计算最大回撤
function calculateMaxDrawdown(trade) {
  // 这里简化处理，实际应该根据历史数据计算
  if (trade.status === 'CLOSED' && trade.pnl < 0) {
    return `${Math.abs(parseFloat(trade.pnl)).toFixed(2)}`;
  }
  return '--';
}

// 获取盈亏样式类
function getProfitClass(pnl) {
  if (pnl === null || pnl === undefined) return '';
  const amount = parseFloat(pnl);
  if (amount > 0) return 'profit';
  if (amount < 0) return 'loss';
  return '';
}

// 格式化盈亏
function formatProfit(pnl) {
  if (pnl === null || pnl === undefined) return '--';
  const amount = parseFloat(pnl);
  if (amount === 0) return '0.00%';
  return `${amount >= 0 ? '+' : ''}${amount.toFixed(2)}%`;
}

// 格式化日期时间
function formatDate(dateString) {
  if (!dateString) return '--';
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}
