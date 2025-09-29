/**
 * 新币监控控制器
 * 负责新币监控的核心业务逻辑
 */

const logger = require('../../utils/logger');
const axios = require('axios');

class NewCoinMonitorController {
  constructor(database, cache) {
    this.database = database;
    this.cache = cache;
    this.isRunning = false;
    this.intervals = {};
    this.config = {};
    
    // API配置
    this.binanceBaseUrl = 'https://api.binance.com/api/v3';
    this.githubBaseUrl = 'https://api.github.com';
    
    // 请求队列管理
    this.requestQueue = [];
    this.activeRequests = 0;
    this.maxConcurrentRequests = 5;
  }

  /**
   * 启动新币监控服务
   */
  async start() {
    try {
      logger.info('Starting new coin monitor service...');
      
      // 加载配置
      await this.loadConfig();
      
      // 启动定时任务
      await this.startScheduledTasks();
      
      this.isRunning = true;
      logger.info('New coin monitor service started successfully');
      
    } catch (error) {
      logger.error('Failed to start new coin monitor service:', error);
      throw error;
    }
  }

  /**
   * 停止新币监控服务
   */
  async stop() {
    try {
      logger.info('Stopping new coin monitor service...');
      
      this.isRunning = false;
      
      // 清理定时任务
      Object.values(this.intervals).forEach(interval => {
        if (interval) clearInterval(interval);
      });
      this.intervals = {};
      
      logger.info('New coin monitor service stopped successfully');
      
    } catch (error) {
      logger.error('Error stopping new coin monitor service:', error);
    }
  }

  /**
   * 加载配置
   */
  async loadConfig() {
    try {
      const query = `
        SELECT config_key, config_value, config_type 
        FROM new_coin_monitor_config 
        WHERE is_active = 1
      `;
      
      const configs = await this.database.query(query);
      
      this.config = {};
      configs.forEach(config => {
        let value = config.config_value;
        
        switch (config.config_type) {
          case 'NUMBER':
            value = parseFloat(value);
            break;
          case 'BOOLEAN':
            value = value === 'true';
            break;
          case 'JSON':
            try {
              value = JSON.parse(value);
            } catch (e) {
              logger.warn(`Invalid JSON config: ${config.config_key}`);
              value = null;
            }
            break;
        }
        
        this.config[config.config_key] = value;
      });
      
      logger.info('New coin monitor config loaded successfully');
      
    } catch (error) {
      logger.error('Failed to load config:', error);
      throw error;
    }
  }

  /**
   * 启动定时任务
   */
  async startScheduledTasks() {
    const evaluationInterval = this.config.evaluation_interval * 1000 || 300000; // 5分钟
    const marketDataInterval = this.config.market_data_interval * 1000 || 60000; // 1分钟
    const githubDataInterval = this.config.github_data_interval * 1000 || 3600000; // 1小时
    
    // 评分更新任务
    this.intervals.evaluation = setInterval(async () => {
      if (this.isRunning) {
        await this.evaluateAllCoins();
      }
    }, evaluationInterval);
    
    // 市场数据更新任务
    this.intervals.marketData = setInterval(async () => {
      if (this.isRunning) {
        await this.updateMarketData();
      }
    }, marketDataInterval);
    
    // GitHub数据更新任务
    this.intervals.githubData = setInterval(async () => {
      if (this.isRunning) {
        await this.updateGitHubData();
      }
    }, githubDataInterval);
    
    logger.info('Scheduled tasks started');
  }

  /**
   * 获取所有监控中的新币
   */
  async getMonitoredCoins() {
    try {
      const query = `
        SELECT id, symbol, name, github_repo, team_score, 
               supply_total, supply_circulation, vesting_lock_score,
               twitter_followers, telegram_members, status
        FROM new_coins 
        WHERE status = 'ACTIVE' OR status = 'MONITORING'
        ORDER BY created_at DESC
      `;
      
      const coins = await this.database.query(query);
      return coins;
      
    } catch (error) {
      logger.error('Failed to get monitored coins:', error);
      throw error;
    }
  }

