/**
 * 策略回测引擎 V2
 * 直接调用Dashboard正在运行的ICT和V3策略逻辑
 * 确保回测结果与实时策略一致
 */

const logger = require('../utils/logger');
const ICTStrategy = require('../strategies/ict-strategy');
const V3StrategyV31 = require('../strategies/v3-strategy-v3-1-integrated');

class BacktestStrategyEngineV2 {
  constructor() {
    this.ictStrategy = new ICTStrategy();
    this.v3Strategy = new V3StrategyV31();
  }

  /**
   * 模拟ICT策略交易
   * 直接调用Dashboard的ICT策略逻辑
   * @param {string} symbol - 交易对
   * @param {Array} klines - K线数据
   * @param {Object} params - 策略参数（暂不使用，直接使用策略默认参数）
   * @param {string} mode - 策略模式
   * @returns {Promise<Array>} 交易记录
   */
  async simulateICTTrades(symbol, klines, params, mode) {
    const trades = [];
    let position = null;
    let lastSignal = null;

    logger.info(`[回测引擎V2] ${symbol} ICT-${mode}: 开始回测，K线数量=${klines.length}`);

    // 遍历K线，逐根调用ICT策略
    // 注意：ICT策略需要1D/4H/15M数据，这里使用1h数据作为模拟
    for (let i = 50; i < klines.length - 1; i++) {
      const currentKline = klines[i];
      const currentPrice = currentKline[4]; // close price
      const nextKline = klines[i + 1];
      const nextPrice = nextKline[4];

      try {
        // 调用ICT策略的execute方法
        // 注意：这里需要模拟策略所需的数据格式
        const ictResult = await this.ictStrategy.execute(symbol);

        // 检查是否有交易信号
        if (ictResult && ictResult.signal) {
          const signal = ictResult.signal;

          // 检查开仓信号
          if (!position && (signal === 'BUY' || signal === 'SELL')) {
            // 开仓
            const direction = signal === 'BUY' ? 'LONG' : 'SHORT';
            const entryPrice = currentPrice;

            position = {
              symbol,
              type: direction,
              entryTime: new Date(currentKline[0]),
              entryPrice,
              quantity: 1.0,
              confidence: ictResult.confidence || 'med',
              stopLoss: ictResult.stopLoss || 0,
              takeProfit: ictResult.takeProfit || 0,
              leverage: ictResult.leverage || 1
            };

            lastSignal = signal;

            logger.info(`[回测引擎V2] ${symbol} ICT-${mode}: 开仓 ${direction} @ ${entryPrice}, SL=${position.stopLoss}, TP=${position.takeProfit}`);
          }
          // 检查信号反转
          else if (position && signal !== 'HOLD' && signal !== lastSignal) {
            // 信号反转，平仓
            const trade = this.closePosition(position, currentPrice, '信号反转');
            trades.push(trade);
            position = null;
            lastSignal = null;
          }
        }

        // 检查平仓条件（如果有持仓）
        if (position) {
          let shouldExit = false;
          let exitReason = '';

          // 检查止损
          if (position.type === 'LONG' && nextPrice <= position.stopLoss) {
            shouldExit = true;
            exitReason = '止损';
          } else if (position.type === 'SHORT' && nextPrice >= position.stopLoss) {
            shouldExit = true;
            exitReason = '止损';
          }
          // 检查止盈
          else if (position.type === 'LONG' && nextPrice >= position.takeProfit) {
            shouldExit = true;
            exitReason = '止盈';
          } else if (position.type === 'SHORT' && nextPrice <= position.takeProfit) {
            shouldExit = true;
            exitReason = '止盈';
          }

          if (shouldExit) {
            const trade = this.closePosition(position, nextPrice, exitReason);
            trades.push(trade);
            position = null;
            lastSignal = null;
          }
        }
      } catch (error) {
        logger.error(`[回测引擎V2] ${symbol} ICT-${mode}: 策略执行失败:`, error);
      }
    }

    // 平仓未完成的持仓
    if (position) {
      const lastKline = klines[klines.length - 1];
      const trade = this.closePosition(position, lastKline[4], '回测结束');
      trades.push(trade);
    }

    logger.info(`[回测引擎V2] ${symbol} ICT-${mode}: 生成交易=${trades.length}`);
    return trades;
  }

