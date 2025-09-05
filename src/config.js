/**
 * SmartFlow 策略配置文件
 * 集中管理所有策略参数，便于调整和优化
 */

export const STRATEGY_CONFIG = {
  // 系统基本信息
  system: {
    name: "SmartFlow_v1",
    version: "1.0.0",
    description: "多周期共振高胜率高盈亏比交易策略"
  },

  // 监控的交易对
  symbols: ["BTCUSDT", "ETHUSDT", "LINKUSDT", "LDOUSDT"],

  // 时间周期配置
  timeframes: {
    trend: "1d",      // 日线趋势
    confirm: "1h",    // 小时确认
    execute: "15m"    // 15分钟执行
  },

  // 日线趋势过滤参数
  trendFilter: {
    // 移动平均线参数
    ma: {
      fast: 20,
      medium: 50,
      slow: 200
    },
    // 资金费率阈值（绝对值）
    fundingRateMax: 0.001,  // 0.1%
    // OI变化阈值（百分比）
    oiChangeThreshold: 0.02,  // 2%
    // OI回看小时数
    oiLookbackHours: 6
  },

  // 小时确认参数
  hourlyConfirmation: {
    // 突破回看K线数
    breakoutBars: 20,
    // 成交量倍数阈值
    volumeMultiple: 1.5,
    // 成交量SMA周期
    volumeSmaPeriod: 20,
    // 是否要求VWAP确认
    vwapRequired: true,
    // CVD确认要求
    cvdRequired: true
  },

  // 15分钟执行参数
  execution: {
    // ATR周期
    atrPeriod: 14,
    // ATR止损倍数
    atrStopMultiple: 1.2,
    // 盈亏比目标
    riskRewardRatio: 2.0,
    // EMA回踩确认
    ema: {
      fast: 20,
      slow: 50
    }
  },

  // 风险管理参数
  riskManagement: {
    // 单笔风险比例
    riskPerTrade: 0.01,  // 1%
    // 最大同时持仓数
    maxConcurrentPositions: 3,
    // 日损限制（R倍数）
    maxDailyLoss: -3,
    // 时间止损（小时）
    timeStopHours: 8,
    // 最小盈利要求（R倍数）
    minProfitRequirement: 0.5
  },

  // 持仓管理参数
  positionManagement: {
    // 保本移动（R倍数）
    breakevenAt: 1.0,
    // 部分止盈（R倍数）
    partialTakeAt: 1.5,
    // 部分止盈比例
    partialTakeRatio: 0.3,  // 30%
    // 追踪止盈启动（R倍数）
    trailingStartAt: 2.0,
    // 追踪止盈倍数（ATR倍数）
    trailingMultiple: 1.5
  },

  // 硬退出条件
  hardExit: {
    // OI回落阈值
    oiDeclineThreshold: 0.03,  // 3%
    // CVD背离要求
    cvdDivergenceRequired: true
  },

  // API配置
  api: {
    // Binance API基础URL
    binanceBaseUrl: "https://fapi.binance.com",
    // WebSocket基础URL
    wsBaseUrl: "wss://fstream.binance.com/ws",
    // 请求超时时间（毫秒）
    timeout: 10000,
    // 重试次数
    retryAttempts: 3,
    // 重试延迟（毫秒）
    retryDelay: 1000
  },

  // 日志配置
  logging: {
    // 日志级别
    level: "INFO",  // DEBUG, INFO, WARN, ERROR
    // 是否保存到KV
    saveToKV: true,
    // 日志保留天数
    retentionDays: 30
  },

  // 通知配置
  notifications: {
    // Telegram配置
    telegram: {
      enabled: true,
      // 信号通知
      signalAlerts: true,
      // 错误通知
      errorAlerts: true,
      // 每日摘要
      dailySummary: true
    }
  }
};

// 信号类型枚举
export const SIGNAL_TYPES = {
  NO_SIGNAL: "NO_SIGNAL",
  LONG_SIGNAL: "LONG_SIGNAL", 
  SHORT_SIGNAL: "SHORT_SIGNAL",
  ERROR: "ERROR"
};

// 趋势类型枚举
export const TREND_TYPES = {
  UPTREND: "UPTREND",
  DOWNTREND: "DOWNTREND", 
  RANGE: "RANGE",
  ERROR: "ERROR"
};

// CVD方向枚举
export const CVD_DIRECTIONS = {
  BULLISH: "BULLISH",    // 买盘主导
  BEARISH: "BEARISH",    // 卖盘主导
  NEUTRAL: "NEUTRAL",    // 平衡
  INACTIVE: "INACTIVE"   // 不活跃
};

// 获取配置值的辅助函数
export function getConfig(path, defaultValue = null) {
  const keys = path.split('.');
  let value = STRATEGY_CONFIG;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return defaultValue;
    }
  }
  
  return value;
}

// 验证配置的辅助函数
export function validateConfig() {
  const errors = [];
  
  // 检查必要的配置
  if (!STRATEGY_CONFIG.symbols || STRATEGY_CONFIG.symbols.length === 0) {
    errors.push("监控交易对不能为空");
  }
  
  if (STRATEGY_CONFIG.riskManagement.riskPerTrade <= 0 || STRATEGY_CONFIG.riskManagement.riskPerTrade > 0.1) {
    errors.push("单笔风险比例应在0-10%之间");
  }
  
  if (STRATEGY_CONFIG.execution.riskRewardRatio < 1.0) {
    errors.push("盈亏比应大于等于1.0");
  }
  
  if (STRATEGY_CONFIG.trendFilter.fundingRateMax <= 0) {
    errors.push("资金费率阈值应大于0");
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// 导出默认配置
export default STRATEGY_CONFIG;
