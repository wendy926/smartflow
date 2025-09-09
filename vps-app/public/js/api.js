// public/js/api.js - API调用模块

class APIClient {
  constructor() {
    this.baseURL = '';
  }

  async request(endpoint, options = {}) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API请求失败 ${endpoint}:`, error);
      throw error;
    }
  }

  // 获取交易对列表（轻量级）
  async getSymbols() {
    return await this.request('/api/symbols');
  }

  // 获取所有信号
  async getAllSignals() {
    return await this.request('/api/signals');
  }

  // 刷新所有信号
  async refreshAllSignals() {
    return await this.request('/api/refresh-all', { method: 'POST' });
  }

  // 添加交易对
  async addSymbol(symbol) {
    return await this.request('/api/add-symbol', {
      method: 'POST',
      body: JSON.stringify({ symbol })
    });
  }

  // 删除交易对
  async removeSymbol(symbol) {
    return await this.request('/api/remove-symbol', {
      method: 'POST',
      body: JSON.stringify({ symbol })
    });
  }

  // 获取模拟交易历史
  async getSimulationHistory() {
    return await this.request('/api/simulation-history');
  }

  // 获取分页模拟交易历史
  async getSimulationHistoryPaginated(page = 1, pageSize = 20) {
    return await this.request(`/api/simulation-history-paginated?page=${page}&pageSize=${pageSize}`);
  }

  // 获取方向统计
  async getDirectionStats() {
    return await this.request('/api/direction-stats');
  }

  // 获取胜率统计
  async getWinRateStats() {
    return await this.request('/api/win-rate-stats');
  }

  // 获取监控仪表板数据
  async getMonitoringDashboard() {
    return await this.request('/api/monitoring-dashboard');
  }

  // 获取健康检查数据
  async getHealthCheck() {
    return await this.request('/api/health-check');
  }

  // 设置监控阈值
  async setMonitoringThresholds(thresholds) {
    return await this.request('/api/monitoring-thresholds', {
      method: 'POST',
      body: JSON.stringify(thresholds)
    });
  }

  // 测试Telegram通知
  async testTelegramNotification() {
    return await this.request('/api/test-telegram', { method: 'POST' });
  }

  // 测试监控告警
  async testMonitoringAlert() {
    return await this.request('/api/test-monitoring-alert', { method: 'POST' });
  }

  // 测试数据质量告警
  async testDataQualityAlert() {
    return await this.request('/api/test-data-quality-alert', { method: 'POST' });
  }

  // 获取Telegram配置状态
  async getTelegramConfig() {
    return await this.request('/api/telegram-config');
  }

  // 用户设置相关API
  async getUserSettings() {
    return await this.request('/api/user-settings');
  }

  async setUserSetting(key, value) {
    return await this.request('/api/user-settings', {
      method: 'POST',
      body: JSON.stringify({ key, value })
    });
  }

  // 获取数据更新时间
  async getUpdateTimes() {
    return await this.request('/api/update-times');
  }

  // 获取数据质量详情
  async getDataQualityDetails() {
    return await this.request('/api/monitoring-dashboard');
  }
}

// 创建全局API客户端实例
console.log('🔧 正在初始化API客户端...');
window.apiClient = new APIClient();
console.log('✅ API客户端初始化完成:', window.apiClient);
console.log('✅ getUpdateTimes方法:', typeof window.apiClient.getUpdateTimes);
