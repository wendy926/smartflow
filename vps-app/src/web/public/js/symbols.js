// symbols.js - 交易对管理功能

// 显示交易对列表
async function showSymbolsList() {
  try {
    const response = await fetch('/api/symbols');
    const symbols = await response.json();

    let symbolsHtml = `
      <div class="symbols-list">
        <h4>📊 交易对列表</h4>
        <div class="symbols-header">
          <div class="symbols-search">
            <input type="text" id="symbolSearch" placeholder="搜索交易对..." onkeyup="filterSymbols()">
          </div>
          <div class="symbols-actions">
            <button class="btn primary" onclick="addSymbol()">➕ 添加交易对</button>
          </div>
        </div>
        <div class="symbols-table-container">
          <table class="symbols-table">
            <thead>
              <tr>
                <th>交易对</th>
                <th>分类</th>
                <th>状态</th>
                <th>最后更新</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
    `;

    symbols.forEach(symbol => {
      const statusClass = symbol.isActive ? 'active' : 'inactive';
      const lastUpdate = symbol.lastUpdate ? new Date(symbol.lastUpdate).toLocaleString('zh-CN') : '--';

      symbolsHtml += `
        <tr class="symbol-row ${statusClass}" data-symbol="${symbol.symbol}">
          <td class="symbol-cell">${symbol.symbol}</td>
          <td class="category-cell">${app.getCategoryDisplay(symbol.category)}</td>
          <td class="status-cell ${statusClass}">${symbol.isActive ? '✅ 活跃' : '❌ 非活跃'}</td>
          <td class="time-cell">${lastUpdate}</td>
          <td class="action-cell">
            <button class="btn btn-sm secondary" onclick="removeCustomSymbol('${symbol.symbol}')">删除</button>
          </td>
        </tr>
      `;
    });

    symbolsHtml += `
            </tbody>
          </table>
        </div>
      </div>
    `;

    const modal = new Modal();
    modal.show('交易对管理', symbolsHtml);
  } catch (error) {
    console.error('加载交易对列表失败:', error);
    modal.showMessage('加载交易对列表失败: ' + error.message, 'error');
  }
}

// 添加交易对
async function addSymbol() {
  const symbol = prompt('请输入要添加的交易对（如：BTCUSDT）:');
  if (!symbol) return;

  const symbolUpper = symbol.toUpperCase();

  // 验证交易对格式
  if (!/^[A-Z]{3,10}USDT$/.test(symbolUpper)) {
    alert('交易对格式不正确，应为如 BTCUSDT 的格式');
    return;
  }

  try {
    const response = await fetch('/api/symbols', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        symbol: symbolUpper,
        category: 'custom'
      })
    });

    const result = await response.json();

    if (result.success) {
      modal.showMessage(`交易对 ${symbolUpper} 添加成功`, 'success');
      // 刷新交易对列表
      showSymbolsList();
    } else {
      modal.showMessage('添加交易对失败: ' + result.message, 'error');
    }
  } catch (error) {
    console.error('添加交易对失败:', error);
    modal.showMessage('添加交易对失败: ' + error.message, 'error');
  }
}

// 删除自定义交易对
async function removeCustomSymbol(symbol) {
  if (!confirm(`确定要删除交易对 ${symbol} 吗？`)) return;

  try {
    const response = await fetch(`/api/symbols/${symbol}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (result.success) {
      modal.showMessage(`交易对 ${symbol} 删除成功`, 'success');
      // 刷新交易对列表
      showSymbolsList();
    } else {
      modal.showMessage('删除交易对失败: ' + result.message, 'error');
    }
  } catch (error) {
    console.error('删除交易对失败:', error);
    modal.showMessage('删除交易对失败: ' + error.message, 'error');
  }
}

// 过滤交易对
function filterSymbols() {
  const searchInput = document.getElementById('symbolSearch');
  const searchTerm = searchInput.value.toLowerCase();
  const symbolRows = document.querySelectorAll('.symbol-row');

  symbolRows.forEach(row => {
    const symbol = row.dataset.symbol.toLowerCase();
    if (symbol.includes(searchTerm)) {
      row.style.display = 'table-row';
    } else {
      row.style.display = 'none';
    }
  });
}
