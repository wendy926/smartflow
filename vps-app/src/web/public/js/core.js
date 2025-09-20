// core.js - SmartFlowApp 核心类

class SmartFlowApp {
  constructor() {
    this.allSymbols = []; // 动态加载交易对，不再硬编码
    this.isLoading = false;
    this.currentStrategy = 'trend'; // 当前选择的策略
    this.userSettings = {
      maxLossAmount: '100' // 默认100 USDT
    };
    this.updateTimes = {
      trend: null,
      signal: null,
      execution: null,
      ict: null
    };
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.loadUserSettings();

    // 动态加载交易对列表
    await this.loadSymbolsList();

    // 检查页面加载类型
    const urlParams = new URLSearchParams(window.location.search);
    const forceRefresh = urlParams.get('force') === '1' || urlParams.get('cleared') === '1' || urlParams.get('reset') === '1';
    const fromCache = urlParams.get('cache') === '1';
    const isFirstLoad = !sessionStorage.getItem('smartflow_initialized');

    console.log('🔍 页面加载类型检测:', {
      forceRefresh,
      fromCache,
      isFirstLoad,
      urlParams: Object.fromEntries(urlParams),
      symbolsCount: this.allSymbols.length
    });

    if (forceRefresh || isFirstLoad) {
      // 强制刷新或首次加载：清除缓存，从数据库加载
      console.log('🔄 强制刷新/首次加载，从数据库加载数据');
      this.loadInitialData();
      sessionStorage.setItem('smartflow_initialized', 'true');
    } else if (fromCache) {
      // 从其他页面返回：只使用缓存数据，不刷新
      console.log('📦 从其他页面返回，只使用缓存数据，不刷新');
      await this.loadDataFromCacheOnly();
    } else {
      // 正常加载：先尝试缓存，再刷新
      console.log('🔄 正常加载，先尝试缓存，再刷新');
      await this.loadDataFromCache();
    }

    // 启动监控数据自动刷新
    this.startMonitoringRefresh();
  }

  // 加载用户设置
  async loadUserSettings() {
    try {
      const settings = await window.apiClient.getUserSettings();
      if (settings) {
        this.userSettings = { ...this.userSettings, ...settings };

        // 应用设置到UI - V3策略
        const maxLossAmountElement = document.getElementById('maxLossAmount');
        if (maxLossAmountElement && this.userSettings.maxLossAmount) {
          maxLossAmountElement.value = this.userSettings.maxLossAmount;
          console.log('✅ V3策略最大损失金额已加载:', this.userSettings.maxLossAmount);
        }

        // 应用设置到UI - ICT策略
        const ictMaxLossAmountElement = document.getElementById('ictMaxLossAmount');
        if (ictMaxLossAmountElement && this.userSettings.maxLossAmount) {
          ictMaxLossAmountElement.value = this.userSettings.maxLossAmount;
          console.log('✅ ICT策略最大损失金额已加载:', this.userSettings.maxLossAmount);
        }
      }
    } catch (error) {
      console.warn('加载用户设置失败，使用默认值:', error);
    }
  }

  // 动态加载交易对列表
  async loadSymbolsList() {
    try {
      const symbols = await window.apiClient.getSymbols();
      this.allSymbols = symbols.map(s => s.symbol);
      console.log('✅ 交易对列表加载完成:', this.allSymbols);
    } catch (error) {
      console.warn('加载交易对列表失败，使用默认值:', error.message);
      // 使用默认交易对列表
      this.allSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT'];
    }
  }

  // 保存用户设置
  async saveUserSetting(key, value) {
    try {
      this.userSettings[key] = value;
      await window.apiClient.setUserSetting(key, value);
      console.log(`✅ 设置保存成功: ${key} = ${value}`);
    } catch (error) {
      console.error(`❌ 保存设置失败: ${key} = ${value}`, error);
    }
  }