  /**
   * 评估所有新币
   */
  async evaluateAllCoins() {
    try {
      const coins = await this.getMonitoredCoins();
      logger.info(`Evaluating ${coins.length} coins`);
      
      for (const coin of coins) {
        try {
          await this.evaluateCoin(coin);
          // 添加延迟避免API限制
          await this.delay(1000);
        } catch (error) {
          logger.error(`Failed to evaluate coin ${coin.symbol}:`, error);
        }
      }
      
    } catch (error) {
      logger.error('Failed to evaluate all coins:', error);
    }
  }

  /**
   * 评估单个新币
   */
  async evaluateCoin(coin) {
    try {
      const techScore = await this.calculateTechScore(coin);
      const tokenScore = this.calculateTokenEconomicsScore(coin);
      const liquidityScore = await this.calculateLiquidityScore(coin.symbol);
      const sentimentScore = await this.calculateSentimentScore(coin);
      
      // 计算综合评分
      const totalScore = 
        techScore * this.config.weight_tech_team +
        tokenScore * this.config.weight_token_economics +
        liquidityScore * this.config.weight_liquidity +
        sentimentScore * this.config.weight_market_sentiment;
      
      // 生成策略建议
      const strategyRecommendation = this.generateStrategyRecommendation(totalScore);
      
      // 保存评分记录
      await this.saveScoreRecord(coin.id, {
        techScore,
        tokenScore,
        liquidityScore,
        sentimentScore,
        totalScore,
        strategyRecommendation
      });
      
      // 检查告警条件
      await this.checkAlerts(coin, totalScore, strategyRecommendation);
      
      logger.info(`Evaluated ${coin.symbol}: score=${totalScore.toFixed(2)}, strategy=${strategyRecommendation}`);
      
    } catch (error) {
      logger.error(`Failed to evaluate coin ${coin.symbol}:`, error);
      throw error;
    }
  }

  /**
   * 计算技术团队评分
   */
  async calculateTechScore(coin) {
    try {
      let githubScore = 0;
      
      if (coin.github_repo) {
        githubScore = await this.getGitHubScore(coin.github_repo);
      }
      
      // 技术评分 = GitHub评分 * 0.7 + 团队经验分 * 0.3
      const techScore = githubScore * 0.7 + coin.team_score * 0.3;
      
      return Math.min(techScore, 10);
      
    } catch (error) {
      logger.error(`Failed to calculate tech score for ${coin.symbol}:`, error);
      return 0;
    }
  }

  /**
   * 获取GitHub评分
   */
  async getGitHubScore(repo) {
    try {
      const cacheKey = `github_score:${repo}`;
      let githubData = await this.cache.get(cacheKey);
      
      if (!githubData) {
        githubData = await this.fetchGitHubData(repo);
        await this.cache.set(cacheKey, githubData, 3600); // 缓存1小时
      }
      
      let score = 0;
      if (githubData.stargazers_count) {
        score += Math.min(10, githubData.stargazers_count / 100);
      }
      if (githubData.forks_count) {
        score += Math.min(5, githubData.forks_count / 50);
      }
      if (githubData.open_issues_count) {
        score += Math.min(5, githubData.open_issues_count / 20);
      }
      
      return Math.min(score, 10);
      
    } catch (error) {
      logger.error(`Failed to get GitHub score for ${repo}:`, error);
      return 0;
    }
  }

  /**
   * 获取GitHub数据
   */
  async fetchGitHubData(repo) {
    try {
      const url = `${this.githubBaseUrl}/repos/${repo}`;
      const headers = {};
      
      if (this.config.github_token) {
        headers.Authorization = `token ${this.config.github_token}`;
      }
      
      const response = await this.makeRequest('GET', url, { headers });
      return response.data;
      
    } catch (error) {
      logger.error(`Failed to fetch GitHub data for ${repo}:`, error);
      throw error;
    }
  }

