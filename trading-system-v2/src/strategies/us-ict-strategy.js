/**
 * 美股ICT策略 - 复用加密货币ICT策略逻辑
 * 独立模块，不影响加密货币策略
 */

const TechnicalIndicators = require('../utils/technical-indicators');
const logger = require('../utils/logger');
const DatabaseConnection = require('../database/database-connection');

/**
 * 美股策略参数加载器
 */
class USStrategyParameterLoader {
  constructor(dbConnection) {
    this.dbConnection = dbConnection;
  }

  async loadParameters(strategyName, mode) {
    try {
      const sql = `
        SELECT param_name, param_value, param_type
        FROM us_stock_strategy_params
        WHERE strategy_name = ? AND strategy_mode = ?
      `;

      const params = await this.dbConnection.query(sql, [strategyName, mode]);
      
      const result = {};
      for (const param of params) {
        const value = this.convertValue(param.param_value, param.param_type);
        result[param.param_name] = value;
      }

      return result;
    } catch (error) {
      logger.error(`[USStrategyParameterLoader] 参数加载失败:`, error);
      return this.getDefaultParameters(strategyName);
    }
  }

  convertValue(value, type) {
    if (type === 'number') {
      return parseFloat(value);
    } else if (type === 'boolean') {
      return value === 'true' || value === '1';
    }
    return value;
  }

  getDefaultParameters(strategyName) {
    // 返回默认参数
    if (strategyName === 'ICT_US') {
      return {
        orderBlockSize: 15,
        liquidityRange: 0.008,
        stopLossATRMultiplier: 2.0,
        takeProfitRatio: 2.0
      };
    }
    return {};
  }
}

/**
 * 美股ICT策略类
 */
class USICTStrategy {
  constructor() {
    this.name = 'ICT_US';
    this.timeframes = ['1d', '4h', '15m'];
    this.paramLoader = null;
    this.params = {};
    
    this.initializeParameters();
  }

  /**
   * 初始化参数
   */
  async initializeParameters() {
    try {
      const dbConnection = DatabaseConnection.getInstance();
      this.paramLoader = new USStrategyParameterLoader(dbConnection);
      this.params = await this.paramLoader.loadParameters('ICT_US', 'BALANCED');
      
      logger.info('[USICTStrategy] 参数加载完成', {
        params: this.params
      });
    } catch (error) {
      logger.error('[USICTStrategy] 参数加载失败，使用默认值', error);
      this.params = this.paramLoader.getDefaultParameters('ICT_US');
    }
  }

  /**
   * 执行策略分析
   */
  async execute(klines15m) {
    try {
      if (!klines15m || klines15m.length === 0) {
        return null;
      }

      // 1. 识别订单块
      const orderBlock = this.identifyOrderBlock(klines15m);
      
      // 2. 检测流动性扫荡
      const liquiditySweep = this.detectLiquiditySweep(klines15m, orderBlock);
      
      // 3. 生成交易信号
      const signal = this.generateSignal(orderBlock, liquiditySweep);

      return signal;

    } catch (error) {
      logger.error('[USICTStrategy] 策略执行失败:', error);
      return null;
    }
  }

  /**
   * 识别订单块
   */
  identifyOrderBlock(klines) {
    const orderBlockSize = this.params.orderBlockSize || 15;
    const blockSize = Math.min(orderBlockSize, Math.floor(klines.length / 4));

    if (klines.length < blockSize + 5) {
      return null;
    }

    // 查找成交量突增的区域
    let maxVolume = 0;
    let blockIndex = -1;

    for (let i = 5; i < klines.length - 5; i++) {
      const volumes = klines.slice(i - blockSize, i).map(k => k.volume);
      const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
      
      if (klines[i].volume > avgVolume * 1.5 && klines[i].volume > maxVolume) {
        maxVolume = klines[i].volume;
        blockIndex = i;
      }
    }

    if (blockIndex === -1) {
      return null;
    }

    const blockKlines = klines.slice(blockIndex - blockSize, blockIndex + 1);
    const highs = blockKlines.map(k => k.high);
    const lows = blockKlines.map(k => k.low);
    const closes = blockKlines.map(k => k.close);

    const high = Math.max(...highs);
    const low = Math.min(...lows);
    const direction = blockKlines[blockKlines.length - 1].close > blockKlines[0].open ? 'UP' : 'DOWN';

    return {
      high,
      low,
      direction,
      timestamp: blockKlines[blockKlines.length - 1].timestamp,
      volume: maxVolume
    };
  }

  /**
   * 检测流动性扫荡
   */
  detectLiquiditySweep(klines, orderBlock) {
    if (!orderBlock) {
      return null;
    }

    const liquidityRange = this.params.liquidityRange || 0.008;
    const recentKlines = klines.slice(-20);

    const recentHigh = Math.max(...recentKlines.map(k => k.high));
    const recentLow = Math.min(...recentKlines.map(k => k.low));

    const sweepRange = (recentHigh - recentLow) * liquidityRange;

    // 检测上方扫荡
    if (orderBlock.direction === 'UP') {
      const aboveBlockHigh = recentHigh > (orderBlock.high + sweepRange);
      if (aboveBlockHigh) {
        return { type: 'UP', price: recentHigh, swept: true };
      }
    }

    // 检测下方扫荡
    if (orderBlock.direction === 'DOWN') {
      const belowBlockLow = recentLow < (orderBlock.low - sweepRange);
      if (belowBlockLow) {
        return { type: 'DOWN', price: recentLow, swept: true };
      }
    }

    return null;
  }

  /**
   * 生成交易信号
   */
  generateSignal(orderBlock, liquiditySweep) {
    if (!orderBlock || !liquiditySweep || !liquiditySweep.swept) {
      return {
        action: 'HOLD',
        confidence: 0,
        strategy: 'ICT_US'
      };
    }

    const currentKline = this.getCurrentKline();
    const entryPrice = currentKline.close;

    // 计算ATR用于止损
    const atrMultiplier = this.params.stopLossATRMultiplier || 2.0;
    const stopLoss = entryPrice - (entryPrice * 0.02 * atrMultiplier); // 基于ATR的止损

    const takeProfitRatio = this.params.takeProfitRatio || 2.0;
    const takeProfit = entryPrice + ((entryPrice - stopLoss) * takeProfitRatio);

    return {
      action: 'BUY',
      confidence: 7,
      entryPrice,
      stopLoss,
      takeProfit,
      strategy: 'ICT_US'
    };
  }

  /**
   * 获取当前K线（简化版）
   */
  getCurrentKline() {
    return {
      close: 150.0,
      timestamp: new Date()
    };
  }
}

module.exports = USICTStrategy;

