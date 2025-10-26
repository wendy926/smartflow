# 通用交易系统架构设计方案

**日期**: 2025-07-07  
**版本**: v3.0.0  
**设计范围**: 多市场交易系统 + AI模块解耦 + 跨机房部署

---

## 📋 系统架构概览

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端层 (Web UI)                          │
│                    React/Vue + WebSocket                      │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                      API网关层 (API Gateway)                    │
│              Nginx + Load Balancer + Rate Limiting             │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                      微服务层 (Microservices)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │  交易服务   │  │  AI服务     │  │  数据服务   │  │  通知服务   │ │
│  │ Trading     │  │ AI Agent    │  │ Data        │  │ Notification│ │
│  │ Service     │  │ Service     │  │ Service     │  │ Service     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                      核心引擎层 (Core Engines)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │  策略引擎   │  │  风险管理   │  │  回测引擎   │  │  订单管理   │ │
│  │ Strategy    │  │ Risk        │  │ Backtest    │  │ Order       │ │
│  │ Engine      │  │ Manager      │  │ Engine      │  │ Manager     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                      适配器层 (Adapters)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ Binance     │  │ A股适配器   │  │ 美股适配器   │  │ 数据适配器   │ │
│  │ Adapter     │  │ CN Stock    │  │ US Stock    │  │ Data        │ │
│  │             │  │ Adapter     │  │ Adapter     │  │ Adapter     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                      数据层 (Data Layer)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ MySQL        │  │ Redis       │  │ InfluxDB     │  │ MongoDB      │ │
│  │ (交易数据)   │  │ (缓存)      │  │ (时序数据)   │  │ (日志数据)   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ 核心架构设计

### 1. 通用交易系统核心

#### 1.1 市场抽象接口

```typescript
// src/core/interfaces/IMarket.ts
interface IMarket {
  readonly marketType: MarketType;
  readonly tradingHours: TradingHours;
  readonly symbols: string[];
  readonly timezone: string;
}

interface IExchangeAdapter {
  readonly market: IMarket;
  
  // 基础数据接口
  getKlines(symbol: string, timeframe: Timeframe, limit?: number): Promise<Kline[]>;
  getTicker(symbol: string): Promise<Ticker>;
  getOrderBook(symbol: string): Promise<OrderBook>;
  
  // 交易接口
  placeOrder(order: OrderRequest): Promise<OrderResponse>;
  cancelOrder(orderId: string): Promise<boolean>;
  getOrders(symbol?: string): Promise<Order[]>;
  
  // 账户接口
  getAccount(): Promise<Account>;
  getPositions(symbol?: string): Promise<Position[]>;
  
  // 市场特定数据
  getMarketMetrics(symbol: string): Promise<MarketMetrics>;
}

enum MarketType {
  CRYPTO = 'crypto',
  CN_STOCK = 'cn_stock', 
  US_STOCK = 'us_stock'
}

interface TradingHours {
  timezone: string;
  sessions: TradingSession[];
}

interface TradingSession {
  open: string;  // "09:30"
  close: string; // "15:00"
  days: number[]; // [1,2,3,4,5] 周一到周五
}
```

#### 1.2 统一数据模型

```typescript
// src/core/models/MarketData.ts
interface Kline {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  symbol: string;
  timeframe: Timeframe;
  marketType: MarketType;
}

interface MarketMetrics {
  // 通用指标
  volume: number;
  turnover?: number;
  
  // 加密货币特有
  fundingRate?: number;
  openInterest?: number;
  delta?: number;
  liquidation?: LiquidationData;
  
  // A股特有
  financingBalance?: number;
  northwardFunds?: number;
  volumeRatio?: number;
  peRatio?: number;
  
  // 美股特有
  putCallRatio?: number;
  optionOIChange?: number;
  institutionalFlow?: number;
  vixIndex?: number;
  shortInterest?: number;
}

interface OrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP';
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
}

interface OrderResponse {
  orderId: string;
  symbol: string;
  status: 'NEW' | 'FILLED' | 'CANCELLED' | 'REJECTED';
  filledQuantity: number;
  avgPrice?: number;
  timestamp: Date;
}
```

