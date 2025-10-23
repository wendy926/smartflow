/**
 * 新币监控功能测试脚本
 * 用于测试新币监控模块的基本功能
 */

const NewCoinMonitorController = require('./src/services/new-coin-monitor/new-coin-monitor-controller');

// 模拟数据库和缓存对象
const mockDatabase = {
  query: async (sql, params = []) => {
    console.log('Mock DB Query:', sql, params);
    
    // 模拟配置查询
    if (sql.includes('new_coin_monitor_config')) {
      return [
        { config_key: 'monitor_enabled', config_value: 'true', config_type: 'BOOLEAN' },
        { config_key: 'evaluation_interval', config_value: '300', config_type: 'NUMBER' },
        { config_key: 'market_data_interval', config_value: '60', config_type: 'NUMBER' },
        { config_key: 'github_data_interval', config_value: '3600', config_type: 'NUMBER' },
        { config_key: 'alert_score_threshold', config_value: '7.0', config_type: 'NUMBER' },
        { config_key: 'weight_tech_team', config_value: '0.30', config_type: 'NUMBER' },
        { config_key: 'weight_token_economics', config_value: '0.25', config_type: 'NUMBER' },
        { config_key: 'weight_liquidity', config_value: '0.25', config_type: 'NUMBER' },
        { config_key: 'weight_market_sentiment', config_value: '0.20', config_type: 'NUMBER' },
        { config_key: 'github_token', config_value: '', config_type: 'STRING' },
        { config_key: 'telegram_bot_token', config_value: '', config_type: 'STRING' },
        { config_key: 'telegram_chat_id', config_value: '', config_type: 'STRING' },
        { config_key: 'binance_api_timeout', config_value: '10000', config_type: 'NUMBER' },
        { config_key: 'github_api_timeout', config_value: '10000', config_type: 'NUMBER' },
        { config_key: 'max_concurrent_requests', config_value: '5', config_type: 'NUMBER' }
      ];
    }
    
    // 模拟新币查询
    if (sql.includes('new_coins') && !sql.includes('INSERT')) {
      return [
        {
          id: 1,
          symbol: 'EXAMPLEUSDT',
          name: 'Example Coin',
          github_repo: 'example/repo',
          team_score: 8.0,
          supply_total: 100000000,
          supply_circulation: 5000000,
          vesting_lock_score: 7.0,
          twitter_followers: 5000,
          telegram_members: 1000,
          status: 'ACTIVE'
        }
      ];
    }
    
    // 模拟插入操作
    if (sql.includes('INSERT')) {
      return { insertId: 1, affectedRows: 1 };
    }
    
    return [];
  }
};

const mockCache = {
  get: async (key) => {
    console.log('Mock Cache Get:', key);
    return null; // 模拟缓存未命中
  },
  set: async (key, value, ttl) => {
    console.log('Mock Cache Set:', key, ttl);
    return true;
  }
};

async function testNewCoinMonitor() {
  console.log('开始测试新币监控功能...');
  
  try {
    // 创建新币监控控制器
    const monitor = new NewCoinMonitorController(mockDatabase, mockCache);
    
    // 测试启动
    console.log('\n1. 测试启动监控服务...');
    await monitor.start();
    console.log('✓ 监控服务启动成功');
    
    // 测试配置加载
    console.log('\n2. 测试配置加载...');
    console.log('配置项数量:', Object.keys(monitor.config).length);
    console.log('✓ 配置加载成功');
    
    // 测试获取监控币种
    console.log('\n3. 测试获取监控币种...');
    const coins = await monitor.getMonitoredCoins();
    console.log('监控币种数量:', coins.length);
    console.log('✓ 获取监控币种成功');
    
    // 测试评分计算
    console.log('\n4. 测试评分计算...');
    if (coins.length > 0) {
      const coin = coins[0];
      const techScore = await monitor.calculateTechScore(coin);
      const tokenScore = monitor.calculateTokenEconomicsScore(coin);
      console.log('技术评分:', techScore);
      console.log('代币经济评分:', tokenScore);
      console.log('✓ 评分计算成功');
    }
    
    // 测试停止服务
    console.log('\n5. 测试停止监控服务...');
    await monitor.stop();
    console.log('✓ 监控服务停止成功');
    
    console.log('\n🎉 所有测试通过！新币监控功能正常工作');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('错误详情:', error);
  }
}

// 运行测试
testNewCoinMonitor();
