/**
 * 四阶段聪明钱检测API路由
 * 提供四阶段状态机检测的REST API接口
 * 
 * 设计原则：
 * 1. RESTful设计：遵循REST API规范
 * 2. 单一职责：专注于四阶段检测API
 * 3. 错误处理：统一的错误响应格式
 * 4. 参数验证：严格的输入验证
 */

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');

let smartMoneyDetector = null;

// 中间件：确保聪明钱检测器已初始化
router.use((req, res, next) => {
  if (!smartMoneyDetector) {
    smartMoneyDetector = req.app.get('smartMoneyDetector');
  }
  if (!smartMoneyDetector) {
    logger.error('[四阶段聪明钱API] 聪明钱检测器未初始化');
    return res.status(500).json({ 
      success: false, 
      error: '聪明钱检测器未初始化' 
    });
  }
  next();
});

/**
 * 获取所有交易对的四阶段状态
 * GET /api/v1/smart-money-four-phase/states
 */
router.get('/states', (req, res) => {
  try {
    const states = smartMoneyDetector.getAllFourPhaseStates();
    
    res.json({
      success: true,
      data: states,
      count: Object.keys(states).length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('获取所有四阶段状态失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取四阶段统计信息
 * GET /api/v1/smart-money-four-phase/statistics
 */
router.get('/statistics', (req, res) => {
  try {
    const stats = smartMoneyDetector.getStatistics();
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('获取四阶段统计信息失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取当前参数配置
 * GET /api/v1/smart-money-four-phase/parameters
 */
router.get('/parameters', (req, res) => {
  try {
    const params = smartMoneyDetector.getParameters();
    
    res.json({
      success: true,
      data: params,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('获取参数配置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取四阶段说明文档
 * GET /api/v1/smart-money-four-phase/docs
 */
router.get('/docs', (req, res) => {
  const docs = {
    title: '四阶段聪明钱检测API文档',
    version: '1.0.0',
    description: '基于状态机的四阶段聪明钱检测系统',
    stages: {
      neutral: {
        name: '中性',
        description: '无明显聪明钱活动',
        transition: ['accumulation']
      },
      accumulation: {
        name: '吸筹',
        description: '底部横盘，机构在低位悄悄买入',
        indicators: ['OBI正偏', 'CVD上升', '成交量放大', '大额买单支撑'],
        transition: ['markup', 'neutral']
      },
      markup: {
        name: '拉升',
        description: '价格突破箱体并且量价、CVD同向放量',
        indicators: ['放量突破', 'CVD持续正向', '主动买盘'],
        transition: ['distribution', 'markdown']
      },
      distribution: {
        name: '派发',
        description: '高位震荡，机构开始出货',
        indicators: ['成交量萎缩', 'CVD与OBI背离', '大额卖单压力'],
        transition: ['markdown', 'accumulation']
      },
      markdown: {
        name: '砸盘',
        description: '快速下跌，主动卖压',
        indicators: ['价格快速下跌', 'CVD急降', 'OBI负偏'],
        transition: ['accumulation', 'neutral']
      }
    },
    endpoints: {
      'GET /:symbol': '获取单个交易对的四阶段状态',
      'POST /batch': '批量获取多个交易对的四阶段状态',
      'GET /states': '获取所有交易对的四阶段状态',
      'GET /statistics': '获取四阶段统计信息',
      'GET /parameters': '获取当前参数配置',
      'POST /parameters': '更新参数配置',
      'POST /:symbol/reset': '重置交易对状态',
      'GET /docs': '获取API文档'
    }
  };
  
  res.json({
    success: true,
    data: docs,
    timestamp: new Date().toISOString()
  });
});

/**
 * 批量获取多个交易对的四阶段状态
 * POST /api/v1/smart-money-four-phase/batch
 * body: { symbols: ['BTCUSDT', 'ETHUSDT'] }
 */
router.post('/batch', async (req, res) => {
  try {
    const { symbols } = req.body;
    
    // 参数验证
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'symbols必须是非空数组'
      });
    }

    if (symbols.length > 20) {
      return res.status(400).json({
        success: false,
        error: '一次最多查询20个交易对'
      });
    }

    // 验证每个symbol格式
    for (const symbol of symbols) {
      if (typeof symbol !== 'string' || !symbol.match(/^[A-Z]{3,10}USDT$/)) {
        return res.status(400).json({
          success: false,
          error: `无效的交易对格式: ${symbol}`
        });
      }
    }

    // 批量检测
    const results = await smartMoneyDetector.detectBatch(symbols);
    
    res.json({
      success: true,
      data: results,
      count: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('批量获取四阶段状态失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 更新参数配置
 * POST /api/v1/smart-money-four-phase/parameters
 * body: { param1: value1, param2: value2 }
 */
router.post('/parameters', async (req, res) => {
  try {
    const params = req.body;
    
    // 参数验证
    if (!params || typeof params !== 'object') {
      return res.status(400).json({
        success: false,
        error: '参数必须是对象格式'
      });
    }

    // 验证参数值类型
    const currentParams = smartMoneyDetector.getParameters();
    for (const [key, value] of Object.entries(params)) {
      if (!(key in currentParams)) {
        return res.status(400).json({
          success: false,
          error: `未知参数: ${key}`
        });
      }
      
      if (typeof value !== typeof currentParams[key]) {
        return res.status(400).json({
          success: false,
          error: `参数${key}类型不匹配，期望${typeof currentParams[key]}，实际${typeof value}`
        });
      }
    }

    // 更新参数
    await smartMoneyDetector.updateParameters(params);
    
    res.json({
      success: true,
      message: '参数更新成功',
      data: smartMoneyDetector.getParameters(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('更新参数配置失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 重置交易对状态
 * POST /api/v1/smart-money-four-phase/:symbol/reset
 */
router.post('/:symbol/reset', (req, res) => {
  try {
    const { symbol } = req.params;
    
    // 参数验证
    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({
        success: false,
        error: '无效的交易对符号'
      });
    }

    // 重置状态
    smartMoneyDetector.resetSymbolState(symbol);
    
    res.json({
      success: true,
      message: `${symbol}状态已重置`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`重置${req.params.symbol}状态失败:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取单个交易对的四阶段状态
 * GET /api/v1/smart-money-four-phase/:symbol
 */
router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    // 参数验证
    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({
        success: false,
        error: '无效的交易对符号'
      });
    }

    // 获取四阶段详细信息
    const result = await smartMoneyDetector.getFourPhaseDetails(symbol);
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`获取${req.params.symbol}四阶段状态失败:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;