  // 设置事件监听器
  setupEventListeners() {
    // 策略切换按钮
    document.querySelectorAll('.strategy-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const strategy = tab.dataset.strategy;
        this.switchStrategy(strategy);
      });
    });

    // 最大损失金额设置
    const maxLossAmountElement = document.getElementById('maxLossAmount');
    if (maxLossAmountElement) {
      maxLossAmountElement.addEventListener('change', async (e) => {
        const value = e.target.value;
        await this.saveUserSetting('maxLossAmount', value);
        console.log('💰 最大损失金额已更新为:', value, 'USDT');

        // 广播全局设置变化事件
        window.dispatchEvent(new CustomEvent('globalSettingsChanged', {
          detail: { maxLossAmount: value }
        }));
      });
    }

    // 监听全局设置变化事件
    window.addEventListener('globalSettingsChanged', (event) => {
      console.log('🔔 全局设置已更新:', event.detail);
      // 可以在这里添加其他需要响应设置变化的逻辑
    });
  }

  async loadInitialData() {
    try {
      this.showLoading(true);
      // 清除所有缓存，强制刷新数据
      if (window.dataManager) {
        window.dataManager.clearCache();
      }
      await this.loadAllData();
    } catch (error) {
      console.error('❌ 初始数据加载失败:', error);
      this.showError('数据加载失败: ' + error.message);
    } finally {
      this.showLoading(false);
    }
  }

  async loadAllData() {
    try {
      console.log('🔍 开始loadAllData，检查API客户端状态...');
      console.log('window.apiClient:', window.apiClient);
      console.log('typeof window.apiClient:', typeof window.apiClient);

      // 确保API客户端已初始化
      if (!window.apiClient) {
        console.error('❌ API客户端未初始化');
        this.showError('API客户端未初始化，请刷新页面重试');
        return;
      }

      // 初始化DataManager
      if (!window.dataManager) {
        console.log('🔧 初始化DataManager...');
        window.dataManager = new DataManager();
      }

      // 并行加载所有数据，包括更新时间
      const [signals, stats, updateTimes] = await Promise.all([
        window.dataManager.getAllSignals(true), // 强制刷新信号数据
        window.dataManager.getWinRateStats(),
        window.apiClient.getUpdateTimes().catch(error => {
          console.warn('获取更新时间失败，使用当前时间:', error);
          const now = new Date().toISOString();
          return { trend: now, signal: now, execution: now };
        })
      ]);

      console.log('📊 数据加载完成:', {
        signalsCount: signals.length,
        stats: stats,
        updateTimes: updateTimes
      });

      // 更新更新时间
      if (updateTimes) {
        this.updateTimes.trend = new Date(updateTimes.trend);
        this.updateTimes.signal = new Date(updateTimes.signal);
        this.updateTimes.execution = new Date(updateTimes.execution);
        console.log('✅ 更新时间已设置:', this.updateTimes);
      }

      // 更新UI - 处理API响应结构
      const statsData = stats && stats.data ? stats.data : stats;
      this.updateStatsDisplay(signals, statsData);
      this.updateSignalsTable(signals);

      // 保存到缓存
      this.saveDataToCache(signals, stats);

      // 更新UI时间戳
      this.updateTimestamp();

      // 检查模拟交易触发条件
      await this.checkSimulationTriggers();

    } catch (error) {
      console.error('❌ 数据加载失败:', error);
      this.showError('数据加载失败: ' + error.message);
    }
  }

  // 只从缓存加载数据，不刷新（用于从其他页面返回）
  async loadDataFromCacheOnly() {
    try {
      const cachedData = localStorage.getItem('smartflow_cached_data');
      if (cachedData) {
        const { signals, stats, updateTimes, timestamp } = JSON.parse(cachedData);
        const now = Date.now();
        const cacheAge = now - timestamp;
        const maxAge = 5 * 60 * 1000; // 5分钟

        if (cacheAge < maxAge) {
          console.log('📦 使用缓存数据，缓存年龄:', Math.round(cacheAge / 1000), '秒');
          this.updateStatsDisplay(signals, stats);
          this.updateSignalsTable(signals);
          this.updateTimes = updateTimes || {};
          this.updateTimestamp();
          return;
        }
      }

      // 缓存过期或不存在，加载新数据
      console.log('📦 缓存过期或不存在，加载新数据');
      await this.loadAllData();
    } catch (error) {
      console.error('❌ 缓存数据加载失败:', error);
      await this.loadAllData();
    }
  }

  // 从缓存加载数据
  async loadDataFromCache() {
    try {
      const cachedData = localStorage.getItem('smartflow_cached_data');
      if (cachedData) {
        const { signals, stats, updateTimes, timestamp } = JSON.parse(cachedData);
        const now = Date.now();
        const cacheAge = now - timestamp;
        const maxAge = 2 * 60 * 1000; // 2分钟

        if (cacheAge < maxAge) {
          console.log('📦 使用缓存数据，缓存年龄:', Math.round(cacheAge / 1000), '秒');
          this.updateStatsDisplay(signals, stats);
          this.updateSignalsTable(signals);
          this.updateTimes = updateTimes || {};
          this.updateTimestamp();
        }
      }

      // 无论缓存如何，都尝试刷新数据
      console.log('🔄 刷新数据...');
      await this.loadAllData();
    } catch (error) {
      console.error('❌ 数据加载失败:', error);
      this.showError('数据加载失败: ' + error.message);
    }
  }

  // 保存数据到缓存
  saveDataToCache(signals, stats) {
    try {
      const cacheData = {
        signals,
        stats,
        updateTimes: this.updateTimes,
        timestamp: Date.now()
      };
      localStorage.setItem('smartflow_cached_data', JSON.stringify(cacheData));
      console.log('💾 数据已保存到缓存');
    } catch (error) {
      console.warn('保存缓存失败:', error);
    }
  }

  // 清除缓存并刷新
  async clearCacheAndRefresh() {
    try {
      console.log('🗑️ 清除缓存并刷新数据...');
      localStorage.removeItem('smartflow_cached_data');
      if (window.dataManager) {
        window.dataManager.clearCache();
      }

      // 显示加载状态
      this.showLoading(true);

      // 重新加载数据
      await this.loadAllData();
      console.log('✅ 缓存清除并刷新完成');
    } catch (error) {
      console.error('❌ 清除缓存并刷新失败:', error);
      this.showError('清除缓存并刷新失败: ' + error.message);
    } finally {
      this.showLoading(false);
    }
  }

  // 启动监控数据自动刷新（2分钟一次，匹配15min信号更新频率）
  startMonitoringRefresh() {
    this.monitoringInterval = setInterval(async () => {
      try {
        console.log('🔄 监控数据自动刷新开始...');
        // 静默刷新监控数据，不显示加载状态和消息
        const [signals, stats] = await Promise.all([
          window.dataManager.getAllSignals(true), // 强制刷新信号数据
          window.dataManager.getWinRateStats()
        ]);

        this.updateStatsDisplay(signals, stats);
        this.updateSignalsTable(signals);
        this.updateTimes.trend = new Date();
        this.updateTimes.signal = new Date();
        this.updateTimes.execution = new Date();
        this.updateTimestamp();
        this.saveDataToCache(signals, stats);

        // 检查模拟交易触发条件
        await this.checkSimulationTriggers();

        console.log('✅ 监控数据自动刷新完成');
      } catch (error) {
        console.error('❌ 监控数据自动刷新失败:', error);
      }
    }, 120000); // 2分钟 = 120000毫秒，匹配15min信号更新频率

    // 启动15min信号变化检测（每30秒检查一次）
    this.signalChangeInterval = setInterval(async () => {
      try {
        await this.checkSignalChanges();
      } catch (error) {
        console.error('❌ 信号变化检测失败:', error);
      }
    }, 30000); // 30秒检查一次
  }

  // 检查15min信号变化
  async checkSignalChanges() {
    try {
      // 使用新的数据变化状态API
      const response = await fetch('/api/data-change-status');
      const result = await response.json();

      if (result.success) {
        const changeStatus = result.data;
        let hasChanges = false;

        // 检查是否有新的15min信号
        for (const [symbol, status] of Object.entries(changeStatus)) {
          if (status.hasNew15minSignal) {
            console.log(`🆕 检测到新的15min信号: ${symbol}`);
            hasChanges = true;
          }
        }

        if (hasChanges) {
          console.log('🔄 检测到信号变化，刷新数据...');
          // 静默刷新数据
          const [signals, stats] = await Promise.all([
            dataManager.getAllSignals(true),
            dataManager.getWinRateStats()
          ]);

          this.updateStatsDisplay(signals, stats);
          this.updateSignalsTable(signals);
          this.updateTimes.trend = new Date();
          this.updateTimes.signal = new Date();
          this.updateTimes.execution = new Date();
          this.updateTimestamp();
          this.saveDataToCache(signals, stats);

          // 检查模拟交易触发条件
          await this.checkSimulationTriggers();
        }
      }
    } catch (error) {
      console.error('❌ 检查信号变化失败:', error);
    }
  }

  /**
   * 检查模拟交易触发条件
   * 只在15分钟入场时机出现时触发
   */
  async checkSimulationTriggers() {
    try {
      console.log('🔍 检查模拟交易触发条件...');

      // 获取最新信号数据
      const signals = await window.dataManager.getAllSignals();

      // 检查是否有新的入场执行信号
      await this.checkAndAutoTriggerSimulation(signals);

    } catch (error) {
      console.error('❌ 检查模拟交易触发条件失败:', error);
    }
  }

  /**
   * 检查并自动触发模拟交易
   * 当检测到新的入场执行信号时，自动启动模拟交易
   */
  async checkAndAutoTriggerSimulation(signals) {
    try {
      // 获取当前已触发的模拟交易记录
      const currentHistory = await window.dataManager.getSimulationHistory();

      // 创建已触发信号的映射，基于交易对+策略类型+时间窗口（最近10分钟）
      const triggeredSignals = new Map();
      const now = Date.now();
      const timeWindow = 10 * 60 * 1000; // 10分钟

      currentHistory.forEach(record => {
        const recordTime = new Date(record.created_at).getTime();
        if (now - recordTime < timeWindow) {
          const key = `${record.symbol}_${record.strategy_type || 'V3'}_${record.direction || 'LONG'}`;
          triggeredSignals.set(key, record);
        }
      });

      // 检查当前信号是否有新的入场执行信号
      for (const signal of signals) {
        let shouldTrigger = false;
        let signalType = 'LONG';
        let strategyType = signal.strategyVersion || 'V3';

        // V3策略信号检查
        if (signal.execution && (signal.execution.includes('做多_') || signal.execution.includes('做空_'))) {
          signalType = signal.execution.includes('做多_') ? 'LONG' : 'SHORT';
          shouldTrigger = true;
        }
        // ICT策略信号检查
        else if (signal.signalType && signal.signalType !== 'WAIT' && signal.signalType !== '观望') {
          signalType = signal.signalType.includes('LONG') ? 'LONG' : 'SHORT';
          shouldTrigger = true;
        }

        if (shouldTrigger) {
          const key = `${signal.symbol}_${strategyType}_${signalType}`;

          if (!triggeredSignals.has(key)) {
            console.log(`🚀 检测到新的入场执行信号: ${signal.symbol} ${strategyType} ${signalType}`);
            await this.autoStartSimulation(signal);
          } else {
            console.log(`⏭️ 跳过 ${signal.symbol} ${strategyType} ${signalType}：最近10分钟内已有模拟交易`);
          }
        }
      }
    } catch (error) {
      console.error('❌ 检查自动触发模拟交易失败:', error);
    }
  }

  /**
   * 检查并自动触发ICT模拟交易
   */
  async checkAndAutoTriggerICTSimulation(signals) {
    try {
      // 获取当前已触发的模拟交易记录
      const currentHistory = await window.dataManager.getSimulationHistory();

      // 创建已触发信号的映射，基于交易对+时间窗口（最近10分钟）
      const triggeredSignals = new Map();
      const now = Date.now();
      const timeWindow = 10 * 60 * 1000; // 10分钟

      currentHistory.forEach(record => {
        const recordTime = new Date(record.created_at).getTime();
        if (now - recordTime < timeWindow) {
          const key = `${record.symbol}_${record.direction || record.signal_type}`;
          triggeredSignals.set(key, record);
        }
      });

      // 检查ICT信号是否有新的入场信号
      for (const signal of signals) {
        if (signal.signalType && signal.signalType !== 'WAIT' && signal.entryPrice) {
          const direction = signal.signalType.includes('LONG') ? 'LONG' : 'SHORT';
          const key = `${signal.symbol}_${direction}`;

          if (!triggeredSignals.has(key)) {
            console.log(`🎯 检测到新的ICT入场信号: ${signal.symbol} ${direction}`);
            await this.autoStartICTSimulation(signal);
          }
        }
      }
    } catch (error) {
      console.error('❌ 检查ICT自动触发模拟交易失败:', error);
    }
  }

  /**
   * 自动启动ICT模拟交易
   */
  async autoStartICTSimulation(signalData) {
    try {
      const direction = signalData.signalType.includes('LONG') ? 'LONG' : 'SHORT';
      const stopLossDistance = signalData.stopLoss ? Math.abs(signalData.entryPrice - signalData.stopLoss) : 0;

      const tradeData = {
        symbol: signalData.symbol,
        entryPrice: signalData.entryPrice,
        stopLoss: signalData.stopLoss,
        takeProfit: signalData.takeProfit,
        direction: direction,
        signalType: signalData.signalType,
        strategyType: 'ICT',
        stopLossDistance: stopLossDistance,
        executionMode: signalData.executionMode || signalData.signalType
      };

      const result = await window.apiClient.startSimulation(tradeData);
      
      if (result.success) {
        console.log(`✅ ICT模拟交易已自动启动: ${signalData.symbol} ${direction}`, result);
        this.showSuccess(`ICT模拟交易已启动: ${signalData.symbol} ${direction}`);
      }
    } catch (error) {
      console.error('❌ ICT自动启动模拟交易失败:', error);
    }
  }

  /**
   * 自动启动模拟交易
   */
  async autoStartSimulation(signalData) {
    try {
      // 确定方向和策略类型
      let direction = 'LONG';
      let strategyType = signalData.strategyVersion || 'V3';
      
      if (signalData.execution) {
        // V3策略
        direction = signalData.execution.includes('做多_') ? 'LONG' : 'SHORT';
      } else if (signalData.signalType) {
        // ICT策略
        direction = signalData.signalType.includes('LONG') ? 'LONG' : 'SHORT';
      }
      
      // 使用信号数据中的价格信息
      const entryPrice = signalData.entrySignal || signalData.entryPrice || signalData.currentPrice;
      const stopLoss = signalData.stopLoss;
      const takeProfit = signalData.takeProfit;
      
      // 计算止损距离
      const stopLossDistance = stopLoss ? Math.abs(entryPrice - stopLoss) / entryPrice * 100 : 0;

      console.log(`🤖 自动启动模拟交易: ${signalData.symbol} ${strategyType} ${direction}`);
      console.log(`   入场价格: ${entryPrice}, 止损: ${stopLoss}, 止盈: ${takeProfit}`);
      
      // 调用批量触发API，让服务器端处理策略逻辑
      const response = await window.apiClient.request('/api/simulation/trigger-all', {
        method: 'POST',
        body: JSON.stringify({ 
          symbol: signalData.symbol,
          strategy: strategyType,
          direction: direction 
        })
      });
      
      console.log('✅ 模拟交易触发成功:', response);
    } catch (error) {
      console.error('❌ 自动启动模拟交易失败:', error);
    }
  }

  // 创建模拟交易
  async createSimulation(tradeData) {
    try {
      const response = await window.apiClient.createSimulation(tradeData);
      console.log('✅ 模拟交易创建成功:', response);
      return response;
    } catch (error) {
      console.error('❌ 创建模拟交易失败:', error);
      throw error;
    }
  }

  // 更新统计信息显示
  updateStatsDisplay(signals, stats) {
    console.log('🔍 updateStatsDisplay 被调用:', { signalsLength: signals?.length, stats });

    // 更新信号统计
    const totalSignals = signals?.length || 0;
    const longSignals = signals?.filter(s => s.signal === 'LONG' || s.signal === '做多' || s.execution?.includes('做多_')).length || 0;
    const shortSignals = signals?.filter(s => s.signal === 'SHORT' || s.signal === '做空' || s.execution?.includes('做空_')).length || 0;
    const executionSignals = signals?.filter(s => s.execution && (s.execution.includes('做多_') || s.execution.includes('做空_'))).length || 0;

    // 安全地更新DOM元素
    const totalSignalsEl = document.getElementById('totalSignals');
    const longSignalsEl = document.getElementById('longSignals');
    const shortSignalsEl = document.getElementById('shortSignals');

    console.log('🔍 DOM元素查找结果:', {
      totalSignalsEl: !!totalSignalsEl,
      longSignalsEl: !!longSignalsEl,
      shortSignalsEl: !!shortSignalsEl
    });

    if (totalSignalsEl) {
      totalSignalsEl.textContent = totalSignals;
      console.log('✅ 更新总信号数:', totalSignals);
    } else {
      console.error('❌ 找不到totalSignals元素');
    }

    if (longSignalsEl) {
      longSignalsEl.textContent = longSignals;
      console.log('✅ 更新多头信号数:', longSignals);
    } else {
      console.error('❌ 找不到longSignals元素');
    }

    if (shortSignalsEl) {
      shortSignalsEl.textContent = shortSignals;
      console.log('✅ 更新空头信号数:', shortSignals);
    } else {
      console.error('❌ 找不到shortSignals元素');
    }

    console.log('📊 更新统计信息:', {
      totalSignals,
      longSignals,
      shortSignals,
      executionSignals
    });

    // 强制更新DOM元素内容
    if (totalSignalsEl) {
      totalSignalsEl.textContent = totalSignals.toString();
      totalSignalsEl.innerHTML = totalSignals.toString();
    }
    if (longSignalsEl) {
      longSignalsEl.textContent = longSignals.toString();
      longSignalsEl.innerHTML = longSignals.toString();
    }
    if (shortSignalsEl) {
      shortSignalsEl.textContent = shortSignals.toString();
      shortSignalsEl.innerHTML = shortSignals.toString();
    }

    // 更新胜率统计
    if (stats) {
      const winRateEl = document.getElementById('winRate');
      const winRateDetailsEl = document.getElementById('winRateDetails');

      if (winRateEl) {
        const winRate = stats.winRate || stats.win_rate || 0;
        winRateEl.textContent = winRate > 0 ? `${winRate.toFixed(1)}%` : '0%';
        console.log('✅ 更新胜率显示:', winRate);
      }

      if (winRateDetailsEl) {
        const totalTrades = stats.totalTrades || stats.total_trades || 0;
        const winTrades = stats.winTrades || stats.winning_trades || 0;
        winRateDetailsEl.textContent = `${winTrades}/${totalTrades}`;
        console.log('✅ 更新胜率详情:', `${winTrades}/${totalTrades}`);
      }
    }
  }

  // 更新信号表格
  updateSignalsTable(signals) {
    console.log('🔍 updateSignalsTable 被调用:', { signalsLength: signals?.length });

    const tbody = document.querySelector('#signalsTable tbody');
    console.log('🔍 找到表格tbody元素:', !!tbody);

    if (!tbody) {
      console.error('❌ 找不到signalsTable tbody元素');
      return;
    }

    tbody.innerHTML = '';
    console.log('✅ 清空表格内容');

    signals.forEach((signal, index) => {
      console.log(`🔍 处理信号 ${index + 1}:`, signal.symbol);
      const row = this.createSignalRow(signal);
      tbody.appendChild(row);
    });

    console.log('✅ 表格更新完成，共添加', signals.length, '行');

    // 检查表格滚动性
    this.checkTableScrollability();
  }

  // 创建信号行
  createSignalRow(signal) {
    const tr = document.createElement('tr');

    // 根据信号类型添加样式
    if (signal.signal === 'LONG' || signal.signal === '做多') {
      tr.classList.add('signal-long');
    } else if (signal.signal === 'SHORT' || signal.signal === '做空') {
      tr.classList.add('signal-short');
    }

    tr.innerHTML = `
      <td><button class="expand-btn" onclick="toggleHistory('${signal.symbol}')" title="查看详细信息">+</button></td>
      <td><strong>${signal.symbol}</strong></td>
      <td class="category-${signal.category}">${this.getCategoryDisplay(signal.category)}</td>
      <td class="score-${signal.score4h >= 4 ? 'high' : 'low'}">${signal.score4h || 0}</td>
      <td class="trend-${signal.trend4h?.toLowerCase() || 'none'}">${signal.trend4h || '--'}</td>
      <td class="score-${signal.score1h >= 3 ? 'high' : 'low'}">${signal.score1h || 0}</td>
      <td class="trend-${signal.trendStrength?.toLowerCase() || 'none'}">${signal.trendStrength || '--'}</td>
      <td class="signal-${signal.signal?.toLowerCase() || 'none'}">${signal.signal || '--'}</td>
      <td class="price-cell">${signal.currentPrice ? signal.currentPrice.toFixed(4) : '--'}</td>
      <td class="rate-cell ${this.getDataRateClass(signal.dataCollectionRate)}">${signal.dataCollectionRate?.toFixed(1) || 0}%</td>
    `;

    return tr;
  }

  // 获取分类显示名称
  getCategoryDisplay(category) {
    const categoryMap = {
      'high-cap-trending': '高市值趋势币',
      'mainstream': '主流币',
      'trending': '热点币',
      'smallcap': '小币',
      'altcoin': '山寨币',
      'meme': 'Meme币',
      'defi': 'DeFi',
      'layer1': 'Layer1',
      'layer2': 'Layer2',
      'unknown': '未知'
    };
    return categoryMap[category] || category || '未知';
  }

  // 获取数据收集率样式类
  getDataRateClass(rate) {
    if (rate >= 90) return 'rate-excellent';
    if (rate >= 70) return 'rate-good';
    if (rate >= 50) return 'rate-fair';
    return 'rate-poor';
  }

  // 更新时间戳
  updateTimestamp() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-CN');

    // 更新主要的最后更新时间
    const lastUpdateEl = document.getElementById('lastUpdate');
    const updateTimeEl = document.getElementById('updateTime');

    if (lastUpdateEl) lastUpdateEl.textContent = timeStr;
    if (updateTimeEl) updateTimeEl.textContent = timeStr;

    // 更新各个层级的更新时间
    const trendUpdateTimeEl = document.getElementById('trendUpdateTime');
    const signalUpdateTimeEl = document.getElementById('signalUpdateTime');
    const executionUpdateTimeEl = document.getElementById('executionUpdateTime');

    if (trendUpdateTimeEl) {
      const trendTime = this.updateTimes.trend ? new Date(this.updateTimes.trend).toLocaleTimeString('zh-CN') : timeStr;
      trendUpdateTimeEl.textContent = trendTime;
      console.log('✅ 更新趋势时间:', trendTime);
    }

    if (signalUpdateTimeEl) {
      const signalTime = this.updateTimes.signal ? new Date(this.updateTimes.signal).toLocaleTimeString('zh-CN') : timeStr;
      signalUpdateTimeEl.textContent = signalTime;
      console.log('✅ 更新信号时间:', signalTime);
    }

    if (executionUpdateTimeEl) {
      const executionTime = this.updateTimes.execution ? new Date(this.updateTimes.execution).toLocaleTimeString('zh-CN') : timeStr;
      executionUpdateTimeEl.textContent = executionTime;
      console.log('✅ 更新执行时间:', executionTime);
    }
  }

  // 显示加载状态
  showLoading(message = '加载中...') {
    this.isLoading = true;
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
      loadingElement.textContent = message;
      loadingElement.style.display = 'block';
    }
  }

  // 隐藏加载状态
  hideLoading() {
    this.isLoading = false;
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }
  }

  // 显示错误消息
  showError(message) {
    console.error('❌', message);
    // 可以在这里添加错误提示UI
  }

  // 显示成功消息
  showSuccess(message) {
    console.log('✅', message);
    // 可以在这里添加成功提示UI
  }

  // 检查表格滚动性
  checkTableScrollability() {
    const containers = document.querySelectorAll('.table-container');
    containers.forEach(container => {
      const table = container.querySelector('table');
      if (!table) return;

      const tableWidth = table.scrollWidth;
      const containerWidth = container.clientWidth;

      if (tableWidth > containerWidth) {
        container.classList.add('scrollable');
      } else {
        container.classList.remove('scrollable');
      }
    });
  }

  /**
   * 策略切换方法
   */
  switchStrategy(strategy) {
    if (this.currentStrategy === strategy) return;

    console.log(`🔄 切换策略: ${this.currentStrategy} -> ${strategy}`);

    // 更新当前策略
    this.currentStrategy = strategy;

    // 更新选项卡状态
    document.querySelectorAll('.strategy-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.strategy === strategy);
    });

    // 切换内容显示
    document.querySelectorAll('.strategy-content').forEach(content => {
      content.classList.toggle('active', content.id === `${strategy}-content`);
    });

    // 根据策略加载相应数据
    if (strategy === 'trend') {
      this.loadAllData();
    } else if (strategy === 'ict') {
      this.loadICTData();
    }
  }

  /**
   * 加载ICT策略数据
   */
  async loadICTData() {
    try {
      this.showLoading('正在加载ICT策略数据...');

      const data = await window.apiClient.fetchICTSignals();
      console.log('📊 ICT数据加载完成:', data);

      this.renderICTSignals(data);
      this.updateICTStats(data);
      this.updateTimes.ict = new Date();
      this.updateICTTimestamp();
      
      // ICT策略自动触发模拟交易检查
      await this.checkAndAutoTriggerICTSimulation(data);

    } catch (error) {
      console.error('❌ ICT数据加载失败:', error);
      this.showError('ICT数据加载失败: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  /**
   * 渲染ICT信号表格
   */
  renderICTSignals(signals) {
    const tbody = document.querySelector('#ictSignalsTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    signals.forEach(signal => {
      const row = this.createICTSignalRow(signal);
      tbody.appendChild(row);
    });

    // 检查表格列数
    this.checkTableColumns();
  }

  /**
   * 检查表格列数
   */
  checkTableColumns() {
    const table = document.getElementById('ictSignalsTable');
    const columnCountEl = document.getElementById('columnCount');

    if (table && columnCountEl) {
      const headerRow = table.querySelector('thead tr');
      const dataRow = table.querySelector('tbody tr');

      const headerCols = headerRow ? headerRow.children.length : 0;
      const dataCols = dataRow ? dataRow.children.length : 0;

      columnCountEl.innerHTML = `表头: ${headerCols}列, 数据行: ${dataCols}列`;

      console.log('🔍 表格列数检查:', {
        headerCols,
        dataCols,
        expected: 16
      });
    }
  }

  /**
   * 创建ICT信号行
   */
  createICTSignalRow(signal) {
    const tr = document.createElement('tr');

    // 根据信号类型添加样式
    if (signal.signalType === 'LONG') {
      tr.classList.add('signal-long');
    } else if (signal.signalType === 'SHORT') {
      tr.classList.add('signal-short');
    }

    tr.innerHTML = `
      <td class="symbol-cell">${signal.symbol}</td>
      <td class="category-${signal.category}">${this.getCategoryDisplay(signal.category)}</td>
      <td class="trend-cell ${signal.dailyTrend}">${signal.dailyTrend || '--'}</td>
      <td class="signal-${signal.signalType?.toLowerCase()}">${signal.signalType || '--'}</td>
      <td class="strength-${signal.signalStrength?.toLowerCase()}">${signal.signalStrength || '--'}</td>
      <td class="execution-mode">${signal.executionMode || '--'}</td>
      <td class="indicator-${signal.obDetected ? 'yes' : 'no'}">${signal.obDetected ? '✅' : '❌'}</td>
      <td class="indicator-${signal.fvgDetected ? 'yes' : 'no'}">${signal.fvgDetected ? '✅' : '❌'}</td>
      <td class="indicator-${signal.engulfingDetected ? 'yes' : 'no'}">${signal.engulfingDetected ? '✅' : '❌'}</td>
      <td class="indicator-${signal.sweepLTF ? 'yes' : 'no'}">${signal.sweepLTF ? '✅' : '❌'}</td>
      <td class="price-cell">${signal.entryPrice ? signal.entryPrice.toFixed(4) : '--'}</td>
      <td class="price-cell">${signal.stopLoss ? signal.stopLoss.toFixed(4) : '--'}</td>
      <td class="price-cell">${signal.takeProfit ? signal.takeProfit.toFixed(4) : '--'}</td>
      <td class="rr-cell">${signal.riskRewardRatio ? signal.riskRewardRatio.toFixed(2) : '--'}</td>
      <td class="rate-cell ${this.getDataRateClass(signal.dataCollectionRate)}">${signal.dataCollectionRate?.toFixed(1) || 0}%</td>
      <td class="action-cell">
        ${signal.signalType && signal.signalType !== 'NONE' ?
        `<button class="btn-trade" onclick="app.createICTSimulation('${signal.symbol}', ${signal.entryPrice}, ${signal.stopLoss}, ${signal.takeProfit}, '${signal.signalType}', '${signal.executionMode}')"> 📈 模拟交易</button>` :
        '--'
      }
      </td>
    `;

    return tr;
  }

  /**
   * 更新ICT统计信息
   */
  async updateICTStats(signals) {
    const totalSignals = signals.length;
    const longSignals = signals.filter(s => s.signalType && s.signalType.includes('LONG')).length;
    const shortSignals = signals.filter(s => s.signalType && s.signalType.includes('SHORT')).length;

    const ictTotalSignalsEl = document.getElementById('ictTotalSignals');
    const ictLongSignalsEl = document.getElementById('ictLongSignals');
    const ictShortSignalsEl = document.getElementById('ictShortSignals');

    if (ictTotalSignalsEl) ictTotalSignalsEl.textContent = totalSignals;
    if (ictLongSignalsEl) ictLongSignalsEl.textContent = longSignals;
    if (ictShortSignalsEl) ictShortSignalsEl.textContent = shortSignals;

    // 获取ICT策略胜率统计
    try {
      const stats = await window.dataManager.getWinRateStats();
      const statsData = stats && stats.data ? stats.data : stats;
      
      // 从统计数据中提取ICT策略的胜率（如果有按策略分组的数据）
      if (statsData && statsData.byStrategy && statsData.byStrategy.ICT) {
        const ictStats = statsData.byStrategy.ICT;
        const ictWinRateEl = document.getElementById('ictWinRate');
        const ictWinRateDetailsEl = document.getElementById('ictWinRateDetails');
        
        if (ictWinRateEl) {
          const winRate = ictStats.winRate || ictStats.win_rate || 0;
          ictWinRateEl.textContent = winRate > 0 ? `${winRate.toFixed(1)}%` : '0%';
          console.log('✅ 更新ICT策略胜率显示:', winRate);
        }
        
        if (ictWinRateDetailsEl) {
          const totalTrades = ictStats.totalTrades || ictStats.total_trades || 0;
          const winTrades = ictStats.winTrades || ictStats.winning_trades || 0;
          ictWinRateDetailsEl.textContent = `${winTrades}/${totalTrades}`;
          console.log('✅ 更新ICT策略胜率详情:', `${winTrades}/${totalTrades}`);
        }
      } else {
        // 如果没有按策略分组的数据，使用整体数据作为ICT策略数据
        const ictWinRateEl = document.getElementById('ictWinRate');
        const ictWinRateDetailsEl = document.getElementById('ictWinRateDetails');
        
        if (ictWinRateEl) {
          const winRate = statsData.winRate || statsData.win_rate || 0;
          ictWinRateEl.textContent = winRate > 0 ? `${winRate.toFixed(1)}%` : '0%';
        }
        
        if (ictWinRateDetailsEl) {
          const totalTrades = statsData.totalTrades || statsData.total_trades || 0;
          const winTrades = statsData.winTrades || statsData.winning_trades || 0;
          ictWinRateDetailsEl.textContent = `${winTrades}/${totalTrades}`;
        }
      }
    } catch (error) {
      console.error('获取ICT策略胜率统计失败:', error);
    }
  }

  /**
   * 更新ICT时间戳
   */
  updateICTTimestamp() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-CN');

    const ictLastUpdateEl = document.getElementById('ictLastUpdate');
    const ictUpdateTimeEl = document.getElementById('ictUpdateTime');
    
    // 更新高时间框架更新时间（1D趋势分析）
    const htfUpdateTimeEl = document.getElementById('htfUpdateTime');
    
    // 更新低时间框架更新时间（15m入场确认）
    const ltfUpdateTimeEl = document.getElementById('ltfUpdateTime');

    if (ictLastUpdateEl) ictLastUpdateEl.textContent = timeStr;
    if (ictUpdateTimeEl) ictUpdateTimeEl.textContent = timeStr;
    if (htfUpdateTimeEl) htfUpdateTimeEl.textContent = timeStr;
    if (ltfUpdateTimeEl) ltfUpdateTimeEl.textContent = timeStr;
  }

  /**
   * 创建ICT模拟交易
   */
  async createICTSimulation(symbol, entryPrice, stopLoss, takeProfit, signalType, executionMode) {
    try {
      this.showLoading('正在创建ICT模拟交易...');

      const result = await window.apiClient.createICTSimulation({
        symbol,
        entryPrice,
        stopLoss,
        takeProfit,
        signalType,
        executionMode,
        strategy: 'ICT'
      });

      if (result.success) {
        this.showSuccess(`ICT模拟交易创建成功 [${symbol}]`);
      } else {
        this.showError('ICT模拟交易创建失败: ' + result.message);
      }

    } catch (error) {
      console.error('❌ 创建ICT模拟交易失败:', error);
      this.showError('创建ICT模拟交易失败: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }
}
