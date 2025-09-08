// public/js/data/DataManager.js - 数据管理模块

class DataManager {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30秒缓存
    this.refreshInterval = null;
  }

  // 设置缓存
  setCache(key, data) {
    this.cache.set(key, {
      data: data,
      timestamp: Date.now()
    });
  }

  // 获取缓存
  getCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    // 检查是否过期
    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  // 清除缓存
  clearCache() {
    this.cache.clear();
  }

  // 获取所有信号数据
  async getAllSignals() {
    const cacheKey = 'allSignals';
    let data = this.getCache(cacheKey);

    if (!data) {
      try {
        data = await window.apiClient.getAllSignals();
        this.setCache(cacheKey, data);
      } catch (error) {
        console.error('获取信号数据失败:', error);
        throw error;
      }
    }

    return data;
  }

  // 获取监控数据
  async getMonitoringData() {
    const cacheKey = 'monitoringData';
    let data = this.getCache(cacheKey);

    if (!data) {
      try {
        data = await window.apiClient.getMonitoringDashboard();
        this.setCache(cacheKey, data);
      } catch (error) {
        console.error('获取监控数据失败:', error);
        throw error;
      }
    }

    return data;
  }

  // 获取模拟交易历史
  async getSimulationHistory() {
    const cacheKey = 'simulationHistory';
    let data = this.getCache(cacheKey);

    if (!data) {
      try {
        data = await window.apiClient.getSimulationHistory();
        this.setCache(cacheKey, data);
      } catch (error) {
        console.error('获取模拟交易历史失败:', error);
        throw error;
      }
    }

    return data;
  }

  // 获取胜率统计
  async getWinRateStats() {
    const cacheKey = 'winRateStats';
    let data = this.getCache(cacheKey);

    if (!data) {
      try {
        data = await window.apiClient.getWinRateStats();
        this.setCache(cacheKey, data);
      } catch (error) {
        console.error('获取胜率统计失败:', error);
        throw error;
      }
    }

    return data;
  }

  // 刷新所有数据
  async refreshAllData() {
    try {
      // 清除缓存
      this.clearCache();

      // 刷新所有信号
      await window.apiClient.refreshAllSignals();

      // 重新获取数据
      const [signals, monitoring, history, stats] = await Promise.all([
        this.getAllSignals(),
        this.getMonitoringData(),
        this.getSimulationHistory(),
        this.getWinRateStats()
      ]);

      return { signals, monitoring, history, stats };
    } catch (error) {
      console.error('刷新数据失败:', error);
      throw error;
    }
  }

  // 开始自动刷新
  startAutoRefresh(interval = 300000) { // 默认5分钟
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = setInterval(async () => {
      try {
        await this.refreshAllData();
        console.log('数据自动刷新完成');
      } catch (error) {
        console.error('自动刷新失败:', error);
      }
    }, interval);
  }

  // 停止自动刷新
  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  // 格式化数字
  formatNumber(num, decimals = 2) {
    if (typeof num !== 'number' || isNaN(num)) return '0';
    return num.toFixed(decimals);
  }

  // 格式化价格（保留4位小数）
  formatPrice(price) {
    if (typeof price !== 'number' || isNaN(price)) return '0.0000';
    return price.toFixed(4);
  }

  // 格式化百分比
  formatPercentage(num, decimals = 1) {
    if (typeof num !== 'number' || isNaN(num)) return '0%';
    // 对于非常小的数字，使用科学计数法显示
    if (Math.abs(num) < 0.0001 && num !== 0) {
      return `${num.toExponential(4)}%`;
    }
    return `${num.toFixed(decimals)}%`;
  }

  // 格式化时间
  formatTime(timestamp) {
    if (!timestamp) return '--';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN');
  }

  // 获取趋势状态样式
  getTrendClass(trend) {
    switch (trend) {
      case 'UPTREND':
        return 'trend-uptrend';
      case 'DOWNTREND':
        return 'trend-downtrend';
      default:
        return 'trend-range';
    }
  }

  // 获取信号状态样式
  getSignalClass(signal) {
    switch (signal) {
      case 'LONG':
      case '做多':
        return 'signal-long';
      case 'SHORT':
      case '做空':
        return 'signal-short';
      case '观望/不做':
        return 'signal-moderate';
      default:
        return 'signal-no';
    }
  }

  // 获取执行状态样式
  getExecutionClass(execution) {
    if (execution && (execution.includes('EXECUTE') || execution.includes('做多') || execution.includes('做空'))) {
      return 'execution-execute';
    } else if (execution && execution.includes('WAIT')) {
      return 'execution-wait';
    } else {
      return 'execution-no';
    }
  }

  // 测试数据质量告警
  async testDataQualityAlert() {
    try {
      const response = await window.apiClient.testDataQualityAlert();
      return response;
    } catch (error) {
      console.error('测试数据质量告警失败:', error);
      throw error;
    }
  }

  // 获取监控仪表板数据
  async getMonitoringDashboard() {
    const cacheKey = 'monitoringDashboard';
    let data = this.getCache(cacheKey);

    if (!data) {
      try {
        data = await window.apiClient.getMonitoringDashboard();
        this.setCache(cacheKey, data);
      } catch (error) {
        console.error('获取监控仪表板数据失败:', error);
        throw error;
      }
    }

    return data;
  }
}

// 创建全局数据管理器实例
window.dataManager = new DataManager();
