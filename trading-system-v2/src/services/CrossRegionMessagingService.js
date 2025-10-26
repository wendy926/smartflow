/**
 * 跨机房通信服务
 * 实现SG/CN机房之间的数据同步和通信
 */

const Redis = require('ioredis');
const logger = require('../utils/logger');

// 消息类型枚举
const MessageType = {
  DATA_SYNC: 'data_sync',
  AI_ANALYSIS: 'ai_analysis',
  TRADING_SIGNAL: 'trading_signal',
  RISK_ALERT: 'risk_alert',
  SYSTEM_STATUS: 'system_status',
  HEARTBEAT: 'heartbeat'
};

// 消息优先级
const MessagePriority = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  CRITICAL: 4
};

// 区域枚举
const Region = {
  SG: 'SG',
  CN: 'CN'
};

/**
 * 消息模型
 */
class Message {
  constructor(type, data, options = {}) {
    this.id = this.generateId();
    this.type = type;
    this.data = data;
    this.priority = options.priority || MessagePriority.NORMAL;
    this.sourceRegion = options.sourceRegion;
    this.targetRegion = options.targetRegion;
    this.timestamp = new Date();
    this.ttl = options.ttl || 3600; // 默认1小时过期
    this.retryCount = 0;
    this.maxRetries = options.maxRetries || 3;
  }

  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      data: this.data,
      priority: this.priority,
      sourceRegion: this.sourceRegion,
      targetRegion: this.targetRegion,
      timestamp: this.timestamp.toISOString(),
      ttl: this.ttl,
      retryCount: this.retryCount,
      maxRetries: this.maxRetries
    };
  }

  static fromJSON(json) {
    const message = new Message(json.type, json.data, {
      priority: json.priority,
      sourceRegion: json.sourceRegion,
      targetRegion: json.targetRegion,
      ttl: json.ttl,
      maxRetries: json.maxRetries
    });
    message.id = json.id;
    message.timestamp = new Date(json.timestamp);
    message.retryCount = json.retryCount;
    return message;
  }
}

/**
 * 消息处理器接口
 */
class IMessageHandler {
  constructor() {
    if (this.constructor === IMessageHandler) {
      throw new Error('IMessageHandler is an abstract class and cannot be instantiated');
    }
  }

  /**
   * 处理消息
   * @param {Message} message - 消息对象
   * @returns {Promise<boolean>} 处理是否成功
   */
  async handle(message) {
    throw new Error('handle method must be implemented');
  }

  /**
   * 获取支持的消息类型
   * @returns {Array<string>} 支持的消息类型数组
   */
  getSupportedTypes() {
    throw new Error('getSupportedTypes method must be implemented');
  }
}

/**
 * 跨机房通信服务
 */
class CrossRegionMessagingService {
  constructor(config) {
    this.config = config;
    this.region = config.region;
    this.redis = this.initializeRedis(config.redis);
    this.handlers = new Map();
    this.isRunning = false;
    this.consumerGroup = `${this.region}_group`;
    this.consumerName = `${this.region}_consumer_${process.pid}`;

    // 统计信息
    this.stats = {
      messagesSent: 0,
      messagesReceived: 0,
      messagesProcessed: 0,
      messagesFailed: 0,
      lastActivity: null
    };
  }

  /**
   * 初始化Redis连接
   */
  initializeRedis(redisConfig) {
    const redis = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      db: redisConfig.db || 0,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    redis.on('error', (error) => {
      logger.error('[CrossRegionMessaging] Redis connection error:', error);
    });

    redis.on('connect', () => {
      logger.info('[CrossRegionMessaging] Redis connected successfully');
    });

    return redis;
  }

  /**
   * 启动服务
   */
  async start() {
    try {
      await this.redis.connect();

      // 创建消费者组
      await this.createConsumerGroups();

      // 启动消息处理器
      this.startMessageProcessor();

      // 启动心跳检测
      this.startHeartbeat();

      this.isRunning = true;
      logger.info(`[CrossRegionMessaging] Service started in ${this.region} region`);

    } catch (error) {
      logger.error('[CrossRegionMessaging] Failed to start service:', error);
      throw error;
    }
  }

