/**
 * 告警引擎单测
 */

const AlertEngine = require('../../src/services/alert-engine');
const TelegramAlertService = require('../../src/services/telegram-alert');

// Mock TelegramAlertService
jest.mock('../../src/services/telegram-alert');

describe('AlertEngine', () => {
  let alertEngine;
  let mockTelegramService;

  beforeEach(() => {
    mockTelegramService = {
      sendAlert: jest.fn().mockResolvedValue(true)
    };
    TelegramAlertService.mockImplementation(() => mockTelegramService);
    
    alertEngine = new AlertEngine();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('构造函数', () => {
    it('应该正确初始化', () => {
      expect(alertEngine.rules).toBeInstanceOf(Map);
      expect(alertEngine.alertHistory).toBeInstanceOf(Map);
      expect(alertEngine.telegramService).toBeDefined();
    });

    it('应该设置默认告警规则', () => {
      expect(alertEngine.rules.has('CPU_HIGH')).toBe(true);
      expect(alertEngine.rules.has('MEMORY_HIGH')).toBe(true);
      expect(alertEngine.rules.has('DISK_HIGH')).toBe(true);
      expect(alertEngine.rules.has('API_ERROR')).toBe(true);
      expect(alertEngine.rules.has('STRATEGY_ERROR')).toBe(true);
      expect(alertEngine.rules.has('DATABASE_ERROR')).toBe(true);
    });
  });

  describe('addRule', () => {
    it('应该添加新规则', () => {
      alertEngine.addRule('CUSTOM_RULE', {
        threshold: 90,
        cooldown: 600000,
        message: '自定义告警',
        enabled: true
      });

      const rule = alertEngine.rules.get('CUSTOM_RULE');
      expect(rule.threshold).toBe(90);
      expect(rule.cooldown).toBe(600000);
      expect(rule.message).toBe('自定义告警');
      expect(rule.enabled).toBe(true);
    });
  });

  describe('checkAlert', () => {
    it('应该触发CPU告警', async () => {
      const result = await alertEngine.checkAlert('CPU_HIGH', 80, { cpu: 80 });

      expect(result).toBe(true);
      expect(mockTelegramService.sendAlert).toHaveBeenCalledWith(
        'CPU_HIGH',
        'CPU使用率过高',
        { cpu: 80 }
      );
    });

    it('应该触发内存告警', async () => {
      const result = await alertEngine.checkAlert('MEMORY_HIGH', 85, { memory: 85 });

      expect(result).toBe(true);
      expect(mockTelegramService.sendAlert).toHaveBeenCalledWith(
        'MEMORY_HIGH',
        '内存使用率过高',
        { memory: 85 }
      );
    });

    it('应该触发API错误告警', async () => {
      // 模拟多次错误
      await alertEngine.checkAlert('API_ERROR', 1, { error: 'API调用失败' });
      await alertEngine.checkAlert('API_ERROR', 1, { error: 'API调用失败' });
      await alertEngine.checkAlert('API_ERROR', 1, { error: 'API调用失败' });
      await alertEngine.checkAlert('API_ERROR', 1, { error: 'API调用失败' });
      const result = await alertEngine.checkAlert('API_ERROR', 1, { error: 'API调用失败' });

      expect(result).toBe(true);
      expect(mockTelegramService.sendAlert).toHaveBeenCalledWith(
        'API_ERROR',
        'API调用失败次数过多',
        { error: 'API调用失败', api: 1 }
      );
    });

    it('应该遵守冷却期', async () => {
      // 第一次告警
      await alertEngine.checkAlert('CPU_HIGH', 80, { cpu: 80 });
      expect(mockTelegramService.sendAlert).toHaveBeenCalledTimes(1);

      // 立即再次告警（应该在冷却期内）
      const result = await alertEngine.checkAlert('CPU_HIGH', 90, { cpu: 90 });
      expect(result).toBe(false);
      expect(mockTelegramService.sendAlert).toHaveBeenCalledTimes(1);
    });

    it('应该忽略未启用的规则', async () => {
      alertEngine.setRuleEnabled('CPU_HIGH', false);

      const result = await alertEngine.checkAlert('CPU_HIGH', 80, { cpu: 80 });

      expect(result).toBe(false);
      expect(mockTelegramService.sendAlert).not.toHaveBeenCalled();
    });

    it('应该忽略未达到阈值的情况', async () => {
      const result = await alertEngine.checkAlert('CPU_HIGH', 50, { cpu: 50 });

      expect(result).toBe(false);
      expect(mockTelegramService.sendAlert).not.toHaveBeenCalled();
    });
  });

  describe('recordAlert', () => {
    it('应该记录告警历史', () => {
      const alertData = {
        type: 'CPU_HIGH',
        value: 80,
        threshold: 60,
        message: 'CPU使用率过高',
        timestamp: new Date().toISOString()
      };

      alertEngine.recordAlert(alertData);

      const today = new Date().toISOString().split('T')[0];
      const key = `CPU_HIGH_${today}`;
      const history = alertEngine.alertHistory.get(key);

      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(alertData);
    });

    it('应该限制历史记录数量', () => {
      const alertData = {
        type: 'CPU_HIGH',
        value: 80,
        threshold: 60,
        message: 'CPU使用率过高',
        timestamp: new Date().toISOString()
      };

      // 添加超过100条记录
      for (let i = 0; i < 150; i++) {
        alertEngine.recordAlert({ ...alertData, value: 80 + i });
      }

      const today = new Date().toISOString().split('T')[0];
      const key = `CPU_HIGH_${today}`;
      const history = alertEngine.alertHistory.get(key);

      expect(history).toHaveLength(100);
    });
  });

  describe('getAlertHistory', () => {
    it.skip('应该返回告警历史', () => {
      const alertData = {
        type: 'CPU_HIGH',
        value: 80,
        threshold: 60,
        message: 'CPU使用率过高',
        timestamp: new Date().toISOString()
      };

      alertEngine.recordAlert(alertData);

      const history = alertEngine.getAlertHistory(null, 1); // 只获取1天内的历史
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(alertData);
    });

    it.skip('应该按类型过滤告警历史', () => {
      const cpuAlert = { type: 'CPU_HIGH', value: 80, timestamp: new Date().toISOString() };
      const memoryAlert = { type: 'MEMORY_HIGH', value: 85, timestamp: new Date().toISOString() };

      alertEngine.recordAlert(cpuAlert);
      alertEngine.recordAlert(memoryAlert);

      const cpuHistory = alertEngine.getAlertHistory('CPU_HIGH', 1); // 只获取1天内的历史
      expect(cpuHistory).toHaveLength(1);
      expect(cpuHistory[0]).toEqual(cpuAlert);
    });
  });

  describe('getAlertStats', () => {
    it('应该返回告警统计', () => {
      const stats = alertEngine.getAlertStats();

      expect(stats).toHaveProperty('rules');
      expect(stats).toHaveProperty('totalAlerts');
      expect(stats).toHaveProperty('alertsByType');
      expect(stats).toHaveProperty('last24Hours');
    });
  });

  describe('resetAlertCount', () => {
    it('应该重置告警计数', () => {
      const rule = alertEngine.rules.get('API_ERROR');
      rule.count = 5;

      alertEngine.resetAlertCount('API_ERROR');

      expect(rule.count).toBe(0);
    });
  });

  describe('setRuleEnabled', () => {
    it('应该启用/禁用规则', () => {
      alertEngine.setRuleEnabled('CPU_HIGH', false);
      expect(alertEngine.rules.get('CPU_HIGH').enabled).toBe(false);

      alertEngine.setRuleEnabled('CPU_HIGH', true);
      expect(alertEngine.rules.get('CPU_HIGH').enabled).toBe(true);
    });
  });

  describe('updateThreshold', () => {
    it('应该更新告警阈值', () => {
      alertEngine.updateThreshold('CPU_HIGH', 70);

      expect(alertEngine.rules.get('CPU_HIGH').threshold).toBe(70);
    });
  });
});
