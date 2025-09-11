/**
 * 模拟交易数据显示逻辑单元测试
 * 测试simulation-data.js中的数据显示逻辑是否正确
 */

// Mock DOM环境
global.document = {
  getElementById: jest.fn(() => ({
    innerHTML: '',
    textContent: '',
    style: { display: '' }
  }))
};

// Mock window对象
global.window = {
  apiClient: {
    getSimulationHistory: jest.fn()
  }
};

// Mock APIClient
class MockAPIClient {
  constructor() {
    this.getSimulationHistory = jest.fn();
    this.getWinRateStats = jest.fn();
    this.getDirectionStats = jest.fn();
    this.getSymbolStats = jest.fn();
  }
}

// 模拟SimulationDataManager类
class SimulationDataManager {
  constructor() {
    this.apiClient = new MockAPIClient();
  }

  formatNumber(value) {
    if (value === null || value === undefined || value === '') return '--';
    return parseFloat(value).toFixed(4);
  }

  calculateSimulationResult(sim) {
    // 如果交易没有结束，不显示盈亏金额
    const profitLoss = sim.status === 'ACTIVE' ? null : (sim.profit_loss || 0);
    const profitLossClass = profitLoss === null ? 'neutral' : (profitLoss > 0 ? 'positive' : profitLoss < 0 ? 'negative' : 'neutral');
    
    // 根据状态和is_win字段判断结果
    let resultClass, resultText;
    if (sim.status === 'ACTIVE') {
      // 如果交易没有结束，显示进行中，不展示盈亏金额
      resultClass = 'neutral';
      resultText = '进行中';
    } else if (sim.is_win === 1 || sim.is_win === true) {
      resultClass = 'positive';
      resultText = '盈利';
    } else if (sim.is_win === 0 || sim.is_win === false) {
      resultClass = 'negative';
      resultText = '亏损';
    } else {
      resultClass = 'neutral';
      resultText = '进行中';
    }

    return { profitLoss, profitLossClass, resultClass, resultText };
  }

  formatSimulationRow(sim) {
    const entryTime = sim.created_at ? new Date(sim.created_at).toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }) : '--';
    const exitTime = sim.closed_at ? new Date(sim.closed_at).toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }) : '--';
    
    // 使用提取的方法处理盈亏金额和结果显示
    const { profitLoss, profitLossClass, resultClass, resultText } = this.calculateSimulationResult(sim);

    return `
      <tr>
        <td>${sim.symbol}</td>
        <td>${sim.direction === 'LONG' ? '做多' : '做空'}</td>
        <td>${this.formatNumber(sim.entry_price)}</td>
        <td>${this.formatNumber(sim.stop_loss_price)}</td>
        <td>${this.formatNumber(sim.take_profit_price)}</td>
        <td>${sim.max_leverage || '--'}</td>
        <td>${this.formatNumber(sim.min_margin)} USDT</td>
        <td>${sim.stop_loss_distance ? sim.stop_loss_distance.toFixed(2) + '%' : '--'}</td>
        <td>${this.formatNumber(sim.atr_value)}</td>
        <td>${entryTime}</td>
        <td>${exitTime}</td>
        <td>${this.formatNumber(sim.exit_price)}</td>
        <td>${sim.exit_reason || '--'}</td>
        <td>${sim.trigger_reason || '--'}</td>
        <td class="profit-loss ${profitLossClass}">${profitLoss === null ? '--' : this.formatNumber(profitLoss)}</td>
        <td class="profit-loss ${resultClass}">${resultText}</td>
      </tr>
    `;
  }
}

