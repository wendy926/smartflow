// SmartFlowStrategyV3 初始化测试
const SmartFlowStrategyV3 = require('../modules/strategy/SmartFlowStrategyV3');
const StrategyV3Core = require('../modules/strategy/StrategyV3Core');
const StrategyV3Execution = require('../modules/strategy/StrategyV3Execution');
const { DataMonitor } = require('../modules/monitoring/DataMonitor');

// Mock dependencies
jest.mock('../modules/strategy/StrategyV3Core');
jest.mock('../modules/strategy/StrategyV3Execution');
jest.mock('../modules/monitoring/DataMonitor');

describe('SmartFlowStrategyV3 初始化测试', () => {
  let mockDatabase;

  beforeEach(() => {
    // 重置所有mock
    jest.clearAllMocks();
    
    // 创建mock数据库
    mockDatabase = {
      runQuery: jest.fn(),
      getUserSetting: jest.fn(),
      getSymbolCategory: jest.fn(),
      getFactorWeights: jest.fn()
    };

    // 重置静态属性
    SmartFlowStrategyV3.core = null;
    SmartFlowStrategyV3.execution = null;
    SmartFlowStrategyV3.dataMonitor = null;
  });

  afterEach(() => {
    // 清理静态属性
    SmartFlowStrategyV3.core = null;
    SmartFlowStrategyV3.execution = null;
    SmartFlowStrategyV3.dataMonitor = null;
  });

  describe('init方法', () => {
    test('应该正确初始化所有模块', () => {
      // 调用init方法
      SmartFlowStrategyV3.init(mockDatabase);

      // 验证StrategyV3Core被正确初始化
      expect(StrategyV3Core).toHaveBeenCalledWith(mockDatabase);
      expect(SmartFlowStrategyV3.core).toBeDefined();

      // 验证StrategyV3Execution被正确初始化
      expect(StrategyV3Execution).toHaveBeenCalledWith(mockDatabase);
      expect(SmartFlowStrategyV3.execution).toBeDefined();

      // 验证DataMonitor被正确初始化
      expect(DataMonitor).toHaveBeenCalledWith(mockDatabase);
      expect(SmartFlowStrategyV3.dataMonitor).toBeDefined();
    });

    test('应该处理null数据库参数', () => {
      // 调用init方法，传入null数据库
      SmartFlowStrategyV3.init(null);

      // 验证模块仍然被初始化（使用null数据库）
      expect(StrategyV3Core).toHaveBeenCalledWith(null);
      expect(StrategyV3Execution).toHaveBeenCalledWith(null);
      expect(DataMonitor).toHaveBeenCalledWith(null);
    });

    test('应该处理undefined数据库参数', () => {
      // 调用init方法，传入undefined数据库
      SmartFlowStrategyV3.init(undefined);

      // 验证模块仍然被初始化（使用undefined数据库）
      expect(StrategyV3Core).toHaveBeenCalledWith(undefined);
      expect(StrategyV3Execution).toHaveBeenCalledWith(undefined);
      expect(DataMonitor).toHaveBeenCalledWith(undefined);
    });

    test('应该可以重复调用init方法', () => {
      const mockDatabase2 = { ...mockDatabase, id: 'db2' };

      // 第一次调用
      SmartFlowStrategyV3.init(mockDatabase);
      const firstCore = SmartFlowStrategyV3.core;
      const firstExecution = SmartFlowStrategyV3.execution;
      const firstDataMonitor = SmartFlowStrategyV3.dataMonitor;

      // 第二次调用
      SmartFlowStrategyV3.init(mockDatabase2);
      const secondCore = SmartFlowStrategyV3.core;
      const secondExecution = SmartFlowStrategyV3.execution;
      const secondDataMonitor = SmartFlowStrategyV3.dataMonitor;

      // 验证实例被重新创建
      expect(firstCore).not.toBe(secondCore);
      expect(firstExecution).not.toBe(secondExecution);
      expect(firstDataMonitor).not.toBe(secondDataMonitor);

      // 验证第二次调用使用了新的数据库
      expect(StrategyV3Core).toHaveBeenLastCalledWith(mockDatabase2);
      expect(StrategyV3Execution).toHaveBeenLastCalledWith(mockDatabase2);
      expect(DataMonitor).toHaveBeenLastCalledWith(mockDatabase2);
    });
  });

  describe('静态属性访问', () => {
    test('初始化后应该能够访问core属性', () => {
      SmartFlowStrategyV3.init(mockDatabase);
      
      expect(SmartFlowStrategyV3.core).toBeDefined();
      expect(SmartFlowStrategyV3.core).toBeInstanceOf(StrategyV3Core);
    });

    test('初始化后应该能够访问execution属性', () => {
      SmartFlowStrategyV3.init(mockDatabase);
      
      expect(SmartFlowStrategyV3.execution).toBeDefined();
      expect(SmartFlowStrategyV3.execution).toBeInstanceOf(StrategyV3Execution);
    });

    test('初始化后应该能够访问dataMonitor属性', () => {
      SmartFlowStrategyV3.init(mockDatabase);
      
      expect(SmartFlowStrategyV3.dataMonitor).toBeDefined();
      expect(SmartFlowStrategyV3.dataMonitor).toBeInstanceOf(DataMonitor);
    });
  });

  describe('错误处理', () => {
    test('应该处理StrategyV3Core构造函数错误', () => {
      // 重置mock
      StrategyV3Core.mockReset();
      StrategyV3Core.mockImplementation(() => {
        throw new Error('StrategyV3Core constructor error');
      });

      expect(() => {
        SmartFlowStrategyV3.init(mockDatabase);
      }).toThrow('StrategyV3Core constructor error');
    });

    test('应该处理StrategyV3Execution构造函数错误', () => {
      // 重置mock
      StrategyV3Core.mockReset();
      StrategyV3Execution.mockReset();
      StrategyV3Core.mockImplementation(() => ({}));
      StrategyV3Execution.mockImplementation(() => {
        throw new Error('StrategyV3Execution constructor error');
      });

      expect(() => {
        SmartFlowStrategyV3.init(mockDatabase);
      }).toThrow('StrategyV3Execution constructor error');
    });

    test('应该处理DataMonitor构造函数错误', () => {
      // 重置mock
      StrategyV3Core.mockReset();
      StrategyV3Execution.mockReset();
      DataMonitor.mockReset();
      StrategyV3Core.mockImplementation(() => ({}));
      StrategyV3Execution.mockImplementation(() => ({}));
      DataMonitor.mockImplementation(() => {
        throw new Error('DataMonitor constructor error');
      });

      expect(() => {
        SmartFlowStrategyV3.init(mockDatabase);
      }).toThrow('DataMonitor constructor error');
    });
  });
});
