#!/usr/bin/env node

const DatabaseManager = require('./modules/database/DatabaseManager');
const StrategyV3Migration = require('./modules/database/StrategyV3Migration');

async function runMigration() {
  console.log('🔄 开始运行V3策略数据库迁移...');

  try {
    // 初始化数据库
    const dbManager = new DatabaseManager();
    await dbManager.init();

    // 运行V3迁移
    const migration = new StrategyV3Migration(dbManager);
    await migration.migrateToV3();

    console.log('✅ V3策略数据库迁移完成');

    // 关闭数据库连接
    await dbManager.close();

  } catch (error) {
    console.error('❌ 迁移失败:', error);
    process.exit(1);
  }
}

runMigration();
