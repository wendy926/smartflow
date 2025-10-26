/**
 * A股市场适配器
 * 实现A股市场交易接口，专注于指数交易
 * 不进行真实交易，仅模拟交易并记录到数据库
 */

const { IExchangeAdapter, MarketType, Timeframe, OrderSide, OrderType, OrderStatus, TimeInForce, MarketInfo, TradingHours, Kline, MarketMetrics, OrderRequest, OrderResponse, Account, Position } = require('../core/interfaces/IExchangeAdapter');
const { TushareAPI } = require('../api/cn-stock-api');
const logger = require('../utils/logger');

class ChinaStockAdapter extends IExchangeAdapter {
  constructor(config) {
    super();
    this.config = config;
    
    // 初始化Tushare API
    this.tushareAPI = new TushareAPI(config.tushare || {});
    
    // 市场信息 - A股交易时间
    this.marketInfo = new MarketInfo(
      MarketType.CN_STOCK,
      new TradingHours('Asia/Shanghai', [
        { open: '09:30', close: '11:30', days: [1, 2, 3, 4, 5] }, // 上午
        { open: '13:00', close: '15:00', days: [1, 2, 3, 4, 5] } // 下午
      ]),
      config.symbols || [
        '000300.SH', // 沪深300
        '000905.SH', // 中证500
        '000852.SH', // 中证1000
        '399001.SZ', // 深证成指
        '399006.SZ'  // 创业板指
      ],
      'Asia/Shanghai'
    );

    // 是否启用模拟交易
    this.simulationMode = config.simulationMode !== false; // 默认启用模拟模式
  }

  /**
   * 获取市场信息
   */
  getMarketInfo() {
    return this.marketInfo;
  }

