/**
 * 候选-确认分层聪明钱检测器
 * 基于smartmoney.md文档的"候选→确认"分层策略
 * 解决现有系统滞后和不准确的问题
 * 
 * 设计原则：
 * 1. 单一职责：专注于候选-确认分层检测
 * 2. 开闭原则：支持参数扩展和阈值调整
 * 3. 依赖倒置：依赖抽象接口而非具体实现
 * 4. 接口隔离：提供简洁的检测接口
 * 5. 事件驱动：使用EventEmitter发布检测事件
 * 6. 高性能：支持实时数据流处理
 * 7. 可观测性：提供详细的调试日志和事件
 */

const EventEmitter = require('events');
const logger = require('../../utils/logger');

/**
 * 阶段枚举
 */
const Phase = {
  NONE: 'none',
  ACCUMULATE: 'accumulate',
  MARKUP: 'markup',
  DISTRIBUTION: 'distribution',
  MARKDOWN: 'markdown'
};

/**
 * 候选-确认分层聪明钱检测器
 */
class CandidateConfirmDetector extends EventEmitter {
  constructor(database, binanceAPI, options = {}) {
    super();

    this.database = database;
    this.binanceAPI = binanceAPI;

    // 当前阶段状态：symbol -> state
    this.stateMap = new Map();

    // 候选状态：symbol -> candidate
    this.candidateMap = new Map();

    // 指标历史：symbol -> metrics[]
    this.metricsHistory = new Map();

    // 默认参数（可从数据库加载）
    this.params = {
      // 价格阈值
      smallDownThreshold: -0.002,  // -0.2%
      smallUpThreshold: 0.002,     // 0.2%
      priceGrowthMin: 0.005,       // 0.5%

      // 成交量阈值
      volThreshold1: 1.2,          // 吸筹确认
      volThreshold2: 1.5,          // 拉升/派发确认
      volThreshold3: 2.0,          // 砸盘确认（更强）

      // 价格跌幅阈值
      dropThreshold: -0.01,        // -1%

      // 时间参数
      minHoldPeriods: 2,           // 最小保持周期数
      candidateMaxAge: 90000,      // 候选最大存活时间(ms)
      keepAliveWindowMs: 180000,   // 指标保持窗口(ms)

      // 趋势影响因子
      trendInfluence: 0.25,        // 0..1

      // 调试模式
      debug: false,

      // 数据更新频率（秒）
      updateIntervalSec: 1,        // 1秒更新一次

      // 指标窗口大小
      metricsWindowSize: 100,      // 保留最近100个指标

      ...options
    };

    // 中文映射
    this.phaseMapping = {
      [Phase.NONE]: '无动作',
      [Phase.ACCUMULATE]: '吸筹',
      [Phase.MARKUP]: '拉升',
      [Phase.DISTRIBUTION]: '派发',
      [Phase.MARKDOWN]: '砸盘'
    };
  }

