/**
 * Telegram通知模块
 * 负责发送模拟交易开启和结束的通知消息
 */

const https = require('https');

class TelegramNotifier {
    constructor() {
        // 15min信号通知机器人配置
        this.botToken = null;
        this.chatId = null;
        this.enabled = false;
        this.initialized = false;

        // 模拟交易执行通知机器人配置
        this.simulationBotToken = null;
        this.simulationChatId = null;
        this.simulationEnabled = false;
        this.simulationInitialized = false;
    }

    /**
     * 初始化15min信号通知Telegram配置
     * @param {string} botToken - Telegram Bot Token
     * @param {string} chatId - Telegram Chat ID
     */
    init(botToken, chatId) {
        if (!botToken || !chatId) {
            console.warn('⚠️ 15min信号Telegram通知未配置: botToken或chatId为空');
            this.enabled = false;
            return;
        }

        this.botToken = botToken;
        this.chatId = chatId;
        this.enabled = true;
        this.initialized = true;

        console.log('✅ 15min信号Telegram通知已启用');
    }

    /**
     * 初始化模拟交易通知Telegram配置
     * @param {string} botToken - Telegram Bot Token
     * @param {string} chatId - Telegram Chat ID
     */
    initSimulation(botToken, chatId) {
        if (!botToken || !chatId) {
            console.warn('⚠️ 模拟交易Telegram通知未配置: botToken或chatId为空');
            this.simulationEnabled = false;
            return;
        }

        this.simulationBotToken = botToken;
        this.simulationChatId = chatId;
        this.simulationEnabled = true;
        this.simulationInitialized = true;

        console.log('✅ 模拟交易Telegram通知已启用');
    }

