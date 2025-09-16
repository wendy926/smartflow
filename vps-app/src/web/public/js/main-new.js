// main-new.js - 主入口文件（模块化版本）

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 DOM加载完成，开始初始化应用...');
  console.log('window.apiClient状态:', window.apiClient);
  console.log('window.apiClient类型:', typeof window.apiClient);

  // 等待API客户端初始化完成
  const initApp = () => {
    if (window.apiClient) {
      console.log('✅ API客户端已就绪，初始化应用...');
      window.app = new SmartFlowApp();
      testCategoryMapping();
    } else {
      console.log('⏳ 等待API客户端初始化...');
      setTimeout(initApp, 100);
    }
  };

  initApp();
});

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
