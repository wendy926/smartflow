/**
 * 更新现有模拟交易记录的缺失字段
 * 计算止损距离、ATR值，并重新计算杠杆和保证金
 */

const sqlite3 = require('sqlite3').verbose();
const StrategyExecutor = require('./strategy-executor');

class SimulationUpdater {
  constructor(dbPath = './smartflow.db') {
    this.db = new sqlite3.Database(dbPath);
    this.strategyExecutor = new StrategyExecutor(dbPath);
  }

  /**
   * 更新现有模拟交易记录
   */
  async updateExistingSimulations() {
    try {
      console.log('🔄 开始更新现有模拟交易记录...');
      
      // 获取所有模拟交易记录
      const simulations = await this.getAllSimulations();
      console.log(`📊 找到 ${simulations.length} 条模拟交易记录`);

      for (const sim of simulations) {
        await this.updateSimulation(sim);
      }

      console.log('✅ 所有模拟交易记录更新完成');
    } catch (error) {
      console.error('❌ 更新模拟交易记录失败:', error);
    }
  }

  /**
   * 获取所有模拟交易记录
   */
  getAllSimulations() {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM simulations ORDER BY id';
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * 更新单个模拟交易记录
   */
  async updateSimulation(sim) {
    try {
      console.log(`🔄 更新 ${sim.symbol} (${sim.strategy_type})...`);

      // 获取K线数据计算ATR
      const klines15m = await this.strategyExecutor.fetchKLines(sim.symbol, '15m', 50);
      const klines4h = await this.strategyExecutor.fetchKLines(sim.symbol, '4h', 50);
      
      let atrValue;
      if (sim.strategy_type === 'V3') {
        atrValue = this.strategyExecutor.calculateATR(klines15m, 14);
      } else {
        atrValue = this.strategyExecutor.calculateATR(klines4h, 14);
      }

      // 计算止损距离百分比
      const entryPrice = parseFloat(sim.entry_price);
      const stopLossPrice = parseFloat(sim.stop_loss_price);
      const stopLossDistance = Math.abs(entryPrice - stopLossPrice) / entryPrice * 100;

      // 重新计算杠杆和保证金
      const stopLossPercentage = Math.abs(entryPrice - stopLossPrice) / entryPrice;
      const maxLeverage = Math.floor(1 / (stopLossPercentage + 0.005));
      const maxLossAmount = 100;
      const minMargin = Math.ceil(maxLossAmount / (maxLeverage * stopLossPercentage));

      // 为CLOSED状态的交易设置出场价格
      let exitPrice = null;
      if (sim.status === 'CLOSED' && !sim.exit_price) {
        // 根据盈亏情况设置出场价格
        if (sim.profit_loss > 0) {
          // 盈利交易，使用止盈价格
          exitPrice = parseFloat(sim.take_profit_price);
        } else {
          // 亏损交易，使用止损价格
          exitPrice = parseFloat(sim.stop_loss_price);
        }
      }

      // 更新数据库记录
      await this.updateSimulationInDB(sim.id, {
        stop_loss_distance: stopLossDistance,
        atr_value: atrValue,
        max_leverage: maxLeverage,
        min_margin: minMargin,
        exit_price: exitPrice
      });

      console.log(`✅ 更新完成: 止损距离=${stopLossDistance.toFixed(2)}%, ATR=${atrValue.toFixed(4)}, 杠杆=${maxLeverage}, 保证金=${minMargin}`);
    } catch (error) {
      console.error(`❌ 更新 ${sim.symbol} 失败:`, error);
    }
  }

  /**
   * 更新数据库记录
   */
  updateSimulationInDB(id, updates) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE simulations 
        SET stop_loss_distance = ?, atr_value = ?, max_leverage = ?, min_margin = ?, 
            exit_price = ?, last_updated = ?
        WHERE id = ?
      `;
      
      const params = [
        updates.stop_loss_distance,
        updates.atr_value,
        updates.max_leverage,
        updates.min_margin,
        updates.exit_price,
        new Date().toISOString(),
        id
      ];

      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id, ...updates });
        }
      });
    });
  }

  /**
   * 关闭数据库连接
   */
  close() {
    this.db.close();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const updater = new SimulationUpdater();
  updater.updateExistingSimulations()
    .then(() => {
      console.log('🎉 更新完成');
      updater.close();
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 更新失败:', error);
      updater.close();
      process.exit(1);
    });
}

module.exports = SimulationUpdater;
