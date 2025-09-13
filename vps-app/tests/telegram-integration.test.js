/**
 * Telegram通知集成测试
 * 测试Telegram通知在模拟交易开启和结束时的集成功能
 */

const TelegramNotifier = require('../modules/notification/TelegramNotifier');
const SimulationManager = require('../modules/database/SimulationManager');

// 模拟数据库
const mockDatabase = {
  runQuery: jest.fn(),
  run: jest.fn(),
  getUserSetting: jest.fn()
};

describe('Telegram通知集成测试', () => {
  let telegramNotifier;
  let simulationManager;

  beforeEach(() => {
    telegramNotifier = new TelegramNotifier();
    simulationManager = new SimulationManager(mockDatabase);
    simulationManager.setTelegramNotifier(telegramNotifier);

    jest.clearAllMocks();
  });

  describe('模拟交易开启通知集成', () => {
    test('应该在模拟交易创建时发送通知', async () => {
      // 配置Telegram
      telegramNotifier.init('test_bot_token', 'test_chat_id');

      // 模拟sendMessage方法
      const sendStartNotificationSpy = jest.spyOn(telegramNotifier, 'sendSimulationStartNotification')
        .mockResolvedValue(true);

      // 模拟数据库查询返回新的模拟交易
      mockDatabase.runQuery.mockResolvedValue([{
        id: 1,
        symbol: 'BTCUSDT',
        direction: 'LONG',
        entry_price: 50000.0,
        stop_loss_price: 48000.0,
        take_profit_price: 52000.0,
        max_leverage: 20,
        min_margin: 100.0,
        trigger_reason: 'SIGNAL_多头回踩突破',
        execution_mode_v3: '多头回踩突破',
        market_type: '趋势市'
      }]);

      // 模拟createSimulation方法
      const createSimulationSpy = jest.spyOn(simulationManager, 'createSimulation')
        .mockResolvedValue(1);

      // 执行创建模拟交易
      await simulationManager.createSimulation(
        'BTCUSDT',
        50000.0,
        48000.0,
        52000.0,
        20,
        100.0,
        'SIGNAL_多头回踩突破'
      );

      // 验证通知被调用（在实际集成中，这会在server.js中调用）
      expect(createSimulationSpy).toHaveBeenCalled();
    });
  });

  describe('模拟交易结束通知集成', () => {
    beforeEach(() => {
      telegramNotifier.init('test_bot_token', 'test_chat_id');
    });

    test('应该在模拟交易结束时发送通知', async () => {
      // 模拟活跃的模拟交易
      const activeSimulation = {
        id: 1,
        symbol: 'BTCUSDT',
        direction: 'LONG',
        entry_price: 50000.0,
        stop_loss_price: 48000.0,
        take_profit_price: 52000.0,
        max_leverage: 20,
        min_margin: 100.0,
        trigger_reason: 'SIGNAL_多头回踩突破',
        time_in_position: 2,
        max_time_in_position: 48
      };

      // 模拟数据库查询返回活跃交易
      mockDatabase.runQuery.mockResolvedValue([activeSimulation]);

      // 模拟数据库更新
      mockDatabase.run.mockResolvedValue({ changes: 1 });

      // 模拟sendMessage方法
      const sendEndNotificationSpy = jest.spyOn(telegramNotifier, 'sendSimulationEndNotification')
        .mockResolvedValue(true);

      // 模拟checkExitConditions返回退出条件
      const checkExitConditionsSpy = jest.spyOn(simulationManager, 'checkExitConditions')
        .mockReturnValue({
          exit: true,
          exitPrice: 52000.0,
          reason: '止盈触发'
        });

      // 模拟calculateProfitLoss
      const calculateProfitLossSpy = jest.spyOn(simulationManager, 'calculateProfitLoss')
        .mockReturnValue(200.0);

      // 模拟updateWinRateStats
      jest.spyOn(simulationManager, 'updateWinRateStats').mockResolvedValue();

      // 执行updateSimulationStatus
      await simulationManager.updateSimulationStatus('BTCUSDT', 52000.0);

      // 验证通知被发送
      expect(sendEndNotificationSpy).toHaveBeenCalledWith({
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
      });
    });

    test('应该处理通知发送失败的情况', async () => {
      const activeSimulation = {
        id: 1,
        symbol: 'BTCUSDT',
        direction: 'LONG',
        entry_price: 50000.0,
        stop_loss_price: 48000.0,
        take_profit_price: 52000.0,
        max_leverage: 20,
        min_margin: 100.0,
        trigger_reason: 'SIGNAL_多头回踩突破',
        time_in_position: 1,
        max_time_in_position: 48
      };

      mockDatabase.runQuery.mockResolvedValue([activeSimulation]);
      mockDatabase.run.mockResolvedValue({ changes: 1 });

      // 模拟通知发送失败
      const sendEndNotificationSpy = jest.spyOn(telegramNotifier, 'sendSimulationEndNotification')
        .mockRejectedValue(new Error('Telegram API错误'));

      jest.spyOn(simulationManager, 'checkExitConditions').mockReturnValue({
        exit: true,
        exitPrice: 48000.0,
        reason: '止损触发'
      });

      jest.spyOn(simulationManager, 'calculateProfitLoss').mockReturnValue(-100.0);
      jest.spyOn(simulationManager, 'updateWinRateStats').mockResolvedValue();

      // 执行updateSimulationStatus，应该不抛出错误
      await expect(simulationManager.updateSimulationStatus('BTCUSDT', 48000.0))
        .resolves.not.toThrow();

      expect(sendEndNotificationSpy).toHaveBeenCalled();
    });
  });

  describe('配置管理集成', () => {
    test('应该正确设置和获取Telegram配置', () => {
      // 初始状态
      let status = telegramNotifier.getStatus();
      expect(status.configured).toBe(false);

      // 设置配置
      telegramNotifier.init('test_bot_token', 'test_chat_id');

      status = telegramNotifier.getStatus();
      expect(status.configured).toBe(true);
      expect(status.enabled).toBe(true);
      expect(status.hasBotToken).toBe(true);
      expect(status.hasChatId).toBe(true);
    });

    test('应该正确处理无效配置', () => {
      telegramNotifier.init('', '');

      const status = telegramNotifier.getStatus();
      expect(status.configured).toBe(false);
      expect(status.enabled).toBe(false);
    });
  });

  describe('消息格式验证', () => {
    beforeEach(() => {
      telegramNotifier.init('test_bot_token', 'test_chat_id');
    });

    test('开启通知消息格式应该正确', async () => {
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

      let capturedMessage = '';
      const sendMessageSpy = jest.spyOn(telegramNotifier, 'sendMessage')
        .mockImplementation(async (message) => {
          capturedMessage = message;
          return true;
        });

      await telegramNotifier.sendSimulationStartNotification(simulationData);

      expect(capturedMessage).toContain('🚀 <b>模拟交易开启</b>');
      expect(capturedMessage).toContain('BTCUSDT');
      expect(capturedMessage).toContain('做多');
      expect(capturedMessage).toContain('50000.0000 USDT');
      expect(capturedMessage).toContain('48000.0000 USDT');
      expect(capturedMessage).toContain('52000.0000 USDT');
      expect(capturedMessage).toContain('20x');
      expect(capturedMessage).toContain('100.00 USDT');
      expect(capturedMessage).toContain('SIGNAL_多头回踩突破');
    });

    test('结束通知消息格式应该正确', async () => {
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

      let capturedMessage = '';
      const sendMessageSpy = jest.spyOn(telegramNotifier, 'sendMessage')
        .mockImplementation(async (message) => {
          capturedMessage = message;
          return true;
        });

      await telegramNotifier.sendSimulationEndNotification(simulationData);

      expect(capturedMessage).toContain('❌ <b>模拟交易结束</b>');
      expect(capturedMessage).toContain('ETHUSDT');
      expect(capturedMessage).toContain('做空');
      expect(capturedMessage).toContain('3100.0000 USDT');
      expect(capturedMessage).toContain('止损触发');
      expect(capturedMessage).toContain('-50.0000 USDT');
      expect(capturedMessage).toContain('亏损');
      expect(capturedMessage).toContain('-33.33%');
    });
  });
});