  /**
   * 获取K线数据
   */
  async getKlines(symbol, timeframe, limit = 500) {
    try {
      if (!this.isSymbolSupported(symbol)) {
        throw new Error(`Symbol ${symbol} is not supported`);
      }

      // 计算日期范围
      const endDate = this.formatDate(new Date(), 'YYYYMMDD');
      const startDate = this.calculateStartDate(timeframe, limit);
      
      const data = await this.tushareAPI.getIndexDaily(symbol, startDate, endDate);
      
      // 转换数据格式
      const klines = data.map(item => new Kline(
        this.parseTushareDate(item.trade_date),
        parseFloat(item.open),
        parseFloat(item.high),
        parseFloat(item.low),
        parseFloat(item.close),
        parseFloat(item.vol || 0),
        symbol,
        timeframe,
        MarketType.CN_STOCK
      ));

      return klines.slice(-limit);
    } catch (error) {
      logger.error(`获取K线数据失败: ${symbol}, ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取实时行情
   */
  async getTicker(symbol) {
    try {
      if (!this.isSymbolSupported(symbol)) {
        throw new Error(`Symbol ${symbol} is not supported`);
      }

      // Tushare需要通过指数基本信息获取
      const basicInfo = await this.tushareAPI.getIndexBasic(symbol);
      if (!basicInfo || basicInfo.length === 0) {
        throw new Error(`无法获取指数基本信息: ${symbol}`);
      }

      // 获取最新交易数据
      const endDate = this.formatDate(new Date(), 'YYYYMMDD');
      const latestData = await this.tushareAPI.getIndexDaily(symbol, null, endDate);
      
      if (!latestData || latestData.length === 0) {
        throw new Error(`无法获取最新行情: ${symbol}`);
      }

      const lastBar = latestData[0];
      
      return {
        symbol: symbol,
        price: parseFloat(lastBar.close),
        change: parseFloat(lastBar.change || 0),
        changePercent: parseFloat(lastBar.pct_chg || 0),
        volume: parseFloat(lastBar.vol || 0),
        amount: parseFloat(lastBar.amount || 0),
        timestamp: this.parseTushareDate(lastBar.trade_date)
      };
    } catch (error) {
      logger.error(`获取实时行情失败: ${symbol}, ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取订单簿（A股指数不提供深度数据）
   */
  async getOrderBook(symbol) {
    throw new Error('A股指数不支持订单簿数据');
  }

  /**
   * 下单 - 仅模拟交易
   */
  async placeOrder(orderRequest) {
    try {
      if (!this.simulationMode) {
        throw new Error('A股适配器仅支持模拟交易模式');
      }

      // 模拟订单生成
      const orderResponse = new OrderResponse(
        `SIM_${Date.now()}`,
        orderRequest.symbol,
        OrderStatus.FILLED,
        orderRequest.quantity,
        await this.getTicker(orderRequest.symbol).then(t => t.price),
        new Date()
      );

      logger.info(`模拟订单创建成功: ${JSON.stringify(orderResponse)}`);
      
      // 这里应该将交易记录写入数据库
      // await this.saveTradeToDatabase(orderResponse);

      return orderResponse;
    } catch (error) {
      logger.error(`下单失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 取消订单（模拟）
   */
  async cancelOrder(orderId) {
    logger.warn(`模拟交易不支持取消订单: ${orderId}`);
    return false;
  }

  /**
   * 获取订单列表（模拟）
   */
  async getOrders(symbol) {
    logger.warn(`模拟交易不支持获取订单列表`);
    return [];
  }

  /**
   * 获取账户信息（模拟）
   */
  async getAccount() {
    // 返回模拟账户信息
    return new Account(
      'SIM_ACCOUNT',
      1000000, // 100万模拟资金
      'CNY',
      MarketType.CN_STOCK
    );
  }

  /**
   * 获取持仓（模拟）
   */
  async getPositions(symbol) {
    // 从数据库查询模拟持仓
    return [];
  }

  /**
   * 获取市场指标
   */
  async getMarketMetrics(symbol) {
    try {
      const [ticker, basic] = await Promise.all([
        this.getTicker(symbol),
        this.tushareAPI.getIndexBasic(symbol)
      ]);

      const basicInfo = basic && basic.length > 0 ? basic[0] : null;

      return new MarketMetrics(
        ticker.volume,
        ticker.amount,
        // A股特有指标
        basicInfo ? {
          pb: basicInfo.pb,
          pe: basicInfo.pe,
          totalMv: basicInfo.total_mv,
          floatMv: basicInfo.float_mv
        } : {}
      );
    } catch (error) {
      logger.error(`获取市场指标失败: ${symbol}, ${error.message}`);
      throw error;
    }
  }

  /**
   * 转换时间框架
   */
  convertTimeframe(timeframe) {
    const tfMap = {
      '1m': '1min',
      '5m': '5min',
      '15m': '15min',
      '30m': '30min',
      '1h': '60min',
      '1d': 'daily'
    };
    return tfMap[timeframe] || timeframe;
  }

  /**
   * 计算开始日期
   */
  calculateStartDate(timeframe, limit) {
    const days = {
      '1m': limit / (60 * 24),
      '5m': limit / (12 * 24),
      '15m': limit / (4 * 24),
      '30m': limit / (2 * 24),
      '1h': limit / 24,
      '1d': limit
    };

    const daysToSubtract = days[timeframe] || limit;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToSubtract);
    return this.formatDate(startDate, 'YYYYMMDD');
  }

  /**
   * 格式化日期
   */
  formatDate(date, format) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    if (format === 'YYYYMMDD') {
      return `${year}${month}${day}`;
    }
    return date;
  }

  /**
   * 解析Tushare日期
   */
  parseTushareDate(dateStr) {
    // 格式: '20250126'
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    return new Date(year, month, day);
  }

  /**
   * 检查交易时间
   */
  isTradingTime() {
    const now = new Date();
    const chinaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
    const hour = chinaTime.getHours();
    const minute = chinaTime.getMinutes();
    const day = chinaTime.getDay();

    // 周一到周五
    if (day < 1 || day > 5) {
      return false;
    }

    // 上午: 09:30 - 11:30
    if ((hour === 9 && minute >= 30) || hour === 10 || (hour === 11 && minute <= 30)) {
      return true;
    }

    // 下午: 13:00 - 15:00
    if (hour >= 13 && hour < 15) {
      return true;
    }

    return false;
  }
}

module.exports = ChinaStockAdapter;
