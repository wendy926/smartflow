/**
 * 真实策略数据展示模块
 * 支持V3和ICT策略的真实分析结果显示
 */

class RealStrategyDisplay {
  constructor() {
    this.apiBaseUrl = window.location.origin;
    this.refreshInterval = 30000; // 30秒刷新一次
    this.isInitialized = false;
  }

  /**
   * 初始化真实策略展示
   */
  async init() {
    try {
      console.log('🔄 初始化真实策略展示...');
      
      // 检查API是否可用
      await this.checkAPIHealth();
      
      // 加载初始数据
      await this.loadAllData();
      
      // 启动自动刷新
      this.startAutoRefresh();
      
      this.isInitialized = true;
      console.log('✅ 真实策略展示初始化完成');
      
    } catch (error) {
      console.error('❌ 真实策略展示初始化失败:', error.message);
    }
  }

  /**
   * 检查API健康状态
   */
  async checkAPIHealth() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/strategy/stats`);
      if (!response.ok) {
        throw new Error(`API健康检查失败: ${response.status}`);
      }
      console.log('✅ API健康检查通过');
    } catch (error) {
      console.warn('⚠️ API健康检查失败:', error.message);
      throw error;
    }
  }

  /**
   * 加载所有数据
   */
  async loadAllData() {
    try {
      console.log('🔄 加载真实策略数据...');
      
      // 并行加载各种数据
      const [v3Signals, ictSignals, stats, simulations] = await Promise.all([
        this.loadV3Signals(),
        this.loadICTSignals(),
        this.loadStrategyStats(),
        this.loadSimulations()
      ]);
      
      // 更新页面显示
      this.updateV3Display(v3Signals);
      this.updateICTDisplay(ictSignals);
      this.updateStatsDisplay(stats);
      this.updateSimulationsDisplay(simulations);
      
      console.log('✅ 真实策略数据加载完成');
      
    } catch (error) {
      console.error('❌ 加载真实策略数据失败:', error.message);
    }
  }

  /**
   * 加载V3策略信号
   */
  async loadV3Signals() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/signals`);
      const result = await response.json();
      
      if (result.success) {
        return result.data;
      } else {
        console.warn('⚠️ V3信号加载失败:', result.error);
        return [];
      }
    } catch (error) {
      console.error('❌ 加载V3信号失败:', error.message);
      return [];
    }
  }

  /**
   * 加载ICT策略信号
   */
  async loadICTSignals() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/ict/signals`);
      const result = await response.json();
      
      if (result.success) {
        return result.data;
      } else {
        console.warn('⚠️ ICT信号加载失败:', result.error);
        return [];
      }
    } catch (error) {
      console.error('❌ 加载ICT信号失败:', error.message);
      return [];
    }
  }

  /**
   * 加载策略统计
   */
  async loadStrategyStats() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/win-rate-stats`);
      const result = await response.json();
      
      if (result.success) {
        return result.data;
      } else {
        console.warn('⚠️ 策略统计加载失败:', result.error);
        return null;
      }
    } catch (error) {
      console.error('❌ 加载策略统计失败:', error.message);
      return null;
    }
  }

  /**
   * 加载模拟交易数据
   */
  async loadSimulations() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/unified-simulations/history?limit=100`);
      const result = await response.json();
      
      if (result.success) {
        return result.data.simulations;
      } else {
        console.warn('⚠️ 模拟交易数据加载失败:', result.error);
        return [];
      }
    } catch (error) {
      console.error('❌ 加载模拟交易数据失败:', error.message);
      return [];
    }
  }

  /**
   * 更新V3策略显示
   */
  updateV3Display(signals) {
    try {
      // 更新V3策略信号表格
      const tableBody = document.querySelector('#signalsTable tbody');
      if (tableBody) {
        tableBody.innerHTML = '';
        
        signals.forEach(signal => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${signal.symbol}</td>
            <td class="signal-${signal.signal === '做多' ? 'long' : signal.signal === '做空' ? 'short' : 'neutral'}">
              ${signal.signal}
            </td>
            <td>${signal.trend4h || '--'}</td>
            <td>${signal.score4h || '--'}</td>
            <td>${signal.score1h || '--'}</td>
            <td class="strength-${signal.signal_strength}">${signal.signal_strength || '--'}</td>
            <td>${signal.execution || '--'}</td>
            <td>${signal.currentPrice ? signal.currentPrice.toFixed(4) : '--'}</td>
            <td>${signal.timestamp ? new Date(signal.timestamp).toLocaleString() : '--'}</td>
          `;
          tableBody.appendChild(row);
        });
      }

      // 更新V3策略统计
      const v3ActiveSignals = signals.filter(s => s.signal !== '观望' && s.execution !== 'NONE');
      this.updateElement('v3ActiveSignals', v3ActiveSignals.length);
      
      const v3LongSignals = signals.filter(s => s.signal === '做多');
      const v3ShortSignals = signals.filter(s => s.signal === '做空');
      this.updateElement('v3LongSignals', v3LongSignals.length);
      this.updateElement('v3ShortSignals', v3ShortSignals.length);

    } catch (error) {
      console.error('❌ 更新V3显示失败:', error.message);
    }
  }

  /**
   * 更新ICT策略显示
   */
  updateICTDisplay(signals) {
    try {
      // 更新ICT策略信号表格
      const ictTableBody = document.querySelector('#ictSignalsTable tbody');
      if (ictTableBody) {
        ictTableBody.innerHTML = '';
        
        signals.forEach(signal => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${signal.symbol}</td>
            <td class="signal-${signal.signalType}">
              ${signal.signalType}
            </td>
            <td>${signal.dailyTrend || '--'}</td>
            <td>${signal.obDetected ? '是' : '否'}</td>
            <td>${signal.sweepHTF ? '是' : '否'}</td>
            <td>${signal.sweepLTF ? '是' : '否'}</td>
            <td>${signal.engulfingDetected ? '是' : '否'}</td>
            <td class="strength-${signal.signal_strength}">${signal.signal_strength || '--'}</td>
            <td>${signal.currentPrice ? signal.currentPrice.toFixed(4) : '--'}</td>
            <td>${signal.timestamp ? new Date(signal.timestamp).toLocaleString() : '--'}</td>
          `;
          ictTableBody.appendChild(row);
        });
      }

      // 更新ICT策略统计
      const ictActiveSignals = signals.filter(s => s.signalType !== 'WAIT');
      this.updateElement('ictActiveSignals', ictActiveSignals.length);
      
      const ictLongSignals = signals.filter(s => s.signalType.includes('LONG'));
      const ictShortSignals = signals.filter(s => s.signalType.includes('SHORT'));
      this.updateElement('ictLongSignals', ictLongSignals.length);
      this.updateElement('ictShortSignals', ictShortSignals.length);

    } catch (error) {
      console.error('❌ 更新ICT显示失败:', error.message);
    }
  }

  /**
   * 更新统计显示
   */
  updateStatsDisplay(stats) {
    try {
      if (!stats) return;

      // 更新整体统计
      if (stats.overall) {
        this.updateElement('totalTrades', stats.overall.totalTrades);
        this.updateElement('winningTrades', stats.overall.winningTrades);
        this.updateElement('losingTrades', stats.overall.losingTrades);
        this.updateElement('overallWinRate', `${stats.overall.winRate.toFixed(2)}%`);
        this.updateElement('netProfit', `${stats.overall.netProfit.toFixed(4)} USDT`);
      }

      // 更新V3策略统计
      if (stats.byStrategy && stats.byStrategy.V3) {
        const v3Stats = stats.byStrategy.V3;
        this.updateElement('v3TotalTrades', v3Stats.totalTrades);
        this.updateElement('v3WinningTrades', v3Stats.winningTrades);
        this.updateElement('v3LosingTrades', v3Stats.losingTrades);
        this.updateElement('v3WinRate', `${v3Stats.winRate.toFixed(2)}%`);
        this.updateElement('v3NetProfit', `${v3Stats.netProfit.toFixed(4)} USDT`);
      }

      // 更新ICT策略统计
      if (stats.byStrategy && stats.byStrategy.ICT) {
        const ictStats = stats.byStrategy.ICT;
        this.updateElement('ictTotalTrades', ictStats.totalTrades);
        this.updateElement('ictWinningTrades', ictStats.winningTrades);
        this.updateElement('ictLosingTrades', ictStats.losingTrades);
        this.updateElement('ictWinRate', `${ictStats.winRate.toFixed(2)}%`);
        this.updateElement('ictNetProfit', `${ictStats.netProfit.toFixed(4)} USDT`);
      }

    } catch (error) {
      console.error('❌ 更新统计显示失败:', error.message);
    }
  }

  /**
   * 更新模拟交易显示
   */
  updateSimulationsDisplay(simulations) {
    try {
      const tableBody = document.querySelector('#simulationsTable tbody');
      if (!tableBody) return;

      tableBody.innerHTML = '';
      
      simulations.forEach(sim => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${sim.symbol}</td>
          <td class="strategy-${sim.strategyType}">${sim.strategyType}</td>
          <td class="direction-${sim.direction}">${sim.direction}</td>
          <td>${sim.entryPrice ? sim.entryPrice.toFixed(4) : '--'}</td>
          <td>${sim.stopLossPrice ? sim.stopLossPrice.toFixed(4) : '--'}</td>
          <td>${sim.takeProfitPrice ? sim.takeProfitPrice.toFixed(4) : '--'}</td>
          <td>${sim.maxLeverage || '--'}</td>
          <td>${sim.minMargin ? sim.minMargin.toFixed(2) : '--'}</td>
          <td class="status-${sim.status}">${sim.status}</td>
          <td class="${sim.isWin === true ? 'win' : sim.isWin === false ? 'loss' : 'neutral'}">
            ${sim.profitLoss ? sim.profitLoss.toFixed(4) : '--'}
          </td>
          <td>${sim.createdAt ? new Date(sim.createdAt).toLocaleString() : '--'}</td>
        `;
        tableBody.appendChild(row);
      });

    } catch (error) {
      console.error('❌ 更新模拟交易显示失败:', error.message);
    }
  }

  /**
   * 更新页面元素
   */
  updateElement(id, value) {
    try {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    } catch (error) {
      console.warn(`⚠️ 更新元素 ${id} 失败:`, error.message);
    }
  }

  /**
   * 启动自动刷新
   */
  startAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    
    this.refreshTimer = setInterval(() => {
      if (this.isInitialized) {
        this.loadAllData();
      }
    }, this.refreshInterval);
    
    console.log(`🔄 自动刷新已启动，间隔: ${this.refreshInterval / 1000}秒`);
  }

  /**
   * 停止自动刷新
   */
  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
      console.log('⏹️ 自动刷新已停止');
    }
  }

  /**
   * 手动刷新数据
   */
  async refresh() {
    console.log('🔄 手动刷新数据...');
    await this.loadAllData();
  }

  /**
   * 触发策略分析
   */
  async triggerAnalysis(symbol = null) {
    try {
      console.log(`🔄 触发策略分析${symbol ? ` (${symbol})` : ' (所有交易对)'}...`);
      
      const response = await fetch(`${this.apiBaseUrl}/api/strategy/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ symbol })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('✅ 策略分析完成:', result.message);
        // 刷新数据
        await this.loadAllData();
        return true;
      } else {
        console.error('❌ 策略分析失败:', result.error);
        return false;
      }
      
    } catch (error) {
      console.error('❌ 触发策略分析失败:', error.message);
      return false;
    }
  }

  /**
   * 销毁实例
   */
  destroy() {
    this.stopAutoRefresh();
    this.isInitialized = false;
    console.log('🗑️ 真实策略展示已销毁');
  }
}

// 全局实例
window.realStrategyDisplay = new RealStrategyDisplay();

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  window.realStrategyDisplay.init();
});

// 页面卸载前清理
window.addEventListener('beforeunload', () => {
  window.realStrategyDisplay.destroy();
});