    /**
     * 发送Telegram消息
     * @param {string} message - 要发送的消息
     * @param {string} type - 消息类型：'signal'（15min信号）或'simulation'（模拟交易）
     * @returns {Promise<boolean>} - 发送是否成功
     */
    async sendMessage(message, type = 'signal') {
        let botToken, chatId, enabled, initialized;

        if (type === 'simulation') {
            botToken = this.simulationBotToken;
            chatId = this.simulationChatId;
            enabled = this.simulationEnabled;
            initialized = this.simulationInitialized;
        } else {
            botToken = this.botToken;
            chatId = this.chatId;
            enabled = this.enabled;
            initialized = this.initialized;
        }

        if (!enabled || !initialized) {
            console.warn(`⚠️ ${type === 'simulation' ? '模拟交易' : '15min信号'}Telegram通知未启用，跳过发送消息`);
            return false;
        }

        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const data = JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML'
        });

        return new Promise((resolve) => {
            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                },
                timeout: 10000
            };

            const req = https.request(url, options, (res) => {
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode === 200) {
                        console.log('✅ Telegram通知发送成功');
                        resolve(true);
                    } else {
                        console.error('❌ Telegram通知发送失败:', res.statusCode, responseData);
                        resolve(false);
                    }
                });
            });

            req.on('error', (error) => {
                console.error('❌ Telegram通知发送错误:', error.message);
                resolve(false);
            });

            req.on('timeout', () => {
                console.error('❌ Telegram通知发送超时');
                req.destroy();
                resolve(false);
            });

            req.write(data);
            req.end();
        });
    }

    /**
     * 发送模拟交易开启通知
     * @param {Object} simulationData - 模拟交易数据
     * @returns {Promise<boolean>} - 发送是否成功
     */
    async sendSimulationStartNotification(simulationData) {
        const {
            symbol,
            direction,
            entryPrice,
            stopLoss,
            takeProfit,
            maxLeverage,
            minMargin,
            triggerReason,
            executionMode,
            marketType
        } = simulationData;

        const directionText = direction === 'LONG' ? '做多' : '做空';
        const directionEmoji = direction === 'LONG' ? '📈' : '📉';

        const message = `
🚀 <b>模拟交易开启</b> ${directionEmoji}

📊 <b>交易对:</b> ${symbol}
🎯 <b>方向:</b> ${directionText}
💰 <b>入场价格:</b> ${entryPrice.toFixed(4)} USDT
🛑 <b>止损价格:</b> ${stopLoss.toFixed(4)} USDT
🎯 <b>止盈价格:</b> ${takeProfit.toFixed(4)} USDT
⚡ <b>杠杆倍数:</b> ${maxLeverage}x
💎 <b>最小保证金:</b> ${minMargin.toFixed(2)} USDT
📝 <b>触发原因:</b> ${triggerReason}
🏷️ <b>执行模式:</b> ${executionMode}
📈 <b>市场类型:</b> ${marketType}

⏰ <b>开启时间:</b> ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
        `.trim();

        return await this.sendMessage(message, 'simulation');
    }

    /**
     * 发送模拟交易结束通知
     * @param {Object} simulationData - 模拟交易数据
     * @returns {Promise<boolean>} - 发送是否成功
     */
    async sendSimulationEndNotification(simulationData) {
        const {
            symbol,
            direction,
            exitPrice,
            exitReason,
            profitLoss,
            isWin,
            entryPrice,
            stopLoss,
            takeProfit,
            maxLeverage,
            minMargin,
            timeInPosition,
            maxTimeInPosition,
            triggerReason
        } = simulationData;

        const directionText = direction === 'LONG' ? '做多' : '做空';
        const directionEmoji = direction === 'LONG' ? '📈' : '📉';
        const resultEmoji = isWin ? '✅' : '❌';
        const resultText = isWin ? '盈利' : '亏损';
        const profitEmoji = profitLoss >= 0 ? '💰' : '💸';

        // 计算收益率
        const entryMargin = minMargin;
        const returnRate = ((profitLoss / entryMargin) * 100).toFixed(2);

        const message = `
${resultEmoji} <b>模拟交易结束</b> ${directionEmoji}

📊 <b>交易对:</b> ${symbol}
🎯 <b>方向:</b> ${directionText}
💰 <b>出场价格:</b> ${exitPrice.toFixed(4)} USDT
📝 <b>出场原因:</b> ${exitReason}
${profitEmoji} <b>盈亏金额:</b> ${profitLoss >= 0 ? '+' : ''}${profitLoss.toFixed(4)} USDT
📊 <b>收益率:</b> ${returnRate}%
${resultEmoji} <b>结果:</b> ${resultText}

📈 <b>交易详情:</b>
• 入场价格: ${entryPrice.toFixed(4)} USDT
• 止损价格: ${stopLoss.toFixed(4)} USDT
• 止盈价格: ${takeProfit.toFixed(4)} USDT
• 杠杆倍数: ${maxLeverage}x
• 保证金: ${minMargin.toFixed(2)} USDT
• 持仓时间: ${timeInPosition}/${maxTimeInPosition} 小时
• 触发原因: ${triggerReason}

⏰ <b>结束时间:</b> ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
        `.trim();

        return await this.sendMessage(message, 'simulation');
    }

    /**
     * 发送15min信号通知
     * @param {Object} data - 信号数据
     * @returns {Promise<boolean>} - 发送是否成功
     */
    async send15minSignalNotification(data) {
        const {
            symbol,
            executionMode,
            signal,
            entryPrice,
            stopLoss,
            takeProfit,
            currentPrice,
            trend4h,
            score1h,
            reason,
            timestamp
        } = data;

        // 格式化价格显示
        const formatPrice = (price) => price ? price.toFixed(4) : '--';

        // 确定信号方向
        const direction = signal === 'BUY' ? '📈 多头' : signal === 'SELL' ? '📉 空头' : '⏸️ 观望';

        // 确定市场类型
        const marketType = trend4h === '多头趋势' || trend4h === '空头趋势' ? '趋势市' : '震荡市';

        const message = `
🎯 <b>15分钟信号检测</b>

📊 <b>交易对:</b> ${symbol}
🔄 <b>执行模式:</b> ${executionMode}
${direction}
📈 <b>4H趋势:</b> ${trend4h}
📊 <b>1H得分:</b> ${score1h}/6
🏷️ <b>市场类型:</b> ${marketType}

💰 <b>价格信息:</b>
• 当前价格: ${formatPrice(currentPrice)}
• 入场价格: ${formatPrice(entryPrice)}
• 止损价格: ${formatPrice(stopLoss)}
• 止盈价格: ${formatPrice(takeProfit)}

📝 <b>触发原因:</b> ${reason}

⏰ <b>检测时间:</b> ${new Date(timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}

🤖 SmartFlow V3策略系统
        `.trim();

        return await this.sendMessage(message, 'signal');
    }

    /**
     * 发送测试通知
     * @returns {Promise<boolean>} - 发送是否成功
     */
    async sendTestNotification() {
        const message = `
🧪 <b>Telegram通知测试</b>

✅ 通知功能正常工作
⏰ 测试时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}

📱 SmartFlow V3策略系统
        `.trim();

        return await this.sendMessage(message, 'signal');
    }

    /**
     * 发送数据新鲜度告警通知
     * @param {Object} alertData - 告警数据
     * @returns {Promise<boolean>} - 发送是否成功
     */
    async sendDataFreshnessAlert(alertData) {
        const {
            dataType,
            symbol,
            freshness,
            threshold,
            lastUpdate,
            interval,
            severity
        } = alertData;

        const dataTypeNames = {
            'trend_analysis': '4H趋势判断',
            'trend_scoring': '1H多因子打分',
            'trend_strength': '1H加强趋势判断',
            'trend_entry': '趋势市15分钟入场判断',
            'range_boundary': '震荡市1H边界判断',
            'range_entry': '震荡市15分钟入场判断',
            'trend_score': '4H趋势打分'
        };

        const severityEmoji = {
            'critical': '🔴',
            'warning': '🟡',
            'info': '🔵'
        };

        const severityText = {
            'critical': '严重',
            'warning': '警告',
            'info': '提示'
        };

        const freshnessStatus = freshness >= 50 ? '✅ 正常' : freshness >= 30 ? '⚠️ 需关注' : '❌ 过期';

        const message = `
${severityEmoji[severity] || '🔴'} <b>数据新鲜度告警</b> - ${severityText[severity] || '严重'}

📊 <b>数据类型:</b> ${dataTypeNames[dataType] || dataType}
📈 <b>交易对:</b> ${symbol}
📊 <b>当前新鲜度:</b> ${freshness.toFixed(1)}%
⚠️ <b>告警阈值:</b> ${threshold}%
📅 <b>最后更新:</b> ${new Date(lastUpdate).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
⏰ <b>刷新间隔:</b> ${interval}分钟
📊 <b>状态:</b> ${freshnessStatus}

⏰ <b>告警时间:</b> ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}

🤖 SmartFlow 数据监控系统
        `.trim();

        return await this.sendMessage(message, 'signal');
    }

    /**
     * 发送批量数据新鲜度告警通知
     * @param {Array} alertList - 告警列表
     * @returns {Promise<boolean>} - 发送是否成功
     */
    async sendBatchDataFreshnessAlert(alertList) {
        if (!alertList || alertList.length === 0) return true;

        const criticalAlerts = alertList.filter(alert => alert.severity === 'critical');
        const warningAlerts = alertList.filter(alert => alert.severity === 'warning');
        const infoAlerts = alertList.filter(alert => alert.severity === 'info');

        let message = `🔴 <b>数据新鲜度批量告警</b>\n\n`;

        if (criticalAlerts.length > 0) {
            message += `🔴 <b>严重告警 (${criticalAlerts.length}个):</b>\n`;
            criticalAlerts.forEach(alert => {
                const dataTypeNames = {
                    'trend_analysis': '4H趋势判断',
                    'trend_scoring': '1H多因子打分',
                    'trend_strength': '1H加强趋势判断',
                    'trend_entry': '趋势市15分钟入场判断',
                    'range_boundary': '震荡市1H边界判断',
                    'range_entry': '震荡市15分钟入场判断',
                    'trend_score': '4H趋势打分'
                };
                message += `• ${dataTypeNames[alert.dataType] || alert.dataType} - ${alert.symbol}: ${alert.freshness.toFixed(1)}%\n`;
            });
            message += '\n';
        }

        if (warningAlerts.length > 0) {
            message += `🟡 <b>警告告警 (${warningAlerts.length}个):</b>\n`;
            warningAlerts.forEach(alert => {
                const dataTypeNames = {
                    'trend_analysis': '4H趋势判断',
                    'trend_scoring': '1H多因子打分',
                    'trend_strength': '1H加强趋势判断',
                    'trend_entry': '趋势市15分钟入场判断',
                    'range_boundary': '震荡市1H边界判断',
                    'range_entry': '震荡市15分钟入场判断',
                    'trend_score': '4H趋势打分'
                };
                message += `• ${dataTypeNames[alert.dataType] || alert.dataType} - ${alert.symbol}: ${alert.freshness.toFixed(1)}%\n`;
            });
            message += '\n';
        }

        if (infoAlerts.length > 0) {
            message += `🔵 <b>提示告警 (${infoAlerts.length}个):</b>\n`;
            infoAlerts.forEach(alert => {
                const dataTypeNames = {
                    'trend_analysis': '4H趋势判断',
                    'trend_scoring': '1H多因子打分',
                    'trend_strength': '1H加强趋势判断',
                    'trend_entry': '趋势市15分钟入场判断',
                    'range_boundary': '震荡市1H边界判断',
                    'range_entry': '震荡市15分钟入场判断',
                    'trend_score': '4H趋势打分'
                };
                message += `• ${dataTypeNames[alert.dataType] || alert.dataType} - ${alert.symbol}: ${alert.freshness.toFixed(1)}%\n`;
            });
            message += '\n';
        }

        message += `⏰ <b>告警时间:</b> ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n`;
        message += `🤖 SmartFlow 数据监控系统`;

        return await this.sendMessage(message, 'signal');
    }

    /**
     * 检查Telegram配置状态
     * @returns {Object} - 配置状态
     */
    getStatus() {
        return {
            signal: {
                enabled: this.enabled,
                initialized: this.initialized,
                hasBotToken: !!this.botToken,
                hasChatId: !!this.chatId,
                configured: this.enabled && this.initialized
            },
            simulation: {
                enabled: this.simulationEnabled,
                initialized: this.simulationInitialized,
                hasBotToken: !!this.simulationBotToken,
                hasChatId: !!this.simulationChatId,
                configured: this.simulationEnabled && this.simulationInitialized
            }
        };
    }
}

module.exports = TelegramNotifier;