  /**
   * 初始化检测器
   */
  async initialize() {
    try {
      logger.info('[候选确认检测器] 初始化...');

      // 加载参数配置
      await this.loadParams();

      // 加载历史状态
      await this.loadStates();

      logger.info('[候选确认检测器] 初始化完成');
    } catch (error) {
      logger.error('[候选确认检测器] 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 加载参数配置
   */
  async loadParams() {
    try {
      const sql = `
        SELECT param_name, param_value 
        FROM strategy_params 
        WHERE category = 'candidate_confirm_smart_money'
      `;

      const rows = await this.database.query(sql);

      for (const row of rows) {
        const key = row.param_name.replace('ccsm_', '');
        const value = parseFloat(row.param_value);

        if (!isNaN(value) && this.params.hasOwnProperty(key)) {
          this.params[key] = value;
        }
      }

      logger.info('[候选确认检测器] 参数加载完成:', this.params);
    } catch (error) {
      logger.warn('[候选确认检测器] 参数加载失败，使用默认值:', error.message);
    }
  }

  /**
   * 加载历史状态
   */
  async loadStates() {
    try {
      const sql = `
        SELECT symbol, current_stage, stage_confidence, stage_duration_ms
        FROM four_phase_smart_money_results
        WHERE timestamp = (
          SELECT MAX(timestamp) 
          FROM four_phase_smart_money_results s2 
          WHERE s2.symbol = four_phase_smart_money_results.symbol
        )
      `;

      const rows = await this.database.query(sql);

      for (const row of rows) {
        this.stateMap.set(row.symbol, {
          phase: row.current_stage,
          confidence: row.stage_confidence,
          startTime: Date.now() - row.stage_duration_ms
        });
      }

      logger.info(`[候选确认检测器] 加载${rows.length}个交易对的历史状态`);
    } catch (error) {
      logger.warn('[候选确认检测器] 历史状态加载失败:', error.message);
    }
  }

  /**
   * 处理新的市场指标
   * @param {string} symbol - 交易对
   * @param {Object} metrics - 市场指标
   */
  onNewMetrics(symbol, metrics) {
    try {
      logger.info(`[候选确认检测器] 收到${symbol}指标:`, {
        time: metrics.time,
        price: metrics.price,
        volume: metrics.volume,
        dCVD: metrics.prevCVD !== undefined ? (metrics.CVD - metrics.prevCVD) : 'N/A',
        dOI: metrics.oiChange
      });

      // 验证指标完整性
      if (!this.validateMetrics(metrics)) {
        logger.warn(`[候选确认检测器] ${symbol} 指标不完整:`, metrics);
        return;
      }

      // 计算变化量
      const deltas = this.calculateDeltas(symbol, metrics);

      logger.info(`[候选确认检测器] ${symbol} 变化量:`, {
        dPrice: deltas.dPrice,
        dCVD: deltas.dCVD,
        dOI: deltas.dOI,
        volRatio: deltas.volRatio
      });

      // 保存指标历史
      this.saveMetricsHistory(symbol, metrics);

      // 检查候选条件
      const candidateChecks = this.evaluateCandidates(symbol, metrics, deltas);

      logger.info(`[候选确认检测器] ${symbol} 候选条件评估:`, {
        accumulate: candidateChecks.accumulate.candidate,
        markup: candidateChecks.markup.candidate,
        distribution: candidateChecks.distribution.candidate,
        markdown: candidateChecks.markdown.candidate,
        hasExistingCandidate: this.candidateMap.has(symbol)
      });

      // 处理现有候选
      if (this.candidateMap.has(symbol)) {
        this.processExistingCandidate(symbol, metrics, candidateChecks, deltas);
      } else {
        // 创建新候选
        this.createCandidate(symbol, metrics, candidateChecks, deltas);
      }

      // 检查是否应该重置到NONE
      this.checkResetToNone(symbol, metrics, deltas);

      // 调试输出
      if (this.params.debug) {
        this.emit('debug', {
          symbol,
          metrics,
          deltas,
          candidateChecks,
          currentState: this.stateMap.get(symbol),
          currentCandidate: this.candidateMap.get(symbol)
        });
      }
    } catch (error) {
      logger.error(`[候选确认检测器] 处理${symbol}指标失败:`, error);
    }
  }

  /**
   * 验证指标完整性
   */
  validateMetrics(metrics) {
    return (
      typeof metrics.time === 'number' &&
      typeof metrics.price === 'number' &&
      typeof metrics.volume === 'number' &&
      typeof metrics.volAvg === 'number' &&
      typeof metrics.CVD === 'number'
    );
  }

  /**
   * 计算变化量
   */
  calculateDeltas(symbol, metrics) {
    const history = this.metricsHistory.get(symbol) || [];
    const prevMetrics = history[history.length - 1];

    if (!prevMetrics) {
      return {
        dPrice: 0,
        dCVD: 0,
        dOI: 0,
        volRatio: safeDiv(metrics.volume, metrics.volAvg)
      };
    }

    const dPrice = (metrics.price - prevMetrics.price) / prevMetrics.price;
    const dCVD = metrics.CVD - prevMetrics.CVD;
    const dOI = metrics.OI && prevMetrics.OI ?
      (metrics.OI - prevMetrics.OI) / prevMetrics.OI : 0;
    const volRatio = safeDiv(metrics.volume, metrics.volAvg);

    return { dPrice, dCVD, dOI, volRatio };
  }

  /**
   * 保存指标历史
   */
  saveMetricsHistory(symbol, metrics) {
    if (!this.metricsHistory.has(symbol)) {
      this.metricsHistory.set(symbol, []);
    }

    const history = this.metricsHistory.get(symbol);
    history.push(metrics);

    // 保持窗口大小
    if (history.length > this.params.metricsWindowSize) {
      history.shift();
    }
  }

  /**
   * 评估候选条件
   */
  evaluateCandidates(symbol, metrics, deltas) {
    const p = this.params;
    const checks = {
      accumulate: { candidate: false },
      markup: { candidate: false },
      distribution: { candidate: false },
      markdown: { candidate: false }
    };

    // ACCUMULATE候选：小幅下跌/横盘 + CVD↑ + OI↑
    if (deltas.dPrice <= p.smallDownThreshold && deltas.dCVD > 0 && deltas.dOI > 0) {
      checks.accumulate = {
        candidate: true,
        reason: '价格小幅下跌/横盘 && CVD上升 && OI上升',
        score: 0.6
      };
    }

    // MARKUP候选：价格上涨 + CVD↑ + OI↑
    if (deltas.dPrice > 0 && deltas.dCVD > 0 && deltas.dOI > 0) {
      checks.markup = {
        candidate: true,
        reason: '价格上涨 && CVD上升 && OI上升',
        score: 0.6
      };
    }

    // DISTRIBUTION候选：横盘/小幅上涨 + CVD↓ + OI↑
    if (Math.abs(deltas.dPrice) < Math.abs(p.smallUpThreshold) && deltas.dCVD < 0 && deltas.dOI > 0) {
      checks.distribution = {
        candidate: true,
        reason: '价格横盘/小幅上涨 && CVD下降 && OI上升',
        score: 0.6
      };
    }

    // MARKDOWN候选：价格下跌 + CVD↓ + OI↓
    if (deltas.dPrice < 0 && deltas.dCVD < 0 && deltas.dOI < 0) {
      checks.markdown = {
        candidate: true,
        reason: '价格下跌 && CVD下降 && OI下降',
        score: 0.6
      };
    }

    return checks;
  }

  /**
   * 处理现有候选
   */
  processExistingCandidate(symbol, metrics, candidateChecks, deltas) {
    const candidate = this.candidateMap.get(symbol);
    const now = metrics.time;
    const age = now - candidate.since;

    // 检查候选是否过期
    if (age > this.params.candidateMaxAge) {
      logger.info(`[候选确认检测器] ${symbol} 候选${candidate.phase}过期`);
      this.candidateMap.delete(symbol);
      return;
    }

    // 尝试确认候选
    const confirmResult = this.attemptConfirm(symbol, candidate, metrics, deltas);

    if (confirmResult.confirmed) {
      // 确认成功，应用阶段变化
      this.applyPhaseChange(symbol, confirmResult.toPhase, metrics, confirmResult.confidence, confirmResult.reason);
      this.candidateMap.delete(symbol);

      // 触发事件
      this.emit('phase_change', {
        symbol,
        from: this.stateMap.get(symbol)?.phase || Phase.NONE,
        to: confirmResult.toPhase,
        time: metrics.time,
        metrics,
        confidence: confirmResult.confidence,
        reason: confirmResult.reason
      });
    }
  }

  /**
   * 创建新候选
   */
  createCandidate(symbol, metrics, candidateChecks, deltas) {
    // 查找满足条件的候选
    for (const phase of [Phase.ACCUMULATE, Phase.MARKUP, Phase.DISTRIBUTION, Phase.MARKDOWN]) {
      const check = candidateChecks[phase];

      if (check.candidate) {
        this.candidateMap.set(symbol, {
          phase,
          since: metrics.time,
          metrics,
          reason: check.reason,
          score: check.score
        });

        logger.info(`[候选确认检测器] ${symbol} 创建候选: ${phase} - ${check.reason}`);

        // 触发事件
        this.emit('candidate', {
          symbol,
          phase,
          since: metrics.time,
          metrics,
          reason: check.reason
        });

        break;
      }
    }
  }

  /**
   * 尝试确认候选
   */
  attemptConfirm(symbol, candidate, metrics, deltas) {
    const p = this.params;
    const phase = candidate.phase;
    const trendFactor = this.getTrendFactor(symbol, metrics);

    // 动态调整阈值
    const adjust = (base) => {
      const tf = p.trendInfluence;
      if (trendFactor === 0) return base;
      return base * (1 - tf * Math.abs(trendFactor));
    };

    let confirmed = false;
    let confidence = 0;
    let reason = '';

    switch (phase) {
      case Phase.ACCUMULATE: {
        const vt = adjust(p.volThreshold1);
        if (deltas.volRatio >= vt && deltas.dCVD > 0 && deltas.dOI > 0) {
          confirmed = true;
          confidence = Math.min(1, 0.6 + (deltas.volRatio - vt) * 0.2);
          reason = `吸筹确认: 成交量比率${deltas.volRatio.toFixed(2)} >= ${vt.toFixed(2)}`;
        }
        break;
      }

      case Phase.MARKUP: {
        const vt = adjust(p.volThreshold2);
        if (deltas.volRatio >= vt && deltas.dPrice >= p.priceGrowthMin && deltas.dCVD > 0 && deltas.dOI > 0) {
          confirmed = true;
          confidence = Math.min(1, 0.6 + (deltas.dPrice / p.priceGrowthMin) * 0.4);
          reason = `拉升确认: 价格增长${deltas.dPrice.toFixed(4)} && 成交量比率${deltas.volRatio.toFixed(2)}`;
        }
        break;
      }

      case Phase.DISTRIBUTION: {
        const vt = adjust(p.volThreshold2);
        if (deltas.volRatio >= vt && deltas.dCVD < 0 && deltas.dOI > 0 && Math.abs(deltas.dPrice) < Math.abs(p.smallUpThreshold)) {
          confirmed = true;
          confidence = Math.min(1, 0.6 + (deltas.volRatio - vt) * 0.2);
          reason = `派发确认: 成交量比率${deltas.volRatio.toFixed(2)}`;
        }
        break;
      }

      case Phase.MARKDOWN: {
        const vt = adjust(p.volThreshold3);
        if (deltas.volRatio >= vt && deltas.dCVD < 0 && deltas.dOI < 0 && deltas.dPrice <= p.dropThreshold) {
          confirmed = true;
          confidence = Math.min(1, 0.7 + Math.abs(deltas.dPrice / p.dropThreshold) * 0.3);
          reason = `砸盘确认: 价格跌幅${deltas.dPrice.toFixed(4)} && 成交量比率${deltas.volRatio.toFixed(2)}`;
        }
        break;
      }
    }

    return { confirmed, toPhase: phase, confidence, reason };
  }

  /**
   * 应用阶段变化
   */
  applyPhaseChange(symbol, toPhase, metrics, confidence, reason) {
    const currentState = this.stateMap.get(symbol);
    const fromPhase = currentState?.phase || Phase.NONE;

    if (fromPhase === toPhase) {
      return;
    }

    this.stateMap.set(symbol, {
      phase: toPhase,
      confidence,
      startTime: metrics.time
    });

    logger.info(`[候选确认检测器] ${symbol} 阶段变化: ${fromPhase} -> ${toPhase} (置信度: ${confidence.toFixed(2)})`);

    // 保存到数据库
    this.savePhaseChange(symbol, fromPhase, toPhase, metrics, confidence, reason);
  }

  /**
   * 保存阶段变化到数据库
   */
  async savePhaseChange(symbol, fromPhase, toPhase, metrics, confidence, reason) {
    try {
      const sql = `
        INSERT INTO four_phase_smart_money_results (
          symbol, timestamp, current_stage, stage_confidence, 
          stage_duration_ms, trigger_reasons, raw_indicators
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        symbol,
        metrics.time,
        toPhase,
        confidence,
        Date.now() - metrics.time,
        JSON.stringify([reason]),
        JSON.stringify(metrics)
      ];

      await this.database.query(sql, params);

      // 保存状态转换记录
      const transitionSql = `
        INSERT INTO four_phase_stage_transitions (
          symbol, from_stage, to_stage, transition_time,
          transition_confidence, transition_reasons,
          price_at_transition, volume_at_transition
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const transitionParams = [
        symbol,
        fromPhase,
        toPhase,
        metrics.time,
        confidence,
        JSON.stringify([reason]),
        metrics.price,
        metrics.volume
      ];

      await this.database.query(transitionSql, transitionParams);
    } catch (error) {
      logger.error(`[候选确认检测器] 保存${symbol}阶段变化失败:`, error);
    }
  }

  /**
   * 检查是否应该重置到NONE
   */
  checkResetToNone(symbol, metrics, deltas) {
    const currentState = this.stateMap.get(symbol);

    if (!currentState || currentState.phase === Phase.NONE) {
      return;
    }

    // 检查是否满足最小保持时间
    const minHoldMs = this.params.minHoldPeriods * 1000;
    const holdTime = metrics.time - currentState.startTime;

    if (holdTime < minHoldMs) {
      return;
    }

    // 检查是否稳定（指标变化很小）
    if (this.isStableToNone(metrics, deltas)) {
      this.applyPhaseChange(symbol, Phase.NONE, metrics, 0.5, '指标稳定，无阶段信号');
    }
  }

  /**
   * 检查是否稳定到NONE
   */
  isStableToNone(metrics, deltas) {
    const c1 = Math.abs(deltas.dCVD) < 1e-6;
    const c2 = Math.abs(deltas.dOI) < 0.005;
    const c3 = deltas.volRatio < 1.05;

    return c1 && c2 && c3;
  }

  /**
   * 获取趋势因子
   */
  getTrendFactor(symbol, metrics) {
    // 简化实现，实际应该基于多时间框架EMA
    if (metrics.trendScore !== undefined) {
      return (metrics.trendScore - 50) / 50; // -1..1
    }
    return 0;
  }

  /**
   * 获取当前状态
   */
  getState(symbol) {
    const state = this.stateMap.get(symbol);
    const candidate = this.candidateMap.get(symbol);

    return {
      phase: state?.phase || Phase.NONE,
      confidence: state?.confidence || 0,
      startTime: state?.startTime || 0,
      candidate: candidate ? {
        phase: candidate.phase,
        since: candidate.since,
        reason: candidate.reason
      } : null
    };
  }

  /**
   * 获取所有交易对状态
   */
  getAllStates() {
    const states = {};

    for (const [symbol, state] of this.stateMap.entries()) {
      states[symbol] = this.getState(symbol);
    }

    return states;
  }
}

// 安全除法
function safeDiv(a, b) {
  if (!b || !isFinite(b) || b === 0) return a || 0;
  return (a || 0) / b;
}

module.exports = {
  CandidateConfirmDetector,
  Phase
};

