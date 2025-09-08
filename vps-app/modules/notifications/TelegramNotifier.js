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
}

module.exports = TelegramNotifier;
