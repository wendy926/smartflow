/**
 * V3.1-Plus 优化 - 分批建仓管理模块
 * 
 * 功能：
 * - 首仓入场（50%仓位）
 * - 确认后补仓（剩余50%）
 * - 移动止损到盈亏平衡
 * 
 * 设计原则：
 * - 单一职责：仅负责分批建仓逻辑
 * - 数据完整：记录每一批的详细信息
 * - 风险控制：首仓后等待确认再补仓
 * 
 * @module v3-1-plus/staged-entry
 */

const logger = require('../../utils/logger');

/**
 * 分批建仓管理器
 * 管理分批入场、补仓和止损调整
 */
class StagedEntryManager {
  constructor(database, params = {}) {
    this.database = database;
    this.params = {
      firstLegRatio: params.firstLegRatio || 0.5,          // 首仓比例
      confirmWaitMinutes: params.confirmWaitMinutes || 15, // 等待确认时间（分钟）
      breakevenBuffer: params.breakevenBuffer || 0.001,    // 盈亏平衡缓冲（0.1%）
      momentumConfirmThreshold: params.momentumConfirmThreshold || 0.6 // 动量确认阈值
    };

    logger.info('[StagedEntry] 初始化分批建仓管理器', this.params);
  }

  /**
   * 计算分批大小
   * @param {number} totalSize - 总目标仓位
   * @param {number} firstLegRatio - 首仓比例（默认0.5）
   * @returns {Object} {stage1: number, stage2: number}
   */
  calculateStageSizes(totalSize, firstLegRatio = null) {
    const ratio = firstLegRatio || this.params.firstLegRatio;
    const stage1 = totalSize * ratio;
    const stage2 = totalSize - stage1;

    return {
      stage1: parseFloat(stage1.toFixed(8)),
      stage2: parseFloat(stage2.toFixed(8)),
      ratio,
      total: totalSize
    };
  }

  /**
   * 创建分批订单记录
   * @param {number} tradeId - 关联的trade ID
   * @param {Object} stageData - 订单数据 {stage, symbol, side, size, price}
   * @returns {Object} 订单详情
   */
  createStageOrder(tradeId, stageData) {
    const { stage, symbol, side, size, price } = stageData;

    return {
      stage,
      symbol,
      side,
      size,
      price,
      time: new Date().toISOString(),
      status: 'PENDING',
      tradeId
    };
  }

