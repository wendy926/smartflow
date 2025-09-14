const DatabaseManager = require('./modules/database/DatabaseManager');

async function cleanOldData() {
    const db = new DatabaseManager();
    
    try {
        console.log('🔧 初始化数据库连接...');
        await db.init();
        
        console.log('🧹 清理过时的分析数据...');
        
        // 清理7天前的策略分析数据
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        
        const result = await db.runQuery(
            `DELETE FROM strategy_analysis WHERE timestamp < ?`,
            [sevenDaysAgo]
        );
        
        console.log(`✅ 清理了 ${result.changes} 条过时的策略分析数据`);
        
        // 清理过时的监控数据
        const monitorResult = await db.runQuery(
            `DELETE FROM data_quality_alerts WHERE created_at < ?`,
            [sevenDaysAgo]
        );
        
        console.log(`✅ 清理了 ${monitorResult.changes} 条过时的监控数据`);
        
        // 清理过时的K线数据（保留最近30天）
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        
        const klineResult = await db.runQuery(
            `DELETE FROM kline_data WHERE open_time < ?`,
            [thirtyDaysAgo]
        );
        
        console.log(`✅ 清理了 ${klineResult.changes} 条过时的K线数据`);
        
        console.log('\n✅ 数据清理完成!');
        
    } catch (error) {
        console.error('❌ 清理失败:', error.message);
    } finally {
        await db.close();
        console.log('🔒 数据库连接已关闭');
    }
}

cleanOldData();
