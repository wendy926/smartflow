/**
 * 持仓监控服务
 * 监控所有活跃交易的持仓时长，根据交易对类别自动执行平仓操作
 */

const PositionDurationManager = require('../utils/position-duration-manager');
const logger = require('../utils/logger');

class PositionMonitor {
  constructor(database, binanceAPI) {
    this.database = database;
    this.binanceAPI = binanceAPI;
    this.isRunning = false;
    this.monitorInterval = null;
    this.checkInterval = 5 * 60 * 1000; // 5分钟检查一次
  }

  /**
   * 启动持仓监控服务
   */
  async start() {
    if (this.isRunning) {
      logger.warn('[持仓监控] 服务已在运行中');
      return;
    }

    this.isRunning = true;
    logger.info('[持仓监控] 启动持仓监控服务...');

    // 立即执行一次检查
    await this.checkAllPositions();

    // 设置定时检查
    this.monitorInterval = setInterval(async () => {
      await this.checkAllPositions();
    }, this.checkInterval);

    logger.info('[持仓监控] ✅ 持仓监控服务启动成功');
  }

  /**
   * 停止持仓监控服务
   */
  async stop() {
    if (!this.isRunning) {
      logger.warn('[持仓监控] 服务未在运行');
      return;
    }

    this.isRunning = false;

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    logger.info('[持仓监控] 持仓监控服务已停止');
  }

  /**
   * 检查所有活跃持仓
   */
  async checkAllPositions() {
    try {
      logger.info('[持仓监控] 开始检查所有活跃持仓...');

      // 获取所有进行中的交易
      const [trades] = await this.database.pool.query(
        'SELECT st.*, s.symbol FROM simulation_trades st JOIN symbols s ON st.symbol_id = s.id WHERE st.status = "OPEN"'
      );

      if (trades.length === 0) {
        logger.debug('[持仓监控] 没有活跃持仓需要检查');
        return;
      }

      logger.info(`[持仓监控] 发现 ${trades.length} 个活跃持仓，开始检查...`);

      let closedCount = 0;
      let warnedCount = 0;

      for (const trade of trades) {
        const result = await this.checkSinglePosition(trade);

        if (result.action === 'closed') {
          closedCount++;
        } else if (result.action === 'warned') {
          warnedCount++;
        }
      }

      logger.info(`[持仓监控] 检查完成: 平仓 ${closedCount} 个, 警告 ${warnedCount} 个`);

    } catch (error) {
      logger.error('[持仓监控] 检查持仓失败:', error);
    }
  }

  /**
   * 检查单个持仓
   * @param {Object} trade - 交易对象
   * @returns {Object} 检查结果
   */
  async checkSinglePosition(trade) {
    try {
      const { id, symbol, entry_time, trade_type, entry_price, strategy_name } = trade;

      // 获取当前价格
      const klines15m = await this.binanceAPI.getKlines(symbol, '15m', 2);
      if (!klines15m || klines15m.length < 1) {
        logger.warn(`[持仓监控] ${symbol} 无法获取当前价格`);
        return { action: 'error', reason: '无法获取当前价格' };
      }

      const currentPrice = parseFloat(klines15m[klines15m.length - 1][4]);

      // 确定市场类型（根据策略）
      const marketType = strategy_name === 'ICT' ? 'TREND' : 'RANGE';

      // 检查最大持仓时长
      const durationCheck = PositionDurationManager.checkMaxDurationExceeded({
        symbol,
        entryTime: entry_time,
        marketType
      });

      // 检查时间止损
      const timeStopCheck = PositionDurationManager.checkTimeStopLoss({
        symbol,
        entryTime: entry_time,
        entryPrice: entry_price,
        side: trade_type,
        marketType
      }, currentPrice);

      // 决定执行的操作
      if (durationCheck.exceeded || timeStopCheck.triggered) {
        const reason = durationCheck.exceeded ? durationCheck.reason : timeStopCheck.reason;
        await this.closePosition(trade, currentPrice, reason);
        return { action: 'closed', reason };
      } else if (durationCheck.warning) {
        logger.warn(`[持仓监控] ⚠️ ${symbol} ${durationCheck.reason}`);
        return { action: 'warned', reason: durationCheck.reason };
      }

      return { action: 'monitor' };

    } catch (error) {
      logger.error(`[持仓监控] 检查 ${trade.symbol} 持仓失败:`, error);
      return { action: 'error', reason: error.message };
    }
  }

  /**
   * 平仓操作
   * @param {Object} trade - 交易对象
   * @param {number} exitPrice - 平仓价格
   * @param {string} reason - 平仓原因
   */
  async closePosition(trade, exitPrice, reason) {
    try {
      const { id, symbol, trade_type, entry_price, entry_time } = trade;

      // 计算盈亏
      const pnl = trade_type === 'LONG'
        ? exitPrice - entry_price
        : entry_price - exitPrice;
      const pnlPercentage = (pnl / entry_price) * 100;

      // 更新数据库
      await this.database.pool.query(
        `UPDATE simulation_trades 
         SET status = 'CLOSED', 
             exit_price = ?, 
             exit_time = NOW(), 
             exit_reason = ?, 
             pnl = ?, 
             pnl_percentage = ? 
         WHERE id = ?`,
        [exitPrice, reason, pnl, pnlPercentage, id]
      );

      logger.info(`[持仓监控] ✅ ${symbol} 自动平仓: 入场=${entry_price}, 出场=${exitPrice}, 盈亏=${pnl.toFixed(4)} (${pnlPercentage.toFixed(2)}%), 原因=${reason}`);

    } catch (error) {
      logger.error(`[持仓监控] 平仓 ${trade.symbol} 失败:`, error);
    }
  }

  /**
   * 获取监控状态
   * @returns {Object} 监控状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
      nextCheck: this.isRunning ? new Date(Date.now() + this.checkInterval).toISOString() : null
    };
  }

  /**
   * 手动检查所有持仓
   * @returns {Object} 检查结果
   */
  async manualCheck() {
    logger.info('[持仓监控] 执行手动持仓检查...');
    await this.checkAllPositions();
    return {
      success: true,
      timestamp: new Date().toISOString(),
      message: '手动持仓检查完成'
    };
  }

  /**
   * 更新检查间隔
   * @param {number} intervalMinutes - 间隔分钟数
   */
  updateCheckInterval(intervalMinutes) {
    const newInterval = intervalMinutes * 60 * 1000;

    if (newInterval !== this.checkInterval) {
      this.checkInterval = newInterval;

      if (this.isRunning && this.monitorInterval) {
        clearInterval(this.monitorInterval);
        this.monitorInterval = setInterval(async () => {
          await this.checkAllPositions();
        }, this.checkInterval);
      }

      logger.info(`[持仓监控] 检查间隔已更新为 ${intervalMinutes} 分钟`);
    }
  }
}

module.exports = PositionMonitor;
