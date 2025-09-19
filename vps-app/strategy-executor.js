/**
 * 策略执行器 - 根据V3和ICT策略文档实现模拟交易逻辑
 * 包含止盈止损、最大杠杆、最小保证金计算
 */

const sqlite3 = require('sqlite3').verbose();

class StrategyExecutor {
  constructor(dbPath = './smartflow.db') {
    this.db = new sqlite3.Database(dbPath);
  }

  /**
   * V3策略执行逻辑
   * 基于strategy-v3.md文档
   */
  async executeV3Strategy(signal) {
    try {
      // 获取4H、1H、15m K线数据
      const klines4h = await this.fetchKLines(signal.symbol, '4h', 250);
      const klines1h = await this.fetchKLines(signal.symbol, '1h', 50);
      const klines15m = await this.fetchKLines(signal.symbol, '15m', 50);

      // 1. 4H趋势判断
      const trend4h = this.detectTrend4H(klines4h);
      if (trend4h === 'RANGE') return null;

      // 2. 1H多因子打分确认
      const score1h = this.scoreFactors1H(klines1h, trend4h);
      if (score1h < 3) return null;

      // 3. 15m入场执行确认
      const entrySignal = this.check15mEntry(klines15m, trend4h);
      if (!entrySignal) return null;

      // 4. 计算交易参数
      const atr14 = this.calculateATR(klines15m, 14);
      const currentPrice = parseFloat(signal.currentPrice);

      // 计算止损止盈
      const { stopLoss, takeProfit, maxLeverage, minMargin, stopLossDistance, atrValue } = this.calculateV3Parameters(
        currentPrice, atr14, entrySignal, trend4h
      );

      // 5. 创建模拟交易记录
      const simulation = {
        symbol: signal.symbol,
        strategy_type: 'V3',
        entry_price: currentPrice,
        stop_loss_price: stopLoss,
        take_profit_price: takeProfit,
        max_leverage: maxLeverage,
        min_margin: minMargin,
        stop_loss_distance: stopLossDistance,
        atr_value: atrValue,
        trigger_reason: `V3策略${signal.signal}信号-15m确认`,
        status: 'ACTIVE'
      };

      return simulation;
    } catch (error) {
      console.error('V3策略执行失败:', error);
      return null;
    }
  }

