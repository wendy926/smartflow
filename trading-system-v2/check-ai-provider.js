/**
 * 检查AI提供商实际使用情况
 */

const encryption = require('./src/utils/encryption');
const { pool } = require('./src/database/connection');

async function checkAIProvider() {
  try {
    console.log('=== 检查AI提供商配置 ===\n');
    
    // 查询配置
    const [rows] = await pool.query(
      `SELECT config_key, config_value 
       FROM ai_config 
       WHERE config_key IN ('ai_provider', 'openai_api_key', 'deepseek_api_key', 'openai_model', 'deepseek_model')`
    );
    
    for (const row of rows) {
      if (row.config_key === 'ai_provider') {
        console.log(`✅ 当前提供商: ${row.config_value}`);
      } else if (row.config_key.includes('_model')) {
        console.log(`✅ ${row.config_key}: ${row.config_value}`);
      } else if (row.config_key.includes('_api_key')) {
        try {
          const decrypted = encryption.decrypt(row.config_value);
          const masked = decrypted.substring(0, 15) + '***' + decrypted.substring(decrypted.length - 4);
          console.log(`✅ ${row.config_key}: ${masked}`);
          
          // 验证key格式
          if (row.config_key === 'openai_api_key') {
            if (decrypted.startsWith('sk-proj-') || decrypted.startsWith('sk-')) {
              console.log('   格式: OpenAI官方key ✅');
            } else {
              console.log('   格式: 未知格式 ⚠️');
            }
          } else if (row.config_key === 'deepseek_api_key') {
            if (decrypted.startsWith('sk-')) {
              console.log('   格式: DeepSeek key ✅');
            } else {
              console.log('   格式: 未知格式 ⚠️');
            }
          }
        } catch (e) {
          console.error(`❌ ${row.config_key}: 解密失败 -`, e.message);
        }
      }
    }
    
    // 查询最近的API调用日志
    console.log('\n=== 最近的API调用 ===\n');
    const [logs] = await pool.query(
      `SELECT request_type, response_status, response_time_ms, created_at 
       FROM ai_api_logs 
       ORDER BY created_at DESC 
       LIMIT 5`
    );
    
    logs.forEach(log => {
      console.log(`${log.request_type}: ${log.response_status}, ${log.response_time_ms}ms, ${log.created_at}`);
    });
    
    // 统计tokens使用
    console.log('\n=== Token使用统计 ===\n');
    const [stats] = await pool.query(
      `SELECT 
        request_type,
        COUNT(*) as total_calls,
        SUM(tokens_used) as total_tokens,
        AVG(response_time_ms) as avg_time
       FROM ai_api_logs 
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
       GROUP BY request_type`
    );
    
    stats.forEach(stat => {
      console.log(`${stat.request_type}:`);
      console.log(`  调用次数: ${stat.total_calls}`);
      console.log(`  总tokens: ${stat.total_tokens || 0}`);
      console.log(`  平均耗时: ${Math.round(stat.avg_time)}ms`);
    });
    
    await pool.end();
    process.exit(0);
    
  } catch (error) {
    console.error('检查失败:', error);
    process.exit(1);
  }
}

checkAIProvider();