### 2. 市场适配器实现

#### 2.1 Binance适配器 (SG机房)

```typescript
// src/adapters/BinanceAdapter.ts
export class BinanceAdapter implements IExchangeAdapter {
  readonly market: IMarket = {
    marketType: MarketType.CRYPTO,
    tradingHours: {
      timezone: 'UTC',
      sessions: [{ open: '00:00', close: '23:59', days: [0,1,2,3,4,5,6] }]
    },
    symbols: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'],
    timezone: 'UTC'
  };

  private api: BinanceAPI;
  private ws: BinanceWebSocket;

  constructor(config: BinanceConfig) {
    this.api = new BinanceAPI(config);
    this.ws = new BinanceWebSocket(config);
  }

  async getKlines(symbol: string, timeframe: Timeframe, limit = 500): Promise<Kline[]> {
    const data = await this.api.getKlines(symbol, timeframe, limit);
    return data.map(k => ({
      timestamp: new Date(k[0]),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      symbol,
      timeframe,
      marketType: MarketType.CRYPTO
    }));
  }

  async getMarketMetrics(symbol: string): Promise<MarketMetrics> {
    const [fundingRate, openInterest, ticker] = await Promise.all([
      this.api.getFundingRate(symbol),
      this.api.getOpenInterest(symbol),
      this.api.getTicker24hr(symbol)
    ]);

    return {
      volume: parseFloat(ticker.volume),
      fundingRate: parseFloat(fundingRate.lastFundingRate),
      openInterest: parseFloat(openInterest.openInterest),
      delta: parseFloat(ticker.delta || 0)
    };
  }

  async placeOrder(order: OrderRequest): Promise<OrderResponse> {
    const response = await this.api.placeOrder({
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      quantity: order.quantity,
      price: order.price,
      timeInForce: order.timeInForce
    });

    return {
      orderId: response.orderId,
      symbol: order.symbol,
      status: response.status as any,
      filledQuantity: parseFloat(response.executedQty),
      avgPrice: parseFloat(response.avgPrice || 0),
      timestamp: new Date(response.transactTime)
    };
  }
}
```

#### 2.2 A股适配器 (CN机房)

```typescript
// src/adapters/ChinaStockAdapter.ts
export class ChinaStockAdapter implements IExchangeAdapter {
  readonly market: IMarket = {
    marketType: MarketType.CN_STOCK,
    tradingHours: {
      timezone: 'Asia/Shanghai',
      sessions: [
        { open: '09:30', close: '11:30', days: [1,2,3,4,5] },
        { open: '13:00', close: '15:00', days: [1,2,3,4,5] }
      ]
    },
    symbols: ['000001.SZ', '600000.SH', '000002.SZ'],
    timezone: 'Asia/Shanghai'
  };

  private tushareAPI: TushareAPI;
  private efinanceAPI: EFinanceAPI;

  constructor(config: ChinaStockConfig) {
    this.tushareAPI = new TushareAPI(config.tushare);
    this.efinanceAPI = new EFinanceAPI(config.efinance);
  }

  async getKlines(symbol: string, timeframe: Timeframe, limit = 500): Promise<Kline[]> {
    const data = await this.tushareAPI.getKlines(symbol, timeframe, limit);
    return data.map(k => ({
      timestamp: new Date(k.trade_date),
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
      volume: k.vol,
      symbol,
      timeframe,
      marketType: MarketType.CN_STOCK
    }));
  }

  async getMarketMetrics(symbol: string): Promise<MarketMetrics> {
    const [financing, northward, basic] = await Promise.all([
      this.tushareAPI.getFinancingBalance(symbol),
      this.efinanceAPI.getNorthwardFunds(),
      this.tushareAPI.getStockBasic(symbol)
    ]);

    return {
      volume: basic.volume,
      turnover: basic.turnover,
      financingBalance: financing.balance,
      northwardFunds: northward.netInflow,
      volumeRatio: basic.volume / basic.avgVolume,
      peRatio: basic.pe
    };
  }

  async placeOrder(order: OrderRequest): Promise<OrderResponse> {
    // A股交易需要通过券商API
    const response = await this.brokerAPI.placeOrder({
      symbol: order.symbol,
      side: order.side,
      quantity: order.quantity,
      price: order.price,
      orderType: order.type
    });

    return {
      orderId: response.orderId,
      symbol: order.symbol,
      status: response.status,
      filledQuantity: response.filledQuantity,
      avgPrice: response.avgPrice,
      timestamp: new Date(response.timestamp)
    };
  }
}
```