  /**
   * ICT策略执行逻辑
   * 基于ict.md文档
   */
  async executeICTStrategy(signal) {
    try {
      // 检查信号是否有效
      if (!signal.signalType || signal.signalType === 'WAIT') {
        console.log(`ICT策略跳过 ${signal.symbol}: 信号类型为 ${signal.signalType}`);
        return null;
      }

      // 检查是否已有活跃交易
      const existingSql = 'SELECT COUNT(*) as count FROM simulations WHERE symbol = ? AND status = "ACTIVE"';
      const existing = await new Promise((resolve, reject) => {
        this.db.get(existingSql, [signal.symbol], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (existing.count > 0) {
        console.log(`ICT策略跳过 ${signal.symbol}: 已有活跃交易`);
        return null;
      }

      // 使用模拟信号数据计算交易参数
      const currentPrice = parseFloat(signal.currentPrice || signal.entryPrice);
      if (!currentPrice || currentPrice <= 0) {
        console.log(`ICT策略跳过 ${signal.symbol}: 无效价格 ${currentPrice}`);
        return null;
      }

      // 基于信号类型计算交易参数
      const direction = signal.signalType.includes('LONG') ? 'LONG' : 'SHORT';
      const atrValue = currentPrice * 0.02; // 2% ATR
      
      let stopLoss, takeProfit;
      if (direction === 'LONG') {
        stopLoss = currentPrice - atrValue * 1.5; // 1.5倍ATR止损
        takeProfit = currentPrice + atrValue * 4.5; // 3:1风险回报比
      } else {
        stopLoss = currentPrice + atrValue * 1.5;
        takeProfit = currentPrice - atrValue * 4.5;
      }

      // 计算杠杆和保证金
      const stopLossDistance = Math.abs(currentPrice - stopLoss) / currentPrice;
      const maxLeverage = Math.floor(1 / (stopLossDistance + 0.005));
      const maxLossAmount = 100;
      const minMargin = Math.ceil(maxLossAmount / (maxLeverage * stopLossDistance));

      // 创建模拟交易记录
      const simulation = {
        symbol: signal.symbol,
        strategy_type: 'ICT',
        entry_price: currentPrice,
        stop_loss_price: stopLoss,
        take_profit_price: takeProfit,
        max_leverage: maxLeverage,
        min_margin: minMargin,
        stop_loss_distance: stopLossDistance * 100,
        atr_value: atrValue,
        trigger_reason: `ICT策略${signal.signalType}信号确认`,
        status: 'ACTIVE'
      };

      console.log(`🎯 ICT策略创建模拟交易: ${signal.symbol} ${direction} @${currentPrice}`);
      return simulation;
    } catch (error) {
      console.error('ICT策略执行失败:', error);
      return null;
    }
  }

  /**
   * V3策略参数计算
   * 基于strategy-v3.md文档的杠杆和保证金计算逻辑
   */
  calculateV3Parameters(currentPrice, atr14, entrySignal, trend4h) {
    // 计算止损距离（使用ATR或固定比例，取较大值）
    const atrStopDistance = atr14 * 1.2; // 1.2倍ATR
    const fixedStopDistance = currentPrice * 0.02; // 2%固定止损
    const stopLossDistance = Math.max(atrStopDistance, fixedStopDistance);

    let stopLoss, takeProfit;
    if (trend4h === 'LONG') {
      stopLoss = currentPrice - stopLossDistance;
      takeProfit = currentPrice + (stopLossDistance * 2); // 1:2风险回报比
    } else {
      stopLoss = currentPrice + stopLossDistance;
      takeProfit = currentPrice - (stopLossDistance * 2); // 1:2风险回报比
    }

    // 按照strategy-v3.md计算杠杆和保证金
    // 止损距离X% = |entrySignal - stopLoss| / entrySignal
    const stopLossPercentage = Math.abs(currentPrice - stopLoss) / currentPrice;
    
    // 最大杠杆数Y = 1/(X%+0.5%) 数值向下取整
    const maxLeverage = Math.floor(1 / (stopLossPercentage + 0.005));
    
    // 最大损失金额M = 用户选择的单次交易最大损失金额（假设100 USDT）
    const maxLossAmount = 100;
    
    // 保证金Z = M/(Y*X%) 数值向上取整
    const minMargin = Math.ceil(maxLossAmount / (maxLeverage * stopLossPercentage));

    return { 
      stopLoss, 
      takeProfit, 
      maxLeverage, 
      minMargin, 
      stopLossDistance: stopLossPercentage * 100, // 转换为百分比
      atrValue: atr14 
    };
  }

  /**
   * ICT策略参数计算
   * 基于ict.md文档的杠杆和保证金计算逻辑
   */
  calculateICTParameters(currentPrice, ob, atr4h, trend1d) {
    let stopLoss, takeProfit;
    
    if (trend1d === 'up') {
      // 上升趋势：止损在OB下沿-1.5×ATR或最近3根4H最低点
      stopLoss = Math.min(ob.low - 1.5 * atr4h, ob.low * 0.98);
      const stopDistance = currentPrice - stopLoss;
      takeProfit = currentPrice + 3 * stopDistance; // RR=3:1
    } else {
      // 下降趋势：止损在OB上沿+1.5×ATR或最近3根4H最高点
      stopLoss = Math.max(ob.high + 1.5 * atr4h, ob.high * 1.02);
      const stopDistance = stopLoss - currentPrice;
      takeProfit = currentPrice - 3 * stopDistance; // RR=3:1
    }

    // 按照strategy-v3.md计算杠杆和保证金
    // 止损距离X% = |entrySignal - stopLoss| / entrySignal
    const stopLossPercentage = Math.abs(currentPrice - stopLoss) / currentPrice;
    
    // 最大杠杆数Y = 1/(X%+0.5%) 数值向下取整
    const maxLeverage = Math.floor(1 / (stopLossPercentage + 0.005));
    
    // 最大损失金额M = 用户选择的单次交易最大损失金额（假设100 USDT）
    const maxLossAmount = 100;
    
    // 保证金Z = M/(Y*X%) 数值向上取整
    const minMargin = Math.ceil(maxLossAmount / (maxLeverage * stopLossPercentage));

    return { 
      stopLoss, 
      takeProfit, 
      maxLeverage, 
      minMargin, 
      stopLossDistance: stopLossPercentage * 100, // 转换为百分比
      atrValue: atr4h 
    };
  }

  /**
   * 4H趋势判断
   */
  detectTrend4H(klines) {
    if (klines.length < 200) return 'RANGE';

    const closes = klines.map(k => parseFloat(k[4]));
    const ma20 = this.calculateMA(closes, 20);
    const ma50 = this.calculateMA(closes, 50);
    const ma200 = this.calculateMA(closes, 200);

    const lastClose = closes[closes.length - 1];
    const lastMA20 = ma20[ma20.length - 1];
    const lastMA50 = ma50[ma50.length - 1];
    const lastMA200 = ma200[ma200.length - 1];

    // 多头趋势条件
    if (lastClose > lastMA20 && lastMA20 > lastMA50 && lastMA50 > lastMA200) {
      return 'LONG';
    }
    // 空头趋势条件
    if (lastClose < lastMA20 && lastMA20 < lastMA50 && lastMA50 < lastMA200) {
      return 'SHORT';
    }

    return 'RANGE';
  }

  /**
   * 1D趋势判断
   */
  detectTrend1D(klines) {
    if (klines.length < 20) return 'sideways';

    const closes = klines.map(k => parseFloat(k[4]));
    const last20 = closes.slice(-20);
    
    if (last20[last20.length - 1] > last20[0]) return 'up';
    if (last20[last20.length - 1] < last20[0]) return 'down';
    return 'sideways';
  }

  /**
   * 1H多因子打分
   */
  scoreFactors1H(klines, trend4h) {
    if (klines.length < 20) return 0;

    const last = klines[klines.length - 1];
    const close = parseFloat(last[4]);
    const high = parseFloat(last[2]);
    const low = parseFloat(last[3]);
    const volume = parseFloat(last[5]);

    let score = 0;

    // 计算VWAP
    const vwap = this.calculateVWAP(klines.slice(-20));
    if (vwap) {
      if (trend4h === 'LONG' && close > vwap) score += 1;
      if (trend4h === 'SHORT' && close < vwap) score += 1;
    }

    // 突破确认
    const highs = klines.slice(-20).map(k => parseFloat(k[2]));
    const lows = klines.slice(-20).map(k => parseFloat(k[3]));
    if (trend4h === 'LONG' && close > Math.max(...highs)) score += 1;
    if (trend4h === 'SHORT' && close < Math.min(...lows)) score += 1;

    // 成交量确认
    const avgVolume = klines.slice(-20).reduce((sum, k) => sum + parseFloat(k[5]), 0) / 20;
    if (volume >= avgVolume * 1.5) score += 1;

    return score;
  }

  /**
   * 15m入场检查
   */
  check15mEntry(klines, trend4h) {
    if (klines.length < 2) return null;

    const last = klines[klines.length - 1];
    const prev = klines[klines.length - 2];
    
    const lastClose = parseFloat(last[4]);
    const prevClose = parseFloat(prev[4]);

    // 简单的突破确认
    if (trend4h === 'LONG' && lastClose > prevClose) return 'long';
    if (trend4h === 'SHORT' && lastClose < prevClose) return 'short';
    
    return null;
  }

  /**
   * ICT入场检查
   */
  checkICTEntry(klines, ob, trend1d) {
    if (klines.length < 2) return false;

    const last = klines[klines.length - 1];
    const prev = klines[klines.length - 2];
    
    const lastClose = parseFloat(last[4]);
    const prevClose = parseFloat(prev[4]);

    // 检查是否在OB区域内
    if (lastClose >= ob.low && lastClose <= ob.high) {
      // 检查吞没形态
      if (trend1d === 'up' && lastClose > prevClose) return true;
      if (trend1d === 'down' && lastClose < prevClose) return true;
    }

    return false;
  }

  /**
   * 检测订单块(OB)
   */
  detectOB(klines, atr4h) {
    if (klines.length < 2) return null;

    const last = klines[klines.length - 2];
    const low = parseFloat(last[3]);
    const high = parseFloat(last[2]);

    // 检查OB高度
    if ((high - low) < 0.25 * atr4h) return null;

    return { low, high, time: last[0] };
  }

  /**
   * 检测Sweep宏观速率
   */
  detectSweepHTF(ob, klines, atr4h) {
    // 简化实现：检查是否有突破OB边界
    const recent = klines.slice(-3);
    for (let k of recent) {
      const high = parseFloat(k[2]);
      const low = parseFloat(k[3]);
      if (high > ob.high || low < ob.low) return true;
    }
    return false;
  }

  /**
   * 获取K线数据
   */
  async fetchKLines(symbol, interval, limit) {
    const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const response = await fetch(url);
    return await response.json();
  }

  /**
   * 计算移动平均线
   */
  calculateMA(data, period) {
    const result = [];
    for (let i = period - 1; i < data.length; i++) {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
    return result;
  }

  /**
   * 计算ATR
   */
  calculateATR(klines, period) {
    if (klines.length < period + 1) return 0;

    const trs = [];
    for (let i = 1; i < klines.length; i++) {
      const high = parseFloat(klines[i][2]);
      const low = parseFloat(klines[i][3]);
      const prevClose = parseFloat(klines[i - 1][4]);
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trs.push(tr);
    }

    const atr = trs.slice(-period).reduce((sum, tr) => sum + tr, 0) / period;
    return atr;
  }

  /**
   * 计算VWAP
   */
  calculateVWAP(klines) {
    let pvSum = 0;
    let vSum = 0;

    for (const k of klines) {
      const high = parseFloat(k[2]);
      const low = parseFloat(k[3]);
      const close = parseFloat(k[4]);
      const volume = parseFloat(k[5]);

      const typicalPrice = (high + low + close) / 3;
      pvSum += typicalPrice * volume;
      vSum += volume;
    }

    return vSum > 0 ? pvSum / vSum : null;
  }

  /**
   * 保存模拟交易记录
   */
  saveSimulation(simulation) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO simulations (
          symbol, strategy_type, entry_price, stop_loss_price, take_profit_price,
          max_leverage, min_margin, stop_loss_distance, atr_value, trigger_reason, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        simulation.symbol,
        simulation.strategy_type,
        simulation.entry_price,
        simulation.stop_loss_price,
        simulation.take_profit_price,
        simulation.max_leverage,
        simulation.min_margin,
        simulation.stop_loss_distance,
        simulation.atr_value,
        simulation.trigger_reason,
        simulation.status,
        new Date().toISOString()
      ];

      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, ...simulation });
        }
      });
    });
  }

  /**
   * 批量执行策略
   */
  async executeAllStrategies(signals) {
    const results = [];
    
    for (const signal of signals) {
      if (!signal.signal || signal.signal === '--' || signal.signal === '观望') {
        continue;
      }

      let simulation = null;
      
      // 根据策略版本执行对应策略
      if (signal.strategyVersion === 'V3') {
        simulation = await this.executeV3Strategy(signal);
      } else if (signal.strategyVersion === 'ICT') {
        simulation = await this.executeICTStrategy(signal);
      } else {
        // 默认使用V3策略
        simulation = await this.executeV3Strategy(signal);
      }

      if (simulation) {
        try {
          const saved = await this.saveSimulation(simulation);
          results.push(saved);
          console.log(`✅ 策略执行成功: ${signal.symbol} (${simulation.strategy_type})`);
        } catch (error) {
          console.error(`❌ 保存模拟交易失败: ${signal.symbol}`, error);
        }
      }
    }

    return results;
  }
}

module.exports = StrategyExecutor;
