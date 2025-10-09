/**
 * 测试Telegram配置
 */

const TelegramConfigOps = require('./src/database/telegram-config-ops');
const logger = require('./src/utils/logger');

async function testTelegramConfig() {
  try {
    console.log('=== 测试Telegram配置功能 ===\n');

    // 1. 查看当前配置
    console.log('1. 查看当前配置:');
    const allConfigs = await TelegramConfigOps.getAllConfigs();
    if (allConfigs.success && allConfigs.data.length > 0) {
      allConfigs.data.forEach(cfg => {
        console.log(`  - ${cfg.config_type}: ${cfg.enabled ? '已启用' : '已禁用'}`);
        console.log(`    Bot Token: ${cfg.bot_token.substring(0, 20)}...`);
        console.log(`    Chat ID: ${cfg.chat_id}`);
      });
    } else {
      console.log('  暂无配置');
    }

    console.log('\n=== 测试完成 ===');
    console.log('\n📝 使用说明:');
    console.log('1. 访问 https://smart.aimaventop.com/tools');
    console.log('2. 在"Telegram监控设置"中配置机器人');
    console.log('3. 测试配置是否成功');

    process.exit(0);
  } catch (error) {
    console.error('测试失败:', error);
    process.exit(1);
  }
}

testTelegramConfig();

