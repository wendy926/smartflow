// modules/notifications/TelegramNotifier.js
// Telegram 通知模块

class TelegramNotifier {
  constructor(db = null) {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_CHAT_ID;
    this.enabled = !!(this.botToken && this.chatId);
    this.db = db;
    // 移除lastExecutions Map，使用数据库存储状态
  }

  async sendMessage(message) {
    if (!this.enabled) {
      console.log('📱 Telegram 通知未配置');
      return { success: false, error: 'Telegram 未配置' };
    }

    try {
      const { default: fetch } = await import('node-fetch');
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: message,
          parse_mode: 'HTML'
        })
      });

      if (response.ok) {
        console.log('✅ Telegram 消息发送成功');
        return { success: true };
      } else {
        const error = await response.text();
        console.error('❌ Telegram 消息发送失败:', error);
        return { success: false, error };
      }
    } catch (error) {
      console.error('❌ Telegram 发送异常:', error.message);
      return { success: false, error: error.message };
    }
  }

  formatSignalMessage(symbol, signalData, executionData, keyReasons) {
    let message = `🚀 <b>SmartFlow 交易信号</b>\n\n`;
    message += `📊 <b>交易对：</b>${symbol}\n`;

    if (signalData && signalData.signal) {
      message += `📈 <b>信号：</b>${signalData.signal}\n`;
    }

    if (executionData && executionData.execution) {
      message += `⚡ <b>入场执行：</b>${executionData.execution}\n`;
    }

    if (keyReasons && keyReasons.length > 0) {
      message += `🔍 <b>关键判断依据：</b>\n`;
      keyReasons.forEach((reason, index) => {
        message += `${index + 1}. ${reason}\n`;
      });
    }

    message += `\n🌐 <b>网页链接：</b>https://smart.aimaventop.com`;

    return message;
  }

  getSignalChange(symbol, currentSignal) {
    const lastSignal = this.lastSignals?.get(symbol);
    if (!lastSignal || lastSignal === currentSignal) {
      return null;
    }
    this.lastSignals.set(symbol, currentSignal);
    return `信号变化: ${lastSignal} → ${currentSignal}`;
  }

  getExecutionChange(symbol, currentExecution) {
    const lastExecution = this.lastExecutions.get(symbol);
    if (!lastExecution || lastExecution === currentExecution) {
      return null;
    }
    this.lastExecutions.set(symbol, currentExecution);
    return `入场执行变化: ${lastExecution} → ${currentExecution}`;
  }

  extractKeyReasons(analysis) {
    const reasons = [];

    if (analysis.dailyTrend) {
      const trend = analysis.dailyTrend.trend;
      if (trend === 'UPTREND') {
        reasons.push('日线趋势：多头排列');
      } else if (trend === 'DOWNTREND') {
        reasons.push('日线趋势：空头排列');
      }
    }

    if (analysis.hourlyConfirmation) {
      const conf = analysis.hourlyConfirmation;
      if (conf.confirmed) {
        reasons.push('小时确认：突破+放量');
      }
      if (conf.oiChange >= 2) {
        reasons.push(`持仓量变化：+${conf.oiChange.toFixed(1)}%`);
      }
    }

    if (analysis.execution15m) {
      const exec = analysis.execution15m;
      if (exec.pullbackToEma20 || exec.pullbackToEma50) {
        reasons.push('15分钟：回踩EMA支撑');
      }
      if (exec.breakSetupHigh || exec.breakSetupLow) {
        reasons.push('15分钟：突破setup candle');
      }
    }

    return reasons;
  }

  async checkAndNotify(symbol, analysis) {
    if (!this.enabled) return;

    try {
      const signalChange = this.getSignalChange(symbol, analysis.signal);
      const executionChange = this.getExecutionChange(symbol, analysis.execution);

      if (signalChange || executionChange) {
        const keyReasons = this.extractKeyReasons(analysis);
        const message = this.formatSignalMessage(symbol, analysis, analysis, keyReasons);

        if (signalChange) {
          message += `\n\n📈 <b>信号变化：</b>${signalChange}\n`;
        }
        if (executionChange) {
          message += `⚡ <b>入场执行变化：</b>${executionChange}\n\n`;
        }

        await this.sendMessage(message);
      }
    } catch (error) {
      console.error(`Telegram 通知检查失败 ${symbol}:`, error);
    }
  }

  /**
   * 格式化模拟交易开始消息
   */
  formatSimulationStartMessage(simulationData) {
    const { symbol, entryPrice, stopLossPrice, takeProfitPrice, maxLeverage, minMargin, direction, triggerReason, stopLossDistance, atrValue } = simulationData;
    
    const directionText = direction === 'LONG' ? '🟢 做多' : '🔴 做空';
    const mode = triggerReason.includes('多头回踩突破') ? '多头回踩突破' : 
                 triggerReason.includes('空头反抽破位') ? '空头反抽破位' : '未知模式';
    
    const riskReward = stopLossDistance ? (100 / stopLossDistance).toFixed(1) : 'N/A';
    
    let message = `🚀 <b>模拟交易开始</b>\n\n`;
    message += `📊 <b>交易对：</b>${symbol}\n`;
    message += `📈 <b>方向：</b>${directionText}\n`;
    message += `🎯 <b>模式：</b>${mode}\n\n`;
    message += `💰 <b>入场价格：</b>${entryPrice.toFixed(4)}\n`;
    message += `🛑 <b>止损价格：</b>${stopLossPrice.toFixed(4)}\n`;
    message += `🎯 <b>止盈价格：</b>${takeProfitPrice.toFixed(4)}\n\n`;
    message += `⚙️ <b>杠杆倍数：</b>${maxLeverage}x\n`;
    message += `💵 <b>最小保证金：</b>${minMargin.toFixed(2)} USDT\n`;
    message += `📏 <b>止损距离：</b>${stopLossDistance ? (stopLossDistance * 100).toFixed(2) + '%' : 'N/A'}\n`;
    message += `📊 <b>ATR值：</b>${atrValue ? atrValue.toFixed(4) : 'N/A'}\n`;
    message += `📈 <b>风险回报比：</b>1:${riskReward}\n\n`;
    message += `⏰ <b>开始时间：</b>${new Date().toLocaleString('zh-CN')}\n`;
    message += `🆔 <b>交易ID：</b>${simulationData.id || 'N/A'}`;
    
    return message;
  }

  /**
   * 格式化模拟交易结束消息
   */
  formatSimulationEndMessage(simulationData) {
    const { symbol, entryPrice, exitPrice, stopLossPrice, takeProfitPrice, direction, exitReason, profitLoss, isWin, duration } = simulationData;
    
    const directionText = direction === 'LONG' ? '🟢 做多' : '🔴 做空';
    const resultText = isWin ? '✅ 盈利' : '❌ 亏损';
    const resultEmoji = isWin ? '🎉' : '😞';
    
    // 计算收益率
    const returnRate = stopLossPrice ? 
      (direction === 'LONG' ? 
        ((exitPrice - entryPrice) / entryPrice) * 100 : 
        ((entryPrice - exitPrice) / entryPrice) * 100) : 0;
    
    let message = `${resultEmoji} <b>模拟交易结束</b>\n\n`;
    message += `📊 <b>交易对：</b>${symbol}\n`;
    message += `📈 <b>方向：</b>${directionText}\n`;
    message += `🏁 <b>结果：</b>${resultText}\n\n`;
    message += `💰 <b>入场价格：</b>${entryPrice.toFixed(4)}\n`;
    message += `💸 <b>出场价格：</b>${exitPrice.toFixed(4)}\n`;
    message += `📊 <b>盈亏金额：</b>${profitLoss.toFixed(2)} USDT\n`;
    message += `📈 <b>收益率：</b>${returnRate.toFixed(2)}%\n\n`;
    message += `🛑 <b>止损价格：</b>${stopLossPrice.toFixed(4)}\n`;
    message += `🎯 <b>止盈价格：</b>${takeProfitPrice.toFixed(4)}\n`;
    message += `📝 <b>出场原因：</b>${this.getExitReasonText(exitReason)}\n`;
    message += `⏱️ <b>持仓时长：</b>${duration || 'N/A'}\n\n`;
    message += `⏰ <b>结束时间：</b>${new Date().toLocaleString('zh-CN')}`;
    
    return message;
  }

  /**
   * 获取出场原因的中文描述
   */
  getExitReasonText(exitReason) {
    const reasonMap = {
      'STOP_LOSS': '止损出场',
      'TAKE_PROFIT': '止盈出场',
      'TREND_REVERSAL': '趋势反转',
      'DELTA_WEAKENING': 'Delta减弱',
      'SUPPORT_RESISTANCE_BREAK': '支撑阻力突破',
      'TIME_STOP': '时间止损',
      'MANUAL_CLOSE': '手动关闭'
    };
    return reasonMap[exitReason] || exitReason;
  }

  /**
   * 发送模拟交易开始通知
   */
  async notifySimulationStart(simulationData) {
    if (!this.enabled) return;
    
    try {
      const message = this.formatSimulationStartMessage(simulationData);
      await this.sendMessage(message);
      console.log(`📱 模拟交易开始通知已发送: ${simulationData.symbol}`);
    } catch (error) {
      console.error(`❌ 模拟交易开始通知发送失败: ${simulationData.symbol}`, error);
    }
  }

  /**
   * 发送模拟交易结束通知
   */
  async notifySimulationEnd(simulationData) {
    if (!this.enabled) return;
    
    try {
      const message = this.formatSimulationEndMessage(simulationData);
      await this.sendMessage(message);
      console.log(`📱 模拟交易结束通知已发送: ${simulationData.symbol}`);
    } catch (error) {
      console.error(`❌ 模拟交易结束通知发送失败: ${simulationData.symbol}`, error);
    }
  }
}

module.exports = TelegramNotifier;
