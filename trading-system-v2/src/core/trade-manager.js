/**
 * 模拟交易管理器
 * 负责管理模拟交易的创建、更新和状态控制
 */

const logger = require('../utils/logger');
const dbOps = require('../database/operations');

class TradeManager {
  constructor() {
    this.activeTrades = new Map(); // 存储活跃交易
    this.tradeCooldowns = new Map(); // 存储交易冷却时间
    this.minCooldownMinutes = 5; // 最小冷却时间（分钟）
  }

  /**
   * 检查是否可以创建新交易
   * @param {string} symbol - 交易对
   * @param {string} strategy - 策略名称
   * @returns {Object} 检查结果
   */
  async canCreateTrade(symbol, strategy) {
    try {
      // 检查是否有活跃交易
      const activeTrade = await this.getActiveTrade(symbol, strategy);
      if (activeTrade) {
        return {
          canCreate: false,
          reason: '该交易对和策略已有活跃交易',
          activeTrade: activeTrade
        };
      }

      // 检查冷却时间
      const cooldownKey = `${symbol}_${strategy}`;
      const lastTradeTime = this.tradeCooldowns.get(cooldownKey);

      if (lastTradeTime) {
        const timeDiff = Date.now() - lastTradeTime;
        const minutesDiff = timeDiff / (1000 * 60);

        if (minutesDiff < this.minCooldownMinutes) {
          const remainingMinutes = this.minCooldownMinutes - minutesDiff;
          return {
            canCreate: false,
            reason: `交易冷却中，还需等待 ${remainingMinutes.toFixed(1)} 分钟`,
            remainingMinutes: remainingMinutes
          };
        }
      }

      return {
        canCreate: true,
        reason: '可以创建新交易'
      };
    } catch (error) {
      logger.error('检查交易创建条件失败:', error);
      return {
        canCreate: false,
        reason: '检查失败: ' + error.message
      };
    }
  }

