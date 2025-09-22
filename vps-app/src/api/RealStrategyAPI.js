/**
 * 真实策略API接口
 * 提供V3和ICT策略的真实分析结果
 */

const StrategyManager = require('../strategies/StrategyManager');

class RealStrategyAPI {
  constructor(dbPath = './smartflow.db') {
    this.strategyManager = new StrategyManager(dbPath);
    this.isInitialized = false;
  }

  /**
   * 初始化API
   */
  async init() {
    if (!this.isInitialized) {
      await this.strategyManager.init();
      this.isInitialized = true;
      console.log('✅ 真实策略API初始化完成');
    }
  }

  /**
   * 获取V3策略分析结果
   * @param {string} symbol - 交易对符号
   * @param {number} limit - 结果数量限制
   * @returns {Promise<Object>} API响应
   */
  async getV3Analysis(symbol, limit = 10) {
    try {
      await this.init();

      const results = await this.strategyManager.getStrategyResults(symbol, 'V3', limit);

      return {
        success: true,
        data: {
          symbol,
          strategyType: 'V3',
          results,
          count: results.length,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error(`❌ 获取V3分析结果失败 ${symbol}:`, error.message);
      return {
        success: false,
        error: error.message,
        data: {
          symbol,
          strategyType: 'V3',
          results: [],
          count: 0,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * 获取ICT策略分析结果
   * @param {string} symbol - 交易对符号
   * @param {number} limit - 结果数量限制
   * @returns {Promise<Object>} API响应
   */
  async getICTAnalysis(symbol, limit = 10) {
    try {
      await this.init();

      const results = await this.strategyManager.getStrategyResults(symbol, 'ICT', limit);

      return {
        success: true,
        data: {
          symbol,
          strategyType: 'ICT',
          results,
          count: results.length,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error(`❌ 获取ICT分析结果失败 ${symbol}:`, error.message);
      return {
        success: false,
        error: error.message,
        data: {
          symbol,
          strategyType: 'ICT',
          results: [],
          count: 0,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * 获取所有交易对的V3策略信号
   * @returns {Promise<Object>} API响应
   */
  async getAllV3Signals() {
    try {
      await this.init();

      const signals = [];
      const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT', 'XRPUSDT', 'DOGEUSDT', 'DOTUSDT', 'AVAXUSDT', 'LINKUSDT'];

      for (const symbol of symbols) {
        try {
          const results = await this.strategyManager.getStrategyResults(symbol, 'V3', 1);
          if (results.length > 0) {
            const latest = results[0];

            // 转换为前端需要的格式
            const signal = {
              symbol,
              strategyVersion: 'V3',
              signal: latest.final_signal,
              signal_strength: latest.signal_strength,
              trend4h: latest.trend4h,
              score4h: latest.trend4h_score,
              score1h: latest.score1h,
              execution: latest.execution_mode === 'NONE' ? 'NONE' : 'EXECUTE',
              entrySignal: latest.entry_price,
              stopLoss: latest.stop_loss,
              takeProfit: latest.take_profit,
              currentPrice: latest.entry_price,
              timestamp: new Date(latest.analysis_time * 1000).toISOString()
            };

            signals.push(signal);
          }
        } catch (error) {
          console.warn(`⚠️ 获取 ${symbol} V3信号失败:`, error.message);
        }
      }

      return {
        success: true,
        data: signals,
        count: signals.length,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ 获取所有V3信号失败:', error.message);
      return {
        success: false,
        error: error.message,
        data: [],
        count: 0,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 获取所有交易对的ICT策略信号
   * @returns {Promise<Object>} API响应
   */
  async getAllICTSignals() {
    try {
      await this.init();

      const signals = [];
      const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT', 'XRPUSDT', 'DOGEUSDT', 'DOTUSDT', 'AVAXUSDT', 'LINKUSDT'];

      for (const symbol of symbols) {
        try {
          const results = await this.strategyManager.getStrategyResults(symbol, 'ICT', 1);
          if (results.length > 0) {
            const latest = results[0];

            // 转换为前端需要的格式
            const signal = {
              symbol,
              strategyType: 'ICT',
              signalType: latest.signal_type,
              signal_strength: latest.signal_strength,
              dailyTrend: latest.daily_trend,
              obDetected: latest.ob_detected,
              sweepHTF: latest.sweep_htf,
              sweepLTF: latest.sweep_ltf,
              engulfingDetected: latest.engulfing_detected,
              entrySignal: latest.entry_price,
              entryPrice: latest.entry_price,
              stopLoss: latest.stop_loss,
              takeProfit: latest.take_profit,
              currentPrice: latest.entry_price,
              atr4h: latest.atr_4h,
              atr15m: latest.atr_15m,
              timestamp: new Date(latest.analysis_time * 1000).toISOString()
            };

            signals.push(signal);
          }
        } catch (error) {
          console.warn(`⚠️ 获取 ${symbol} ICT信号失败:`, error.message);
        }
      }

      return {
        success: true,
        data: signals,
        count: signals.length,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ 获取所有ICT信号失败:', error.message);
      return {
        success: false,
        error: error.message,
        data: [],
        count: 0,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 触发实时策略分析
   * @param {string} symbol - 交易对符号（可选，不指定则分析所有）
   * @returns {Promise<Object>} API响应
   */
  async triggerAnalysis(symbol = null) {
    try {
      await this.init();

      if (symbol) {
        // 分析指定交易对
        await this.strategyManager.updateSymbolData(symbol);
        await this.strategyManager.analyzeSymbol(symbol);

        return {
          success: true,
          message: `${symbol} 策略分析完成`,
          data: {
            symbol,
            analyzed: true,
            timestamp: new Date().toISOString()
          }
        };
      } else {
        // 分析所有交易对
        await this.strategyManager.updateAllSymbols();
        await this.strategyManager.analyzeAllSymbols();

        return {
          success: true,
          message: '所有交易对策略分析完成',
          data: {
            symbolsAnalyzed: this.strategyManager.symbols.length,
            analyzed: true,
            timestamp: new Date().toISOString()
          }
        };
      }

    } catch (error) {
      console.error('❌ 触发策略分析失败:', error.message);
      return {
        success: false,
        error: error.message,
        message: '策略分析失败',
        data: {
          analyzed: false,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * 获取策略统计信息
   * @returns {Promise<Object>} API响应
   */
  async getStrategyStats() {
    try {
      await this.init();

      const stats = {
        v3: { total: 0, active: 0, signals: 0 },
        ict: { total: 0, active: 0, signals: 0 },
        symbols: this.strategyManager.symbols.length,
        lastUpdate: new Date().toISOString()
      };

      // 统计V3策略
      for (const symbol of this.strategyManager.symbols) {
        const v3Results = await this.strategyManager.getStrategyResults(symbol, 'V3', 1);
        if (v3Results.length > 0) {
          stats.v3.total++;
          if (v3Results[0].final_signal !== '观望') {
            stats.v3.signals++;
          }
        }
      }

      // 统计ICT策略
      for (const symbol of this.strategyManager.symbols) {
        const ictResults = await this.strategyManager.getStrategyResults(symbol, 'ICT', 1);
        if (ictResults.length > 0) {
          stats.ict.total++;
          if (ictResults[0].signal_type !== 'WAIT') {
            stats.ict.signals++;
          }
        }
      }

      return {
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ 获取策略统计失败:', error.message);
      return {
        success: false,
        error: error.message,
        data: null,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 关闭API
   */
  async close() {
    if (this.isInitialized) {
      await this.strategyManager.close();
      this.isInitialized = false;
    }
  }
}

module.exports = RealStrategyAPI;
