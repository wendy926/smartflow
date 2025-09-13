const DatabaseManager = require('./modules/database/DatabaseManager');

/**
 * 数据库结构修复脚本
 * 创建缺失的表结构
 */
async function fixDatabaseSchema() {
    const db = new DatabaseManager();
    
    try {
        await db.init();
        console.log('🔧 开始修复数据库结构...\n');
        
        // 1. 创建kline_data表
        console.log('📊 创建kline_data表...');
        await db.run(`
            CREATE TABLE IF NOT EXISTS kline_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL,
                interval TEXT NOT NULL,
                open_time INTEGER NOT NULL,
                close_time INTEGER NOT NULL,
                open_price REAL NOT NULL,
                high_price REAL NOT NULL,
                low_price REAL NOT NULL,
                close_price REAL NOT NULL,
                volume REAL NOT NULL,
                quote_volume REAL NOT NULL,
                trades_count INTEGER NOT NULL,
                taker_buy_volume REAL NOT NULL,
                taker_buy_quote_volume REAL NOT NULL,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                UNIQUE(symbol, interval, open_time)
            )
        `);
        
        // 创建索引
        await db.run(`
            CREATE INDEX IF NOT EXISTS idx_kline_data_symbol_interval 
            ON kline_data(symbol, interval, open_time)
        `);
        
        // 2. 创建data_quality_issues表
        console.log('⚠️ 创建data_quality_issues表...');
        await db.run(`
            CREATE TABLE IF NOT EXISTS data_quality_issues (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL,
                issue_type TEXT NOT NULL,
                severity TEXT NOT NULL DEFAULT 'WARNING',
                message TEXT NOT NULL,
                details TEXT,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                resolved_at INTEGER,
                resolved_by TEXT
            )
        `);
        
        // 创建索引
        await db.run(`
            CREATE INDEX IF NOT EXISTS idx_data_quality_symbol_created 
            ON data_quality_issues(symbol, created_at)
        `);
        
        // 3. 创建analysis_logs表（如果不存在）
        console.log('📝 创建analysis_logs表...');
        await db.run(`
            CREATE TABLE IF NOT EXISTS analysis_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL,
                analysis_type TEXT NOT NULL,
                start_time INTEGER NOT NULL,
                end_time INTEGER,
                status TEXT NOT NULL DEFAULT 'RUNNING',
                result_data TEXT,
                error_message TEXT,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `);
        
        // 4. 检查现有表结构
        console.log('\n📋 检查现有表结构...');
        const tables = await db.runQuery(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        `);
        
        console.log('现有表：');
        tables.forEach(table => {
            console.log(`  - ${table.name}`);
        });
        
        // 5. 检查kline_data表的数据
        console.log('\n📊 检查kline_data表数据...');
        let klineCount = [];
        try {
            klineCount = await db.runQuery(`
                SELECT symbol, interval, COUNT(*) as count 
                FROM kline_data 
                GROUP BY symbol, interval 
                ORDER BY symbol, interval
            `);
            
            if (klineCount.length > 0) {
                console.log('K线数据统计：');
                klineCount.forEach(row => {
                    console.log(`  ${row.symbol} ${row.interval}: ${row.count}条`);
                });
            } else {
                console.log('  K线数据表为空');
            }
        } catch (error) {
            console.log('  K线数据表查询失败:', error.message);
        }
        
        // 6. 检查data_quality_issues表的数据
        console.log('\n⚠️ 检查data_quality_issues表数据...');
        let qualityCount = [];
        try {
            qualityCount = await db.runQuery(`
                SELECT issue_type, COUNT(*) as count 
                FROM data_quality_issues 
                GROUP BY issue_type 
                ORDER BY count DESC
            `);
            
            if (qualityCount.length > 0) {
                console.log('数据质量问题统计：');
                qualityCount.forEach(row => {
                    console.log(`  ${row.issue_type}: ${row.count}个`);
                });
            } else {
                console.log('  数据质量问题表为空');
            }
        } catch (error) {
            console.log('  数据质量问题表查询失败:', error.message);
        }
        
        console.log('\n✅ 数据库结构修复完成！');
        
        return {
            success: true,
            tables: tables.map(t => t.name),
            klineCount: klineCount?.length || 0,
            qualityCount: qualityCount?.length || 0
        };
        
    } catch (error) {
        console.error('❌ 数据库结构修复失败:', error.message);
        return {
            success: false,
            error: error.message
        };
    } finally {
        await db.close();
    }
}

// 运行修复
fixDatabaseSchema().then(result => {
    if (result.success) {
        console.log('\n🎉 数据库结构修复成功！');
        process.exit(0);
    } else {
        console.log('\n⚠️ 数据库结构修复失败！');
        process.exit(1);
    }
}).catch(error => {
    console.error('❌ 修复执行失败:', error.message);
    process.exit(1);
});
