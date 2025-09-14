const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('smartflow.db');

console.log('🔍 分析震荡市边界判断无效的原因...\n');

// 查询震荡市边界判断的详细数据
db.all(`
  SELECT 
    symbol,
    market_type,
    range_lower_boundary_valid,
    range_upper_boundary_valid,
    bb_upper,
    bb_middle,
    bb_lower,
    range_touches_lower,
    range_touches_upper,
    last_breakout,
    full_analysis_data,
    timestamp
  FROM strategy_analysis 
  WHERE market_type = '震荡市' 
    AND timestamp > datetime('now', '-2 hours')
  ORDER BY timestamp DESC 
  LIMIT 5
`, (err, rows) => {
  if (err) {
    console.error('查询失败:', err);
    return;
  }
  
  console.log('📊 震荡市边界判断详细数据:');
  console.log('='.repeat(120));
  
  rows.forEach((row, index) => {
    console.log(`\n${index + 1}. 交易对: ${row.symbol}`);
    console.log(`   时间: ${row.timestamp}`);
    console.log(`   下边界有效: ${row.range_lower_boundary_valid}`);
    console.log(`   上边界有效: ${row.range_upper_boundary_valid}`);
    console.log(`   布林带上轨: ${row.bb_upper}`);
    console.log(`   布林带中轨: ${row.bb_middle}`);
    console.log(`   布林带下轨: ${row.bb_lower}`);
    console.log(`   下轨触碰次数: ${row.range_touches_lower}`);
    console.log(`   上轨触碰次数: ${row.range_touches_upper}`);
    console.log(`   最后突破: ${row.last_breakout}`);
    
    // 解析full_analysis_data中的边界判断详情
    if (row.full_analysis_data) {
      try {
        const analysisData = JSON.parse(row.full_analysis_data);
        if (analysisData.rangeResult) {
          console.log(`   边界判断总分: ${analysisData.rangeResult.totalScore || 'N/A'}`);
          console.log(`   因子得分详情:`);
          if (analysisData.rangeResult.factorScores) {
            Object.entries(analysisData.rangeResult.factorScores).forEach(([key, value]) => {
              console.log(`     - ${key}: ${value}`);
            });
          }
        }
      } catch (e) {
        console.log(`   分析数据解析失败: ${e.message}`);
      }
    }
    
    console.log('-'.repeat(80));
  });
  
  // 查询边界判断指标数据
  console.log('\n🔍 查询边界判断指标数据...\n');
  
  db.all(`
    SELECT 
      symbol,
      indicator_name,
      indicator_data,
      timestamp
    FROM indicator_monitoring 
    WHERE indicator_name = '震荡市1H边界判断'
      AND timestamp > datetime('now', '-2 hours')
    ORDER BY timestamp DESC 
    LIMIT 5
  `, (err, indicatorRows) => {
    if (err) {
      console.error('查询指标数据失败:', err);
      return;
    }
    
    console.log('📊 震荡市1H边界判断指标数据:');
    console.log('='.repeat(120));
    
    indicatorRows.forEach((row, index) => {
      console.log(`\n${index + 1}. 交易对: ${row.symbol}`);
      console.log(`   时间: ${row.timestamp}`);
      console.log(`   指标数据: ${row.indicator_data}`);
      
      try {
        const data = JSON.parse(row.indicator_data);
        console.log(`   总分: ${data.totalScore || 'N/A'}`);
        console.log(`   下边界有效: ${data.lowerBoundaryValid || 'N/A'}`);
        console.log(`   上边界有效: ${data.upperBoundaryValid || 'N/A'}`);
        if (data.factorScores) {
          console.log(`   因子得分:`);
          Object.entries(data.factorScores).forEach(([key, value]) => {
            console.log(`     - ${key}: ${value}`);
          });
        }
      } catch (e) {
        console.log(`   数据解析失败: ${e.message}`);
      }
      
      console.log('-'.repeat(80));
    });
    
    db.close();
  });
});