#### 2.3 美股适配器 (SG机房)

```typescript
// src/adapters/USStockAdapter.ts
export class USStockAdapter implements IExchangeAdapter {
  readonly market: IMarket = {
    marketType: MarketType.US_STOCK,
    tradingHours: {
      timezone: 'America/New_York',
      sessions: [
        { open: '09:30', close: '16:00', days: [1,2,3,4,5] }
      ]
    },
    symbols: ['AAPL', 'MSFT', 'GOOGL'],
    timezone: 'America/New_York'
  };

  private alpacaAPI: AlpacaAPI;
  private alphaVantageAPI: AlphaVantageAPI;

  constructor(config: USStockConfig) {
    this.alpacaAPI = new AlpacaAPI(config.alpaca);
    this.alphaVantageAPI = new AlphaVantageAPI(config.alphaVantage);
  }

  async getKlines(symbol: string, timeframe: Timeframe, limit = 500): Promise<Kline[]> {
    const data = await this.alpacaAPI.getBars(symbol, timeframe, limit);
    return data.map(bar => ({
      timestamp: new Date(bar.t),
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
      symbol,
      timeframe,
      marketType: MarketType.US_STOCK
    }));
  }

  async getMarketMetrics(symbol: string): Promise<MarketMetrics> {
    const [options, institutional, vix] = await Promise.all([
      this.alphaVantageAPI.getOptionsData(symbol),
      this.alphaVantageAPI.getInstitutionalFlow(symbol),
      this.alphaVantageAPI.getVIX()
    ]);

    return {
      volume: options.volume,
      putCallRatio: options.putCallRatio,
      optionOIChange: options.oiChange,
      institutionalFlow: institutional.netFlow,
      vixIndex: vix.value,
      shortInterest: options.shortInterest
    };
  }

  async placeOrder(order: OrderRequest): Promise<OrderResponse> {
    const response = await this.alpacaAPI.placeOrder({
      symbol: order.symbol,
      qty: order.quantity,
      side: order.side.toLowerCase(),
      type: order.type.toLowerCase(),
      limit_price: order.price,
      stop_price: order.stopPrice,
      time_in_force: order.timeInForce?.toLowerCase()
    });

    return {
      orderId: response.id,
      symbol: order.symbol,
      status: response.status.toUpperCase(),
      filledQuantity: parseFloat(response.filled_qty || 0),
      avgPrice: parseFloat(response.filled_avg_price || 0),
      timestamp: new Date(response.created_at)
    };
  }
}
```

### 3. AI模块解耦设计

#### 3.1 AI服务独立架构

```typescript
// src/services/ai/AIService.ts
interface IAIService {
  readonly provider: AIProvider;
  readonly model: string;
  readonly region: 'SG' | 'CN';
  
  analyzeMarket(marketData: MarketData[]): Promise<MarketAnalysis>;
  generateSignal(strategy: string, context: AnalysisContext): Promise<TradingSignal>;
  assessRisk(portfolio: Portfolio): Promise<RiskAssessment>;
  optimizeParameters(strategy: string, history: BacktestResult[]): Promise<OptimizedParameters>;
}

enum AIProvider {
  CLAUDE = 'claude',
  DEEPSEEK = 'deepseek',
  OPENAI = 'openai'
}

interface MarketAnalysis {
  trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
  strength: number; // 0-100
  confidence: number; // 0-100
  factors: AnalysisFactor[];
  recommendation: string;
}

interface TradingSignal {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  expectedReturn: number;
  stopLoss?: number;
  takeProfit?: number;
}
```

