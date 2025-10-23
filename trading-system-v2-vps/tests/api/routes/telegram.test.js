/**
 * Telegram API路由单元测试
 */

const request = require('supertest');
const express = require('express');
const telegramRoutes = require('../../../src/api/routes/telegram');
const TelegramMonitoringService = require('../../../src/services/telegram-monitoring');

// 模拟TelegramMonitoringService
jest.mock('../../../src/services/telegram-monitoring');
jest.mock('../../../src/utils/logger');

describe('Telegram API Routes', () => {
  let app;
  let mockTelegramService;

  beforeEach(() => {
    jest.clearAllMocks();

    // 创建Express应用
    app = express();
    app.use(express.json());
    app.use('/api/v1/telegram', telegramRoutes);

    // 模拟TelegramMonitoringService
    mockTelegramService = {
      getStatus: jest.fn(),
      updateConfig: jest.fn(),
      testConnection: jest.fn(),
      sendTradingAlert: jest.fn(),
      sendMonitoringAlert: jest.fn()
    };

    // 替换模块实例
    TelegramMonitoringService.mockImplementation(() => mockTelegramService);
  });

  describe('GET /api/v1/telegram/status', () => {
    it('应该返回Telegram状态', async () => {
      const mockStatus = {
        trading: {
          enabled: true,
          botToken: '已配置',
          chatId: '已配置'
        },
        monitoring: {
          enabled: true,
          botToken: '已配置',
          chatId: '已配置'
        }
      };

      mockTelegramService.getStatus.mockReturnValue(mockStatus);

      const response = await request(app)
        .get('/api/v1/telegram/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStatus);
      expect(mockTelegramService.getStatus).toHaveBeenCalled();
    });

    it('应该处理服务错误', async () => {
      mockTelegramService.getStatus.mockImplementation(() => {
        throw new Error('Service error');
      });

      const response = await request(app)
        .get('/api/v1/telegram/status')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Service error');
    });
  });

  describe('POST /api/v1/telegram/trading-config', () => {
    it('应该成功配置交易触发Telegram', async () => {
      const configData = {
        botToken: 'test_trading_token',
        chatId: 'test_trading_chat'
      };

      const mockStatus = {
        trading: { enabled: true, botToken: '已配置', chatId: '已配置' },
        monitoring: { enabled: false, botToken: '未配置', chatId: '未配置' }
      };

      mockTelegramService.getStatus.mockReturnValue(mockStatus);

      const response = await request(app)
        .post('/api/v1/telegram/trading-config')
        .send(configData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('交易触发Telegram配置已保存');
      expect(mockTelegramService.updateConfig).toHaveBeenCalledWith({
        trading: configData
      });
    });

    it('应该拒绝无效的配置数据', async () => {
      const response = await request(app)
        .post('/api/v1/telegram/trading-config')
        .send({ botToken: 'test_token' }) // 缺少chatId
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('botToken和chatId不能为空');
    });

    it('应该处理配置错误', async () => {
      mockTelegramService.updateConfig.mockImplementation(() => {
        throw new Error('Configuration error');
      });

      const configData = {
        botToken: 'test_trading_token',
        chatId: 'test_trading_chat'
      };

      const response = await request(app)
        .post('/api/v1/telegram/trading-config')
        .send(configData)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Configuration error');
    });
  });

  describe('POST /api/v1/telegram/monitoring-config', () => {
    it('应该成功配置系统监控Telegram', async () => {
      const configData = {
        botToken: 'test_monitoring_token',
        chatId: 'test_monitoring_chat'
      };

      const mockStatus = {
        trading: { enabled: false, botToken: '未配置', chatId: '未配置' },
        monitoring: { enabled: true, botToken: '已配置', chatId: '已配置' }
      };

      mockTelegramService.getStatus.mockReturnValue(mockStatus);

      const response = await request(app)
        .post('/api/v1/telegram/monitoring-config')
        .send(configData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('系统监控Telegram配置已保存');
      expect(mockTelegramService.updateConfig).toHaveBeenCalledWith({
        monitoring: configData
      });
    });

    it('应该拒绝无效的配置数据', async () => {
      const response = await request(app)
        .post('/api/v1/telegram/monitoring-config')
        .send({ chatId: 'test_chat' }) // 缺少botToken
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('botToken和chatId不能为空');
    });
  });

  describe('POST /api/v1/telegram/test-trading', () => {
    it('应该成功测试交易触发连接', async () => {
      const mockConnectionResult = {
        success: true,
        bot: { id: 123, first_name: 'Trading Bot' }
      };

      mockTelegramService.testConnection.mockResolvedValue(mockConnectionResult);
      mockTelegramService.sendMessage.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/telegram/test-trading')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('交易触发Telegram测试成功');
      expect(mockTelegramService.testConnection).toHaveBeenCalledWith('trading');
    });

    it('应该处理连接测试失败', async () => {
      const mockConnectionResult = {
        success: false,
        error: 'Invalid token'
      };

      mockTelegramService.testConnection.mockResolvedValue(mockConnectionResult);

      const response = await request(app)
        .post('/api/v1/telegram/test-trading')
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid token');
    });
  });

  describe('POST /api/v1/telegram/test-monitoring', () => {
    it('应该成功测试系统监控连接', async () => {
      const mockConnectionResult = {
        success: true,
        bot: { id: 456, first_name: 'Monitoring Bot' }
      };

      mockTelegramService.testConnection.mockResolvedValue(mockConnectionResult);
      mockTelegramService.sendMessage.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/telegram/test-monitoring')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('系统监控Telegram测试成功');
      expect(mockTelegramService.testConnection).toHaveBeenCalledWith('monitoring');
    });

    it('应该处理连接测试失败', async () => {
      const mockConnectionResult = {
        success: false,
        error: 'Connection failed'
      };

      mockTelegramService.testConnection.mockResolvedValue(mockConnectionResult);

      const response = await request(app)
        .post('/api/v1/telegram/test-monitoring')
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Connection failed');
    });
  });

  describe('POST /api/v1/telegram/send-trading-alert', () => {
    it('应该成功发送交易触发通知', async () => {
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

      mockTelegramService.sendTradingAlert.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/telegram/send-trading-alert')
        .send(tradeData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('交易触发通知发送成功');
      expect(mockTelegramService.sendTradingAlert).toHaveBeenCalledWith(tradeData);
    });

    it('应该拒绝不完整的交易数据', async () => {
      const incompleteData = {
        symbol: 'BTCUSDT'
        // 缺少其他必需字段
      };

      const response = await request(app)
        .post('/api/v1/telegram/send-trading-alert')
        .send(incompleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('交易数据不完整');
    });

    it('应该处理发送失败', async () => {
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

      mockTelegramService.sendTradingAlert.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/v1/telegram/send-trading-alert')
        .send(tradeData)
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('交易触发通知发送失败');
    });
  });

  describe('POST /api/v1/telegram/send-monitoring-alert', () => {
    it('应该成功发送系统监控告警', async () => {
      const alertData = {
        type: 'CPU_HIGH',
        message: 'CPU使用率过高',
        data: { cpu: 85, memory: 60 }
      };

      mockTelegramService.sendMonitoringAlert.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/telegram/send-monitoring-alert')
        .send(alertData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('系统监控告警发送成功');
      expect(mockTelegramService.sendMonitoringAlert).toHaveBeenCalledWith(
        'CPU_HIGH',
        'CPU使用率过高',
        { cpu: 85, memory: 60 }
      );
    });

    it('应该拒绝缺少必需字段的告警数据', async () => {
      const incompleteData = {
        message: '测试消息'
        // 缺少type字段
      };

      const response = await request(app)
        .post('/api/v1/telegram/send-monitoring-alert')
        .send(incompleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('告警类型和消息不能为空');
    });

    it('应该处理发送失败', async () => {
      const alertData = {
        type: 'CPU_HIGH',
        message: 'CPU使用率过高',
        data: { cpu: 85 }
      };

      mockTelegramService.sendMonitoringAlert.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/v1/telegram/send-monitoring-alert')
        .send(alertData)
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('系统监控告警发送失败');
    });
  });
});