  /**
   * 计算代币经济评分
   */
  calculateTokenEconomicsScore(coin) {
    try {
      const circulationRatio = coin.supply_circulation / coin.supply_total;
      const supplyScore = (1 - circulationRatio) * 10;
      
      return Math.min(10, (supplyScore + coin.vesting_lock_score) / 2);
      
    } catch (error) {
      logger.error(`Failed to calculate token economics score for ${coin.symbol}:`, error);
      return 0;
    }
  }

  /**
   * 计算流动性评分
   */
  async calculateLiquidityScore(symbol) {
    try {
      const marketData = await this.getMarketData(symbol);
      
      if (!marketData) return 0;
      
      // 交易量评分
      const volumeScore = Math.min(10, Math.log10(parseFloat(marketData.volume) + 1));
      
      // 订单簿深度评分
      const depthScore = Math.min(10, Math.log10(marketData.bid_depth + marketData.ask_depth + 1));
      
      return (volumeScore + depthScore) / 2;
      
    } catch (error) {
      logger.error(`Failed to calculate liquidity score for ${symbol}:`, error);
      return 0;
    }
  }

  /**
   * 计算市场情绪评分
   */
  async calculateSentimentScore(coin) {
    try {
      // 社交媒体评分
      const socialScore = Math.min(10, (coin.twitter_followers + coin.telegram_members * 10) / 1000);
      
      // 波动性评分
      const volatilityScore = await this.getVolatilityScore(coin.symbol);
      
      return (socialScore + volatilityScore) / 2;
      
    } catch (error) {
      logger.error(`Failed to calculate sentiment score for ${coin.symbol}:`, error);
      return 0;
    }
  }

  /**
   * 获取波动性评分
   */
  async getVolatilityScore(symbol) {
    try {
      const url = `${this.binanceBaseUrl}/klines?symbol=${symbol}&interval=1h&limit=24`;
      const response = await this.makeRequest('GET', url);
      
      if (!response.data || response.data.length === 0) return 0;
      
      const data = response.data;
      const openFirst = parseFloat(data[0][1]);
      const highMax = Math.max(...data.map(k => parseFloat(k[2])));
      const lowMin = Math.min(...data.map(k => parseFloat(k[3])));
      
      const volatility = (highMax - lowMin) / openFirst;
      
      if (volatility < 0.05) return 10;
      else if (volatility < 0.10) return 8;
      else if (volatility < 0.20) return 5;
      else return 2;
      
    } catch (error) {
      logger.error(`Failed to get volatility score for ${symbol}:`, error);
      return 0;
    }
  }