#### 3.2 AI服务实现

```typescript
// src/services/ai/ClaudeAIService.ts (SG机房)
export class ClaudeAIService implements IAIService {
  readonly provider = AIProvider.CLAUDE;
  readonly model = 'claude-3.5-sonnet';
  readonly region = 'SG';

  private client: AnthropicClient;

  constructor(config: ClaudeConfig) {
    this.client = new AnthropicClient({
      apiKey: config.apiKey,
      baseURL: config.baseURL || 'https://api.anthropic.com'
    });
  }

  async analyzeMarket(marketData: MarketData[]): Promise<MarketAnalysis> {
    const prompt = this.buildMarketAnalysisPrompt(marketData);
    
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    return this.parseMarketAnalysis(response.content[0].text);
  }

  async generateSignal(strategy: string, context: AnalysisContext): Promise<TradingSignal> {
    const prompt = this.buildSignalGenerationPrompt(strategy, context);
    
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    });

    return this.parseTradingSignal(response.content[0].text);
  }

  private buildMarketAnalysisPrompt(marketData: MarketData[]): string {
    return `
作为专业的量化交易分析师，请分析以下市场数据：

${JSON.stringify(marketData.slice(-50), null, 2)}

请提供：
1. 市场趋势判断 (BULLISH/BEARISH/SIDEWAYS)
2. 趋势强度 (0-100)
3. 分析置信度 (0-100)
4. 关键影响因素
5. 交易建议

请以JSON格式返回分析结果。
    `;
  }
}

// src/services/ai/DeepSeekAIService.ts (CN机房)
export class DeepSeekAIService implements IAIService {
  readonly provider = AIProvider.DEEPSEEK;
  readonly model = 'deepseek-chat';
  readonly region = 'CN';

  private client: DeepSeekClient;

  constructor(config: DeepSeekConfig) {
    this.client = new DeepSeekClient({
      apiKey: config.apiKey,
      baseURL: config.baseURL || 'https://api.deepseek.com'
    });
  }

  async analyzeMarket(marketData: MarketData[]): Promise<MarketAnalysis> {
    // 针对A股市场优化的分析逻辑
    const prompt = this.buildChinaStockAnalysisPrompt(marketData);
    
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000
    });

    return this.parseMarketAnalysis(response.choices[0].message.content);
  }

  private buildChinaStockAnalysisPrompt(marketData: MarketData[]): string {
    return `
作为A股市场专业分析师，请分析以下市场数据：

${JSON.stringify(marketData.slice(-50), null, 2)}

请特别关注：
1. 北向资金流向
2. 融资融券余额变化
3. 政策面影响
4. 技术面指标
5. 市场情绪

请以JSON格式返回分析结果。
    `;
  }
}
```

### 4. 跨机房通信机制

#### 4.1 消息队列架构

