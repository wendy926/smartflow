/**
 * CooldownCache 单元测试
 */

const CooldownCache = require('../../src/services/v3-1-plus/cooldown-cache');

describe('CooldownCache', () => {
  let cooldownCache;

  beforeEach(() => {
    cooldownCache = new CooldownCache();
  });

  describe('canEnter', () => {
    test('首次入场应该允许', () => {
      const result = cooldownCache.canEnter('BTCUSDT', 45, 6);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('first_entry');
    });

    test('冷却时间内应该拒绝', () => {
      cooldownCache.updateEntry('BTCUSDT');
      const result = cooldownCache.canEnter('BTCUSDT', 45, 6);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('cooldown_active');
      expect(result.details.minutesRemaining).toBeGreaterThan(0);
    });

    test('超过冷却时间应该允许', () => {
      // 模拟45分钟前的入场
      const symbol = 'ETHUSDT';
      const pastTime = Date.now() - 46 * 60 * 1000;
      cooldownCache.cache.set(symbol, {
        lastEntry: pastTime,
        dailyCount: 2,
        lastResetDate: new Date().toDateString()
      });

      const result = cooldownCache.canEnter(symbol, 45, 6);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('ok');
    });

    test('达到每日限制应该拒绝', () => {
      const symbol = 'SOLUSDT';
      const pastTime = Date.now() - 60 * 60 * 1000;
      cooldownCache.cache.set(symbol, {
        lastEntry: pastTime,
        dailyCount: 6,
        lastResetDate: new Date().toDateString()
      });

      const result = cooldownCache.canEnter(symbol, 45, 6);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('daily_limit_reached');
    });

    test('新的一天应该重置每日计数', () => {
      const symbol = 'BTCUSDT';
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      cooldownCache.cache.set(symbol, {
        lastEntry: Date.now() - 60 * 60 * 1000,
        dailyCount: 6,
        lastResetDate: yesterday.toDateString()
      });

      const result = cooldownCache.canEnter(symbol, 45, 6);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('daily_reset');
    });
  });

  describe('updateEntry', () => {
    test('更新入场记录应该增加计数', () => {
      cooldownCache.updateEntry('BTCUSDT');
      const status = cooldownCache.getStatus('BTCUSDT');
      expect(status.dailyCount).toBe(1);

      cooldownCache.updateEntry('BTCUSDT');
      const status2 = cooldownCache.getStatus('BTCUSDT');
      expect(status2.dailyCount).toBe(2);
    });
  });

  describe('getStatistics', () => {
    test('应该返回正确的统计信息', () => {
      cooldownCache.updateEntry('BTCUSDT');
      cooldownCache.updateEntry('ETHUSDT');
      cooldownCache.updateEntry('SOLUSDT');

      const stats = cooldownCache.getStatistics();
      expect(stats.totalSymbols).toBe(3);
      expect(stats.recentEntries.length).toBe(3);
    });
  });

  describe('reset', () => {
    test('应该能够重置单个交易对', () => {
      cooldownCache.updateEntry('BTCUSDT');
      cooldownCache.reset('BTCUSDT');
      
      const result = cooldownCache.canEnter('BTCUSDT', 45, 6);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('first_entry');
    });
  });
});

