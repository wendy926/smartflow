/**
 * 统一API客户端
 * 自动在请求头中添加Authorization token
 */

class APIClient {
  constructor() {
    this.baseURL = '/api/v1';
  }

  /**
   * 获取认证token
   */
  getToken() {
    return localStorage.getItem('authToken');
  }

  /**
   * 检查是否已登录
   */
  isAuthenticated() {
    return !!this.getToken();
  }

  /**
   * 检查是否需要登录
   */
  checkAuth() {
    if (!this.isAuthenticated()) {
      // 重定向到首页
      window.location.href = '/';
      return false;
    }
    return true;
  }

  /**
   * 发送HTTP请求
   */
  async request(url, options = {}) {
    const token = this.getToken();
    
    // 设置默认headers
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // 如果已登录，添加token
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${this.baseURL}${url}`, {
        ...options,
        headers
      });

      // 如果401未授权，清除token并跳转
      if (response.status === 401) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userInfo');
        window.location.href = '/';
        throw new Error('未授权，请重新登录');
      }

      return await response.json();
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  }

  /**
   * GET请求
   */
  async get(url, options = {}) {
    return this.request(url, {
      ...options,
      method: 'GET'
    });
  }

  /**
   * POST请求
   */
  async post(url, data, options = {}) {
    return this.request(url, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * PUT请求
   */
  async put(url, data, options = {}) {
    return this.request(url, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  /**
   * DELETE请求
   */
  async delete(url, options = {}) {
    return this.request(url, {
      ...options,
      method: 'DELETE'
    });
  }
}

// 创建全局实例
const apiClient = new APIClient();

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = apiClient;
} else {
  window.apiClient = apiClient;
}