```typescript
// src/infrastructure/MessagingService.ts
interface IMessagingService {
  publish(topic: string, message: any): Promise<void>;
  subscribe(topic: string, handler: MessageHandler): Promise<void>;
  request(topic: string, data: any, timeout?: number): Promise<any>;
}

interface MessageHandler {
  (message: any): Promise<void>;
}

// Redis Streams实现
export class RedisMessagingService implements IMessagingService {
  private redis: Redis;
  private consumers: Map<string, MessageHandler> = new Map();

  constructor(config: RedisConfig) {
    this.redis = new Redis(config);
  }

  async publish(topic: string, message: any): Promise<void> {
    await this.redis.xadd(topic, '*', 'data', JSON.stringify(message));
  }

  async subscribe(topic: string, handler: MessageHandler): Promise<void> {
    this.consumers.set(topic, handler);
    
    // 启动消费者
    this.startConsumer(topic, handler);
  }

  async request(topic: string, data: any, timeout = 5000): Promise<any> {
    const requestId = generateUUID();
    const responseTopic = `${topic}.response.${requestId}`;
    
    // 发送请求
    await this.publish(topic, {
      requestId,
      responseTopic,
      data,
      timestamp: Date.now()
    });

    // 等待响应
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, timeout);

      this.subscribe(responseTopic, (message) => {
        clearTimeout(timeoutId);
        resolve(message.data);
      });
    });
  }

  private async startConsumer(topic: string, handler: MessageHandler): Promise<void> {
    const consumerGroup = `${topic}.group`;
    const consumerName = `${topic}.consumer.${process.pid}`;

    try {
      await this.redis.xgroup('CREATE', topic, consumerGroup, '$', 'MKSTREAM');
    } catch (error) {
      // Group already exists
    }

    while (true) {
      try {
        const messages = await this.redis.xreadgroup(
          'GROUP', consumerGroup, consumerName,
          'COUNT', 1,
          'BLOCK', 1000,
          'STREAMS', topic, '>'
        );

        if (messages && messages.length > 0) {
          for (const [stream, streamMessages] of messages) {
            for (const [id, fields] of streamMessages) {
              const message = JSON.parse(fields.data);
              await handler(message);
              await this.redis.xack(topic, consumerGroup, id);
            }
          }
        }
      } catch (error) {
        console.error('Consumer error:', error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
}
```

#### 4.2 数据同步服务

```typescript
// src/services/DataSyncService.ts
export class DataSyncService {
  private messaging: IMessagingService;
  private adapters: Map<MarketType, IExchangeAdapter>;

  constructor(messaging: IMessagingService, adapters: Map<MarketType, IExchangeAdapter>) {
    this.messaging = messaging;
    this.adapters = adapters;
  }

  async start(): Promise<void> {
    // 订阅跨机房数据同步消息
    await this.messaging.subscribe('data.sync.request', this.handleDataSyncRequest.bind(this));
    await this.messaging.subscribe('data.sync.response', this.handleDataSyncResponse.bind(this));
    
    // 启动定时数据同步
    this.startPeriodicSync();
  }

  private async handleDataSyncRequest(message: any): Promise<void> {
    const { marketType, symbol, timeframe, from, to } = message;
    
    try {
      const adapter = this.adapters.get(marketType);
      if (!adapter) {
        throw new Error(`No adapter for market type: ${marketType}`);
      }

      const data = await adapter.getKlines(symbol, timeframe);
      const filteredData = data.filter(k => 
        k.timestamp >= new Date(from) && k.timestamp <= new Date(to)
      );

      await this.messaging.publish('data.sync.response', {
        requestId: message.requestId,
        data: filteredData,
        success: true
      });
    } catch (error) {
      await this.messaging.publish('data.sync.response', {
        requestId: message.requestId,
        error: error.message,
        success: false
      });
    }
  }

  private async startPeriodicSync(): Promise<void> {
    setInterval(async () => {
      // 同步关键市场数据
      const syncTasks = [
        this.syncCryptoData(),
        this.syncStockData()
      ];

      await Promise.allSettled(syncTasks);
    }, 60000); // 每分钟同步一次
  }

  private async syncCryptoData(): Promise<void> {
    // SG机房 -> CN机房 同步加密货币数据
    const cryptoAdapter = this.adapters.get(MarketType.CRYPTO);
    if (cryptoAdapter) {
      const data = await cryptoAdapter.getKlines('BTCUSDT', '1h', 24);
      await this.messaging.publish('data.crypto.update', {
        marketType: MarketType.CRYPTO,
        data,
        timestamp: Date.now()
      });
    }
  }

  private async syncStockData(): Promise<void> {
    // CN机房 -> SG机房 同步A股数据
    const cnStockAdapter = this.adapters.get(MarketType.CN_STOCK);
    if (cnStockAdapter) {
      const data = await cnStockAdapter.getKlines('000001.SZ', '1h', 24);
      await this.messaging.publish('data.stock.update', {
        marketType: MarketType.CN_STOCK,
        data,
        timestamp: Date.now()
      });
    }
  }
}
```

