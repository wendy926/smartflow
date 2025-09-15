// utils.js - 工具函数

// 检查表格滚动性
function checkTableScrollability() {
  const containers = document.querySelectorAll('.table-container');
  containers.forEach(container => {
    const table = container.querySelector('table');
    if (!table) return;

    const tableWidth = table.scrollWidth;
    const containerWidth = container.clientWidth;

    if (tableWidth > containerWidth) {
      container.classList.add('scrollable');
    } else {
      container.classList.remove('scrollable');
    }
  });
}

// 系统综合测试
async function runSystemTests() {
  const modal = new Modal();
  modal.showMessage('🧪 开始系统测试...', 'info');

  try {
    const results = [];

    // 1. 测试API连接
    try {
      const startTime = Date.now();
      await dataManager.getAllSignals();
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      results.push({
        test: 'API连接测试',
        status: '✅ 成功',
        details: `响应时间: ${responseTime}ms`,
        color: 'success'
      });
    } catch (error) {
      results.push({
        test: 'API连接测试',
        status: '❌ 失败',
        details: error.message,
        color: 'error'
      });
    }

    // 2. 测试Telegram机器人
    try {
      await dataManager.testDataQualityAlert();
      results.push({
        test: 'Telegram机器人测试',
        status: '✅ 成功',
        details: '告警消息已发送',
        color: 'success'
      });
    } catch (error) {
      results.push({
        test: 'Telegram机器人测试',
        status: '❌ 失败',
        details: error.message,
        color: 'error'
      });
    }

    // 3. 测试数据监控
    try {
      const monitoringData = await dataManager.getMonitoringDashboard();
      results.push({
        test: '数据监控测试',
        status: '✅ 成功',
        details: `监控数据正常，共${monitoringData.data?.totalSymbols || 0}个交易对`,
        color: 'success'
      });
    } catch (error) {
      results.push({
        test: '数据监控测试',
        status: '❌ 失败',
        details: error.message,
        color: 'error'
      });
    }

    // 4. 测试缓存功能
    try {
      const cachedData = localStorage.getItem('smartflow_cached_data');
      if (cachedData) {
        const data = JSON.parse(cachedData);
        const cacheAge = Date.now() - data.timestamp;
        results.push({
          test: '缓存功能测试',
          status: '✅ 成功',
          details: `缓存数据存在，年龄: ${Math.round(cacheAge / 1000)}秒`,
          color: 'success'
        });
      } else {
        results.push({
          test: '缓存功能测试',
          status: '⚠️ 警告',
          details: '缓存数据不存在',
          color: 'warning'
        });
      }
    } catch (error) {
      results.push({
        test: '缓存功能测试',
        status: '❌ 失败',
        details: error.message,
        color: 'error'
      });
    }

    // 5. 测试用户设置
    try {
      const settings = await window.apiClient.getUserSettings();
      results.push({
        test: '用户设置测试',
        status: '✅ 成功',
        details: `设置加载成功，最大损失: ${settings?.maxLossAmount || '100'} USDT`,
        color: 'success'
      });
    } catch (error) {
      results.push({
        test: '用户设置测试',
        status: '❌ 失败',
        details: error.message,
        color: 'error'
      });
    }

    // 显示测试结果
    const successCount = results.filter(r => r.color === 'success').length;
    const totalCount = results.length;

    let resultHtml = `
      <div class="test-results">
        <h4>🧪 系统测试结果</h4>
        <div class="test-summary">
          <div class="summary-item success">✅ 成功: ${successCount}</div>
          <div class="summary-item warning">⚠️ 警告: ${results.filter(r => r.color === 'warning').length}</div>
          <div class="summary-item error">❌ 失败: ${results.filter(r => r.color === 'error').length}</div>
        </div>
        <div class="test-details">
    `;

    results.forEach(result => {
      resultHtml += `
        <div class="test-item ${result.color}">
          <div class="test-name">${result.test}</div>
          <div class="test-status">${result.status}</div>
          <div class="test-details">${result.details}</div>
        </div>
      `;
    });

    resultHtml += `
        </div>
        <div class="test-actions" style="margin-top: 20px; text-align: center;">
          <button class="btn primary" onclick="viewTelegramConfig()">📱 查看Telegram配置</button>
          <button class="btn secondary" onclick="modal.close()">关闭</button>
        </div>
      </div>
    `;

    modal.showMessage(resultHtml, successCount === totalCount ? 'success' : 'warning');

  } catch (error) {
    console.error('系统测试失败:', error);
    modal.showMessage('系统测试失败: ' + error.message, 'error');
  }
}

// 测试分类映射函数
function testCategoryMapping() {
  if (window.app) {
    console.log('🧪 测试分类映射函数:');
    console.log('high-cap-trending ->', window.app.getCategoryDisplay('high-cap-trending'));
    console.log('mainstream ->', window.app.getCategoryDisplay('mainstream'));
    console.log('unknown ->', window.app.getCategoryDisplay('unknown'));
  }
}

// 手动刷新数据函数
async function refreshData() {
  try {
    console.log('🔄 开始手动刷新数据...');

    // 清除缓存
    try {
      localStorage.removeItem('smartflow_cached_data');
      console.log('🗑️ 已清除localStorage缓存');
    } catch (error) {
      console.error('清除localStorage缓存失败:', error);
    }

    // 显示加载状态
    app.showLoading(true);

    // 重新加载数据
    await app.loadAllData();
    console.log('✅ 手动数据刷新完成');
  } catch (error) {
    console.error('❌ 刷新数据失败:', error);
    modal.showMessage('刷新数据失败: ' + error.message, 'error');
  } finally {
    app.showLoading(false);
  }
}

// 显示数据验证详情
function showDataValidationDetails(errors) {
  let content = '<div class="validation-details"><h4>📊 数据验证详情</h4><ul>';

  errors.forEach(error => {
    content += `<li class="validation-error">❌ ${error}</li>`;
  });

  content += '</ul></div>';

  modal.show('数据验证详情', content);
}

// 显示数据质量问题详情
function showDataQualityDetails(issues) {
  let content = '<div class="quality-details"><h4>📊 数据质量问题详情</h4><ul>';

  issues.forEach(issue => {
    content += `<li class="quality-issue">⚠️ ${issue}</li>`;
  });

  content += '</ul></div>';

  modal.show('数据质量问题详情', content);
}

// 测试API连接
async function testAPIConnection() {
  try {
    app.showLoading(true);
    await window.apiClient.getAllSignals();
    modal.showMessage('API连接正常', 'success');
  } catch (error) {
    console.error('API连接测试失败:', error);
    modal.showMessage('API连接测试失败: ' + error.message, 'error');
  } finally {
    app.showLoading(false);
  }
}