  /**
   * 记录首仓入场
   * @param {number} tradeId - simulation_trades.id
   * @param {Object} orderData - 订单数据
   * @returns {Promise<Object>} 首仓详情
   */
  async recordFirstLeg(tradeId, orderData) {
    try {
      const { symbol, side, size, price, stopLoss, takeProfit } = orderData;

      // 创建stage1订单记录
      const stage1 = this.createStageOrder(tradeId, {
        stage: 1,
        symbol,
        side,
        size,
        price
      });

      // 更新simulation_trades表
      await this.database.pool.query(`
        UPDATE simulation_trades
        SET staged_entry = TRUE,
            stage_count = 2,
            staged_orders = JSON_ARRAY(?)
        WHERE id = ?
      `, [JSON.stringify(stage1), tradeId]);

      logger.info(`[StagedEntry] ✅ 记录首仓入场: tradeId=${tradeId}, symbol=${symbol}, size=${size}`);

      return {
        tradeId,
        stage: 1,
        size,
        price,
        stopLoss,
        takeProfit,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('[StagedEntry] recordFirstLeg错误:', error);
      throw error;
    }
  }

  /**
   * 检查是否可以补仓（动量确认）
   * @param {Object} klines15m - 最新15M K线
   * @param {Object} klines1h - 最新1H K线
   * @param {string} side - 交易方向
   * @returns {Object} {confirmed: boolean, reason: string, details: Object}
   */
  checkMomentumConfirmation(klines15m, klines1h, side) {
    try {
      if (!klines15m || klines15m.length < 2) {
        return { confirmed: false, reason: 'insufficient_15m_data' };
      }

      // 获取最近2根15M K线
      const [prev, current] = klines15m.slice(-2);
      const prevClose = parseFloat(prev[4]);
      const currentClose = parseFloat(current[4]);
      const priceChange = (currentClose - prevClose) / prevClose;

      // 根据方向检查价格是否延续
      let priceConfirmed = false;
      if (side === 'LONG') {
        priceConfirmed = currentClose > prevClose; // 价格上涨
      } else if (side === 'SHORT') {
        priceConfirmed = currentClose < prevClose; // 价格下跌
      }

      // 检查成交量（最新K线成交量应>=前一根）
      const prevVol = parseFloat(prev[5]);
      const currentVol = parseFloat(current[5]);
      const volumeConfirmed = currentVol >= prevVol * 0.8; // 容忍20%的成交量下降

      // 综合判断
      const confirmed = priceConfirmed && volumeConfirmed;

      return {
        confirmed,
        reason: confirmed ? 'momentum_confirmed' : this._getMomentumRejectReason(priceConfirmed, volumeConfirmed),
        details: {
          priceChange: parseFloat((priceChange * 100).toFixed(2)),
          priceConfirmed,
          volumeConfirmed,
          volumeRatio: prevVol > 0 ? parseFloat((currentVol / prevVol).toFixed(2)) : 0
        }
      };
    } catch (error) {
      logger.error('[StagedEntry] checkMomentumConfirmation错误:', error);
      return { confirmed: false, reason: 'error', error: error.message };
    }
  }

  /**
   * 记录补仓
   * @param {number} tradeId - simulation_trades.id
   * @param {Object} orderData - 订单数据
   * @returns {Promise<Object>} 补仓详情
   */
  async recordSecondLeg(tradeId, orderData) {
    try {
      const { symbol, side, size, price } = orderData;

      // 创建stage2订单记录
      const stage2 = this.createStageOrder(tradeId, {
        stage: 2,
        symbol,
        side,
        size,
        price
      });

      // 获取现有staged_orders
      const [rows] = await this.database.pool.query(
        'SELECT staged_orders FROM simulation_trades WHERE id = ?',
        [tradeId]
      );

      let stagedOrders = [];
      if (rows[0] && rows[0].staged_orders) {
        stagedOrders = JSON.parse(rows[0].staged_orders);
      }

      // 添加stage2
      stagedOrders.push(stage2);

      // 更新数据库
      await this.database.pool.query(`
        UPDATE simulation_trades
        SET staged_orders = ?
        WHERE id = ?
      `, [JSON.stringify(stagedOrders), tradeId]);

      logger.info(`[StagedEntry] ✅ 记录补仓: tradeId=${tradeId}, symbol=${symbol}, size=${size}`);

      return {
        tradeId,
        stage: 2,
        size,
        price,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('[StagedEntry] recordSecondLeg错误:', error);
      throw error;
    }
  }

  /**
   * 移动止损到盈亏平衡点
   * @param {number} tradeId - simulation_trades.id
   * @param {number} entryPrice - 平均入场价
   * @param {string} side - 交易方向
   * @returns {Promise<Object>} 新止损价格
   */
  async moveStopToBreakeven(tradeId, entryPrice, side) {
    try {
      // 计算盈亏平衡止损（加缓冲）
      let breakevenSL;
      if (side === 'LONG') {
        breakevenSL = entryPrice * (1 + this.params.breakevenBuffer);
      } else {
        breakevenSL = entryPrice * (1 - this.params.breakevenBuffer);
      }

      // 更新止损
      await this.database.pool.query(`
        UPDATE simulation_trades
        SET stop_loss = ?,
            stop_loss_type = 'breakeven',
            stop_loss_adjusted_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [breakevenSL, tradeId]);

      logger.info(`[StagedEntry] ✅ 止损移至盈亏平衡: tradeId=${tradeId}, newSL=${breakevenSL.toFixed(4)}`);

      return {
        tradeId,
        newStopLoss: parseFloat(breakevenSL.toFixed(8)),
        type: 'breakeven',
        buffer: this.params.breakevenBuffer,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('[StagedEntry] moveStopToBreakeven错误:', error);
      throw error;
    }
  }

  /**
   * 获取交易的分批信息
   * @param {number} tradeId - simulation_trades.id
   * @returns {Promise<Object>} 分批信息
   */
  async getStageInfo(tradeId) {
    try {
      const [rows] = await this.database.pool.query(`
        SELECT 
          staged_entry,
          stage_count,
          staged_orders,
          entry_price,
          stop_loss,
          stop_loss_type
        FROM simulation_trades
        WHERE id = ?
      `, [tradeId]);

      if (rows.length === 0) {
        return { found: false, reason: 'trade_not_found' };
      }

      const trade = rows[0];
      let stagedOrders = [];

      if (trade.staged_orders) {
        stagedOrders = JSON.parse(trade.staged_orders);
      }

      return {
        found: true,
        tradeId,
        stagedEntry: Boolean(trade.staged_entry),
        stageCount: trade.stage_count || 1,
        stages: stagedOrders,
        entryPrice: parseFloat(trade.entry_price),
        stopLoss: trade.stop_loss ? parseFloat(trade.stop_loss) : null,
        stopLossType: trade.stop_loss_type
      };
    } catch (error) {
      logger.error('[StagedEntry] getStageInfo错误:', error);
      return { found: false, reason: 'error', error: error.message };
    }
  }

  /**
   * 获取动量拒绝原因
   * @private
   */
  _getMomentumRejectReason(priceConfirmed, volumeConfirmed) {
    if (!priceConfirmed && !volumeConfirmed) {
      return 'price_and_volume_weak';
    }
    if (!priceConfirmed) {
      return 'price_momentum_weak';
    }
    if (!volumeConfirmed) {
      return 'volume_weak';
    }
    return 'unknown';
  }
}

module.exports = StagedEntryManager;

