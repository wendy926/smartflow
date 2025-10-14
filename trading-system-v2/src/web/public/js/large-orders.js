/**
 * 大额挂单监控前端交互
 * V2.1.0
 */

class LargeOrdersTracker {
  constructor() {
    this.refreshInterval = null;
    this.currentSymbol = 'BTCUSDT';
    this.init();
  }

  init() {
    // 绑定刷新按钮
    const refreshBtn = document.getElementById('refresh-large-orders-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadHistoricalData());
    }

    // 绑定查询按钮
    const persistentBtn = document.getElementById('query-persistent-orders-btn');
    if (persistentBtn) {
      persistentBtn.addEventListener('click', () => this.queryPersistentOrders());
    }

    const megaBtn = document.getElementById('query-mega-orders-btn');
    if (megaBtn) {
      megaBtn.addEventListener('click', () => this.queryMegaOrders());
    }

    // 绑定内联查询按钮
    const persistentInlineBtn = document.getElementById('query-persistent-orders-inline');
    if (persistentInlineBtn) {
      persistentInlineBtn.addEventListener('click', () => this.queryPersistentOrders());
    }

    const megaInlineBtn = document.getElementById('query-mega-orders-inline');
    if (megaInlineBtn) {
      megaInlineBtn.addEventListener('click', () => this.queryMegaOrders());
    }

    // 初次加载历史数据
    this.loadHistoricalData();
  }

  /**
   * 加载7天历史聚合数据
   */
  async loadHistoricalData() {
    try {
      console.log('[LargeOrders] 加载7天历史数据...');
      const response = await fetch('/api/v1/large-orders/history-aggregated?symbols=BTCUSDT,ETHUSDT&days=7');
      const result = await response.json();
      console.log('[LargeOrders] 历史数据:', result);

      if (result.success && result.data) {
        this.renderHistoricalView(result.data);
        this.updateLastUpdate();
      } else {
        this.showError('加载历史数据失败');
      }
    } catch (error) {
      console.error('[LargeOrders] 加载历史数据失败', error);
      this.showError('加载失败: ' + error.message);
    }
  }