### 5. 统一配置管理

#### 5.1 多环境配置

```typescript
// src/config/ConfigManager.ts
interface SystemConfig {
  environment: 'development' | 'staging' | 'production';
  region: 'SG' | 'CN';
  
  // 数据库配置
  database: {
    mysql: MySQLConfig;
    redis: RedisConfig;
    influxdb?: InfluxDBConfig;
    mongodb?: MongoDBConfig;
  };
  
  // 市场配置
  markets: {
    crypto: MarketConfig;
    cnStock: MarketConfig;
    usStock: MarketConfig;
  };
  
  // AI服务配置
  ai: {
    providers: {
      claude: ClaudeConfig;
      deepseek: DeepSeekConfig;
    };
    defaultProvider: AIProvider;
  };
  
  // 消息队列配置
  messaging: {
    redis: RedisConfig;
    topics: string[];
  };
  
  // 监控配置
  monitoring: {
    prometheus: PrometheusConfig;
    grafana: GrafanaConfig;
  };
}

// SG机房配置
const sgConfig: SystemConfig = {
  environment: 'production',
  region: 'SG',
  
  database: {
    mysql: {
      host: 'sg-mysql-cluster.internal',
      port: 3306,
      database: 'trading_sg',
      username: 'trading_user',
      password: process.env.MYSQL_PASSWORD
    },
    redis: {
      host: 'sg-redis-cluster.internal',
      port: 6379,
      password: process.env.REDIS_PASSWORD
    }
  },
  
  markets: {
    crypto: {
      enabled: true,
      adapter: 'BinanceAdapter',
      symbols: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'],
      tradingHours: '24/7'
    },
    usStock: {
      enabled: true,
      adapter: 'USStockAdapter',
      symbols: ['AAPL', 'MSFT', 'GOOGL'],
      tradingHours: '09:30-16:00 ET'
    },
    cnStock: {
      enabled: false, // SG机房不直接交易A股
      adapter: 'ChinaStockAdapter'
    }
  },
  
  ai: {
    providers: {
      claude: {
        apiKey: process.env.CLAUDE_API_KEY,
        baseURL: 'https://api.anthropic.com',
        model: 'claude-3.5-sonnet'
      },
      deepseek: {
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: 'https://api.deepseek.com',
        model: 'deepseek-chat'
      }
    },
    defaultProvider: AIProvider.CLAUDE
  },
  
  messaging: {
    redis: {
      host: 'sg-redis-cluster.internal',
      port: 6379,
      password: process.env.REDIS_PASSWORD
    },
    topics: [
      'data.sync.request',
      'data.sync.response',
      'ai.analysis.request',
      'ai.analysis.response',
      'trading.signal',
      'risk.alert'
    ]
  }
};

// CN机房配置
const cnConfig: SystemConfig = {
  environment: 'production',
  region: 'CN',
  
  database: {
    mysql: {
      host: 'cn-mysql-cluster.internal',
      port: 3306,
      database: 'trading_cn',
      username: 'trading_user',
      password: process.env.MYSQL_PASSWORD
    },
    redis: {
      host: 'cn-redis-cluster.internal',
      port: 6379,
      password: process.env.REDIS_PASSWORD
    }
  },
  
  markets: {
    crypto: {
      enabled: false, // CN机房不直接交易加密货币
      adapter: 'BinanceAdapter'
    },
    usStock: {
      enabled: false, // CN机房不直接交易美股
      adapter: 'USStockAdapter'
    },
    cnStock: {
      enabled: true,
      adapter: 'ChinaStockAdapter',
      symbols: ['000001.SZ', '600000.SH', '000002.SZ'],
      tradingHours: '09:30-11:30,13:00-15:00'
    }
  },
  
  ai: {
    providers: {
      deepseek: {
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: 'https://api.deepseek.com',
        model: 'deepseek-chat'
      }
    },
    defaultProvider: AIProvider.DEEPSEEK
  },
  
  messaging: {
    redis: {
      host: 'cn-redis-cluster.internal',
      port: 6379,
      password: process.env.REDIS_PASSWORD
    },
    topics: [
      'data.sync.request',
      'data.sync.response',
      'ai.analysis.request',
      'ai.analysis.response',
      'trading.signal',
      'risk.alert'
    ]
  }
};

export class ConfigManager {
  private static instance: ConfigManager;
  private config: SystemConfig;

  private constructor() {
    this.loadConfig();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadConfig(): void {
    const region = process.env.REGION as 'SG' | 'CN';
    
    switch (region) {
      case 'SG':
        this.config = sgConfig;
        break;
      case 'CN':
        this.config = cnConfig;
        break;
      default:
        throw new Error(`Unsupported region: ${region}`);
    }
  }

  getConfig(): SystemConfig {
    return this.config;
  }

  getMarketConfig(marketType: MarketType): MarketConfig {
    switch (marketType) {
      case MarketType.CRYPTO:
        return this.config.markets.crypto;
      case MarketType.CN_STOCK:
        return this.config.markets.cnStock;
      case MarketType.US_STOCK:
        return this.config.markets.usStock;
      default:
        throw new Error(`Unsupported market type: ${marketType}`);
    }
  }

  getAIProvider(provider: AIProvider): any {
    return this.config.ai.providers[provider];
  }
}
```

