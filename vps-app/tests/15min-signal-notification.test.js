// tests/15min-signal-notification.test.js
// 15min信号通知功能测试

const TelegramNotifier = require('../modules/notification/TelegramNotifier');

describe('15min信号通知功能', () => {
  let telegramNotifier;

  beforeEach(() => {
    telegramNotifier = new TelegramNotifier();
    // 模拟配置
    telegramNotifier.botToken = 'test-bot-token';
    telegramNotifier.chatId = 'test-chat-id';
    telegramNotifier.enabled = true;
    telegramNotifier.initialized = true;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('send15minSignalNotification', () => {
    test('应该正确发送多头回踩突破信号通知', async () => {
      const mockData = {
        symbol: 'BTCUSDT',
        executionMode: '多头回踩突破',
        signal: 'BUY',
        entryPrice: 50100.1234,
        stopLoss: 49500.5678,
        takeProfit: 51300.9012,
        currentPrice: 50050.3456,
        trend4h: '多头趋势',
        score1h: 4,
        reason: '趋势市多头回踩突破触发',
        timestamp: '2025-01-13T10:30:00.000Z'
      };

      // Mock sendMessage方法
      const sendMessageSpy = jest.spyOn(telegramNotifier, 'sendMessage')
        .mockResolvedValue(true);

      const result = await telegramNotifier.send15minSignalNotification(mockData);

      expect(result).toBe(true);
      expect(sendMessageSpy).toHaveBeenCalledTimes(1);
      
      const sentMessage = sendMessageSpy.mock.calls[0][0];
      expect(sentMessage).toContain('🎯 <b>15分钟信号检测</b>');
      expect(sentMessage).toContain('📊 <b>交易对:</b> BTCUSDT');
      expect(sentMessage).toContain('🔄 <b>执行模式:</b> 多头回踩突破');
      expect(sentMessage).toContain('📈 多头');
      expect(sentMessage).toContain('📈 <b>4H趋势:</b> 多头趋势');
      expect(sentMessage).toContain('📊 <b>1H得分:</b> 4/6');
      expect(sentMessage).toContain('🏷️ <b>市场类型:</b> 趋势市');
      expect(sentMessage).toContain('• 当前价格: 50050.3456');
      expect(sentMessage).toContain('• 入场价格: 50100.1234');
      expect(sentMessage).toContain('• 止损价格: 49500.5678');
      expect(sentMessage).toContain('• 止盈价格: 51300.9012');
      expect(sentMessage).toContain('📝 <b>触发原因:</b> 趋势市多头回踩突破触发');
    });

    test('应该正确发送空头反抽破位信号通知', async () => {
      const mockData = {
        symbol: 'ETHUSDT',
        executionMode: '空头反抽破位',
        signal: 'SELL',
        entryPrice: 3200.1234,
        stopLoss: 3250.5678,
        takeProfit: 3100.9012,
        currentPrice: 3210.3456,
        trend4h: '空头趋势',
        score1h: 3,
        reason: '趋势市空头反抽破位触发',
        timestamp: '2025-01-13T10:30:00.000Z'
      };

      const sendMessageSpy = jest.spyOn(telegramNotifier, 'sendMessage')
        .mockResolvedValue(true);

      const result = await telegramNotifier.send15minSignalNotification(mockData);

      expect(result).toBe(true);
      expect(sendMessageSpy).toHaveBeenCalledTimes(1);
      
      const sentMessage = sendMessageSpy.mock.calls[0][0];
      expect(sentMessage).toContain('📉 空头');
      expect(sentMessage).toContain('🔄 <b>执行模式:</b> 空头反抽破位');
      expect(sentMessage).toContain('📈 <b>4H趋势:</b> 空头趋势');
    });

    test('应该正确处理震荡市信号通知', async () => {
      const mockData = {
        symbol: 'SOLUSDT',
        executionMode: '区间多头',
        signal: 'BUY',
        entryPrice: 240.1234,
        stopLoss: 235.5678,
        takeProfit: 250.9012,
        currentPrice: 238.3456,
        trend4h: '震荡/无趋势',
        score1h: 0,
        reason: '震荡市区间多头触发',
        timestamp: '2025-01-13T10:30:00.000Z'
      };

      const sendMessageSpy = jest.spyOn(telegramNotifier, 'sendMessage')
        .mockResolvedValue(true);

      const result = await telegramNotifier.send15minSignalNotification(mockData);

      expect(result).toBe(true);
      expect(sendMessageSpy).toHaveBeenCalledTimes(1);
      
      const sentMessage = sendMessageSpy.mock.calls[0][0];
      expect(sentMessage).toContain('🏷️ <b>市场类型:</b> 震荡市');
      expect(sentMessage).toContain('🔄 <b>执行模式:</b> 区间多头');
    });

    test('应该正确处理没有价格信息的情况', async () => {
      const mockData = {
        symbol: 'LINKUSDT',
        executionMode: '多头回踩突破',
        signal: 'NONE',
        entryPrice: null,
        stopLoss: null,
        takeProfit: null,
        currentPrice: 15.1234,
        trend4h: '多头趋势',
        score1h: 2,
        reason: '多头回踩突破条件满足但VWAP方向不一致',
        timestamp: '2025-01-13T10:30:00.000Z'
      };

      const sendMessageSpy = jest.spyOn(telegramNotifier, 'sendMessage')
        .mockResolvedValue(true);

      const result = await telegramNotifier.send15minSignalNotification(mockData);

      expect(result).toBe(true);
      expect(sendMessageSpy).toHaveBeenCalledTimes(1);
      
      const sentMessage = sendMessageSpy.mock.calls[0][0];
      expect(sentMessage).toContain('• 当前价格: 15.1234');
      expect(sentMessage).toContain('• 入场价格: --');
      expect(sentMessage).toContain('• 止损价格: --');
      expect(sentMessage).toContain('• 止盈价格: --');
      expect(sentMessage).toContain('⏸️ 观望');
    });

    test('应该正确处理发送失败的情况', async () => {
      const mockData = {
        symbol: 'BTCUSDT',
        executionMode: '多头回踩突破',
        signal: 'BUY',
        entryPrice: 50100.1234,
        stopLoss: 49500.5678,
        takeProfit: 51300.9012,
        currentPrice: 50050.3456,
        trend4h: '多头趋势',
        score1h: 4,
        reason: '趋势市多头回踩突破触发',
        timestamp: '2025-01-13T10:30:00.000Z'
      };

      const sendMessageSpy = jest.spyOn(telegramNotifier, 'sendMessage')
        .mockResolvedValue(false);

      const result = await telegramNotifier.send15minSignalNotification(mockData);

      expect(result).toBe(false);
      expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    });

    test('应该正确处理未配置的情况', async () => {
      const unconfiguredNotifier = new TelegramNotifier();
      
      const mockData = {
        symbol: 'BTCUSDT',
        executionMode: '多头回踩突破',
        signal: 'BUY',
        entryPrice: 50100.1234,
        stopLoss: 49500.5678,
        takeProfit: 51300.9012,
        currentPrice: 50050.3456,
        trend4h: '多头趋势',
        score1h: 4,
        reason: '趋势市多头回踩突破触发',
        timestamp: '2025-01-13T10:30:00.000Z'
      };

      const sendMessageSpy = jest.spyOn(unconfiguredNotifier, 'sendMessage')
        .mockResolvedValue(false);

      const result = await unconfiguredNotifier.send15minSignalNotification(mockData);

      expect(result).toBe(false);
      expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('消息格式验证', () => {
    test('应该包含所有必要的字段', async () => {
      const mockData = {
        symbol: 'BTCUSDT',
        executionMode: '多头回踩突破',
        signal: 'BUY',
        entryPrice: 50100.1234,
        stopLoss: 49500.5678,
        takeProfit: 51300.9012,
        currentPrice: 50050.3456,
        trend4h: '多头趋势',
        score1h: 4,
        reason: '趋势市多头回踩突破触发',
        timestamp: '2025-01-13T10:30:00.000Z'
      };

      const sendMessageSpy = jest.spyOn(telegramNotifier, 'sendMessage')
        .mockResolvedValue(true);

      await telegramNotifier.send15minSignalNotification(mockData);
      
      const sentMessage = sendMessageSpy.mock.calls[0][0];
      
      // 验证消息包含所有必要字段
      expect(sentMessage).toContain('🎯 <b>15分钟信号检测</b>');
      expect(sentMessage).toContain('📊 <b>交易对:</b>');
      expect(sentMessage).toContain('🔄 <b>执行模式:</b>');
      expect(sentMessage).toContain('📈 <b>4H趋势:</b>');
      expect(sentMessage).toContain('📊 <b>1H得分:</b>');
      expect(sentMessage).toContain('🏷️ <b>市场类型:</b>');
      expect(sentMessage).toContain('💰 <b>价格信息:</b>');
      expect(sentMessage).toContain('📝 <b>触发原因:</b>');
      expect(sentMessage).toContain('⏰ <b>检测时间:</b>');
      expect(sentMessage).toContain('🤖 SmartFlow V3策略系统');
    });

    test('应该正确格式化时间', async () => {
      const mockData = {
        symbol: 'BTCUSDT',
        executionMode: '多头回踩突破',
        signal: 'BUY',
        entryPrice: 50100.1234,
        stopLoss: 49500.5678,
        takeProfit: 51300.9012,
        currentPrice: 50050.3456,
        trend4h: '多头趋势',
        score1h: 4,
        reason: '趋势市多头回踩突破触发',
        timestamp: '2025-01-13T10:30:00.000Z'
      };

      const sendMessageSpy = jest.spyOn(telegramNotifier, 'sendMessage')
        .mockResolvedValue(true);

      await telegramNotifier.send15minSignalNotification(mockData);
      
      const sentMessage = sendMessageSpy.mock.calls[0][0];
      
      // 验证时间格式（应该是中国时间）
      expect(sentMessage).toMatch(/⏰ <b>检测时间:<\/b> \d{4}\/\d{1,2}\/\d{1,2} \d{1,2}:\d{2}:\d{2}/);
    });
  });
});