  /**
   * 渲染历史视图（双面板）
   */
  renderHistoricalView(data) {
    const container = document.getElementById('large-order-summary-content');
    if (!container) return;

    console.log('[LargeOrders] 渲染历史视图，数据:', data);

    // 确保即使没有数据也显示空面板
    const btcData = data.BTCUSDT || { symbol: 'BTCUSDT', stats: { totalOrders: 0, newOrders: 0, activeOrders: 0 }, orders: [] };
    const ethData = data.ETHUSDT || { symbol: 'ETHUSDT', stats: { totalOrders: 0, newOrders: 0, activeOrders: 0 }, orders: [] };

    console.log('[LargeOrders] BTC数据:', btcData);
    console.log('[LargeOrders] ETH数据:', ethData);

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        ${this.generateHistoricalPanel(btcData)}
        ${this.generateHistoricalPanel(ethData)}
      </div>
    `;
  }

  /**
   * 生成历史面板
   */
  generateHistoricalPanel(data) {
    const { symbol, stats = {}, orders = [] } = data;
    const newCount = stats.newOrders || 0;
    const activeCount = stats.activeOrders || 0;
    const totalCount = stats.totalOrders || 0;

    console.log(`[LargeOrders] 生成${symbol}面板，订单数:`, orders.length);

    // 过滤出单笔价值>10M的订单
    const filteredOrders = orders.filter(o => (o.valueUSD || 0) >= 10000000);
    console.log(`[LargeOrders] ${symbol}过滤后订单数(>10M):`, filteredOrders.length);

    // 计算买卖对比（side字段可能是buy/sell或bid/ask）
    const buyOrders = filteredOrders.filter(o => o.side === 'buy' || o.side === 'bid');
    const sellOrders = filteredOrders.filter(o => o.side === 'sell' || o.side === 'ask');

    // 区分长期挂单和短期新增挂单（基于过滤后的订单）
    const longTermOrders = filteredOrders.filter(o => !o.isNew && o.isActive); // 长期活跃挂单
    const shortTermOrders = filteredOrders.filter(o => o.isNew); // 短期新增挂单

    // 长期挂单的买卖比例
    const longTermBuyOrders = longTermOrders.filter(o => o.side === 'buy' || o.side === 'bid');
    const longTermSellOrders = longTermOrders.filter(o => o.side === 'sell' || o.side === 'ask');

    // 计算总价值
    const longTermBuyValue = longTermBuyOrders.reduce((sum, o) => sum + (o.valueUSD || 0), 0);
    const longTermSellValue = longTermSellOrders.reduce((sum, o) => sum + (o.valueUSD || 0), 0);
    const shortTermBuyValue = shortTermOrders.filter(o => o.side === 'buy' || o.side === 'bid').reduce((sum, o) => sum + (o.valueUSD || 0), 0);
    const shortTermSellValue = shortTermOrders.filter(o => o.side === 'sell' || o.side === 'ask').reduce((sum, o) => sum + (o.valueUSD || 0), 0);
    const buyValueSum = buyOrders.reduce((sum, o) => sum + (o.valueUSD || o.maxValueUSD || 0), 0);
    const sellValueSum = sellOrders.reduce((sum, o) => sum + (o.valueUSD || o.maxValueUSD || 0), 0);
    const totalValue = buyValueSum + sellValueSum;
    const buyPercent = totalValue > 0 ? (buyValueSum / totalValue * 100).toFixed(1) : 0;
    const sellPercent = totalValue > 0 ? (sellValueSum / totalValue * 100).toFixed(1) : 0;

    console.log(`[LargeOrders] ${symbol} 买卖统计:`, {
      买方订单数: buyOrders.length,
      卖方订单数: sellOrders.length,
      买方价值: (buyValueSum / 1000000).toFixed(1) + 'M',
      卖方价值: (sellValueSum / 1000000).toFixed(1) + 'M',
      买方占比: buyPercent + '%',
      卖方占比: sellPercent + '%'
    });

    // 区分BTC和ETH的颜色标识
    const symbolColor = symbol === 'BTCUSDT' ? '#f7931a' : '#627eea';  // BTC橙色 vs ETH蓝色
    const symbolIcon = symbol === 'BTCUSDT' ? '₿' : 'Ξ';  // BTC符号 vs ETH符号

    return `
      <div class="historical-panel" style="
        background: white; 
        border-radius: 8px; 
        padding: 20px; 
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        border-top: 4px solid ${symbolColor};
      ">
        <!-- 头部 -->
        <div style="border-bottom: 2px solid #e9ecef; padding-bottom: 15px; margin-bottom: 15px;">
          <h3 style="margin: 0 0 10px 0; font-size: 24px; display: flex; align-items: center; gap: 10px;">
            <span style="
              background: ${symbolColor}; 
              color: white; 
              padding: 6px 12px; 
              border-radius: 6px;
              font-weight: 700;
              display: flex;
              align-items: center;
              gap: 6px;
            ">
              ${symbolIcon} ${symbol}
            </span>
            <span style="font-size: 14px; color: #28a745;">● 监控中</span>
            <span style="font-size: 11px; color: #999; margin-left: auto;">
              💡 大额挂单：单笔 > 10M USD
            </span>
          </h3>
          
          <!-- 统计信息 -->
          <div style="display: flex; gap: 20px; font-size: 13px; flex-wrap: wrap; margin-bottom: 12px;">
            <span style="color: #666;">
              📊 7天累计追踪: <strong style="color: #333;">${totalCount}个</strong>
            </span>
            <span style="color: #666;">
              🆕 短期新增: <strong style="color: #ffc107;">${shortTermOrders.length}个</strong>
            </span>
            <span style="color: #666;">
              ⚡ 长期活跃: <strong style="color: #28a745;">${longTermOrders.length}个</strong>
            </span>
          </div>
          
          <!-- 长期挂单买卖比例 -->
          ${longTermOrders.length > 0 ? `
          <div style="margin-bottom: 12px; padding: 10px; background: #f8f9fa; border-radius: 6px; border-left: 3px solid #28a745;">
            <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
              <strong>长期挂单 (>1小时，>10M USD)</strong>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="color: #28a745; font-weight: 600;">
                🟢 买方 ${longTermBuyOrders.length}个 (${longTermBuyValue + longTermSellValue > 0 ? ((longTermBuyValue / (longTermBuyValue + longTermSellValue)) * 100).toFixed(1) : 0}%)
              </span>
              <span style="color: #dc3545; font-weight: 600;">
                🔴 卖方 ${longTermSellOrders.length}个 (${longTermBuyValue + longTermSellValue > 0 ? ((longTermSellValue / (longTermBuyValue + longTermSellValue)) * 100).toFixed(1) : 0}%)
              </span>
            </div>
            <div style="font-size: 11px; color: #666;">
              总价值: ${((longTermBuyValue + longTermSellValue) / 1000000).toFixed(1)}M USD
            </div>
          </div>
          ` : ''}
          
          <!-- 短期新增挂单统计 -->
          ${shortTermOrders.length > 0 ? `
          <div style="margin-bottom: 12px; padding: 10px; background: #fff3cd; border-radius: 6px; border-left: 3px solid #ffc107;">
            <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
              <strong>短期新增挂单 (<1小时)</strong>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="color: #28a745; font-weight: 600;">
                🟢 买方 ${shortTermOrders.filter(o => o.side === 'buy' || o.side === 'bid').length}个 (${shortTermBuyValue + shortTermSellValue > 0 ? ((shortTermBuyValue / (shortTermBuyValue + shortTermSellValue)) * 100).toFixed(1) : 0}%)
              </span>
              <span style="color: #dc3545; font-weight: 600;">
                🔴 卖方 ${shortTermOrders.filter(o => o.side === 'sell' || o.side === 'ask').length}个 (${shortTermBuyValue + shortTermSellValue > 0 ? ((shortTermSellValue / (shortTermBuyValue + shortTermSellValue)) * 100).toFixed(1) : 0}%)
              </span>
            </div>
            <div style="font-size: 11px; color: #666;">
              总价值: ${((shortTermBuyValue + shortTermSellValue) / 1000000).toFixed(1)}M USD
            </div>
          </div>
          ` : ''}

          <!-- 买卖力量对比条 -->
          <div style="margin-top: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 12px;">
              <span style="color: #28a745; font-weight: 600;">
                🟢 买方 ${buyOrders.length}个 (${buyPercent}%)
              </span>
              <span style="color: #dc3545; font-weight: 600;">
                🔴 卖方 ${sellOrders.length}个 (${sellPercent}%)
              </span>
            </div>
            <div style="display: flex; height: 24px; border-radius: 6px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <div style="
                background: linear-gradient(90deg, #28a745 0%, #20c997 100%);
                width: ${buyPercent}%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 11px;
                font-weight: 600;
                transition: width 0.5s ease;
              ">
                ${buyPercent > 10 ? `${buyPercent}%` : ''}
              </div>
              <div style="
                background: linear-gradient(90deg, #fd7e14 0%, #dc3545 100%);
                width: ${sellPercent}%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 11px;
                font-weight: 600;
                transition: width 0.5s ease;
              ">
                ${sellPercent > 10 ? `${sellPercent}%` : ''}
              </div>
            </div>
            <div style="margin-top: 5px; font-size: 10px; color: #999; text-align: center;">
              ⚠️ 对比条表示：7天内追踪到的大额挂单买卖数量/价值对比
            </div>
          </div>
        </div>

        <!-- 挂单列表 -->
        <div style="max-height: 400px; overflow-y: auto;">
          ${filteredOrders.length > 0 ? `
            <!-- 说明信息 -->
            <div style="margin-bottom: 10px; padding: 8px 12px; background: #e3f2fd; border-radius: 4px; font-size: 11px; color: #1976d2;">
              <strong>📋 超大额挂单列表说明：</strong>
              <br/>• <strong>显示条件</strong>：仅显示单笔价值 > 10M USD 的挂单
              <br/>• <strong>出现次数</strong>：同一价格档位在7天历史记录中被检测到的次数
              <br/>• <strong>长期挂单</strong>：存在时间>1小时，通常代表机构或大户的真实意图
              <br/>• <strong>短期新增</strong>：<1小时的新挂单，可能是试探性或临时性订单
            </div>
            <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
              <thead style="position: sticky; top: 0; background: #f8f9fa; z-index: 10;">
                <tr style="border-bottom: 2px solid #dee2e6;">
                  <th style="padding: 10px 8px; text-align: left;">状态</th>
                  <th style="padding: 10px 8px; text-align: right;">价格</th>
                  <th style="padding: 10px 8px; text-align: right;">价值</th>
                  <th style="padding: 10px 8px; text-align: center;">出现次数</th>
                  <th style="padding: 10px 8px; text-align: right;">时间跨度</th>
                </tr>
              </thead>
              <tbody>
                ${filteredOrders.map(order => this.generateHistoricalRow(order)).join('')}
              </tbody>
            </table>
          ` : `
            <div style="text-align: center; padding: 60px 20px; color: #999;">
              <div style="font-size: 48px; margin-bottom: 15px;">📊</div>
              <div style="font-size: 14px; font-weight: 500; color: #666; margin-bottom: 8px;">7天内无超大额挂单追踪记录</div>
              <div style="font-size: 12px; color: #aaa;">超大额挂单定义：单笔价值 > 10M USD</div>
              <div style="font-size: 12px; color: #aaa; margin-top: 5px;">WebSocket实时监控中...</div>
            </div>
          `}
        </div>
      </div>
    `;
  }

  /**
   * 生成历史行
   */
  generateHistoricalRow(order) {
    const bgColor = order.isNew
      ? '#fff3cd'  // 新增：黄色
      : order.isActive
        ? '#d4edda'  // 活跃：绿色
        : '#ffffff'; // 历史：白色

    const borderLeft = order.isNew
      ? '3px solid #ffc107'
      : order.isActive
        ? '3px solid #28a745'
        : '1px solid #e9ecef';

    const statusIcon = order.isNew
      ? '<span style="color: #ffc107; font-weight: bold;">🆕</span>'
      : order.isActive
        ? '<span style="color: #28a745;">●</span>'
        : '<span style="color: #9ca3af;">○</span>';

    // 修复：检查side字段（可能是buy/sell或bid/ask）
    const isBuy = order.side === 'buy' || order.side === 'bid';
    const sideColor = isBuy ? '#28a745' : '#dc3545';
    const sideText = isBuy ? 'BUY' : 'SELL';

    // 安全获取字段值（兼容不同数据结构）
    const price = order.price || order.avgPrice || 0;
    const valueUSD = order.valueUSD || order.maxValueUSD || 0;
    const appearances = order.appearances || order.snapshotCount || 1;
    const firstSeen = order.firstSeen || order.firstSeenTime || Date.now();
    const lastSeen = order.lastSeen || order.lastSeenTime || Date.now();

    return `
      <tr style="background: ${bgColor}; border-left: ${borderLeft};">
        <td style="padding: 10px;">
          ${statusIcon}
          <span style="color: ${sideColor}; font-weight: 600; margin-left: 5px;">${sideText}</span>
        </td>
        <td style="padding: 10px; text-align: right; font-weight: 600;">
          $${typeof price === 'number' ? price.toLocaleString() : price}
        </td>
        <td style="padding: 10px; text-align: right;">
          ${(valueUSD / 1000000).toFixed(1)}M
        </td>
        <td style="padding: 10px; text-align: center;">
          ${appearances}次
        </td>
        <td style="padding: 10px; text-align: right; font-size: 11px; color: #666;">
          ${this.formatTimeAgo(firstSeen)} -<br/>
          ${this.formatTimeAgo(lastSeen)}
        </td>
      </tr>
    `;
  }

  /**
   * 格式化相对时间
   */
  formatTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}天前`;
    if (hours > 0) return `${hours}小时前`;
    if (minutes > 0) return `${minutes}分钟前`;
    return '刚刚';
  }

  async loadData() {
    try {
      console.log('[LargeOrders] 开始加载数据...');
      const response = await fetch('/api/v1/large-orders/detect');
      const result = await response.json();
      console.log('[LargeOrders] API响应:', result);

      if (result.success && result.data && result.data.length > 0) {
        // V2.1.2：支持多交易对显示
        this.renderMultipleSymbols(result.data);
        this.updateLastUpdate();
      } else {
        console.warn('[LargeOrders] 无数据返回');
        this.showError('暂无数据');
      }
    } catch (error) {
      console.error('[LargeOrders] 加载失败', error);
      this.showError('加载失败: ' + error.message);
    }
  }

  /**
   * 渲染多个交易对（新增）
   */
  renderMultipleSymbols(dataArray) {
    const container = document.getElementById('large-order-summary-content');
    if (!container) return;

    // 生成多个交易对的Summary卡片
    container.innerHTML = dataArray.map(data => this.generateSymbolCard(data)).join('');

    // 渲染第一个有数据的交易对的详细表格
    const dataWithEntries = dataArray.find(d => d.trackedEntriesCount > 0);
    if (dataWithEntries) {
      this.renderTable(dataWithEntries);
    } else {
      // 都没有数据，显示第一个
      this.renderTable(dataArray[0]);
    }
  }

  /**
   * 生成单个交易对卡片（新增）
   */
  generateSymbolCard(data) {
    const actionColor = this.getActionColor(data.finalAction);
    const buyScore = (data.buyScore || 0).toFixed(2);
    const sellScore = (data.sellScore || 0).toFixed(2);

    // 买卖力量百分比
    const totalScore = parseFloat(buyScore) + parseFloat(sellScore);
    const buyPct = totalScore > 0 ? (parseFloat(buyScore) / totalScore * 100).toFixed(0) : 50;
    const sellPct = totalScore > 0 ? (parseFloat(sellScore) / totalScore * 100).toFixed(0) : 50;

    // Trap标记
    const trapIndicator = data.trap && data.trap.detected
      ? `<span class="trap-${data.trap.type === 'BULL_TRAP' ? 'bull' : 'bear'}">
           ⚠️ ${data.trap.type === 'BULL_TRAP' ? '诱多' : '诱空'} (${data.trap.confidence.toFixed(0)}%)
         </span>`
      : '';

    return `
      <div class="symbol-card" style="margin-bottom: 20px; padding: 20px; background: white; border-radius: 8px; border-left: 4px solid ${actionColor};">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <div>
            <h3 style="margin: 0; font-size: 20px;">${data.symbol}</h3>
            <div style="margin-top: 5px;">
              <span class="badge" style="background: ${actionColor}; color: white; padding: 4px 12px; border-radius: 12px;">
                ${this.getActionText(data.finalAction)}
              </span>
              ${trapIndicator}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 24px; font-weight: bold;">${data.trackedEntriesCount}个</div>
            <div style="font-size: 12px; color: #666;">追踪挂单 (>1M USD)</div>
          </div>
        </div>
        
        <!-- 买卖力量对比 -->
        <div style="margin: 15px 0;">
          <div style="font-size: 13px; color: #666; margin-bottom: 5px;">买卖力量对比</div>
          <div style="display: flex; height: 30px; border-radius: 15px; overflow: hidden; background: #e9ecef;">
            <div style="width: ${buyPct}%; background: linear-gradient(90deg, #28a745, #20c997); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">
              ${buyPct > 20 ? `买 ${buyScore}` : ''}
            </div>
            <div style="width: ${sellPct}%; background: linear-gradient(90deg, #ffc107, #fd7e14); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">
              ${sellPct > 20 ? `卖 ${sellScore}` : ''}
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 5px; font-size: 12px; color: #666;">
            <span>买方 ${buyPct}%</span>
            <span>卖方 ${sellPct}%</span>
          </div>
        </div>
        
        <!-- 关键指标 -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 15px;">
          <div style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 6px;">
            <div style="font-size: 11px; color: #666;">CVD累积</div>
            <div style="font-size: 16px; font-weight: bold; color: ${data.cvdCum >= 0 ? '#28a745' : '#dc3545'};">
              ${data.cvdCum >= 0 ? '+' : ''}${this.formatNumber(data.cvdCum || 0)}
            </div>
          </div>
          <div style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 6px;">
            <div style="font-size: 11px; color: #666;">OI变化</div>
            <div style="font-size: 16px; font-weight: bold; color: ${data.oiChangePct >= 0 ? '#28a745' : '#dc3545'};">
              ${data.oiChangePct >= 0 ? '+' : ''}${(data.oiChangePct || 0).toFixed(2)}%
            </div>
          </div>
          <div style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 6px;">
            <div style="font-size: 11px; color: #666;">Spoof</div>
            <div style="font-size: 16px; font-weight: bold; color: ${data.spoofCount > 0 ? '#fd7e14' : '#6c757d'};">
              ${data.spoofCount > 0 ? '⚠️ ' : ''}${data.spoofCount || 0}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 获取动作文本（新增）
   */
  getActionText(action) {
    const textMap = {
      'ACCUMULATE': '吸筹',
      'MARKUP': '拉升',
      'DISTRIBUTION': '派发',
      'MARKDOWN': '砸盘',
      'MANIPULATION': '操纵',
      'UNKNOWN': '观察'
    };
    return textMap[action] || action;
  }

  render(data) {
    this.renderSummary(data);
    this.renderTable(data);
  }

  renderSummary(data) {
    const container = document.getElementById('large-order-summary-content');
    if (!container) {
      console.error('[LargeOrders] Summary容器未找到');
      return;
    }

    const actionColor = this.getActionColor(data.finalAction);
    const buyScore = (data.buyScore !== undefined && data.buyScore !== null) ? data.buyScore.toFixed(2) : '0.00';
    const sellScore = (data.sellScore !== undefined && data.sellScore !== null) ? data.sellScore.toFixed(2) : '0.00';
    const oiChangePct = (data.oiChangePct !== undefined && data.oiChangePct !== null) ? data.oiChangePct.toFixed(2) : '0.00';

    // Trap信息
    const trapIndicator = data.trap && data.trap.detected
      ? `<span class="trap-${data.trap.type === 'BULL_TRAP' ? 'bull' : 'bear'}">
           ⚠️ ${data.trap.type === 'BULL_TRAP' ? '诱多' : '诱空'} (${data.trap.confidence.toFixed(0)}%)
         </span>`
      : '';

    container.innerHTML = `
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-label">交易对</div>
          <div class="summary-value">${data.symbol || 'N/A'}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">最终动作</div>
          <div class="summary-value action-${(data.finalAction || 'UNKNOWN').toLowerCase()}">
            ${data.finalAction || 'UNKNOWN'}
            ${trapIndicator}
          </div>
        </div>
        <div class="summary-item">
          <div class="summary-label">买入得分</div>
          <div class="summary-value">${buyScore}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">卖出得分</div>
          <div class="summary-value">${sellScore}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">CVD累积</div>
          <div class="summary-value">${this.formatNumber(data.cvdCum || 0)}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">OI变化</div>
          <div class="summary-value">${oiChangePct}%</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Spoof数量</div>
          <div class="summary-value">${data.spoofCount || 0}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">追踪挂单</div>
          <div class="summary-value">${data.trackedEntriesCount || 0}</div>
        </div>
      </div>
      <div style="margin-top: 15px; padding: 10px; background: #fff3cd; border-radius: 4px; font-size: 13px;">
        💡 说明：大额挂单监控采用按需检测模式，点击"刷新数据"按钮可获取最新数据。当前没有追踪挂单表示市场上暂无>100M USD的大额挂单（正常现象）。
      </div>
    `;

    console.log('[LargeOrders] Summary渲染完成');
  }

  renderTable(data) {
    const tbody = document.getElementById('large-order-table-body');
    if (!tbody) return;

    const entries = data.trackedEntries || [];

    if (entries.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center">暂无追踪挂单</td></tr>';
      return;
    }

    tbody.innerHTML = entries.map((entry, index) => {
      const sideClass = entry.side === 'bid' ? 'buy' : 'sell';
      const classificationClass = this.getClassificationClass(entry.classification);
      const impactWarning = entry.impactRatio >= 0.25 ? '<span style="color: red;">⚠️</span>' : '';

      return `
        <tr class="${classificationClass}">
          <td>${index + 1}</td>
          <td><span class="badge badge-${sideClass}">${entry.side === 'bid' ? '买' : '卖'}</span></td>
          <td>${entry.price.toFixed(2)}</td>
          <td>${this.formatNumber(entry.qty)}</td>
          <td>${this.formatUSD(entry.valueUSD)}</td>
          <td>${(entry.impactRatio * 100).toFixed(1)}% ${impactWarning}</td>
          <td><span class="classification-badge ${entry.classification.toLowerCase()}">${this.translateClassification(entry.classification)}</span></td>
          <td>${entry.isPersistent ? '🟢' : '⚪'}</td>
          <td>${entry.wasConsumed ? '✅ 已吃' : (entry.isSpoof ? '⚠️ 诱导' : '—')}</td>
        </tr>
      `;
    }).join('');
  }

  getActionClass(action) {
    const map = {
      'ACCUMULATE/MARKUP': 'accumulate',
      'DISTRIBUTION/MARKDOWN': 'distribution',
      'MANIPULATION': 'manipulation',
      'NEUTRAL': 'neutral'
    };
    return map[action] || 'unknown';
  }

  getActionColor(action) {
    const map = {
      'ACCUMULATE/MARKUP': '#28a745',
      'DISTRIBUTION/MARKDOWN': '#dc3545',
      'MANIPULATION': '#ffc107',
      'NEUTRAL': '#6c757d',
      'UNKNOWN': '#6c757d'
    };
    return map[action] || '#6c757d';
  }

  getClassificationClass(classification) {
    const map = {
      'DEFENSIVE_BUY': 'defensive-buy',
      'DEFENSIVE_SELL': 'defensive-sell',
      'SWEEP_BUY': 'sweep-buy',
      'SWEEP_SELL': 'sweep-sell',
      'SPOOF': 'spoof',
      'MANIPULATION': 'manipulation'
    };
    return map[classification] || '';
  }

  translateClassification(classification) {
    const map = {
      'DEFENSIVE_BUY': '防守买',
      'DEFENSIVE_SELL': '防守卖',
      'SWEEP_BUY': '扫单买',
      'SWEEP_SELL': '扫单卖',
      'SPOOF': '诱导',
      'MANIPULATION': '操纵',
      'UNKNOWN': '未知'
    };
    return map[classification] || classification;
  }

  formatNumber(num) {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
    return num.toFixed(2);
  }

  formatUSD(num) {
    if (!num) return '$0';
    if (num >= 1000000) return '$' + (num / 1000000).toFixed(1) + 'M';
    return '$' + this.formatNumber(num);
  }

  updateLastUpdate() {
    const updateSpan = document.getElementById('lo-last-update');
    if (updateSpan) {
      const now = new Date();
      updateSpan.textContent = `更新于 ${now.toLocaleTimeString()}`;
    }
  }

  showError(message) {
    const container = document.getElementById('large-order-summary-content');
    if (container) {
      container.innerHTML = `<div class="error-message">${message}</div>`;
    }
  }

  startAutoRefresh() {
    this.stopAutoRefresh();
    this.loadHistoricalData();  // 改为加载历史数据（7天累计）
    this.refreshInterval = setInterval(() => this.loadHistoricalData(), 60000); // 60秒刷新
  }

  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * 查询持续超过指定天数的大额挂单
   */
  async queryPersistentOrders() {
    try {
      const days = document.getElementById('persistent-days').value;
      const amount = document.getElementById('persistent-amount').value;

      console.log(`[LargeOrders] 查询持续${days}天且>${amount}USD的挂单...`);

      const response = await fetch(`/api/v1/large-orders-advanced/persistent-orders?symbols=BTCUSDT,ETHUSDT&minDays=${days}&minAmount=${amount}`);
      const result = await response.json();

      if (result.success && result.data) {
        this.renderPersistentOrders(result.data, result.criteria);
      } else {
        this.showQueryError('查询持续挂单失败: ' + (result.error || '未知错误'));
      }
    } catch (error) {
      console.error('[LargeOrders] 查询持续挂单失败', error);
      this.showQueryError('查询失败: ' + error.message);
    }
  }

  /**
   * 查询超大额挂单（实时最新）
   */
  async queryMegaOrders() {
    try {
      const amount = document.getElementById('mega-amount').value;

      console.log(`[LargeOrders] 查询>${amount}USD的超大挂单...`);

      const response = await fetch(`/api/v1/large-orders-advanced/mega-orders?symbols=BTCUSDT,ETHUSDT&minAmount=${amount}`);
      const result = await response.json();

      if (result.success && result.data) {
        this.renderMegaOrders(result.data, result.criteria);
      } else {
        this.showQueryError('查询超大挂单失败: ' + (result.error || '未知错误'));
      }
    } catch (error) {
      console.error('[LargeOrders] 查询超大挂单失败', error);
      this.showQueryError('查询失败: ' + error.message);
    }
  }

  /**
   * 渲染持续挂单查询结果
   */
  renderPersistentOrders(data, criteria) {
    const container = document.getElementById('query-results');
    if (!container) return;

    let html = `
      <div class="query-result-card" style="background: white; border: 1px solid #28a745; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <div class="result-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h4 style="margin: 0; color: #28a745;">
            📅 持续${criteria.minDays}天且>${this.formatNumber(criteria.minAmount)}USD的挂单
          </h4>
          <span class="badge" style="background: #28a745; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
            ${new Date().toLocaleTimeString()}
          </span>
        </div>
    `;

    for (const [symbol, symbolData] of Object.entries(data)) {
      if (symbolData.totalOrders > 0) {
        html += `
          <div class="symbol-section" style="margin-bottom: 20px;">
            <h5 style="margin: 0 0 10px 0; color: #333;">${symbol}</h5>
            <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-bottom: 15px;">
              <div class="stat-item" style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 6px;">
                <div style="font-size: 18px; font-weight: bold; color: #28a745;">${symbolData.totalOrders}</div>
                <div style="font-size: 12px; color: #666;">总挂单数</div>
              </div>
              <div class="stat-item" style="text-align: center; padding: 10px; background: #d4edda; border-radius: 6px;">
                <div style="font-size: 18px; font-weight: bold; color: #155724;">${symbolData.buyOrders}</div>
                <div style="font-size: 12px; color: #666;">买单 (${symbolData.buyRatio}%)</div>
              </div>
              <div class="stat-item" style="text-align: center; padding: 10px; background: #f8d7da; border-radius: 6px;">
                <div style="font-size: 18px; font-weight: bold; color: #721c24;">${symbolData.sellOrders}</div>
                <div style="font-size: 12px; color: #666;">卖单 (${symbolData.sellRatio}%)</div>
              </div>
              <div class="stat-item" style="text-align: center; padding: 10px; background: #fff3cd; border-radius: 6px;">
                <div style="font-size: 16px; font-weight: bold; color: #856404;">${this.formatNumber(symbolData.totalValue)}</div>
                <div style="font-size: 12px; color: #666;">总价值 USD</div>
              </div>
            </div>
            <div class="orders-list" style="max-height: 200px; overflow-y: auto;">
              ${symbolData.orders.map(order => `
                <div class="order-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #eee;">
                  <div>
                    <span class="badge ${order.side === 'bid' ? 'badge-buy' : 'badge-sell'}" style="margin-right: 8px;">
                      ${order.side === 'bid' ? '买单' : '卖单'}
                    </span>
                    <span style="font-weight: bold;">${this.formatNumber(order.price)}</span>
                    <span style="color: #666; font-size: 12px;">(${order.durationDays}天)</span>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-weight: bold; color: #28a745;">${this.formatNumber(order.valueUSD)} USD</div>
                    <div style="font-size: 11px; color: #666;">出现${order.appearances}次</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      } else {
        html += `
          <div class="symbol-section" style="margin-bottom: 20px;">
            <h5 style="margin: 0 0 10px 0; color: #333;">${symbol}</h5>
            <div style="text-align: center; padding: 20px; color: #666; background: #f8f9fa; border-radius: 6px;">
              暂无持续${criteria.minDays}天且>${this.formatNumber(criteria.minAmount)}USD的挂单
            </div>
          </div>
        `;
      }
    }

    html += `</div>`;
    container.innerHTML = html;
  }

  /**
   * 渲染超大挂单查询结果
   */
  renderMegaOrders(data, criteria) {
    const container = document.getElementById('query-results');
    if (!container) return;

    let html = `
      <div class="query-result-card" style="background: white; border: 1px solid #ffc107; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <div class="result-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h4 style="margin: 0; color: #ffc107;">
            ⚡ >${this.formatNumber(criteria.minAmount)}USD的超大挂单 (24小时内)
          </h4>
          <span class="badge" style="background: #ffc107; color: #000; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
            ${new Date().toLocaleTimeString()}
          </span>
        </div>
    `;

    for (const [symbol, symbolData] of Object.entries(data)) {
      if (symbolData.totalOrders > 0) {
        html += `
          <div class="symbol-section" style="margin-bottom: 20px;">
            <h5 style="margin: 0 0 10px 0; color: #333;">${symbol}</h5>
            <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-bottom: 15px;">
              <div class="stat-item" style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 6px;">
                <div style="font-size: 18px; font-weight: bold; color: #ffc107;">${symbolData.totalOrders}</div>
                <div style="font-size: 12px; color: #666;">总挂单数</div>
              </div>
              <div class="stat-item" style="text-align: center; padding: 10px; background: #fff3cd; border-radius: 6px;">
                <div style="font-size: 18px; font-weight: bold; color: #856404;">${symbolData.activeOrders}</div>
                <div style="font-size: 12px; color: #666;">活跃挂单</div>
              </div>
              <div class="stat-item" style="text-align: center; padding: 10px; background: #d4edda; border-radius: 6px;">
                <div style="font-size: 18px; font-weight: bold; color: #155724;">${symbolData.buyOrders}</div>
                <div style="font-size: 12px; color: #666;">买单 (${symbolData.buyRatio}%)</div>
              </div>
              <div class="stat-item" style="text-align: center; padding: 10px; background: #f8d7da; border-radius: 6px;">
                <div style="font-size: 18px; font-weight: bold; color: #721c24;">${symbolData.sellOrders}</div>
                <div style="font-size: 12px; color: #666;">卖单 (${symbolData.sellRatio}%)</div>
              </div>
              <div class="stat-item" style="text-align: center; padding: 10px; background: #fff3cd; border-radius: 6px;">
                <div style="font-size: 16px; font-weight: bold; color: #856404;">${this.formatNumber(symbolData.totalValue)}</div>
                <div style="font-size: 12px; color: #666;">总价值 USD</div>
              </div>
            </div>
            <div class="orders-list" style="max-height: 200px; overflow-y: auto;">
              ${symbolData.orders.map(order => `
                <div class="order-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #eee;">
                  <div>
                    <span class="badge ${order.side === 'bid' ? 'badge-buy' : 'badge-sell'}" style="margin-right: 8px;">
                      ${order.side === 'bid' ? '买单' : '卖单'}
                    </span>
                    <span style="font-weight: bold;">${this.formatNumber(order.price)}</span>
                    <span class="badge ${order.isActive ? 'badge-success' : 'badge-secondary'}" style="margin-left: 8px; font-size: 10px;">
                      ${order.isActive ? '活跃' : `${order.ageMinutes}分钟前`}
                    </span>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-weight: bold; color: #ffc107;">${this.formatNumber(order.valueUSD)} USD</div>
                    <div style="font-size: 11px; color: #666;">出现${order.appearances}次</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      } else {
        html += `
          <div class="symbol-section" style="margin-bottom: 20px;">
            <h5 style="margin: 0 0 10px 0; color: #333;">${symbol}</h5>
            <div style="text-align: center; padding: 20px; color: #666; background: #f8f9fa; border-radius: 6px;">
              暂无>${this.formatNumber(criteria.minAmount)}USD的超大挂单
            </div>
          </div>
        `;
      }
    }

    html += `</div>`;
    container.innerHTML = html;
  }

  /**
   * 显示查询错误
   */
  showQueryError(message) {
    const container = document.getElementById('query-results');
    if (!container) return;

    container.innerHTML = `
      <div class="error-card" style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <div style="display: flex; align-items: center;">
          <i class="fas fa-exclamation-triangle" style="color: #721c24; margin-right: 10px; font-size: 18px;"></i>
          <div>
            <h5 style="margin: 0; color: #721c24;">查询失败</h5>
            <p style="margin: 5px 0 0 0; color: #721c24;">${message}</p>
          </div>
        </div>
      </div>
    `;
  }
}

// 全局实例
let largeOrdersTracker;

// DOM加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    largeOrdersTracker = new LargeOrdersTracker();
  });
} else {
  largeOrdersTracker = new LargeOrdersTracker();
}

// 全局函数已移除，改为使用事件监听器避免CSP问题