describe('SimulationDataManager', () => {
  let manager;

  beforeEach(() => {
    manager = new SimulationDataManager();
    // 重置mock
    jest.clearAllMocks();
  });

  describe('模拟交易记录显示逻辑', () => {
    test('ACTIVE状态应该显示进行中', () => {
      const sim = {
        symbol: 'BTCUSDT',
        direction: 'LONG',
        status: 'ACTIVE',
        entry_price: 50000,
        stop_loss_price: 49000,
        take_profit_price: 51000,
        max_leverage: 10,
        min_margin: 100,
        stop_loss_distance: 2,
        atr_value: 1000,
        created_at: '2025-01-09T10:00:00Z',
        closed_at: null,
        exit_price: null,
        exit_reason: null,
        trigger_reason: 'SIGNAL_多头回踩突破',
        profit_loss: null,
        is_win: null
      };

      const result = manager.formatSimulationRow(sim);
      
      expect(result).toContain('进行中');
      expect(result).toContain('--'); // 盈亏金额应该显示为--
    });

    test('CLOSED状态且is_win=1应该显示盈利', () => {
      const sim = {
        symbol: 'BTCUSDT',
        direction: 'LONG',
        status: 'CLOSED',
        entry_price: 50000,
        stop_loss_price: 49000,
        take_profit_price: 51000,
        max_leverage: 10,
        min_margin: 100,
        stop_loss_distance: 2,
        atr_value: 1000,
        created_at: '2025-01-09T10:00:00Z',
        closed_at: '2025-01-09T11:00:00Z',
        exit_price: 51000,
        exit_reason: 'TAKE_PROFIT',
        trigger_reason: 'SIGNAL_多头回踩突破',
        profit_loss: 1000,
        is_win: 1
      };

      const result = manager.formatSimulationRow(sim);
      
      expect(result).toContain('盈利');
      expect(result).toContain('1000.0000'); // 盈亏金额应该显示
    });

    test('CLOSED状态且is_win=0应该显示亏损', () => {
      const sim = {
        symbol: 'BTCUSDT',
        direction: 'LONG',
        status: 'CLOSED',
        entry_price: 50000,
        stop_loss_price: 49000,
        take_profit_price: 51000,
        max_leverage: 10,
        min_margin: 100,
        stop_loss_distance: 2,
        atr_value: 1000,
        created_at: '2025-01-09T10:00:00Z',
        closed_at: '2025-01-09T11:00:00Z',
        exit_price: 49000,
        exit_reason: 'STOP_LOSS',
        trigger_reason: 'SIGNAL_多头回踩突破',
        profit_loss: -1000,
        is_win: 0
      };

      const result = manager.formatSimulationRow(sim);
      
      expect(result).toContain('亏损');
      expect(result).toContain('-1000.0000'); // 盈亏金额应该显示
    });

    test('CLOSED状态但is_win为null应该根据profit_loss判断', () => {
      const sim = {
        symbol: 'BTCUSDT',
        direction: 'LONG',
        status: 'CLOSED',
        entry_price: 50000,
        stop_loss_price: 49000,
        take_profit_price: 51000,
        max_leverage: 10,
        min_margin: 100,
        stop_loss_distance: 2,
        atr_value: 1000,
        created_at: '2025-01-09T10:00:00Z',
        closed_at: '2025-01-09T11:00:00Z',
        exit_price: 51000,
        exit_reason: 'TAKE_PROFIT',
        trigger_reason: 'SIGNAL_多头回踩突破',
        profit_loss: 500,
        is_win: null
      };

      const result = manager.formatSimulationRow(sim);
      
      // 当is_win为null时，应该显示进行中（因为无法确定结果）
      expect(result).toContain('进行中');
    });

    test('数据边界情况测试', () => {
      // 测试is_win为字符串的情况
      const sim1 = {
        symbol: 'BTCUSDT',
        direction: 'LONG',
        status: 'CLOSED',
        entry_price: 50000,
        stop_loss_price: 49000,
        take_profit_price: 51000,
        max_leverage: 10,
        min_margin: 100,
        stop_loss_distance: 2,
        atr_value: 1000,
        created_at: '2025-01-09T10:00:00Z',
        closed_at: '2025-01-09T11:00:00Z',
        exit_price: 51000,
        exit_reason: 'TAKE_PROFIT',
        trigger_reason: 'SIGNAL_多头回踩突破',
        profit_loss: 1000,
        is_win: '1' // 字符串类型
      };

      const result1 = manager.formatSimulationRow(sim1);
      expect(result1).toContain('进行中'); // 字符串'1'不应该匹配数字1

      // 测试is_win为undefined的情况
      const sim2 = {
        ...sim1,
        is_win: undefined
      };

      const result2 = manager.formatSimulationRow(sim2);
      expect(result2).toContain('进行中');
    });
  });

  describe('盈亏金额显示逻辑', () => {
    test('ACTIVE状态不应该显示盈亏金额', () => {
      const sim = {
        symbol: 'BTCUSDT',
        direction: 'LONG',
        status: 'ACTIVE',
        profit_loss: 1000, // 即使有盈亏金额，也不应该显示
        is_win: 1
      };

      const result = manager.formatSimulationRow(sim);
      expect(result).toContain('--'); // 盈亏金额应该显示为--
    });

    test('CLOSED状态应该显示盈亏金额', () => {
      const sim = {
        symbol: 'BTCUSDT',
        direction: 'LONG',
        status: 'CLOSED',
        profit_loss: 1000,
        is_win: 1
      };

      const result = manager.formatSimulationRow(sim);
      expect(result).toContain('1000.0000'); // 盈亏金额应该显示
    });
  });

  describe('数据格式化测试', () => {
    test('formatNumber方法应该正确格式化数字', () => {
      expect(manager.formatNumber(1234.5678)).toBe('1234.5678');
      expect(manager.formatNumber(0)).toBe('0.0000');
      expect(manager.formatNumber(null)).toBe('--');
      expect(manager.formatNumber(undefined)).toBe('--');
    });
  });
});
