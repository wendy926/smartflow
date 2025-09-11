const puppeteer = require('puppeteer');

describe('监控中心页面测试', () => {
  let browser;
  let page;
  const baseUrl = 'http://localhost:8080';

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
    
    // 设置视口大小
    await page.setViewport({ width: 1280, height: 720 });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  describe('监控中心基本功能', () => {
    test('应该能够访问监控中心页面', async () => {
      const response = await page.goto(`${baseUrl}/monitoring.html`);
      expect(response.status()).toBe(200);
      
      const title = await page.title();
      expect(title).toContain('SmartFlow 统一监控中心');
    });

    test('应该显示系统概览数据', async () => {
      await page.goto(`${baseUrl}/monitoring.html`);
      
      // 等待页面加载完成
      await page.waitForSelector('.overview-cards', { timeout: 10000 });
      
      // 检查概览卡片是否存在
      const totalSymbols = await page.$eval('#totalSymbols', el => el.textContent);
      const healthySymbols = await page.$eval('#healthySymbols', el => el.textContent);
      const dataCollectionRate = await page.$eval('#dataCollectionRate', el => el.textContent);
      
      expect(totalSymbols).toBeDefined();
      expect(healthySymbols).toBeDefined();
      expect(dataCollectionRate).toBeDefined();
      expect(dataCollectionRate).toMatch(/\d+\.\d{2}%/);
    });

    test('应该能够切换到告警明细标签', async () => {
      await page.goto(`${baseUrl}/monitoring.html`);
      
      // 等待页面加载完成
      await page.waitForSelector('.monitoring-tabs', { timeout: 10000 });
      
      // 点击告警明细标签
      await page.click('button[onclick="switchMonitoringTab(\'alerts\')"]');
      
      // 等待告警视图显示
      await page.waitForSelector('#alertsView', { timeout: 5000 });
      
      // 检查告警视图是否激活
      const alertsView = await page.$('#alertsView');
      const isActive = await page.evaluate(el => el.classList.contains('active'), alertsView);
      expect(isActive).toBe(true);
    });

    test('应该显示告警过滤按钮', async () => {
      await page.goto(`${baseUrl}/monitoring.html`);
      
      // 切换到告警明细标签
      await page.click('button[onclick="switchMonitoringTab(\'alerts\')"]');
      await page.waitForSelector('#alertsView', { timeout: 5000 });
      
      // 检查过滤按钮是否存在
      const filterButtons = await page.$$('.filter-btn');
      expect(filterButtons.length).toBeGreaterThan(0);
      
      // 检查特定过滤按钮
      const allButton = await page.$('button[onclick="filterAlerts(\'all\')"]');
      const dataQualityButton = await page.$('button[onclick="filterAlerts(\'data-quality\')"]');
      const clearButton = await page.$('button[onclick="clearAllErrors()"]');
      
      expect(allButton).toBeTruthy();
      expect(dataQualityButton).toBeTruthy();
      expect(clearButton).toBeTruthy();
    });
  });

  describe('告警数据显示', () => {
    test('应该能够加载和显示告警数据', async () => {
      await page.goto(`${baseUrl}/monitoring.html`);
      
      // 切换到告警明细标签
      await page.click('button[onclick="switchMonitoringTab(\'alerts\')"]');
      await page.waitForSelector('#alertsView', { timeout: 5000 });
      
      // 等待告警数据加载
      await page.waitForSelector('#alertList', { timeout: 10000 });
      
      // 检查告警列表是否存在
      const alertList = await page.$('#alertList');
      expect(alertList).toBeTruthy();
      
      // 检查是否有告警项
      const alertItems = await page.$$('.alert-item');
      expect(alertItems.length).toBeGreaterThanOrEqual(0);
    });

    test('应该正确显示数据质量告警', async () => {
      await page.goto(`${baseUrl}/monitoring.html`);
      
      // 切换到告警明细标签
      await page.click('button[onclick="switchMonitoringTab(\'alerts\')"]');
      await page.waitForSelector('#alertsView', { timeout: 5000 });
      
      // 等待告警数据加载
      await page.waitForSelector('#alertList', { timeout: 10000 });
      
      // 检查是否有数据质量告警
      const dataQualityAlerts = await page.$$('.alert-item[data-type="data-quality"]');
      if (dataQualityAlerts.length > 0) {
        const firstAlert = dataQualityAlerts[0];
        const category = await page.evaluate(el => el.querySelector('.alert-category').textContent, firstAlert);
        expect(category).toBe('数据质量');
      }
    });

    test('应该正确显示数据收集率告警', async () => {
      await page.goto(`${baseUrl}/monitoring.html`);
      
      // 切换到告警明细标签
      await page.click('button[onclick="switchMonitoringTab(\'alerts\')"]');
      await page.waitForSelector('#alertsView', { timeout: 5000 });
      
      // 等待告警数据加载
      await page.waitForSelector('#alertList', { timeout: 10000 });
      
      // 检查是否有数据收集率告警
      const dataCollectionAlerts = await page.$$('.alert-item[data-type="data-collection"]');
      if (dataCollectionAlerts.length > 0) {
        const firstAlert = dataCollectionAlerts[0];
        const category = await page.evaluate(el => el.querySelector('.alert-category').textContent, firstAlert);
        const message = await page.evaluate(el => el.querySelector('.alert-message').textContent, firstAlert);
        
        expect(category).toBe('数据收集');
        expect(message).toMatch(/数据收集率过低: \d+\.\d{2}%/);
      }
    });
  });

  describe('告警过滤功能', () => {
    test('应该能够按类型过滤告警', async () => {
      await page.goto(`${baseUrl}/monitoring.html`);
      
      // 切换到告警明细标签
      await page.click('button[onclick="switchMonitoringTab(\'alerts\')"]');
      await page.waitForSelector('#alertsView', { timeout: 5000 });
      
      // 等待告警数据加载
      await page.waitForSelector('#alertList', { timeout: 10000 });
      
      // 点击数据质量过滤按钮
      await page.click('button[onclick="filterAlerts(\'data-quality\')"]');
      
      // 检查过滤是否生效
      const visibleAlerts = await page.$$eval('.alert-item', items => 
        items.filter(item => item.style.display !== 'none')
      );
      
      // 所有可见的告警都应该是数据质量类型
      for (const alert of visibleAlerts) {
        const alertType = await page.evaluate(el => el.dataset.type, alert);
        expect(alertType).toBe('data-quality');
      }
    });

    test('应该能够显示全部告警', async () => {
      await page.goto(`${baseUrl}/monitoring.html`);
      
      // 切换到告警明细标签
      await page.click('button[onclick="switchMonitoringTab(\'alerts\')"]');
      await page.waitForSelector('#alertsView', { timeout: 5000 });
      
      // 等待告警数据加载
      await page.waitForSelector('#alertList', { timeout: 10000 });
      
      // 点击全部过滤按钮
      await page.click('button[onclick="filterAlerts(\'all\')"]');
      
      // 检查所有告警都可见
      const allAlerts = await page.$$('.alert-item');
      const visibleAlerts = await page.$$eval('.alert-item', items => 
        items.filter(item => item.style.display !== 'none')
      );
      
      expect(visibleAlerts.length).toBe(allAlerts.length);
    });
  });

  describe('数据收集率显示格式', () => {
    test('应该显示两位小数的数据收集率', async () => {
      await page.goto(`${baseUrl}/monitoring.html`);
      
      // 等待页面加载完成
      await page.waitForSelector('.overview-cards', { timeout: 10000 });
      
      // 检查数据收集率格式
      const dataCollectionRate = await page.$eval('#dataCollectionRate', el => el.textContent);
      expect(dataCollectionRate).toMatch(/\d+\.\d{2}%/);
    });

    test('应该在交易对表格中显示两位小数的数据收集率', async () => {
      await page.goto(`${baseUrl}/monitoring.html`);
      
      // 等待页面加载完成
      await page.waitForSelector('.symbols-table', { timeout: 10000 });
      
      // 检查表格中的数据收集率格式
      const dataCollectionRates = await page.$$eval('.metric-rate', elements => 
        elements.map(el => el.textContent).filter(text => text.includes('%'))
      );
      
      if (dataCollectionRates.length > 0) {
        dataCollectionRates.forEach(rate => {
          expect(rate).toMatch(/\d+\.\d{2}%/);
        });
      }
    });
  });

  describe('API数据获取', () => {
    test('应该能够获取监控仪表板数据', async () => {
      const response = await page.goto(`${baseUrl}/api/monitoring-dashboard`);
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('summary');
      expect(data).toHaveProperty('detailedStats');
      expect(data.summary).toHaveProperty('completionRates');
      expect(data.summary).toHaveProperty('dataQuality');
      expect(data.summary).toHaveProperty('dataValidation');
    });

    test('监控数据应该包含正确的结构', async () => {
      const response = await page.goto(`${baseUrl}/api/monitoring-dashboard`);
      const data = await response.json();
      
      // 检查完成率结构
      expect(data.summary.completionRates).toHaveProperty('dataCollection');
      expect(data.summary.completionRates).toHaveProperty('signalAnalysis');
      expect(data.summary.completionRates).toHaveProperty('simulationTrading');
      
      // 检查数据质量结构
      expect(data.summary.dataQuality).toHaveProperty('hasIssues');
      expect(data.summary.dataQuality).toHaveProperty('issues');
      expect(data.summary.dataQuality).toHaveProperty('issueCount');
      
      // 检查数据验证结构
      expect(data.summary.dataValidation).toHaveProperty('hasErrors');
      expect(data.summary.dataValidation).toHaveProperty('errors');
      expect(data.summary.dataValidation).toHaveProperty('errorCount');
    });
  });
});
