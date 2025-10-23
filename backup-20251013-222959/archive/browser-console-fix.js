/**
 * 浏览器Console修复脚本
 * 
 * 如果页面显示数据为0，打开浏览器Console (F12)，
 * 复制这整个脚本粘贴到Console中运行
 */

(async function forceUpdateDisplay() {
  console.log('='.repeat(80));
  console.log('🔧 开始强制更新页面数据显示');
  console.log('='.repeat(80));
  console.log();

  try {
    // 1. 测试Settings API
    console.log('📡 测试Settings API...');
    const settingsResponse = await fetch('/api/v1/settings/maxLossAmount');
    const settingsData = await settingsResponse.json();
    console.log('Settings API响应:', settingsData);
    console.log(`✅ 最大损失金额: ${settingsData.value} USDT`);
    console.log();

    // 2. 测试统计API
    console.log('📡 测试统计API...');
    const statsResponse = await fetch('/api/v1/strategies/statistics');
    const statsData = await statsResponse.json();
    console.log('统计API响应:', statsData);
    console.log();

    if (!statsData.success) {
      throw new Error('统计API返回失败');
    }

    const stats = statsData.data;

    // 3. 显示数据
    console.log('📊 实际数据:');
    console.log(`V3策略: ${stats.v3.totalTrades}笔交易, 胜率${stats.v3.winRate}%, 总盈亏${stats.v3.totalPnl} USDT`);
    console.log(`ICT策略: ${stats.ict.totalTrades}笔交易, 胜率${stats.ict.winRate}%, 总盈亏${stats.ict.totalPnl} USDT`);
    console.log();

    // 4. 检查DOM元素
    console.log('🔍 检查DOM元素...');
    const v3Element = document.getElementById('v3-stats');
    const ictElement = document.getElementById('ict-stats');

    if (!v3Element) {
      console.error('❌ 找不到v3-stats元素！当前可能不在strategies页面');
      console.log('请访问: https://smart.aimaventop.com/strategies');
      return;
    }

    console.log('✅ v3-stats元素找到');
    console.log('✅ ict-stats元素找到');
    console.log();

    // 5. 强制更新V3统计
    console.log('🔄 更新V3统计...');
    const v3Stats = stats.v3;

    const v3TotalTrades = v3Element.querySelector('.total-trades');
    const v3Profitable = v3Element.querySelector('.profitable-trades');
    const v3Losing = v3Element.querySelector('.losing-trades');
    const v3WinRate = v3Element.querySelector('.win-rate');
    const v3TotalPnl = v3Element.querySelector('.total-pnl');
    const v3MaxDrawdown = v3Element.querySelector('.max-drawdown');

    if (v3TotalTrades) v3TotalTrades.textContent = v3Stats.totalTrades;
    if (v3Profitable) v3Profitable.textContent = v3Stats.profitableTrades;
    if (v3Losing) v3Losing.textContent = v3Stats.losingTrades;
    if (v3WinRate) v3WinRate.textContent = `${v3Stats.winRate}%`;
    if (v3TotalPnl) {
      const pnl = v3Stats.totalPnl;
      v3TotalPnl.textContent = pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;
      v3TotalPnl.className = `stat-value total-pnl ${pnl >= 0 ? 'positive' : 'negative'}`;
    }
    if (v3MaxDrawdown) v3MaxDrawdown.textContent = `${v3Stats.maxDrawdown}%`;

    console.log('✅ V3统计已更新');
    console.log();

    // 6. 强制更新ICT统计
    console.log('🔄 更新ICT统计...');
    const ictStats = stats.ict;

    const ictTotalTrades = ictElement.querySelector('.total-trades');
    const ictProfitable = ictElement.querySelector('.profitable-trades');
    const ictLosing = ictElement.querySelector('.losing-trades');
    const ictWinRate = ictElement.querySelector('.win-rate');
    const ictTotalPnl = ictElement.querySelector('.total-pnl');
    const ictMaxDrawdown = ictElement.querySelector('.max-drawdown');

    if (ictTotalTrades) ictTotalTrades.textContent = ictStats.totalTrades;
    if (ictProfitable) ictProfitable.textContent = ictStats.profitableTrades;
    if (ictLosing) ictLosing.textContent = ictStats.losingTrades;
    if (ictWinRate) ictWinRate.textContent = `${ictStats.winRate}%`;
    if (ictTotalPnl) {
      const pnl = ictStats.totalPnl;
      ictTotalPnl.textContent = pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;
      ictTotalPnl.className = `stat-value total-pnl ${pnl >= 0 ? 'positive' : 'negative'}`;
    }
    if (ictMaxDrawdown) ictMaxDrawdown.textContent = `${ictStats.maxDrawdown}%`;

    console.log('✅ ICT统计已更新');
    console.log();

    // 7. 测试交易记录API
    console.log('📡 测试交易记录API...');
    const tradesResponse = await fetch('/api/v1/trades?limit=100');
    const tradesData = await tradesResponse.json();
    console.log(`✅ 获取到 ${tradesData.count} 条交易记录`);

    const closedTrades = tradesData.data.filter(t => t.status === 'CLOSED');
    console.log(`   其中已关闭: ${closedTrades.length} 条`);
    console.log();

    // 8. 完成
    console.log('='.repeat(80));
    console.log('✅ 强制更新完成！');
    console.log('='.repeat(80));
    console.log();
    console.log('📊 当前显示:');
    console.log(`   V3: ${v3Stats.totalTrades}笔交易, ${v3Stats.winRate}%胜率, ${v3Stats.totalPnl >= 0 ? '+' : ''}$${v3Stats.totalPnl.toFixed(2)}`);
    console.log(`   ICT: ${ictStats.totalTrades}笔交易, ${ictStats.winRate}%胜率, ${ictStats.totalPnl >= 0 ? '+' : ''}$${ictStats.totalPnl.toFixed(2)}`);
    console.log();
    console.log('💡 提示: 如果还是显示0，请执行以下操作:');
    console.log('   1. 清除浏览器缓存（Ctrl+Shift+Delete）');
    console.log('   2. 关闭所有标签页');
    console.log('   3. 重新打开浏览器');
    console.log('   4. 访问 https://smart.aimaventop.com/strategies');

  } catch (error) {
    console.error('❌ 强制更新失败:', error);
    console.error('错误详情:', error.stack);
    console.log();
    console.log('🔧 故障排查:');
    console.log('   1. 确认当前在strategies页面（不是dashboard或其他页面）');
    console.log('   2. 检查Network标签，API调用是否成功');
    console.log('   3. 尝试硬刷新页面（Ctrl+Shift+R）');
  }
})();

