const DatabaseManager = require('./DatabaseManager');

/**
 * 安全的数据库连接管理器
 * 防止内存泄漏和连接泄漏
 */
class SafeDatabaseManager {
  constructor() {
    this.database = null;
    this.isConnected = false;
    this.connectionCount = 0;
    this.maxConnections = 10;
    this.connectionTimeout = 30000; // 30秒超时
  }

  /**
   * 初始化数据库连接
   */
  async init() {
    if (this.isConnected) {
      this.connectionCount++;
      return;
    }

    try {
      this.database = new DatabaseManager();
      await this.database.init();
      this.isConnected = true;
      this.connectionCount = 1;
      
      console.log('✅ 安全数据库连接已建立');
      
      // 设置连接超时
      this.setupConnectionTimeout();
      
    } catch (error) {
      this.isConnected = false;
      this.database = null;
      throw new Error(`数据库连接失败: ${error.message}`);
    }
  }

  /**
   * 设置连接超时
   */
  setupConnectionTimeout() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    
    this.timeoutId = setTimeout(() => {
      console.log('⚠️ 数据库连接超时，自动关闭');
      this.forceClose();
    }, this.connectionTimeout);
  }

  /**
   * 执行查询
   */
  async runQuery(sql, params = []) {
    if (!this.isConnected || !this.database) {
      throw new Error('数据库连接未建立');
    }

    try {
      const result = await this.database.runQuery(sql, params);
      return result;
    } catch (error) {
      console.error('❌ 数据库查询失败:', error.message);
      throw error;
    }
  }

  /**
   * 释放连接
   */
  async release() {
    if (!this.isConnected) return;

    this.connectionCount--;
    
    if (this.connectionCount <= 0) {
      await this.close();
    }
  }

  /**
   * 关闭数据库连接
   */
  async close() {
    if (!this.isConnected) return;

    try {
      if (this.database) {
        await this.database.close();
      }
      
      this.isConnected = false;
      this.database = null;
      this.connectionCount = 0;
      
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }
      
      console.log('🔒 安全数据库连接已关闭');
      
    } catch (error) {
      console.error('❌ 关闭数据库连接失败:', error.message);
    }
  }

  /**
   * 强制关闭连接
   */
  forceClose() {
    this.isConnected = false;
    this.database = null;
    this.connectionCount = 0;
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  /**
   * 获取连接状态
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      connectionCount: this.connectionCount,
      hasDatabase: !!this.database
    };
  }

  /**
   * 创建策略实例的安全方法
   */
  async createStrategyInstance(StrategyClass) {
    await this.init();
    const instance = new StrategyClass(this.database);
    
    // 绑定清理方法
    const originalDestroy = instance.destroy || (() => {});
    instance.destroy = async () => {
      await originalDestroy.call(instance);
      await this.release();
    };
    
    return instance;
  }
}

module.exports = SafeDatabaseManager;