  /**
   * 模拟V3策略交易
   * 直接调用Dashboard的V3策略逻辑
   * @param {string} symbol - 交易对
   * @param {Array} klines - K线数据
   * @param {Object} params - 策略参数
   * @param {string} mode - 策略模式
   * @returns {Promise<Array>} 交易记录
   */
  async simulateV3Trades(symbol, klines, params, mode) {
    const trades = [];
    let position = null;
    let lastSignal = null;

    logger.info(`[回测引擎V2] ${symbol} V3-${mode}: 开始回测，K线数量=${klines.length}`);

    // 遍历K线，逐根调用V3策略
    for (let i = 50; i < klines.length - 1; i++) {
      const currentKline = klines[i];
      const currentPrice = currentKline[4]; // close price
      const nextKline = klines[i + 1];
      const nextPrice = nextKline[4];

      try {
        // 调用V3策略的execute方法
        const v3Result = await this.v3Strategy.execute(symbol);

        // 检查是否有交易信号
        if (v3Result && v3Result.signal) {
          const signal = v3Result.signal;

          // 检查开仓信号
          if (!position && (signal === 'BUY' || signal === 'SELL')) {
            // 开仓
            const direction = signal === 'BUY' ? 'LONG' : 'SHORT';
            const entryPrice = currentPrice;

            position = {
              symbol,
              type: direction,
              entryTime: new Date(currentKline[0]),
              entryPrice,
              quantity: 1.0,
              confidence: v3Result.confidence || 'med',
              stopLoss: v3Result.stopLoss || 0,
              takeProfit: v3Result.takeProfit || 0,
              leverage: v3Result.leverage || 1
            };

            lastSignal = signal;

            logger.info(`[回测引擎V2] ${symbol} V3-${mode}: 开仓 ${direction} @ ${entryPrice}, SL=${position.stopLoss}, TP=${position.takeProfit}`);
          }
          // 检查信号反转
          else if (position && signal !== 'HOLD' && signal !== lastSignal) {
            // 信号反转，平仓
            const trade = this.closePosition(position, currentPrice, '信号反转');
            trades.push(trade);
            position = null;
            lastSignal = null;
          }
        }

        // 检查平仓条件（如果有持仓）
        if (position) {
          let shouldExit = false;
          let exitReason = '';

          // 检查止损
          if (position.type === 'LONG' && nextPrice <= position.stopLoss) {
            shouldExit = true;
            exitReason = '止损';
          } else if (position.type === 'SHORT' && nextPrice >= position.stopLoss) {
            shouldExit = true;
            exitReason = '止损';
          }
          // 检查止盈
          else if (position.type === 'LONG' && nextPrice >= position.takeProfit) {
            shouldExit = true;
            exitReason = '止盈';
          } else if (position.type === 'SHORT' && nextPrice <= position.takeProfit) {
            shouldExit = true;
            exitReason = '止盈';
          }

          if (shouldExit) {
            const trade = this.closePosition(position, nextPrice, exitReason);
            trades.push(trade);
            position = null;
            lastSignal = null;
          }
        }
      } catch (error) {
        logger.error(`[回测引擎V2] ${symbol} V3-${mode}: 策略执行失败:`, error);
      }
    }

    // 平仓未完成的持仓
    if (position) {
      const lastKline = klines[klines.length - 1];
      const trade = this.closePosition(position, lastKline[4], '回测结束');
      trades.push(trade);
    }

    logger.info(`[回测引擎V2] ${symbol} V3-${mode}: 生成交易=${trades.length}`);
    return trades;
  }

  /**
   * 平仓
   * @param {Object} position - 持仓
   * @param {number} exitPrice - 平仓价格
   * @param {string} reason - 平仓原因
   * @returns {Object} 交易记录
   */
  closePosition(position, exitPrice, reason) {
    const pnl = position.type === 'LONG'
      ? (exitPrice - position.entryPrice) * position.quantity
      : (position.entryPrice - exitPrice) * position.quantity;

    const durationHours = (new Date() - position.entryTime) / (1000 * 60 * 60);
    const fees = Math.abs(pnl) * 0.001; // 0.1% 手续费

    return {
      ...position,
      exitTime: new Date(),
      exitPrice,
      pnl,
      durationHours,
      exitReason: reason,
      fees
    };
  }
}

module.exports = BacktestStrategyEngineV2;

