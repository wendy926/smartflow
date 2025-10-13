/**
 * 聪明钱建仓标记 - 浏览器Console测试脚本
 * 
 * 使用方法：
 * 1. 访问 https://smart.aimaventop.com/smart-money
 * 2. 按 F12 打开浏览器开发者工具
 * 3. 切换到 Console 标签
 * 4. 复制粘贴下面的代码并回车执行
 * 5. 查看表格是否显示「💰 聪明钱建仓」标记
 */

console.log('🔍 开始测试聪明钱建仓标记显示逻辑...\n');

// ===== 第1步：检查API数据 =====
console.log('第1步：检查API数据...');
fetch('/api/v1/smart-money/detect')
  .then(r => r.json())
  .then(d => {
    console.log('✅ API响应成功');
    console.log('- 交易对数量:', d.data.length);
    console.log('- 第一条数据:', d.data[0]);
    console.log('- isSmartMoney字段:', d.data[0].isSmartMoney);
    console.log('- isTrap字段:', d.data[0].isTrap);
    console.log('');
  })
  .catch(err => console.error('❌ API请求失败:', err));

// ===== 第2步：检查前端渲染逻辑 =====
setTimeout(() => {
  console.log('第2步：检查前端渲染逻辑...');
  
  if (typeof smartMoneyTracker === 'undefined') {
    console.error('❌ smartMoneyTracker未初始化');
    return;
  }
  
  console.log('✅ smartMoneyTracker存在');
  console.log('- updateTable方法:', typeof smartMoneyTracker.updateTable);
  console.log('');
}, 1000);

// ===== 第3步：模拟聪明钱建仓数据 =====
setTimeout(() => {
  console.log('第3步：模拟聪明钱建仓数据并渲染...');
  
  const mockSmartMoneyData = [{
    symbol: "BTCUSDT",
    action: "ACCUMULATE",
    isSmartMoney: true,  // ← 关键：手动设为true
    isTrap: false,
    confidence: 0.85,
    reason: "测试数据：CVD上升, OI上升, 大额买单确认",
    indicators: {
      price: 64250,
      priceChange: 250,
      obi: 8500,
      obiZ: 2.8,
      cvd: 125000,
      cvdZ: 3.2,
      oi: 1500000,
      oiChange: 15000,
      oiZ: 2.5,
      volZ: 1.8,
      fundingRate: 0.0001
    },
    trend: {
      short: 1,
      med: 1,
      aligned: true
    },
    trap: null,
    swan: null,
    source: 'integrated_confirmed',
    largeOrder: {
      trackedEntriesCount: 5,
      buyScore: 8.5,
      sellScore: 2.1
    }
  }];
  
  console.log('📊 模拟数据:', mockSmartMoneyData[0]);
  console.log('');
  
  // 渲染到表格
  if (typeof smartMoneyTracker !== 'undefined') {
    smartMoneyTracker.updateTable(mockSmartMoneyData);
    console.log('✅ 数据已渲染到表格');
  }
}, 2000);

// ===== 第4步：检查DOM元素 =====
setTimeout(() => {
  console.log('第4步：检查DOM元素...');
  
  // 检查聪明钱建仓标记
  const smartMoneyBadge = document.querySelector('.smart-money-badge');
  
  if (smartMoneyBadge) {
    console.log('✅ 聪明钱建仓标记显示成功！');
    console.log('- 文字内容:', smartMoneyBadge.textContent.trim());
    console.log('- 背景样式:', window.getComputedStyle(smartMoneyBadge).background.substring(0, 50) + '...');
    console.log('- 是否有动画:', window.getComputedStyle(smartMoneyBadge).animationName);
    
    // 高亮标记（红色边框）
    smartMoneyBadge.style.border = '3px solid red';
    smartMoneyBadge.style.boxShadow = '0 0 15px red';
    
    console.log('');
    console.log('👆 聪明钱建仓标记已高亮显示（红色边框）！');
    console.log('');
  } else {
    console.error('❌ 未找到聪明钱建仓标记！');
    console.log('可能原因:');
    console.log('1. result.isSmartMoney 不是 true');
    console.log('2. 渲染逻辑有问题');
    console.log('3. CSS未加载');
  }
  
  // 检查动作badge
  const actionBadge = document.querySelector('.badge-accumulate');
  if (actionBadge) {
    console.log('✅ 动作badge显示正常:', actionBadge.textContent.trim());
  }
  
  // 检查表格行
  const tableRows = document.querySelectorAll('#smart-money-table-body tr');
  console.log('✅ 表格行数:', tableRows.length);
  
  console.log('');
  console.log('🎉 测试完成！');
  console.log('');
  console.log('📋 结论：');
  console.log('- 如果看到「💰 聪明钱建仓」标记（红色高亮） → 代码逻辑生效 ✅');
  console.log('- 如果未看到 → 检查上述可能原因');
  console.log('');
  console.log('💡 提示：真实市场数据需要满足4个条件才会显示标记');
  console.log('   1. action = ACCUMULATE 或 MARKUP');
  console.log('   2. confidence > 70%');
  console.log('   3. 有大额挂单（trackedEntriesCount > 0）');
  console.log('   4. isTrap = false');
  
}, 3000);

