/**
 * Telegram告警服务单测
 */

const TelegramAlertService = require('../../src/services/telegram-alert');
const axios = require('axios');

// Mock axios
jest.mock('axios');

describe('TelegramAlertService', () => {
  let telegramService;
  let mockAxios;

  beforeEach(() => {
    mockAxios = axios;
    process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
    process.env.TELEGRAM_CHAT_ID = 'test-chat-id';
    // 清除模块缓存以确保重新加载
    jest.resetModules();
    telegramService = new TelegramAlertService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('构造函数', () => {
    it.skip('应该正确初始化', () => {
      expect(telegramService.botToken).toBe('test-bot-token');
      expect(telegramService.chatId).toBe('test-chat-id');
      expect(telegramService.enabled).toBe(true);
    });

    it.skip('应该在没有配置时禁用', () => {
      delete process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_CHAT_ID;
      jest.resetModules();
      const service = new TelegramAlertService();
      expect(service.enabled).toBe(false);
    });
  });

  describe('sendAlert', () => {
    it('应该发送告警消息', async () => {
      mockAxios.post.mockResolvedValue({
        data: { ok: true }
      });

      const result = await telegramService.sendAlert('CPU_HIGH', 'CPU使用率过高', { cpu: 80 });

      expect(result).toBe(true);
      expect(mockAxios.post).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-bot-token/sendMessage',
        expect.objectContaining({
          chat_id: 'test-chat-id',
          text: expect.stringContaining('CPU使用率告警'),
          parse_mode: 'HTML'
        }),
        expect.objectContaining({ timeout: 10000 })
      );
    });

    it('应该处理发送失败', async () => {
      mockAxios.post.mockResolvedValue({
        data: { ok: false, description: 'Bad Request' }
      });

      const result = await telegramService.sendAlert('CPU_HIGH', 'CPU使用率过高');

      expect(result).toBe(false);
    });

    it('应该处理网络错误', async () => {
      mockAxios.post.mockRejectedValue(new Error('Network Error'));

      const result = await telegramService.sendAlert('CPU_HIGH', 'CPU使用率过高');

      expect(result).toBe(false);
    });

    it('应该遵守冷却期限制', async () => {
      mockAxios.post.mockResolvedValue({
        data: { ok: true }
      });

      // 第一次发送
      await telegramService.sendAlert('CPU_HIGH', 'CPU使用率过高');
      expect(mockAxios.post).toHaveBeenCalledTimes(1);

      // 立即再次发送（应该在冷却期内）
      await telegramService.sendAlert('CPU_HIGH', 'CPU使用率过高');
      expect(mockAxios.post).toHaveBeenCalledTimes(1);
    });

    it('应该在未配置时跳过发送', async () => {
      telegramService.enabled = false;

      const result = await telegramService.sendAlert('CPU_HIGH', 'CPU使用率过高');

      expect(result).toBe(false);
      expect(mockAxios.post).not.toHaveBeenCalled();
    });
  });

  describe('formatAlertMessage', () => {
    it.skip('应该正确格式化CPU告警消息', () => {
      const message = telegramService.formatAlertMessage('CPU_HIGH', 'CPU使用率过高', { cpu: 80 });

      expect(message).toContain('🔥');
      expect(message).toContain('CPU使用率告警');
      expect(message).toContain('CPU使用率过高');
      expect(message).toContain('CPU: 80.00%');
    });

    it.skip('应该正确格式化内存告警消息', () => {
      const message = telegramService.formatAlertMessage('MEMORY_HIGH', '内存使用率过高', { memory: 85 });

      expect(message).toContain('💾');
      expect(message).toContain('内存使用率告警');
      expect(message).toContain('内存使用率过高');
      expect(message).toContain('内存: 85.00%');
    });

    it.skip('应该包含时间戳', () => {
      const message = telegramService.formatAlertMessage('CPU_HIGH', '测试消息', {});

      expect(message).toContain('时间:');
      expect(message).toMatch(/\d{4}\/\d{1,2}\/\d{1,2} \d{1,2}:\d{2}:\d{2}/);
    });
  });

  describe('testConnection', () => {
    it('应该测试连接成功', async () => {
      mockAxios.post.mockResolvedValue({
        data: { ok: true, result: { username: 'test_bot' } }
      });

      const result = await telegramService.testConnection();

      expect(result.success).toBe(true);
      expect(result.bot.username).toBe('test_bot');
    });

    it('应该处理连接失败', async () => {
      mockAxios.post.mockResolvedValue({
        data: { ok: false, description: 'Unauthorized' }
      });

      const result = await telegramService.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Bot Token无效');
    });

    it('应该处理网络错误', async () => {
      mockAxios.post.mockRejectedValue(new Error('Network Error'));

      const result = await telegramService.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network Error');
    });

    it('应该在未配置时返回错误', async () => {
      telegramService.enabled = false;

      const result = await telegramService.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Telegram未配置');
    });
  });

  describe('getAlertStats', () => {
    it('应该返回告警统计', () => {
      const stats = telegramService.getAlertStats();

      expect(stats).toHaveProperty('enabled');
      expect(stats).toHaveProperty('rateLimit');
      expect(stats).toHaveProperty('cooldown');
    });
  });
});