  /**
   * 停止服务
   */
  async stop() {
    this.isRunning = false;
    await this.redis.disconnect();
    logger.info('[CrossRegionMessaging] Service stopped');
  }

  /**
   * 注册消息处理器
   * @param {IMessageHandler} handler - 消息处理器
   */
  registerHandler(handler) {
    const supportedTypes = handler.getSupportedTypes();

    for (const type of supportedTypes) {
      if (!this.handlers.has(type)) {
        this.handlers.set(type, []);
      }
      this.handlers.get(type).push(handler);
    }

    logger.info(`[CrossRegionMessaging] Registered handler for types: ${supportedTypes.join(', ')}`);
  }

  /**
   * 发送消息
   * @param {Message} message - 消息对象
   * @returns {Promise<boolean>} 发送是否成功
   */
  async sendMessage(message) {
    try {
      if (!this.isRunning) {
        throw new Error('Service is not running');
      }

      // 设置源区域
      message.sourceRegion = this.region;

      // 根据优先级选择队列
      const queueName = this.getQueueName(message.type, message.priority);

      // 发送消息到Redis Stream
      await this.redis.xadd(queueName, '*', 'message', JSON.stringify(message.toJSON()));

      this.stats.messagesSent++;
      this.stats.lastActivity = new Date();

      logger.debug(`[CrossRegionMessaging] Message sent: ${message.id} to ${queueName}`);

      return true;

    } catch (error) {
      logger.error('[CrossRegionMessaging] Failed to send message:', error);
      return false;
    }
  }

  /**
   * 请求-响应模式发送消息
   * @param {Message} message - 消息对象
   * @param {number} timeout - 超时时间（毫秒）
   * @returns {Promise<any>} 响应数据
   */
  async requestResponse(message, timeout = 5000) {
    const responseId = `${message.id}_response`;
    const responseQueue = `response_${responseId}`;

    try {
      // 发送请求消息
      await this.sendMessage(message);

      // 等待响应
      const response = await this.waitForResponse(responseQueue, timeout);

      return response;

    } catch (error) {
      logger.error('[CrossRegionMessaging] Request-response failed:', error);
      throw error;
    }
  }

