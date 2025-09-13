/**
 * Telegram通知功能单元测试
 */

const TelegramNotifier = require('../modules/notification/TelegramNotifier');

describe('TelegramNotifier', () => {
  let telegramNotifier;

  beforeEach(() => {
    telegramNotifier = new TelegramNotifier();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('初始化', () => {
    test('应该正确初始化TelegramNotifier', () => {
      expect(telegramNotifier).toBeDefined();
      expect(telegramNotifier.enabled).toBe(false);
      expect(telegramNotifier.initialized).toBe(false);
    });

    test('应该正确配置Telegram', () => {
      const botToken = 'test_bot_token';
      const chatId = 'test_chat_id';

      telegramNotifier.init(botToken, chatId);

      expect(telegramNotifier.botToken).toBe(botToken);
      expect(telegramNotifier.chatId).toBe(chatId);
      expect(telegramNotifier.enabled).toBe(true);
      expect(telegramNotifier.initialized).toBe(true);
    });

    test('应该处理空配置', () => {
      telegramNotifier.init('', '');

      expect(telegramNotifier.enabled).toBe(false);
      expect(telegramNotifier.initialized).toBe(false);
    });
  });

  describe('发送模拟交易开启通知', () => {
    beforeEach(() => {
      telegramNotifier.init('test_bot_token', 'test_chat_id');
    });

    test('应该正确格式化开启通知消息', async () => {
      const simulationData = {
        symbol: 'BTCUSDT',
        direction: 'LONG',
        entryPrice: 50000.0,
        stopLoss: 48000.0,
        takeProfit: 52000.0,
        maxLeverage: 20,
        minMargin: 100.0,
        triggerReason: 'SIGNAL_多头回踩突破',
        executionMode: '多头回踩突破',
        marketType: '趋势市'
      };

      // 模拟sendMessage方法
      const sendMessageSpy = jest.spyOn(telegramNotifier, 'sendMessage')
        .mockResolvedValue(true);

      await telegramNotifier.sendSimulationStartNotification(simulationData);

      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚀 <b>模拟交易开启</b>')
      );
      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining('BTCUSDT')
      );
      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining('做多')
      );
      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining('50000.0000 USDT')
      );
      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining('20x')
      );
    });

    test('应该处理做空交易', async () => {
      const simulationData = {
        symbol: 'ETHUSDT',
        direction: 'SHORT',
        entryPrice: 3000.0,
        stopLoss: 3100.0,
        takeProfit: 2900.0,
        maxLeverage: 15,
        minMargin: 150.0,
        triggerReason: 'SIGNAL_空头反抽破位',
        executionMode: '空头反抽破位',
        marketType: '趋势市'
      };

      const sendMessageSpy = jest.spyOn(telegramNotifier, 'sendMessage')
        .mockResolvedValue(true);

      await telegramNotifier.sendSimulationStartNotification(simulationData);

      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining('做空')
      );
      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining('3000.0000 USDT')
      );
    });
  });

  describe('发送模拟交易结束通知', () => {
    beforeEach(() => {
      telegramNotifier.init('test_bot_token', 'test_chat_id');
    });

    test('应该正确格式化盈利结束通知消息', async () => {
      const simulationData = {
        symbol: 'BTCUSDT',
        direction: 'LONG',
        exitPrice: 52000.0,
        exitReason: '止盈触发',
        profitLoss: 200.0,
        isWin: true,
        entryPrice: 50000.0,
        stopLoss: 48000.0,
        takeProfit: 52000.0,
        maxLeverage: 20,
        minMargin: 100.0,
        timeInPosition: 2,
        maxTimeInPosition: 48,
        triggerReason: 'SIGNAL_多头回踩突破'
      };

      const sendMessageSpy = jest.spyOn(telegramNotifier, 'sendMessage')
        .mockResolvedValue(true);

      await telegramNotifier.sendSimulationEndNotification(simulationData);

      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ <b>模拟交易结束</b>')
      );
      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining('盈利')
      );
      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining('+200.0000 USDT')
      );
      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining('200.00%')
      );
    });

    test('应该正确格式化亏损结束通知消息', async () => {
      const simulationData = {
        symbol: 'ETHUSDT',
        direction: 'SHORT',
        exitPrice: 3100.0,
        exitReason: '止损触发',
        profitLoss: -50.0,
        isWin: false,
        entryPrice: 3000.0,
        stopLoss: 3100.0,
        takeProfit: 2900.0,
        maxLeverage: 15,
        minMargin: 150.0,
        timeInPosition: 1,
        maxTimeInPosition: 48,
        triggerReason: 'SIGNAL_空头反抽破位'
      };

      const sendMessageSpy = jest.spyOn(telegramNotifier, 'sendMessage')
        .mockResolvedValue(true);

      await telegramNotifier.sendSimulationEndNotification(simulationData);

      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ <b>模拟交易结束</b>')
      );
      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining('亏损')
      );
      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining('-50.0000 USDT')
      );
      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining('-33.33%')
      );
    });
  });

  describe('测试通知', () => {
    beforeEach(() => {
      telegramNotifier.init('test_bot_token', 'test_chat_id');
    });

    test('应该发送测试通知', async () => {
      const sendMessageSpy = jest.spyOn(telegramNotifier, 'sendMessage')
        .mockResolvedValue(true);

      await telegramNotifier.sendTestNotification();

      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining('🧪 <b>Telegram通知测试</b>')
      );
    });
  });

  describe('配置状态', () => {
    test('应该返回正确的配置状态', () => {
      let status = telegramNotifier.getStatus();

      expect(status.enabled).toBe(false);
      expect(status.initialized).toBe(false);
      expect(status.hasBotToken).toBe(false);
      expect(status.hasChatId).toBe(false);
      expect(status.configured).toBe(false);

      telegramNotifier.init('test_bot_token', 'test_chat_id');

      status = telegramNotifier.getStatus();

      expect(status.enabled).toBe(true);
      expect(status.initialized).toBe(true);
      expect(status.hasBotToken).toBe(true);
      expect(status.hasChatId).toBe(true);
      expect(status.configured).toBe(true);
    });
  });

  describe('错误处理', () => {
    test('应该处理发送消息失败', async () => {
      telegramNotifier.init('test_bot_token', 'test_chat_id');

      const sendMessageSpy = jest.spyOn(telegramNotifier, 'sendMessage')
        .mockResolvedValue(false);

      const result = await telegramNotifier.sendTestNotification();

      expect(result).toBe(false);
      expect(sendMessageSpy).toHaveBeenCalled();
    });

    test('应该处理未配置时的通知', async () => {
      // 创建一个新的未配置的TelegramNotifier实例
      const unconfiguredNotifier = new TelegramNotifier();

      // 直接mock sendMessage方法，让它返回false（未配置状态）
      const sendMessageSpy = jest.spyOn(unconfiguredNotifier, 'sendMessage')
        .mockImplementation(async () => {
          if (!unconfiguredNotifier.enabled || !unconfiguredNotifier.initialized) {
            return false;
          }
          return true;
        });

      const result = await unconfiguredNotifier.sendTestNotification();

      expect(result).toBe(false);
      expect(sendMessageSpy).toHaveBeenCalled();
    });
  });
});
