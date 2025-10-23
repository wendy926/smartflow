/**
 * Telegram监控服务单元测试
 */

const TelegramMonitoringService = require('../../src/services/telegram-monitoring');
const axios = require('axios');

// 模拟axios
jest.mock('axios');
jest.mock('../../src/utils/logger');

describe('TelegramMonitoringService', () => {
  let telegramService;

  beforeEach(() => {
    jest.clearAllMocks();

    // 重置环境变量
    process.env.TELEGRAM_TRADING_BOT_TOKEN = 'trading_bot_token';
    process.env.TELEGRAM_TRADING_CHAT_ID = 'trading_chat_id';
    process.env.TELEGRAM_MONITORING_BOT_TOKEN = 'monitoring_bot_token';
    process.env.TELEGRAM_MONITORING_CHAT_ID = 'monitoring_chat_id';

    telegramService = new TelegramMonitoringService();
  });

  describe('构造函数', () => {
    it('应该正确初始化配置', () => {
      expect(telegramService.tradingBotToken).toBe('trading_bot_token');
      expect(telegramService.tradingChatId).toBe('trading_chat_id');
      expect(telegramService.monitoringBotToken).toBe('monitoring_bot_token');
      expect(telegramService.monitoringChatId).toBe('monitoring_chat_id');
      expect(telegramService.tradingEnabled).toBe(true);
      expect(telegramService.monitoringEnabled).toBe(true);
    });

    it('应该在没有配置时禁用服务', () => {
      delete process.env.TELEGRAM_TRADING_BOT_TOKEN;
      delete process.env.TELEGRAM_MONITORING_BOT_TOKEN;

      const service = new TelegramMonitoringService();

      expect(service.tradingEnabled).toBe(false);
      expect(service.monitoringEnabled).toBe(false);
    });
  });

  describe('sendTradingAlert', () => {
    it('应该成功发送交易触发通知', async () => {
      axios.post.mockResolvedValue({
        data: { ok: true }
      });

      const tradeData = {
        symbol: 'BTCUSDT',
        strategy_type: 'V3',
        direction: 'LONG',
        entry_price: 50000,
        stop_loss: 49000,
        take_profit: 52000,
        leverage: 10,
        margin_required: 500,
        entry_reason: '测试交易',
        status: 'ACTIVE'
      };

      const result = await telegramService.sendTradingAlert(tradeData);

      expect(result).toBe(true);
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.telegram.org/bot' + telegramService.tradingBotToken + '/sendMessage',
        expect.objectContaining({
          chat_id: telegramService.tradingChatId,
          text: expect.stringContaining('新交易开启'),
          parse_mode: 'HTML'
        }),
        expect.objectContaining({
          timeout: 10000
        })
      );
    });

    it('应该在未配置时跳过发送', async () => {
      telegramService.tradingEnabled = false;

      const tradeData = {
        symbol: 'BTCUSDT',
        strategy_type: 'V3',
        direction: 'LONG',
        entry_price: 50000,
        stop_loss: 49000,
        take_profit: 52000,
        leverage: 10,
        margin_required: 500,
        entry_reason: '测试交易',
        status: 'ACTIVE'
      };

      const result = await telegramService.sendTradingAlert(tradeData);

      expect(result).toBe(false);
      expect(axios.post).not.toHaveBeenCalled();
    });

    it('应该处理发送失败的情况', async () => {
      axios.post.mockResolvedValue({
        data: { ok: false, error_code: 400, description: 'Bad Request' }
      });

      const tradeData = {
        symbol: 'BTCUSDT',
        strategy_type: 'V3',
        direction: 'LONG',
        entry_price: 50000,
        stop_loss: 49000,
        take_profit: 52000,
        leverage: 10,
        margin_required: 500,
        entry_reason: '测试交易',
        status: 'ACTIVE'
      };

      const result = await telegramService.sendTradingAlert(tradeData);

      expect(result).toBe(false);
    });
  });

  describe('sendMonitoringAlert', () => {
    it('应该成功发送系统监控告警', async () => {
      axios.post.mockResolvedValue({
        data: { ok: true }
      });

      const result = await telegramService.sendMonitoringAlert(
        'CPU_HIGH',
        'CPU使用率过高',
        { cpu: 85, memory: 60 }
      );

      expect(result).toBe(true);
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.telegram.org/bot' + telegramService.monitoringBotToken + '/sendMessage',
        expect.objectContaining({
          chat_id: telegramService.monitoringChatId,
          text: expect.stringContaining('CPU使用率告警'),
          parse_mode: 'HTML'
        }),
        expect.objectContaining({
          timeout: 10000
        })
      );
    });

    it('应该遵守冷却期限制', async () => {
      axios.post.mockResolvedValue({
        data: { ok: true }
      });

      // 第一次发送
      await telegramService.sendMonitoringAlert('CPU_HIGH', '测试消息', {});

      // 立即再次发送（应该在冷却期内）
      const result = await telegramService.sendMonitoringAlert('CPU_HIGH', '测试消息', {});

      expect(result).toBe(false);
      expect(axios.post).toHaveBeenCalledTimes(1);
    });

    it('应该处理不同类型的告警', async () => {
      axios.post.mockResolvedValue({
        data: { ok: true }
      });

      const alertTypes = [
        { type: 'CPU_HIGH', expected: 'CPU使用率告警' },
        { type: 'MEMORY_HIGH', expected: '内存使用率告警' },
        { type: 'DISK_HIGH', expected: '磁盘使用率告警' },
        { type: 'API_ERROR', expected: 'API错误告警' },
        { type: 'STRATEGY_ERROR', expected: '策略执行告警' },
        { type: 'DATABASE_ERROR', expected: '数据库告警' },
        { type: 'SYSTEM_HEALTH', expected: '系统健康检查' }
      ];

      for (const alert of alertTypes) {
        await telegramService.sendMonitoringAlert(alert.type, '测试消息', {});

        expect(axios.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            text: expect.stringContaining(alert.expected)
          }),
          expect.any(Object)
        );
      }
    });
  });

  describe('testConnection', () => {
    it('应该成功测试交易触发连接', async () => {
      axios.post.mockResolvedValue({
        data: {
          ok: true,
          result: {
            id: 123456789,
            is_bot: true,
            first_name: 'Trading Bot',
            username: 'trading_bot'
          }
        }
      });

      const result = await telegramService.testConnection('trading');

      expect(result.success).toBe(true);
      expect(result.bot).toBeDefined();
      expect(result.type).toBe('trading');
    });

    it('应该成功测试系统监控连接', async () => {
      axios.post.mockResolvedValue({
        data: {
          ok: true,
          result: {
            id: 987654321,
            is_bot: true,
            first_name: 'Monitoring Bot',
            username: 'monitoring_bot'
          }
        }
      });

      const result = await telegramService.testConnection('monitoring');

      expect(result.success).toBe(true);
      expect(result.bot).toBeDefined();
      expect(result.type).toBe('monitoring');
    });

    it('应该处理无效的Bot Token', async () => {
      axios.post.mockResolvedValue({
        data: {
          ok: false,
          error_code: 401,
          description: 'Unauthorized'
        }
      });

      const result = await telegramService.testConnection('trading');

      expect(result.success).toBe(false);
      expect(result.error).toBe('trading Bot Token无效');
    });

    it('应该处理网络错误', async () => {
      axios.post.mockRejectedValue(new Error('Network Error'));

      const result = await telegramService.testConnection('trading');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network Error');
    });
  });

  describe('getStatus', () => {
    it('应该返回正确的状态信息', () => {
      const status = telegramService.getStatus();

      expect(status).toHaveProperty('trading');
      expect(status).toHaveProperty('monitoring');
      expect(status.trading.enabled).toBe(true);
      expect(status.monitoring.enabled).toBe(true);
      expect(status.trading.botToken).toBe('已配置');
      expect(status.trading.chatId).toBe('已配置');
      expect(status.monitoring.botToken).toBe('已配置');
      expect(status.monitoring.chatId).toBe('已配置');
    });
  });

  describe('updateConfig', () => {
    it('应该更新交易触发配置', () => {
      const config = {
        trading: {
          botToken: 'new_trading_token',
          chatId: 'new_trading_chat'
        }
      };

      telegramService.updateConfig(config);

      expect(telegramService.tradingBotToken).toBe('new_trading_token');
      expect(telegramService.tradingChatId).toBe('new_trading_chat');
      expect(telegramService.tradingEnabled).toBe(true);
    });

    it('应该更新系统监控配置', () => {
      const config = {
        monitoring: {
          botToken: 'new_monitoring_token',
          chatId: 'new_monitoring_chat'
        }
      };

      telegramService.updateConfig(config);

      expect(telegramService.monitoringBotToken).toBe('new_monitoring_token');
      expect(telegramService.monitoringChatId).toBe('new_monitoring_chat');
      expect(telegramService.monitoringEnabled).toBe(true);
    });

    it('应该同时更新两个配置', () => {
      const config = {
        trading: {
          botToken: 'new_trading_token',
          chatId: 'new_trading_chat'
        },
        monitoring: {
          botToken: 'new_monitoring_token',
          chatId: 'new_monitoring_chat'
        }
      };

      telegramService.updateConfig(config);

      expect(telegramService.tradingBotToken).toBe('new_trading_token');
      expect(telegramService.monitoringBotToken).toBe('new_monitoring_token');
    });
  });

  describe('formatTradingMessage', () => {
    it('应该正确格式化交易消息', () => {
      const tradeData = {
        symbol: 'BTCUSDT',
        strategy_type: 'V3',
        direction: 'LONG',
        entry_price: 50000,
        stop_loss: 49000,
        take_profit: 52000,
        leverage: 10,
        margin_required: 500,
        entry_reason: '测试交易',
        status: 'ACTIVE'
      };

      const message = telegramService.formatTradingMessage(tradeData);

      expect(message).toContain('新交易开启');
      expect(message).toContain('BTCUSDT');
      expect(message).toContain('V3');
      expect(message).toContain('LONG');
      expect(message).toContain('50000');
      expect(message).toContain('49000');
      expect(message).toContain('52000');
      expect(message).toContain('10x');
      expect(message).toContain('500');
      expect(message).toContain('测试交易');
    });

    it('应该正确格式化已关闭交易消息', () => {
      const tradeData = {
        symbol: 'BTCUSDT',
        strategy_type: 'V3',
        direction: 'LONG',
        entry_price: 50000,
        stop_loss: 49000,
        take_profit: 52000,
        leverage: 10,
        margin_required: 500,
        entry_reason: '测试交易',
        status: 'CLOSED'
      };

      const message = telegramService.formatTradingMessage(tradeData);

      expect(message).toContain('交易关闭');
    });
  });

  describe('formatMonitoringMessage', () => {
    it('应该正确格式化监控消息', () => {
      const message = telegramService.formatMonitoringMessage(
        'CPU_HIGH',
        'CPU使用率过高',
        { cpu: 85, memory: 60, disk: 70 }
      );

      expect(message).toContain('CPU使用率告警');
      expect(message).toContain('CPU使用率过高');
      expect(message).toContain('85');
      expect(message).toContain('60');
      expect(message).toContain('70');
    });

    it('应该处理不同类型的告警消息', () => {
      const alertTypes = [
        { type: 'CPU_HIGH', expected: 'CPU使用率告警' },
        { type: 'MEMORY_HIGH', expected: '内存使用率告警' },
        { type: 'DISK_HIGH', expected: '磁盘使用率告警' },
        { type: 'API_ERROR', expected: 'API错误告警' },
        { type: 'STRATEGY_ERROR', expected: '策略执行告警' },
        { type: 'DATABASE_ERROR', expected: '数据库告警' },
        { type: 'SYSTEM_HEALTH', expected: '系统健康检查' }
      ];

      alertTypes.forEach(alert => {
        const message = telegramService.formatMonitoringMessage(
          alert.type,
          '测试消息',
          {}
        );

        expect(message).toContain(alert.expected);
      });
    });
  });
});