  /**
   * 等待响应
   */
  async waitForResponse(responseQueue, timeout) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Response timeout'));
      }, timeout);

      const checkResponse = async () => {
        try {
          const messages = await this.redis.xread('COUNT', 1, 'BLOCK', 1000, 'STREAMS', responseQueue, '$');

          if (messages && messages.length > 0) {
            clearTimeout(timeoutId);
            const response = JSON.parse(messages[0][1][0][1]);
            resolve(response);
          } else {
            setTimeout(checkResponse, 100);
          }
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      };

      checkResponse();
    });
  }

  /**
   * 创建消费者组
   */
  async createConsumerGroups() {
    const queues = [
      'data_sync_low', 'data_sync_normal', 'data_sync_high', 'data_sync_critical',
      'ai_analysis_low', 'ai_analysis_normal', 'ai_analysis_high', 'ai_analysis_critical',
      'trading_signal_low', 'trading_signal_normal', 'trading_signal_high', 'trading_signal_critical',
      'risk_alert_low', 'risk_alert_normal', 'risk_alert_high', 'risk_alert_critical',
      'system_status_low', 'system_status_normal', 'system_status_high', 'system_status_critical',
      'heartbeat_low', 'heartbeat_normal', 'heartbeat_high', 'heartbeat_critical'
    ];

    for (const queue of queues) {
      try {
        await this.redis.xgroup('CREATE', queue, this.consumerGroup, '$', 'MKSTREAM');
      } catch (error) {
        // 组已存在，忽略错误
        if (!error.message.includes('BUSYGROUP')) {
          logger.warn(`[CrossRegionMessaging] Failed to create consumer group for ${queue}:`, error);
        }
      }
    }
  }

  /**
   * 启动消息处理器
   */
  startMessageProcessor() {
    const processMessages = async () => {
      if (!this.isRunning) return;

      try {
        // 按优先级处理消息
        const priorities = [MessagePriority.CRITICAL, MessagePriority.HIGH, MessagePriority.NORMAL, MessagePriority.LOW];

        for (const priority of priorities) {
          const queues = this.getQueuesByPriority(priority);

          for (const queue of queues) {
            await this.processQueue(queue);
          }
        }

      } catch (error) {
        logger.error('[CrossRegionMessaging] Message processing error:', error);
      }

      // 继续处理
      setTimeout(processMessages, 100);
    };

    processMessages();
  }

  /**
   * 处理队列消息
   */
  async processQueue(queueName) {
    try {
      const messages = await this.redis.xreadgroup(
        'GROUP', this.consumerGroup, this.consumerName,
        'COUNT', 1,
        'BLOCK', 1000,
        'STREAMS', queueName, '>'
      );

      if (messages && messages.length > 0) {
        for (const [stream, streamMessages] of messages) {
          for (const [id, fields] of streamMessages) {
            const messageData = JSON.parse(fields.message);
            const message = Message.fromJSON(messageData);

            await this.processMessage(message);

            // 确认消息处理完成
            await this.redis.xack(queueName, this.consumerGroup, id);
          }
        }
      }

    } catch (error) {
      logger.error(`[CrossRegionMessaging] Failed to process queue ${queueName}:`, error);
    }
  }

  /**
   * 处理单个消息
   */
  async processMessage(message) {
    try {
      this.stats.messagesReceived++;

      // 检查消息是否过期
      if (this.isMessageExpired(message)) {
        logger.warn(`[CrossRegionMessaging] Message expired: ${message.id}`);
        return;
      }

      // 检查目标区域
      if (message.targetRegion && message.targetRegion !== this.region) {
        logger.debug(`[CrossRegionMessaging] Message not for this region: ${message.id}`);
        return;
      }

      // 获取处理器
      const handlers = this.handlers.get(message.type) || [];

      if (handlers.length === 0) {
        logger.warn(`[CrossRegionMessaging] No handler for message type: ${message.type}`);
        return;
      }

      // 处理消息
      let processed = false;
      for (const handler of handlers) {
        try {
          const result = await handler.handle(message);
          if (result) {
            processed = true;
            break;
          }
        } catch (error) {
          logger.error(`[CrossRegionMessaging] Handler error for message ${message.id}:`, error);
        }
      }

      if (processed) {
        this.stats.messagesProcessed++;
      } else {
        this.stats.messagesFailed++;
        logger.warn(`[CrossRegionMessaging] Message processing failed: ${message.id}`);
      }

    } catch (error) {
      logger.error(`[CrossRegionMessaging] Failed to process message ${message.id}:`, error);
      this.stats.messagesFailed++;
    }
  }

  /**
   * 检查消息是否过期
   */
  isMessageExpired(message) {
    const now = new Date();
    const messageTime = new Date(message.timestamp);
    const ttlMs = message.ttl * 1000;

    return (now.getTime() - messageTime.getTime()) > ttlMs;
  }

  /**
   * 获取队列名称
   */
  getQueueName(messageType, priority) {
    const priorityName = this.getPriorityName(priority);
    return `${messageType}_${priorityName}`;
  }

  /**
   * 获取优先级名称
   */
  getPriorityName(priority) {
    switch (priority) {
      case MessagePriority.CRITICAL: return 'critical';
      case MessagePriority.HIGH: return 'high';
      case MessagePriority.NORMAL: return 'normal';
      case MessagePriority.LOW: return 'low';
      default: return 'normal';
    }
  }

  /**
   * 根据优先级获取队列列表
   */
  getQueuesByPriority(priority) {
    const priorityName = this.getPriorityName(priority);
    const messageTypes = Object.values(MessageType);

    return messageTypes.map(type => `${type}_${priorityName}`);
  }

  /**
   * 启动心跳检测
   */
  startHeartbeat() {
    setInterval(async () => {
      if (!this.isRunning) return;

      try {
        const heartbeat = new Message(MessageType.HEARTBEAT, {
          region: this.region,
          timestamp: new Date().toISOString(),
          stats: this.stats
        }, {
          priority: MessagePriority.LOW,
          ttl: 60
        });

        await this.sendMessage(heartbeat);

      } catch (error) {
        logger.error('[CrossRegionMessaging] Heartbeat failed:', error);
      }
    }, 30000); // 每30秒发送一次心跳
  }

  /**
   * 获取服务统计信息
   */
  getStats() {
    return {
      ...this.stats,
      region: this.region,
      isRunning: this.isRunning,
      handlersCount: this.handlers.size,
      lastActivity: this.stats.lastActivity
    };
  }

  /**
   * 清理过期消息
   */
  async cleanupExpiredMessages() {
    try {
      const queues = this.getQueuesByPriority(MessagePriority.LOW)
        .concat(this.getQueuesByPriority(MessagePriority.NORMAL))
        .concat(this.getQueuesByPriority(MessagePriority.HIGH))
        .concat(this.getQueuesByPriority(MessagePriority.CRITICAL));

      for (const queue of queues) {
        // 清理7天前的消息
        const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000);
        await this.redis.xtrim(queue, 'MINID', cutoffTime);
      }

      logger.info('[CrossRegionMessaging] Expired messages cleaned up');

    } catch (error) {
      logger.error('[CrossRegionMessaging] Failed to cleanup expired messages:', error);
    }
  }
}

