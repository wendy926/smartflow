/**
 * 策略参数加载器
 * 从数据库加载策略参数，避免硬编码
 */

const logger = require('./logger');

class StrategyParameterLoader {
  constructor(dbConnection) {
    this.db = dbConnection;
    this.paramCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5分钟缓存过期
  }

  /**
   * 从数据库加载策略参数
   * @param {string} strategyName - 策略名称 (ICT/V3)
   * @param {string} strategyMode - 策略模式 (AGGRESSIVE/BALANCED/CONSERVATIVE)
   * @returns {Promise<Object>} 参数对象
   */
  async loadParameters(strategyName, strategyMode = 'BALANCED') {
    const cacheKey = `${strategyName}_${strategyMode}`;
    
    // 检查缓存
    const cached = this.paramCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < this.cacheExpiry)) {
      return cached.params;
    }

    try {
      const sql = `
        SELECT param_group, param_name, param_value, param_type, category
        FROM strategy_params
        WHERE strategy_name = ? 
          AND strategy_mode = ?
          AND is_active = 1
        ORDER BY param_group, param_name
      `;

      const rows = await this.db.query(sql, [strategyName, strategyMode]);
      
      // 将参数组织成嵌套对象结构
      const params = {};
      
      for (const row of rows) {
        // ✅ 优先使用category，如果不存在则使用param_group
        const group = row.category || row.param_group || 'general';
        const name = row.param_name;
        let value = row.param_value;

        // 类型转换
        switch (row.param_type) {
          case 'number':
            value = parseFloat(value);
            break;
          case 'boolean':
            value = value === '1' || value === 'true' || value === true;
            break;
          case 'json':
            try {
              value = JSON.parse(value);
            } catch (e) {
              logger.warn(`[参数加载器] 解析JSON失败: ${name}`, e);
            }
            break;
          // string类型保持原样
        }

        // 创建嵌套结构
        if (!params[group]) {
          params[group] = {};
        }
        params[group][name] = value;
      }

      // 更新缓存
      this.paramCache.set(cacheKey, {
        params,
        timestamp: Date.now()
      });

      logger.info(`[参数加载器] 加载参数: ${strategyName}-${strategyMode}, 共${rows.length}个参数`);
      return params;

    } catch (error) {
      logger.error(`[参数加载器] 加载参数失败: ${strategyName}-${strategyMode}`, error);
      // 返回空对象而不是抛出错误，让策略使用默认值
      return {};
    }
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.paramCache.clear();
    logger.info('[参数加载器] 缓存已清除');
  }

  /**
   * 获取单个参数
   */
  async getParameter(strategyName, strategyMode, paramGroup, paramName, defaultValue = null) {
    const params = await this.loadParameters(strategyName, strategyMode);
    return params[paramGroup]?.[paramName] ?? defaultValue;
  }
}

module.exports = StrategyParameterLoader;
