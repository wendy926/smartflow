/**
 * Telegram通知模块
 * 负责发送模拟交易开启和结束的通知消息
 */

const https = require('https');

class TelegramNotifier {
    constructor() {
        this.botToken = null;
        this.chatId = null;
        this.enabled = false;
        this.initialized = false;
    }

    /**
     * 初始化Telegram配置
     * @param {string} botToken - Telegram Bot Token
     * @param {string} chatId - Telegram Chat ID
     */
    init(botToken, chatId) {
        if (!botToken || !chatId) {
            console.warn('⚠️ Telegram通知未配置: botToken或chatId为空');
            this.enabled = false;
            return;
        }

        this.botToken = botToken;
        this.chatId = chatId;
        this.enabled = true;
        this.initialized = true;
        
        console.log('✅ Telegram通知已启用');
    }

    /**
     * 发送Telegram消息
     * @param {string} message - 要发送的消息
     * @returns {Promise<boolean>} - 发送是否成功
     */
    async sendMessage(message) {
        if (!this.enabled || !this.initialized) {
            console.warn('⚠️ Telegram通知未启用，跳过发送消息');
            return false;
        }

        const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
        const data = JSON.stringify({
            chat_id: this.chatId,
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

        return await this.sendMessage(message);
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

        return await this.sendMessage(message);
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

        return await this.sendMessage(message);
    }

    /**
     * 检查Telegram配置状态
     * @returns {Object} - 配置状态
     */
    getStatus() {
        return {
            enabled: this.enabled,
            initialized: this.initialized,
            hasBotToken: !!this.botToken,
            hasChatId: !!this.chatId,
            configured: this.enabled && this.initialized
        };
    }
}

module.exports = TelegramNotifier;