/**
 * 数据同步处理器
 */
class DataSyncHandler extends IMessageHandler {
  constructor(dataSyncService) {
    super();
    this.dataSyncService = dataSyncService;
  }

  async handle(message) {
    if (message.type !== MessageType.DATA_SYNC) {
      return false;
    }

    try {
      const { marketType, symbol, timeframe, from, to } = message.data;

      // 同步数据
      const data = await this.dataSyncService.syncData(marketType, symbol, timeframe, from, to);

      // 发送响应
      const response = new Message(MessageType.DATA_SYNC, {
        requestId: message.id,
        data: data,
        success: true
      }, {
        priority: MessagePriority.NORMAL,
        targetRegion: message.sourceRegion
      });

      await this.dataSyncService.messagingService.sendMessage(response);

      return true;

    } catch (error) {
      logger.error('[DataSyncHandler] Failed to handle data sync:', error);

      // 发送错误响应
      const errorResponse = new Message(MessageType.DATA_SYNC, {
        requestId: message.id,
        error: error.message,
        success: false
      }, {
        priority: MessagePriority.NORMAL,
        targetRegion: message.sourceRegion
      });

      await this.dataSyncService.messagingService.sendMessage(errorResponse);

      return false;
    }
  }

  getSupportedTypes() {
    return [MessageType.DATA_SYNC];
  }
}

/**
 * AI分析处理器
 */
class AIAnalysisHandler extends IMessageHandler {
  constructor(aiService) {
    super();
    this.aiService = aiService;
  }

  async handle(message) {
    if (message.type !== MessageType.AI_ANALYSIS) {
      return false;
    }

    try {
      const { analysisType, data, context } = message.data;

      let result;
      switch (analysisType) {
        case 'market':
          result = await this.aiService.analyzeMarket(data, context);
          break;
        case 'signal':
          result = await this.aiService.generateSignal(context.strategy, context);
          break;
        case 'risk':
          result = await this.aiService.assessRisk(data, context);
          break;
        case 'sentiment':
          result = await this.aiService.analyzeSentiment(data, context);
          break;
        default:
          throw new Error(`Unsupported analysis type: ${analysisType}`);
      }

      // 发送响应
      const response = new Message(MessageType.AI_ANALYSIS, {
        requestId: message.id,
        result: result,
        success: true
      }, {
        priority: MessagePriority.NORMAL,
        targetRegion: message.sourceRegion
      });

      await this.aiService.messagingService.sendMessage(response);

      return true;

    } catch (error) {
      logger.error('[AIAnalysisHandler] Failed to handle AI analysis:', error);
      return false;
    }
  }

  getSupportedTypes() {
    return [MessageType.AI_ANALYSIS];
  }
}

module.exports = {
  MessageType,
  MessagePriority,
  Region,
  Message,
  IMessageHandler,
  CrossRegionMessagingService,
  DataSyncHandler,
  AIAnalysisHandler
};