  /**
   * 创建模拟交易
   * @param {Object} tradeData - 交易数据
   * @returns {Object} 创建结果
   */
  async createTrade(tradeData) {
    try {
      const { symbol, strategy_type } = tradeData;

      // 检查是否可以创建交易
      const canCreate = await this.canCreateTrade(symbol, strategy_type);
      if (!canCreate.canCreate) {
        return {
          success: false,
          error: canCreate.reason,
          data: canCreate
        };
      }

      // 创建交易记录
      const result = await dbOps.addTrade(tradeData);

      if (result.success) {
        // 更新冷却时间
        const cooldownKey = `${symbol}_${strategy_type}`;
        this.tradeCooldowns.set(cooldownKey, Date.now());

        // 添加到活跃交易列表
        const trade = await dbOps.getTradeById(result.id);
        this.activeTrades.set(result.id, trade);

        logger.info(`模拟交易创建成功: ${symbol} ${strategy_type} ID: ${result.id}`);

        return {
          success: true,
          data: trade,
          message: '模拟交易创建成功'
        };
      } else {
        return {
          success: false,
          error: '创建交易记录失败'
        };
      }
    } catch (error) {
      logger.error('创建模拟交易失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 关闭模拟交易
   * @param {number} tradeId - 交易ID
   * @param {Object} closeData - 关闭数据
   * @returns {Object} 关闭结果
   */
  async closeTrade(tradeId, closeData) {
    try {
      const { exit_price, exit_reason = 'MANUAL' } = closeData;

      // 获取交易信息
      const trade = await dbOps.getTradeById(tradeId);
      if (!trade) {
        return {
          success: false,
          error: '交易记录不存在'
        };
      }

      if (trade.status !== 'ACTIVE') {
        return {
          success: false,
          error: '交易已关闭，无法重复关闭'
        };
      }

      // 计算盈亏
      const pnl = trade.direction === 'LONG'
        ? (exit_price - trade.entry_price) * trade.position_size
        : (trade.entry_price - exit_price) * trade.position_size;

      const pnl_percentage = (pnl / (trade.entry_price * trade.position_size)) * 100;

      // 更新交易记录
      const updateData = {
        status: 'CLOSED',
        exit_price,
        exit_reason,
        pnl,
        pnl_percentage,
        closed_at: new Date()
      };

      const result = await dbOps.updateTrade(tradeId, updateData);

      if (result.success) {
        // 从活跃交易列表中移除
        this.activeTrades.delete(tradeId);

        logger.info(`模拟交易关闭成功: ID ${tradeId}, PnL: ${pnl.toFixed(2)}`);

        return {
          success: true,
          data: {
            ...trade,
            ...updateData
          },
          message: '模拟交易关闭成功'
        };
      } else {
        return {
          success: false,
          error: '更新交易记录失败'
        };
      }
    } catch (error) {
      logger.error('关闭模拟交易失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取活跃交易
   * @param {string} symbol - 交易对
   * @param {string} strategy - 策略名称
   * @returns {Object} 活跃交易信息
   */
  async getActiveTrade(symbol, strategy) {
    try {
      const trades = await dbOps.getTrades(strategy, symbol, 1);
      const activeTrade = trades.find(trade => trade.status === 'ACTIVE');
      return activeTrade || null;
    } catch (error) {
      logger.error('获取活跃交易失败:', error);
      return null;
    }
  }

  /**
   * 获取所有活跃交易
   * @returns {Array} 活跃交易列表
   */
  async getAllActiveTrades() {
    try {
      const v3Trades = await dbOps.getTrades('V3', null, 100);
      const ictTrades = await dbOps.getTrades('ICT', null, 100);

      const allTrades = [...v3Trades, ...ictTrades];
      return allTrades.filter(trade => trade.status === 'ACTIVE');
    } catch (error) {
      logger.error('获取所有活跃交易失败:', error);
      return [];
    }
  }

  /**
   * 检查交易止损/止盈
   * @param {Object} trade - 交易信息
   * @param {number} currentPrice - 当前价格
   * @returns {Object} 检查结果
   */
  checkTradeExit(trade, currentPrice) {
    const { direction, entry_price, stop_loss, take_profit } = trade;

    if (direction === 'LONG') {
      // 多头交易
      if (currentPrice <= stop_loss) {
        return {
          shouldExit: true,
          exitReason: 'STOP_LOSS',
          exitPrice: stop_loss
        };
      } else if (currentPrice >= take_profit) {
        return {
          shouldExit: true,
          exitReason: 'TAKE_PROFIT',
          exitPrice: take_profit
        };
      }
    } else {
      // 空头交易
      if (currentPrice >= stop_loss) {
        return {
          shouldExit: true,
          exitReason: 'STOP_LOSS',
          exitPrice: stop_loss
        };
      } else if (currentPrice <= take_profit) {
        return {
          shouldExit: true,
          exitReason: 'TAKE_PROFIT',
          exitPrice: take_profit
        };
      }
    }

    return {
      shouldExit: false,
      exitReason: null,
      exitPrice: null
    };
  }

  /**
   * 自动检查并关闭符合条件的交易
   * @param {string} symbol - 交易对
   * @param {number} currentPrice - 当前价格
   * @returns {Array} 关闭的交易列表
   */
  async autoCloseTrades(symbol, currentPrice) {
    try {
      const closedTrades = [];

      // 获取该交易对的所有活跃交易
      const v3Trades = await dbOps.getTrades('V3', symbol, 10);
      const ictTrades = await dbOps.getTrades('ICT', symbol, 10);
      const allTrades = [...v3Trades, ...ictTrades].filter(trade => trade.status === 'ACTIVE');

      for (const trade of allTrades) {
        const exitCheck = this.checkTradeExit(trade, currentPrice);

        if (exitCheck.shouldExit) {
          const closeResult = await this.closeTrade(trade.id, {
            exit_price: exitCheck.exitPrice,
            exit_reason: exitCheck.exitReason
          });

          if (closeResult.success) {
            closedTrades.push(closeResult.data);
            logger.info(`自动关闭交易: ${symbol} ${trade.strategy_type} ${exitCheck.exitReason}`);
          }
        }
      }

      return closedTrades;
    } catch (error) {
      logger.error('自动关闭交易失败:', error);
      return [];
    }
  }

  /**
   * 获取交易统计信息
   * @param {string} strategy - 策略名称
   * @param {string} symbol - 交易对
   * @returns {Object} 统计信息
   */
  async getTradeStatistics(strategy, symbol = null) {
    try {
      return await dbOps.getTradeStatistics(strategy, symbol);
    } catch (error) {
      logger.error('获取交易统计失败:', error);
      return {
        total_trades: 0,
        winning_trades: 0,
        losing_trades: 0,
        win_rate: 0,
        total_pnl: 0,
        avg_pnl: 0,
        best_trade: 0,
        worst_trade: 0,
        avg_pnl_percentage: 0
      };
    }
  }

  /**
   * 清理过期的冷却时间记录
   */
  cleanupCooldowns() {
    const now = Date.now();
    const cooldownMinutes = this.minCooldownMinutes * 60 * 1000; // 转换为毫秒

    for (const [key, timestamp] of this.tradeCooldowns.entries()) {
      if (now - timestamp > cooldownMinutes) {
        this.tradeCooldowns.delete(key);
      }
    }
  }

  /**
   * 获取冷却时间状态
   * @param {string} symbol - 交易对
   * @param {string} strategy - 策略名称
   * @returns {Object} 冷却时间状态
   */
  getCooldownStatus(symbol, strategy) {
    const cooldownKey = `${symbol}_${strategy}`;
    const lastTradeTime = this.tradeCooldowns.get(cooldownKey);

    if (!lastTradeTime) {
      return {
        isInCooldown: false,
        remainingMinutes: 0
      };
    }

    const timeDiff = Date.now() - lastTradeTime;
    const minutesDiff = timeDiff / (1000 * 60);
    const remainingMinutes = Math.max(0, this.minCooldownMinutes - minutesDiff);

    return {
      isInCooldown: remainingMinutes > 0,
      remainingMinutes: Math.round(remainingMinutes * 10) / 10
    };
  }
}

module.exports = new TradeManager();
