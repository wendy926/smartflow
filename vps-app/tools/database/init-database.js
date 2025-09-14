const fs = require('fs');
const DatabaseManager = require('./modules/database/DatabaseManager');

async function initDatabase() {
  const db = new DatabaseManager();
  
  try {
    await db.init();
    console.log('✅ 数据库连接成功');
    
    // 读取SQL文件
    const sql = fs.readFileSync('database-schema-optimization.sql', 'utf8');
    
    // 分割SQL语句并执行
    const statements = sql.split(';').filter(stmt => stmt.trim());
    
    console.log(`📝 准备执行 ${statements.length} 个SQL语句`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement) {
        try {
          console.log(`执行语句 ${i + 1}/${statements.length}: ${statement.substring(0, 50)}...`);
          await db.run(statement);
        } catch (error) {
          console.error(`❌ 语句 ${i + 1} 执行失败:`, error.message);
          console.error(`语句内容: ${statement}`);
          // 继续执行其他语句
        }
      }
    }
    
    console.log('✅ 数据库结构初始化完成');
    
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    throw error;
  } finally {
    await db.close();
  }
}

// 运行初始化
initDatabase().catch(error => {
  console.error('初始化失败:', error);
  process.exit(1);
});