  /**
   * 获取市场数据
   */
  async getMarketData(symbol) {
    try {
      const cacheKey = `market_data:${symbol}`;
      let marketData = await this.cache.get(cacheKey);
      
      if (!marketData) {
        // 获取24小时价格统计
        const tickerUrl = `${this.binanceBaseUrl}/ticker/24hr?symbol=${symbol}`;
        const tickerResponse = await this.makeRequest('GET', tickerUrl);
        
        // 获取订单簿深度
        const depthUrl = `${this.binanceBaseUrl}/depth?symbol=${symbol}&limit=50`;
        const depthResponse = await this.makeRequest('GET', depthUrl);
        
        const ticker = tickerResponse.data;
        const depth = depthResponse.data;
        
        const bidDepth = depth.bids.reduce((sum, b) => sum + parseFloat(b[1]), 0);
        const askDepth = depth.asks.reduce((sum, a) => sum + parseFloat(a[1]), 0);
        
        marketData = {
          price: parseFloat(ticker.lastPrice),
          volume: parseFloat(ticker.volume),
          priceChange24h: parseFloat(ticker.priceChangePercent),
          high24h: parseFloat(ticker.highPrice),
          low24h: parseFloat(ticker.lowPrice),
          bidDepth,
          askDepth
        };
        
        await this.cache.set(cacheKey, marketData, 60); // 缓存1分钟
      }
      
      return marketData;
      
    } catch (error) {
      logger.error(`Failed to get market data for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * 生成策略建议
   */
  generateStrategyRecommendation(totalScore) {
    if (totalScore >= 9) return '高可靠性，中长期可持有';
    else if (totalScore >= 7) return '中等可靠性，短线+观望';
    else if (totalScore >= 5) return '低可靠性，仅适合极短线博弈';
    else return '高风险，建议规避';
  }

  /**
   * 保存评分记录
   */
  async saveScoreRecord(coinId, scores) {
    try {
      const query = `
        INSERT INTO new_coin_scores 
        (coin_id, tech_score, token_score, liquidity_score, sentiment_score, total_score, strategy_recommendation)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      
      await this.database.query(query, [
        coinId,
        scores.techScore,
        scores.tokenScore,
        scores.liquidityScore,
        scores.sentimentScore,
        scores.totalScore,
        scores.strategyRecommendation
      ]);
      
    } catch (error) {
      logger.error('Failed to save score record:', error);
      throw error;
    }
  }

  /**
   * 检查告警条件
   */
  async checkAlerts(coin, totalScore, strategyRecommendation) {
    try {
      const alerts = [];
      
      // 评分告警
      if (totalScore < this.config.alert_score_threshold) {
        alerts.push({
          type: 'LOW_SCORE',
          level: 'WARNING',
          message: `新币评分警报: ${coin.symbol}, 总分: ${totalScore.toFixed(1)}, 建议策略: ${strategyRecommendation}`,
          data: { totalScore, strategyRecommendation }
        });
      }
      
      // 保存告警记录
      for (const alert of alerts) {
        await this.saveAlert(coin.id, alert);
      }
      
    } catch (error) {
      logger.error(`Failed to check alerts for ${coin.symbol}:`, error);
    }
  }

  /**
   * 保存告警记录
   */
  async saveAlert(coinId, alert) {
    try {
      const query = `
        INSERT INTO new_coin_alerts 
        (coin_id, alert_type, alert_level, alert_message, alert_data)
        VALUES (?, ?, ?, ?, ?)
      `;
      
      await this.database.query(query, [
        coinId,
        alert.type,
        alert.level,
        alert.message,
        JSON.stringify(alert.data)
      ]);
      
    } catch (error) {
      logger.error('Failed to save alert:', error);
    }
  }

  /**
   * 更新市场数据
   */
  async updateMarketData() {
    try {
      const coins = await this.getMonitoredCoins();
      logger.info(`Updating market data for ${coins.length} coins`);
      
      for (const coin of coins) {
        try {
          const marketData = await this.getMarketData(coin.symbol);
          
          if (marketData) {
            await this.saveMarketData(coin.id, marketData);
          }
          
          await this.delay(500); // 避免API限制
          
        } catch (error) {
          logger.error(`Failed to update market data for ${coin.symbol}:`, error);
        }
      }
      
    } catch (error) {
      logger.error('Failed to update market data:', error);
    }
  }

  /**
   * 保存市场数据
   */
  async saveMarketData(coinId, marketData) {
    try {
      const query = `
        INSERT INTO new_coin_market_data 
        (coin_id, price, volume_24h, price_change_24h, high_24h, low_24h, bid_depth, ask_depth)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      await this.database.query(query, [
        coinId,
        marketData.price,
        marketData.volume,
        marketData.priceChange24h,
        marketData.high24h,
        marketData.low24h,
        marketData.bidDepth,
        marketData.askDepth
      ]);
      
    } catch (error) {
      logger.error('Failed to save market data:', error);
      throw error;
    }
  }

  /**
   * 更新GitHub数据
   */
  async updateGitHubData() {
    try {
      const coins = await this.getMonitoredCoins();
      const coinsWithGitHub = coins.filter(coin => coin.github_repo);
      
      logger.info(`Updating GitHub data for ${coinsWithGitHub.length} coins`);
      
      for (const coin of coinsWithGitHub) {
        try {
          const githubData = await this.fetchGitHubData(coin.github_repo);
          await this.saveGitHubData(coin.id, githubData);
          
          await this.delay(2000); // GitHub API限制更严格
          
        } catch (error) {
          logger.error(`Failed to update GitHub data for ${coin.symbol}:`, error);
        }
      }
      
    } catch (error) {
      logger.error('Failed to update GitHub data:', error);
    }
  }

  /**
   * 保存GitHub数据
   */
  async saveGitHubData(coinId, githubData) {
    try {
      const query = `
        INSERT INTO new_coin_github_data 
        (coin_id, stars_count, forks_count, issues_count, github_score)
        VALUES (?, ?, ?, ?, ?)
      `;
      
      const githubScore = await this.calculateGitHubScore(githubData);
      
      await this.database.query(query, [
        coinId,
        githubData.stargazers_count || 0,
        githubData.forks_count || 0,
        githubData.open_issues_count || 0,
        githubScore
      ]);
      
    } catch (error) {
      logger.error('Failed to save GitHub data:', error);
      throw error;
    }
  }

  /**
   * 计算GitHub评分
   */
  calculateGitHubScore(githubData) {
    let score = 0;
    if (githubData.stargazers_count) {
      score += Math.min(10, githubData.stargazers_count / 100);
    }
    if (githubData.forks_count) {
      score += Math.min(5, githubData.forks_count / 50);
    }
    if (githubData.open_issues_count) {
      score += Math.min(5, githubData.open_issues_count / 20);
    }
    return Math.min(score, 10);
  }

  /**
   * 发送HTTP请求（带队列管理）
   */
  async makeRequest(method, url, options = {}) {
    return new Promise((resolve, reject) => {
      const request = { method, url, options, resolve, reject };
      this.requestQueue.push(request);
      this.processRequestQueue();
    });
  }

  /**
   * 处理请求队列
   */
  async processRequestQueue() {
    if (this.activeRequests >= this.maxConcurrentRequests || this.requestQueue.length === 0) {
      return;
    }
    
    const request = this.requestQueue.shift();
    this.activeRequests++;
    
    try {
      const response = await axios({
        method: request.method,
        url: request.url,
        timeout: this.config.binance_api_timeout || 10000,
        ...request.options
      });
      
      request.resolve(response);
      
    } catch (error) {
      request.reject(error);
      
    } finally {
      this.activeRequests--;
      // 继续处理队列
      setTimeout(() => this.processRequestQueue(), 100);
    }
  }

  /**
   * 延迟函数
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 添加新币到监控列表
   */
  async addCoin(coinData) {
    try {
      const query = `
        INSERT INTO new_coins 
        (symbol, name, github_repo, team_score, supply_total, supply_circulation, 
         vesting_lock_score, twitter_followers, telegram_members, status, listing_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const result = await this.database.query(query, [
        coinData.symbol,
        coinData.name,
        coinData.github_repo,
        coinData.team_score,
        coinData.supply_total,
        coinData.supply_circulation,
        coinData.vesting_lock_score,
        coinData.twitter_followers,
        coinData.telegram_members,
        coinData.status || 'ACTIVE',
        coinData.listing_date
      ]);
      
      logger.info(`Added new coin to monitoring: ${coinData.symbol}`);
      return result.insertId;
      
    } catch (error) {
      logger.error('Failed to add coin:', error);
      throw error;
    }
  }

  /**
   * 获取新币监控概览数据
   */
  async getMonitorOverview() {
    try {
      const query = `
        SELECT * FROM new_coin_monitor_overview 
        ORDER BY total_score DESC, evaluation_time DESC
        LIMIT 50
      `;
      
      const overview = await this.database.query(query);
      return overview;
      
    } catch (error) {
      logger.error('Failed to get monitor overview:', error);
      throw error;
    }
  }

  /**
   * 获取告警统计
   */
  async getAlertStatistics() {
    try {
      const query = `
        SELECT * FROM new_coin_alert_statistics
        ORDER BY total_alerts DESC
      `;
      
      const statistics = await this.database.query(query);
      return statistics;
      
    } catch (error) {
      logger.error('Failed to get alert statistics:', error);
      throw error;
    }
  }
}

module.exports = NewCoinMonitorController;