### 6. 服务启动和部署

#### 6.1 主服务启动器

```typescript
// src/Application.ts
export class TradingSystemApplication {
  private config: SystemConfig;
  private adapters: Map<MarketType, IExchangeAdapter>;
  private aiService: IAIService;
  private messagingService: IMessagingService;
  private dataSyncService: DataSyncService;

  async start(): Promise<void> {
    console.log(`🚀 Starting Trading System in ${this.config.region} region...`);
    
    // 1. 初始化配置
    this.config = ConfigManager.getInstance().getConfig();
    
    // 2. 初始化数据库连接
    await this.initializeDatabase();
    
    // 3. 初始化消息队列
    await this.initializeMessaging();
    
    // 4. 初始化市场适配器
    await this.initializeAdapters();
    
    // 5. 初始化AI服务
    await this.initializeAIService();
    
    // 6. 初始化数据同步服务
    await this.initializeDataSync();
    
    // 7. 启动核心服务
    await this.startCoreServices();
    
    console.log('✅ Trading System started successfully!');
  }

  private async initializeAdapters(): Promise<void> {
    this.adapters = new Map();
    
    // 根据配置初始化适配器
    if (this.config.markets.crypto.enabled) {
      const binanceAdapter = new BinanceAdapter(this.config.markets.crypto);
      this.adapters.set(MarketType.CRYPTO, binanceAdapter);
    }
    
    if (this.config.markets.cnStock.enabled) {
      const cnStockAdapter = new ChinaStockAdapter(this.config.markets.cnStock);
      this.adapters.set(MarketType.CN_STOCK, cnStockAdapter);
    }
    
    if (this.config.markets.usStock.enabled) {
      const usStockAdapter = new USStockAdapter(this.config.markets.usStock);
      this.adapters.set(MarketType.US_STOCK, usStockAdapter);
    }
  }

  private async initializeAIService(): Promise<void> {
    const provider = this.config.ai.defaultProvider;
    const providerConfig = this.config.ai.providers[provider];
    
    switch (provider) {
      case AIProvider.CLAUDE:
        this.aiService = new ClaudeAIService(providerConfig);
        break;
      case AIProvider.DEEPSEEK:
        this.aiService = new DeepSeekAIService(providerConfig);
        break;
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }

  private async startCoreServices(): Promise<void> {
    // 启动策略引擎
    const strategyEngine = new StrategyEngine(this.adapters, this.aiService);
    await strategyEngine.start();
    
    // 启动风险管理
    const riskManager = new RiskManager(this.adapters);
    await riskManager.start();
    
    // 启动回测引擎
    const backtestEngine = new BacktestEngine(this.adapters);
    await backtestEngine.start();
    
    // 启动订单管理
    const orderManager = new OrderManager(this.adapters);
    await orderManager.start();
  }
}

// 启动应用
const app = new TradingSystemApplication();
app.start().catch(console.error);
```

