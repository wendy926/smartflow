// main-new.js - 主入口文件（模块化版本）

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 DOM加载完成，开始初始化应用...');
  console.log('window.apiClient状态:', window.apiClient);
  console.log('window.apiClient类型:', typeof window.apiClient);

  // 等待所有模块加载完成
  const initApp = () => {
    if (window.apiClient && typeof SmartFlowApp !== 'undefined') {
      console.log('✅ 所有模块已就绪，初始化应用...');
      window.app = new SmartFlowApp();
      
      // 确保DataManager已初始化
      if (!window.dataManager) {
        console.log('🔧 初始化DataManager...');
        window.dataManager = new DataManager();
      }
      
      // 立即开始加载数据
      console.log('🔄 开始加载数据...');
      window.app.loadData();
      
      if (typeof testCategoryMapping === 'function') {
        testCategoryMapping();
      }
    } else {
      console.log('⏳ 等待模块加载...', {
        apiClient: !!window.apiClient,
        SmartFlowApp: typeof SmartFlowApp !== 'undefined'
      });
      setTimeout(initApp, 100);
    }
  };

  // 延迟初始化，确保所有脚本都加载完成
  setTimeout(initApp, 500);
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