#### 6.2 Docker部署配置

```yaml
# docker-compose.sg.yml (SG机房)
version: '3.8'
services:
  trading-system-sg:
    build: .
    environment:
      - REGION=SG
      - NODE_ENV=production
      - MYSQL_PASSWORD=${MYSQL_PASSWORD}
      - REDIS_PASSWORD=${REDIS_PASSWORD}
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
      - DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}
    ports:
      - "3000:3000"
    depends_on:
      - mysql-sg
      - redis-sg
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped

  mysql-sg:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
      - MYSQL_DATABASE=trading_sg
    volumes:
      - mysql-sg-data:/var/lib/mysql
    restart: unless-stopped

  redis-sg:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-sg-data:/data
    restart: unless-stopped

volumes:
  mysql-sg-data:
  redis-sg-data:
```

```yaml
# docker-compose.cn.yml (CN机房)
version: '3.8'
services:
  trading-system-cn:
    build: .
    environment:
      - REGION=CN
      - NODE_ENV=production
      - MYSQL_PASSWORD=${MYSQL_PASSWORD}
      - REDIS_PASSWORD=${REDIS_PASSWORD}
      - DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}
      - TUSHARE_TOKEN=${TUSHARE_TOKEN}
    ports:
      - "3000:3000"
    depends_on:
      - mysql-cn
      - redis-cn
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped

  mysql-cn:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
      - MYSQL_DATABASE=trading_cn
    volumes:
      - mysql-cn-data:/var/lib/mysql
    restart: unless-stopped

  redis-cn:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-cn-data:/data
    restart: unless-stopped

volumes:
  mysql-cn-data:
  redis-cn-data:
```

---

## 📊 实施计划

### 阶段1: 核心架构搭建 (2-3周)
1. ✅ 设计通用交易系统接口
2. ✅ 实现市场适配器模式
3. ✅ 创建统一数据模型
4. ✅ 搭建消息队列基础设施

### 阶段2: 市场适配器开发 (3-4周)
1. ✅ 完善Binance适配器
2. ✅ 开发A股适配器 (Tushare + 东方财富)
3. ✅ 开发美股适配器 (Alpaca + Alpha Vantage)
4. ✅ 实现数据格式标准化

### 阶段3: AI模块解耦 (2-3周)
1. ✅ 设计AI服务接口
2. ✅ 实现Claude AI服务 (SG机房)
3. ✅ 实现DeepSeek AI服务 (CN机房)
4. ✅ 建立AI服务通信机制

### 阶段4: 跨机房部署 (2-3周)
1. ✅ 配置多环境管理
2. ✅ 实现数据同步服务
3. ✅ 部署SG机房服务
4. ✅ 部署CN机房服务

### 阶段5: 测试与优化 (2-3周)
1. ✅ 单元测试覆盖
2. ✅ 集成测试验证
3. ✅ 性能优化
4. ✅ 监控告警完善

---

## 🎯 预期效果

### 技术优势
- **高度模块化**: 核心业务逻辑与市场解耦
- **AI独立服务**: AI模块完全解耦，支持多提供商
- **跨机房部署**: 支持SG/CN机房独立部署
- **统一接口**: 多市场统一交易接口

### 业务价值
- **多市场覆盖**: 加密货币 + A股 + 美股
- **风险分散**: 跨市场配置降低风险
- **AI增强**: 多AI提供商提升分析质量
- **扩展性强**: 易于添加新市场和新功能

这个架构设计完全基于现有的trading-system-v2系统，通过抽象化和模块化改造，实现了多市场支持和AI模块解耦，同时考虑了跨机房部署的复杂需求。
